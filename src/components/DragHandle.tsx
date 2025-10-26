import React from 'react';

export type PaneType = 'editor' | 'chat';

type DragHandleProps = {
  paneType: PaneType;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onKeySwap?: (direction: 'left' | 'right' | 'toggle') => void;
};

export const DRAG_HANDLE_BUTTON_CLASSES = [
  // layout
  'group relative flex items-center justify-center',
  // sizing
  'rounded-full w-6 h-6',
  // color/foreground
  'text-gray-500 dark:text-gray-400',
  // background
  'bg-white/30 dark:bg-white/5',
  // hover/interaction
  'hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/60 dark:hover:bg-white/10 hover:scale-110 hover:ring-2 hover:ring-indigo-400/40 hover:ring-offset-2 hover:ring-offset-transparent',
  // effects
  'transition-all duration-200 backdrop-blur-sm shadow-sm',
].join(' ');

const DragHandle: React.FC<DragHandleProps> = ({ paneType, isDragging, onDragStart, onDragEnd, onKeySwap }) => {
  const ariaKeyShortcuts = [
    ...(onKeySwap ? ['Enter', 'Space', 'ArrowLeft', 'ArrowRight'] : []),
    ...(onDragEnd ? ['Escape'] : []),
  ].join(' ') || undefined;

  return (
    <button
      className={`${DRAG_HANDLE_BUTTON_CLASSES} cursor-grab active:cursor-grabbing`}
      draggable
      onDragStart={(e) => {
        // Indicate this is a move operation to avoid the browser's green plus badge
        try { e.dataTransfer.effectAllowed = 'move'; } catch (_e) {
          if (import.meta.env.DEV) {
            // Some environments may throw when setting effectAllowed
            console.warn('DragHandle: unable to set effectAllowed to move');
          }
        }
        e.dataTransfer.setData('text/pane', paneType);
        const img = new Image();
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        try {
          e.dataTransfer.setDragImage(img, 0, 0);
        } catch (err) {
          if (import.meta.env.DEV) {
            console.error('DragHandle.setDragImage error', err);
          }
        }
        onDragStart();
      }}
      onDragEnd={() => {
        onDragEnd();
      }}
      title="Drag to swap panes"
      aria-label={`Drag ${paneType} pane`}
      aria-keyshortcuts={ariaKeyShortcuts}
      onKeyDown={(e) => {
        // Enable keyboard swapping: Enter/Space toggles, Arrow keys move toward side, Escape cancels drag state
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (onKeySwap) onKeySwap('toggle');
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (onKeySwap) onKeySwap('left');
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          if (onKeySwap) onKeySwap('right');
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          onDragEnd();
        }
      }}
    >
      <span className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.22),transparent_60%)]" />
      <span className={`relative inline-block w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600 transition-transform transition-colors duration-200 group-hover:bg-indigo-400 dark:group-hover:bg-indigo-300 group-hover:scale-110 ${isDragging ? 'animate-pulse' : ''}`} />
    </button>
  );
};

export default DragHandle;


