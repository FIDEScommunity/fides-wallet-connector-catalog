<?php
/**
 * Connector-specific SSR integration for the shared catalog renderer.
 *
 * @package fides-wallet-connector-catalog
 */

if (! defined('ABSPATH')) {
    exit;
}

if (! class_exists('Fides_Wallet_Connector_Catalog_SSR')) {
    if (! class_exists('Fides_Catalog_SSR_Renderer')) {
        class Fides_Wallet_Connector_Catalog_SSR {
            const LISTING_PATH = '/ecosystem-explorer/wallet-connectors/';
            public static function bootstrap() {}
            public static function build_initial_html(array $atts) { return ''; }
        }
    } else {
        class Fides_Wallet_Connector_Catalog_SSR extends Fides_Catalog_SSR_Renderer {
            const TYPE = 'connector';
            const LISTING_PATH = '/ecosystem-explorer/wallet-connectors/';
            const DETAIL_PATH = '/connector/';
            /** @var self|null */
            private static $instance = null;

            public static function bootstrap(): void {
                if (self::$instance === null) {
                    self::$instance = new self();
                    self::$instance->bootstrap_renderer();
                }
            }

            public static function build_initial_html(array $atts): string {
                self::bootstrap();
                return self::$instance->render_initial_html($atts);
            }

            protected function type(): string { return self::TYPE; }
            protected function text_domain(): string { return 'fides-wallet-connector-catalog'; }
            protected function shortcode_root_id(): string { return 'fides-wallet-connector-catalog-root'; }
            protected function loading_label(): string {
                return __('Loading wallet connector catalog…', 'fides-wallet-connector-catalog');
            }
            protected function supports_standalone_detail_page(): bool { return true; }

            public function register_with_core(): void {
                if (! class_exists('Fides_Catalog_Registry')) {
                    return;
                }
                Fides_Catalog_Registry::register(self::TYPE, array(
                    'label'             => __('Wallet connectors', 'fides-wallet-connector-catalog'),
                    'json_url'          => 'https://raw.githubusercontent.com/FIDEScommunity/fides-wallet-connector-catalog/main/data/aggregated.json',
                    'local_json_path'   => dirname(__DIR__) . '/data/aggregated.json',
                    'collection_key'    => 'connectors',
                    'id_field'          => 'id',
                    'name_field'        => 'name',
                    'description_field' => 'description',
                    'logo_field'        => 'logo',
                    'detail_param'      => 'connector',
                    'pretty_path'       => self::DETAIL_PATH,
                    'pages'             => array('default' => self::LISTING_PATH),
                    'jsonld_type'       => 'SoftwareApplication',
                ));
            }

            protected function listing_page_name(string $page_slug): string {
                return __('Wallet Connector Catalog', 'fides-wallet-connector-catalog');
            }

            protected function listing_page_url(string $page_slug): string {
                return home_url(self::LISTING_PATH);
            }

            public function filter_detail_url_base($base, $type, $item) {
                return $type === self::TYPE ? self::LISTING_PATH : $base;
            }

            /** Labels mirrored from CONNECTOR_VALUE_LABELS in fides-catalog-ui.js. */
            private const VALUE_LABELS = array(
                'issuer'               => 'Issuer',
                'verifier'             => 'Verifier',
                'saas'                 => 'SaaS',
                'on_premises'          => 'On-premises',
                'hybrid'               => 'Hybrid',
                'software_only'        => 'Software only',
                'managed_verification' => 'Managed verification',
                'managed_issuance'     => 'Managed issuance',
                'oidc_oauth2'          => 'OIDC / OAuth 2.0',
                'saml2'                => 'SAML 2.0',
                'rest_api'             => 'REST API',
                'webhooks'             => 'Webhooks',
                'server_sdk'           => 'Server SDK',
                'hosted_ui_redirect'   => 'Hosted UI (redirect)',
                'headless_api'         => 'Headless API',
                'frontend_sdk'         => 'Frontend SDK',
                'web_component'        => 'Web component',
                'other'                => 'Other',
                'rp_intermediary'      => 'RP intermediary',
                'eaa_provider'         => 'EAA provider',
                'qeaa_provider'        => 'QEAA provider',
                'provider_managed'     => 'Provider-managed',
                'customer_managed'     => 'Customer-managed',
                'both'                 => 'Provider- or customer-managed',
                'development'          => 'In Development',
                'beta'                 => 'Beta',
                'production'           => 'Production',
                'deprecated'           => 'Deprecated',
            );

            /** Credential format labels mirrored from CREDENTIAL_FORMAT_DISPLAY. */
            private const VC_FORMAT_LABELS = array(
                'sd_jwt_vc'          => 'SD-JWT VC',
                'mdoc'               => 'ISO mDoc',
                'jwt_vc'             => 'JWT VC',
                'vcdm_1_1'           => 'VCDM1.1',
                'vcdm_2_0'           => 'VCDM2.0',
                'anoncreds'          => 'AnonCreds',
                'idemix'             => 'Idemix',
                'apple_wallet_pass'  => 'Apple Wallet Pass',
                'google_wallet_pass' => 'Google Wallet Pass',
                'acdc'               => 'ACDC',
            );

            /** License labels mirrored from WALLET_LICENSE_LABELS. */
            private const LICENSE_LABELS = array(
                'GPL-3.0-or-later'  => 'GPL-3.0 or later',
                'AGPL-3.0-or-later' => 'AGPL-3.0 or later',
                'LGPL-3.0-or-later' => 'LGPL-3.0 or later',
                'proprietary'       => 'Proprietary (closed source)',
                'other'             => 'Other',
            );

            /** Human-readable label for an enum code; unknown codes are humanized. */
            private function value_label(string $value, string $group = ''): string {
                $raw = trim($value);
                if ($raw === '') {
                    return '';
                }
                if ($group === 'vcFormat' && isset(self::VC_FORMAT_LABELS[$raw])) {
                    return self::VC_FORMAT_LABELS[$raw];
                }
                if ($group === 'license' && isset(self::LICENSE_LABELS[$raw])) {
                    return self::LICENSE_LABELS[$raw];
                }
                if (isset(self::VALUE_LABELS[$raw])) {
                    return self::VALUE_LABELS[$raw];
                }
                if (strpos($raw, '_') === false) {
                    return $raw;
                }
                return ucfirst(str_replace('_', ' ', $raw));
            }

            /** @return array<int, string> */
            private function labeled_list(array $item, string $key): array {
                $out = array();
                foreach ($this->list_field($item, $key) as $v) {
                    $out[] = $this->value_label($v, $key);
                }
                return array_values(array_unique(array_filter($out, 'strlen')));
            }

            protected function enrich_jsonld(array $jsonld, array $item): array {
                $jsonld['applicationCategory'] = 'SecurityApplication';
                $keywords = array_unique(array_merge(
                    $this->labeled_list($item, 'connectorFunctions'),
                    $this->labeled_list($item, 'vcFormat'),
                    $this->list_field($item, 'issuanceProtocols'),
                    $this->list_field($item, 'presentationProtocols'),
                    $this->list_field($item, 'interoperabilityProfiles')
                ));
                if ($keywords) {
                    $jsonld['keywords'] = implode(', ', $keywords);
                }
                if (! empty($item['organization']['name'])) {
                    $jsonld['publisher'] = array(
                        '@type' => 'Organization',
                        'name'  => (string) $item['organization']['name'],
                    );
                }
                return $jsonld;
            }

            protected function detail_meta_rows(array $item): array {
                $td   = 'fides-wallet-connector-catalog';
                $rows = array();
                if (! empty($item['status'])) {
                    $rows[] = array('label' => __('Status', $td), 'html' => esc_html($this->value_label((string) $item['status'])));
                }
                if (! empty($item['deploymentModel'])) {
                    $rows[] = array('label' => __('Deployment', $td), 'html' => esc_html($this->value_label((string) $item['deploymentModel'])));
                }
                if (! empty($item['license']) && is_string($item['license'])) {
                    $license = $this->value_label($item['license'], 'license');
                    if ($item['license'] === 'other' && ! empty($item['licenseOther']) && is_string($item['licenseOther'])) {
                        $license = trim($item['licenseOther']);
                    }
                    $rows[] = array('label' => __('License', $td), 'html' => esc_html($license));
                }
                if (! empty($item['certificateManagement']) && is_string($item['certificateManagement'])) {
                    $rows[] = array('label' => __('Certificate management', $td), 'html' => esc_html($this->value_label($item['certificateManagement'])));
                }
                if (! empty($item['organization']['country'])) {
                    $rows[] = array('label' => __('Provider country', $td), 'html' => esc_html((string) $item['organization']['country']));
                }
                return $rows;
            }

            protected function detail_extra_sections(array $item): string {
                $td = 'fides-wallet-connector-catalog';
                return $this->render_chip_section($this->labeled_list($item, 'connectorFunctions'), __('Functions', $td))
                    . $this->render_chip_section($this->labeled_list($item, 'eidasRoles'), __('eIDAS roles', $td))
                    . $this->render_chip_section($this->labeled_list($item, 'vcFormat'), __('VC formats', $td))
                    . $this->render_chip_section($this->list_field($item, 'issuanceProtocols'), __('Issuance protocols', $td))
                    . $this->render_chip_section($this->list_field($item, 'presentationProtocols'), __('Presentation protocols', $td))
                    . $this->render_chip_section($this->list_field($item, 'credentialStatusMethods'), __('Credential status methods', $td))
                    . $this->render_chip_section($this->labeled_list($item, 'backendIntegrations'), __('Backend integrations', $td))
                    . $this->render_chip_section($this->labeled_list($item, 'frontendIntegrations'), __('Frontend integrations', $td))
                    . $this->render_chip_section($this->labeled_list($item, 'serviceModels'), __('Service models', $td));
            }
        }
    }
}
