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
import { parseLatexToHtml } from '../lib/parseLatex';
import EditorToolbar from '../components/Editor/EditorToolbar';
import useInlineMath from '../hooks/useInlineMath';
import LatexView from '../components/Editor/LatexView';
import { buildLatexDocument } from '../lib/buildLatex';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../components/ui/resizable';

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

  // Editor state for split view (must be declared before any early returns)
  const editorRef = useRef<HTMLDivElement>(null);
  const [editorContent, setEditorContent] = useState<string>('');
  const { insertMathDelimiters } = useInlineMath();
  const [execFormatCommand, setExecFormatCommand] = useState<((command: string, value?: string) => void) | null>(null);
  const [showRawLatex, setShowRawLatex] = useState(false);
  const suppressLatexSyncRef = useRef(false);
  const [editorOnLeft, setEditorOnLeft] = useState(true);
  const [isDraggingPane, setIsDraggingPane] = useState(false);
  const [dragOverEditor, setDragOverEditor] = useState(false);
  const [dragOverChat, setDragOverChat] = useState(false);

  const handleIndent = () => {
    document.execCommand('indent');
  };

  const handleOutdent = () => {
    document.execCommand('outdent');
  };

  const insertTable = (rows: number, cols: number) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    let tableHTML = '<table class="editor-table" data-rows="' + rows + '" data-cols="' + cols + '">';
    tableHTML += '<thead><tr>' + Array.from({ length: cols }).map((_, i) => '<th contenteditable="true">Header ' + (i + 1) + '</th>').join('') + '</tr></thead>';
    tableHTML += '<tbody>' + Array.from({ length: Math.max(rows - 1, 1) }).map(() => '<tr>' + Array.from({ length: cols }).map(() => '<td contenteditable="true">Cell</td>').join('') + '</tr>').join('') + '</tbody></table><p><br></p>';
    document.execCommand('insertHTML', false, tableHTML);
    if (editorRef.current) {
      setEditorContent(editorRef.current.innerHTML);
    }
  };

  // Populate WYSIWYG when deterministic LaTeX is set
  useEffect(() => {
    if (showEditorSplit && editorLatex) {
      try {
        const html = parseLatexToHtml(editorLatex);
        // Prevent immediate LaTeX rebuild caused by this programmatic HTML set
        suppressLatexSyncRef.current = true;
        setEditorContent(html);
        // Also update live DOM if already mounted
        if (editorRef.current) {
          editorRef.current.innerHTML = html;
          const event = new Event('input', { bubbles: true });
          editorRef.current.dispatchEvent(event);
        }
      } catch (_e) {
        // If parse fails, keep split open without content update
      }
    }
  }, [showEditorSplit, editorLatex]);

  // Keep LaTeX in sync when WYSIWYG changes
  useEffect(() => {
    if (!showEditorSplit) return;
    if (suppressLatexSyncRef.current) {
      suppressLatexSyncRef.current = false;
      return;
    }
    try {
      const doc = buildLatexDocument(editorContent);
      setEditorLatex(doc);
    } catch (_e) {
      // ignore conversion failures during typing
    }
  }, [editorContent, showEditorSplit, setEditorLatex]);

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

          <div className={`flex-1 flex w-full`}>
            {showEditorSplit ? (
              <ResizablePanelGroup direction="horizontal" className="w-full">
                {editorOnLeft ? (
                  <>
                    <ResizablePanel defaultSize={50} minSize={20}>
                      <div
                        className={`h-full border-r border-gray-200 dark:border-gray-800 p-3 flex flex-col transition-all duration-200 ${dragOverEditor ? 'ring-2 ring-indigo-500/60 shadow-lg scale-[1.01]' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setDragOverEditor(true); }}
                        onDragEnter={() => setDragOverEditor(true)}
                        onDragLeave={() => setDragOverEditor(false)}
                        onDrop={(e) => { const src = e.dataTransfer.getData('text/pane'); if (src === 'chat') setEditorOnLeft(false); setDragOverEditor(false); setIsDraggingPane(false); document.body.classList.remove('dragging-pane'); }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Editor</div>
                          <button
                            className="rounded-full w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/pane', 'editor');
                              const img = new Image();
                              img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
                              try { e.dataTransfer.setDragImage(img, 0, 0); } catch {}
                              setIsDraggingPane(true);
                              document.body.classList.add('dragging-pane');
                            }}
                            onDragEnd={() => { setIsDraggingPane(false); setDragOverEditor(false); setDragOverChat(false); document.body.classList.remove('dragging-pane'); }}
                            title="Drag to swap panes"
                            aria-label="Drag editor pane"
                          >
                            <span className={`inline-block w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600 ${isDraggingPane ? 'animate-pulse' : ''}`} />
                          </button>
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
                            onFormatCommandReady={(fn) => setExecFormatCommand(() => fn)}
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
                        className={`h-full flex flex-col transition-all duration-200 ${dragOverChat ? 'ring-2 ring-indigo-500/60 shadow-lg scale-[1.01]' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setDragOverChat(true); }}
                        onDragEnter={() => setDragOverChat(true)}
                        onDragLeave={() => setDragOverChat(false)}
                        onDrop={(e) => { const src = e.dataTransfer.getData('text/pane'); if (src === 'editor') setEditorOnLeft(false); setDragOverChat(false); setIsDraggingPane(false); document.body.classList.remove('dragging-pane'); }}
                      >
                        <div className="flex items-center justify-between px-3 pt-3 pb-2">
                          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Chat</div>
                          <button
                            className="rounded-full w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/pane', 'chat');
                              const img = new Image();
                              img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
                              try { e.dataTransfer.setDragImage(img, 0, 0); } catch {}
                              setIsDraggingPane(true);
                              document.body.classList.add('dragging-pane');
                            }}
                            onDragEnd={() => { setIsDraggingPane(false); setDragOverEditor(false); setDragOverChat(false); document.body.classList.remove('dragging-pane'); }}
                            title="Drag to swap panes"
                            aria-label="Drag chat pane"
                          >
                            <span className={`inline-block w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600 ${isDraggingPane ? 'animate-pulse' : ''}`} />
                          </button>
                        </div>
                        <ChatMessages
                          key={`messages-${forceUpdate}`}
                          activeTab={activeTab}
                          darkMode={userSettings.darkMode}
                          onEditMessage={handleEditMessage}
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
                    </ResizablePanel>
                  </>
                ) : (
                  <>
                    <ResizablePanel defaultSize={50} minSize={20}>
                      <div
                        className={`h-full flex flex-col transition-all duration-200 ${dragOverChat ? 'ring-2 ring-indigo-500/60 shadow-lg scale-[1.01]' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setDragOverChat(true); }}
                        onDragEnter={() => setDragOverChat(true)}
                        onDragLeave={() => setDragOverChat(false)}
                        onDrop={(e) => { const src = e.dataTransfer.getData('text/pane'); if (src === 'editor') setEditorOnLeft(true); setDragOverChat(false); setIsDraggingPane(false); document.body.classList.remove('dragging-pane'); }}
                      >
                        <div className="flex items-center justify-between px-3 pt-3 pb-2">
                          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Chat</div>
                          <button
                            className="rounded-full w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/pane', 'chat');
                              const img = new Image();
                              img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
                              try { e.dataTransfer.setDragImage(img, 0, 0); } catch {}
                              setIsDraggingPane(true);
                              document.body.classList.add('dragging-pane');
                            }}
                            onDragEnd={() => { setIsDraggingPane(false); setDragOverEditor(false); setDragOverChat(false); document.body.classList.remove('dragging-pane'); }}
                            title="Drag to swap panes"
                            aria-label="Drag chat pane"
                          >
                            <span className={`inline-block w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600 ${isDraggingPane ? 'animate-pulse' : ''}`} />
                          </button>
                        </div>
                        <ChatMessages
                          key={`messages-${forceUpdate}`}
                          activeTab={activeTab}
                          darkMode={userSettings.darkMode}
                          onEditMessage={handleEditMessage}
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
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                    <ResizablePanel defaultSize={50} minSize={20}>
                      <div
                        className={`h-full border-l border-gray-200 dark:border-gray-800 p-3 flex flex-col transition-all duration-200 ${
                          dragOverEditor
                            ? 'ring-2 ring-indigo-500/60 shadow-lg scale-[1.01]'
                            : ''
                        }`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverEditor(true);
                        }}
                        onDragEnter={() => setDragOverEditor(true)}
                        onDragLeave={() => setDragOverEditor(false)}
                        onDrop={(e) => {
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
                          <button
                            className="rounded-full w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/pane', 'editor');
                              const img = new Image();
                              img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
                              try { e.dataTransfer.setDragImage(img, 0, 0); } catch {}
                              setIsDraggingPane(true);
                              document.body.classList.add('dragging-pane');
                            }}
                            onDragEnd={() => {
                              setIsDraggingPane(false);
                              setDragOverEditor(false);
                              setDragOverChat(false);
                              document.body.classList.remove('dragging-pane');
                            }}
                            title="Drag to swap panes"
                            aria-label="Drag editor pane"
                          >
                            <span
                              className={`inline-block w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600 ${
                                isDraggingPane ? 'animate-pulse' : ''
                              }`}
                            />
                          </button>
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
            ) : (
              <div className="w-full flex flex-col">
            <ChatMessages
              key={`messages-${forceUpdate}`}
              activeTab={activeTab}
              darkMode={userSettings.darkMode}
              onEditMessage={handleEditMessage}
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
            )}
          </div>
        </div>
      </div>
  );
};

export default Chat;
