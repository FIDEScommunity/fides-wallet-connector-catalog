<?php
/**
 * Public submission forms (add connector / suggest update).
 *
 * Mirrors Fides_Wallet_Catalog_Submission_Forms: the forms only render the UI;
 * authentication, persistence, moderation and export are handled by the shared
 * submission core of fides-community-tools-tiles.
 *
 * @package fides-wallet-connector-catalog
 */

if (! defined('ABSPATH')) {
    exit;
}

if (! class_exists('Fides_Wallet_Connector_Catalog_Submission_Forms')) {

    class Fides_Wallet_Connector_Catalog_Submission_Forms {

        const VERSION = '1.2.0';

        /**
         * @param string $mode create|update.
         */
        private static function section_intro_for_mode($mode): string {
            if ($mode === 'update') {
                return __('Search for your connector, then review and edit the fields below.', 'fides-wallet-connector-catalog');
            }
            return __('Select the organization, then enter the connector details for the FIDES Wallet Connector Catalog.', 'fides-wallet-connector-catalog');
        }

        /** @var array<string, string> */
        const FIELD_HELP = array(
            'orgSearch'                => 'Search the organization catalog and select the provider of this connector.',
            'connectorSearch'          => 'Search by connector name or id, then select the correct entry.',
            'id'                       => 'Stable catalog id (lowercase, hyphens). Unique across all connectors. Used in deep links (?connector=…).',
            'name'                     => 'Display name of the connector product.',
            'status'                   => 'Deployment maturity of the connector.',
            'description'              => 'Short description of the connector: what it connects and which credential flows it supports.',
            'connectorFunctions'       => 'Whether the connector lets applications issue credentials, verify credentials, or both.',
            'deploymentModel'          => 'How customers run this connector: vendor-hosted cloud (SaaS), fully on-premises, or a hybrid of both.',
            'serviceModels'            => 'Software only, or a managed service where the provider operates verification or issuance on behalf of the customer.',
            'logo'                     => 'Direct URL to a logo image (PNG, SVG, or JPG) shown on catalog cards and the connector detail page. Leave empty to use the organization logo.',
            'website'                  => 'Official product page. Leave empty to use the organization website.',
            'documentation'            => 'Link to technical or product documentation — API references and integration guides.',
            'repository'               => 'Public source code repository, if applicable — for example GitHub or GitLab.',
            'playgroundUrls'           => 'Public sandboxes or demo environments where developers can try the connector. One URL per row.',
            'mediaVideos'              => 'Short product demos embedded on your public listing. Paste YouTube or Vimeo links — one per row (max 3).',
            'mediaImages'              => 'Screenshots or product images visitors see on your connector page. Upload a file or paste a URL — one per row (max 10).',
            'license'                  => 'Software license of the connector. The catalog shows open vs closed source based on this choice.',
            'licenseOther'             => 'Exact license name when none of the standard options apply. Required if you selected Other (max 100 characters).',
            'walletRef'                => 'Optional: the business wallet from the Wallet Catalog that ships with or is part of this connector. Only business wallets of the same organization can be selected.',
            'walletCompatibility'      => 'Personal wallets from the Wallet Catalog that are known to work with this connector.',
            'vcFormat'                 => 'Credential formats the connector can issue or verify.',
            'issuanceProtocols'        => 'Protocols used to issue credentials. Required for issuer connectors.',
            'presentationProtocols'    => 'Protocols used to request and verify presentations. Required for verifier connectors.',
            'interoperabilityProfiles' => 'Interop profiles the connector supports. EUDI Wallet ARF is required for the RP intermediary role.',
            'credentialStatusMethods'  => 'Credential status / revocation methods the connector supports.',
            'backendIntegrations'      => 'How your customers\' backend systems integrate with the connector.',
            'frontendIntegrations'     => 'How the user-facing flow is embedded in customer applications.',
            'certificateManagement'    => 'Who manages the certificates used for wallet interactions: the provider, the customer, or either.',
            'eidasRoles'               => 'Optional eIDAS roles the provider fulfils with this connector. Each role has prerequisites (functions, service models, interop profile).',
            'contactEmail'             => 'Taken from your FIDES account; used for submission review only, not published as the connector contact.',
        );

        public static function bootstrap(): void {
            add_action('wp_enqueue_scripts', array(__CLASS__, 'register_assets'));
            add_shortcode('fides_wallet_connector_submit_form', array(__CLASS__, 'render_submit_shortcode'));
            add_shortcode('fides_wallet_connector_update_form', array(__CLASS__, 'render_update_shortcode'));
        }

        public static function register_assets(): void {
            $base = plugin_dir_path(dirname(__FILE__));
            $url  = plugin_dir_url(dirname(__FILE__));

            $version = static function (string $relative) use ($base): string {
                $path = $base . $relative;
                return file_exists($path) ? (string) filemtime($path) : self::VERSION;
            };

            wp_register_style('fides-wallet-connector-form', $url . 'assets/connector-form.css', array(), $version('assets/connector-form.css'));
            wp_register_script('fides-wallet-connector-form-rules', $url . 'assets/connector-form-rules.js', array(), $version('assets/connector-form-rules.js'), true);
            wp_register_script(
                'fides-wallet-connector-form',
                $url . 'assets/connector-form.js',
                array('fides-wallet-connector-form-rules'),
                $version('assets/connector-form.js'),
                true
            );
        }

        /**
         * @param array<string, mixed> $atts Shortcode attributes.
         */
        public static function render_submit_shortcode($atts = array()): string {
            return self::render_form_shortcode('create', $atts);
        }

        /**
         * @param array<string, mixed> $atts Shortcode attributes (connector = optional preselected id).
         */
        public static function render_update_shortcode($atts = array()): string {
            $atts = shortcode_atts(
                array(
                    'connector' => '',
                ),
                $atts,
                'fides_wallet_connector_update_form'
            );

            $preselect = self::normalize_connector_query_param((string) $atts['connector']);
            if ($preselect === '' && isset($_GET['connector'])) {
                // phpcs:ignore WordPress.Security.NonceVerification.Recommended
                $preselect = self::normalize_connector_query_param((string) wp_unslash($_GET['connector']));
            }
            return self::render_form_shortcode('update', array('preselectConnectorId' => $preselect));
        }

        /**
         * @param string               $mode  create|update.
         * @param array<string, mixed> $extra Extra config for inline script.
         */
        private static function render_form_shortcode($mode, array $extra = array()): string {
            if (! class_exists('Fides_Catalog_Submission_Registry')
                || ! Fides_Catalog_Submission_Registry::exists(Fides_Wallet_Connector_Catalog_Submission_Adapter::TYPE)) {
                return '<div class="fides-use-case-card"><p>' . esc_html__(
                    'Connector submissions are unavailable (missing submission core or adapter).',
                    'fides-wallet-connector-catalog'
                ) . '</p></div>';
            }

            if (! is_user_logged_in()) {
                wp_enqueue_style('fides-wallet-connector-form');
                $login_url = self::form_login_url();
                return sprintf(
                    '<div class="fides-use-case-card"><p>%s</p><p><a class="fides-org-form-login-link" href="%s">%s</a></p></div>',
                    esc_html__('You must be signed in to submit connector catalog changes.', 'fides-wallet-connector-catalog'),
                    esc_url($login_url),
                    esc_html__('Sign in to continue', 'fides-wallet-connector-catalog')
                );
            }

            $user = wp_get_current_user();
            if ($mode === 'update' && ! empty($extra['preselectConnectorId']) && class_exists('Fides_Catalog_Org_Tier')) {
                $connector_id = (string) $extra['preselectConnectorId'];
                $existing     = class_exists('Fides_Catalog_Submission_Lookups')
                    ? Fides_Catalog_Submission_Lookups::find_item_by_id(Fides_Wallet_Connector_Catalog_Submission_Adapter::TYPE, $connector_id)
                    : null;
                if (! Fides_Catalog_Org_Tier::user_can_edit_item(
                    Fides_Wallet_Connector_Catalog_Submission_Adapter::TYPE,
                    $connector_id,
                    (int) $user->ID,
                    is_array($existing) ? $existing : null
                )) {
                    return '<div class="fides-use-case-card"><p>' . esc_html__(
                        'This connector belongs to a Pro organization. Only the linked owner or a site administrator can suggest updates.',
                        'fides-wallet-connector-catalog'
                    ) . '</p></div>';
                }
            }

            wp_enqueue_style('fides-wallet-connector-form');
            wp_enqueue_script('fides-wallet-connector-form-rules');
            wp_enqueue_script('fides-wallet-connector-form');

            $plugin_url = plugin_dir_url(dirname(__FILE__));
            $config     = array_merge(
                array(
                    'mode'                  => $mode === 'update' ? 'update' : 'create',
                    'apiBase'               => esc_url_raw(rest_url('fides-catalog/v1')),
                    'restNonce'             => wp_create_nonce('wp_rest'),
                    'vocabularyUrl'         => 'https://raw.githubusercontent.com/FIDEScommunity/fides-interop-profiles/main/data/vocabulary.json',
                    'vocabularyFallbackUrl' => $plugin_url . 'assets/vocabulary.json',
                    'walletCatalogUrl'      => 'https://raw.githubusercontent.com/FIDEScommunity/fides-wallet-catalog/main/data/aggregated.json',
                    'contactEmail'          => sanitize_email((string) $user->user_email),
                    'enums'                 => Fides_Wallet_Connector_Catalog_V1_Normalizer::form_enums(),
                    'enumLabels'            => Fides_Wallet_Connector_Catalog_V1_Normalizer::enum_labels(),
                    'fieldHelp'             => self::FIELD_HELP,
                    'sectionIntro'          => self::section_intro_for_mode($mode),
                    'limits'                => Fides_Wallet_Connector_Catalog_V1_Normalizer::limits_for_form(),
                    'wallets'               => Fides_Wallet_Connector_Catalog_Submission_Adapter::wallet_options(),
                    'preselectConnectorId'  => '',
                    'planTier'              => class_exists('Fides_Catalog_Org_Tier')
                        ? Fides_Catalog_Org_Tier::form_config(self::plan_org_id_for_form($mode, $extra))
                        : array(
                            'tierUiEnabled'        => false,
                            'tier'                 => 'Community',
                            'isPro'                => false,
                            'plansUrl'             => home_url('/plans/'),
                            'descriptionMaxLength' => 2000,
                        ),
                ),
                $extra
            );

            wp_add_inline_script(
                'fides-wallet-connector-form',
                'window.FIDES_WALLET_CONNECTOR_FORM_CONFIG = ' . wp_json_encode($config) . ';',
                'before'
            );

            $root_id = $mode === 'update' ? 'fides-connector-update-form-root' : 'fides-connector-submit-form-root';
            return '<div id="' . esc_attr($root_id) . '" class="fides-connector-submission-root fides-org-submission-root"></div>';
        }

        public static function form_login_url(): string {
            $current_request_uri = isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : '';
            $current_host        = isset($_SERVER['HTTP_HOST']) ? sanitize_text_field(wp_unslash($_SERVER['HTTP_HOST'])) : '';
            $current_url         = $current_host !== ''
                ? ((is_ssl() ? 'https://' : 'http://') . $current_host . $current_request_uri)
                : home_url('/');

            $oid4vp_options = get_option('universal_openid4vp_options', array());
            if (is_array($oid4vp_options) && ! empty($oid4vp_options['loginUrl'])) {
                return esc_url_raw(
                    add_query_arg('return_to', $current_url, (string) $oid4vp_options['loginUrl'])
                );
            }
            return wp_login_url($current_url);
        }

        /**
         * Resolve organization id for planTier / org-tier REST on connector forms.
         *
         * @param string               $mode  create|update.
         * @param array<string, mixed> $extra Shortcode config (preselectConnectorId).
         */
        private static function plan_org_id_for_form($mode, array $extra = array()): string {
            if ($mode !== 'update' || empty($extra['preselectConnectorId'])) {
                return '';
            }
            if (! class_exists('Fides_Catalog_Submission_Lookups')) {
                return '';
            }
            $connector = Fides_Catalog_Submission_Lookups::find_item_by_id(
                Fides_Wallet_Connector_Catalog_Submission_Adapter::TYPE,
                (string) $extra['preselectConnectorId']
            );
            if (! is_array($connector)) {
                return '';
            }
            return trim((string) ($connector['orgId'] ?? ''));
        }

        private static function normalize_connector_query_param($raw): string {
            $raw = sanitize_text_field(trim((string) $raw));
            if ($raw === '' || ! class_exists('Fides_Catalog_Submission_Registry')) {
                return '';
            }
            return Fides_Catalog_Submission_Registry::is_valid_item_id(Fides_Wallet_Connector_Catalog_Submission_Adapter::TYPE, $raw) ? $raw : '';
        }
    }
}
