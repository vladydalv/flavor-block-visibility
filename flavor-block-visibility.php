<?php
/**
 * Plugin Name: Flavor Block Visibility
 * Description: Hide any block on Mobile, Tablet or Desktop, and set a different Columns order per device. Lightweight, CSS-first, native editor UI.
 * Version: 2.0.0
 * Author: Vlad Zelinskyi
 * Author URI: https://www.spacenerd.space/
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: flavor-block-visibility
 * Requires at least: 6.2
 * Requires PHP: 7.4
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'FLBVIS_VERSION', '2.0.0' );
define( 'FLBVIS_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

// ============================================
// Default breakpoints
// ============================================

/**
 * Get the default breakpoint values.
 *
 * @return array Default breakpoints.
 */
function flbvis_get_default_breakpoints() {
    return array(
        'mobile_max'  => 767,
        'tablet_min'  => 768,
        'tablet_max'  => 1024,
        'desktop_min' => 1025,
    );
}

/**
 * Get the current breakpoint values (saved or defaults).
 *
 * @return array Current breakpoints.
 */
function flbvis_get_breakpoints() {
    $defaults = flbvis_get_default_breakpoints();
    $saved    = get_option( 'flbvis_breakpoints', array() );

    if ( ! is_array( $saved ) ) {
        $saved = array();
    }

    return wp_parse_args( $saved, $defaults );
}

// ============================================
// Register block attributes
// ============================================

/**
 * Register responsive visibility attributes for all blocks.
 */
function flbvis_register_block_attributes() {
    $registered_blocks = WP_Block_Type_Registry::get_instance()->get_all_registered();

    foreach ( $registered_blocks as $block ) {
        $block->attributes['flbvisHideOnDesktop'] = array(
            'type'    => 'boolean',
            'default' => false,
        );
        $block->attributes['flbvisHideOnTablet'] = array(
            'type'    => 'boolean',
            'default' => false,
        );
        $block->attributes['flbvisHideOnMobile'] = array(
            'type'    => 'boolean',
            'default' => false,
        );

        if ( 'core/columns' === $block->name ) {
            $block->attributes['flbvisColumnOrder'] = array(
                'type' => 'object',
            );
        }
    }
}
add_action( 'init', 'flbvis_register_block_attributes', 100 );

// ============================================
// Editor assets
// ============================================

/**
 * Enqueue editor scripts and styles.
 */
function flbvis_enqueue_editor_assets() {
    wp_enqueue_script(
        'flbvis-editor-script',
        FLBVIS_PLUGIN_URL . 'src/editor.js',
        array(
            'wp-blocks',
            'wp-i18n',
            'wp-element',
            'wp-block-editor',
            'wp-components',
            'wp-compose',
            'wp-hooks',
            'wp-data',
            'wp-a11y',
        ),
        FLBVIS_VERSION,
        true
    );

    wp_set_script_translations( 'flbvis-editor-script', 'flavor-block-visibility' );

    $bp = flbvis_get_breakpoints();
    wp_localize_script( 'flbvis-editor-script', 'flbvisSettings', array(
        'breakpoints' => array(
            'mobile_max'  => absint( $bp['mobile_max'] ),
            'tablet_min'  => absint( $bp['tablet_min'] ),
            'tablet_max'  => absint( $bp['tablet_max'] ),
            'desktop_min' => absint( $bp['desktop_min'] ),
        ),
    ) );

    wp_enqueue_style(
        'flbvis-editor-style',
        FLBVIS_PLUGIN_URL . 'src/editor.css',
        array(),
        FLBVIS_VERSION
    );
}
add_action( 'enqueue_block_editor_assets', 'flbvis_enqueue_editor_assets' );

// ============================================
// Frontend: conditional CSS loading
// ============================================

/**
 * Conditionally enqueue frontend styles only when needed.
 */
function flbvis_maybe_enqueue_frontend_styles() {
    if ( flbvis_current_content_has_hidden_blocks() ) {
        flbvis_enqueue_inline_styles();
    }
}
add_action( 'wp_enqueue_scripts', 'flbvis_maybe_enqueue_frontend_styles' );

/**
 * Check if the current page content uses any responsive visibility attributes.
 *
 * @return bool True if hidden blocks are found.
 */
