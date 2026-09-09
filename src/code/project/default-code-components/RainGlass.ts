// RainGlass — Code component template (WebGL fragment-shader background).
//
// A drop is a lens: it bends the backdrop toward its own centre, which is why
// the pane has to be drawn as a function that can be re-sampled rather than as a
// finished image. Every column runs on its own clock, so the drops never fall in
// ranks. Frost is the same backdrop flattened toward its low-frequency average.
//
// Noise is a hand-rolled hash + smoothstep value noise stacked into fBm. That
// is deliberate: the widely-copied simplex `snoise` implementations are
// somebody's licensed code, whereas hash-and-interpolate value noise is
// trivial maths with no provenance to carry.
//
// Performance: `useStaticCanvas()` renders exactly one frame at a fixed time
// offset and never starts a rAF loop, so a page holding several of these on
// the editor canvas doesn't run several GPU loops at once.

export const RAIN_GLASS_COMPONENT = `'use client';

/** @label "Rain Glass" */
/** @comment "Raindrops running down a frosted pane." */
/** @defaultWidth 600 */
/** @defaultHeight 400 */
/** @controls {
  "colorA": {
    "type": "color",
    "label": "Glass",
    "default": "#164e63"
  },
  "colorB": {
    "type": "color",
    "label": "Light",
    "default": "#67e8f9"
  },
  "bgColor": {
    "type": "color",
    "label": "Background",
    "default": "#050a10"
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
    "min": 3,
    "max": 20,
    "step": 0.5,
    "default": 9.0
  },
  "fall": {
    "type": "number",
    "label": "Fall",
    "min": 0,
    "max": 3,
    "step": 0.05,
    "default": 1.0
  },
  "size": {
    "type": "number",
    "label": "Drop Size",
    "min": 0.3,
    "max": 3,
    "step": 0.05,
    "default": 1.0
  },
  "frost": {
    "type": "number",
    "label": "Frost",
    "min": 0,
    "max": 1,
    "step": 0.05,
    "default": 0.8
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
  'uniform float uDensity; uniform float uSpeed; uniform float uSize; uniform float uBlur;',
  'vec3 backdrop(vec2 uv) {',
  '  float f = fbm(uv * 2.4 + vec2(0.0, uTime * 0.03));',
  '  return uBg + mix(uA, uB, smoothstep(0.3, 0.8, f)) * (0.25 + 0.75 * f);',
  '}',
  'void main() {',
  '  vec2 uv = gl_FragCoord.xy / uRes;',
  '  vec2 g = vec2(uv.x * uRes.x / uRes.y, uv.y) * uDensity;',
  '  vec2 i = floor(g);',
  '  // Each column runs on its own clock so the drops do not fall in ranks.',
  '  float ph = hash(vec2(i.x, 0.0));',
  '  g.y += uTime * uSpeed * (0.35 + ph * 0.5);',
  '  i = floor(g);',
  '  vec2 f = fract(g) - 0.5;',
  '  vec2 o = (hash2(i) - 0.5) * 0.6;',
  '  float r = (0.16 + 0.16 * hash(i + 2.2)) * uSize;',
  '  float d = length((f - o) * vec2(1.0, 0.78));',
  '  float drop = smoothstep(r, r * 0.72, d);',
  '  // A drop is a lens: it bends the backdrop toward its own centre.',
  '  vec2 bend = (f - o) * drop * 0.16;',
  '  vec3 col = backdrop(uv - bend);',
  '  // Everything not under a drop is the frosted pane - fake the frost by',
  '  // flattening the backdrop toward its low-frequency average.',
  '  vec3 frost = mix(col, backdrop(uv * 0.55 + 4.0), clamp(uBlur, 0.0, 1.0) * 0.75);',
  '  col = mix(frost, col * 1.25 + 0.06, drop);',
  '  col += vec3(1.0) * smoothstep(r * 0.55, r * 0.2, length((f - o - vec2(0.03, 0.05)) * vec2(1.0, 0.78))) * drop * 0.25;',
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

function RainGlass({
  colorA = '#164e63',
  colorB = '#67e8f9',
  bgColor = '#050a10',
  speed = 1,
  density = 9.0,
  fall = 1.0,
  size = 1.0,
  frost = 0.8,
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
    const uSpeed = gl.getUniformLocation(prog, 'uSpeed');
    const uSize = gl.getUniformLocation(prog, 'uSize');
    const uBlur = gl.getUniformLocation(prog, 'uBlur');

    const c_uA = hexToRgb(colorA);
    gl.uniform3f(uA, c_uA[0], c_uA[1], c_uA[2]);
    const c_uB = hexToRgb(colorB);
    gl.uniform3f(uB, c_uB[0], c_uB[1], c_uB[2]);
    const c_uBg = hexToRgb(bgColor);
    gl.uniform3f(uBg, c_uBg[0], c_uBg[1], c_uBg[2]);
    gl.uniform1f(uDensity, density);
    gl.uniform1f(uSpeed, fall);
    gl.uniform1f(uSize, size);
    gl.uniform1f(uBlur, frost);

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
  }, [colorA, colorB, bgColor, speed, density, fall, size, frost, isStatic]);

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

export default withResponsiveProps(RainGlass);
`;
