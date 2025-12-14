import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Animated,
  Dimensions
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

const screenWidth = Dimensions.get('window').width;

// ============================================
// TYPES
// ============================================
interface ThemeColors {
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  border: string;
  borderLight: string;
  primary: string;
  success: string;
  successDark: string;
  gray: string;
  inputBg: string;
  inputBorder: string;
  placeholder: string;
  chipBg: string;
  chipActiveBg: string;
  chipActiveText: string;
  checkbox: string;
  checkboxChecked: string;
}

interface Item {
  id: string;
  title: string;
  quantity: number;
  location: string;
}

interface LocationManagerModalProps {
  visible: boolean;
  onClose: () => void;
  locations: string[];
  items: Item[];
  openedFrom: 'button' | 'itemModal';
  addingLocationInMgr: boolean;
  setAddingLocationInMgr: (value: boolean) => void;
  newLocationNameInMgr: string;
  setNewLocationNameInMgr: (value: string) => void;
  addLocationInMgr: () => void;
  editingLocationInMgr: string | null;
  setEditingLocationInMgr: (value: string | null) => void;
  editingLocationNewNameInMgr: string;
  setEditingLocationNewNameInMgr: (value: string) => void;
  confirmRenameLocationInMgr: () => void;
  confirmAndDeleteLocation: (location: string) => void;
  selectedLocationForMgr: string | null;
  setSelectedLocationForMgr: (value: string | null) => void;
  mgrSelectedItemIds: string[];
  setMgrSelectedItemIds: (ids: string[]) => void;
  toggleMgrSelectItem: (id: string) => void;
  mgrTargetLocation: string | null;
  setMgrTargetLocation: (value: string | null) => void;
  reassignMgrItems: () => void;
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
    success: '#34C759',
    successDark: '#28a745',
    gray: '#999999',
    inputBg: '#ffffff',
    inputBorder: '#ddd',
    placeholder: '#999',
    chipBg: '#e8e8e8',
    chipActiveBg: '#34C759',
    chipActiveText: '#ffffff',
    checkbox: '#ddd',
    checkboxChecked: '#34C759',
  },
  dark: {
    background: '#121212',
    card: '#1e1e1e',
    text: '#ffffff',
    textSecondary: '#b0b0b0',
    border: '#333333',
    borderLight: '#2a2a2a',
    primary: '#0A84FF',
    success: '#32D74B',
    successDark: '#30D158',
    gray: '#666666',
    inputBg: '#2a2a2a',
    inputBorder: '#444',
    placeholder: '#666',
    chipBg: '#2a2a2a',
    chipActiveBg: '#32D74B',
    chipActiveText: '#000000',
    checkbox: '#444',
    checkboxChecked: '#32D74B',
  }
};