function flbvis_current_content_has_hidden_blocks() {
    if ( is_singular() ) {
        global $post;
        if ( $post && ! empty( $post->post_content ) ) {
            if ( preg_match( '/"flbvisHideOn(Desktop|Tablet|Mobile)"\s*:\s*true|"flbvisColumnOrder"/', $post->post_content ) ) {
                return true;
            }
        }
        return false;
    }

    global $wp_query;
    if ( $wp_query && ! empty( $wp_query->posts ) ) {
        foreach ( $wp_query->posts as $queried_post ) {
            if ( ! empty( $queried_post->post_content ) &&
                 preg_match( '/"flbvisHideOn(Desktop|Tablet|Mobile)"\s*:\s*true|"flbvisColumnOrder"/', $queried_post->post_content ) ) {
                return true;
            }
        }
    }

    // Block themes render templates before wp_head, so render_block enqueues
    // the CSS in time for blocks in templates and template parts.
    return false;
}

/**
 * Output inline CSS with current breakpoint values.
 */
function flbvis_enqueue_inline_styles() {
    static $enqueued = false;
    if ( $enqueued ) {
        return;
    }
    $enqueued = true;

    $bp = flbvis_get_breakpoints();

    $css = sprintf(
        '@media(min-width:%dpx){.flbvis-hide-desktop{display:none!important}}' .
        '@media(min-width:%dpx) and (max-width:%dpx){.flbvis-hide-tablet{display:none!important}}' .
        '@media(max-width:%dpx){.flbvis-hide-mobile{display:none!important}}' .
        '@media(max-width:%dpx){.flbvis-order-mobile>.wp-block-column{order:var(--flbvis-order-mobile)}}' .
        '@media(min-width:%dpx) and (max-width:%dpx){.flbvis-order-tablet>.wp-block-column{order:var(--flbvis-order-tablet)}}' .
        '@media(min-width:%dpx){.flbvis-order-desktop>.wp-block-column{order:var(--flbvis-order-desktop)}}' .
        '.flbvis-has-order.flbvis-dom-ordered>.wp-block-column{order:0}',
        absint( $bp['desktop_min'] ),
        absint( $bp['tablet_min'] ),
        absint( $bp['tablet_max'] ),
        absint( $bp['mobile_max'] ),
        absint( $bp['mobile_max'] ),
        absint( $bp['tablet_min'] ),
        absint( $bp['tablet_max'] ),
        absint( $bp['desktop_min'] )
    );

    wp_register_style( 'flbvis-frontend-style', false, array(), FLBVIS_VERSION );
    wp_enqueue_style( 'flbvis-frontend-style' );
    wp_add_inline_style( 'flbvis-frontend-style', $css );
}

// ============================================
// Render: add CSS classes to blocks
// ============================================

/**
 * Add responsive visibility CSS classes to blocks on the frontend.
 *
 * @param string $block_content The block HTML content.
 * @param array  $block         The parsed block data.
 * @return string Modified block content.
 */
function flbvis_render_block( $block_content, $block ) {
    if ( empty( $block_content ) ) {
        return $block_content;
    }

    $attrs   = isset( $block['attrs'] ) ? $block['attrs'] : array();
    $classes = array();

    if ( ! empty( $attrs['flbvisHideOnDesktop'] ) ) {
        $classes[] = 'flbvis-hide-desktop';
    }
    if ( ! empty( $attrs['flbvisHideOnTablet'] ) ) {
        $classes[] = 'flbvis-hide-tablet';
    }
    if ( ! empty( $attrs['flbvisHideOnMobile'] ) ) {
        $classes[] = 'flbvis-hide-mobile';
    }

    if ( empty( $classes ) ) {
        return $block_content;
    }

    // Ensure CSS is loaded (covers edge cases: widgets, template parts, etc.)
    flbvis_enqueue_inline_styles();

    // Use WP_HTML_Tag_Processor (WP 6.2+).
    if ( class_exists( 'WP_HTML_Tag_Processor' ) ) {
        $processor = new WP_HTML_Tag_Processor( $block_content );
        if ( $processor->next_tag() ) {
            foreach ( $classes as $cls ) {
                $processor->add_class( $cls );
            }
            return $processor->get_updated_html();
        }
    }

    // Fallback for older WordPress versions.
    $extra_class = implode( ' ', $classes );

    // Check if the first tag already has a class attribute.
    if ( preg_match( '/^<[a-z][a-z0-9]*\s[^>]*class\s*=\s*["\']([^"\']*)["\']/', $block_content, $matches ) ) {
        // Append to existing class.
        $block_content = preg_replace(
            '/^(<[a-z][a-z0-9]*\s[^>]*class\s*=\s*["\'])/',
            '$1' . esc_attr( $extra_class ) . ' ',
            $block_content,
            1
        );
    } else {
        // Add new class attribute.
        $block_content = preg_replace(
            '/^(<[a-z][a-z0-9]*)([\s>])/i',
            '$1 class="' . esc_attr( $extra_class ) . '"$2',
            $block_content,
            1
        );
    }

    return $block_content;
}
add_filter( 'render_block', 'flbvis_render_block', 10, 2 );

