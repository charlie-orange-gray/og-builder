// LightPillar — Code component template (WebGL fragment-shader background).
//
// A single beam: an exponential falloff either side of a centre line that one
// fBm field pushes left and right, so the shaft breathes instead of standing
// still. Both ends fade out so the light has somewhere to come from, and a
// radial darkening plus per-pixel grain keep it from looking like a gradient.
//
// Noise is a hand-rolled hash + smoothstep value noise stacked into fBm. That
// is deliberate: the widely-copied simplex `snoise` implementations are
// somebody's licensed code, whereas hash-and-interpolate value noise is
// trivial maths with no provenance to carry.
//
// Performance: `useStaticCanvas()` renders exactly one frame at a fixed time
// offset and never starts a rAF loop, so a page holding several of these on
// the editor canvas doesn't run several GPU loops at once.

export const LIGHT_PILLAR_COMPONENT = `'use client';

/** @label "Light Pillar" */
/** @comment "A vertical shaft of light wavering in the dark, with grain and vignette." */
/** @defaultWidth 600 */
/** @defaultHeight 400 */
/** @controls {
  "colorA": {
    "type": "color",
    "label": "Core",
    "default": "#e9dcff"
  },
  "colorB": {
    "type": "color",
    "label": "Halo",
    "default": "#7c3aed"
  },
  "bgColor": {
    "type": "color",
    "label": "Background",
    "default": "#07060f"
  },
  "speed": {
    "type": "number",
    "label": "Speed",
    "min": 0,
    "max": 3,
    "step": 0.05,
    "default": 1
  },
  "waver": {
    "type": "number",
    "label": "Waver",
    "min": 0,
    "max": 3,
    "step": 0.05,
    "default": 1
  },
  "tightness": {
    "type": "number",
    "label": "Tightness",
    "min": 0.3,
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
    "default": 1.1
  },
  "grain": {
    "type": "number",
    "label": "Grain",
    "min": 0,
    "max": 0.2,
    "step": 0.005,
    "default": 0.06
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
  'uniform float uWaver; uniform float uTight; uniform float uIntensity; uniform float uGrain;',
  'void main() {',
  '  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;',
  '  float n = fbm(vec2(p.x * 2.2, p.y * 1.1 - uTime * 0.10));',
  '  float x = p.x + (n - 0.5) * uWaver * 0.30;',
  '  float core = exp(-abs(x) * uTight * 16.0);',
  '  float halo = exp(-abs(x) * uTight * 3.2) * 0.30;',
  '  // Fade both ends so the beam has somewhere to come from and go to.',
  '  float vert = smoothstep(-0.85, 0.05, p.y) * smoothstep(0.95, 0.15, p.y);',
  '  vec3 col = uBg + (uA * core + uB * halo) * uIntensity * vert;',
  '  col *= 1.0 - 0.55 * dot(p, p);',
  '  col += (hash(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * uGrain;',
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

function LightPillar({
  colorA = '#e9dcff',
  colorB = '#7c3aed',
  bgColor = '#07060f',
  speed = 1,
  waver = 1,
  tightness = 1,
  intensity = 1.1,
  grain = 0.06,
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
    const uWaver = gl.getUniformLocation(prog, 'uWaver');
    const uTight = gl.getUniformLocation(prog, 'uTight');
    const uIntensity = gl.getUniformLocation(prog, 'uIntensity');
    const uGrain = gl.getUniformLocation(prog, 'uGrain');

    const c_uA = hexToRgb(colorA);
    gl.uniform3f(uA, c_uA[0], c_uA[1], c_uA[2]);
    const c_uB = hexToRgb(colorB);
    gl.uniform3f(uB, c_uB[0], c_uB[1], c_uB[2]);
    const c_uBg = hexToRgb(bgColor);
    gl.uniform3f(uBg, c_uBg[0], c_uBg[1], c_uBg[2]);
    gl.uniform1f(uWaver, waver);
    gl.uniform1f(uTight, tightness);
    gl.uniform1f(uIntensity, intensity);
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
  }, [colorA, colorB, bgColor, speed, waver, tightness, intensity, grain, isStatic]);

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

export default withResponsiveProps(LightPillar);
`;
