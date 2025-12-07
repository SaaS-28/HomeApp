import { useState, useEffect } from 'react';

import { 
  StyleSheet, Text, View, TextInput, FlatList, Image, SafeAreaView, Dimensions,
  TouchableOpacity, Alert, Modal, Button, ScrollView, KeyboardAvoidingView, Platform, Switch
} from 'react-native';

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

/*InventoryItem object e structure*/
interface InventoryItem {
  id: string;
  title: string;
  images: string[];
  quantity: number;
  location: string;
  description: string;
}

export default function App() {
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
  const screenWidth = Dimensions.get('window').width;
  const [originalSnapshot, setOriginalSnapshot] = useState<any>(null);

  useEffect(() => {
    loadItems();
    loadLocations();
  }, []);

  const loadItems = async () => {
    const data = await AsyncStorage.getItem('inventory');
    const parsed: InventoryItem[] = data ? JSON.parse(data) : [];
    setItems(parsed);
    setFilteredItems(parsed);
  };

  const saveItems = async (newItems: InventoryItem[]) => {
    await AsyncStorage.setItem('inventory', JSON.stringify(newItems));
    setItems(newItems);
    setFilteredItems(newItems);
  };

  const loadLocations = async () => {
    const data = await AsyncStorage.getItem('locations');
    const parsed: string[] = data ? JSON.parse(data) : [];
    setLocations(parsed);
  };

  const saveLocations = async (newLocations: string[]) => {
    await AsyncStorage.setItem('locations', JSON.stringify(newLocations));
    setLocations(newLocations);
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
    <TouchableOpacity style={styles.itemContainer} onPress={() => openModalForEditItem(item)}>
      <TouchableOpacity 
        onPress={() => openModalForEditItem(item)} 
        onLongPress={() => { if (debugMode && item.images[0]) showImageDebugActions(item.images[0]); }} 
        delayLongPress={2000}
      >
        <Image source={{ uri: item.images[0] }} style={styles.itemImageSmall} />
      </TouchableOpacity>
      <View style={styles.itemDetails}>
        <Text style={styles.itemTitle}>{item.title}</Text>
        <Text>Quantità: {item.quantity}</Text>
        <Text>Ubicazione: {item.location}</Text>
        <Text numberOfLines={2} ellipsizeMode="tail">{item.description}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput 
          style={styles.searchInput} 
          placeholder="Cerca oggetto, ubicazione o descrizione..." 
          value={searchQuery} 
          onChangeText={setSearchQuery} 
        />
      </View>

      <FlatList 
        data={filteredItems} 
        renderItem={renderItem} 
        keyExtractor={item => item.id} 
        ListEmptyComponent={items.length > 0 ? (
          <View style={styles.emptyContainer}><Text>Nessun risultato trovato</Text></View>
        ) : null} 
      />

      {/* floating buttons container */}
      <View style={styles.fabContainer}>
        <TouchableOpacity 
          style={[styles.fab, { backgroundColor: '#8E8E93', marginRight: 10 }]} 
          onPress={() => setSettingsVisible(true)}
        >
          <Text style={styles.addButtonText}>Impostazioni</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.fab, { backgroundColor: '#34C759', marginRight: 10 }]} 
          onPress={openLocationManager}
        >
          <Text style={styles.addButtonText}>Gestione Ubicazioni</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.fab, { backgroundColor: '#007AFF' }]} 
          onPress={openModalForNewItem}
        >
          <Text style={styles.addButtonText}>+ Aggiungi nuovo oggetto</Text>
        </TouchableOpacity>
      </View>

      {/* Location Manager Modal */}
      <Modal visible={locationMgrVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
            {/* Header */}
            <View style={{ marginBottom: 30, alignItems: 'center' }}>
              <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 8 }}>Gestione Ubicazioni</Text>
              <View style={{ width: 60, height: 4, backgroundColor: '#34C759', borderRadius: 2 }} />
            </View>

            {/* List all locations with add/edit/delete */}
            <View style={styles.sectionCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
                <Text style={styles.sectionTitle}>Tutte le ubicazioni ({locations.length})</Text>
                {!addingLocationInMgr && (
                  <TouchableOpacity 
                    style={{ backgroundColor: '#34C759', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 }}
                    onPress={() => setAddingLocationInMgr(true)}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>+ Aggiungi</Text>
                  </TouchableOpacity>
                )}
              </View>

              {addingLocationInMgr && (
                <View style={{ marginBottom: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' }}>
                  <TextInput
                    placeholder="Nome ubicazione"
                    value={newLocationNameInMgr}
                    onChangeText={setNewLocationNameInMgr}
                    style={styles.modalInput}
                    autoFocus
                  />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1, marginRight: 5 }}>
                      <Button title="Aggiungi" onPress={addLocationInMgr} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 5 }}>
                      <Button 
                        title="Annulla" 
                        color="gray" 
                        onPress={() => {
                          setAddingLocationInMgr(false);
                          setNewLocationNameInMgr('');
                        }} 
                      />
                    </View>
                  </View>
                </View>
              )}

              {locations.length === 0 ? (
                <Text style={{ color: '#666', fontStyle: 'italic', paddingVertical: 20, textAlign: 'center' }}>
                  Nessuna ubicazione presente. Creane una con il pulsante + Aggiungi.
                </Text>
              ) : (
                locations.map(loc => (
                  <View key={loc} style={styles.locationItemRow}>
                    {editingLocationInMgr === loc ? (
                      <View style={{ flex: 1 }}>
                        <TextInput
                          value={editingLocationNewNameInMgr}
                          onChangeText={setEditingLocationNewNameInMgr}
                          style={[styles.modalInput, { marginBottom: 10 }]}
                          autoFocus
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <View style={{ flex: 1, marginRight: 5 }}>
                            <Button title="Salva" onPress={confirmRenameLocationInMgr} />
                          </View>
                          <View style={{ flex: 1, marginLeft: 5 }}>
                            <Button 
                              title="Annulla" 
                              color="gray" 
                              onPress={() => {
                                setEditingLocationInMgr(null);
                                setEditingLocationNewNameInMgr('');
                              }} 
                            />
                          </View>
                        </View>
                      </View>
                    ) : (
                      <>
                        <Text style={{ flex: 1, fontSize: 16, fontWeight: '500' }}>{loc}</Text>
                        <TouchableOpacity 
                          style={styles.iconBtn} 
                          onPress={() => {
                            setEditingLocationInMgr(loc);
                            setEditingLocationNewNameInMgr(loc);
                          }}
                        >
                          <Text style={{ fontSize: 18 }}>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.iconBtn} 
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
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Sposta oggetti tra ubicazioni</Text>
              
              <Text style={{ marginBottom: 8, fontWeight: '600' }}>1. Seleziona ubicazione di origine:</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={{ marginBottom: 15 }}
              >
                {locations.map(loc => (
                  <TouchableOpacity 
                    key={loc} 
                    style={[
                      styles.locationChip, 
                      selectedLocationForMgr === loc && styles.locationChipActive
                    ]} 
                    onPress={() => { 
                      setSelectedLocationForMgr(loc); 
                      setMgrSelectedItemIds([]); 
                    }}
                  >
                    <Text style={{ color: selectedLocationForMgr === loc ? '#fff' : '#000' }}>
                      {loc}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={{ marginBottom: 8, fontWeight: '600' }}>
                2. Seleziona oggetti da spostare:
              </Text>
              <View style={{ maxHeight: 200, marginBottom: 15 }}>
                <ScrollView>
                  {selectedLocationForMgr ? (
                    items.filter(it => it.location === selectedLocationForMgr).length === 0 ? (
                      <Text style={{ fontStyle: 'italic', color: '#666' }}>
                        Nessun oggetto in questa ubicazione
                      </Text>
                    ) : (
                      items.filter(it => it.location === selectedLocationForMgr).map(it => (
                        <TouchableOpacity 
                          key={it.id} 
                          style={styles.mgrItemRow} 
                          onPress={() => toggleMgrSelectItem(it.id)}
                        >
                          <View style={styles.checkbox}>
                            {mgrSelectedItemIds.includes(it.id) && (
                              <View style={styles.checkboxChecked} />
                            )}
                          </View>
                          <Text style={{ flex: 1 }}>{it.title} (qta: {it.quantity})</Text>
                        </TouchableOpacity>
                      ))
                    )
                  ) : (
                    <Text style={{ fontStyle: 'italic', color: '#666' }}>
                      Seleziona prima un'ubicazione di origine
                    </Text>
                  )}
                </ScrollView>
              </View>

              <Text style={{ marginBottom: 8, fontWeight: '600' }}>
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
                      styles.locationChipSmall, 
                      mgrTargetLocation === l && styles.locationChipActive
                    ]} 
                    onPress={() => setMgrTargetLocation(l)}
                  >
                    <Text style={{ color: mgrTargetLocation === l ? '#fff' : '#000' }}>
                      {l}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity 
                style={styles.reassignBtn} 
                onPress={reassignMgrItems}
              >
                <Text style={styles.reassignBtnText}>Sposta oggetti selezionati</Text>
              </TouchableOpacity>
            </View>

            {/* Close Button */}
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setLocationMgrVisible(false)}
            >
              <Text style={styles.closeButtonText}>Chiudi</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={settingsVisible} animationType="slide" onRequestClose={() => setSettingsVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
            {/* Header */}
            <View style={{ marginBottom: 30, alignItems: 'center' }}>
              <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 8 }}>Impostazioni</Text>
              <View style={{ width: 60, height: 4, backgroundColor: '#007AFF', borderRadius: 2 }} />
            </View>

            {/* Debug Mode Card */}
            <View style={styles.settingsCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsCardTitle}>Modalità Debug</Text>
                  <Text style={styles.settingsCardSubtitle}>
                    Visualizza info avanzate sulle immagini
                  </Text>
                </View>
                <Switch 
                  value={debugMode} 
                  onValueChange={(v) => { 
                    setDebugMode(v); 
                    if (v) Alert.alert('Debug', 'Modalità debug abilitata. Tieni premuta un\'immagine per 2s per azioni di debug.'); 
                  }}
                  trackColor={{ false: '#ddd', true: '#81C784' }}
                  thumbColor={debugMode ? '#4CAF50' : '#f4f3f4'}
                  style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
                />
              </View>
              <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' }}>
                <Text style={styles.settingsCardNote}>
                  💡 Premi a lungo (2s) sulle immagini per azioni di debug
                </Text>
              </View>
            </View>

            {/*Dark Mode Section*/}
            <View style={styles.settingsCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsCardTitle}>Modalità Scura</Text>
                  <Text style={styles.settingsCardSubtitle}>
                    Abilita la modalità scura
                  </Text>
                </View>
                <Switch 
                  value={debugMode} 
                  onValueChange={(v) => { 
                    if (v) Alert.alert('Modalità scura', 'Modalità scura abilitata.'); 
                  }}
                  trackColor={{ false: '#ddd', true: '#81C784' }}
                  thumbColor={debugMode ? '#4CAF50' : '#f4f3f4'}
                  style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
                />
              </View>
            </View>

            {/* Database Section */}
            <Text style={styles.sectionHeader}>Database</Text>

            {/* Export Card */}
            <TouchableOpacity 
              style={styles.settingsButton} 
              onPress={exportDatabase}
              activeOpacity={0.7}
            >
              <View style={[styles.buttonIcon, { backgroundColor: '#E3F2FD' }]}>
                <Text style={{ fontSize: 24 }}>📤</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingsButtonTitle}>Esporta Database</Text>
                <Text style={styles.settingsButtonSubtitle}>Salva inventario e immagini in JSON</Text>
              </View>
              <Text style={{ fontSize: 20 }}>›</Text>
            </TouchableOpacity>

            {/* Import Card */}
            <TouchableOpacity 
              style={styles.settingsButton} 
              onPress={importDatabase}
              activeOpacity={0.7}
            >
              <View style={[styles.buttonIcon, { backgroundColor: '#F3E5F5' }]}>
                <Text style={{ fontSize: 24 }}>📥</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingsButtonTitle}>Importa Database</Text>
                <Text style={styles.settingsButtonSubtitle}>Ripristina da file JSON</Text>
              </View>
              <Text style={{ fontSize: 20 }}>›</Text>
            </TouchableOpacity>

            {/* Danger Zone */}
            <Text style={[styles.sectionHeader, { marginTop: 30, color: '#d32f2f' }]}>Zona Pericolo</Text>

            {/* Delete All Card */}
            <TouchableOpacity 
              style={[styles.settingsButton, styles.dangerButton]} 
              onPress={deleteAllData}
              activeOpacity={0.7}
            >
              <View style={[styles.buttonIcon, { backgroundColor: '#FFEBEE' }]}>
                <Text style={{ fontSize: 24 }}>🗑️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingsButtonTitle, { color: '#d32f2f' }]}>Elimina Tutto</Text>
                <Text style={[styles.settingsButtonSubtitle, { color: '#c62828' }]}>
                  Cancella oggetti, immagini e ubicazioni
                </Text>
              </View>
              <Text style={{ fontSize: 20, color: '#d32f2f' }}>›</Text>
            </TouchableOpacity>

            {/* Footer */}
            <View style={{ marginTop: 40, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#e0e0e0', alignItems: 'center' }}>
              <Text style={{ color: '#999', fontSize: 12 }}>CasaApp v1.0</Text>
            </View>

            <View style={{ marginTop: 20 }}>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setSettingsVisible(false)}
              >
                <Text style={styles.closeButtonText}>Chiudi</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Duplicate candidates picker modal */}
      <Modal visible={duplicatePickerVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={{ padding: 20, flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>
              Scegli oggetto esistente
            </Text>
            <Text style={{ marginBottom: 8 }}>
              {duplicateContextMode === 'create' 
                ? `Seleziona l'oggetto a cui aggiungere la quantità (${duplicateContextNewQuantity})` 
                : `Seleziona l'oggetto nel target su cui aggregare lo spostamento`}
            </Text>
            <ScrollView style={{ flex: 1, marginBottom: 12 }}>
              {duplicateCandidates.length === 0 ? (
                <Text>Nessun candidato trovato.</Text>
              ) : duplicateCandidates.map(c => (
                <TouchableOpacity 
                  key={c.id} 
                  style={styles.mgrItemRow} 
                  onPress={() => onDuplicateCandidatePress(c)}
                >
                  <Image 
                    source={{ uri: c.images[0] }} 
                    style={{ width: 48, height: 48, borderRadius: 6, marginRight: 8 }} 
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: 'bold' }}>{c.title}</Text>
                    <Text>Ubicazione: {c.location} — Qta: {c.quantity}</Text>
                    <Text numberOfLines={1} ellipsizeMode="tail">{c.description}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Button 
                title="Annulla" 
                color="gray" 
                onPress={() => { 
                  setDuplicatePickerVisible(false); 
                  setDuplicateCandidates([]); 
                  setDuplicateContextNewQuantity(0); 
                  setDuplicateContextMode(null); 
                  setDuplicateContextMovingItemId(null); 
                  if (reassignQueue.length > 0) processNextReassign(); 
                }} 
              />
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Item create/edit modal */}
      <Modal visible={modalVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={{ flex: 1 }}
          >
            <ScrollView 
              contentContainerStyle={{ padding: 20, paddingBottom: 200 }} 
              keyboardShouldPersistTaps="handled"
            >
              {/* Header */}
              <View style={{ marginBottom: 30, alignItems: 'center' }}>
                <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 8 }}>
                  {editingItem ? 'Modifica Oggetto' : 'Nuovo Oggetto'}
                </Text>
                <View style={{ width: 60, height: 4, backgroundColor: '#007AFF', borderRadius: 2 }} />
              </View>

              {/* Info Section */}
              <View style={styles.formCard}>
                <Text style={styles.formSectionTitle}>Informazioni Base</Text>
                
                <TextInput 
                  placeholder="Titolo" 
                  value={newTitle} 
                  onChangeText={setNewTitle} 
                  style={styles.formInput} 
                  placeholderTextColor="#999"
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
                  style={styles.formInput} 
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />

                <TextInput 
                  placeholder="Descrizione" 
                  value={newDescription} 
                  onChangeText={setNewDescription} 
                  style={[styles.formInput, { height: 100, textAlignVertical: 'top' }]} 
                  multiline 
                  maxLength={500}
                  placeholderTextColor="#999"
                />
              </View>

              {/* Adjustment Section (edit only) */}
              {editingItem && (
                <View style={styles.formCard}>
                  <Text style={styles.formSectionTitle}>Modifica Quantità</Text>
                  <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                    <TouchableOpacity 
                      style={[
                        styles.adjustButtonLarge, 
                        adjustmentMode === 'add' && styles.adjustButtonLargeActive
                      ]} 
                      onPress={() => setAdjustmentMode(adjustmentMode === 'add' ? null : 'add')}
                    >
                      <Text style={{ fontSize: 20, marginBottom: 4 }}>➕</Text>
                      <Text style={[
                        styles.adjustButtonLargeText, 
                        adjustmentMode === 'add' && { color: '#fff' }
                      ]}>
                        Aggiungi
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[
                        styles.adjustButtonLarge, 
                        adjustmentMode === 'remove' && styles.adjustButtonLargeActive,
                        { marginLeft: 10 }
                      ]} 
                      onPress={() => setAdjustmentMode(adjustmentMode === 'remove' ? null : 'remove')}
                    >
                      <Text style={{ fontSize: 20, marginBottom: 4 }}>➖</Text>
                      <Text style={[
                        styles.adjustButtonLargeText, 
                        adjustmentMode === 'remove' && { color: '#fff' }
                      ]}>
                        Rimuovi
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {adjustmentMode && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TextInput 
                        placeholder={adjustmentMode === 'add' ? 'Quantità da aggiungere' : 'Quantità da rimuovere'} 
                        value={adjustmentValue} 
                        onChangeText={setAdjustmentValue} 
                        style={[styles.formInput, { flex: 1, marginBottom: 0 }]} 
                        keyboardType="numeric"
                        placeholderTextColor="#999"
                      />
                      <TouchableOpacity 
                        style={styles.adjConfirmBtn}
                        onPress={handleConfirmAdjustment}
                      >
                        <Text style={styles.adjConfirmBtnText}>✓</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.adjCancelBtn}
                        onPress={() => { 
                          setAdjustmentMode(null); 
                          setAdjustmentValue(''); 
                        }}
                      >
                        <Text style={styles.adjCancelBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {/* Location Section */}
              <View style={styles.formCard}>
                <Text style={styles.formSectionTitle}>Ubicazione</Text>
                <TouchableOpacity 
                  style={styles.dropdownButtonLarge} 
                  onPress={() => setLocationDropdownVisible(!locationDropdownVisible)}
                >
                  <Text style={{ flex: 1, fontSize: 16, color: newLocation ? '#333' : '#999' }}>
                    {newLocation || 'Seleziona ubicazione'}
                  </Text>
                  <Text style={{ fontSize: 16, color: '#007AFF' }}>{locationDropdownVisible ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {locationDropdownVisible && (
                  <View style={styles.dropdownListLarge}>
                    <ScrollView style={{ maxHeight: 150 }}>
                      {locations.length === 0 ? (
                        <Text style={{ padding: 10, fontStyle: 'italic', color: '#999' }}>
                          Nessuna ubicazione. Creane una in "Gestione Ubicazioni".
                        </Text>
                      ) : (
                        locations.map(loc => (
                          <TouchableOpacity 
                            key={loc} 
                            style={[
                              styles.dropdownItemLarge,
                              newLocation === loc && styles.dropdownItemSelectedLarge
                            ]} 
                            onPress={() => {
                              setNewLocation(loc);
                              setLocationDropdownVisible(false);
                            }}
                          >
                            <Text style={{ 
                              color: newLocation === loc ? '#007AFF' : '#333',
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
              <View style={styles.formCard}>
                <Text style={styles.formSectionTitle}>Immagini ({newImages.length}/5)</Text>
                <ScrollView 
                  horizontal 
                  pagingEnabled 
                  showsHorizontalScrollIndicator={false} 
                  style={{ marginBottom: 0 }}
                >
                  {newImages.map(uri => (
                    <View key={uri} style={{ position: 'relative', marginRight: 10 }}>
                      <TouchableOpacity 
                        onPress={() => setImageToView(uri)} 
                        onLongPress={() => { if (debugMode) showImageDebugActions(uri); }} 
                        delayLongPress={2000}
                      >
                        <Image 
                          source={{ uri }} 
                          style={{ 
                            width: screenWidth - 60, 
                            height: 200, 
                            borderRadius: 12, 
                            resizeMode: 'cover' 
                          }} 
                        />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.imageRemoveBtn} 
                        onPress={() => confirmAndRemoveImage(uri)}
                      >
                        <Text style={styles.imageRemoveBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  {newImages.length < 5 && (
                    <TouchableOpacity 
                      style={styles.imageAddBtn} 
                      onPress={openImagePicker}
                    >
                      <Text style={{ fontSize: 32, color: '#fff' }}>+</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>

              {/* Action Buttons */}
              <View style={{ marginTop: 30, gap: 10 }}>
                {editingItem ? (
                  <>
                    <TouchableOpacity 
                      style={styles.primaryButton}
                      onPress={confirmAndSaveItem}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.primaryButtonText}>💾 Salva Modifiche</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.secondaryButton}
                      onPress={confirmCancel}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.secondaryButtonText}>Annulla</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.settingsButton, styles.dangerButton]} 
                      onPress={() => { 
                        if (editingItem) confirmAndDeleteItem(editingItem.id); 
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.buttonIcon, { backgroundColor: '#FFEBEE' }]}>
                        <Text style={{ fontSize: 24 }}>🗑️</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.settingsButtonTitle, { color: '#d32f2f' }]}>Elimina Oggetto</Text>
                        <Text style={[styles.settingsButtonSubtitle, { color: '#c62828' }]}>
                          Rimuovi questo oggetto dall'inventario
                        </Text>
                      </View>
                      <Text style={{ fontSize: 20, color: '#d32f2f' }}>›</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity 
                      style={styles.primaryButton}
                      onPress={confirmAndSaveItem}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.primaryButtonText}>➕ Crea Oggetto</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.secondaryButton}
                      onPress={resetModal}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.secondaryButtonText}>Annulla</Text>
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
                  backgroundColor: 'rgba(0,0,0,0.9)', 
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
    </View>
  );
}

const screenWidth = Dimensions.get('window').width;

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

  modalTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 20, 
    textAlign:'center' 
  },
  modalInput: { 
    borderWidth: 1, 
    borderColor: 'gray', 
    borderRadius: 8, 
    padding: 10, 
    marginBottom: 15 
  },

  imageButtonSmall: { 
    width:40, 
    height:40, 
    borderRadius:5, 
    backgroundColor:'#007AFF', 
    marginRight:5 
  },
  addButtonTextSmall: { color:'#fff', fontSize:12, fontWeight:'bold' },

  emptyContainer: { 
    flex:1, 
    justifyContent:'center', 
    alignItems:'center', 
    padding:20 
  },

  adjustButton: { 
    paddingVertical: 8, 
    paddingHorizontal: 14, 
    borderRadius: 6, 
    borderWidth: 1, 
    borderColor: '#007AFF' 
  },
  adjustButtonActive: { backgroundColor: '#007AFF' },
  adjustButtonText: { color: '#007AFF', fontWeight: 'bold' },

  locationChip: { 
    paddingVertical: 8, 
    paddingHorizontal: 12, 
    borderRadius: 16, 
    backgroundColor: '#eee', 
    marginRight: 8, 
    marginBottom: 8 
  },
  locationChipSmall: { 
    paddingVertical: 6, 
    paddingHorizontal: 10, 
    borderRadius: 12, 
    backgroundColor: '#eee', 
    marginRight: 8 
  },
  locationChipActive: { backgroundColor: '#007AFF' },
  
  mgrItemRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 8, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0' 
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
  },

  // Location Manager styles
  sectionCard: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  addLocationBtn: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addLocationBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  locationItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  iconBtn: {
    padding: 8,
    marginLeft: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#888',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    width: 12,
    height: 12,
    backgroundColor: '#007AFF',
  },
  reassignBtn: {
    backgroundColor: '#34C759',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  reassignBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },

  // Dropdown styles
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  dropdownList: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    backgroundColor: '#fff',
    marginBottom: 15,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemSelected: {
    backgroundColor: '#f0f8ff',
  },

  // Settings styles
  settingsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
       marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  settingsCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  settingsCardSubtitle: {
    fontSize: 13,
    color: '#999',
  },
  settingsCardNote: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#007AFF',
    marginTop: 20,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  dangerButton: {
    borderWidth: 1,
    borderColor: '#ffcdd2',
    backgroundColor: '#fff5f5',
  },
  buttonIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingsButtonTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  settingsButtonSubtitle: {
    fontSize: 12,
    color: '#999',
  },
  closeButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Form styles
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  formSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  formInput: {
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    fontSize: 15,
    color: '#333',
    backgroundColor: '#fafafa',
  },

  // Adjustment buttons
  adjustButtonLarge: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  adjustButtonLargeActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  adjustButtonLargeText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 13,
  },

  adjConfirmBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  adjConfirmBtnText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  adjCancelBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  adjCancelBtnText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },

  // Dropdown large
  dropdownButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fafafa',
  },
  dropdownListLarge: {
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    backgroundColor: '#fff',
    marginBottom: 12,
    overflow: 'hidden',
  },
  dropdownItemLarge: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemSelectedLarge: {
    backgroundColor: '#E3F2FD',
  },

  // Image buttons
  imageAddBtn: {
    width: screenWidth - 60,
    height: 200,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  imageRemoveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  imageRemoveBtnText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },

  // Primary/Secondary/Danger buttons
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
  },
  secondaryButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerButtonLarge: {
  paddingVertical: 16,
  marginTop: 10,
  borderWidth: 2,
  borderColor: '#FF3B30',
},
},
);