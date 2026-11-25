<?php
/**
 * Registers the wallet connector catalog with the shared submission core
 * (fides-community-tools-tiles): validation, export document and prefill.
 *
 * @package fides-wallet-connector-catalog
 */

if (! defined('ABSPATH')) {
    exit;
}

if (! class_exists('Fides_Wallet_Connector_Catalog_Submission_Adapter')) {

    class Fides_Wallet_Connector_Catalog_Submission_Adapter {

        /** Submission registry slug (stored in the submissions table, max 32 chars). */
        const TYPE = 'wallet-connector';

        /** Catalog registry slug (see Fides_Wallet_Connector_Catalog_SSR::TYPE). */
        const CATALOG_TYPE = 'connector';

        const SCHEMA = 'https://fides.community/schemas/wallet-connector-catalog/v1';

        const GITHUB_REPO = 'FIDEScommunity/fides-wallet-connector-catalog';

        public static function bootstrap(): void {
            add_action('init', array(__CLASS__, 'register'), 6);
            add_filter('fides_catalog_github_sync_repos', array(__CLASS__, 'filter_github_repos'));
            add_filter('fides_catalog_github_commit_route_types', array(__CLASS__, 'filter_commit_route_types'));
            add_filter('fides_catalog_submission_public_item_url', array(__CLASS__, 'filter_public_item_url'), 10, 4);
            add_action('rest_api_init', array(__CLASS__, 'register_rest_routes'));
        }

        /**
         * Map the submission type to the connector catalog repository for GitHub push sync.
         *
         * @param mixed $repos Type => owner/repo map.
         * @return mixed
         */
        public static function filter_github_repos($repos) {
            if (! is_array($repos)) {
                return $repos;
            }
            if (empty($repos[ self::TYPE ])) {
                $repos[ self::TYPE ] = self::GITHUB_REPO;
            }
            return $repos;
        }

        /**
         * Commit the export as data/wp-export/wallet-connector.json (Contents API) instead of repository_dispatch.
         *
         * @param mixed $types Catalog types using the commit route.
         * @return mixed
         */
        public static function filter_commit_route_types($types) {
            if (is_array($types) && ! in_array(self::TYPE, $types, true)) {
                $types[] = self::TYPE;
            }
            return $types;
        }

        public static function register(): void {
            if (! class_exists('Fides_Catalog_Submission_Registry')) {
                return;
            }

            Fides_Catalog_Submission_Registry::register(
                self::TYPE,
                array(
                    'label'                    => __('Wallet connectors', 'fides-wallet-connector-catalog'),
                    'catalog_type'             => self::CATALOG_TYPE,
                    'id_pattern'               => '/^[a-z0-9-]+$/',
                    'community_filename'       => 'wallet-connector-catalog.json',
                    'slug_from_item_id'        => array(__CLASS__, 'slug_from_item_id'),
                    'slug_from_payload'        => array(__CLASS__, 'slug_from_payload'),
                    'validate_payload'         => array(__CLASS__, 'validate_payload'),
                    'payload_to_export'        => array(__CLASS__, 'payload_to_export'),
                    'catalog_item_to_payload'  => array(__CLASS__, 'catalog_item_to_payload'),
                    'prepare_payload_for_diff' => array(__CLASS__, 'prepare_payload_for_diff'),
                    'diff_field_labels'        => array(
                        'id'                        => 'Connector id',
                        'orgId'                     => 'Organization',
                        'name'                      => 'Connector name',
                        'description'               => 'Description',
                        'walletRef.walletCatalogId' => 'Business wallet reference',
                        'logo'                      => 'Logo URL',
                        'website'                   => 'Website',
                        'documentation'             => 'Documentation',
                        'repository'                => 'Repository',
                        'playgroundUrls'            => 'Playground URLs',
                        'connectorFunctions'        => 'Connector functions',
                        'deploymentModel'           => 'Deployment model',
                        'openSource'                => 'Open source',
                        'license'                   => 'License',
                        'licenseOther'              => 'License (other)',
                        'status'                    => 'Status',
                        'vcFormat'                  => 'VC formats',
                        'issuanceProtocols'         => 'Issuance protocols',
                        'presentationProtocols'     => 'Presentation protocols',
                        'interoperabilityProfiles'  => 'Interop profiles',
                        'credentialStatusMethods'   => 'Credential status methods',
                        'walletCompatibility'       => 'Compatible personal wallets',
                        'backendIntegrations'       => 'Backend integrations',
                        'frontendIntegrations'      => 'Frontend integrations',
                        'serviceModels'             => 'Service models',
                        'eidasRoles'                => 'eIDAS roles',
                        'certificateManagement'     => 'Certificate management',
                    ),
                )
            );
        }

        /**
         * Deep link for published-notification emails.
         *
         * @param string               $url          Current URL.
         * @param string               $catalog_type Submission type slug.
         * @param string               $item_id      Connector id.
         * @param array<string, mixed> $payload      Published payload.
         * @return string
         */
        public static function filter_public_item_url($url, $catalog_type, $item_id, $payload) {
            unset($payload);
            if ($catalog_type !== self::TYPE) {
                return $url;
            }
            $item_id = trim((string) $item_id);
            if ($item_id === '') {
                return $url;
            }
            $path = class_exists('Fides_Wallet_Connector_Catalog_SSR')
                ? Fides_Wallet_Connector_Catalog_SSR::LISTING_PATH
                : '/ecosystem-explorer/wallet-connectors/';
            return add_query_arg('connector', rawurlencode($item_id), home_url($path));
        }

        /**
         * Fallback export slug (folder under community-catalogs/).
         *
         * @param string $item_id Connector id.
         * @return string
         */
        public static function slug_from_item_id($item_id) {
            return sanitize_title((string) $item_id);
        }

        /**
         * Folder slug is derived from the org id (org:lissi -> lissi), like the wallet catalog.
         *
         * @param array<string, mixed> $payload Normalized payload.
         * @param string               $item_id Connector id.
         * @return string
         */
        public static function slug_from_payload(array $payload, $item_id) {
            unset($item_id);
            $org_id = isset($payload['orgId']) ? sanitize_text_field((string) $payload['orgId']) : '';
            if ($org_id !== '' && strpos($org_id, 'org:') === 0) {
                return sanitize_title(substr($org_id, 4));
            }
            return '';
        }

        /**
         * @param array<string, mixed> $payload Raw request payload.
         * @param array<string, mixed> $context action, type, optional item_id.
         * @return array<string, mixed>|WP_Error
         */
        public static function validate_payload(array $payload, array $context) {
            $td     = 'fides-wallet-connector-catalog';
            $action = isset($context['action']) ? sanitize_key((string) $context['action']) : 'create';

            $org_id = isset($payload['orgId']) ? sanitize_text_field((string) $payload['orgId']) : '';
            if ($org_id === '' || ! preg_match('/^org:[a-z0-9]+(?:-[a-z0-9]+)*$/', $org_id)) {
                return new WP_Error('fides_connector_invalid', __('A valid organization (org:…) is required.', $td));
            }

            $existing = null;
            if ($action === 'update') {
                $item_id = isset($context['item_id']) ? sanitize_text_field((string) $context['item_id']) : '';
                if ($item_id === '' || ! Fides_Catalog_Submission_Registry::is_valid_item_id(self::TYPE, $item_id)) {
                    return new WP_Error('fides_connector_invalid', __('Invalid connector id.', $td));
                }
                $existing = self::find_catalog_item($item_id);
                if (is_array($existing) && isset($existing['orgId']) && (string) $existing['orgId'] !== $org_id) {
                    return new WP_Error('fides_connector_invalid', __('Organization cannot be changed when updating a connector.', $td));
                }
                $payload_id = isset($payload['id']) ? sanitize_text_field((string) $payload['id']) : '';
                if ($payload_id !== '' && $payload_id !== $item_id) {
                    return new WP_Error('fides_connector_invalid', __('Connector id cannot be changed on update.', $td));
                }
                $payload['id'] = $item_id;
            } else {
                $item_id = isset($payload['id']) ? sanitize_text_field((string) $payload['id']) : '';
                if ($item_id === '' || ! preg_match('/^[a-z0-9-]+$/', $item_id)) {
                    return new WP_Error('fides_connector_invalid', __('Connector id is required (lowercase letters, numbers, hyphens).', $td));
                }
                // Connector ids are unique across all organizations (the crawler rejects duplicates).
                if (self::find_catalog_item($item_id)) {
                    return new WP_Error('fides_connector_invalid', __('This connector id already exists in the catalog.', $td));
                }
            }

            if (! self::organization_exists($org_id)) {
                return new WP_Error('fides_connector_invalid', __('The selected organization was not found in the organization catalog.', $td));
            }

            $result = Fides_Wallet_Connector_Catalog_V1_Normalizer::validate(
                $payload,
                array(
                    'org_id'        => $org_id,
                    'wallet_lookup' => array(__CLASS__, 'lookup_wallet'),
                    'org_has_qeaa'  => array(__CLASS__, 'lookup_org_has_qeaa'),
                )
            );
            if (! empty($result['errors'])) {
                return new WP_Error('fides_connector_invalid', (string) $result['errors'][0], array('errors' => $result['errors']));
            }

            $normalized            = $result['connector'];
            $normalized['orgId']   = $org_id;
            $normalized['item_id'] = $item_id;

            // Community listings: truncate the description and keep Pro-only fields at their published values.
            return Fides_Wallet_Connector_Catalog_Tier::constrain_submission($normalized, $org_id, $existing);
        }

        /**
         * Export document for community-catalogs/<org>/wallet-connector-catalog.json (one connector per entry).
         *
         * @param array<string, mixed> $payload Normalized payload.
         * @return array<string, mixed>
         */
        public static function payload_to_export(array $payload) {
            unset($payload['item_id']);
            $org_id    = isset($payload['orgId']) ? sanitize_text_field((string) $payload['orgId']) : '';
            $connector = Fides_Wallet_Connector_Catalog_V1_Normalizer::pick_connector_keys($payload);
            if (! isset($connector['id']) && isset($payload['id'])) {
                $connector = array('id' => sanitize_text_field((string) $payload['id'])) + $connector;
            }
            if ($org_id !== '') {
                $connector = Fides_Wallet_Connector_Catalog_Tier::filter_export($connector, $org_id);
            }
            return array(
                '$schema'     => self::SCHEMA,
                'orgId'       => $org_id,
                'connectors'  => array($connector),
                'lastUpdated' => gmdate(DATE_ATOM),
            );
        }

        /**
         * Prefill payload for the update form from an aggregated catalog item.
         *
         * @param array<string, mixed> $item Aggregated connector item.
         * @return array<string, mixed>
         */
        public static function catalog_item_to_payload(array $item) {
            // The crawler falls back to the organization logo/website; do not copy those fallbacks into the form payload.
            $item = Fides_Wallet_Connector_Catalog_V1_Normalizer::strip_organization_fallbacks($item);

            $payload = array(
                'orgId' => isset($item['orgId']) ? (string) $item['orgId'] : '',
                'id'    => isset($item['id']) ? (string) $item['id'] : '',
            );
            foreach (Fides_Wallet_Connector_Catalog_V1_Normalizer::pick_connector_keys($item) as $key => $value) {
                if ($key !== 'id') {
                    $payload[ $key ] = $value;
                }
            }

            if (isset($payload['credentialStatusMethods']) && is_array($payload['credentialStatusMethods'])) {
                $methods = array();
                foreach ($payload['credentialStatusMethods'] as $method) {
                    $method = (string) $method;
                    if (isset(Fides_Wallet_Connector_Catalog_V1_Normalizer::CREDENTIAL_STATUS_ALIASES[ $method ])) {
                        $method = Fides_Wallet_Connector_Catalog_V1_Normalizer::CREDENTIAL_STATUS_ALIASES[ $method ];
                    }
                    if (! in_array($method, $methods, true)) {
                        $methods[] = $method;
                    }
                }
                $payload['credentialStatusMethods'] = $methods;
            }

            return self::prepare_payload_for_diff($payload);
        }

        /**
         * @param array<string, mixed> $payload Submission or catalog payload.
         * @return array<string, mixed>
         */
        public static function prepare_payload_for_diff(array $payload) {
            if (array_key_exists('openSource', $payload)) {
                $payload['openSource'] = (bool) $payload['openSource'];
            }
            foreach ($payload as $key => $value) {
                if ($value === '' || $value === null || $value === array()) {
                    unset($payload[ $key ]);
                }
            }
            return $payload;
        }

        /**
         * Minimal wallet projection used by the cross-catalog validation rules.
         *
         * @param string $wallet_id Wallet catalog id.
         * @return array{type: string, orgId: string}|null
         */
        public static function lookup_wallet($wallet_id) {
            if (! class_exists('Fides_Catalog_Source') || ! class_exists('Fides_Catalog_Registry') || ! Fides_Catalog_Registry::exists('wallet')) {
                return null;
            }
            $source = Fides_Catalog_Source::for('wallet');
            $wallet = $source ? $source->find_by_id((string) $wallet_id) : null;
            if (! is_array($wallet)) {
                return null;
            }
            return array(
                'type'  => (string) ($wallet['type'] ?? ''),
                'orgId' => (string) ($wallet['orgId'] ?? ''),
            );
        }

        /**
         * @param string $org_id org:slug.
         * @return bool|null Null when the organization catalog is unavailable.
         */
        public static function lookup_org_has_qeaa($org_id) {
            $org = self::find_organization((string) $org_id);
            if (! is_array($org)) {
                return null;
            }
            return Fides_Wallet_Connector_Catalog_V1_Normalizer::organization_has_qeaa($org);
        }

        /**
         * Compact wallet list for the form pickers (id, name, type, orgId, provider).
         *
         * @return array<int, array<string, string>>
         */
        public static function wallet_options(): array {
            if (! class_exists('Fides_Catalog_Source') || ! class_exists('Fides_Catalog_Registry') || ! Fides_Catalog_Registry::exists('wallet')) {
                return array();
            }
            $source = Fides_Catalog_Source::for('wallet');
            $items  = $source ? $source->all() : array();
            $out    = array();
            foreach ($items as $wallet) {
                if (! is_array($wallet) || empty($wallet['id'])) {
                    continue;
                }
                $type = (string) ($wallet['type'] ?? '');
                if ($type !== 'personal' && $type !== 'organizational') {
                    continue;
                }
                $provider = isset($wallet['provider']) && is_array($wallet['provider']) ? (string) ($wallet['provider']['name'] ?? '') : '';
                $out[]    = array(
                    'id'       => (string) $wallet['id'],
                    'name'     => (string) ($wallet['name'] ?? $wallet['id']),
                    'type'     => $type,
                    'orgId'    => (string) ($wallet['orgId'] ?? ''),
                    'provider' => $provider,
                );
            }
            usort(
                $out,
                static function ($a, $b) {
                    return strcasecmp($a['name'], $b['name']);
                }
            );
            return $out;
        }

        public static function register_rest_routes(): void {
            register_rest_route(
                'fides-catalog/v1',
                '/wallet-connector/org-context',
                array(
                    'methods'             => 'GET',
                    'permission_callback' => function () {
                        return is_user_logged_in()
                            ? true
                            : new WP_Error('fides_submission_auth', __('You must be signed in.', 'fides-wallet-connector-catalog'), array('status' => 401));
                    },
                    'callback'            => array(__CLASS__, 'handle_org_context'),
                    'args'                => array(
                        'orgId' => array(
                            'type'              => 'string',
                            'required'          => true,
                            'sanitize_callback' => 'sanitize_text_field',
                        ),
                    ),
                )
            );
        }

        /**
         * Organization facts the form needs to apply the QEAA rule.
         *
         * @param WP_REST_Request $request Request.
         * @return WP_REST_Response|WP_Error
         */
        public static function handle_org_context($request) {
            $org_id = sanitize_text_field((string) $request->get_param('orgId'));
            if (! preg_match('/^org:[a-z0-9]+(?:-[a-z0-9]+)*$/', $org_id)) {
                return new WP_Error('fides_connector_org', __('Invalid organization id.', 'fides-wallet-connector-catalog'), array('status' => 400));
            }
            return rest_ensure_response(
                array(
                    'orgId'   => $org_id,
                    'hasQeaa' => self::lookup_org_has_qeaa($org_id) === true,
                )
            );
        }

        /**
         * @param string $connector_id Connector catalog id.
         * @return array<string, mixed>|null
         */
        private static function find_catalog_item($connector_id) {
            if (class_exists('Fides_Catalog_Submission_Lookups')) {
                $item = Fides_Catalog_Submission_Lookups::find_item_by_id(self::TYPE, $connector_id);
                if (is_array($item)) {
                    return $item;
                }
            }
            return null;
        }

        /**
         * @param string $org_id org:slug.
         * @return array<string, mixed>|null
         */
        private static function find_organization($org_id) {
            if (! class_exists('Fides_Catalog_Source') || ! class_exists('Fides_Catalog_Registry') || ! Fides_Catalog_Registry::exists('organization')) {
                return null;
            }
            $source = Fides_Catalog_Source::for('organization');
            $org    = $source ? $source->find_by_id($org_id) : null;
            return is_array($org) ? $org : null;
        }

        /**
         * @param string $org_id org:slug.
         * @return bool
         */
        private static function organization_exists($org_id) {
            if (! class_exists('Fides_Catalog_Source') || ! class_exists('Fides_Catalog_Registry')) {
                return true;
            }
            if (! Fides_Catalog_Registry::exists('organization')) {
                return true;
            }
            return is_array(self::find_organization($org_id));
        }
    }
}
