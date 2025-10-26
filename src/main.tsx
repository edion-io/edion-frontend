import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Initialize theme from localStorage on app startup
const initializeTheme = () => {
  const storedSettings = localStorage.getItem('userSettings');
  let darkMode = false;
  
  if (storedSettings) {
    try {
      const settings = JSON.parse(storedSettings);
      darkMode = settings.darkMode;
    } catch (e) {
      console.error('Failed to parse user settings:', e);
    }
  } else {
    // Respect system preference on first run
    darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  
  // Apply theme immediately before render
  if (darkMode) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

// Initialize theme before rendering
initializeTheme();

createRoot(document.getElementById("root")!).render(<App />);
