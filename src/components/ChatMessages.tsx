import React, { useEffect, useRef, useState, memo } from 'react';
import { Download, Pencil, RefreshCw, FileText, BookOpen, ClipboardList, CheckSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { ChatTab } from '../types';
import ChatBubble from './ChatBubble';

interface SuggestionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  delay?: number;
  color?: string;
  darkMode?: boolean;
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({ 
  icon, 
  title, 
  description, 
  onClick, 
  delay = 0, 
  color = 'gray',
  darkMode = false
}) => {
  // Use even more subtle glow colors
  const lightModeGlow = "0 0 1px rgba(100, 100, 100, 0.3), 0 0 15px rgba(100, 100, 100, 0.1)";
  const darkModeGlow = "0 0 1px rgba(120, 120, 120, 0.05), 0 0 15px rgba(120, 120, 120, 0.08)";
  
  // Refined pulsing effect with softer transitions
  const pulseVariants = {
    hover: {
      boxShadow: [
        darkMode ? darkModeGlow : lightModeGlow,
        darkMode 
          ? "0 0 2px rgba(120, 120, 120, 0.1), 0 0 25px rgba(120, 120, 120, 0.12)" 
          : "0 0 2px rgba(80, 80, 80, 0.35), 0 0 25px rgba(80, 80, 80, 0.2)",
        darkMode ? darkModeGlow : lightModeGlow
      ],
      transition: {
        boxShadow: {
          repeat: Infinity,
          repeatType: "reverse" as const,
          duration: 2.5,
          ease: [0.33, 1, 0.68, 1] // custom cubic-bezier for more elegant pulsing
        }
      }
    }
  };
  
  return (
    <motion.button
      onClick={onClick}
      className="w-full p-4 text-left rounded-lg bg-white/80 dark:bg-gray-800/60 border border-gray-200/50 dark:border-gray-700/50 shadow-sm relative overflow-hidden"
      initial={{
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        opacity: 0,
        y: 10
      }}
      animate={{
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        opacity: 1,
        y: 0
      }}
      whileHover="hover"
      variants={pulseVariants}
      whileTap={{ scale: 0.98 }}
      transition={{
        duration: 0.4,
        delay,
        ease: "easeOut"
      }}
    >
      <motion.div
        initial={{ scale: 1 }}
        whileHover={{ scale: 1.02 }} // More subtle scale
        transition={{ 
          duration: 0.5,
          ease: [0.19, 1, 0.22, 1] // More elegant easing
        }}
        className="w-full h-full"
      >
        <div className="flex items-center mb-2">
          <div className="flex-shrink-0 mr-3">
            {icon}
          </div>
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{title}</span>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {description}
        </p>
      </motion.div>
    </motion.button>
  );
};

interface ChatMessagesProps {
  activeTab: ChatTab;
  darkMode: boolean;
  onEditMessage?: (messageId: number, newText: string) => void;
  onEditPDF?: () => void;
  reserveForFixedComposer?: boolean; // when true, add bottom padding based on fixed composer height
}

const ChatMessages: React.FC<ChatMessagesProps> = memo(({ activeTab, darkMode, onEditMessage, onEditPDF, reserveForFixedComposer = true }) => {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isNearBottom) {
      scrollToBottom();
    }
  }, [activeTab.messages, isNearBottom]);

  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const updateNearBottom = () => {
      const threshold = 120; // px
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setIsNearBottom(distanceFromBottom <= threshold);
    };

    const handleScroll = () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(updateNearBottom, 50);
    };

    // Initialize near-bottom state on mount
    updateNearBottom();
    el.addEventListener('scroll', handleScroll);
    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div 
      ref={chatContainerRef}
      className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 bg-gray-100 dark:bg-zinc-950"
      style={reserveForFixedComposer ? { paddingBottom: 'var(--composer-height, 160px)' } : undefined}
    >
      <div className="w-full mx-auto" style={{ maxWidth: 'min(100%, 800px)', width: '100%', padding: '0 4px', boxSizing: 'border-box' }}>
        {activeTab.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-10">
            <div className="mb-6">
              <div className="flex items-center justify-center theme-change-immediate">
                <div className="logo-container theme-change-immediate">
                  <div className="flex items-center theme-change-immediate">
                    <img 
                      src={darkMode ? "/white_on_trans.svg" : "/black_on_trans.svg"}
                      alt="edion logo" 
                      className="h-16 w-auto mr-2 theme-change-immediate" 
                    />
                    <span className="text-4xl font-light tracking-wider theme-change-immediate bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/80">edion</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg mt-6">
              <SuggestionCard
                icon={<FileText className="w-5 h-5 text-purple-500 dark:text-purple-400" />}
                title="Generate a progress report"
                description="Create detailed student performance reports with metrics, achievements, and areas for development"
                onClick={() => onEditMessage(-1, "Generate a student progress report")}
                delay={0.1}
                color="purple"
                darkMode={darkMode}
              />
              <SuggestionCard
                icon={<BookOpen className="w-5 h-5 text-amber-500 dark:text-amber-400" />}
                title="Create a lesson plan"
                description="Design comprehensive lesson plans with learning objectives, activities, and assessment strategies"
                onClick={() => onEditMessage(-1, "Help me create a lesson plan")}
                delay={0.2}
                color="amber"
                darkMode={darkMode}
              />
              <SuggestionCard
                icon={<ClipboardList className="w-5 h-5 text-blue-500 dark:text-blue-400" />}
                title="Generate an assignment"
                description="Develop structured assignments with clear learning objectives, instructions, and evaluation criteria"
                onClick={() => onEditMessage(-1, "Help me create an assignment")}
                delay={0.3}
                color="blue"
                darkMode={darkMode}
              />
              <SuggestionCard
                icon={<CheckSquare className="w-5 h-5 text-green-500 dark:text-green-400" />}
                title="Grade a paper"
                description="Evaluate student work with constructive feedback and targeted improvement recommendations"
                onClick={() => onEditMessage(-1, "Can you help me grade this paper?")}
                delay={0.4}
                color="green"
                darkMode={darkMode}
              />
            </div>
          </div>
        ) : (
          activeTab.messages.map((message) => (
            <div 
              key={`${message.id}-${darkMode}`}
              className="mb-6"
            >
              <ChatBubble 
                message={message} 
                darkMode={darkMode} 
                onEditMessage={message.isUser ? onEditMessage : undefined}
                onEditPDF={onEditPDF}
              />
              {message.pdfUrl && !message.isUser && (
                <div className="ml-10 mt-2 flex flex-wrap gap-2">
                  <button className="flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/70 dark:bg-gray-900 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm backdrop-blur-sm">
                    <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>Download</span>
                  </button>
                  <button 
                    onClick={onEditPDF}
                    className="flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/70 dark:bg-gray-900 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm backdrop-blur-sm"
                  >
                    <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>Edit</span>
                  </button>
                  <button className="flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/70 dark:bg-gray-900 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm backdrop-blur-sm">
                    <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>Regenerate report</span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.darkMode === nextProps.darkMode &&
         prevProps.reserveForFixedComposer === nextProps.reserveForFixedComposer &&
         prevProps.activeTab.id === nextProps.activeTab.id &&
         prevProps.activeTab.messages === nextProps.activeTab.messages;
});

export default ChatMessages; 