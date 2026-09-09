// FluidGradient — Code component template (WebGL fragment-shader background).
//
// Two rounds of domain warping over one fBm field. A single round gives soft
// blobs; feeding the first offset back into the second is what makes the field
// fold over itself, and folding is what separates a liquid from a blur.
//
// Noise is a hand-rolled hash + smoothstep value noise stacked into fBm. That
// is deliberate: the widely-copied simplex `snoise` implementations are
// somebody's licensed code, whereas hash-and-interpolate value noise is
// trivial maths with no provenance to carry.
//
// Performance: `useStaticCanvas()` renders exactly one frame at a fixed time
// offset and never starts a rAF loop, so a page holding several of these on
// the editor canvas doesn't run several GPU loops at once.

export const FLUID_GRADIENT_COMPONENT = `'use client';

/** @label "Fluid Gradient" */
/** @comment "Four colours folded through a warped noise field, like ink in water." */
/** @defaultWidth 600 */
/** @defaultHeight 400 */
/** @controls {
  "colorA": {
    "type": "color",
    "label": "Color 1",
    "default": "#1e1b4b"
  },
  "colorB": {
    "type": "color",
    "label": "Color 2",
    "default": "#7c3aed"
  },
  "colorC": {
    "type": "color",
    "label": "Color 3",
    "default": "#ec4899"
  },
  "colorD": {
    "type": "color",
    "label": "Color 4",
    "default": "#22d3ee"
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
    "min": 0.5,
    "max": 6,
    "step": 0.1,
    "default": 1.8
  },
  "warp": {
    "type": "number",
    "label": "Warp",
    "min": 0,
    "max": 5,
    "step": 0.1,
    "default": 2.2
  },
  "contrast": {
    "type": "number",
    "label": "Contrast",
    "min": 0.2,
    "max": 3,
    "step": 0.05,
    "default": 1.4
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
  'uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform vec3 uD;',
  'uniform float uScale; uniform float uWarp; uniform float uContrast;',
  'void main() {',
  '  vec2 uv = gl_FragCoord.xy / uRes;',
  '  vec2 p = uv * vec2(uRes.x / uRes.y, 1.0) * uScale;',
  '  float t = uTime * 0.08;',
  '  // Two rounds of domain warping. One round gives soft blobs; feeding the',
  '  // first offset back in is what makes the field fold over itself and read',
  '  // as liquid rather than as a blurred gradient.',
  '  vec2 q = vec2(fbm(p + t), fbm(p + vec2(3.7, 1.2) - t));',
  '  vec2 r = vec2(fbm(p + q * uWarp + vec2(1.7, 9.2) + t * 0.7),',
  '                fbm(p + q * uWarp + vec2(8.3, 2.8) - t * 0.5));',
  '  float f = fbm(p + r * uWarp);',
  '  float k = clamp((f - 0.5) * uContrast + 0.5, 0.0, 1.0);',
  '  vec3 col = mix(uA, uB, k);',
  '  col = mix(col, uC, clamp(length(q) * 0.85, 0.0, 1.0));',
  '  col = mix(col, uD, clamp(r.x * 1.1 - 0.15, 0.0, 1.0));',
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

function FluidGradient({
  colorA = '#1e1b4b',
  colorB = '#7c3aed',
  colorC = '#ec4899',
  colorD = '#22d3ee',
  speed = 1,
  scale = 1.8,
  warp = 2.2,
  contrast = 1.4,
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
    const uC = gl.getUniformLocation(prog, 'uC');
    const uD = gl.getUniformLocation(prog, 'uD');
    const uScale = gl.getUniformLocation(prog, 'uScale');
    const uWarp = gl.getUniformLocation(prog, 'uWarp');
    const uContrast = gl.getUniformLocation(prog, 'uContrast');

    const c_uA = hexToRgb(colorA);
    gl.uniform3f(uA, c_uA[0], c_uA[1], c_uA[2]);
    const c_uB = hexToRgb(colorB);
    gl.uniform3f(uB, c_uB[0], c_uB[1], c_uB[2]);
    const c_uC = hexToRgb(colorC);
    gl.uniform3f(uC, c_uC[0], c_uC[1], c_uC[2]);
    const c_uD = hexToRgb(colorD);
    gl.uniform3f(uD, c_uD[0], c_uD[1], c_uD[2]);
    gl.uniform1f(uScale, scale);
    gl.uniform1f(uWarp, warp);
    gl.uniform1f(uContrast, contrast);

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
      if (isStatic) render(12.0);
    });
    ro.observe(canvas);

    // Static canvas: one frame at an offset where the effect has formed.
    if (isStatic) {
      render(12.0);
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
  }, [colorA, colorB, colorC, colorD, speed, scale, warp, contrast, isStatic]);

  return (
    <div
      data-id={props['data-id']}
      data-name={props['data-name']}
      style={{ position: 'relative', overflow: 'hidden', ...props.style }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', top: '0px', left: '0px', width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}

export default withResponsiveProps(FluidGradient);
`;
