<?php
/**
 * Minimal WordPress stubs so the pure normalizer can be tested without WordPress.
 *
 * Run from the repo root:
 *   php ../fides-community-tools-tiles/tools/phpunit.phar -c tests/php/phpunit.xml.dist
 */

declare(strict_types=1);

if (! defined('ABSPATH')) {
    define('ABSPATH', __DIR__ . '/');
}
if (! function_exists('sanitize_text_field')) {
    function sanitize_text_field($str) {
        return is_scalar($str) ? trim(preg_replace('/\s+/', ' ', strip_tags((string) $str))) : '';
    }
}
if (! function_exists('sanitize_textarea_field')) {
    function sanitize_textarea_field($str) {
        return is_scalar($str) ? trim(strip_tags((string) $str)) : '';
    }
}
if (! function_exists('esc_url_raw')) {
    function esc_url_raw($url, $protocols = null) {
        if (! is_string($url)) {
            return '';
        }
        $url    = filter_var($url, FILTER_SANITIZE_URL);
        $scheme = strtolower((string) parse_url((string) $url, PHP_URL_SCHEME));
        $allowed = is_array($protocols) ? $protocols : array('http', 'https');
        return in_array($scheme, $allowed, true) ? (string) $url : '';
    }
}

require_once dirname(__DIR__, 2) . '/wordpress-plugin/fides-wallet-connector-catalog/includes/class-fides-wallet-connector-catalog-v1-normalizer.php';
require_once dirname(__DIR__, 2) . '/wordpress-plugin/fides-wallet-connector-catalog/includes/class-fides-wallet-connector-catalog-tier.php';
