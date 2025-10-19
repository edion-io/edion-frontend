import { Button } from "../ui/button";
import { Toggle } from "../ui/toggle";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { 
  Bold, 
  Italic, 
  Underline, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  Code,
  Type,
  List,
  ListOrdered,
  Paintbrush,
  Highlighter,
  Indent,
  Outdent
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import TableSelector from "./TableSelector";
import ColorPicker from "./ColorPicker";
import TextColorIcon from "./TextColorIcon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { computeDesiredFormattingState } from "./markerFormattingLogic";

interface EditorToolbarProps {
  showRawLatex: boolean;
  toggleRawLatex: () => void;
  onInsertMath: () => void;
  onInsertTable: (rows: number, cols: number) => void;
  onIndent: () => void;
  onOutdent: () => void;
  editorRef: React.RefObject<HTMLDivElement>;
  onNewListCreated?: () => void;
  onFormatCommandReady?: (execFormatCommand: (command: string, value?: string) => void) => void;
  onApplyLatexFormat?: (command: string, value?: string) => void;
}

type TextAlignment = 'left' | 'center' | 'right';

// Types for list formatting helpers
interface ListContext {
  currentList: HTMLElement | null;
  listItem: HTMLElement | null;
  listType: 'UL' | 'OL' | null;
  selection: Selection | null;
  cursorNode: Node | null;
  cursorOffset: number;
  cursorListItemIndex: number;
  cursorPosition: 'beginning' | 'middle' | 'end';
}

interface ListItemData {
  textContent: string;
  indentLevel: string;
  paddingLeft: string;
  markerBold?: boolean;
  markerItalic?: boolean;
  markerUnderline?: boolean;
  justifyContent?: string;
  markerOffset?: string;
  fullStyle?: string | null;
}

interface AlignmentContext {
  currentAlignment: string;
  alignedParentNode: HTMLElement | null;
}

// Minimal wrapper to centralize use of deprecated Editing API and avoid TS deprecation warnings
const execLegacyCommand = (commandId: string, value?: string, showUI: boolean = false): boolean => {
  // Narrow the surface we touch on document for deprecated commands
  const doc = document as unknown as { execCommand?: (cmd: string, showUI?: boolean, value?: string) => boolean };
  return doc.execCommand ? doc.execCommand(commandId, showUI, value) : false;
};

const isLegacyCommandSupported = (commandId: string): boolean => {
  try {
    const doc = document as unknown as { queryCommandSupported?: (cmd: string) => boolean };
    return doc.queryCommandSupported ? doc.queryCommandSupported(commandId) : true;
  } catch {
    return true;
  }
};

const isLegacyCommandEnabled = (commandId: string): boolean => {
  try {
    const doc = document as unknown as { queryCommandEnabled?: (cmd: string) => boolean };
    return doc.queryCommandEnabled ? doc.queryCommandEnabled(commandId) : true;
  } catch {
    return true;
  }
};

const getLegacyCommandState = (commandId: string): boolean => {
  try {
    const doc = document as unknown as { queryCommandState?: (cmd: string) => boolean };
    return doc.queryCommandState ? doc.queryCommandState(commandId) : false;
  } catch {
    return false;
  }
};

// Selection preservation types and utilities (marker-based)
interface TextSelectionState {
  hasSelection: boolean;
  isCollapsed: boolean;
  startMarkerId?: string;
  endMarkerId?: string;
  // Minimal fallback context if markers are lost
  startPath?: number[];
  endPath?: number[];
}

const generateMarkerId = (suffix: string): string => {
  return `sel-marker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${suffix}`;
};

const createMarkerSpan = (id: string): HTMLSpanElement => {
  const span = document.createElement('span');
  span.setAttribute('data-selection-marker', 'true');
  span.setAttribute('data-marker-id', id);
  span.id = id;
  span.contentEditable = 'false';
  span.style.display = 'inline-block';
  span.style.width = '0px';
  span.style.overflow = 'hidden';
  span.style.lineHeight = '0';
  span.style.padding = '0';
  span.style.margin = '0';
  span.style.border = '0';
  span.style.userSelect = 'none';
  span.ariaHidden = 'true';
  // zero-width no-break to ensure presence without visible impact
  span.textContent = '\uFEFF';
  return span;
};

const getNodeIndexInParent = (node: Node): number => {
  if (!node.parentNode) return -1;
  const parent = node.parentNode;
  let index = 0;
  for (let child = parent.firstChild; child; child = child.nextSibling) {
    if (child === node) return index;
    index++;
  }
  return -1;
};

const buildIndexPathFromRoot = (root: HTMLElement, node: Node): number[] => {
  const path: number[] = [];
  let current: Node | null = node;
  while (current && current !== root) {
    const index = getNodeIndexInParent(current);
    if (index === -1) break;
    path.unshift(index);
    current = current.parentNode;
  }
  return path;
};

const resolveNodeByPath = (root: HTMLElement, path: number[]): Node | null => {
  let current: Node = root;
  for (const index of path) {
    const next = current.childNodes.item(index);
    if (!next) return null;
    current = next;
  }
  return current;
};

// Capture the current selection by inserting DOM markers
const captureTextSelection = (editorElement: HTMLElement): TextSelectionState => {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) {
    return { hasSelection: false, isCollapsed: true };
  }

  const range = selection.getRangeAt(0);
  const isCollapsed = range.collapsed;

  // Insert end marker first to avoid offset shifts
  const endId = generateMarkerId('end');
  const endMarker = createMarkerSpan(endId);
  const endRange = range.cloneRange();
  endRange.collapse(false);
  try {
    endRange.insertNode(endMarker);
  } catch (e) {
    // Fallback: try placing as sibling of container if insert fails
    const container = endRange.commonAncestorContainer;
    if (container && container.parentNode) {
      try { container.parentNode.insertBefore(endMarker, container.nextSibling); } catch (err) {
        if (import.meta.env.DEV) console.warn('captureTextSelection: end insert fallback failed');
      }
    }
  }

  let startId: string | undefined;
  let startMarker: HTMLSpanElement | null = null;
  if (!isCollapsed) {
    startId = generateMarkerId('start');
    startMarker = createMarkerSpan(startId);
    const startRange = range.cloneRange();
    startRange.collapse(true);
    try {
      startRange.insertNode(startMarker);
    } catch (e) {
      const container = startRange.commonAncestorContainer;
      if (container && container.parentNode) {
        try { container.parentNode.insertBefore(startMarker, container); } catch (err) {
          if (import.meta.env.DEV) console.warn('captureTextSelection: start insert fallback failed');
        }
      }
    }
  } else {
    // collapsed: reuse end as the single marker, but treat as caret
    startId = endId;
  }

  // Record minimal fallback paths from editor to markers
  const startNodeForPath: Node | null = (startMarker ?? endMarker);
  const startPath = startNodeForPath ? buildIndexPathFromRoot(editorElement, startNodeForPath) : undefined;
  const endPath = (!isCollapsed) ? buildIndexPathFromRoot(editorElement, endMarker) : startPath;

  return {
    hasSelection: true,
    isCollapsed,
    startMarkerId: startId,
    endMarkerId: isCollapsed ? undefined : endId,
    startPath,
    endPath
  };
};

// Restore text selection after DOM changes using markers
const restoreTextSelection = (editorElement: HTMLElement, selectionState: TextSelectionState): void => {
  if (!selectionState.hasSelection) return;

  const findMarker = (id?: string): HTMLElement | null => {
    if (!id) return null;
    return editorElement.querySelector(`[data-marker-id="${id}"]`) as HTMLElement | null;
  };

  const startMarker = findMarker(selectionState.startMarkerId);
  const endMarker = selectionState.isCollapsed ? startMarker : findMarker(selectionState.endMarkerId);

  try {
    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();

    if (startMarker && (!selectionState.isCollapsed ? endMarker : true)) {
      // Build range using markers
      range.setStartBefore(startMarker);
      if (selectionState.isCollapsed) {
        range.collapse(true);
      } else if (endMarker) {
        range.setEndBefore(endMarker);
      }

      selection.removeAllRanges();
      selection.addRange(range);

      // Clean up markers after applying selection
      if (endMarker && endMarker.parentNode) endMarker.parentNode.removeChild(endMarker);
      if (startMarker && startMarker !== endMarker && startMarker.parentNode) {
        startMarker.parentNode.removeChild(startMarker);
      }
      return;
    }

    // Fallback: markers not found, attempt to use recorded paths
    if (selectionState.startPath) {
      const startNode = resolveNodeByPath(editorElement, selectionState.startPath);
      if (startNode) {
        try {
          if (startNode.nodeType === Node.TEXT_NODE) {
            range.setStart(startNode, 0);
          } else {
            range.setStart(startNode, 0);
          }
        } catch (err) {
          if (import.meta.env.DEV) console.warn('restoreTextSelection: setStart fallback failed');
        }
      }
    }
    if (!selectionState.isCollapsed && selectionState.endPath) {
      const endNode = resolveNodeByPath(editorElement, selectionState.endPath);
      if (endNode) {
        try {
          if (endNode.nodeType === Node.TEXT_NODE) {
            range.setEnd(endNode, (endNode.textContent || '').length);
          } else {
            range.setEnd(endNode, endNode.childNodes.length);
          }
        } catch (err) {
          if (import.meta.env.DEV) console.warn('restoreTextSelection: setEnd fallback failed');
        }
      }
    } else {
      range.collapse(true);
    }

    // Only apply if range is valid
    selection.removeAllRanges();
    selection.addRange(range);
  } catch (e) {
    console.error('restoreTextSelection: failed to re-apply selection', e);
  } finally {
    // Best-effort marker cleanup if any remain
    try {
      const leftover = editorElement.querySelectorAll('[data-selection-marker="true"]');
      leftover.forEach(el => el.parentNode && el.parentNode.removeChild(el));
    } catch (err) {
      if (import.meta.env.DEV) console.warn('restoreTextSelection: leftover cleanup failed');
    }
  }
};

// Wrapper function to preserve selection during list operations
const preserveSelectionDuringListOperation = (
  editorElement: HTMLElement,
  operation: () => void
): void => {
  // Capture current selection
  const selectionState = captureTextSelection(editorElement);
  
  // Perform the operation
  operation();
  
  // Restore selection based on DOM stability rather than a fixed delay.
  // Use a MutationObserver to detect when changes settle, with a fallback timeout.
  try {
    let settled = false;
    const NO_MUTATION_WINDOW_MS = 60; // consider DOM stable after this quiet period
    const FALLBACK_TIMEOUT_MS = 400;  // hard cap in case no events arrive
    let quietTimer: ReturnType<typeof setTimeout> | null = null;

    const finalize = () => {
      if (settled) return;
      settled = true;
      if (quietTimer) {
        clearTimeout(quietTimer);
        quietTimer = null;
      }
      try {
        restoreTextSelection(editorElement, selectionState);
      } catch (err) {
        console.error('preserveSelectionDuringListOperation: restore failed', err);
      }
    };

    // Fallback timer to ensure we attempt restore even without mutations
    const fallbackTimer = setTimeout(finalize, FALLBACK_TIMEOUT_MS);

    // If MutationObserver is unavailable, fall back immediately to timeout path
    if (typeof MutationObserver === 'undefined') {
      return; // fallbackTimer will trigger finalize
    }

    const observer = new MutationObserver(() => {
      if (settled) return;
      if (quietTimer) clearTimeout(quietTimer);
      quietTimer = setTimeout(() => {
        observer.disconnect();
        clearTimeout(fallbackTimer);
        finalize();
      }, NO_MUTATION_WINDOW_MS);
    });

    // Start observing for any structural or text changes within the editor
    observer.observe(editorElement, {
      childList: true,
      characterData: true,
      subtree: true
    });

    // Also schedule a near-term check in case operation made synchronous changes only
    // without triggering mutations (rare but possible depending on the operation)
    if (!quietTimer) {
      quietTimer = setTimeout(() => {
        observer.disconnect();
        clearTimeout(fallbackTimer);
        finalize();
      }, NO_MUTATION_WINDOW_MS);
    }
  } catch (err) {
    console.error('preserveSelectionDuringListOperation: observer setup failed', err);
    // Last-resort fallback: attempt restore after a modest delay
    setTimeout(() => {
      try {
        restoreTextSelection(editorElement, selectionState);
      } catch (e) {
        console.error('preserveSelectionDuringListOperation: restore failed (fallback)', e);
      }
    }, 300);
  }
};

