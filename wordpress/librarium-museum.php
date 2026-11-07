<?php
/**
 * Plugin Name:       Librarium Archives
 * Plugin URI:        https://github.com/CptNope/Librarium-Museum
 * Description:       A walkable 3D archive of the oldest board and card games, with tables visitors can play against the Scribe. Add it with the [librarium_museum] shortcode or the "Librarium Archives" Elementor widget.
 * Version:           0.5.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Jeremy Anderson Tech
 * Author URI:        https://jeremyanderson.tech
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       librarium-museum
 *
 * @package LibrariumMuseum
 */

defined( 'ABSPATH' ) || exit;

define( 'LIBRARIUM_MUSEUM_VERSION', '0.5.0' );
define( 'LIBRARIUM_MUSEUM_DIR', plugin_dir_path( __FILE__ ) );
define( 'LIBRARIUM_MUSEUM_URL', plugin_dir_url( __FILE__ ) );

/**
 * Exhibits the museum can open on, keyed by the id the script uses.
 *
 * @return array<string,string>
 */
function librarium_museum_exhibits() {
	return array(
		''           => __( 'Entrance (Wing I)', 'librarium-museum' ),
		'senet'      => 'Senet',
		'mehen'      => 'Mehen',
		'basur'      => __( 'The Başur Höyük pieces', 'librarium-museum' ),
		'ur'         => __( 'The Royal Game of Ur', 'librarium-museum' ),
		'dice'       => __( 'The first dice', 'librarium-museum' ),
		'hounds'     => __( 'Hounds and Jackals', 'librarium-museum' ),
		'wing2'      => __( 'Wing II: Strategy Takes the Table', 'librarium-museum' ),
		'petteia'    => 'Petteia',
		'liubo'      => 'Liubo',
		'go'         => __( 'Weiqi (Go)', 'librarium-museum' ),
		'latrunculi' => 'Ludus Latrunculorum',
		'patolli'    => 'Patolli',
		'morris'     => __( "Nine Men's Morris", 'librarium-museum' ),
		'oware'      => __( 'Mancala (Oware)', 'librarium-museum' ),
		'alquerque'  => 'Alquerque',
		'brandubh'   => 'Brandubh',
		'wing3'      => __( 'Wing III: Kings, Cards and Courts', 'librarium-museum' ),
		'tables'     => __( 'Tables (backgammon)', 'librarium-museum' ),
		'chaturanga' => 'Chaturanga',
		'shatranj'   => 'Shatranj',
		'xiangqi'    => __( 'Xiangqi (Chinese chess)', 'librarium-museum' ),
		'lewis'      => __( 'The Lewis Chessmen', 'librarium-museum' ),
		'cards'      => __( 'Playing cards', 'librarium-museum' ),
		'tarot'      => __( 'Tarot', 'librarium-museum' ),
		'wing4'      => __( 'Wing IV: Printed Boards and Parlour Tables', 'librarium-museum' ),
		'foxgeese'   => __( 'Fox and Geese', 'librarium-museum' ),
		'newqueen'   => __( 'The New Queen (chess)', 'librarium-museum' ),
		'draughts'   => __( 'Draughts', 'librarium-museum' ),
		'pachisi'    => __( 'Pachisi', 'librarium-museum' ),
		'goose'      => __( 'The Game of the Goose', 'librarium-museum' ),
		'snakes'     => __( 'Snakes and Ladders', 'librarium-museum' ),
		'mahjong'    => 'Mahjong',
		'wing5'      => __( 'Wing V: The Modern Board Game', 'librarium-museum' ),
		'mansion'    => __( 'The Mansion of Happiness', 'librarium-museum' ),
		'lifegame'   => __( 'The Checkered Game of Life', 'librarium-museum' ),
		'reversi'    => 'Reversi',
		'halma'      => 'Halma',
		'dotsboxes'  => __( 'Dots and Boxes', 'librarium-museum' ),
		'landlord'   => __( "The Landlord's Game", 'librarium-museum' ),
		'wing6'      => __( 'Wing VI: Games of the World', 'librarium-museum' ),
		'mutorere'   => __( 'Mū tōrere', 'librarium-museum' ),
		'shogi'      => 'Shogi',
		'konane'     => __( 'Kōnane', 'librarium-museum' ),
		'yut'        => 'Yut Nori',
		'fanorona'   => 'Fanorona',
		'bao'        => 'Bao',
		'next'       => __( 'Librarium lectern', 'librarium-museum' ),
	);
}

/**
 * Register the museum's styles and scripts. They are enqueued only on pages that show the museum.
 */
