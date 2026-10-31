/* ==========================================================================
   The hero's 3D pizza: plain WebGL2 (a few KB, no 3D library). The pizza image
   is mapped onto a solid of revolution with a raised crust and an underside;
   surface bumps come from the image, so the toppings catch the moving light.
   Resolves once the first frame is drawn. It gives up (rejects, or calls onFail
   later) when WebGL is missing, the context is lost or the device is too slow;
   the caller then simply keeps showing the flat image.
   ========================================================================== */

const VERT = `#version 300 es
in vec3 aPos; in vec3 aNor; in vec2 aUv; in float aSide;
uniform mat4 uModel, uView;
out vec2 vUv; out vec3 vNor; out float vSide; out vec3 vWorld;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vWorld = w.xyz; vUv = aUv; vNor = aNor; vSide = aSide;
  gl_Position = uView * w;
}`;

const FRAG = `#version 300 es
precision mediump float;
in vec2 vUv; in vec3 vNor; in float vSide; in vec3 vWorld;
uniform sampler2D uTex; uniform mat3 uRot; uniform vec3 uEye;
out vec4 color;
float lum(vec2 uv) { vec3 c = texture(uTex, uv).rgb; return dot(c, vec3(.3, .59, .11)); }
void main() {
  vec4 t = texture(uTex, vUv);
  vec3 crust = vec3(.76, .5, .23);
  vec3 alb = mix(crust, t.rgb, smoothstep(.35, .9, t.a));
  vec3 n = normalize(vNor);
  // Bumps from the image on the top surface only.
  float top = (1.0 - vSide) * smoothstep(.2, .7, n.y);
  if (top > 0.0) {
    float e = 1.0 / 512.0, h = lum(vUv);
    vec3 b = normalize(vec3(-(lum(vUv + vec2(e, 0)) - h) * 5.0, 1.0, -(lum(vUv + vec2(0, e)) - h) * 5.0));
    n = normalize(mix(n, b, top));
  }
  // The side and underside are baked dough, darker further down.
  alb *= mix(1.0, .62, vSide);
  n = normalize(uRot * n);
  vec3 L = normalize(vec3(-.45, .75, .62));
  vec3 V = normalize(uEye - vWorld);
  float d = max(dot(n, L), 0.0);
  float fill = max(dot(n, normalize(vec3(.6, .1, .7))), 0.0);
  float spec = pow(max(dot(n, normalize(L + V)), 0.0), 34.0) * (1.0 - vSide);
  vec3 c = alb * (vec3(.38, .36, .34) + vec3(.60, .58, .54) * d + vec3(.12, .09, .06) * fill) + vec3(1, .93, .8) * spec * .16;
  color = vec4(c, 1.0);
}`;

/* ---------- Geometry: a profile (radius, height) spun around the axis ---------- */
// The top surface, centre to rim, then round the edge and back under.
const PROFILE = [[0, 0], [.4, .002], [.72, .002], [.78, .006], [.82, .022], [.86, .056], [.9, .082], [.935, .088], [.968, .07], [.99, .036], [1, 0],
  [.992, -.034], [.965, -.058], [.92, -.066], [.5, -.066], [0, -.066]];
const RINGS = 1 + 6 * (PROFILE.length - 1), SEGMENTS = 96;
const TEX_EDGE = .945; // the crust's outer edge in the image, as a share of its half-width

function profileAt(t) { // Catmull-Rom through PROFILE, t in 0..1
  const n = PROFILE.length - 1, x = Math.min(t * n, n - 1e-6), i = Math.floor(x), u = x - i;
  const p = (k) => PROFILE[Math.max(0, Math.min(n, k))];
  return [0, 1].map((a) => {
    const p0 = p(i - 1)[a], p1 = p(i)[a], p2 = p(i + 1)[a], p3 = p(i + 2)[a];
    return .5 * (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (3 * p1 - p0 - 3 * p2 + p3) * u * u * u);
  });
}

