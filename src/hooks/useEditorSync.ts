import { useCallback, useEffect, useRef, useState } from 'react';
import useInlineMath from './useInlineMath';
import { parseLatexToHtml } from '../lib/parseLatex';
import { buildLatexDocument } from '../lib/buildLatex';

export type FormatCommandExecutor = (command: string, value?: string) => void;

interface UseEditorSyncOptions {
  showEditorSplit: boolean;
  initialLatex?: string;
  onLatexChange?: (latex: string) => void;
}

interface UseEditorSyncResult {
  editorRef: React.RefObject<HTMLDivElement>;
  editorContent: string;
  setEditorContent: React.Dispatch<React.SetStateAction<string>>;
  insertMathDelimiters: () => void;
  execFormatCommand: FormatCommandExecutor | null;
  setExecFormatCommand: (fn: FormatCommandExecutor) => void;
  showRawLatex: boolean;
  setShowRawLatex: React.Dispatch<React.SetStateAction<boolean>>;
  editorOnLeft: boolean;
  setEditorOnLeft: React.Dispatch<React.SetStateAction<boolean>>;
  isDraggingPane: boolean;
  setIsDraggingPane: React.Dispatch<React.SetStateAction<boolean>>;
  dragOverEditor: boolean;
  setDragOverEditor: React.Dispatch<React.SetStateAction<boolean>>;
  dragOverChat: boolean;
  setDragOverChat: React.Dispatch<React.SetStateAction<boolean>>;
  handleIndent: () => void;
  handleOutdent: () => void;
  insertTable: (rows: number, cols: number) => void;
}

const INDENT_STEP_PX = 24;

const isBlockElement = (el: Element, root: HTMLElement): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  if (el === root) return false;
  const display = window.getComputedStyle(el).display;
  return (
    display === 'block' ||
    display === 'list-item' ||
    display === 'table-cell' ||
    display === 'flex' ||
    display === 'grid'
  );
};

const getNearestBlock = (node: Node, root: HTMLElement): HTMLElement | null => {
  let current: Node | null = node;
  while (current && current !== root) {
    if (current instanceof HTMLElement && isBlockElement(current, root)) return current;
    current = current.parentNode;
  }
  return null;
};

const rangesIntersect = (a: Range, b: Range): boolean => {
  if (a.compareBoundaryPoints(Range.END_TO_START, b) <= 0) return false;
  if (a.compareBoundaryPoints(Range.START_TO_END, b) >= 0) return false;
  return true;
};

