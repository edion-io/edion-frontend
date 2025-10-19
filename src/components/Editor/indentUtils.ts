export const INDENT_STEP_PX = 24;

const BLOCK_TAGS = new Set([
  'ADDRESS','ARTICLE','ASIDE','BLOCKQUOTE','DETAILS','DIALOG','DD','DIV','DL','DT',
  'FIELDSET','FIGCAPTION','FIGURE','FOOTER','FORM','H1','H2','H3','H4','H5','H6',
  'HEADER','HR','LI','MAIN','NAV','OL','P','PRE','SECTION','TABLE','THEAD','TBODY',
  'TFOOT','TR','TD','TH','UL']);

const isBlockElement = (el: Element, root: HTMLElement): boolean => {
  if (el === root) return false;
  const display = window.getComputedStyle(el).display;
  if (display) {
    if (
      display === 'block' ||
      display === 'list-item' ||
      display === 'table-cell' ||
      display === 'flex' ||
      display === 'grid'
    ) {
      return true;
    }
  }
  // Fallback for environments without computed layout (e.g., jsdom)
  return BLOCK_TAGS.has(el.tagName);
};

const getNearestBlock = (node: Node, root: HTMLElement): HTMLElement | null => {
  let current: Node | null = node;
  while (current && current !== root) {
    if (current.nodeType === 1 && isBlockElement(current as Element, root)) return current as HTMLElement;
    current = current.parentNode;
  }
  return null;
};

const rangesIntersect = (a: Range, b: Range): boolean => {
  if (a.compareBoundaryPoints(Range.END_TO_START, b) <= 0) return false;
  if (a.compareBoundaryPoints(Range.START_TO_END, b) >= 0) return false;
  return true;
};

export const getBlocksForRange = (range: Range, root: HTMLElement): HTMLElement[] => {
  if (range.collapsed) {
    const block = getNearestBlock(range.startContainer, root);
    return block ? [block] : [];
  }
  const blocks: HTMLElement[] = [];
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        const el = node as Element;
        return isBlockElement(el, root) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    },
  );
  let current = walker.nextNode() as Element | null;
  while (current) {
    const el = current as HTMLElement;
    // Prefer the native intersectsNode if available (works well in jsdom/browsers)
    if (typeof (range as any).intersectsNode === 'function') {
      if ((range as any).intersectsNode(el)) {
        blocks.push(el);
      }
    } else {
      const elRange = document.createRange();
      elRange.selectNodeContents(el);
      if (rangesIntersect(range, elRange)) {
        blocks.push(el);
      }
    }
    current = walker.nextNode() as Element | null;
  }
  return Array.from(new Set(blocks));
};

const getCurrentMarginLeftPx = (el: HTMLElement): number => {
  const computed = window.getComputedStyle(el).marginLeft;
  const parsed = parseFloat(computed);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const applyIndentDelta = (els: HTMLElement[], deltaPx: number) => {
  els.forEach(el => {
    const current = getCurrentMarginLeftPx(el);
    const next = Math.max(0, current + deltaPx);
    if (next === 0) {
      el.style.marginLeft = '';
    } else {
      el.style.marginLeft = `${next}px`;
    }
  });
};


