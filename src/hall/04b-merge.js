/* ------------------------------------------------------------- merging
 * Draw calls are the hall's main cost: every visible mesh is one, and the hall had well over a thousand in
 * view at the entrance. Static meshes that share a look are merged into one mesh per look (the threejs-
 * performance skill's "merge static geometry, per cluster"): each exhibit separately, so frustum culling
 * still works exhibit by exhibit, and the hall's own shelves and sconces in short stretches of the hall.
 *
 * Only what nothing can reach again is merged. Inside an exhibit that means every mesh except those the
 * build keeps a handle on in group.userData (pits, pegs, the board and so on, with all they contain), cards
 * (which carry a face the Pack switch repaints) and anything with userData of its own, transparent meshes,
 * meshes with an array of materials, and meshes with a custom onBeforeRender. The display set (hidden while a game is
 * played) is merged separately, and the display list is replaced by the merged meshes. A merged mesh gets a
 * copy of the material, so a piece that shares the original and glows when selectable never lights it up.
 * ?nomerge in the address turns all this off, to compare. */
const MERGE_OFF = /[?&]nomerge\b/.test(location.search);
const mergeStats = { meshes: 0, merged: 0 };
const ownRender = THREE.Object3D.prototype.onBeforeRender;

// The look of a material, as a key: meshes with the same key can share one merged mesh.
function matKey(m) {
  const c = x => (x ? x.getHexString() : '');
  return [m.type, c(m.color), c(m.emissive), m.roughness, m.metalness, m.opacity, m.side, m.vertexColors, m.flatShading, m.emissiveIntensity,
    m.map && m.map.uuid, m.normalMap && m.normalMap.uuid, m.roughnessMap && m.roughnessMap.uuid, m.emissiveMap && m.emissiveMap.uuid, m.alphaMap && m.alphaMap.uuid,
    m.depthWrite, m.depthTest, m.blending, m.fog, m.wireframe, m.alphaTest, m.polygonOffset].join('|');
}
const mergedMats = new Map();
function mergedMat(m) { const k = matKey(m); if (!mergedMats.has(k)) mergedMats.set(k, m.clone()); return mergedMats.get(k); }