// ============================================
// Column order (core/columns)
// ============================================

/**
 * Devices supported by the column order feature.
 *
 * @return string[] Device keys.
 */
function flbvis_order_devices() {
    return array( 'mobile', 'tablet', 'desktop' );
}

/**
 * Whether the accessible DOM reorder script is enabled.
 *
 * @return bool
 */
function flbvis_dom_reorder_enabled() {
    return (bool) get_option( 'flbvis_dom_reorder', 1 );
}

/**
 * Parse a stored order string ("2,0,1") into positions => original column index.
 *
 * Returns null when the value is empty, invalid for the given column count,
 * or equal to the natural order.
 *
 * @param mixed $value Stored order string.
 * @param int   $count Number of columns.
 * @return int[]|null
 */
function flbvis_parse_column_order( $value, $count ) {
    if ( ! is_string( $value ) || '' === trim( $value ) || $count < 2 ) {
        return null;
    }

    $parts = preg_split( '/[\s,]+/', trim( $value ) );
    if ( ! is_array( $parts ) || count( $parts ) !== $count ) {
        return null;
    }

    $order = array();
    foreach ( $parts as $part ) {
        if ( ! ctype_digit( (string) $part ) ) {
            return null;
        }
        $order[] = (int) $part;
    }

    $sorted = $order;
    sort( $sorted );
    if ( range( 0, $count - 1 ) !== $sorted ) {
        return null;
    }

    if ( range( 0, $count - 1 ) === $order ) {
        return null;
    }

    return $order;
}

/**
 * Get the valid per-device orders of a core/columns block.
 *
 * @param array $attrs Block attributes.
 * @param int   $count Number of columns.
 * @return array Device => order array.
 */
function flbvis_get_column_orders( $attrs, $count ) {
    $config = isset( $attrs['flbvisColumnOrder'] ) ? $attrs['flbvisColumnOrder'] : null;
    if ( ! is_array( $config ) ) {
        return array();
    }

    $orders = array();
    foreach ( flbvis_order_devices() as $device ) {
        $order = flbvis_parse_column_order( isset( $config[ $device ] ) ? $config[ $device ] : '', $count );
        if ( null !== $order ) {
            $orders[ $device ] = $order;
        }
    }

    return $orders;
}

/**
 * Pass each column its per-device position, computed from the parent Columns block.
 *
 * @param array         $parsed_block The column being rendered.
 * @param array         $source_block Unmodified copy of the block.
 * @param WP_Block|null $parent_block Parent block instance (WP 5.9+).
 * @return array
 */
function flbvis_column_order_block_data( $parsed_block, $source_block, $parent_block = null ) {
    if ( ! isset( $parsed_block['blockName'] ) || 'core/column' !== $parsed_block['blockName'] ) {
        return $parsed_block;
    }
    if ( ! ( $parent_block instanceof WP_Block ) || 'core/columns' !== $parent_block->name ) {
        return $parsed_block;
    }

    $parent = $parent_block->parsed_block;
    $count  = isset( $parent['innerBlocks'] ) ? count( $parent['innerBlocks'] ) : 0;
    $orders = flbvis_get_column_orders( isset( $parent['attrs'] ) ? $parent['attrs'] : array(), $count );

    if ( empty( $orders ) ) {
        return $parsed_block;
    }

    // Inner blocks render sequentially, so a per-parent counter gives the column index.
    static $counters = array();
    $key              = spl_object_id( $parent_block );
    $index            = isset( $counters[ $key ] ) ? $counters[ $key ] : 0;
    $counters[ $key ] = ( $index + 1 ) % $count;

    $positions = array();
    foreach ( $orders as $device => $order ) {
        $positions[ $device ] = (int) array_search( $index, $order, true );
    }

    $parsed_block['attrs']['flbvisOrderPosition'] = $positions;

    return $parsed_block;
}
add_filter( 'render_block_data', 'flbvis_column_order_block_data', 10, 3 );

