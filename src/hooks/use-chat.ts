import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChatTab, ChatHistoryItem, UserSettings } from '../types';
import { getDeterministicResponse } from '../lib/intentMappings';
import { showChatDeletedToast, showErrorToast } from '../utils/toastUtils';

export const useChat = (userSettings: UserSettings) => {
  const location = useLocation();
  const navigate = useNavigate();
  const initialState = location.state || {};
  
  const [showHistory, setShowHistory] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [tabs, setTabs] = useState<ChatTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [showEditorSplit, setShowEditorSplit] = useState(false);
  const [editorLatex, setEditorLatex] = useState<string | null>(null);

  // Load chat history from localStorage
  useEffect(() => {
    // Always filter the history to make sure it only contains valid tabs
    const storedHistory = localStorage.getItem('chatHistory');
    const storedTabs = localStorage.getItem('chatTabs');
    
    if (storedHistory && storedTabs) {
      try {
        const history = JSON.parse(storedHistory);
        const tabs = JSON.parse(storedTabs);
        
        // Filter history to only include items with corresponding tab data
        const validHistory = history.filter((historyItem) => {
          return tabs.some(tab => tab.id === historyItem.id);
        });
        
        // If the filtered history is different from the original, update localStorage
        if (validHistory.length !== history.length) {
          localStorage.setItem('chatHistory', JSON.stringify(validHistory));
        }
        
        setChatHistory(validHistory);
      } catch (error) {
        console.error('Failed to parse chat history:', error);
        setChatHistory([]);
      }
    } else {
      setChatHistory([]);
    }
  }, []);

  // Initialize tabs and active tab
  useEffect(() => {
    const savedTabs = localStorage.getItem('chatTabs');
    let loadedTabs: ChatTab[] = [];
    
    try {
      loadedTabs = savedTabs ? JSON.parse(savedTabs) : [];
    } catch (error) {
      console.error('Failed to parse saved tabs:', error);
    }
    
    if (initialState.selectedChatId) {
      const existingTabIndex = loadedTabs.findIndex(tab => tab.id === initialState.selectedChatId);
      
      if (existingTabIndex >= 0) {
        setActiveTabId(initialState.selectedChatId);
        setTabs(loadedTabs);
      } else {
        // Create a new tab if the chat doesn't exist
        const defaultTab: ChatTab = {
          id: String(Date.now()),
          title: 'New Chat',
          date: new Date().toLocaleDateString('en-GB'),
          messages: [],
          activePDF: null,
        };
        
        loadedTabs = [defaultTab, ...loadedTabs];
        setTabs(loadedTabs);
        setActiveTabId(defaultTab.id);
        
        localStorage.setItem('chatTabs', JSON.stringify(loadedTabs));
        
        // Display error notification
        showErrorToast(
          "Chat not found", 
          "The requested chat could not be found. A new chat has been created."
        );
      }
    } else if (loadedTabs.length > 0) {
      setTabs(loadedTabs);
      setActiveTabId(loadedTabs[0].id);
    } else {
      const defaultTab: ChatTab = {
        id: String(Date.now()),
        title: 'New Chat',
        date: new Date().toLocaleDateString('en-GB'),
        messages: [],
        activePDF: null,
      };
      setTabs([defaultTab]);
      setActiveTabId(defaultTab.id);
      
      localStorage.setItem('chatTabs', JSON.stringify([defaultTab]));
    }
    
    // If navigation requested opening editor with LaTeX, honor it
    if (initialState.openEditorWithLatex && typeof initialState.openEditorWithLatex === 'string') {
      setShowEditorSplit(true);
      setEditorLatex(initialState.openEditorWithLatex);
    }
    if (initialState.latexContent && typeof initialState.latexContent === 'string') {
      setShowEditorSplit(true);
      setEditorLatex(initialState.latexContent);
    }

    setIsLoading(false);
  }, [initialState.selectedChatId, initialState.initialQuery, initialState.openEditorWithLatex, initialState.latexContent]);

  // Handle form submission (calls backend)
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !activeTabId) return;

    const userText = inputValue;

    // Append user message locally
    const updatedTabs = tabs.map(tab => {
      if (tab.id === activeTabId) {
        return {
          ...tab,
          messages: [
            ...tab.messages,
            {
              id: tab.messages.length + 1,
              text: userText,
              isUser: true,
            }
          ],
        };
      }
      return tab;
    });
    setTabs(updatedTabs);
    setInputValue('');

    // Ensure sessionId per tab
    let sessionId = updatedTabs.find(t => t.id === activeTabId)?.sessionId;
    try {
      if (!sessionId) {
        const r = await fetch('http://127.0.0.1:5057/add_session');
        const j = await r.json();
        sessionId = j.session_id;
        const tabsWithSession = updatedTabs.map(tab => tab.id === activeTabId ? { ...tab, sessionId } : tab);
        setTabs(tabsWithSession);
        localStorage.setItem('chatTabs', JSON.stringify(tabsWithSession));
      }

      // Send chat to backend
      const resp = await fetch('http://127.0.0.1:5057/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, user_input: userText })
      });
      const data = await resp.json();
      const assistantText = typeof data.response === 'string' ? data.response : JSON.stringify(data.response);

      // Append assistant message
      setTabs(prevTabs => prevTabs.map(tab => {
        if (tab.id === activeTabId) {
          return {
            ...tab,
            messages: [
              ...tab.messages,
              {
                id: tab.messages.length + 1,
                text: assistantText,
                isUser: false,
              }
            ],
          };
        }
        return tab;
      }));

      // Update chat history (last message)
      const updatedHistory = chatHistory.map(chat => chat.id === activeTabId ? { ...chat, lastMessage: userText } : chat);
      setChatHistory(updatedHistory);
      localStorage.setItem('chatHistory', JSON.stringify(updatedHistory));
    } catch (err) {
      console.error('Chat error:', err);
      // Append error message
      setTabs(prevTabs => prevTabs.map(tab => {
        if (tab.id === activeTabId) {
          return {
            ...tab,
            messages: [
              ...tab.messages,
              {
                id: tab.messages.length + 1,
                text: 'Error contacting the assistant. Please try again.',
                isUser: false,
              }
            ],
          };
        }
        return tab;
      }));
    }
  }, [inputValue, activeTabId, tabs, chatHistory]);

  // Create a new tab
  const handleNewTab = useCallback(() => {
    const newTab: ChatTab = {
      id: String(Date.now()),
      title: 'New Chat',
      date: new Date().toLocaleDateString('en-GB'),
      messages: [],
      activePDF: null,
    };
    
    const updatedTabs = [...tabs, newTab];
    setTabs(updatedTabs);
    setActiveTabId(newTab.id);
    
    localStorage.setItem('chatTabs', JSON.stringify(updatedTabs));
    
    const newChatHistoryItem: ChatHistoryItem = {
      id: newTab.id,
      title: newTab.title,
      date: newTab.date,
      lastMessage: '',
    };
    
    const updatedHistory = [newChatHistoryItem, ...chatHistory];
    setChatHistory(updatedHistory);
    localStorage.setItem('chatHistory', JSON.stringify(updatedHistory));
  }, [tabs, chatHistory]);

  // Close a tab
  const handleTabClose = useCallback((tabId: string) => {
    if (tabs.length === 1) return;
    
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    setTabs(newTabs);
    
    if (activeTabId === tabId) {
      setActiveTabId(newTabs[newTabs.length - 1].id);
    }
    
    localStorage.setItem('chatTabs', JSON.stringify(newTabs));
  }, [tabs, activeTabId]);

  // Delete a chat
  const handleDeleteChat = useCallback((chatId: string) => {
    // Update chat history
    const updatedHistory = chatHistory.filter(chat => chat.id !== chatId);
    setChatHistory(updatedHistory);
    localStorage.setItem('chatHistory', JSON.stringify(updatedHistory));
    
    // Update tabs
    const updatedTabs = tabs.filter(tab => tab.id !== chatId);
    setTabs(updatedTabs);
    localStorage.setItem('chatTabs', JSON.stringify(updatedTabs));
    
    // If the active tab was deleted, set a new active tab
    if (activeTabId === chatId) {
      if (updatedTabs.length > 0) {
        // Find the index of the deleted tab
        const tabIndex = tabs.findIndex(tab => tab.id === chatId);
        // Select the next tab, or the last tab if it was the last one
        const newActiveIndex = tabIndex < updatedTabs.length ? tabIndex : updatedTabs.length - 1;
        setActiveTabId(updatedTabs[newActiveIndex].id);
      } else {
        // Create a new tab if there are no tabs left
        const newTab: ChatTab = {
          id: String(Date.now()),
          title: 'New Chat',
          date: new Date().toLocaleDateString('en-GB'),
          messages: [],
          activePDF: null,
        };
        
        setTabs([newTab]);
        setActiveTabId(newTab.id);
        
        // Add the new tab to chat history
        const newChatHistoryItem: ChatHistoryItem = {
          id: newTab.id,
          title: newTab.title,
          date: newTab.date,
          lastMessage: '',
        };
        
        setChatHistory([newChatHistoryItem]);
        localStorage.setItem('chatHistory', JSON.stringify([newChatHistoryItem]));
        localStorage.setItem('chatTabs', JSON.stringify([newTab]));
      }
    }

    // Create an undo function for chat deletion
    const deletedTab = tabs.find(tab => tab.id === chatId);
    const deletedHistoryItem = chatHistory.find(chat => chat.id === chatId);
    
    const undoDelete = () => {
      if (deletedTab && deletedHistoryItem) {
        // Restore the tab and history item
        setTabs(prevTabs => [...prevTabs, deletedTab]);
        setChatHistory(prevHistory => [...prevHistory, deletedHistoryItem]);

        // Update localStorage with the latest state
        setTimeout(() => {
          const currentTabs = JSON.parse(localStorage.getItem('chatTabs') || '[]');
          const currentHistory = JSON.parse(localStorage.getItem('chatHistory') || '[]');
          localStorage.setItem('chatTabs', JSON.stringify([...currentTabs, deletedTab]));
          localStorage.setItem('chatHistory', JSON.stringify([...currentHistory, deletedHistoryItem]));
        }, 0);
      }
    };

    showChatDeletedToast(undoDelete);
  }, [activeTabId, tabs, chatHistory]);

  // Return values and functions
  return useMemo(() => ({
    showHistory,
    setShowHistory,
    chatHistory,
    setChatHistory,
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    isLoading,
    inputValue,
    setInputValue,
    handleSubmit,
    handleNewTab,
    handleTabClose,
    handleDeleteChat,
    showEditorSplit,
    setShowEditorSplit,
    editorLatex,
    setEditorLatex,
    navigate
  }), [
    showHistory, 
    chatHistory, 
    tabs, 
    activeTabId, 
    isLoading, 
    inputValue, 
    handleSubmit, 
    handleNewTab, 
    handleTabClose, 
    handleDeleteChat, 
    showEditorSplit,
    editorLatex,
    navigate
  ]);
}; 