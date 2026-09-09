// ScanlineCRT — Code component template (WebGL fragment-shader background).
//
// Three tube artefacts stacked on a drifting noise picture. The sample point is
// barrelled out from the centre so the image bulges; the red and blue channels
// are sampled a few pixels apart, which is the chroma smear of a misconverged
// tube; and the line pattern is tied to the DEVICE height, so it stays one
// scanline per row however large the element gets.
//
// Noise is a hand-rolled hash + smoothstep value noise stacked into fBm. That
// is deliberate: the widely-copied simplex `snoise` implementations are
// somebody's licensed code, whereas hash-and-interpolate value noise is
// trivial maths with no provenance to carry.
//
// Performance: `useStaticCanvas()` renders exactly one frame at a fixed time
// offset and never starts a rAF loop, so a page holding several of these on
// the editor canvas doesn't run several GPU loops at once.

export const SCANLINE_C_R_T_COMPONENT = `'use client';

/** @label "CRT" */
/** @comment "A CRT picture: barrel bulge, rolling scanlines and channel smear." */
/** @defaultWidth 600 */
/** @defaultHeight 400 */
/** @controls {
  "colorA": {
    "type": "color",
    "label": "Color 1",
    "default": "#0ea5e9"
  },
  "colorB": {
    "type": "color",
    "label": "Color 2",
    "default": "#a3e635"
  },
  "bgColor": {
    "type": "color",
    "label": "Background",
    "default": "#05070a"
  },
  "speed": {
    "type": "number",
    "label": "Speed",
    "min": 0,
    "max": 3,
    "step": 0.05,
    "default": 1
  },
  "lineGap": {
    "type": "number",
    "label": "Line Gap",
    "min": 1,
    "max": 8,
    "step": 0.5,
    "default": 3.0
  },
  "roll": {
    "type": "number",
    "label": "Roll",
    "min": 0,
    "max": 4,
    "step": 0.05,
    "default": 1.0
  },
  "shift": {
    "type": "number",
    "label": "Color Shift",
    "min": 0,
    "max": 4,
    "step": 0.05,
    "default": 1.0
  },
  "grain": {
    "type": "number",
    "label": "Grain",
    "min": 0,
    "max": 0.4,
    "step": 0.01,
    "default": 0.09
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
  'uniform float uLines; uniform float uRoll; uniform float uShift; uniform float uGrain;',
  'void main() {',
  '  vec2 uv = gl_FragCoord.xy / uRes;',
  '  // Barrel the sample so the picture bulges like a tube.',
  '  vec2 c = uv - 0.5;',
  '  vec2 b = c * (1.0 + dot(c, c) * 0.18);',
  '  float glow = fbm(b * 2.2 + vec2(0.0, uTime * 0.15));',
  '  // Split the channels sideways: the chroma smear of a misconverged tube.',
  '  float s = uShift * 0.006;',
  '  float rr = fbm((b + vec2(s, 0.0)) * 2.2 + vec2(0.0, uTime * 0.15));',
  '  float bb = fbm((b - vec2(s, 0.0)) * 2.2 + vec2(0.0, uTime * 0.15));',
  '  vec3 col = uBg + mix(uA, uB, glow) * glow * 1.3;',
  '  col.r += (rr - glow) * 0.9;',
  '  col.b += (bb - glow) * 0.9;',
  '  float line = 0.5 + 0.5 * sin((uv.y + uTime * uRoll * 0.05) * uRes.y * 3.14159 / max(uLines, 1.0));',
  '  col *= 0.68 + 0.32 * line;',
  '  col *= 1.0 - 0.7 * dot(c, c);',
  '  col += (hash(gl_FragCoord.xy + fract(uTime) * 71.0) - 0.5) * uGrain;',
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

function ScanlineCRT({
  colorA = '#0ea5e9',
  colorB = '#a3e635',
  bgColor = '#05070a',
  speed = 1,
  lineGap = 3.0,
  roll = 1.0,
  shift = 1.0,
  grain = 0.09,
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
    const uLines = gl.getUniformLocation(prog, 'uLines');
    const uRoll = gl.getUniformLocation(prog, 'uRoll');
    const uShift = gl.getUniformLocation(prog, 'uShift');
    const uGrain = gl.getUniformLocation(prog, 'uGrain');

    const c_uA = hexToRgb(colorA);
    gl.uniform3f(uA, c_uA[0], c_uA[1], c_uA[2]);
    const c_uB = hexToRgb(colorB);
    gl.uniform3f(uB, c_uB[0], c_uB[1], c_uB[2]);
    const c_uBg = hexToRgb(bgColor);
    gl.uniform3f(uBg, c_uBg[0], c_uBg[1], c_uBg[2]);
    gl.uniform1f(uLines, lineGap);
    gl.uniform1f(uRoll, roll);
    gl.uniform1f(uShift, shift);
    gl.uniform1f(uGrain, grain);

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
  }, [colorA, colorB, bgColor, speed, lineGap, roll, shift, grain, isStatic]);

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

export default withResponsiveProps(ScanlineCRT);
`;
