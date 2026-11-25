/**
 * FIDES Wallet Connector Catalog - WordPress Plugin JavaScript
 *
 * Mirrors the Business Wallet Catalog listing (wallet-catalog.js): same markup, class names,
 * sorting, pagination, quick filters, ratings, tier badges, vocabulary popups and shared
 * FidesCatalogUI modal lifecycle. Only the connector-specific filters and card content differ.
 */
(function () {
  'use strict';

  const config = window.fidesWalletConnectorCatalog || {};
  const container = document.getElementById('fides-wallet-connector-catalog-root');
  if (!container) return;

  const ARF_PROFILE = 'EUDI Wallet ARF';
  const LIST_BREAKPOINT = 1024;
  const LISTING_PAGE_SIZE = 24;
  const LISTING_PAGE_PARAM = 'catalog_page';
  const SORT_PREFERENCE_STORAGE_KEY = 'fidesWalletConnectorCatalogSortByV1';
  // Shared with the wallet catalogs so the grid/list choice follows the visitor across catalogs.
  const VIEW_PREFERENCE_STORAGE_KEY = 'fides-wallet-view';
  const RATINGS_BATCH_LIMIT = 100;
  const OFFICIAL_ACCOUNT_TITLE = 'Official listing \u2014 managed by the provider';
  const OFFICIAL_FILTER_LABEL = 'Official listings only';

  const ASK_FIDES_AVAILABLE = !!config.askFidesAvailable;
  const ASK_FIDES_PLACEHOLDER = config.askFidesPlaceholder ? String(config.askFidesPlaceholder) : 'Ask anything about wallet connectors\u2026';
  const ORGANIZATION_CATALOG_PAGE_URL = config.organizationCatalogUrl || 'https://fides.community/ecosystem-explorer/organization-catalog/';
  const BLUE_PAGES_URL = config.bluePagesUrl ? String(config.bluePagesUrl).trim() : '';
  const RATINGS_API_BASE = config.ratingsApiBase ? String(config.ratingsApiBase).trim().replace(/\/$/, '') : '';
  const RATINGS_NONCE = config.ratingsNonce ? String(config.ratingsNonce) : '';
  const RATINGS_IS_LOGGED_IN = !!config.ratingsIsLoggedIn;
  const RATINGS_LOGIN_URL = config.ratingsLoginUrl ? String(config.ratingsLoginUrl) : '';
  const UPDATE_FORM_URL = config.updateFormUrl ? String(config.updateFormUrl).trim() : '';
  const EDIT_ACCESS = config.editAccess && typeof config.editAccess === 'object'
    ? config.editAccess
    : { isLoggedIn: false, isAdmin: false, ownedOrgIds: [], proOrgIds: [], fullOrgIds: [] };
  const TIER_UI_ENABLED = !!config.tierUiEnabled;
  const SHARE_PATH = config.sharePath ? String(config.sharePath) : '/connector/';
  const WALLET_SHARE_PATH = config.walletSharePath ? String(config.walletSharePath) : '/wallet/';

  const icons = {
    filter: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>',
    search: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>',
    chevronDown: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg>',
    x: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>',
    xSmall: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>',
    xLarge: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>',
    eye: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    wallet: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path></svg>',
    viewGrid: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    viewList: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    official: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>'
  };

  // Fallback labels; the shared FidesCatalogUI.connectorValueLabel is preferred when available.
  const VALUE_LABELS = {
    saas: 'SaaS',
    on_premises: 'On-premises',
    hybrid: 'Hybrid',
    rest_api: 'REST API',
    oidc_oauth2: 'OIDC / OAuth 2.0',
    saml2: 'SAML 2.0',
    webhooks: 'Webhooks',
    server_sdk: 'Server SDK',
    hosted_ui_redirect: 'Hosted UI (redirect)',
    headless_api: 'Headless API',
    frontend_sdk: 'Frontend SDK',
    web_component: 'Web component',
    software_only: 'Software only',
    managed_verification: 'Managed verification',
    managed_issuance: 'Managed issuance',
    rp_intermediary: 'RP intermediary',
    eaa_provider: 'EAA provider',
    qeaa_provider: 'QEAA provider',
    issuer: 'Issuer',
    verifier: 'Verifier',
    development: 'In Development',
    beta: 'Beta',
    production: 'Production',
    deprecated: 'Deprecated',
    other: 'Other',
    sd_jwt_vc: 'SD-JWT VC',
    mdoc: 'ISO mDoc',
    jwt_vc: 'JWT VC',
    vcdm_1_1: 'VCDM1.1',
    vcdm_2_0: 'VCDM2.0',
    anoncreds: 'AnonCreds',
    idemix: 'Idemix',
    apple_wallet_pass: 'Apple Wallet Pass',
    google_wallet_pass: 'Google Wallet Pass',
    acdc: 'ACDC'
  };

  const CREDENTIAL_FORMAT_ORDER = ['sd_jwt_vc', 'mdoc', 'jwt_vc', 'vcdm_1_1', 'vcdm_2_0', 'anoncreds', 'idemix', 'apple_wallet_pass', 'google_wallet_pass', 'acdc'];

  const COUNTRY_NAMES = {
    'AD': 'Andorra', 'AL': 'Albania', 'AT': 'Austria', 'AU': 'Australia',
    'BE': 'Belgium', 'BG': 'Bulgaria', 'BA': 'Bosnia and Herzegovina',
    'CA': 'Canada', 'CH': 'Switzerland', 'CY': 'Cyprus', 'CZ': 'Czech Republic',
    'DE': 'Germany', 'DK': 'Denmark', 'EE': 'Estonia', 'ES': 'Spain', 'EU': 'European Union',
    'FI': 'Finland', 'FR': 'France', 'GB': 'United Kingdom', 'GR': 'Greece',
    'HR': 'Croatia', 'HU': 'Hungary', 'IE': 'Ireland', 'IL': 'Israel',
    'IN': 'India', 'IS': 'Iceland', 'IT': 'Italy', 'JP': 'Japan', 'KR': 'South Korea',
    'XK': 'Kosovo', 'LI': 'Liechtenstein', 'LT': 'Lithuania', 'LU': 'Luxembourg',
    'LV': 'Latvia', 'MC': 'Monaco', 'MD': 'Moldova', 'ME': 'Montenegro',
    'MK': 'North Macedonia', 'MT': 'Malta', 'NL': 'Netherlands', 'NO': 'Norway',
    'NZ': 'New Zealand', 'PL': 'Poland', 'PT': 'Portugal', 'RO': 'Romania',
    'RS': 'Serbia', 'SE': 'Sweden', 'SG': 'Singapore', 'SI': 'Slovenia',
    'SK': 'Slovakia', 'SM': 'San Marino', 'TR': 'Turkey', 'UA': 'Ukraine',
    'US': 'United States', 'VA': 'Vatican City'
  };

  // Vocabulary for [i] info popups (loaded from interop-profiles; falls back to the bundled copy).
  let vocabulary = null;
  // Filter group -> vocabulary key. Groups without an entry (or without matching terms) get no [i] button.
  const CONNECTOR_FILTER_TO_VOCAB = {
    connectorFunctions: 'capabilities',
    country: 'country',
    interop: 'interopProfile',
    vcFormat: 'vcFormat',
    credentialStatusMethods: 'credentialStatus',
    license: 'license'
  };
  const CONNECTOR_OPTION_TO_VOCAB = {
    credentialStatus: {
      'JWT Validity': 'jwtValidity',
      'IETF Token Status List': 'ietfTokenStatusList',
      'PKI Cert Validity': 'pkiCertValidity'
    },
    license: { 'true': 'openSource', 'false': 'proprietary' }
  };

  let connectors = [];
  let filterFacets = null;
  let ratingSummariesById = Object.create(null);
  let mobileFiltersController = null;
  let catalogLoadMeta = { showStaleNotice: false, remoteFailed: false, snapshotDate: '' };
  let listingUrlWhenOpened = '';
  let modalCloseBound = false;
  let sortBy = 'explore';
  let viewMode = 'grid';
  let listingPage = 1;
  let originalIds = [];

  const settings = {
    showFilters: container.dataset.showFilters !== 'false',
    showSearch: container.dataset.showSearch !== 'false',
    columns: container.dataset.columns || '3',
    theme: container.dataset.theme || 'fides'
  };
  container.setAttribute('data-theme', settings.theme);

  const filters = {
    search: '',
    eudi: false,
    addedLast30Days: false,
    officialOnly: false,
    openSource: null,
    ids: [],
    connectorFunctions: [],
    deploymentModel: [],
    serviceModels: [],
    backendIntegrations: [],
    frontendIntegrations: [],
    interoperabilityProfiles: [],
    vcFormat: [],
    credentialStatusMethods: [],
    eidasRoles: [],
    status: [],
    countries: [],
    organizations: []
  };

  // Collapsible filter groups: true = expanded. Top filter open, the rest collapsed (same as the wallet catalog).
  const filterGroupState = {
    connectorFunctions: true,
    country: false,
    interop: false,
    vcFormat: false,
    deploymentModel: false,
    serviceModels: false,
    backendIntegrations: false,
    frontendIntegrations: false,
    credentialStatusMethods: false,
    eidasRoles: false,
    license: false,
    status: false,
    organizations: false
  };

  function arr(value) {
    if (Array.isArray(value)) return value.filter(function (v) { return v !== null && v !== undefined && v !== ''; });
    return value === null || value === undefined || value === '' ? [] : [value];
  }

  function escapeHtml(value) {
    const node = document.createElement('div');
    node.textContent = String(value == null ? '' : value);
    return node.innerHTML.replace(/"/g, '&quot;');
  }

  function debounce(fn, wait) {
    let timer = null;
    return function () {
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(null, args); }, wait);
    };
  }

  function orgName(connector) {
    return (connector.organization && connector.organization.name) || connector.orgId || 'Unknown';
  }

  function orgCountry(connector) {
    return String((connector.organization && connector.organization.country) || '').trim().toUpperCase();
  }

  function countryLabel(code) {
    return COUNTRY_NAMES[code] || code;
  }

  function isEudiConnector(connector) {
    return arr(connector.interoperabilityProfiles).indexOf(ARF_PROFILE) !== -1 || connector.isEudiWalletConnector === true;
  }

  function valueLabel(value, group) {
    const ui = window.FidesCatalogUI;
    if (ui && typeof ui.connectorValueLabel === 'function') return ui.connectorValueLabel(value, group);
    const raw = String(value == null ? '' : value);
    if (Object.prototype.hasOwnProperty.call(VALUE_LABELS, raw)) return VALUE_LABELS[raw];
    if (raw.indexOf('_') === -1) return raw;
    const spaced = raw.replace(/_/g, ' ');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }

  function getDisplayName(name) {
    return String(name || '').replace(/\s*\([^)]*\)\s*/g, '').trim() || String(name || '');
  }

  function isFidesLocalDevHost() {
    const ui = window.FidesCatalogUI;
    if (ui && typeof ui.isFidesLocalDevHost === 'function') return ui.isFidesLocalDevHost();
    return String(window.location.hostname || '').indexOf('.local') !== -1;
  }

  // ---------------------------------------------------------------------------
  // Dates and KPI metrics
  // ---------------------------------------------------------------------------

  function parseConnectorDate(connector, fields) {
    for (let i = 0; i < fields.length; i += 1) {
      const value = connector[fields[i]];
      if (!value) continue;
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }
    return null;
  }

  function getConnectorAddedDate(connector) {
    return parseConnectorDate(connector, ['firstSeenAt', 'createdAt', 'addedAt']);
  }

  function getConnectorUpdatedDate(connector) {
    return parseConnectorDate(connector, ['updatedAt', 'fetchedAt']);
  }

  function isWithinLastDays(date, days) {
    if (!date || Number.isNaN(date.getTime())) return false;
    return date.getTime() >= Date.now() - days * 24 * 60 * 60 * 1000;
  }

  function getCatalogMetrics(items) {
    const countries = {};
    let newLast30Days = 0;
    let updatedLast30Days = 0;
    items.forEach(function (connector) {
      if (isWithinLastDays(getConnectorAddedDate(connector), 30)) newLast30Days += 1;
      if (isWithinLastDays(getConnectorUpdatedDate(connector), 30)) updatedLast30Days += 1;
      if (orgCountry(connector)) countries[orgCountry(connector)] = true;
    });
    return {
      total: items.length,
      newLast30Days: newLast30Days,
      updatedLast30Days: updatedLast30Days,
      countryCount: Object.keys(countries).length
    };
  }

  // ---------------------------------------------------------------------------
  // Listing tier (Official / Community) -- same rules as the wallet catalog
  // ---------------------------------------------------------------------------

  function resolveOrgIdForEdit(connector) {
    const ui = window.FidesCatalogUI;
    if (ui && typeof ui.resolveWalletOrgId === 'function') return ui.resolveWalletOrgId(connector);
    return connector && typeof connector.orgId === 'string' && connector.orgId.indexOf('org:') === 0 ? connector.orgId : '';
  }

  function tierIsCommunity(connector) {
    if (!TIER_UI_ENABLED || !connector || !connector.catalogTier) return false;
    const tier = String(connector.catalogTier).toLowerCase();
    return tier === 'gratis' || tier === 'community';
  }

  /** Official (Pro): explicit catalogTier Pro, or provider org linked in proOrgIds when the tier field is absent. */
  function tierIsPro(connector) {
    if (!TIER_UI_ENABLED || !connector) return false;
    if (connector.catalogTier) return !tierIsCommunity(connector);
    const orgId = resolveOrgIdForEdit(connector);
    const proOrgIds = Array.isArray(EDIT_ACCESS.proOrgIds) ? EDIT_ACCESS.proOrgIds : [];
    return orgId !== '' && proOrgIds.indexOf(orgId) >= 0;
  }

  function officialCardClass(connector) {
    return tierIsPro(connector) ? ' fides-wallet-card--official fides-wallet-card--official-organizational' : '';
  }

  function renderCardFooterBadges(connector) {
    const ui = window.FidesCatalogUI;
    if (TIER_UI_ENABLED && ui && typeof ui.buildCatalogListingHeaderBadgeHtml === 'function') {
      const badge = ui.buildCatalogListingHeaderBadgeHtml(connector, {
        tierUiEnabled: TIER_UI_ENABLED,
        editAccess: EDIT_ACCESS,
        isLoggedIn: RATINGS_IS_LOGGED_IN
      });
      return badge ? '<div class="fides-wallet-card-footer-badges fides-wallet-card-footer-listing">' + badge + '</div>' : '';
    }
    if (!tierIsPro(connector)) return '';
    return '<div class="fides-wallet-card-footer-badges"><span class="fides-wallet-footer-badge fides-wallet-footer-badge--official" role="img" aria-label="Official account" title="' + OFFICIAL_ACCOUNT_TITLE + '">' + icons.official + '</span></div>';
  }

  function renderListBadges(connector) {
    if (!TIER_UI_ENABLED || !tierIsPro(connector)) return '';
    return '<div class="fides-row-badges"><span class="fides-row-badge-icon fides-row-badge-icon--official" role="img" aria-label="Official account" title="' + OFFICIAL_ACCOUNT_TITLE + '">' + icons.official + '</span></div>';
  }

  function cardAriaLabel(connector) {
    const name = escapeHtml(getDisplayName(connector.name || connector.id));
    return tierIsPro(connector) ? name + ', official account' : name;
  }

  // ---------------------------------------------------------------------------
  // Ratings (likes)
  // ---------------------------------------------------------------------------

  function buildRatingsEndpoint(baseUrl, path, queryParams) {
    const rawBase = String(baseUrl || '').trim();
    const safePath = String(path || '').replace(/^\/+/, '');
    if (!rawBase) return '';
    try {
      const url = new URL(rawBase, window.location.origin);
      if (url.origin !== window.location.origin) {
        url.protocol = window.location.protocol;
        url.host = window.location.host;
      }
      if (url.searchParams.has('rest_route')) {
        const currentRoute = String(url.searchParams.get('rest_route') || '').replace(/\/+$/, '');
        url.searchParams.set('rest_route', currentRoute + '/' + safePath);
      } else {
        url.pathname = url.pathname.replace(/\/+$/, '') + '/' + safePath;
      }
      Object.keys(queryParams || {}).forEach(function (key) {
        const value = queryParams[key];
        if (value === null || value === undefined || value === '') return;
        url.searchParams.set(key, String(value));
      });
      return url.toString();
    } catch (e) {
      return '';
    }
  }

  function normalizeRatingSummary(raw) {
    const likeCount = Number(raw && raw.likes);
    return {
      avg: Number(raw && raw.avg) || 0,
      count: isFinite(likeCount) ? likeCount : (Number(raw && raw.count) || 0),
      myRating: Number(raw && raw.my_like) > 0 || Number(raw && raw.my_rating) > 0 ? 1 : null
    };
  }

  async function fetchRatingSummaries(type, ids) {
    const map = Object.create(null);
    if (!RATINGS_API_BASE || !type) return map;
    const uniqueIds = Array.from(new Set((ids || []).map(function (id) { return String(id || '').trim(); }).filter(Boolean)));
    for (let i = 0; i < uniqueIds.length; i += RATINGS_BATCH_LIMIT) {
      const chunk = uniqueIds.slice(i, i + RATINGS_BATCH_LIMIT);
      const url = buildRatingsEndpoint(RATINGS_API_BASE, 'ratings/batch', { type: type, ids: chunk.join(','), _wpnonce: RATINGS_NONCE });
      if (!url) continue;
      try {
        const response = await fetch(url, { method: 'GET', credentials: 'same-origin', headers: { 'X-WP-Nonce': RATINGS_NONCE } });
        if (!response.ok) continue;
        const data = await response.json();
        const results = data && data.results ? data.results : {};
        Object.keys(results).forEach(function (id) { map[id] = normalizeRatingSummary(results[id]); });
      } catch (e) {
        // Keep the listing usable when ratings are unreachable.
      }
    }
    return map;
  }

  async function loadConnectorRatingSummaries(items) {
    ratingSummariesById = await fetchRatingSummaries('connector', items.map(function (connector) { return connector.id; }));
  }

  function renderRatingSummary(id) {
    const summary = ratingSummariesById[id];
    if (!summary || summary.count < 1) {
      return '<span class="fides-item-rating fides-item-rating-empty"><span class="fides-item-rating-text">No likes yet</span></span>';
    }
    const label = summary.count + ' like' + (summary.count === 1 ? '' : 's');
    return '<span class="fides-item-rating' + (summary.myRating === 1 ? ' is-liked' : '') + '" title="Community likes">' +
      '<span class="fides-item-rating-star">\u2605</span><span class="fides-item-rating-text">' + escapeHtml(label) + '</span></span>';
  }

  function renderListLikeSummary(id) {
    const summary = ratingSummariesById[id];
    const count = summary ? (Number(summary.count) || 0) : 0;
    if (count < 1) return '';
    return '<span class="fides-list-like' + (summary.myRating === 1 ? ' is-liked' : '') + '" title="Community likes">' +
      '<span class="fides-list-like-star">\u2605</span><span class="fides-list-like-count">' + escapeHtml(count) + '</span></span>';
  }

  function updateLikeInPlace(id) {
    container.querySelectorAll('.fides-wallet-card[data-connector-id]').forEach(function (card) {
      if (card.getAttribute('data-connector-id') !== id) return;
      const cardSummary = card.querySelector('.fides-wallet-rating-summary');
      if (cardSummary) cardSummary.innerHTML = renderRatingSummary(id);
      const rowSummary = card.querySelector('.fides-row-likes');
      if (rowSummary) rowSummary.innerHTML = renderListLikeSummary(id);
    });
  }

  // ---------------------------------------------------------------------------
  // Facet groups and filtering
  // ---------------------------------------------------------------------------

  // Multi-value facet groups rendered as collapsible checkbox lists (connector-specific taxonomy).
  const FACET_GROUPS = [
    { key: 'connectorFunctions', domKey: 'connectorFunctions', label: 'Function', values: function (c) { return arr(c.connectorFunctions); } },
    { key: 'countries', domKey: 'country', label: 'Country', values: function (c) { return orgCountry(c) ? [orgCountry(c)] : []; }, country: true, scroll: true },
    { key: 'interoperabilityProfiles', domKey: 'interop', label: 'Interop Profile', values: function (c) { return arr(c.interoperabilityProfiles); }, raw: true },
    { key: 'vcFormat', domKey: 'vcFormat', label: 'VC Format', values: function (c) { return arr(c.vcFormat); }, group: 'vcFormat' },
    { key: 'deploymentModel', domKey: 'deploymentModel', label: 'Deployment Model', values: function (c) { return arr(c.deploymentModel); } },
    { key: 'serviceModels', domKey: 'serviceModels', label: 'Service Model', values: function (c) { return arr(c.serviceModels); } },
    { key: 'backendIntegrations', domKey: 'backendIntegrations', label: 'Backend Integration', values: function (c) { return arr(c.backendIntegrations); } },
    { key: 'frontendIntegrations', domKey: 'frontendIntegrations', label: 'Frontend Integration', values: function (c) { return arr(c.frontendIntegrations); } },
    { key: 'credentialStatusMethods', domKey: 'credentialStatusMethods', label: 'Credential Status', values: function (c) { return arr(c.credentialStatusMethods); }, raw: true },
    { key: 'eidasRoles', domKey: 'eidasRoles', label: 'eIDAS Role', values: function (c) { return arr(c.eidasRoles); } },
    { key: 'license', domKey: 'license', label: 'License', special: 'license' },
    { key: 'status', domKey: 'status', label: 'Status', values: function (c) { return c.status ? [c.status] : []; } },
    { key: 'organizations', domKey: 'organizations', label: 'Organization', values: function (c) { return [orgName(c)]; }, raw: true, scroll: true }
  ];

  function optionLabel(group, value) {
    if (group.raw) return String(value);
    if (group.country) return countryLabel(String(value).toUpperCase());
    return valueLabel(value, group.group);
  }

  function matchesSearch(connector) {
    if (!filters.search) return true;
    const haystack = [
      connector.name,
      connector.description,
      orgName(connector),
      connector.orgId,
      arr(connector.connectorFunctions).join(' '),
      arr(connector.interoperabilityProfiles).join(' '),
      arr(connector.vcFormat).join(' '),
      arr(connector.issuanceProtocols).join(' '),
      arr(connector.presentationProtocols).join(' ')
    ].join(' ').toLowerCase();
    return haystack.indexOf(filters.search.toLowerCase()) !== -1;
  }

  function matchesConnector(connector) {
    if (filters.ids.length && filters.ids.indexOf(connector.id) === -1) return false;
    if (!matchesSearch(connector)) return false;
    if (filters.eudi && !isEudiConnector(connector)) return false;
    if (filters.addedLast30Days && !isWithinLastDays(getConnectorAddedDate(connector), 30)) return false;
    if (TIER_UI_ENABLED && filters.officialOnly && !tierIsPro(connector)) return false;
    if (filters.openSource !== null && Boolean(connector.openSource) !== filters.openSource) return false;
    for (let i = 0; i < FACET_GROUPS.length; i += 1) {
      const group = FACET_GROUPS[i];
      if (group.special) continue;
      const selected = filters[group.key];
      if (!selected.length) continue;
      const own = group.values(connector);
      if (!selected.some(function (value) { return own.indexOf(value) !== -1; })) return false;
    }
    return true;
  }

  // ---- Explore ordering: deterministic daily shuffle inside quality bands (same idea as the wallet catalog) ----

  function dailyExploreScore(connector) {
    const seed = new Date().toISOString().slice(0, 10) + '|' + String(connector.id || connector.name || '');
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function exploreBand(connector) {
    if (tierIsPro(connector)) return 0;
    if (connector.status === 'production') return 1;
    if (connector.status === 'beta') return 2;
    return 3;
  }

  function compareName(a, b) {
    return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
  }

  function buildExploreOrder(items, deferWithoutLogo) {
    return items.slice().sort(function (a, b) {
      if (deferWithoutLogo) {
        const logoDiff = (a.logo ? 0 : 1) - (b.logo ? 0 : 1);
        if (logoDiff !== 0) return logoDiff;
      }
      const bandDiff = exploreBand(a) - exploreBand(b);
      if (bandDiff !== 0) return bandDiff;
      const scoreDiff = dailyExploreScore(a) - dailyExploreScore(b);
      return scoreDiff !== 0 ? scoreDiff : compareName(a, b);
    });
  }

  function getActiveFilterCount() {
    let count = 0;
    if (filters.eudi) count += 1;
    if (filters.addedLast30Days) count += 1;
    if (filters.officialOnly) count += 1;
    if (filters.openSource !== null) count += 1;
    if (filters.ids.length) count += 1;
    FACET_GROUPS.forEach(function (group) {
      if (!group.special) count += filters[group.key].length;
    });
    return count;
  }

  function getFilteredConnectors() {
    const filtered = connectors.filter(matchesConnector);
    if (sortBy === 'explore') {
      return buildExploreOrder(filtered, !filters.search && getActiveFilterCount() === 0);
    }
    if (sortBy === 'lastUpdated') {
      return filtered.sort(function (a, b) {
        const dateA = getConnectorUpdatedDate(a);
        const dateB = getConnectorUpdatedDate(b);
        const diff = (dateB ? dateB.getTime() : 0) - (dateA ? dateA.getTime() : 0);
        return diff !== 0 ? diff : compareName(a, b);
      });
    }
    if (sortBy === 'rating') {
      return filtered.sort(function (a, b) {
        const countA = ratingSummariesById[a.id] ? (Number(ratingSummariesById[a.id].count) || 0) : 0;
        const countB = ratingSummariesById[b.id] ? (Number(ratingSummariesById[b.id].count) || 0) : 0;
        return countB !== countA ? countB - countA : compareName(a, b);
      });
    }
    return filtered.sort(compareName);
  }

  // Counts per option over the whole catalog (computed once after load, like the wallet catalog).
  function computeFilterFacets(list) {
    const facets = { eudi: 0, addedLast30Days: 0, officialOnly: 0, license: { true: 0, false: 0 } };
    FACET_GROUPS.forEach(function (group) {
      if (!group.special) facets[group.key] = {};
    });
    list.forEach(function (connector) {
      if (isEudiConnector(connector)) facets.eudi += 1;
      if (isWithinLastDays(getConnectorAddedDate(connector), 30)) facets.addedLast30Days += 1;
      if (tierIsPro(connector)) facets.officialOnly += 1;
      facets.license[Boolean(connector.openSource)] += 1;
      FACET_GROUPS.forEach(function (group) {
        if (group.special) return;
        group.values(connector).forEach(function (value) {
          facets[group.key][value] = (facets[group.key][value] || 0) + 1;
        });
      });
    });
    return facets;
  }

  function allOptions(group) {
    const set = {};
    connectors.forEach(function (connector) {
      group.values(connector).forEach(function (value) { set[value] = true; });
    });
    const keys = Object.keys(set);
    if (group.group === 'vcFormat') {
      return keys.sort(function (a, b) {
        const ia = CREDENTIAL_FORMAT_ORDER.indexOf(a);
        const ib = CREDENTIAL_FORMAT_ORDER.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });
    }
    return keys.sort(function (a, b) {
      return optionLabel(group, a).localeCompare(optionLabel(group, b), undefined, { sensitivity: 'base' });
    });
  }

  // ---------------------------------------------------------------------------
  // Pagination (same markup and ?catalog_page= parameter as the wallet catalog)
  // ---------------------------------------------------------------------------

  function listingPageFromLocation() {
    try {
      const page = parseInt(new URLSearchParams(window.location.search).get(LISTING_PAGE_PARAM) || '1', 10);
      return Number.isFinite(page) && page > 0 ? page : 1;
    } catch (e) {
      return 1;
    }
  }

  function connectorSharePath() {
    return String(SHARE_PATH || '/connector/').replace(/\/?$/, '/');
  }

  function connectorHref(connector) {
    return connectorSharePath() + encodeURIComponent(connector.id) + '/';
  }

  function connectorIdFromLocation() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('connector');
    if (fromQuery) return fromQuery;
    const hash = String(window.location.hash || '').replace(/^#/, '');
    if (hash) return hash;
    const sharePath = connectorSharePath();
    const path = String(window.location.pathname || '').replace(/\/+$/, '') + '/';
    if (path.indexOf(sharePath) !== 0) return '';
    const rest = path.slice(sharePath.length).replace(/\/+$/, '');
    if (!rest || rest.indexOf('/') !== -1) return '';
    try {
      return decodeURIComponent(rest);
    } catch (e) {
      return rest;
    }
  }

  function isConnectorSharePath() {
    return !!connectorIdFromLocation() && String(window.location.pathname || '').indexOf(connectorSharePath()) === 0;
  }

  function listingBasePath() {
    return config.listingPath || '/ecosystem-explorer/wallet-connectors/';
  }

  function listingHrefForPage(page) {
    try {
      const base = isConnectorSharePath() ? new URL(listingBasePath(), window.location.origin) : new URL(window.location.href);
      base.searchParams.delete('connector');
      if (page <= 1) base.searchParams.delete(LISTING_PAGE_PARAM);
      else base.searchParams.set(LISTING_PAGE_PARAM, String(page));
      return base.pathname + base.search + base.hash;
    } catch (e) {
      return listingBasePath();
    }
  }

  function setListingPage(page, push) {
    listingPage = Math.max(1, Number(page) || 1);
    try {
      const next = listingHrefForPage(listingPage);
      if (push) history.pushState({ fidesCatalogPage: listingPage }, '', next);
      else history.replaceState({ fidesCatalogPage: listingPage }, '', next);
    } catch (e) { /* ignore history API failures */ }
  }

  function resetListingPage() {
    if (listingPage !== 1 || listingPageFromLocation() !== 1) setListingPage(1, false);
    else listingPage = 1;
  }

  function paginationBounds(items, page) {
    const total = Array.isArray(items) ? items.length : 0;
    const totalPages = Math.max(1, Math.ceil(total / LISTING_PAGE_SIZE));
    const safePage = Math.max(1, Math.min(Number(page) || 1, totalPages));
    const startIndex = (safePage - 1) * LISTING_PAGE_SIZE;
    return { totalPages: totalPages, startIndex: startIndex, endIndex: Math.min(startIndex + LISTING_PAGE_SIZE, total) };
  }

  function visibleSlice(items) {
    let bounds = paginationBounds(items, listingPage);
    if (listingPage > bounds.totalPages) {
      setListingPage(bounds.totalPages, false);
      bounds = paginationBounds(items, listingPage);
    }
    return items.slice(bounds.startIndex, bounds.endIndex);
  }

  function paginationPageNumbers(page, totalPages) {
    if (totalPages <= 9) return Array.from({ length: totalPages }, function (_, index) { return index + 1; });
    const pages = [1];
    for (let number = Math.max(2, page - 2); number <= Math.min(totalPages - 1, page + 2); number += 1) pages.push(number);
    pages.push(totalPages);
    return pages.filter(function (number, index, list) { return list.indexOf(number) === index; });
  }

  function renderPaginationBar(items) {
    const total = Array.isArray(items) ? items.length : 0;
    if (total <= LISTING_PAGE_SIZE) return '';
    const bounds = paginationBounds(items, listingPage);
    const totalPages = bounds.totalPages;
    const page = Math.min(listingPage, totalPages);
    let previousPage = 0;
    const pageLinks = paginationPageNumbers(page, totalPages).map(function (number) {
      const ellipsis = previousPage > 0 && number > previousPage + 1 ? '<li class="fides-catalog-pagination__ellipsis" aria-hidden="true">\u2026</li>' : '';
      previousPage = number;
      return ellipsis + '<li><a href="' + escapeHtml(listingHrefForPage(number)) + '" data-catalog-page="' + number + '"' + (number === page ? ' aria-current="page"' : '') + '>' + number + '</a></li>';
    }).join('');
    const previous = page > 1
      ? '<a class="fides-catalog-pagination__prev" href="' + escapeHtml(listingHrefForPage(page - 1)) + '" data-catalog-page="' + (page - 1) + '" rel="prev">Previous</a>'
      : '';
    const next = page < totalPages
      ? '<a class="fides-catalog-pagination__next" href="' + escapeHtml(listingHrefForPage(page + 1)) + '" data-catalog-page="' + (page + 1) + '" rel="next">Next</a>'
      : '';
    return '<nav class="fides-catalog-pagination" data-fides-wallet-pagination aria-label="Catalog pages">' +
      '<p class="fides-catalog-pagination__meta">Showing ' + (bounds.startIndex + 1) + '\u2013' + bounds.endIndex + ' of ' + total + '</p>' +
      '<div class="fides-catalog-pagination__nav">' + previous + '<ol class="fides-catalog-pagination__pages">' + pageLinks + '</ol>' + next + '</div></nav>';
  }

  function isModifiedClick(event) {
    return !!(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0);
  }

  function bindPaginationLinks() {
    container.querySelectorAll('[data-catalog-page]').forEach(function (link) {
      link.addEventListener('click', function (event) {
        if (isModifiedClick(event)) return;
        event.preventDefault();
        setListingPage(parseInt(link.getAttribute('data-catalog-page') || '1', 10), true);
        renderGridOnly();
      });
    });
  }

  function syncPaginationBar(filtered) {
    const html = renderPaginationBar(filtered);
    const existing = container.querySelector('[data-fides-wallet-pagination]');
    if (existing) {
      if (html) existing.outerHTML = html;
      else existing.remove();
    } else if (html) {
      const contentArea = container.querySelector('.fides-content');
      const anchor = contentArea && (contentArea.querySelector('.fides-wallet-grid') || contentArea.querySelector('.fides-empty'));
      if (anchor) anchor.insertAdjacentHTML('afterend', html);
      else if (contentArea) contentArea.insertAdjacentHTML('beforeend', html);
    }
    bindPaginationLinks();
  }

  // ---------------------------------------------------------------------------
  // View mode
  // ---------------------------------------------------------------------------

  function effectiveView() {
    return window.innerWidth < LIST_BREAKPOINT ? 'grid' : viewMode;
  }
  let lastEffectiveView = 'grid';

  function renderViewToggle() {
    return '<div class="fides-view-toggle" role="group" aria-label="View mode">' +
      '<button class="fides-view-btn' + (viewMode === 'grid' ? ' active' : '') + '" data-view="grid" aria-label="Grid view" aria-pressed="' + (viewMode === 'grid') + '" title="Grid view">' + icons.viewGrid + '</button>' +
      '<button class="fides-view-btn' + (viewMode === 'list' ? ' active' : '') + '" data-view="list" aria-label="List view" aria-pressed="' + (viewMode === 'list') + '" title="List view">' + icons.viewList + '</button>' +
      '</div>';
  }

  // ---------------------------------------------------------------------------
  // Cards and rows
  // ---------------------------------------------------------------------------

  function renderCountryFlag(connector) {
    const code = orgCountry(connector);
    if (!/^[A-Z]{2}$/.test(code)) return '';
    const label = countryLabel(code);
    return '<span class="fides-wallet-country" title="' + escapeHtml(label) + '" aria-label="' + escapeHtml(label) + '">' +
      '<img src="https://flagcdn.com/w40/' + encodeURIComponent(code.toLowerCase()) + '.png" alt="" class="fides-wallet-country-flag" width="16" height="12" loading="lazy" decoding="async"></span>';
  }

  function cardAnalyticsAttrs(connector) {
    const providerId = String(connector.orgId || (connector.organization && connector.organization.id) || '')
      .trim().replace(/^org:/i, '').toLowerCase().replace(/\|/g, '-').replace(/\s+/g, '-');
    if (!providerId || !connector.id) return '';
    return ' data-provider-id="' + escapeHtml(providerId) + '"' +
      ' data-provider-name="' + escapeHtml(orgName(connector)) + '"' +
      ' data-entity-type="connector"' +
      ' data-entity-id="' + escapeHtml(connector.id) + '"' +
      ' data-entity-name="' + escapeHtml(connector.name || '') + '"';
  }

  function renderFunctionTags(connector) {
    return arr(connector.connectorFunctions).map(function (fn) {
      return '<span class="fides-tag capability">' + escapeHtml(valueLabel(fn)) + '</span>';
    }).join('') + (isEudiConnector(connector) ? '<span class="fides-tag eudi">EUDI</span>' : '');
  }

  function renderCardLogo(connector) {
    return connector.logo
      ? '<img src="' + escapeHtml(connector.logo) + '" alt="" width="64" height="64" loading="lazy" decoding="async">'
      : icons.wallet;
  }

  function renderConnectorCard(connector) {
    const displayName = getDisplayName(connector.name || connector.id);
    return '<a class="fides-wallet-card' + officialCardClass(connector) + '" href="' + escapeHtml(connectorHref(connector)) + '" data-connector-id="' + escapeHtml(connector.id) + '"' + cardAnalyticsAttrs(connector) + ' aria-label="' + cardAriaLabel(connector) + '">' +
      '<header class="fides-wallet-header fides-wallet-card-header--text-only type-organizational"><div class="fides-wallet-info">' +
      '<h3 class="fides-wallet-name" title="' + escapeHtml(displayName) + '">' + escapeHtml(displayName) + '</h3>' +
      '<p class="fides-wallet-provider">' + renderCountryFlag(connector) + '<span class="fides-wallet-provider-text">' + escapeHtml(orgName(connector)) + '</span></p>' +
      '</div></header>' +
      '<div class="fides-wallet-body">' +
      '<div class="fides-wallet-card-meta-row"><p class="fides-wallet-rating-summary">' + renderRatingSummary(connector.id) + '</p></div>' +
      '<div class="fides-wallet-card-logo-panel" aria-hidden="true"><div class="fides-wallet-card-logo-main">' + renderCardLogo(connector) + '</div></div>' +
      '<div class="fides-connector-card-tags">' + renderFunctionTags(connector) + '</div>' +
      '</div>' +
      '<div class="fides-wallet-footer"><div class="fides-wallet-card-footer-start">' + renderCardFooterBadges(connector) + '</div>' +
      '<span class="fides-view-details">' + icons.eye + ' View details</span></div></a>';
  }

  function renderListHeader() {
    return '<div class="fides-wallet-list-header" aria-hidden="true"><div></div><div>Name</div><div class="fides-list-col-likes"></div><div>Provider</div><div>Function</div><div class="fides-list-col-updated">Updated</div></div>';
  }

  function renderConnectorRow(connector) {
    const displayName = getDisplayName(connector.name || connector.id);
    const updated = getConnectorUpdatedDate(connector);
    return '<div class="fides-wallet-card' + officialCardClass(connector) + '" data-connector-id="' + escapeHtml(connector.id) + '"' + cardAnalyticsAttrs(connector) + '>' +
      '<a class="fides-catalog-card-link" href="' + escapeHtml(connectorHref(connector)) + '" aria-label="' + cardAriaLabel(connector) + ' \u2013 ' + escapeHtml(orgName(connector)) + '">' + escapeHtml(displayName) + '</a>' +
      '<div class="fides-row-icon" aria-hidden="true">' +
      (connector.logo ? '<img src="' + escapeHtml(connector.logo) + '" alt="" style="width:22px;height:22px;object-fit:contain;border-radius:3px;">' : icons.wallet) + '</div>' +
      '<div class="fides-row-name"><span class="fides-row-name-text" title="' + escapeHtml(displayName) + '">' + escapeHtml(displayName) + '</span>' + renderListBadges(connector) + '</div>' +
      '<div class="fides-row-likes">' + renderListLikeSummary(connector.id) + '</div>' +
      '<div class="fides-row-provider" title="' + escapeHtml(orgName(connector)) + '">' + renderCountryFlag(connector) + escapeHtml(orgName(connector)) + '</div>' +
      '<div class="fides-row-platforms">' + (renderFunctionTags(connector) || '<span class="fides-row-platform-empty">\u2014</span>') + '</div>' +
      '<div class="fides-row-updated">' + escapeHtml(updated ? updated.toLocaleDateString('en-US') : '\u2014') + '</div></div>';
  }

  function renderGridInner(visible) {
    const view = effectiveView();
    return (view === 'list' ? renderListHeader() : '') + visible.map(view === 'list' ? renderConnectorRow : renderConnectorCard).join('');
  }

  function renderEmptyState() {
    return '<div class="fides-empty"><div class="fides-empty-icon">' + icons.wallet + '</div>' +
      '<h3 class="fides-empty-title">No wallet connectors found</h3>' +
      '<p class="fides-empty-text">Adjust your filters or try a different search query.</p></div>';
  }

  // ---------------------------------------------------------------------------
  // Sidebar
  // ---------------------------------------------------------------------------

  function checkbox(filterName, value, checked, labelHtml, count) {
    return '<label class="fides-filter-checkbox">' +
      '<input type="checkbox" data-filter="' + escapeHtml(filterName) + '" data-value="' + escapeHtml(value) + '"' + (checked ? ' checked' : '') + '>' +
      '<span>' + labelHtml + '<span class="fides-filter-option-count">(' + count + ')</span></span></label>';
  }

  function renderFilterGroup(group, facets) {
    const active = group.special ? filters.openSource !== null : filters[group.key].length > 0;
    let options = '';
    if (group.special === 'license') {
      options = checkbox('openSource', 'true', filters.openSource === true, 'Open Source', facets.license.true) +
        checkbox('openSource', 'false', filters.openSource === false, 'Proprietary', facets.license.false);
    } else {
      const values = allOptions(group);
      if (!values.length) return '';
      options = values.map(function (value) {
        const labelHtml = group.country
          ? '<img src="https://flagcdn.com/w20/' + encodeURIComponent(String(value).toLowerCase()) + '.png" alt="" class="fides-country-flag"> ' + escapeHtml(optionLabel(group, value))
          : escapeHtml(optionLabel(group, value));
        return checkbox(group.key, value, filters[group.key].indexOf(value) !== -1, labelHtml, facets[group.key][value] || 0);
      }).join('');
    }
    const expanded = !!filterGroupState[group.domKey];
    return '<div class="fides-filter-group collapsible' + (expanded ? '' : ' collapsed') + (active ? ' has-active' : '') + '" data-filter-group="' + group.domKey + '">' +
      '<button class="fides-filter-label-toggle" type="button" aria-expanded="' + expanded + '">' +
      '<span class="fides-filter-label">' + escapeHtml(group.label) + '</span>' +
      '<span class="fides-filter-active-indicator"></span>' + icons.chevronDown + '</button>' +
      '<div class="fides-filter-options' + (group.scroll ? ' fides-filter-options-scrollable' : '') + '">' + options + '</div></div>';
  }

  function renderSidebar(facets, activeCount) {
    return '<aside class="fides-sidebar">' +
      '<div class="fides-sidebar-header">' +
      '<div class="fides-sidebar-title">' + icons.filter + '<span>Filters</span>' +
      '<span class="fides-filter-count ' + (activeCount > 0 ? '' : 'hidden') + '">' + activeCount + '</span></div>' +
      '<div class="fides-sidebar-actions">' +
      '<button class="fides-clear-all ' + (activeCount > 0 ? '' : 'hidden') + '" id="fides-clear" type="button">' + icons.x + ' Clear</button>' +
      '<button class="fides-sidebar-close" id="fides-sidebar-close" type="button" aria-label="Close filters">' + icons.xLarge + '</button>' +
      '</div></div>' +
      '<div class="fides-sidebar-content">' +
      '<div class="fides-quick-filters"><span class="fides-quick-filters-title">Quick filters</span>' +
      (originalIds.length > 0 ? '<label class="fides-filter-checkbox"><input type="checkbox" data-filter="linkedConnectors" data-value="true"' + (filters.ids.length ? ' checked' : '') + '><span>Linked connectors<span class="fides-filter-option-count">(' + originalIds.length + ')</span></span></label>' : '') +
      checkbox('addedLast30Days', 'true', filters.addedLast30Days, 'Added last 30 days', facets.addedLast30Days) +
      checkbox('eudi', 'true', filters.eudi, 'EUDI Wallet Connector', facets.eudi) +
      (TIER_UI_ENABLED ? checkbox('officialOnly', 'true', filters.officialOnly, OFFICIAL_FILTER_LABEL, facets.officialOnly) : '') +
      '</div>' +
      FACET_GROUPS.map(function (group) { return renderFilterGroup(group, facets); }).join('') +
      '</div></aside>';
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  function getMobileFilters() {
    if (mobileFiltersController) return mobileFiltersController;
    if (!window.FidesCatalogUI || typeof window.FidesCatalogUI.createMobileFiltersController !== 'function') return null;
    mobileFiltersController = window.FidesCatalogUI.createMobileFiltersController({
      root: function () { return container; },
      breakpoint: LIST_BREAKPOINT
    });
    return mobileFiltersController;
  }

  function applyStaleCatalogNotice() {
    if (!window.FidesCatalogUI || typeof window.FidesCatalogUI.mountStaleCatalogNotice !== 'function') return;
    window.FidesCatalogUI.mountStaleCatalogNotice(container, {
      showStaleNotice: catalogLoadMeta.showStaleNotice,
      catalogType: 'connector',
      snapshotDate: catalogLoadMeta.snapshotDate
    });
  }

  function renderKpiRow(metrics) {
    return '<div class="fides-kpi-row">' +
      '<div class="fides-kpi-card" data-kpi-action="clear-added-filter"><span class="fides-kpi-value">' + metrics.total + '</span><span class="fides-kpi-label">Wallet Connectors</span></div>' +
      '<div class="fides-kpi-card' + (filters.addedLast30Days ? ' active' : '') + '" data-kpi-action="toggle-added-filter"><span class="fides-kpi-value">' + metrics.newLast30Days + '</span><span class="fides-kpi-label">New<span class="fides-kpi-label-extra"> last 30 days</span></span></div>' +
      '<div class="fides-kpi-card" data-kpi-action="set-last-updated-sort"><span class="fides-kpi-value">' + metrics.updatedLast30Days + '</span><span class="fides-kpi-label">Updated<span class="fides-kpi-label-extra"> last 30 days</span></span></div>' +
      '<div class="fides-kpi-card' + (filters.countries.length > 0 ? ' active' : '') + '" data-kpi-action="clear-country-filter"><span class="fides-kpi-value">' + metrics.countryCount + '</span><span class="fides-kpi-label">Countries</span></div>' +
      '</div>';
  }

  function render(options) {
    if (!(options && options.keepListingPage)) resetListingPage();
    const filtered = getFilteredConnectors();
    const visible = visibleSlice(filtered);
    const metrics = getCatalogMetrics(filtered);
    const activeCount = getActiveFilterCount();
    const facets = filterFacets || computeFilterFacets(connectors);

    const prevSearch = document.getElementById('fides-search-input');
    const wasSearchFocused = prevSearch && document.activeElement === prevSearch;
    const cursor = wasSearchFocused ? prevSearch.selectionStart : 0;

    let html = '<div class="fides-main-layout fides-main ' + (settings.showFilters ? '' : 'no-filters') + '">';
    if (settings.showFilters) html += renderSidebar(facets, activeCount);
    html += '<main class="fides-content"><div class="fides-results-bar">';
    if (settings.showSearch) {
      html += '<div class="fides-search-actions"><div class="fides-topbar-search"><div class="fides-search-wrapper">' +
        '<span class="fides-search-icon">' + icons.search + '</span>' +
        '<input type="text" class="fides-search-input" placeholder="Search..." value="' + escapeHtml(filters.search) + '" id="fides-search-input" autocomplete="off">' +
        '<button class="fides-search-clear ' + (filters.search ? '' : 'hidden') + '" id="fides-search-clear" type="button" aria-label="Clear search">' + icons.xSmall + '</button>' +
        '</div></div>' +
        (ASK_FIDES_AVAILABLE
          ? '<div class="fides-ask-fides-option"><span class="fides-ask-fides-separator">or</span><button class="fides-ask-fides-trigger" id="fides-ask-fides-trigger" type="button">Ask <strong>FIDES</strong></button></div>'
          : '') +
        '</div>';
    }
    html += '<div class="fides-results-bar-actions">';
    if (settings.showFilters) {
      html += '<button class="fides-mobile-filter-toggle" id="fides-mobile-filter-toggle" type="button">' + icons.filter + '<span>Filters</span>' +
        '<span class="fides-filter-count ' + (activeCount > 0 ? '' : 'hidden') + '">' + activeCount + '</span></button>';
    }
    html += '<label class="fides-sort-label" for="fides-sort-select"><span class="fides-sort-text">Sort by:</span>' +
      '<select id="fides-sort-select" class="fides-sort-select">' +
      '<option value="explore"' + (sortBy === 'explore' ? ' selected' : '') + '>Explore</option>' +
      '<option value="lastUpdated"' + (sortBy === 'lastUpdated' ? ' selected' : '') + '>Last updated</option>' +
      '<option value="rating"' + (sortBy === 'rating' ? ' selected' : '') + '>Likes</option>' +
      '<option value="az"' + (sortBy === 'az' ? ' selected' : '') + '>A-Z</option>' +
      '</select></label></div>' + renderViewToggle() + '</div>';
    html += renderKpiRow(metrics);
    if (filtered.length) {
      html += '<div class="fides-wallet-grid" data-view="' + effectiveView() + '" data-columns="' + escapeHtml(settings.columns) + '">' + renderGridInner(visible) + '</div>';
    } else {
      html += renderEmptyState();
    }
    html += renderPaginationBar(filtered) + '</main></div>';

    const mobile = getMobileFilters();
    const mobileOpen = mobile ? mobile.captureOpenState() : false;
    container.innerHTML = html;
    attachEventListeners();
    bindPaginationLinks();
    if (mobile) mobile.applyAfterRender(mobileOpen);
    applyStaleCatalogNotice();

    if (wasSearchFocused) {
      const input = document.getElementById('fides-search-input');
      if (input) {
        input.focus();
        input.setSelectionRange(cursor, cursor);
      }
    }
  }

  // Update only KPIs + grid so the search input keeps focus (keyboard stays open on mobile).
  function renderGridOnly() {
    const filtered = getFilteredConnectors();
    const visible = visibleSlice(filtered);
    const metrics = getCatalogMetrics(filtered);
    const setKpi = function (action, value) {
      const el = container.querySelector('.fides-kpi-card[data-kpi-action="' + action + '"] .fides-kpi-value');
      if (el) el.textContent = String(value);
    };
    setKpi('clear-added-filter', metrics.total);
    setKpi('toggle-added-filter', metrics.newLast30Days);
    setKpi('set-last-updated-sort', metrics.updatedLast30Days);
    setKpi('clear-country-filter', metrics.countryCount);
    const addedCard = container.querySelector('.fides-kpi-card[data-kpi-action="toggle-added-filter"]');
    if (addedCard) addedCard.classList.toggle('active', filters.addedLast30Days);
    const countryCard = container.querySelector('.fides-kpi-card[data-kpi-action="clear-country-filter"]');
    if (countryCard) countryCard.classList.toggle('active', filters.countries.length > 0);
    const searchClear = document.getElementById('fides-search-clear');
    if (searchClear) searchClear.classList.toggle('hidden', !filters.search);

    const contentArea = container.querySelector('.fides-content');
    if (!contentArea) return;
    const gridContainer = contentArea.querySelector('.fides-wallet-grid');
    const emptyContainer = contentArea.querySelector('.fides-empty');
    if (filtered.length) {
      if (emptyContainer) emptyContainer.remove();
      let grid = gridContainer;
      if (!grid) {
        grid = document.createElement('div');
        grid.className = 'fides-wallet-grid';
        grid.setAttribute('data-columns', settings.columns);
        const anchor = contentArea.querySelector('.fides-kpi-row') || contentArea.querySelector('.fides-results-bar');
        if (anchor) anchor.after(grid);
        else contentArea.appendChild(grid);
      }
      grid.setAttribute('data-view', effectiveView());
      grid.innerHTML = renderGridInner(visible);
      attachCardListeners();
    } else {
      if (gridContainer) gridContainer.remove();
      if (!emptyContainer) contentArea.insertAdjacentHTML('beforeend', renderEmptyState());
    }
    syncPaginationBar(filtered);
  }

  // ---------------------------------------------------------------------------
  // Vocabulary [i] popups
  // ---------------------------------------------------------------------------

  async function loadVocabulary(primaryUrl, fallbackUrl) {
    let first = primaryUrl;
    let second = fallbackUrl;
    if (isFidesLocalDevHost() && primaryUrl && fallbackUrl) {
      const sep = String(fallbackUrl).indexOf('?') === -1 ? '?' : '&';
      first = config.vocabularyDataVersion ? fallbackUrl + sep + 'v=' + encodeURIComponent(config.vocabularyDataVersion) : fallbackUrl;
      second = primaryUrl;
    }
    const tryLoad = async function (url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      return data.terms || null;
    };
    const sources = [first, second];
    for (let i = 0; i < sources.length; i += 1) {
      if (!sources[i]) continue;
      try {
        const terms = await tryLoad(sources[i]);
        if (terms) return terms;
      } catch (e) {
        if (window.console) console.warn('Vocabulary load failed:', e.message);
      }
    }
    return null;
  }

  function filterCheckboxLabelTextWithoutCount(label) {
    const span = label.querySelector('span');
    if (!span) return label.textContent.trim();
    const clone = span.cloneNode(true);
    clone.querySelectorAll('.fides-filter-option-count').forEach(function (el) { el.remove(); });
    return clone.textContent.trim();
  }

  function vocabTermForOption(vocabKey, value) {
    const mapped = CONNECTOR_OPTION_TO_VOCAB[vocabKey] && CONNECTOR_OPTION_TO_VOCAB[vocabKey][value] !== undefined
      ? CONNECTOR_OPTION_TO_VOCAB[vocabKey][value]
      : value;
    return mapped ? vocabulary[mapped] : null;
  }

  function groupHasVocabulary(groupEl, vocabKey) {
    if (vocabulary[vocabKey] && vocabulary[vocabKey].description) return true;
    return Array.prototype.some.call(groupEl.querySelectorAll('input[data-value]'), function (input) {
      const term = vocabTermForOption(vocabKey, input.dataset.value);
      return !!(term && term.description);
    });
  }

  function hideVocabularyPopup() {
    const overlay = document.querySelector('.fides-vocab-overlay');
    const popup = document.querySelector('.fides-vocab-popup');
    if (overlay) overlay.remove();
    if (popup) popup.remove();
  }

  function showVocabularyPopup(button, groupEl, vocabKey) {
    hideVocabularyPopup();
    const groupTerm = vocabulary[vocabKey];
    const labelEl = groupEl.querySelector('.fides-filter-label');
    const categoryName = labelEl && labelEl.textContent ? labelEl.textContent.trim() : '';
    let html = '';
    if (categoryName) html += '<p class="fides-vocab-popup-title"><strong>' + escapeHtml(categoryName) + '</strong></p>';
    if (groupTerm && groupTerm.description) html += '<p class="fides-vocab-popup-intro">' + escapeHtml(groupTerm.description) + '</p>';
    const items = [];
    groupEl.querySelectorAll('label.fides-filter-checkbox').forEach(function (label) {
      const input = label.querySelector('input[data-value]');
      const term = input ? vocabTermForOption(vocabKey, input.dataset.value) : null;
      if (term && term.description) items.push({ labelText: filterCheckboxLabelTextWithoutCount(label), desc: term.description });
    });
    if (items.length) {
      html += '<ul class="fides-vocab-popup-list">' + items.map(function (item) {
        return '<li><strong>' + escapeHtml(item.labelText) + '</strong>: ' + escapeHtml(item.desc) + '</li>';
      }).join('') + '</ul>';
    }
    if (!html) html = '<p>No description available.</p>';

    const popup = document.createElement('div');
    popup.className = 'fides-vocab-popup';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-label', 'Filter explanation');
    popup.innerHTML = html;
    const overlay = document.createElement('div');
    overlay.className = 'fides-vocab-overlay';
    document.body.appendChild(overlay);
    document.body.appendChild(popup);

    const margin = 20;
    const rect = button.getBoundingClientRect();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const left = Math.max(margin, Math.min(rect.right + 40, w - popup.offsetWidth - margin));
    const top = Math.max(margin, Math.min((h - popup.offsetHeight) / 2, h - popup.offsetHeight - margin));
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
    setTimeout(function () {
      overlay.classList.add('visible');
      popup.classList.add('visible');
    }, 10);

    function onKeydown(e) {
      if (e.key === 'Escape') close();
    }
    function close(e) {
      if (e && e.target && e.target.closest && e.target.closest('.fides-vocab-popup')) return;
      hideVocabularyPopup();
      document.removeEventListener('click', close, true);
      document.removeEventListener('keydown', onKeydown);
    }
    document.addEventListener('keydown', onKeydown);
    setTimeout(function () { document.addEventListener('click', close, true); }, 0);
  }

  function initVocabularyInfo(containerEl) {
    if (!vocabulary) return;
    hideVocabularyPopup();
    containerEl.querySelectorAll('.fides-vocab-info').forEach(function (btn) { btn.remove(); });
    containerEl.querySelectorAll('.fides-filter-group').forEach(function (groupEl) {
      const toggle = groupEl.querySelector('.fides-filter-label-toggle');
      const labelSpan = toggle && toggle.querySelector('.fides-filter-label');
      const vocabKey = CONNECTOR_FILTER_TO_VOCAB[groupEl.dataset.filterGroup];
      // No glossary content for this group (connector-specific taxonomies): skip the [i] button gracefully.
      if (!toggle || !labelSpan || !vocabKey || !groupHasVocabulary(groupEl, vocabKey)) return;
      const infoBtn = document.createElement('button');
      infoBtn.type = 'button';
      infoBtn.className = 'fides-vocab-info';
      infoBtn.dataset.group = vocabKey;
      infoBtn.setAttribute('aria-label', 'Explain filter');
      infoBtn.textContent = 'i';
      infoBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        showVocabularyPopup(e.currentTarget, groupEl, vocabKey);
      });
      const parent = labelSpan.parentNode;
      if (parent.classList && parent.classList.contains('fides-filter-label-with-info')) {
        parent.appendChild(infoBtn);
        return;
      }
      const wrapper = document.createElement('div');
      wrapper.className = 'fides-filter-label-with-info';
      parent.insertBefore(wrapper, labelSpan);
      wrapper.appendChild(labelSpan);
      wrapper.appendChild(infoBtn);
      const spacer = document.createElement('span');
      spacer.className = 'fides-filter-toggle-spacer';
      spacer.setAttribute('aria-hidden', 'true');
      parent.insertBefore(spacer, wrapper.nextSibling);
    });
  }

  // ---------------------------------------------------------------------------
  // Modal (shared FidesCatalogUI lifecycle)
  // ---------------------------------------------------------------------------

  function connectorWalletIds(connector) {
    const ids = arr(connector.compatibleWallets).map(function (wallet) { return wallet && wallet.id; });
    if (connector.walletReference && connector.walletReference.id) ids.push(connector.walletReference.id);
    return ids.filter(Boolean);
  }

  function rememberListingUrlIfNeeded() {
    if (listingUrlWhenOpened || isConnectorSharePath()) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('connector');
    listingUrlWhenOpened = url.pathname + url.search + url.hash;
  }

  async function openConnectorDetail(id) {
    const connector = connectors.find(function (item) { return item.id === id; });
    const ui = window.FidesCatalogUI;
    if (!connector || !ui || typeof ui.openConnectorModal !== 'function') return;
    rememberListingUrlIfNeeded();
    const walletSummaries = await fetchRatingSummaries('wallet', connectorWalletIds(connector));
    const opened = ui.openConnectorModal(connector, {
      theme: settings.theme,
      tierUiEnabled: TIER_UI_ENABLED,
      vocabulary: vocabulary,
      countryNames: COUNTRY_NAMES,
      organizationCatalogUrl: ORGANIZATION_CATALOG_PAGE_URL,
      bluePagesUrl: BLUE_PAGES_URL,
      updateFormUrl: UPDATE_FORM_URL,
      isLoggedIn: RATINGS_IS_LOGGED_IN,
      editAccess: EDIT_ACCESS,
      entityRatingSummaries: { wallet: walletSummaries },
      ratingsApiBase: RATINGS_API_BASE,
      ratingsNonce: RATINGS_NONCE,
      ratingsIsLoggedIn: RATINGS_IS_LOGGED_IN,
      ratingsLoginUrl: RATINGS_LOGIN_URL,
      sharePath: connectorSharePath(),
      walletSharePath: WALLET_SHARE_PATH,
      onRatingUpdate: function (updated) {
        if (!updated || updated.itemId !== connector.id) return;
        ratingSummariesById[connector.id] = { avg: updated.avg, count: updated.count, myRating: updated.myRating };
        if (sortBy === 'rating') renderGridOnly();
        else updateLikeInPlace(connector.id);
      }
    });
    if (opened !== false) {
      try {
        history.replaceState(null, '', connectorHref(connector));
      } catch (error) { /* ignore history errors */ }
    }
  }

  function bindModalClose() {
    if (modalCloseBound) return;
    modalCloseBound = true;
    document.addEventListener('fides-catalog-modal-closed', function () {
      const target = listingUrlWhenOpened || (isConnectorSharePath() ? listingBasePath() : '');
      if (!target) return;
      try {
        history.replaceState(null, '', target);
      } catch (error) { /* ignore history errors */ }
      listingUrlWhenOpened = '';
    });
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  function attachCardListeners() {
    container.querySelectorAll('.fides-wallet-card[data-connector-id]').forEach(function (card) {
      card.addEventListener('click', function (event) {
        if (isModifiedClick(event)) return;
        const nested = event.target.closest('a');
        if (nested && nested !== card && !nested.classList.contains('fides-catalog-card-link')) return;
        event.preventDefault();
        openConnectorDetail(card.dataset.connectorId);
      });
    });
  }

  function resetFilters() {
    filters.eudi = false;
    filters.addedLast30Days = false;
    filters.officialOnly = false;
    filters.openSource = null;
    filters.ids = [];
    FACET_GROUPS.forEach(function (group) {
      if (!group.special) filters[group.key] = [];
    });
    // Drop deep-link pre-filters so the checkbox disappears and the URL stays clean.
    originalIds = [];
    const url = new URL(window.location.href);
    let changed = false;
    ['connectors', 'country', 'profile'].forEach(function (param) {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        changed = true;
      }
    });
    if (changed) history.replaceState(null, '', url.toString());
  }

  function attachEventListeners() {
    const searchInput = document.getElementById('fides-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', debounce(function (event) {
        filters.search = event.target.value;
        resetListingPage();
        renderGridOnly();
      }, 300));
    }
    const searchClear = document.getElementById('fides-search-clear');
    if (searchClear) {
      searchClear.addEventListener('click', function () {
        filters.search = '';
        const input = document.getElementById('fides-search-input');
        if (input) input.value = '';
        resetListingPage();
        renderGridOnly();
      });
    }
    const askFides = document.getElementById('fides-ask-fides-trigger');
    if (askFides) {
      askFides.addEventListener('click', function () {
        if (!window.FidesAssistant || typeof window.FidesAssistant.open !== 'function') return;
        window.FidesAssistant.open({
          prefill: searchInput ? String(searchInput.value || '').trim() : filters.search,
          placeholder: ASK_FIDES_PLACEHOLDER
        });
      });
    }

    const mobile = getMobileFilters();
    if (mobile) {
      mobile.bindShell();
      mobile.bindCollapsibleToggles(filterGroupState);
    }
    initVocabularyInfo(container);

    container.querySelectorAll('.fides-filter-checkbox input[type="checkbox"]').forEach(function (box) {
      box.addEventListener('change', function () {
        const name = box.dataset.filter;
        const value = box.dataset.value;
        if (name === 'linkedConnectors') {
          filters.ids = box.checked ? originalIds.slice() : [];
        } else if (name === 'eudi' || name === 'addedLast30Days' || name === 'officialOnly') {
          filters[name] = box.checked;
        } else if (name === 'openSource') {
          filters.openSource = box.checked ? value === 'true' : null;
        } else if (box.checked) {
          if (filters[name].indexOf(value) === -1) filters[name].push(value);
        } else {
          filters[name] = filters[name].filter(function (item) { return item !== value; });
        }
        render();
      });
    });

    const sortSelect = document.getElementById('fides-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', function () {
        sortBy = ['explore', 'lastUpdated', 'rating', 'az'].indexOf(sortSelect.value) !== -1 ? sortSelect.value : 'explore';
        try {
          window.localStorage.setItem(SORT_PREFERENCE_STORAGE_KEY, sortBy);
        } catch (error) { /* ignore storage errors */ }
        render();
      });
    }

    container.querySelectorAll('.fides-view-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const next = btn.getAttribute('data-view') || 'grid';
        if (next !== 'grid' && next !== 'list') return;
        viewMode = next;
        lastEffectiveView = effectiveView();
        try {
          window.localStorage.setItem(VIEW_PREFERENCE_STORAGE_KEY, viewMode);
        } catch (error) { /* ignore storage errors */ }
        container.querySelectorAll('.fides-view-btn').forEach(function (b) {
          const active = b.getAttribute('data-view') === viewMode;
          b.classList.toggle('active', active);
          b.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        renderGridOnly();
      });
    });

    const clear = document.getElementById('fides-clear');
    if (clear) {
      clear.addEventListener('click', function () {
        resetFilters();
        render();
      });
    }

    attachCardListeners();
  }

  // ---------------------------------------------------------------------------
  // Loading and boot
  // ---------------------------------------------------------------------------

  function readQueryParams() {
    const params = new URLSearchParams(window.location.search);
    const profile = params.get('profile');
    if (profile && filters.interoperabilityProfiles.indexOf(profile) === -1) filters.interoperabilityProfiles.push(profile);
    const country = String(params.get('country') || '').replace(/[^a-z]/gi, '').toUpperCase();
    if (country.length === 2) filters.countries = [country];
    const idsParam = params.get('connectors');
    if (idsParam) {
      originalIds = idsParam.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      filters.ids = originalIds.slice();
    }
  }

  function revealSsrFallback() {
    const fallback = container.querySelector('[data-fides-ssr="connector"]');
    if (!fallback) return false;
    fallback.style.display = '';
    fallback.removeAttribute('aria-hidden');
    const spinner = container.querySelector('[data-fides-ssr-spinner="1"]');
    if (spinner) spinner.remove();
    return true;
  }

  async function loadConnectors() {
    const ui = window.FidesCatalogUI;
    const version = config.aggregatedDataVersion ? '?v=' + encodeURIComponent(config.aggregatedDataVersion) : '';
    const localUrl = config.localDataUrl ? config.localDataUrl + version : '';
    if (ui && typeof ui.loadCatalogAggregatedJson === 'function') {
      const loaded = await ui.loadCatalogAggregatedJson({
        remoteUrl: config.githubDataUrl,
        cacheUrl: config.cacheDataUrl,
        localUrl: localUrl
      });
      catalogLoadMeta.showStaleNotice = !!loaded.showStaleNotice;
      catalogLoadMeta.remoteFailed = !!loaded.remoteFailed;
      catalogLoadMeta.snapshotDate = loaded.snapshotDate || '';
      if (loaded.ok && loaded.data && Array.isArray(loaded.data.connectors)) return loaded.data.connectors;
      return [];
    }
    try {
      const response = await fetch(localUrl);
      const data = await response.json();
      return Array.isArray(data.connectors) ? data.connectors : [];
    } catch (error) {
      return [];
    }
  }

  async function init() {
    try {
      const savedSort = window.localStorage.getItem(SORT_PREFERENCE_STORAGE_KEY);
      if (['explore', 'az', 'lastUpdated', 'rating'].indexOf(savedSort) !== -1) sortBy = savedSort;
      const savedView = window.localStorage.getItem(VIEW_PREFERENCE_STORAGE_KEY);
      if (savedView === 'grid' || savedView === 'list') viewMode = savedView;
    } catch (error) { /* ignore storage errors (private mode) */ }
    lastEffectiveView = effectiveView();

    if (window.FidesCatalogUI && window.FidesCatalogUI.initMatomoLinkTracking) {
      window.FidesCatalogUI.initMatomoLinkTracking({
        category: 'Wallet Connector Catalog',
        containerSelector: '#fides-wallet-connector-catalog-root',
        modalOverlayId: 'fides-modal-overlay'
      });
    }

    connectors = await loadConnectors();
    if (!connectors.length) {
      // Only reveal the server-rendered fallback when no items could be loaded.
      if (revealSsrFallback()) {
        catalogLoadMeta.showStaleNotice = catalogLoadMeta.remoteFailed && !isFidesLocalDevHost();
        applyStaleCatalogNotice();
        return;
      }
    } else {
      await loadConnectorRatingSummaries(connectors).catch(function (error) {
        if (window.console) console.warn('Failed to load connector likes:', error.message);
      });
      filterFacets = computeFilterFacets(connectors);
    }

    readQueryParams();
    listingPage = listingPageFromLocation();
    bindModalClose();
    render({ keepListingPage: true });

    const id = connectorIdFromLocation();
    if (id && connectors.some(function (item) { return item.id === id; })) {
      setTimeout(function () { openConnectorDetail(id); }, 150);
    }

    window.addEventListener('resize', debounce(function () {
      if (mobileFiltersController) mobileFiltersController.onLeavingMobileViewport();
      const current = effectiveView();
      if (current !== lastEffectiveView) {
        lastEffectiveView = current;
        renderGridOnly();
      }
    }, 120));

    // Load vocabulary after the first render to avoid delaying the initial paint.
    if (config.vocabularyUrl || config.vocabularyFallbackUrl) {
      loadVocabulary(config.vocabularyUrl, config.vocabularyFallbackUrl).then(function (terms) {
        vocabulary = terms;
        if (vocabulary) initVocabularyInfo(container);
      });
    }
  }

  init().catch(function (error) {
    if (window.console) console.error('Wallet connector catalog failed to mount:', error);
    revealSsrFallback();
  });
})();
