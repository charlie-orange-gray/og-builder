// VoronoiCells — Code component template (WebGL fragment-shader background).
//
// Cell walls are the set of points equidistant from the two NEAREST seeds, so
// the border is `d2 - d1` rather than a distance from any one point. That is why
// the walls close into a watertight mosaic instead of leaving gaps at junctions.
// Each seed orbits inside its own cell, so the pattern shifts and never tears.
//
// Noise is a hand-rolled hash + smoothstep value noise stacked into fBm. That
// is deliberate: the widely-copied simplex `snoise` implementations are
// somebody's licensed code, whereas hash-and-interpolate value noise is
// trivial maths with no provenance to carry.
//
// Performance: `useStaticCanvas()` renders exactly one frame at a fixed time
// offset and never starts a rAF loop, so a page holding several of these on
// the editor canvas doesn't run several GPU loops at once.

export const VORONOI_CELLS_COMPONENT = `'use client';

/** @label "Voronoi Cells" */
/** @comment "A living mosaic of glowing cells, each one drifting on its own clock." */
/** @defaultWidth 600 */
/** @defaultHeight 400 */
/** @controls {
  "colorA": {
    "type": "color",
    "label": "Cell 1",
    "default": "#0f172a"
  },
  "colorB": {
    "type": "color",
    "label": "Cell 2",
    "default": "#1d4ed8"
  },
  "lineColor": {
    "type": "color",
    "label": "Walls",
    "default": "#67e8f9"
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
    "min": 1,
    "max": 20,
    "step": 0.5,
    "default": 6.0
  },
  "drift": {
    "type": "number",
    "label": "Drift",
    "min": 0,
    "max": 3,
    "step": 0.05,
    "default": 1.0
  },
  "edge": {
    "type": "number",
    "label": "Wall Width",
    "min": 0.1,
    "max": 3,
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
  'uniform vec3 uA; uniform vec3 uB; uniform vec3 uLine;',
  'uniform float uScale; uniform float uSpeed; uniform float uEdge; uniform float uGlow;',
  'void main() {',
  '  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y * uScale;',
  '  vec2 i = floor(p), f = fract(p);',
  '  float d1 = 8.0, d2 = 8.0;',
  '  vec2 cid = vec2(0.0);',
  '  for (int y = -1; y <= 1; y++) {',
  '    for (int x = -1; x <= 1; x++) {',
  '      vec2 g = vec2(float(x), float(y));',
  '      vec2 o = hash2(i + g);',
  '      // Each seed orbits its own cell on its own phase, so the mosaic',
  '      // shifts without any cell ever leaving its neighbourhood.',
  '      o = 0.5 + 0.45 * sin(uTime * uSpeed * 0.7 + 6.28318 * o);',
  '      float d = length(g + o - f);',
  '      if (d < d1) { d2 = d1; d1 = d; cid = i + g; }',
  '      else if (d < d2) { d2 = d; }',
  '    }',
  '  }',
  '  // The border is where the two nearest seeds are equidistant - not a',
  '  // distance from a point, which is why it closes into clean cell walls.',
  '  float b = d2 - d1;',
  '  float edge = smoothstep(0.0, 0.16 * uEdge, b);',
  '  vec3 cell = mix(uA, uB, hash(cid + 3.3));',
  '  cell *= 0.55 + 0.45 * (1.0 - d1);',
  '  vec3 col = mix(uLine, cell, edge);',
  '  col += uLine * exp(-b * 22.0) * 0.35 * uGlow;',
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

function VoronoiCells({
  colorA = '#0f172a',
  colorB = '#1d4ed8',
  lineColor = '#67e8f9',
  speed = 1,
  scale = 6.0,
  drift = 1.0,
  edge = 1.0,
  glow = 1.0,
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
    const uLine = gl.getUniformLocation(prog, 'uLine');
    const uScale = gl.getUniformLocation(prog, 'uScale');
    const uSpeed = gl.getUniformLocation(prog, 'uSpeed');
    const uEdge = gl.getUniformLocation(prog, 'uEdge');
    const uGlow = gl.getUniformLocation(prog, 'uGlow');

    const c_uA = hexToRgb(colorA);
    gl.uniform3f(uA, c_uA[0], c_uA[1], c_uA[2]);
    const c_uB = hexToRgb(colorB);
    gl.uniform3f(uB, c_uB[0], c_uB[1], c_uB[2]);
    const c_uLine = hexToRgb(lineColor);
    gl.uniform3f(uLine, c_uLine[0], c_uLine[1], c_uLine[2]);
    gl.uniform1f(uScale, scale);
    gl.uniform1f(uSpeed, drift);
    gl.uniform1f(uEdge, edge);
    gl.uniform1f(uGlow, glow);

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
  }, [colorA, colorB, lineColor, speed, scale, drift, edge, glow, isStatic]);

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

export default withResponsiveProps(VoronoiCells);
`;
