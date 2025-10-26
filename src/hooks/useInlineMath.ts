import { useCallback, useEffect, useRef } from 'react';

/**
 * Hook to handle inline math operations in the WYSIWYG editor
 */
export const useInlineMath = (editorRef?: React.RefObject<HTMLElement>) => {
  // Add state to track empty math fields pending deletion
  const emptyMathFieldRef = useRef<HTMLElement | null>(null);

  // Track per-field undo handlers without mutating DOM nodes
  const undoHandlersRef = useRef<WeakMap<HTMLElement, (e: KeyboardEvent) => void>>(new WeakMap());
  // Track per-field input listeners used to clear pending delete state
  const pendingDeleteInputHandlersRef = useRef<WeakMap<HTMLElement, (e: Event) => void>>(new WeakMap());
  interface MathFieldElement extends HTMLElement { value?: string }

  /**
   * Find a math field element starting from a given node
   */
  const findMathField = (node: Node | null): HTMLElement | null => {
    if (!node) return null;

    // Check if we're inside a math field
    let current = node;
    while (current) {
      if (current instanceof HTMLElement && current.tagName === 'MATH-FIELD') {
        return current;
      }
      current = current.parentNode;
    }

    // Check if we're adjacent to or contain a math field
    const element = node instanceof HTMLElement ? node : node.parentElement;
    if (element) {
      // Check siblings
      const prevSibling = element.previousSibling;
      const nextSibling = element.nextSibling;

      if (prevSibling instanceof HTMLElement && prevSibling.tagName === 'MATH-FIELD') {
        return prevSibling;
      } else if (nextSibling instanceof HTMLElement && nextSibling.tagName === 'MATH-FIELD') {
        return nextSibling;
      }

      // Check children
      const mathFields = element.getElementsByTagName('MATH-FIELD');
      if (mathFields.length > 0) {
        return mathFields[mathFields.length - 1] as HTMLElement;
      }
    }

    // Check if we're in text node after math field
    if (node.nodeType === Node.TEXT_NODE && node.nodeValue === '\u200B') {
      const prevSibling = node.previousSibling;
      if (prevSibling instanceof HTMLElement && prevSibling.tagName === 'MATH-FIELD') {
        return prevSibling;
      }
    }

    return null;
  };

  /**
   * Add a zero-width space after an element
   */
  const addZeroWidthSpace = (element: Node) => {
    const textNode = document.createTextNode('\u200B');
    element.parentNode?.insertBefore(textNode, element.nextSibling);
  };

  /**
   * Focus the editor and position cursor
   */
  const focusEditor = useCallback(() => {
    const editor = editorRef?.current || (document.querySelector('[contenteditable="true"]') as HTMLElement | null);
    if (editor) {
      editor.focus();
    }
  }, [editorRef]);

  /**
   * Remove a math field and clean up spacing to maintain single cursor position
   */
  const removeMathField = useCallback((mathField: HTMLElement) => {
    // Clean up event listener to prevent memory leaks
    const handler = undoHandlersRef.current.get(mathField);
    if (handler) {
      mathField.removeEventListener('keydown', handler);
      undoHandlersRef.current.delete(mathField);
    }

    // Clean up any pending delete input listener for this field
    const inputHandler = pendingDeleteInputHandlersRef.current.get(mathField);
    if (inputHandler) {
      mathField.removeEventListener('input', inputHandler);
      pendingDeleteInputHandlersRef.current.delete(mathField);
    }
    if (emptyMathFieldRef.current === mathField) {
      emptyMathFieldRef.current = null;
    }

    const nextSibling = mathField.nextSibling;
    const prevSibling = mathField.previousSibling;
    
    // Check if we have math fields on both sides
    const hasNextMathField = nextSibling?.nextSibling && 
      (nextSibling.nextSibling as HTMLElement).tagName === 'MATH-FIELD';
    const hasPrevMathField = prevSibling?.previousSibling && 
      (prevSibling.previousSibling as HTMLElement).tagName === 'MATH-FIELD';
    
    // Remove spacing nodes adjacent to this math field
    if (nextSibling?.nodeType === Node.TEXT_NODE && 
        (nextSibling.nodeValue === '\u200B' || nextSibling.nodeValue === ' ')) {
      nextSibling.remove();
    }
    if (prevSibling?.nodeType === Node.TEXT_NODE && 
        (prevSibling.nodeValue === '\u200B' || prevSibling.nodeValue === ' ')) {
      prevSibling.remove();
    }
    
    // If we're removing a math field between two other math fields,
    // ensure there's still a single space between them
    if (hasNextMathField && hasPrevMathField) {
      const singleSpace = document.createTextNode(' ');
      mathField.parentNode?.insertBefore(singleSpace, mathField);
    }
    
    mathField.remove();
    focusEditor();
  }, [focusEditor]);

  /**
   * Initialize a newly created math field and set up cursor position
   */
  const initializeMathField = (parentElement: Element | null) => {
    // Perform DOM queries and synchronous cleanup in a deterministic frame
    requestAnimationFrame(() => {
      // Determine the context to search for the newly inserted math field
      const contextRoot = (parentElement as Element | null) ||
        (editorRef?.current || (document.querySelector('[contenteditable="true"]') as Element | null));

      if (!contextRoot) return;

      const mathFields = contextRoot.querySelectorAll('math-field');
      if (!mathFields || mathFields.length === 0) return;

      const newMathField = mathFields[mathFields.length - 1] as HTMLElement;

      // Ensure the math field is visible in viewport
      if ('scrollIntoView' in newMathField) {
        newMathField.scrollIntoView({ block: 'nearest' });
      }

      // Clean up any redundant spacing around the math field before adding our own
      cleanupRedundantSpacing(newMathField);

      // Add a single zero-width space after the field for cursor positioning
      // Only if there isn't already a space or another math field immediately after
      const nextSibling = newMathField.nextSibling;
      const needsSpace = !nextSibling ||
        (nextSibling.nodeType === Node.ELEMENT_NODE && (nextSibling as HTMLElement).tagName === 'MATH-FIELD');

      if (needsSpace) {
        addZeroWidthSpace(newMathField);
      }

      // Consolidated focus handling in a single follow-up frame after layout
      requestAnimationFrame(() => {
        if (document.activeElement !== newMathField) {
          newMathField.focus();
        }
      });
    });
  };

  /**
   * Clean up redundant spacing around math fields to ensure single cursor position
   */
  const cleanupRedundantSpacing = (mathField: Element) => {
    const prevSibling = mathField.previousSibling;
    const nextSibling = mathField.nextSibling;
    
    // If previous sibling is a math field, consolidate spacing between them
    if (prevSibling && prevSibling.nodeType === Node.ELEMENT_NODE && 
        (prevSibling as HTMLElement).tagName === 'MATH-FIELD') {
      
      // Remove any space nodes between the two math fields
      let nodeToCheck = prevSibling.nextSibling;
      const spacesToRemove: Node[] = [];
      
      while (nodeToCheck && nodeToCheck !== mathField) {
        if (nodeToCheck.nodeType === Node.TEXT_NODE && 
            (nodeToCheck.nodeValue === '\u200B' || nodeToCheck.nodeValue === ' ')) {
          spacesToRemove.push(nodeToCheck);
        }
        nodeToCheck = nodeToCheck.nextSibling;
      }
      
      // Remove all but one spacing element
      if (spacesToRemove.length > 1) {
        for (let i = 1; i < spacesToRemove.length; i++) {
          spacesToRemove[i].parentNode?.removeChild(spacesToRemove[i]);
        }
      }
      
      // Ensure the remaining spacing is a single space for better visibility
      if (spacesToRemove.length > 0) {
        spacesToRemove[0].nodeValue = ' ';
      } else {
        // If no spacing exists between math fields, add a single space
        const singleSpace = document.createTextNode(' ');
        mathField.parentNode?.insertBefore(singleSpace, mathField);
      }
    }
  };

  /**
   * Check if the current selection is inside or near a math field
   */
  const isInsideMathField = (): boolean => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return false;
    return !!findMathField(selection.anchorNode);
  };

  /**
   * Insert math delimiters at the current cursor position
   */
  const insertMathDelimiters = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;

    // Ensure operations target the editor, not the background/chat
    const editorEl = editorRef?.current || (document.querySelector('[contenteditable="true"]') as HTMLElement | null);
    if (editorEl) {
      const currentRange = selection.getRangeAt(0);
      const inEditor = editorEl.contains(currentRange.startContainer);
      if (!inEditor) {
        // Move caret to end of the editor
        const newRange = document.createRange();
        newRange.selectNodeContents(editorEl);
        newRange.collapse(false);
        selection.removeAllRanges();
        selection.addRange(newRange);
        editorEl.focus();
      }
    }

    const range = selection.getRangeAt(0);
    const container = range.startContainer;

    // Check if we are inside an empty list item
    let listItem = null;
    let tempNode: Node | null = container;
    while (tempNode && tempNode !== document.documentElement) {
      if (tempNode.nodeType === Node.ELEMENT_NODE &&
          (tempNode as HTMLElement).tagName === 'LI') {
        listItem = tempNode as HTMLElement;
        break;
      }
      tempNode = tempNode.parentNode;
    }

    const isInsideEmptyListItem =
      listItem &&
      (listItem.textContent || '').replace(/\s/g, '') === '' &&
      !listItem.querySelector('math-field');

    // If in an empty list item, ensure the math field is inserted within it
    if (isInsideEmptyListItem) {
      // Clear the list item's content (e.g., <br> or &nbsp;)
      listItem.innerHTML = '';
      range.setStart(listItem, 0);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else if (
      container.nodeType === Node.ELEMENT_NODE &&
      (container as HTMLElement).getAttribute('contenteditable') === 'true' &&
      (container as HTMLElement).childNodes.length === 0
    ) {
      // If editor is empty, create a paragraph to hold the math field
      const paragraph = document.createElement('p');
      (container as HTMLElement).appendChild(paragraph);
      range.setStart(paragraph, 0);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    // HTML snippet for an empty MathLive field followed by a zero-width space
    const mathFieldHTML =
      '<math-field class="math-field" data-latex="" value="" virtual-keyboard-mode="manual" keypress-sound="none" plonk-sound="none"></math-field>' +
      '\u200B';

    const insertMathFieldAtCursor = () => {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;

      const range = selection.getRangeAt(0);
      let fragment: DocumentFragment;
      let newMathField: HTMLElement | null = null;
      
      try {
        fragment = range.createContextualFragment(mathFieldHTML);
        newMathField = fragment.querySelector('math-field') as HTMLElement;
      } catch (error) {
        console.error('Failed to create math field fragment:', error);
        return;
      }

      range.deleteContents();
      range.insertNode(fragment);

      if (!newMathField) return;

      // After insertion, focus the newly created math field so the caret is inside it
      const editor = (editorRef?.current as HTMLElement | null) || (document.querySelector('[contenteditable="true"]') as HTMLElement | null);

      // Attach an undo handler so Cmd/Ctrl+Z inside the field triggers editor undo
      const handleFieldUndo = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          // Move focus back to the editor then invoke native undo
          if (editor) {
            editor.focus();
            // Future: Integrate UndoManager API when widely supported
            document.execCommand('undo');
          }
        }
      };
      newMathField.addEventListener('keydown', handleFieldUndo);
      undoHandlersRef.current.set(newMathField, handleFieldUndo);

      // Focus the math field to place the caret inside it
      newMathField.focus();
    };

    if (isInsideMathField()) {
      // If currently inside a math field, push cursor after it (with spacing) then insert the new one
      const currentMathField = findMathField(selection.anchorNode);
      if (!currentMathField) return;
            
      // Ensure there is at least a zero-width space after current field
      let spacer = currentMathField.nextSibling;
      if (!spacer || spacer.nodeType !== Node.TEXT_NODE) {
        spacer = document.createTextNode('\u200B');
        currentMathField.parentNode?.insertBefore(spacer, currentMathField.nextSibling);
      }
      // Position cursor just after the spacer
      const newRange = document.createRange();
      newRange.setStartAfter(spacer);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);

      insertMathFieldAtCursor();
    } else {
      // Normal case: just insert at current cursor position
      insertMathFieldAtCursor();
    }
  }, [editorRef]);

  /**
   * Handle deletion of empty math fields
   */
  const handleMathFieldDelete = useCallback((event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    // Only handle events if we're actually in a math field
    if (target.tagName === 'MATH-FIELD') {
      // Handle Enter key to create a new line after the math block
      if (event.key === 'Enter') {
        
        
        event.preventDefault();
        
        // Find the parent paragraph or appropriate container
        const container = target.parentElement;
        
        
        // Create a new paragraph after the math field's container
        const newParagraph = document.createElement('p');
        newParagraph.innerHTML = '&#8203;'; // Zero-width space to ensure paragraph has content
        
        
        // Insert the new paragraph after the container
        if (container) {
          
          if (container.nextSibling) {
            
            container.parentNode?.insertBefore(newParagraph, container.nextSibling);
          } else {
            
            container.parentNode?.appendChild(newParagraph);
          }
          
          // Set cursor to the new paragraph
          const range = document.createRange();
          const selection = window.getSelection();
          
          // Position at the start of the text content
          if (newParagraph.firstChild) {
            
            range.setStart(newParagraph.firstChild, 0);
          } else {
            
            range.setStart(newParagraph, 0);
          }
          range.collapse(true);
          
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
            
            // Ensure the new position is visible
            const clientRect = range.getBoundingClientRect();
            if (clientRect) {
              window.scrollTo({
                top: window.scrollY + clientRect.top - window.innerHeight / 2,
                behavior: 'smooth'
              });
            }
          }
          
          // Focus the editor
          const editor = document.querySelector('[contenteditable="true"]') as HTMLElement;
          if (editor) {
            
            editor.focus();
          }
        }
        return;
      }
      
      // Handle backspace and delete for empty math fields
      if (event.key === 'Backspace' || event.key === 'Delete') {
        const mathField = target as MathFieldElement;
        
        
        // Only proceed if the field is empty
        if (!mathField.value) {
          event.preventDefault();
          
          // If this is the first delete on an empty field
          if (emptyMathFieldRef.current !== mathField) {
            // If another field was pending deletion, remove its listener and clear styles
            const previousPending = emptyMathFieldRef.current;
            if (previousPending && previousPending !== mathField) {
              const prevHandler = pendingDeleteInputHandlersRef.current.get(previousPending);
              if (prevHandler) {
                previousPending.removeEventListener('input', prevHandler);
                pendingDeleteInputHandlersRef.current.delete(previousPending);
              }
              previousPending.style.border = '';
              previousPending.style.backgroundColor = '';
            }

            emptyMathFieldRef.current = mathField;
            
            // Add a visual indicator that the field is pending deletion
            mathField.style.border = '1px solid red';
            mathField.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
            
            // Clear the pending state if the user starts typing
            const clearPendingState: (e: Event) => void = () => {
              if (emptyMathFieldRef.current === mathField) {
                mathField.style.border = '';
                mathField.style.backgroundColor = '';
                emptyMathFieldRef.current = null;
              }
              mathField.removeEventListener('input', clearPendingState);
              pendingDeleteInputHandlersRef.current.delete(mathField);
            };
            mathField.addEventListener('input', clearPendingState);
            pendingDeleteInputHandlersRef.current.set(mathField, clearPendingState);
          } else {
            // This is the second delete, remove the field
            removeMathField(mathField);
            emptyMathFieldRef.current = null;
          }
        } else {
          // Field is not empty, clear any pending deletion state
          if (emptyMathFieldRef.current === mathField) {
            mathField.style.border = '';
            mathField.style.backgroundColor = '';
            const existing = pendingDeleteInputHandlersRef.current.get(mathField);
            if (existing) {
              mathField.removeEventListener('input', existing);
              pendingDeleteInputHandlersRef.current.delete(mathField);
            }
            emptyMathFieldRef.current = null;
          }
        }
      }
    }
  }, [removeMathField]);

  /**
   * Handle keyboard shortcuts and navigation
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'm') {
      event.preventDefault();
      insertMathDelimiters();
      return;
    }
    // Only handle backspace for text nodes outside math fields
    if (event.key === 'Backspace') {
      const target = event.target as HTMLElement;
      // Skip if we're inside a math field - that's handled by handleMathFieldDelete
      if (target.tagName === 'MATH-FIELD') {
        return;
      }

      const selection = window.getSelection();
      if (selection?.rangeCount) {
        const range = selection.getRangeAt(0);
        const container = range.startContainer;
        
        // If we're at the start of a text node or element
        if (range.startOffset === 0) {
          // Find the previous math field by walking the DOM backwards
          let currentNode: Node | null = container;
          let previousNode: Node | null = null;

          // First try to get the previous sibling or its last descendant
          if (currentNode.previousSibling) {
            previousNode = currentNode.previousSibling;
            // If the previous sibling has children, get its last descendant
            while (previousNode && previousNode.lastChild) {
              previousNode = previousNode.lastChild;
            }
          } else {
            // If no previous sibling, walk up the parent chain until we find one
            while (currentNode.parentNode) {
              if (currentNode.parentNode.previousSibling) {
                previousNode = currentNode.parentNode.previousSibling;
                // Get the last descendant of this previous sibling
                while (previousNode && previousNode.lastChild) {
                  previousNode = previousNode.lastChild;
                }
                break;
              }
              currentNode = currentNode.parentNode;
            }
          }

          // Check if we found a math field
          if (previousNode instanceof HTMLElement && previousNode.tagName === 'MATH-FIELD') {
            event.preventDefault();
            removeMathField(previousNode);
            return;
          }

          // Also check parent of previous node in case math field is wrapped
          let prevParent = previousNode?.parentNode;
          while (prevParent && !(prevParent instanceof HTMLElement && prevParent.tagName === 'MATH-FIELD')) {
            prevParent = prevParent.parentNode;
          }
          
          if (prevParent instanceof HTMLElement && prevParent.tagName === 'MATH-FIELD') {
            event.preventDefault();
            removeMathField(prevParent);
            return;
          }
        }
      }
    }
  }, [insertMathDelimiters, removeMathField]);

  // Add event listener for handling math field deletion
  useEffect(() => {
    document.addEventListener('keydown', handleMathFieldDelete);
    return () => document.removeEventListener('keydown', handleMathFieldDelete);
  }, [handleMathFieldDelete]);

  // Ensure any pending delete listener on the active field is removed on unmount
  useEffect(() => {
    return () => {
      const field = emptyMathFieldRef.current as HTMLElement | null;
      if (field) {
        const handler = pendingDeleteInputHandlersRef.current.get(field);
        if (handler) {
          field.removeEventListener('input', handler);
          pendingDeleteInputHandlersRef.current.delete(field);
        }
      }
    };
  }, []);
  
  return {
    insertMathDelimiters,
    handleKeyDown,
    handleMathFieldDelete
  };
};

export default useInlineMath; 