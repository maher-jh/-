// طبقة المعاينة السينمائية (Three.js r128). تُضاف بجانب المحرك القديم ولا تستبدله.
// المحتوى: شاطئ وقت الغروب (سماء، محيط بموج وزبد، رمل، صخور)، شخصية بهيكل عظمي وحركة مشي، كاميرا متتبِّعة.
(function () {
  "use strict";
  const T = window.THREE;
  const available = () => !!(window.THREE && THREE.GLTFLoader);

  const NOISE_GLSL = `
    float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
    float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
      return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
    float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*vn(p); p*=2.03; a*=.5; } return s; }`;

  function makeSky(sunDir) {
    const mat = new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, fog: false,
      uniforms: { sunDir: { value: sunDir.clone() }, time: { value: 0 } },
      vertexShader: "varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
      fragmentShader: NOISE_GLSL + `
        varying vec3 vD; uniform vec3 sunDir; uniform float time;
        void main(){
          vec3 d = normalize(vD); float h = clamp(d.y, -0.2, 1.);
          vec3 zen = vec3(.10,.16,.38), mid = vec3(.80,.38,.30), hor = vec3(1.,.70,.42);
          vec3 col = mix(hor, mid, smoothstep(0., .22, h)); col = mix(col, zen, smoothstep(.18, .9, h));
          float sd = max(dot(d, sunDir), 0.);
          col += vec3(1.,.55,.22) * pow(sd, 6.) * .55 + vec3(1.,.8,.5) * pow(sd, 90.) * 1.2;
          col += vec3(1.,.95,.8) * smoothstep(.9992, .9998, sd) * 4.;
          if (d.y > 0.) {
            vec2 uv = d.xz / (d.y + .25) * 1.6 + vec2(time*.004, 0.);
            float c = fbm(uv * vec2(1.2, 3.2)); c = smoothstep(.45, .85, c);
            vec3 cc = mix(vec3(.95,.45,.32), vec3(1.,.78,.55), pow(sd, 2.)) * (.7 + .5*pow(sd, 3.));
            col = mix(col, cc, c * smoothstep(0., .25, d.y) * (1. - smoothstep(.55, .95, d.y)) * .85);
          }
          if (d.y < 0.) col = mix(col, vec3(.35,.2,.18), smoothstep(0., -.2, d.y));
          gl_FragColor = vec4(col, 1.);
        }`,
    });
    const m = new T.Mesh(new T.SphereGeometry(500, 32, 24), mat); m.frustumCulled = false; return m;
  }

  function makeOcean(sunDir) {
    const g = new T.PlaneGeometry(600, 330, 220, 120); g.rotateX(-Math.PI / 2); g.translate(0, 0, -165 + 4);
    const mat = new T.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { time: { value: 0 }, sunDir: { value: sunDir.clone() } },
      vertexShader: NOISE_GLSL + `
        uniform float time; varying vec3 vW; varying vec3 vN; varying float vSL;
        void main(){
          vec3 p = position; float d = max(0., -p.z);
          float amp = clamp(d * .08, .06, 1.) * (.5 + .5*smoothstep(0., 30., d)) ;
          float a1 = sin(p.x*.20 + p.z*.35 - time*1.2), a2 = sin(p.x*.07 - p.z*.15 - time*.8), a3 = sin(p.x*.5 + p.z*.8 - time*2.1);
          p.y = (a1*.22 + a2*.30 + a3*.05) * amp;
          float dx = (cos(p.x*.20+p.z*.35-time*1.2)*.20*.22 + cos(p.x*.07-p.z*.15-time*.8)*.07*.30 + cos(p.x*.5+p.z*.8-time*2.1)*.5*.05) * amp;
          float dz = (cos(p.x*.20+p.z*.35-time*1.2)*.35*.22 - cos(p.x*.07-p.z*.15-time*.8)*.15*.30 + cos(p.x*.5+p.z*.8-time*2.1)*.8*.05) * amp;
          vN = normalize(vec3(-dx, 1., -dz));
          vSL = .9 + .55*sin(time*.7 + position.x*.25) + .25*sin(time*1.3 + position.x*.7);
          vec4 w = modelMatrix * vec4(p, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: NOISE_GLSL + `
        uniform float time; uniform vec3 sunDir; varying vec3 vW; varying vec3 vN; varying float vSL;
        void main(){
          vec3 V = normalize(cameraPosition - vW); vec3 n = normalize(vN);
          n = normalize(n + .10*vec3(vn(vW.xz*1.7+time*.3)-.5, 0., vn(vW.xz*1.7-time*.25+9.)-.5));
          float fr = pow(1. - max(dot(n, V), 0.), 4.); fr = clamp(.04 + .96*fr, 0., 1.);
          vec3 R = reflect(-V, n);
          vec3 hor = vec3(1.,.66,.42), mid = vec3(.62,.34,.34), zen = vec3(.14,.2,.42);
          float rh = clamp(R.y, 0., 1.);
          vec3 sky = mix(hor, mid, smoothstep(0., .2, rh)); sky = mix(sky, zen, smoothstep(.2, .8, rh));
          float sd = max(dot(R, sunDir), 0.);
          sky += vec3(1.,.6,.3) * pow(sd, 8.) * .5 + vec3(1.,.85,.6) * pow(sd, 400.) * 6.;
          float depth = clamp((vSL*-1. + (-vW.z + 4.)) * .12, 0., 1.);
          vec3 deep = vec3(.03,.16,.22), shallow = vec3(.18,.45,.42);
          vec3 body = mix(shallow, deep, smoothstep(0., .6, depth));
          vec3 col = mix(body, sky, fr);
          float sh = (vW.z + 4.) - (4. - vSL);          // المسافة عن خط الشاطئ المتحرك (سالب = داخل الماء)
          float edge = -(vW.z - (4. - vSL));
          float foam = smoothstep(.55, .0, abs(edge - .15)) * (.55 + .45*fbm(vW.xz*3. + time*.4));
          foam += smoothstep(.9, 1., vn(vW.xz*.9 + vec2(0., -time*.5)) * (1. - smoothstep(0., 14., -vW.z + 2.))) * .35;
          col = mix(col, vec3(1.,.93,.84), clamp(foam, 0., 1.) * .9);
          float alpha = smoothstep(-.05, .6, edge) ;
          alpha = max(alpha, foam * .85);
          float dist = length(cameraPosition - vW);
          col = mix(col, vec3(1.,.72,.48), 1. - exp(-dist * .006));
          gl_FragColor = vec4(col, clamp(alpha, 0., 1.));
        }`,
    });
    const m = new T.Mesh(g, mat); m.renderOrder = 2; return m;
  }

  function grainTexture() {
    const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d");
    const id = x.createImageData(256, 256);
    for (let i = 0; i < id.data.length; i += 4) { const v = 200 + Math.random() * 55 | 0; id.data[i] = v; id.data[i + 1] = v - 8; id.data[i + 2] = v - 22; id.data[i + 3] = 255; }
    x.putImageData(id, 0, 0);
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(60, 60); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t;
  }

  function makeSand() {
    const g = new T.PlaneGeometry(220, 120, 160, 90); g.rotateX(-Math.PI / 2); g.translate(0, 0, 55);
    const p = g.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      let y = Math.min(0, (z - 4) * 0.07);                                  // ينحدر تحت الماء
      y += Math.sin(x * .13 + z * .05) * .12 + Math.sin(x * .41 - z * .23) * .035 + Math.sin(z * .9 + x * .2) * .012;   // كثبان وتموجات
      p.setY(i, y);
      const wet = 1 - Math.min(1, Math.max(0, (z - 1.5) / 6));              // رمل مبلل قرب الماء
      const k = 1 - wet * .5;
      col[i * 3] = .88 * k; col[i * 3 + 1] = .74 * k; col[i * 3 + 2] = .56 * k;
    }
    g.setAttribute("color", new T.BufferAttribute(col, 3)); g.computeVertexNormals();
    const m = new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: true, map: grainTexture(), roughness: .96, metalness: 0 }));
    m.receiveShadow = true; return m;
  }

  function makeRocks(rand) {
    const grp = new T.Group();
    const mat = new T.MeshStandardMaterial({ color: 0x5b4f48, roughness: .82, metalness: .02, flatShading: false });
    const place = [[9, 1, 1.6], [11.5, 3, 1.1], [13, -1, 2.6], [15.5, 2, 1.8], [18, 0, 3.4], [-10, 2.5, 1.2], [-12.5, 0.5, 1.9], [-15, 3, 1.0], [-17.5, -1, 2.8], [20, 6, 1.3], [7.5, 5, .7], [-8, 6, .8], [24, -4, 4.5]];
    for (const [x, z, s] of place) {
      const gm = new T.IcosahedronGeometry(1, 4), p = gm.attributes.position, seed = rand() * 100;
      for (let i = 0; i < p.count; i++) {
        const v = new T.Vector3().fromBufferAttribute(p, i).normalize();
        const n = Math.sin(v.x * 3.1 + seed) * Math.cos(v.y * 2.7 + seed) * .22 + Math.sin(v.z * 6.3 + v.x * 4 + seed) * .08 + Math.sin(v.x * 13 + v.y * 11 + v.z * 9 + seed) * .025;
        v.multiplyScalar(1 + n); p.setXYZ(i, v.x, v.y, v.z);
      }
      gm.computeVertexNormals();
      const m = new T.Mesh(gm, mat); m.scale.set(s * (1 + rand() * .5), s * (.55 + rand() * .35), s * (.9 + rand() * .4));
      m.position.set(x, s * .25 - .1, z); m.rotation.y = rand() * 6.28; m.castShadow = m.receiveShadow = true; grp.add(m);
    }
    return grp;
  }

  function create(container, opts = {}) {
    if (!available()) throw new Error("مكتبة Three.js أو GLTFLoader غير محمَّلة");
    const W = () => container.clientWidth || 640, H = () => Math.round(W() * (opts.aspect || 9 / 16));
    const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: !!opts.preserve });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.maxDpr || 1.5));
    renderer.setSize(W(), H());
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.domElement.style.cssText = "width:100%;display:block;border-radius:16px;filter:contrast(1.07) saturate(1.12)";
    container.replaceChildren(renderer.domElement);
    const wrap = document.createElement("div"); wrap.style.cssText = "position:relative"; container.replaceChildren(wrap); wrap.appendChild(renderer.domElement);
    const vig = document.createElement("div"); vig.style.cssText = "position:absolute;inset:0;border-radius:16px;pointer-events:none;background:radial-gradient(ellipse at center,transparent 55%,rgba(10,5,20,.55) 100%)"; wrap.appendChild(vig);
    const bars = document.createElement("div"); bars.style.cssText = "position:absolute;inset:0;pointer-events:none;border-top:6% solid #000;box-shadow:inset 0 22px 0 -0px rgba(0,0,0,.0)"; 
    let seed = 7; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    const scene = new T.Scene(), sunDir = new T.Vector3(-.55, .16, -1).normalize();
    scene.fog = new T.FogExp2(0xf0a878, .0055);
    const sky = makeSky(sunDir); scene.add(sky);
    // بيئة انعكاسات من السماء (PBR)
    try { const pm = new T.PMREMGenerator(renderer), es = new T.Scene(); es.add(makeSky(sunDir)); scene.environment = pm.fromScene(es, 0.02).texture; pm.dispose(); } catch (e) { /* بدون بيئة */ }
    const sand = makeSand(); scene.add(sand);
    const ocean = makeOcean(sunDir); scene.add(ocean);
    scene.add(makeRocks(rand));
    const sun = new T.DirectionalLight(0xffa85c, 3.0); sun.castShadow = true;
    sun.shadow.mapSize.set(opts.shadow || 2048, opts.shadow || 2048); const sc = sun.shadow.camera; sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 80; sun.shadow.bias = -0.0004; sun.shadow.normalBias = .03;
    scene.add(sun, sun.target);
    scene.add(new T.HemisphereLight(0xffc7a0, 0x5a463c, .55));
    const fill = new T.DirectionalLight(0x7a96ff, .35); fill.position.set(6, 5, 12); scene.add(fill);

    const cam = new T.PerspectiveCamera(32, W() / H(), .1, 900); cam.position.set(0, 1.4, 14);
    let mixer = null, model = null, walk = null, run = null, idle = null, state = { loaded: false, error: null };
    const clock = new T.Clock(); let t = 0, raf = 0, disposed = false;
    new T.GLTFLoader().load(opts.model || "Soldier.glb", (gltf) => {
      model = gltf.scene; model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) o.material.envMapIntensity = 1.2; } });
      model.scale.setScalar(1); scene.add(model);
      mixer = new T.AnimationMixer(model);
      const by = (n) => gltf.animations.find((a) => a.name === n);
      walk = mixer.clipAction(by("Walk")); idle = mixer.clipAction(by("Idle")); run = mixer.clipAction(by("Run"));
      walk.play(); state.loaded = true;
    }, undefined, (e) => { state.error = "تعذّر تحميل الموديل Soldier.glb (تأكد من رفعه جنب index.html)"; });

    const C = { x: 0, z: 4.2, r: 3.4 }, SPEED = 1.25;
    function frame(dt) {
      t += dt; sky.material.uniforms.time.value = t; ocean.material.uniforms.time.value = t;
      let px = 0, pz = 0;
      if (model) {
        const th = (SPEED * t) / C.r; px = C.x + C.r * Math.sin(th); pz = C.z - C.r * .55 * Math.cos(th);
        const vx = Math.cos(th) * C.r, vz = Math.sin(th) * C.r * .55;
        model.position.set(px, Math.min(0, (pz - 4) * .07) + .0, pz); model.rotation.y = Math.atan2(vx, vz);
        if (walk) walk.timeScale = SPEED / 1.25;
        mixer.update(dt);
        sun.target.position.set(px, 0, pz); sun.position.copy(sun.target.position).addScaledVector(sunDir, 40); sun.target.updateMatrixWorld();
      }
      // كاميرا سينمائية: لقطة تتبّع واسعة ثم اقتراب بطيء
      const k = (Math.sin(t * .09) + 1) / 2, dist = 15 - k * 6;
      cam.position.set(px * .35 + Math.sin(t * .07) * 4.5, 1.15 + k * .55, pz + dist);
      cam.fov = 34 - k * 8; cam.updateProjectionMatrix();
      cam.lookAt(px * .8, .95 + k * .35, pz - 1.2);
      renderer.render(scene, cam);
    }
    function loop() { if (disposed) return; raf = requestAnimationFrame(loop); frame(Math.min(.05, clock.getDelta())); }
    loop();
    const onResize = () => { renderer.setSize(W(), H()); cam.aspect = W() / H(); cam.updateProjectionMatrix(); };
    window.addEventListener("resize", onResize);
    return {
      state, renderer, scene, cam,
      advance(sec) { const steps = Math.ceil(sec / .033); for (let i = 0; i < steps; i++) frame(.033); },
      dispose() { disposed = true; cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); renderer.dispose(); },
    };
  }
  window.Stage3D = { available, create };
})();
