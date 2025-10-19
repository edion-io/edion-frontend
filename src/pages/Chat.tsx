import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserSettings as UserSettingsType } from '../types';
import ChatHistoryMenu from '../components/ChatHistory';
import ChatHeader from '../components/ChatHeader';
import ChatMessages from '../components/ChatMessages';
import ChatInput from '../components/ChatInput';
import { useChat } from '../hooks/use-chat';
import { updateUserSettings, getUserSettingsFromStorage } from '../utils/storageUtils';
import RichTextArea from '../components/Editor/RichTextArea';
import useEditorSync from '../hooks/useEditorSync';
import EditorToolbar from '../components/Editor/EditorToolbar';
import LatexView from '../components/Editor/LatexView';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../components/ui/resizable';
import DragHandle from '../components/DragHandle';
import { AnimatePresence, motion } from 'framer-motion';

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

  const handleKeyboardSwap = (pane: 'editor' | 'chat', direction: 'left' | 'right' | 'toggle') => {
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
                {editorOnLeft ? (
                  <>
                    <ResizablePanel defaultSize={50} minSize={20}>
                      <div
                        className={`h-full min-h-0 p-3 flex flex-col transition-all duration-200 ${dragOverEditor ? 'ring-2 ring-indigo-500/60 shadow-lg scale-[1.01]' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); const dt = e.dataTransfer; if (dt && 'dropEffect' in dt) { try { dt.dropEffect = 'move'; } catch (err) { const name = (err && (err as { name?: string }).name) || ''; if (name === 'SecurityError' || name === 'NotAllowedError' || name === 'InvalidStateError') { /* ignore benign browser exceptions when setting dropEffect */ } else { console.error('Error setting dataTransfer.dropEffect:', err); } } } setDragOverEditor(true); }}
                        onDragEnter={() => setDragOverEditor(true)}
                        onDragLeave={() => setDragOverEditor(false)}
                        onDrop={(e) => { e.preventDefault(); const src = e.dataTransfer.getData('text/pane'); if (src === 'chat') setEditorOnLeft(false); setDragOverEditor(false); setIsDraggingPane(false); document.body.classList.remove('dragging-pane'); }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Editor</div>
                          <DragHandle
                            paneType="editor"
                            isDragging={isDraggingPane}
                            onDragStart={() => {
                              setIsDraggingPane(true);
                              document.body.classList.add('dragging-pane');
                            }}
                            onDragEnd={() => {
                              setIsDraggingPane(false);
                              setDragOverEditor(false);
                              setDragOverChat(false);
                              document.body.classList.remove('dragging-pane');
                            }}
                            onKeySwap={(dir) => handleKeyboardSwap('editor', dir)}
                          />
                        </div>
                        <div className="mb-2">
                          <EditorToolbar 
                            showRawLatex={showRawLatex}
                            toggleRawLatex={() => setShowRawLatex(v => !v)}
                            onInsertMath={insertMathDelimiters}
                            onInsertTable={insertTable}
                            onIndent={handleIndent}
                            onOutdent={handleOutdent}
                            editorRef={editorRef}
                            onNewListCreated={() => {}}
                            onFormatCommandReady={fn => setExecFormatCommand(() => fn)}
                          />
                        </div>
                        {
                          !showRawLatex ? (
                            <div className="flex-1 bg-white dark:bg-zinc-800 rounded-md border shadow-sm">
                              <RichTextArea
                                content={editorContent}
                                onChange={setEditorContent}
                                editorRef={editorRef}
                                onFormatCommand={execFormatCommand || undefined}
                              />
                            </div>
                          ) : (
                            <div className="flex-1 bg-white dark:bg-zinc-800 rounded-md border shadow-sm p-3">
                              <LatexView 
                                latexDocument={editorLatex || ''}
                                onChange={(next) => setEditorLatex(next)}
                              />
                            </div>
                          )
                        }
                      </div>
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                    <ResizablePanel defaultSize={50} minSize={20}>
                      <div
                        className={`h-full min-h-0 flex flex-col transition-all duration-200 ${dragOverChat ? 'ring-2 ring-indigo-500/60 shadow-lg scale-[1.01]' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); const dt = e.dataTransfer; if (dt && 'dropEffect' in dt) { try { dt.dropEffect = 'move'; } catch (err) { const name = (err && (err as { name?: string }).name) || ''; if (name === 'SecurityError' || name === 'NotAllowedError' || name === 'InvalidStateError') { /* ignore benign browser exceptions when setting dropEffect */ } else { console.error('Error setting dataTransfer.dropEffect:', err); } } } setDragOverChat(true); }}
                        onDragEnter={() => setDragOverChat(true)}
                        onDragLeave={() => setDragOverChat(false)}
                        onDrop={(e) => { e.preventDefault(); const src = e.dataTransfer.getData('text/pane'); if (src === 'editor') setEditorOnLeft(false); setDragOverChat(false); setIsDraggingPane(false); document.body.classList.remove('dragging-pane'); }}
                      >
                        <div className="flex items-center justify-between px-3 pt-3 pb-2">
                          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Chat</div>
                          <DragHandle
                            paneType="chat"
                            isDragging={isDraggingPane}
                            onDragStart={() => {
                              setIsDraggingPane(true);
                              document.body.classList.add('dragging-pane');
                            }}
                            onDragEnd={() => {
                              setIsDraggingPane(false);
                              setDragOverEditor(false);
                              setDragOverChat(false);
                              document.body.classList.remove('dragging-pane');
                            }}
                            onKeySwap={(dir) => handleKeyboardSwap('chat', dir)}
                          />
                        </div>
                        <ChatMessages
                          key={`messages-${forceUpdate}`}
                          activeTab={activeTab}
                          darkMode={userSettings.darkMode}
                          onEditMessage={handleEditMessage}
                          reserveForFixedComposer={false}
                        />
                        <div className="relative px-3 pb-3">
                          <ChatInput
                            key={`input-${forceUpdate}`}
                            inputValue={inputValue}
                            setInputValue={setInputValue}
                            onSubmit={handleSubmit}
                            withinPane
                          />
                        </div>
                      </div>
                    </ResizablePanel>
                  </>
                ) : (
                  <>
                    <ResizablePanel defaultSize={50} minSize={20}>
                      <div
                        className={`h-full min-h-0 flex flex-col transition-all duration-200 ${dragOverChat ? 'ring-2 ring-indigo-500/60 shadow-lg scale-[1.01]' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); const dt = e.dataTransfer; if (dt && 'dropEffect' in dt) { try { dt.dropEffect = 'move'; } catch (err) { const name = (err && (err as any).name) || ''; if (name === 'SecurityError' || name === 'NotAllowedError' || name === 'InvalidStateError') { /* ignore benign browser exceptions when setting dropEffect */ } else { console.error('Error setting dataTransfer.dropEffect:', err); } } } setDragOverChat(true); }}
                        onDragEnter={() => setDragOverChat(true)}
                        onDragLeave={() => setDragOverChat(false)}
                        onDrop={(e) => { e.preventDefault(); const src = e.dataTransfer.getData('text/pane'); if (src === 'editor') setEditorOnLeft(true); setDragOverChat(false); setIsDraggingPane(false); document.body.classList.remove('dragging-pane'); }}
                      >
                        <div className="flex items-center justify-between px-3 pt-3 pb-2">
                          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Chat</div>
                          <DragHandle
                            paneType="chat"
                            isDragging={isDraggingPane}
                            onDragStart={() => {
                              setIsDraggingPane(true);
                              document.body.classList.add('dragging-pane');
                            }}
                            onDragEnd={() => {
                              setIsDraggingPane(false);
                              setDragOverEditor(false);
                              setDragOverChat(false);
                              document.body.classList.remove('dragging-pane');
                            }}
                            onKeySwap={(dir) => handleKeyboardSwap('chat', dir)}
                          />
                        </div>
                        <ChatMessages
                          key={`messages-${forceUpdate}`}
                          activeTab={activeTab}
                          darkMode={userSettings.darkMode}
                          onEditMessage={handleEditMessage}
                          reserveForFixedComposer={false}
                        />
                        <div className="relative px-3 pb-3">
                          <ChatInput
                            key={`input-${forceUpdate}`}
                            inputValue={inputValue}
                            setInputValue={setInputValue}
                            onSubmit={handleSubmit}
                            withinPane
                          />
                        </div>
                      </div>
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                    <ResizablePanel defaultSize={50} minSize={20}>
                      <div
                        className={`h-full min-h-0 p-3 flex flex-col transition-all duration-200 ${
                          dragOverEditor ? 'ring-2 ring-indigo-500/60 shadow-lg scale-[1.01]' : ''
                        }`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          const dt = e.dataTransfer;
                          if (dt && 'dropEffect' in dt) {
                            try { dt.dropEffect = 'move'; } catch (err) {
                              const name = (err && (err as { name?: string }).name) || '';
                              if (name === 'SecurityError' || name === 'NotAllowedError' || name === 'InvalidStateError') {
                                // ignore benign browser exceptions when setting dropEffect
                              } else {
                                console.error('Error setting dataTransfer.dropEffect:', err);
                              }
                            }
                          }
                          setDragOverEditor(true);
                        }}
                        onDragEnter={() => setDragOverEditor(true)}
                        onDragLeave={() => setDragOverEditor(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          const src = e.dataTransfer.getData('text/pane');
                          if (src === 'chat') setEditorOnLeft(true);
                          setDragOverEditor(false);
                          setIsDraggingPane(false);
                          document.body.classList.remove('dragging-pane');
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Editor
                          </div>
                          <DragHandle
                            paneType="editor"
                            isDragging={isDraggingPane}
                            onDragStart={() => {
                              setIsDraggingPane(true);
                              document.body.classList.add('dragging-pane');
                            }}
                            onDragEnd={() => {
                              setIsDraggingPane(false);
                              setDragOverEditor(false);
                              setDragOverChat(false);
                              document.body.classList.remove('dragging-pane');
                            }}
                            onKeySwap={(dir) => handleKeyboardSwap('editor', dir)}
                          />
                        </div>
                        <div className="mb-2">
                          <EditorToolbar
                            showRawLatex={showRawLatex}
                            toggleRawLatex={() => setShowRawLatex(v => !v)}
                            onInsertMath={insertMathDelimiters}
                            onInsertTable={insertTable}
                            onIndent={handleIndent}
                            onOutdent={handleOutdent}
                            editorRef={editorRef}
                            onNewListCreated={() => {}}
                            onFormatCommandReady={fn => setExecFormatCommand(() => fn)}
                          />
                        </div>
                        {!showRawLatex ? (
                          <div className="flex-1 bg-white dark:bg-zinc-800 rounded-md border shadow-sm">
                            <RichTextArea
                              content={editorContent}
                              onChange={setEditorContent}
                              editorRef={editorRef}
                              onFormatCommand={execFormatCommand || undefined}
                            />
                          </div>
                        ) : (
                          <div className="flex-1 bg-white dark:bg-zinc-800 rounded-md border shadow-sm p-3">
                            <LatexView
                              latexDocument={editorLatex || ''}
                              onChange={next => setEditorLatex(next)}
                            />
                          </div>
                        )}
                      </div>
                    </ResizablePanel>
                  </>
                )}
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
