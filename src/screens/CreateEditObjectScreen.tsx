import React, { useState } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  Dimensions
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext'; // Import the ThemeContext

const screenWidth = Dimensions.get('window').width;

// ============================================
// TYPES
// ============================================
type AdjustmentMode = 'add' | 'remove' | null;

interface ThemeColors {
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  border: string;
  borderLight: string;
  primary: string;
  primaryLight: string;
  danger: string;
  dangerDark: string;
  dangerLight: string;
  inputBg: string;
  inputBorder: string;
  placeholder: string;
  dropdownBg: string;
  buttonSecondary: string;
  imageOverlay: string;
}

interface Item {
  id: string;
  title: string;
  quantity: number;
  description: string;
  location: string;
  images: string[];
}

interface ItemEditorModalProps {
  visible: boolean;
  onClose: () => void;
  editingItem: Item | null;
  newTitle: string;
  setNewTitle: (value: string) => void;
  newQuantity: string;
  setNewQuantity: (value: string) => void;
  newDescription: string;
  setNewDescription: (value: string) => void;
  newLocation: string;
  setNewLocation: (value: string) => void;
  newImages: string[];
  setNewImages: (images: string[]) => void;
  locations: string[];
  debugMode: boolean;
  adjustmentMode: AdjustmentMode;
  setAdjustmentMode: (mode: AdjustmentMode) => void;
  adjustmentValue: string;
  setAdjustmentValue: (value: string) => void;
  handleConfirmAdjustment: () => void;
  confirmAndSaveItem: () => void;
  confirmCancel: () => void;
  confirmAndDeleteItem: (id: string) => void;
  resetModal: () => void;
  openImagePicker: () => void;
  confirmAndRemoveImage: (uri: string) => void;
  showImageDebugActions: (uri: string) => void;
  onGoToLocationManager: () => void;
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
    danger: '#d32f2f',
    dangerDark: '#c62828',
    dangerLight: '#FFEBEE',
    inputBg: '#ffffff',
    inputBorder: '#ddd',
    placeholder: '#999',
    dropdownBg: '#ffffff',
    buttonSecondary: '#f0f0f0',
    imageOverlay: 'rgba(0,0,0,0.9)',
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
    danger: '#ef5350',
    dangerDark: '#e53935',
    dangerLight: '#3d1f1f',
    inputBg: '#2a2a2a',
    inputBorder: '#444',
    placeholder: '#666',
    dropdownBg: '#2a2a2a',
    buttonSecondary: '#2a2a2a',
    imageOverlay: 'rgba(0,0,0,0.95)',
  }
};

