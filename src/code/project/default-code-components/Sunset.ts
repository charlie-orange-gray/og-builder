// Sunset — Code component template (WebGL fragment-shader background).
//
// Below the horizon the sky is drawn a second time, mirrored, with a sideways
// offset that grows with distance from the shoreline - that widening offset is
// what makes still water read as moving water. Strips chop the reflection so it
// never looks like a flipped copy.
//
// Noise is a hand-rolled hash + smoothstep value noise stacked into fBm. That
// is deliberate: the widely-copied simplex `snoise` implementations are
// somebody's licensed code, whereas hash-and-interpolate value noise is
// trivial maths with no provenance to carry.
//
// Performance: `useStaticCanvas()` renders exactly one frame at a fixed time
// offset and never starts a rAF loop, so a page holding several of these on
// the editor canvas doesn't run several GPU loops at once.

export const SUNSET_COMPONENT = `'use client';

/** @label "Sunset" */
/** @comment "A sun on the horizon with its reflection broken across the water." */
/** @defaultWidth 600 */
/** @defaultHeight 400 */
/** @controls {
  "skyColor": {
    "type": "color",
    "label": "Sky",
    "default": "#1e1b4b"
  },
  "midColor": {
    "type": "color",
    "label": "Horizon",
    "default": "#f97316"
  },
  "sunColor": {
    "type": "color",
    "label": "Sun",
    "default": "#fde68a"
  },
  "seaColor": {
    "type": "color",
    "label": "Water",
    "default": "#0c1129"
  },
  "speed": {
    "type": "number",
    "label": "Speed",
    "min": 0,
    "max": 3,
    "step": 0.05,
    "default": 1
  },
  "horizon": {
    "type": "number",
    "label": "Horizon",
    "min": 0.1,
    "max": 0.9,
    "step": 0.01,
    "default": 0.45
  },
  "size": {
    "type": "number",
    "label": "Sun Size",
    "min": 0.3,
    "max": 3,
    "step": 0.05,
    "default": 1.0
  },
  "bands": {
    "type": "number",
    "label": "Ripples",
    "min": 0.2,
    "max": 3,
    "step": 0.05,
    "default": 1.0
  },
  "grain": {
    "type": "number",
    "label": "Grain",
    "min": 0,
    "max": 0.3,
    "step": 0.01,
    "default": 0.05
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
  'uniform vec3 uSky; uniform vec3 uMid; uniform vec3 uSun; uniform vec3 uSea;',
  'uniform float uHorizon; uniform float uSize; uniform float uBands; uniform float uGrain;',
  'void main() {',
  '  vec2 uv = gl_FragCoord.xy / uRes;',
  '  float ar = uRes.x / uRes.y;',
  '  vec2 s = vec2((uv.x - 0.5) * ar, uv.y - uHorizon);',
  '  vec3 col = mix(uMid, uSky, smoothstep(uHorizon - 0.05, 1.0, uv.y));',
  '  float d = length(s * vec2(1.0, 1.25));',
  '  col += uSun * smoothstep(0.26 * uSize, 0.24 * uSize, d);',
  '  col += uSun * exp(-d * 3.2) * 0.55;',
  '  if (uv.y < uHorizon) {',
  '    // Water: the same sky, mirrored and chopped into strips whose width and',
  '    // offset grow with distance from the shoreline.',
  '    float k = (uHorizon - uv.y);',
  '    vec2 m = vec2(uv.x + sin(uv.y * 90.0 + uTime * 0.9) * k * 0.06, uHorizon + k);',
  '    vec2 ms = vec2((m.x - 0.5) * ar, m.y - uHorizon);',
  '    float md = length(ms * vec2(1.0, 1.25));',
  '    vec3 refl = mix(uMid, uSky, smoothstep(uHorizon - 0.05, 1.0, m.y));',
  '    refl += uSun * exp(-md * 3.2) * 0.55;',
  '    refl *= step(0.35, fract(uv.y * uBands * 26.0 + uTime * 0.4)) * 0.55 + 0.45;',
  '    col = mix(uSea, refl, 0.65) * (0.55 + 0.45 * smoothstep(0.0, 0.35, uv.y));',
  '  }',
  '  col += (hash(gl_FragCoord.xy + fract(uTime) * 37.0) - 0.5) * uGrain;',
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

function Sunset({
  skyColor = '#1e1b4b',
  midColor = '#f97316',
  sunColor = '#fde68a',
  seaColor = '#0c1129',
  speed = 1,
  horizon = 0.45,
  size = 1.0,
  bands = 1.0,
  grain = 0.05,
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
    const uSky = gl.getUniformLocation(prog, 'uSky');
    const uMid = gl.getUniformLocation(prog, 'uMid');
    const uSun = gl.getUniformLocation(prog, 'uSun');
    const uSea = gl.getUniformLocation(prog, 'uSea');
    const uHorizon = gl.getUniformLocation(prog, 'uHorizon');
    const uSize = gl.getUniformLocation(prog, 'uSize');
    const uBands = gl.getUniformLocation(prog, 'uBands');
    const uGrain = gl.getUniformLocation(prog, 'uGrain');

    const c_uSky = hexToRgb(skyColor);
    gl.uniform3f(uSky, c_uSky[0], c_uSky[1], c_uSky[2]);
    const c_uMid = hexToRgb(midColor);
    gl.uniform3f(uMid, c_uMid[0], c_uMid[1], c_uMid[2]);
    const c_uSun = hexToRgb(sunColor);
    gl.uniform3f(uSun, c_uSun[0], c_uSun[1], c_uSun[2]);
    const c_uSea = hexToRgb(seaColor);
    gl.uniform3f(uSea, c_uSea[0], c_uSea[1], c_uSea[2]);
    gl.uniform1f(uHorizon, horizon);
    gl.uniform1f(uSize, size);
    gl.uniform1f(uBands, bands);
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
  }, [skyColor, midColor, sunColor, seaColor, speed, horizon, size, bands, grain, isStatic]);

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

export default withResponsiveProps(Sunset);
`;
