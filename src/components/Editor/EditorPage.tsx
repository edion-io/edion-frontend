import { useState, useRef } from 'react';
import EditorToolbar from './EditorToolbar';
import RichTextArea from './RichTextArea';
import LatexView from './LatexView';
import { buildLatexDocument } from '../../lib/buildLatex';
import useInlineMath from '../../hooks/useInlineMath';

const EditorPage = () => {
  const [content, setContent] = useState<string>('<p>Start typing here. Use the toolbar to format text or add math expressions.</p>');
  const [showRawLatex, setShowRawLatex] = useState(false);
  const [latexDocument, setLatexDocument] = useState<string>(buildLatexDocument(content));
  const { insertMathDelimiters } = useInlineMath();
  const editorRef = useRef<HTMLDivElement>(null);
  
  // State to store the execFormatCommand function from the toolbar
  const [execFormatCommand, setExecFormatCommand] = useState<((command: string, value?: string) => void) | null>(null);

  // Update latex document whenever content changes
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setLatexDocument(buildLatexDocument(newContent));
  };

  // Callback to receive the execFormatCommand function from the toolbar
  const handleFormatCommandReady = (formatCommand: (command: string, value?: string) => void) => {
    setExecFormatCommand(() => formatCommand);
  };

  // Toggle raw LaTeX view
  const toggleRawLatex = () => {
    setShowRawLatex(!showRawLatex);
  };

  // Callback for when a new list is created to fix cursor
  const handleNewListCreated = () => {
    // Use a slightly longer timeout to ensure DOM changes are complete
    setTimeout(() => {
      if (!editorRef.current) return;

      // Handle both ordered and unordered lists
      const lists = editorRef.current.querySelectorAll('ol, ul');
      if (lists.length === 0) {
        return;
      }
      
      const lastList = lists[lists.length - 1];
      const firstItem = lastList.querySelector('li:first-child');

      if (firstItem) {
        // Check if the list item is empty or needs cursor positioning
        const textContent = firstItem.textContent || '';
        const isEmpty = !textContent.trim() || 
                       textContent === '\u00A0' || 
                       textContent === '\u200B' ||
                       firstItem.innerHTML === '<br>' ||
                       firstItem.innerHTML === '';

        // If empty, ensure it has a non-breaking space for cursor visibility
        if (isEmpty) {
          firstItem.innerHTML = '\u00A0'; // Non-breaking space
        }

        // Always position cursor at the beginning of the list item
        const selection = window.getSelection();
        if (selection) {
          editorRef.current.focus();
          
          const range = document.createRange();
          
          // Position cursor at the beginning of the first text node if it exists
          if (firstItem.firstChild && firstItem.firstChild.nodeType === Node.TEXT_NODE) {
            range.setStart(firstItem.firstChild, 0);
          } else if (firstItem.firstChild) {
            range.setStart(firstItem.firstChild, 0);
          } else {
            range.setStart(firstItem, 0);
          }
          
          range.collapse(true);
          
          selection.removeAllRanges();
          selection.addRange(range);
          
          // Ensure the list item is visible
          firstItem.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      }
    }, 50); // Longer delay to ensure all DOM manipulations are complete
  };

  const handleIndent = () => {
    document.execCommand('indent');
  };

  const handleOutdent = () => {
    document.execCommand('outdent');
  };

  // Insert table at cursor position
  const insertTable = (rows: number, cols: number) => {
    if (!editorRef.current) return;
    
    // Ensure editor has focus
    editorRef.current.focus();
    
    // Get current selection
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    
    // Create table HTML
    let tableHTML = '<table class="editor-table" data-rows="' + rows + '" data-cols="' + cols + '">';
    
    // Add table header
    tableHTML += '<thead><tr>';
    for (let i = 0; i < cols; i++) {
      tableHTML += '<th contenteditable="true">Header ' + (i + 1) + '</th>';
    }
    tableHTML += '</tr></thead>';
    
    // Add table body
    tableHTML += '<tbody>';
    for (let i = 0; i < rows - 1; i++) { // Assuming one row is header
      tableHTML += '<tr>';
      for (let j = 0; j < cols; j++) {
        tableHTML += '<td contenteditable="true">Cell</td>'; // Simpler cell content
      }
      tableHTML += '</tr>';
    }
    tableHTML += '</tbody></table><p><br></p>'; // Add a new paragraph after the table for easier editing
    
    // Insert table at current position
    document.execCommand('insertHTML', false, tableHTML);
    
    // Update content
    if (editorRef.current) {
      handleContentChange(editorRef.current.innerHTML);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="container mx-auto py-3 px-4">
          <h1 className="text-xl font-semibold">LaTeX Math Editor</h1>
        </div>
      </header>
      
      <main className="flex-grow flex flex-col container mx-auto p-4 gap-4">
        <EditorToolbar 
          showRawLatex={showRawLatex}
          toggleRawLatex={toggleRawLatex}
          onInsertMath={insertMathDelimiters}
          onInsertTable={insertTable}
          onIndent={handleIndent}
          onOutdent={handleOutdent}
          editorRef={editorRef}
          onNewListCreated={handleNewListCreated}
          onFormatCommandReady={handleFormatCommandReady}
        />
        
        {!showRawLatex ? (
          <div className="flex-grow bg-white dark:bg-zinc-800 rounded-md border shadow-sm">
            <RichTextArea 
              content={content}
              onChange={handleContentChange}
              editorRef={editorRef}
              onFormatCommand={execFormatCommand || undefined}
            />
          </div>
        ) : (
          <LatexView latexDocument={latexDocument} />
        )}
      </main>
    </div>
  );
};

export default EditorPage; 