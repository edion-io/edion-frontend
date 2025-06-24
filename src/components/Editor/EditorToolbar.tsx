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

interface EditorToolbarProps {
  showRawLatex: boolean;
  toggleRawLatex: () => void;
  onInsertMath: () => void;
  onInsertTable: (rows: number, cols: number) => void;
  onIndent: () => void;
  onOutdent: () => void;
  editorRef: React.RefObject<HTMLDivElement>;
  onNewListCreated?: () => void;
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
  html: string;
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

// Selection preservation types and utilities
interface TextSelectionState {
  hasSelection: boolean;
  selectedText: string;
  startText: string;
  endText: string;
  startOffset: number;
  endOffset: number;
  contextBefore: string;
  contextAfter: string;
}

// Capture the current text selection with context for restoration
const captureTextSelection = (editorElement: HTMLElement): TextSelectionState => {
  const selection = window.getSelection();
  
  if (!selection || !selection.rangeCount || selection.isCollapsed) {
    return {
      hasSelection: false,
      selectedText: '',
      startText: '',
      endText: '',
      startOffset: 0,
      endOffset: 0,
      contextBefore: '',
      contextAfter: ''
    };
  }
  
  const range = selection.getRangeAt(0);
  const selectedText = range.toString();
  

  
  // Get the full text content of the editor
  const fullText = editorElement.textContent || '';
  
  // Find the position of selected text in the full text
  const beforeRange = document.createRange();
  beforeRange.setStart(editorElement, 0);
  beforeRange.setEnd(range.startContainer, range.startOffset);
  const textBefore = beforeRange.toString();
  
  const afterRange = document.createRange();
  afterRange.setStart(range.endContainer, range.endOffset);
  afterRange.setEnd(editorElement, editorElement.childNodes.length);
  const textAfter = afterRange.toString();
  
  // Get some context around the selection for better matching
  const contextLength = 20;
  const contextBefore = textBefore.slice(-contextLength);
  const contextAfter = textAfter.slice(0, contextLength);
  
  return {
    hasSelection: true,
    selectedText,
    startText: textBefore,
    endText: textAfter,
    startOffset: textBefore.length,
    endOffset: textBefore.length + selectedText.length,
    contextBefore,
    contextAfter
  };
};

// Restore text selection after DOM changes
const restoreTextSelection = (editorElement: HTMLElement, selectionState: TextSelectionState): void => {
  if (!selectionState.hasSelection || !selectionState.selectedText) {
    return;
  }
  
  // Get the current full text after DOM changes
  const currentFullText = editorElement.textContent || '';
  
  // Try to find the selected text in the new structure
  // First, try exact position match
  let startPos = selectionState.startOffset;
  let endPos = selectionState.endOffset;
  
  // If the text at the expected position doesn't match, search for it
  if (currentFullText.slice(startPos, endPos) !== selectionState.selectedText) {
    // Search for the selected text using context
    const searchText = selectionState.contextBefore + selectionState.selectedText + selectionState.contextAfter;
    const foundIndex = currentFullText.indexOf(searchText);
    
    if (foundIndex !== -1) {
      startPos = foundIndex + selectionState.contextBefore.length;
      endPos = startPos + selectionState.selectedText.length;
    } else {
      // Fallback: search for just the selected text
      const directIndex = currentFullText.indexOf(selectionState.selectedText);
      if (directIndex !== -1) {
        startPos = directIndex;
        endPos = startPos + selectionState.selectedText.length;
      } else {
        // If we still can't find exact text, try finding the closest match
        // This can happen when list markers are added/removed
        const words = selectionState.selectedText.split(/\s+/).filter(w => w.length > 0);
        if (words.length > 0) {
          // Try to find the first few words
          const partialText = words.slice(0, Math.min(3, words.length)).join(' ');
          const partialIndex = currentFullText.indexOf(partialText);
          if (partialIndex !== -1) {
            startPos = partialIndex;
            endPos = Math.min(startPos + selectionState.selectedText.length, currentFullText.length);
          } else {
            // Cannot find the text, give up
            return;
          }
        } else {
          return;
        }
      }
    }
  }
  
  // Create a tree walker to find text nodes
  const walker = document.createTreeWalker(
    editorElement,
    NodeFilter.SHOW_TEXT,
    null
  );
  
  let currentPos = 0;
  let startNode: Node | null = null;
  let endNode: Node | null = null;
  let startNodeOffset = 0;
  let endNodeOffset = 0;
  
  // Walk through text nodes to find start and end positions
  let node: Node | null;
  while (node = walker.nextNode()) {
    const nodeLength = node.textContent?.length || 0;
    
    // Check if start position is in this node
    if (startNode === null && currentPos + nodeLength >= startPos) {
      startNode = node;
      startNodeOffset = Math.max(0, startPos - currentPos);
    }
    
    // Check if end position is in this node
    if (endNode === null && currentPos + nodeLength >= endPos) {
      endNode = node;
      endNodeOffset = Math.min(nodeLength, endPos - currentPos);
      break;
    }
    
    currentPos += nodeLength;
  }
  
  // Create and apply the selection
  if (startNode && endNode) {
    try {
      const range = document.createRange();
      range.setStart(startNode, startNodeOffset);
      range.setEnd(endNode, endNodeOffset);
      
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);

      }
    } catch (e) {
      // If range creation fails, try a simpler approach
      console.warn('Failed to restore selection:', e);
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
  
  // Restore selection after a brief delay to allow DOM to settle
  // Use requestAnimationFrame to ensure DOM changes are complete
  requestAnimationFrame(() => {
    setTimeout(() => {

      restoreTextSelection(editorElement, selectionState);
    }, 5);
  });
};

// Helper function to normalize color to hex
const normalizeColorToHex = (colorValue: string): string => {
  if (!colorValue) return '#000000';
  
  // Handle hex format
  if (colorValue.startsWith('#')) {
    // Normalize 3-digit hex to 6-digit
    if (colorValue.length === 4) {
      return `#${colorValue[1]}${colorValue[1]}${colorValue[2]}${colorValue[2]}${colorValue[3]}${colorValue[3]}`.toLowerCase();
    }
    return colorValue.toLowerCase();
  }
  
  // Handle RGB/RGBA format
  if (colorValue.startsWith('rgb')) {
    const rgbMatch = colorValue.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1], 10);
      const g = parseInt(rgbMatch[2], 10);
      const b = parseInt(rgbMatch[3], 10);
      const toHex = (c: number) => c.toString(16).padStart(2, '0');
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toLowerCase();
    }
  }

  // Handle basic color names
  const colorMap: { [key: string]: string } = {
    black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff', 
    yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff', gray: '#808080', 
  };
  const lowerCaseColor = colorValue.toLowerCase();
  if (colorMap[lowerCaseColor]) {
    return colorMap[lowerCaseColor];
  }

  // Default to black if conversion fails
  return '#000000';
};

