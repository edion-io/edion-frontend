import { useEffect, useState, useRef } from 'react';
import type { DragEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserSettings as UserSettingsType } from '../types';
import ChatHistoryMenu from '../components/ChatHistory';
import ChatHeader from '../components/ChatHeader';
import ChatMessages from '../components/ChatMessages';
import ChatInput from '../components/ChatInput';
import { useChat } from '../hooks/use-chat';
import { updateUserSettings, getUserSettingsFromStorage } from '../utils/storageUtils';
import useEditorSync from '../hooks/useEditorSync';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../components/ui/resizable';
import { AnimatePresence, motion } from 'framer-motion';
import EditorPane from '../components/EditorPane';
import ChatPane from '../components/ChatPane';

type PanelSwapDirection = 'left' | 'right' | 'toggle';

const Chat = () => {
  const [userSettings, setUserSettings] = useState<UserSettingsType>(getUserSettingsFromStorage());
  const navigate = useNavigate();
  // Add this state to force re-renders
  const [forceUpdate, setForceUpdate] = useState(0);
  // Track if this is the first load
  const isInitialMount = useRef(true);

  const {
    showHistory,
    setShowHistory,
    chatHistory,
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
  } = useChat(userSettings);

  const getActiveTab = () => tabs.find(tab => tab.id === activeTabId);

  useEffect(() => {
    // Apply theme immediately on first load
    if (isInitialMount.current) {
      // First, disable all transitions
      document.documentElement.classList.add('disable-transitions');
      
      // Apply theme change
      if (userSettings.darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      
      // Re-enable transitions after a small delay
      setTimeout(() => {
        document.documentElement.classList.remove('disable-transitions');
      }, 50);
      
      isInitialMount.current = false;
      return;
    }
    
    // For subsequent theme changes
    // First, disable all transitions
    document.documentElement.classList.add('disable-transitions');
    
    // Apply theme change
    if (userSettings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Force a re-render of components that depend on theme
    setForceUpdate(prev => prev + 1);
    
    // Re-enable transitions after a small delay to ensure theme is applied
    const timer = setTimeout(() => {
      document.documentElement.classList.remove('disable-transitions');
    }, 50);
    
    return () => clearTimeout(timer);
  }, [userSettings.darkMode]);

  // Listen for theme changes from other components
  useEffect(() => {
    const handleThemeChange = (event: CustomEvent) => {
      const { darkMode } = event.detail;
      if (darkMode !== userSettings.darkMode) {
        setUserSettings(prev => ({
          ...prev,
          darkMode
        }));
      }
    };
    
    window.addEventListener('themeChanged', handleThemeChange as EventListener);
    return () => {
      window.removeEventListener('themeChanged', handleThemeChange as EventListener);
    };
  }, [userSettings.darkMode]);

  // Editor state and sync logic moved into custom hook
  const {
    editorRef,
    editorContent,
    setEditorContent,
    insertMathDelimiters,
    execFormatCommand,
    setExecFormatCommand,
    showRawLatex,
    setShowRawLatex,
    editorOnLeft,
    setEditorOnLeft,
    isDraggingPane,
    setIsDraggingPane,
    dragOverEditor,
    setDragOverEditor,
    dragOverChat,
    setDragOverChat,
    handleIndent,
    handleOutdent,
    insertTable,
  } = useEditorSync({
    showEditorSplit,
    initialLatex: editorLatex || '',
    onLatexChange: setEditorLatex,
  });

  const handleKeyboardSwap = (pane: 'editor' | 'chat', direction: PanelSwapDirection) => {
    if (direction === 'toggle') {
      setEditorOnLeft(prev => !prev);
      return;
    }
    if (pane === 'editor') {
      setEditorOnLeft(direction === 'left');
      return;
    }
    // pane === 'chat'
    setEditorOnLeft(direction === 'right');
  };
  
  // Indentation, table insertion, and LaTeX↔HTML sync handled by useEditorSync

  const handleEditMessage = (messageId: number, newText: string) => {
    if (messageId === -1) {
      setInputValue(newText);
      return;
    }

    const activeTab = getActiveTab();
    if (!activeTab) return;

    const updatedTabs = tabs.map(tab => {
      if (tab.id === activeTabId) {
        const updatedMessages = tab.messages.map(msg => {
          if (msg.id === messageId) {
            return {
              ...msg,
              text: newText
            };
          }
          return msg;
        });
        
        return {
          ...tab,
          messages: updatedMessages,
        };
      }
      return tab;
    });
    
    setTabs(updatedTabs);
    localStorage.setItem('chatTabs', JSON.stringify(updatedTabs));
  };

  const handleReorderTabs = (newTabOrder: typeof tabs) => {
    setTabs(newTabOrder);
    localStorage.setItem('chatTabs', JSON.stringify(newTabOrder));
  };

  const goToSettings = () => {
    navigate('/settings');
  };

  const handleUpdateUserSettings = (newSettings: UserSettingsType) => {
    setUserSettings(newSettings);
    updateUserSettings(newSettings);
  };

  const toggleHistory = () => {
    setShowHistory(!showHistory);
  };

  const handleOutsideClick = () => {
    if (showHistory) {
      setShowHistory(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">Loading chat...</p>
      </div>
    );
  }

  const activeTab = getActiveTab();
  if (!activeTab) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">No active chat found. Please try again or start a new chat.</p>
      </div>
    );
  }

  // Shared drag and drop helpers
  const safelySetDropEffectMove = (e: DragEvent<HTMLDivElement>) => {
    const dt = e.dataTransfer;
    if (dt && 'dropEffect' in dt) {
      try {
        dt.dropEffect = 'move';
      } catch (err) {
        const name = (err && (err as { name?: string }).name) || '';
        if (name === 'SecurityError' || name === 'NotAllowedError' || name === 'InvalidStateError') {
          // ignore benign browser exceptions when setting dropEffect
        } else {
          console.error('Error setting dataTransfer.dropEffect:', err);
        }
      }
    }
  };

  const handlePaneDragStart = () => {
    setIsDraggingPane(true);
    document.body.classList.add('dragging-pane');
  };

  const handlePaneDragEnd = () => {
    setIsDraggingPane(false);
    setDragOverEditor(false);
    setDragOverChat(false);
    document.body.classList.remove('dragging-pane');
  };

  const handleEditorDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    safelySetDropEffectMove(e);
    setDragOverEditor(true);
  };

  const handleEditorDrop = (e: DragEvent<HTMLDivElement>, targetIsLeft: boolean) => {
    e.preventDefault();
    const src = e.dataTransfer.getData('text/pane');
    if (src === 'chat') setEditorOnLeft(!targetIsLeft);
    setDragOverEditor(false);
    setIsDraggingPane(false);
    document.body.classList.remove('dragging-pane');
  };

  const handleChatDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    safelySetDropEffectMove(e);
    setDragOverChat(true);
  };

  const handleChatDrop = (e: DragEvent<HTMLDivElement>, targetIsLeft: boolean) => {
    e.preventDefault();
    const src = e.dataTransfer.getData('text/pane');
    if (src === 'editor') setEditorOnLeft(targetIsLeft);
    setDragOverChat(false);
    setIsDraggingPane(false);
    document.body.classList.remove('dragging-pane');
  };

  return (
    <div className="flex h-screen">
      {showHistory && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={handleOutsideClick}
          />
          <ChatHistoryMenu 
            history={chatHistory} 
            onSelectChat={(chatId) => {
              setShowHistory(false);
              setActiveTabId(chatId);
            }} 
            onDeleteChat={handleDeleteChat} 
          />
        </>
      )}

      <div className="flex-1 flex flex-col bg-gray-100 dark:bg-zinc-950">
        <ChatHeader
          toggleHistory={toggleHistory}
          tabs={tabs}
          activeTabId={activeTabId}
          onTabChange={setActiveTabId}
          onTabClose={handleTabClose}
          onNewTab={handleNewTab}
          onReorderTabs={handleReorderTabs}
          userSettings={userSettings}
          goToSettings={goToSettings}
        />

        <AnimatePresence mode="wait" initial={false}>
          {showEditorSplit ? (
            <motion.div
              key="split"
              className="flex-1 flex w-full min-h-0"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
            >
              <ResizablePanelGroup direction="horizontal" className="w-full min-h-0">
                {(() => {
                  const panels = editorOnLeft
                    ? [
                        (
                          <ResizablePanel defaultSize={50} minSize={20} key="editor">
                            <EditorPane
                              dragOver={dragOverEditor}
                              targetIsLeft
                              onDragOver={handleEditorDragOver}
                              onDragEnter={() => setDragOverEditor(true)}
                              onDragLeave={() => setDragOverEditor(false)}
                              onDrop={(e) => handleEditorDrop(e, true)}
                              isDraggingPane={isDraggingPane}
                              onDragStart={handlePaneDragStart}
                              onDragEnd={handlePaneDragEnd}
                              onKeySwap={(dir) => handleKeyboardSwap('editor', dir)}
                              showRawLatex={showRawLatex}
                              toggleRawLatex={() => setShowRawLatex(v => !v)}
                              insertMathDelimiters={insertMathDelimiters}
                              insertTable={insertTable}
                              handleIndent={handleIndent}
                              handleOutdent={handleOutdent}
                              editorRef={editorRef}
                              editorContent={editorContent}
                              setEditorContent={setEditorContent}
                              execFormatCommand={execFormatCommand}
                              setExecFormatCommand={setExecFormatCommand}
                              editorLatex={editorLatex || ''}
                              setEditorLatex={setEditorLatex}
                            />
                          </ResizablePanel>
                        ),
                        <ResizableHandle withHandle key="handle" />,
                        (
                          <ResizablePanel defaultSize={50} minSize={20} key="chat">
                            <ChatPane
                              dragOver={dragOverChat}
                              targetIsLeft={false}
                              onDragOver={handleChatDragOver}
                              onDragEnter={() => setDragOverChat(true)}
                              onDragLeave={() => setDragOverChat(false)}
                              onDrop={(e) => handleChatDrop(e, false)}
                              isDraggingPane={isDraggingPane}
                              onDragStart={handlePaneDragStart}
                              onDragEnd={handlePaneDragEnd}
                              onKeySwap={(dir) => handleKeyboardSwap('chat', dir)}
                              forceUpdate={forceUpdate}
                              activeTab={activeTab}
                              darkMode={userSettings.darkMode}
                              onEditMessage={handleEditMessage}
                              inputValue={inputValue}
                              setInputValue={setInputValue}
                              onSubmit={handleSubmit}
                            />
                          </ResizablePanel>
                        ),
                      ]
                    : [
                        (
                          <ResizablePanel defaultSize={50} minSize={20} key="chat">
                            <ChatPane
                              dragOver={dragOverChat}
                              targetIsLeft
                              onDragOver={handleChatDragOver}
                              onDragEnter={() => setDragOverChat(true)}
                              onDragLeave={() => setDragOverChat(false)}
                              onDrop={(e) => handleChatDrop(e, true)}
                              isDraggingPane={isDraggingPane}
                              onDragStart={handlePaneDragStart}
                              onDragEnd={handlePaneDragEnd}
                              onKeySwap={(dir) => handleKeyboardSwap('chat', dir)}
                              forceUpdate={forceUpdate}
                              activeTab={activeTab}
                              darkMode={userSettings.darkMode}
                              onEditMessage={handleEditMessage}
                              inputValue={inputValue}
                              setInputValue={setInputValue}
                              onSubmit={handleSubmit}
                            />
                          </ResizablePanel>
                        ),
                        <ResizableHandle withHandle key="handle" />,
                        (
                          <ResizablePanel defaultSize={50} minSize={20} key="editor">
                            <EditorPane
                              dragOver={dragOverEditor}
                              targetIsLeft={false}
                              onDragOver={handleEditorDragOver}
                              onDragEnter={() => setDragOverEditor(true)}
                              onDragLeave={() => setDragOverEditor(false)}
                              onDrop={(e) => handleEditorDrop(e, false)}
                              isDraggingPane={isDraggingPane}
                              onDragStart={handlePaneDragStart}
                              onDragEnd={handlePaneDragEnd}
                              onKeySwap={(dir) => handleKeyboardSwap('editor', dir)}
                              showRawLatex={showRawLatex}
                              toggleRawLatex={() => setShowRawLatex(v => !v)}
                              insertMathDelimiters={insertMathDelimiters}
                              insertTable={insertTable}
                              handleIndent={handleIndent}
                              handleOutdent={handleOutdent}
                              editorRef={editorRef}
                              editorContent={editorContent}
                              setEditorContent={setEditorContent}
                              execFormatCommand={execFormatCommand}
                              setExecFormatCommand={setExecFormatCommand}
                              editorLatex={editorLatex || ''}
                              setEditorLatex={setEditorLatex}
                            />
                          </ResizablePanel>
                        ),
                      ];
                  return panels;
                })()}
              </ResizablePanelGroup>
            </motion.div>
          ) : (
            <motion.div
              key="single"
              className="flex-1 flex w-full min-h-0"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
            >
              <div className="w-full flex flex-col">
                <ChatMessages
                  key={`messages-${forceUpdate}`}
                  activeTab={activeTab}
                  darkMode={userSettings.darkMode}
                  onEditMessage={handleEditMessage}
                  reserveForFixedComposer
                />
                <div className="relative">
                  <ChatInput
                    key={`input-${forceUpdate}`}
                    inputValue={inputValue}
                    setInputValue={setInputValue}
                    onSubmit={handleSubmit}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Chat;
