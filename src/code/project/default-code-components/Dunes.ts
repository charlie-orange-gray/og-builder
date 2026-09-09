// Dunes — Code component template (WebGL fragment-shader background).
//
// Ridged noise, not plain fBm: folding the field at its midpoint turns the
// maxima into sharp crests, and a dune without a knife edge is just a hill. The
// sample is stretched along x because wind builds long ridges, not lumps, and
// the shading comes from the slope so the light has a direction.
//
// Noise is a hand-rolled hash + smoothstep value noise stacked into fBm. That
// is deliberate: the widely-copied simplex `snoise` implementations are
// somebody's licensed code, whereas hash-and-interpolate value noise is
// trivial maths with no provenance to carry.
//
// Performance: `useStaticCanvas()` renders exactly one frame at a fixed time
// offset and never starts a rAF loop, so a page holding several of these on
// the editor canvas doesn't run several GPU loops at once.

export const DUNES_COMPONENT = `'use client';

/** @label "Dunes" */
/** @comment "Wind-built sand ridges under a low sun." */
/** @defaultWidth 600 */
/** @defaultHeight 400 */
/** @controls {
  "colorA": {
    "type": "color",
    "label": "Shadow",
    "default": "#7c2d12"
  },
  "colorB": {
    "type": "color",
    "label": "Sand",
    "default": "#fed7aa"
  },
  "skyColor": {
    "type": "color",
    "label": "Haze",
    "default": "#fca5a5"
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
    "min": 0.3,
    "max": 5,
    "step": 0.1,
    "default": 1.6
  },
  "ridge": {
    "type": "number",
    "label": "Ridge",
    "min": 0,
    "max": 1,
    "step": 0.05,
    "default": 0.9
  },
  "light": {
    "type": "number",
    "label": "Light",
    "min": 0.2,
    "max": 3,
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
  'uniform vec3 uA; uniform vec3 uB; uniform vec3 uSky;',
  'uniform float uScale; uniform float uRidge; uniform float uLight; uniform float uSpeed;',
  'float ridged(vec2 p) {',
  '  // Ridged noise: fold the field at its midpoint so the maxima become sharp',
  '  // crests. Plain fBm gives rolling hills, never a dune\\'s knife edge.',
  '  float s = 0.0, a = 0.5;',
  '  for (int i = 0; i < 5; i++) {',
  '    s += a * (1.0 - abs(vnoise(p) * 2.0 - 1.0));',
  '    p *= 2.07; a *= 0.5;',
  '  }',
  '  return s;',
  '}',
  'void main() {',
  '  vec2 uv = gl_FragCoord.xy / uRes;',
  '  // Stretch along x: wind-built dunes are long ridges, not lumps.',
  '  vec2 p = uv * vec2(uRes.x / uRes.y * 0.45, 1.5) * uScale + vec2(uTime * uSpeed * 0.03, 0.0);',
  '  float h = mix(fbm(p), ridged(p), clamp(uRidge, 0.0, 1.0));',
  '  float e = 0.012;',
  '  vec2 n = vec2(mix(fbm(p + vec2(e, 0.0)), ridged(p + vec2(e, 0.0)), uRidge) - h,',
  '                mix(fbm(p + vec2(0.0, e)), ridged(p + vec2(0.0, e)), uRidge) - h);',
  '  float lit = clamp(0.5 - n.x * 26.0 * uLight - n.y * 9.0 * uLight, 0.0, 1.0);',
  '  lit = smoothstep(0.05, 0.95, lit);',
  '  vec3 col = mix(uA, uB, lit);',
  '  col = mix(col, uSky, smoothstep(0.55, 1.05, uv.y) * 0.55);',
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

function Dunes({
  colorA = '#7c2d12',
  colorB = '#fed7aa',
  skyColor = '#fca5a5',
  speed = 1,
  scale = 1.6,
  ridge = 0.9,
  light = 1.0,
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
    const uSky = gl.getUniformLocation(prog, 'uSky');
    const uScale = gl.getUniformLocation(prog, 'uScale');
    const uRidge = gl.getUniformLocation(prog, 'uRidge');
    const uLight = gl.getUniformLocation(prog, 'uLight');
    const uSpeed = gl.getUniformLocation(prog, 'uSpeed');

    const c_uA = hexToRgb(colorA);
    gl.uniform3f(uA, c_uA[0], c_uA[1], c_uA[2]);
    const c_uB = hexToRgb(colorB);
    gl.uniform3f(uB, c_uB[0], c_uB[1], c_uB[2]);
    const c_uSky = hexToRgb(skyColor);
    gl.uniform3f(uSky, c_uSky[0], c_uSky[1], c_uSky[2]);
    gl.uniform1f(uScale, scale);
    gl.uniform1f(uRidge, ridge);
    gl.uniform1f(uLight, light);
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
  }, [colorA, colorB, skyColor, speed, scale, ridge, light, drift, isStatic]);

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

export default withResponsiveProps(Dunes);
`;
