// src/contexts/ThemeContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

type ThemePref = 'auto' | 'light' | 'dark';

/* Define the shape of the context */
type ThemeContextType = {
  themePreference: ThemePref;
  setThemePreference: (p: ThemePref) => Promise<void>;
  systemScheme: 'light' | 'dark';
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/* ThemeProvider component to wrap the app and provide theme context */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // State to hold theme preference and system scheme
  const [themePreference, setThemePreferenceState] = useState<ThemePref>('auto');
  const [systemScheme, setSystemScheme] = useState<'light' | 'dark'>(() =>
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'
  );

  useEffect(() => {
    (async () => {
      try {
        // Load saved theme preference from AsyncStorage
        const saved = await AsyncStorage.getItem('themePreference');
        if (saved === 'auto' || saved === 'light' || saved === 'dark') {
          setThemePreferenceState(saved);
        }
      } catch (e) {
        console.warn('ThemeContext: errore caricamento preferenza', e);
      }
    })();

    // Listen for system theme changes
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme === 'dark' ? 'dark' : 'light');
    });

    return () => {
      try {
        if (sub && typeof (sub as any).remove === 'function') (sub as any).remove(); // For newer RN versions
      } catch {}
    };
  }, []);

  // Function to update theme preference and save it to AsyncStorage
  const setThemePreference = async (p: ThemePref) => {
    try {
      await AsyncStorage.setItem('themePreference', p);
    } catch (e) {
      console.warn('ThemeContext: errore salvataggio preferenza', e);
    }

    setThemePreferenceState(p);
  };

  return (
    <ThemeContext.Provider value={{ themePreference, setThemePreference, systemScheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

/* Custom hook to use the ThemeContext */
export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
};
