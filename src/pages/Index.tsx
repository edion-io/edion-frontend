import { useEffect, useState, useRef } from 'react';
import Header from '../components/Header';
import Logo from '../components/Logo';
import Search from '../components/Search';
import ActionCards from '../components/ActionCards';
import MainContainer from '../components/MainContainer';
import { UserSettings } from '../types';
import { getUserSettingsFromStorage } from '../utils/storageUtils';

const Index = () => {
  const [userSettings, setUserSettings] = useState<UserSettings>(getUserSettingsFromStorage());
  const isInitialMount = useRef(true);
  const [forceUpdate, setForceUpdate] = useState(0);

  // Apply theme based on user settings
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

  // Smooth page transition effect on load
  useEffect(() => {
    document.body.style.opacity = '0';
    setTimeout(() => {
      document.body.style.transition = 'opacity 0.5s ease';
      document.body.style.opacity = '1';
    }, 100);
    
    return () => {
      document.body.style.opacity = '';
      document.body.style.transition = '';
    };
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header userSettings={userSettings} setUserSettings={setUserSettings} />
      
      <main className="flex-grow flex flex-col items-center justify-center px-4">
        <div className="mb-4">
          <Logo />
        </div>
        
        <MainContainer>
          <div className="space-y-6">
            <Search />
            <div className="pt-4">
              <ActionCards />
            </div>
          </div>
        </MainContainer>
      </main>
    </div>
  );
};

export default Index;
