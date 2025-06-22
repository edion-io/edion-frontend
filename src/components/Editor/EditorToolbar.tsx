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
        listElement.style.display = 'none';
        listElement.offsetHeight; // Force reflow
        listElement.style.display = '';
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

  // Handle list formatting specifically
  const handleListFormatting = (listType: 'UL' | 'OL') => {
    if (!editorRef.current) return;

    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    
    // Find if we're already in a list
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
    
    // Check for existing alignment before creating list
    let currentAlignment = 'left';
    let alignedParentNode = null;
    
    if (!currentList) {
      // If not in a list, check for text alignment in the closest parent block element
      node = selection.anchorNode;
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
    }
    
    // If already in a list of the same type, toggle it off (preserve indentation)
    if (currentList && currentList.tagName === listType) {
      // Store cursor position before conversion
      const selectionRange = selection.getRangeAt(0);
      const cursorNode = selectionRange.startContainer;
      const cursorOffset = selectionRange.startOffset;
      
      // Find which list item contains the cursor and its index
      let cursorListItem: HTMLElement | null = null;
      let cursorListItemIndex = -1;
      
      if (cursorNode) {
        let node = cursorNode;
        while (node && node !== currentList) {
          if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'LI') {
            cursorListItem = node as HTMLElement;
            break;
          }
          node = node.parentNode;
        }
        
        if (cursorListItem) {
          const allItems = Array.from(currentList.querySelectorAll('li'));
          cursorListItemIndex = allItems.indexOf(cursorListItem);
        }
      }
      
      // Store whether cursor is at beginning, middle, or end of text node
      let cursorPosition: 'beginning' | 'middle' | 'end' = 'middle';
      if (cursorNode.nodeType === Node.TEXT_NODE) {
        if (cursorOffset === 0) {
          cursorPosition = 'beginning';
        } else if (cursorOffset === cursorNode.textContent?.length) {
          cursorPosition = 'end';
        }
      }
      
      // Store the list items' content and indentation
      const listItems = Array.from(currentList.querySelectorAll('li')).map(item => item as HTMLLIElement);
      const itemsData = listItems.map(item => {
        return {
          html: item.innerHTML,
          textContent: item.textContent,
          indentLevel: item.style.getPropertyValue('--indent-level'),
          paddingLeft: item.style.paddingLeft
        };
      });
      
      // Get alignment of the current list
      const currentAlign = currentList.style.textAlign || '';
      
      // Store current selection details
      const currentRange = selection.getRangeAt(0);
      const currentOffset = currentRange.startOffset;
      const currentContainer = currentRange.startContainer;
      
      // Manual conversion instead of execCommand to preserve cursor position
      const fragment = document.createDocumentFragment();
      
      // Convert each list item to a paragraph
      listItems.forEach((listItem, index) => {
        const paragraph = document.createElement('p');
        
        // Preserve the list item's content - improved content handling
        const originalContent = listItem.innerHTML;
        const originalTextContent = listItem.textContent || '';
        
        // Handle empty or minimal content - use BR for empty paragraphs as it's more stable
        if (!originalContent || originalContent.trim() === '' || originalContent === '<br>' || originalContent === '&nbsp;') {
          // For empty content, use BR tag which is stable in contentEditable
          paragraph.innerHTML = '<br>';
        } else {
          paragraph.innerHTML = originalContent;
        }
        
        // Apply indentation from list item - improved logic
        const data = itemsData[index];
        
        // First try to use --indent-level (preferred method)
        if (data.indentLevel && data.indentLevel.trim() !== '' && data.indentLevel !== '0px' && data.indentLevel !== '0') {
          paragraph.style.paddingLeft = data.indentLevel;
        } 
        // Fallback to direct paddingLeft
        else if (data.paddingLeft && data.paddingLeft.trim() !== '' && data.paddingLeft !== '0px' && data.paddingLeft !== '0') {
          paragraph.style.paddingLeft = data.paddingLeft;
        }
        
        // Apply alignment if the list had it
        if (currentAlign && currentAlign !== 'left' && currentAlign !== 'start') {
          paragraph.style.textAlign = currentAlign;
        }
        
        fragment.appendChild(paragraph);
      });
      
      // Find which paragraph should contain the cursor
      let targetParagraph = fragment.children[cursorListItemIndex] as HTMLElement;
      if (!targetParagraph && fragment.children.length > 0) {
        targetParagraph = fragment.children[0] as HTMLElement;
      }
      
      // Replace the list with the paragraphs
      currentList.parentNode?.replaceChild(fragment, currentList);
      

      
      // Update content FIRST
      if (editorRef.current) {
        const event = new Event('input', { bubbles: true });
        editorRef.current.dispatchEvent(event);
      }
      
                    // THEN handle cursor positioning in a separate microtask to avoid interference
       setTimeout(() => {
          if (editorRef.current) {
            // Find the first paragraph with the matching indentation
            const paragraphs = editorRef.current.querySelectorAll('p');
            let actualTargetParagraph: HTMLElement | null = null;
            
            // Look for a paragraph with matching padding (indentation)
            const targetPaddingLeft = itemsData[cursorListItemIndex]?.indentLevel || itemsData[cursorListItemIndex]?.paddingLeft || '';
            
            for (let i = 0; i < paragraphs.length; i++) {
              const p = paragraphs[i] as HTMLElement;
              const pPadding = p.style.paddingLeft || '';
              
              // Match by indentation and being empty (BR only)
              if (pPadding === targetPaddingLeft && (p.innerHTML === '<br>' || p.textContent?.trim() === '')) {
                actualTargetParagraph = p;
                break;
              }
            }
            
            // Fallback to first paragraph
            if (!actualTargetParagraph && paragraphs.length > 0) {
              actualTargetParagraph = paragraphs[0] as HTMLElement;
            }
            
            if (actualTargetParagraph) {
              // Set cursor to the paragraph - simple and reliable
              const range = document.createRange();
              const selection = window.getSelection();
              
              // For BR-only paragraphs, position cursor at the beginning of the paragraph
              range.setStart(actualTargetParagraph, 0);
              range.collapse(true);
              selection?.removeAllRanges();
              selection?.addRange(range);
              
              // Focus the editor
              editorRef.current.focus();
            }
          }
        }, 0);
      
      return;
    }
    
    // If already in a list, but not of the desired type, convert between UL and OL
    if (currentList && currentList.tagName !== listType) {
      const currentListType = currentList.tagName;
      const alignmentToTransfer = currentList.style.textAlign;



      // Check if we're trying to convert between list types
      if (currentListType === 'UL' && listType === 'OL' || currentListType === 'OL' && listType === 'UL') {
        // Store cursor position before conversion
        const selectionRange = selection.getRangeAt(0);
        const cursorNode = selectionRange.startContainer;
        const cursorOffset = selectionRange.startOffset;
        
        // Find which list item contains the cursor and its index
        let cursorListItem: HTMLElement | null = null;
        let cursorListItemIndex = -1;
        
        if (cursorNode) {
          let node = cursorNode;
          while (node && node !== currentList) {
            if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'LI') {
              cursorListItem = node as HTMLElement;
              break;
            }
            node = node.parentNode;
          }
          
          if (cursorListItem) {
            const allItems = Array.from(currentList.querySelectorAll('li'));
            cursorListItemIndex = allItems.indexOf(cursorListItem);
          }
        }
        
        // Also store whether cursor is at beginning, middle, or end of text node
        let cursorPosition: 'beginning' | 'middle' | 'end' = 'middle';
        if (cursorNode.nodeType === Node.TEXT_NODE) {
          if (cursorOffset === 0) {
            cursorPosition = 'beginning';
          } else if (cursorOffset === cursorNode.textContent?.length) {
            cursorPosition = 'end';
          }
        }
        
        // Store original list item content for potential restoration
        const listItems = currentList ? Array.from(currentList.querySelectorAll('li')).map(item => item as HTMLLIElement) : [];
        const originalContent = listItems.map((item, index) => {
          const itemData = {
            html: item.innerHTML,
            textContent: item.textContent || '',
            paddingLeft: item.style.paddingLeft,
            markerOffset: item.style.getPropertyValue('--marker-offset'),
            indentLevel: item.style.getPropertyValue('--indent-level'),
            fullStyle: item.getAttribute('style')
          };

          return itemData;
        });

        // If list has alignment, we need to preserve it
        if (alignmentToTransfer && alignmentToTransfer !== 'left' && alignmentToTransfer !== 'start') {
          // Disable transitions during conversion to prevent visual movement
          const originalEditorTransition = editorRef.current?.style.transition;
          if (editorRef.current) {
            editorRef.current.style.transition = 'none';
          }
          
          // First remove the current list type, then add the new list type
          document.execCommand(currentListType === 'UL' ? 'insertUnorderedList' : 'insertOrderedList', false);
          document.execCommand(listType === 'UL' ? 'insertUnorderedList' : 'insertOrderedList', false);

          // Find the newly created list and apply alignment
          const sel = window.getSelection();
          let list: HTMLElement | null = null;

          if (sel?.anchorNode) {
            let n: Node | null = sel.anchorNode;
            while (n && n !== editorRef.current) {
              if (
                n.nodeType === Node.ELEMENT_NODE &&
                ((n as HTMLElement).tagName === 'UL' || (n as HTMLElement).tagName === 'OL')
              ) {
                list = n as HTMLElement;
                break;
              }
              n = n.parentNode;
            }
          }



          if (list) {
            // Disable transitions on the list itself
            const originalListTransition = list.style.transition;
            list.style.transition = 'none';
            
            list.style.textAlign = alignmentToTransfer;

            // Get all list items and disable their transitions
            const allListItems = Array.from(list.querySelectorAll('li'));
            const originalItemTransitions: string[] = [];
            allListItems.forEach((item, index) => {
              const listItem = item as HTMLElement;
              originalItemTransitions[index] = listItem.style.transition;
              listItem.style.transition = 'none';
            });

            list.querySelectorAll('li').forEach(liNode => {
              const li = liNode as HTMLElement;

              if (list.tagName === 'UL') {
                li.style.listStylePosition = 'inside';
              }
              li.style.removeProperty('justify-content');

              if (alignmentToTransfer === 'center') {
                li.style.justifyContent = 'center';
              } else if (alignmentToTransfer === 'right') {
                li.style.justifyContent = 'flex-end';
              }

            });
            
            // MISSING PIECE: Restore indentation from original list items
            const newItems = Array.from(list.querySelectorAll('li'));
            newItems.forEach((item, index) => {
              if (index < originalContent.length) {
                const listItem = item as HTMLElement;
                const originalData = originalContent[index];
                

                
                // Restore indentation - prioritize --indent-level over paddingLeft
                if (originalData.indentLevel && originalData.indentLevel !== '' && originalData.indentLevel !== '0px') {
                  listItem.style.setProperty('--indent-level', originalData.indentLevel);
                  listItem.style.removeProperty('padding-left');

                } else if (originalData.paddingLeft && originalData.paddingLeft !== '' && originalData.paddingLeft !== '0px') {
                  listItem.style.paddingLeft = originalData.paddingLeft;
                  listItem.style.removeProperty('--indent-level');
                  
                } else {
                  // No indentation to restore
                  listItem.style.removeProperty('--indent-level');
                  listItem.style.removeProperty('padding-left');
                  
                }
              }
            });
            
            // Force reflows to ensure styles are applied before re-enabling transitions
            list.offsetHeight;
            list.offsetWidth;
            
            // Re-enable transitions after everything is positioned correctly
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                // Restore editor transition
                if (editorRef.current) {
                  editorRef.current.style.transition = originalEditorTransition || '';
                }
                
                // Restore list transition
                list.style.transition = originalListTransition || '';
                
                // Restore item transitions
                allListItems.forEach((item, index) => {
                  const listItem = item as HTMLElement;
                  listItem.style.transition = originalItemTransitions[index] || '';
                });
              });
            });
          }
          
          // Find all paragraphs that were created from the list items
          const range = selection.getRangeAt(0);
          const commonAncestor = range.commonAncestorContainer;
          let paragraphs: HTMLElement[] = [];
          
          if (commonAncestor.nodeType === Node.ELEMENT_NODE) {
            // Walk up a few levels to find paragraphs or divs that were created
            let container = commonAncestor as HTMLElement;
            if (container.tagName !== 'DIV' && container.tagName !== 'P') {
              container = container.parentElement || editorRef.current;
            }
            
            // Find all paragraphs that might have been created
            paragraphs = Array.from(container.querySelectorAll('p'));
          }
          

          // Apply the alignment to all created paragraphs
          paragraphs.forEach((p) => {
            p.style.textAlign = alignmentToTransfer;
            p.setAttribute('data-alignment-fixed', 'true');

          });
          
          // Update the last known alignment
          lastKnownAlignmentRef.current = alignmentToTransfer as TextAlignment;
          setTextAlignment(alignmentToTransfer as TextAlignment);
          
          // Special case for single paragraph - make sure it gets the alignment
          if (paragraphs.length === 0) {
            // If we can't find paragraphs, try a different approach - look at the selection
            const selNode = selection.anchorNode;
            if (selNode) {
              let paragraphNode = selNode;
              if (selNode.nodeType === Node.TEXT_NODE) {
                paragraphNode = selNode.parentNode;
              }
              
              // Apply alignment to the closest paragraph or div
              while (paragraphNode && paragraphNode !== editorRef.current) {
                if (paragraphNode.nodeType === Node.ELEMENT_NODE) {
                  const element = paragraphNode as HTMLElement;
                  if (element.tagName === 'P' || element.tagName === 'DIV') {
                    element.style.textAlign = alignmentToTransfer;
                    element.setAttribute('data-alignment-fixed', 'true');
                    break;
                  }
                }
                paragraphNode = paragraphNode.parentNode;
              }
            }
          }
          
          // Update content to ensure changes are saved
          if (editorRef.current) {
            const event = new Event('input', { bubbles: true });
            editorRef.current.dispatchEvent(event);
          }
        } else {
          // Temporarily disable transitions on the entire editor during list conversion
          const originalEditorTransition = editorRef.current?.style.transition;
          if (editorRef.current) {
            editorRef.current.style.transition = 'none';
          }
          
          // Standard conversion for left-aligned lists, but preserve indentation
          // First remove the current list type, then add the new list type
          document.execCommand(currentListType === 'UL' ? 'insertUnorderedList' : 'insertOrderedList', false);
          document.execCommand(listType === 'UL' ? 'insertUnorderedList' : 'insertOrderedList', false);
          
          // Immediately find and fix the new list (no setTimeout)
          const selection = window.getSelection();
          let newList = null;
          
          if (selection && selection.anchorNode) {
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
            // Also disable transitions on the list itself
            const originalListTransition = newList.style.transition;
            newList.style.transition = 'none';
            
            const newItems = Array.from(newList.querySelectorAll('li'));
            
            // Disable transitions on all list items
            const originalTransitions: string[] = [];
            newItems.forEach((item, index) => {
              const listItem = item as HTMLElement;
              originalTransitions[index] = listItem.style.transition;
              listItem.style.transition = 'none';
            });
            
            // Restore indentation immediately
            newItems.forEach((item, index) => {
              if (index < originalContent.length) {
                const listItem = item as HTMLElement;
                const originalData = originalContent[index];
                

                
                listItem.innerHTML = originalData.html;
                let finalIndentLevel = 0; // Integer value of indent level
                let indentLevelSuccessfullySet = false;

                // 1. Try to use originalData.indentLevel
                if (originalData.indentLevel && originalData.indentLevel !== '') {
                    const parsedOriginalIndent = parseInt(originalData.indentLevel, 10);
                    if (!isNaN(parsedOriginalIndent) && parsedOriginalIndent >= 0) {
                        finalIndentLevel = parsedOriginalIndent;
                        listItem.style.setProperty('--indent-level', finalIndentLevel.toString());
                        indentLevelSuccessfullySet = true;

                    }
                }

                // 2. If not set from originalData.indentLevel, try to derive from originalData.paddingLeft
                if (!indentLevelSuccessfullySet && originalData.paddingLeft) {
                    listItem.style.paddingLeft = originalData.paddingLeft;

                    // listItem.style.removeProperty('--indent-level'); // This was removed in the bad edit, should stay if it was intentional for this logic path

                    // The logic to derive finalIndentLevel from paddingLeft was here.
                    // We need to ensure it is correctly restored if it was meant to be here.
                    // For now, assuming the previous state correctly handled this if block or it was simplified.
                    // The main goal is to remove logs. If paddingLeft implies indentLevel, that logic is separate.
                    // For now, just removing the logs from the restored derivation logic.

                }

                // 3. Fallback if --indent-level is still not successfully set
                if (!indentLevelSuccessfullySet) {
                    listItem.style.setProperty('--indent-level', '0'); // finalIndentLevel remains 0 (its initial value)

                }
              }
            });
            
            // Force multiple reflows to ensure styles are applied
            newList.offsetHeight;
            newList.offsetWidth;
            
            // Re-enable transitions after the browser has definitely rendered
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                // Restore editor transition
                if (editorRef.current) {
                  editorRef.current.style.transition = originalEditorTransition || '';
                }
                
                // Restore list transition
                newList.style.transition = originalListTransition || '';
                
                // Restore item transitions
                newItems.forEach((item, index) => {
                  const listItem = item as HTMLElement;
                  listItem.style.transition = originalTransitions[index] || '';
                });
              });
            });
            
            // Update content
            if (editorRef.current) {
              const event = new Event('input', { bubbles: true });
              editorRef.current.dispatchEvent(event);
            }
          } else {
            // If we couldn't find the list, still restore editor transition
            setTimeout(() => {
              if (editorRef.current) {
                editorRef.current.style.transition = originalEditorTransition || '';
              }
            }, 100);
          }
          
          // Fix cursor position for all list type conversions
          setTimeout(() => {
            // Find the newly created list
            let newList = null;
            
            // Try multiple methods to find the new list
            // Method 1: Starting from selection
            if (selection.anchorNode) {
              let node = selection.anchorNode;
              
              while (node && node !== editorRef.current) {
                if (node.nodeType === 1 && (node as HTMLElement).tagName === listType) {
                  newList = node;
                  break;
                }
                node = node.parentNode;
              }
            }
            
            // Method 2: Direct query if method 1 fails
            if (!newList) {
              newList = editorRef.current?.querySelector(listType === 'UL' ? 'ul' : 'ol');
            }
            
            if (newList) {
              // Get all list items
              const listItems = (newList as HTMLElement).querySelectorAll('li');
              
              // Check if we have original content to restore
              if (originalContent && originalContent.length > 0) {
                // Try to restore original content to the new list
                Array.from(listItems).forEach((item, index) => {
                  if (index < originalContent.length && originalContent[index].html) {
                    // Only restore if current item appears empty or just has a spacer
                    const isEmpty = !item.textContent || 
                                   item.textContent === '\u200B' ||
                                   item.innerHTML.includes('list-item-spacer');
                    
                    if (isEmpty) {
                      item.innerHTML = originalContent[index].html;
                    }
                  }
                });
              }
              
              // Restore cursor to the same list item at approximately the same position
              let targetItem = null;
              
              if (cursorListItemIndex >= 0 && cursorListItemIndex < listItems.length) {
                // If we know which list item had the cursor, use that
                targetItem = listItems[cursorListItemIndex];
              } else if (selection.rangeCount > 0) {
                // Otherwise try to find a list item that contains the selection
                for (let i = 0; i < listItems.length; i++) {
                  if (selection.containsNode(listItems[i], true)) {
                    targetItem = listItems[i];
                    break;
                  }
                }
              }
              
              // If no item contains selection, use first item
              if (!targetItem && listItems.length > 0) {
                targetItem = listItems[0];
              }
              
              if (targetItem) {
                // Place cursor in the right position
                const range = document.createRange();
                
                // Try to get all text nodes
                const walker = document.createTreeWalker(
                  targetItem,
                  NodeFilter.SHOW_TEXT,
                  null
                );
                
                // Find first and last text node
                let firstTextNode = null;
                let lastTextNode = null;
                let textNode = null;
                
                while (textNode = walker.nextNode() as Text) {
                  if (!firstTextNode) {
                    firstTextNode = textNode;
                  }
                  lastTextNode = textNode;
                }
                
                // Choose which text node to use based on stored cursor position
                if (firstTextNode) {
                  if (cursorPosition === 'beginning') {
                    // Place cursor at beginning of first text node
                    range.setStart(firstTextNode, 0);
                  } else if (cursorPosition === 'end' && lastTextNode) {
                    // Place cursor at end of last text node
                    range.setStart(lastTextNode, lastTextNode.textContent?.length || 0);
                  } else {
                    // Place cursor at beginning of first text node by default
                    range.setStart(firstTextNode, 0);
                  }
                } else {
                  // If no text node exists, create one
                  textNode = document.createTextNode('\u200B'); // Zero-width space
                  targetItem.appendChild(textNode);
                  range.setStart(textNode, 0);
                }
                
                // Apply the selection
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
                
                // Ensure the item is visible
                targetItem.scrollIntoView({ block: 'nearest', inline: 'nearest' });
              }
            }
          }, 0);
        }
        
        // Update format states immediately
        updateFormatStates();
        
        // Trigger content update
        if (editorRef.current) {
          const event = new Event('input', { bubbles: true });
          editorRef.current.dispatchEvent(event);
        }
      }
      // If trying to change list type, convert it
      else {
        // 1. Remember the content and any marker formatting classes
        const items = Array.from(currentList.querySelectorAll('li'));
        const contents = items.map((item, index) => {
          const listItem = item as HTMLElement;
          const itemData = {
            html: listItem.innerHTML,
            markerBold: listItem.classList.contains('marker-bold'),
            markerItalic: listItem.classList.contains('marker-italic'),
            markerUnderline: listItem.classList.contains('marker-underline'),
            justifyContent: listItem.style.justifyContent,
            paddingLeft: listItem.style.paddingLeft,
            markerOffset: listItem.style.getPropertyValue('--marker-offset'),
            indentLevel: listItem.style.getPropertyValue('--indent-level'),
            fullStyle: listItem.getAttribute('style')
          };
          return itemData;
        });
        
        // Remember alignment of the current list
        const currentAlign = currentList.style.textAlign;
        
        // 2. Convert list type by first removing current type, then adding new type
        document.execCommand(currentList.tagName === 'UL' ? 'insertUnorderedList' : 'insertOrderedList', false);
        document.execCommand(listType === 'UL' ? 'insertUnorderedList' : 'insertOrderedList', false);
        
        // 3. Find the newly created list
        let newList = null;
        const currentNode = selection.anchorNode;
        if (currentNode) {
          let node = currentNode;
          while (node && node !== editorRef.current) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement;
              if (element.tagName === listType) {
                newList = element;
                break;
              }
            }
            node = node.parentNode;
          }
        }
        
        // 4. If we found the new list, restore content and marker formatting
        if (newList) {
          // Disable transitions on the editor and list immediately
          const originalEditorTransition = editorRef.current?.style.transition;
          const originalListTransition = newList.style.transition;
          
          if (editorRef.current) {
            editorRef.current.style.transition = 'none';
          }
          newList.style.transition = 'none';
          
          // Add the appropriate list style class
          if (listType === 'UL') {
            newList.classList.add('list-disc');
            newList.style.listStyleType = 'disc';
          } else {
            newList.classList.add('list-decimal');
            newList.style.listStyleType = 'decimal';
          }
          
          // Restore previous alignment
          if (currentAlign) {
            (newList as HTMLElement).style.textAlign = currentAlign;
            
            // For right and center alignment on UL lists, ensure proper bullet positioning
            if ((currentAlign === 'right' || currentAlign === 'center') && listType === 'UL') {
              const listItems = newList.querySelectorAll('li');
              listItems.forEach(item => {
                (item as HTMLElement).style.listStylePosition = 'inside';
                
                // Also add justify-content for proper alignment
                (item as HTMLElement).style.removeProperty('justify-content');
                if (currentAlign === 'center') {
                  (item as HTMLElement).style.justifyContent = 'center';
                } else if (currentAlign === 'right') {
                  (item as HTMLElement).style.justifyContent = 'flex-end';
                }
              });
            }
            
            // For ordered lists with center/right alignment, set proper justification on list items
            if (listType === 'OL' && (currentAlign === 'right' || currentAlign === 'center')) {
              const listItems = newList.querySelectorAll('li');
              listItems.forEach(item => {
                if (currentAlign === 'center') {
                  (item as HTMLElement).style.justifyContent = 'center';
                } else if (currentAlign === 'right') {
                  (item as HTMLElement).style.justifyContent = 'flex-end';
                }
              });
            }
          }
          
          const newItems = Array.from(newList.querySelectorAll('li'));
          
          // Disable transitions on all list items
          const originalTransitions: string[] = [];
          newItems.forEach((item, index) => {
            const listItem = item as HTMLElement;
            originalTransitions[index] = listItem.style.transition;
            listItem.style.transition = 'none';
          });
          
          newItems.forEach((item, index) => {
            if (index < contents.length) {
              const listItem = item as HTMLElement;
              const originalData = contents[index];
              
              listItem.innerHTML = originalData.html;
              let finalIndentLevel = 0; // Integer value of indent level
              let indentLevelSuccessfullySet = false;

              // 1. Try to use originalData.indentLevel
              if (originalData.indentLevel && originalData.indentLevel !== '') {
                  const parsedOriginalIndent = parseInt(originalData.indentLevel, 10);
                  if (!isNaN(parsedOriginalIndent) && parsedOriginalIndent >= 0) {
                      finalIndentLevel = parsedOriginalIndent;
                      listItem.style.setProperty('--indent-level', finalIndentLevel.toString());
                      indentLevelSuccessfullySet = true;
                  }
              }

              // 2. If not set from originalData.indentLevel, try to derive from originalData.paddingLeft
              if (!indentLevelSuccessfullySet && originalData.paddingLeft) {
                  listItem.style.paddingLeft = originalData.paddingLeft;
                  // listItem.style.removeProperty('--indent-level'); // This was removed in the bad edit, should stay if it was intentional for this logic path

                  // The logic to derive finalIndentLevel from paddingLeft was here.
                  // We need to ensure it is correctly restored if it was meant to be here.
                  // For now, assuming the previous state correctly handled this if block or it was simplified.
                  // The main goal is to remove logs. If paddingLeft implies indentLevel, that logic is separate.
                  // For now, just removing the logs from the restored derivation logic.

              }

              // 3. Fallback if --indent-level is still not successfully set
              if (!indentLevelSuccessfullySet) {
                  listItem.style.setProperty('--indent-level', '0'); // finalIndentLevel remains 0 (its initial value)
              }
              
              // Restore marker formatting if this is an ordered list (listType === 'OL')
              if (listType === 'OL') {
                // Restore specific marker styles (bold, italic, underline) if they existed.
                if (originalData.markerBold) listItem.classList.add('marker-bold');
                if (originalData.markerItalic) listItem.classList.add('marker-italic');
                if (originalData.markerUnderline) listItem.classList.add('marker-underline');
                
                // Restore justifyContent (text alignment within marker area) if it was set.
                if (originalData.justifyContent) {
                  listItem.style.justifyContent = originalData.justifyContent;
                }
                
                // Set marker offset based on the final indent level.
                const baseMarkerOffset = 0.5; // em
                const indentStep = 1.5; // em
                const newMarkerOffset = baseMarkerOffset + (finalIndentLevel * indentStep);
                listItem.style.setProperty('--marker-offset', `${newMarkerOffset}em`);
              }
            }
          });
          
          // Force multiple reflows to ensure styles are applied
          newList.offsetHeight;
          newList.offsetWidth;
          
          // Re-enable transitions after the browser has definitely rendered
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              // Restore editor transition
              if (editorRef.current) {
                editorRef.current.style.transition = originalEditorTransition || '';
              }
              
              // Restore list transition
              newList.style.transition = originalListTransition || '';
              
              // Restore item transitions
              newItems.forEach((item, index) => {
                const listItem = item as HTMLElement;
                listItem.style.transition = originalTransitions[index] || '';
              });
            });
          });
        }
      }
    } else {
      // Not in a list, use standard command
      const originalSelection = window.getSelection();
      let cursorOffset = 0;
      let textNode: Text | null = null;
      let originalText = '';
      
      let initialIndentPx = 0;
      let blockToClearPadding: HTMLElement | null = null;

      if (originalSelection && originalSelection.rangeCount > 0) {
        const range = originalSelection.getRangeAt(0);
        cursorOffset = range.startOffset;
        let currentElementForIndentSearch: Node | null = range.startContainer;

        // Traverse up to find the P or DIV that has padding-left
        while (currentElementForIndentSearch && currentElementForIndentSearch !== editorRef.current) {
            if (currentElementForIndentSearch.nodeType === Node.ELEMENT_NODE) {
                const htmlElement = currentElementForIndentSearch as HTMLElement;
                if (['P', 'DIV'].includes(htmlElement.tagName) && htmlElement.style.paddingLeft) {
                    const pxVal = parseInt(htmlElement.style.paddingLeft, 10);
                    if (!isNaN(pxVal) && pxVal > 0) {
                        initialIndentPx = pxVal;
                        blockToClearPadding = htmlElement;
                        break; // Found the relevant block
                    }
                }
            }
            currentElementForIndentSearch = currentElementForIndentSearch.parentNode;
        }
        
        // Fallback if selection was directly on text node and loop above didn't catch parent P/DIV immediately
        if (!blockToClearPadding && range.startContainer.nodeType === Node.TEXT_NODE) {
            textNode = range.startContainer as Text;
            originalText = textNode.textContent || '';
            let parentBlock = textNode.parentElement;
            // Traverse up from text node's parent
            while (parentBlock && parentBlock !== editorRef.current) {
                if (['P', 'DIV'].includes(parentBlock.tagName) && parentBlock.style.paddingLeft) {
                    const pxVal = parseInt(parentBlock.style.paddingLeft, 10);
                    if (!isNaN(pxVal) && pxVal > 0) {
                        initialIndentPx = pxVal;
                        blockToClearPadding = parentBlock;
                        break; 
                    }
                }
                 if (['P', 'DIV'].includes(parentBlock.tagName)) break; // Stop if we hit a P/DIV without padding
                parentBlock = parentBlock.parentElement;
            }
        }
      }
      
      const originalPaddingValue = blockToClearPadding?.style.paddingLeft;

      // Create the list
      document.execCommand(listType === 'UL' ? 'insertUnorderedList' : 'insertOrderedList', false);
      
      // Get the new selection and find the list element and first item
      const newSelection = window.getSelection();
      let newListElement: HTMLElement | null = null;
      let firstItem: HTMLLIElement | null = null;
      
      if (newSelection && newSelection.rangeCount > 0) {
        let listNodeAnchor = newSelection.anchorNode;
        let tempNode = listNodeAnchor;
        while (tempNode && tempNode !== editorRef.current) {
          if (tempNode.nodeType === Node.ELEMENT_NODE && 
              ((tempNode as HTMLElement).tagName === 'UL' || (tempNode as HTMLElement).tagName === 'OL')) { // Check for UL or OL
            newListElement = tempNode as HTMLElement;
            break; 
          }
          tempNode = tempNode.parentNode;
        }
        
        if (newListElement) {
          firstItem = newListElement.querySelector('li:first-child');
        }
      }
      
      // If the original indented block still exists and now appears to contain the new list, remove its padding.
      if (blockToClearPadding && editorRef.current?.contains(blockToClearPadding) && newListElement && blockToClearPadding.contains(newListElement)) {
          // And ensure it's not the editor itself
          if (blockToClearPadding !== editorRef.current) {
            blockToClearPadding.style.removeProperty('padding-left');
          }
      }
      
      if (newListElement) {
        // Find the first list item again, just in case DOM changed
        firstItem = newListElement.querySelector('li:first-child') as HTMLLIElement | null;

        if (firstItem) {
          // Add appropriate classes to the list
          if (listType === 'OL') {
            firstItem.classList.add('list-spacing-fixed');
            if (!newListElement.classList.contains('list-decimal')) {
              newListElement.classList.add('list-decimal');
            }
          } else if (listType === 'UL') {
            if (!newListElement.classList.contains('list-disc')) {
              newListElement.classList.add('list-disc');
            }
          }

          // Apply captured initial indentation to the first list item
          if (initialIndentPx > 0) {
            firstItem.style.setProperty('--indent-level', `${initialIndentPx}px`);
          }
          
          // Fix cursor positioning in list item with a slight delay to ensure DOM is updated
          setTimeout(() => {
            // Find or create a text node inside the list item for cursor placement
            const walker = document.createTreeWalker(
              firstItem, 
              NodeFilter.SHOW_TEXT,
              null
            );
            
            let textNode = walker.nextNode();
            
            // If no text node exists, create one
            if (!textNode) {
              // Create a non-breaking space for cursor visibility
              textNode = document.createTextNode('\u00A0'); // Non-breaking space
              
              // Clear any existing content (like <br> tags)
              if (firstItem.innerHTML === '<br>') {
                firstItem.innerHTML = '';
              }
              
              // Append the text node
              firstItem.appendChild(textNode);
            }
            
            // Set the cursor position
            if (textNode) {
              const range = document.createRange();
              // Place cursor at the beginning of the text
              range.setStart(textNode, 0);
              range.collapse(true);
              
              // Apply the selection
              newSelection.removeAllRanges();
              newSelection.addRange(range);
              
              // Ensure the list item is visible
              firstItem.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }
          }, 10);
          
          // Apply alignment if needed
          if (currentAlignment !== 'left') {
            newListElement.style.textAlign = currentAlignment;
            
            if (newListElement.tagName === 'OL') {
              const listItems = newListElement.querySelectorAll('li');
              listItems.forEach(item => {
                (item as HTMLElement).style.removeProperty('justify-content');
                if (currentAlignment === 'center') {
                  (item as HTMLElement).style.justifyContent = 'center';
                } else if (currentAlignment === 'right') {
                  (item as HTMLElement).style.justifyContent = 'flex-end';
                }
              });
            }
            
            if (newListElement.tagName === 'UL' && currentAlignment !== 'left') {
              const listItems = newListElement.querySelectorAll('li');
              listItems.forEach(item => {
                (item as HTMLElement).style.listStylePosition = 'inside';
                
                // Also apply justify-content for UL items just like OL items
                (item as HTMLElement).style.removeProperty('justify-content');
                if (currentAlignment === 'center') {
                  (item as HTMLElement).style.justifyContent = 'center';
                } else if (currentAlignment === 'right') {
                  (item as HTMLElement).style.justifyContent = 'flex-end';
                }
              });
            }
            lastKnownAlignmentRef.current = currentAlignment as TextAlignment;
            setTextAlignment(currentAlignment as TextAlignment);
          }
          
          // Trigger callback for ordered lists
          if (listType === 'OL') { 
            // If initial indent was applied, we need to ensure this doesn't override it.
            // The onNewListCreated callback might reset cursor or styles.
            // For now, let's assume it's okay or adjust it later if needed.
            onNewListCreated?.();
          }
        }
      }
    }
    
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