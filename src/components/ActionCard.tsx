import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from "@/lib/utils";

interface ActionCardProps {
  icon: string | React.ReactNode;
  title: string;
  description: string;
  color?: string;
  delay?: number;
  onClick?: () => void;
  ariaLabel?: string;
  ariaPressed?: boolean;
  ariaExpanded?: boolean;
}

const ActionCard: React.FC<ActionCardProps> = ({ icon, title, description, color = 'gray', delay = 0, onClick, ariaLabel, ariaPressed, ariaExpanded }) => {
  const [isHovered, setIsHovered] = useState(false);
  const isInteractive = typeof onClick === 'function';

  return (
    <div 
      className="relative isolate"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.div 
        className={cn(
          "flex items-start py-3 px-4 rounded-xl shadow-sm backdrop-blur-sm w-full max-w-md",
          isInteractive && "cursor-pointer",
          "border border-gray-200/30 dark:border-gray-800/50",
          "bg-white/80 hover:bg-white dark:bg-gray-900/50 dark:hover:bg-gray-900/80",
          "transition-all duration-300 ease-in-out"
        )}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: delay, ease: "easeOut" }}
        whileHover={{ 
          scale: 1.02,
          transition: { duration: 0.3, ease: "easeOut" }
        }}
        whileTap={isInteractive ? { scale: 0.98 } : undefined}
        role={isInteractive ? "button" : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        aria-label={ariaLabel}
        aria-pressed={ariaPressed}
        aria-expanded={ariaExpanded}
        onClick={isInteractive ? () => onClick?.() : undefined}
        onKeyDown={isInteractive ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
          }
        } : undefined}
      >
        <div className="flex-shrink-0 mr-4 pt-1">
          {typeof icon === 'string' ? (
            <span className="text-xl">{icon}</span>
          ) : (
            icon
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</span>
          <AnimatePresence mode="wait">
            {isHovered && (
              <motion.span 
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 4 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ 
                  duration: 0.3,
                  ease: "easeInOut",
                  opacity: { duration: 0.2 },
                  height: { duration: 0.3 }
                }}
                className="text-sm text-gray-500 dark:text-gray-400 overflow-hidden"
              >
                {description}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default ActionCard;