// Complete CSS named colors map (147 names)
const CSS_NAMED_COLORS: { [key: string]: string } = {
  aliceblue: '#f0f8ff', antiquewhite: '#faebd7', aqua: '#00ffff', aquamarine: '#7fffd4', azure: '#f0ffff',
  beige: '#f5f5dc', bisque: '#ffe4c4', black: '#000000', blanchedalmond: '#ffebcd', blue: '#0000ff',
  blueviolet: '#8a2be2', brown: '#a52a2a', burlywood: '#deb887', cadetblue: '#5f9ea0', chartreuse: '#7fff00',
  chocolate: '#d2691e', coral: '#ff7f50', cornflowerblue: '#6495ed', cornsilk: '#fff8dc', crimson: '#dc143c',
  cyan: '#00ffff', darkblue: '#00008b', darkcyan: '#008b8b', darkgoldenrod: '#b8860b', darkgray: '#a9a9a9',
  darkgreen: '#006400', darkgrey: '#a9a9a9', darkkhaki: '#bdb76b', darkmagenta: '#8b008b', darkolivegreen: '#556b2f',
  darkorange: '#ff8c00', darkorchid: '#9932cc', darkred: '#8b0000', darksalmon: '#e9967a', darkseagreen: '#8fbc8f',
  darkslateblue: '#483d8b', darkslategray: '#2f4f4f', darkslategrey: '#2f4f4f', darkturquoise: '#00ced1', darkviolet: '#9400d3',
  deeppink: '#ff1493', deepskyblue: '#00bfff', dimgray: '#696969', dimgrey: '#696969', dodgerblue: '#1e90ff',
  firebrick: '#b22222', floralwhite: '#fffaf0', forestgreen: '#228b22', fuchsia: '#ff00ff', gainsboro: '#dcdcdc',
  ghostwhite: '#f8f8ff', gold: '#ffd700', goldenrod: '#daa520', gray: '#808080', green: '#008000',
  greenyellow: '#adff2f', grey: '#808080', honeydew: '#f0fff0', hotpink: '#ff69b4', indianred: '#cd5c5c',
  indigo: '#4b0082', ivory: '#fffff0', khaki: '#f0e68c', lavender: '#e6e6fa', lavenderblush: '#fff0f5',
  lawngreen: '#7cfc00', lemonchiffon: '#fffacd', lightblue: '#add8e6', lightcoral: '#f08080', lightcyan: '#e0ffff',
  lightgoldenrodyellow: '#fafad2', lightgray: '#d3d3d3', lightgreen: '#90ee90', lightgrey: '#d3d3d3', lightpink: '#ffb6c1',
  lightsalmon: '#ffa07a', lightseagreen: '#20b2aa', lightskyblue: '#87cefa', lightslategray: '#778899', lightslategrey: '#778899',
  lightsteelblue: '#b0c4de', lightyellow: '#ffffe0', lime: '#00ff00', limegreen: '#32cd32', linen: '#faf0e6',
  magenta: '#ff00ff', maroon: '#800000', mediumaquamarine: '#66cdaa', mediumblue: '#0000cd', mediumorchid: '#ba55d3',
  mediumpurple: '#9370db', mediumseagreen: '#3cb371', mediumslateblue: '#7b68ee', mediumspringgreen: '#00fa9a', mediumturquoise: '#48d1cc',
  mediumvioletred: '#c71585', midnightblue: '#191970', mintcream: '#f5fffa', mistyrose: '#ffe4e1', moccasin: '#ffe4b5',
  navajowhite: '#ffdead', navy: '#000080', oldlace: '#fdf5e6', olive: '#808000', olivedrab: '#6b8e23',
  orange: '#ffa500', orangered: '#ff4500', orchid: '#da70d6', palegoldenrod: '#eee8aa', palegreen: '#98fb98',
  paleturquoise: '#afeeee', palevioletred: '#db7093', papayawhip: '#ffefd5', peachpuff: '#ffdab9', peru: '#cd853f',
  pink: '#ffc0cb', plum: '#dda0dd', powderblue: '#b0e0e6', purple: '#800080', rebeccapurple: '#663399',
  red: '#ff0000', rosybrown: '#bc8f8f', royalblue: '#4169e1', saddlebrown: '#8b4513', salmon: '#fa8072',
  sandybrown: '#f4a460', seagreen: '#2e8b57', seashell: '#fff5ee', sienna: '#a0522d', silver: '#c0c0c0',
  skyblue: '#87ceeb', slateblue: '#6a5acd', slategray: '#708090', slategrey: '#708090', snow: '#fffafa',
  springgreen: '#00ff7f', steelblue: '#4682b4', tan: '#d2b48c', teal: '#008080', thistle: '#d8bfd8',
  tomato: '#ff6347', turquoise: '#40e0d0', violet: '#ee82ee', wheat: '#f5deb3', white: '#ffffff',
  whitesmoke: '#f5f5f5', yellow: '#ffff00', yellowgreen: '#9acd32'
};

// Helper function to normalize color to hex
const normalizeColorToHex = (colorValue: string): string | undefined => {
  if (!colorValue) return undefined;
  const value = colorValue.trim();
  
  // Handle hex format
  if (value.startsWith('#')) {
    // Normalize 3-digit hex to 6-digit
    if (value.length === 4) {
      return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase();
    }
    // Return original for 6, 8 (alpha) or 4 (rgba shorthand) length
    if (value.length === 7 || value.length === 9 || value.length === 5) {
      return value.toLowerCase();
    }
    return undefined;
  }
  
  // Handle RGB/RGBA format
  if (value.toLowerCase().startsWith('rgb')) {
    const rgbMatch = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/i);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1], 10);
      const g = parseInt(rgbMatch[2], 10);
      const b = parseInt(rgbMatch[3], 10);
      const toHex = (c: number) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0');
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toLowerCase();
    }
  }

  // Handle HSL/HSLA format
  if (value.toLowerCase().startsWith('hsl')) {
    const hslMatch = value.match(/hsla?\(([-\d.]+),\s*([\d.]+)%\s*,\s*([\d.]+)%(?:,\s*[\d.]+)?\)/i);
    if (hslMatch) {
      const h = ((parseFloat(hslMatch[1]) % 360) + 360) % 360; // wrap
      const s = Math.max(0, Math.min(100, parseFloat(hslMatch[2]))) / 100;
      const l = Math.max(0, Math.min(100, parseFloat(hslMatch[3]))) / 100;
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = l - c / 2;
      let r1 = 0, g1 = 0, b1 = 0;
      if (h < 60) { r1 = c; g1 = x; b1 = 0; }
      else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
      else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
      else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
      else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
      else { r1 = c; g1 = 0; b1 = x; }
      const r = Math.round((r1 + m) * 255);
      const g = Math.round((g1 + m) * 255);
      const b = Math.round((b1 + m) * 255);
      const toHex = (n: number) => n.toString(16).padStart(2, '0');
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toLowerCase();
    }
  }

  // Handle full CSS named colors
  const lower = value.toLowerCase();
  if (CSS_NAMED_COLORS[lower]) {
    return CSS_NAMED_COLORS[lower];
  }

  // Parsing failed
  return undefined;
};

