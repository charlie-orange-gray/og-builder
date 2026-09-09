// IridescentFilm — Code component template (WebGL fragment-shader background).
//
// Thin-film colour: a thickness field read through a cosine palette, so the
// hue travels the spectrum as the film thins and thickens.
//
// The thickness is SINES warped by one low-frequency fBm, not fBm alone. An
// earlier version drove the hue from the gradient of an fBm and it came out as
// crunchy rainbow speckle - hash-based value noise has a noisy derivative, so
// anything read as a slope has to be smooth to start with. The sheen is also
// gated so it pools in places rather than coating the whole plate, which is
// what keeps this usable underneath text.
//
// Noise is a hand-rolled hash + smoothstep value noise stacked into fBm. That
// is deliberate: the widely-copied simplex `snoise` implementations are
// somebody's licensed code, whereas hash-and-interpolate value noise is
// trivial maths with no provenance to carry.
//
// Performance: `useStaticCanvas()` renders exactly one frame at a fixed time
// offset and never starts a rAF loop, so a page holding several of these on
// the editor canvas doesn't run several GPU loops at once.

export const IRIDESCENT_FILM_COMPONENT = `'use client';

/** @label "Iridescence" */
/** @comment "An oil-slick sheen of shifting colour, thin-film style." */
/** @defaultWidth 600 */
/** @defaultHeight 400 */
/** @controls {
  "tint": {
    "type": "color",
    "label": "Tint",
    "default": "#ffffff"
  },
  "bgColor": {
    "type": "color",
    "label": "Background",
    "default": "#08070d"
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
    "min": 0.6,
    "max": 6,
    "step": 0.1,
    "default": 2.4
  },
  "shift": {
    "type": "number",
    "label": "Hue shift",
    "min": 0,
    "max": 1,
    "step": 0.01,
    "default": 0
  },
  "saturation": {
    "type": "number",
    "label": "Saturation",
    "min": 0,
    "max": 1.5,
    "step": 0.05,
    "default": 0.8
  },
  "grain": {
    "type": "number",
    "label": "Grain",
    "min": 0,
    "max": 0.2,
    "step": 0.005,
    "default": 0.04
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
  'uniform vec3 uTint; uniform vec3 uBg;',
  'uniform float uScale; uniform float uShift; uniform float uSat; uniform float uGrain;',
  'void main() {',
  '  vec2 uv = gl_FragCoord.xy / uRes;',
  '  vec2 p = uv * uScale * vec2(uRes.x / uRes.y, 1.0);',
  '  float t = uTime * 0.06;',
  '  // One LOW-frequency fBm warps the domain - that supplies the organic shape.',
  '  float w = fbm(p * 0.55 + t);',
  '  vec2 q = p + (w - 0.5) * 1.6;',
  '  // ...but the film thickness itself is SINES. An earlier pass drove the hue',
  '  // from the slope of an fBm and it came out as crunchy rainbow speckle:',
  '  // hash-based value noise has a noisy derivative, so anything you difference',
  '  // or read as a gradient has to be smooth to begin with.',
  '  float th = sin(q.x * 1.7 + q.y * 0.9 + t) * 0.50',
  '           + sin(q.y * 2.3 - q.x * 1.1 - t * 0.8) * 0.35',
  '           + w * 1.5 + uShift;',
  '  vec3 col = 0.5 + 0.5 * cos(6.28318 * (th * 0.85 + vec3(0.0, 0.33, 0.67)));',
  '  col = mix(vec3(dot(col, vec3(0.33))), col, uSat) * uTint;',
  '  // The sheen pools rather than coating everything, so the plate stays dark',
  '  // enough to sit under text.',
  '  col *= 0.18 + 0.82 * smoothstep(0.30, 0.88, fbm(p * 0.8 + 3.0));',
  '  col = uBg + col * 0.9;',
  '  col += (hash(gl_FragCoord.xy + fract(uTime) * 57.0) - 0.5) * uGrain;',
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

function IridescentFilm({
  tint = '#ffffff',
  bgColor = '#08070d',
  speed = 1,
  scale = 2.4,
  shift = 0,
  saturation = 0.8,
  grain = 0.04,
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
    const uTint = gl.getUniformLocation(prog, 'uTint');
    const uBg = gl.getUniformLocation(prog, 'uBg');
    const uScale = gl.getUniformLocation(prog, 'uScale');
    const uShift = gl.getUniformLocation(prog, 'uShift');
    const uSat = gl.getUniformLocation(prog, 'uSat');
    const uGrain = gl.getUniformLocation(prog, 'uGrain');

    const c_uTint = hexToRgb(tint);
    gl.uniform3f(uTint, c_uTint[0], c_uTint[1], c_uTint[2]);
    const c_uBg = hexToRgb(bgColor);
    gl.uniform3f(uBg, c_uBg[0], c_uBg[1], c_uBg[2]);
    gl.uniform1f(uScale, scale);
    gl.uniform1f(uShift, shift);
    gl.uniform1f(uSat, saturation);
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
  }, [tint, bgColor, speed, scale, shift, saturation, grain, isStatic]);

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

export default withResponsiveProps(IridescentFilm);
`;
