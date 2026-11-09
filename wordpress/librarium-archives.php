<?php
/**
 * Plugin Name:       Librarium Archives
 * Plugin URI:        https://github.com/CptNope/Librarium-Archives
 * Description:       A walkable 3D archive of the oldest board and card games, with tables visitors can play against the Scribe. Add it with the [librarium_archives] shortcode or the "Librarium Archives" Elementor widget.
 * Version:           0.5.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Jeremy Anderson Tech
 * Author URI:        https://jeremyanderson.tech
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       librarium-archives
 *
 * @package LibrariumArchives
 */

defined( 'ABSPATH' ) || exit;

define( 'LIBRARIUM_ARCHIVES_VERSION', '0.5.0' );
define( 'LIBRARIUM_ARCHIVES_DIR', plugin_dir_path( __FILE__ ) );
define( 'LIBRARIUM_ARCHIVES_URL', plugin_dir_url( __FILE__ ) );

/**
 * Exhibits the Archives can open on, keyed by the id the script uses.
 *
 * @return array<string,string>
 */
function librarium_archives_exhibits() {
	return array(
		''           => __( 'Entrance (Wing I)', 'librarium-archives' ),
		'senet'      => 'Senet',
		'mehen'      => 'Mehen',
		'basur'      => __( 'The Başur Höyük pieces', 'librarium-archives' ),
		'ur'         => __( 'The Royal Game of Ur', 'librarium-archives' ),
		'dice'       => __( 'The first dice', 'librarium-archives' ),
		'hounds'     => __( 'Hounds and Jackals', 'librarium-archives' ),
		'wing2'      => __( 'Wing II: Strategy Takes the Table', 'librarium-archives' ),
		'petteia'    => 'Petteia',
		'liubo'      => 'Liubo',
		'go'         => __( 'Weiqi (Go)', 'librarium-archives' ),
		'latrunculi' => 'Ludus Latrunculorum',
		'patolli'    => 'Patolli',
		'morris'     => __( "Nine Men's Morris", 'librarium-archives' ),
		'oware'      => __( 'Mancala (Oware)', 'librarium-archives' ),
		'alquerque'  => 'Alquerque',
		'brandubh'   => 'Brandubh',
		'wing3'      => __( 'Wing III: Kings, Cards and Courts', 'librarium-archives' ),
		'tables'     => __( 'Tables (backgammon)', 'librarium-archives' ),
		'chaturanga' => 'Chaturanga',
		'shatranj'   => 'Shatranj',
		'xiangqi'    => __( 'Xiangqi (Chinese chess)', 'librarium-archives' ),
		'lewis'      => __( 'The Lewis Chessmen', 'librarium-archives' ),
		'cards'      => __( 'Playing cards', 'librarium-archives' ),
		'tarot'      => __( 'Tarot', 'librarium-archives' ),
		'wing4'      => __( 'Wing IV: Printed Boards and Parlour Tables', 'librarium-archives' ),
		'foxgeese'   => __( 'Fox and Geese', 'librarium-archives' ),
		'newqueen'   => __( 'The New Queen (chess)', 'librarium-archives' ),
		'draughts'   => __( 'Draughts', 'librarium-archives' ),
		'pachisi'    => __( 'Pachisi', 'librarium-archives' ),
		'goose'      => __( 'The Game of the Goose', 'librarium-archives' ),
		'snakes'     => __( 'Snakes and Ladders', 'librarium-archives' ),
		'mahjong'    => 'Mahjong',
		'wing5'      => __( 'Wing V: The Modern Board Game', 'librarium-archives' ),
		'mansion'    => __( 'The Mansion of Happiness', 'librarium-archives' ),
		'lifegame'   => __( 'The Checkered Game of Life', 'librarium-archives' ),
		'reversi'    => 'Reversi',
		'halma'      => 'Halma',
		'dotsboxes'  => __( 'Dots and Boxes', 'librarium-archives' ),
		'landlord'   => __( "The Landlord's Game", 'librarium-archives' ),
		'wing6'      => __( 'Wing VI: Games of the World', 'librarium-archives' ),
		'mutorere'   => __( 'Mū tōrere', 'librarium-archives' ),
		'shogi'      => 'Shogi',
		'konane'     => __( 'Kōnane', 'librarium-archives' ),
		'yut'        => 'Yut Nori',
		'fanorona'   => 'Fanorona',
		'bao'        => 'Bao',
		'next'       => __( 'Librarium lectern', 'librarium-archives' ),
	);
}

/**
 * Register the Archives' styles and scripts. They are enqueued only on pages that show the Archives.
 */
