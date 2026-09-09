// LiquidChrome — Code component template (WebGL fragment-shader background).
//
// Chrome is a mirror, so all the shape comes from what it reflects: a striped
// environment, bent by the surface normal. The height field is SINES and never
// fBm - anything you difference for a normal has to be smooth to begin with, and
// differencing hash noise pits the metal like a golf ball instead of pooling it
// like mercury.
//
// Noise is a hand-rolled hash + smoothstep value noise stacked into fBm. That
// is deliberate: the widely-copied simplex `snoise` implementations are
// somebody's licensed code, whereas hash-and-interpolate value noise is
// trivial maths with no provenance to carry.
//
// Performance: `useStaticCanvas()` renders exactly one frame at a fixed time
// offset and never starts a rAF loop, so a page holding several of these on
// the editor canvas doesn't run several GPU loops at once.

export const LIQUID_CHROME_COMPONENT = `'use client';

/** @label "Liquid Chrome" */
/** @comment "Polished metal rolling in slow waves." */
/** @defaultWidth 600 */
/** @defaultHeight 400 */
/** @controls {
  "colorA": {
    "type": "color",
    "label": "Dark",
    "default": "#0b0f1a"
  },
  "colorB": {
    "type": "color",
    "label": "Light",
    "default": "#cbd5e1"
  },
  "tint": {
    "type": "color",
    "label": "Tint",
    "default": "#ffffff"
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
    "max": 8,
    "step": 0.1,
    "default": 3.0
  },
  "amount": {
    "type": "number",
    "label": "Distortion",
    "min": 0,
    "max": 3,
    "step": 0.05,
    "default": 1.0
  },
  "bands": {
    "type": "number",
    "label": "Bands",
    "min": 1,
    "max": 20,
    "step": 0.5,
    "default": 7.0
  },
  "flow": {
    "type": "number",
    "label": "Flow",
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
  'uniform vec3 uA; uniform vec3 uB; uniform vec3 uTint;',
  'uniform float uScale; uniform float uAmp; uniform float uBands; uniform float uSpeed;',
  'float H(vec2 p) {',
  '  // Height is SINES, never fBm. Anything you difference for a normal has to',
  '  // be smooth to begin with: differencing hash noise pits the metal like a',
  '  // golf ball instead of pooling it like mercury.',
  '  float t = uTime * uSpeed;',
  '  return sin(p.x * 1.3 + t * 0.30) * 0.50',
  '       + sin(p.y * 1.1 - t * 0.24) * 0.40',
  '       + sin((p.x + p.y) * 0.72 + t * 0.17) * 0.32',
  '       + sin((p.x - p.y * 1.4) * 0.51 - t * 0.11) * 0.26;',
  '}',
  'void main() {',
  '  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y * uScale;',
  '  float e = 0.02;',
  '  vec2 n = vec2(H(p + vec2(e, 0.0)) - H(p - vec2(e, 0.0)),',
  '                H(p + vec2(0.0, e)) - H(p - vec2(0.0, e))) / (2.0 * e);',
  '  // Reflect a striped environment off that normal - chrome is nothing but a',
  '  // mirror, so all the shape comes from what it is mirroring.',
  '  vec2 refl = p + n * uAmp * 0.55;',
  '  float env = 0.5 + 0.5 * sin(refl.y * uBands + refl.x * 0.4);',
  '  env = pow(env, 1.8);',
  '  float rim = pow(clamp(1.0 - length(n) * 0.18, 0.0, 1.0), 3.0);',
  '  vec3 col = mix(uA, uB, env) * uTint;',
  '  col += vec3(1.0) * pow(env, 12.0) * 0.55;',
  '  col *= 0.75 + 0.25 * rim;',
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

function LiquidChrome({
  colorA = '#0b0f1a',
  colorB = '#cbd5e1',
  tint = '#ffffff',
  speed = 1,
  scale = 3.0,
  amount = 1.0,
  bands = 7.0,
  flow = 1.0,
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
    const uTint = gl.getUniformLocation(prog, 'uTint');
    const uScale = gl.getUniformLocation(prog, 'uScale');
    const uAmp = gl.getUniformLocation(prog, 'uAmp');
    const uBands = gl.getUniformLocation(prog, 'uBands');
    const uSpeed = gl.getUniformLocation(prog, 'uSpeed');

    const c_uA = hexToRgb(colorA);
    gl.uniform3f(uA, c_uA[0], c_uA[1], c_uA[2]);
    const c_uB = hexToRgb(colorB);
    gl.uniform3f(uB, c_uB[0], c_uB[1], c_uB[2]);
    const c_uTint = hexToRgb(tint);
    gl.uniform3f(uTint, c_uTint[0], c_uTint[1], c_uTint[2]);
    gl.uniform1f(uScale, scale);
    gl.uniform1f(uAmp, amount);
    gl.uniform1f(uBands, bands);
    gl.uniform1f(uSpeed, flow);

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
  }, [colorA, colorB, tint, speed, scale, amount, bands, flow, isStatic]);

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

export default withResponsiveProps(LiquidChrome);
`;
