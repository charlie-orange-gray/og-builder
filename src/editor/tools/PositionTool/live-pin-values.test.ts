import { describe, it, expect } from 'vitest';
import { livePinValues } from './live-pin-values';

describe('livePinValues', () => {
  it('a rotated bar at rest: the live values EQUAL the source (left px, top %), unset sides are not shown', () => {
    const styles = { position: 'absolute', width: '1119px', height: '163px', left: '18px', top: '50%', transform: 'translateY(-50%) rotate(90deg)' };
    // layout box as painted: cssTop = 0.5·671 = 335.5, painted top = 335.5 − 81.5
    const rect = { left: 18, top: 335.5 - 81.5, width: 1119, height: 163 };
    expect(livePinValues({ styles, rect, parentWidth: 1119, parentHeight: 671 })).toEqual({ left: '18px', top: '50%' });
  });
  it('px right / bottom pins derive from the layout box, not the rotated bounding box', () => {
    const styles = { position: 'absolute', width: '200px', height: '50px', right: '30px', bottom: '20px', transform: 'rotate(45deg)' };
    const rect = { left: 770, top: 730, width: 200, height: 50 };
    expect(livePinValues({ styles, rect, parentWidth: 1000, parentHeight: 800 })).toEqual({ right: '30px', bottom: '20px' });
  });
  it('a translate(-50%) centring channel is undone before expressing the %', () => {
    const styles = { position: 'absolute', width: '100px', height: '40px', left: '50%', top: '10px', transform: 'translateX(-50%)' };
    const rect = { left: 450, top: 10, width: 100, height: 40 }; // painted left = 500 − 50
    expect(livePinValues({ styles, rect, parentWidth: 1000, parentHeight: 800 })).toEqual({ left: '50%', top: '10px' });
  });
});