/**
 * Add order classes / data attributes to Columns and CSS variables to each Column.
 *
 * @param string $block_content The block HTML content.
 * @param array  $block         The parsed block data.
 * @return string
 */
function flbvis_render_column_order( $block_content, $block ) {
    if ( empty( $block_content ) || empty( $block['blockName'] ) ) {
        return $block_content;
    }

    if ( 'core/column' === $block['blockName'] ) {
        $positions = isset( $block['attrs']['flbvisOrderPosition'] ) ? $block['attrs']['flbvisOrderPosition'] : null;
        if ( ! is_array( $positions ) ) {
            return $block_content;
        }

        $processor = new WP_HTML_Tag_Processor( $block_content );
        if ( ! $processor->next_tag() ) {
            return $block_content;
        }

        $vars = '';
        foreach ( flbvis_order_devices() as $device ) {
            if ( isset( $positions[ $device ] ) ) {
                $vars .= sprintf( '--flbvis-order-%s:%d;', $device, absint( $positions[ $device ] ) );
            }
        }

        $style = $processor->get_attribute( 'style' );
        $style = is_string( $style ) ? rtrim( trim( $style ), ';' ) : '';
        $processor->set_attribute( 'style', ( '' !== $style ? $style . ';' : '' ) . $vars );

        return $processor->get_updated_html();
    }

    if ( 'core/columns' !== $block['blockName'] ) {
        return $block_content;
    }

    $count  = isset( $block['innerBlocks'] ) ? count( $block['innerBlocks'] ) : 0;
    $orders = flbvis_get_column_orders( isset( $block['attrs'] ) ? $block['attrs'] : array(), $count );

    if ( empty( $orders ) ) {
        return $block_content;
    }

    $processor = new WP_HTML_Tag_Processor( $block_content );
    if ( ! $processor->next_tag() ) {
        return $block_content;
    }

    $processor->add_class( 'flbvis-has-order' );
    foreach ( $orders as $device => $order ) {
        $processor->add_class( 'flbvis-order-' . $device );
        $processor->set_attribute( 'data-flbvis-order-' . $device, implode( ',', $order ) );
    }

    flbvis_enqueue_inline_styles();

    if ( flbvis_dom_reorder_enabled() ) {
        flbvis_enqueue_dom_reorder_script();
    }

    return $processor->get_updated_html();
}
add_filter( 'render_block', 'flbvis_render_column_order', 10, 2 );

/**
 * Enqueue the small script that syncs DOM order with the visual order.
 */
function flbvis_enqueue_dom_reorder_script() {
    static $enqueued = false;
    if ( $enqueued ) {
        return;
    }
    $enqueued = true;

    $bp = flbvis_get_breakpoints();

    wp_enqueue_script(
        'flbvis-frontend',
        FLBVIS_PLUGIN_URL . 'src/frontend.js',
        array(),
        FLBVIS_VERSION,
        true
    );

    wp_add_inline_script(
        'flbvis-frontend',
        'window.flbvisFrontend=' . wp_json_encode(
            array(
                'mq' => array(
                    'mobile'  => sprintf( '(max-width:%dpx)', absint( $bp['mobile_max'] ) ),
                    'tablet'  => sprintf( '(min-width:%dpx) and (max-width:%dpx)', absint( $bp['tablet_min'] ), absint( $bp['tablet_max'] ) ),
                    'desktop' => sprintf( '(min-width:%dpx)', absint( $bp['desktop_min'] ) ),
                ),
            )
        ) . ';',
        'before'
    );
}

// ============================================
// Settings Page
// ============================================

/**
 * Register plugin settings.
 */
function flbvis_register_settings() {
    register_setting(
        'flbvis_settings_group',
        'flbvis_breakpoints',
        array(
            'type'              => 'object',
            'sanitize_callback' => 'flbvis_sanitize_breakpoints',
            'default'           => flbvis_get_default_breakpoints(),
        )
    );

    register_setting(
        'flbvis_settings_group',
        'flbvis_dom_reorder',
        array(
            'type'              => 'boolean',
            'sanitize_callback' => 'flbvis_sanitize_checkbox',
            'default'           => 1,
        )
    );
}
add_action( 'admin_init', 'flbvis_register_settings' );

/**
 * Sanitize a checkbox / boolean value.
 *
 * @param mixed $input Raw value.
 * @return int 1 or 0.
 */
