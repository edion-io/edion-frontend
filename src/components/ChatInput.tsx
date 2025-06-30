import React, { useEffect, useRef, useState } from 'react';
import { Send, Mic, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from "@/lib/utils";
import FileUploadMenu from './FileUploadMenu';
import { Howl, Howler } from 'howler';//Import the howler library for sound effects.

// Add our fun keyframes for the spin animation
const spinKeyframes = `
@keyframes spin-once {
  from {
    transform: rotate(-10deg);
  }
  to {
    transform: rotate(10deg);
  }
}

.hover-spin:hover {
  animation: spin-once 0.3s ease-in-out alternate infinite;
}
`;

// Add the style tag with our keyframes
const styleTag = document.createElement('style');
styleTag.textContent = spinKeyframes;
document.head.appendChild(styleTag);

interface ChatInputProps {
  inputValue: string;
  setInputValue: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const ChatInput: React.FC<ChatInputProps> = React.memo(({ inputValue, setInputValue, onSubmit }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showExpandButton, setShowExpandButton] = useState(false);

// We declare a sound we want to use with howler on our script, using the saved setting of sound volume
  let soundVolume = 0.5; // Default value
  const savedUserSettings = localStorage.getItem('userSettings');
  if (savedUserSettings) {
    soundVolume = JSON.parse(savedUserSettings).soundVolume;
  }

const sound = new Howl({// We declare a sound we want to use with howler on our script
  src: ['/sounds/send_sound.mp3'],
  volume: soundVolume, // Cambiar mas adelante por una variable para establecer el sonido desde configuracion
  loop: false
  });

  const INITIAL_HEIGHT = 120;
  const EXPANDED_HEIGHT = Math.round(window.innerHeight * 0.6);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
    if (textareaRef.current && formRef.current) {
      const newHeight = !isExpanded ? EXPANDED_HEIGHT : INITIAL_HEIGHT;
      textareaRef.current.style.height = `${newHeight}px`;
      formRef.current.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const checkOverflow = () => {
      // Reset to initial height to check content height
      textarea.style.height = `${INITIAL_HEIGHT}px`;
      const shouldShowExpand = textarea.scrollHeight > INITIAL_HEIGHT;
      
      // If content is small enough and we're expanded, auto-contract
      if (!shouldShowExpand && isExpanded) {
        setIsExpanded(false);
        const newHeight = INITIAL_HEIGHT;
        textarea.style.height = `${newHeight}px`;
        if (formRef.current) {
          formRef.current.style.height = `${newHeight}px`;
        }
      } else {
        // Otherwise set to appropriate height
        const newHeight = isExpanded ? EXPANDED_HEIGHT : INITIAL_HEIGHT;
        textarea.style.height = `${newHeight}px`;
        if (formRef.current) {
          formRef.current.style.height = `${newHeight}px`;
        }
      }
      
      setShowExpandButton(shouldShowExpand);
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [inputValue, isExpanded]);

  return (
    <div className="absolute bottom-6 left-0 right-0 px-3 sm:px-6">
      {showExpandButton && (
        <button
          onClick={toggleExpand}
          className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10 p-1 rounded-full bg-white/80 dark:bg-gray-900/80 border border-gray-200/80 dark:border-gray-800/50 shadow-sm hover:bg-white dark:hover:bg-gray-800 transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          ) : (
            <ChevronUp className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          )}
        </button>
      )}
      <div className="w-full mx-auto relative z-50" style={{ maxWidth: 'min(100%, 800px)', width: '100%', padding: '0 4px', boxSizing: 'border-box' }}>
        <div className="bg-white/80 dark:bg-gray-900/80 border border-gray-200/80 dark:border-gray-800/50 backdrop-blur-md rounded-xl shadow-lg py-2">
          <form ref={formRef} onSubmit={onSubmit} className="relative overflow-hidden">
            <div className="flex">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask anything"
                  className={cn(
                    "w-full bg-transparent rounded-xl",
                    "focus:outline-none text-sm",
                    "text-gray-700 dark:text-gray-200",
                    "placeholder:text-gray-400 dark:placeholder-gray-400",
                    "resize-none",
                    "scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600",
                    "scrollbar-track-transparent hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500",
                    "pr-[68px]"
                  )}
                  style={{
                    lineHeight: '20px',
                    padding: '12px 12px 12px 16px',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    whiteSpace: 'pre-wrap',
                    overflowY: 'auto',
                    height: `${isExpanded ? EXPANDED_HEIGHT : INITIAL_HEIGHT}px`,
                    width: 'calc(100% - 52px)'
                  }}
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                       sound.play(); //Play sound when pressing "enter" button
                      e.preventDefault();
                      onSubmit(e);
                    }
                  }}
                />
              </div>
              <div className="flex flex-col bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-l border-gray-200/80 dark:border-gray-800/50 p-3 z-10" style={{ 
                minWidth: '52px',
                height: `${INITIAL_HEIGHT}px`,
                position: 'absolute',
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <button
                  type="button"
                  className="p-1.5 sm:p-2 hover:bg-gray-100/70 dark:hover:bg-gray-800/70 rounded-lg text-gray-500 dark:text-gray-400 backdrop-blur-sm flex items-center justify-center"
                >
                  <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                
                <FileUploadMenu />
                
                <button
                  type="submit"
                  className={cn(
                    "p-1.5 sm:p-2 rounded-lg flex items-center justify-center",
                    inputValue.trim()
                      ? "bg-indigo-100/80 dark:bg-blue-900/30 text-indigo-600/90 dark:text-blue-400/90 hover:bg-indigo-200/80 dark:hover:bg-blue-800/40 shadow-[0_0_5px_rgba(79,70,229,0.1)] dark:shadow-[0_0_5px_rgba(96,165,250,0.1)]"
                      : "hover:bg-gray-100/70 dark:hover:bg-gray-800/70 text-gray-500 dark:text-gray-400 backdrop-blur-sm"
                  )}
                  disabled={!inputValue.trim()}
                >
                  <Send className={cn(
                    "w-4 h-4 sm:w-5 sm:h-5",
                    inputValue.trim() && "hover-spin"
                  )} />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
});

ChatInput.displayName = 'ChatInput';

export default ChatInput; 

//Line 5 import Howler.
//Line 40-45 we declare the send sound.
//Line 139 sound.play();