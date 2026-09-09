// CyberGrid — Code component template (WebGL fragment-shader background).
//
// Same 1/y floor as Ripple Grid, but the grid scrolls toward the viewer and the
// half above the horizon gets its own branch: a sun disc cut by horizontal gaps
// that widen toward its base, plus the haze it throws into the sky.
//
// Noise is a hand-rolled hash + smoothstep value noise stacked into fBm. That
// is deliberate: the widely-copied simplex `snoise` implementations are
// somebody's licensed code, whereas hash-and-interpolate value noise is
// trivial maths with no provenance to carry.
//
// Performance: `useStaticCanvas()` renders exactly one frame at a fixed time
// offset and never starts a rAF loop, so a page holding several of these on
// the editor canvas doesn't run several GPU loops at once.

export const CYBER_GRID_COMPONENT = `'use client';

/** @label "Cyber Grid" */
/** @comment "Neon perspective grid running under a sliced sun on the horizon." */
/** @defaultWidth 600 */
/** @defaultHeight 400 */
/** @controls {
  "colorA": {
    "type": "color",
    "label": "Grid",
    "default": "#ff2fb9"
  },
  "sunColor": {
    "type": "color",
    "label": "Sun",
    "default": "#ffb03a"
  },
  "bgColor": {
    "type": "color",
    "label": "Background",
    "default": "#0a0418"
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
    "min": 0.2,
    "max": 0.95,
    "step": 0.01,
    "default": 0.58
  },
  "density": {
    "type": "number",
    "label": "Density",
    "min": 0.2,
    "max": 4,
    "step": 0.05,
    "default": 1.0
  },
  "glow": {
    "type": "number",
    "label": "Glow",
    "min": 0,
    "max": 3,
    "step": 0.05,
    "default": 1.0
  },
  "scroll": {
    "type": "number",
    "label": "Scroll",
    "min": 0,
    "max": 3,
    "step": 0.05,
    "default": 0.6
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
  'uniform vec3 uA; uniform vec3 uSun; uniform vec3 uBg;',
  'uniform float uHorizon; uniform float uDensity; uniform float uGlow; uniform float uSpeed;',
  'void main() {',
  '  vec2 uv = gl_FragCoord.xy / uRes;',
  '  float y = uHorizon - uv.y;',
  '  float ar = uRes.x / uRes.y;',
  '  // Sky half: a sun disc sitting on the horizon plus its haze.',
  '  if (y <= 0.0015) {',
  '    vec2 s = vec2((uv.x - 0.5) * ar, uv.y - uHorizon);',
  '    float d = length(s * vec2(1.0, 1.35));',
  '    float disc = smoothstep(0.30, 0.27, d);',
  '    // Slice the disc with horizontal gaps that widen toward the bottom.',
  '    disc *= step(0.35, fract(s.y * 26.0)) + smoothstep(0.10, 0.30, s.y);',
  '    vec3 col = uBg + uSun * clamp(disc, 0.0, 1.0) * 1.1',
  '             + uSun * exp(-d * 3.4) * 0.35 * uGlow;',
  '    gl_FragColor = vec4(col, 1.0);',
  '    return;',
  '  }',
  '  float z = 0.55 / y;',
  '  float x = (uv.x - 0.5) * z * ar * 1.6;',
  '  vec2 g = vec2(x, z - uTime * uSpeed) * uDensity;',
  '  vec2 f = abs(fract(g) - 0.5);',
  '  float wide = 0.045 + z * 0.004;',
  '  float line = smoothstep(wide, 0.0, min(f.x, f.y));',
  '  float fade = exp(-z * 0.08);',
  '  vec3 col = uBg + uA * line * fade * 2.4 + uSun * exp(-z * 0.9) * 0.10 * uGlow;',
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

function CyberGrid({
  colorA = '#ff2fb9',
  sunColor = '#ffb03a',
  bgColor = '#0a0418',
  speed = 1,
  horizon = 0.58,
  density = 1.0,
  glow = 1.0,
  scroll = 0.6,
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
    const uSun = gl.getUniformLocation(prog, 'uSun');
    const uBg = gl.getUniformLocation(prog, 'uBg');
    const uHorizon = gl.getUniformLocation(prog, 'uHorizon');
    const uDensity = gl.getUniformLocation(prog, 'uDensity');
    const uGlow = gl.getUniformLocation(prog, 'uGlow');
    const uSpeed = gl.getUniformLocation(prog, 'uSpeed');

    const c_uA = hexToRgb(colorA);
    gl.uniform3f(uA, c_uA[0], c_uA[1], c_uA[2]);
    const c_uSun = hexToRgb(sunColor);
    gl.uniform3f(uSun, c_uSun[0], c_uSun[1], c_uSun[2]);
    const c_uBg = hexToRgb(bgColor);
    gl.uniform3f(uBg, c_uBg[0], c_uBg[1], c_uBg[2]);
    gl.uniform1f(uHorizon, horizon);
    gl.uniform1f(uDensity, density);
    gl.uniform1f(uGlow, glow);
    gl.uniform1f(uSpeed, scroll);

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
  }, [colorA, sunColor, bgColor, speed, horizon, density, glow, scroll, isStatic]);

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

export default withResponsiveProps(CyberGrid);
`;
