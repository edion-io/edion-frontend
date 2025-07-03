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
  onFormatCommandReady?: (execFormatCommand: (command: string, value?: string) => void) => void;
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
      // Silently handle selection restoration failures
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
  onNewListCreated,
  onFormatCommandReady
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
  
  // Function to check if a list item is fully selected
  const isListItemFullySelected = (selection: Selection): HTMLElement | null => {
    if (!selection || !selection.rangeCount) {
      return null;
    }
    
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
    if (!listItem) {
      return null;
    }
    
    // Case 1: Selection starts and ends outside the list item but encompasses it
    if (range.startContainer !== listItem && 
        range.endContainer !== listItem && 
        range.intersectsNode(listItem)) {
      
      // Check if the selection contains the entire list item
      const listItemRange = document.createRange();
      listItemRange.selectNodeContents(listItem);
      
      // If the selection contains the entire list item's content
      const startsBeforeOrAt = range.compareBoundaryPoints(Range.START_TO_START, listItemRange) <= 0;
      const endsAfterOrAt = range.compareBoundaryPoints(Range.END_TO_END, listItemRange) >= 0;
      
      if (startsBeforeOrAt && endsAfterOrAt) {
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
      const fullTextSelected = range.startOffset === 0 && range.endOffset === textNode.textContent?.length;
      
      if (fullTextSelected) {
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
        const queryCommandState = document.queryCommandState(command);
        
        hasAnyContentFormatting = foundFormatTags || queryCommandState;
        
        // Debug content analysis
        console.log(`[DEBUG] Content analysis details:`, {
          selectedContentHTML: tempDiv.innerHTML,
          foundFormatTags,
          queryCommandState,
          formatTags,
          hasAnyContentFormatting
        });
        
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
          let textNode;
          const textNodeDetails = [];
          while (textNode = walker.nextNode()) {
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
          
          console.log(`[DEBUG] Text node analysis:`, {
            textNodeDetails,
            hasUnformattedText,
            hasFullContentFormatting,
            formatTags
          });
          
          // Additional check: if the entire list item content is selected and queryCommandState is true,
          // we should trust queryCommandState more than our tag analysis for full selections
          // BUT only if we don't have unformatted text (mixed formatting case)
          const isFullListItemSelection = isListItemFullySelected(selection) !== null;
          console.log(`[DEBUG] Override check:`, {
            isFullListItemSelection,
            queryCommandState,
            hasUnformattedText,
            foundFormatTags,
            willOverride: isFullListItemSelection && queryCommandState && !hasUnformattedText
          });
          
          if (isFullListItemSelection && queryCommandState && !hasUnformattedText) {
            // For full list item selections, if queryCommandState is true AND we don't have unformatted text,
            // trust queryCommandState. The browser might be using inline styles or other formatting methods
            // that our tag-based analysis doesn't detect
            hasFullContentFormatting = true;
            console.log(`[DEBUG] Applied override: hasFullContentFormatting = true (trusting queryCommandState for full selection with no unformatted text)`);
          }
          
        } else {
          // If queryCommandState is false, check if there might still be formatting tags
          // This can happen in some edge cases
          hasFullContentFormatting = false;
          
          // But for full list item selections, if we found format tags, consider it formatted
          const isFullListItemSelection = isListItemFullySelected(selection) !== null;
          if (isFullListItemSelection && foundFormatTags) {
            hasFullContentFormatting = true;
            console.log(`[DEBUG] Override for queryCommandState=false: found format tags in full selection`);
          }
        }
        
        // Determine desired state:
        // - If marker is formatted AND all content is fully formatted → remove formatting
        // - Otherwise → add formatting to both marker and content
        desiredFormattingState = !(hasMarkerFormatting && hasFullContentFormatting);
        
        // Fallback check: if marker is formatted and queryCommandState is true for full selection,
        // assume we should remove formatting even if hasFullContentFormatting is false
        const isFullListItemSelection = isListItemFullySelected(selection) !== null;
        console.log(`[DEBUG] Fallback override check:`, {
          hasMarkerFormatting,
          isFullListItemSelection,
          queryCommandState,
          desiredFormattingStateBeforeOverride: desiredFormattingState,
          willOverride: hasMarkerFormatting && isFullListItemSelection && queryCommandState && desiredFormattingState
        });
        
        if (hasMarkerFormatting && isFullListItemSelection && queryCommandState && desiredFormattingState) {
          console.log(`[DEBUG] Fallback override APPLIED: marker formatted + full selection + queryCommandState=true → REMOVE`);
          desiredFormattingState = false; // Override to remove formatting
        }
        
        // Debug the decision values
        console.log(`[DEBUG] ${command} state detection:`, {
          hasMarkerFormatting,
          hasFullContentFormatting,
          hasAnyContentFormatting,
          queryCommandState,
          isFullListItemSelection,
          desiredFormattingState: desiredFormattingState ? 'ADD' : 'REMOVE',
          markerClass,
          listItemClasses: Array.from(listItem.classList)
        });
        
        // Debug for fully formatted case
        if (hasMarkerFormatting && hasFullContentFormatting) {
          console.log(`[DEBUG] Fully formatted ${command} - will REMOVE formatting`);
        }
        
        // Apply marker formatting based on desired state
        if (desiredFormattingState) {
          listItem.classList.add(markerClass);
          console.log(`[DEBUG] Added marker class: ${markerClass}`);
        } else {
          listItem.classList.remove(markerClass);
          console.log(`[DEBUG] Removed marker class: ${markerClass}`);
        }
        
        // For content formatting, we need to apply the desired state
        // If we want formatting but content is not fully formatted, OR
        // if we want no formatting but content has any formatting, then toggle
        const needsContentToggle = 
          (desiredFormattingState && !hasFullContentFormatting) ||
          (!desiredFormattingState && hasAnyContentFormatting);
        
        // Debug for remove case
        if (!desiredFormattingState) {
          console.log(`[DEBUG] REMOVE ${command} decision:`, {
            desiredFormattingState,
            hasFullContentFormatting,
            hasAnyContentFormatting,
            needsContentToggle,
            condition1: desiredFormattingState && !hasFullContentFormatting,
            condition2: !desiredFormattingState && hasAnyContentFormatting
          });
        }
        
        if (needsContentToggle) {
          // Continue to execCommand below
          
          // Special handling for mixed formatting - if we want to ADD formatting but there's mixed content,
          // we need to handle this more carefully than just using execCommand
          if (desiredFormattingState && hasAnyContentFormatting && !hasFullContentFormatting) {
            console.log(`[DEBUG] Mixed formatting case: ${command}`);
            // For mixed formatting, we need to:
            // 1. Remove all existing formatting of this type
            // 2. Apply formatting to the entire selection
            
            if (['bold', 'italic', 'underline'].includes(command)) {
              // First, remove all existing formatting of this type
              let attempts = 0;
              while (document.queryCommandState(command) && attempts < 5) {
                document.execCommand(command, false);
                attempts++;
              }
              console.log(`[DEBUG] Removed existing ${command} formatting in ${attempts} attempts`);
              
              // Then apply formatting to ensure everything is formatted
              const result = document.execCommand(command, false);
              console.log(`[DEBUG] Applied ${command} formatting, result: ${result}`);
              
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
          
          // Debug for remove formatting case
          if (!desiredFormattingState && hasFullContentFormatting) {
            console.log(`[DEBUG] REMOVE case: Removing ${command} from fully formatted content`);
          }
        } else {
          // Update states to reflect the current formatting
          console.log(`[DEBUG] Skipping content command for ${command} - content already in desired state`);
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
    console.log(`[DEBUG] Executing normal document.execCommand('${command}')`);
    const commandResult = document.execCommand(command, false, value);
    console.log(`[DEBUG] Command result: ${commandResult}`);
    
    if (!commandResult) {
      // Debug: Check if the browser supports this command
      const isSupported = document.queryCommandSupported(command);
      const isEnabled = document.queryCommandEnabled(command);
    }

    // Update states
    switch (command) {
      case 'bold':
        const boldState = document.queryCommandState(command);
        setIsBold(boldState);
        break;
      case 'italic':
        const italicState = document.queryCommandState(command);
        setIsItalic(italicState);
        break;
      case 'underline':
        const underlineState = document.queryCommandState(command);
        setIsUnderline(underlineState);
        break;
      case 'foreColor':
        updateTextColor(value || '#000000');
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
    
    // Default to current toolbar highlight color if no highlight color is detected
    return currentHighlightColorRef.current;
  };
  
  // Update formatting states based on current selection
  const updateFormatStates = () => {
    if (!editorHasFocusRef.current) {
      return;
    }
    
    const isBullet = isInListType('UL');
    const isNumbered = isInListType('OL');
    const alignment = getCurrentAlignment();
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
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
              updateTextColor(normalizeColorToHex(listMarkerColor));
            }
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
    document.execCommand('hiliteColor', false, color);
    
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
        
        item.innerHTML = originalData.html;
        
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
    
    // Create a temporary style element to aggressively disable all transitions
    const tempStyle = document.createElement('style');
    tempStyle.id = 'temp-disable-transitions';
    tempStyle.textContent = `
      .rich-text-editor ol li,
      .rich-text-editor ul li {
        transition: none !important;
      }
      .rich-text-editor ol li *,
      .rich-text-editor ul li * {
        transition: none !important;
      }
    `;
    document.head.appendChild(tempStyle);
    
    // Store and disable transitions on the editor
    if (editorRef.current) {
      editorRef.current.style.transition = 'none';
    }
    
    // Store and disable transitions on all current list items
    const allListItems = editorRef.current?.querySelectorAll('li') || [];
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
        // Remove the temporary style element
        const styleElement = document.getElementById('temp-disable-transitions');
        if (styleElement) {
          styleElement.remove();
        }
        
        // Restore editor transition
        if (editorRef.current) {
          editorRef.current.style.transition = originalEditorTransition || '';
        }
        
        // Restore list item transitions, but need to find them again since they may have changed
        const newListItems = editorRef.current?.querySelectorAll('li') || [];
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
      } else {
        // If the list had left alignment (or no explicit alignment), ensure the paragraph reflects this
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
        } else {
          // Check if we should apply current alignment from toolbar state
          const currentToolbarAlignment = getCurrentAlignment();
          
          if (currentToolbarAlignment !== 'left') {
            applyListAlignment(newList, currentToolbarAlignment, toType);
          }
        }
        
        const newItems = Array.from(newList.querySelectorAll('li')) as HTMLElement[];
        
        // Restore content and formatting
        restoreIndentationToItems(newItems, itemData);
        restoreMarkerFormatting(newItems, itemData, toType);
        
        // Force immediate style application to prevent visual delays
        newItems.forEach((item) => {
          void item.offsetHeight;
          void item.offsetWidth;
        });
        
        // Force reflow
        newList.offsetHeight;
        newList.offsetWidth;
        
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
      // Use selection preservation for list conversion
      preserveSelectionDuringListOperation(editorRef.current, () => {
        const itemData = preserveListItemData(Array.from(context.currentList!.querySelectorAll('li')) as HTMLElement[]);
        convertBetweenListTypes(context.listType!, listType, context, itemData);
      });
      
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
    createNewListFromText(listType, alignmentContext, true); // Skip callback to avoid cursor positioning that interferes with selection restoration
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
              onClick={() => {
                execFormatCommand('bold');
              }}
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
              onClick={() => {
                execFormatCommand('italic');
              }}
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
              onClick={() => {
                execFormatCommand('underline');
              }}
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
              key={`text-color-${currentTextColorRef.current}-${colorVersion}`}
              onSelectColor={applyTextColor}
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
              key={`highlight-color-${currentHighlightColorRef.current}-${colorVersion}`}
              onSelectColor={applyHighlightColor}
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