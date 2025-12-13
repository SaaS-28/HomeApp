// src/screens/SettingsScreen.tsx
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Switch, Alert, SafeAreaView, ScrollView } from 'react-native';
import { useTheme } from '../contexts/ThemeContext'; // Import the ThemeContext

// ============================================
// TYPES
// ============================================
type ThemePreference = 'auto' | 'light' | 'dark';

interface ThemeColors {
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  border: string;
  borderLight: string;
  primary: string;
  primaryLight: string;
  success: string;
  successLight: string;
  danger: string;
  dangerDark: string;
  dangerLight: string;
  purple: string;
  footer: string;
}

/* Props for SettingsModal component */
interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  debugMode: boolean;
  setDebugMode: (value: boolean) => void;
  exportDatabase: () => void;
  importDatabase: () => void;
  deleteAllData: () => void;
}

// ============================================
// THEME CONFIGURATION
// ============================================
const Colors: Record<'light' | 'dark', ThemeColors> = {
  light: {
    background: '#f5f5f5',
    card: '#ffffff',
    text: '#333333',
    textSecondary: '#666666',
    border: '#e0e0e0',
    borderLight: '#f0f0f0',
    primary: '#007AFF',
    primaryLight: '#E3F2FD',
    success: '#4CAF50',
    successLight: '#81C784',
    danger: '#d32f2f',
    dangerDark: '#c62828',
    dangerLight: '#FFEBEE',
    purple: '#F3E5F5',
    footer: '#999999',
  },
  dark: {
    background: '#121212',
    card: '#1e1e1e',
    text: '#ffffff',
    textSecondary: '#b0b0b0',
    border: '#333333',
    borderLight: '#2a2a2a',
    primary: '#0A84FF',
    primaryLight: '#1a3a52',
    success: '#66BB6A',
    successLight: '#4CAF50',
    danger: '#ef5350',
    dangerDark: '#e53935',
    dangerLight: '#3d1f1f',
    purple: '#3d2f3f',
    footer: '#666666',
  }
};