// ============================================
// LOCATION MANAGER MODAL COMPONENT
// ============================================
const LocationManagerModal: React.FC<LocationManagerModalProps> = ({ 
  visible,
  onClose,
  locations,
  items,
  openedFrom,
  addingLocationInMgr,
  setAddingLocationInMgr,
  newLocationNameInMgr,
  setNewLocationNameInMgr,
  addLocationInMgr,
  editingLocationInMgr,
  setEditingLocationInMgr,
  editingLocationNewNameInMgr,
  setEditingLocationNewNameInMgr,
  confirmRenameLocationInMgr,
  confirmAndDeleteLocation,
  selectedLocationForMgr,
  setSelectedLocationForMgr,
  mgrSelectedItemIds,
  setMgrSelectedItemIds,
  toggleMgrSelectItem,
  mgrTargetLocation,
  setMgrTargetLocation,
  reassignMgrItems
}) => {
  // Using ThemeContext
  const { themePreference, systemScheme } = useTheme();

  // Check if dark mode is active
  const isDarkMode = themePreference === 'auto' 
    ? systemScheme === 'dark' 
    : themePreference === 'dark';
  
  const theme: ThemeColors = isDarkMode ? Colors.dark : Colors.light;

  const slideAnim = useRef(new Animated.Value(screenWidth)).current;

  useEffect(() => {
    if (openedFrom === 'itemModal') {
      if (visible) {
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      } else {
        Animated.timing(slideAnim, {
          toValue: screenWidth,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    }
  }, [visible, openedFrom]);

    const handleClose = () => {
    if (openedFrom === 'itemModal') {
      // Animate slide out
      Animated.timing(slideAnim, {
        toValue: screenWidth,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        onClose(); // Caall onClose after animation completes
      });
    } else {
      // If opened from button, just close normally
      onClose();
    }
  };

  // Reset state when modal is opened
  React.useEffect(() => {
    if (visible) {
      setSelectedLocationForMgr(null);
      setMgrSelectedItemIds([]);
      setMgrTargetLocation(null);
    }
  }, [visible]);

  // Handle location selection for item reassignment
  const handleLocationSelect = (loc: string) => {
    if (selectedLocationForMgr === loc) {
      // Deselect location
      setSelectedLocationForMgr(null);
      setMgrSelectedItemIds([]);
      setMgrTargetLocation(null);
    } else {
      // Select new location
      setSelectedLocationForMgr(loc);
      setMgrSelectedItemIds([]);
      setMgrTargetLocation(null);
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
      backgroundColor: theme.success,
      borderRadius: 2,
    },
    sectionCard: {
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
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700' as const,
      color: theme.text,
      marginBottom: 4,
    },
    addButton: {
      backgroundColor: theme.success,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 6,
    },
    addButtonText: {
      color: '#fff',
      fontWeight: 'bold' as const,
      fontSize: 14,
    },
    modalInput: {
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 8,
      padding: 12,
      marginBottom: 10,
      fontSize: 16,
      color: theme.text,
    },
    button: {
      backgroundColor: theme.primary,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: 'center' as const,
    },
    buttonText: {
      color: '#ffffff',
      fontWeight: '600' as const,
      fontSize: 15,
    },
    buttonGray: {
      backgroundColor: theme.gray,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: 'center' as const,
    },
    emptyText: {
      color: theme.textSecondary,
      fontStyle: 'italic' as const,
      paddingVertical: 20,
      textAlign: 'center' as const,
    },
    locationItemRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    iconBtn: {
      padding: 8,
      marginLeft: 8,
    },
    locationChip: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: theme.chipBg,
      marginRight: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    locationChipActive: {
      backgroundColor: theme.chipActiveBg,
      borderColor: theme.chipActiveBg,
    },
    locationChipSmall: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: theme.chipBg,
      marginRight: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    mgrItemRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: theme.checkbox,
      marginRight: 12,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    checkboxChecked: {
      width: 16,
      height: 16,
      borderRadius: 2,
      backgroundColor: theme.checkboxChecked,
    },
    reassignBtn: {
      backgroundColor: theme.success,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center' as const,
    },
    reassignBtnText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600' as const,
    },
    closeButton: {
      backgroundColor: theme.primary,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center' as const,
      marginTop: 20,
    },
    closeButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600' as const,
    },
    sectionLabel: {
      marginBottom: 8,
      fontWeight: '600' as const,
      color: theme.text,
      fontSize: 15,
    },
  };

  const content = (
    <SafeAreaView style={dynamicStyles.container}>
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
      >
        {/* Header */}
        <View style={dynamicStyles.header}>
          <Text style={dynamicStyles.headerTitle}>Gestione Ubicazioni</Text>
          <View style={dynamicStyles.headerUnderline} />
        </View>

        {/* List all locations */}
        <View style={dynamicStyles.sectionCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
            <Text style={dynamicStyles.sectionTitle}>Tutte le ubicazioni ({locations.length})</Text>
            {!addingLocationInMgr && (
              <TouchableOpacity 
                style={dynamicStyles.addButton}
                onPress={() => setAddingLocationInMgr(true)}
              >
                <Text style={dynamicStyles.addButtonText}>+ Aggiungi</Text>
              </TouchableOpacity>
            )}
          </View>

          {addingLocationInMgr && (
            <View style={{ marginBottom: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <TextInput
                placeholder="Nome ubicazione"
                placeholderTextColor={theme.placeholder}
                value={newLocationNameInMgr}
                onChangeText={setNewLocationNameInMgr}
                style={dynamicStyles.modalInput}
                autoFocus
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <TouchableOpacity 
                  style={[dynamicStyles.button, { flex: 1, marginRight: 5 }]}
                  onPress={addLocationInMgr}
                >
                  <Text style={dynamicStyles.buttonText}>Aggiungi</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[dynamicStyles.buttonGray, { flex: 1, marginLeft: 5 }]}
                  onPress={() => {
                    setAddingLocationInMgr(false);
                    setNewLocationNameInMgr('');
                  }}
                >
                  <Text style={dynamicStyles.buttonText}>Annulla</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {locations.length === 0 ? (
            <Text style={dynamicStyles.emptyText}>
              Nessuna ubicazione presente. Creane una con il pulsante + Aggiungi.
            </Text>
          ) : (
            locations.map(loc => (
              <View key={loc} style={dynamicStyles.locationItemRow}>
                {editingLocationInMgr === loc ? (
                  <View style={{ flex: 1 }}>
                    <TextInput
                      value={editingLocationNewNameInMgr}
                      onChangeText={setEditingLocationNewNameInMgr}
                      style={[dynamicStyles.modalInput, { marginBottom: 10 }]}
                      autoFocus
                      placeholderTextColor={theme.placeholder}
                    />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <TouchableOpacity 
                        style={[dynamicStyles.button, { flex: 1, marginRight: 5 }]}
                        onPress={confirmRenameLocationInMgr}
                      >
                        <Text style={dynamicStyles.buttonText}>Salva</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[dynamicStyles.buttonGray, { flex: 1, marginLeft: 5 }]}
                        onPress={() => {
                          setEditingLocationInMgr(null);
                          setEditingLocationNewNameInMgr('');
                        }}
                      >
                        <Text style={dynamicStyles.buttonText}>Annulla</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <>
                    <Text style={{ flex: 1, fontSize: 16, fontWeight: '500', color: theme.text }}>{loc}</Text>
                    <TouchableOpacity 
                      style={dynamicStyles.iconBtn} 
                      onPress={() => {
                        setEditingLocationInMgr(loc);
                        setEditingLocationNewNameInMgr(loc);
                      }}
                    >
                      <Text style={{ fontSize: 18 }}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={dynamicStyles.iconBtn} 
                      onPress={() => confirmAndDeleteLocation(loc)}
                    >
                      <Text style={{ fontSize: 18 }}>🗑️</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ))
          )}
        </View>

        {/* Reassign items section */}
        <View style={dynamicStyles.sectionCard}>
          <Text style={dynamicStyles.sectionTitle}>Sposta oggetti tra ubicazioni</Text>
          
          <Text style={dynamicStyles.sectionLabel}>1. Seleziona ubicazione di origine:</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={{ marginBottom: 15 }}
          >
            {locations.map(loc => (
              <TouchableOpacity 
                key={loc} 
                style={[
                  dynamicStyles.locationChip, 
                  selectedLocationForMgr === loc && dynamicStyles.locationChipActive
                ]} 
                onPress={() => handleLocationSelect(loc)}
              >
                <Text style={{ color: selectedLocationForMgr === loc ? theme.chipActiveText : theme.text }}>
                  {loc}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Shows only if the locaation is selected */}
          {selectedLocationForMgr && (
            <>
              <Text style={dynamicStyles.sectionLabel}>
                2. Seleziona oggetti da spostare:
              </Text>
              <View style={{ maxHeight: 200, marginBottom: 15 }}>
                <ScrollView>
                  {items.filter(it => it.location === selectedLocationForMgr).length === 0 ? (
                    <Text style={{ fontStyle: 'italic', color: theme.textSecondary }}>
                      Nessun oggetto in questa ubicazione
                    </Text>
                  ) : (
                    items.filter(it => it.location === selectedLocationForMgr).map(it => (
                      <TouchableOpacity 
                        key={it.id} 
                        style={dynamicStyles.mgrItemRow} 
                        onPress={() => toggleMgrSelectItem(it.id)}
                      >
                        <View style={dynamicStyles.checkbox}>
                          {mgrSelectedItemIds.includes(it.id) && (
                            <View style={dynamicStyles.checkboxChecked} />
                          )}
                        </View>
                        <Text style={{ flex: 1, color: theme.text }}>{it.title} (qta: {it.quantity})</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </View>
            </>
          )}

          {/* Shows only if at least one object is being selected */}
          {mgrSelectedItemIds.length > 0 && (
            <>
              <Text style={dynamicStyles.sectionLabel}>
                3. Seleziona ubicazione di destinazione:
              </Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={{ marginBottom: 15 }}
              >
                {locations.filter(l => l !== selectedLocationForMgr).map(l => (
                  <TouchableOpacity 
                    key={l} 
                    style={[
                      dynamicStyles.locationChipSmall, 
                      mgrTargetLocation === l && dynamicStyles.locationChipActive
                    ]} 
                    onPress={() => setMgrTargetLocation(l)}
                  >
                    <Text style={{ color: mgrTargetLocation === l ? theme.chipActiveText : theme.text }}>
                      {l}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity 
                style={dynamicStyles.reassignBtn} 
                onPress={reassignMgrItems}
              >
                <Text style={dynamicStyles.reassignBtnText}>Sposta oggetti selezionati</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Close Button */}
        <TouchableOpacity 
          style={dynamicStyles.closeButton}
          onPress={handleClose}
        >
          <Text style={dynamicStyles.closeButtonText}>Chiudi</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )

  if (openedFrom === 'itemModal') {
    if (!visible) return null;
    
    return (
      <Animated.View 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: theme.background,
          transform: [{ translateX: slideAnim }],
          zIndex: 1000,
        }}
      >
        {content}
      </Animated.View>
    );
  }

  // Altrimenti usa il Modal wrapper normale
  return (
    <Modal 
      visible={visible} 
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={dynamicStyles.container}>
        {content}
      </View>
    </Modal>
  );
};

export default LocationManagerModal;