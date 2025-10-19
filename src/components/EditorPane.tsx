import type { DragEvent } from 'react';
import DragHandle from './DragHandle';
import EditorToolbar from './Editor/EditorToolbar';
import RichTextArea from './Editor/RichTextArea';
import LatexView from './Editor/LatexView';

export type PanelSwapDirection = 'left' | 'right' | 'toggle';

export type EditorPaneProps = {
  dragOver: boolean;
  targetIsLeft: boolean;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  isDraggingPane: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onKeySwap: (dir: PanelSwapDirection) => void;
  showRawLatex: boolean;
  toggleRawLatex: () => void;
  insertMathDelimiters: () => void;
  insertTable: (rows: number, cols: number) => void;
  handleIndent: () => void;
  handleOutdent: () => void;
  editorRef: React.RefObject<HTMLDivElement>;
  editorContent: string;
  setEditorContent: (v: string) => void;
  execFormatCommand: ((command: string) => void) | null;
  setExecFormatCommand: (fn: ((command: string) => void) | null) => void;
  editorLatex: string;
  setEditorLatex: (v: string) => void;
};

export default function EditorPane(props: EditorPaneProps) {
  const {
    dragOver,
    onDragOver,
    onDragEnter,
    onDragLeave,
    onDrop,
    isDraggingPane,
    onDragStart,
    onDragEnd,
    onKeySwap,
    showRawLatex,
    toggleRawLatex,
    insertMathDelimiters,
    insertTable,
    handleIndent,
    handleOutdent,
    editorRef,
    editorContent,
    setEditorContent,
    execFormatCommand,
    setExecFormatCommand,
    editorLatex,
    setEditorLatex,
  } = props;

  return (
    <div
      className={`h-full min-h-0 p-3 flex flex-col transition-all duration-200 ${dragOver ? 'ring-2 ring-indigo-500/60 shadow-lg scale-[1.01]' : ''}`}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Editor</div>
        <DragHandle
          paneType="editor"
          isDragging={isDraggingPane}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onKeySwap={onKeySwap}
        />
      </div>
      <div className="mb-2">
        <EditorToolbar 
          showRawLatex={showRawLatex}
          toggleRawLatex={toggleRawLatex}
          onInsertMath={insertMathDelimiters}
          onInsertTable={insertTable}
          onIndent={handleIndent}
          onOutdent={handleOutdent}
          editorRef={editorRef}
          onNewListCreated={() => {}}
          onFormatCommandReady={fn => setExecFormatCommand(() => fn)}
        />
      </div>
      {
        !showRawLatex ? (
          <div className="flex-1 bg-white dark:bg-zinc-800 rounded-md border shadow-sm">
            <RichTextArea
              content={editorContent}
              onChange={setEditorContent}
              editorRef={editorRef}
              onFormatCommand={execFormatCommand || undefined}
            />
          </div>
        ) : (
          <div className="flex-1 bg-white dark:bg-zinc-800 rounded-md border shadow-sm p-3">
            <LatexView 
              latexDocument={editorLatex || ''}
              onChange={next => setEditorLatex(next)}
            />
          </div>
        )
      }
    </div>
  );
}


