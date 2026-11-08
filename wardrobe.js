// خزانة الملابس: تبني قطع ملابس من جسم الشخصية نفسه (تتحرك مع الهيكل العظمي) وتركّب الشعر والإكسسوارات.
(function () {
  "use strict"; const T = window.THREE; const col = (h) => new T.Color(h).convertSRGBToLinear();
  const bodyOf = (root) => { let b = null; root.traverse((o) => { if (o.isSkinnedMesh && (!b || o.geometry.attributes.position.count > b.geometry.attributes.position.count)) b = o; }); return b; };
  const boneSet = (body, names) => { const s = new Set(); body.skeleton.bones.forEach((b, i) => { if (names.some((n) => b.name === n || b.name.startsWith(n))) s.add(i); }); return s; };
  function garment(root, body, names, offset, color, opt = {}) {
    const g = body.geometry, pos = g.attributes.position, nor = g.attributes.normal, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, n = pos.count, set = boneSet(body, names), ok = new Uint8Array(n);
    for (let v = 0; v < n; v++) {
      const j = [si.getX(v), si.getY(v), si.getZ(v), si.getW(v)], w = [sw.getX(v), sw.getY(v), sw.getZ(v), sw.getW(v)]; let s = 0;
      for (let k = 0; k < 4; k++) if (set.has(j[k])) s += w[k];
      const y = pos.getY(v); ok[v] = s >= (opt.thr || 0.55) && (opt.minY === undefined || y >= opt.minY) && (opt.maxY === undefined || y <= opt.maxY) ? 1 : 0;
    }
    const src = g.index.array, out = [];
    for (let i = 0; i < src.length; i += 3) if (ok[src[i]] && ok[src[i + 1]] && ok[src[i + 2]]) out.push(src[i], src[i + 1], src[i + 2]);
    if (!out.length) return null;
    const ng = new T.BufferGeometry(), np = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) { const k = opt.balloon && pos.getY(v) < 1 ? offset * (1 + 0.5 * Math.min(1, Math.max(0, 1 - pos.getY(v) / 0.9))) : offset; np[v * 3] = pos.getX(v) + nor.getX(v) * k; np[v * 3 + 1] = pos.getY(v) + nor.getY(v) * k; np[v * 3 + 2] = pos.getZ(v) + nor.getZ(v) * k; }
    ng.setAttribute("position", new T.BufferAttribute(np, 3)); ng.setAttribute("normal", nor); if (g.attributes.uv) ng.setAttribute("uv", g.attributes.uv);
    ng.setAttribute("skinIndex", si); ng.setAttribute("skinWeight", sw); ng.setIndex(out);
    const m = new T.SkinnedMesh(ng, new T.MeshStandardMaterial({ skinning: true, color: col(color), roughness: opt.rough || 0.85, metalness: 0, side: opt.double ? T.DoubleSide : T.FrontSide }));
    m.position.copy(body.position); m.quaternion.copy(body.quaternion); m.scale.copy(body.scale); body.parent.add(m); m.bind(body.skeleton, body.bindMatrix); m.frustumCulled = false; m.castShadow = true; return m;
  }
  const L = (s) => [s + "_l", s + "_r"];
  const SETS = {
    shirtShort: ["spine", "clavicle", "upperarm", "neck_01"], vest: ["spine", "clavicle"],
    pants: ["pelvis", "thigh", "calf"], shorts: ["pelvis", "thigh"], shoes: ["foot", "ball"],
  };
  function wear(root, kind, colors) {
    const body = bodyOf(root), out = [];
    const add = (names, off, col, o) => { const m = garment(root, body, names, off, col, o); if (m) out.push(m); };
    if (kind === "modern") { add(SETS.shirtShort, 0.010, colors.top || 0x2e6fd0); add(SETS.pants, 0.012, colors.bottom || 0x2a3b66); add(SETS.shoes, 0.012, colors.shoes || 0x1d1d1f, { rough: .6 }); }
    if (kind === "aladdin") { add(SETS.vest, 0.012, colors.top || 0x8a1c2b); add(SETS.pants, 0.045, colors.bottom || 0xf0e2c0, { balloon: true, double: true }); add(["foot", "ball"], 0.012, colors.shoes || 0x7a4a22); }
    return out;
  }
  function headAnchor(root, dy) { const head = root.getObjectByName("Head"); root.updateMatrixWorld(true); const w = new T.Vector3().setFromMatrixPosition(head.matrixWorld); return { head, local: head.worldToLocal(w.clone().add(new T.Vector3(0, dy, 0))) }; }
  function turban(root, color) {
    const { head, local } = headAnchor(root, 0.135), m = new T.Mesh(new T.SphereGeometry(1, 28, 18), new T.MeshStandardMaterial({ color: col(color || 0xf4efe6), roughness: .8 }));
    m.scale.set(0.125, 0.10, 0.135); m.position.copy(local); m.castShadow = true; head.add(m);
    const g = new T.Mesh(new T.SphereGeometry(0.018, 12, 8), new T.MeshStandardMaterial({ color: col(0xd9a21b), metalness: .6, roughness: .35 })); const a = headAnchor(root, 0.14); g.position.copy(a.local).add(new T.Vector3(0, 0, 0)); head.add(g); return m;
  }
  function tint(mesh, hex) { mesh.traverse((o) => { if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.color.copy(col(hex)); } }); }
  async function bindParts(root, urls, loader, hairColor) {
    const body = bodyOf(root);
    for (const u of urls) { const g = await new Promise((r, e) => loader.load(u, r, undefined, e)); const parts = []; g.scene.traverse((o) => { if (o.isSkinnedMesh) parts.push(o); });
      parts.forEach((o) => { o.parent && o.parent.remove(o); if (hairColor && /hr_/.test(u)) { o.material = o.material.clone(); o.material.color.copy(col(hairColor)); } o.bind(body.skeleton, body.bindMatrix); o.frustumCulled = false; root.add(o); }); }
  }
  window.Wardrobe = { wear, turban, bindParts, tint, bodyOf };
})();
