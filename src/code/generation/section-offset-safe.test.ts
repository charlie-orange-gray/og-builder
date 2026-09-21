import { describe, it, expect } from 'vitest';
import {
  sectionSafeOffset, canonicalOffset, detectSectionViewportFromOffset, detectTriggerFromOffset,
  detectLayerExitFromOffset, layerInViewOffset, layerInViewExitOffset, healSectionOffsets,
} from './generator-motion-scroll';
import { updateScrollAnimInCode } from './generator-motion';

// Section in View resolves its target by id inside a mount effect, AFTER the
// animated element mounted. framer-motion 12.38+ recognises the named offset
// pairs as its ScrollOffset presets and accelerates them through a ViewTimeline
// created at that mount — with no target yet — so the scrub tracked the whole
// page (an imported hero image faded over 16,000px instead of its 900px
// section). A percentage viewport edge is the same pixel in motion's JS
// resolver and never a preset.
describe('Section in View offsets stay off framer-motion\'s preset fast path', () => {
  it('spells the viewport edge as a percentage and reads it back', () => {
    expect(sectionSafeOffset(`["start end", "end start"]`)).toBe(`["start 100%", "end 0%"]`);
    expect(sectionSafeOffset(`["start end", "start center"]`)).toBe(`["start 100%", "start 50%"]`);
    expect(sectionSafeOffset(`["start start", "end start"]`)).toBe(`["start 0%", "end 0%"]`);
    expect(canonicalOffset(`["start 100%", "start 50%"]`)).toBe(`["start end", "start center"]`);
    expect(canonicalOffset(`["start 0%", "end 0%"]`)).toBe(`["start start", "end start"]`);
    // A Layer-in-View custom range is not the section spelling and is left alone.
    expect(canonicalOffset(`["start end", "start 37%"]`)).toBe(`["start end", "start 37%"]`);
    expect(canonicalOffset(`["start end", "end end"]`)).toBe(`["start end", "end end"]`);
  });

  it('round-trips the viewport position, the trigger and the exit timing', () => {
    expect(detectSectionViewportFromOffset(`["start 100%", "start 0%"]`)).toBe('top');
    expect(detectSectionViewportFromOffset(`["start 100%", "start 50%"]`)).toBe('middle');
    expect(detectSectionViewportFromOffset(`["start 100%", "end 100%"]`)).toBe('bottom');
    expect(detectSectionViewportFromOffset(`["start 0%", "end 0%"]`)).toBe('top');
    expect(detectTriggerFromOffset(`["start 100%", "end 0%"]`, true, true)).toBe('sectionInView');
    expect(detectLayerExitFromOffset(`["start 0%", "end 0%"]`)).toBe(true);
    expect(detectLayerExitFromOffset(`["start 100%", "start 50%"]`)).toBe(false);
    // Layer-in-View keeps its named spelling: the ref sits on the element itself.
    expect(layerInViewOffset('center')).toBe(`["start end", "start center"]`);
    expect(layerInViewExitOffset('top')).toBe(`["start start", "end start"]`);
  });

  it('emits the percentage spelling for a section-driven scroll transform', () => {
    const PAGE = `import React from 'react';

export default function Page() {
  return (
    <div data-id="root" data-name="Page" style={{ position: 'relative' }}>
      <section data-id="hero" data-name="Hero" id="hero" style={{ position: 'relative', height: '900px' }}></section>
      <div data-id="photo" data-name="Photo" style={{ position: 'relative', opacity: '1' }}></div>
    </div>
  );
}
`;
    const out = updateScrollAnimInCode(PAGE, {
      nodeId: 'photo',
      trigger: 'sectionInView',
      sectionId: 'hero',
      sectionViewport: 'middle',
      stops: [
        { progress: 0, props: { opacity: '1' } },
        { progress: 1, props: { opacity: '0' } },
      ],
    });
    expect(out).toContain("document.getElementById('hero')");
    expect(out).toContain(`offset: ["start 100%", "start 50%"]`);
    expect(out).not.toMatch(/offset: \["start end", "(?:start|end) (?:start|center|end)"\]/);
  });
});

describe('healSectionOffsets (load-time migration of the named spelling)', () => {
  const SECTION = `
  const heroRef = useRef(null);
  useEffect(() => { heroRef.current = document.getElementById('hero') || document.body; }, []);
  const { scrollYProgress: heroProgress } = useScroll({ target: heroRef, offset: ["start end", "end start"] });
  const cardRef = useRef(null);
  useEffect(() => { cardRef.current = document.getElementById('next'); }, []);
  const { scrollYProgress: cardP } = useScroll({ target: cardRef, offset: ['start center', 'end center'] });
`;
  const LAYER = `
  const boxRef = useRef(null);
  const { scrollYProgress: boxProgress } = useScroll({ target: boxRef, offset: ["start end", "end end"] });
  <motion.div ref={boxRef} data-id="box" />
`;
  it('rewrites only section-driven scrubs, both quote styles, idempotently', () => {
    const healed = healSectionOffsets(SECTION + LAYER + `const { scrollYProgress: p } = useScroll();`);
    expect(healed).toContain(`useScroll({ target: heroRef, offset: ["start 100%", "end 0%"] })`);
    expect(healed).toContain(`useScroll({ target: cardRef, offset: ['start 50%', 'end 50%'] })`);
    // Layer in View keeps its named spelling — its ref is attached at commit.
    expect(healed).toContain(`useScroll({ target: boxRef, offset: ["start end", "end end"] })`);
    expect(healed).toContain(`useScroll();`);
    expect(healSectionOffsets(healed)).toBe(healed);
  });
  it('leaves a file without section bindings untouched', () => {
    expect(healSectionOffsets(LAYER)).toBe(LAYER);
  });
});
