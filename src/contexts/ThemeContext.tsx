// src/contexts/ThemeContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

type ThemePref = 'auto' | 'light' | 'dark';

type ThemeContextType = {
  themePreference: ThemePref;
  setThemePreference: (p: ThemePref) => Promise<void>;
  systemScheme: 'light' | 'dark';
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themePreference, setThemePreferenceState] = useState<ThemePref>('auto');
  const [systemScheme, setSystemScheme] = useState<'light' | 'dark'>(() =>
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'
  );

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('themePreference');
        if (saved === 'auto' || saved === 'light' || saved === 'dark') {
          setThemePreferenceState(saved);
        }
      } catch (e) {
        console.warn('ThemeContext: errore caricamento preferenza', e);
      }
    })();

    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme === 'dark' ? 'dark' : 'light');
    });

    return () => {
      try {
        // In RN >= 0.65 remove() or subscription.remove()
        if (sub && typeof (sub as any).remove === 'function') (sub as any).remove();
      } catch {}
    };
  }, []);

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

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
};