const getBlocksForRange = (range: Range, root: HTMLElement): HTMLElement[] => {
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
  let current = walker.currentNode as Element | null;
  while (current) {
    const el = current as HTMLElement;
    const elRange = document.createRange();
    elRange.selectNodeContents(el);
    if (rangesIntersect(range, elRange)) {
      blocks.push(el);
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

const applyIndentDelta = (els: HTMLElement[], deltaPx: number) => {
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

export default function useEditorSync(options: UseEditorSyncOptions): UseEditorSyncResult {
  const editorRef = useRef<HTMLDivElement>(null);
  const [editorContent, setEditorContent] = useState<string>('');
  const { insertMathDelimiters } = useInlineMath(editorRef as unknown as React.RefObject<HTMLElement>);
  const [execFormatCommand, setExecFormatCommandState] = useState<FormatCommandExecutor | null>(null);
  const [showRawLatex, setShowRawLatex] = useState(false);
  const suppressLatexSyncRef = useRef(false);
  const skipPopulateFromEditorRef = useRef(false);
  const [editorOnLeft, setEditorOnLeft] = useState(true);
  const [isDraggingPane, setIsDraggingPane] = useState(false);
  const [dragOverEditor, setDragOverEditor] = useState(false);
  const [dragOverChat, setDragOverChat] = useState(false);

  const setExecFormatCommand = useCallback((fn: FormatCommandExecutor) => {
    setExecFormatCommandState(() => fn);
  }, []);

  const handleIndent = useCallback(() => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) return;
    const savedRange = range.cloneRange();
    const blocks = getBlocksForRange(range, editorRef.current);
    if (blocks.length === 0) return;
    applyIndentDelta(blocks, INDENT_STEP_PX);
    selection.removeAllRanges();
    selection.addRange(savedRange);
    setEditorContent(editorRef.current.innerHTML);
    const event = new Event('input', { bubbles: true });
    editorRef.current.dispatchEvent(event);
  }, []);

  const handleOutdent = useCallback(() => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) return;
    const savedRange = range.cloneRange();
    const blocks = getBlocksForRange(range, editorRef.current);
    if (blocks.length === 0) return;
    applyIndentDelta(blocks, -INDENT_STEP_PX);
    selection.removeAllRanges();
    selection.addRange(savedRange);
    setEditorContent(editorRef.current.innerHTML);
    const event = new Event('input', { bubbles: true });
    editorRef.current.dispatchEvent(event);
  }, []);

  const insertTable = useCallback((rows: number, cols: number) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const selection = window.getSelection();
    if (!selection) return;
    const safeRows = Math.max(1, Math.min(50, Math.floor(Number(rows) || 0)));
    const safeCols = Math.max(1, Math.min(20, Math.floor(Number(cols) || 0)));
    let range: Range | null = selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    if (!range || !editorRef.current.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    const table = document.createElement('table');
    table.className = 'editor-table';
    table.setAttribute('data-rows', String(safeRows));
    table.setAttribute('data-cols', String(safeCols));
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (let i = 0; i < safeCols; i++) {
      const th = document.createElement('th');
      th.setAttribute('contenteditable', 'true');
      th.textContent = `Header ${i + 1}`;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    const bodyRows = Math.max(safeRows - 1, 1);
    for (let r = 0; r < bodyRows; r++) {
      const tr = document.createElement('tr');
      for (let c = 0; c < safeCols; c++) {
        const td = document.createElement('td');
        td.setAttribute('contenteditable', 'true');
        td.textContent = 'Cell';
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    const spacerP = document.createElement('p');
    const br = document.createElement('br');
    spacerP.appendChild(br);
    if (range) {
      range.deleteContents();
      const fragment = document.createDocumentFragment();
      fragment.appendChild(table);
      fragment.appendChild(spacerP);
      range.insertNode(fragment);
      const firstEditableCell = table.querySelector('td, th') as HTMLElement | null;
      if (firstEditableCell) {
        const newRange = document.createRange();
        newRange.selectNodeContents(firstEditableCell);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    }
    setEditorContent(editorRef.current.innerHTML);
    const event = new Event('input', { bubbles: true });
    editorRef.current.dispatchEvent(event);
  }, []);

  useEffect(() => {
    if (options.showEditorSplit && options.initialLatex) {
      if (skipPopulateFromEditorRef.current) {
        skipPopulateFromEditorRef.current = false;
        return;
      }
      try {
        const html = parseLatexToHtml(options.initialLatex);
        suppressLatexSyncRef.current = true;
        setEditorContent(html);
      } catch (_e) {
        console.error('Failed to parse LaTeX to HTML:', _e);
      }
    }
  }, [options.showEditorSplit, options.initialLatex]);

  useEffect(() => {
    if (!options.showEditorSplit) return;
    if (suppressLatexSyncRef.current) {
      suppressLatexSyncRef.current = false;
      return;
    }
    try {
      const doc = buildLatexDocument(editorContent);
      skipPopulateFromEditorRef.current = true;
      options.onLatexChange?.(doc);
    } catch (_e) {
      // Ignore conversion failures during typing
    }
  }, [editorContent, options.showEditorSplit, options.onLatexChange]);

  return {
    editorRef,
    editorContent,
    setEditorContent,
    insertMathDelimiters,
    execFormatCommand,
    setExecFormatCommand,
    showRawLatex,
    setShowRawLatex,
    editorOnLeft,
    setEditorOnLeft,
    isDraggingPane,
    setIsDraggingPane,
    dragOverEditor,
    setDragOverEditor,
    dragOverChat,
    setDragOverChat,
    handleIndent,
    handleOutdent,
    insertTable,
  };
}


