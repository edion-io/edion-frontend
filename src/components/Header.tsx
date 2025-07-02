import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import ChatHistoryMenu from './ChatHistory';
import UserMenu from './UserMenu';
import { UserSettings as UserSettingsType, ChatHistoryItem } from '../types';
import { getUserSettingsFromStorage, getChatHistoryFromStorage } from '../utils/storageUtils';

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
  
  // Use props if provided, otherwise use local state
  const userSettings = propUserSettings || localUserSettings;
  const setUserSettings = propSetUserSettings || setLocalUserSettings;

  // Settings page still needs UserMenu for theme toggle, but not the full header
  const isSettingsPage = location.pathname === '/settings';

  useEffect(() => {
    const handleStorageChange = () => {
      const newSettings = getUserSettingsFromStorage();
      setChatHistory(getChatHistoryFromStorage());
      
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
      console.log(`Selected chat with ID: ${chatId}`);
      navigate('/chat', { state: { selectedChatId: chatId } });
    }
  };

  const handleDeleteChat = (chatId: string) => {
    const updatedHistory = chatHistory.filter(chat => chat.id !== chatId);
    setChatHistory(updatedHistory);
    localStorage.setItem('chatHistory', JSON.stringify(updatedHistory));
    
    const storedTabs = localStorage.getItem('chatTabs');
    if (storedTabs) {
      const tabs = JSON.parse(storedTabs);
      const updatedTabs = tabs.filter((tab: any) => tab.id !== chatId);
      localStorage.setItem('chatTabs', JSON.stringify(updatedTabs));
    }


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
        
        <div className="flex-1">
          {/* Empty flex spacer */}
        </div>
        
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
