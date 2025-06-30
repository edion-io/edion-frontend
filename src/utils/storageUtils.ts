import { UserSettings, ChatHistoryItem } from '../types';

export const getUserSettingsFromStorage = (): UserSettings => {
  const storedSettings = localStorage.getItem('userSettings');
  if (storedSettings) {
    return JSON.parse(storedSettings);
  }
  return {
    fullName: 'Jane Smith',
    email: 'jane.smith@school.edu',
    profilePicture: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&q=80',
    darkMode: document.documentElement.classList.contains('dark'), // Get actual state from DOM
  };
};

/**
 * Gets chat history from localStorage and filters out any entries that don't have corresponding tab data
 */
export const getChatHistoryFromStorage = () => {
  try {
    const storedHistory = localStorage.getItem('chatHistory');
    const storedTabs = localStorage.getItem('chatTabs');
    
    if (!storedHistory) return [];
    
    const history = JSON.parse(storedHistory);
    
    // If there are no tabs, return empty history
    if (!storedTabs) return [];
    
    const tabs = JSON.parse(storedTabs);
    
    // Filter history to only include items with corresponding tab data
    const validHistory = history.filter((historyItem) => {
      return tabs.some(tab => tab.id === historyItem.id);
    });
    
    // If the filtered history is different from the original, update localStorage
    if (validHistory.length !== history.length) {
      localStorage.setItem('chatHistory', JSON.stringify(validHistory));
    }
    
    return validHistory;
  } catch (error) {
    console.error('Failed to parse chat history:', error);
    return [];
  }
};

export const updateUserSettings = (newSettings: UserSettings): void => {
  console.log(newSettings);
  // Save to localStorage
  localStorage.setItem('userSettings', JSON.stringify(newSettings));
  
  // Disable transitions before theme change
  document.documentElement.classList.add('disable-transitions');
  
  // Update dark mode in the DOM
  if (newSettings.darkMode) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  
  // Dispatch storage event for other components to update
  window.dispatchEvent(new Event('storage'));
  
  // Dispatch theme change event with more details
  window.dispatchEvent(new CustomEvent('themeChanged', { 
    detail: { 
      darkMode: newSettings.darkMode, 
      timestamp: Date.now(),
      source: 'storageUtils'
    }
  }));
  
  // Re-enable transitions after a small delay
  setTimeout(() => {
    document.documentElement.classList.remove('disable-transitions');
  }, 50);
};
