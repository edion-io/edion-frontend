import { useEffect } from 'react';
import 'mathlive';
import useInlineMath from '../../hooks/useInlineMath';

interface ListStyle {
  className: string;
  marker: string;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        value?: string;
        'virtual-keyboard-mode'?: string;
      }, HTMLElement>;
    }
  }
}

interface RichTextAreaProps {
  content: string;
  onChange: (newContent: string) => void;
  editorRef: React.RefObject<HTMLDivElement>;
  onFormatCommand?: (command: string, value?: string) => void;
}

// Add type declaration at the top of the file to support our custom property
declare global {
  interface HTMLElement {
    _spaceFixScheduled?: ReturnType<typeof setTimeout>;
  }
}

const RichTextArea = ({ content, onChange, editorRef, onFormatCommand }: RichTextAreaProps) => {
  const { handleKeyDown: handleInlineMathKeyDown, handleMathFieldDelete } = useInlineMath();
  
  const addMathFieldInputListener = (mathField: Element) => {
    mathField.addEventListener('input', () => {
        const updatedLatex = (mathField as any).value;
        mathField.setAttribute('data-latex', updatedLatex);
        mathField.setAttribute('value', updatedLatex);
        if (editorRef.current) {
          onChange(editorRef.current.innerHTML);
        }
    });
  };
  
  const isListItemEmpty = (li: HTMLElement | null): boolean => {
    if (!li) return false;
    // An item is not empty if it contains a math-field, image, or table.
    if (li.querySelector('math-field, img, table')) {
      return false;
    }
    // An item is empty if its text content is effectively empty
    // (only whitespace, ZWS, or NBSP) or if its only content is a <br> tag.
    const textContent = li.textContent || '';
    return textContent.replace(/[\u00A0\u200B]/g, ' ').trim() === '' || li.innerHTML === '<br>';
  };
  
  // Define ordered list styles in sequence: decimal (1, 2, 3), alpha (a, b, c), roman (i, ii, iii)
  const orderedListStyles: ListStyle[] = [
    { className: 'list-decimal', marker: 'decimal' },
    { className: 'list-alpha', marker: 'lower-alpha' },
    { className: 'list-roman', marker: 'lower-roman' }
  ];
  
  // Define unordered list styles in sequence: disc, circle, square
  const unorderedListStyles: ListStyle[] = [
    { className: 'list-disc', marker: 'disc' },
    { className: 'list-circle', marker: 'circle' },
    { className: 'list-square', marker: 'square' }
  ];
  
  const PX_PER_EM_LEVEL = 24; // Approx 1.5em * 16px/em (used by toolbar for one indent step)
  const TAB_INDENT_STEP_PX = 40;

  // Calculate responsive maximum indentation based on editor width
  const getMaxIndentPx = (): number => {
    if (!editorRef.current) return 800; // Fallback to old limit
    
    const editorWidth = editorRef.current.offsetWidth;
    const padding = 32; // Account for editor padding (16px * 2)
    const availableWidth = editorWidth - padding;
    
    // Allow indentation up to 70% of available width, leaving 30% for content
    const maxIndentPx = Math.floor(availableWidth * 0.7);
    
    // Ensure minimum space for content (at least 200px) and reasonable maximum
    return Math.min(Math.max(maxIndentPx, 200), 1200);
  };

  const getEffectivePxIndent = (listItem: HTMLElement): number => {
    const indentLevelStyle = listItem.style.getPropertyValue('--indent-level');

    if (indentLevelStyle && indentLevelStyle.endsWith('px')) {
      const pxVal = parseInt(indentLevelStyle, 10);
      if (!isNaN(pxVal)) {
        return pxVal;
      }
    }

    const paddingLeftStyle = listItem.style.paddingLeft;

    if (paddingLeftStyle && paddingLeftStyle.endsWith('em')) {
      const emVal = parseFloat(paddingLeftStyle);
      if (!isNaN(emVal)) {
        // Determine base padding for the list type to subtract it
        const listElement = listItem.closest('ul, ol') as HTMLElement | null;
        let baseEmPadding = 1.5; // Default for UL
        if (listElement && listElement.tagName === 'OL') {
          baseEmPadding = 2.2; // For OL
        }
        const netEmIndent = Math.max(0, emVal - baseEmPadding);
        // Convert em levels (1.5em per level) to px. Each 1.5em is one PX_PER_EM_LEVEL step.
        const numEmLevels = netEmIndent / 1.5; 
        const calculatedPx = Math.round(numEmLevels * PX_PER_EM_LEVEL); 
        return calculatedPx; 
      }
    }
    return 0;
  };
  
  const handleIndent = (listItem: HTMLElement, listElement: HTMLElement) => {
    let currentPxIndent = getEffectivePxIndent(listItem);
    const maxIndent = getMaxIndentPx();
    const newIndent = Math.min(currentPxIndent + TAB_INDENT_STEP_PX, maxIndent);
    
    listItem.style.setProperty('--indent-level', `${newIndent}px`);
    listItem.style.removeProperty('padding-left');
    listItem.style.removeProperty('list-style-position');
    listItem.classList.forEach(cls => {
      if (cls.startsWith('indent-')) listItem.classList.remove(cls);
    });

    // Add visual indicator if at maximum indent
    if (newIndent >= maxIndent) {
      listItem.classList.add('max-indent-reached');
    } else {
      listItem.classList.remove('max-indent-reached');
    }
  };

  const handleOutdent = (listItem: HTMLElement, listElement: HTMLElement) => {
    let currentPxIndent = getEffectivePxIndent(listItem);

    if (currentPxIndent > 0) {
      const newIndent = Math.max(0, currentPxIndent - TAB_INDENT_STEP_PX);
      if (newIndent === 0) {
        listItem.style.removeProperty('--indent-level');
        listItem.style.removeProperty('padding-left');
        listItem.style.removeProperty('list-style-position');
        listItem.classList.forEach(cls => {
          if (cls.startsWith('indent-')) listItem.classList.remove(cls);
        });
      } else {
        listItem.style.setProperty('--indent-level', `${newIndent}px`);
        // Ensure other styles are also cleaned if we are setting --indent-level
        listItem.style.removeProperty('padding-left');
        listItem.style.removeProperty('list-style-position');
        listItem.classList.forEach(cls => {
          if (cls.startsWith('indent-')) listItem.classList.remove(cls);
        });
      }

      // Remove max indent indicator when outdenting
      listItem.classList.remove('max-indent-reached');
    }
  };
  
  // Handle keyboard events in the editor
  const handleEditorKeyDown = (e: React.KeyboardEvent) => {
    // First call the inline math handler
    handleInlineMathKeyDown(e);

    // Handle arrow key navigation for math blocks
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;
      
      const range = selection.getRangeAt(0);
      const target = e.target as HTMLElement;
      
      
      // Special handler for moving left from a space (regular or ZWS) into a math field
      if (e.key === 'ArrowLeft' &&
          range.startContainer.nodeType === Node.TEXT_NODE) {
          
          // Check if we're in a space between math fields and at the start, or just a single-char space
          const textContent = range.startContainer.textContent || '';
          const isAtStart = range.startOffset === 0;
          const isSpaceNode = textContent === '\u200B' || textContent === ' ';
          
          if (isAtStart || isSpaceNode) {
            const potentialMathField = range.startContainer.previousSibling;
            
            if (potentialMathField && potentialMathField instanceof HTMLElement && potentialMathField.classList.contains('math-field')) {
                e.preventDefault();
                const mathFieldElement = potentialMathField as any;
                mathFieldElement.focus();
                mathFieldElement.executeCommand(['moveTo', 'end']); // Move caret to the end
                return;
            }
          }
      }
      
      // Special handler for moving right from a space (regular or ZWS) into a math field
      if (e.key === 'ArrowRight' &&
          range.startContainer.nodeType === Node.TEXT_NODE) {
          
          // Check if we're in a space between math fields and at the end, or just a single-char space
          const textContent = range.startContainer.textContent || '';
          const isAtEnd = range.startOffset === textContent.length;
          const isSpaceNode = textContent === '\u200B' || textContent === ' ';
          
          if (isAtEnd || isSpaceNode) {
            const potentialMathField = range.startContainer.nextSibling;
            
            if (potentialMathField && potentialMathField instanceof HTMLElement && potentialMathField.classList.contains('math-field')) {
                e.preventDefault();
                const mathFieldElement = potentialMathField as any;
                mathFieldElement.focus();
                mathFieldElement.executeCommand(['moveTo', 'start']); // Move caret to the start
                return;
            }
          }
      }
      
      // Check if we're next to a math field
      let mathField: HTMLElement | null = null;
      
      if (e.key === 'ArrowRight') {
        // Check if we're just before a math field
        let nextNode: Node | null = null;
        
        
        // If we're at the end of a text node, look for next sibling
        if (range.startOffset === (range.startContainer.textContent?.length || 0)) {
          nextNode = range.startContainer.nextSibling;
          
        }
        // If we're at an element boundary, check the next node at that position
        else if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
          nextNode = (range.startContainer as Element).childNodes[range.startOffset];
          
        }
        
        // If we haven't found a next node yet, try parent's next sibling
        if (!nextNode && range.startContainer.parentNode) {
          nextNode = range.startContainer.parentNode.nextSibling;
          
        }
        
        // Check if the next node is a math field
        if (nextNode && nextNode instanceof HTMLElement && nextNode.classList.contains('math-field')) {
          mathField = nextNode;
          
        }
      } else if (e.key === 'ArrowLeft') {
        // Check if we're just after a math field
        let prevNode: Node | null = null;
        
        // If we're at the start of a text node, look for previous sibling
        if (range.startOffset === 0) {
          prevNode = range.startContainer.previousSibling;
        }
        // If we're at an element boundary, check the previous node at that position
        else if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
          prevNode = (range.startContainer as Element).childNodes[range.startOffset - 1];
        }
        
        // If we haven't found a previous node yet, try parent's previous sibling
        if (!prevNode && range.startContainer.parentNode) {
          prevNode = range.startContainer.parentNode.previousSibling;
        }
        
        // Check if the previous node is a math field
        if (prevNode && prevNode instanceof HTMLElement && prevNode.classList.contains('math-field')) {
          mathField = prevNode;
        }
      }
      
      // If we found a math field and we're at the edge of the current text node
      if (mathField) {
        const isAtStart = range.startOffset === 0;
        const isAtEnd = range.startOffset === (range.startContainer.textContent?.length || 0);
        
        // For right movement, also check if we're at an element boundary
        const isAtElementBoundary = range.startContainer.nodeType === Node.ELEMENT_NODE && 
                                  (e.key === 'ArrowRight' ? 
                                    range.startOffset === range.startContainer.childNodes.length :
                                    range.startOffset === 0);
        
        const inSpaceNodeForLeft = e.key === 'ArrowLeft' && 
                                     range.startContainer.nodeType === Node.TEXT_NODE &&
                                     (range.startContainer.textContent === '\u200B' || range.startContainer.textContent === ' ') &&
                                     range.startOffset === 0;
                                     
        const inSpaceNodeForRight = e.key === 'ArrowRight' && 
                                     range.startContainer.nodeType === Node.TEXT_NODE &&
                                     (range.startContainer.textContent === '\u200B' || range.startContainer.textContent === ' ') &&
                                     range.startOffset === range.startContainer.textContent.length;

        

        if ((e.key === 'ArrowRight' && (isAtEnd || isAtElementBoundary || inSpaceNodeForRight)) || 
            (e.key === 'ArrowLeft' && (isAtStart || isAtElementBoundary || inSpaceNodeForLeft))) {
          e.preventDefault();
          
          
          // Focus the math field - MathLive will automatically position the cursor
          // at the start when moving right, and at the end when moving left
          (mathField as any).focus();
          return;
        }
      }
      
      // Handle cursor movement from within math field
      if (target.classList.contains('math-field')) {
        const mathField = target as any;
        const initialPosition = mathField.position;
        const mathValue = mathField.value;

        
        
        // Use MathLive's built-in edge detection for complex expressions
        // Try to move in the direction first, then check if we're still in the same position
        
        // NEW: explicit position-based edge detection as fallback
        const atVeryLeft = initialPosition === 0;
        const atVeryRight = typeof mathValue === 'string' ? initialPosition === mathValue.length : false;
        
        // Temporarily try to move the cursor in the desired direction
        let isAtEdge = false;
        
        if (e.key === 'ArrowRight') {
          // Try to move right
          mathField.executeCommand(['moveToNextChar']);
          const newPosition = mathField.position;
          
          // If position didn't change, we're at the right edge
          isAtEdge = (newPosition === initialPosition) || atVeryRight;
          
          // Move back to original position
          mathField.position = initialPosition;
        } else if (e.key === 'ArrowLeft') {
          // Try to move left
          mathField.executeCommand(['moveToPreviousChar']);
          const newPosition = mathField.position;
          
          // If position didn't change, we're at the left edge
          isAtEdge = (newPosition === initialPosition) || atVeryLeft;
          
          // Move back to original position
          mathField.position = initialPosition;
        }
        
        const isAtRightEdge = e.key === 'ArrowRight' && isAtEdge;
        const isAtLeftEdge = e.key === 'ArrowLeft' && isAtEdge;
        
        
        if (isAtRightEdge || isAtLeftEdge) {
          
          e.preventDefault();
          
          // Find the adjacent node
          const adjacentNode = e.key === 'ArrowRight' ? target.nextSibling : target.previousSibling;
          
          
          
          if (adjacentNode) {
            // Always position cursor in the adjacent space first
            const newRange = document.createRange();
            if (adjacentNode.nodeType === Node.TEXT_NODE) {
              // Position cursor at the edge of the text node that's closest to the math field
              if (e.key === 'ArrowRight') {
                newRange.setStart(adjacentNode, 0);
                
              } else {
                const offset = adjacentNode.textContent!.length;
                newRange.setStart(adjacentNode, offset);
                
              }
            } else {
              // For other nodes, position at their edge closest to the math field
              if (e.key === 'ArrowRight') {
                newRange.setStart(adjacentNode, 0);
              } else {
                const childCount = adjacentNode.nodeType === Node.ELEMENT_NODE ? 
                  (adjacentNode as Element).childNodes.length : 0;
                newRange.setStart(adjacentNode, childCount);
              }
              
            }
            newRange.collapse(true);
            
            // Apply the new selection
            selection.removeAllRanges();
            selection.addRange(newRange);
            
          } else {
            
            // Create a new text node if needed
            const textNode = document.createTextNode('\u00A0'); // Use non-breaking space for visibility
            if (e.key === 'ArrowRight') {
              target.parentNode?.insertBefore(textNode, target.nextSibling);
            } else {
              target.parentNode?.insertBefore(textNode, target);
            }
            
            // Position cursor in the new text node
            const newRange = document.createRange();
            newRange.setStart(textNode, 1); // Position after the ZWS
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
          }
          return; // Stop further event handling
        } else {
          // If we're inside a math field but not at the exit condition, don't process the "entering math field" logic
          
          return;
        }
      }
    }

    // Handle backspace for math blocks
    if (e.key === 'Backspace') {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        
        // Check if we're at the start of a text node right after a math-field
        if (range.collapsed) {
          let node = range.startContainer;
          let offset = range.startOffset;
          let mathNode: Node | null = null;
          
          // If we're in a text node
          if (node.nodeType === Node.TEXT_NODE) {
            // If we're at the beginning of a text node or it only contains whitespace
            if (offset === 0 || (node.textContent || '').trim() === '') {
              mathNode = node.previousSibling;
              // If this text node is empty/whitespace, mark it for removal
              if ((node.textContent || '').trim() === '') {
                node.parentNode?.removeChild(node);
              }
            }
          } else if (node.nodeType === Node.ELEMENT_NODE && offset > 0) {
            // If we're in an element node, get the child before the current position
            mathNode = (node as HTMLElement).childNodes[offset - 1];
            
            // Check for and remove any empty text nodes after the math field
            const nextNode = mathNode?.nextSibling;
            if (nextNode && nextNode.nodeType === Node.TEXT_NODE && 
                (nextNode.textContent || '').trim() === '') {
              nextNode.parentNode?.removeChild(nextNode);
            }
          }
          
          // Check if we found a math-field
          if (mathNode && mathNode.nodeType === Node.ELEMENT_NODE && 
              (mathNode as HTMLElement).classList.contains('math-field')) {
            e.preventDefault();
            mathNode.parentNode?.removeChild(mathNode);
            if (editorRef.current) {
              onChange(editorRef.current.innerHTML);
            }
            return;
          }
        }
      }
    }

    // Handle keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          if (onFormatCommand) {
            onFormatCommand('bold');
          } else {
            // Fallback to direct command if no handler provided
            document.execCommand('bold');
            if (editorRef.current) {
              const event = new Event('input', { bubbles: true });
              editorRef.current.dispatchEvent(event);
            }
          }
          return;
        case 'i':
          e.preventDefault();
          if (onFormatCommand) {
            onFormatCommand('italic');
          } else {
            // Fallback to direct command if no handler provided
            document.execCommand('italic');
            if (editorRef.current) {
              const event = new Event('input', { bubbles: true });
              editorRef.current.dispatchEvent(event);
            }
          }
          return;
        case 'u':
          e.preventDefault();
          if (onFormatCommand) {
            onFormatCommand('underline');
          } else {
            // Fallback to direct command if no handler provided
            document.execCommand('underline');
            if (editorRef.current) {
              const event = new Event('input', { bubbles: true });
              editorRef.current.dispatchEvent(event);
            }
          }
          return;
        case 'l':
          e.preventDefault();
          if (e.shiftKey) {
            // Ctrl+Shift+L for numbered list
            document.execCommand('insertOrderedList');
          } else {
            // Ctrl+L for bullet list
            document.execCommand('insertUnorderedList');
          }
          if (editorRef.current) {
            const event = new Event('input', { bubbles: true });
            editorRef.current.dispatchEvent(event);
          }
          return;
        case '.':
          if (e.shiftKey) {
            // Ctrl+Shift+> for indent
            e.preventDefault();
            // Trigger indent functionality
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              let node = range.startContainer;
              let listItem = null;
              
              // Find list item or block element to indent
              while (node && node !== editorRef.current) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                  const element = node as HTMLElement;
                  if (element.tagName === 'LI') {
                    listItem = element;
                    break;
                  }
                }
                node = node.parentNode;
              }
              
              if (listItem) {
                // Apply list indent (simplified version)
                const currentIndent = parseInt(listItem.style.getPropertyValue('--indent-level') || '0', 10);
                const maxIndent = getMaxIndentPx();
                const newIndent = Math.min(currentIndent + 40, maxIndent);
                listItem.style.setProperty('--indent-level', `${newIndent}px`);
                
                // Add/remove visual indicator for maximum indent
                if (newIndent >= maxIndent) {
                  listItem.classList.add('max-indent-reached');
                } else {
                  listItem.classList.remove('max-indent-reached');
                }
              } else {
                // Apply paragraph indent
                let paragraph = range.startContainer;
                if (paragraph.nodeType === Node.TEXT_NODE) {
                  paragraph = paragraph.parentNode;
                }
                while (paragraph && paragraph !== editorRef.current) {
                  if (paragraph.nodeType === Node.ELEMENT_NODE) {
                    const element = paragraph as HTMLElement;
                    if (['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(element.tagName)) {
                                          const currentPadding = parseInt(element.style.paddingLeft || '0', 10);
                    const maxIndent = getMaxIndentPx();
                    const newPadding = Math.min(currentPadding + 40, maxIndent);
                    element.style.paddingLeft = `${newPadding}px`;
                    
                    // Add/remove visual indicator for maximum indent
                    if (newPadding >= maxIndent) {
                      element.classList.add('max-indent-reached');
                    } else {
                      element.classList.remove('max-indent-reached');
                    }
                      break;
                    }
                  }
                  paragraph = paragraph.parentNode;
                }
              }
              
              if (editorRef.current) {
                onChange(editorRef.current.innerHTML);
              }
            }
            return;
          }
          break;
        case ',':
          if (e.shiftKey) {
            // Ctrl+Shift+< for outdent
            e.preventDefault();
            // Trigger outdent functionality
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              let node = range.startContainer;
              let listItem = null;
              
              // Find list item or block element to outdent
              while (node && node !== editorRef.current) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                  const element = node as HTMLElement;
                  if (element.tagName === 'LI') {
                    listItem = element;
                    break;
                  }
                }
                node = node.parentNode;
              }
              
              if (listItem) {
                // Apply list outdent (simplified version)
                const currentIndent = parseInt(listItem.style.getPropertyValue('--indent-level') || '0', 10);
                const newIndent = Math.max(currentIndent - 40, 0);
                if (newIndent === 0) {
                  listItem.style.removeProperty('--indent-level');
                } else {
                  listItem.style.setProperty('--indent-level', `${newIndent}px`);
                }
                
                // Remove max indent indicator when outdenting
                listItem.classList.remove('max-indent-reached');
              } else {
                // Apply paragraph outdent
                let paragraph = range.startContainer;
                if (paragraph.nodeType === Node.TEXT_NODE) {
                  paragraph = paragraph.parentNode;
                }
                while (paragraph && paragraph !== editorRef.current) {
                  if (paragraph.nodeType === Node.ELEMENT_NODE) {
                    const element = paragraph as HTMLElement;
                    if (['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(element.tagName)) {
                      const currentPadding = parseInt(element.style.paddingLeft || '0', 10);
                      const newPadding = Math.max(currentPadding - 40, 0);
                      if (newPadding === 0) {
                        element.style.removeProperty('padding-left');
                      } else {
                        element.style.paddingLeft = `${newPadding}px`;
                      }
                      
                      // Remove max indent indicator when outdenting
                      element.classList.remove('max-indent-reached');
                      break;
                    }
                  }
                  paragraph = paragraph.parentNode;
                }
              }
              
              if (editorRef.current) {
                onChange(editorRef.current.innerHTML);
              }
            }
            return;
          }
          break;
      }
    }

    // Handle Enter key in lists for better line creation
    if (e.key === 'Enter' && !e.shiftKey) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const target = e.target as HTMLElement;

        // Handle 'Enter' from within a math block in a list
        if (target.classList.contains('math-field')) {
          const listItem = target.closest('li');
          if (listItem) {
            e.preventDefault();
            e.stopPropagation(); // Stop the event from bubbling further

            const newListItem = document.createElement('li');
            const space = document.createTextNode('\u00A0'); // Use a non-breaking space
            newListItem.appendChild(space);

            // Insert the new list item after the current one
            listItem.parentNode?.insertBefore(newListItem, listItem.nextSibling);

            // Move cursor to the new list item
            const newRange = document.createRange();
            newRange.setStart(space, 1); // Position cursor after the space
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);

            // Update content
            if (editorRef.current) {
              onChange(editorRef.current.innerHTML);
            }
            return;
          }
        }

        let node = range.startContainer;
        let listItem = null;
        
        // Check if we're in a list item
        while (node && node !== editorRef.current) {
          if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'LI') {
            listItem = node as HTMLElement;
            break;
          }
          node = node.parentNode;
        }
        
        // If we're in a list item and it's empty, break out of the list
        if (listItem) {
          const isEmpty = isListItemEmpty(listItem);
          
          if (isEmpty) {
            e.preventDefault();
            
            // Create a new paragraph after the list
            const list = listItem.closest('ul, ol') as HTMLElement;
            const paragraph = document.createElement('p');
            paragraph.innerHTML = '<br>';
            
            // Apply any indentation from the list item
            const indentLevel = listItem.style.getPropertyValue('--indent-level');
            const paddingLeft = listItem.style.paddingLeft;
            
            if (indentLevel && indentLevel !== '0px') {
              paragraph.style.paddingLeft = indentLevel;
            } else if (paddingLeft) {
              paragraph.style.paddingLeft = paddingLeft;
            }
            
            // Insert paragraph after the list
            if (list && list.parentNode) {
              if (list.querySelectorAll('li').length === 1) {
                // Only one item, replace the entire list
                list.parentNode.replaceChild(paragraph, list);
              } else {
                // Multiple items, remove this item and add paragraph after list
                listItem.remove();
                list.parentNode.insertBefore(paragraph, list.nextSibling);
              }
              
              // Set cursor to the new paragraph
              const newRange = document.createRange();
              newRange.setStart(paragraph, 0);
              newRange.collapse(true);
              selection.removeAllRanges();
              selection.addRange(newRange);
              
              // Update content
              if (editorRef.current) {
                onChange(editorRef.current.innerHTML);
              }
            }
            return;
          }
        }
      }
    }
    
    // Handle arrow key navigation in tables
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        let node = range.startContainer;
        let tableCell = null;
        
        // Find if we're in a table cell
        while (node && node !== editorRef.current) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            if (element.tagName === 'TD' || element.tagName === 'TH') {
              tableCell = element;
              break;
            }
          }
          node = node.parentNode;
        }
        
        if (tableCell) {
          const table = tableCell.closest('table') as HTMLTableElement;
          if (table) {
            // Only handle navigation if we're at the edge of the cell content
            const atStart = range.startOffset === 0 && range.startContainer === (tableCell.firstChild || tableCell);
            const atEnd = range.startOffset === (range.startContainer.textContent?.length || 0) && range.startContainer === (tableCell.lastChild || tableCell);
            
            if ((e.key === 'ArrowLeft' && atStart) || 
                (e.key === 'ArrowRight' && atEnd) ||
                (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
              
              e.preventDefault();
              
              const rows = Array.from(table.rows);
              const currentRow = tableCell.closest('tr') as HTMLTableRowElement;
              const currentRowIndex = rows.indexOf(currentRow);
              const currentCellIndex = Array.from(currentRow.cells).indexOf(tableCell as HTMLTableCellElement);
              
              let targetCell = null;
              
              switch (e.key) {
                case 'ArrowLeft':
                  // Previous cell in same row
                  if (currentCellIndex > 0) {
                    targetCell = currentRow.cells[currentCellIndex - 1];
                  } else if (currentRowIndex > 0) {
                    // Last cell of previous row
                    const prevRow = rows[currentRowIndex - 1];
                    targetCell = prevRow.cells[prevRow.cells.length - 1];
                  }
                  break;
                  
                case 'ArrowRight':
                  // Next cell in same row
                  if (currentCellIndex < currentRow.cells.length - 1) {
                    targetCell = currentRow.cells[currentCellIndex + 1];
                  } else if (currentRowIndex < rows.length - 1) {
                    // First cell of next row
                    targetCell = rows[currentRowIndex + 1].cells[0];
                  }
                  break;
                  
                case 'ArrowUp':
                  // Same column, previous row
                  if (currentRowIndex > 0) {
                    const prevRow = rows[currentRowIndex - 1];
                    if (prevRow.cells[currentCellIndex]) {
                      targetCell = prevRow.cells[currentCellIndex];
                    }
                  }
                  break;
                  
                case 'ArrowDown':
                  // Same column, next row
                  if (currentRowIndex < rows.length - 1) {
                    const nextRow = rows[currentRowIndex + 1];
                    if (nextRow.cells[currentCellIndex]) {
                      targetCell = nextRow.cells[currentCellIndex];
                    }
                  }
                  break;
              }
              
              if (targetCell) {
                // Focus the target cell
                const newRange = document.createRange();
                if (targetCell.firstChild) {
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    // Position at end for left/up navigation
                    const lastChild = targetCell.lastChild;
                    if (lastChild && lastChild.nodeType === Node.TEXT_NODE) {
                      newRange.setStart(lastChild, lastChild.textContent?.length || 0);
                    } else {
                      newRange.setStart(targetCell, targetCell.childNodes.length);
                    }
                  } else {
                    // Position at start for right/down navigation
                    newRange.setStart(targetCell.firstChild, 0);
                  }
                } else {
                  newRange.setStart(targetCell, 0);
                }
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
                
                // Ensure the cell is visible
                targetCell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
              }
            }
          }
        } else {
          // If we're inside a math field but not exiting, don't process the "entering math field" logic
          
          return;
        }
      }
    }
    
    // Handle tab key
    if (e.key === 'Tab') {
      let selection = window.getSelection(); // Use let as it might be updated
      if (!selection || !selection.rangeCount) {
        return;
      }
      
      e.preventDefault();
      
      // Check if we're in a table cell first
      const tabRange = selection.getRangeAt(0);
      let tabNode = tabRange.startContainer;
      let tableCell = null;
      
      // Find if we're in a table cell
      while (tabNode && tabNode !== editorRef.current) {
        if (tabNode.nodeType === Node.ELEMENT_NODE) {
          const element = tabNode as HTMLElement;
          if (element.tagName === 'TD' || element.tagName === 'TH') {
            tableCell = element;
            break;
          }
        }
        tabNode = tabNode.parentNode;
      }
      
      if (tableCell) {
        // Handle table navigation
        const table = tableCell.closest('table');
        if (table) {
          const cells = Array.from(table.querySelectorAll('td, th'));
          const currentIndex = cells.indexOf(tableCell);
          
          let targetCell = null;
          if (e.shiftKey) {
            // Shift+Tab: go to previous cell
            targetCell = cells[currentIndex - 1] || cells[cells.length - 1];
          } else {
            // Tab: go to next cell
            targetCell = cells[currentIndex + 1] || cells[0];
          }
          
          if (targetCell) {
            // Focus the target cell
            const newRange = document.createRange();
            if (targetCell.firstChild) {
              newRange.setStart(targetCell.firstChild, 0);
            } else {
              newRange.setStart(targetCell, 0);
            }
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            
            // Ensure the cell is visible
            targetCell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          }
        }
        return;
      }

      let range = selection.getRangeAt(0); // Use let as it might be updated
      
      // Check if the current selection needs to be wrapped in a paragraph
      // This is for cases like raw text nodes directly in the editor or an empty editor state.
      const container = range.startContainer;
      const parentIsEditor = container.parentNode === editorRef.current;
      const editorIsEmptyOrBr = editorRef.current && (!editorRef.current.firstChild || editorRef.current.firstChild.nodeName === 'BR');
      const isRawTextNodeInEditor = container.nodeType === Node.TEXT_NODE && parentIsEditor;
      const isCursorAtEditorRoot = container === editorRef.current;

      if (isRawTextNodeInEditor || (isCursorAtEditorRoot && editorIsEmptyOrBr) || (parentIsEditor && container.nodeName === 'BR')) {
        document.execCommand('formatBlock', false, 'P');
        // Re-acquire selection and range as formatBlock can change them
        selection = window.getSelection();
        if (!selection || !selection.rangeCount) {
            return;
        }
        range = selection.getRangeAt(0);
      }

      let node = range.startContainer; // Node for traversal might have changed
      let listItem: HTMLElement | null = null;
      let listElement: HTMLElement | null = null;
      let currentBlockElement: HTMLElement | null = null;
      let isNewlyCreatedP = false; // Flag if we just made a P (though formatBlock handles this)

      // 1. Find existing block element or list item
      let tempNode = range.startContainer;
      if (tempNode === editorRef.current) { // Handle if cursor is on editor div itself
          tempNode = tempNode.childNodes[range.startOffset] || tempNode.firstChild;
      }

      while (tempNode && tempNode !== editorRef.current) {
        if (tempNode.nodeType === Node.ELEMENT_NODE) {
          const element = tempNode as HTMLElement;
          if (element.tagName === 'LI') {
            listItem = element;
            listElement = element.closest('ul, ol') as HTMLElement | null;
            currentBlockElement = listItem;
            break;
          } else if (['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(element.tagName)) {
            currentBlockElement = element;
            const parentLi = element.closest('li');
            if (parentLi && listElement?.contains(parentLi)) {
                listItem = parentLi;
                currentBlockElement = parentLi; 
            }
            break;
          }
        }
        if (!tempNode.parentNode) break;
        tempNode = tempNode.parentNode;
      }
      
      // This case should ideally be caught by formatBlock now, but as a fallback:
      if (!currentBlockElement && node?.parentElement?.tagName === 'LI') {
        listItem = node.parentElement as HTMLElement;
        listElement = listItem.parentElement as HTMLElement;
        currentBlockElement = listItem;
      } else if (!currentBlockElement && node?.nodeType === Node.TEXT_NODE && node.parentElement && ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(node.parentElement.tagName)) {
        currentBlockElement = node.parentElement as HTMLElement;
      }
      
      // If after formatBlock and traversal, currentBlockElement is the editor itself, something is wrong or editor is truly empty.
      if (currentBlockElement === editorRef.current) {
          currentBlockElement = null; // Don't indent the editor div itself
      }

      // 3. Determine if the cursor is at the beginning of the block
      let isAtStartOfBlock = false;
      if (currentBlockElement) { // No longer check !== editorRef.current here, handled above
        const testRange = document.createRange();
        testRange.selectNodeContents(currentBlockElement);
        testRange.setEnd(range.startContainer, range.startOffset);
        if (testRange.toString().trim() === '') {
          isAtStartOfBlock = true;
        }
        if (listItem && (listItem.innerHTML === '' || listItem.innerHTML === '<br>' || listItem.innerHTML.includes('list-item-spacer'))) {
          isAtStartOfBlock = true;
        }
      } else if (editorRef.current && range.commonAncestorContainer === editorRef.current && range.startOffset === 0) {
         // This might be if editor is truly empty and formatBlock didn't run or create a P (e.g. no text typed yet)
         // We want to avoid inserting spaces if the intent is to indent a new line.
         // However, formatBlock should have created a P if text was typed.
         // If editor is empty and Tab is hit, it should create a P and indent it.
         isAtStartOfBlock = true; // Allow proceeding to indent logic which might create P if needed or use currentBlockElement.
      }

      // 4. Indentation Logic
      if (listItem && listElement && isAtStartOfBlock) {
        if (e.shiftKey) {
          handleOutdent(listItem, listElement);
        } else {
          handleIndent(listItem, listElement);
        }
        
        // Update content
        if (editorRef.current) {
          onChange(editorRef.current.innerHTML);
        }
      } else if (isAtStartOfBlock && !listItem && currentBlockElement) { // Indent paragraph or other block if at the start
        const currentPadding = parseFloat(currentBlockElement.style.paddingLeft || '0');
        const indentAmount = 40; // Corresponds to 40px, consistent with list indentation logic

        if (e.shiftKey) { // Outdent
          const newPadding = Math.max(0, currentPadding - indentAmount);
          currentBlockElement.style.paddingLeft = newPadding === 0 ? '' : `${newPadding}px`;
          
          // Remove max indent indicator when outdenting
          currentBlockElement.classList.remove('max-indent-reached');
        } else { // Indent
          const maxIndent = getMaxIndentPx();
          const newPadding = Math.min(currentPadding + indentAmount, maxIndent);
          currentBlockElement.style.paddingLeft = `${newPadding}px`;

          // Add/remove visual indicator for maximum indent
          if (newPadding >= maxIndent) {
            currentBlockElement.classList.add('max-indent-reached');
          } else {
            currentBlockElement.classList.remove('max-indent-reached');
          }
        }
        
        // Update content
        if (editorRef.current) {
          onChange(editorRef.current.innerHTML);
        }
      }
      else {
        // Not at the start of a block, or in a list but not at the start of LI: insert spaces
        const tabTextNode = document.createTextNode('\u00a0\u00a0\u00a0\u00a0'); // Four non-breaking spaces
        range.deleteContents();
        range.insertNode(tabTextNode);
        
        // Move cursor after the inserted spaces
        range.setStartAfter(tabTextNode);
        range.setEndAfter(tabTextNode);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Update content
        if (editorRef.current) {
          onChange(editorRef.current.innerHTML);
        }
      }
      return;
    }
    
    // Add special handling for space key in empty list items
    if (e.key === ' ') {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;
      
      const range = selection.getRangeAt(0);
      
      // Check if we're in a list item
      let node = range.startContainer;
      let listItem = null;
      
      while (node && node !== editorRef.current) {
        if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'LI') {
          listItem = node as HTMLElement;
          break;
        }
        node = node.parentNode;
      }
      
      if (listItem) {
        // Check for spacer and determine if this is a truly empty list item
        const spacer = listItem.querySelector('.list-item-spacer');
        
        // Check if the list item already has a space or regular content
        const hasSpace = listItem.innerHTML.includes('&nbsp;');
        const hasVisibleContent = !!listItem.textContent?.replace(/[\u200B\u00A0\s]/g, '').trim();
        
        // Only consider a list item "effectively empty" if it has a spacer, is empty, or has just a BR
        const isEffectivelyEmpty = 
          (spacer !== null && !hasVisibleContent) || 
          listItem.innerHTML === '<br>' || 
          listItem.innerHTML === '' ||
          (listItem.hasAttribute('data-empty-item') && !hasSpace && !hasVisibleContent);
        
        // If the list item is empty and the cursor is not visible, make it visible
        if (isEffectivelyEmpty && !hasSpace) {
          // Clear any existing content
          if (listItem.innerHTML === '<br>') {
            listItem.innerHTML = '';
          }
          
          // Add non-breaking space and position cursor
          const nbspNode = document.createTextNode('\u00A0');
          listItem.appendChild(nbspNode);
          
          // Position cursor after the space
          const newRange = document.createRange();
          newRange.setStart(nbspNode, 1);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
          
          // Mark as fixed to avoid repeating
          listItem.classList.add('space-directly-fixed');
          
          // Prevent default to handle it ourselves
          e.preventDefault();
          
          // Update content
          if (editorRef.current) {
            const event = new Event('input', { bubbles: true });
            editorRef.current.dispatchEvent(event);
          }
          
          return;
        }
        
        // If we've already applied a space fix, don't interfere with normal typing
        const alreadyFixed = listItem.classList.contains('space-directly-fixed') && hasSpace;
        
        // Only apply our fix to truly empty list items
        if (isEffectivelyEmpty && !alreadyFixed) {
          return;
        }
      }
    }
    
    // Handle Backspace and Delete keys
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;
      
      const range = selection.getRangeAt(0);
      
      // First check if we're in a math field
      const mathField = range.startContainer.parentElement?.closest('math-field');
      if (mathField) {
        // If we're at the edge of a math field
        if (range.startOffset === 0 || range.startOffset === (range.startContainer.textContent || '').length) {
          // Remove the entire math field
          mathField.remove();
          e.preventDefault();
          
          // Create a text node with a space to ensure proper cursor placement
          const spaceNode = document.createTextNode('\u200B'); // Zero-width space
          if (mathField.parentNode) {
            mathField.parentNode.insertBefore(spaceNode, mathField.nextSibling);
            
            // Place cursor after the space
            const newRange = document.createRange();
            newRange.setStartAfter(spaceNode);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
          }
          
          // Update content
          if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
          }
        }
        return;
      }
      
      // Prevent Delete/Backspace from removing indentation on paragraphs
      // Check if we're at the beginning/end of an indented paragraph
      const isAtBeginning = range.startOffset === 0;
      const isAtEnd = range.startOffset === (range.startContainer.textContent?.length || 0);
      const hasSelection = !range.collapsed;
      
                      if (!hasSelection && ((e.key === 'Backspace' && isAtBeginning) || (e.key === 'Delete' && isAtEnd))) {
          // Find if we're in an indented paragraph or other block element
          let node = range.startContainer;
          let paragraph = null;
          let isInList = false;
          
          // If we're directly in a text node, get its parent
          if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentNode;
          }
          
          // Check if we're in a list first
          let checkNode = node;
          while (checkNode && checkNode !== editorRef.current) {
            if (checkNode.nodeType === Node.ELEMENT_NODE) {
              const element = checkNode as HTMLElement;
              if (element.tagName === 'LI' || element.tagName === 'UL' || element.tagName === 'OL') {
                isInList = true;
                break;
              }
            }
            checkNode = checkNode.parentNode;
          }
          
          // Only check for paragraph protection if we're NOT in a list
          if (!isInList) {
            // Check if we're in a paragraph or other block element
            while (node && node !== editorRef.current) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as HTMLElement;
                if (['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(element.tagName)) {
                  paragraph = element;
                  break;
                }
              }
              node = node.parentNode;
            }
          }
        
                  // If we found a paragraph with formatting (indentation or alignment), prevent the key from removing it
          // But only if we're not in a list (lists handle their own formatting)
          if (paragraph && paragraph.style && !isInList) {
            const currentPadding = parseInt(paragraph.style.paddingLeft, 10) || 0;
            const currentAlignment = paragraph.style.textAlign || '';
            
            // Check if paragraph has indentation or non-default alignment
            const hasIndentation = currentPadding > 0;
            const hasAlignment = currentAlignment && currentAlignment !== 'left' && currentAlignment !== 'start';
            
            if (hasIndentation || hasAlignment) {
            // Check if this would result in removing formatting by checking adjacent elements
            let wouldRemoveFormatting = false;
            
            if (e.key === 'Backspace' && isAtBeginning) {
              // Check if there's a previous element that would merge and lose formatting
              const prevElement = paragraph.previousElementSibling;
              if (!prevElement || !prevElement.style) {
                wouldRemoveFormatting = true;
              } else {
                const prevPadding = parseInt(prevElement.style.paddingLeft, 10) || 0;
                const prevAlignment = prevElement.style.textAlign || '';
                
                // Check if indentation would be lost
                if (hasIndentation && prevPadding !== currentPadding) {
                  wouldRemoveFormatting = true;
                }
                
                // Check if alignment would be lost
                if (hasAlignment && prevAlignment !== currentAlignment) {
                  wouldRemoveFormatting = true;
                }
              }
            } else if (e.key === 'Delete' && isAtEnd) {
              // Check if there's a next element that would merge and lose formatting
              const nextElement = paragraph.nextElementSibling;
              if (!nextElement || !nextElement.style) {
                wouldRemoveFormatting = true;
              } else {
                const nextPadding = parseInt(nextElement.style.paddingLeft, 10) || 0;
                const nextAlignment = nextElement.style.textAlign || '';
                
                // Check if indentation would be lost
                if (hasIndentation && nextPadding !== currentPadding) {
                  wouldRemoveFormatting = true;
                }
                
                // Check if alignment would be lost
                if (hasAlignment && nextAlignment !== currentAlignment) {
                  wouldRemoveFormatting = true;
                }
              }
            }
            
            if (wouldRemoveFormatting) {
              // Prevent the default behavior that would remove formatting
              e.preventDefault();
              return;
            }
          }
        }
      }
      
      // Check if we're in a list item and at the beginning of it
      let node = range.startContainer;
      let listItem = null;
      let list = null;
      
      // Find the list item containing the cursor
      while (node && node !== editorRef.current) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          if (element.tagName === 'LI') {
            listItem = element;
          } else if (element.tagName === 'UL' || element.tagName === 'OL') {
            list = element;
            break;
          }
        }
        node = node.parentNode;
      }
      
              // If we found a list item and we're at the beginning of it
        if (listItem && list) {
          // Check if we're at the beginning of the list item's content
          let isAtStart = false;
          
          // For text nodes, check if we're at the beginning
          if (range.startContainer.nodeType === Node.TEXT_NODE) {
            isAtStart = range.startOffset === 0;
            
            // If we're at the start of a text node, make sure it's the first text node
            if (isAtStart) {
              const walker = document.createTreeWalker(
                listItem,
                NodeFilter.SHOW_TEXT,
                null
              );
              
              const firstTextNode = walker.nextNode();
              isAtStart = firstTextNode === range.startContainer;
            }
          } 
          // For element nodes, check if we're at the first position
          else if (range.startContainer === listItem) {
            isAtStart = range.startOffset === 0;
          }
          // Special handling for aligned lists with flexbox layout
          else if (range.startContainer === listItem.firstChild && range.startOffset === 0) {
            // When list items have justifyContent (center/right alignment), 
            // the cursor might be positioned differently
            isAtStart = true;
          }
          
          // Check if the list item is empty or contains only a non-breaking space
          const isEmpty = isListItemEmpty(listItem);
          
          // If we're at the start of a list item
          if (isAtStart) {
            // If there's a selection, do not trigger any custom list-handling logic.
            // Let the default backspace behavior (deleting the selection) proceed.
            if (!range.collapsed) {
              return;
            }
            
            // Add special handling for Shift+Backspace to directly remove list formatting
            if (e.shiftKey && list) {
              // Remove the list formatting but keep the content
            
            // Create a document fragment to hold list items content
            const fragment = document.createDocumentFragment();
            
            // Collect all list items
            const items = Array.from(list.querySelectorAll('li')).map(item => item as HTMLLIElement);
            
            // Store original indentation and formatting
            const itemsData = items.map(item => {
              return {
                html: item.innerHTML,
                indentLevel: item.style.getPropertyValue('--indent-level'),
                paddingLeft: item.style.paddingLeft
              };
            });
            
            // Remember alignment of the list
            const listAlignment = (list as HTMLElement).style.textAlign || '';
            
            // Create paragraphs for each list item's content
            items.forEach((item, index) => {
              const p = document.createElement('p');
              p.innerHTML = item.innerHTML;
              
              // Apply indentation to the paragraph
              const data = itemsData[index];
              
              // First try to use --indent-level (preferred method)
              if (data.indentLevel && data.indentLevel.trim() !== '' && data.indentLevel !== '0px' && data.indentLevel !== '0') {
                p.style.paddingLeft = data.indentLevel; // Convert to padding-left
              } 
              // Fallback to direct paddingLeft
              else if (data.paddingLeft && data.paddingLeft.trim() !== '' && data.paddingLeft !== '0px' && data.paddingLeft !== '0') {
                p.style.paddingLeft = data.paddingLeft;
              }
              
              // Apply alignment if the list had it
              if (listAlignment && listAlignment !== 'left' && listAlignment !== 'start') {
                p.style.textAlign = listAlignment;
                // Add the data attribute to ensure it's preserved
                p.setAttribute('data-alignment-fixed', 'true');
              } else {
                // If the list had left alignment (or no explicit alignment), ensure the paragraph reflects this
                p.style.textAlign = 'left';
                p.setAttribute('data-alignment-fixed', 'true');
              }
              
              fragment.appendChild(p);
            });
            
            // Replace list with the fragment
            list.parentNode?.replaceChild(fragment, list);
            
            // Set cursor to the first paragraph - improved positioning
            const firstP = fragment.firstChild as HTMLElement;
            if (firstP) {
              const newRange = document.createRange();
              if (firstP.firstChild && firstP.firstChild.nodeType === Node.TEXT_NODE) {
                newRange.setStart(firstP.firstChild, 0);
              } else if (firstP.firstChild) {
                newRange.setStart(firstP.firstChild, 0);
              } else {
                newRange.setStart(firstP, 0);
              }
              newRange.collapse(true);
              selection.removeAllRanges();
              selection.addRange(newRange);
              
              // Force focus on the editor
              if (editorRef.current) {
                editorRef.current.focus();
              }
            }
            
            // Prevent default backspace behavior
            e.preventDefault();
            
            // Update content
            if (editorRef.current) {
              onChange(editorRef.current.innerHTML);
            }
            return;
          }

          // If this is the first item in the list and it's empty, remove the entire list formatting
          const isFirstItem = listItem === list.querySelector('li:first-child');
          
          if (isFirstItem && isListItemEmpty(listItem)) {
            // If there's only one item in the list, convert to paragraph
            if (list.querySelectorAll('li').length === 1) {
              // Get indentation from the list item
              const indentLevel = listItem.style.getPropertyValue('--indent-level');
              const paddingLeft = listItem.style.paddingLeft;
              
                          // Get alignment from the list
            const listAlignment = (list as HTMLElement).style.textAlign || '';
            
            // Replace the list with a paragraph
            const p = document.createElement('p');
            p.innerHTML = '<br>'; // Empty paragraph needs BR to be visible
              
              // Apply indentation to the paragraph
              if (indentLevel && indentLevel.trim() !== '' && indentLevel !== '0px' && indentLevel !== '0') {
                p.style.paddingLeft = indentLevel; // Convert to padding-left
              } else if (paddingLeft && paddingLeft.trim() !== '' && paddingLeft !== '0px' && paddingLeft !== '0') {
                p.style.paddingLeft = paddingLeft;
              }
              
              // Apply alignment if the list had it
              if (listAlignment && listAlignment !== 'left' && listAlignment !== 'start') {
                p.style.textAlign = listAlignment;
                // Add the data attribute to ensure it's preserved
                p.setAttribute('data-alignment-fixed', 'true');
              } else {
                // If the list had left alignment (or no explicit alignment), ensure the paragraph reflects this
                p.style.textAlign = 'left';
                p.setAttribute('data-alignment-fixed', 'true');
              }
              
              list.parentNode?.replaceChild(p, list);
              

              
              // Set cursor to the paragraph - improved for aligned paragraphs
              const newRange = document.createRange();
              if (p.firstChild && p.firstChild.nodeType === Node.TEXT_NODE) {
                newRange.setStart(p.firstChild, 0);
              } else if (p.firstChild) {
                newRange.setStart(p.firstChild, 0);
              } else {
                newRange.setStart(p, 0);
              }
              newRange.collapse(true);
              selection.removeAllRanges();
              selection.addRange(newRange);
              
              // Force focus on the editor
              if (editorRef.current) {
                editorRef.current.focus();
              }
              
              // Prevent default backspace behavior
              e.preventDefault();
              
              // Update content
              if (editorRef.current) {
                onChange(editorRef.current.innerHTML);
              }
              return;
            }
            // If there are more items, just remove this one
            else {
              listItem.remove();
              
              // Prevent default backspace behavior
              e.preventDefault();
              
              // Update content
              if (editorRef.current) {
                onChange(editorRef.current.innerHTML);
              }
              return;
            }
          }
          // If this is not the first item, merge with the previous item
          else if (!isFirstItem) {
            const prevItem = listItem.previousElementSibling as HTMLElement;
            
            if (prevItem && prevItem.tagName === 'LI') {
              // If current item is empty, just remove it and place cursor at end of previous item
              if (isListItemEmpty(listItem)) {
                // Set cursor to end of previous item
                const walker = document.createTreeWalker(
                  prevItem,
                  NodeFilter.SHOW_TEXT,
                  null
                );
                
                let lastTextNode = null;
                let currentNode;
                
                while (currentNode = walker.nextNode()) {
                  lastTextNode = currentNode;
                }
                
                if (lastTextNode) {
                  const newRange = document.createRange();
                  newRange.setStart(lastTextNode, lastTextNode.textContent?.length || 0);
                  newRange.collapse(true);
                  selection.removeAllRanges();
                  selection.addRange(newRange);
                } else {
                  // If no text node, place at end of element
                  const newRange = document.createRange();
                  newRange.selectNodeContents(prevItem);
                  newRange.collapse(false);
                  selection.removeAllRanges();
                  selection.addRange(newRange);
                }
                
                // Remove the current list item
                listItem.remove();
              }
              // If not empty, merge content with previous item
              else {
                // Append current item's content to previous item
                prevItem.innerHTML += listItem.innerHTML;
                
                // Remove current item
                listItem.remove();
              }
              
              // Prevent default backspace behavior
              e.preventDefault();
              
              // Update content
              if (editorRef.current) {
                onChange(editorRef.current.innerHTML);
              }
              return;
            }
          }
          // Handle regular backspace at start of any list item (not just first/empty)
          else {
            // For any list item at the start, remove the list formatting from this item
            // Convert this list item to a paragraph
            const p = document.createElement('p');
            p.innerHTML = listItem.innerHTML || '<br>';
            
            // Get indentation from the list item
            const indentLevel = listItem.style.getPropertyValue('--indent-level');
            const paddingLeft = listItem.style.paddingLeft;
            
            // Get alignment from the list
            const listAlignment = (list as HTMLElement).style.textAlign || '';
            
            // Apply indentation to the paragraph
            if (indentLevel && indentLevel.trim() !== '' && indentLevel !== '0px' && indentLevel !== '0') {
              p.style.paddingLeft = indentLevel; // Convert to padding-left
            } else if (paddingLeft && paddingLeft.trim() !== '' && paddingLeft !== '0px' && paddingLeft !== '0') {
              p.style.paddingLeft = paddingLeft;
            }
            
            // Apply alignment if the list had it
            if (listAlignment && listAlignment !== 'left' && listAlignment !== 'start') {
              p.style.textAlign = listAlignment;
              // Add the data attribute to ensure it's preserved
              p.setAttribute('data-alignment-fixed', 'true');
            } else {
              // If the list had left alignment (or no explicit alignment), ensure the paragraph reflects this
              p.style.textAlign = 'left';
              p.setAttribute('data-alignment-fixed', 'true');
            }
            
            // If this was the only item in the list, replace the entire list
            if (list.querySelectorAll('li').length === 1) {
              list.parentNode?.replaceChild(p, list);
            } else {
              // Insert the paragraph before the list and remove this item
              list.parentNode?.insertBefore(p, list);
              listItem.remove();
            }
            

            
            // Set cursor to the paragraph - improved cursor positioning
            const newRange = document.createRange();
            if (p.firstChild && p.firstChild.nodeType === Node.TEXT_NODE) {
              newRange.setStart(p.firstChild, 0);
            } else if (p.firstChild) {
              // If first child is an element, place cursor at the beginning
              newRange.setStart(p.firstChild, 0);
            } else {
              // If no children, place cursor inside the paragraph
              newRange.setStart(p, 0);
            }
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            
            // Force focus on the editor to ensure cursor is visible
            if (editorRef.current) {
              editorRef.current.focus();
            }
            
            // Prevent default backspace behavior
            e.preventDefault();
            
            // Update content
            if (editorRef.current) {
              onChange(editorRef.current.innerHTML);
            }
            return;
          }
        }
      }
    }
  };
  
  // --- Place caret at end of line when clicking whitespace to the right ---
  const handleEditorMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!editorRef.current) return;
    // Only respond to left clicks
    if (e.button !== 0) return;

    // Get the click coordinates relative to the viewport
    const { clientX, clientY } = e;
    // Find the element at the click point
    const clickedElem = document.elementFromPoint(clientX, clientY);

    // If the click is on a math-field, let MathLive handle it
    if (clickedElem && (clickedElem as HTMLElement).closest('math-field')) return;

    // Find the nearest block (li, p, div, etc.)
    let blockElem: HTMLElement | null = clickedElem as HTMLElement;
    while (blockElem && blockElem !== editorRef.current) {
      if (['LI', 'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(blockElem.tagName)) {
        break;
      }
      blockElem = blockElem.parentElement;
    }
    if (!blockElem || blockElem === editorRef.current) {
      // If click is on the editor background, place caret at end of last block
      const blocks = Array.from(editorRef.current.querySelectorAll('li, p, div, h1, h2, h3, h4, h5, h6')) as HTMLElement[];
      if (blocks.length > 0) {
        blockElem = blocks[blocks.length - 1];
      } else {
        blockElem = editorRef.current;
      }
    }

    // Get the bounding rect of the block
    const rect = blockElem.getBoundingClientRect();

    // --- Find the bounding rect of the last visible character ---
    let lastRect = rect;
    let lastTextNode: Node | null = null;
    let walker = document.createTreeWalker(blockElem, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
    });
    let node: Node | null;
    while ((node = walker.nextNode())) {
      lastTextNode = node;
    }
    if (lastTextNode) {
      const range = document.createRange();
      range.selectNodeContents(lastTextNode);
      // Collapse to end to get the last character's rect
      range.collapse(false);
      const rects = range.getClientRects();
      if (rects.length > 0) {
        lastRect = rects[rects.length - 1];
      }
    }

    // If click is to the right of the last visible character, move caret to end
    if (clientX > lastRect.right - 2) { // 2px tolerance
      e.preventDefault();
      // Find the deepest last child node
      let node: Node = blockElem;
      while (node.lastChild) node = node.lastChild;
      // If it's a text node, place caret at end
      const range = document.createRange();
      if (node.nodeType === Node.TEXT_NODE) {
        range.setStart(node, node.textContent?.length || 0);
      } else {
        range.setStart(blockElem, blockElem.childNodes.length);
      }
      range.collapse(true);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
      // Focus editor
      editorRef.current.focus();
    }
  };
  
  // Initialize the editor with content
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = content;
    }
  }, []);
  
  // Set up event listeners for content changes
    // Configure MathLive fonts to avoid the font loading error
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).MathfieldElement) {
      // Configure MathLive to not load fonts from the problematic node_modules path
      (window as any).MathfieldElement.fontsDirectory = null;
    }
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    
    const handleInput = () => {
      // Get the current content and pass it back
      onChange(editor.innerHTML);
      
      // Fix empty paragraphs to ensure cursor visibility
      const paragraphs = editor.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6');
      paragraphs.forEach(paragraph => {
        const element = paragraph as HTMLElement;
        // If paragraph is completely empty or only contains whitespace
        // BUT EXCLUDE paragraphs that contain lists (ul, ol), as they are not truly empty
        if (!element.textContent?.trim() && !element.querySelector('br, math-field, img, table, ul, ol')) {
          // Ensure it has a BR tag for cursor visibility
          if (!element.querySelector('br')) {
            element.innerHTML = '<br>';
          }
        }
      });
      
      // Fix empty list items to ensure cursor visibility
      const listItems = editor.querySelectorAll('li');
      listItems.forEach(listItem => {
        const element = listItem as HTMLElement;
        // If list item is completely empty or only contains whitespace/zero-width chars
        const textContent = element.textContent || '';
        const isEmpty = !textContent.trim() || 
                       textContent === '\u00A0' || 
                       textContent === '\u200B' ||
                       element.innerHTML === '<br>' ||
                       element.innerHTML === '';
        
        if (isEmpty && !element.querySelector('math-field, img, table')) {
          // Ensure it has a non-breaking space for cursor visibility
          if (!textContent.includes('\u00A0')) {
            element.innerHTML = '\u00A0'; // Non-breaking space
          }
        }
      });
      
      // Initialize MathLive fields in any newly added inline math
      initializeMathLiveFields();
    };

    editor.addEventListener('input', handleInput);
    
    // Initialize MathLive fields on initial render
    initializeMathLiveFields();
    
    return () => {
      editor.removeEventListener('input', handleInput);
    };
  }, [onChange]);
  

  
  // Add a MutationObserver to preserve alignment when list type changes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    
    // Use a "recently added/removed lists" approach with a small time window
    let recentlyAddedLists: {element: HTMLElement, time: number}[] = [];
    let recentlyRemovedLists: {element: HTMLElement, items: {el: HTMLElement, style: string}[], time: number}[] = [];
    const RECENT_WINDOW_MS = 500; // Look back 500ms for related list operations
    
    // Function to save a list's items and their styles
    const captureListItems = (list: HTMLElement) => {
      const items = list.querySelectorAll('li');
      const itemsData: {el: HTMLElement, style: string}[] = [];
      
      items.forEach(item => {
        const style = item.getAttribute('style') || '';
        itemsData.push({el: item as HTMLElement, style});
      });
      
      return itemsData;
    };
    
    // Function to apply stored styles to a new list, based on item position
    const applyStoredStyles = (newList: HTMLElement) => {
      // Clean up expired entries
      const now = Date.now();
      recentlyRemovedLists = recentlyRemovedLists.filter(entry => now - entry.time < RECENT_WINDOW_MS);
      
      if (recentlyRemovedLists.length === 0) {
        return;
      }
      
      // Sort by recency, most recent first
      recentlyRemovedLists.sort((a, b) => b.time - a.time);
      
      // Try to find a removed list with similar structure
      const newItems = newList.querySelectorAll('li');
      
      // Use the most recently removed list
      const mostRecentRemoved = recentlyRemovedLists[0];
      
      // Apply styles based on position
      newItems.forEach((newItem, index) => {
        if (index < mostRecentRemoved.items.length) {
          const oldItemData = mostRecentRemoved.items[index];
          const oldStyle = oldItemData.style;
          
          // Extract text-align from old style if it exists
          const alignMatch = oldStyle.match(/text-align:\s*(left|center|right|start|end)/i);
          if (alignMatch && alignMatch[1]) {
            const alignment = alignMatch[1];
            
            // Apply alignment to new item
            const currentStyle = newItem.getAttribute('style') || '';
            const newStyle = currentStyle.replace(/text-align:\s*(left|center|right|start|end);?/i, '') +
                           (currentStyle.endsWith(';') || currentStyle === '' ? '' : ';') +
                           `text-align: ${alignment};`;
            
            newItem.setAttribute('style', newStyle);
            
            // For UL items with center/right alignment, also add justify-content
            if ((alignment === 'center' || alignment === 'right') && 
                newList.tagName === 'UL') {
              // Add list-style-position: inside
              (newItem as HTMLElement).style.listStylePosition = 'inside';
              
              // Add justify-content
              if (alignment === 'center') {
                (newItem as HTMLElement).style.justifyContent = 'center';
              } else if (alignment === 'right') {
                (newItem as HTMLElement).style.justifyContent = 'flex-end';
              }
            }
            
            // For OL items with center/right alignment, also add justify-content
            if ((alignment === 'center' || alignment === 'right') && 
                newList.tagName === 'OL') {
              if (alignment === 'center') {
                (newItem as HTMLElement).style.justifyContent = 'center';
              } else if (alignment === 'right') {
                (newItem as HTMLElement).style.justifyContent = 'flex-end';
              }
            }
            
            // Force a reflow
            void newItem.offsetHeight;
          }
        }
      });
    };
    
    // Observer for list changes
    const listObserver = new MutationObserver((mutations) => {
      const now = Date.now();
      
      // First, process all removed lists to capture their styles
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
          mutation.removedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement;
              if (element.tagName === 'UL' || element.tagName === 'OL') {
                
                // Capture all items and their styles
                const itemsData = captureListItems(element);
                
                // Store in recently removed lists
                recentlyRemovedLists.push({
                  element,
                  items: itemsData,
                  time: now
                });
              }
            }
          });
        }
      });
      
      // Then, process all added lists and try to apply styles from recently removed lists
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement;
              if (element.tagName === 'UL' || element.tagName === 'OL') {
                
                // Add to recently added lists
                recentlyAddedLists.push({
                  element,
                  time: now
                });
                
                // Try to apply styles from a recently removed list
                setTimeout(() => {
                  applyStoredStyles(element);
                }, 0);
              }
            }
          });
        }
      });
      
      // Clean up old entries
      recentlyAddedLists = recentlyAddedLists.filter(entry => now - entry.time < RECENT_WINDOW_MS);
    });
    
    // Observe the entire editor for list changes
    listObserver.observe(editor, {
      childList: true,
      subtree: true
    });
    
    return () => {
      listObserver.disconnect();
    };
  }, [editorRef]);
  
  // Function to initialize MathLive fields within math delimiters
  const initializeMathLiveFields = () => {
    if (!editorRef.current) return;
    
    const mathRegex = /\\(\(.*?\\\))/g;
    
    // Find all text nodes that contain a math delimiter
    const walker = document.createTreeWalker(
      editorRef.current,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    const textNodesToReplace: Array<{ node: Text; matches: RegExpMatchArray[] }> = [];
    
    let currentNode: Text | null;
    while ((currentNode = walker.nextNode() as Text)) {
      const matches = Array.from(currentNode.nodeValue?.matchAll(mathRegex) || []);
      if (matches.length > 0) {
        textNodesToReplace.push({ node: currentNode, matches });
      }
    }
    
    // Replace each text node with a mix of text and math-field
    for (const { node, matches } of textNodesToReplace) {
      let html = node.nodeValue || '';
      matches.forEach(match => {
        const [fullMatch, mathContent] = match;
        const mathLatex = mathContent.slice(1, -1); // Remove the outer \( \)
        html = html.replace(
          fullMatch,
          `<math-field class="math-field" data-latex="${mathLatex}"></math-field>`
        );
      });
      
      // Create a temporary div to hold our new nodes
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      // Insert all the new nodes before the text node
      while (tempDiv.firstChild) {
        node.parentNode?.insertBefore(tempDiv.firstChild, node);
      }
      
      // Remove the original text node
      node.parentNode?.removeChild(node);
    }
    
    // Set up event listeners for math-field elements
    document.querySelectorAll('.math-field:not([data-initialized])').forEach(mathField => {
      const latex = mathField.getAttribute('data-latex') || '';
      
      // Set the value of the math-field element
      (mathField as HTMLElement).setAttribute('value', latex);
      (mathField as HTMLElement).setAttribute('virtual-keyboard-mode', 'manual');
      (mathField as HTMLElement).setAttribute('keypress-sound', 'none');
      (mathField as HTMLElement).setAttribute('plonk-sound', 'none');
      
      // Add change event listener
      addMathFieldInputListener(mathField);
      
      // Mark as initialized
      mathField.setAttribute('data-initialized', 'true');
    });
  };
  
  // Function to preserve math fields during DOM operations
  const preserveMathFields = <T extends any>(operation: () => T): T => {
    if (!editorRef.current) return operation();
    
    // Store all math fields and their data before the operation
    const mathFields = Array.from(editorRef.current.querySelectorAll('math-field'));
    const mathFieldsData = mathFields.map(field => ({
      element: field,
      latex: field.getAttribute('data-latex') || '',
      value: (field as any).value || '',
      placeholder: `__MATH_FIELD_${Math.random().toString(36).substr(2, 9)}__`
    }));
    
    // Replace math fields with placeholders
    mathFieldsData.forEach(data => {
      const placeholder = document.createTextNode(data.placeholder);
      data.element.parentNode?.replaceChild(placeholder, data.element);
    });
    
    // Execute the operation
    const result = operation();
    
    // Restore math fields from placeholders
    setTimeout(() => {
      mathFieldsData.forEach(data => {
        const walker = document.createTreeWalker(
          editorRef.current!,
          NodeFilter.SHOW_TEXT,
          null
        );
        
        let textNode: Text | null;
        while ((textNode = walker.nextNode() as Text)) {
          if (textNode.nodeValue?.includes(data.placeholder)) {
            // Replace placeholder with math field
            const mathField = document.createElement('math-field');
            mathField.className = 'math-field';
            mathField.setAttribute('data-latex', data.latex);
            mathField.setAttribute('value', data.value);
            mathField.setAttribute('virtual-keyboard-mode', 'manual');
            mathField.setAttribute('keypress-sound', 'none');
            mathField.setAttribute('plonk-sound', 'none');
            
            // Replace the text node containing the placeholder
            const newText = textNode.nodeValue.replace(data.placeholder, '');
            if (newText) {
              textNode.nodeValue = newText;
              textNode.parentNode?.insertBefore(mathField, textNode);
            } else {
              textNode.parentNode?.replaceChild(mathField, textNode);
            }
            
            // Add event listener
            addMathFieldInputListener(mathField);
            
            break;
          }
        }
      });
    }, 0);
    
    return result;
  };
  
  return (
    <div
      ref={editorRef}
      contentEditable
      className="p-4 min-h-[300px] focus:outline-none overflow-y-auto rich-text-editor"
      style={{ fontSize: '16px', lineHeight: '1.5' }}
      onKeyDown={handleEditorKeyDown}
      onMouseDown={handleEditorMouseDown}
    />
  );
};

