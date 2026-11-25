<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class V1NormalizerTest extends TestCase {

    private function context(array $override = array()): array {
        $wallets = array(
            'acme-business' => array('type' => 'organizational', 'orgId' => 'acme'),
            'other-business' => array('type' => 'organizational', 'orgId' => 'other'),
            'alice-wallet'  => array('type' => 'personal', 'orgId' => 'alice'),
        );
        return array_merge(array(
            'org_id'        => 'acme',
            'wallet_lookup' => static fn(string $id) => $wallets[ $id ] ?? null,
            'org_has_qeaa'  => static fn(string $org) => $org === 'qtsp-org',
        ), $override);
    }

    private function issuer(array $override = array()): array {
        return array_merge(array(
            'id'                  => 'acme-connect',
            'name'                => 'Acme Connect',
            'description'         => 'Connector for issuing credentials.',
            'status'              => 'production',
            'deploymentModel'     => 'saas',
            'connectorFunctions'  => array('issuer'),
            'serviceModels'       => array('software_only'),
            'license'             => 'MIT',
            'vcFormat'            => array('sd_jwt_vc'),
            'issuanceProtocols'   => array('OpenID4VCI'),
            'backendIntegrations' => array('rest_api'),
        ), $override);
    }

    public function test_valid_issuer_passes_and_derives_open_source(): void {
        $result = Fides_Wallet_Connector_Catalog_V1_Normalizer::validate($this->issuer(), $this->context());
        $this->assertSame(array(), $result['errors']);
        $this->assertTrue($result['connector']['openSource']);
        $this->assertSame('acme-connect', $result['connector']['id']);
    }

    public function test_proprietary_license_is_not_open_source(): void {
        $result = Fides_Wallet_Connector_Catalog_V1_Normalizer::validate($this->issuer(array('license' => 'proprietary')), $this->context());
        $this->assertSame(array(), $result['errors']);
        $this->assertFalse($result['connector']['openSource']);
    }

    public function test_required_fields_are_enforced(): void {
        $result = Fides_Wallet_Connector_Catalog_V1_Normalizer::validate(array(), $this->context());
        $joined = implode(' | ', $result['errors']);
        foreach (array('id is required', 'name is required', 'Description is required', 'connector function', 'deployment model', 'status', 'license', 'VC format', 'backend integration', 'service model') as $needle) {
            $this->assertStringContainsStringIgnoringCase($needle, $joined);
        }
    }

    public function test_issuer_requires_issuance_protocols(): void {
        $result = Fides_Wallet_Connector_Catalog_V1_Normalizer::validate($this->issuer(array('issuanceProtocols' => array())), $this->context());
        $this->assertStringContainsString('issuance protocol', implode(' ', $result['errors']));
    }

    public function test_verifier_requires_presentation_protocols_and_drops_issuance(): void {
        $input  = $this->issuer(array('connectorFunctions' => array('verifier'), 'serviceModels' => array('software_only')));
        $result = Fides_Wallet_Connector_Catalog_V1_Normalizer::validate($input, $this->context());
        $this->assertStringContainsString('presentation protocol', implode(' ', $result['errors']));

        $input['presentationProtocols'] = array('OpenID4VP');
        $result = Fides_Wallet_Connector_Catalog_V1_Normalizer::validate($input, $this->context());
        $this->assertSame(array(), $result['errors']);
        $this->assertArrayNotHasKey('issuanceProtocols', $result['connector']);
    }

    public function test_license_other_rules(): void {
        $result = Fides_Wallet_Connector_Catalog_V1_Normalizer::validate($this->issuer(array('license' => 'other')), $this->context());
        $this->assertNotEmpty($result['errors']);

        $result = Fides_Wallet_Connector_Catalog_V1_Normalizer::validate($this->issuer(array('license' => 'other', 'licenseOther' => 'Custom')), $this->context());
        $this->assertSame(array(), $result['errors']);
        $this->assertSame('Custom', $result['connector']['licenseOther']);

        $result = Fides_Wallet_Connector_Catalog_V1_Normalizer::validate($this->issuer(array('licenseOther' => 'Custom')), $this->context());
        $this->assertNotEmpty($result['errors']);
    }

    public function test_urls_must_be_http_and_playground_urls_are_limited(): void {
        $result = Fides_Wallet_Connector_Catalog_V1_Normalizer::validate($this->issuer(array('website' => 'javascript:alert(1)')), $this->context());
        $this->assertStringContainsString('Website must be a valid http(s) URL', implode(' ', $result['errors']));

        $urls   = array_map(static fn($i) => "https://p{$i}.example.com", range(1, 11));
        $result = Fides_Wallet_Connector_Catalog_V1_Normalizer::validate($this->issuer(array('playgroundUrls' => $urls)), $this->context());
        $this->assertStringContainsString('At most 10', implode(' ', $result['errors']));

        $result = Fides_Wallet_Connector_Catalog_V1_Normalizer::validate($this->issuer(array('playgroundUrls' => array('https://a.example.com', 'https://a.example.com'))), $this->context());
        $this->assertSame(array('https://a.example.com'), $result['connector']['playgroundUrls']);
    }

    public function test_wallet_ref_must_be_business_wallet_of_same_org(): void {
        $ok = Fides_Wallet_Connector_Catalog_V1_Normalizer::validate($this->issuer(array('walletRef' => 'acme-business')), $this->context());
        $this->assertSame(array(), $ok['errors']);
        $this->assertSame(array('walletCatalogId' => 'acme-business'), $ok['connector']['walletRef']);

        $object = Fides_Wallet_Connector_Catalog_V1_Normalizer::validate($this->issuer(array('walletRef' => array('walletCatalogId' => 'acme-business'))), $this->context());
        $this->assertSame(array(), $object['errors']);

        foreach (array('other-business', 'alice-wallet', 'missing-wallet') as $bad) {
            $result = Fides_Wallet_Connector_Catalog_V1_Normalizer::validate($this->issuer(array('walletRef' => $bad)), $this->context());
            $this->assertNotEmpty($result['errors'], $bad);
        }
    }

    public function test_wallet_compatibility_must_be_personal_wallets(): void {
        $ok = Fides_Wallet_Connector_Catalog_V1_Normalizer::validate($this->issuer(array('walletCompatibility' => array('alice-wallet', 'alice-wallet'))), $this->context());
        $this->assertSame(array(), $ok['errors']);
        $this->assertSame(array('alice-wallet'), $ok['connector']['walletCompatibility']);

        $bad = Fides_Wallet_Connector_Catalog_V1_Normalizer::validate($this->issuer(array('walletCompatibility' => array('acme-business'))), $this->context());
        $this->assertStringContainsString('must be a personal wallet', implode(' ', $bad['errors']));
    }

    public function test_rp_intermediary_requires_verifier_managed_verification_and_arf(): void {
        $base = $this->issuer(array('eidasRoles' => array('rp_intermediary')));
        $bad  = Fides_Wallet_Connector_Catalog_V1_Normalizer::validate($base, $this->context());
        $this->assertStringContainsString('requires the verifier function', implode(' ', $bad['errors']));

        $good = $this->issuer(array(
            'connectorFunctions'    => array('verifier'),
            'presentationProtocols' => array('OpenID4VP'),
            'serviceModels'         => array('managed_verification'),
            'interoperabilityProfiles' => array('EUDI Wallet ARF'),
            'eidasRoles'            => array('rp_intermediary'),
        ));
        $result = Fides_Wallet_Connector_Catalog_V1_Normalizer::validate($good, $this->context());
        $this->assertSame(array(), $result['errors']);

        unset($good['interoperabilityProfiles']);
        $result = Fides_Wallet_Connector_Catalog_V1_Normalizer::validate($good, $this->context());
        $this->assertStringContainsString('EUDI Wallet ARF', implode(' ', $result['errors']));
    }

    public function test_qeaa_provider_requires_issuer_managed_issuance_and_qtsp(): void {
        $input = $this->issuer(array('serviceModels' => array('managed_issuance'), 'eidasRoles' => array('qeaa_provider')));
        $bad   = Fides_Wallet_Connector_Catalog_V1_Normalizer::validate($input, $this->context());
        $this->assertStringContainsString('QTSP', implode(' ', $bad['errors']));

        $good = Fides_Wallet_Connector_Catalog_V1_Normalizer::validate($input, $this->context(array('org_id' => 'qtsp-org')));
        $this->assertSame(array(), $good['errors']);

        $eaa = $this->issuer(array('eidasRoles' => array('eaa_provider')));
        $result = Fides_Wallet_Connector_Catalog_V1_Normalizer::validate($eaa, $this->context());
        $this->assertStringContainsString('Managed issuance', implode(' ', $result['errors']));
    }

    public function test_qeaa_check_fails_closed_when_lookup_unknown(): void {
        $input = $this->issuer(array('serviceModels' => array('managed_issuance'), 'eidasRoles' => array('qeaa_provider')));
        $ctx   = $this->context(array('org_has_qeaa' => static fn(string $org) => null));
        $result = Fides_Wallet_Connector_Catalog_V1_Normalizer::validate($input, $ctx);
        $this->assertStringContainsString('could not be verified', implode(' ', $result['errors']));
    }

    public function test_credential_status_aliases_are_mapped_to_canonical_values(): void {
        $result = Fides_Wallet_Connector_Catalog_V1_Normalizer::validate(
            $this->issuer(array('credentialStatusMethods' => array('Token Status List', 'BitstringStatusList v1.0'))),
            $this->context()
        );
        $this->assertSame(array(), $result['errors']);
        foreach ($result['connector']['credentialStatusMethods'] as $method) {
            $this->assertContains($method, Fides_Wallet_Connector_Catalog_V1_Normalizer::CREDENTIAL_STATUS_METHODS);
        }
    }

    public function test_organization_has_qeaa(): void {
        $org = array('certifications' => array(array('code' => 'qtsp', 'details' => array('trustServices' => array(array('code' => 'QEAA'))))));
        $this->assertTrue(Fides_Wallet_Connector_Catalog_V1_Normalizer::organization_has_qeaa($org));
        $this->assertFalse(Fides_Wallet_Connector_Catalog_V1_Normalizer::organization_has_qeaa(array()));
    }

    /** Enum lists in PHP must stay identical to the JSON schema. */
    public function test_enums_match_schema(): void {
        $schema = json_decode((string) file_get_contents(dirname(__DIR__, 2) . '/schemas/wallet-connector-catalog.schema.json'), true);
        $props  = $schema['$defs']['Connector']['properties'];
        $map = array(
            'connectorFunctions'       => array('items', 'FUNCTIONS'),
            'deploymentModel'          => array(null, 'DEPLOYMENT_MODELS'),
            'status'                   => array(null, 'STATUSES'),
            'license'                  => array(null, 'LICENSES'),
            'vcFormat'                 => array('items', 'VC_FORMATS'),
            'issuanceProtocols'        => array('items', 'ISSUANCE_PROTOCOLS'),
            'presentationProtocols'    => array('items', 'PRESENTATION_PROTOCOLS'),
            'interoperabilityProfiles' => array('items', 'INTEROP_PROFILES'),
            'backendIntegrations'      => array('items', 'BACKEND_INTEGRATIONS'),
            'frontendIntegrations'     => array('items', 'FRONTEND_INTEGRATIONS'),
            'serviceModels'            => array('items', 'SERVICE_MODELS'),
            'eidasRoles'               => array('items', 'EIDAS_ROLES'),
            'certificateManagement'    => array(null, 'CERTIFICATE_MANAGEMENT'),
        );
        foreach ($map as $key => $info) {
            $schema_enum = $info[0] ? $props[ $key ]['items']['enum'] : $props[ $key ]['enum'];
            $php_enum    = constant('Fides_Wallet_Connector_Catalog_V1_Normalizer::' . $info[1]);
            $this->assertSame($schema_enum, $php_enum, $key);
        }
        // Every schema status method is either canonical or a known alias.
        $known = array_merge(
            Fides_Wallet_Connector_Catalog_V1_Normalizer::CREDENTIAL_STATUS_METHODS,
            array_keys(Fides_Wallet_Connector_Catalog_V1_Normalizer::CREDENTIAL_STATUS_ALIASES)
        );
        foreach ($props['credentialStatusMethods']['items']['enum'] as $method) {
            $this->assertContains($method, $known, $method);
        }
    }

    public function test_labelled_form_enums_have_labels_for_every_value(): void {
        $labels = Fides_Wallet_Connector_Catalog_V1_Normalizer::enum_labels();
        foreach (Fides_Wallet_Connector_Catalog_V1_Normalizer::form_enums() as $field => $values) {
            if (! isset($labels[ $field ])) {
                continue; // Self-describing values (protocols, interop profiles) have no label map.
            }
            foreach ($values as $value) {
                $this->assertArrayHasKey($value, $labels[ $field ] ?? array(), "$field:$value");
            }
        }
    }
}
