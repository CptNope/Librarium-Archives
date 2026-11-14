/* ------------------------------------------------------------------ renderer */
const canvas = $('#lm-scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.4 : 1.75));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0807);
scene.fog = new THREE.FogExp2(0x0a0807, 0.042);
const camera = new THREE.PerspectiveCamera(58, 1, 0.03, 90);
camera.rotation.order = 'YXZ';

function resize() {
  const { w, h } = hostSize();
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = camera.aspect < 0.8 ? 72 : 58;
  camera.updateProjectionMatrix();
  if (mode === 'play' && play.ex) flyToPlay(play.ex, 0.4);
  updateJoy();
}

