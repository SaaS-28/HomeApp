// App.tsx
import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, Text, View, TextInput, FlatList, Image, TouchableOpacity,
  Alert, useColorScheme
} from 'react-native';

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

/*MY IMPORTS*/
import SettingsModal from './src/screens/SettingsScreen';
import DuplicatePickerModal from './src/screens/DuplicateObjectsScreen';
import ItemEditorModal from './src/screens/CreateEditObjectScreen';
import LocationManagerModal from './src/screens/LocationManagerScreen';

/* Theme context */
import { useTheme, ThemeProvider } from './src/contexts/ThemeContext';

/*InventoryItem object e structure*/
interface InventoryItem {
  id: string;
  title: string;
  images: string[];
  quantity: number;
  location: string;
  description: string;
}

function AppInner() {
  const { themePreference, systemScheme } = useTheme();
  const systemColorScheme = systemScheme;
  const isDarkMode = themePreference === 'auto' 
    ? systemColorScheme === 'dark' 
    : themePreference === 'dark';

  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newImages, setNewImages] = useState<string[]>([]);

  const [locations, setLocations] = useState<string[]>([]);
  // Location dropdown state
  const [locationDropdownVisible, setLocationDropdownVisible] = useState(false);

  const [adjustmentMode, setAdjustmentMode] = useState<'add' | 'remove' | null>(null);
  const [adjustmentValue, setAdjustmentValue] = useState('');

  // Location Manager modal states
  const [locationMgrVisible, setLocationMgrVisible] = useState(false);
  const [selectedLocationForMgr, setSelectedLocationForMgr] = useState<string | null>(null);
  const [mgrSelectedItemIds, setMgrSelectedItemIds] = useState<string[]>([]);
  const [mgrTargetLocation, setMgrTargetLocation] = useState<string | null>(null);
  
  // Location Manager - Add/Edit states
  const [addingLocationInMgr, setAddingLocationInMgr] = useState(false);
  const [newLocationNameInMgr, setNewLocationNameInMgr] = useState('');
  const [editingLocationInMgr, setEditingLocationInMgr] = useState<string | null>(null);
  const [editingLocationNewNameInMgr, setEditingLocationNewNameInMgr] = useState('');

  // Settings / debug mode
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  // Reassign flow context (for handling duplicates during reassign)
  const [reassignQueue, setReassignQueue] = useState<string[]>([]);
  const [reassignTarget, setReassignTarget] = useState<string | null>(null);

  // Duplicate selection modal states (used both for create and reassign)
  const [duplicatePickerVisible, setDuplicatePickerVisible] = useState(false);
  const [duplicateCandidates, setDuplicateCandidates] = useState<InventoryItem[]>([]);
  const [duplicateContextNewQuantity, setDuplicateContextNewQuantity] = useState(0);
  const [duplicateContextMode, setDuplicateContextMode] = useState<'create'|'reassign'|null>(null);
  const [duplicateContextMovingItemId, setDuplicateContextMovingItemId] = useState<string | null>(null);

  const [imageToView, setImageToView] = useState<string | null>(null);
  const [originalSnapshot, setOriginalSnapshot] = useState<any>(null);

  // Load items and locations once on mount
  useEffect(() => {
    loadItems();
    loadLocations();
  }, []);

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

  const saveItems = async (newItems: InventoryItem[]) => {
    try {
      await AsyncStorage.setItem('inventory', JSON.stringify(newItems));
      setItems(newItems);
      setFilteredItems(newItems);
    } catch (e) {
      console.warn('saveItems error', e);
    }
  };

  const loadLocations = async () => {
    try {
      const data = await AsyncStorage.getItem('locations');
      const parsed: string[] = data ? JSON.parse(data) : [];
      setLocations(parsed);
    } catch (e) {
      console.warn('loadLocations error', e);
    }
  };

  const saveLocations = async (newLocations: string[]) => {
    try {
      await AsyncStorage.setItem('locations', JSON.stringify(newLocations));
      setLocations(newLocations);
    } catch (e) {
      console.warn('saveLocations error', e);
    }
  };

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
        setNewImages(prev => [...prev, savedUri]);
      } catch (e) {
        console.error('Errore compress/save image', e);
        Alert.alert('Errore immagine', 'Non è stato possibile processare l\'immagine.');
      }
    }
  };

  const compressAndSaveImage = async (
    uri: string,
    opts: { maxWidth?: number; maxSizeKB?: number } = {}
  ): Promise<string> => {
    const maxWidth = opts.maxWidth ?? 1280;
    const targetKB = opts.maxSizeKB ?? 250;

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

    const baseDir: string | null =
      (FileSystem as any).documentDirectory ||
      (FileSystem as any).cacheDirectory ||
      null;

    const imagesDir = baseDir ? `${baseDir}images/` : null;
    const filename = `img_${Date.now()}.jpg`;
    const finalPath = imagesDir ? `${imagesDir}${filename}` : null;

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

    while (quality >= minQuality) {
      try {
        const manipResult = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: maxWidth } }],
          { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
        );

        const tmpUri = manipResult.uri;

        if (!finalPath) {
          const tmpSize = await getSizeKB(tmpUri);
          if (tmpSize !== null && tmpSize <= targetKB) return tmpUri;
          lastSaved = tmpUri;
          quality -= 0.15;
          continue;
        }

        try {
          await FileSystem.moveAsync({ from: tmpUri, to: finalPath });
        } catch (moveErr) {
          try {
            await FileSystem.copyAsync({ from: tmpUri, to: finalPath });
          } catch (copyErr) {
            await FileSystem.downloadAsync(tmpUri, finalPath);
          }
        }

        lastSaved = finalPath;
        const sizeKB = await getSizeKB(finalPath);
        if (sizeKB === null) return finalPath;
        if (sizeKB <= targetKB) return finalPath;

        quality -= 0.15;
      } catch (err) {
        console.warn('compressAndSaveImage inner error:', err);
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

    if (lastSaved) return lastSaved;

    if (finalPath) {
      await FileSystem.downloadAsync(uri, finalPath);
      return finalPath;
    }

    throw new Error('compressAndSaveImage: impossibile ottenere o creare un file immagine.');
  };

  const getImageDebugInfo = async (uri: string) : Promise<{ exists: boolean; uri: string; sizeKB: number | null; persisted: boolean }> => {
    let info: any = null;
    try {
      info = await FileSystem.getInfoAsync(uri);
    } catch (e) {
      info = { exists: false, uri };
    }

    const sizeKB = info && 'size' in info && typeof info.size === 'number' ? Math.round(info.size / 1024) : null;

    const doc = (FileSystem as any).documentDirectory || null;
    const cache = (FileSystem as any).cacheDirectory || null;
    const persisted = !!((doc && uri.startsWith(doc)) || (cache && uri.startsWith(cache)));

    return { exists: !!(info && info.exists), uri: info ? info.uri : uri, sizeKB, persisted };
  };

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
  
  const deleteLocalImage = async (uri: string): Promise<boolean> => {
    if (!uri) return false;

    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
      console.log('[DELETE LOCAL IMAGE] deleted:', uri);
      return true;
    } catch (e) {
      console.warn('[DELETE LOCAL IMAGE] error deleting', uri, e);
      return false;
    }
  };

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
            const fileData = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
            return { uri, base64: fileData };
          } catch (e) {
            console.warn('Could not convert image to base64:', uri, e);
            return { uri, base64: null };
          }
        }));
        return { ...item, imagesBase64 };
      }));

      const payload = {
        exportedAt: new Date().toISOString(),
        inventory: invItemsWithBase64,
        locations: locRaw ? JSON.parse(locRaw) : []
      };
      const json = JSON.stringify(payload, null, 2);
      const filename = `casaapp_export_${Date.now()}.json`;
      const baseCache: string = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || '';
      const tmpUri = `${baseCache}${filename}`;
      await FileSystem.writeAsStringAsync(tmpUri, json);
  
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
      const res: any = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      console.log('DocumentPicker result:', res);
      
      if (res.canceled === true || !res.assets || res.assets.length === 0) {
        console.log('Document picker cancelled');
        return;
      }
      
      const pickedUri: string = res.assets[0].uri;
      console.log('Picked URI:', pickedUri);
      
      let content: string;
      try {
        console.log('Attempting direct read...');
        content = await FileSystem.readAsStringAsync(pickedUri);
        console.log('Direct read successful, content length:', content.length);
      } catch (e) {
        console.warn('Direct read failed, attempting to copy to cache:', e);
        const filename = `temp_import_${Date.now()}.json`;
        const cacheDir = (FileSystem as any).cacheDirectory || '';
        const tempPath = `${cacheDir}${filename}`;
        
        console.log('Copying from', pickedUri, 'to', tempPath);
        
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
      const parsed = JSON.parse(content);
      let inv = Array.isArray(parsed.inventory) ? parsed.inventory : null;
      const locs = Array.isArray(parsed.locations) ? parsed.locations : null;
      
      console.log('Parsed inventory items:', inv ? inv.length : 0, 'locations:', locs ? locs.length : 0);
      
      if (!inv || !locs) { 
        Alert.alert('Importazione', 'File non valido o non compatibile.'); 
        return; 
      }

      const baseDir: string = (FileSystem as any).documentDirectory || '';
      const imagesDir = `${baseDir}images/`;
      
      inv = await Promise.all(inv.map(async (item: any) => {
        let restoredImages: string[] = [];
        
        if (item.imagesBase64 && Array.isArray(item.imagesBase64)) {
          for (const imgData of item.imagesBase64) {
            if (imgData.base64) {
              try {
                const dirInfo = await FileSystem.getInfoAsync(imagesDir);
                if (!dirInfo.exists) {
                  await FileSystem.makeDirectoryAsync(imagesDir, { intermediates: true });
                }
                
                const filename = `img_imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
                const filePath = `${imagesDir}${filename}`;
                console.log('Writing base64 image to:', filePath);
                
                await FileSystem.writeAsStringAsync(filePath, imgData.base64, { encoding: 'base64' });
                restoredImages.push(filePath);
              } catch (e) {
                console.warn('Could not restore image from base64:', e);
              }
            }
          }
        }
        
        return {
          ...item,
          images: restoredImages.length > 0 ? restoredImages : (item.images || []),
          imagesBase64: undefined
        };
      }));

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
            const existingKeys = new Set(items.map(i => `${i.title.trim().toLowerCase()}||${i.location}`));
            const toAdd = inv.filter((i: InventoryItem) => {
              const key = `${(i.title||'').trim().toLowerCase()}||${i.location}`;
              return !existingKeys.has(key);
            });
            const mergedItems = [...items, ...toAdd];
            const locSet = new Set([...locations, ...locs]);
            const mergedLocs = Array.from(locSet);
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
              await AsyncStorage.setItem('inventory', JSON.stringify([]));
              await AsyncStorage.setItem('locations', JSON.stringify([]));
              
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
  };

  const hasUnsavedChanges = () => {
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

  const confirmCancel = () => {
    if (!hasUnsavedChanges()) { resetModal(); return; }
    Alert.alert('Conferma Annullamento','Sei sicuro di voler annullare? Le modifiche non salvate andranno perse.',[
      { text: 'No', style: 'cancel' },{ text: 'Sì', style: 'destructive', onPress: resetModal }
    ]);
  };

  const confirmAndSaveItem = () => {
    Alert.alert(editingItem ? 'Conferma salvataggio' : 'Conferma creazione', editingItem ? "Salvare le modifiche all'oggetto?" : 'Creare il nuovo oggetto?', [
      { text: 'Annulla', style: 'cancel' }, { text: 'Conferma', onPress: () => addOrUpdateItem(true) }
    ]);
  };

  const addOrUpdateItem = async (confirmed = false) => {
    if (!confirmed) return;
    let missingFields: string[] = [];
    if (!newTitle) missingFields.push('Titolo');
    if (!newQuantity) missingFields.push('Quantità');
    if (!newLocation) missingFields.push('Ubicazione');
    if (!newImages || newImages.length === 0) missingFields.push('Immagine/i');
    if (missingFields.length > 0) { Alert.alert('Errore', `Compila i seguenti campi obbligatori: ${missingFields.join(', ')}.`); return; }

    if (!locations.includes(newLocation)) { await saveLocations([...locations, newLocation]); }

    if (editingItem) {
      const updatedItems = items.map(i => i.id === editingItem.id ? { ...i, title: newTitle, quantity: parseInt(newQuantity), location: newLocation, description: newDescription, images: newImages } : i);
      await saveItems(updatedItems);
      Alert.alert('Salvataggio Modifiche', 'Modifiche salvate con successo.');
      resetModal();
    } else {
      const titleLower = newTitle.trim().toLowerCase();
      const duplicatesAnyLocation = items.filter(i => i.title.trim().toLowerCase() === titleLower);

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

      if (duplicatesAnyLocation.length === 1) {
        const target = duplicatesAnyLocation[0];
        Alert.alert(
          'Oggetto già presente',
          `Esiste già un oggetto "${newTitle}" in "${target.location}" (qta: ${target.quantity}). Vuoi aggregare la quantità a quello esistente o creare comunque un nuovo oggetto in "${newLocation}"?`,
          [
            { text: 'Annulla', style: 'cancel' },
            { text: `Aggrega a ${target.location}`, onPress: async () => {
                const updated = items.map(i => i.id === target.id ? { ...i, quantity: i.quantity + parseInt(newQuantity) } : i);
                await saveItems(updated);
                Alert.alert('Quantità aggiornata', `La quantità è stata aggiunta all'oggetto "${target.title}" in "${target.location}".`);
                resetModal();
              }
            },
            { text: `Crea comunque in "${newLocation}"`, onPress: async () => {
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

      if (duplicatesAnyLocation.length > 1) {
        setDuplicateCandidates(duplicatesAnyLocation);
        setDuplicateContextNewQuantity(parseInt(newQuantity));
        setDuplicateContextMode('create');
        setModalVisible(false);
        setTimeout(() => setDuplicatePickerVisible(true), 200);
        return;
      }
    }
  };

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

    if (duplicateContextMode === 'reassign') {
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

  const confirmAndDeleteItem = (id: string) => {
    Alert.alert('Conferma eliminazione','Sei sicuro di voler eliminare questo oggetto?',[ 
      { text: 'Annulla', style: 'cancel' },{ text: 'Elimina', style: 'destructive', onPress: async () => { await deleteItem(id); resetModal(); } }
    ]);
  };

  const deleteItem = async (id: string) => {
    const itemToDelete = items.find(i => i.id === id);
    const updatedItems = items.filter(i => i.id !== id);
    await saveItems(updatedItems);
    if (itemToDelete) Alert.alert('Eliminazione Oggetto', `Oggetto "${itemToDelete.title}" eliminato con successo.`);
  };

  // Location management functions (now in Location Manager modal)
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
    const newLocs = [...locations, loc];
    await saveLocations(newLocs);
    setNewLocationNameInMgr('');
    setAddingLocationInMgr(false);
    Alert.alert('Ubicazione creata', `Ubicazione "${loc}" aggiunta con successo.`);
  };

  const confirmAndDeleteLocation = (loc: string) => {
    const used = items.some(it => it.location === loc);
    if (used) {
      Alert.alert('Impossibile eliminare', `L'ubicazione "${loc}" contiene degli oggetti e non può essere eliminata.`);
      return;
    }
    Alert.alert('Conferma eliminazione', `Eliminare l'ubicazione "${loc}"?`, [
      { text: 'Annulla', style: 'cancel' }, 
      { text: 'Elimina', style: 'destructive', onPress: async () => { await deleteLocation(loc); } }
    ]);
  };

  const deleteLocation = async (loc: string) => {
    const updatedLocations = locations.filter(l => l !== loc);
    await saveLocations(updatedLocations);
    const updatedItems = items.map(item => item.location === loc ? { ...item, location: '' } : item);
    await saveItems(updatedItems);
    if (newLocation === loc) setNewLocation('');
    if (selectedLocationForMgr === loc) setSelectedLocationForMgr(null);
    Alert.alert('Eliminazione Ubicazione', `Ubicazione "${loc}" eliminata correttamente.`);
  };

  const handleConfirmAdjustment = () => {
    const adj = parseInt(adjustmentValue || '0', 10);
    if (isNaN(adj) || adj <= 0) { Alert.alert('Valore non valido', 'Inserisci un numero intero maggiore di 0.'); return; }
    const current = parseInt(newQuantity || '0', 10);
    const newQty = adjustmentMode === 'add' ? current + adj : current - adj;
    if (newQty < 0) { Alert.alert('Errore quantità', 'La quantità risultante sarebbe negativa. Inserisci un valore più piccolo.'); return; }
    Alert.alert('Conferma modifica quantità', `Sei sicuro di voler ${adjustmentMode === 'add' ? 'aggiungere' : 'rimuovere'} ${adj} alla quantità (attuale: ${current})? Risultato: ${newQty}`, [
      { text: 'Annulla', style: 'cancel' }, 
      { text: 'Conferma', onPress: () => { setNewQuantity(newQty.toString()); setAdjustmentMode(null); setAdjustmentValue(''); } }
    ]);
  };

  const confirmRenameLocationInMgr = () => {
    const oldName = editingLocationInMgr;
    const newName = editingLocationNewNameInMgr.trim();
    
    if (!oldName || !newName) {
      Alert.alert('Nome non valido', 'Inserisci un nome valido per l\'ubicazione.');
      return;
    }
    
    if (newName === oldName) {
      setEditingLocationInMgr(null);
      setEditingLocationNewNameInMgr('');
      return;
    }
    
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
            const updatedLocations = locations.map(l => l === oldName ? newName : l);
            await saveLocations(updatedLocations);
            
            const updatedItems = items.map(item => item.location === oldName ? { ...item, location: newName } : item);
            await saveItems(updatedItems);
            
            if (newLocation === oldName) setNewLocation(newName);
            if (selectedLocationForMgr === oldName) setSelectedLocationForMgr(newName);
            
            setEditingLocationInMgr(null);
            setEditingLocationNewNameInMgr('');
            
            Alert.alert('Rinomina completata', `"${oldName}" rinominata in "${newName}".`);
          }
        }
      ]
    );
  };

  // --- Location Manager functions ---
  const openLocationManager = () => {
    setSelectedLocationForMgr(locations.length > 0 ? locations[0] : null);
    setMgrSelectedItemIds([]);
    setMgrTargetLocation(null);
    setAddingLocationInMgr(false);
    setNewLocationNameInMgr('');
    setEditingLocationInMgr(null);
    setEditingLocationNewNameInMgr('');
    setLocationMgrVisible(true);
  };

  const toggleMgrSelectItem = (id: string) => {
    setMgrSelectedItemIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const reassignMgrItems = () => {
    if (!selectedLocationForMgr) { Alert.alert('Seleziona ubicazione','Scegli prima una ubicazione da cui prendere gli oggetti.'); return; }
    if (!mgrTargetLocation) { Alert.alert('Seleziona destinazione','Scegli una ubicazione di destinazione.'); return; }
    if (mgrTargetLocation === selectedLocationForMgr) { Alert.alert('Stessa ubicazione','La destinazione è identica all\'origine.'); return; }
    if (mgrSelectedItemIds.length === 0) { Alert.alert('Nessun oggetto selezionato','Seleziona almeno un oggetto da riassegnare.'); return; }

    const queue = mgrSelectedItemIds.slice();
    const target = mgrTargetLocation;
    setReassignQueue(queue);
    setReassignTarget(target);
    setLocationMgrVisible(false);
    setTimeout(() => processNextReassign(queue, target), 200);
  };

  const processNextReassign = async (queueParam?: string[], targetParam?: string | null) => {
    let queue = Array.isArray(queueParam) ? queueParam.slice() : reassignQueue.slice();
    const target = typeof targetParam !== 'undefined' ? targetParam : reassignTarget;

    setMgrSelectedItemIds([]);

    if (queue.length === 0) {
      setReassignTarget(null);
      setReassignQueue([]);
      return;
    }

    const currentId = queue.shift()!;
    setReassignQueue(queue);

    const movingItem = items.find(i => i.id === currentId);
    if (!movingItem || !target) {
      setTimeout(() => processNextReassign(queue, target), 50);
      return;
    }

    const titleLower = movingItem.title.trim().toLowerCase();
    const duplicatesInTarget = items.filter(i => i.title.trim().toLowerCase() === titleLower && i.location === target && i.id !== movingItem.id);

    if (duplicatesInTarget.length === 0) {
      const updated = items.map(i => i.id === movingItem.id ? { ...i, location: target } : i);
      await saveItems(updated);
      Alert.alert('Riassegnazione completata', `"${movingItem.title}" spostato in "${target}".`);
      setTimeout(() => processNextReassign(queue, target), 50);
      return;
    }

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

    setDuplicateCandidates(duplicatesInTarget);
    setDuplicateContextMode('reassign');
    setDuplicateContextMovingItemId(movingItem.id);
    setTimeout(() => setDuplicatePickerVisible(true), 200);
    return;
  };

  // --- UI and rendering ---
  useEffect(() => {
    const filtered = items.filter(item => 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.location.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredItems(filtered);
  }, [searchQuery, items]);

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
      <LocationManagerModal
        visible={locationMgrVisible}
        onClose={() => setLocationMgrVisible(false)}
        locations={locations}
        items={items}
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
        resetModal={resetModal}
        openImagePicker={openImagePicker}
        confirmAndRemoveImage={confirmAndRemoveImage}
        showImageDebugActions={showImageDebugActions}
      />
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}

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
