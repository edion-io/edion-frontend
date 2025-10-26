import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import ChatHistoryMenu from './ChatHistory';
import UserMenu from './UserMenu';
import { UserSettings as UserSettingsType, ChatHistoryItem, ChatTab } from '../types';
import { getUserSettingsFromStorage, getChatHistoryFromStorage } from '../utils/storageUtils';
import { showChatDeletedToast } from '../utils/toastUtils';

interface HeaderProps {
  userSettings?: UserSettingsType;
  setUserSettings?: React.Dispatch<React.SetStateAction<UserSettingsType>>;
}

const Header: React.FC<HeaderProps> = ({ userSettings: propUserSettings, setUserSettings: propSetUserSettings }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showHistory, setShowHistory] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>(getChatHistoryFromStorage());
  const [localUserSettings, setLocalUserSettings] = useState<UserSettingsType>(getUserSettingsFromStorage());
  const [chatTabs, setChatTabs] = useState<ChatTab[]>(() => {
    try {
      const saved = localStorage.getItem('chatTabs');
      return saved ? JSON.parse(saved) : [];
    } catch (_e) {
      return [];
    }
  });
  
  // Use props if provided, otherwise use local state
  const userSettings = propUserSettings || localUserSettings;
  const setUserSettings = propSetUserSettings || setLocalUserSettings;

  // Settings page still needs UserMenu for theme toggle, but not the full header
  const isSettingsPage = location.pathname === '/settings';

  useEffect(() => {
    const handleStorageChange = () => {
      const newSettings = getUserSettingsFromStorage();
      setChatHistory(getChatHistoryFromStorage());
      try {
        const savedTabs = localStorage.getItem('chatTabs');
        setChatTabs(savedTabs ? JSON.parse(savedTabs) : []);
      } catch (_e) {
        setChatTabs([]);
      }
      
      // Only update local state if props are not provided
      if (!propUserSettings) {
        setLocalUserSettings(newSettings);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    setChatHistory(getChatHistoryFromStorage());
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [location.pathname, propUserSettings]);

  const handleHistoryAction = (chatId: string) => {
    if (chatId !== '') {
      navigate('/chat', { state: { selectedChatId: chatId } });
    }
  };

  const handleDeleteChat = (chatId: string) => {
    // Store the deleted items for undo functionality
    const deletedHistoryIndex = chatHistory.findIndex(chat => chat.id === chatId);
    const deletedHistoryItem = deletedHistoryIndex >= 0 ? chatHistory[deletedHistoryIndex] : undefined;
    const deletedTabIndex = chatTabs.findIndex(tab => tab.id === chatId);
    const deletedTab = deletedTabIndex >= 0 ? chatTabs[deletedTabIndex] : undefined;

    // Update chat history
    const updatedHistory = chatHistory.filter(chat => chat.id !== chatId);
    setChatHistory(updatedHistory);
    try {
      localStorage.setItem('chatHistory', JSON.stringify(updatedHistory));
    } catch (_e) {
      if (import.meta.env.DEV) console.warn('Header: failed to persist chatHistory');
    }
    
    // Update tabs
    if (deletedTab) {
      const updatedTabs = chatTabs.filter((tab) => tab.id !== chatId);
      setChatTabs(updatedTabs);
      try {
        localStorage.setItem('chatTabs', JSON.stringify(updatedTabs));
      } catch (_e) {
        if (import.meta.env.DEV) console.warn('Header: failed to persist chatTabs');
      }
    }

    // Create undo function for chat deletion
    const undoDelete = () => {
      // Helper to parse dd/mm/yyyy to timestamp for fallback ordering
      const parseDateToTs = (dateStr: string | undefined): number => {
        if (!dateStr) return Date.now();
        // Expecting en-GB format: dd/mm/yyyy
        const parts = dateStr.split('/').map((p) => parseInt(p, 10));
        if (parts.length === 3 && !parts.some((n) => Number.isNaN(n))) {
          const [dd, mm, yyyy] = parts;
          const d = new Date(yyyy, mm - 1, dd);
          const t = d.getTime();
          return Number.isNaN(t) ? Date.now() : t;
        }
        const t = Date.parse(dateStr);
        return Number.isNaN(t) ? Date.now() : t;
      };

      // Restore history item if not already present
      if (deletedHistoryItem) {
        const historyItemToRestore: ChatHistoryItem = {
          ...deletedHistoryItem,
          date: deletedHistoryItem.date && deletedHistoryItem.date.trim() !== ''
            ? deletedHistoryItem.date
            : new Date().toLocaleDateString('en-GB'),
        };
        setChatHistory((prevHistory) => {
          if (prevHistory.some((h) => h.id === historyItemToRestore.id)) {
            return prevHistory; // avoid duplicates
          }

          const nextHistory = [...prevHistory];
          const insertIndex = deletedHistoryIndex >= 0 && deletedHistoryIndex <= nextHistory.length
            ? deletedHistoryIndex
            : -1;

          if (insertIndex >= 0) {
            nextHistory.splice(insertIndex, 0, historyItemToRestore);
          } else {
            // Fallback: insert then sort by parsed timestamp descending (newest first)
            nextHistory.push(historyItemToRestore);
            nextHistory.sort((a, b) => parseDateToTs(b.date) - parseDateToTs(a.date));
          }

          try {
            localStorage.setItem('chatHistory', JSON.stringify(nextHistory));
          } catch (_e) {
            if (import.meta.env.DEV) console.warn('Header: failed to persist chatHistory (undo)');
          }
          return nextHistory;
        });
      }

      // Restore tab if it existed and not already present
      if (deletedTab) {
        const tabToRestore: ChatTab = {
          ...deletedTab,
          date: deletedTab.date && deletedTab.date.trim() !== ''
            ? deletedTab.date
            : new Date().toLocaleDateString('en-GB'),
        };
        setChatTabs((prevTabs) => {
          if (prevTabs.some((t) => t.id === tabToRestore.id)) {
            return prevTabs; // avoid duplicates
          }

          const nextTabs = [...prevTabs];
          const insertIndex = deletedTabIndex >= 0 && deletedTabIndex <= nextTabs.length
            ? deletedTabIndex
            : -1;

          if (insertIndex >= 0) {
            nextTabs.splice(insertIndex, 0, tabToRestore);
          } else {
            nextTabs.push(tabToRestore);
            // Fallback: sort by date desc if available
            nextTabs.sort((a, b) => parseDateToTs(b.date) - parseDateToTs(a.date));
          }

          try {
            localStorage.setItem('chatTabs', JSON.stringify(nextTabs));
          } catch (_e) {
            if (import.meta.env.DEV) console.warn('Header: failed to persist chatTabs (undo)');
          }
          return nextTabs;
        });
      }
    };

    // Show the deletion toast with undo functionality
    showChatDeletedToast(undoDelete);
  };

  const toggleHistory = () => {
    setShowHistory(!showHistory);
  };

  // If on settings page, only show UserMenu for theme toggle
  if (isSettingsPage) {
    return (
      <motion.div 
        className="absolute top-6 right-6 z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <UserMenu userSettings={userSettings} setUserSettings={setUserSettings} />
      </motion.div>
    );
  }

  return (
    <>
      <div className="navbar-container sticky top-0 z-40 flex h-[60px] items-center justify-between px-2 sm:px-4 bg-transparent">
        <div className="flex-none flex items-center justify-center h-full">
          <button
            className="p-2 hover:bg-white/40 dark:hover:bg-gray-900 rounded-lg text-gray-700 dark:text-gray-200 flex items-center justify-center"
            onClick={toggleHistory}
          >
            <LayoutGrid className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
        
        <div className="flex-1" aria-hidden="true" />
        
        <div className="flex-none flex items-center justify-center h-full">
          <UserMenu userSettings={userSettings} setUserSettings={setUserSettings} />
        </div>
      </div>

      {showHistory && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowHistory(false)}
          />
          <ChatHistoryMenu 
            history={chatHistory} 
            onSelectChat={handleHistoryAction}
            onDeleteChat={handleDeleteChat}
          />
        </>
      )}
    </>
  );
};

export default Header;
