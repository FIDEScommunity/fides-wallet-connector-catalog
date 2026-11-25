/**
 * Conditional rules of the wallet connector submission forms.
 *
 * Pure functions (no DOM) so the same rules drive the form UI and the unit tests.
 * They mirror schemas/wallet-connector-catalog.schema.json and the PHP validator
 * (Fides_Wallet_Connector_Catalog_V1_Normalizer); the server stays authoritative.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.FidesConnectorFormRules = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var ARF_PROFILE = "EUDI Wallet ARF";

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function has(values, value) {
    return list(values).indexOf(value) !== -1;
  }

  /**
   * Which protocol groups apply to the selected connector functions.
   * Issuer connectors need issuance protocols, verifier connectors presentation protocols.
   */
  function protocolGroups(functions) {
    return {
      issuance: has(functions, "issuer"),
      presentation: has(functions, "verifier"),
    };
  }

  /** The "Other" license name field only applies to license "other". */
  function licenseOtherApplies(license) {
    return license === "other";
  }

  /** openSource follows the license; only "other" is ambiguous and falls back to a text heuristic. */
  function deriveOpenSource(license, licenseOther) {
    var value = String(license || "").trim();
    if (!value) return undefined;
    if (value === "proprietary") return false;
    if (value === "other" && /proprietary/i.test(String(licenseOther || ""))) return false;
    return true;
  }

  /**
   * Availability of each eIDAS role for the current form state.
   *
   * visible:  the role's function prerequisite is met (the role is only offered then).
   * enabled:  all prerequisites are met, so it can be selected.
   * missing:  human-readable list of unmet prerequisites (for the hint next to a disabled role).
   */
  function eidasRoleAvailability(state, orgHasQeaa) {
    var functions = list(state.connectorFunctions);
    var serviceModels = list(state.serviceModels);
    var profiles = list(state.interoperabilityProfiles);

    var rp = [];
    if (!has(serviceModels, "managed_verification")) rp.push("Managed verification service model");
    if (!has(profiles, ARF_PROFILE)) rp.push(ARF_PROFILE + " interop profile");

    var eaa = [];
    if (!has(serviceModels, "managed_issuance")) eaa.push("Managed issuance service model");

    var qeaa = eaa.slice();
    if (orgHasQeaa !== true) qeaa.push("QTSP with QEAA in the Organization Catalog");

    return {
      rp_intermediary: { visible: has(functions, "verifier"), enabled: rp.length === 0, missing: rp },
      eaa_provider: { visible: has(functions, "issuer"), enabled: eaa.length === 0, missing: eaa },
      qeaa_provider: { visible: has(functions, "issuer"), enabled: qeaa.length === 0, missing: qeaa },
    };
  }

  /** Whether the eIDAS roles section is relevant at all (needs at least one connector function). */
  function eidasSectionVisible(state) {
    return list(state.connectorFunctions).length > 0;
  }

  /** Drop selected roles whose prerequisites are no longer met. */
  function pruneEidasRoles(state, orgHasQeaa) {
    var availability = eidasRoleAvailability(state, orgHasQeaa);
    return list(state.eidasRoles).filter(function (role) {
      var entry = availability[role];
      return !!entry && entry.visible && entry.enabled;
    });
  }

  /** Business wallets of the connector's organization (walletRef candidates). */
  function organizationalWalletsForOrg(wallets, orgId) {
    return list(wallets).filter(function (wallet) {
      return wallet && wallet.type === "organizational" && !!orgId && wallet.orgId === orgId;
    });
  }

  /** Personal wallets (walletCompatibility candidates). */
  function personalWallets(wallets) {
    return list(wallets).filter(function (wallet) {
      return wallet && wallet.type === "personal";
    });
  }

  /**
   * Validate the form state against the schema's conditional rules.
   * Returns a list of { field, message } (empty when valid). `field` is a form row key.
   */
  function validateState(state, ctx) {
    var context = ctx || {};
    var errors = [];
    var add = function (field, message) {
      errors.push({ field: field, message: message });
    };
    var functions = list(state.connectorFunctions);
    var groups = protocolGroups(functions);

    if (!functions.length) add("connectorFunctions", "Select at least one connector function (issuer and/or verifier).");
    if (!state.deploymentModel) add("deploymentModel", "Select a deployment model.");
    if (!state.status) add("status", "Select a connector status.");
    if (!state.license) add("license", "Select a license.");
    if (state.license === "other" && !String(state.licenseOther || "").trim()) {
      add("licenseOther", 'Please specify the license when "Other" is selected.');
    }
    if (!list(state.serviceModels).length) add("serviceModels", "Select at least one service model.");
    if (!list(state.vcFormat).length) add("vcFormat", "Select at least one VC format.");
    if (groups.issuance && !list(state.issuanceProtocols).length) {
      add("issuanceProtocols", "Select at least one issuance protocol for an issuer connector.");
    }
    if (groups.presentation && !list(state.presentationProtocols).length) {
      add("presentationProtocols", "Select at least one presentation protocol for a verifier connector.");
    }
    if (!list(state.backendIntegrations).length) add("backendIntegrations", "Select at least one backend integration.");

    var availability = eidasRoleAvailability(state, context.orgHasQeaa);
    list(state.eidasRoles).forEach(function (role) {
      var entry = availability[role];
      if (!entry || !entry.visible) {
        add("eidasRoles", "The " + role.replace(/_/g, " ") + " role does not match the selected connector functions.");
      } else if (!entry.enabled) {
        add("eidasRoles", "The " + role.replace(/_/g, " ") + " role requires: " + entry.missing.join(", ") + ".");
      }
    });

    if (state.walletRef) {
      var ref = list(context.wallets).filter(function (wallet) {
        return wallet && wallet.id === state.walletRef;
      })[0];
      if (!ref) {
        add("walletRef", "The referenced wallet was not found in the Wallet Catalog.");
      } else if (ref.type !== "organizational") {
        add("walletRef", "The referenced wallet must be a business wallet.");
      } else if (state.orgId && ref.orgId !== state.orgId) {
        add("walletRef", "The referenced wallet must belong to the same organization.");
      }
    }
    return errors;
  }

  return {
    ARF_PROFILE: ARF_PROFILE,
    protocolGroups: protocolGroups,
    licenseOtherApplies: licenseOtherApplies,
    deriveOpenSource: deriveOpenSource,
    eidasRoleAvailability: eidasRoleAvailability,
    eidasSectionVisible: eidasSectionVisible,
    pruneEidasRoles: pruneEidasRoles,
    organizationalWalletsForOrg: organizationalWalletsForOrg,
    personalWallets: personalWallets,
    validateState: validateState,
  };
});