// ============================================
// ITEM EDITOR MODAL COMPONENT
// ============================================
const ItemEditorModal: React.FC<ItemEditorModalProps> = ({ 
  visible,
  onClose,
  editingItem,
  newTitle,
  setNewTitle,
  newQuantity,
  setNewQuantity,
  newDescription,
  setNewDescription,
  newLocation,
  setNewLocation,
  newImages,
  setNewImages,
  locations,
  debugMode,
  adjustmentMode,
  setAdjustmentMode,
  adjustmentValue,
  setAdjustmentValue,
  handleConfirmAdjustment,
  confirmAndSaveItem,
  confirmCancel,
  confirmAndDeleteItem,
  resetModal,
  openImagePicker,
  confirmAndRemoveImage,
  showImageDebugActions,
  onGoToLocationManager
}) => {
  // Using ThemeContext
  const { themePreference, systemScheme } = useTheme();
  
  // Local state for UI
  const [locationDropdownVisible, setLocationDropdownVisible] = useState(false);
  const [imageToView, setImageToView] = useState<string | null>(null);
  
  // Check if dark mode is active
  const isDarkMode = themePreference === 'auto' 
    ? systemScheme === 'dark' 
    : themePreference === 'dark';
  
  const theme: ThemeColors = isDarkMode ? Colors.dark : Colors.light;

  // Calcola larghezza immagine con padding
  const cardPadding = 40; // 20px per lato della card
  const imageWidth = screenWidth - cardPadding; // larghezza piena disponibile

  // ============================================
  // DYNAMIC STYLES
  // ============================================
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
    formCard: {
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
    formSectionTitle: {
      fontSize: 16,
      fontWeight: '700' as const,
      color: theme.text,
      marginBottom: 12,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
    },
    formInput: {
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 10,
      padding: 14,
      marginBottom: 12,
      fontSize: 16,
      color: theme.text,
    },
    adjustButtonLarge: {
      flex: 1,
      backgroundColor: theme.buttonSecondary,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderWidth: 2,
      borderColor: theme.border,
    },
    adjustButtonLargeActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    adjustButtonLargeText: {
      fontSize: 14,
      fontWeight: '600' as const,
      color: theme.text,
    },
    adjConfirmBtn: {
      backgroundColor: '#4CAF50',
      width: 44,
      height: 44,
      borderRadius: 10,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    adjConfirmBtnText: {
      color: '#fff',
      fontSize: 20,
      fontWeight: 'bold' as const,
    },
    adjCancelBtn: {
      backgroundColor: theme.danger,
      width: 44,
      height: 44,
      borderRadius: 10,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    adjCancelBtnText: {
      color: '#fff',
      fontSize: 20,
      fontWeight: 'bold' as const,
    },
    dropdownButtonLarge: {
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 10,
      padding: 14,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
    },
    dropdownListLarge: {
      backgroundColor: theme.dropdownBg,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 10,
      marginTop: 8,
      maxHeight: 200,
    },
    dropdownItemLarge: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    dropdownItemSelectedLarge: {
      backgroundColor: theme.primaryLight,
    },
    imageRemoveBtn: {
      position: 'absolute' as const,
      top: 8,
      right: 8,
      backgroundColor: theme.danger,
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      zIndex: 10,
    },
    imageRemoveBtnText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold' as const,
    },
    imageAddBtn: {
      height: 200,
      backgroundColor: theme.primary,
      borderRadius: 12,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    primaryButton: {
      backgroundColor: theme.primary,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center' as const,
    },
    primaryButtonText: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: '600' as const,
    },
    secondaryButton: {
      backgroundColor: theme.buttonSecondary,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center' as const,
      borderWidth: 1,
      borderColor: theme.border,
    },
    secondaryButtonText: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '600' as const,
    },
    dangerButton: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 16,
      marginTop: 10,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      borderWidth: 1,
      borderColor: theme.danger,
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
      marginBottom: 2,
    },
    buttonSubtitle: {
      fontSize: 13,
    },
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={dynamicStyles.container}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={{ flex: 1 }}
        >
          <ScrollView 
            contentContainerStyle={{ padding: 20, paddingBottom: 200 }} 
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={dynamicStyles.header}>
              <Text style={dynamicStyles.headerTitle}>
                {editingItem ? 'Modifica Oggetto' : 'Nuovo Oggetto'}
              </Text>
              <View style={dynamicStyles.headerUnderline} />
            </View>

            {/* Info Section */}
            <View style={dynamicStyles.formCard}>
              <Text style={dynamicStyles.formSectionTitle}>Informazioni Base</Text>
              
              <TextInput 
                placeholder="Titolo" 
                value={newTitle} 
                onChangeText={setNewTitle} 
                style={dynamicStyles.formInput} 
                placeholderTextColor={theme.placeholder}
              />
              
              <TextInput 
                placeholder="Quantità" 
                value={newQuantity} 
                onChangeText={(text) => {
                  const numValue = parseInt(text, 10);
                  if (text === '' || (numValue >= 0 && !isNaN(numValue))) {
                    setNewQuantity(text);
                  }
                }} 
                style={dynamicStyles.formInput} 
                keyboardType="numeric"
                placeholderTextColor={theme.placeholder}
              />

              <TextInput 
                placeholder="Descrizione" 
                value={newDescription} 
                onChangeText={setNewDescription} 
                style={[dynamicStyles.formInput, { height: 100, textAlignVertical: 'top' }]} 
                multiline 
                maxLength={500}
                placeholderTextColor={theme.placeholder}
              />
            </View>

            {/* Adjustment Section (edit only) */}
            {editingItem && (
              <View style={dynamicStyles.formCard}>
                <Text style={dynamicStyles.formSectionTitle}>Modifica Quantità</Text>
                <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                  <TouchableOpacity 
                    style={[
                      dynamicStyles.adjustButtonLarge, 
                      adjustmentMode === 'add' && dynamicStyles.adjustButtonLargeActive
                    ]} 
                    onPress={() => setAdjustmentMode(adjustmentMode === 'add' ? null : 'add')}
                  >
                    <Text style={{ fontSize: 20, marginBottom: 4 }}>➕</Text>
                    <Text style={[
                      dynamicStyles.adjustButtonLargeText, 
                      adjustmentMode === 'add' && { color: '#fff' }
                    ]}>
                      Aggiungi
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[
                      dynamicStyles.adjustButtonLarge, 
                      adjustmentMode === 'remove' && dynamicStyles.adjustButtonLargeActive,
                      { marginLeft: 10 }
                    ]} 
                    onPress={() => setAdjustmentMode(adjustmentMode === 'remove' ? null : 'remove')}
                  >
                    <Text style={{ fontSize: 20, marginBottom: 4 }}>➖</Text>
                    <Text style={[
                      dynamicStyles.adjustButtonLargeText, 
                      adjustmentMode === 'remove' && { color: '#fff' }
                    ]}>
                      Rimuovi
                    </Text>
                  </TouchableOpacity>
                </View>

                {adjustmentMode && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput 
                      placeholder={adjustmentMode === 'add' ? 'Aggiungi' : 'Rimuovi'} 
                      value={adjustmentValue} 
                      onChangeText={setAdjustmentValue} 
                      style={[dynamicStyles.formInput, { flex: 1, marginBottom: 0 }]} 
                      keyboardType="numeric"
                      placeholderTextColor={theme.placeholder}
                      maxLength={10}
                    />
                    <TouchableOpacity 
                      style={dynamicStyles.adjConfirmBtn}
                      onPress={handleConfirmAdjustment}
                    >
                      <Text style={dynamicStyles.adjConfirmBtnText}>✓</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={dynamicStyles.adjCancelBtn}
                      onPress={() => { 
                        setAdjustmentMode(null); 
                        setAdjustmentValue(''); 
                      }}
                    >
                      <Text style={dynamicStyles.adjCancelBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Location Section */}
            <View style={dynamicStyles.formCard}>
              <Text style={dynamicStyles.formSectionTitle}>Ubicazione</Text>
              <TouchableOpacity 
                style={dynamicStyles.dropdownButtonLarge} 
                onPress={() => setLocationDropdownVisible(!locationDropdownVisible)}
              >
                <Text style={{ flex: 1, fontSize: 16, color: newLocation ? theme.text : theme.placeholder }}>
                  {newLocation || 'Seleziona ubicazione'}
                </Text>
                <Text style={{ fontSize: 16, color: theme.primary }}>{locationDropdownVisible ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {locationDropdownVisible && (
                <View style={dynamicStyles.dropdownListLarge}>
                  <ScrollView style={{ maxHeight: 150 }}>
                    {locations.length === 0 ? (
                      <View style={{ padding: 16 }}>
                        <Text style={{ 
                          fontStyle: 'italic', 
                          color: theme.textSecondary,
                          marginBottom: 12,
                          textAlign: 'center'
                        }}>
                          Nessuna ubicazione disponibile
                        </Text>
                        <TouchableOpacity
                          style={{
                            backgroundColor: theme.primary,
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            borderRadius: 8,
                            alignItems: 'center'
                          }}
                          onPress={onGoToLocationManager}
                        >
                          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>
                            📍 Gestisci Ubicazioni
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      locations.map(loc => (
                        <TouchableOpacity 
                          key={loc} 
                          style={[
                            dynamicStyles.dropdownItemLarge,
                            newLocation === loc && dynamicStyles.dropdownItemSelectedLarge
                          ]} 
                          onPress={() => {
                            setNewLocation(loc);
                            setLocationDropdownVisible(false);
                          }}
                        >
                          <Text style={{ 
                            color: newLocation === loc ? theme.primary : theme.text,
                            fontWeight: newLocation === loc ? '600' : 'normal',
                            fontSize: 15
                          }}>
                            {loc}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Images Section */}
            <View style={dynamicStyles.formCard}>
              <Text style={dynamicStyles.formSectionTitle}>Immagini ({newImages.length}/5)</Text>
              <ScrollView 
                horizontal 
                pagingEnabled 
                showsHorizontalScrollIndicator={false}
                snapToInterval={screenWidth - 80}
                decelerationRate="fast"
                style={{ marginHorizontal: -20, marginBottom: -20 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
              >
                {newImages.map((uri, index) => (
                  <View 
                    key={uri} 
                    style={{ 
                      width: screenWidth - 80,
                      marginRight: index < newImages.length - 1 || newImages.length < 5 ? 10 : 0,
                      position: 'relative'
                    }}
                  >
                    <TouchableOpacity 
                      onPress={() => setImageToView(uri)} 
                      onLongPress={() => { if (debugMode) showImageDebugActions(uri); }} 
                      delayLongPress={2000}
                      activeOpacity={0.9}
                    >
                      <Image 
                        source={{ uri }} 
                        style={{ 
                          width: '100%', 
                          height: 200, 
                          borderRadius: 12, 
                          resizeMode: 'cover' 
                        }} 
                      />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={dynamicStyles.imageRemoveBtn} 
                      onPress={() => confirmAndRemoveImage(uri)}
                    >
                      <Text style={dynamicStyles.imageRemoveBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {newImages.length < 5 && (
                  <View style={{ width: screenWidth - 80 }}>
                    <TouchableOpacity 
                      style={{ 
                        width: '100%',
                        height: 200,
                        backgroundColor: theme.primary,
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }} 
                      onPress={openImagePicker}
                    >
                      <Text style={{ fontSize: 32, color: '#fff' }}>+</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            </View>

            {/* Action Buttons */}
            <View style={{ marginTop: 30, gap: 10 }}>
              {editingItem ? (
                <>
                  <TouchableOpacity 
                    style={dynamicStyles.primaryButton}
                    onPress={confirmAndSaveItem}
                    activeOpacity={0.85}
                  >
                    <Text style={dynamicStyles.primaryButtonText}>💾 Salva Modifiche</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={dynamicStyles.secondaryButton}
                    onPress={confirmCancel}
                    activeOpacity={0.85}
                  >
                    <Text style={dynamicStyles.secondaryButtonText}>Annulla</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={dynamicStyles.dangerButton} 
                    onPress={() => { 
                      if (editingItem) confirmAndDeleteItem(editingItem.id); 
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[dynamicStyles.buttonIcon, { backgroundColor: theme.dangerLight }]}>
                      <Text style={{ fontSize: 24 }}>🗑️</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[dynamicStyles.buttonTitle, { color: theme.danger }]}>Elimina Oggetto</Text>
                      <Text style={[dynamicStyles.buttonSubtitle, { color: theme.dangerDark }]}>
                        Rimuovi questo oggetto dall'inventario
                      </Text>
                    </View>
                    <Text style={{ fontSize: 20, color: theme.danger }}>›</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity 
                    style={dynamicStyles.primaryButton}
                    onPress={confirmAndSaveItem}
                    activeOpacity={0.85}
                  >
                    <Text style={dynamicStyles.primaryButtonText}>➕ Crea Oggetto</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={dynamicStyles.secondaryButton}
                    onPress={resetModal}
                    activeOpacity={0.85}
                  >
                    <Text style={dynamicStyles.secondaryButtonText}>Annulla</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {imageToView && (
              <View style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                right: 0, 
                bottom: 0, 
                backgroundColor: theme.imageOverlay, 
                justifyContent: 'center', 
                alignItems: 'center', 
                zIndex: 10 
              }}>
                <TouchableOpacity 
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} 
                  onPress={() => setImageToView(null)} 
                />
                <Image 
                  source={{ uri: imageToView }} 
                  style={{ width: '90%', aspectRatio: 1, resizeMode: 'contain' }} 
                />
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

export default ItemEditorModal;