import { describe, test, expect } from 'vitest';
import { unfoldFlowStyles, axisSizedByFrame } from './unfold-flow-sizing';

const ROW_GP_FRAME = { position: 'relative', height: '100%', flex: '1 0 0px', order: '1', display: 'flex', flexDirection: 'column', alignItems: 'center' };
const WATER = { position: 'relative', width: '100%', flex: '3 0 0px', order: '0', backgroundImage: 'url(x)' };

describe('unfoldFlowStyles — single child takes the frame slot', () => {
  test('the water frame inherits the column frame\'s slot sizing in the row grandparent', () => {
    const s = unfoldFlowStyles({ frameStyles: ROW_GP_FRAME, childStyles: WATER, measured: { width: 300, height: 418 }, siblingCount: 1 });
    expect(s.flex).toBe('1 0 0px');
    expect(s.height).toBe('100%');
    expect(s.width).toBe('');        // the frame had none — the flex fills the row
    expect(s.order).toBe('1');
    expect(s.position).toBe('relative');
  });
  test('a frame with no flex → child gets a fixed flex, never a stray grow', () => {
    const s = unfoldFlowStyles({ frameStyles: { display: 'flex', width: '200px', height: '100px' }, childStyles: WATER, measured: null, siblingCount: 1 });
    expect(s.flex).toBe('0 0 auto');
    expect(s.width).toBe('200px');
    expect(s.height).toBe('100px');
  });
});

describe('unfoldFlowStyles — several children keep what they painted', () => {
  test('frame-supplied axes bake to px, explicit px stays', () => {
    const s = unfoldFlowStyles({ frameStyles: ROW_GP_FRAME, childStyles: WATER, measured: { width: 300.4, height: 250.6 }, siblingCount: 2 });
    expect(s.flex).toBe('0 0 auto');
    expect(s.width).toBe('300px');   // was 100% → baked
    expect(s.height).toBe('251px');  // was flex fill on the column → baked
    const fixed = unfoldFlowStyles({ frameStyles: ROW_GP_FRAME, childStyles: { width: '80px', height: '40px', flex: '0 0 auto' }, measured: { width: 80, height: 40 }, siblingCount: 2 });
    expect(fixed.width).toBeUndefined();
    expect(fixed.height).toBeUndefined();
  });
});

describe('axisSizedByFrame', () => {
  test('cross-axis stretch counts as frame-sized; a non-stretch alignment does not', () => {
    expect(axisSizedByFrame('width', { display: 'flex', flexDirection: 'column' }, {})).toBe(true);
    expect(axisSizedByFrame('width', { display: 'flex', flexDirection: 'column', alignItems: 'center' }, {})).toBe(false);
  });
  test('main-axis grow counts; fit size does not', () => {
    expect(axisSizedByFrame('height', { display: 'flex', flexDirection: 'column' }, { flex: '1 0 0px' })).toBe(true);
    expect(axisSizedByFrame('height', { display: 'flex', flexDirection: 'column' }, { height: 'fit-content' })).toBe(false);
  });
});
