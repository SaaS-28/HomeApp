import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  Image,
  useColorScheme 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  primary: string;
  gray: string;
  itemRowBg: string;
}

interface DuplicateCandidate {
  id: string;
  title: string;
  location: string;
  quantity: number;
  description: string;
  images: string[];
}

interface DuplicatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  duplicateCandidates: DuplicateCandidate[];
  duplicateContextMode: 'create' | 'move' | 'reassign' | null;
  duplicateContextNewQuantity: number;
  onCandidatePress: (candidate: DuplicateCandidate) => void;
  onCancel: () => void;
}

// ============================================
// THEME CONFIGURATION
// ============================================
const Colors: Record<'light' | 'dark', ThemeColors> = {
  light: {
    background: '#ffffff',
    card: '#f9f9f9',
    text: '#333333',
    textSecondary: '#666666',
    border: '#e0e0e0',
    primary: '#007AFF',
    gray: '#999999',
    itemRowBg: '#f5f5f5',
  },
  dark: {
    background: '#1e1e1e',
    card: '#2a2a2a',
    text: '#ffffff',
    textSecondary: '#b0b0b0',
    border: '#333333',
    primary: '#0A84FF',
    gray: '#666666',
    itemRowBg: '#252525',
  }
};

// ============================================
// DUPLICATE PICKER MODAL COMPONENT
// ============================================
const DuplicatePickerModal: React.FC<DuplicatePickerModalProps> = ({ 
  visible, 
  onClose,
  duplicateCandidates,
  duplicateContextMode,
  duplicateContextNewQuantity,
  onCandidatePress,
  onCancel
}) => {
  // Theme Management
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreference] = useState<ThemePreference>('auto');
  
  const isDarkMode = themePreference === 'auto' 
    ? systemColorScheme === 'dark' 
    : themePreference === 'dark';
  
  const theme: ThemeColors = isDarkMode ? Colors.dark : Colors.light;

  // Load theme preference
  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async (): Promise<void> => {
    try {
      const saved = await AsyncStorage.getItem('themePreference');
      if (saved && (saved === 'auto' || saved === 'light' || saved === 'dark')) {
        setThemePreference(saved as ThemePreference);
      }
    } catch (error) {
      console.log('Errore caricamento tema:', error);
    }
  };

  // ============================================
  // DYNAMIC STYLES
  // ============================================
  const dynamicStyles = {
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    contentContainer: {
      padding: 20,
      flex: 1,
    },
    title: {
      fontSize: 18,
      fontWeight: 'bold' as const,
      marginBottom: 12,
      color: theme.text,
    },
    subtitle: {
      marginBottom: 8,
      color: theme.textSecondary,
      lineHeight: 20,
    },
    scrollView: {
      flex: 1,
      marginBottom: 12,
    },
    emptyText: {
      color: theme.textSecondary,
      textAlign: 'center' as const,
      marginTop: 20,
    },
    itemRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      backgroundColor: theme.itemRowBg,
      padding: 12,
      borderRadius: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    itemImage: {
      width: 48,
      height: 48,
      borderRadius: 6,
      marginRight: 12,
      backgroundColor: theme.card,
    },
    itemContent: {
      flex: 1,
    },
    itemTitle: {
      fontWeight: 'bold' as const,
      color: theme.text,
      marginBottom: 4,
    },
    itemSubtitle: {
      color: theme.textSecondary,
      fontSize: 13,
      marginBottom: 2,
    },
    itemDescription: {
      color: theme.textSecondary,
      fontSize: 12,
    },
    buttonContainer: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      marginTop: 8,
    },
    cancelButton: {
      backgroundColor: theme.gray,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      minWidth: 100,
      alignItems: 'center' as const,
    },
    cancelButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600' as const,
    },
  };

  const getSubtitleText = (): string => {
    if (duplicateContextMode === 'create') {
      return `Seleziona l'oggetto a cui aggiungere la quantità (${duplicateContextNewQuantity})`;
    } else if (duplicateContextMode === 'move') {
      return `Seleziona l'oggetto nel target su cui aggregare lo spostamento`;
    } else if (duplicateContextMode === 'reassign') {
      return `Seleziona l'oggetto su cui riassegnare`;
    }
    return '';
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={dynamicStyles.container}>
        <View style={dynamicStyles.contentContainer}>
          <Text style={dynamicStyles.title}>
            Scegli oggetto esistente
          </Text>
          
          <Text style={dynamicStyles.subtitle}>
            {getSubtitleText()}
          </Text>

          <ScrollView style={dynamicStyles.scrollView}>
            {duplicateCandidates.length === 0 ? (
              <Text style={dynamicStyles.emptyText}>Nessun candidato trovato.</Text>
            ) : (
              duplicateCandidates.map(candidate => (
                <TouchableOpacity 
                  key={candidate.id} 
                  style={dynamicStyles.itemRow} 
                  onPress={() => onCandidatePress(candidate)}
                  activeOpacity={0.7}
                >
                  {candidate.images && candidate.images.length > 0 && (
                    <Image 
                      source={{ uri: candidate.images[0] }} 
                      style={dynamicStyles.itemImage}
                    />
                  )}
                  <View style={dynamicStyles.itemContent}>
                    <Text style={dynamicStyles.itemTitle}>{candidate.title}</Text>
                    <Text style={dynamicStyles.itemSubtitle}>
                      Ubicazione: {candidate.location} — Qta: {candidate.quantity}
                    </Text>
                    <Text 
                      style={dynamicStyles.itemDescription}
                      numberOfLines={1} 
                      ellipsizeMode="tail"
                    >
                      {candidate.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          <View style={dynamicStyles.buttonContainer}>
            <TouchableOpacity 
              style={dynamicStyles.cancelButton}
              onPress={onCancel}
              activeOpacity={0.8}
            >
              <Text style={dynamicStyles.cancelButtonText}>Annulla</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default DuplicatePickerModal;