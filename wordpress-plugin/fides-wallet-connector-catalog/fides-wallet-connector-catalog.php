<?php
/**
 * Plugin Name: FIDES Wallet Connector Catalog
 * Description: Searchable catalog of issuer and verifier wallet connector products with shared SSR, SEO, and modal support, plus submit/update forms ([fides_wallet_connector_submit_form], [fides_wallet_connector_update_form]) backed by the shared submission core.
 * Version: 1.2.1
 * Author: FIDES Community
 * License: Apache-2.0
 * Text Domain: fides-wallet-connector-catalog
 */

if (! defined('ABSPATH')) {
    exit;
}

define('FIDES_WALLET_CONNECTOR_CATALOG_VERSION', '1.2.1');
define('FIDES_WALLET_CONNECTOR_CATALOG_DIR', plugin_dir_path(__FILE__));
define('FIDES_WALLET_CONNECTOR_CATALOG_URL', plugin_dir_url(__FILE__));

/** Default site path of the page hosting [fides_wallet_connector_update_form]. */
define('FIDES_WALLET_CONNECTOR_CATALOG_DEFAULT_UPDATE_FORM_PATH', '/wallet-connectors-update/');

require_once FIDES_WALLET_CONNECTOR_CATALOG_DIR . 'includes/class-fides-wallet-connector-catalog-ssr.php';
require_once FIDES_WALLET_CONNECTOR_CATALOG_DIR . 'includes/class-fides-wallet-connector-catalog-v1-normalizer.php';
require_once FIDES_WALLET_CONNECTOR_CATALOG_DIR . 'includes/class-fides-wallet-connector-catalog-tier.php';
require_once FIDES_WALLET_CONNECTOR_CATALOG_DIR . 'includes/class-fides-wallet-connector-catalog-tier.php';
require_once FIDES_WALLET_CONNECTOR_CATALOG_DIR . 'includes/class-fides-wallet-connector-catalog-submission-adapter.php';
require_once FIDES_WALLET_CONNECTOR_CATALOG_DIR . 'includes/class-fides-wallet-connector-catalog-submission-forms.php';
Fides_Wallet_Connector_Catalog_SSR::bootstrap();
Fides_Wallet_Connector_Catalog_Submission_Adapter::bootstrap();
Fides_Wallet_Connector_Catalog_Submission_Forms::bootstrap();

/**
 * Resolve the public connector update form URL (option or default path).
 */
function fides_wallet_connector_catalog_update_form_url(): string {
    $option = trim((string) get_option('fides_wallet_connector_update_form_url', ''));
    if ($option !== '') {
        return esc_url_raw($option);
    }
    return home_url(FIDES_WALLET_CONNECTOR_CATALOG_DEFAULT_UPDATE_FORM_PATH);
}

