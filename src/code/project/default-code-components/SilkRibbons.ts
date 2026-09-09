// SilkRibbons — Code component template (WebGL fragment-shader background).
//
// Fullscreen quad, all the work in the fragment shader. The ribbons come from
// sampling one fBm field in a ROTATED frame: fast across the ribbons, slow
// along them. That anisotropy is the whole effect - sampling the same noise
// isotropically gives tie-dye, not silk. A second, finer sample warps the
// band edges so they are never parallel.
//
// Noise is a hand-rolled hash + smoothstep value noise stacked into fBm. That
// is deliberate: the widely-copied simplex `snoise` implementations are
// somebody's licensed code, whereas hash-and-interpolate value noise is
// trivial maths with no provenance to carry.
//
// Performance: `useStaticCanvas()` renders exactly one frame at a fixed time
// offset and never starts a rAF loop, so a page holding several of these on
// the editor canvas doesn't run several GPU loops at once.

export const SILK_RIBBONS_COMPONENT = `'use client';

/** @label "Silk" */
/** @comment "Wide ribbons of light drifting like silk, rendered on the GPU." */
/** @defaultWidth 600 */
/** @defaultHeight 400 */
/** @controls {
  "colorA": {
    "type": "color",
    "label": "Color 1",
    "default": "#c6d4ff"
  },
  "colorB": {
    "type": "color",
    "label": "Color 2",
    "default": "#f5c8e4"
  },
  "colorC": {
    "type": "color",
    "label": "Color 3",
    "default": "#fff0d0"
  },
  "bgColor": {
    "type": "color",
    "label": "Background",
    "default": "#0b0b14"
  },
  "speed": {
    "type": "number",
    "label": "Speed",
    "min": 0,
    "max": 3,
    "step": 0.05,
    "default": 1
  },
  "angle": {
    "type": "number",
    "label": "Angle",
    "min": 0,
    "max": 180,
    "step": 1,
    "default": 35
  },
  "bands": {
    "type": "number",
    "label": "Bands",
    "min": 0.5,
    "max": 6,
    "step": 0.1,
    "default": 2.2
  },
  "flow": {
    "type": "number",
    "label": "Flow",
    "min": 0,
    "max": 5,
    "step": 0.1,
    "default": 2
  },
  "soften": {
    "type": "number",
    "label": "Saturation",
    "min": 0,
    "max": 1,
    "step": 0.05,
    "default": 0.85
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
  'uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform vec3 uBg;',
  'uniform float uAngle; uniform float uBands; uniform float uFlow; uniform float uSoften;',
  'vec3 ramp(float t) {',
  '  float x = fract(t);',
  '  vec3 c = mix(uA, uB, smoothstep(0.0, 0.5, x));',
  '  c = mix(c, uC, smoothstep(0.45, 0.9, x));',
  '  return mix(c, uA, smoothstep(0.85, 1.0, x));',
  '}',
  'void main() {',
  '  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;',
  '  float a = radians(uAngle);',
  '  vec2 r = vec2(p.x * cos(a) - p.y * sin(a), p.x * sin(a) + p.y * cos(a));',
  '  // Noise sampled FAST across the ribbons and SLOW along them. That anisotropy',
  '  // is the whole trick: an isotropic field here reads as tie-dye, not silk.',
  '  float w  = fbm(vec2(r.x * 1.6, r.y * 0.28) + vec2(0.0, uTime * 0.05));',
  '  float w2 = fbm(vec2(r.x * 3.3, r.y * 0.50) - vec2(0.0, uTime * 0.035));',
  '  float band = r.x * uBands + (w - 0.5) * uFlow + (w2 - 0.5) * uFlow * 0.3;',
  '  vec3 col = ramp(band * 0.5 + uTime * 0.015);',
  '  col = mix(col, vec3(dot(col, vec3(0.33))), 1.0 - uSoften);',
  '  col = mix(uBg, col, 0.92);',
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

function SilkRibbons({
  colorA = '#c6d4ff',
  colorB = '#f5c8e4',
  colorC = '#fff0d0',
  bgColor = '#0b0b14',
  speed = 1,
  angle = 35,
  bands = 2.2,
  flow = 2,
  soften = 0.85,
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
    const uBg = gl.getUniformLocation(prog, 'uBg');
    const uAngle = gl.getUniformLocation(prog, 'uAngle');
    const uBands = gl.getUniformLocation(prog, 'uBands');
    const uFlow = gl.getUniformLocation(prog, 'uFlow');
    const uSoften = gl.getUniformLocation(prog, 'uSoften');

    const c_uA = hexToRgb(colorA);
    gl.uniform3f(uA, c_uA[0], c_uA[1], c_uA[2]);
    const c_uB = hexToRgb(colorB);
    gl.uniform3f(uB, c_uB[0], c_uB[1], c_uB[2]);
    const c_uC = hexToRgb(colorC);
    gl.uniform3f(uC, c_uC[0], c_uC[1], c_uC[2]);
    const c_uBg = hexToRgb(bgColor);
    gl.uniform3f(uBg, c_uBg[0], c_uBg[1], c_uBg[2]);
    gl.uniform1f(uAngle, angle);
    gl.uniform1f(uBands, bands);
    gl.uniform1f(uFlow, flow);
    gl.uniform1f(uSoften, soften);

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
  }, [colorA, colorB, colorC, bgColor, speed, angle, bands, flow, soften, isStatic]);

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

export default withResponsiveProps(SilkRibbons);
`;
