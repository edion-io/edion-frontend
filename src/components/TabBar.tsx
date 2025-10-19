import React, { useEffect, useRef, useState } from 'react';
import { Plus, X, ChevronRight } from 'lucide-react';
import { ChatTab } from '../types';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';

interface TabBarProps {
  tabs: ChatTab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
  onReorderTabs?: (newOrder: ChatTab[]) => void;
}

const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  onTabClose,
  onNewTab,
  onReorderTabs,
}) => {
  const [visibleTabs, setVisibleTabs] = useState<ChatTab[]>([]);
  const [hiddenTabs, setHiddenTabs] = useState<ChatTab[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const plusButtonRef = useRef<HTMLButtonElement>(null);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [draggedOverTabId, setDraggedOverTabId] = useState<string | null>(null);
  const [draggedHiddenTabId, setDraggedHiddenTabId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [preventTabClick, setPreventTabClick] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(
    typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    setForceUpdate(prev => prev + 1);
  }, [tabs]);

  useEffect(() => {
    if (tabs.length > 0 && !isInitialized) {
      calculateVisibleTabs();
      setIsInitialized(true);
    }
  }, [tabs, isInitialized]);

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDarkMode(document.documentElement.classList.contains('dark'));
        }
      });
    });
    
    observer.observe(document.documentElement, { attributes: true });
    
    return () => observer.disconnect();
  }, []);

  const calculateVisibleTabs = () => {
    if (!containerRef.current || !plusButtonRef.current || tabs.length === 0) return;
    
    const containerWidth = containerRef.current.offsetWidth;
    const plusButtonWidth = plusButtonRef.current.offsetWidth;
    const dropdownWidth = 32; 
    
    const availableWidth = containerWidth - plusButtonWidth - dropdownWidth - 16; 
    
    const maxVisibleTabs = Math.max(1, Math.floor(availableWidth / 120));
    
    setIsTransitioning(true);
    
    if (maxVisibleTabs < tabs.length) {
      setVisibleTabs(tabs.slice(0, maxVisibleTabs));
      setHiddenTabs(tabs.slice(maxVisibleTabs));
    } else {
      setVisibleTabs(tabs);
      setHiddenTabs([]);
    }
    
    setTimeout(() => {
      setIsTransitioning(false);
    }, 300);
  };

  useEffect(() => {
    calculateVisibleTabs();
    
    window.addEventListener('resize', calculateVisibleTabs);
    
    return () => {
      window.removeEventListener('resize', calculateVisibleTabs);
    };
  }, [tabs, forceUpdate]);

  const handleDragStart = (e: React.DragEvent, tabId: string, isHidden: boolean = false) => {
    e.stopPropagation();
    
    e.dataTransfer.setData('text/plain', tabId);
    e.dataTransfer.effectAllowed = 'move';
    
    const ghostElement = document.createElement('div');
    ghostElement.style.width = '1px';
    ghostElement.style.height = '1px';
    document.body.appendChild(ghostElement);
    e.dataTransfer.setDragImage(ghostElement, 0, 0);
    
    if (isHidden) {
      setDraggedHiddenTabId(tabId);
    } else {
      setDraggedTabId(tabId);
    }
    
    setTimeout(() => document.body.removeChild(ghostElement), 0);
  };

  const handleDragOver = (e: React.DragEvent, tabId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDraggedOverTabId(tabId);
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDraggedOverTabId(null);
    
    const draggedId = e.dataTransfer.getData('text/plain') || draggedTabId || draggedHiddenTabId;
    
    if (!draggedId || draggedId === targetTabId) {
      setDraggedTabId(null);
      setDraggedHiddenTabId(null);
      return;
    }
    
    const newTabs = [...tabs];
    
    const draggedIndex = newTabs.findIndex(tab => tab.id === draggedId);
    const targetIndex = newTabs.findIndex(tab => tab.id === targetTabId);
    
    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedTabId(null);
      setDraggedHiddenTabId(null);
      return;
    }
    
    const [movedTab] = newTabs.splice(draggedIndex, 1);
    newTabs.splice(targetIndex, 0, movedTab);
    
    if (onReorderTabs) {
      onReorderTabs(newTabs);
    }
    
    setDraggedTabId(null);
    setDraggedHiddenTabId(null);
  };

  const handleDragEnd = () => {
    setDraggedTabId(null);
    setDraggedHiddenTabId(null);
    setDraggedOverTabId(null);
  };

  const handleTabClick = (tabId: string) => {
    if (preventTabClick || isTransitioning) return;
    onTabChange(tabId);
    setDropdownOpen(false);
  };

  const handleTabClose = (tabId: string, isHiddenTab: boolean = false) => {
    if (isHiddenTab && hiddenTabs.length === 1) {
      setDropdownOpen(false);
    }
    
    onTabClose(tabId);
  };

  const isActiveTabHidden = () => {
    return hiddenTabs.some(tab => tab.id === activeTabId);
  };

  return (
    <div 
      ref={containerRef}
      className="flex items-center w-full relative overflow-hidden px-3"
    >
      <div
        ref={tabsRef}
        className={cn(
          "flex items-center overflow-visible flex-grow",
          isTransitioning && "pointer-events-none"
        )}
      >
        {visibleTabs.map((tab, index) => (
          <div
            key={tab.id}
            className={cn(
              "group relative flex items-center justify-between w-full max-w-[120px] mx-1 cursor-pointer overflow-visible",
              activeTabId === tab.id
                ? "text-gray-900 dark:text-gray-100"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100",
              draggedTabId === tab.id && "opacity-50",
              draggedOverTabId === tab.id && "bg-indigo-100/30 dark:bg-blue-900/30"
            )}
            onClick={() => handleTabClick(tab.id)}
            draggable
            onDragStart={(e) => handleDragStart(e, tab.id)}
            onDragOver={(e) => handleDragOver(e, tab.id)}
            onDrop={(e) => handleDrop(e, tab.id)}
            onDragEnd={handleDragEnd}
          >
            {activeTabId === tab.id && (
              <div className="absolute inset-y-0 left-0 right-0 overflow-visible">
                {/* Main tab background with EXTRA dramatic glow */}
                <div className="absolute inset-0 bg-white dark:bg-gray-800 
                     shadow-[0_0_20px_rgba(0,0,0,0.15)] dark:shadow-[0_0_22px_rgba(59,130,246,0.3)] 
                     rounded-tl-xl rounded-tr-lg border-b-3 border-indigo-500/90 dark:border-blue-400/90
                     transition-all duration-300 ease-out active-tab
                     origin-center"></div>
                
                {/* Left corner with enhanced styling */}
                <div className="absolute bottom-0 left-[-8px] w-[8px] h-[8px] drop-shadow-md" data-testid="left-corner">
                  <svg width="8" height="8" viewBox="0 0 8 8" xmlns="http://www.w3.org/2000/svg">
                    <path 
                      d="M8 0V8H0C4.42 8 8 4.42 8 0Z" 
                      style={{ 
                        fill: isDarkMode ? 'rgb(9, 9, 11)' : 'white',
                        filter: isDarkMode ? 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.2))' : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.06))'
                      }}
                    />
                  </svg>
                </div>
                
                {/* Right corner with enhanced styling */}
                <div className="absolute bottom-0 right-[-8px] w-[8px] h-[8px] drop-shadow-md" data-testid="right-corner">
                  <svg width="8" height="8" viewBox="0 0 8 8" xmlns="http://www.w3.org/2000/svg">
                    <path 
                      d="M0 0V8H8C3.58 8 0 4.42 0 0Z" 
                      style={{ 
                        fill: isDarkMode ? 'rgb(9, 9, 11)' : 'white',
                        filter: isDarkMode ? 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.2))' : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.06))'
                      }}
                    />
                  </svg>
                </div>
              </div>
            )}
            
            <div className="flex-grow overflow-hidden px-2 py-0.5 relative z-10">
              <div className="flex flex-col">
                <span className={cn(
                  "text-xs truncate",
                  activeTabId === tab.id 
                    ? "text-indigo-600 dark:text-blue-400" 
                    : "text-gray-500 dark:text-gray-400"
                )}>
                  {tab.date}
                </span>
                <span className={cn(
                  "text-xs truncate", 
                  activeTabId === tab.id 
                    ? "font-semibold text-gray-900 dark:text-white" 
                    : "font-medium text-gray-600 dark:text-gray-300"
                )}>
                  {tab.title}
                </span>
              </div>
            </div>
            <button
              className={cn(
                "p-0.5 rounded-full relative z-10 mr-1",
                activeTabId === tab.id
                  ? "opacity-0 group-hover:opacity-100 hover:bg-indigo-100/50 dark:hover:bg-blue-500/20"
                  : "opacity-0 group-hover:opacity-100 hover:bg-gray-100/70 dark:hover:bg-gray-700/70"
              )}
              onClick={(e) => {
                e.stopPropagation();
                handleTabClose(tab.id);
              }}
            >
              <X className={cn(
                "w-3 h-3",
                activeTabId === tab.id
                  ? "text-indigo-600 dark:text-blue-400" 
                  : "text-gray-400 dark:text-gray-500"
              )} />
            </button>
            
            {index < visibleTabs.length - 1 && (
              <div className="absolute right-[-4px] top-1/2 h-2/3 w-px bg-gray-200/50 dark:bg-gray-700/30 transform translate-y-[-50%] z-20"></div>
            )}
          </div>
        ))}
      </div>
      
      <div className="flex-none flex items-center">
        <div className={`mr-1 flex items-center ${!hiddenTabs.length && 'invisible'}`}>
          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <button 
                className={cn(
                  "p-1 rounded-lg flex-shrink-0 flex items-center justify-center",
                  isActiveTabHidden() 
                    ? "bg-indigo-100/80 dark:bg-blue-900/30 text-indigo-600/90 dark:text-blue-400/90 hover:bg-indigo-200/80 dark:hover:bg-blue-800/40 shadow-[0_0_5px_rgba(79,70,229,0.1)] dark:shadow-[0_0_5px_rgba(96,165,250,0.1)]" 
                    : dropdownOpen 
                      ? "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300" 
                      : "hover:bg-gray-100/70 dark:hover:bg-gray-800/80 text-gray-700 dark:text-gray-300"
                )}
              >
                <ChevronRight className={cn(
                  "w-3.5 h-3.5",
                  isActiveTabHidden() && "animate-pulse"
                )} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              sideOffset={5}
              className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md p-1 border border-gray-200 dark:border-gray-800 w-[220px] max-h-[300px] overflow-y-auto -mr-3 z-[60]"
            >
              {hiddenTabs.map((tab) => (
                <div
                  key={tab.id}
                  className={cn(
                    "flex items-center justify-between space-x-2 px-3 py-2 rounded-md cursor-pointer",
                    activeTabId === tab.id 
                      ? "bg-gray-100/80 dark:bg-gray-800/80 font-medium border-l-2 border-indigo-500/40 dark:border-blue-400/50 shadow-[0_0_6px_rgba(79,70,229,0.1)_inset] dark:shadow-[0_0_6px_rgba(96,165,250,0.1)_inset]" 
                      : "hover:bg-gray-100/70 dark:hover:bg-gray-800/70",
                    draggedHiddenTabId === tab.id && "opacity-50",
                    draggedOverTabId === tab.id && "bg-indigo-100/30 dark:bg-blue-900/30"
                  )}
                  onClick={() => handleTabClick(tab.id)}
                  draggable
                  onDragStart={(e) => handleDragStart(e, tab.id, true)}
                  onDragOver={(e) => handleDragOver(e, tab.id)}
                  onDrop={(e) => handleDrop(e, tab.id)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-600 dark:text-gray-400">{tab.date}</span>
                    <span className="text-xs truncate max-w-[150px]">{tab.title}</span>
                  </div>
                  <button
                    className="p-1 rounded-full hover:bg-gray-200/70 dark:hover:bg-gray-700/70"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTabClose(tab.id, true);
                    }}
                  >
                    <X className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <button
          ref={plusButtonRef}
          className="p-1 hover:bg-gray-100/70 dark:hover:bg-gray-800/80 rounded-lg flex-shrink-0 text-gray-700 dark:text-gray-300 flex items-center justify-center mr-0"
          onClick={() => {
            setPreventTabClick(true);
            onNewTab();
            setTimeout(() => setPreventTabClick(false), 300);
          }}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default TabBar;
