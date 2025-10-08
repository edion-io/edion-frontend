import { useRef } from "react";
import { Button } from "../ui/button";
import { Clipboard, ClipboardCheck } from "lucide-react";
import { useState } from "react";

/**
 * Controlled view of a LaTeX document.
 * Parent components MUST update `latexDocument` in response to `onChange`.
 */
interface LatexViewProps {
  latexDocument: string;
  onChange?: (latex: string) => void;
}

const LatexView = ({ latexDocument, onChange }: LatexViewProps) => {
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const copyToClipboard = async () => {
    if (textareaRef.current) {
      try {
        await navigator.clipboard.writeText(textareaRef.current.value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy text: ', err);
      }
    }
  };
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange?.(e.target.value);
  };
  
  return (
    <div className="flex flex-col flex-grow gap-2">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm font-medium">Raw LaTeX Document</h2>
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
        readOnly={!onChange}
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