function fides_wallet_connector_catalog_register_assets(): void {
    $asset = static function (string $relative): string {
        $path = FIDES_WALLET_CONNECTOR_CATALOG_DIR . $relative;
        return file_exists($path) ? (string) filemtime($path) : FIDES_WALLET_CONNECTOR_CATALOG_VERSION;
    };
    wp_register_style(
        'fides-wallet-connector-catalog-ui',
        FIDES_WALLET_CONNECTOR_CATALOG_URL . 'assets/lib/fides-catalog-ui.css',
        array(),
        $asset('assets/lib/fides-catalog-ui.css')
    );
    wp_register_style(
        'fides-wallet-connector-catalog',
        FIDES_WALLET_CONNECTOR_CATALOG_URL . 'assets/style.css',
        array('fides-wallet-connector-catalog-ui'),
        $asset('assets/style.css')
    );
    wp_register_script(
        'fides-wallet-connector-catalog-ui',
        FIDES_WALLET_CONNECTOR_CATALOG_URL . 'assets/lib/fides-catalog-ui.js',
        array(),
        $asset('assets/lib/fides-catalog-ui.js'),
        true
    );
    wp_register_script(
        'fides-wallet-connector-catalog',
        FIDES_WALLET_CONNECTOR_CATALOG_URL . 'assets/wallet-connector-catalog.js',
        array('fides-wallet-connector-catalog-ui'),
        $asset('assets/wallet-connector-catalog.js'),
        true
    );
    $version_of = static function (string $relative): string {
        $path = FIDES_WALLET_CONNECTOR_CATALOG_DIR . $relative;
        return file_exists($path) ? (string) filemtime($path) : '';
    };
    // Same login return handling as the Business Wallet Catalog.
    $request_uri = isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : '';
    $host = isset($_SERVER['HTTP_HOST']) ? sanitize_text_field(wp_unslash($_SERVER['HTTP_HOST'])) : '';
    $current_url = $host !== '' ? ((is_ssl() ? 'https://' : 'http://') . $host . $request_uri) : home_url('/');
    $oid4vp_options = get_option('universal_openid4vp_options', array());
    $oid4vp_login_url = is_array($oid4vp_options) && ! empty($oid4vp_options['loginUrl'])
        ? esc_url_raw((string) $oid4vp_options['loginUrl'])
        : '';
    $ratings_login_url = $oid4vp_login_url !== '' ? $oid4vp_login_url : wp_login_url($current_url);
    wp_localize_script('fides-wallet-connector-catalog', 'fidesWalletConnectorCatalog', array(
        'pluginUrl' => FIDES_WALLET_CONNECTOR_CATALOG_URL,
        'githubDataUrl' => 'https://raw.githubusercontent.com/FIDEScommunity/fides-wallet-connector-catalog/main/data/aggregated.json',
        'cacheDataUrl' => rest_url('fides-catalog/v1/aggregated/connector'),
        'localDataUrl' => FIDES_WALLET_CONNECTOR_CATALOG_URL . 'data/aggregated.json',
        'aggregatedDataVersion' => $version_of('data/aggregated.json'),
        'vocabularyUrl' => 'https://raw.githubusercontent.com/FIDEScommunity/fides-interop-profiles/main/data/vocabulary.json',
        'vocabularyFallbackUrl' => FIDES_WALLET_CONNECTOR_CATALOG_URL . 'assets/vocabulary.json',
        'vocabularyDataVersion' => $version_of('assets/vocabulary.json'),
        'organizationCatalogUrl' => get_option('fides_wallet_connector_organization_url', 'https://fides.community/ecosystem-explorer/organization-catalog/'),
        'bluePagesUrl' => get_option('fides_wallet_connector_blue_pages_url', 'https://fides.community/community-tools/blue-pages'),
        'ratingsApiBase' => rest_url('fides-catalog/v1'),
        'ratingsNonce' => wp_create_nonce('wp_rest'),
        'ratingsIsLoggedIn' => is_user_logged_in(),
        'ratingsLoginUrl' => $ratings_login_url,
        'updateFormUrl' => fides_wallet_connector_catalog_update_form_url(),
        'editAccess' => class_exists('Fides_Catalog_Org_Tier')
            ? Fides_Catalog_Org_Tier::edit_access_for_user(get_current_user_id())
            : array(
                'isLoggedIn'  => is_user_logged_in(),
                'isAdmin'     => current_user_can('manage_options'),
                'ownedOrgIds' => array(),
                'proOrgIds'   => array(),
            ),
        'tierUiEnabled' => function_exists('fides_catalog_tier_ui_enabled') && fides_catalog_tier_ui_enabled(),
        'askFidesAvailable' => has_action('fides_assistant_enqueue_headless') !== false,
        'askFidesPlaceholder' => __('Ask anything about wallet connectors…', 'fides-wallet-connector-catalog'),
        'sharePath' => '/connector/',
        'walletSharePath' => '/wallet/',
    ));
}
add_action('wp_enqueue_scripts', 'fides_wallet_connector_catalog_register_assets');

function fides_wallet_connector_catalog_shortcode($atts): string {
    $atts = shortcode_atts(array(
        'theme' => 'fides',
        'show_filters' => 'true',
        'show_search' => 'true',
        'columns' => '3',
    ), $atts, 'fides_wallet_connector_catalog');
    wp_enqueue_style('fides-wallet-connector-catalog');
    wp_enqueue_script('fides-wallet-connector-catalog-ui');
    wp_enqueue_script('fides-wallet-connector-catalog');
    // Tell the UI which page hosts the listing so closing a deeplinked modal restores the listing URL.
    $listing_url = get_permalink();
    if ($listing_url) {
        wp_add_inline_script(
            'fides-wallet-connector-catalog',
            'window.fidesWalletConnectorCatalog = window.fidesWalletConnectorCatalog || {}; window.fidesWalletConnectorCatalog.listingPath = ' .
                wp_json_encode((string) wp_parse_url($listing_url, PHP_URL_PATH)) . ';',
            'before'
        );
    }
    $initial = Fides_Wallet_Connector_Catalog_SSR::build_initial_html($atts);
    if ($initial === '') {
        $initial = '<div class="fides-loading"><div class="fides-spinner"></div><p>Loading wallet connector catalog…</p></div>';
    }
    return sprintf(
        '<div id="fides-wallet-connector-catalog-root" class="fides-wallet-connector-catalog" data-theme="%1$s" data-show-filters="%2$s" data-show-search="%3$s" data-columns="%5$s">%4$s</div>',
        esc_attr((string) $atts['theme']),
        esc_attr((string) $atts['show_filters']),
        esc_attr((string) $atts['show_search']),
        $initial,
        esc_attr((string) $atts['columns'])
    );
}
add_shortcode('fides_wallet_connector_catalog', 'fides_wallet_connector_catalog_shortcode');