function buildMesh() {
  const v = [], idx = [], rimIndex = PROFILE.findIndex((p) => p[0] === 1) / (PROFILE.length - 1);
  for (let i = 0; i <= RINGS; i++) {
    const t = i / RINGS, [r, y] = profileAt(t);
    const [ra, ya] = profileAt(Math.max(0, t - .004)), [rb, yb] = profileAt(Math.min(1, t + .004));
    // Normal of the profile curve, pointing outward/up.
    let nr = ya - yb, ny = rb - ra;
    const len = Math.hypot(nr, ny) || 1; nr /= len; ny /= len;
    const side = t > rimIndex ? 1 : 0;
    for (let j = 0; j <= SEGMENTS; j++) {
      const a = j / SEGMENTS * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      // The underside repeats the crust's colours rather than the toppings.
      const texR = (side ? Math.max(r, .9) * .96 : r) * TEX_EDGE;
      v.push(r * c, y, r * s, nr * c, ny, nr * s, .5 + c * texR * .5, .5 + s * texR * .5, side);
    }
  }
  const row = SEGMENTS + 1;
  for (let i = 0; i < RINGS; i++) for (let j = 0; j < SEGMENTS; j++) {
    const a = i * row + j, b = a + row;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  return { verts: new Float32Array(v), indices: new Uint16Array(idx) };
}

/* ---------- Small matrix helpers (column-major) ---------- */
const mul = (a, b) => {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[r + 4] * b[c * 4 + 1] + a[r + 8] * b[c * 4 + 2] + a[r + 12] * b[c * 4 + 3];
  return o;
};
const rotX = (t) => { const c = Math.cos(t), s = Math.sin(t); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; };
const rotY = (t) => { const c = Math.cos(t), s = Math.sin(t); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; };
const rotZ = (t) => { const c = Math.cos(t), s = Math.sin(t); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; };
function perspective(fov, far, near) {
  const f = 1 / Math.tan(fov / 2);
  return [f, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0];
}
const EYE = 5;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

/**
 * canvas:   where to draw; imgUrl: the pizza image (same origin)
 * pointer(): current pointer position, each axis -0.5..0.5
 * onFail(): called if the 3D view has to stop after it started
 * Returns a promise of a stop() function.
 */
export function startPizza3D(canvas, imgUrl, pointer, onFail) {
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'low-power' });
  if (!gl) return Promise.reject(new Error('no WebGL2'));

  const img = new Image();
  img.src = imgUrl;
  return img.decode().then(() => new Promise((resolve, reject) => {
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);

    const mesh = buildMesh();
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, mesh.verts, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    const attr = (name, size, offset) => {
      const at = gl.getAttribLocation(prog, name);
      gl.enableVertexAttribArray(at);
      gl.vertexAttribPointer(at, size, gl.FLOAT, false, 36, offset);
    };
    attr('aPos', 3, 0); attr('aNor', 3, 12); attr('aUv', 2, 24); attr('aSide', 1, 32);

    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0);

    const U = (n) => gl.getUniformLocation(prog, n);
    const uModel = U('uModel'), uView = U('uView'), uRot = U('uRot');
    gl.uniform3f(U('uEye'), 0, 0, EYE);
    const proj = perspective(.46, 12, 1), view = mul(proj, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -EYE, 1]);
    gl.uniformMatrix4fv(uView, false, view);

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2), w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
    };

    let raf = 0, visible = true, stopped = false, started = false, last = 0, slow = 0, frames = 0;
    let spin = 0, tiltX = 0, tiltZ = 0;
    const t0 = performance.now();

    function stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      if (io) io.disconnect();
      canvas.removeEventListener('webglcontextlost', lost);
    }
    function give_up() { stop(); if (started) onFail(); else reject(new Error('too slow')); }
    function lost(e) { e.preventDefault(); give_up(); }
    canvas.addEventListener('webglcontextlost', lost);

    function frame(now) {
      if (stopped) return;
      raf = visible ? requestAnimationFrame(frame) : 0;
      const dt = Math.min(now - (last || now), 100); last = now;
      // A device that can't keep up keeps the flat image instead.
      if (document.visibilityState === 'visible' && frames > 5 && dt > 70 && ++slow > 40) return give_up();
      frames++;
      const t = (now - t0) / 1000, p = pointer();
      spin += dt * .00028;
      // Ease towards the pointer, with a slow sway on top.
      tiltX += ((1.02 + Math.sin(t * .7) * .055 - p.y * .28) - tiltX) * .06;
      tiltZ += ((Math.cos(t * .5) * .05 - p.x * .3) - tiltZ) * .06;
      const model = mul(mul(rotZ(tiltZ), rotX(tiltX)), rotY(spin));
      size();
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(uModel, false, model);
      gl.uniformMatrix3fv(uRot, false, [model[0], model[1], model[2], model[4], model[5], model[6], model[8], model[9], model[10]]);
      gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
      if (!started) { started = true; resolve(stop); }
    }
    // Rest while off screen.
    const io = 'IntersectionObserver' in window ? new IntersectionObserver((en) => {
      visible = en[0].isIntersecting;
      if (visible && !raf && !stopped) { last = 0; raf = requestAnimationFrame(frame); }
    }) : null;
    if (io) io.observe(canvas);
    tiltX = 1.02;
    raf = requestAnimationFrame(frame);
  }));
}
