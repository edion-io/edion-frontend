import type { DragEvent, FormEvent } from 'react';
import DragHandle from './DragHandle';
import ChatMessages from './ChatMessages';
import ChatInput from './ChatInput';

export type PanelSwapDirection = 'left' | 'right' | 'toggle';

export type ChatPaneProps = {
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
  forceUpdate: number;
  activeTab: any;
  darkMode: boolean;
  onEditMessage: (messageId: number, newText: string) => void;
  inputValue: string;
  setInputValue: (v: string) => void;
  onSubmit: (e: FormEvent) => Promise<void>;
};

export default function ChatPane(props: ChatPaneProps) {
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
    forceUpdate,
    activeTab,
    darkMode,
    onEditMessage,
    inputValue,
    setInputValue,
    onSubmit,
  } = props;

  return (
    <div
      className={`h-full min-h-0 flex flex-col transition-all duration-200 ${dragOver ? 'ring-2 ring-indigo-500/60 shadow-lg scale-[1.01]' : ''}`}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Chat</div>
        <DragHandle
          paneType="chat"
          isDragging={isDraggingPane}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onKeySwap={onKeySwap}
        />
      </div>
      <ChatMessages
        key={`messages-${forceUpdate}`}
        activeTab={activeTab}
        darkMode={darkMode}
        onEditMessage={onEditMessage}
        reserveForFixedComposer={false}
      />
      <div className="relative px-3 pb-3">
        <ChatInput
          key={`input-${forceUpdate}`}
          inputValue={inputValue}
          setInputValue={setInputValue}
          onSubmit={onSubmit}
          withinPane
        />
      </div>
    </div>
  );
}


