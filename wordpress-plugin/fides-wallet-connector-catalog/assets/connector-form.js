/**
 * FIDES Wallet Connector Catalog - submit / update form.
 *
 * Mirrors the Wallet Catalog form (wallet-form.js): same markup, class names, lookups,
 * validation UX and REST contract (fides-catalog/v1/submissions/<type>). Only the
 * connector-specific fields and conditional rules differ. Conditional rules live in
 * connector-form-rules.js (FidesConnectorFormRules).
 */
(function () {
  const config = window.FIDES_WALLET_CONNECTOR_FORM_CONFIG || {};
  const Rules = window.FidesConnectorFormRules;
  const mode = config.mode === "update" ? "update" : "create";
  const root =
    document.getElementById(
      mode === "update" ? "fides-connector-update-form-root" : "fides-connector-submit-form-root"
    ) || document.querySelector(".fides-connector-submission-root");
  if (!root || !Rules) return;

  const SUBMISSION_TYPE = "wallet-connector";
  const apiBase = String(config.apiBase || "").replace(/\/$/, "");
  const restNonce = String(config.restNonce || "").trim();
  const contactEmail = String(config.contactEmail || "").trim();
  const fieldHelp = config.fieldHelp && typeof config.fieldHelp === "object" ? config.fieldHelp : {};
  const enums = config.enums && typeof config.enums === "object" ? config.enums : {};
  const enumLabels = config.enumLabels && typeof config.enumLabels === "object" ? config.enumLabels : {};
  const limits = config.limits && typeof config.limits === "object" ? config.limits : {};
  const sectionIntro = String(config.sectionIntro || "").trim();
  const VOCABULARY_URL = config.vocabularyUrl ? String(config.vocabularyUrl) : "";
  const VOCABULARY_FALLBACK_URL = config.vocabularyFallbackUrl ? String(config.vocabularyFallbackUrl) : "";
  const WALLET_CATALOG_URL = config.walletCatalogUrl ? String(config.walletCatalogUrl) : "";
  let vocabulary = null;
  let wallets = Array.isArray(config.wallets) ? config.wallets.slice() : [];

  const FORM_FIELD_TO_VOCAB = {
    connectorFunctions: "capabilities",
    vcFormat: "vcFormat",
    issuanceProtocols: "issuanceProtocol",
    presentationProtocols: "presentationProtocol",
    interoperabilityProfiles: "interopProfile",
    credentialStatusMethods: "credentialStatus",
  };

  /** Map form option values to vocabulary.json term keys (when they differ). */
  const FORM_OPTION_TO_VOCAB = {
    capabilities: { issuer: "issuer", verifier: "verifier" },
    issuanceProtocol: {
      OpenID4VCI: "OpenID4VCI",
      "DIDComm Issue Credential v2": "DIDComm v2",
      "DIDComm Issue Credential v1": "DIDComm v1",
    },
    presentationProtocol: {
      "DIDComm Present Proof v2": "DIDComm v2",
    },
    credentialStatus: {
      "JWT Validity": "jwtValidity",
      "IETF Token Status List": "ietfTokenStatusList",
      "PKI Cert Validity": "pkiCertValidity",
    },
  };

  let selectedConnectorId = mode === "update" ? String(config.preselectConnectorId || "").trim() : "";
  let selectedConnectorLabel = "";
  let selectedOrgId = "";
  let selectedOrgLabel = "";
  let orgHasQeaa = null;
  let compatSelected = [];
  const playgroundRowsState = [{ url: "" }];

  /* ---------------------------------------------- Community / Pro listing tier
   * Mirrors the Wallet Catalog form: Community listings lock the Pro fields and cap the description;
   * the server enforces the same rules (Fides_Wallet_Connector_Catalog_Tier). */

  let planTier =
    config.planTier && typeof config.planTier === "object"
      ? { ...config.planTier }
      : { tierUiEnabled: false, tier: "Community", isPro: false, hasFullListing: false, plansUrl: "/plans/", descriptionMaxLength: 2000 };

  function tierUiEnabled() {
    return planTier.tierUiEnabled === true;
  }

  function fullListingFieldsEnabled() {
    return !tierUiEnabled() || !!planTier.isPro || !!planTier.hasFullListing;
  }

  /** Connector fields that correspond to the wallet Pro fields (website, documentation, repository). */
  const CONNECTOR_PRO_FIELD_IDS = [
    "fides-connector-website",
    "fides-connector-documentation",
    "fides-connector-repository",
  ];

  function proBadgeHtml() {
    if (!!planTier.isPro || planTier.tier === "Pro") {
      return '<span class="fides-pro-plan-badge fides-pro-plan-badge--label">Pro plan</span>';
    }
    if (fullListingFieldsEnabled()) {
      return '<span class="fides-pro-plan-badge fides-pro-plan-badge--label">Full listing</span>';
    }
    const url = String(planTier.plansUrl || "/plans/");
    return `<a href="${escapeHtml(url)}" class="fides-pro-plan-badge" target="_blank" rel="noopener">Pro plan</a>`;
  }

  function labelWithProIfNeeded(labelText, isProField) {
    if (!tierUiEnabled() || !isProField) return labelText;
    return `${labelText} ${proBadgeHtml()}`;
  }

  function updateProFieldLabels() {
    root.querySelectorAll("[data-pro-label]").forEach((el) => {
      const text = el.getAttribute("data-pro-label");
      if (text) el.innerHTML = labelWithProIfNeeded(text, true);
    });
  }

  async function refreshPlanTier(orgId) {
    const id = String(orgId || "").trim();
    if (!id || !apiBase) {
      planTier = {
        tierUiEnabled: planTier.tierUiEnabled,
        tier: "Community",
        isPro: false,
        hasFullListing: false,
        plansUrl: planTier.plansUrl || "/plans/",
        descriptionMaxLength: 200,
      };
      applyTierFieldState();
      return;
    }
    const headers = {};
    if (restNonce) headers["X-WP-Nonce"] = restNonce;
    try {
      const response = await fetch(`${apiBase}/org-tier?orgId=${encodeURIComponent(id)}`, {
        credentials: "same-origin",
        headers,
      });
      const json = await response.json().catch(() => ({}));
      if (response.ok && json && typeof json === "object") {
        planTier = { ...planTier, ...json };
      }
    } catch (_err) {
      /* keep current tier */
    }
    applyTierFieldState();
  }

  const CONNECTOR_DESC_MAX_COMMUNITY = 200;
  const CONNECTOR_DESC_MAX_PRO = 2000;

  function connectorDescriptionMaxLength() {
    if (!tierUiEnabled()) {
      return CONNECTOR_DESC_MAX_PRO;
    }
    const fromConfig = Number(planTier.descriptionMaxLength);
    if (fromConfig > 0) {
      return fromConfig;
    }
    return fullListingFieldsEnabled() ? CONNECTOR_DESC_MAX_PRO : CONNECTOR_DESC_MAX_COMMUNITY;
  }

  function updateDescriptionLimitUi() {
    const maxLen = connectorDescriptionMaxLength();
    const hasFullListing = fullListingFieldsEnabled();
    const descEl = root.querySelector("#fides-connector-description");
    const labelEl = root.querySelector("#fides-connector-description-label");
    const noticeEl = root.querySelector("#fides-connector-description-limit-notice");
    if (descEl) descEl.maxLength = maxLen;
    if (labelEl) {
      labelEl.textContent = "Description *";
    }
    if (noticeEl) {
      const plansUrl = escapeHtml(String(planTier.plansUrl || "/plans/"));
      if (hasFullListing) {
        noticeEl.textContent = `You can use up to ${CONNECTOR_DESC_MAX_PRO.toLocaleString("en-US")} characters in the published catalog description.`;
      } else {
        noticeEl.innerHTML = `Community plan: maximum ${CONNECTOR_DESC_MAX_COMMUNITY} characters in the catalog. <a href="${plansUrl}" target="_blank" rel="noopener">Pro plan</a> allows up to ${CONNECTOR_DESC_MAX_PRO.toLocaleString("en-US")} characters.`;
      }
    }
    updateDescriptionCounter();
  }

  function updatePlanTierBadgeEl(badge, visible) {
    if (!badge) return;
    if (!tierUiEnabled() || !visible) {
      badge.hidden = true;
      badge.textContent = "";
      return;
    }
    const isPro = !!planTier.isPro;
    const hasFullListing = fullListingFieldsEnabled();
    badge.hidden = false;
    badge.textContent = isPro ? "Pro plan" : hasFullListing ? "Full Community listing" : "Community plan";
    badge.className = `fides-update-banner-plan ${isPro ? "fides-pro-plan-badge" : "fides-free-plan-badge"}`;
    badge.title = isPro
      ? "This organization has a linked Pro account. Extended connector catalog fields are enabled."
      : hasFullListing
        ? "This Community listing includes all connector catalog fields."
        : "Community plan limits apply to fields published in the catalog.";
  }

  function updatePlanTierBanner() {
    updatePlanTierBadgeEl(
      root.querySelector("#fides-connector-update-plan-tier-badge"),
      mode === "update" && Boolean(selectedConnectorId) && Boolean(selectedOrgId)
    );
    updatePlanTierBadgeEl(
      root.querySelector("#fides-connector-org-plan-tier-badge"),
      mode === "create" && Boolean(selectedOrgId)
    );
  }

  function applyTierFieldState() {
    const hasFullListing = fullListingFieldsEnabled();
    CONNECTOR_PRO_FIELD_IDS.forEach((fieldId) => {
      const el = root.querySelector(`#${fieldId}`);
      if (!el) return;
      el.disabled = !hasFullListing;
      el.readOnly = !hasFullListing;
      el.classList.toggle("fides-input-pro-locked", !hasFullListing);
      const row = el.closest(".fides-form-row");
      if (row) row.classList.toggle("fides-form-row--pro-locked", !hasFullListing);
    });
    updateLicenseOtherVisibility();
    updateDescriptionLimitUi();
    updatePlanTierBanner();
    updateProFieldLabels();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function helpText(key) {
    const text = fieldHelp[key];
    return typeof text === "string" ? text.trim() : "";
  }

  function helpHtml(key) {
    const text = helpText(key);
    return text ? `<p class="fides-help">${escapeHtml(text)}</p>` : "";
  }

  function slugify(text) {
    return String(text || "")
      .toLowerCase()
      .trim()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  function setHidden(el, hidden) {
    if (!el) return;
    el.hidden = hidden;
    el.setAttribute("aria-hidden", hidden ? "true" : "false");
    el.classList.toggle("is-hidden", hidden);
  }

  function enumList(key) {
    return Array.isArray(enums[key]) ? enums[key] : [];
  }

  function enumLabelList(key) {
    const labels = enumLabels[key];
    return labels && typeof labels === "object" ? labels : {};
  }

  function enumDisplayLabel(fieldKey, value) {
    const labels = enumLabelList(fieldKey);
    return labels[value] || value;
  }

  function checkboxGroupHtml(name, values, labels) {
    const labelMap = labels && typeof labels === "object" ? labels : {};
    return values
      .map((value) => {
        const display = labelMap[value] || value;
        return `
        <label class="fides-form-choice">
          <input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(value)}" data-field="${escapeHtml(name)}" />
          <span>${escapeHtml(display)}</span>
        </label>`;
      })
      .join("");
  }

  function labeledSelectOptionsHtml(values, labelMap, selected) {
    const labels = labelMap && typeof labelMap === "object" ? labelMap : {};
    return values
      .map((value) => {
        const sel = String(selected || "") === value ? " selected" : "";
        const label = labels[value] || value;
        return `<option value="${escapeHtml(value)}"${sel}>${escapeHtml(label)}</option>`;
      })
      .join("");
  }

  function accordionSection(title, intro, bodyHtml, options) {
    const opts = options || {};
    const introHtml = intro ? `<p class="fides-form-section-intro">${escapeHtml(intro)}</p>` : "";
    const sectionClass = opts.extraClass ? ` fides-form-accordion ${opts.extraClass}` : " fides-form-accordion";
    const badge = opts.required ? "Required" : "Optional";
    return `
      <details class="fides-form-section${sectionClass}"${opts.open ? " open" : ""}>
        <summary class="fides-form-accordion-summary">
          <span class="fides-form-accordion-heading">
            <span class="fides-form-section-title">${escapeHtml(title)}</span>
            <span class="fides-form-accordion-badge">${badge}</span>
          </span>
          <span class="fides-form-accordion-chevron" aria-hidden="true"></span>
        </summary>
        <div class="fides-form-accordion-panel">
          ${introHtml}
          <div class="fides-form-section-body">
            ${bodyHtml}
          </div>
        </div>
      </details>`;
  }

  function submissionItemUrl(connectorId) {
    const id = String(connectorId || "").trim();
    if (!/^[a-z0-9-]+$/.test(id)) return "";
    return `${apiBase}/submissions/${SUBMISSION_TYPE}/${encodeURIComponent(id)}`;
  }

  function formOrgPickerHtml() {
    return `
        <div id="fides-connector-org-picker" class="fides-form-section-body fides-org-update-picker-body">
          <div id="fides-connector-org-search-block" class="fides-linked-field">
            <label for="fides-connector-org-search">Organization *</label>
            ${helpHtml("orgSearch")}
            <div class="fides-linked-inputs">
              <input id="fides-connector-org-search" type="text" autocomplete="off" placeholder="Start typing organization name…" />
            </div>
            <div class="fides-lookup-panel">
              <p id="fides-connector-org-hint" class="fides-lookup-hint" hidden></p>
              <ul id="fides-connector-org-results" class="fides-lookup-results" role="listbox" aria-label="Organization search results"></ul>
            </div>
          </div>
          <div id="fides-connector-org-banner" class="fides-update-banner-row" hidden>
            <div class="fides-update-banner">
              <span class="fides-update-banner-label">Organization:</span>
              <strong id="fides-connector-org-name"></strong>
              <code id="fides-connector-org-id-display"></code>
              <span id="fides-connector-org-plan-tier-badge" class="fides-update-banner-plan" hidden></span>
            </div>
            <button type="button" class="fides-secondary-btn" id="fides-connector-org-change">Choose different</button>
          </div>
        </div>`;
  }

  function choiceRowHtml(fieldKey, rowKey, label, extra) {
    const vocab = FORM_FIELD_TO_VOCAB[fieldKey] ? ` data-vocab-field="${escapeHtml(fieldKey)}"` : "";
    return `
            <div class="fides-form-row"${vocab} data-row="${escapeHtml(rowKey || fieldKey)}"${extra || ""}>
              <span class="fides-form-label" id="fides-connector-${escapeHtml(fieldKey)}-label">${escapeHtml(label)}</span>
              ${helpHtml(fieldKey)}
              <div class="fides-form-choices" role="group" aria-labelledby="fides-connector-${escapeHtml(fieldKey)}-label">
                ${checkboxGroupHtml(fieldKey, enumList(fieldKey), enumLabelList(fieldKey))}
              </div>
            </div>`;
  }

  function formCoreFieldsHtml() {
    return `
      <div class="fides-form-section-body fides-connector-fields" hidden>
        <div class="fides-form-grid fides-form-grid-pair">
          <div class="fides-form-row" data-row="name">
            <label for="fides-connector-name">Connector name *</label>
            ${helpHtml("name")}
            <input id="fides-connector-name" name="name" type="text" required maxlength="${Number(limits.name) || 150}" />
          </div>
          <div class="fides-form-row" data-row="id">
            <label for="fides-connector-id">Connector id *</label>
            ${helpHtml("id")}
            <input id="fides-connector-id" name="id" type="text" required maxlength="80" pattern="[a-z0-9-]+" ${mode === "update" ? "readonly aria-readonly=\"true\"" : ""} />
          </div>
        </div>
        <div class="fides-form-grid fides-form-grid-pair">
          <div class="fides-form-row" data-row="status">
            <label for="fides-connector-status">Status *</label>
            ${helpHtml("status")}
            <select id="fides-connector-status" name="status" required>
              ${labeledSelectOptionsHtml(enumList("status"), enumLabelList("status"), "production")}
            </select>
          </div>
          <div class="fides-form-row" data-row="deploymentModel">
            <label for="fides-connector-deployment-model">Deployment model *</label>
            ${helpHtml("deploymentModel")}
            <select id="fides-connector-deployment-model" name="deploymentModel" required>
              <option value="">—</option>
              ${labeledSelectOptionsHtml(enumList("deploymentModel"), enumLabelList("deploymentModel"), "")}
            </select>
          </div>
        </div>
        <div class="fides-form-row" data-row="description">
          <label for="fides-connector-description" id="fides-connector-description-label">Description *</label>
          ${helpHtml("description")}
          <textarea id="fides-connector-description" name="description" required maxlength="${Number(limits.description) || 2000}" placeholder="Short description of the connector and the credential flows it supports."></textarea>
          <div class="fides-field-meta">
            <p class="fides-description-limit-notice fides-pro-field-notice" id="fides-connector-description-limit-notice"></p>
            <p class="fides-description-counter" id="fides-connector-description-counter" aria-live="polite"></p>
          </div>
        </div>
        <div class="fides-form-grid fides-form-grid-pair fides-form-grid-pair--aligned">
          ${choiceRowHtml("connectorFunctions", "connectorFunctions", "Connector functions *")}
          ${choiceRowHtml("serviceModels", "serviceModels", "Service models *")}
        </div>
        <div class="fides-form-grid fides-form-grid-pair">
          <div class="fides-form-row" data-row="logo">
            <label for="fides-connector-logo">Logo URL</label>
            ${helpHtml("logo")}
            <input id="fides-connector-logo" name="logo" type="url" placeholder="https://…/logo.png" />
          </div>
          <div class="fides-form-row" data-row="website">
            <label for="fides-connector-website" data-pro-label="Website">${labelWithProIfNeeded("Website", true)}</label>
            ${helpHtml("website")}
            <input id="fides-connector-website" name="website" type="url" placeholder="https://…" />
          </div>
        </div>
        <div class="fides-form-grid fides-form-grid-pair">
          <div class="fides-form-row" data-row="license">
            <label for="fides-connector-license">License *</label>
            ${helpHtml("license")}
            <select id="fides-connector-license" name="license" required>
              <option value="">—</option>
              ${labeledSelectOptionsHtml(enumList("license"), enumLabelList("license"), "")}
            </select>
          </div>
          <div class="fides-form-row" id="fides-connector-license-other-row" data-row="licenseOther">
            <label for="fides-connector-license-other">License (other)</label>
            ${helpHtml("licenseOther")}
            <input id="fides-connector-license-other" name="licenseOther" type="text" maxlength="${Number(limits.licenseOther) || 100}" placeholder="Custom license name" disabled />
          </div>
        </div>
        <div class="fides-form-grid fides-form-grid-pair">
          <div class="fides-form-row" data-row="documentation">
            <label for="fides-connector-documentation" data-pro-label="Documentation URL">${labelWithProIfNeeded("Documentation URL", true)}</label>
            ${helpHtml("documentation")}
            <input id="fides-connector-documentation" name="documentation" type="url" placeholder="https://…" />
          </div>
          <div class="fides-form-row" data-row="repository">
            <label for="fides-connector-repository" data-pro-label="Repository URL">${labelWithProIfNeeded("Repository URL", true)}</label>
            ${helpHtml("repository")}
            <input id="fides-connector-repository" name="repository" type="url" placeholder="https://github.com/…" />
          </div>
        </div>
        <div class="fides-form-row" data-row="playgroundUrls">
          <label>Playground URLs</label>
          ${helpHtml("playgroundUrls")}
          <div id="fides-connector-playground-rows" class="fides-media-rows" aria-live="polite"></div>
        </div>
        <div class="fides-form-row" data-row="walletRef">
          <label for="fides-connector-wallet-ref">Business wallet</label>
          ${helpHtml("walletRef")}
          <select id="fides-connector-wallet-ref" name="walletRef"></select>
          <p id="fides-connector-wallet-ref-hint" class="fides-help" hidden></p>
        </div>
        ${
          contactEmail
            ? `<div class="fides-form-row">
          <label for="fides-connector-contact">Contact email *</label>
          ${helpHtml("contactEmail")}
          <input id="fides-connector-contact" class="fides-input-locked" type="email" value="${escapeHtml(contactEmail)}" readonly aria-readonly="true" tabindex="-1" />
        </div>`
            : `<p class="fides-form-message is-error">Your WordPress profile must have a valid email address before you can submit.</p>`
        }
        <input type="hidden" id="fides-connector-org-id" name="orgId" value="" />
      </div>
    `;
  }

  function formAccordionSectionsHtml() {
    return `
        ${accordionSection(
          "Formats & protocols",
          "Credential formats and protocols. Issuance protocols apply to issuer connectors, presentation protocols to verifier connectors.",
          `
            ${choiceRowHtml("vcFormat", "vcFormat", "VC formats *")}
            ${choiceRowHtml("issuanceProtocols", "issuanceProtocols", "Issuance protocols *", ' data-protocol-group="issuance"')}
            ${choiceRowHtml("presentationProtocols", "presentationProtocols", "Presentation protocols *", ' data-protocol-group="presentation"')}
            ${choiceRowHtml("interoperabilityProfiles", "interoperabilityProfiles", "Interop profiles")}
            ${choiceRowHtml("credentialStatusMethods", "credentialStatusMethods", "Credential status")}`,
          { required: true, open: true }
        )}
        ${accordionSection(
          "Integrations",
          "How applications integrate with the connector.",
          `
            ${choiceRowHtml("backendIntegrations", "backendIntegrations", "Backend integrations *")}
            ${choiceRowHtml("frontendIntegrations", "frontendIntegrations", "Frontend integrations")}
            <div class="fides-form-row" data-row="certificateManagement">
              <label for="fides-connector-certificate-management">Certificate management</label>
              ${helpHtml("certificateManagement")}
              <select id="fides-connector-certificate-management" name="certificateManagement">
                <option value="">—</option>
                ${labeledSelectOptionsHtml(enumList("certificateManagement"), enumLabelList("certificateManagement"), "")}
              </select>
            </div>`,
          { required: true, open: true }
        )}
        ${accordionSection(
          "Wallet compatibility",
          "Personal wallets from the Wallet Catalog that work with this connector.",
          `
            <div class="fides-form-row" data-row="walletCompatibility">
              ${helpHtml("walletCompatibility")}
              <input id="fides-connector-compat-filter" type="text" autocomplete="off" placeholder="Filter personal wallets…" />
              <div id="fides-connector-compat-chips" class="fides-chip-list" aria-live="polite"></div>
              <div id="fides-connector-compat-list" class="fides-form-choices fides-connector-compat-list" role="group" aria-label="Personal wallets"></div>
              <p id="fides-connector-compat-hint" class="fides-help" hidden></p>
            </div>`
        )}
        ${accordionSection(
          "eIDAS roles",
          "Optional roles the provider fulfils with this connector. Roles appear for the selected functions and need their prerequisites.",
          `
            <div class="fides-form-row" data-row="eidasRoles">
              ${helpHtml("eidasRoles")}
              <div class="fides-form-choices fides-connector-eidas-roles" id="fides-connector-eidas-roles" role="group" aria-label="eIDAS roles"></div>
            </div>`,
          { extraClass: "fides-connector-eidas-section" }
        )}
    `;
  }

  const sectionTitle = mode === "update" ? "Suggest a connector update" : "Submit a connector";
  const sectionIntroHtml = sectionIntro
    ? `<p class="fides-form-section-intro">${escapeHtml(sectionIntro)}</p>`
    : "";

  root.innerHTML = `
    <section class="fides-use-case-card">
      <form id="fides-connector-form" class="fides-use-case-form fides-connector-form" novalidate>
        <section class="fides-form-section fides-form-section-first" aria-labelledby="fides-connector-section-title">
          <div class="fides-form-accordion-heading">
            <h3 id="fides-connector-section-title" class="fides-form-section-title">${escapeHtml(sectionTitle)}</h3>
          </div>
          ${sectionIntroHtml}
          ${
            mode === "update"
              ? `<div id="fides-connector-update-picker" class="fides-form-section-body fides-org-update-picker-body">
            <div id="fides-connector-search-block" class="fides-linked-field">
              <label for="fides-connector-search">Find connector *</label>
              ${helpHtml("connectorSearch")}
              <div class="fides-linked-inputs">
                <input id="fides-connector-search" type="text" autocomplete="off" placeholder="Start typing…" />
              </div>
              <div class="fides-lookup-panel">
                <p id="fides-connector-lookup-hint" class="fides-lookup-hint" hidden></p>
                <ul id="fides-connector-lookup-results" class="fides-lookup-results" role="listbox" aria-label="Search results"></ul>
              </div>
            </div>
            <div id="fides-connector-update-banner" class="fides-update-banner-row" hidden>
              <div class="fides-update-banner">
                <span class="fides-update-banner-label">Updating:</span>
                <strong id="fides-connector-update-name"></strong>
                <code id="fides-connector-update-id"></code>
                <span id="fides-connector-update-plan-tier-badge" class="fides-update-banner-plan" hidden></span>
              </div>
              <button type="button" class="fides-secondary-btn" id="fides-connector-change">Choose different</button>
            </div>
          </div>`
              : formOrgPickerHtml()
          }
          ${formCoreFieldsHtml()}
        </section>
        <div class="fides-connector-optional-sections" hidden>
          ${formAccordionSectionsHtml()}
        </div>
        <div id="fides-connector-submit-block" class="fides-org-submit-block" hidden>
          <div class="fides-consent">
            <label><input type="checkbox" name="consentPublish" required /> I confirm this information may be published *</label>
          </div>
          <div class="fides-form-actions">
            <button type="submit">${mode === "update" ? "Submit update proposal" : "Submit connector"}</button>
          </div>
        </div>
        <p id="fides-connector-form-message" class="fides-form-message" aria-live="polite"></p>
      </form>
    </section>
  `;

  const form = root.querySelector("#fides-connector-form");
  const messageEl = root.querySelector("#fides-connector-form-message");
  const fieldsWrap = root.querySelector(".fides-connector-fields");
  const nameInput = root.querySelector("#fides-connector-name");
  const idInput = root.querySelector("#fides-connector-id");
  const orgIdInput = root.querySelector("#fides-connector-org-id");
  const submitBlock = root.querySelector("#fides-connector-submit-block");
  const searchInput = root.querySelector("#fides-connector-search");
  const lookupResults = root.querySelector("#fides-connector-lookup-results");
  const lookupHint = root.querySelector("#fides-connector-lookup-hint");
  const updateBanner = root.querySelector("#fides-connector-update-banner");
  const searchBlock = root.querySelector("#fides-connector-search-block");
  const updateNameEl = root.querySelector("#fides-connector-update-name");
  const updateIdEl = root.querySelector("#fides-connector-update-id");
  const changeBtn = root.querySelector("#fides-connector-change");
  const descriptionEl = root.querySelector("#fides-connector-description");
  const licenseEl = root.querySelector("#fides-connector-license");
  const licenseOtherEl = root.querySelector("#fides-connector-license-other");
  const walletRefEl = root.querySelector("#fides-connector-wallet-ref");
  const playgroundRowsEl = root.querySelector("#fides-connector-playground-rows");

  /* ------------------------------------------------------------------ helpers */

  function val(selector) {
    const el = root.querySelector(selector);
    return el ? String(el.value || "").trim() : "";
  }

  function getCheckedValues(name) {
    return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map((el) => String(el.value));
  }

  function setCheckedValues(name, values) {
    const set = new Set((Array.isArray(values) ? values : []).map(String));
    form.querySelectorAll(`input[name="${name}"]`).forEach((el) => {
      el.checked = set.has(String(el.value));
    });
  }

  function currentRuleState() {
    return {
      orgId: selectedOrgId,
      connectorFunctions: getCheckedValues("connectorFunctions"),
      serviceModels: getCheckedValues("serviceModels"),
      interoperabilityProfiles: getCheckedValues("interoperabilityProfiles"),
      eidasRoles: getCheckedValues("eidasRoles"),
      license: licenseEl ? String(licenseEl.value || "") : "",
      licenseOther: licenseOtherEl ? String(licenseOtherEl.value || "") : "",
      issuanceProtocols: getCheckedValues("issuanceProtocols"),
      presentationProtocols: getCheckedValues("presentationProtocols"),
      vcFormat: getCheckedValues("vcFormat"),
      backendIntegrations: getCheckedValues("backendIntegrations"),
      deploymentModel: val("#fides-connector-deployment-model"),
      status: val("#fides-connector-status"),
      walletRef: walletRefEl ? String(walletRefEl.value || "") : "",
    };
  }

  /* ------------------------------------------------------------ description */

  function updateDescriptionCounter() {
    const counterEl = root.querySelector("#fides-connector-description-counter");
    if (!descriptionEl || !counterEl) return;
    const maxLen = Number(descriptionEl.maxLength) || Number(limits.description) || 2000;
    counterEl.textContent = `${String(descriptionEl.value || "").length.toLocaleString("en-US")} / ${maxLen.toLocaleString("en-US")} characters`;
  }

  /* ----------------------------------------------------------------- license */

  function updateLicenseOtherVisibility() {
    const otherRow = root.querySelector("#fides-connector-license-other-row");
    if (!licenseEl || !licenseOtherEl) return;
    const editable = Rules.licenseOtherApplies(licenseEl.value);
    licenseOtherEl.disabled = !editable;
    licenseOtherEl.readOnly = !editable;
    licenseOtherEl.required = editable;
    licenseOtherEl.classList.toggle("fides-input-pro-locked", !editable);
    setHidden(otherRow, !editable);
    if (!editable) licenseOtherEl.value = "";
  }

  /* -------------------------------------------------------- playground URLs */

  function playgroundMax() {
    return Number(limits.playgroundUrls) || 10;
  }

  function renderPlaygroundRows() {
    if (!playgroundRowsEl) return;
    const max = playgroundMax();
    const lastIndex = playgroundRowsState.length - 1;
    playgroundRowsEl.innerHTML = playgroundRowsState
      .map((entry, index) => {
        const isLast = index === lastIndex;
        const canAdd = playgroundRowsState.length < max;
        let rowAction = "";
        if (isLast && canAdd) {
          rowAction = `<button type="button" class="fides-secondary-btn fides-media-action-btn" data-add-playground="1">Add</button>`;
        } else if (!isLast || playgroundRowsState.length > 1) {
          rowAction = `<button type="button" class="fides-secondary-btn fides-media-action-btn" data-remove-playground="${index}" aria-label="Remove playground URL">Remove</button>`;
        }
        return `
          <div class="fides-media-row" data-playground-index="${index}">
            <div class="fides-media-inputs fides-media-inputs--video">
              <input type="url" class="fides-media-url-input" data-playground-url="${index}" value="${escapeHtml(entry.url || "")}" placeholder="https://playground.example.com" inputmode="url" autocomplete="url" />
              ${rowAction}
            </div>
          </div>`;
      })
      .join("");
  }

  function setPlaygroundRows(urls) {
    playgroundRowsState.length = 0;
    const list = (Array.isArray(urls) ? urls : []).slice(0, playgroundMax());
    if (list.length) {
      list.forEach((url) => playgroundRowsState.push({ url: String(url) }));
    } else {
      playgroundRowsState.push({ url: "" });
    }
    renderPlaygroundRows();
  }

  function initPlaygroundControls() {
    renderPlaygroundRows();
    if (!playgroundRowsEl) return;
    playgroundRowsEl.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || !target.hasAttribute("data-playground-url")) return;
      const index = Number(target.getAttribute("data-playground-url"));
      if (!Number.isFinite(index) || !playgroundRowsState[index]) return;
      playgroundRowsState[index].url = target.value.trim();
    });
    playgroundRowsEl.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.hasAttribute("data-add-playground")) {
        if (playgroundRowsState.length >= playgroundMax()) return;
        playgroundRowsState.push({ url: "" });
        renderPlaygroundRows();
        return;
      }
      const indexAttr = target.getAttribute("data-remove-playground");
      if (indexAttr == null) return;
      const index = Number(indexAttr);
      if (!Number.isFinite(index) || playgroundRowsState.length <= 1) return;
      playgroundRowsState.splice(index, 1);
      renderPlaygroundRows();
    });
  }

  /* ------------------------------------------------------------ wallet pickers */

  function walletLabel(wallet) {
    return wallet.provider ? `${wallet.name} (${wallet.provider})` : wallet.name;
  }

  /** Business wallet select (walletRef): only business wallets of the selected organization. */
  function renderWalletRefOptions(selectedId) {
    if (!walletRefEl) return;
    const wanted = selectedId !== undefined ? String(selectedId || "") : String(walletRefEl.value || "");
    const candidates = Rules.organizationalWalletsForOrg(wallets, selectedOrgId);
    const hint = root.querySelector("#fides-connector-wallet-ref-hint");
    let html = '<option value="">— None —</option>';
    candidates.forEach((wallet) => {
      html += `<option value="${escapeHtml(wallet.id)}">${escapeHtml(walletLabel(wallet))}</option>`;
    });
    if (wanted && !candidates.some((wallet) => wallet.id === wanted)) {
      html += `<option value="${escapeHtml(wanted)}">${escapeHtml(wanted)}</option>`;
    }
    walletRefEl.innerHTML = html;
    walletRefEl.value = wanted;
    if (hint) {
      const empty = candidates.length === 0;
      hint.hidden = !empty;
      hint.textContent = empty
        ? "This organization has no business wallet in the Wallet Catalog yet. Add one first to link it here."
        : "";
    }
  }

  function renderCompatChips() {
    const chips = root.querySelector("#fides-connector-compat-chips");
    if (!chips) return;
    const byId = new Map(wallets.map((wallet) => [wallet.id, wallet]));
    chips.innerHTML = compatSelected
      .map((id) => {
        const wallet = byId.get(id);
        const label = wallet ? wallet.name : id;
        return `<span class="fides-chip">${escapeHtml(label)}<button type="button" data-remove-compat="${escapeHtml(id)}" aria-label="Remove ${escapeHtml(label)}">×</button></span>`;
      })
      .join("");
  }

  function renderCompatList() {
    const listEl = root.querySelector("#fides-connector-compat-list");
    const hint = root.querySelector("#fides-connector-compat-hint");
    if (!listEl) return;
    const filter = val("#fides-connector-compat-filter").toLowerCase();
    const personal = Rules.personalWallets(wallets);
    const visible = personal.filter((wallet) => {
      if (!filter) return true;
      return `${wallet.name} ${wallet.provider || ""} ${wallet.id}`.toLowerCase().includes(filter);
    });
    listEl.innerHTML = visible
      .map((wallet) => {
        const checked = compatSelected.includes(wallet.id) ? " checked" : "";
        return `
        <label class="fides-form-choice">
          <input type="checkbox" name="walletCompatibility" value="${escapeHtml(wallet.id)}" data-field="walletCompatibility"${checked} />
          <span>${escapeHtml(walletLabel(wallet))}</span>
        </label>`;
      })
      .join("");
    if (hint) {
      hint.hidden = visible.length > 0;
      hint.textContent = personal.length ? "No personal wallets match this filter." : "The personal wallet list is not available right now.";
    }
    renderCompatChips();
  }

  function initCompatControls() {
    const listEl = root.querySelector("#fides-connector-compat-list");
    const filterEl = root.querySelector("#fides-connector-compat-filter");
    const chips = root.querySelector("#fides-connector-compat-chips");
    if (filterEl) filterEl.addEventListener("input", renderCompatList);
    if (listEl) {
      listEl.addEventListener("change", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) || target.name !== "walletCompatibility") return;
        const id = String(target.value);
        compatSelected = compatSelected.filter((entry) => entry !== id);
        if (target.checked) compatSelected.push(id);
        renderCompatChips();
      });
    }
    if (chips) {
      chips.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const id = target.getAttribute("data-remove-compat");
        if (!id) return;
        compatSelected = compatSelected.filter((entry) => entry !== id);
        renderCompatList();
      });
    }
    renderCompatList();
  }

  async function ensureWalletsLoaded() {
    if (wallets.length || !WALLET_CATALOG_URL) return;
    try {
      const response = await fetch(WALLET_CATALOG_URL);
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      wallets = (Array.isArray(data.wallets) ? data.wallets : [])
        .filter((wallet) => wallet && wallet.id && (wallet.type === "personal" || wallet.type === "organizational"))
        .map((wallet) => ({
          id: String(wallet.id),
          name: String(wallet.name || wallet.id),
          type: wallet.type,
          orgId: String(wallet.orgId || ""),
          provider: wallet.provider && wallet.provider.name ? String(wallet.provider.name) : "",
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      renderWalletRefOptions();
      renderCompatList();
    } catch (_err) {
      /* the server still validates references; pickers stay empty */
    }
  }

  /* -------------------------------------------------- conditional field state */

  function updateProtocolRows() {
    const groups = Rules.protocolGroups(getCheckedValues("connectorFunctions"));
    root.querySelectorAll("[data-protocol-group]").forEach((row) => {
      const key = row.getAttribute("data-protocol-group");
      const applies = key === "issuance" ? groups.issuance : groups.presentation;
      setHidden(row, !applies);
      row.querySelectorAll('input[type="checkbox"]').forEach((el) => {
        el.disabled = !applies;
        if (!applies) el.checked = false;
      });
    });
  }

  /** Re-render the eIDAS role choices; `checkedOverride` applies prefilled roles. */
  function renderEidasRoles(checkedOverride) {
    const container = root.querySelector("#fides-connector-eidas-roles");
    const section = root.querySelector(".fides-connector-eidas-section");
    if (!container) return;
    const state = currentRuleState();
    const availability = Rules.eidasRoleAvailability(state, orgHasQeaa);
    const checked = new Set(Array.isArray(checkedOverride) ? checkedOverride : state.eidasRoles);
    const labels = enumLabelList("eidasRoles");
    const sectionVisible = Rules.eidasSectionVisible(state);
    setHidden(section, !sectionVisible);
    container.innerHTML = enumList("eidasRoles")
      .filter((role) => availability[role] && availability[role].visible)
      .map((role) => {
        const entry = availability[role];
        const isChecked = entry.enabled && checked.has(role);
        const requirement = entry.enabled
          ? ""
          : `<span class="fides-connector-role-requirement"> — requires ${escapeHtml(entry.missing.join(", "))}</span>`;
        return `
        <label class="fides-form-choice${entry.enabled ? "" : " fides-form-choice--disabled"}">
          <input type="checkbox" name="eidasRoles" value="${escapeHtml(role)}" data-field="eidasRoles"${isChecked ? " checked" : ""}${entry.enabled ? "" : " disabled"} />
          <span>${escapeHtml(labels[role] || role)}${requirement}</span>
        </label>`;
      })
      .join("");
  }

  function updateDependentFields() {
    updateLicenseOtherVisibility();
    updateProtocolRows();
    renderEidasRoles();
  }

  /* ------------------------------------------------------------ org context */

  async function refreshOrgContext(orgId) {
    orgHasQeaa = null;
    renderEidasRoles();
    renderWalletRefOptions();
    const id = String(orgId || "").trim();
    if (!id || !apiBase) return;
    const headers = {};
    if (restNonce) headers["X-WP-Nonce"] = restNonce;
    try {
      const response = await fetch(`${apiBase}/wallet-connector/org-context?orgId=${encodeURIComponent(id)}`, {
        credentials: "same-origin",
        headers,
      });
      const json = await response.json().catch(() => ({}));
      if (response.ok && json && typeof json === "object" && id === selectedOrgId) {
        orgHasQeaa = json.hasQeaa === true;
        renderEidasRoles();
      }
    } catch (_err) {
      /* roles needing QEAA stay disabled; the server validates anyway */
    }
  }

  /* --------------------------------------------------------- messages / a11y */

  function setMessage(text, type) {
    if (!messageEl) return;
    messageEl.textContent = text || "";
    messageEl.className = `fides-form-message ${type ? `is-${type}` : ""}`.trim();
    if (type === "error" && text) {
      messageEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function fieldLabelForControl(el) {
    if (!(el instanceof HTMLElement)) return "";
    const row = el.closest(".fides-form-row, .fides-linked-field, .fides-consent");
    if (!row) return "";
    const label = row.querySelector(":scope > label, :scope > .fides-form-label");
    return label ? String(label.textContent || "").replace(/\*/g, "").trim() : "";
  }

  function openValidationAncestors(el) {
    let node = el instanceof HTMLElement ? el : null;
    while (node) {
      if (node instanceof HTMLDetailsElement && !node.open) {
        node.open = true;
      }
      if (node.hidden && node.classList) {
        if (
          node.classList.contains("fides-connector-fields") ||
          node.classList.contains("fides-connector-optional-sections")
        ) {
          node.hidden = false;
        }
      }
      node = node.parentElement;
    }
  }

  function clearValidationHighlights() {
    form.querySelectorAll(
      ".fides-form-row--invalid, .fides-form-choices--invalid, .fides-linked-field--invalid, .fides-consent--invalid"
    ).forEach((row) => {
      row.classList.remove(
        "fides-form-row--invalid",
        "fides-form-choices--invalid",
        "fides-linked-field--invalid",
        "fides-consent--invalid"
      );
    });
    form.querySelectorAll(".fides-form-field-invalid").forEach((el) => {
      el.classList.remove("fides-form-field-invalid");
      el.removeAttribute("aria-invalid");
    });
  }

  function highlightInvalidControl(el, message) {
    clearValidationHighlights();
    if (!(el instanceof HTMLElement)) {
      if (message) setMessage(message, "error");
      return;
    }
    openValidationAncestors(el);
    const row = el.closest(".fides-form-row, .fides-linked-field, .fides-consent");
    const choices = el.closest(".fides-form-choices");
    if (choices) {
      choices.classList.add("fides-form-choices--invalid");
      const choicesRow = choices.closest(".fides-form-row, .fides-linked-field");
      if (choicesRow) {
        choicesRow.classList.add(
          choicesRow.classList.contains("fides-linked-field") ? "fides-linked-field--invalid" : "fides-form-row--invalid"
        );
      }
    } else if (row) {
      if (row.classList.contains("fides-consent")) {
        row.classList.add("fides-consent--invalid");
      } else if (row.classList.contains("fides-linked-field")) {
        row.classList.add("fides-linked-field--invalid");
      } else {
        row.classList.add("fides-form-row--invalid");
      }
    }
    if (el.matches("input, select, textarea")) {
      el.classList.add("fides-form-field-invalid");
      el.setAttribute("aria-invalid", "true");
      if (typeof el.focus === "function") {
        el.focus({ preventScroll: true });
      }
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const label = fieldLabelForControl(el);
    setMessage(message || (label ? `Please complete: ${label}` : "Please complete all required fields."), "error");
  }

  function highlightInvalidRow(row, message) {
    clearValidationHighlights();
    if (!(row instanceof HTMLElement)) {
      setMessage(message || "Please complete required fields.", "error");
      return;
    }
    openValidationAncestors(row);
    row.classList.add(row.classList.contains("fides-linked-field") ? "fides-linked-field--invalid" : "fides-form-row--invalid");
    const choices = row.querySelector(".fides-form-choices");
    if (choices) choices.classList.add("fides-form-choices--invalid");
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    setMessage(message || "Please complete required fields.", "error");
  }

  function highlightRuleError(error) {
    const row = root.querySelector(`[data-row="${error.field}"]`);
    if (!row) {
      setMessage(error.message, "error");
      return;
    }
    const control = row.querySelector("select, textarea, input:not([type=hidden])");
    if (row.querySelector(".fides-form-choices") || !control) {
      highlightInvalidRow(row, error.message);
    } else {
      highlightInvalidControl(control, error.message);
    }
  }

  function firstInvalidControl() {
    const controls = form.querySelectorAll("input, select, textarea");
    for (const el of controls) {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) {
        continue;
      }
      if (el.disabled || el.type === "hidden" || el.type === "file") continue;
      if (!el.checkValidity()) return el;
    }
    return null;
  }

  /* ------------------------------------------------------------- fill / build */

  function fillForm(payload) {
    const data = payload && typeof payload === "object" ? payload : {};
    if (nameInput) nameInput.value = data.name || "";
    if (idInput) idInput.value = data.id || "";
    if (orgIdInput) orgIdInput.value = data.orgId || "";
    selectedOrgId = data.orgId || selectedOrgId;
    const setVal = (selector, value) => {
      const el = root.querySelector(selector);
      if (el) el.value = value == null ? "" : String(value);
    };
    setVal("#fides-connector-status", data.status || "production");
    setVal("#fides-connector-deployment-model", data.deploymentModel || "");
    if (descriptionEl) {
      descriptionEl.value = data.description || "";
      updateDescriptionCounter();
    }
    setVal("#fides-connector-logo", data.logo);
    setVal("#fides-connector-website", data.website);
    setVal("#fides-connector-documentation", data.documentation);
    setVal("#fides-connector-repository", data.repository);
    setVal("#fides-connector-license", data.license || "");
    setVal("#fides-connector-license-other", data.licenseOther);
    setVal("#fides-connector-certificate-management", data.certificateManagement || "");
    setPlaygroundRows(data.playgroundUrls);

    ["connectorFunctions", "serviceModels", "vcFormat", "issuanceProtocols", "presentationProtocols",
      "interoperabilityProfiles", "credentialStatusMethods", "backendIntegrations", "frontendIntegrations"].forEach((name) => {
      setCheckedValues(name, data[name]);
    });
    compatSelected = Array.isArray(data.walletCompatibility) ? data.walletCompatibility.map(String) : [];
    renderCompatList();

    const refId = data.walletRef && typeof data.walletRef === "object" ? data.walletRef.walletCatalogId : data.walletRef;
    renderWalletRefOptions(refId ? String(refId) : "");
    updateLicenseOtherVisibility();
    updateProtocolRows();
    renderEidasRoles(Array.isArray(data.eidasRoles) ? data.eidasRoles : []);
    applyTierFieldState();
  }

  function buildPayload() {
    const state = currentRuleState();
    const groups = Rules.protocolGroups(state.connectorFunctions);
    const payload = {
      orgId: orgIdInput ? String(orgIdInput.value || selectedOrgId || "").trim() : selectedOrgId,
      id: idInput ? String(idInput.value || "").trim() : "",
      name: nameInput ? String(nameInput.value || "").trim() : "",
      description: descriptionEl ? String(descriptionEl.value || "").trim() : "",
      status: state.status,
      deploymentModel: state.deploymentModel,
      connectorFunctions: state.connectorFunctions,
      serviceModels: state.serviceModels,
      license: state.license,
      vcFormat: state.vcFormat,
      backendIntegrations: state.backendIntegrations,
      frontendIntegrations: getCheckedValues("frontendIntegrations"),
      interoperabilityProfiles: state.interoperabilityProfiles,
      credentialStatusMethods: getCheckedValues("credentialStatusMethods"),
      issuanceProtocols: groups.issuance ? state.issuanceProtocols : [],
      presentationProtocols: groups.presentation ? state.presentationProtocols : [],
      eidasRoles: Rules.pruneEidasRoles(state, orgHasQeaa),
      walletCompatibility: compatSelected.slice(),
      playgroundUrls: playgroundRowsState.map((entry) => String(entry.url || "").trim()).filter(Boolean),
    };
    ["logo", "website", "documentation", "repository"].forEach((key) => {
      const value = val(`#fides-connector-${key}`);
      if (value) payload[key] = value;
    });
    if (state.license === "other") payload.licenseOther = state.licenseOther.trim();
    const openSource = Rules.deriveOpenSource(state.license, state.licenseOther);
    if (openSource !== undefined) payload.openSource = openSource;
    const certificateManagement = val("#fides-connector-certificate-management");
    if (certificateManagement) payload.certificateManagement = certificateManagement;
    if (state.walletRef) payload.walletRef = { walletCatalogId: state.walletRef };
    return payload;
  }

  /* --------------------------------------------------------- selection state */

  function revealFields(show) {
    if (fieldsWrap) fieldsWrap.hidden = !show;
    const optionalSections = root.querySelector(".fides-connector-optional-sections");
    if (optionalSections) optionalSections.hidden = !show;
    if (show) updateDependentFields();
  }

  function showUpdateSelectionUi() {
    const hasSelection = Boolean(selectedConnectorId);
    if (updateBanner) updateBanner.hidden = !hasSelection;
    if (searchBlock) searchBlock.hidden = hasSelection;
    if (submitBlock && mode === "update") submitBlock.hidden = !hasSelection;
    if (!hasSelection) {
      if (updateNameEl) updateNameEl.textContent = "";
      if (updateIdEl) updateIdEl.textContent = "";
      return;
    }
    if (updateNameEl) updateNameEl.textContent = selectedConnectorLabel || selectedConnectorId;
    if (updateIdEl) updateIdEl.textContent = selectedConnectorId;
    updatePlanTierBanner();
  }

  async function selectConnector(item) {
    selectedConnectorId = String(item.id || "").trim();
    selectedConnectorLabel = String(item.label || selectedConnectorId).trim();
    if (lookupResults) lookupResults.innerHTML = "";
    if (lookupHint) lookupHint.hidden = true;
    showUpdateSelectionUi();
    await loadItemPayload(selectedConnectorId);
  }

  function resetUpdateSelection() {
    selectedConnectorId = "";
    selectedConnectorLabel = "";
    selectedOrgId = "";
    orgHasQeaa = null;
    if (searchInput) {
      searchInput.value = "";
      searchInput.focus();
    }
    if (lookupResults) lookupResults.innerHTML = "";
    if (lookupHint) lookupHint.hidden = true;
    showUpdateSelectionUi();
    revealFields(false);
    fillForm({});
    setMessage("", "");
  }

  function showOrgSelectionUi() {
    const banner = root.querySelector("#fides-connector-org-banner");
    const orgSearchBlock = root.querySelector("#fides-connector-org-search-block");
    const hasSelection = Boolean(selectedOrgId);
    if (banner) banner.hidden = !hasSelection;
    if (orgSearchBlock) orgSearchBlock.hidden = hasSelection;
    if (submitBlock && mode === "create") submitBlock.hidden = !hasSelection;
    if (orgIdInput) orgIdInput.value = selectedOrgId;
    const nameEl = root.querySelector("#fides-connector-org-name");
    const idEl = root.querySelector("#fides-connector-org-id-display");
    if (!hasSelection) {
      if (nameEl) nameEl.textContent = "";
      if (idEl) idEl.textContent = "";
      revealFields(false);
      return;
    }
    if (nameEl) nameEl.textContent = selectedOrgLabel || selectedOrgId;
    if (idEl) idEl.textContent = selectedOrgId;
    revealFields(true);
    updatePlanTierBanner();
  }

  async function loadItemPayload(connectorId) {
    const url = submissionItemUrl(connectorId);
    if (!url) {
      setMessage("Invalid connector id.", "error");
      return;
    }
    setMessage("Loading connector details…", "");
    const headers = {};
    if (restNonce) headers["X-WP-Nonce"] = restNonce;
    try {
      const response = await fetch(url, { credentials: "same-origin", headers });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(json.message || "Could not load connector details.", "error");
        return;
      }
      selectedOrgId = (json.payload && json.payload.orgId) || selectedOrgId;
      await ensureWalletsLoaded();
      fillForm(json.payload || {});
      await refreshPlanTier(selectedOrgId);
      revealFields(true);
      refreshOrgContext(selectedOrgId).then(() => {
        renderEidasRoles(Array.isArray(json.payload && json.payload.eidasRoles) ? json.payload.eidasRoles : undefined);
      });
      setMessage("", "");
    } catch {
      setMessage("Could not load connector details due to a network error.", "error");
    }
  }

  /* ------------------------------------------------------------------ lookup */

  async function lookupFetch(type, query) {
    const headers = {};
    if (restNonce) headers["X-WP-Nonce"] = restNonce;
    const response = await fetch(`${apiBase}/lookups/${type}?q=${encodeURIComponent(query)}`, {
      credentials: "same-origin",
      headers,
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.message || "Lookup failed.");
    return {
      content: Array.isArray(json.content) ? json.content : [],
      totalMatches: Number(json.totalMatches) || 0,
    };
  }

  function renderLookupOption(item, idx) {
    const title = escapeHtml(item.label || item.id || "Unnamed");
    const subtitle = item.subtitle ? escapeHtml(item.subtitle) : "";
    return (
      `<li><button type="button" class="fides-lookup-option" data-idx="${idx}" ` +
      `aria-label="Select ${title}${subtitle ? `, ${subtitle}` : ""}">` +
      `<span class="fides-lookup-option-main">` +
      `<span class="fides-lookup-option-title">${title}</span>` +
      (subtitle ? `<span class="fides-lookup-option-subtitle">${subtitle}</span>` : "") +
      `</span>` +
      `<span class="fides-lookup-option-action">Select</span>` +
      `</button></li>`
    );
  }

  function wireLookup(input, resultsEl, hintEl, type, onSelect) {
    if (!input || !resultsEl) return;
    let debounceTimer = null;
    input.addEventListener("input", () => {
      const query = input.value.trim();
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        resultsEl.innerHTML = "";
        if (hintEl) {
          hintEl.hidden = true;
          hintEl.textContent = "";
        }
        if (query.length < 2) return;
        try {
          const { content: items, totalMatches } = await lookupFetch(type, query);
          if (!items.length) {
            if (hintEl) {
              hintEl.hidden = false;
              hintEl.textContent =
                type === SUBMISSION_TYPE
                  ? "No matches. Check the spelling or contact us if the connector is missing."
                  : "No matches.";
            }
            return;
          }
          const total = totalMatches || items.length;
          if (hintEl) {
            hintEl.hidden = false;
            hintEl.textContent =
              total === 1 ? "1 match — click to select" : `${total} matches — click to select`;
          }
          resultsEl.innerHTML = items.map((item, idx) => renderLookupOption(item, idx)).join("");
          resultsEl.querySelectorAll("button[data-idx]").forEach((btn) => {
            btn.addEventListener("click", () => {
              const picked = items[Number(btn.getAttribute("data-idx"))];
              if (picked) onSelect(picked);
            });
          });
        } catch (err) {
          if (hintEl) {
            hintEl.hidden = false;
            hintEl.textContent = err.message || "Lookup failed.";
          }
        }
      }, 250);
    });
  }

  /* ------------------------------------------------------------------- init */

  initPlaygroundControls();
  initCompatControls();
  renderWalletRefOptions("");
  updateDependentFields();
  if (descriptionEl) {
    descriptionEl.addEventListener("input", updateDescriptionCounter);
    updateDescriptionCounter();
  }
  applyTierFieldState();
  ensureWalletsLoaded();

  if (mode === "create") {
    showOrgSelectionUi();
    wireLookup(
      root.querySelector("#fides-connector-org-search"),
      root.querySelector("#fides-connector-org-results"),
      root.querySelector("#fides-connector-org-hint"),
      "organization",
      (item) => {
        selectedOrgId = String(item.id || "").trim();
        selectedOrgLabel = String(item.label || selectedOrgId).trim();
        const results = root.querySelector("#fides-connector-org-results");
        if (results) results.innerHTML = "";
        const orgHint = root.querySelector("#fides-connector-org-hint");
        if (orgHint) orgHint.hidden = true;
        refreshPlanTier(selectedOrgId);
        showOrgSelectionUi();
        refreshOrgContext(selectedOrgId);
      }
    );
    const orgChange = root.querySelector("#fides-connector-org-change");
    if (orgChange) {
      orgChange.addEventListener("click", () => {
        selectedOrgId = "";
        selectedOrgLabel = "";
        orgHasQeaa = null;
        const orgSearch = root.querySelector("#fides-connector-org-search");
        if (orgSearch) {
          orgSearch.value = "";
          orgSearch.focus();
        }
        fillForm({});
        showOrgSelectionUi();
        setMessage("", "");
      });
    }
    if (nameInput && idInput) {
      nameInput.addEventListener("input", () => {
        if (!idInput.value || idInput.dataset.autoId === "1") {
          idInput.value = slugify(nameInput.value);
          idInput.dataset.autoId = "1";
        }
      });
      idInput.addEventListener("input", () => {
        idInput.dataset.autoId = "0";
      });
    }
  }

  if (mode === "update") {
    showUpdateSelectionUi();
    revealFields(false);
    wireLookup(searchInput, lookupResults, lookupHint, SUBMISSION_TYPE, (item) => {
      selectConnector(item);
    });
    if (changeBtn) {
      changeBtn.addEventListener("click", (event) => {
        event.preventDefault();
        resetUpdateSelection();
      });
    }
    if (selectedConnectorId) {
      selectedConnectorLabel = selectedConnectorId;
      showUpdateSelectionUi();
      loadItemPayload(selectedConnectorId);
    }
  }

  // Conditional rules: functions, service models, interop profiles and license drive dependent fields.
  form.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const name = target.getAttribute("name") || "";
    if (name === "license") {
      updateLicenseOtherVisibility();
    } else if (name === "connectorFunctions") {
      updateProtocolRows();
      renderEidasRoles();
    } else if (name === "serviceModels" || name === "interoperabilityProfiles") {
      renderEidasRoles();
    }
  });

  form.addEventListener(
    "invalid",
    (event) => {
      event.preventDefault();
      const target = event.target;
      if (target instanceof HTMLElement) {
        highlightInvalidControl(target);
      }
    },
    true
  );

  form.addEventListener(
    "input",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      target.classList.remove("fides-form-field-invalid");
      const row = target.closest(
        ".fides-form-row--invalid, .fides-form-choices--invalid, .fides-linked-field--invalid, .fides-consent--invalid"
      );
      if (row) {
        row.classList.remove(
          "fides-form-row--invalid",
          "fides-form-choices--invalid",
          "fides-linked-field--invalid",
          "fides-consent--invalid"
        );
      }
      const choices = target.closest(".fides-form-choices--invalid");
      if (choices) choices.classList.remove("fides-form-choices--invalid");
    },
    true
  );

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    updateLicenseOtherVisibility();
    const invalidControl = firstInvalidControl();
    if (invalidControl) {
      highlightInvalidControl(invalidControl);
      return;
    }
    if (!contactEmail) {
      setMessage("Your WordPress profile must have a valid email address before submitting.", "error");
      return;
    }
    if (mode === "create" && !selectedOrgId) {
      const orgSearch = root.querySelector("#fides-connector-org-search");
      highlightInvalidControl(orgSearch || root.querySelector("#fides-connector-org-search-block"), "Select the organization for this connector.");
      return;
    }
    if (mode === "update" && !selectedConnectorId) {
      const connectorSearch = root.querySelector("#fides-connector-search");
      highlightInvalidControl(connectorSearch || root.querySelector("#fides-connector-search-block"), "Select the connector you want to update.");
      return;
    }

    const payload = buildPayload();
    if (!payload.orgId) {
      highlightInvalidControl(orgIdInput, "Organization is required.");
      return;
    }
    if (!payload.id || !/^[a-z0-9-]+$/.test(payload.id)) {
      highlightInvalidControl(idInput, "Connector id is required (lowercase letters, numbers, hyphens).");
      return;
    }
    if (!payload.name) {
      highlightInvalidControl(nameInput, "Connector name is required.");
      return;
    }
    if (!payload.description) {
      highlightInvalidControl(descriptionEl, "Description is required.");
      return;
    }
    const ruleErrors = Rules.validateState(
      Object.assign(currentRuleState(), { eidasRoles: getCheckedValues("eidasRoles") }),
      { wallets, orgHasQeaa }
    );
    if (ruleErrors.length) {
      highlightRuleError(ruleErrors[0]);
      return;
    }

    const url =
      mode === "update" ? submissionItemUrl(selectedConnectorId) : `${apiBase}/submissions/${SUBMISSION_TYPE}`;
    if (!url) {
      setMessage("Invalid connector id.", "error");
      return;
    }

    setMessage("Submitting…", "");
    const headers = { "Content-Type": "application/json" };
    if (restNonce) headers["X-WP-Nonce"] = restNonce;

    try {
      const response = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers,
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(json.message || "Submission failed.", "error");
        return;
      }
      const ref = json.itemId || json.id || payload.id;
      setMessage(
        mode === "update"
          ? `Update proposal received${ref ? ` for ${ref}` : ""}. It will be reviewed before publication.`
          : `Submission received${ref ? ` (${ref})` : ""}. It will be reviewed before publication.`,
        "success"
      );
      if (mode === "create") {
        form.reset();
        selectedOrgId = "";
        selectedOrgLabel = "";
        orgHasQeaa = null;
        fillForm({});
        showOrgSelectionUi();
      } else {
        selectedConnectorId = "";
        selectedConnectorLabel = "";
        revealFields(false);
        showUpdateSelectionUi();
      }
    } catch {
      setMessage("Submission failed due to a network error.", "error");
    }
  });

  /* -------------------------------------------------- vocabulary [i] popups */

  function isFidesLocalDevHost() {
    try {
      const host = window.location.hostname || "";
      const href = window.location.href || "";
      return host.includes(".local") || href.includes(".local");
    } catch (_err) {
      return false;
    }
  }

  async function loadVocabulary(primaryUrl, fallbackUrl) {
    let first = primaryUrl;
    let second = fallbackUrl;
    if (isFidesLocalDevHost() && primaryUrl && fallbackUrl) {
      first = fallbackUrl;
      second = primaryUrl;
    }
    const tryLoad = async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      return data.terms || null;
    };
    if (first) {
      try {
        return await tryLoad(first);
      } catch (e) {
        console.warn("Connector form vocabulary load failed (first):", e.message);
      }
    }
    if (second) {
      try {
        return await tryLoad(second);
      } catch (e) {
        console.warn("Connector form vocabulary load failed (second):", e.message);
      }
    }
    return null;
  }

  function hideVocabularyPopup() {
    const overlay = document.querySelector(".fides-vocab-overlay");
    const popup = document.querySelector(".fides-vocab-popup");
    if (overlay) overlay.remove();
    if (popup) popup.remove();
  }

  function formChoiceLabelText(label) {
    const span = label.querySelector("span");
    return span ? span.textContent.trim() : label.textContent.trim();
  }

  function resolveFormOptionVocabKey(fieldKey, value) {
    const vocabGroup = FORM_FIELD_TO_VOCAB[fieldKey] || fieldKey;
    const groupMap = FORM_OPTION_TO_VOCAB[vocabGroup] || FORM_OPTION_TO_VOCAB[fieldKey];
    if (groupMap && groupMap[value] !== undefined) {
      return groupMap[value];
    }
    return value;
  }

  function showFormVocabularyPopup(button, groupEl, fieldKey, vocabKey) {
    hideVocabularyPopup();
    if (!vocabulary) return;
    const groupTerm = vocabulary[vocabKey];
    const labelEl = groupEl.querySelector(
      ".fides-form-label-with-info .fides-form-label, .fides-form-label-with-info label, :scope > .fides-form-label"
    );
    const categoryName = labelEl ? labelEl.textContent.replace(/\s*\*$/, "").trim() : "";
    let html = "";
    if (categoryName) {
      html += '<p class="fides-vocab-popup-title"><strong>' + escapeHtml(categoryName) + "</strong></p>";
    }
    if (groupTerm && groupTerm.description) {
      html += '<p class="fides-vocab-popup-intro">' + escapeHtml(groupTerm.description) + "</p>";
    }
    const choicesEl = groupEl.querySelector(".fides-form-choices");
    if (choicesEl) {
      const labels = choicesEl.querySelectorAll("label.fides-form-choice");
      if (labels.length > 0) {
        const listItems = [];
        labels.forEach((label) => {
          const input = label.querySelector("input");
          const value = input ? String(input.value || "").trim() : "";
          let labelText = formChoiceLabelText(label);
          if (!labelText || labelText === value) {
            labelText = enumDisplayLabel(fieldKey, value);
          }
          const optionVocabKey = resolveFormOptionVocabKey(fieldKey, value);
          const term = optionVocabKey ? vocabulary[optionVocabKey] : null;
          const desc = term && term.description ? escapeHtml(term.description) : "";
          if (desc) {
            listItems.push({ labelText, desc });
          }
        });
        if (listItems.length > 0) {
          html += '<ul class="fides-vocab-popup-list">';
          listItems.forEach((item) => {
            html += "<li><strong>" + escapeHtml(item.labelText) + "</strong>: " + item.desc + "</li>";
          });
          html += "</ul>";
        }
      }
    }
    if (!html) html = "<p>No description available.</p>";

    const popup = document.createElement("div");
    popup.className = "fides-vocab-popup";
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-label", "Field explanation");
    popup.innerHTML = html;
    const overlay = document.createElement("div");
    overlay.className = "fides-vocab-overlay";
    document.body.appendChild(overlay);
    document.body.appendChild(popup);

    const margin = 20;
    const rect = button.getBoundingClientRect();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pw = popup.offsetWidth;
    const ph = popup.offsetHeight;
    const left = Math.max(margin, Math.min(rect.right + 40, w - pw - margin));
    const top = Math.max(margin, Math.min((h - ph) / 2, h - ph - margin));
    popup.style.left = left + "px";
    popup.style.top = top + "px";

    setTimeout(() => {
      overlay.classList.add("visible");
      popup.classList.add("visible");
    }, 10);

    const close = (e) => {
      if (e && e.target.closest && e.target.closest(".fides-vocab-popup")) return;
      hideVocabularyPopup();
      document.removeEventListener("click", close, true);
      document.removeEventListener("keydown", onKeydown);
    };
    function onKeydown(e) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeydown);
    setTimeout(() => document.addEventListener("click", close, true), 0);
  }

  function initFormVocabularyInfo(containerEl) {
    if (!vocabulary) return;
    hideVocabularyPopup();
    containerEl.querySelectorAll(".fides-vocab-info").forEach((btn) => btn.remove());
    containerEl.querySelectorAll(".fides-form-row[data-vocab-field]").forEach((groupEl) => {
      const fieldKey = groupEl.getAttribute("data-vocab-field") || "";
      const vocabKey = FORM_FIELD_TO_VOCAB[fieldKey] || fieldKey;
      if (!vocabulary[vocabKey]) return;
      const labelEl = groupEl.querySelector(":scope > .fides-form-label");
      if (!labelEl) return;

      const infoBtn = document.createElement("button");
      infoBtn.type = "button";
      infoBtn.className = "fides-vocab-info";
      infoBtn.dataset.group = vocabKey;
      infoBtn.setAttribute("aria-label", "Show help for this field");
      infoBtn.setAttribute("title", "Show help");
      infoBtn.textContent = "i";
      infoBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        showFormVocabularyPopup(e.currentTarget, groupEl, fieldKey, vocabKey);
      });

      const parent = labelEl.parentNode;
      if (parent && parent.classList && parent.classList.contains("fides-form-label-with-info")) {
        parent.appendChild(infoBtn);
        return;
      }
      const wrapper = document.createElement("div");
      wrapper.className = "fides-form-label-with-info";
      parent.insertBefore(wrapper, labelEl);
      wrapper.appendChild(labelEl);
      wrapper.appendChild(infoBtn);
    });
  }

  if (VOCABULARY_URL || VOCABULARY_FALLBACK_URL) {
    loadVocabulary(VOCABULARY_URL, VOCABULARY_FALLBACK_URL)
      .then((terms) => {
        vocabulary = terms;
        if (vocabulary) initFormVocabularyInfo(root);
      })
      .catch(() => {});
  }
})();
