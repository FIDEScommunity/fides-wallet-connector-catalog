<?php
/**
 * Community vs Pro listing rules for connectors.
 *
 * Mirrors Fides_Catalog_Org_Tier::constrain_wallet_submission() and ::filter_wallet_export() of the
 * shared tiles core one-to-one, applied to the connector fields that correspond to the wallet
 * "Pro payload keys". The shared core only knows organizations and wallets, so the connector
 * variant lives here and delegates every tier decision (tier UI switch, full listing, tier label,
 * description truncation) to Fides_Catalog_Org_Tier.
 *
 * @package fides-wallet-connector-catalog
 */

if (! defined('ABSPATH')) {
    exit;
}

if (! class_exists('Fides_Wallet_Connector_Catalog_Tier')) {

    class Fides_Wallet_Connector_Catalog_Tier {

        /**
         * Connector payload keys that only full listings (Official / Pro or full Community) may edit.
         * Wallet equivalents: website, documentation, repository plus media (the other wallet Pro keys have no connector field).
         *
         * @var string[]
         */
        const PRO_PAYLOAD_KEYS = array(
            'website',
            'documentation',
            'repository',
            'media',
        );

        /**
         * Apply Standard Community submission rules (tier from orgId).
         *
         * @param array<string, mixed>      $normalized    Normalized submission payload.
         * @param string                    $org_id        org:…
         * @param array<string, mixed>|null $existing_item Published aggregated connector item (update only).
         * @return array<string, mixed>
         */
        public static function constrain_submission(array $normalized, $org_id, $existing_item = null): array {
            if (! class_exists('Fides_Catalog_Org_Tier') || ! Fides_Catalog_Org_Tier::tier_ui_enabled()) {
                return $normalized;
            }

            if ($org_id === '' || Fides_Catalog_Org_Tier::has_full_listing($org_id)) {
                return $normalized;
            }

            if (! empty($normalized['description'])) {
                $normalized['description'] = Fides_Catalog_Org_Tier::truncate_description((string) $normalized['description']);
            }

            if (is_array($existing_item)) {
                // The aggregated item carries crawler fallbacks (organization logo/website); keep only own values.
                $existing_item = Fides_Wallet_Connector_Catalog_V1_Normalizer::strip_organization_fallbacks($existing_item);
                foreach (self::PRO_PAYLOAD_KEYS as $key) {
                    if (array_key_exists($key, $existing_item) && $existing_item[ $key ] !== '' && $existing_item[ $key ] !== array()) {
                        $normalized[ $key ] = $existing_item[ $key ];
                    } else {
                        unset($normalized[ $key ]);
                    }
                }
            } else {
                foreach (self::PRO_PAYLOAD_KEYS as $key) {
                    unset($normalized[ $key ]);
                }
            }

            return $normalized;
        }

        /**
         * Strip Pro-only fields from a connector export object for Community listings and stamp the tier.
         *
         * @param array<string, mixed> $connector Export connector object.
         * @param string               $org_id    org:…
         * @return array<string, mixed>
         */
        public static function filter_export(array $connector, $org_id): array {
            if (! class_exists('Fides_Catalog_Org_Tier') || ! Fides_Catalog_Org_Tier::tier_ui_enabled()) {
                return $connector;
            }

            $connector['catalogTier'] = Fides_Catalog_Org_Tier::export_catalog_tier_label($org_id);
            unset($connector['catalogListingDepth']);
            if (Fides_Catalog_Org_Tier::has_curated_community_full_listing($org_id)) {
                $connector['catalogListingDepth'] = 'full';
            }

            if (Fides_Catalog_Org_Tier::has_full_listing($org_id)) {
                return $connector;
            }

            foreach (self::PRO_PAYLOAD_KEYS as $key) {
                unset($connector[ $key ]);
            }

            if (! empty($connector['description'])) {
                $connector['description'] = Fides_Catalog_Org_Tier::truncate_description((string) $connector['description']);
            }

            return $connector;
        }
    }
}