function flbvis_sanitize_checkbox( $input ) {
    return empty( $input ) ? 0 : 1;
}

/**
 * Sanitize breakpoint values.
 *
 * @param mixed $input Raw input.
 * @return array Sanitized breakpoints.
 */
function flbvis_sanitize_breakpoints( $input ) {
    $defaults = flbvis_get_default_breakpoints();

    if ( ! is_array( $input ) ) {
        return $defaults;
    }

    $sanitized = array();

    foreach ( $defaults as $key => $default_val ) {
        $val               = isset( $input[ $key ] ) ? absint( $input[ $key ] ) : $default_val;
        $sanitized[ $key ] = min( 9999, $val );
    }

    // Ensure logical order: mobile_max < tablet_min <= tablet_max < desktop_min.
    if ( $sanitized['tablet_min'] <= $sanitized['mobile_max'] ) {
        $sanitized['tablet_min'] = $sanitized['mobile_max'] + 1;
    }
    if ( $sanitized['tablet_max'] < $sanitized['tablet_min'] ) {
        $sanitized['tablet_max'] = $sanitized['tablet_min'];
    }
    if ( $sanitized['desktop_min'] <= $sanitized['tablet_max'] ) {
        $sanitized['desktop_min'] = $sanitized['tablet_max'] + 1;
    }

    return $sanitized;
}

/**
 * Add settings page to the admin menu.
 */
function flbvis_add_settings_page() {
    add_options_page(
        esc_html__( 'Flavor Block Visibility', 'flavor-block-visibility' ),
        esc_html__( 'Block Visibility', 'flavor-block-visibility' ),
        'manage_options',
        'flbvis-settings',
        'flbvis_render_settings_page'
    );
}
add_action( 'admin_menu', 'flbvis_add_settings_page' );

/**
 * Enqueue admin styles for the settings page.
 *
 * @param string $hook_suffix The current admin page hook.
 */
function flbvis_enqueue_admin_assets( $hook_suffix ) {
    if ( 'settings_page_flbvis-settings' !== $hook_suffix ) {
        return;
    }

    wp_enqueue_style(
        'flbvis-admin-style',
        FLBVIS_PLUGIN_URL . 'src/admin.css',
        array(),
        FLBVIS_VERSION
    );
}
add_action( 'admin_enqueue_scripts', 'flbvis_enqueue_admin_assets' );

/**
 * Render one breakpoint number field (same names as in 1.x).
 *
 * @param string $key      Breakpoint key.
 * @param string $label    Field label.
 * @param array  $bp       Current breakpoints.
 * @param array  $defaults Default breakpoints.
 */
function flbvis_render_breakpoint_field( $key, $label, $bp, $defaults ) {
    ?>
    <div class="flbvis-field">
        <label for="flbvis_<?php echo esc_attr( $key ); ?>"><?php echo esc_html( $label ); ?></label>
        <span class="flbvis-field__control">
            <input type="number" id="flbvis_<?php echo esc_attr( $key ); ?>" name="flbvis_breakpoints[<?php echo esc_attr( $key ); ?>]"
                   value="<?php echo esc_attr( $bp[ $key ] ); ?>" min="0" max="9999" step="1" />
            <span class="flbvis-field__unit">px</span>
        </span>
        <span class="flbvis-field__default">
            <?php
            printf(
                /* translators: %d: default value in pixels */
                esc_html__( 'Default: %d px', 'flavor-block-visibility' ),
                absint( $defaults[ $key ] )
            );
            ?>
        </span>
    </div>
    <?php
}

/**
 * Render the settings page.
 */