// ============================================
// SETTINGS MODAL COMPONENT (using ThemeContext)
// ============================================
const SettingsModal: React.FC<SettingsModalProps> = ({ 
  visible, 
  onClose, 
  debugMode, 
  setDebugMode,
  exportDatabase,
  importDatabase,
  deleteAllData 
}) => {
  // Using ThemeContext
  const { themePreference, setThemePreference, systemScheme } = useTheme();

  // Check if dark mode is active
  const isDarkMode = themePreference === 'auto' 
    ? systemScheme === 'dark' 
    : themePreference === 'dark';

  const theme = isDarkMode ? Colors.dark : Colors.light;

  // Dynamic styles
  const dynamicStyles = {
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      marginBottom: 30,
      alignItems: 'center' as const,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold' as const,
      color: theme.text,
      marginBottom: 8,
    },
    headerUnderline: {
      width: 60,
      height: 4,
      backgroundColor: theme.primary,
      borderRadius: 2,
    },
    settingsCard: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDarkMode ? 0.3 : 0.1,
      shadowRadius: 8,
      elevation: 3,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '600' as const,
      color: theme.text,
      marginBottom: 4,
    },
    cardSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 20,
    },
    cardNote: {
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    sectionHeader: {
      fontSize: 14,
      fontWeight: '700' as const,
      color: theme.textSecondary,
      textTransform: 'uppercase' as const,
      letterSpacing: 1,
      marginTop: 20,
      marginBottom: 12,
      marginLeft: 4,
    },
    settingsButton: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDarkMode ? 0.3 : 0.1,
      shadowRadius: 8,
      elevation: 3,
    },
    buttonIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      marginRight: 16,
    },
    buttonTitle: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: theme.text,
      marginBottom: 2,
    },
    buttonSubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    dangerButton: {
      borderWidth: 1,
      borderColor: theme.danger,
    },
    closeButton: {
      backgroundColor: theme.primary,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center' as const,
      marginTop: 10,
    },
    closeButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600' as const,
    },
    footer: {
      marginTop: 40,
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      alignItems: 'center' as const,
    },
    footerText: {
      color: theme.footer,
      fontSize: 12,
    },
    themeOption: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      marginBottom: 8,
    },
    themeOptionSelected: {
      backgroundColor: theme.primaryLight,
    },
    themeOptionText: {
      fontSize: 16,
      color: theme.text,
      marginLeft: 12,
      flex: 1,
    },
  };

  // When the user selects a theme option --> update the context
  const onSelectTheme = async (pref: ThemePreference) => {
    await setThemePreference(pref);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={dynamicStyles.container}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          {/* Header */}
          <View style={dynamicStyles.header}>
            <Text style={dynamicStyles.headerTitle}>Impostazioni</Text>
            <View style={dynamicStyles.headerUnderline} />
          </View>

          {/* Debug Mode Card */}
          <View style={dynamicStyles.settingsCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={dynamicStyles.cardTitle}>Modalità Debug</Text>
                <Text style={dynamicStyles.cardSubtitle}>
                  Visualizza info avanzate sulle immagini
                </Text>
              </View>
              <Switch 
                value={debugMode} 
                onValueChange={(v) => { 
                  setDebugMode(v); 
                  if (v) Alert.alert('Debug', 'Modalità debug abilitata. Tieni premuta un\'immagine per 2s per azioni di debug.'); 
                }}
                trackColor={{ false: isDarkMode ? '#555' : '#ddd', true: theme.successLight }}
                thumbColor={debugMode ? theme.success : (isDarkMode ? '#888' : '#f4f3f4')}
                style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
              />
            </View>
            <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.borderLight }}>
              <Text style={dynamicStyles.cardNote}>
                💡 Premi a lungo (2s) sulle immagini per azioni di debug
              </Text>
            </View>
          </View>

          {/* Theme Section */}
          <View style={dynamicStyles.settingsCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={dynamicStyles.cardTitle}>Tema Applicazione</Text>
                <Text style={dynamicStyles.cardSubtitle}>
                  {themePreference === 'auto' ? 'Segue il sistema' : 
                   themePreference === 'dark' ? 'Modalità scura attiva' : 
                   'Modalità chiara attiva'}
                </Text>
              </View>
              <Text style={{ fontSize: 28 }}>{isDarkMode ? '🌙' : '☀️'}</Text>
            </View>

            <TouchableOpacity 
              style={[
                dynamicStyles.themeOption, 
                themePreference === 'auto' && dynamicStyles.themeOptionSelected
              ]}
              onPress={() => onSelectTheme('auto')}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 20 }}>🔄</Text>
              <Text style={dynamicStyles.themeOptionText}>Automatico (Sistema)</Text>
              {themePreference === 'auto' && <Text style={{ fontSize: 20, color: theme.primary }}>✓</Text>}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                dynamicStyles.themeOption, 
                themePreference === 'light' && dynamicStyles.themeOptionSelected
              ]}
              onPress={() => onSelectTheme('light')}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 20 }}>☀️</Text>
              <Text style={dynamicStyles.themeOptionText}>Chiaro</Text>
              {themePreference === 'light' && <Text style={{ fontSize: 20, color: theme.primary }}>✓</Text>}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                dynamicStyles.themeOption, 
                themePreference === 'dark' && dynamicStyles.themeOptionSelected
              ]}
              onPress={() => onSelectTheme('dark')}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 20 }}>🌙</Text>
              <Text style={dynamicStyles.themeOptionText}>Scuro</Text>
              {themePreference === 'dark' && <Text style={{ fontSize: 20, color: theme.primary }}>✓</Text>}
            </TouchableOpacity>
          </View>

          {/* Database Section */}
          <Text style={dynamicStyles.sectionHeader}>Database</Text>

          <TouchableOpacity 
            style={dynamicStyles.settingsButton} 
            onPress={exportDatabase}
            activeOpacity={0.7}
          >
            <View style={[dynamicStyles.buttonIcon, { backgroundColor: theme.primaryLight }]}>
              <Text style={{ fontSize: 24 }}>📤</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={dynamicStyles.buttonTitle}>Esporta Database</Text>
              <Text style={dynamicStyles.buttonSubtitle}>Salva inventario e immagini in JSON</Text>
            </View>
            <Text style={{ fontSize: 20, color: theme.textSecondary }}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={dynamicStyles.settingsButton} 
            onPress={importDatabase}
            activeOpacity={0.7}
          >
            <View style={[dynamicStyles.buttonIcon, { backgroundColor: theme.purple }]}>
              <Text style={{ fontSize: 24 }}>📥</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={dynamicStyles.buttonTitle}>Importa Database</Text>
              <Text style={dynamicStyles.buttonSubtitle}>Ripristina da file JSON</Text>
            </View>
            <Text style={{ fontSize: 20, color: theme.textSecondary }}>›</Text>
          </TouchableOpacity>

          {/* Danger Zone */}
          <Text style={[dynamicStyles.sectionHeader, { color: theme.danger }]}>Zona Pericolo</Text>

          <TouchableOpacity 
            style={[dynamicStyles.settingsButton, dynamicStyles.dangerButton]} 
            onPress={deleteAllData}
            activeOpacity={0.7}
          >
            <View style={[dynamicStyles.buttonIcon, { backgroundColor: theme.dangerLight }]}>
              <Text style={{ fontSize: 24 }}>🗑️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[dynamicStyles.buttonTitle, { color: theme.danger }]}>Elimina Tutto</Text>
              <Text style={[dynamicStyles.buttonSubtitle, { color: theme.dangerDark }]}>
                Cancella oggetti, immagini e ubicazioni
              </Text>
            </View>
            <Text style={{ fontSize: 20, color: theme.danger }}>›</Text>
          </TouchableOpacity>

          {/* Footer */}
          <View style={dynamicStyles.footer}>
            <Text style={dynamicStyles.footerText}>CasaApp v1.0</Text>
          </View>

          <View style={{ marginTop: 20 }}>
            <TouchableOpacity 
              style={dynamicStyles.closeButton}
              onPress={onClose}
            >
              <Text style={dynamicStyles.closeButtonText}>Chiudi</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

export default SettingsModal;
