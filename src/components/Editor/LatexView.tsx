import { useEffect, useRef, useState, useId, type RefObject } from "react";
import { Button } from "../ui/button";
import { Clipboard, ClipboardCheck } from "lucide-react";

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

/**
 * Controlled view of a LaTeX document.
 * Parent components MUST update `latexDocument` in response to `onChange`.
 */
interface LatexViewProps {
  latexDocument: string;
  onChange?: (latex: string) => void;
  textareaRef?: RefObject<HTMLTextAreaElement>;
}

const LatexView = ({ latexDocument, onChange, textareaRef: externalTextareaRef }: LatexViewProps) => {
  const [copied, setCopied] = useState(false);
  const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalTextareaRef ?? internalTextareaRef;
  // Undo/redo stacks for controlled textarea
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const lastPushedRef = useRef<string | null>(null);
  const applyingUndoRedoRef = useRef<boolean>(false);
  const MAX_HISTORY = 200;
  const labelId = useId();
  
  const copyToClipboard = async () => {
    if (textareaRef.current) {
      try {
        await navigator.clipboard.writeText(textareaRef.current.value);
        setCopied(true);
      } catch (err) {
        console.error('Failed to copy text: ', err);
      }
    }
  };
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange?.(e.target.value);
  };

  // Track value changes to build undo history (captures typing and programmatic edits)
  useEffect(() => {
    if (applyingUndoRedoRef.current) {
      applyingUndoRedoRef.current = false;
      lastPushedRef.current = latexDocument;
      return;
    }
    if (lastPushedRef.current === null) {
      undoStackRef.current = [latexDocument];
      redoStackRef.current = [];
      lastPushedRef.current = latexDocument;
      return;
    }
    if (lastPushedRef.current !== latexDocument) {
      undoStackRef.current.push(latexDocument);
      if (undoStackRef.current.length > MAX_HISTORY) {
        undoStackRef.current.shift();
      }
      redoStackRef.current = [];
      lastPushedRef.current = latexDocument;
    }
  }, [latexDocument]);

  // Reset copied state after a delay; ensures cleanup on change/unmount
  useEffect(() => {
    if (!copied) return;
    const timeoutId = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeoutId);
  }, [copied]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!onChange) return; // Skip shortcuts in read-only mode
    const mod = isMac ? e.metaKey : e.ctrlKey;
    const key = e.key.toLowerCase();
    // Undo
    if (mod && key === 'z' && !e.shiftKey) {
      if (undoStackRef.current.length > 1) {
        e.preventDefault();
        const current = undoStackRef.current.pop() as string;
        redoStackRef.current.push(current);
        const prev = undoStackRef.current[undoStackRef.current.length - 1];
        applyingUndoRedoRef.current = true;
        onChange?.(prev);
      }
      return;
    }
    // Redo: Ctrl+Shift+Z or Ctrl+Y
    if (mod && ((key === 'z' && e.shiftKey) || key === 'y')) {
      if (redoStackRef.current.length > 0) {
        e.preventDefault();
        const next = redoStackRef.current.pop() as string;
        undoStackRef.current.push(next);
        applyingUndoRedoRef.current = true;
        onChange?.(next);
      }
      return;
    }
  };
  
  return (
    <div className="flex flex-col flex-grow gap-2">
      <div className="flex justify-between items-center mb-2">
        <h2 id={labelId} className="text-sm font-medium">Raw LaTeX Document</h2>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={copyToClipboard}
          className="flex items-center gap-1"
        >
          {copied ? (
            <>
              <ClipboardCheck className="h-4 w-4" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Clipboard className="h-4 w-4" />
              <span>Copy</span>
            </>
          )}
        </Button>
      </div>
      
      <textarea
        ref={textareaRef}
        value={latexDocument}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        readOnly={!onChange}
        aria-labelledby={labelId}
        aria-multiline="true"
        aria-readonly={!onChange}
        role="textbox"
        className="flex-grow p-4 bg-secondary font-mono text-sm rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-primary"
        style={{ minHeight: "300px" }}
      />
      
      <p className="text-xs text-muted-foreground mt-2">
        This is the generated LaTeX document. You can copy and paste it into any LaTeX editor.
      </p>
    </div>
  );
};

export default LatexView; 