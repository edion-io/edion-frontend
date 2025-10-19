import { useState, useRef } from 'react';
import { INDENT_STEP_PX, applyIndentDelta, getBlocksForRange } from './indentUtils';
import EditorToolbar from './EditorToolbar';
import RichTextArea from './RichTextArea';
import LatexView from './LatexView';
import { buildLatexDocument } from '../../lib/buildLatex';
import { parseLatexToHtml } from '../../lib/parseLatex';
import useInlineMath from '../../hooks/useInlineMath';

const EditorPage = () => {
  const [content, setContent] = useState<string>('<p>Start typing here. Use the toolbar to format text or add math expressions.</p>');
  const [showRawLatex, setShowRawLatex] = useState(false);
  const [latexDocument, setLatexDocument] = useState<string>(buildLatexDocument(content));
  const { insertMathDelimiters } = useInlineMath();
  const editorRef = useRef<HTMLDivElement>(null);
  const latexTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  
  // Ref to store the execFormatCommand function from the toolbar
  const execFormatCommandRef = useRef<((command: string, value?: string) => void) | null>(null);

  // Update latex document whenever content changes
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setLatexDocument(buildLatexDocument(newContent));
  };

  // Callback to receive the execFormatCommand function from the toolbar
  const handleFormatCommandReady = (formatCommand: (command: string, value?: string) => void) => {
    execFormatCommandRef.current = formatCommand;
  };

  // Toggle raw LaTeX view
  const toggleRawLatex = () => {
    setShowRawLatex(!showRawLatex);
  };

  // When LaTeX view is edited, parse back to HTML and update the editor content
  const handleLatexChange = (updatedLatex: string) => {
    try {
      const newHtml = parseLatexToHtml(updatedLatex);
      setContent(newHtml);
      setLatexDocument(updatedLatex);
      // Push to the live editor DOM if mounted
      if (editorRef.current) {
        editorRef.current.innerHTML = newHtml;
        const event = new Event('input', { bubbles: true });
        editorRef.current.dispatchEvent(event);
      }
    } catch (_e) {
      // If parsing fails, keep LaTeX text without breaking the UI
      console.error('Failed to parse LaTeX:', _e);
      setLatexDocument(updatedLatex);
    }
  };

  // Callback for when a new list is created to fix cursor
  const handleNewListCreated = () => {
    // Use RAF to ensure DOM changes are complete
    requestAnimationFrame(() => {
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
    });
  };

  const handleIndent = () => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) return;
    const saved = range.cloneRange();
    const blocks = getBlocksForRange(range, editorRef.current);
    if (blocks.length === 0) return;
    applyIndentDelta(blocks, INDENT_STEP_PX);
    selection.removeAllRanges();
    selection.addRange(saved);
    // Trigger change and make undoable via input event
    const event = new Event('input', { bubbles: true });
    editorRef.current.dispatchEvent(event);
  };

  const handleOutdent = () => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) return;
    const saved = range.cloneRange();
    const blocks = getBlocksForRange(range, editorRef.current);
    if (blocks.length === 0) return;
    applyIndentDelta(blocks, -INDENT_STEP_PX);
    selection.removeAllRanges();
    selection.addRange(saved);
    const event = new Event('input', { bubbles: true });
    editorRef.current.dispatchEvent(event);
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
          onApplyLatexFormat={(cmd, fmtValue) => {
            // Apply LaTeX formatting to selection in LatexView's textarea
            const el = latexTextareaRef.current;
            if (!el) return;
            const start = el.selectionStart;
            const end = el.selectionEnd;
            if (start == null || end == null) return;
            const latexText = el.value;
            const selected = start === end ? '' : latexText.slice(start, end);
            let wrapped = selected;
            switch (cmd) {
              case 'bold':
                wrapped = `\\textbf{${selected || ''}}`;
                break;
              case 'italic':
                wrapped = `\\textit{${selected || ''}}`;
                break;
              case 'underline':
                wrapped = `\\underline{${selected || ''}}`;
                break;
              case 'justifyLeft': {
                // remove existing center/flushright around selection, no wrapper needed
                wrapped = selected.replace(/\\begin\{center\}|\\end\{center\}|\\begin\{flushright\}|\\end\{flushright\}/g, '');
                break;
              }
              case 'justifyCenter':
                wrapped = `\\begin{center}${selected}\\end{center}`;
                break;
              case 'justifyRight':
                wrapped = `\\begin{flushright}${selected}\\end{flushright}`;
                break;
              case 'indent':
                wrapped = `\\hspace*{2em}${selected}`;
                break;
              case 'outdent':
                wrapped = selected.replace(/^\\hspace\*\{[0-9.]+em\}/, '');
                break;
              case 'insertUnorderedList':
                wrapped = `\\begin{itemize}[leftmargin=*]\n\\item ${selected || ''}\n\\end{itemize}`;
                break;
              case 'insertOrderedList':
                wrapped = `\\begin{enumerate}[leftmargin=*]\n\\item ${selected || ''}\n\\end{enumerate}`;
                break;
              case 'foreColor':
                if (fmtValue) {
                  wrapped = `\\textcolor{${fmtValue}}{${selected || ''}}`;
                }
                break;
              case 'hiliteColor':
                if (fmtValue) {
                  const hex = (fmtValue as string).replace('#','');
                  wrapped = `\\definecolor{highlightcolor}{HTML}{${hex}}\n\\sethlcolor{highlightcolor}\n\\hl{${selected || ''}}`;
                }
                break;
              default:
                return;
            }
            const next = latexText.slice(0, start) + wrapped + latexText.slice(end);
            setLatexDocument(next);
            // Update WYSIWYG by parsing
            const newHtml = parseLatexToHtml(next);
            setContent(newHtml);
            if (editorRef.current) {
              editorRef.current.innerHTML = newHtml;
              const event = new Event('input', { bubbles: true });
              editorRef.current.dispatchEvent(event);
            }
            // restore selection to end of wrapped
            const pos = start + wrapped.length;
            requestAnimationFrame(() => {
              const el2 = latexTextareaRef.current;
              if (!el2) return;
              el2.focus();
              el2.setSelectionRange(pos, pos);
            });
          }}
        />
        
        {!showRawLatex ? (
          <div className="flex-grow bg-white dark:bg-zinc-800 rounded-md border shadow-sm">
            <RichTextArea 
              content={content}
              onChange={handleContentChange}
              editorRef={editorRef}
              onFormatCommand={(cmd, fmtValue) => execFormatCommandRef.current?.(cmd, fmtValue)}
            />
          </div>
        ) : (
          <LatexView latexDocument={latexDocument} onChange={handleLatexChange} textareaRef={latexTextareaRef} />
        )}
      </main>
    </div>
  );
};

export default EditorPage; 