const EditorToolbar = ({ 
  showRawLatex, 
  toggleRawLatex,
  onInsertMath,
  onInsertTable,
  onIndent,
  onOutdent,
  editorRef,
  onNewListCreated,
  onFormatCommandReady,
  onApplyLatexFormat
}: EditorToolbarProps) => {
  // Track formatting states
  const [isBulletList, setIsBulletList] = useState(false);
  const [isNumberedList, setIsNumberedList] = useState(false);
  const [textAlignment, setTextAlignment] = useState<TextAlignment>('left');
  const [currentTextColor, setCurrentTextColor] = useState<string>('#000000');
  const [currentHighlightColor, setCurrentHighlightColor] = useState<string>('transparent');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);

  // Debounce timer for underline color synchronization
  const underlineSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check whether current selection contains underline formatting
  const selectionHasUnderline = (): boolean => {
    if (!editorRef.current) return false;
    try {
      // Fast path via execCommand state if available
      const doc = document as unknown as { queryCommandState?: (cmd: string) => boolean };
      if (typeof doc.queryCommandState === 'function' && getLegacyCommandState('underline')) {
        return true;
      }
    } catch (_) {
      // Some browsers may throw; fall back to DOM inspection
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return isUnderline;

    const range = selection.getRangeAt(0);
    const editorEl = editorRef.current;

    const walker = document.createTreeWalker(
      editorEl,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (!(node instanceof HTMLElement)) return NodeFilter.FILTER_SKIP;
          const el = node as HTMLElement;
          const inlineStyle = el.style?.textDecoration || '';
          const computed = window.getComputedStyle(el);
          const hasUnderline = el.tagName === 'U' || inlineStyle.includes('underline') || (computed.textDecorationLine || '').includes('underline');
          if (!hasUnderline) return NodeFilter.FILTER_SKIP;
          return range.intersectsNode(el) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
      }
    );

    return Boolean(walker.nextNode());
  };

  // Debounced scheduler for synchronizeUnderlineColor
  const scheduleSynchronizeUnderlineColor = (color: string) => {
    if (underlineSyncTimeoutRef.current) {
      clearTimeout(underlineSyncTimeoutRef.current);
    }
    underlineSyncTimeoutRef.current = setTimeout(() => {
      synchronizeUnderlineColor(color);
      underlineSyncTimeoutRef.current = null;
    }, 120);
  };
  
  // Track color history - maximum 6 recent colors
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const MAX_RECENT_COLORS = 6;
  
  // New ref to track if the editor has focus
  const editorHasFocusRef = useRef<boolean>(false);
  // New ref to store the last valid alignment when editor had focus
  const lastKnownAlignmentRef = useRef<TextAlignment>('left');
  
  // Use refs as the source of truth for colors to avoid stale closure issues
  const currentTextColorRef = useRef<string>('#000000');
  const currentHighlightColorRef = useRef<string>('transparent');
  
  // Force re-render when colors change by using a version counter
  const [colorVersion, setColorVersion] = useState(0);
  
  // Add refs to track recent user color changes
  const recentTextColorChangeRef = useRef<{ color: string; timestamp: number } | null>(null);
  const recentHighlightColorChangeRef = useRef<{ color: string; timestamp: number } | null>(null);
  const COLOR_OVERRIDE_DURATION = 1000; // 1 second to prevent overrides
  
  // Helper functions to update colors and keep ref and state in sync
  const updateTextColor = (color: string) => {
    currentTextColorRef.current = color;
    setCurrentTextColor(color);
    setColorVersion(prev => prev + 1); // Force re-render
  };
  
  const updateHighlightColor = (color: string) => {
    currentHighlightColorRef.current = color;
    setCurrentHighlightColor(color);
    setColorVersion(prev => prev + 1); // Force re-render
  };
  
  // Function to add a color to the history
  const addToColorHistory = (color: string) => {
    // Don't add transparent to history
    if (color === 'transparent') return;
    
    setRecentColors(prev => {
      // Remove this color if it already exists (to move it to the front)
      const filteredColors = prev.filter(c => c !== color);
      // Add new color to the beginning
      const newColors = [color, ...filteredColors];
      // Limit to maximum number of recent colors
      return newColors.slice(0, MAX_RECENT_COLORS);
    });
  };
  
  // Add new useEffect for focus handling
  useEffect(() => {
    if (!editorRef.current) return;
    const editorEl = editorRef.current;

    // Remove the aggressive focus handling
    // We'll rely on more intentional focus management instead
    
    return () => {
      // Clean up any remaining listeners
    };
  }, [editorRef]);
  
  // Expose execFormatCommand to parent component
  useEffect(() => {
    if (onFormatCommandReady) {
      onFormatCommandReady(execFormatCommand);
    }
  }, [onFormatCommandReady]);
  
  // List item selection helpers (extracted for readability and testability)
  const findContainingListItem = (range: Range, editorRoot: HTMLElement | null): HTMLElement | null => {
    let node: Node | null = range.commonAncestorContainer;
    while (node && node !== editorRoot) {
      if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'LI') {
        return node as HTMLElement;
      }
      node = node.parentNode;
    }
    return null;
  };

  const checkExternalEncompassment = (range: Range, listItem: HTMLElement): HTMLElement | null => {
    if (range.startContainer !== listItem && range.endContainer !== listItem && range.intersectsNode(listItem)) {
      const listItemRange = document.createRange();
      listItemRange.selectNodeContents(listItem);
      const startsBeforeOrAt = range.compareBoundaryPoints(Range.START_TO_START, listItemRange) <= 0;
      const endsAfterOrAt = range.compareBoundaryPoints(Range.END_TO_END, listItemRange) >= 0;
      if (startsBeforeOrAt && endsAfterOrAt) {
        return listItem;
      }
    }
    return null;
  };

  const checkInternalFullCoverage = (range: Range, listItem: HTMLElement): HTMLElement | null => {
    const selectionStartsAtBeginning =
      (range.startContainer === listItem && range.startOffset === 0) ||
      (range.startContainer === listItem.firstChild && range.startOffset === 0);
    const selectionEndsAtEnd =
      (range.endContainer === listItem && range.endOffset === listItem.childNodes.length) ||
      (range.endContainer === listItem.lastChild &&
        range.endOffset === (range.endContainer.nodeType === Node.TEXT_NODE
          ? range.endContainer.textContent?.length || 0
          : (range.endContainer as HTMLElement).childNodes.length));
    if (selectionStartsAtBeginning && selectionEndsAtEnd) {
      return listItem;
    }
    return null;
  };

  const checkSingleTextNodeSelection = (range: Range, listItem: HTMLElement): HTMLElement | null => {
    if (
      listItem.childNodes.length === 1 &&
      listItem.firstChild?.nodeType === Node.TEXT_NODE &&
      range.startContainer === listItem.firstChild &&
      range.endContainer === listItem.firstChild
    ) {
      const textNode = listItem.firstChild as ChildNode;
      const fullTextSelected = range.startOffset === 0 && range.endOffset === (textNode.textContent?.length || 0);
      if (fullTextSelected) {
        return listItem;
      }
    }
    return null;
  };

  const checkTextContentMatch = (range: Range, listItem: HTMLElement): HTMLElement | null => {
    const listItemText = listItem.textContent || '';
    const selectedText = range.toString();
    if (selectedText.trim() === listItemText.trim() && selectedText.length > 0) {
      return listItem;
    }
    return null;
  };

  // Function to check if a list item is fully selected
  const isListItemFullySelected = (selection: Selection): HTMLElement | null => {
    if (!selection || !selection.rangeCount) return null;
    const range = selection.getRangeAt(0);
    const listItem = findContainingListItem(range, editorRef.current);
    if (!listItem) return null;
    return (
      checkExternalEncompassment(range, listItem) ||
      checkInternalFullCoverage(range, listItem) ||
      checkSingleTextNodeSelection(range, listItem) ||
      checkTextContentMatch(range, listItem) ||
      null
    );
  };
  
  // Modify execFormatCommand to only focus when necessary for text operations
  const execFormatCommand = (command: string, value?: string) => {
    if (!editorRef.current) {
      return;
    }

    // Only focus for direct text formatting commands
    const shouldFocus = ['bold', 'italic', 'underline', 'foreColor', 'hiliteColor', 
                        'justifyLeft', 'justifyCenter', 'justifyRight'].includes(command);
    
    if (shouldFocus) {
      // Store current selection state
      const selection = window.getSelection();
      const hadSelection = selection && selection.rangeCount > 0;
      const range = hadSelection ? selection?.getRangeAt(0).cloneRange() : null;

      // Focus if needed for formatting commands
      editorRef.current.focus();
      
      // If no selection, create one at the last known position
      if (!hadSelection && editorRef.current.lastChild) {
        const newRange = document.createRange();
        newRange.selectNodeContents(editorRef.current.lastChild);
        newRange.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(newRange);
      }
    }
    
    // Enhanced list item formatting logic for all formatting commands
    let listItem: HTMLElement | null = null;
    let shouldFormatMarker = false;
    const selection = window.getSelection();
    
    if (selection && ['bold', 'italic', 'underline', 'foreColor'].includes(command)) {
      // First, find if we're in a list item
      let node = selection.anchorNode;
      
      while (node && node !== editorRef.current) {
        if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'LI') {
          listItem = node as HTMLElement;
          break;
        }
        node = node.parentNode;
      }
      
      if (listItem) {
        const range = selection.getRangeAt(0);
        
        // Check if entire list item is selected
        const isFullySelected = isListItemFullySelected(selection) !== null;
        
        // Check if cursor is at the beginning with no selection
        const isAtBeginningWithoutSelection = range.collapsed && 
          ((range.startContainer === listItem && range.startOffset === 0) ||
           (range.startContainer === listItem.firstChild && range.startOffset === 0));
        
        // Format the marker if:
        // 1. The entire list item is selected, OR
        // 2. The cursor is at the beginning without any selection
        shouldFormatMarker = isFullySelected || isAtBeginningWithoutSelection;
      }
    }
    
    // Handle list marker formatting for all supported commands
    if (listItem && shouldFormatMarker) {
      // For formatting commands on fully selected list items, we want to make both marker and content consistent
      // Instead of just toggling, we need to determine the desired state
      let desiredFormattingState = false;
      
      // Handle different command types
      if (command === 'bold' || command === 'italic' || command === 'underline') {
        const markerClass = `marker-${command}`;
        const hasMarkerFormatting = listItem.classList.contains(markerClass);
        
        // Check for content formatting - need to detect partial formatting too
        let hasAnyContentFormatting = false;
        let hasFullContentFormatting = false;
        
        // Get the current selection range
        const range = selection.getRangeAt(0);
        
        // Check if there's any formatting in the selected content
        const selectedContent = range.cloneContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(selectedContent);
        
        // Look for formatting tags in the selected content
        const formatTags = command === 'bold' ? ['B', 'STRONG'] : 
                          command === 'italic' ? ['I', 'EM'] : 
                          ['U'];
        
        const foundFormatTags = formatTags.some(tag => 
          tempDiv.querySelector(tag) !== null
        );
        
        // Also check if the selection itself has formatting applied
        const queryCommandState = getLegacyCommandState(command);
        
        hasAnyContentFormatting = foundFormatTags || queryCommandState;
        
        // To check for full formatting, we need to see if the entire selection is formatted
        // This is tricky with contentEditable, so we'll use a heuristic:
        // If queryCommandState is true AND we don't find any unformatted text nodes, assume full formatting
        if (queryCommandState) {
          // Create a range for just text content to see if there are unformatted parts
          const walker = document.createTreeWalker(
            tempDiv,
            NodeFilter.SHOW_TEXT,
            null
          );
          
          let hasUnformattedText = false;
          let textNode: Node | null;
          const textNodeDetails: Array<{ text: string | null; isFormatted: boolean; parentNodeName?: string; hasContent?: boolean }> = [];
          while ((textNode = walker.nextNode())) {
            // Check if this text node is inside a formatting tag
            let parent = textNode.parentNode;
            let isFormatted = false;
            while (parent && parent !== tempDiv) {
              if (formatTags.includes(parent.nodeName)) {
                isFormatted = true;
                break;
              }
              parent = parent.parentNode;
            }
            
            textNodeDetails.push({
              text: textNode.textContent,
              isFormatted,
              parentNodeName: textNode.parentNode?.nodeName,
              hasContent: !!textNode.textContent?.trim()
            });
            
            if (!isFormatted && textNode.textContent?.trim()) {
              hasUnformattedText = true;
            }
          }
          
          hasFullContentFormatting = !hasUnformattedText;
          
          // Additional check: if the entire list item content is selected and queryCommandState is true,
          // we should trust queryCommandState more than our tag analysis for full selections
          // BUT only if we don't have unformatted text (mixed formatting case)
          const isFullListItemSelection = isListItemFullySelected(selection) !== null;
          if (isFullListItemSelection && queryCommandState && !hasUnformattedText) {
            // For full list item selections, if queryCommandState is true AND we don't have unformatted text,
            // trust queryCommandState. The browser might be using inline styles or other formatting methods
            // that our tag-based analysis doesn't detect
            hasFullContentFormatting = true;
          }
          
        } else {
          // If queryCommandState is false, check if there might still be formatting tags
          // This can happen in some edge cases
          hasFullContentFormatting = false;
          
          // But for full list item selections, if we found format tags, consider it formatted
          const isFullListItemSelection = isListItemFullySelected(selection) !== null;
          if (isFullListItemSelection && foundFormatTags) {
            hasFullContentFormatting = true;
          }
        }
        
        // Determine desired state using a clear linear decision sequence
        // 1) compute all booleans first (done above)
        // 2) set default rule, 3) apply cursor-at-beginning override, 4) final override independent of desired state
        const isFullListItemSelection = isListItemFullySelected(selection) !== null;
        const isCursorAtBeginningWithoutSelection = range.collapsed && ((
          (range.startContainer === listItem && range.startOffset === 0) ||
          (range.startContainer === listItem.firstChild && range.startOffset === 0)
        ));

        // Use pure helper to compute decision with linear rules
        const decision = computeDesiredFormattingState({
          hasMarkerFormatting,
          hasAnyContentFormatting,
          hasFullContentFormatting,
          queryCommandState,
          isFullListItemSelection,
          isCursorAtBeginningWithoutSelection
        });
        desiredFormattingState = decision.desiredFormattingState;
        hasFullContentFormatting = decision.hasFullContentFormatting;
        
        // Debug the decision values

        
        // Apply marker formatting based on desired state
        if (desiredFormattingState) {
          listItem.classList.add(markerClass);
        } else {
          listItem.classList.remove(markerClass);
        }
        
        // For content formatting, we need to apply the desired state
        // If we want formatting but content is not fully formatted, OR
        // if we want no formatting but content has any formatting, then toggle
        const needsContentToggle = 
          (desiredFormattingState && !hasFullContentFormatting) ||
          (!desiredFormattingState && hasAnyContentFormatting);
        
        if (needsContentToggle) {
          // Continue to execCommand below
          
          // Special handling for mixed formatting - if we want to ADD formatting but there's mixed content,
          // we need to handle this more carefully than just using execCommand
          if (desiredFormattingState && hasAnyContentFormatting && !hasFullContentFormatting) {
            // For mixed formatting, we need to:
            // 1. Remove all existing formatting of this type
            // 2. Apply formatting to the entire selection
            
            if (['bold', 'italic', 'underline'].includes(command)) {
              // First, remove all existing formatting of this type
              let attempts = 0;
              while (getLegacyCommandState(command) && attempts < 5) {
                execLegacyCommand(command);
                attempts++;
              }
              // Then apply formatting to ensure everything is formatted
              execLegacyCommand(command);
              
              // Update format states
              updateFormatStates();
              
              // Trigger input event to ensure changes are saved
              if (editorRef.current) {
                const event = new Event('input', { bubbles: true });
                editorRef.current.dispatchEvent(event);
              }
              return; // Skip the normal execCommand below
            }
          }
          

        } else {
          // Update states to reflect the current formatting
          switch (command) {
            case 'bold':
              setIsBold(desiredFormattingState);
              break;
            case 'italic':
              setIsItalic(desiredFormattingState);
              break;
            case 'underline':
              setIsUnderline(desiredFormattingState);
              break;
          }

          // Update format states
          updateFormatStates();
          
          // Trigger input event to ensure changes are saved
          if (editorRef.current) {
            const event = new Event('input', { bubbles: true });
            editorRef.current.dispatchEvent(event);
          }
          return; // Don't execute the content command since content is already in desired state
        }
      } else if (command === 'foreColor') {
        // Handle text color for markers using CSS custom properties
        const currentMarkerColor = listItem.style.getPropertyValue('--marker-color');
        
        if (currentMarkerColor === value) {
          // If same color, remove the custom property (reset to default)
          listItem.style.removeProperty('--marker-color');
        } else {
          // Temporarily disable marker transitions for immediate color change
          listItem.classList.add('disable-marker-transition');
          
          // Set the new marker color
          listItem.style.setProperty('--marker-color', value || '#000000');
          
          // Force a style recalculation to ensure immediate application
          void listItem.offsetHeight; // Trigger reflow
          
          // Re-enable transitions after the DOM update is complete
          requestAnimationFrame(() => {
            listItem.classList.remove('disable-marker-transition');
          });
        }
      }
      
      // For cursor at beginning without selection, don't execute the content command for colors
      // Only format the marker
      const range = selection.getRangeAt(0);
      const isAtBeginningWithoutSelection = range.collapsed && 
        ((range.startContainer === listItem && range.startOffset === 0) ||
         (range.startContainer === listItem.firstChild && range.startOffset === 0));
      
      if (isAtBeginningWithoutSelection && command === 'foreColor') {
        // Update states based on the command
        updateTextColor(value || '#000000');

        // Update format states
        updateFormatStates();
        
        // Trigger input event to ensure changes are saved
        if (editorRef.current) {
          const event = new Event('input', { bubbles: true });
          editorRef.current.dispatchEvent(event);
        }
        return; // Don't execute the content command
      }
      
      // For bold/italic/underline, handle the existing logic
      if (['bold', 'italic', 'underline'].includes(command) && isAtBeginningWithoutSelection) {
        // Update states
        switch (command) {
          case 'bold':
            setIsBold(listItem.classList.contains('marker-bold'));
            break;
          case 'italic':
            setIsItalic(listItem.classList.contains('marker-italic'));
            break;
          case 'underline':
            setIsUnderline(listItem.classList.contains('marker-underline'));
            break;
        }

        // Update format states
        updateFormatStates();
        
        // Trigger input event to ensure changes are saved
        if (editorRef.current) {
          const event = new Event('input', { bubbles: true });
          editorRef.current.dispatchEvent(event);
        }
        return; // Don't execute the content command
      }
    }

    // Execute command for the content (this will handle both marker and content when entire item is selected)
    const commandResult = execLegacyCommand(command, value);
    
    if (!commandResult) {
      // Debug: Check if the browser supports this command
      const isSupported = isLegacyCommandSupported(command);
      const isEnabled = isLegacyCommandEnabled(command);
    }

    // Update states
    switch (command) {
      case 'bold': {
        const boldState = getLegacyCommandState(command);
        setIsBold(boldState);
        break;
      }
      case 'italic': {
        const italicState = getLegacyCommandState(command);
        setIsItalic(italicState);
        break;
      }
      case 'underline': {
        const underlineState = getLegacyCommandState(command);
        setIsUnderline(underlineState);
        break;
      }
      case 'foreColor':
        updateTextColor(value || '#000000');
        // Ensure underline color follows text color only when underline is active/present
        {
          const nextColor = value || '#000000';
          if (selectionHasUnderline()) {
            scheduleSynchronizeUnderlineColor(nextColor);
          }
        }
        break;
      case 'hiliteColor':
        updateHighlightColor(value === 'transparent' ? 'transparent' : (value || 'transparent'));
        break;
    }

    // Update format states
    updateFormatStates();
    
    // Trigger input event to ensure changes are saved
    if (editorRef.current) {
      const event = new Event('input', { bubbles: true });
      editorRef.current.dispatchEvent(event);
    }
  };

  // Cleanup any pending debounced tasks on unmount
  useEffect(() => {
    return () => {
      if (underlineSyncTimeoutRef.current) {
        clearTimeout(underlineSyncTimeoutRef.current);
        underlineSyncTimeoutRef.current = null;
      }
    };
  }, []);
  
  // Function to check if selection is in a specific list type
  const isInListType = (listType: string): boolean => {
    if (!editorRef.current) return false;
    
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return false;
    
    let node = selection.anchorNode;
    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        if (element.tagName === listType) {
          return true;
        }
      }
      node = node.parentNode;
    }
    return false;
  };
  
  // Function to determine the current text alignment
  const getCurrentAlignment = (): TextAlignment => {    
    if (!editorRef.current) {
      return lastKnownAlignmentRef.current;
    }
    
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
      return lastKnownAlignmentRef.current;
    }
    
    // Get the current node where the cursor is
    let node = selection.anchorNode;
    
    // First check if we're in a list, since lists need special handling
    let parentList = null;
    let currentNode = node;
    let foundAlignedElement = false;
    
        // Check direct parents for inline alignment style first (highest priority)
    while (currentNode && currentNode !== editorRef.current) {
      if (currentNode.nodeType === Node.ELEMENT_NODE) {
        const element = currentNode as HTMLElement;

        
        // First check for direct inline style (highest priority)
        if (element.style && element.style.textAlign) {
                  // Only consider valid alignments
        if (element.style.textAlign === 'center') {
          lastKnownAlignmentRef.current = 'center';
          return 'center';
        }
        if (element.style.textAlign === 'right') {
          lastKnownAlignmentRef.current = 'right';
          return 'right';
        }
        if (element.style.textAlign === 'left') {
          lastKnownAlignmentRef.current = 'left';
          return 'left';
        }
        }
        
        // Special handling for lists
        if (element.tagName === 'UL' || element.tagName === 'OL') {
          parentList = element;
          // Check the list's alignment directly
          const listStyle = window.getComputedStyle(element);
          const listAlign = listStyle.textAlign;
          
          // Only update if we found a meaningful alignment
          if (listAlign === 'center') {
            lastKnownAlignmentRef.current = 'center';
            foundAlignedElement = true;
            return 'center';
          }
          if (listAlign === 'right') {
            lastKnownAlignmentRef.current = 'right';
            foundAlignedElement = true;
            return 'right';
          }
          if (listAlign === 'left' || listAlign === 'start') {
            lastKnownAlignmentRef.current = 'left';
            foundAlignedElement = true;
            return 'left';
          }
        }
        
        // Special handling for paragraphs and div elements
        if (element.tagName === 'P' || element.tagName === 'DIV') {
          const computedStyle = window.getComputedStyle(element);
          const textAlign = computedStyle.textAlign;
          
          // Check if we have the data-alignment-fixed attribute (our custom marker)
          const hasFixedAlignment = element.hasAttribute('data-alignment-fixed');
          
          // If this paragraph has an explicit inline text-align style, use it
          if (element.style.textAlign) {
            if (element.style.textAlign === 'center') {
              lastKnownAlignmentRef.current = 'center';
              foundAlignedElement = true;
              return 'center';
            }
            if (element.style.textAlign === 'right') {
              lastKnownAlignmentRef.current = 'right';
              foundAlignedElement = true;
              return 'right';
            }
            if (element.style.textAlign === 'left') {
              lastKnownAlignmentRef.current = 'left';
              foundAlignedElement = true;
              return 'left';
            }
          }
          
          // If no inline style but has data-alignment-fixed, use computed style
          if (hasFixedAlignment) {
            if (textAlign === 'center') {
              lastKnownAlignmentRef.current = 'center';
              foundAlignedElement = true;
              return 'center';
            }
            if (textAlign === 'right') {
              lastKnownAlignmentRef.current = 'right';
              foundAlignedElement = true;
              return 'right';
            }
            // If we explicitly set left alignment, ensure it's honored
            lastKnownAlignmentRef.current = 'left';
            foundAlignedElement = true;
            return 'left';
          }
          
          // For paragraphs with no explicit alignment, treat as left (don't fall back to cached value)
          if (!element.style.textAlign && !hasFixedAlignment) {
            lastKnownAlignmentRef.current = 'left';
            foundAlignedElement = true;
            return 'left';
          }
        }
      }
      currentNode = currentNode.parentNode;
    }
    
    // If we haven't found list or paragraph with alignment, check any element's computed style
    while (node && node !== editorRef.current && !foundAlignedElement) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const computedStyle = window.getComputedStyle(element);
        const textAlign = computedStyle.textAlign;
        
        // Only update for non-default alignments (center/right) - leave left alone
        // unless it's explicitly set as an inline style
        if (textAlign === 'center') {
          lastKnownAlignmentRef.current = 'center';
          foundAlignedElement = true;
          return 'center';
        }
        if (textAlign === 'right') {
          lastKnownAlignmentRef.current = 'right';
          foundAlignedElement = true;
          return 'right';
        }
        if (element.style.textAlign === 'left') {
          lastKnownAlignmentRef.current = 'left';
          foundAlignedElement = true;
          return 'left';
        }
      }
      node = node.parentNode;
    }
    
    return lastKnownAlignmentRef.current; // Return last known alignment if nothing found
  };
  
  // Function to get the computed color at a specific selection point
  const getColorAtSelection = (): string => {
    // Default to current toolbar color if no selection or editor ref
    if (!editorRef.current) return currentTextColorRef.current;
    
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return currentTextColorRef.current;
    
    // Get the focused node and check if it's inside the editor
    const range = selection.getRangeAt(0);
    let node = range.startContainer;
    
    // For text nodes, get their parent element
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.parentElement) return '#000000';
      node = node.parentElement;
    }
    
    // Check if this node or any parent has a specific color style
    let currentNode = node as HTMLElement;
    while (currentNode && currentNode !== editorRef.current) {
      // Check inline style first (highest priority)
      if (currentNode.style && currentNode.style.color) {
        const parsed = normalizeColorToHex(currentNode.style.color);
        if (parsed) return parsed;
      }
      
      // Check for font elements with color attribute
      if (currentNode.tagName === 'FONT' && currentNode.getAttribute('color')) {
        const parsedAttr = normalizeColorToHex(currentNode.getAttribute('color') || '');
        if (parsedAttr) return parsedAttr;
      }
      
      // Move up to parent
      if (!currentNode.parentElement) break;
      currentNode = currentNode.parentElement;
    }
    
    // If no explicit color is found in the ancestors, check computed style
    // of the immediate container at the selection point
    if (node instanceof HTMLElement) {
      const computedColor = window.getComputedStyle(node).color;
      if (computedColor && computedColor !== 'rgb(0, 0, 0)') {
        const parsedComputed = normalizeColorToHex(computedColor);
        if (parsedComputed) return parsedComputed;
      }
    }
    
    // Default to current toolbar color if no color is detected
    return currentTextColorRef.current;
  };

  // Function to get the highlight color at the current selection
  const getHighlightColorAtSelection = (): string => {
    // Default to current toolbar highlight color if no selection or editor ref
    if (!editorRef.current) return currentHighlightColorRef.current;
    
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return currentHighlightColorRef.current;
    
    // Get the focused node and check if it's inside the editor
    const range = selection.getRangeAt(0);
    let node = range.startContainer;
    
    // For text nodes, get their parent element
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.parentElement) return 'transparent';
      node = node.parentElement;
    }
    
    // Check if this node or any parent has a background color style
    let currentNode = node as HTMLElement;
    while (currentNode && currentNode !== editorRef.current) {
      // Check inline style first (highest priority)
      if (currentNode.style && currentNode.style.backgroundColor && 
          currentNode.style.backgroundColor !== 'transparent' && 
          currentNode.style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
        const parsedBg = normalizeColorToHex(currentNode.style.backgroundColor);
        if (parsedBg) return parsedBg;
      }
      
      // Move up to parent
      if (!currentNode.parentElement) break;
      currentNode = currentNode.parentElement;
    }
    
    // If no explicit highlight is found in the ancestors, check computed style
    if (node instanceof HTMLElement) {
      const computedBgColor = window.getComputedStyle(node).backgroundColor;
      // Only return computed background color if it's not transparent and not the editor's default
      if (computedBgColor && 
          computedBgColor !== 'transparent' && 
          computedBgColor !== 'rgba(0, 0, 0, 0)') {
        // Make sure it's not the default background of the editor or its parent elements
        const editorBgColor = window.getComputedStyle(editorRef.current).backgroundColor;
        if (computedBgColor !== editorBgColor) {
          const parsedComputedBg = normalizeColorToHex(computedBgColor);
          if (parsedComputedBg) return parsedComputedBg;
        }
      }
    }
    
    // Default to current toolbar highlight color if no highlight color is detected
    return currentHighlightColorRef.current;
  };
  
  // Update formatting states based on current selection
  const updateFormatStates = (force: boolean = false) => {
    if (!force && !editorHasFocusRef.current) {
      return;
    }
    
    const isBullet = isInListType('UL');
    const isNumbered = isInListType('OL');
    const alignment = getCurrentAlignment();
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      // Check formatting states using document.queryCommandState
      const boldState = getLegacyCommandState('bold');
      const italicState = getLegacyCommandState('italic');
      const underlineState = getLegacyCommandState('underline');
      
      setIsBold(boldState);
      setIsItalic(italicState);
      setIsUnderline(underlineState);
      
      // Check for list item marker formatting
      const isInList = isBullet || isNumbered;
      
      if (isInList) {
        // Find the list item containing the selection
        let listItemElement = null;
        let currentNode = selection.anchorNode;
        
                  while (currentNode && currentNode !== editorRef.current) {
            if (currentNode.nodeType === Node.ELEMENT_NODE && 
                (currentNode as HTMLElement).tagName === 'LI') {
              listItemElement = currentNode as HTMLElement;
              break;
            }
            currentNode = currentNode.parentNode;
          }
        
        // If we found a list item, check for marker formatting classes and colors
        if (listItemElement) {
          // If the entire list item is selected, consider the marker formatting
          const isFullySelected = isListItemFullySelected(selection) !== null;
          
          // Also check if cursor is at beginning without selection
          const range = selection.getRangeAt(0);
          const isAtBeginningWithoutSelection = range.collapsed && 
            ((range.startContainer === listItemElement && range.startOffset === 0) ||
             (range.startContainer === listItemElement.firstChild && range.startOffset === 0));
          
          if (isFullySelected || isAtBeginningWithoutSelection) {
            // Update toolbar states based on marker classes
            const hasMarkerBold = listItemElement.classList.contains('marker-bold');
            const hasMarkerItalic = listItemElement.classList.contains('marker-italic');
            const hasMarkerUnderline = listItemElement.classList.contains('marker-underline');
            
            // Update the state only if the marker has formatting
            // (This might override the content formatting, but that's ok when selecting the whole item)
            if (hasMarkerBold) {
              setIsBold(true);
            }
            if (hasMarkerItalic) {
              setIsItalic(true);
            }
            if (hasMarkerUnderline) {
              setIsUnderline(true);
            }
            
            // Check for marker colors
            const listMarkerColor = listItemElement.style.getPropertyValue('--marker-color');
            
            if (listMarkerColor) {
              const parsedMarker = normalizeColorToHex(listMarkerColor);
              if (parsedMarker) updateTextColor(parsedMarker);
            }
          }
        }
      }
    }
    
    // Update list states
    setIsBulletList(isBullet);
    setIsNumberedList(isNumbered);
    
    // Use functional update to ensure we're comparing against the latest state.
    setTextAlignment(currentAlignment => {
      if (currentAlignment !== alignment) {
        return alignment;
      }
      return currentAlignment;
    });
    
    // Update text color - but only if we're not in a list with marker formatting
    // and only if the detected color is significantly different from current
    const detectedColor = getColorAtSelection();
    
    // Check if there's a recent user text color change
    const now = Date.now();
    const hasRecentTextColorChange = recentTextColorChangeRef.current && 
      (now - recentTextColorChangeRef.current.timestamp) < COLOR_OVERRIDE_DURATION;
    
    // Check if editor is empty or has minimal content
    const editorContent = editorRef.current?.textContent?.trim() || '';
    const isEditorEmpty = editorContent.length === 0;
    
    if (hasRecentTextColorChange) {
      // Don't update - preserve user's recent color choice
      // But ensure the ref matches the recent user choice
      if (recentTextColorChangeRef.current.color !== currentTextColorRef.current) {
        updateTextColor(recentTextColorChangeRef.current.color);
      }
    } else if (isEditorEmpty) {
      // If editor is empty, don't change the color unless it's the initial black state
      // This prevents the color from reverting to black when all text is deleted
      if (currentTextColorRef.current === '#000000' && detectedColor !== '#000000') {
        updateTextColor(detectedColor);
      }
      // Otherwise, keep the current color
    } else {
      // Use ref for comparison to avoid stale state issues
      const currentRefColor = currentTextColorRef.current;
      const colorDifference = Math.abs(parseInt(detectedColor.slice(1), 16) - parseInt(currentRefColor.slice(1), 16));
      const isSignificantColorChange = colorDifference > 0x111111; // Only update if colors are significantly different
      
      // Only update text color in these cases:
      // 1. If this is the initial state (currentTextColor is default black)
      // 2. If there's a significant color difference (user moved to differently colored text)
      // 3. If we're in a list and detected marker color (handled above)
      if ((currentRefColor === '#000000' && detectedColor !== '#000000') || isSignificantColorChange) {
        updateTextColor(detectedColor);
      }
    }
    
    // Update highlight color - similar logic
    const detectedHighlight = getHighlightColorAtSelection();
    
    // Check if there's a recent user highlight color change
    const hasRecentHighlightColorChange = recentHighlightColorChangeRef.current && 
      (now - recentHighlightColorChangeRef.current.timestamp) < COLOR_OVERRIDE_DURATION;
    
    if (hasRecentHighlightColorChange) {
      // Don't update - preserve user's recent color choice
      // But ensure the ref matches the recent user choice
      if (recentHighlightColorChangeRef.current.color !== currentHighlightColorRef.current) {
        updateHighlightColor(recentHighlightColorChangeRef.current.color);
      }
    } else if (isEditorEmpty) {
      // If editor is empty, don't change the highlight color unless it's the initial transparent state
      // This prevents the highlight color from reverting to transparent when all text is deleted
      if (currentHighlightColorRef.current === 'transparent' && detectedHighlight !== 'transparent') {
        updateHighlightColor(detectedHighlight);
      }
      // Otherwise, keep the current highlight color
    } else {
      // Use ref for comparison to avoid stale state issues
      const currentRefHighlight = currentHighlightColorRef.current;
      // For highlight, be more conservative - only update if current is transparent and we detect a color
      if (currentRefHighlight === 'transparent' && detectedHighlight !== 'transparent') {
        updateHighlightColor(detectedHighlight);
      } else if (detectedHighlight === 'transparent' && currentRefHighlight !== 'transparent') {
        // If we detect transparent but have a color set, check if we moved to non-highlighted text
        // Don't change - user might have selected non-highlighted text but still wants the highlight color in toolbar
      }
    }
  };
  
  // Track selection changes to update format states
  useEffect(() => {
    if (!editorRef.current) return;
    const editorEl = editorRef.current;
    const handleSelectionChange = () => {
      // Only update format states if the editor has focus
      if (editorHasFocusRef.current) {
        updateFormatStates();
      }
      
      // Debug selection changes during list operations
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const isInEditor = editorRef.current?.contains(range.startContainer);
        
        if (isInEditor) {
          // Track selection changes for any necessary UI updates
        }
      }
    };
    
    // Update format states initially
    updateFormatStates();
    
    // Listen for selection changes
    document.addEventListener('selectionchange', handleSelectionChange);
    
    // Add mouseup listener to editor to catch selection changes
    const handleEditorMouseUp = () => {
      // Small delay to ensure selection is fully updated
      setTimeout(() => {
        updateFormatStates();
      }, 10);
    };
    
    editorEl.addEventListener('mouseup', handleEditorMouseUp);
    
    // Add focus/blur event listeners to track when editor loses/gains focus
    const handleEditorFocus = () => {
      editorHasFocusRef.current = true;
      updateFormatStates(true); // Force update on focus
    };
    
    const handleEditorBlur = () => {
      editorHasFocusRef.current = false;
      // Don't update the format states on blur to keep the current toolbar state
    };
    
    editorEl.addEventListener('focus', handleEditorFocus);
    editorEl.addEventListener('blur', handleEditorBlur);
    
    // When the document is modified (e.g., via undo/redo), ensure the toolbar reflects the new state
    const handleEditorInput = () => {
      // Wait until the DOM has settled, then update states (forced)
      setTimeout(() => updateFormatStates(true), 0);
    };
    
    // Listen for undo/redo key combinations globally to refresh toolbar state even if input event doesn't fire
    const handleKeyDown = (e: KeyboardEvent) => {
      const isUndo = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey;
      const isRedo = (e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'z' && e.shiftKey || e.key.toLowerCase() === 'y');
      if (isUndo || isRedo) {
        setTimeout(() => updateFormatStates(true), 0);
      }
    };
    
    editorEl.addEventListener('input', handleEditorInput);
    editorEl.addEventListener('keydown', handleKeyDown);
    
    // Clean up
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      editorEl.removeEventListener('keydown', handleKeyDown);
      editorEl.removeEventListener('mouseup', handleEditorMouseUp);
      editorEl.removeEventListener('focus', handleEditorFocus);
      editorEl.removeEventListener('blur', handleEditorBlur);
      editorEl.removeEventListener('input', handleEditorInput);
    };
  }, [editorRef.current]);
  
  // Apply text color
  const applyTextColor = (color: string) => {
    // Track this as a recent user color change
    recentTextColorChangeRef.current = { color, timestamp: Date.now() };
    
    // Update both ref and state
    updateTextColor(color);
    
    // Use the enhanced execFormatCommand that handles list markers
    execFormatCommand('foreColor', color);
    
    // Add to color history
    addToColorHistory(color);
  };
  
  // Apply highlight color
  const applyHighlightColor = (color: string) => {
    // Track this as a recent user color change
    recentHighlightColorChangeRef.current = { color, timestamp: Date.now() };
    
    // Update both ref and state
    updateHighlightColor(color);
    
    // Use standard execCommand instead of enhanced version (no marker formatting for highlighting)
    execLegacyCommand('hiliteColor', color);
    
    // Update format states
    updateFormatStates();
    
    // Trigger input event to ensure changes are saved
    if (editorRef.current) {
      const event = new Event('input', { bubbles: true });
      editorRef.current.dispatchEvent(event);
    }
    
    // Add to color history (except transparent)
    if (color !== 'transparent') {
      addToColorHistory(color);
    }
  };

  // Special handling for alignment to ensure it works with lists
  const handleAlignment = (alignType: 'justifyLeft' | 'justifyCenter' | 'justifyRight') => {
    if (!editorRef.current) return;
    
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
      return;
    }
    
    // Find if we're in a list - improved detection for empty list items
    let listElement = null;
    let listItem = null;
    let node = selection.anchorNode;
    
    // First, find both the list element and list item
    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        
        if (element.tagName === 'LI' && !listItem) {
          listItem = element;
        }
        if (element.tagName === 'UL' || element.tagName === 'OL') {
          listElement = element;
          break;
        }
      }
      node = node.parentNode;
    }
    
    // Additional check: if we didn't find a list but we're at the range boundary,
    // check if the range intersects with any list in the editor
    if (!listElement && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const allLists = editorRef.current.querySelectorAll('ul, ol');
      
      for (const list of allLists) {
        // Check if the selection range intersects with this list
        if (range.intersectsNode(list)) {
          listElement = list as HTMLElement;
          
          // Also find the specific list item if we haven't already
          if (!listItem) {
            const listItems = list.querySelectorAll('li');
            for (const item of listItems) {
              if (range.intersectsNode(item)) {
                listItem = item as HTMLElement;
                break;
              }
            }
          }
          break;
        }
      }
    }
    
    // Also check what element we're directly in
    node = selection.anchorNode;
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentNode;
    }

    if (listElement) {
      // The key issue: ordered lists (OL) created in non-left aligned text
      // have their style.textAlign property directly set, which isn't being properly overridden
      
      // First, determine the actual target alignment value
      const targetAlign = alignType === 'justifyLeft' ? 'left' : 
                         alignType === 'justifyCenter' ? 'center' : 'right';
      
      // Clear any direct alignment style first to reset any previous alignment
      (listElement as HTMLElement).style.removeProperty('text-align');
      
      // Then set the new alignment
      (listElement as HTMLElement).style.textAlign = targetAlign;
      
      // IMPORTANT FIX: Also clear and set text-align on all list items to prevent conflicting styles
      const listItems = listElement.querySelectorAll('li');
      listItems.forEach(item => {
        // Remove any text-align on list items that might override the parent
        (item as HTMLElement).style.removeProperty('text-align');
        // Apply the same alignment to ensure consistency
        (item as HTMLElement).style.textAlign = targetAlign;
      });
      
      // For right and center alignment, ensure list items have the proper list-style-position
      if (alignType !== 'justifyLeft' && listElement.tagName === 'UL') {
        const listItems = listElement.querySelectorAll('li');
        listItems.forEach(item => {
          (item as HTMLElement).style.listStylePosition = 'inside';
          
          // Also apply justify-content for UL items just like OL items
          (item as HTMLElement).style.removeProperty('justify-content');
          if (alignType === 'justifyCenter') {
            (item as HTMLElement).style.justifyContent = 'center';
          } else if (alignType === 'justifyRight') {
            (item as HTMLElement).style.justifyContent = 'flex-end';
          }
        });
      }
      
      // For ordered lists, handle proper justification based on the align type
      if (listElement.tagName === 'OL') {
        const listItems = listElement.querySelectorAll('li');
        listItems.forEach(item => {
          // First clear any existing justify-content style
          (item as HTMLElement).style.removeProperty('justify-content');
          
          if (alignType === 'justifyCenter') {
            (item as HTMLElement).style.justifyContent = 'center';
          } else if (alignType === 'justifyRight') {
            (item as HTMLElement).style.justifyContent = 'flex-end';
          }
        });
        
        // Schedule a non-blocking visual update to avoid synchronous reflow
        const listEl = listElement as HTMLElement;
        const originalWillChange = listEl.style.willChange;
        // Hint to the browser that the element is about to change so it can optimize
        listEl.style.willChange = 'contents';
        // Use rAF to let the browser batch style and layout work
        requestAnimationFrame(() => {
          // If a measurement is needed, do it in this read phase
          // e.g., void listEl.getBoundingClientRect();
          requestAnimationFrame(() => {
            // Restore original will-change to clean up
            listEl.style.willChange = originalWillChange;
          });
        });
      }
      
      // Update content
      if (editorRef.current) {
        const event = new Event('input', { bubbles: true });
        editorRef.current.dispatchEvent(event);
      }
      
      // Force update the UI state immediately
      setTextAlignment(targetAlign as TextAlignment);
      // Also update the last known alignment ref
      lastKnownAlignmentRef.current = targetAlign as TextAlignment;
      
      // Update format states
      updateFormatStates();
    } else {
      // Standard alignment for non-list elements
      execFormatCommand(alignType);
      
      // Update the last known alignment ref based on the command
      const newAlignment: TextAlignment = 
        alignType === 'justifyLeft' ? 'left' :
        alignType === 'justifyCenter' ? 'center' : 'right';
      lastKnownAlignmentRef.current = newAlignment;
    }
  };

  // Helper function to detect current list context
  const detectListContext = (): ListContext => {
    if (!editorRef.current) {
      return {
        currentList: null,
        listItem: null,
        listType: null,
        selection: null,
        cursorNode: null,
        cursorOffset: 0,
        cursorListItemIndex: -1,
        cursorPosition: 'middle'
      };
    }

    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
      return {
        currentList: null,
        listItem: null,
        listType: null,
        selection: null,
        cursorNode: null,
        cursorOffset: 0,
        cursorListItemIndex: -1,
        cursorPosition: 'middle'
      };
    }

    let currentList = null;
    let listItem = null;
    let node = selection.anchorNode;
    
    // Find the current list and list item if any
    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        if (element.tagName === 'LI') {
          listItem = element;
        }
        if (element.tagName === 'UL' || element.tagName === 'OL') {
          currentList = element;
          break;
        }
      }
      node = node.parentNode;
    }

    // Calculate cursor information
    const selectionRange = selection.getRangeAt(0);
    const cursorNode = selectionRange.startContainer;
    const cursorOffset = selectionRange.startOffset;
    
    let cursorListItemIndex = -1;
    let cursorPosition: 'beginning' | 'middle' | 'end' = 'middle';
    
    if (currentList && listItem) {
      const allItems = Array.from(currentList.querySelectorAll('li'));
      cursorListItemIndex = allItems.indexOf(listItem);
      
      if (cursorNode.nodeType === Node.TEXT_NODE) {
        if (cursorOffset === 0) {
          cursorPosition = 'beginning';
        } else if (cursorOffset === cursorNode.textContent?.length) {
          cursorPosition = 'end';
        }
      }
    }

    return {
      currentList,
      listItem,
      listType: currentList?.tagName as 'UL' | 'OL' | null,
      selection,
      cursorNode,
      cursorOffset,
      cursorListItemIndex,
      cursorPosition
    };
  };

  // Helper function to preserve list item data
  const preserveListItemData = (listItems: HTMLElement[]): ListItemData[] => {
    return listItems.map(item => ({
      textContent: item.textContent || '',
      indentLevel: item.style.getPropertyValue('--indent-level'),
      paddingLeft: item.style.paddingLeft,
      markerBold: item.classList.contains('marker-bold'),
      markerItalic: item.classList.contains('marker-italic'),
      markerUnderline: item.classList.contains('marker-underline'),
      justifyContent: item.style.justifyContent,
      markerOffset: item.style.getPropertyValue('--marker-offset'),
      fullStyle: item.getAttribute('style')
    }));
  };

  // Helper function to detect alignment context
  const detectAlignmentContext = (): AlignmentContext => {
    // First, check if we should use the toolbar state instead of DOM scanning
    // This prevents using stale DOM alignment when the user has explicitly changed alignment
    const toolbarAlignment = textAlignment || lastKnownAlignmentRef.current;
    
    let currentAlignment = 'left';
    let alignedParentNode = null;
    
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
      return { currentAlignment: toolbarAlignment, alignedParentNode };
    }

    const range = selection.getRangeAt(0);
    let node = range.startContainer;
    
    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const computedStyle = window.getComputedStyle(element);
        const textAlign = computedStyle.textAlign;
        
        if (textAlign === 'center' || textAlign === 'right') {
          currentAlignment = textAlign;
          alignedParentNode = element;
          break;
        }
      }
      node = node.parentNode;
    }
    
    // If we found DOM alignment but it conflicts with toolbar state, prefer toolbar state
    if (currentAlignment !== toolbarAlignment) {
      currentAlignment = toolbarAlignment;
      alignedParentNode = null; // Clear the aligned parent since we're overriding
    }
    
    return { currentAlignment, alignedParentNode };
  };

  // Helper function to apply alignment to lists
  const applyListAlignment = (listElement: HTMLElement, alignment: string, listType: 'UL' | 'OL') => {
    // Always set the alignment explicitly, including 'left'
    listElement.style.textAlign = alignment;
    
    if (listType === 'OL') {
      const listItems = listElement.querySelectorAll('li');
      listItems.forEach(item => {
        (item as HTMLElement).style.removeProperty('justify-content');
        if (alignment === 'center') {
          (item as HTMLElement).style.justifyContent = 'center';
        } else if (alignment === 'right') {
          (item as HTMLElement).style.justifyContent = 'flex-end';
        }
        // For left alignment, justify-content should be removed (which we already did above)
      });
    }
    
    if (listType === 'UL') {
      const listItems = listElement.querySelectorAll('li');
      listItems.forEach(item => {
        (item as HTMLElement).style.removeProperty('justify-content');
        
        if (alignment === 'center' || alignment === 'right') {
          (item as HTMLElement).style.listStylePosition = 'inside';
          if (alignment === 'center') {
            (item as HTMLElement).style.justifyContent = 'center';
          } else if (alignment === 'right') {
            (item as HTMLElement).style.justifyContent = 'flex-end';
          }
        } else {
          // For left alignment, reset list-style-position to default
          (item as HTMLElement).style.removeProperty('list-style-position');
        }
      });
    }
    
    lastKnownAlignmentRef.current = alignment as TextAlignment;
    setTextAlignment(alignment as TextAlignment);
  };

  // Helper function to restore indentation to list items
  const restoreIndentationToItems = (items: HTMLElement[], itemData: ListItemData[]) => {
    items.forEach((item, index) => {
      if (index < itemData.length) {
        const originalData = itemData[index];
        
        let indentLevelSuccessfullySet = false;

        // Try to use originalData.indentLevel
        if (originalData.indentLevel && originalData.indentLevel !== '') {
          const parsedOriginalIndent = parseInt(originalData.indentLevel, 10);
          if (!isNaN(parsedOriginalIndent) && parsedOriginalIndent >= 0) {
            // During restoration, set both paddingLeft directly AND --indent-level
            // This ensures immediate visual effect while maintaining the CSS custom property
            item.style.paddingLeft = `${parsedOriginalIndent}px`;
            item.style.setProperty('--indent-level', `${parsedOriginalIndent}px`);
            indentLevelSuccessfullySet = true;
          }
        }

        // Fallback to paddingLeft
        if (!indentLevelSuccessfullySet && originalData.paddingLeft) {
          item.style.paddingLeft = originalData.paddingLeft;
          // Also set --indent-level to match for consistency
          const paddingValue = parseInt(originalData.paddingLeft, 10);
          if (!isNaN(paddingValue)) {
            item.style.setProperty('--indent-level', `${paddingValue}px`);
          }
        }

        // Ensure --indent-level is set
        if (!indentLevelSuccessfullySet) {
          item.style.paddingLeft = '0px';
          item.style.setProperty('--indent-level', '0px');
        }
      }
    });
  };

  // Helper function to restore marker formatting
  const restoreMarkerFormatting = (items: HTMLElement[], itemData: ListItemData[], listType: 'UL' | 'OL') => {
    // Skip UL: marker formatting only applies to ordered lists.
    // Bullets are rendered via CSS list-style and cannot carry per-item inline marker styles.
    if (listType !== 'OL') return;
    
    items.forEach((item, index) => {
      if (index < itemData.length) {
        const originalData = itemData[index];
        
        if (originalData.markerBold) item.classList.add('marker-bold');
        if (originalData.markerItalic) item.classList.add('marker-italic');
        if (originalData.markerUnderline) item.classList.add('marker-underline');
        
        if (originalData.justifyContent) {
          item.style.justifyContent = originalData.justifyContent;
        }
        
        // Set marker offset based on indent level
        const indentLevel = parseInt(item.style.getPropertyValue('--indent-level') || '0', 10);
        const baseMarkerOffset = 0.5;
        const indentStep = 1.5;
        const newMarkerOffset = baseMarkerOffset + (indentLevel * indentStep);
        item.style.setProperty('--marker-offset', `${newMarkerOffset}em`);
      }
    });
  };

  // Helper function to manage transitions during operations
  const disableTransitionsDuring = (callback: () => void) => {
    const editorEl = editorRef.current;
    const originalEditorTransition = editorEl?.style.transition;

    // Ensure a unique editor id is present on the editor element
    let editorId = editorEl?.dataset?.editorId as string | undefined;
    if (editorEl && !editorId) {
      editorId = `rte-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      editorEl.dataset.editorId = editorId;
    }

    // Create a temporary style element to disable transitions scoped to this editor only
    let tempStyle: HTMLStyleElement | null = null;
    if (editorId) {
      tempStyle = document.createElement('style');
      tempStyle.id = `temp-disable-transitions-${editorId}`;
      tempStyle.textContent = `
        [data-editor-id="${editorId}"] ol li,
        [data-editor-id="${editorId}"] ul li {
          transition: none !important;
        }
        [data-editor-id="${editorId}"] ol li *,
        [data-editor-id="${editorId}"] ul li * {
          transition: none !important;
        }
      `;
      document.head.appendChild(tempStyle);
    }

    // Store and disable transitions on the editor
    if (editorEl) {
      editorEl.style.transition = 'none';
    }

    // Store and disable transitions on all current list items within this editor
    const allListItems = editorEl?.querySelectorAll('li') || [];
    const originalTransitions: string[] = [];
    allListItems.forEach((item, index) => {
      const htmlItem = item as HTMLElement;
      originalTransitions[index] = htmlItem.style.transition;
      htmlItem.style.transition = 'none !important';
    });

    callback();

    // Re-enable transitions after operation with a delay to ensure DOM changes are complete
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Remove the temporary style element for this editor only
        if (editorId) {
          const styleElement = document.getElementById(`temp-disable-transitions-${editorId}`);
          if (styleElement) {
            styleElement.remove();
          }
        }

        // Restore editor transition
        if (editorEl) {
          editorEl.style.transition = originalEditorTransition || '';
        }

        // Restore list item transitions, but need to find them again since they may have changed
        const newListItems = editorEl?.querySelectorAll('li') || [];
        newListItems.forEach((item, index) => {
          const htmlItem = item as HTMLElement;
          // Only restore if we have a stored transition for this index
          if (index < originalTransitions.length) {
            htmlItem.style.transition = originalTransitions[index] || '';
          } else {
            // For new items, remove the explicit transition to allow CSS to take over
            htmlItem.style.removeProperty('transition');
          }
        });
      });
    });
  };

  // Helper function to toggle list off (convert to paragraphs)
  const toggleListOff = (context: ListContext, itemData: ListItemData[]) => {
    if (!context.currentList || !editorRef.current) return;
    
    const currentAlign = context.currentList.style.textAlign || '';
    const fragment = document.createDocumentFragment();
    
    // Convert each list item to a paragraph
    const originalListItems = Array.from(context.currentList.querySelectorAll('li')) as HTMLElement[];

    originalListItems.forEach((li, idx) => {
      const paragraph = document.createElement('p');

      // Move (not clone) all child nodes into the new paragraph to preserve live elements like <math-field>
      while (li.firstChild) {
        paragraph.appendChild(li.firstChild); // this removes from li and appends to paragraph
      }

      // Ensure visibility if paragraph ended up empty
      if (paragraph.innerHTML.trim() === '') {
        paragraph.innerHTML = '<br>'; // maintain cursor visibility
      }

      // Restore style data from saved snapshot (indentation, etc.)
      const data = itemData[idx];
      if (data) {
        if (data.indentLevel && data.indentLevel.trim() !== '' && data.indentLevel !== '0px' && data.indentLevel !== '0') {
          paragraph.style.paddingLeft = data.indentLevel;
        } else if (data.paddingLeft && data.paddingLeft.trim() !== '' && data.paddingLeft !== '0px' && data.paddingLeft !== '0') {
          paragraph.style.paddingLeft = data.paddingLeft;
        }
      }

      // Apply alignment
      if (currentAlign && currentAlign !== 'left' && currentAlign !== 'start') {
        paragraph.style.textAlign = currentAlign;
        paragraph.setAttribute('data-alignment-fixed', 'true');
      } else {
        paragraph.style.textAlign = 'left';
        paragraph.setAttribute('data-alignment-fixed', 'true');
      }

      fragment.appendChild(paragraph);
    });
    
    // Get reference to first paragraph before replacement
    const firstParagraph = fragment.firstChild as HTMLElement;
    
    // Replace the list with paragraphs
    context.currentList.parentNode?.replaceChild(fragment, context.currentList);
    
    // Position cursor in the first newly created paragraph
    if (firstParagraph) {
      const selection = window.getSelection();
      if (selection) {
        const newRange = document.createRange();
        if (firstParagraph.firstChild && firstParagraph.firstChild.nodeType === Node.TEXT_NODE) {
          newRange.setStart(firstParagraph.firstChild, 0);
        } else if (firstParagraph.firstChild) {
          newRange.setStart(firstParagraph.firstChild, 0);
        } else {
          newRange.setStart(firstParagraph, 0);
        }
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
        
        // Focus the editor to ensure the cursor is visible
        if (editorRef.current) {
          editorRef.current.focus();
        }
      }
    }
    
    // Update content
    if (editorRef.current) {
      const event = new Event('input', { bubbles: true });
      editorRef.current.dispatchEvent(event);
    }
    
    // Force immediate update of format states to ensure we detect the new paragraph
    setTimeout(() => {
      updateFormatStates();
    }, 10);
  };

  // Helper function to convert between list types
  const convertBetweenListTypes = (fromType: 'UL' | 'OL', toType: 'UL' | 'OL', context: ListContext, itemData: ListItemData[]) => {
    if (!context.currentList) return;
    
    const alignmentToTransfer = context.currentList.style.textAlign;
    
    disableTransitionsDuring(() => {
      /*
        Rebuild the list by MOVING (not cloning) existing <li> elements into a new list
        of the desired type. This preserves the original DOM nodes so the browser's
        undo stack can correctly restore them without duplicating content.
      */

      const oldList = context.currentList;
      const newList = document.createElement(toType);

      // Transfer list items by reference (no cloning).
      while (oldList.firstChild) {
        newList.appendChild(oldList.firstChild);
      }

      // Copy alignment/style from old list.
      if (alignmentToTransfer) {
        newList.style.textAlign = alignmentToTransfer;
      }

      // Copy classes except the old list style class.
      newList.className = oldList.className;
      newList.classList.remove('list-disc', 'list-decimal');
      if (toType === 'OL') {
        newList.classList.add('list-decimal');
      } else {
        newList.classList.add('list-disc');
      }

      // Replace list in DOM (single mutation for undo).
      oldList.parentNode?.replaceChild(newList, oldList);

      // Ensure indentation & marker formatting restored on moved items.
      const newItems = Array.from(newList.querySelectorAll('li')) as HTMLElement[];
      restoreIndentationToItems(newItems, itemData);
      restoreMarkerFormatting(newItems, itemData, toType);

      // Restore selection in the first item.
      const selection = window.getSelection();
      const firstItem = newList.querySelector('li');
      if (selection && firstItem) {
        const newRange = document.createRange();
        newRange.setStart(firstItem, 0);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }

      // Trigger an input event to notify of the content change.
      if (editorRef.current) {
        const event = new Event('input', { bubbles: true, cancelable: true });
        editorRef.current.dispatchEvent(event);
      }
    });
    
  };

  // Helper function to create new list from text
  const createNewListFromText = (listType: 'UL' | 'OL', alignmentContext: AlignmentContext, skipNewListCallback: boolean = false) => {
    if (!editorRef.current) return;
    
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    
    let initialIndentPx = 0;
    let blockToClearPadding: HTMLElement | null = null;
    
    // Check for existing indentation
    const range = selection.getRangeAt(0);
    let currentElementForIndentSearch: Node | null = range.startContainer;
    
    while (currentElementForIndentSearch && currentElementForIndentSearch !== editorRef.current) {
      if (currentElementForIndentSearch.nodeType === Node.ELEMENT_NODE) {
        const htmlElement = currentElementForIndentSearch as HTMLElement;
        if (['P', 'DIV'].includes(htmlElement.tagName) && htmlElement.style.paddingLeft) {
          const pxVal = parseInt(htmlElement.style.paddingLeft, 10);
          if (!isNaN(pxVal) && pxVal > 0) {
            initialIndentPx = pxVal;
            blockToClearPadding = htmlElement;
            break;
          }
        }
      }
      currentElementForIndentSearch = currentElementForIndentSearch.parentNode;
    }
    
    // This operation needs to be undo-friendly. Using execCommand is the simplest way.
    // Math fields will be handled by the browser's default behavior for wrapping content.
    // The complexity of preserving/restoring them manually is high and brittle.
    execLegacyCommand(listType === 'UL' ? 'insertUnorderedList' : 'insertOrderedList');

    // Post-command adjustments are still needed for styling and indentation.
    // Find the new list
    const newSelection = window.getSelection();
    let newListElement: HTMLElement | null = null;
    let firstItem: HTMLLIElement | null = null;
    
    if (newSelection && newSelection.rangeCount > 0) {
      const listNodeAnchor = newSelection.anchorNode;
      let tempNode = listNodeAnchor;
      while (tempNode && tempNode !== editorRef.current) {
        if (tempNode.nodeType === Node.ELEMENT_NODE && 
            ((tempNode as HTMLElement).tagName === 'UL' || (tempNode as HTMLElement).tagName === 'OL')) {
          newListElement = tempNode as HTMLElement;
          break;
        }
        tempNode = tempNode.parentNode;
      }
      
      if (newListElement) {
        firstItem = newListElement.querySelector('li:first-child');
      }
    }
    
    // Clear padding from original block if it now contains the list
    if (blockToClearPadding && editorRef.current?.contains(blockToClearPadding) && 
        newListElement && blockToClearPadding.contains(newListElement) && 
        blockToClearPadding !== editorRef.current) {
      blockToClearPadding.style.removeProperty('padding-left');
    }
    
    if (newListElement && firstItem) {
      // Add appropriate classes
      if (listType === 'OL') {
        firstItem.classList.add('list-spacing-fixed');
        if (!newListElement.classList.contains('list-decimal')) {
          newListElement.classList.add('list-decimal');
        }
      } else {
        if (!newListElement.classList.contains('list-disc')) {
          newListElement.classList.add('list-disc');
        }
      }

      // Ensure first item is not visually empty
      const firstItemText = (firstItem.textContent || '').replace(/\u200B/g, '').trim();
      const firstItemIsEmpty = firstItemText === '' || firstItem.innerHTML === '<br>' || firstItem.innerHTML === '';
      if (firstItemIsEmpty) {
        firstItem.innerHTML = '<br>';
      }

      // Trigger callback for all lists to ensure proper cursor positioning
      if (!skipNewListCallback) {
        onNewListCreated?.();
      }
      
      // Update content
      if (editorRef.current) {
        const event = new Event('input', { bubbles: true });
        editorRef.current.dispatchEvent(event);
      }
    }
  };

  // Handle list formatting specifically - now much cleaner!
  const handleListFormatting = (listType: 'UL' | 'OL') => {
    if (!editorRef.current) return;

    const context = detectListContext();
    if (!context.selection) return;

    // If already in a list of the same type, toggle it off
    if (context.currentList && context.listType === listType) {
      // Use selection preservation for toggleing off
      preserveSelectionDuringListOperation(editorRef.current, () => {
        const itemData = preserveListItemData(Array.from(context.currentList!.querySelectorAll('li')) as HTMLElement[]);
        toggleListOff(context, itemData);
      });
      
      updateFormatStates();
      if (editorRef.current) {
        const event = new Event('input', { bubbles: true });
        editorRef.current.dispatchEvent(event);
      }
      return;
    }

    // If in a different list type, convert between types
    if (context.currentList && context.listType && context.listType !== listType) {
        // First, save the styling and indentation from the old list items.
        const itemData = preserveListItemData(Array.from(context.currentList.querySelectorAll('li')) as HTMLElement[]);

        // Use **one** execCommand to convert list types so that the browser
        // registers a single undo step (bullet → numbered or vice-versa).
        // Calling the opposite list command automatically converts the list
        // without an intermediate paragraph state.
        const command = listType === 'UL' ? 'insertUnorderedList' : 'insertOrderedList';
        const commandSuccess = execLegacyCommand(command);

        if (!commandSuccess) {
            console.warn(`[EditorToolbar] execCommand '${command}' failed during list conversion.`);
        }
        
        // After conversion, find the new list and reapply the preserved styles.
        const newContext = detectListContext();
        if (newContext.currentList && newContext.listType === listType) {
            const newItems = Array.from(newContext.currentList.querySelectorAll('li')) as HTMLElement[];
            restoreIndentationToItems(newItems, itemData);
            restoreMarkerFormatting(newItems, itemData, listType);
            applyListAlignment(newContext.currentList, newContext.currentList.style.textAlign || 'left', listType);
        } else if (commandSuccess) {
            // Only warn if the command succeeded but the context is wrong
            console.warn(`List conversion to ${listType} executed, but the resulting DOM is not as expected.`, {
                detectedContext: newContext
            });
        }

        updateFormatStates();
        if (editorRef.current) {
            const event = new Event('input', { bubbles: true });
            editorRef.current.dispatchEvent(event);
        }
        return;
    }

      // Not in a list, create a new one - use selection preservation to maintain text selection
    const alignmentContext = detectAlignmentContext();
    preserveSelectionDuringListOperation(editorRef.current, () => {
      createNewListFromText(listType, alignmentContext, true); // Skip callback to avoid interference with selection restoration
    });

    // Update format states and trigger content change event
    updateFormatStates();
    if (editorRef.current) {
      const event = new Event('input', { bubbles: true });
      editorRef.current.dispatchEvent(event);
    }
  };
  
  // Update handleToolbarClick to only prevent default but not force focus
  const handleToolbarClick = (e: React.MouseEvent) => {
    // Only prevent default to avoid losing selection
    // Don't force focus back to editor
    e.preventDefault();
  };
  
  // Helper to ensure underline color matches text color for selection
  const synchronizeUnderlineColor = (color: string) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const editorEl = editorRef.current;
    if (!editorEl) return;

    // Apply to underline elements strictly inside selection only
    const walker = document.createTreeWalker(
      editorEl,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (!(node instanceof HTMLElement)) return NodeFilter.FILTER_SKIP;
          const el = node as HTMLElement;
          // target <u> elements or elements with inline underline style
          const hasUnderline = el.tagName === 'U' || (el.style.textDecoration || '').includes('underline');
          if (!hasUnderline) return NodeFilter.FILTER_SKIP;
          return range.intersectsNode(el) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
      }
    );

    let current: Node | null = walker.nextNode();
    while (current) {
      const el = current as HTMLElement;
      // If this underline element extends beyond selection, we need to split it.
      // Simplest approach: wrap the exact selection portion in a <span> with text-decoration-color.
      if (range.comparePoint(el, 0) === 0 && range.comparePoint(el, el.childNodes.length) === 0) {
        // Element fully inside selection – safe to style directly
        el.style.textDecorationColor = color;
        el.style.color = el.style.color || color;
      } else {
        // Partially overlapped – clone range portion into span to localize style
        const subRange = range.cloneRange();
        subRange.selectNodeContents(el);
        subRange.setStart(range.startContainer, range.startOffset);
        subRange.setEnd(range.endContainer, range.endOffset);
        const span = document.createElement('span');
        span.style.textDecoration = 'underline';
        span.style.textDecorationColor = color;
        span.style.color = color;
        subRange.surroundContents(span);
      }
      current = walker.nextNode();
    }
  };
  
  type FormattingToggleProps = {
    command: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    pressed: boolean;
    onApply: () => void;
  };

  const FormattingToggle: React.FC<FormattingToggleProps> = ({ command, icon: Icon, label, pressed, onApply }) => {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Toggle 
            aria-label={`Toggle ${label.toLowerCase()}`}
            onClick={onApply}
            pressed={pressed}
            data-state={pressed ? 'on' : 'off'}
            data-command={command}
            className="data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
          >
            <Icon className="h-4 w-4" />
          </Toggle>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider>
      <div 
        className="bg-white dark:bg-zinc-800 rounded-md border p-2 flex flex-wrap gap-1 items-center"
        onMouseDown={handleToolbarClick}
      >
        {/* Text formatting */}
        <FormattingToggle
          command="bold"
          icon={Bold}
          label="Bold"
          pressed={isBold}
          onApply={() => {
            if (showRawLatex) {
              onApplyLatexFormat?.('bold');
            } else {
              execFormatCommand('bold');
            }
          }}
        />
        <FormattingToggle
          command="italic"
          icon={Italic}
          label="Italic"
          pressed={isItalic}
          onApply={() => {
            if (showRawLatex) {
              onApplyLatexFormat?.('italic');
            } else {
              execFormatCommand('italic');
            }
          }}
        />
        <FormattingToggle
          command="underline"
          icon={Underline}
          label="Underline"
          pressed={isUnderline}
          onApply={() => {
            if (showRawLatex) {
              onApplyLatexFormat?.('underline');
            } else {
              execFormatCommand('underline');
            }
          }}
        />
      
        {/* Separator */}
        <div className="w-px h-6 bg-gray-200 dark:bg-zinc-700 mx-1"></div>
        
        {/* Alignment */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle 
              aria-label="Align left" 
              onClick={() => {
                if (showRawLatex) {
                  onApplyLatexFormat?.('justifyLeft');
                } else {
                  handleAlignment('justifyLeft');
                }
              }}
              pressed={textAlignment === 'left'}
              data-state={textAlignment === 'left' ? 'on' : 'off'}
              className="data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
            >
              <AlignLeft className="h-4 w-4" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>Align left</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle 
              aria-label="Align center" 
              onClick={() => {
                if (showRawLatex) {
                  onApplyLatexFormat?.('justifyCenter');
                } else {
                  handleAlignment('justifyCenter');
                }
              }}
              pressed={textAlignment === 'center'}
              data-state={textAlignment === 'center' ? 'on' : 'off'}
              className="data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
            >
              <AlignCenter className="h-4 w-4" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>Align center</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle 
              aria-label="Align right" 
              onClick={() => {
                if (showRawLatex) {
                  onApplyLatexFormat?.('justifyRight');
                } else {
                  handleAlignment('justifyRight');
                }
              }}
              pressed={textAlignment === 'right'}
              data-state={textAlignment === 'right' ? 'on' : 'off'}
              className="data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
            >
              <AlignRight className="h-4 w-4" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>Align right</TooltipContent>
        </Tooltip>
      
        {/* Separator before Indent/Outdent */}
        <div className="w-px h-6 bg-gray-200 dark:bg-zinc-700 mx-1"></div>
        
        {/* Indent/Outdent Buttons */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={(e) => {
                if (showRawLatex) {
                  onApplyLatexFormat?.('outdent');
                } else {
                  onOutdent();
                }
              }}
              className="flex items-center gap-1"
            >
              <Outdent className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Outdent</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={(e) => {
                if (showRawLatex) {
                  onApplyLatexFormat?.('indent');
                } else {
                  onIndent();
                }
              }}
              className="flex items-center gap-1"
            >
              <Indent className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Indent</TooltipContent>
        </Tooltip>

        {/* Separator after Indent/Outdent */}
        <div className="w-px h-6 bg-gray-200 dark:bg-zinc-700 mx-1"></div>
        
        {/* Lists */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              aria-label="Bullet list"
              onClick={() => {
                if (showRawLatex) {
                  onApplyLatexFormat?.('insertUnorderedList');
                } else {
                  handleListFormatting('UL');
                }
              }}
              pressed={isBulletList}
              data-state={isBulletList ? 'on' : 'off'}
              className="data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
            >
              <List className="h-4 w-4" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>Bullet list</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              aria-label="Numbered list"
              onClick={() => {
                if (showRawLatex) {
                  onApplyLatexFormat?.('insertOrderedList');
                } else {
                  handleListFormatting('OL');
                }
              }}
              pressed={isNumberedList}
              data-state={isNumberedList ? 'on' : 'off'}
              className="data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
            >
              <ListOrdered className="h-4 w-4" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>Numbered list</TooltipContent>
        </Tooltip>
        
        {/* Separator */}
        <div className="w-px h-6 bg-gray-200 dark:bg-zinc-700 mx-1"></div>
        
        {/* Colors */}
        <Tooltip>
          <TooltipTrigger asChild>
            <ColorPicker 
              key={`text-color-${colorVersion}`}
              onSelectColor={(color) => {
                if (showRawLatex) {
                  onApplyLatexFormat?.('foreColor', color);
                } else {
                  applyTextColor(color);
                }
              }}
              triggerIcon={<TextColorIcon className="h-4 w-4" color={currentTextColorRef.current} />}
              label="Text color"
              initialColor={currentTextColorRef.current}
              showTransparentOption={false}
              recentColors={recentColors}
            />
          </TooltipTrigger>
          <TooltipContent>Text color</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <ColorPicker 
              key={`highlight-color-${colorVersion}`}
              onSelectColor={(color) => {
                if (showRawLatex) {
                  onApplyLatexFormat?.('hiliteColor', color);
                } else {
                  applyHighlightColor(color);
                }
              }}
              triggerIcon={
                <div className="relative">
                  <Highlighter className="h-4 w-4" />
                </div>
              }
              label="Highlight color"
              initialColor={currentHighlightColorRef.current}
              showTransparentOption={true}
              recentColors={recentColors}
            />
          </TooltipTrigger>
          <TooltipContent>Highlight color</TooltipContent>
        </Tooltip>
        
        {/* Separator */}
        <div className="w-px h-6 bg-gray-200 dark:bg-zinc-700 mx-1"></div>
        
        {/* Special content */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onInsertMath}
              className="flex items-center gap-1"
            >
              <Type className="h-4 w-4" />
              <span>Math</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Insert math equation</TooltipContent>
        </Tooltip>

        {/* Push LaTeX toggle to the right */}
        <div className="flex-1"></div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle 
              pressed={showRawLatex}
              onPressedChange={toggleRawLatex}
              aria-label="Toggle raw LaTeX view"
              className="flex items-center gap-1 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
              data-state={showRawLatex ? 'on' : 'off'}
            >
              <Code className="h-4 w-4" />
              <span>Raw LaTeX</span>
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>Toggle raw LaTeX view</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};

export default EditorToolbar; 