function librarium_archives_register_assets() {
	$version = LIBRARIUM_ARCHIVES_VERSION;
	wp_register_style( 'librarium-archives-fonts', 'https://fonts.googleapis.com/css2?family=Almendra+SC&family=Amethysta&family=Montserrat:wght@400;600&display=swap', array(), null ); // phpcs:ignore WordPress.WP.EnqueuedResourceParameters.MissingVersion
	wp_register_style( 'librarium-archives', LIBRARIUM_ARCHIVES_URL . 'assets/css/archives.css', array( 'librarium-archives-fonts' ), $version );

	// three.js ships inside the plugin; the CDN is only a fallback for development builds.
	$three = file_exists( LIBRARIUM_ARCHIVES_DIR . 'assets/vendor/three.min.js' )
		? LIBRARIUM_ARCHIVES_URL . 'assets/vendor/three.min.js'
		: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
	wp_register_script( 'librarium-archives-three', $three, array(), 'r128', true );
	wp_register_script( 'librarium-archives-rules', LIBRARIUM_ARCHIVES_URL . 'assets/js/rules.js', array(), $version, true );
	wp_register_script( 'librarium-archives', LIBRARIUM_ARCHIVES_URL . 'assets/js/archives.js', array( 'librarium-archives-three', 'librarium-archives-rules' ), $version, true );
}
add_action( 'wp_enqueue_scripts', 'librarium_archives_register_assets', 5 );

/**
 * Enqueue the registered assets.
 */
function librarium_archives_enqueue() {
	wp_enqueue_style( 'librarium-archives' );
	wp_enqueue_script( 'librarium-archives' );
}

/**
 * When a post's content holds the shortcode, load the stylesheet in the head instead of the footer.
 */
function librarium_archives_maybe_enqueue_early() {
	if ( ! is_singular() ) {
		return;
	}
	$post = get_post();
	if ( $post && has_shortcode( $post->post_content, 'librarium_archives' ) ) {
		librarium_archives_enqueue();
	}
}
add_action( 'wp_enqueue_scripts', 'librarium_archives_maybe_enqueue_early', 20 );

/**
 * Render the Archives. Used by the shortcode and the Elementor widget.
 *
 * Attributes:
 * - height:   CSS height of the Archives box, e.g. "80vh" or "720px". Default 80vh.
 * - start:    exhibit id to open on (see librarium_archives_exhibits()). Default: the entrance.
 * - shop_url: where the closing "Visit Librarium Games" link points.
 *
 * @param array|string $atts Shortcode attributes.
 * @return string
 */
function librarium_archives_render( $atts = array() ) {
	static $rendered = false;

	$atts = shortcode_atts(
		array(
			'height'   => '80vh',
			'start'    => '',
			'shop_url' => 'https://librarium.games/',
		),
		$atts,
		'librarium_archives'
	);

	// The Archives' markup uses fixed ids, so only one can live on a page.
	if ( $rendered ) {
		return current_user_can( 'edit_posts' )
			? '<p class="librarium-archives-notice">' . esc_html__( 'Only one copy of the Librarium Archives can be shown per page. This copy is hidden.', 'librarium-archives' ) . '</p>'
			: '';
	}

	$template = LIBRARIUM_ARCHIVES_DIR . 'templates/archives.html';
	if ( ! is_readable( $template ) ) {
		return '';
	}
	$rendered = true;
	librarium_archives_enqueue();

	$height = trim( (string) $atts['height'] );
	if ( ! preg_match( '/^\d+(\.\d+)?(px|vh|svh|dvh|em|rem|%)$/', $height ) ) {
		$height = '80vh';
	}
	$start = sanitize_key( $atts['start'] );
	if ( ! array_key_exists( $start, librarium_archives_exhibits() ) ) {
		$start = '';
	}
	$shop = esc_url( $atts['shop_url'], array( 'http', 'https' ) );

	// The template is the Archives' own static markup, built from index.html with the plugin.
	$markup = file_get_contents( $template ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
	$markup = str_replace(
		'<div id="lm-app">',
		'<div id="lm-app" data-start="' . esc_attr( $start ) . '" data-shop="' . esc_attr( $shop ) . '">',
		$markup
	);

	return '<div class="lm-embed" style="--lm-height:' . esc_attr( $height ) . '">' . $markup . '</div>';
}
add_shortcode( 'librarium_archives', 'librarium_archives_render' );

/**
 * Register the Elementor widget when Elementor is active.
 *
 * @param \Elementor\Widgets_Manager $widgets_manager Elementor's widget registry.
 */
function librarium_archives_register_elementor_widget( $widgets_manager ) {
	require_once LIBRARIUM_ARCHIVES_DIR . 'includes/class-librarium-archives-widget.php';
	$widgets_manager->register( new Librarium_Archives_Widget() );
}
add_action( 'elementor/widgets/register', 'librarium_archives_register_elementor_widget' );
