// GrainField — Code component template (WebGL fragment-shader background).
//
// Two fBm fields mix three colours into a slow, wide gradient, then a
// per-pixel hash lays grain over the whole thing. The grain is the point: a
// large flat gradient BANDS on a real display, and dithering it with noise is
// what hides the steps. Nothing here is meant to be sharp.
//
// Noise is a hand-rolled hash + smoothstep value noise stacked into fBm. That
// is deliberate: the widely-copied simplex `snoise` implementations are
// somebody's licensed code, whereas hash-and-interpolate value noise is
// trivial maths with no provenance to carry.
//
// Performance: `useStaticCanvas()` renders exactly one frame at a fixed time
// offset and never starts a rAF loop, so a page holding several of these on
// the editor canvas doesn't run several GPU loops at once.

export const GRAIN_FIELD_COMPONENT = `'use client';

/** @label "Grain Field" */
/** @comment "A soft colour field under heavy film grain." */
/** @defaultWidth 600 */
/** @defaultHeight 400 */
/** @controls {
  "colorA": {
    "type": "color",
    "label": "Color 1",
    "default": "#1b1035"
  },
  "colorB": {
    "type": "color",
    "label": "Color 2",
    "default": "#c2410c"
  },
  "colorC": {
    "type": "color",
    "label": "Color 3",
    "default": "#f5b942"
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
    "max": 5,
    "step": 0.1,
    "default": 1.6
  },
  "grain": {
    "type": "number",
    "label": "Grain",
    "min": 0,
    "max": 0.3,
    "step": 0.005,
    "default": 0.13
  },
  "contrast": {
    "type": "number",
    "label": "Contrast",
    "min": 0.2,
    "max": 2,
    "step": 0.05,
    "default": 1
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
  'uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;',
  'uniform float uScale; uniform float uGrain; uniform float uContrast;',
  'void main() {',
  '  vec2 uv = gl_FragCoord.xy / uRes;',
  '  float f = fbm(uv * uScale + vec2(uTime * 0.03, uTime * 0.02));',
  '  float g = fbm(uv * uScale * 0.55 + 7.0 - uTime * 0.02);',
  '  vec3 col = mix(uA, uB, smoothstep(0.5 - uContrast * 0.3, 0.5 + uContrast * 0.3, f));',
  '  col = mix(col, uC, smoothstep(0.55, 0.95, g) * 0.85);',
  '  // Heavy grain over a soft field: the grain is the point, it is what stops a',
  '  // big flat gradient from banding on a real display.',
  '  col += (hash(gl_FragCoord.xy + fract(uTime) * 113.0) - 0.5) * uGrain;',
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

function GrainField({
  colorA = '#1b1035',
  colorB = '#c2410c',
  colorC = '#f5b942',
  speed = 1,
  scale = 1.6,
  grain = 0.13,
  contrast = 1,
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
    const uScale = gl.getUniformLocation(prog, 'uScale');
    const uGrain = gl.getUniformLocation(prog, 'uGrain');
    const uContrast = gl.getUniformLocation(prog, 'uContrast');

    const c_uA = hexToRgb(colorA);
    gl.uniform3f(uA, c_uA[0], c_uA[1], c_uA[2]);
    const c_uB = hexToRgb(colorB);
    gl.uniform3f(uB, c_uB[0], c_uB[1], c_uB[2]);
    const c_uC = hexToRgb(colorC);
    gl.uniform3f(uC, c_uC[0], c_uC[1], c_uC[2]);
    gl.uniform1f(uScale, scale);
    gl.uniform1f(uGrain, grain);
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
      if (isStatic) render(9.0);
    });
    ro.observe(canvas);

    // Static canvas: one frame at an offset where the effect has formed.
    if (isStatic) {
      render(9.0);
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
  }, [colorA, colorB, colorC, speed, scale, grain, contrast, isStatic]);

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

export default withResponsiveProps(GrainField);
`;
