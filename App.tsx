/* ===== REACT IMPORTS =====*/
import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, Text, View, TextInput, FlatList, Image, TouchableOpacity,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage'; // For persistent storage

/* ===== EXPO IMPORTS =====*/
import * as ImageManipulator from 'expo-image-manipulator'; // For image compression and manipulation
import * as FileSystem from 'expo-file-system/legacy'; // For file system operations
import * as DocumentPicker from 'expo-document-picker'; // For picking JSON files
import * as Sharing from 'expo-sharing'; // For sharing exported files

import * as ImagePicker from 'expo-image-picker'; // For image picking

/* ===== MY IMPORTS =====*/
import SettingsModal from './src/screens/SettingsScreen'; // Settings modal
import DuplicatePickerModal from './src/screens/DuplicateObjectsScreen'; // Duplicate selection modal
import ItemEditorModal from './src/screens/CreateEditObjectScreen'; // Create/Edit item modal
import LocationManagerModal from './src/screens/LocationManagerScreen'; // Location manager modal

import { useTheme, ThemeProvider } from './src/contexts/ThemeContext'; // Theme context

/* InventoryItem object & structure */
interface InventoryItem {
  id: string;
  title: string;
  images: string[];
  quantity: number;
  location: string;
  description: string;
}

function AppInner() {
  /* ===== THEME VARIABLES ===== */
  const { themePreference, systemScheme } = useTheme(); // 'light' | 'dark' | 'auto'
  const systemColorScheme = systemScheme; // 'light' | 'dark'

  // Determine if dark mode should be applied
  const isDarkMode = themePreference === 'auto' 
    ? systemColorScheme === 'dark' 
    : themePreference === 'dark';

  /* ===== SEARCH BAR VARIABLES ===== */
  const [searchQuery, setSearchQuery] = useState(''); // Search bar state
  const [items, setItems] = useState<InventoryItem[]>([]); // All inventory items
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]); // Filtered items based on search

  /* ===== CREATE/EDIT MODAL ===== */
  const [modalVisible, setModalVisible] = useState(false); // Create/Edit item modal visibility
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null); // Currently editing item

  const [newTitle, setNewTitle] = useState(''); // Title of new/editing item
  const [newQuantity, setNewQuantity] = useState(''); // Quantity of new/editing item
  const [newLocation, setNewLocation] = useState(''); // Location of new/editing item
  const [newDescription, setNewDescription] = useState(''); // Description of new/editing item
  const [newImages, setNewImages] = useState<string[]>([]); // Images of new/editing item

  const [locations, setLocations] = useState<string[]>([]); // All locations
  const [locationDropdownVisible, setLocationDropdownVisible] = useState(false); // Location dropdown state

  const [adjustmentMode, setAdjustmentMode] = useState<'add' | 'remove' | null>(null); // Quantity adjustment mode
  const [adjustmentValue, setAdjustmentValue] = useState(''); // Quantity adjustment value

  const [reassignQueue, setReassignQueue] = useState<string[]>([]); // Queue of item IDs to reassign
  const [reassignTarget, setReassignTarget] = useState<string | null>(null); // Target location for reassignment

  const [imageToView, setImageToView] = useState<string | null>(null); // Image viewer state
  const [originalSnapshot, setOriginalSnapshot] = useState<any>(null); // Snapshot of original item data for change detection

  const [shouldReopenItemModal, setShouldReopenItemModal] = useState(false); // Flag to reopen item modal after location manager
  const [locationMgrOpenedFrom, setLocationMgrOpenedFrom] = useState<'button' | 'itemModal'>('button'); // Context of location manager opening
  const [itemModalTemporarilyHidden, setItemModalTemporarilyHidden] = useState(false); // Flag for temporarily hiding item modal

  /* ===== REASSING QUANTITY MODAL ===== */
  const [duplicatePickerVisible, setDuplicatePickerVisible] = useState(false); // Duplicate picker modal visibility
  const [duplicateCandidates, setDuplicateCandidates] = useState<InventoryItem[]>([]); // Candidates for duplicate selection
  const [duplicateContextNewQuantity, setDuplicateContextNewQuantity] = useState(0); // New quantity for duplicate context
  const [duplicateContextMode, setDuplicateContextMode] = useState<'create'|'reassign'|null>(null); // Context mode
  const [duplicateContextMovingItemId, setDuplicateContextMovingItemId] = useState<string | null>(null); // Moving item ID for reassignment

  /* ===== LOCATION MANAGER MODAL ===== */
  const [locationMgrVisible, setLocationMgrVisible] = useState(false); // Location Manager modal visibility
  const [selectedLocationForMgr, setSelectedLocationForMgr] = useState<string | null>(null); // Selected location in Location Manager
  const [mgrSelectedItemIds, setMgrSelectedItemIds] = useState<string[]>([]); // Selected item IDs in Location Manager
  const [mgrTargetLocation, setMgrTargetLocation] = useState<string | null>(null); // Target location for reassignment
  
  const [addingLocationInMgr, setAddingLocationInMgr] = useState(false); // Adding new location state in Location Manager
  const [newLocationNameInMgr, setNewLocationNameInMgr] = useState(''); // New location name input in Location Manager
  const [editingLocationInMgr, setEditingLocationInMgr] = useState<string | null>(null); // Location being edited in Location Manager
  const [editingLocationNewNameInMgr, setEditingLocationNewNameInMgr] = useState(''); // New name for location being edited

  /* ===== SETTINGS MODAL ===== */
  const [settingsVisible, setSettingsVisible] = useState(false); // Settings modal visibility
  const [debugMode, setDebugMode] = useState(false); // Debug mode state

  /* Draft management for Create/Edit Item Modal */
  const [itemDraft, setItemDraft] = useState<{
    title: string;
    quantity: string;
    location: string;
    description: string;
    images: string[];
  } | null>(null);

  /* Load items and locations on mount */
  useEffect(() => {
    loadItems();
    loadLocations();
  }, []);

  /* Load and Save functions for AsyncStorage */
  const loadItems = async () => {
    try {
      const data = await AsyncStorage.getItem('inventory');
      const parsed: InventoryItem[] = data ? JSON.parse(data) : [];

      setItems(parsed);
      setFilteredItems(parsed);
    } catch (e) {
      console.warn('loadItems error', e);
    }
  };

  /* Save items to AsyncStorage */
  const saveItems = async (newItems: InventoryItem[]) => {
    try {
      await AsyncStorage.setItem('inventory', JSON.stringify(newItems));

      setItems(newItems);
      setFilteredItems(newItems);
    } catch (e) {
      console.warn('saveItems error', e);
    }
  };

  /* Load locations from AsyncStorage */
  const loadLocations = async () => {
    try {
      const data = await AsyncStorage.getItem('locations');
      const parsed: string[] = data ? JSON.parse(data) : [];
      setLocations(parsed);
    } catch (e) {
      console.warn('loadLocations error', e);
    }
  };

  /* Save locations to AsyncStorage */
  const saveLocations = async (newLocations: string[]) => {
    try {
      await AsyncStorage.setItem('locations', JSON.stringify(newLocations));
      setLocations(newLocations);
    } catch (e) {
      console.warn('saveLocations error', e);
    }
  };

  /* Image picking and handling functions */
  const openImagePicker = async () => {
    if (newImages.length >= 5) {
      Alert.alert('Limite raggiunto', 'Puoi aggiungere al massimo 5 immagini.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4,3],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      try {
        const pickedUri = result.assets[0].uri;
        const savedUri = await compressAndSaveImage(pickedUri, { maxWidth: 1280, maxSizeKB: 250 });

        setNewImages(prev => [...prev, savedUri]); // Add to images array --> It builds a new array with the previous images plus the new one
      } catch (e) {
        console.error('Errore compress/save image', e);
        Alert.alert('Errore immagine', 'Non è stato possibile processare l\'immagine.');
      }
    }
  };

  /* Compress and save image to local filesystem */
  const compressAndSaveImage = async (
    uri: string,
    opts: { maxWidth?: number; maxSizeKB?: number } = {}
  ): Promise<string> => {
    const maxWidth = opts.maxWidth ?? 1280;
    const targetKB = opts.maxSizeKB ?? 250;

    // Helper to get file size in KB
    const getSizeKB = async (furi: string): Promise<number | null> => {
      try {
        const info = await FileSystem.getInfoAsync(furi);
        if (info && 'size' in info && typeof (info as any).size === 'number') {
          return Math.round((info as any).size / 1024);
        }

        return null;
      } catch (e) {
        return null;
      }
    };

    // Determine base directory for saving images
    const baseDir: string | null =
      (FileSystem as any).documentDirectory ||
      (FileSystem as any).cacheDirectory ||
      null;

    // Prepare final path
    const imagesDir = baseDir ? `${baseDir}images/` : null;
    const filename = `img_${Date.now()}.jpg`;
    const finalPath = imagesDir ? `${imagesDir}${filename}` : null;

    // Ensure images directory exists
    if (imagesDir) {
      try {
        const dirInfo = await FileSystem.getInfoAsync(imagesDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(imagesDir, { intermediates: true });
        }
      } catch (e) {
        console.warn('Warning: creazione directory immagini non riuscita', e);
      }
    }

    let lastSaved: string | null = null;
    let quality = 0.9;
    const minQuality = 0.35;

    // Loop until size requirement is met or quality threshold is reached
    while (quality >= minQuality) {
      try {
        // Compress image
        const manipResult = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: maxWidth } }],
          { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
        );

        const tmpUri = manipResult.uri; // Temporary URI of compressed image

        // If no final path, just check size and return if acceptable
        if (!finalPath) {
          const tmpSize = await getSizeKB(tmpUri);
          if (tmpSize !== null && tmpSize <= targetKB) return tmpUri;
          lastSaved = tmpUri;
          quality -= 0.15;
          continue;
        }

        // Try to move, copy, or download the file to final path
        // If one method fails, try the next
        try {
          await FileSystem.moveAsync({ from: tmpUri, to: finalPath });
        } catch (moveErr) {
          try {
            await FileSystem.copyAsync({ from: tmpUri, to: finalPath });
          } catch (copyErr) {
            await FileSystem.downloadAsync(tmpUri, finalPath);
          }
        }

        // Check size of saved file
        lastSaved = finalPath;

        const sizeKB = await getSizeKB(finalPath);
        if (sizeKB === null) return finalPath;
        if (sizeKB <= targetKB) return finalPath;

        quality -= 0.15;
      } catch (err) {
        console.warn('compressAndSaveImage inner error:', err);

        // If error occurs, try to download directly if finalPath exists
        if (finalPath) {
          try {
            await FileSystem.downloadAsync(uri, finalPath);
            return finalPath;
          } catch (downloadErr) {
            if (lastSaved) return lastSaved;
            throw err;
          }
        } else {
          if (lastSaved) return lastSaved;
          throw err;
        }
      }
    }

    if (lastSaved) return lastSaved; // Return last saved if quality loop ends

    // As a last resort, download the original image if finalPath exists
    if (finalPath) {
      await FileSystem.downloadAsync(uri, finalPath);
      return finalPath;
    }

    throw new Error('compressAndSaveImage: impossibile ottenere o creare un file immagine.');
  };

  /* Debugging functions for images */
  const getImageDebugInfo = async (uri: string) : Promise<{ exists: boolean; uri: string; sizeKB: number | null; persisted: boolean }> => {
    let info: any = null;
    try {
      info = await FileSystem.getInfoAsync(uri);
    } catch (e) {
      info = { exists: false, uri };
    }

    const sizeKB = info && 'size' in info && typeof info.size === 'number' ? Math.round(info.size / 1024) : null; //Get size in KB

    const doc = (FileSystem as any).documentDirectory || null; // Get document directory
    const cache = (FileSystem as any).cacheDirectory || null; // Get cache directory
    const persisted = !!((doc && uri.startsWith(doc)) || (cache && uri.startsWith(cache))); // Check if in persistent dirs

    return { exists: !!(info && info.exists), uri: info ? info.uri : uri, sizeKB, persisted };
  };

  /* Show debug info for an image */
  const debugImageInfo = async (uri: string) => {
    try {
      const info = await getImageDebugInfo(uri);
      console.log('[DEBUG IMAGE INFO]', info);

      Alert.alert(
        'Debug immagine',
        `URI: ${info.uri}\nEsiste: ${info.exists}\nSize (KB): ${info.sizeKB ?? 'sconosciuta'}\nPersistente nell\'app: ${info.persisted ? 'Sì' : 'No'}`,
        [{ text: 'OK' }]
      );
    } catch (e) {
      console.warn('debugImageInfo error', e);
      Alert.alert('Debug immagine', 'Impossibile ottenere info immagine.', [{ text: 'OK' }]);
    }
  };

  /* Confirm and remove image from item and delete local file */
  const confirmAndRemoveImage = (uri: string) => {
    Alert.alert(
      'Rimuovi immagine',
      'Sei sicuro di voler rimuovere questa immagine?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Rimuovi',
          style: 'destructive',
          onPress: async () => {
            setNewImages(prev => prev.filter(u => u !== uri));
            try {
              await deleteLocalImage(uri);
            } catch (e) {
              console.warn('Errore cancellazione file locale:', e);
            }
          }
        }
      ]
    );
  };
  
  /* Delete local image file */
  const deleteLocalImage = async (uri: string): Promise<boolean> => {
    if (!uri) return false; // Invalid URI

    try {
      await FileSystem.deleteAsync(uri, { idempotent: true }); // Delete file

      console.log('[DELETE LOCAL IMAGE] deleted:', uri);
      return true;
    } catch (e) {
      console.warn('[DELETE LOCAL IMAGE] error deleting', uri, e);
      return false;
    }
  };

  /* Show debug actions for an image */
  const showImageDebugActions = (uri: string) => {
    if (!debugMode) return;
    Alert.alert(
      'Azioni Debug immagine',
      uri,
      [
        { text: 'Info immagine', onPress: () => debugImageInfo(uri) },
        { text: 'Elimina file locale', onPress: async () => {
            const ok = await deleteLocalImage(uri);
            if (ok) {
              setNewImages(prev => prev.filter(u => u !== uri));
              Alert.alert('File locale eliminato', 'Il file locale è stato eliminato.');
            } else {
              Alert.alert('Errore', 'Impossibile eliminare il file locale.');
            }
          }, style: 'destructive' },
        { text: 'Annulla', style: 'cancel' }
      ]
    );
  };

  // --- EXPORT / IMPORT database (inventory + locations) ---
  const exportDatabase = async () => {
    try {
      const invRaw = await AsyncStorage.getItem('inventory');
      const locRaw = await AsyncStorage.getItem('locations');
      const invItems: InventoryItem[] = invRaw ? JSON.parse(invRaw) : [];
      
      const invItemsWithBase64 = await Promise.all(invItems.map(async (item) => {
        const imagesBase64 = await Promise.all(item.images.map(async (uri) => {
          try {
            console.log('Converting image to base64:', uri);
            const fileData = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' }); // Read file as base64

            return { uri, base64: fileData };
          } catch (e) {
            console.warn('Could not convert image to base64:', uri, e);
            return { uri, base64: null };
          }
        }));
        return { ...item, imagesBase64 }; // Add imagesBase64 array to item
      }));

      // Prepare export payload
      const payload = {
        exportedAt: new Date().toISOString(),
        inventory: invItemsWithBase64,
        locations: locRaw ? JSON.parse(locRaw) : []
      };

      const json = JSON.stringify(payload, null, 2); // Pretty-print JSON
      const filename = `casaapp_export_${Date.now()}.json`; // Filename with timestamp
      const baseCache: string = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || ''; // Base cache directory
      const tmpUri = `${baseCache}${filename}`; // Temporary file URI

      await FileSystem.writeAsStringAsync(tmpUri, json); // Write JSON to file
  
      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(tmpUri, { mimeType: 'application/json', dialogTitle: 'Esporta database CasaApp' });
      } else {
        Alert.alert('Esportazione', `Condivisione non disponibile. File salvato in: ${tmpUri}`);
      }
    } catch (e) {
      console.warn('exportDatabase error', e);
      Alert.alert('Errore', 'Esportazione non riuscita.');
    }
  };

  const importDatabase = async () => {
    try {
      const res: any = await DocumentPicker.getDocumentAsync({ type: 'application/json' }); // Pick JSON file
      console.log('DocumentPicker result:', res);
      
      // Handle cancellation
      if (res.canceled === true || !res.assets || res.assets.length === 0) {
        console.log('Document picker cancelled');
        return;
      }
      
      // Get the picked file URI
      const pickedUri: string = res.assets[0].uri;
      console.log('Picked URI:', pickedUri);
      
      let content: string;
      try {
        console.log('Attempting direct read...');
        content = await FileSystem.readAsStringAsync(pickedUri); // Try direct read
        console.log('Direct read successful, content length:', content.length);
      } catch (e) {
        console.warn('Direct read failed, attempting to copy to cache:', e);

        // If direct read fails, copy to cache and read from there
        const filename = `temp_import_${Date.now()}.json`;
        const cacheDir = (FileSystem as any).cacheDirectory || '';
        const tempPath = `${cacheDir}${filename}`;
        
        console.log('Copying from', pickedUri, 'to', tempPath);
        
        // Copy and read
        try {
          await FileSystem.copyAsync({ from: pickedUri, to: tempPath });
          console.log('Copy successful, reading from temp path...');
          content = await FileSystem.readAsStringAsync(tempPath);
          console.log('Temp read successful, content length:', content.length);
          await FileSystem.deleteAsync(tempPath, { idempotent: true });
        } catch (copyErr) {
          console.error('Copy and read failed:', copyErr);
          Alert.alert('Errore', 'Impossibile leggere il file JSON selezionato.');
          return;
        }
      }

      console.log('Parsing JSON...');
      const parsed = JSON.parse(content); // Parse JSON content
      let inv = Array.isArray(parsed.inventory) ? parsed.inventory : null; // Validate inventory
      const locs = Array.isArray(parsed.locations) ? parsed.locations : null; // Validate locations
      
      console.log('Parsed inventory items:', inv ? inv.length : 0, 'locations:', locs ? locs.length : 0);
      
      // If invalid, alert and return
      if (!inv || !locs) { 
        Alert.alert('Importazione', 'File non valido o non compatibile.'); 
        return; 
      }

      // Restore images from base64
      const baseDir: string = (FileSystem as any).documentDirectory || '';
      const imagesDir = `${baseDir}images/`;
      
      // Process each inventory item
      inv = await Promise.all(inv.map(async (item: any) => {
        let restoredImages: string[] = [];
        
        // Restore images from base64 data
        if (item.imagesBase64 && Array.isArray(item.imagesBase64)) {
          // Iterate over each base64 image data
          for (const imgData of item.imagesBase64) {
            if (imgData.base64) {
              try {
                const dirInfo = await FileSystem.getInfoAsync(imagesDir); // Ensure images directory exists
                if (!dirInfo.exists) {
                  await FileSystem.makeDirectoryAsync(imagesDir, { intermediates: true });
                }
                
                // Create unique filename
                const filename = `img_imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
                const filePath = `${imagesDir}${filename}`;
                console.log('Writing base64 image to:', filePath);
                
                // Write base64 data to file
                await FileSystem.writeAsStringAsync(filePath, imgData.base64, { encoding: 'base64' });
                restoredImages.push(filePath);
              } catch (e) {
                console.warn('Could not restore image from base64:', e);
              }
            }
          }
        }
        
        // Return item with restored images
        return {
          ...item,
          images: restoredImages.length > 0 ? restoredImages : (item.images || []),
          imagesBase64: undefined
        };
      }));

      // Ask user for import mode: replace or merge
      Alert.alert('Importazione DB', 'Scegli modalità di importazione', [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Sostituisci', onPress: async () => {
            console.log('Replace mode selected');
            await AsyncStorage.setItem('inventory', JSON.stringify(inv));
            await AsyncStorage.setItem('locations', JSON.stringify(locs));
            await loadItems();
            await loadLocations();
            Alert.alert('Importazione', 'Dati e immagini importati (sostituiti).');
          }
        },
        { text: 'Unisci', onPress: async () => {
            console.log('Merge mode selected');
            const existingKeys = new Set(items.map(i => `${i.title.trim().toLowerCase()}||${i.location}`)); // Create set of existing item keys
            
            // Filter items to add (avoid duplicates)
            const toAdd = inv.filter((i: InventoryItem) => {
              const key = `${(i.title||'').trim().toLowerCase()}||${i.location}`;
              return !existingKeys.has(key);
            });

            const mergedItems = [...items, ...toAdd]; // Merge existing items with new unique items
            const locSet = new Set([...locations, ...locs]); // Merge locations into a set to avoid duplicates
            const mergedLocs = Array.from(locSet); // Convert set back to array

            await AsyncStorage.setItem('inventory', JSON.stringify(mergedItems));
            await AsyncStorage.setItem('locations', JSON.stringify(mergedLocs));

            await loadItems();
            await loadLocations();
            Alert.alert('Importazione', `Importazione completata. Aggiunti ${toAdd.length} oggetti e relative immagini.`);
          }
        }
      ]);
    } catch (e) {
      console.error('importDatabase outer error:', e);
      Alert.alert('Errore', `Importazione fallita: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  /* Delete all data: inventory, locations, images */
  const deleteAllData = async () => {
    Alert.alert(
      'Elimina tutto',
      'Sei sicuro di voler eliminare TUTTI gli oggetti, le immagini e le ubicazioni? Questa azione non può essere annullata.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina tutto',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear AsyncStorage entries
              await AsyncStorage.setItem('inventory', JSON.stringify([]));
              await AsyncStorage.setItem('locations', JSON.stringify([]));
              
              // Delete images directory
              const baseDir: string = (FileSystem as any).documentDirectory || '';
              const imagesDir = `${baseDir}images/`;
              try {
                const dirInfo = await FileSystem.getInfoAsync(imagesDir);
                if (dirInfo.exists) {
                  await FileSystem.deleteAsync(imagesDir, { idempotent: true });
                }
              } catch (e) {
                console.warn('Could not delete images directory:', e);
              }
              
              // Reload state
              await loadItems();
              await loadLocations();
              
              Alert.alert('Eliminazione completata', 'Tutti gli oggetti, le immagini e le ubicazioni sono stati eliminati.');
            } catch (e) {
              console.error('deleteAllData error:', e);
              Alert.alert('Errore', 'Impossibile eliminare i dati.');
            }
          }
        }
      ]
    );
  };

  /* --- CREATE / EDIT ITEM MODAL FUNCTIONS --- */
  const openModalForNewItem = () => {
    setEditingItem(null);
    setNewTitle('');
    setNewQuantity('');
    setNewLocation('');
    setNewDescription('');
    setNewImages([]);
    setAdjustmentMode(null);
    setAdjustmentValue('');
    setOriginalSnapshot(null);
    setModalVisible(true);
  };

  /* Open modal for editing an existing item */
  const openModalForEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setNewTitle(item.title);
    setNewQuantity(item.quantity.toString());
    setNewLocation(item.location);
    setNewDescription(item.description);
    setNewImages(item.images);
    setAdjustmentMode(null);
    setAdjustmentValue('');
    setOriginalSnapshot({ title: item.title, quantity: item.quantity.toString(), location: item.location, description: item.description, images: item.images.slice() });
    setModalVisible(true);
  };

  /* Reset modal state */
  const resetModal = () => {
    setModalVisible(false);
    setEditingItem(null);
    setNewTitle('');
    setNewQuantity('');
    setNewLocation('');
    setNewDescription('');
    setNewImages([]);
    setAdjustmentMode(null);
    setAdjustmentValue('');
    setImageToView(null);
    setOriginalSnapshot(null);
    setLocationDropdownVisible(false);
    
    // Clear draft if exists
    setItemDraft(null);
    setShouldReopenItemModal(false);
  };

  /* Check for unsaved changes in modal */
  const hasUnsavedChanges = () => {
    // Se siamo in creazione (non editing), controlla se c'è almeno un campo compilato
    if (!editingItem) {
      return (
        newTitle.trim() !== '' ||
        newQuantity.trim() !== '' ||
        newDescription.trim() !== '' ||
        newLocation.trim() !== '' ||
        newImages.length > 0
      );
    }

    // Se siamo in modifica, confronta con lo snapshot originale
    if (!originalSnapshot) return false;

    const changed = (
      newTitle !== originalSnapshot.title ||
      newQuantity !== originalSnapshot.quantity ||
      newLocation !== originalSnapshot.location ||
      newDescription !== originalSnapshot.description ||
      JSON.stringify(newImages) !== JSON.stringify(originalSnapshot.images)
    );
    return changed;
  };

  /* Confirm cancellation of modal with unsaved changes check */
  const confirmCancel = () => {
    if (!hasUnsavedChanges()) { resetModal(); return; }
    Alert.alert('Conferma Annullamento','Sei sicuro di voler annullare? Le modifiche non salvate andranno perse.',[
      { text: 'No', style: 'cancel' },{ text: 'Sì', style: 'destructive', onPress: resetModal }
    ]);
  };

  /* Confirm and save item (create or update) */
  const confirmAndSaveItem = () => {
    Alert.alert(editingItem ? 'Conferma salvataggio' : 'Conferma creazione', editingItem ? "Salvare le modifiche all'oggetto?" : 'Creare il nuovo oggetto?', [
      { text: 'Annulla', style: 'cancel' }, { text: 'Conferma', onPress: () => addOrUpdateItem(true) }
    ]);
  };

  /* Add a new item or update an existing one */
  const addOrUpdateItem = async (confirmed = false) => {
    if (!confirmed) return; // Only proceed if confirmed

    // Validate required fields
    let missingFields: string[] = [];
    if (!newTitle) missingFields.push('Titolo');
    if (!newQuantity) missingFields.push('Quantità');
    if (!newLocation) missingFields.push('Ubicazione');
    if (!newImages || newImages.length === 0) missingFields.push('Immagine/i');
    if (missingFields.length > 0) { Alert.alert('Errore', `Compila i seguenti campi obbligatori: ${missingFields.join(', ')}.`); return; }

    // Save new location if it doesn't exist
    if (!locations.includes(newLocation)) { await saveLocations([...locations, newLocation]); }

    // If editing, update the item
    if (editingItem) {
      const updatedItems = items.map(i => i.id === editingItem.id ? { ...i, title: newTitle, quantity: parseInt(newQuantity), location: newLocation, description: newDescription, images: newImages } : i);
      await saveItems(updatedItems);
      Alert.alert('Salvataggio Modifiche', 'Modifiche salvate con successo.');
      resetModal();
    } else {
      // If creating, check for duplicates
      const titleLower = newTitle.trim().toLowerCase();
      const duplicatesAnyLocation = items.filter(i => i.title.trim().toLowerCase() === titleLower);

      // No duplicates found, create new item
      if (duplicatesAnyLocation.length === 0) {
        const newItem: InventoryItem = {
          id: Date.now().toString(),
          title: newTitle,
          quantity: parseInt(newQuantity),
          location: newLocation,
          description: newDescription,
          images: newImages,
        };
        await saveItems([...items, newItem]);
        Alert.alert('Creazione Oggetto', `Oggetto "${newItem.title}" creato con successo in "${newLocation}".`);

        resetModal();
        return;
      }

      // One duplicate found, ask user for action
      if (duplicatesAnyLocation.length === 1) {
        const target = duplicatesAnyLocation[0];
        Alert.alert(
          'Oggetto già presente',
          `Esiste già un oggetto "${newTitle}" in "${target.location}" (qta: ${target.quantity}). Vuoi aggregare la quantità a quello esistente o creare comunque un nuovo oggetto in "${newLocation}"?`,
          [
            { text: 'Annulla', style: 'cancel' },
            { text: `Aggrega a "${target.location}"`, onPress: async () => {
                // Aggregate quantity to existing item
                const updated = items.map(i => i.id === target.id ? { ...i, quantity: i.quantity + parseInt(newQuantity) } : i);
                await saveItems(updated);
                Alert.alert('Quantità aggiornata', `La quantità è stata aggiunta all'oggetto "${target.title}" in "${target.location}".`);
                resetModal();
              }
            },
            { text: `Crea comunque in "${newLocation}"`, onPress: async () => {
                // Create new item anyway, even if in the same location
                const newItem: InventoryItem = {
                  id: Date.now().toString(),
                  title: newTitle,
                  quantity: parseInt(newQuantity),
                  location: newLocation,
                  description: newDescription,
                  images: newImages,
                };
                await saveItems([...items, newItem]);

                Alert.alert('Creazione Oggetto', `Oggetto "${newItem.title}" creato con successo in "${newLocation}".`);
                resetModal();
              }
            }
          ]
        );
        return;
      }

      // Multiple duplicates found, open duplicate picker
      if (duplicatesAnyLocation.length > 1) {
        setDuplicateCandidates(duplicatesAnyLocation); // Set candidates for duplicate selection
        setDuplicateContextNewQuantity(parseInt(newQuantity)); // Set new quantity for context
        setDuplicateContextMode('create'); // Set context mode to 'create'
        setModalVisible(false);
        setTimeout(() => setDuplicatePickerVisible(true), 200);
        return;
      }
    }
  };

  /* Handle duplicate candidate selection */
  const onDuplicateCandidatePress = (candidate: InventoryItem) => {
    if (duplicateContextMode === 'create') {
      Alert.alert(
        'Conferma aggiunta quantità',
        `Vuoi aggiungere ${duplicateContextNewQuantity} alla quantità dell'oggetto "${candidate.title}" (${candidate.location})? Quantità attuale: ${candidate.quantity}`,
        [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Conferma', onPress: async () => {
            const updated = items.map(i => i.id === candidate.id ? { ...i, quantity: i.quantity + duplicateContextNewQuantity } : i);
            await saveItems(updated);

            Alert.alert('Quantità aggiornata', `La quantità è stata aggiunta all'oggetto "${candidate.title}" in "${candidate.location}".`);
            setDuplicatePickerVisible(false);
            setDuplicateCandidates([]);
            setDuplicateContextNewQuantity(0);
            setDuplicateContextMode(null);
            resetModal();
          } }
        ]
      );
      return;
    }

    // Handle 'reassign' mode for duplicates
    if (duplicateContextMode === 'reassign') {
      // Get the moving item based on stored ID
      const movingId = duplicateContextMovingItemId;
      if (!movingId) return;

      const movingItem = items.find(i => i.id === movingId);
      if (!movingItem) return;

      Alert.alert(
        'Conferma aggregazione',
        `Vuoi aggiungere la quantità (${movingItem.quantity}) dell'oggetto spostato "${movingItem.title}" a "${candidate.title}" in ${candidate.location}? L'oggetto spostato verrà eliminato.`,
        [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Conferma', onPress: async () => {
            const updated = items.map(i => i.id === candidate.id ? { ...i, quantity: i.quantity + movingItem.quantity } : i).filter(i => i.id !== movingId);
            await saveItems(updated);

            Alert.alert('Operazione completata', `Quantità aggiunta a "${candidate.title}". Oggetto spostato rimosso.`);
            setDuplicatePickerVisible(false);
            setDuplicateCandidates([]);
            setDuplicateContextMode(null);
            setDuplicateContextMovingItemId(null);
            processNextReassign();
          } }
        ]
      );
      return;
    }
  };

  /* Confirm and delete an item */
  const confirmAndDeleteItem = (id: string) => {
    Alert.alert('Conferma eliminazione','Sei sicuro di voler eliminare questo oggetto?',[ 
      { text: 'Annulla', style: 'cancel' },{ text: 'Elimina', style: 'destructive', onPress: async () => { await deleteItem(id); resetModal(); } }
    ]);
  };

  /* Delete an item by ID */
  const deleteItem = async (id: string) => {
    const itemToDelete = items.find(i => i.id === id);
    const updatedItems = items.filter(i => i.id !== id);

    await saveItems(updatedItems);
    if (itemToDelete) Alert.alert('Eliminazione Oggetto', `Oggetto "${itemToDelete.title}" eliminato con successo.`);
  };

  /* Close location manager modal */
  const closeLocationManager = () => {
    setLocationMgrVisible(false);
    
    // Check if we need to restore item modal
    if (shouldReopenItemModal && itemDraft) {
      setTimeout(() => {
        // Restore item modal visibility
        setItemModalTemporarilyHidden(false);
        
        // Update fields with any changes from draft
        setNewTitle(itemDraft.title);
        setNewQuantity(itemDraft.quantity);
        setNewLocation(itemDraft.location);
        setNewDescription(itemDraft.description);
        setNewImages(itemDraft.images);
        
        // Clear flags
        setShouldReopenItemModal(false);
        setItemDraft(null);
      }, 100);
    } else {
      // If no draft, just reset flags
      setShouldReopenItemModal(false);
      setItemDraft(null);
      setItemModalTemporarilyHidden(false);
    }
    
    // Reset context
    setLocationMgrOpenedFrom('button');
  };

  /* Open location manager modal */
  const saveDraftAndOpenLocationManager = () => {
    // Save current item data as draft
    setItemDraft({
      title: newTitle,
      quantity: newQuantity,
      location: newLocation,
      description: newDescription,
      images: newImages.slice(),
    });
    
    // Set flag to reopen item modal later
    setShouldReopenItemModal(true);
    
    // Set context - opened from item modal
    setLocationMgrOpenedFrom('itemModal');
    
    // Hide item modal temporarily instead of closing it
    setItemModalTemporarilyHidden(true);
    
    // Open location manager after a short delay
    setTimeout(() => {
      setLocationMgrVisible(true);
    }, 100);
  };

  /* Add a new location in location manager */
  const addLocationInMgr = async () => {
    const loc = newLocationNameInMgr.trim();
    if (!loc) {
      Alert.alert('Nome non valido', 'Inserisci un nome valido per l\'ubicazione.');
      return;
    }
    if (locations.includes(loc)) {
      Alert.alert('Ubicazione già presente', 'Questa ubicazione esiste già.');
      return;
    }

    // Add new location
    const newLocs = [...locations, loc];

    // Save updated locations
    await saveLocations(newLocs);
    setNewLocationNameInMgr(''); // Clear input
    setAddingLocationInMgr(false); // Exit adding mode
    Alert.alert('Ubicazione creata', `Ubicazione "${loc}" aggiunta con successo.`);
  };

  /* Confirm and delete a location */
  const confirmAndDeleteLocation = (loc: string) => {
    const used = items.some(it => it.location === loc); // Check if location is used
    if (used) {
      Alert.alert('Impossibile eliminare', `L'ubicazione "${loc}" contiene degli oggetti e non può essere eliminata.`);
      return;
    }
    Alert.alert('Conferma eliminazione', `Eliminare l'ubicazione "${loc}"?`, [
      { text: 'Annulla', style: 'cancel' }, 
      { text: 'Elimina', style: 'destructive', onPress: async () => { await deleteLocation(loc); } }
    ]);
  };

  /* Delete a location and update items */
  const deleteLocation = async (loc: string) => {
    const updatedLocations = locations.filter(l => l !== loc);
    await saveLocations(updatedLocations);

    const updatedItems = items.map(item => item.location === loc ? { ...item, location: '' } : item);
    await saveItems(updatedItems);

    if (newLocation === loc) setNewLocation('');
    if (selectedLocationForMgr === loc) setSelectedLocationForMgr(null);
    Alert.alert('Eliminazione Ubicazione', `Ubicazione "${loc}" eliminata correttamente.`);
  };

  /* Confirm adjustment of item quantity */
  const handleConfirmAdjustment = () => {
    const adj = parseInt(adjustmentValue || '0', 10);
    if (isNaN(adj) || adj <= 0) { Alert.alert('Valore non valido', 'Inserisci un numero intero maggiore di 0.'); return; }
    
    // Calculate new quantity based on adjustment mode
    const current = parseInt(newQuantity || '0', 10);
    const newQty = adjustmentMode === 'add' ? current + adj : current - adj;
    if (newQty < 0) { Alert.alert('Errore quantità', 'La quantità risultante sarebbe negativa. Inserisci un valore più piccolo.'); return; }
    Alert.alert('Conferma modifica quantità', `Sei sicuro di voler ${adjustmentMode === 'add' ? 'aggiungere' : 'rimuovere'} ${adj} alla quantità (attuale: ${current})? Risultato: ${newQty}`, [
      { text: 'Annulla', style: 'cancel' }, 
      { text: 'Conferma', onPress: () => { setNewQuantity(newQty.toString()); setAdjustmentMode(null); setAdjustmentValue(''); } }
    ]);
  };

  /* Confirm renaming a location */
  const confirmRenameLocationInMgr = () => {
    const oldName = editingLocationInMgr;
    const newName = editingLocationNewNameInMgr.trim();
    
    if (!oldName || !newName) {
      Alert.alert('Nome non valido', 'Inserisci un nome valido per l\'ubicazione.');
      return;
    }
    
    // No change, the old and new names are the same
    if (newName === oldName) {
      setEditingLocationInMgr(null);
      setEditingLocationNewNameInMgr('');
      return;
    }
    
    // Check if new name already exists
    if (locations.includes(newName)) {
      Alert.alert('Nome già esistente', 'Esiste già un\'altra ubicazione con questo nome. Scegli un nome diverso.');
      return;
    }
    
    Alert.alert(
      'Conferma rinomina ubicazione',
      `Rinominare "${oldName}" in "${newName}"? Tutti gli oggetti assegnati a "${oldName}" verranno aggiornati.`,
      [
        { text: 'Annulla', style: 'cancel' },
        { 
          text: 'Conferma',
          onPress: async () => {
            // Update locations list
            const updatedLocations = locations.map(l => l === oldName ? newName : l);
            await saveLocations(updatedLocations);
            
            // Update items assigned to the old location
            const updatedItems = items.map(item => item.location === oldName ? { ...item, location: newName } : item);
            await saveItems(updatedItems);
            
            // Update state if needed
            if (newLocation === oldName) setNewLocation(newName);
            if (selectedLocationForMgr === oldName) setSelectedLocationForMgr(newName);
            
            // Clear editing state
            setEditingLocationInMgr(null);
            setEditingLocationNewNameInMgr('');
            
            Alert.alert('Rinomina completata', `"${oldName}" rinominata in "${newName}".`);
          }
        }
      ]
    );
  };

  /* Open location manager modal */
  const openLocationManager = () => {
    setSelectedLocationForMgr(null);
    setMgrSelectedItemIds([]);
    setMgrTargetLocation(null);
    setAddingLocationInMgr(false);
    setNewLocationNameInMgr('');
    setEditingLocationInMgr(null);
    setEditingLocationNewNameInMgr('');
    
    // Set context - opened from button
    setLocationMgrOpenedFrom('button');
    
    setLocationMgrVisible(true);
  };

  /* Toggle selection of an item in location manager */
  const toggleMgrSelectItem = (id: string) => {
    setMgrSelectedItemIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  /* Reassign selected items to target location */
  const reassignMgrItems = () => {
    if (!selectedLocationForMgr) { Alert.alert('Seleziona ubicazione','Scegli prima una ubicazione da cui prendere gli oggetti.'); return; }
    if (!mgrTargetLocation) { Alert.alert('Seleziona destinazione','Scegli una ubicazione di destinazione.'); return; }
    if (mgrTargetLocation === selectedLocationForMgr) { Alert.alert('Stessa ubicazione','La destinazione è identica all\'origine.'); return; }
    if (mgrSelectedItemIds.length === 0) { Alert.alert('Nessun oggetto selezionato','Seleziona almeno un oggetto da riassegnare.'); return; }

    // Prepare queue and target
    const queue = mgrSelectedItemIds.slice();
    const target = mgrTargetLocation;

    // Start reassignment process
    setReassignQueue(queue);
    setReassignTarget(target);
    setLocationMgrVisible(false);
    setTimeout(() => processNextReassign(queue, target), 200); // Slight delay to ensure modal is closed
  };

  /* Process the next item in the reassignment queue */
  const processNextReassign = async (queueParam?: string[], targetParam?: string | null) => {
    // Use provided queue and target or fall back to state
    let queue = Array.isArray(queueParam) ? queueParam.slice() : reassignQueue.slice();
    const target = typeof targetParam !== 'undefined' ? targetParam : reassignTarget;

    // Clear selection in location manager
    setMgrSelectedItemIds([]);

    // If queue is empty, finish reassignment
    if (queue.length === 0) {
      setReassignTarget(null);
      setReassignQueue([]);
      return;
    }

    // Process the next item in the queue
    const currentId = queue.shift()!;
    setReassignQueue(queue);

    // Find the item to move
    const movingItem = items.find(i => i.id === currentId);
    if (!movingItem || !target) {
      setTimeout(() => processNextReassign(queue, target), 50);
      return;
    }

    // Check for duplicates in the target location
    const titleLower = movingItem.title.trim().toLowerCase();
    const duplicatesInTarget = items.filter(i => i.title.trim().toLowerCase() === titleLower && i.location === target && i.id !== movingItem.id);

    // No duplicates, proceed with reassignment
    if (duplicatesInTarget.length === 0) {
      const updated = items.map(i => i.id === movingItem.id ? { ...i, location: target } : i);
      await saveItems(updated);

      Alert.alert('Riassegnazione completata', `"${movingItem.title}" spostato in "${target}".`);
      setTimeout(() => processNextReassign(queue, target), 50);
      return;
    }

    // One duplicate found, ask user for action
    if (duplicatesInTarget.length === 1) {
      const targetExisting = duplicatesInTarget[0];
      Alert.alert(
        'Oggetto con stesso titolo presente',
        `In "${target}" esiste già un oggetto "${movingItem.title}" (qta: ${targetExisting.quantity}). Vuoi aggregare la quantità del pezzo spostato (${movingItem.quantity}) o spostare comunque creando un duplicato?`,
        [
          { text: 'Annulla', style: 'cancel', onPress: () => { setTimeout(() => processNextReassign(queue, target), 50); } },
          { text: `Aggrega a ${target}`, onPress: async () => {
              const updated = items.map(i => i.id === targetExisting.id ? { ...i, quantity: i.quantity + movingItem.quantity } : i).filter(i => i.id !== movingItem.id);
              await saveItems(updated);

              Alert.alert('Aggregazione completata', `Quantità aggiunta a "${targetExisting.title}". Oggetto spostato rimosso.`);
              setTimeout(() => processNextReassign(queue, target), 50);
            }
          },
          { text: `Sposta comunque`, onPress: async () => {
              const updated = items.map(i => i.id === movingItem.id ? { ...i, location: target } : i);
              await saveItems(updated);

              Alert.alert('Spostamento completato', `"${movingItem.title}" spostato in "${target}".`);
              setTimeout(() => processNextReassign(queue, target), 50);
            }
          }
        ]
      );
      return;
    }

    // Multiple duplicates found, open duplicate picker
    setDuplicateCandidates(duplicatesInTarget);
    setDuplicateContextMode('reassign');
    setDuplicateContextMovingItemId(movingItem.id);
    setTimeout(() => setDuplicatePickerVisible(true), 200);
    return;
  };

  /* --- RENDERING COMPONENTS FOR FILTERS --- */
  useEffect(() => {
    const filtered = items.filter(item => 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.location.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredItems(filtered);
  }, [searchQuery, items]);

  /* Render a single inventory item in the list */
  const renderItem = ({ item }: { item: InventoryItem }) => (
    <TouchableOpacity 
      style={[
        styles.itemContainer, 
        { 
          backgroundColor: theme.card,
          borderColor: theme.border,
          borderWidth: 1,
        }
      ]} 
      onPress={() => openModalForEditItem(item)}
    >
      <TouchableOpacity 
        onPress={() => openModalForEditItem(item)} 
        onLongPress={() => { 
          if (debugMode && item.images[0]) showImageDebugActions(item.images[0]); 
        }} 
        delayLongPress={2000}
      >
        <Image 
          source={{ uri: item.images[0] }} 
          style={styles.itemImageSmall} 
        />
      </TouchableOpacity>
      <View style={styles.itemDetails}>
        <Text style={[styles.itemTitle, { color: theme.text }]}>
          {item.title}
        </Text>
        <Text style={{ color: theme.textSecondary }}>
          Quantità: {item.quantity}
        </Text>
        <Text style={{ color: theme.textSecondary }}>
          Ubicazione: {item.location}
        </Text>
        <Text 
          numberOfLines={2} 
          ellipsizeMode="tail"
          style={{ color: theme.textSecondary }}
        >
          {item.description}
        </Text>
      </View>
    </TouchableOpacity>
  );

  /* Colors for light and dark mode --> They are all presetted */
  const Colors = {
    light: {
      background: '#f5f5f5',
      card: '#ffffff',
      text: '#333333',
      textSecondary: '#666666',
      border: '#e0e0e0',
      searchBg: '#ffffff',
      searchBorder: '#ddd',
      placeholder: '#999',
      primary: '#007AFF',
      success: '#34C759',
      gray: '#8E8E93',
    },
    dark: {
      background: '#121212',
      card: '#1e1e1e',
      text: '#ffffff',
      textSecondary: '#b0b0b0',
      border: '#333333',
      searchBg: '#2a2a2a',
      searchBorder: '#444',
      placeholder: '#666',
      primary: '#0A84FF',
      success: '#32D74B',
      gray: '#98989D',
    }
  };
  const theme = isDarkMode ? Colors.dark : Colors.light;

  /* Main component render */
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.searchContainer}>
        <TextInput 
            style={[
              styles.searchInput, 
              { 
                backgroundColor: theme.searchBg, 
                borderColor: theme.searchBorder,
                color: theme.text 
              }
            ]} 
          placeholder="Cerca oggetto, ubicazione o descrizione..." 
          placeholderTextColor={theme.placeholder}
          value={searchQuery} 
          onChangeText={setSearchQuery} 
        />
      </View>

      <FlatList 
        data={filteredItems} 
        renderItem={renderItem} 
        keyExtractor={item => item.id} 
        style={{ backgroundColor: theme.background }}
        ListEmptyComponent={items.length > 0 ? (
          <View style={styles.emptyContainer}><Text>Nessun risultato trovato</Text></View>
        ) : null} 
      />

      {/* floating buttons container */}
      <View style={styles.fabContainer}>
        <TouchableOpacity 
          style={[styles.fab, { backgroundColor: theme.gray, marginRight: 10 }]} 
          onPress={() => setSettingsVisible(true)}
        >
          <Text style={styles.addButtonText}>Impostazioni</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.fab, { backgroundColor: theme.success, marginRight: 10 }]} 
          onPress={openLocationManager}
        >
          <Text style={styles.addButtonText}>Gestione Ubicazioni</Text>
        </TouchableOpacity>

        <TouchableOpacity 
           style={[styles.fab, { backgroundColor: theme.primary }]} 
          onPress={openModalForNewItem}
        >
          <Text style={styles.addButtonText}>+ Aggiungi nuovo oggetto</Text>
        </TouchableOpacity>
      </View>

      {/* Location Manager Modal */}
      {locationMgrOpenedFrom === 'button' && (
        <LocationManagerModal
          visible={locationMgrVisible}
          onClose={closeLocationManager}
          locations={locations}
          items={items}
          openedFrom={locationMgrOpenedFrom}
          addingLocationInMgr={addingLocationInMgr}
          setAddingLocationInMgr={setAddingLocationInMgr}
          newLocationNameInMgr={newLocationNameInMgr}
          setNewLocationNameInMgr={setNewLocationNameInMgr}
          addLocationInMgr={addLocationInMgr}
          editingLocationInMgr={editingLocationInMgr}
          setEditingLocationInMgr={setEditingLocationInMgr}
          editingLocationNewNameInMgr={editingLocationNewNameInMgr}
          setEditingLocationNewNameInMgr={setEditingLocationNewNameInMgr}
          confirmRenameLocationInMgr={confirmRenameLocationInMgr}
          confirmAndDeleteLocation={confirmAndDeleteLocation}
          selectedLocationForMgr={selectedLocationForMgr}
          setSelectedLocationForMgr={setSelectedLocationForMgr}
          mgrSelectedItemIds={mgrSelectedItemIds}
          setMgrSelectedItemIds={setMgrSelectedItemIds}
          toggleMgrSelectItem={toggleMgrSelectItem}
          mgrTargetLocation={mgrTargetLocation}
          setMgrTargetLocation={setMgrTargetLocation}
          reassignMgrItems={reassignMgrItems}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        debugMode={debugMode}
        setDebugMode={setDebugMode}
        exportDatabase={exportDatabase}
        importDatabase={importDatabase}
        deleteAllData={deleteAllData}
      />

      {/* Duplicate candidates picker modal */}
      <DuplicatePickerModal
        visible={duplicatePickerVisible}
        onClose={() => setDuplicatePickerVisible(false)}
        duplicateCandidates={duplicateCandidates}
        duplicateContextMode={duplicateContextMode}
        duplicateContextNewQuantity={duplicateContextNewQuantity}
        onCandidatePress={onDuplicateCandidatePress}
        onCancel={() => {
          setDuplicatePickerVisible(false);
          setDuplicateCandidates([]);
          setDuplicateContextNewQuantity(0);
          setDuplicateContextMode(null);
          setDuplicateContextMovingItemId(null);
          if (reassignQueue.length > 0) processNextReassign();
        }}
      />

      {/* Item create/edit modal */}
      <ItemEditorModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        editingItem={editingItem}
        newTitle={newTitle}
        setNewTitle={setNewTitle}
        newQuantity={newQuantity}
        setNewQuantity={setNewQuantity}
        newDescription={newDescription}
        setNewDescription={setNewDescription}
        newLocation={newLocation}
        setNewLocation={setNewLocation}
        newImages={newImages}
        setNewImages={setNewImages}
        locations={locations}
        debugMode={debugMode}
        adjustmentMode={adjustmentMode}
        setAdjustmentMode={setAdjustmentMode}
        adjustmentValue={adjustmentValue}
        setAdjustmentValue={setAdjustmentValue}
        handleConfirmAdjustment={handleConfirmAdjustment}
        confirmAndSaveItem={confirmAndSaveItem}
        confirmCancel={confirmCancel}
        confirmAndDeleteItem={confirmAndDeleteItem}
        openImagePicker={openImagePicker}
        confirmAndRemoveImage={confirmAndRemoveImage}
        showImageDebugActions={showImageDebugActions}
        onGoToLocationManager={saveDraftAndOpenLocationManager}
        locationManagerContent={
          locationMgrOpenedFrom === 'itemModal' ? (
            <LocationManagerModal
              visible={locationMgrVisible}
              onClose={closeLocationManager}
              locations={locations}
              items={items}
              openedFrom={locationMgrOpenedFrom}
              addingLocationInMgr={addingLocationInMgr}
              setAddingLocationInMgr={setAddingLocationInMgr}
              newLocationNameInMgr={newLocationNameInMgr}
              setNewLocationNameInMgr={setNewLocationNameInMgr}
              addLocationInMgr={addLocationInMgr}
              editingLocationInMgr={editingLocationInMgr}
              setEditingLocationInMgr={setEditingLocationInMgr}
              editingLocationNewNameInMgr={editingLocationNewNameInMgr}
              setEditingLocationNewNameInMgr={setEditingLocationNewNameInMgr}
              confirmRenameLocationInMgr={confirmRenameLocationInMgr}
              confirmAndDeleteLocation={confirmAndDeleteLocation}
              selectedLocationForMgr={selectedLocationForMgr}
              setSelectedLocationForMgr={setSelectedLocationForMgr}
              mgrSelectedItemIds={mgrSelectedItemIds}
              setMgrSelectedItemIds={setMgrSelectedItemIds}
              toggleMgrSelectItem={toggleMgrSelectItem}
              mgrTargetLocation={mgrTargetLocation}
              setMgrTargetLocation={setMgrTargetLocation}
              reassignMgrItems={reassignMgrItems}
            />
          ) : null
        }
      />
    </View>
  );
}

/* Wrap AppInner with ThemeProvider */
export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}

/* Styles */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 50 },
  searchContainer: { padding: 10 },
  searchInput: { 
    height: 40, 
    borderColor: 'gray', 
    borderWidth: 1, 
    borderRadius: 8, 
    paddingHorizontal: 10 
  },
  itemContainer: { 
    flexDirection: 'row', 
    padding: 10, 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee', 
    alignItems: 'center' 
  },
  itemImageSmall: { width: 40, height: 40, borderRadius: 5 },
  itemDetails: { flex: 1, marginLeft: 10 },
  itemTitle: { fontSize: 16, fontWeight: 'bold' },
  addButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  emptyContainer: { 
    flex:1, 
    justifyContent:'center', 
    alignItems:'center', 
    padding:20 
  },
  fabContainer: {
    position: 'absolute', 
    bottom: 20, 
    right: 20, 
    flexDirection: 'column', 
    alignItems: 'flex-end'
  },
  fab: {
    paddingVertical: 10, 
    paddingHorizontal: 14, 
    borderRadius: 8, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.25, 
    shadowRadius: 3, 
    elevation: 5, 
    marginBottom: 10
  }
});
