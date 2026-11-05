<?php
/**
 * Elementor widget: Museum of Play.
 *
 * @package LibrariumMuseum
 */

defined( 'ABSPATH' ) || exit;

use Elementor\Controls_Manager;
use Elementor\Widget_Base;

/**
 * Places the museum on an Elementor page, with the same settings as the shortcode.
 */
class Librarium_Museum_Widget extends Widget_Base {

	/** @return string */
	public function get_name() {
		return 'librarium_museum';
	}

	/** @return string */
	public function get_title() {
		return esc_html__( 'Museum of Play', 'librarium-museum' );
	}

	/** @return string */
	public function get_icon() {
		return 'eicon-gallery-grid';
	}

	/** @return string[] */
	public function get_categories() {
		return array( 'general' );
	}

	/** @return string[] */
	public function get_keywords() {
		return array( 'museum', 'game', 'board game', '3d', 'librarium' );
	}

	/** @return string[] */
	public function get_style_depends() {
		return array( 'librarium-museum' );
	}

	/** @return string[] */
	public function get_script_depends() {
		return array( 'librarium-museum' );
	}

	/**
	 * Widget settings: height, the exhibit to open on, and the shop link.
	 */
	protected function register_controls() {
		$this->start_controls_section(
			'museum',
			array(
				'label' => esc_html__( 'Museum', 'librarium-museum' ),
				'tab'   => Controls_Manager::TAB_CONTENT,
			)
		);

		$this->add_control(
			'height',
			array(
				'label'      => esc_html__( 'Height', 'librarium-museum' ),
				'type'       => Controls_Manager::SLIDER,
				'size_units' => array( 'vh', 'px' ),
				'range'      => array(
					'vh' => array( 'min' => 40, 'max' => 100 ),
					'px' => array( 'min' => 440, 'max' => 1400, 'step' => 10 ),
				),
				'default'    => array( 'unit' => 'vh', 'size' => 80 ),
			)
		);

		$this->add_control(
			'start',
			array(
				'label'   => esc_html__( 'Open at', 'librarium-museum' ),
				'type'    => Controls_Manager::SELECT,
				'options' => librarium_museum_exhibits(),
				'default' => '',
			)
		);

		$this->add_control(
			'shop_url',
			array(
				'label'       => esc_html__( 'Shop link', 'librarium-museum' ),
				'description' => esc_html__( 'Where the "Visit Librarium Games" button at the end of the hall points.', 'librarium-museum' ),
				'type'        => Controls_Manager::URL,
				'default'     => array( 'url' => 'https://librarium.games/' ),
			)
		);

		$this->end_controls_section();
	}

	/**
	 * In the editor, show a placeholder: the 3D hall only runs on the live page, so editing stays fast.
	 */
	protected function render() {
		$settings = $this->get_settings_for_display();
		$height   = isset( $settings['height']['size'], $settings['height']['unit'] ) && '' !== $settings['height']['size']
			? $settings['height']['size'] . $settings['height']['unit']
			: '80vh';
		$shop     = isset( $settings['shop_url']['url'] ) ? $settings['shop_url']['url'] : '';
		$start    = isset( $settings['start'] ) ? $settings['start'] : '';

		if ( \Elementor\Plugin::$instance->editor->is_edit_mode() ) {
			$exhibits = librarium_museum_exhibits();
			$label    = isset( $exhibits[ $start ] ) ? $exhibits[ $start ] : $exhibits[''];
			printf(
				'<div style="height:%1$s;min-height:240px;display:grid;place-items:center;background:#0b0907;color:#f6a01a;font-family:Georgia,serif;text-align:center;padding:24px;border:1px solid rgba(246,160,26,.32)"><div><strong style="font-size:22px">%2$s</strong><br><span style="color:#a8977a;font-size:14px">%3$s</span></div></div>',
				esc_attr( $height ),
				esc_html__( 'Librarium Museum of Play', 'librarium-museum' ),
				/* translators: %s: exhibit name */
				esc_html( sprintf( __( 'The 3D hall appears on the live page. Opens at: %s', 'librarium-museum' ), $label ) )
			);
			return;
		}

		echo librarium_museum_render( // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped inside.
			array(
				'height'   => $height,
				'start'    => $start,
				'shop_url' => $shop,
			)
		);
	}
}