function fides_wallet_connector_catalog_query_vars(array $vars): array {
    $vars[] = 'connector';
    $vars[] = 'fides_connector_share';
    return $vars;
}
add_filter('query_vars', 'fides_wallet_connector_catalog_query_vars');

function fides_wallet_connector_catalog_rewrites(): void {
    add_rewrite_rule('^connector/([^/]+)/?$', 'index.php?fides_connector_share=1&connector=$matches[1]', 'top');
}
add_action('init', 'fides_wallet_connector_catalog_rewrites', 6);

function fides_wallet_connector_catalog_map_share_request(array $query_vars): array {
    if (empty($query_vars['fides_connector_share']) || empty($query_vars['connector'])) {
        return $query_vars;
    }
    $page = get_page_by_path(trim(Fides_Wallet_Connector_Catalog_SSR::LISTING_PATH, '/'));
    if (! ($page instanceof WP_Post)) {
        // Fallback for sites (e.g. local demos) where the listing lives on another page: use the first page with the shortcode.
        $pages = get_posts(array(
            'post_type'      => 'page',
            'post_status'    => 'publish',
            's'              => '[fides_wallet_connector_catalog',
            'posts_per_page' => 1,
            'orderby'        => 'ID',
            'order'          => 'ASC',
        ));
        $page = $pages ? $pages[0] : null;
    }
    if ($page instanceof WP_Post) {
        $query_vars['page_id'] = (int) $page->ID;
        unset($query_vars['pagename'], $query_vars['name']);
    }
    unset($query_vars['fides_connector_share']);
    return $query_vars;
}
add_filter('request', 'fides_wallet_connector_catalog_map_share_request');

function fides_wallet_connector_catalog_register_settings(): void {
    register_setting('fides_wallet_connector_catalog_settings', 'fides_wallet_connector_update_form_url', array(
        'type'              => 'string',
        'default'           => '',
        'sanitize_callback' => 'esc_url_raw',
    ));
}
add_action('admin_init', 'fides_wallet_connector_catalog_register_settings');

function fides_wallet_connector_catalog_add_admin_menu(): void {
    add_options_page(
        'FIDES Wallet Connector Catalog',
        'FIDES Wallet Connector Catalog',
        'manage_options',
        'fides-wallet-connector-catalog',
        'fides_wallet_connector_catalog_render_admin_page'
    );
}
add_action('admin_menu', 'fides_wallet_connector_catalog_add_admin_menu');

function fides_wallet_connector_catalog_render_admin_page(): void {
    ?>
    <div class="wrap">
        <h1>FIDES Wallet Connector Catalog</h1>
        <form method="post" action="options.php">
            <?php settings_fields('fides_wallet_connector_catalog_settings'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="fides_wallet_connector_update_form_url">Connector update form page URL</label></th>
                    <td>
                        <input type="url" id="fides_wallet_connector_update_form_url" name="fides_wallet_connector_update_form_url"
                               value="<?php echo esc_attr(get_option('fides_wallet_connector_update_form_url', '')); ?>"
                               class="regular-text"
                               placeholder="<?php echo esc_attr(home_url(FIDES_WALLET_CONNECTOR_CATALOG_DEFAULT_UPDATE_FORM_PATH)); ?>">
                        <p class="description">Page with <code>[fides_wallet_connector_update_form]</code>. Used for the &quot;Suggest an update&quot; link in the connector modal (logged-in users only).</p>
                    </td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
        <hr>
        <h2>Shortcodes</h2>
        <table class="widefat" style="max-width: 800px;">
            <thead><tr><th>Shortcode</th><th>Attributes</th><th>Description</th></tr></thead>
            <tbody>
                <tr><td><code>[fides_wallet_connector_catalog]</code></td><td><code>theme</code>, <code>show_filters</code>, <code>show_search</code>, <code>columns</code></td><td>Connector listing</td></tr>
                <tr><td><code>[fides_wallet_connector_submit_form]</code></td><td>none</td><td>Form to add a new connector (signed-in users)</td></tr>
                <tr><td><code>[fides_wallet_connector_update_form]</code></td><td><code>connector</code> (optional connector id; also read from <code>?connector=</code>)</td><td>Form to suggest an update to an existing connector (signed-in users)</td></tr>
            </tbody>
        </table>
        <p>Submissions are reviewed under Tools &rarr; Catalog Submissions (FIDES Community Tools Tiles).</p>
    </div>
    <?php
}