const EditorToolbar = ({ 
  showRawLatex, 
  toggleRawLatex,
  onInsertMath,
  onInsertTable,
  onIndent,
  onOutdent,
  editorRef,
  onNewListCreated
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
  
  // Track color history - maximum 6 recent colors
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const MAX_RECENT_COLORS = 6;
  
  // New ref to track if the editor has focus
  const editorHasFocusRef = useRef<boolean>(false);
  // New ref to store the last valid alignment when editor had focus
  const lastKnownAlignmentRef = useRef<TextAlignment>('left');
  
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

    // Remove the aggressive focus handling
    // We'll rely on more intentional focus management instead
    
    return () => {
      // Clean up any remaining listeners
    };
  }, [editorRef]);
  
  // Function to check if a list item is fully selected
  const isListItemFullySelected = (selection: Selection): HTMLElement | null => {
    if (!selection || !selection.rangeCount) return null;
    
    const range = selection.getRangeAt(0);
    
    // Find the list item parent
    let node = range.commonAncestorContainer;
    let listItem: HTMLElement | null = null;
    
    // Walk up the DOM tree to find if we're in a list item
    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'LI') {
        listItem = node as HTMLElement;
        break;
      }
      node = node.parentNode;
    }
    
    // If not in a list item, return null
    if (!listItem) return null;
    
    // Now we need to determine if the entire content is selected
    // We have several cases to handle:
    
    // Case 1: Selection starts and ends outside the list item but encompasses it
    if (range.startContainer !== listItem && 
        range.endContainer !== listItem && 
        range.intersectsNode(listItem)) {
      
      // Check if the selection contains the entire list item
      const listItemRange = document.createRange();
      listItemRange.selectNodeContents(listItem);
      
      // If the selection contains the entire list item's content
      if (range.compareBoundaryPoints(Range.START_TO_START, listItemRange) <= 0 &&
          range.compareBoundaryPoints(Range.END_TO_END, listItemRange) >= 0) {
        return listItem;
      }
    }
    
    // Case 2: Selection starts and ends inside the list item
    // Check if the selection covers all the content
    
    // Create a range for the entire list item content
    const listItemContentRange = document.createRange();
    listItemContentRange.selectNodeContents(listItem);
    
    // Check if the selection range covers the entire content
    const selectionStartsAtBeginning = 
      (range.startContainer === listItem && range.startOffset === 0) ||
      (range.startContainer === listItem.firstChild && range.startOffset === 0);
    
    const selectionEndsAtEnd =
      (range.endContainer === listItem && range.endOffset === listItem.childNodes.length) ||
      (range.endContainer === listItem.lastChild && 
       range.endOffset === (range.endContainer.nodeType === Node.TEXT_NODE ? 
                           range.endContainer.textContent?.length || 0 : 
                           (range.endContainer as HTMLElement).childNodes.length));

    if (selectionStartsAtBeginning && selectionEndsAtEnd) {
      return listItem;
    }
    
    // Case 3: If the list item only has one text node child and it's fully selected
    if (listItem.childNodes.length === 1 && 
        listItem.firstChild?.nodeType === Node.TEXT_NODE && 
        range.startContainer === listItem.firstChild && 
        range.endContainer === listItem.firstChild) {
      const textNode = listItem.firstChild;
      if (range.startOffset === 0 && range.endOffset === textNode.textContent?.length) {
        return listItem;
      }
    }
    
    // Case 4: Compare text content as a fallback
    // This is less reliable but can catch additional cases
    const listItemText = listItem.textContent || '';
    const selectedText = range.toString();
    
    if (selectedText.trim() === listItemText.trim() && selectedText.length > 0) {
      return listItem;
    }
    
    return null;
  };
  
  // Modify execFormatCommand to only focus when necessary for text operations
  const execFormatCommand = (command: string, value?: string) => {
    if (!editorRef.current) return;

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
    
    // Enhanced list item formatting logic
    let listItem: HTMLElement | null = null;
    let shouldFormatMarker = false;
    const selection = window.getSelection();
    
    if (selection && ['bold', 'italic', 'underline'].includes(command)) {
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
    
    // Handle list marker formatting for both ordered and unordered lists
    if (listItem && shouldFormatMarker) {
      // Determine marker class based on the command
      const markerClass = `marker-${command}`;
      
      // Toggle the marker class on the list item
      if (listItem.classList.contains(markerClass)) {
        listItem.classList.remove(markerClass);
      } else {
        listItem.classList.add(markerClass);
      }
      
      // If it's a bullet list, we need to apply styling to the ::marker in addition to the ::before
      if (listItem.closest('ul')) {
        // We can't directly style ::marker with JS, but we can add a class to the list item
        // The CSS in RichTextArea.tsx should be updated to style UL markers as well
      }
      
      // For cursor at beginning without selection, don't execute the content command
      // Only format the marker
      const range = selection.getRangeAt(0);
      const isAtBeginningWithoutSelection = range.collapsed && 
        ((range.startContainer === listItem && range.startOffset === 0) ||
         (range.startContainer === listItem.firstChild && range.startOffset === 0));
      
      if (isAtBeginningWithoutSelection) {
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
    document.execCommand(command, false, value);

    // Update states
    switch (command) {
      case 'bold':
        setIsBold(document.queryCommandState(command));
        break;
      case 'italic':
        setIsItalic(document.queryCommandState(command));
        break;
      case 'underline':
        setIsUnderline(document.queryCommandState(command));
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
    if (!editorRef.current) return lastKnownAlignmentRef.current;
    
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return lastKnownAlignmentRef.current;
    
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
          
          // Only update if it's not the default left alignment or it has our fixed attribute
          if (textAlign === 'center' || hasFixedAlignment) {
            lastKnownAlignmentRef.current = 'center';
            foundAlignedElement = true;
            return 'center';
          }
          if (textAlign === 'right' || hasFixedAlignment) {
            lastKnownAlignmentRef.current = 'right';
            foundAlignedElement = true;
            return 'right';
          }
          if (hasFixedAlignment) {
            // If we explicitly set left alignment, ensure it's honored
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
    // Default to black if no selection or editor ref
    if (!editorRef.current) return '#000000';
    
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return '#000000';
    
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
        return normalizeColorToHex(currentNode.style.color);
      }
      
      // Check for font elements with color attribute
      if (currentNode.tagName === 'FONT' && currentNode.getAttribute('color')) {
        return normalizeColorToHex(currentNode.getAttribute('color') || '');
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
        return normalizeColorToHex(computedColor);
      }
    }
    
    // Default to black if no color is detected
    return '#000000';
  };

  // Function to get the highlight color at the current selection
  const getHighlightColorAtSelection = (): string => {
    // Default to transparent if no selection or editor ref
    if (!editorRef.current) return 'transparent';
    
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return 'transparent';
    
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
        return normalizeColorToHex(currentNode.style.backgroundColor);
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
          return normalizeColorToHex(computedBgColor);
        }
      }
    }
    
    // Default to transparent if no highlight color is detected
    return 'transparent';
  };
  
  // Update formatting states based on current selection
  const updateFormatStates = () => {
    // If editor doesn't have focus, don't update the alignment in the toolbar
    if (!editorHasFocusRef.current) {
      return;
    }
    
    const isBullet = isInListType('UL');
    const isNumbered = isInListType('OL');
    const alignment = getCurrentAlignment();
    
    // Get the current selection
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      // Check if we're in a text node
      let node = selection.anchorNode;
      
      // Check formatting states using document.queryCommandState
      const boldState = document.queryCommandState('bold');
      const italicState = document.queryCommandState('italic');
      const underlineState = document.queryCommandState('underline');
      
      setIsBold(boldState);
      setIsItalic(italicState);
      setIsUnderline(underlineState);
      
      // Check for list item marker formatting
      const isInList = isBullet || isNumbered;
      if (isInList) {
        // Find the list item containing the selection
        let listItemElement = null;
        let currentNode = node;
        
        while (currentNode && currentNode !== editorRef.current) {
          if (currentNode.nodeType === Node.ELEMENT_NODE && 
              (currentNode as HTMLElement).tagName === 'LI') {
            listItemElement = currentNode as HTMLElement;
            break;
          }
          currentNode = currentNode.parentNode;
        }
        
        // If we found a list item, check for marker formatting classes
        if (listItemElement) {
          // If the entire list item is selected, consider the marker formatting
          const isFullySelected = isListItemFullySelected(selection) !== null;
          
          if (isFullySelected) {
            // Update toolbar states based on marker classes
            const hasMarkerBold = listItemElement.classList.contains('marker-bold');
            const hasMarkerItalic = listItemElement.classList.contains('marker-italic');
            const hasMarkerUnderline = listItemElement.classList.contains('marker-underline');
            
            // Update the state only if the marker has formatting
            // (This might override the content formatting, but that's ok when selecting the whole item)
            if (hasMarkerBold) setIsBold(true);
            if (hasMarkerItalic) setIsItalic(true);
            if (hasMarkerUnderline) setIsUnderline(true);
          }
        }
      }
    }
    
    // Update list states
    setIsBulletList(isBullet);
    setIsNumberedList(isNumbered);
    
    // Only update alignment if it's different to avoid unnecessary re-renders
    if (textAlignment !== alignment) {
      setTextAlignment(alignment);
    }
    
    // Update text color
    const detectedColor = getColorAtSelection();
    setCurrentTextColor(detectedColor);
    
    // Update highlight color
    const detectedHighlight = getHighlightColorAtSelection();
    setCurrentHighlightColor(detectedHighlight);
  };
  
  // Track selection changes to update format states
  useEffect(() => {
    if (!editorRef.current) return;
    
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
          // Only log if we have a special debug flag set
          if ((window as any).__debugListOperations) {
            console.log('👁️ SELECTION CHANGE:', {
              startContainer: range.startContainer,
              startOffset: range.startOffset,
              nodeType: range.startContainer.nodeType,
              textContent: range.startContainer.textContent,
              parentElement: range.startContainer.parentElement?.tagName
            });
          }
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
    
    editorRef.current.addEventListener('mouseup', handleEditorMouseUp);
    
    // Add focus/blur event listeners to track when editor loses/gains focus
    const handleEditorFocus = () => {
      editorHasFocusRef.current = true;
      updateFormatStates();
    };
    
    const handleEditorBlur = () => {
      editorHasFocusRef.current = false;
      // Don't update the format states on blur to keep the current toolbar state
    };
    
    editorRef.current.addEventListener('focus', handleEditorFocus);
    editorRef.current.addEventListener('blur', handleEditorBlur);
    
    // Clean up
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      editorRef.current?.removeEventListener('mouseup', handleEditorMouseUp);
      editorRef.current?.removeEventListener('focus', handleEditorFocus);
      editorRef.current?.removeEventListener('blur', handleEditorBlur);
    };
  }, [editorRef]);
  
  // Apply text color
  const applyTextColor = (color: string) => {
    // Immediately update the current text color to reflect the change
    setCurrentTextColor(color);
    
    // Only force focus if we're not already in a color picker interaction
    const isInColorPickerInteraction = document.activeElement && 
      (document.activeElement.closest('.popover-content') !== null);
    
    if (!isInColorPickerInteraction) {
      execFormatCommand('foreColor', color);
    } else {
      // If we're in a picker interaction, just apply the command without focusing
      if (editorRef.current) {
        // Store the current selection
        const selection = window.getSelection();
        
        // Only proceed if there's a valid selection
        if (selection && selection.rangeCount > 0) {
          // Apply the color without forcing focus
          document.execCommand('foreColor', false, color);
          
          // Update states
          updateFormatStates();
          
          // Trigger input event
          const event = new Event('input', { bubbles: true });
          editorRef.current.dispatchEvent(event);
        }
      }
    }
    
    // Add to color history
    addToColorHistory(color);
  };
  
  // Apply highlight color
  const applyHighlightColor = (color: string) => {
    // Immediately update the current highlight color to reflect the change
    setCurrentHighlightColor(color);
    
    // Only force focus if we're not already in a color picker interaction
    const isInColorPickerInteraction = document.activeElement && 
      (document.activeElement.closest('.popover-content') !== null);
    
    if (!isInColorPickerInteraction) {
      execFormatCommand('hiliteColor', color);
    } else {
      // If we're in a picker interaction, just apply the command without focusing
      if (editorRef.current) {
        // Store the current selection
        const selection = window.getSelection();
        
        // Only proceed if there's a valid selection
        if (selection && selection.rangeCount > 0) {
          // Apply the highlight without forcing focus
          document.execCommand('hiliteColor', false, color);
          
          // Update states
          updateFormatStates();
          
          // Trigger input event
          const event = new Event('input', { bubbles: true });
          editorRef.current.dispatchEvent(event);
        }
      }
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
        
        // Force a redraw to make the change take effect immediately
        const originalDisplay = listElement.style.display;
        listElement.style.display = 'none';
        listElement.offsetHeight; // Force reflow
        listElement.style.display = originalDisplay;
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
      html: item.innerHTML,
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
    let currentAlignment = 'left';
    let alignedParentNode = null;
    
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
      return { currentAlignment, alignedParentNode };
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
    
    return { currentAlignment, alignedParentNode };
  };

  // Helper function to apply alignment to lists
  const applyListAlignment = (listElement: HTMLElement, alignment: string, listType: 'UL' | 'OL') => {
    if (alignment !== 'left') {
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
        });
      }
      
      if (listType === 'UL' && alignment !== 'left') {
        const listItems = listElement.querySelectorAll('li');
        listItems.forEach(item => {
          (item as HTMLElement).style.listStylePosition = 'inside';
          (item as HTMLElement).style.removeProperty('justify-content');
          if (alignment === 'center') {
            (item as HTMLElement).style.justifyContent = 'center';
          } else if (alignment === 'right') {
            (item as HTMLElement).style.justifyContent = 'flex-end';
          }
        });
      }
      
      lastKnownAlignmentRef.current = alignment as TextAlignment;
      setTextAlignment(alignment as TextAlignment);
    }
  };

  // Helper function to restore indentation to list items
  const restoreIndentationToItems = (items: HTMLElement[], itemData: ListItemData[]) => {
    items.forEach((item, index) => {
      if (index < itemData.length) {
        const originalData = itemData[index];
        item.innerHTML = originalData.html;
        
        let indentLevelSuccessfullySet = false;

        // Try to use originalData.indentLevel
        if (originalData.indentLevel && originalData.indentLevel !== '') {
          const parsedOriginalIndent = parseInt(originalData.indentLevel, 10);
          if (!isNaN(parsedOriginalIndent) && parsedOriginalIndent >= 0) {
            item.style.setProperty('--indent-level', parsedOriginalIndent.toString());
            indentLevelSuccessfullySet = true;
          }
        }

        // Fallback to paddingLeft
        if (!indentLevelSuccessfullySet && originalData.paddingLeft) {
          item.style.paddingLeft = originalData.paddingLeft;
        }

        // Ensure --indent-level is set
        if (!indentLevelSuccessfullySet) {
          item.style.setProperty('--indent-level', '0');
        }
      }
    });
  };

  // Helper function to restore marker formatting
  const restoreMarkerFormatting = (items: HTMLElement[], itemData: ListItemData[], listType: 'UL' | 'OL') => {
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
    const originalEditorTransition = editorRef.current?.style.transition;
    
    if (editorRef.current) {
      editorRef.current.style.transition = 'none';
    }
    
    callback();
    
    // Re-enable transitions after operation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (editorRef.current) {
          editorRef.current.style.transition = originalEditorTransition || '';
        }
      });
    });
  };

  // Helper function to toggle list off (convert to paragraphs)
  const toggleListOff = (context: ListContext, itemData: ListItemData[]) => {
    if (!context.currentList || !editorRef.current) return;
    
    const currentAlign = context.currentList.style.textAlign || '';
    const fragment = document.createDocumentFragment();
    
    // Convert each list item to a paragraph
    itemData.forEach(data => {
      const paragraph = document.createElement('p');
      
      if (!data.html || data.html.trim() === '' || data.html === '<br>' || data.html === '&nbsp;') {
        paragraph.innerHTML = '<br>';
      } else {
        paragraph.innerHTML = data.html;
      }
      
      // Apply indentation
      if (data.indentLevel && data.indentLevel.trim() !== '' && data.indentLevel !== '0px' && data.indentLevel !== '0') {
        paragraph.style.paddingLeft = data.indentLevel;
      } else if (data.paddingLeft && data.paddingLeft.trim() !== '' && data.paddingLeft !== '0px' && data.paddingLeft !== '0') {
        paragraph.style.paddingLeft = data.paddingLeft;
      }
      
      // Apply alignment
      if (currentAlign && currentAlign !== 'left' && currentAlign !== 'start') {
        paragraph.style.textAlign = currentAlign;
        paragraph.setAttribute('data-alignment-fixed', 'true');
      }
      
      fragment.appendChild(paragraph);
    });
    
    // Replace the list with paragraphs
    context.currentList.parentNode?.replaceChild(fragment, context.currentList);
    
    // Update content
    if (editorRef.current) {
      const event = new Event('input', { bubbles: true });
      editorRef.current.dispatchEvent(event);
    }
    
    // Update content
    if (editorRef.current) {
      const event = new Event('input', { bubbles: true });
      editorRef.current.dispatchEvent(event);
    }
  };

  // Helper function to convert between list types
  const convertBetweenListTypes = (fromType: 'UL' | 'OL', toType: 'UL' | 'OL', context: ListContext, itemData: ListItemData[]) => {
    if (!context.currentList) return;
    
    const alignmentToTransfer = context.currentList.style.textAlign;
    
    disableTransitionsDuring(() => {
      // Convert list type
      document.execCommand(fromType === 'UL' ? 'insertUnorderedList' : 'insertOrderedList', false);
      document.execCommand(toType === 'UL' ? 'insertUnorderedList' : 'insertOrderedList', false);
      
      // Find the newly created list
      const selection = window.getSelection();
      let newList: HTMLElement | null = null;
      
      if (selection?.anchorNode) {
        let node = selection.anchorNode;
        while (node && node !== editorRef.current) {
          if (node.nodeType === Node.ELEMENT_NODE && 
              ((node as HTMLElement).tagName === 'UL' || (node as HTMLElement).tagName === 'OL')) {
            newList = node as HTMLElement;
            break;
          }
          node = node.parentNode;
        }
      }
      
      if (newList) {
        // Apply list classes
        if (toType === 'OL') {
          newList.classList.add('list-decimal');
          newList.style.listStyleType = 'decimal';
        } else {
          newList.classList.add('list-disc');
          newList.style.listStyleType = 'disc';
        }
        
        // Apply alignment if needed
        if (alignmentToTransfer) {
          applyListAlignment(newList, alignmentToTransfer, toType);
        }
        
        const newItems = Array.from(newList.querySelectorAll('li')) as HTMLElement[];
        
        // Disable transitions on list items
        const originalTransitions: string[] = [];
        newItems.forEach((item, index) => {
          originalTransitions[index] = item.style.transition;
          item.style.transition = 'none';
        });
        
        // Restore content and formatting
        restoreIndentationToItems(newItems, itemData);
        restoreMarkerFormatting(newItems, itemData, toType);
        
        // Force reflow
        newList.offsetHeight;
        newList.offsetWidth;
        
        // Re-enable transitions
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            newItems.forEach((item, index) => {
              item.style.transition = originalTransitions[index] || '';
            });
          });
        });
        
        // Update content
        if (editorRef.current) {
          const event = new Event('input', { bubbles: true });
          editorRef.current.dispatchEvent(event);
        }
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
    
    // Create the list
    document.execCommand(listType === 'UL' ? 'insertUnorderedList' : 'insertOrderedList', false);
    
    // Find the new list
    const newSelection = window.getSelection();
    let newListElement: HTMLElement | null = null;
    let firstItem: HTMLLIElement | null = null;
    
    if (newSelection && newSelection.rangeCount > 0) {
      let listNodeAnchor = newSelection.anchorNode;
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
      
      // Apply initial indentation
      if (initialIndentPx > 0) {
        firstItem.style.setProperty('--indent-level', `${initialIndentPx}px`);
      }
      
      // Apply alignment
      if (alignmentContext.currentAlignment !== 'left') {
        applyListAlignment(newListElement, alignmentContext.currentAlignment, listType);
      }
      
      // Trigger callback for ordered lists (unless we're preserving selection)
      if (listType === 'OL' && !skipNewListCallback) {
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

    // Use selection preservation wrapper for all list operations
    preserveSelectionDuringListOperation(editorRef.current, () => {
      const context = detectListContext();
      if (!context.selection) return;

      // If already in a list of the same type, toggle it off
      if (context.currentList && context.listType === listType) {
        const itemData = preserveListItemData(Array.from(context.currentList.querySelectorAll('li')) as HTMLElement[]);
        toggleListOff(context, itemData);
        return;
      }

      // If in a different list type, convert between types
      if (context.currentList && context.listType && context.listType !== listType) {
        const itemData = preserveListItemData(Array.from(context.currentList.querySelectorAll('li')) as HTMLElement[]);
        convertBetweenListTypes(context.listType, listType, context, itemData);
        return;
      }

      // Not in a list, create a new one
      const alignmentContext = detectAlignmentContext();
      createNewListFromText(listType, alignmentContext, true); // Skip callback to preserve selection
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
  
  return (
    <TooltipProvider>
      <div 
        className="bg-white dark:bg-zinc-800 rounded-md border p-2 flex flex-wrap gap-1 items-center"
        onMouseDown={handleToolbarClick}
      >
        {/* Text formatting */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle 
              aria-label="Toggle bold" 
              onClick={() => execFormatCommand('bold')}
              pressed={isBold}
              data-state={isBold ? 'on' : 'off'}
              className="data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
            >
              <Bold className="h-4 w-4" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>Bold</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle 
              aria-label="Toggle italic" 
              onClick={() => execFormatCommand('italic')}
              pressed={isItalic}
              data-state={isItalic ? 'on' : 'off'}
              className="data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
            >
              <Italic className="h-4 w-4" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>Italic</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle 
              aria-label="Toggle underline" 
              onClick={() => execFormatCommand('underline')}
              pressed={isUnderline}
              data-state={isUnderline ? 'on' : 'off'}
              className="data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
            >
              <Underline className="h-4 w-4" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>Underline</TooltipContent>
        </Tooltip>
      
        {/* Separator */}
        <div className="w-px h-6 bg-gray-200 dark:bg-zinc-700 mx-1"></div>
        
        {/* Alignment */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle 
              aria-label="Align left" 
              onClick={() => handleAlignment('justifyLeft')}
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
              onClick={() => handleAlignment('justifyCenter')}
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
              onClick={() => handleAlignment('justifyRight')}
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
              onClick={onOutdent}
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
              onClick={onIndent}
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
              onClick={() => handleListFormatting('UL')}
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
              onClick={() => handleListFormatting('OL')}
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
              onSelectColor={applyTextColor}
              triggerIcon={<TextColorIcon className="h-4 w-4" color={currentTextColor} />}
              label="Text color"
              initialColor={currentTextColor}
              showTransparentOption={false}
              recentColors={recentColors}
            />
          </TooltipTrigger>
          <TooltipContent>Text color</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <ColorPicker 
              onSelectColor={applyHighlightColor}
              triggerIcon={
                <div className="relative">
                  <Highlighter className="h-4 w-4" />
                </div>
              }
              label="Highlight color"
              initialColor={currentHighlightColor}
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