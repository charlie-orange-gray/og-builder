// HexGrid — Code component template (WebGL fragment-shader background).
//
// A hex lattice is two offset rectangular lattices - keep whichever centre is
// nearer and the honeycomb falls out with no trigonometry per pixel. The band
// sits AT the cell radius rather than under it, so the result is a wireframe
// comb instead of a field of solid tiles.
//
// Noise is a hand-rolled hash + smoothstep value noise stacked into fBm. That
// is deliberate: the widely-copied simplex `snoise` implementations are
// somebody's licensed code, whereas hash-and-interpolate value noise is
// trivial maths with no provenance to carry.
//
// Performance: `useStaticCanvas()` renders exactly one frame at a fixed time
// offset and never starts a rAF loop, so a page holding several of these on
// the editor canvas doesn't run several GPU loops at once.

export const HEX_GRID_COMPONENT = `'use client';

/** @label "Hex Grid" */
/** @comment "A honeycomb of neon cells pulsing outward." */
/** @defaultWidth 600 */
/** @defaultHeight 400 */
/** @controls {
  "colorA": {
    "type": "color",
    "label": "Color 1",
    "default": "#0891b2"
  },
  "colorB": {
    "type": "color",
    "label": "Color 2",
    "default": "#a855f7"
  },
  "bgColor": {
    "type": "color",
    "label": "Background",
    "default": "#04060e"
  },
  "speed": {
    "type": "number",
    "label": "Speed",
    "min": 0,
    "max": 3,
    "step": 0.05,
    "default": 1
  },
  "scale": {
    "type": "number",
    "label": "Scale",
    "min": 2,
    "max": 30,
    "step": 0.5,
    "default": 9.0
  },
  "width": {
    "type": "number",
    "label": "Line Width",
    "min": 0.2,
    "max": 3,
    "step": 0.05,
    "default": 1.0
  },
  "pulse": {
    "type": "number",
    "label": "Pulse",
    "min": 0,
    "max": 2,
    "step": 0.05,
    "default": 1.0
  },
  "rate": {
    "type": "number",
    "label": "Rate",
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
  'uniform float uScale; uniform float uWidth; uniform float uPulse; uniform float uSpeed;',
  'void main() {',
  '  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y * uScale;',
  '  // A hex lattice is two offset rectangular lattices; keep whichever centre',
  '  // is nearer and you have the honeycomb with no trigonometry per pixel.',
  '  vec2 s = vec2(1.0, 1.7320508);',
  '  vec2 h = s * 0.5;',
  '  vec2 ga = mod(p, s) - h;',
  '  vec2 gb = mod(p - h, s) - h;',
  '  bool useA = dot(ga, ga) < dot(gb, gb);',
  '  vec2 gv = useA ? ga : gb;',
  '  vec2 id = useA ? floor(p / s) : floor((p - h) / s) + 0.5;',
  '  vec2 q = abs(gv);',
  '  float hd = max(q.y * 0.8660254 + q.x * 0.5, q.x);',
  '  // Ring, not disc: the band sits AT the cell radius, so the lattice reads',
  '  // as a wireframe honeycomb rather than a field of solid tiles.',
  '  float w = 0.035 * uWidth;',
  '  float line = smoothstep(0.46 - w, 0.46, hd) * smoothstep(0.46 + w, 0.46, hd);',
  '  float pulse = 0.5 + 0.5 * sin(uTime * uSpeed * 1.6 + hash(id) * 12.0 - length(id) * 0.5);',
  '  vec3 col = uBg + mix(uA, uB, pulse) * line * 2.4 * (0.3 + 0.7 * pulse * uPulse);',
  '  col += mix(uA, uB, pulse) * (1.0 - smoothstep(0.0, 0.46, hd)) * 0.06 * pulse * uPulse;',
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

function HexGrid({
  colorA = '#0891b2',
  colorB = '#a855f7',
  bgColor = '#04060e',
  speed = 1,
  scale = 9.0,
  width = 1.0,
  pulse = 1.0,
  rate = 1.0,
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
    const uScale = gl.getUniformLocation(prog, 'uScale');
    const uWidth = gl.getUniformLocation(prog, 'uWidth');
    const uPulse = gl.getUniformLocation(prog, 'uPulse');
    const uSpeed = gl.getUniformLocation(prog, 'uSpeed');

    const c_uA = hexToRgb(colorA);
    gl.uniform3f(uA, c_uA[0], c_uA[1], c_uA[2]);
    const c_uB = hexToRgb(colorB);
    gl.uniform3f(uB, c_uB[0], c_uB[1], c_uB[2]);
    const c_uBg = hexToRgb(bgColor);
    gl.uniform3f(uBg, c_uBg[0], c_uBg[1], c_uBg[2]);
    gl.uniform1f(uScale, scale);
    gl.uniform1f(uWidth, width);
    gl.uniform1f(uPulse, pulse);
    gl.uniform1f(uSpeed, rate);

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
      if (isStatic) render(6.0);
    });
    ro.observe(canvas);

    // Static canvas: one frame at an offset where the effect has formed.
    if (isStatic) {
      render(6.0);
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
  }, [colorA, colorB, bgColor, speed, scale, width, pulse, rate, isStatic]);

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

export default withResponsiveProps(HexGrid);
`;