// Add styles for tables and lists
const styles = `
/* Reset list styles for consistency */
.rich-text-editor ul,
.rich-text-editor ol {
  padding-left: 0;
  margin-left: 0;
}

/* Base styles for list items */
.rich-text-editor ol li,
.rich-text-editor ul li {
  position: relative;
  list-style-type: none !important;
  list-style-position: outside !important;
  margin-bottom: 0.5em;
  padding-left: var(--indent-level, 0px);
  display: flex;
  align-items: baseline;
  transition: padding-left 0.2s ease;
}

/* Common styles for ::before as a marker */
.rich-text-editor ol li::before,
.rich-text-editor ul li::before {
  flex-shrink: 0;
  white-space: nowrap;
  display: inline-block;
  width: 2em;
  margin-right: 0.5em;
  box-sizing: border-box;
  text-align: right;
  color: var(--marker-color, inherit);
  transition: color 0.2s ease;
}

/* Disable marker transitions when needed for immediate color changes */
.rich-text-editor ol li.disable-marker-transition::before,
.rich-text-editor ul li.disable-marker-transition::before {
  transition: none !important;
}

/* Marker formatting classes for bold, italic, underline */
.rich-text-editor ol li.marker-bold::before,
.rich-text-editor ul li.marker-bold::before {
  font-weight: bold;
}

.rich-text-editor ol li.marker-italic::before,
.rich-text-editor ul li.marker-italic::before {
  font-style: italic;
}

.rich-text-editor ol li.marker-underline::before,
.rich-text-editor ul li.marker-underline::before {
  text-decoration: underline;
}

/* Ensure marker colors take precedence when set */
.rich-text-editor ol li[style*="--marker-color"]::before,
.rich-text-editor ul li[style*="--marker-color"]::before {
  color: var(--marker-color) !important;
}

/* Number styling for ordered lists */
.rich-text-editor ol li::before {
  content: counter(list-item) ". ";
}

/* Bullet styling for unordered lists */
.rich-text-editor ul li::before {
  content: "•";
}

/* List style variations for ordered lists */
.rich-text-editor ol.list-decimal li::before {
  content: counter(list-item) ". ";
}

.rich-text-editor ol.list-alpha li::before {
  content: counter(list-item, lower-alpha) ". ";
}

.rich-text-editor ol.list-roman li::before {
  content: counter(list-item, lower-roman) ". ";
}

/* List style variations for unordered lists */
.rich-text-editor ul.list-disc li::before {
  content: "•";
}

.rich-text-editor ul.list-circle li::before {
  content: "○";
}

.rich-text-editor ul.list-square li::before {
  content: "▪";
}

/* Alignment handling - use flex for alignment */
.rich-text-editor li[style*="text-align: left"],
.rich-text-editor li[style*="text-align:left"],
.rich-text-editor li[style*="text-align: start"],
.rich-text-editor li[style*="text-align:start"] {
  justify-content: flex-start !important;
}
.rich-text-editor li[style*="text-align: center"],
.rich-text-editor li[style*="text-align:center"] {
  justify-content: center !important;
}
.rich-text-editor li[style*="text-align: right"],
.rich-text-editor li[style*="text-align:right"],
.rich-text-editor li[style*="text-align: end"],
.rich-text-editor li[style*="text-align:end"] {
  justify-content: flex-end !important;
}

/* Dark mode support for markers */
.dark .rich-text-editor ol li::before,
.dark .rich-text-editor ul li::before {
  color: var(--marker-color, inherit);
}

/* Keep counter resets */
.rich-text-editor ol {
  counter-reset: list-item;
}

.rich-text-editor ol li {
  counter-increment: list-item;
}

/* Progressive indentation for nested lists - this needs to be re-evaluated with flex model.
   Currently, --indent-level handles all indentation via li's padding-left.
   If nested lists (ul/ol inside an li) need *additional* margin, that's separate.
   For now, relying on --indent-level applied to each li.
*/
.rich-text-editor li > ul,
.rich-text-editor li > ol {
  margin-top: 0.5em; /* Space before a nested list starts */
  /* margin-left: 1.5em; /* This would be *additional* to parent li's own --indent-level.
                           If --indent-level is correctly applied to nested li's, this might not be needed
                           or could be smaller. Let's keep it for now. */
}

/* Tables */
.rich-text-editor .editor-table {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
  border: 1px solid #e2e8f0;
}

.rich-text-editor .editor-table th,
.rich-text-editor .editor-table td {
  border: 1px solid #e2e8f0;
  padding: 0.5em;
  min-width: 2em;
}

.rich-text-editor .editor-table th {
  background-color: #f8fafc;
  font-weight: 600;
}

.rich-text-editor .editor-table tr:nth-child(even) {
  background-color: #f8fafc;
}

/* Dark mode support */
.dark .rich-text-editor .editor-table {
  border-color: #334155;
}

.dark .rich-text-editor .editor-table th,
.dark .rich-text-editor .editor-table td {
  border-color: #334155;
}

.dark .rich-text-editor .editor-table th {
  background-color: #1e293b;
}

.dark .rich-text-editor .editor-table tr:nth-child(even) {
  background-color: #1e293b;
}

/* Math fields - force vertical centering with maximum specificity */
.rich-text-editor math-field {
  /* Smooth style transitions */
  transition: all 0.2s ease-in-out !important;
  /* Use flexbox to center content */
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  /* Align with text baseline, not middle (middle affects surrounding text) */
  vertical-align: baseline !important;
  font-size: 1em !important;
  line-height: 1.2 !important;
  margin: 0 0.1em !important; /* small spacing like normal characters */
  min-height: 1.2em !important;
  /* Force positioning for internal centering */
  position: relative !important;
}

/* Target all possible MathLive internal elements with maximum specificity */
.rich-text-editor math-field *,
.rich-text-editor math-field > *,
.rich-text-editor math-field [class*="mml"],
.rich-text-editor math-field [class*="ML"],
.rich-text-editor math-field [class*="katex"],
.rich-text-editor math-field div,
.rich-text-editor math-field span {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  vertical-align: middle !important;
  line-height: 1.2 !important;
}

/* Add CSS transitions for padding-left on block elements */
.rich-text-editor p,
.rich-text-editor div,
.rich-text-editor h1,
.rich-text-editor h2,
.rich-text-editor h3,
.rich-text-editor h4,
.rich-text-editor h5,
.rich-text-editor h6 {
  transition: padding-left 0.2s ease;
}

.rich-text-editor math-field:empty {
  min-width: 2em;
  display: inline-block;
}

/* Text and background styling */
.rich-text-editor [style*="color:"] {
  transition: color 0.2s ease;
}

.rich-text-editor [style*="background-color:"] {
  /* Remove extra horizontal padding to avoid visual gaps when highlighting partial words */
  padding: 0;
  border-radius: 2px;
  transition: background-color 0.2s ease;
  /* Ensure highlight wraps nicely across line breaks */
  box-decoration-break: clone;
}

/* Selection styles */
.rich-text-editor::selection,
.rich-text-editor *::selection {
  background-color: rgba(59, 130, 246, 0.3);
}

.dark .rich-text-editor::selection,
.dark .rich-text-editor *::selection {
  background-color: rgba(59, 130, 246, 0.5);
}

/* Dark mode text color */
.dark .rich-text-editor {
  color-scheme: dark;
}

/* Spacer for list items */
.rich-text-editor li .list-item-spacer {
  display: inline-block;
  min-width: 0.1em; /* Reduced from 0.4em to minimize visible space */
  white-space: pre;
}

/* Ensure cursor visibility */
.rich-text-editor {
  caret-color: currentColor;
}

.rich-text-editor li {
  min-height: 1.2em; /* Ensure list items have minimum height for cursor visibility */
  caret-color: currentColor;
}

/* Zero-width spaces need explicit cursor styling */
.rich-text-editor *:empty::after {
  content: '';
  display: inline-block;
  width: 1px;
  height: 1em;
  vertical-align: text-bottom;
  background-color: transparent;
}

/* Ensure cursor visibility when editing empty content */
.rich-text-editor *:focus:empty {
  outline: none;
  min-width: 1px;
  display: inline-block;
}

/* Visual feedback for maximum indentation */
.rich-text-editor .max-indent-reached {
  position: relative;
}

.rich-text-editor .max-indent-reached::after {
  content: '';
  position: absolute;
  right: -2px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(to bottom, transparent, #f59e0b, transparent);
  opacity: 0.6;
  pointer-events: none;
}
`;

// Apply the styles
const styleElement = document.createElement('style');
styleElement.textContent = styles;
document.head.appendChild(styleElement);

export default RichTextArea; 