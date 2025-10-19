import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { INDENT_STEP_PX, applyIndentDelta, getBlocksForRange } from '../indentUtils';

describe('indent utils', () => {
  let dom: JSDOM;
  let root: HTMLElement;

  beforeEach(() => {
    dom = new JSDOM(`<!doctype html><html><body>
      <div id="root" contenteditable="true">
        <p id="p1">Hello <strong>world</strong></p>
        <p id="p2">Second line</p>
        <div id="div1">A <span>nested</span> div</div>
      </div>
    </body></html>`);
    // @ts-expect-error attach globals
    global.window = dom.window as unknown as Window & typeof globalThis;
    // @ts-expect-error attach globals
    global.document = dom.window.document as unknown as Document;
    root = document.getElementById('root') as HTMLElement;
  });

  it('collects the nearest block when selection is collapsed', () => {
    const p1 = document.getElementById('p1') as HTMLElement;
    const range = document.createRange();
    range.selectNodeContents(p1.firstChild as Node);
    range.collapse(true);
    const blocks = getBlocksForRange(range, root);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toBe(p1);
  });

  it('collects multiple blocks for a multi-block selection', () => {
    const p1 = document.getElementById('p1') as HTMLElement;
    const p2 = document.getElementById('p2') as HTMLElement;
    const range = document.createRange();
    range.setStart(p1.firstChild as Node, 0);
    range.setEnd(p2.firstChild as Node, 3);
    const blocks = getBlocksForRange(range, root);
    expect(blocks).toEqual(expect.arrayContaining([p1, p2]));
  });

  it('applies and removes indent via margin-left', () => {
    const p2 = document.getElementById('p2') as HTMLElement;
    expect((p2 as HTMLElement).style.marginLeft).toBe('');
    applyIndentDelta([p2], INDENT_STEP_PX);
    expect((p2 as HTMLElement).style.marginLeft).toBe(`${INDENT_STEP_PX}px`);
    applyIndentDelta([p2], -INDENT_STEP_PX);
    expect((p2 as HTMLElement).style.marginLeft).toBe('');
  });
});


