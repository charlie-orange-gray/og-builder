// GodRays — Code component template (WebGL fragment-shader background).
//
// Volumetric shafts without volume: the noise is sampled around the ANGLE from
// the light source, so the rays stay straight and only their brightness
// breathes. Sampling in xy instead would bend them into smoke. Distance
// falloff thins them out, and a tight radial core gives the source itself.
//
// Noise is a hand-rolled hash + smoothstep value noise stacked into fBm. That
// is deliberate: the widely-copied simplex `snoise` implementations are
// somebody's licensed code, whereas hash-and-interpolate value noise is
// trivial maths with no provenance to carry.
//
// Performance: `useStaticCanvas()` renders exactly one frame at a fixed time
// offset and never starts a rAF loop, so a page holding several of these on
// the editor canvas doesn't run several GPU loops at once.

export const GOD_RAYS_COMPONENT = `'use client';

/** @label "God Rays" */
/** @comment "Shafts of light fanning out from a movable source through haze." */
/** @defaultWidth 600 */
/** @defaultHeight 400 */
/** @controls {
  "colorA": {
    "type": "color",
    "label": "Rays",
    "default": "#ffd9a0"
  },
  "colorB": {
    "type": "color",
    "label": "Core",
    "default": "#fff4e0"
  },
  "bgColor": {
    "type": "color",
    "label": "Background",
    "default": "#0a0806"
  },
  "speed": {
    "type": "number",
    "label": "Speed",
    "min": 0,
    "max": 3,
    "step": 0.05,
    "default": 1
  },
  "originX": {
    "type": "number",
    "label": "Source X",
    "min": 0,
    "max": 1,
    "step": 0.01,
    "default": 0.5
  },
  "originY": {
    "type": "number",
    "label": "Source Y",
    "min": 0,
    "max": 1,
    "step": 0.01,
    "default": 0.85
  },
  "count": {
    "type": "number",
    "label": "Rays",
    "min": 3,
    "max": 24,
    "step": 1,
    "default": 9
  },
  "falloff": {
    "type": "number",
    "label": "Falloff",
    "min": 0.2,
    "max": 3,
    "step": 0.05,
    "default": 1
  },
  "intensity": {
    "type": "number",
    "label": "Intensity",
    "min": 0.2,
    "max": 3,
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
  'uniform vec3 uA; uniform vec3 uB; uniform vec3 uBg;',
  'uniform float uOriginX; uniform float uOriginY; uniform float uCount;',
  'uniform float uFalloff; uniform float uIntensity;',
  'void main() {',
  '  vec2 uv = gl_FragCoord.xy / uRes;',
  '  vec2 p = uv - vec2(uOriginX, uOriginY);',
  '  p.x *= uRes.x / uRes.y;',
  '  float r = length(p);',
  '  float ang = atan(p.y, p.x);',
  '  // Sample the noise around the ANGLE so the shafts stay straight and only',
  '  // their brightness breathes; sampling in xy would bend them into smoke.',
  '  float shaft = fbm(vec2(ang * uCount, uTime * 0.09));',
  '  shaft = pow(max(shaft, 0.0), 1.5) * 1.9;',
  '  vec3 col = uBg + uA * shaft * exp(-r * uFalloff * 2.0) * uIntensity;',
  '  col += uB * exp(-r * 6.0) * 0.85 * uIntensity;',
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

function GodRays({
  colorA = '#ffd9a0',
  colorB = '#fff4e0',
  bgColor = '#0a0806',
  speed = 1,
  originX = 0.5,
  originY = 0.85,
  count = 9,
  falloff = 1,
  intensity = 1,
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
    const uOriginX = gl.getUniformLocation(prog, 'uOriginX');
    const uOriginY = gl.getUniformLocation(prog, 'uOriginY');
    const uCount = gl.getUniformLocation(prog, 'uCount');
    const uFalloff = gl.getUniformLocation(prog, 'uFalloff');
    const uIntensity = gl.getUniformLocation(prog, 'uIntensity');

    const c_uA = hexToRgb(colorA);
    gl.uniform3f(uA, c_uA[0], c_uA[1], c_uA[2]);
    const c_uB = hexToRgb(colorB);
    gl.uniform3f(uB, c_uB[0], c_uB[1], c_uB[2]);
    const c_uBg = hexToRgb(bgColor);
    gl.uniform3f(uBg, c_uBg[0], c_uBg[1], c_uBg[2]);
    gl.uniform1f(uOriginX, originX);
    gl.uniform1f(uOriginY, originY);
    gl.uniform1f(uCount, count);
    gl.uniform1f(uFalloff, falloff);
    gl.uniform1f(uIntensity, intensity);

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
  }, [colorA, colorB, bgColor, speed, originX, originY, count, falloff, intensity, isStatic]);

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

export default withResponsiveProps(GodRays);
`;
