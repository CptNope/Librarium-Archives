<?php
/**
 * Renders the shortcode outside WordPress with minimal stubs, and checks the output.
 * Run after `node tools/build-wp.mjs`:
 *   php tests/plugin-render.test.php render
 *   php tests/plugin-render.test.php sanitize
 */

define( 'ABSPATH', __DIR__ . '/' );
$plugin = dirname( __DIR__ ) . '/dist/librarium-archives/';

// --- the WordPress functions the plugin touches, reduced to what this test needs
$GLOBALS['actions'] = array(); $GLOBALS['enqueued'] = array(); $GLOBALS['can_edit'] = false;
function plugin_dir_path( $f ) { return dirname( $f ) . '/'; }
function plugin_dir_url( $f ) { return 'https://example.test/wp-content/plugins/librarium-archives/'; }
function add_action( $h, $cb ) { $GLOBALS['actions'][ $h ][] = $cb; }
function add_shortcode( $tag, $cb ) { $GLOBALS['shortcode'] = $cb; }
function shortcode_atts( $defaults, $atts ) { $atts = (array) $atts; $out = array(); foreach ( $defaults as $k => $v ) { $out[ $k ] = array_key_exists( $k, $atts ) ? $atts[ $k ] : $v; } return $out; }
function esc_attr( $s ) { return htmlspecialchars( (string) $s, ENT_QUOTES ); }
function esc_html( $s ) { return htmlspecialchars( (string) $s, ENT_QUOTES ); }
function esc_html__( $s ) { return esc_html( $s ); }
function __( $s ) { return $s; }
function esc_url( $u, $protocols = array( 'http', 'https' ) ) { $u = trim( (string) $u ); foreach ( $protocols as $p ) { if ( stripos( $u, $p . '://' ) === 0 ) { return esc_attr( $u ); } } return ''; }
function sanitize_key( $k ) { return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $k ) ); }
function current_user_can( $c ) { return $GLOBALS['can_edit']; }
function wp_enqueue_style( $h ) { $GLOBALS['enqueued'][] = $h; }
function wp_enqueue_script( $h ) { $GLOBALS['enqueued'][] = $h; }

require $plugin . 'librarium-archives.php';

$fails = 0;
function check( $label, $cond ) { global $fails; echo ( $cond ? 'ok     ' : 'FAILED ' ) . $label . "\n"; if ( ! $cond ) { $fails++; } }

$mode = isset( $argv[1] ) ? $argv[1] : 'render';

if ( 'render' === $mode ) {
	$html = librarium_archives_render( array( 'height' => '720px', 'start' => 'tables', 'shop_url' => 'https://librarium.games/marketplace/' ) );
	check( 'wraps the Archives in .lm-embed with the height', strpos( $html, '<div class="lm-embed" style="--lm-height:720px">' ) === 0 );
	check( 'passes the start exhibit', strpos( $html, 'data-start="tables"' ) !== false );
	check( 'passes the shop link', strpos( $html, 'data-shop="https://librarium.games/marketplace/"' ) !== false );
	check( 'includes the Archives markup', strpos( $html, 'id="lm-scene"' ) !== false && strpos( $html, 'id="lm-hud"' ) !== false );
	check( 'has no script tags in the markup', stripos( $html, '<script' ) === false );
	check( 'enqueues the assets', in_array( 'librarium-archives', $GLOBALS['enqueued'], true ) );
	check( 'registers the Elementor hook', isset( $GLOBALS['actions']['elementor/widgets/register'] ) );
	check( 'a second copy on the page renders nothing for visitors', librarium_archives_render( array() ) === '' );
	$GLOBALS['can_edit'] = true;
	check( 'a second copy shows editors a notice', strpos( librarium_archives_render( array() ), 'Only one copy of the Librarium Archives' ) !== false );
} else {
	// Run in its own process so the one-per-page flag starts fresh.
	$bad = librarium_archives_render( array( 'height' => '100%;background:red', 'start' => '<b>nope</b>', 'shop_url' => 'javascript:alert(1)' ) );
	check( 'rejects an unsafe height', strpos( $bad, '--lm-height:80vh' ) !== false );
	check( 'rejects an unknown start exhibit', strpos( $bad, 'data-start=""' ) !== false );
	check( 'rejects a javascript: shop link', strpos( $bad, 'data-shop=""' ) !== false );
}

exit( $fails ? 1 : 0 );
