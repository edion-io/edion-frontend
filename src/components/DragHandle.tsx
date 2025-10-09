import React from 'react';

export type PaneType = 'editor' | 'chat';

type DragHandleProps = {
  paneType: PaneType;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
};

const DragHandle: React.FC<DragHandleProps> = ({ paneType, isDragging, onDragStart, onDragEnd }) => {
  return (
    <button
      className="group relative rounded-full w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all duration-200 hover:scale-110 hover:ring-2 hover:ring-indigo-400/40 hover:ring-offset-2 hover:ring-offset-transparent bg-white/30 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10 backdrop-blur-sm shadow-sm"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/pane', paneType);
        const img = new Image();
        img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
        try {
          e.dataTransfer.setDragImage(img, 0, 0);
        } catch (_err) {
          // Ignore cross-browser issues with setDragImage
        }
        onDragStart();
      }}
      onDragEnd={() => {
        onDragEnd();
      }}
      title="Drag to swap panes"
      aria-label={`Drag ${paneType} pane`}
    >
      <span className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.22),transparent_60%)]" />
      <span className={`relative inline-block w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600 transition-transform transition-colors duration-200 group-hover:bg-indigo-400 dark:group-hover:bg-indigo-300 group-hover:scale-110 ${isDragging ? 'animate-pulse' : ''}`} />
    </button>
  );
};

export default DragHandle;