function librarium_museum_register_assets() {
	$version = LIBRARIUM_MUSEUM_VERSION;
	wp_register_style( 'librarium-museum-fonts', 'https://fonts.googleapis.com/css2?family=Almendra+SC&family=Amethysta&family=Montserrat:wght@400;600&display=swap', array(), null ); // phpcs:ignore WordPress.WP.EnqueuedResourceParameters.MissingVersion
	wp_register_style( 'librarium-museum', LIBRARIUM_MUSEUM_URL . 'assets/css/museum.css', array( 'librarium-museum-fonts' ), $version );

	// three.js ships inside the plugin; the CDN is only a fallback for development builds.
	$three = file_exists( LIBRARIUM_MUSEUM_DIR . 'assets/vendor/three.min.js' )
		? LIBRARIUM_MUSEUM_URL . 'assets/vendor/three.min.js'
		: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
	wp_register_script( 'librarium-museum-three', $three, array(), 'r128', true );
	wp_register_script( 'librarium-museum-rules', LIBRARIUM_MUSEUM_URL . 'assets/js/rules.js', array(), $version, true );
	wp_register_script( 'librarium-museum', LIBRARIUM_MUSEUM_URL . 'assets/js/museum.js', array( 'librarium-museum-three', 'librarium-museum-rules' ), $version, true );
}
add_action( 'wp_enqueue_scripts', 'librarium_museum_register_assets', 5 );

/**
 * Enqueue the registered assets.
 */
function librarium_museum_enqueue() {
	wp_enqueue_style( 'librarium-museum' );
	wp_enqueue_script( 'librarium-museum' );
}

/**
 * When a post's content holds the shortcode, load the stylesheet in the head instead of the footer.
 */
function librarium_museum_maybe_enqueue_early() {
	if ( ! is_singular() ) {
		return;
	}
	$post = get_post();
	if ( $post && has_shortcode( $post->post_content, 'librarium_museum' ) ) {
		librarium_museum_enqueue();
	}
}
add_action( 'wp_enqueue_scripts', 'librarium_museum_maybe_enqueue_early', 20 );

/**
 * Render the museum. Used by the shortcode and the Elementor widget.
 *
 * Attributes:
 * - height:   CSS height of the museum box, e.g. "80vh" or "720px". Default 80vh.
 * - start:    exhibit id to open on (see librarium_museum_exhibits()). Default: the entrance.
 * - shop_url: where the closing "Visit Librarium Games" link points.
 *
 * @param array|string $atts Shortcode attributes.
 * @return string
 */
function librarium_museum_render( $atts = array() ) {
	static $rendered = false;

	$atts = shortcode_atts(
		array(
			'height'   => '80vh',
			'start'    => '',
			'shop_url' => 'https://librarium.games/',
		),
		$atts,
		'librarium_museum'
	);

	// The museum's markup uses fixed ids, so only one can live on a page.
	if ( $rendered ) {
		return current_user_can( 'edit_posts' )
			? '<p class="librarium-museum-notice">' . esc_html__( 'Only one copy of the Librarium Archives can be shown per page. This copy is hidden.', 'librarium-museum' ) . '</p>'
			: '';
	}

	$template = LIBRARIUM_MUSEUM_DIR . 'templates/museum.html';
	if ( ! is_readable( $template ) ) {
		return '';
	}
	$rendered = true;
	librarium_museum_enqueue();

	$height = trim( (string) $atts['height'] );
	if ( ! preg_match( '/^\d+(\.\d+)?(px|vh|svh|dvh|em|rem|%)$/', $height ) ) {
		$height = '80vh';
	}
	$start = sanitize_key( $atts['start'] );
	if ( ! array_key_exists( $start, librarium_museum_exhibits() ) ) {
		$start = '';
	}
	$shop = esc_url( $atts['shop_url'], array( 'http', 'https' ) );

	// The template is the museum's own static markup, built from index.html with the plugin.
	$markup = file_get_contents( $template ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
	$markup = str_replace(
		'<div id="lm-app">',
		'<div id="lm-app" data-start="' . esc_attr( $start ) . '" data-shop="' . esc_attr( $shop ) . '">',
		$markup
	);

	return '<div class="lm-embed" style="--lm-height:' . esc_attr( $height ) . '">' . $markup . '</div>';
}
add_shortcode( 'librarium_museum', 'librarium_museum_render' );

/**
 * Register the Elementor widget when Elementor is active.
 *
 * @param \Elementor\Widgets_Manager $widgets_manager Elementor's widget registry.
 */
function librarium_museum_register_elementor_widget( $widgets_manager ) {
	require_once LIBRARIUM_MUSEUM_DIR . 'includes/class-librarium-museum-widget.php';
	$widgets_manager->register( new Librarium_Museum_Widget() );
}
add_action( 'elementor/widgets/register', 'librarium_museum_register_elementor_widget' );
