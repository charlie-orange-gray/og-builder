// Bokeh — Code component template (WebGL fragment-shader background).
//
// Three lattices at different scales stand in for depth - big soft discs read
// as near, small tight ones as far. Each highlight is a disc with a bright RIM
// rather than a gaussian: that edge is the aperture, and it is the whole reason
// a real out-of-focus light looks like bokeh and not like a blur.
//
// Noise is a hand-rolled hash + smoothstep value noise stacked into fBm. That
// is deliberate: the widely-copied simplex `snoise` implementations are
// somebody's licensed code, whereas hash-and-interpolate value noise is
// trivial maths with no provenance to carry.
//
// Performance: `useStaticCanvas()` renders exactly one frame at a fixed time
// offset and never starts a rAF loop, so a page holding several of these on
// the editor canvas doesn't run several GPU loops at once.

export const BOKEH_COMPONENT = `'use client';

/** @label "Bokeh" */
/** @comment "Out-of-focus lights floating at three depths." */
/** @defaultWidth 600 */
/** @defaultHeight 400 */
/** @controls {
  "colorA": {
    "type": "color",
    "label": "Color 1",
    "default": "#f9a8d4"
  },
  "colorB": {
    "type": "color",
    "label": "Color 2",
    "default": "#7dd3fc"
  },
  "bgColor": {
    "type": "color",
    "label": "Background",
    "default": "#07060e"
  },
  "speed": {
    "type": "number",
    "label": "Speed",
    "min": 0,
    "max": 3,
    "step": 0.05,
    "default": 1
  },
  "density": {
    "type": "number",
    "label": "Density",
    "min": 1,
    "max": 8,
    "step": 0.1,
    "default": 2.8
  },
  "size": {
    "type": "number",
    "label": "Size",
    "min": 0.3,
    "max": 3,
    "step": 0.05,
    "default": 1.2
  },
  "ring": {
    "type": "number",
    "label": "Ring",
    "min": 0,
    "max": 2,
    "step": 0.05,
    "default": 1.0
  },
  "drift": {
    "type": "number",
    "label": "Drift",
    "min": 0,
    "max": 3,
    "step": 0.05,
    "default": 1.0
  }
} */

import { useEffect, useRef } from 'react';
import { withResponsiveProps, useStaticCanvas } from '@revyme/runtime';

const VERT = [
  'attribute vec2 aPos;',
  'void main() {',
  '  gl_Position = vec4(aPos, 0.0, 1.0);',
  '}',
].join('\\n');

const FRAG = [
  'precision highp float;',
  'uniform vec2  uRes;',
  'uniform float uTime;',
  'float hash(vec2 p) { return fract(sin(dot(p, vec2(41.31, 289.07))) * 43758.5453); }',
  'float vnoise(vec2 p) {',
  '  vec2 i = floor(p); vec2 f = fract(p);',
  '  vec2 u = f * f * (3.0 - 2.0 * f);',
  '  float a = hash(i), b = hash(i + vec2(1.0, 0.0));',
  '  float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));',
  '  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);',
  '}',
  'float fbm(vec2 p) {',
  '  float s = 0.0, a = 0.5;',
  '  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }',
  '  return s;',
  '}',
  'vec2 hash2(vec2 p) { return vec2(hash(p), hash(p + 19.19)); }',
  'vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(p.x * c - p.y * s, p.x * s + p.y * c); }',
  'uniform vec3 uA; uniform vec3 uB; uniform vec3 uBg;',
  'uniform float uDensity; uniform float uSize; uniform float uRing; uniform float uSpeed;',
  'void main() {',
  '  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;',
  '  vec3 col = uBg;',
  '  // Three lattices at different scales stand in for depth: the big soft',
  '  // discs read as near, the small tight ones as far.',
  '  for (int L = 0; L < 3; L++) {',
  '    float fl = float(L);',
  '    float sc = uDensity * (1.0 + fl * 0.9);',
  '    vec2 g = p * sc + vec2(fl * 13.7, uTime * uSpeed * (0.05 + fl * 0.03));',
  '    vec2 i = floor(g), f = fract(g) - 0.5;',
  '    for (int y = -1; y <= 1; y++) {',
  '      for (int x = -1; x <= 1; x++) {',
  '        vec2 o = vec2(float(x), float(y));',
  '        vec2 id = i + o;',
  '        float h = hash(id + fl * 31.0);',
  '        if (h < 0.55) continue;',
  '        vec2 c = o + hash2(id) - 0.5 - f;',
  '        float r = (0.16 + 0.22 * hash(id + 5.5)) * uSize / (1.0 + fl * 0.6);',
  '        float d = length(c) / max(r, 1e-3);',
  '        // A real out-of-focus highlight is a disc with a bright RIM, not a',
  '        // gaussian - that edge is the aperture, and it is what sells bokeh.',
  '        float disc = smoothstep(1.0, 0.82, d);',
  '        float rim = smoothstep(0.78, 1.0, d) * smoothstep(1.02, 0.9, d) * uRing;',
  '        col += mix(uA, uB, hash(id + 9.1)) * (disc * 0.34 + rim * 0.55)',
  '             / (1.0 + fl * 0.7);',
  '      }',
  '    }',
  '  }',
  '  gl_FragColor = vec4(col, 1.0);',
  '}',
].join('\\n');

function hexToRgb(hex) {
  const s = String(hex || '').replace('#', '');
  const full = s.length === 3
    ? s[0] + s[0] + s[1] + s[1] + s[2] + s[2]
    : s;
  const n = parseInt(full || '000000', 16);
  return [
    ((n >> 16) & 255) / 255,
    ((n >> 8) & 255) / 255,
    (n & 255) / 255,
  ];
}

function Bokeh({
  colorA = '#f9a8d4',
  colorB = '#7dd3fc',
  bgColor = '#07060e',
  speed = 1,
  density = 2.8,
  size = 1.2,
  ring = 1.0,
  drift = 1.0,
  ...props
}) {
  const canvasRef = useRef(null);
  const isStatic = useStaticCanvas();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { antialias: false, alpha: false })
      || canvas.getContext('experimental-webgl');
    if (!gl) return;

    function compile(type, src) {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    }

    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    // Two triangles covering clip space.
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'uRes');
    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uA = gl.getUniformLocation(prog, 'uA');
    const uB = gl.getUniformLocation(prog, 'uB');
    const uBg = gl.getUniformLocation(prog, 'uBg');
    const uDensity = gl.getUniformLocation(prog, 'uDensity');
    const uSize = gl.getUniformLocation(prog, 'uSize');
    const uRing = gl.getUniformLocation(prog, 'uRing');
    const uSpeed = gl.getUniformLocation(prog, 'uSpeed');

    const c_uA = hexToRgb(colorA);
    gl.uniform3f(uA, c_uA[0], c_uA[1], c_uA[2]);
    const c_uB = hexToRgb(colorB);
    gl.uniform3f(uB, c_uB[0], c_uB[1], c_uB[2]);
    const c_uBg = hexToRgb(bgColor);
    gl.uniform3f(uBg, c_uBg[0], c_uBg[1], c_uBg[2]);
    gl.uniform1f(uDensity, density);
    gl.uniform1f(uSize, size);
    gl.uniform1f(uRing, ring);
    gl.uniform1f(uSpeed, drift);

    // Cap DPR — a full-viewport background at 3x on a retina phone is a lot
    // of fragments for a layer nobody inspects closely.
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    function resize() {
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    }

    function render(timeSec) {
      resize();
      gl.uniform1f(uTime, timeSec);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    const ro = new ResizeObserver(function () {
      if (isStatic) render(8.0);
    });
    ro.observe(canvas);

    // Static canvas: one frame at an offset where the effect has formed.
    if (isStatic) {
      render(8.0);
      return function () {
        ro.disconnect();
        gl.deleteBuffer(buf);
        gl.deleteProgram(prog);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
      };
    }

    let raf = 0;
    const start = performance.now();

    function tick(now) {
      render(((now - start) / 1000) * Math.max(0, speed));
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return function () {
      cancelAnimationFrame(raf);
      ro.disconnect();
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [colorA, colorB, bgColor, speed, density, size, ring, drift, isStatic]);

  return (
    <div
      data-id={props['data-id']}
      data-name={props['data-name']}
      style={{ position: 'relative', overflow: 'hidden', backgroundColor: bgColor, ...props.style }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', top: '0px', left: '0px', width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}

export default withResponsiveProps(Bokeh);
`;
