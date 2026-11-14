/* ------------------------------------------------------------------ host
 * The Archives fill the window on its own page, or a box when embedded in
 * another page (the WordPress plugin wraps it in .lm-embed). Settings come
 * from data attributes on #lm-app: data-start (an exhibit id to open on) and
 * data-shop (where the closing "Visit Librarium Games" link points). */
const root = $('#lm-app');
if (!root) return; // no Archives markup on this page
const embedded = !!root.closest('.lm-embed');
const hostSize = () => ({ w: root.clientWidth || window.innerWidth, h: root.clientHeight || window.innerHeight });
const narrowHost = () => (root.clientWidth || window.innerWidth) <= 720;

// Touch and zoom state (the handlers live in the input section).
const joyEl = $('#lm-joy');
const joy = { id: null, x: 0, y: 0 };
let touchUI = coarse;                       // show touch controls; turns on at the first touch too
const view = { zoom: 1, zoomTo: 1, panX: 0, panY: 0 };

