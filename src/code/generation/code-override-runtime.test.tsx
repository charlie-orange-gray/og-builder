// Runtime check of a code override under `<Override>`: an override file's HOC is
// compiled the way the preview sandbox compiles project files, then rendered
// around a plain element. Covers the two things the wrapper promises — motion
// values in `style` reach the element, and `createStore` is shared.
import { describe, it, expect, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import * as FramerMotion from 'framer-motion';
import * as Runtime from '@revyme/runtime';
import { transform } from '@babel/standalone';

/** An override file as a user (or an import) would write it. */
const OVERRIDE_FILE = `import { jsx as _jsx } from "react/jsx-runtime";
import { forwardRef, useEffect, useRef, useState } from "react";
import { useMotionValue, useSpring } from 'framer-motion';
import { createStore } from '@revyme/runtime';

const useStore = createStore({ maxHeight: 560, minHeight: 440, maxDistance: 640 });

export function withMouseDistanceHeight(Component) {
  return forwardRef((props, ref) => {
    const [store] = useStore();
    const frameRef = useRef(null);
    const [isLargeScreen, setIsLargeScreen] = useState(false);
    const targetHeight = useMotionValue(store.maxHeight);
    const smoothHeight = useSpring(targetHeight, { damping: 25, stiffness: 150 });
    useEffect(() => {
      const check = () => setIsLargeScreen(window.innerWidth >= 1200);
      check();
      window.addEventListener("resize", check);
      return () => window.removeEventListener("resize", check);
    }, []);
    useEffect(() => {
      if (!isLargeScreen) { targetHeight.set(store.maxHeight); return; }
      const onMove = (e) => {
        if (!frameRef.current) return;
        const r = frameRef.current.getBoundingClientRect();
        const distance = Math.min(Math.abs(e.clientX - (r.left + r.width / 2)), store.maxDistance);
        targetHeight.set(store.maxHeight - (distance / store.maxDistance) * (store.maxHeight - store.minHeight));
      };
      document.addEventListener("mousemove", onMove);
      return () => document.removeEventListener("mousemove", onMove);
    }, [store.maxHeight, store.minHeight, store.maxDistance, isLargeScreen]);
    return _jsx(Component, {
      ref: (node) => { frameRef.current = node; if (typeof ref === "function") ref(node); else if (ref) ref.current = node; },
      ...props,
      style: { ...props.style, height: isLargeScreen ? smoothHeight : undefined },
    });
  });
}
`;

function loadOverrideFile(source: string): Record<string, unknown> {
  const { code } = transform(source, {
    filename: 'overrides/Effects.tsx',
    presets: [['env', { modules: 'commonjs' }], ['react', { runtime: 'automatic' }], 'typescript'],
  }) as { code: string };
  const modules: Record<string, unknown> = {
    react: React, 'react/jsx-runtime': jsxRuntime, 'framer-motion': FramerMotion, '@revyme/runtime': Runtime,
  };
  const exports: Record<string, unknown> = {};
  new Function('require', 'exports', 'module', code)((m: string) => {
    if (!(m in modules)) throw new Error(`unmapped import ${m}`);
    return modules[m];
  }, exports, { exports });
  return exports;
}

const settle = () => act(() => new Promise((r) => setTimeout(r, 1500)));

describe('code override at runtime', () => {
  afterEach(cleanup);

  it('drives a plain div\'s height from the pointer distance', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
    const mod = loadOverrideFile(OVERRIDE_FILE);
    const { Override } = Runtime;
    const { container } = render(
      <Override with={mod.withMouseDistanceHeight as Runtime.CodeOverride}>
        <div data-id="card" style={{ width: '400px' }} />
      </Override>,
    );
    const el = container.querySelector('[data-id="card"]') as HTMLElement;
    expect(el).toBeTruthy();
    el.getBoundingClientRect = () => ({ left: 0, width: 400, top: 0, height: 560, right: 400, bottom: 560, x: 0, y: 0, toJSON: () => ({}) });
    await settle();

    await act(async () => { document.dispatchEvent(new MouseEvent('mousemove', { clientX: 200 + 640 })); });
    await settle();
    expect(parseFloat(el.style.height)).toBeLessThan(450);

    await act(async () => { document.dispatchEvent(new MouseEvent('mousemove', { clientX: 200 })); });
    await settle();
    expect(parseFloat(el.style.height)).toBeGreaterThan(550);
  });

  it('shares state between overrides through createStore', async () => {
    const useStore = Runtime.createStore({ count: 0 });
    const withInc = (C: React.ComponentType<Record<string, unknown>>) => React.forwardRef<unknown, Record<string, unknown>>((p, ref) => {
      const [s, set] = useStore();
      return <C {...p} ref={ref} onClick={() => set({ count: s.count + 1 })} />;
    });
    const withCount = (C: React.ComponentType<Record<string, unknown>>) => React.forwardRef<unknown, Record<string, unknown>>((p, ref) => {
      const [s] = useStore();
      return <C {...p} ref={ref} text={`count ${s.count}`} />;
    });
    const { Override } = Runtime;
    const { container } = render(<div>
      <Override with={withInc}><button data-id="b" /></Override>
      <Override with={withCount}><p data-id="t">x</p></Override>
    </div>);
    const b = container.querySelector('[data-id="b"]') as HTMLElement;
    await act(async () => { b.click(); });
    await act(async () => { b.click(); });
    expect(container.querySelector('[data-id="t"]')!.textContent).toBe('count 2');
  });
});
