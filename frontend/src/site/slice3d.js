/* ==========================================================================
   The hero's 3D pizza: plain WebGL (no 3D library). A real photo with a depth
   map: parts of the picture shift by how near they are as the view moves, so
   it looks solid, and the lifted slice rises and falls, stretching the cheese.
   Resolves with a stop() once the first frame is drawn. It gives up (rejects,
   or calls onFail later) when WebGL is missing, the context is lost or the
   device is too slow; the caller then keeps showing the still image.
   ========================================================================== */
const VERT = `attribute vec2 aPos; varying vec2 vUv;
void main() { vUv = aPos * .5 + .5; gl_Position = vec4(aPos, 0., 1.); }`;

const FRAG = `precision mediump float;
varying vec2 vUv;
uniform sampler2D uImg, uMap; uniform vec2 uView; uniform float uLift;
void main() {
  // Walk towards the surface a few steps, so near parts cover what's behind them.
  vec2 uv = vUv; vec4 m;
  for (int i = 0; i < 4; i++) {
    m = texture2D(uMap, uv);
    uv = vUv + uView * (m.r - .45);
    uv.y -= uLift * m.g;
  }
  vec4 c = texture2D(uImg, uv);
  // Light slides over the surface as it moves.
  float e = .012;
  float dx = texture2D(uMap, uv + vec2(e, 0.)).r - texture2D(uMap, uv - vec2(e, 0.)).r;
  float dy = texture2D(uMap, uv + vec2(0., e)).r - texture2D(uMap, uv - vec2(0., e)).r;
  float light = 1. + dot(vec2(dx, dy), uView) * 26. + (m.r - .45) * .12;
  gl_FragColor = vec4(c.rgb * light, c.a);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
const load = (url) => { const i = new Image(); i.src = url; return i.decode().then(() => i); };

/**
 * canvas: where to draw; imgUrl, mapUrl: the photo and its depth map (same origin)
 * pointer(): pointer position, each axis -0.5..0.5; onFail(): the 3D view had to stop after starting
 */
export function startSlice3D(canvas, imgUrl, mapUrl, pointer, onFail) {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' });
  if (!gl) return Promise.reject(new Error('no WebGL'));

  return Promise.all([load(imgUrl), load(mapUrl)]).then(([img, map]) => new Promise((resolve, reject) => {
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const at = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);

    const texture = (unit, source, premultiply) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    texture(0, img, true);
    texture(1, map, false);
    const U = (n) => gl.getUniformLocation(prog, n);
    gl.uniform1i(U('uImg'), 0); gl.uniform1i(U('uMap'), 1);
    const uView = U('uView'), uLift = U('uLift');
    gl.clearColor(0, 0, 0, 0);

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2), w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
    };

    let raf = 0, visible = true, stopped = false, started = false, last = 0, slow = 0, frames = 0, vx = 0, vy = 0;
    const t0 = performance.now();
    function stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      if (io) io.disconnect();
      canvas.removeEventListener('webglcontextlost', lost);
    }
    function giveUp() { stop(); if (started) onFail(); else reject(new Error('too slow')); }
    function lost(e) { e.preventDefault(); giveUp(); }
    canvas.addEventListener('webglcontextlost', lost);

    function frame(now) {
      if (stopped) return;
      raf = visible ? requestAnimationFrame(frame) : 0;
      const dt = Math.min(now - (last || now), 200); last = now;
      // A device that can't keep up keeps the still image instead.
      if (document.visibilityState === 'visible' && frames > 5 && dt > 70 && ++slow > 40) { giveUp(); return; }
      frames++;
      const t = (now - t0) / 1000, p = pointer();
      // Ease towards the pointer, with a slow sway so it also moves on phones.
      vx += ((Math.sin(t * .55) * .014 + p.x * .05) - vx) * .07;
      vy += ((Math.cos(t * .42) * .008 - p.y * .035) - vy) * .07;
      size();
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uView, vx, vy);
      gl.uniform1f(uLift, (Math.sin(t * .9) * .5 + .5) * .035);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!started) { started = true; resolve(stop); }
    }
    // Rest while off screen.
    const io = 'IntersectionObserver' in window ? new IntersectionObserver((en) => {
      visible = en[0].isIntersecting;
      if (visible && !raf && !stopped) { last = 0; raf = requestAnimationFrame(frame); }
    }) : null;
    if (io) io.observe(canvas);
    raf = requestAnimationFrame(frame);
  }));
}