// One geometry from many, each placed by its matrix (relative to where the merged mesh will sit).
function bakeGeometries(parts) {
  const names = Object.keys(parts[0].geo.attributes);
  let nv = 0, ni = 0;
  for (const p of parts) { const n = p.geo.attributes.position.count; nv += n; ni += p.geo.index ? p.geo.index.count : n; }
  const out = new THREE.BufferGeometry(), arrays = {};
  for (const a of names) arrays[a] = new Float32Array(nv * parts[0].geo.attributes[a].itemSize);
  const index = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const nm = new THREE.Matrix3();
  let vo = 0, io = 0;
  // Plain arithmetic on the arrays: this runs over every vertex of the hall while it loads.
  for (const p of parts) {
    const g = p.geo, n = g.attributes.position.count, flip = p.matrix.determinant() < 0, e = p.matrix.elements;
    const q = nm.getNormalMatrix(p.matrix).elements;
    for (const a of names) {
      const s = g.attributes[a].array, size = g.attributes[a].itemSize, dst = arrays[a];
      if (a === 'position') for (let i = 0, j = vo * 3; i < n * 3; i += 3, j += 3) {
        const x = s[i], y = s[i + 1], z = s[i + 2];
        dst[j] = e[0] * x + e[4] * y + e[8] * z + e[12]; dst[j + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; dst[j + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      } else if (a === 'normal') for (let i = 0, j = vo * 3; i < n * 3; i += 3, j += 3) {
        const x = s[i], y = s[i + 1], z = s[i + 2];
        const nx = q[0] * x + q[3] * y + q[6] * z, ny = q[1] * x + q[4] * y + q[7] * z, nz = q[2] * x + q[5] * y + q[8] * z, l = Math.hypot(nx, ny, nz) || 1;
        dst[j] = nx / l; dst[j + 1] = ny / l; dst[j + 2] = nz / l;
      } else dst.set(s.subarray(0, n * size), vo * size);
    }
    const ix = g.index && g.index.array, tri = ix ? ix.length : n;
    for (let i = 0; i < tri; i += 3) {
      // A mirrored placement turns the triangles inside out; swap two corners to put them right.
      const a = ix ? ix[i] : i, b = ix ? ix[i + 1] : i + 1, c = ix ? ix[i + 2] : i + 2;
      index[io + i] = vo + a; index[io + i + 1] = vo + (flip ? c : b); index[io + i + 2] = vo + (flip ? b : c);
    }
    vo += n; io += tri;
  }
  for (const a of names) out.setAttribute(a, new THREE.BufferAttribute(arrays[a], parts[0].geo.attributes[a].itemSize));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
}

// Everything reachable from a value (an object, array or Map), for the meshes a build keeps a handle on.
function reachable(value, into, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return into;
  seen.add(value);
  if (value.isObject3D) { value.traverse(o => into.add(o)); return into; }
  if (value instanceof Map) value.forEach(x => reachable(x, into, seen));
  else if (Array.isArray(value)) value.forEach(x => reachable(x, into, seen));
  else if (Object.getPrototypeOf(value) === Object.prototype) Object.values(value).forEach(x => reachable(x, into, seen));
  return into;
}

/* Merge the static meshes under root. opts.protect: objects (with all they contain) to leave alone;
 * opts.display: a display list to merge separately and rewrite; opts.only(obj): for the hall, which of
 * root's children to look inside; opts.cell(worldPos): a key that splits merging into stretches. */
function mergeStatic(root, opts = {}) {
  if (MERGE_OFF) return opts.display;
  root.updateMatrixWorld(true);
  const keep = new Set(); (opts.protect || []).forEach(o => reachable(o, keep));
  const shown = new Set(); (opts.display || []).forEach(o => o && o.isObject3D && o.traverse(x => shown.add(x)));
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), buckets = new Map(), wp = new THREE.Vector3();
  const visit = (o, top) => {
    if (keep.has(o) || !o.visible) return;
    for (const c of o.children.slice()) visit(c, top);
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || !o.material.visible || o.material.transparent) return;
    if (Object.keys(o.userData).length || o.onBeforeRender !== ownRender || o.renderOrder || o.morphTargetInfluences) return;
    const g = o.geometry; if (!g || !g.isBufferGeometry || !g.attributes.position) return; // groups are ignored with a single material, as here
    if (Object.values(g.attributes).some(a => a.isInterleavedBufferAttribute || a.normalized)) return;
    mergeStats.meshes++;
    const cell = opts.cell ? opts.cell(o.getWorldPosition(wp)) : '';
    const key = [shown.has(o) ? 'D' : 'S', cell, matKey(o.material), Object.keys(g.attributes).sort().join(','), o.castShadow, o.receiveShadow, o.frustumCulled].join('#');
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(o);
  };
  for (const c of root.children.slice()) if (!opts.only || opts.only(c)) visit(c);
  const newDisplay = (opts.display || []).slice();
  for (const [key, ms] of buckets) {
    if (ms.length < 2) continue;
    // Attribute order and item sizes must agree to share buffers.
    const sig = m => Object.keys(m.geometry.attributes).sort().map(a => a + m.geometry.attributes[a].itemSize).join(',');
    const s0 = sig(ms[0]), same = ms.filter(m => sig(m) === s0); if (same.length < 2) continue;
    const parts = same.map(m => ({ geo: m.geometry, matrix: new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld) }));
    const merged = new THREE.Mesh(bakeGeometries(parts), mergedMat(same[0].material));
    merged.castShadow = same[0].castShadow; merged.receiveShadow = same[0].receiveShadow; merged.frustumCulled = same[0].frustumCulled;
    merged.matrixAutoUpdate = false; merged.updateMatrix();
    root.add(merged); merged.updateMatrixWorld(true);
    same.forEach(m => m.parent.remove(m));
    mergeStats.merged += same.length - 1;
    if (key[0] === 'D') {
      for (let i = newDisplay.length - 1; i >= 0; i--) if (same.includes(newDisplay[i])) newDisplay.splice(i, 1);
      newDisplay.push(merged);
    }
  }
  return newDisplay;
}

// An exhibit, once built: protect what its build keeps handles on, merge the rest.
function mergeExhibit(s) {
  const ud = s.group.userData, protect = [];
  for (const [k, v] of Object.entries(ud)) if (k !== 'display') protect.push(v);
  const display = mergeStatic(s.group, { protect, display: ud.display });
  if (ud.display) ud.display = display;
}
