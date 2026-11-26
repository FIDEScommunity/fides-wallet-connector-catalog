<?php
/**
 * Normalization and schema-rule validation for wallet connector submissions.
 *
 * Mirrors schemas/wallet-connector-catalog.schema.json (v1) plus the cross-catalog
 * rules enforced by the crawler (src/crawler/validation.ts). The class is pure
 * (no WordPress lookups): cross-catalog data is injected through a context array
 * so the rules can be unit-tested without WordPress.
 *
 * @package fides-wallet-connector-catalog
 */

if (! defined('ABSPATH')) {
    exit;
}

if (! class_exists('Fides_Wallet_Connector_Catalog_V1_Normalizer')) {

    class Fides_Wallet_Connector_Catalog_V1_Normalizer {

        const LIMIT_NAME           = 150;
        const LIMIT_DESCRIPTION    = 2000;
        const LIMIT_LICENSE_OTHER  = 100;
        const LIMIT_PLAYGROUND_URLS = 10;
        const LIMIT_MEDIA_VIDEOS   = 3;
        const LIMIT_MEDIA_IMAGES   = 10;

        /** @var string[] */
        const FUNCTIONS = array('issuer', 'verifier');

        /** @var string[] */
        const DEPLOYMENT_MODELS = array('saas', 'on_premises', 'hybrid');

        /** @var string[] */
        const STATUSES = array('development', 'beta', 'production', 'deprecated');

        /** @var string[] */
        const LICENSES = array(
            'MIT',
            'Apache-2.0',
            'GPL-3.0-or-later',
            'AGPL-3.0-or-later',
            'LGPL-3.0-or-later',
            'EUPL-1.2',
            'MPL-2.0',
            'BSD-3-Clause',
            'ISC',
            'proprietary',
            'other',
        );

        /** @var string[] */
        const VC_FORMATS = array(
            'sd_jwt_vc',
            'mdoc',
            'jwt_vc',
            'vcdm_1_1',
            'vcdm_2_0',
            'anoncreds',
            'idemix',
            'apple_wallet_pass',
            'google_wallet_pass',
            'acdc',
        );

        /** @var string[] */
        const ISSUANCE_PROTOCOLS = array(
            'OpenID4VCI',
            'DIDComm Issue Credential v1',
            'DIDComm Issue Credential v2',
            'ISO 18013-5 (Device Retrieval)',
        );

        /** @var string[] */
        const PRESENTATION_PROTOCOLS = array(
            'OpenID4VP',
            'DIDComm Present Proof v1',
            'DIDComm Present Proof v2',
            'ISO 18013-5',
            'SIOPv2',
        );

        /** @var string[] */
        const INTEROP_PROFILES = array('DIIP v4', 'DIIP v5', 'EWC v3', 'EUDI Wallet ARF', 'HAIP v1');

        /** @var string[] Canonical values offered in the form. */
        const CREDENTIAL_STATUS_METHODS = array(
            'StatusList2021',
            'RevocationList2020',
            'OCSP',
            'CRL',
            'IETF Token Status List',
            'Bitstring Status List',
        );

        /** @var array<string, string> Legacy schema values mapped to the canonical form value. */
        const CREDENTIAL_STATUS_ALIASES = array(
            'Token Status List'                           => 'IETF Token Status List',
            'W3C Verifiable Credentials Status List v2021' => 'StatusList2021',
            'BitstringStatusList v1.0'                    => 'Bitstring Status List',
        );

        /** @var string[] */
        const BACKEND_INTEGRATIONS = array('oidc_oauth2', 'saml2', 'rest_api', 'webhooks', 'server_sdk', 'other');

        /** @var string[] */
        const FRONTEND_INTEGRATIONS = array('hosted_ui_redirect', 'headless_api', 'frontend_sdk', 'web_component', 'other');

        /** @var string[] */
        const SERVICE_MODELS = array('software_only', 'managed_verification', 'managed_issuance');

        /** @var string[] */
        const EIDAS_ROLES = array('rp_intermediary', 'eaa_provider', 'qeaa_provider');

        /** @var string[] */
        const CERTIFICATE_MANAGEMENT = array('provider_managed', 'customer_managed', 'both');

        /** @var string[] Connector keys that can be stored/exported (schema property order). */
        const CONNECTOR_KEYS = array(
            'id',
            'name',
            'description',
            'walletRef',
            'media',
            'logo',
            'website',
            'documentation',
            'repository',
            'playgroundUrls',
            'connectorFunctions',
            'deploymentModel',
            'openSource',
            'license',
            'licenseOther',
            'status',
            'vcFormat',
            'issuanceProtocols',
            'presentationProtocols',
            'interoperabilityProfiles',
            'credentialStatusMethods',
            'walletCompatibility',
            'backendIntegrations',
            'frontendIntegrations',
            'serviceModels',
            'eidasRoles',
            'certificateManagement',
        );

        /**
         * @return array<string, int>
         */
        public static function limits_for_form(): array {
            return array(
                'name'           => self::LIMIT_NAME,
                'description'    => self::LIMIT_DESCRIPTION,
                'licenseOther'   => self::LIMIT_LICENSE_OTHER,
                'playgroundUrls' => self::LIMIT_PLAYGROUND_URLS,
                'mediaVideos'    => self::LIMIT_MEDIA_VIDEOS,
                'mediaImages'    => self::LIMIT_MEDIA_IMAGES,
            );
        }

        /**
         * Readable labels for enum values (match the modal / SSR labels).
         *
         * @return array<string, array<string, string>>
         */
        public static function enum_labels(): array {
            return array(
                'connectorFunctions' => array('issuer' => 'Issuer', 'verifier' => 'Verifier'),
                'deploymentModel'    => array('saas' => 'SaaS', 'on_premises' => 'On-premises', 'hybrid' => 'Hybrid'),
                'status'             => array(
                    'development' => 'In Development',
                    'beta'        => 'Beta',
                    'production'  => 'Production',
                    'deprecated'  => 'Deprecated',
                ),
                'license'            => array(
                    'MIT'               => 'MIT',
                    'Apache-2.0'        => 'Apache-2.0',
                    'GPL-3.0-or-later'  => 'GPL-3.0 or later',
                    'AGPL-3.0-or-later' => 'AGPL-3.0 or later',
                    'LGPL-3.0-or-later' => 'LGPL-3.0 or later',
                    'EUPL-1.2'          => 'EUPL-1.2',
                    'MPL-2.0'           => 'MPL-2.0',
                    'BSD-3-Clause'      => 'BSD-3-Clause',
                    'ISC'               => 'ISC',
                    'proprietary'       => 'Proprietary (closed source)',
                    'other'             => 'Other',
                ),
                'vcFormat'           => array(
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
                ),
                'credentialStatusMethods' => array(
                    'StatusList2021'         => 'W3C Status List 2021',
                    'RevocationList2020'     => 'W3C Revocation List 2020',
                    'OCSP'                   => 'OCSP (Online Certificate Status Protocol)',
                    'CRL'                    => 'Certificate Revocation List',
                    'IETF Token Status List' => 'IETF Token Status List',
                    'Bitstring Status List'  => 'W3C Bitstring Status List',
                ),
                'backendIntegrations' => array(
                    'oidc_oauth2' => 'OIDC / OAuth 2.0',
                    'saml2'       => 'SAML 2.0',
                    'rest_api'    => 'REST API',
                    'webhooks'    => 'Webhooks',
                    'server_sdk'  => 'Server SDK',
                    'other'       => 'Other',
                ),
                'frontendIntegrations' => array(
                    'hosted_ui_redirect' => 'Hosted UI (redirect)',
                    'headless_api'       => 'Headless API',
                    'frontend_sdk'       => 'Frontend SDK',
                    'web_component'      => 'Web component',
                    'other'              => 'Other',
                ),
                'serviceModels'      => array(
                    'software_only'        => 'Software only',
                    'managed_verification' => 'Managed verification',
                    'managed_issuance'     => 'Managed issuance',
                ),
                'eidasRoles'         => array(
                    'rp_intermediary' => 'RP intermediary',
                    'eaa_provider'    => 'EAA provider',
                    'qeaa_provider'   => 'QEAA provider',
                ),
                'certificateManagement' => array(
                    'provider_managed' => 'Provider-managed',
                    'customer_managed' => 'Customer-managed',
                    'both'             => 'Provider- or customer-managed',
                ),
            );
        }

        /**
         * Enum value lists keyed by form field.
         *
         * @return array<string, string[]>
         */
        public static function form_enums(): array {
            return array(
                'connectorFunctions'       => self::FUNCTIONS,
                'deploymentModel'          => self::DEPLOYMENT_MODELS,
                'status'                   => self::STATUSES,
                'license'                  => self::LICENSES,
                'vcFormat'                 => self::VC_FORMATS,
                'issuanceProtocols'        => self::ISSUANCE_PROTOCOLS,
                'presentationProtocols'    => self::PRESENTATION_PROTOCOLS,
                'interoperabilityProfiles' => self::INTEROP_PROFILES,
                'credentialStatusMethods'  => self::CREDENTIAL_STATUS_METHODS,
                'backendIntegrations'      => self::BACKEND_INTEGRATIONS,
                'frontendIntegrations'     => self::FRONTEND_INTEGRATIONS,
                'serviceModels'            => self::SERVICE_MODELS,
                'eidasRoles'               => self::EIDAS_ROLES,
                'certificateManagement'    => self::CERTIFICATE_MANAGEMENT,
            );
        }

        /**
         * Normalize and validate one connector.
         *
         * Context keys (all optional callables):
         *  - wallet_lookup: fn(string $id): ?array{type: string, orgId: string} (null = unknown wallet).
         *  - org_has_qeaa:  fn(string $org_id): ?bool (null = could not be determined).
         *
         * @param array<string, mixed> $input   Raw payload (id, name, … as sent by the form).
         * @param array<string, mixed> $context Cross-catalog lookups and the owning org id.
         * @return array{connector: array<string, mixed>, errors: string[]}
         */
        public static function validate(array $input, array $context = array()): array {
            $errors = array();
            $out    = array();

            $org_id = isset($context['org_id']) ? (string) $context['org_id'] : '';

            // id.
            $id = self::text($input['id'] ?? '');
            if ($id === '' || ! preg_match('/^[a-z0-9-]+$/', $id)) {
                $errors[] = 'Connector id is required (lowercase letters, numbers, hyphens).';
            } else {
                $out['id'] = $id;
            }

            // name.
            $name = self::text($input['name'] ?? '');
            if ($name === '') {
                $errors[] = 'Connector name is required.';
            } elseif (self::strlen($name) > self::LIMIT_NAME) {
                $errors[] = sprintf('Connector name must be at most %d characters.', self::LIMIT_NAME);
            } else {
                $out['name'] = $name;
            }

            // description.
            $description = self::plain_textarea($input['description'] ?? '');
            if ($description === '') {
                $errors[] = 'Description is required.';
            } elseif (self::strlen($description) > self::LIMIT_DESCRIPTION) {
                $errors[] = sprintf('Description must be at most %d characters.', self::LIMIT_DESCRIPTION);
            } else {
                $out['description'] = $description;
            }

            // Optional URLs.
            foreach (array(
                'logo'          => 'Logo URL',
                'website'       => 'Website',
                'documentation' => 'Documentation URL',
                'repository'    => 'Repository URL',
            ) as $key => $label) {
                $raw = trim((string) ($input[ $key ] ?? ''));
                if ($raw === '') {
                    continue;
                }
                $url = self::url($raw);
                if ($url === '') {
                    $errors[] = sprintf('%s must be a valid http(s) URL.', $label);
                    continue;
                }
                $out[ $key ] = $url;
            }

            // Playground URLs.
            $playground = array();
            foreach (self::as_list($input['playgroundUrls'] ?? array()) as $raw) {
                $raw = trim((string) $raw);
                if ($raw === '') {
                    continue;
                }
                $url = self::url($raw);
                if ($url === '') {
                    $errors[] = 'Playground URLs must be valid http(s) URLs.';
                    $playground = array();
                    break;
                }
                if (! in_array($url, $playground, true)) {
                    $playground[] = $url;
                }
            }
            if (count($playground) > self::LIMIT_PLAYGROUND_URLS) {
                $errors[] = sprintf('At most %d playground URLs are allowed.', self::LIMIT_PLAYGROUND_URLS);
            } elseif ($playground) {
                $out['playgroundUrls'] = $playground;
            }

            // Media (same rules as the Wallet Catalog: deduplicated http(s) URLs, max 3 videos / 10 images).
            $media_input = isset($input['media']) && is_array($input['media']) ? $input['media'] : array();
            $media       = array();
            foreach (array('videos' => self::LIMIT_MEDIA_VIDEOS, 'images' => self::LIMIT_MEDIA_IMAGES) as $media_key => $media_max) {
                $urls = array();
                foreach (self::as_list($media_input[ $media_key ] ?? array()) as $raw) {
                    $raw = trim((string) $raw);
                    if ($raw === '') {
                        continue;
                    }
                    $url = self::url($raw);
                    if ($url === '') {
                        $errors[] = sprintf('Media %s must be valid http(s) URLs.', $media_key);
                        $urls = array();
                        break;
                    }
                    if (! in_array($url, $urls, true)) {
                        $urls[] = $url;
                    }
                }
                if (count($urls) > $media_max) {
                    $errors[] = sprintf('At most %d media %s are allowed.', $media_max, $media_key);
                } elseif ($urls) {
                    $media[ $media_key ] = $urls;
                }
            }
            if ($media) {
                $out['media'] = $media;
            }

            // Functions.
            $functions = self::enum_list($input['connectorFunctions'] ?? array(), self::FUNCTIONS, $errors, 'Connector functions');
            if (! $functions) {
                $errors[] = 'Select at least one connector function (issuer and/or verifier).';
            } else {
                $out['connectorFunctions'] = $functions;
            }
            $is_issuer   = in_array('issuer', $functions, true);
            $is_verifier = in_array('verifier', $functions, true);

            // Single-value enums.
            $deployment = self::text($input['deploymentModel'] ?? '');
            if (! in_array($deployment, self::DEPLOYMENT_MODELS, true)) {
                $errors[] = 'Select a deployment model.';
            } else {
                $out['deploymentModel'] = $deployment;
            }
            $status = self::text($input['status'] ?? '');
            if (! in_array($status, self::STATUSES, true)) {
                $errors[] = 'Select a connector status.';
            } else {
                $out['status'] = $status;
            }

            // License and openSource.
            $license       = self::text($input['license'] ?? '');
            $license_other = self::text($input['licenseOther'] ?? '');
            if (! in_array($license, self::LICENSES, true)) {
                $errors[] = 'Select a license.';
            } else {
                $out['license'] = $license;
                if ($license === 'other') {
                    if ($license_other === '') {
                        $errors[] = 'Specify the license when "Other" is selected.';
                    } elseif (self::strlen($license_other) > self::LIMIT_LICENSE_OTHER) {
                        $errors[] = sprintf('License (other) must be at most %d characters.', self::LIMIT_LICENSE_OTHER);
                    } else {
                        $out['licenseOther'] = $license_other;
                    }
                } elseif ($license_other !== '') {
                    $errors[] = 'License (other) can only be used when the license is "Other".';
                }
                $out['openSource'] = self::derive_open_source($license, $license_other, $input['openSource'] ?? null);
            }

            // Formats, protocols, profiles, status methods.
            $vc_formats = self::enum_list($input['vcFormat'] ?? array(), self::VC_FORMATS, $errors, 'VC formats');
            if (! $vc_formats) {
                $errors[] = 'Select at least one VC format.';
            } else {
                $out['vcFormat'] = $vc_formats;
            }

            $issuance = self::enum_list($input['issuanceProtocols'] ?? array(), self::ISSUANCE_PROTOCOLS, $errors, 'Issuance protocols');
            if ($is_issuer) {
                if (! $issuance) {
                    $errors[] = 'Select at least one issuance protocol for an issuer connector.';
                } else {
                    $out['issuanceProtocols'] = $issuance;
                }
            }
            $presentation = self::enum_list($input['presentationProtocols'] ?? array(), self::PRESENTATION_PROTOCOLS, $errors, 'Presentation protocols');
            if ($is_verifier) {
                if (! $presentation) {
                    $errors[] = 'Select at least one presentation protocol for a verifier connector.';
                } else {
                    $out['presentationProtocols'] = $presentation;
                }
            }

            $profiles = self::enum_list($input['interoperabilityProfiles'] ?? array(), self::INTEROP_PROFILES, $errors, 'Interop profiles');
            if ($profiles) {
                $out['interoperabilityProfiles'] = $profiles;
            }

            $status_methods = self::canonical_status_methods($input['credentialStatusMethods'] ?? array(), $errors);
            if ($status_methods) {
                $out['credentialStatusMethods'] = $status_methods;
            }

            // Integrations and service models.
            $backend = self::enum_list($input['backendIntegrations'] ?? array(), self::BACKEND_INTEGRATIONS, $errors, 'Backend integrations');
            if (! $backend) {
                $errors[] = 'Select at least one backend integration.';
            } else {
                $out['backendIntegrations'] = $backend;
            }
            $frontend = self::enum_list($input['frontendIntegrations'] ?? array(), self::FRONTEND_INTEGRATIONS, $errors, 'Frontend integrations');
            if ($frontend) {
                $out['frontendIntegrations'] = $frontend;
            }
            $service_models = self::enum_list($input['serviceModels'] ?? array(), self::SERVICE_MODELS, $errors, 'Service models');
            if (! $service_models) {
                $errors[] = 'Select at least one service model.';
            } else {
                $out['serviceModels'] = $service_models;
            }

            // eIDAS roles.
            $roles = self::enum_list($input['eidasRoles'] ?? array(), self::EIDAS_ROLES, $errors, 'eIDAS roles');
            if ($roles) {
                $out['eidasRoles'] = $roles;
                array_push($errors, ...self::eidas_role_errors($roles, $functions, $service_models, $profiles, $org_id, $context));
            }

            $cert = self::text($input['certificateManagement'] ?? '');
            if ($cert !== '') {
                if (! in_array($cert, self::CERTIFICATE_MANAGEMENT, true)) {
                    $errors[] = 'Certificate management has an invalid value.';
                } else {
                    $out['certificateManagement'] = $cert;
                }
            }

            // Wallet references.
            $wallet_lookup = isset($context['wallet_lookup']) && is_callable($context['wallet_lookup'])
                ? $context['wallet_lookup']
                : null;

            $wallet_ref = self::wallet_ref_id($input['walletRef'] ?? null);
            if ($wallet_ref === false) {
                $errors[] = 'Wallet reference must be a valid wallet id.';
            } elseif ($wallet_ref !== '') {
                $wallet = $wallet_lookup ? call_user_func($wallet_lookup, $wallet_ref) : null;
                if (! is_array($wallet)) {
                    $errors[] = sprintf('Referenced wallet "%s" was not found in the Wallet Catalog.', $wallet_ref);
                } else {
                    if (($wallet['type'] ?? '') !== 'organizational') {
                        $errors[] = sprintf('Referenced wallet "%s" must be a business (organizational) wallet.', $wallet_ref);
                    } elseif ($org_id !== '' && (string) ($wallet['orgId'] ?? '') !== $org_id) {
                        $errors[] = sprintf('Referenced wallet "%s" must belong to the same organization as the connector.', $wallet_ref);
                    } else {
                        $out['walletRef'] = array('walletCatalogId' => $wallet_ref);
                    }
                }
            }

            $compat = array();
            foreach (self::as_list($input['walletCompatibility'] ?? array()) as $raw) {
                $wallet_id = self::text($raw);
                if ($wallet_id === '') {
                    continue;
                }
                if (! preg_match('/^[a-z0-9-]+$/', $wallet_id)) {
                    $errors[] = sprintf('Compatible wallet id "%s" is not valid.', $wallet_id);
                    continue;
                }
                if (in_array($wallet_id, $compat, true)) {
                    continue;
                }
                $wallet = $wallet_lookup ? call_user_func($wallet_lookup, $wallet_id) : null;
                if (! is_array($wallet)) {
                    $errors[] = sprintf('Compatible wallet "%s" was not found in the Wallet Catalog.', $wallet_id);
                } elseif (($wallet['type'] ?? '') !== 'personal') {
                    $errors[] = sprintf('Compatible wallet "%s" must be a personal wallet.', $wallet_id);
                } else {
                    $compat[] = $wallet_id;
                }
            }
            if ($compat) {
                $out['walletCompatibility'] = $compat;
            }

            return array(
                'connector' => self::order_keys($out),
                'errors'    => array_values(array_unique($errors)),
            );
        }

        /**
         * Conditional eIDAS role rules from the schema and the crawler.
         *
         * @param string[]             $roles          Selected roles.
         * @param string[]             $functions      Selected functions.
         * @param string[]             $service_models Selected service models.
         * @param string[]             $profiles       Selected interop profiles.
         * @param string               $org_id         Owning organization id.
         * @param array<string, mixed> $context        Lookups.
         * @return string[]
         */
        public static function eidas_role_errors(array $roles, array $functions, array $service_models, array $profiles, string $org_id, array $context = array()): array {
            $errors = array();
            if (in_array('rp_intermediary', $roles, true)) {
                if (! in_array('verifier', $functions, true)) {
                    $errors[] = 'The RP intermediary role requires the verifier function.';
                }
                if (! in_array('managed_verification', $service_models, true)) {
                    $errors[] = 'The RP intermediary role requires the "Managed verification" service model.';
                }
                if (! in_array('EUDI Wallet ARF', $profiles, true)) {
                    $errors[] = 'The RP intermediary role requires the "EUDI Wallet ARF" interop profile.';
                }
            }
            $issuing_roles = array_intersect($roles, array('eaa_provider', 'qeaa_provider'));
            if ($issuing_roles) {
                if (! in_array('issuer', $functions, true)) {
                    $errors[] = 'The EAA and QEAA provider roles require the issuer function.';
                }
                if (! in_array('managed_issuance', $service_models, true)) {
                    $errors[] = 'The EAA and QEAA provider roles require the "Managed issuance" service model.';
                }
            }
            if (in_array('qeaa_provider', $roles, true)) {
                $lookup = isset($context['org_has_qeaa']) && is_callable($context['org_has_qeaa']) ? $context['org_has_qeaa'] : null;
                $has    = $lookup && $org_id !== '' ? call_user_func($lookup, $org_id) : null;
                if ($has === null) {
                    $errors[] = 'The QEAA provider role could not be verified against the Organization Catalog.';
                } elseif (! $has) {
                    $errors[] = 'The QEAA provider role requires the organization to be a QTSP with the QEAA trust service in the Organization Catalog.';
                }
            }
            return $errors;
        }

        /**
         * Whether an organization catalog entry has a QTSP certification with the QEAA trust service.
         *
         * @param array<string, mixed> $organization Aggregated organization item.
         */
        public static function organization_has_qeaa(array $organization): bool {
            $certifications = isset($organization['certifications']) && is_array($organization['certifications'])
                ? $organization['certifications']
                : array();
            foreach ($certifications as $certification) {
                if (! is_array($certification) || ($certification['code'] ?? '') !== 'qtsp') {
                    continue;
                }
                $services = $certification['details']['trustServices'] ?? array();
                if (! is_array($services)) {
                    continue;
                }
                foreach ($services as $service) {
                    if (is_array($service) && ($service['code'] ?? '') === 'QEAA') {
                        return true;
                    }
                }
            }
            return false;
        }

        /**
         * openSource is derived from the license; only "other" accepts an explicit client value.
         *
         * @param mixed $client_value Client supplied boolean (only used for license "other").
         */
        public static function derive_open_source(string $license, string $license_other, $client_value = null): bool {
            if ($license === 'proprietary') {
                return false;
            }
            if ($license !== 'other') {
                return true;
            }
            if (is_bool($client_value)) {
                return $client_value;
            }
            return ! (bool) preg_match('/proprietary/i', $license_other);
        }

        /**
         * Remove logo/website values that only exist because the crawler fell back to the
         * organization record (item.logo === organization.logoUri, item.website === organization.website).
         * Those fallbacks must never be copied into the connector's own source JSON.
         *
         * @param array<string, mixed> $item Aggregated connector item (may carry an `organization` projection).
         * @return array<string, mixed>
         */
        public static function strip_organization_fallbacks(array $item): array {
            $organization = isset($item['organization']) && is_array($item['organization']) ? $item['organization'] : array();
            foreach (array('logo' => 'logoUri', 'website' => 'website') as $key => $org_key) {
                if (isset($item[ $key ], $organization[ $org_key ]) && (string) $item[ $key ] === (string) $organization[ $org_key ]) {
                    unset($item[ $key ]);
                }
            }
            return $item;
        }

        /**
         * Canonical (schema-ordered) connector from a stored payload / catalog item.
         *
         * @param array<string, mixed> $item Item with arbitrary extra keys.
         * @return array<string, mixed>
         */
        public static function pick_connector_keys(array $item): array {
            $out = array();
            foreach (self::CONNECTOR_KEYS as $key) {
                if (! array_key_exists($key, $item)) {
                    continue;
                }
                $value = $item[ $key ];
                if ($value === '' || $value === null || $value === array()) {
                    continue;
                }
                $out[ $key ] = $value;
            }
            return $out;
        }

        /**
         * @param array<string, mixed> $values
         * @return array<string, mixed>
         */
        private static function order_keys(array $values): array {
            $ordered = array();
            foreach (self::CONNECTOR_KEYS as $key) {
                if (array_key_exists($key, $values)) {
                    $ordered[ $key ] = $values[ $key ];
                }
            }
            return $ordered;
        }

        /**
         * @param mixed $raw
         * @return string|false '' when absent, false when invalid.
         */
        private static function wallet_ref_id($raw) {
            if ($raw === null || $raw === '' || $raw === array()) {
                return '';
            }
            if (is_array($raw)) {
                $raw = $raw['walletCatalogId'] ?? '';
            }
            $id = self::text($raw);
            if ($id === '') {
                return '';
            }
            return preg_match('/^[a-z0-9-]+$/', $id) ? $id : false;
        }

        /**
         * @param mixed    $raw
         * @param string[] $errors
         * @return string[]
         */
        private static function canonical_status_methods($raw, array &$errors): array {
            $out = array();
            foreach (self::as_list($raw) as $value) {
                $value = trim((string) $value);
                if ($value === '') {
                    continue;
                }
                if (isset(self::CREDENTIAL_STATUS_ALIASES[ $value ])) {
                    $value = self::CREDENTIAL_STATUS_ALIASES[ $value ];
                }
                if (! in_array($value, self::CREDENTIAL_STATUS_METHODS, true)) {
                    $errors[] = 'Credential status methods contains an unsupported value.';
                    continue;
                }
                if (! in_array($value, $out, true)) {
                    $out[] = $value;
                }
            }
            return $out;
        }

        /**
         * @param mixed    $raw
         * @param string[] $allowed
         * @param string[] $errors
         * @return string[]
         */
        private static function enum_list($raw, array $allowed, array &$errors, string $label): array {
            $out = array();
            foreach (self::as_list($raw) as $value) {
                $value = trim((string) $value);
                if ($value === '') {
                    continue;
                }
                if (! in_array($value, $allowed, true)) {
                    $errors[] = sprintf('%s contains an unsupported value.', $label);
                    continue;
                }
                if (! in_array($value, $out, true)) {
                    $out[] = $value;
                }
            }
            return $out;
        }

        /**
         * @param mixed $raw
         * @return array<int, mixed>
         */
        private static function as_list($raw): array {
            if (is_array($raw)) {
                return array_values($raw);
            }
            if (is_string($raw) && trim($raw) !== '') {
                return explode(',', $raw);
            }
            return array();
        }

        /**
         * @param mixed $value
         */
        private static function text($value): string {
            if (is_array($value) || is_object($value)) {
                return '';
            }
            return trim(sanitize_text_field((string) $value));
        }

        /**
         * Plain-text description (the UI escapes on render, so no HTML entities are stored).
         *
         * @param mixed $value
         */
        private static function plain_textarea($value): string {
            if (is_array($value) || is_object($value)) {
                return '';
            }
            $text = str_replace(array("\r\n", "\r"), "\n", (string) $value);
            $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            return trim(sanitize_textarea_field($text));
        }

        private static function url(string $raw): string {
            if (! preg_match('#^https?://#i', $raw)) {
                return '';
            }
            if (filter_var($raw, FILTER_VALIDATE_URL) === false) {
                return '';
            }
            return esc_url_raw($raw, array('http', 'https'));
        }

        private static function strlen(string $value): int {
            return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
        }
    }
}
