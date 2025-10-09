import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Mic } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { ChatHistoryItem, ChatTab } from '../types';
import { cn } from '@/lib/utils';
import FileUploadMenu from './FileUploadMenu';
import { getDeterministicResponse } from '@/lib/intentMappings';

const Search = () => {
  const [searchInput, setSearchInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      // Create a new chat history item
      const newChatId = uuidv4();
      const now = new Date();
      const formattedDate = `${now.getDate()}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
      
      const newChat: ChatHistoryItem = {
        id: newChatId,
        title: searchInput,
        date: formattedDate,
        lastMessage: searchInput,
      };
      
      // Get existing chat history or initialize empty array
      const existingHistory = localStorage.getItem('chatHistory');
      let chatHistory: ChatHistoryItem[] = existingHistory ? JSON.parse(existingHistory) : [];
      
      // Add new chat to history (at the beginning)
      chatHistory = [newChat, ...chatHistory];
      
      // Save updated history
      localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
      
      // Create initial tab data
      const deterministic = getDeterministicResponse(searchInput);

      const newTab: ChatTab = {
        id: newChatId,
        title: searchInput,
        date: formattedDate,
        messages: [
          {
            id: 1,
            text: searchInput,
            isUser: true,
          },
          {
            id: 2,
            text: (deterministic ?? (searchInput.trim().toLowerCase().includes('exercise')
              ? "What grade are the students?"
              : "Hello! I'm here to help. What can I assist you with today?")),
            isUser: false,
          }
        ],
        activePDF: null
      };
      
      // Store the new tab in localStorage so Chat component can find it
      const existingTabs = localStorage.getItem('chatTabs');
      let chatTabs: ChatTab[] = existingTabs ? JSON.parse(existingTabs) : [];
      
      // Add new tab to the end of the array instead of the beginning
      chatTabs = [...chatTabs, newTab];
      localStorage.setItem('chatTabs', JSON.stringify(chatTabs));
      
      // Navigate to chat page with the new chat ID
      navigate('/chat', { 
        state: { 
          selectedChatId: newChatId, 
          initialQuery: searchInput 
        } 
      });
    }
  };

  const handleFileSelect = (file: File) => {
    // Create a new chat for the file
    const newChatId = uuidv4();
    const now = new Date();
    const formattedDate = `${now.getDate()}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
    
    const newChat: ChatHistoryItem = {
      id: newChatId,
      title: `File: ${file.name}`,
      date: formattedDate,
      lastMessage: `Uploaded ${file.name}`,
    };
    
    // Get existing chat history or initialize empty array
    const existingHistory = localStorage.getItem('chatHistory');
    let chatHistory: ChatHistoryItem[] = existingHistory ? JSON.parse(existingHistory) : [];
    
    // Add new chat to history (at the beginning)
    chatHistory = [newChat, ...chatHistory];
    
    // Save updated history
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
    
    // Create initial tab data
    const newTab: ChatTab = {
      id: newChatId,
      title: `File: ${file.name}`,
      date: formattedDate,
      messages: [
        {
          id: 1,
          text: `I've uploaded ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
          isUser: true,
        },
        {
          id: 2,
          text: "I'll analyze this file for you. What would you like to know about it?",
          isUser: false,
        }
      ],
      activePDF: null
    };
    
    // Store the new tab in localStorage so Chat component can find it
    const existingTabs = localStorage.getItem('chatTabs');
    let chatTabs: ChatTab[] = existingTabs ? JSON.parse(existingTabs) : [];
    
    // Add new tab to the end of the array instead of the beginning
    chatTabs = [...chatTabs, newTab];
    localStorage.setItem('chatTabs', JSON.stringify(chatTabs));
    
    // Navigate to chat page with the new chat ID
    navigate('/chat', { 
      state: { 
        selectedChatId: newChatId, 
        initialQuery: `Analyzing file: ${file.name}`
      } 
    });
  };

  return (
    <motion.div 
      className="w-full max-w-xl mx-auto"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
    >
      <form onSubmit={handleSubmit} className="relative">
        <div className="bg-gray-50/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm rounded-lg border border-transparent">
          <div className="flex">
            <div className="flex-1 relative">
              <textarea
                placeholder="What can I help you with, Julia?"
                className={cn(
                  "w-full bg-transparent rounded-lg",
                  "focus:outline-none text-sm",
                  "text-gray-700 dark:text-gray-200",
                  "placeholder:text-gray-400 dark:placeholder:text-gray-400",
                  "resize-none",
                  "scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600",
                  "scrollbar-track-transparent hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500"
                )}
                style={{
                  lineHeight: '20px',
                  padding: '12px 12px 12px 16px',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  whiteSpace: 'pre-wrap',
                  overflowY: 'auto',
                  width: 'calc(100% - 140px)',
                  minHeight: '42px',
                  maxHeight: '200px'
                }}
                aria-label="Search box"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  // Auto-adjust height
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                rows={1}
              />
            </div>
            <div className="flex items-center gap-1 bg-transparent border-l border-gray-200/80 dark:border-gray-800/50 p-2 z-10" style={{ 
              width: '140px',
              position: 'absolute',
              right: 0,
              bottom: 0,
              top: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <button 
                type="button" 
                className="p-1.5 sm:p-2 hover:bg-gray-200/70 dark:hover:bg-gray-700/70 rounded-lg text-gray-500 dark:text-gray-400 backdrop-blur-sm"
                aria-label="Voice input"
              >
                <Mic className="h-4 w-4 sm:w-5 sm:h-5" />
              </button>
              
              <FileUploadMenu onFileSelect={handleFileSelect} />
              
              <button 
                type="submit" 
                className={cn(
                  "p-1.5 sm:p-2 rounded-lg flex items-center justify-center",
                  searchInput.trim()
                    ? "bg-indigo-500 hover:bg-indigo-600 dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
                    : "hover:bg-gray-200/70 dark:hover:bg-gray-700/70 text-gray-500 dark:text-gray-400 backdrop-blur-sm"
                )}
                aria-label="Submit search"
                disabled={!searchInput.trim()}
              >
                <ArrowRight className="h-4 w-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </div>
      </form>
    </motion.div>
  );
};

export default Search;
