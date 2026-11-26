<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

/**
 * Minimal stand-in for the shared tiles core (Fides_Catalog_Org_Tier); only the methods the
 * connector tier helper delegates to. Behaviour is configured per test.
 */
if (! class_exists('Fides_Catalog_Org_Tier')) {
    class Fides_Catalog_Org_Tier {
        public static bool $ui = true;
        public static bool $official = false;
        public static bool $full = false;
        public static bool $curated = false;

        public static function tier_ui_enabled() {
            return self::$ui;
        }

        public static function has_full_listing($org_id) {
            return self::$full || self::$official;
        }

        public static function has_curated_community_full_listing($org_id) {
            return self::$curated;
        }

        public static function export_catalog_tier_label($org_id) {
            return self::$official ? 'Pro' : 'Community';
        }

        public static function truncate_description($text) {
            return rtrim(mb_substr(trim((string) $text), 0, 200));
        }
    }
}

final class TierTest extends TestCase {

    protected function setUp(): void {
        Fides_Catalog_Org_Tier::$ui       = true;
        Fides_Catalog_Org_Tier::$official = false;
        Fides_Catalog_Org_Tier::$full     = false;
        Fides_Catalog_Org_Tier::$curated  = false;
    }

    private function submission(): array {
        return array(
            'id'            => 'acme-connect',
            'name'          => 'Acme Connect',
            'description'   => str_repeat('a', 300),
            'logo'          => 'https://acme.example/logo.png',
            'website'       => 'https://acme.example/connect',
            'documentation' => 'https://acme.example/docs',
            'repository'    => 'https://github.com/acme/connect',
            'media'         => array('videos' => array('https://www.youtube.com/watch?v=abc'), 'images' => array('https://acme.example/shot.png')),
        );
    }

    public function test_community_create_strips_pro_fields_and_truncates_description(): void {
        $out = Fides_Wallet_Connector_Catalog_Tier::constrain_submission($this->submission(), 'org:acme', null);
        $this->assertSame(200, strlen($out['description']));
        foreach (array('website', 'documentation', 'repository', 'media') as $key) {
            $this->assertArrayNotHasKey($key, $out);
        }
        // Logo is not a Pro field (same as the wallet catalog).
        $this->assertSame('https://acme.example/logo.png', $out['logo']);
    }

    public function test_community_update_keeps_published_pro_values_and_drops_missing_ones(): void {
        $existing = array(
            'website'       => 'https://published.example',
            'documentation' => '',
            'organization'  => array('website' => 'https://org.example', 'logoUri' => 'https://org.example/logo.png'),
        );
        $out = Fides_Wallet_Connector_Catalog_Tier::constrain_submission($this->submission(), 'org:acme', $existing);
        $this->assertSame('https://published.example', $out['website']);
        $this->assertArrayNotHasKey('documentation', $out);
        $this->assertArrayNotHasKey('repository', $out);
    }

    public function test_community_update_does_not_copy_organization_website_fallback_into_the_connector(): void {
        // The aggregated item carries the crawler fallback (website === organization.website).
        $existing = array(
            'website'      => 'https://org.example',
            'organization' => array('website' => 'https://org.example'),
        );
        $out = Fides_Wallet_Connector_Catalog_Tier::constrain_submission($this->submission(), 'org:acme', $existing);
        $this->assertArrayNotHasKey('website', $out);
    }

    public function test_full_listing_and_official_are_not_constrained(): void {
        Fides_Catalog_Org_Tier::$full = true;
        $out = Fides_Wallet_Connector_Catalog_Tier::constrain_submission($this->submission(), 'org:acme', null);
        $this->assertSame($this->submission(), $out);

        Fides_Catalog_Org_Tier::$full     = false;
        Fides_Catalog_Org_Tier::$official = true;
        $out = Fides_Wallet_Connector_Catalog_Tier::constrain_submission($this->submission(), 'org:acme', null);
        $this->assertSame($this->submission(), $out);
    }

    public function test_tier_ui_disabled_leaves_everything_untouched(): void {
        Fides_Catalog_Org_Tier::$ui = false;
        $this->assertSame($this->submission(), Fides_Wallet_Connector_Catalog_Tier::constrain_submission($this->submission(), 'org:acme', null));
        $this->assertSame($this->submission(), Fides_Wallet_Connector_Catalog_Tier::filter_export($this->submission(), 'org:acme'));
    }

    public function test_community_export_stamps_tier_and_strips_pro_fields(): void {
        $out = Fides_Wallet_Connector_Catalog_Tier::filter_export($this->submission(), 'org:acme');
        $this->assertSame('Community', $out['catalogTier']);
        $this->assertArrayNotHasKey('catalogListingDepth', $out);
        $this->assertArrayNotHasKey('website', $out);
        $this->assertArrayNotHasKey('documentation', $out);
        $this->assertArrayNotHasKey('repository', $out);
        $this->assertArrayNotHasKey('media', $out);
        $this->assertSame(200, strlen($out['description']));
    }

    public function test_curated_community_export_is_full_depth_and_keeps_fields(): void {
        Fides_Catalog_Org_Tier::$full    = true;
        Fides_Catalog_Org_Tier::$curated = true;
        $out = Fides_Wallet_Connector_Catalog_Tier::filter_export($this->submission(), 'org:acme');
        $this->assertSame('Community', $out['catalogTier']);
        $this->assertSame('full', $out['catalogListingDepth']);
        $this->assertSame('https://acme.example/connect', $out['website']);
        $this->assertSame(300, strlen($out['description']));
    }

    public function test_official_export_is_pro_with_all_fields(): void {
        Fides_Catalog_Org_Tier::$official = true;
        $out = Fides_Wallet_Connector_Catalog_Tier::filter_export($this->submission(), 'org:acme');
        $this->assertSame('Pro', $out['catalogTier']);
        $this->assertArrayNotHasKey('catalogListingDepth', $out);
        $this->assertSame('https://acme.example/docs', $out['documentation']);
    }

    public function test_strip_organization_fallbacks_only_removes_matching_values(): void {
        $item = array(
            'logo'         => 'https://org.example/logo.png',
            'website'      => 'https://own.example',
            'organization' => array('logoUri' => 'https://org.example/logo.png', 'website' => 'https://org.example'),
        );
        $out = Fides_Wallet_Connector_Catalog_V1_Normalizer::strip_organization_fallbacks($item);
        $this->assertArrayNotHasKey('logo', $out);
        $this->assertSame('https://own.example', $out['website']);
    }
}