function flbvis_render_settings_page() {
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }

    $bp       = flbvis_get_breakpoints();
    $defaults = flbvis_get_default_breakpoints();
    ?>
    <div class="wrap flbvis-admin">
        <h1 class="flbvis-admin__title">
            <span class="flbvis-admin__logo" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false">
                    <path d="M4 6C4 4.89543 4.89543 4 6 4H18C19.1046 4 20 4.89543 20 6V15C20 16.1046 19.1046 17 18 17H6C4.89543 17 4 16.1046 4 15V6Z" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M9 20H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    <path d="M12 17V20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
            </span>
            <?php esc_html_e( 'Flavor Block Visibility', 'flavor-block-visibility' ); ?>
            <span class="flbvis-admin__version">v<?php echo esc_html( FLBVIS_VERSION ); ?></span>
        </h1>
        <p class="flbvis-admin__subtitle"><?php esc_html_e( 'Responsive visibility for every block and per-device column order.', 'flavor-block-visibility' ); ?></p>

        <form method="post" action="options.php">
            <?php settings_fields( 'flbvis_settings_group' ); ?>

            <section class="flbvis-card">
                <header class="flbvis-card__header">
                    <h2><?php esc_html_e( 'Breakpoints', 'flavor-block-visibility' ); ?></h2>
                    <p><?php esc_html_e( 'Configure the breakpoints used to determine device types. These values control when blocks are shown or hidden and when column order changes.', 'flavor-block-visibility' ); ?></p>
                </header>
                <div class="flbvis-card__body">
                    <div class="flbvis-devices">
                        <div class="flbvis-device">
                            <div class="flbvis-device__head">
                                <span class="dashicons dashicons-smartphone" aria-hidden="true"></span>
                                <?php esc_html_e( 'Mobile', 'flavor-block-visibility' ); ?>
                            </div>
                            <?php flbvis_render_breakpoint_field( 'mobile_max', __( 'Max-width', 'flavor-block-visibility' ), $bp, $defaults ); ?>
                        </div>
                        <div class="flbvis-device">
                            <div class="flbvis-device__head">
                                <span class="dashicons dashicons-tablet" aria-hidden="true"></span>
                                <?php esc_html_e( 'Tablet', 'flavor-block-visibility' ); ?>
                            </div>
                            <?php flbvis_render_breakpoint_field( 'tablet_min', __( 'Min-width', 'flavor-block-visibility' ), $bp, $defaults ); ?>
                            <?php flbvis_render_breakpoint_field( 'tablet_max', __( 'Max-width', 'flavor-block-visibility' ), $bp, $defaults ); ?>
                        </div>
                        <div class="flbvis-device">
                            <div class="flbvis-device__head">
                                <span class="dashicons dashicons-desktop" aria-hidden="true"></span>
                                <?php esc_html_e( 'Desktop', 'flavor-block-visibility' ); ?>
                            </div>
                            <?php flbvis_render_breakpoint_field( 'desktop_min', __( 'Min-width', 'flavor-block-visibility' ), $bp, $defaults ); ?>
                        </div>
                    </div>
                </div>
            </section>

            <section class="flbvis-card">
                <header class="flbvis-card__header">
                    <h2><?php esc_html_e( 'Column order', 'flavor-block-visibility' ); ?></h2>
                    <p><?php esc_html_e( 'Applies to Columns blocks that use a custom order per device.', 'flavor-block-visibility' ); ?></p>
                </header>
                <div class="flbvis-card__body">
                    <label class="flbvis-check" for="flbvis_dom_reorder">
                        <input type="checkbox" id="flbvis_dom_reorder" name="flbvis_dom_reorder" value="1" <?php checked( flbvis_dom_reorder_enabled() ); ?> />
                        <span>
                            <strong><?php esc_html_e( 'Accessible DOM order', 'flavor-block-visibility' ); ?></strong>
                            <span class="flbvis-check__help"><?php esc_html_e( 'Also reorders the HTML so keyboard and screen reader order match the visual order. Adds a tiny script only on pages that use a custom column order. When off, the order is changed with CSS only.', 'flavor-block-visibility' ); ?></span>
                        </span>
                    </label>
                </div>
            </section>

            <?php submit_button( __( 'Save changes', 'flavor-block-visibility' ) ); ?>
        </form>
    </div>
    <?php
}

// ============================================
// Settings link on Plugins page
// ============================================

/**
 * Add a Settings link to the plugin action links.
 *
 * @param array $links Existing plugin action links.
 * @return array Modified links.
 */
function flbvis_plugin_action_links( $links ) {
    $settings_link = sprintf(
        '<a href="%s">%s</a>',
        esc_url( admin_url( 'options-general.php?page=flbvis-settings' ) ),
        esc_html__( 'Settings', 'flavor-block-visibility' )
    );
    array_unshift( $links, $settings_link );
    return $links;
}
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'flbvis_plugin_action_links' );

// ============================================
// Cleanup on uninstall
// ============================================
register_uninstall_hook( __FILE__, 'flbvis_uninstall' );

/**
 * Clean up plugin data on uninstall.
 */
function flbvis_uninstall() {
    delete_option( 'flbvis_breakpoints' );
    delete_option( 'flbvis_dom_reorder' );
}
