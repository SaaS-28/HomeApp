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
  const [addingLocation, setAddingLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');

  const [editingLocation, setEditingLocation] = useState<string | null>(null);
  const [editingLocationNewName, setEditingLocationNewName] = useState('');

  const [adjustmentMode, setAdjustmentMode] = useState<'add' | 'remove' | null>(null);
  const [adjustmentValue, setAdjustmentValue] = useState('');

  // Location Manager modal states
  const [locationMgrVisible, setLocationMgrVisible] = useState(false);
  const [selectedLocationForMgr, setSelectedLocationForMgr] = useState<string | null>(null);
  const [mgrSelectedItemIds, setMgrSelectedItemIds] = useState<string[]>([]);
  const [mgrTargetLocation, setMgrTargetLocation] = useState<string | null>(null);

  // Settings / debug mode
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  // Reassign flow context (for handling duplicates during reassign)
  const [reassignQueue, setReassignQueue] = useState<string[]>([]);
  const [reassignTarget, setReassignTarget] = useState<string | null>(null);

  // Duplicate selection modal states (used both for create and reassign)
  const [duplicatePickerVisible, setDuplicatePickerVisible] = useState(false);
  const [duplicateCandidates, setDuplicateCandidates] = useState<InventoryItem[]>([]);
  const [duplicateContextNewQuantity, setDuplicateContextNewQuantity] = useState(0); // store newQuantity to add for create flow
  const [duplicateContextMode, setDuplicateContextMode] = useState<'create'|'reassign'|null>(null);
  const [duplicateContextMovingItemId, setDuplicateContextMovingItemId] = useState<string | null>(null); // for reassign

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
        // savedUri è ora un file in DocumentDirectory dell'app (file://...)
        setNewImages(prev => [...prev, savedUri]);
      } catch (e) {
        console.error('Errore compress/save image', e);
        Alert.alert('Errore immagine', 'Non è stato possibile processare l\'immagine.');
      }
    }
  };

  /**
   * Compress + save image where possible.
   * - If documentDirectory/cacheDirectory available -> saves a persistent copy in <base>/images/
   * - Otherwise returns the temporary URI returned by ImageManipulator (usable but non-persistente in alcuni ambienti)
   *
   * opts: { maxWidth?: number; maxSizeKB?: number }
   */
  const compressAndSaveImage = async (
    uri: string,
    opts: { maxWidth?: number; maxSizeKB?: number } = {}
  ): Promise<string> => {
    const maxWidth = opts.maxWidth ?? 1280;
    const targetKB = opts.maxSizeKB ?? 250;

    // Safely read size (type-guard)
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

    // prefer documentDirectory, fallback cacheDirectory; these can be null in some runtimes (es. web)
    const baseDir: string | null =
      (FileSystem as any).documentDirectory ||
      (FileSystem as any).cacheDirectory ||
      null;

    // directory where we'd like to save images if possible
    const imagesDir = baseDir ? `${baseDir}images/` : null;
    const filename = `img_${Date.now()}.jpg`;
    const finalPath = imagesDir ? `${imagesDir}${filename}` : null;

    // Ensure images directory exists if we can write to baseDir
    if (imagesDir) {
      try {
        const dirInfo = await FileSystem.getInfoAsync(imagesDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(imagesDir, { intermediates: true });
        }
      } catch (e) {
        console.warn('Warning: creazione directory immagini non riuscita', e);
        // fallthrough: continueremo comunque provando a salvare/ritornare il tmpUri
      }
    }

    let lastSaved: string | null = null;
    let quality = 0.9;
    const minQuality = 0.35;

    while (quality >= minQuality) {
      try {
        // manipola immagine (restituisce un file temporaneo, tipicamente in cache)
        const manipResult = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: maxWidth } }],
          { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
        );

        const tmpUri = manipResult.uri;

        // Se non abbiamo una directory persistente, ritorniamo il tmpUri (questo evita il throw)
        if (!finalPath) {
          // Proviamo comunque a controllare dimensione e, se necessario, accettare tmpUri
          const tmpSize = await getSizeKB(tmpUri);
          if (tmpSize !== null && tmpSize <= targetKB) return tmpUri;
          // Se è troppo grande, proviamo a diminuire quality e ripetere; ma non possiamo spostare il file in posizione "finale"
          lastSaved = tmpUri;
          quality -= 0.15;
          continue;
        }

        // Proviamo a muovere/copiare il tmpUri in finalPath (persistente)
        try {
          await FileSystem.moveAsync({ from: tmpUri, to: finalPath });
        } catch (moveErr) {
          try {
            await FileSystem.copyAsync({ from: tmpUri, to: finalPath });
          } catch (copyErr) {
            // fallback: downloadAsync (utile per alcuni schemi)
            await FileSystem.downloadAsync(tmpUri, finalPath);
          }
        }

        lastSaved = finalPath;
        const sizeKB = await getSizeKB(finalPath);
        if (sizeKB === null) return finalPath;
        if (sizeKB <= targetKB) return finalPath;

        // troppo grande -> riduci quality e riprova (sovrascrive finalPath)
        quality -= 0.15;
      } catch (err) {
        console.warn('compressAndSaveImage inner error:', err);
        // fallback finale: se abbiamo finalPath proviamo a downloadAsync(uri, finalPath)
        if (finalPath) {
          try {
            await FileSystem.downloadAsync(uri, finalPath);
            return finalPath;
          } catch (downloadErr) {
            // se anche il download fallisce, non scartare tutto: se abbiamo un tmp salvato precedentemente, ritorna quello
            if (lastSaved) return lastSaved;
            throw err;
          }
        } else {
          // non abbiamo finalPath: ritorniamo ultimo tmp se c'è, altrimenti rilanciamo
          if (lastSaved) return lastSaved;
          throw err;
        }
      }
    }

    // se siamo usciti dal loop e abbiamo qualcosa -> ritorna l'ultimo file (persistente o temporaneo)
    if (lastSaved) return lastSaved;

    // ultima risorsa: se abbiamo finalPath proviamo download, altrimenti rilanciamo errore
    if (finalPath) {
      await FileSystem.downloadAsync(uri, finalPath);
      return finalPath;
    }

    throw new Error('compressAndSaveImage: impossibile ottenere o creare un file immagine.');
  };

  const getImageDebugInfo = async (uri: string) : Promise<{ exists: boolean; uri: string; sizeKB: number | null; persisted: boolean }> => {
    // type-safe getInfo
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
            // 1️⃣ Rimuove l’immagine dalla lista (UI)
            setNewImages(prev => prev.filter(u => u !== uri));

            // 2️⃣ Prova a cancellare il file locale collegato
            try {
              await deleteLocalImage(uri); // <-- funzione che ti ho dato prima
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
              // rimuovi anche dalla UI se presente nelle nuove immagini
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
      const payload = {
        exportedAt: new Date().toISOString(),
        inventory: invRaw ? JSON.parse(invRaw) : [],
        locations: locRaw ? JSON.parse(locRaw) : []
      };
      const json = JSON.stringify(payload, null, 2);
      const filename = `casaapp_export_${Date.now()}.json`;
      // safe access to cache/document directory (TypeScript-safe)
      const baseCache: string = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || '';
      const tmpUri = `${baseCache}${filename}`;
      // omit explicit EncodingType — default is UTF-8 in expo-file-system
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
      // cast to any to avoid TS discrepancies in expo-document-picker types
      const res: any = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (!res || res.type !== 'success' || !res.uri) return;
      const pickedUri: string = res.uri;
      const content = await FileSystem.readAsStringAsync(pickedUri, { encoding: (FileSystem as any).EncodingType.UTF8 });
      const parsed = JSON.parse(content);
      const inv = Array.isArray(parsed.inventory) ? parsed.inventory : null;
      const locs = Array.isArray(parsed.locations) ? parsed.locations : null;
      if (!inv || !locs) { Alert.alert('Importazione', 'File non valido o non compatibile.'); return; }

      Alert.alert('Importazione DB', 'Scegli modalità di importazione', [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Sostituisci', onPress: async () => {
            await AsyncStorage.setItem('inventory', JSON.stringify(inv));
            await AsyncStorage.setItem('locations', JSON.stringify(locs));
            await loadItems();
            await loadLocations();
            Alert.alert('Importazione', 'Dati importati (sostituiti).');
          }
        },
        { text: 'Unisci', onPress: async () => {
            // merge inventory by title+location (case-insensitive); keep existing items, add new ones not already present
            const existingKeys = new Set(items.map(i => `${i.title.trim().toLowerCase()}||${i.location}`));
            const toAdd = inv.filter((i: InventoryItem) => {
              const key = `${(i.title||'').trim().toLowerCase()}||${i.location}`;
              return !existingKeys.has(key);
            });
            const mergedItems = [...items, ...toAdd];
            // merge locations
            const locSet = new Set([...locations, ...locs]);
            const mergedLocs = Array.from(locSet);
            await AsyncStorage.setItem('inventory', JSON.stringify(mergedItems));
            await AsyncStorage.setItem('locations', JSON.stringify(mergedLocs));
            await loadItems();
            await loadLocations();
            Alert.alert('Importazione', `Importazione completata. Aggiunti ${toAdd.length} oggetti e ${mergedLocs.length - locations.length} ubicazioni nuove (se presenti).`);
          }
        }
      ]);
    } catch (e) {
      console.warn('importDatabase error', e);
      Alert.alert('Errore', 'Importazione fallita.');
    }
  };

  const openModalForNewItem = () => {
    setEditingItem(null);
    setNewTitle('');
    setNewQuantity('');
    setNewLocation('');
    setNewDescription('');
    setNewImages([]);
    setAddingLocation(false);
    setNewLocationName('');
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
    setAddingLocation(false);
    setNewLocationName('');
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
    setAddingLocation(false);
    setNewLocationName('');
    setAdjustmentMode(null);
    setAdjustmentValue('');
    setImageToView(null);
    setOriginalSnapshot(null);
    setEditingLocation(null);
    setEditingLocationNewName('');
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

      // If there are NO duplicates, create normally
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

      // If exactly one existing match -> offer aggregate OR create anyway
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

      // If more than one existing match -> force the user to choose (open picker)
      if (duplicatesAnyLocation.length > 1) {
        setDuplicateCandidates(duplicatesAnyLocation);
        setDuplicateContextNewQuantity(parseInt(newQuantity));
        setDuplicateContextMode('create');
        // close create modal and open picker
        setModalVisible(false);
        setTimeout(() => setDuplicatePickerVisible(true), 200);
        return;
      }
    }
  };

  const onDuplicateCandidatePress = (candidate: InventoryItem) => {
    if (duplicateContextMode === 'create') {
      // conferma aggiunta quantità al candidato selezionato (create flow)
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
      // Reassign flow: aggregate this moving item into selected candidate
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
            // add quantity to candidate and remove moving item
            const updated = items.map(i => i.id === candidate.id ? { ...i, quantity: i.quantity + movingItem.quantity } : i).filter(i => i.id !== movingId);
            await saveItems(updated);
            Alert.alert('Operazione completata', `Quantità aggiunta a "${candidate.title}". Oggetto spostato rimosso.`);
            // cleanup and proceed to next in queue
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

  const addLocation = async (loc: string) => {
    if (!loc) return;
    if (locations.includes(loc)) { Alert.alert('Ubicazione già presente','Attenzione, l\'ubicazione che stai cercando di inserire esiste già, vuoi selezionarla?',[{ text: 'No', style: 'cancel' },{ text: 'Sì', onPress: () => setNewLocation(loc) }]); return; }
    const newLocs = [...locations, loc]; await saveLocations(newLocs); setNewLocation(loc);
  };

  // delete only if empty
  const confirmAndDeleteLocation = (loc: string) => {
    const used = items.some(it => it.location === loc);
    if (used) {
      Alert.alert('Impossibile eliminare', `L'ubicazione "${loc}" contiene degli oggetti e non può essere eliminata.`);
      return;
    }
    Alert.alert('Conferma eliminazione', `Eliminare l'ubicazione "${loc}"?`, [
      { text: 'Annulla', style: 'cancel' }, { text: 'Elimina', style: 'destructive', onPress: async () => { await deleteLocation(loc); } }
    ]);
  };

  const deleteLocation = async (loc: string) => {
    const updatedLocations = locations.filter(l => l !== loc);
    await saveLocations(updatedLocations);
    // ensure no item keeps it (shouldn't) -> clear
    const updatedItems = items.map(item => item.location === loc ? { ...item, location: '' } : item);
    await saveItems(updatedItems);
    if (newLocation === loc) setNewLocation('');
    Alert.alert('Eliminazione Ubicazione', `Ubicazione "${loc}" eliminata correttamente.`);
  };

  const handleConfirmAdjustment = () => {
    const adj = parseInt(adjustmentValue || '0', 10);
    if (isNaN(adj) || adj <= 0) { Alert.alert('Valore non valido', 'Inserisci un numero intero maggiore di 0.'); return; }
    const current = parseInt(newQuantity || '0', 10);
    const newQty = adjustmentMode === 'add' ? current + adj : current - adj;
    if (newQty < 0) { Alert.alert('Errore quantità', 'La quantità risultante sarebbe negativa. Inserisci un valore più piccolo.'); return; }
    Alert.alert('Conferma modifica quantità', `Sei sicuro di voler ${adjustmentMode === 'add' ? 'aggiungere' : 'rimuovere'} ${adj} alla quantità (attuale: ${current})? Risultato: ${newQty}`, [
      { text: 'Annulla', style: 'cancel' }, { text: 'Conferma', onPress: () => { setNewQuantity(newQty.toString()); setAdjustmentMode(null); setAdjustmentValue(''); } }
    ]);
  };

  const confirmRenameLocation = (oldName: string, newName: string) => {
    if (!newName || newName.trim() === '') { Alert.alert('Nome non valido','Inserisci un nome valido per l\'ubicazione.'); return; }
    if (locations.includes(newName) && newName !== oldName) { Alert.alert('Nome già esistente','Esiste già un\'altra ubicazione con questo nome. Scegli un nome diverso.'); return; }
    Alert.alert('Conferma rinomina ubicazione', `Rinominare "${oldName}" in "${newName}"? Tutti gli oggetti assegnati a "${oldName}" verranno aggiornati.`, [
      { text: 'Annulla', style: 'cancel' }, { text: 'Conferma', onPress: async () => {
        const updatedLocations = locations.map(l => l === oldName ? newName : l); await saveLocations(updatedLocations);
        const updatedItems = items.map(item => item.location === oldName ? { ...item, location: newName } : item); await saveItems(updatedItems);
        if (newLocation === oldName) setNewLocation(newName);
        setEditingLocation(null); setEditingLocationNewName(''); Alert.alert('Rinomina completata', `"${oldName}" rinominata in "${newName}".`);
      } }
    ]);
  };

  // --- Location Manager functions ---
  const openLocationManager = () => {
    setSelectedLocationForMgr(locations.length > 0 ? locations[0] : null);
    setMgrSelectedItemIds([]);
    setMgrTargetLocation(null);
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

    // build queue and start processing sequentially
    const queue = mgrSelectedItemIds.slice();
    const target = mgrTargetLocation;
    setReassignQueue(queue);
    setReassignTarget(target);
    // close location manager UI while we process
    setLocationMgrVisible(false);
    // start processing using explicit params (avoid race on state updates)
    setTimeout(() => processNextReassign(queue, target), 200);
  };

  const processNextReassign = async (queueParam?: string[], targetParam?: string | null) => {
    // use params if provided, otherwise fall back to state
    let queue = Array.isArray(queueParam) ? queueParam.slice() : reassignQueue.slice();
    const target = typeof targetParam !== 'undefined' ? targetParam : reassignTarget;

    // clear selected ids in UI
    setMgrSelectedItemIds([]);

    if (queue.length === 0) {
      // done
      setReassignTarget(null);
      setReassignQueue([]);
      return;
    }

    const currentId = queue.shift()!; // take first
    // persist updated queue to state so cancellations/continuations work
    setReassignQueue(queue);

    const movingItem = items.find(i => i.id === currentId);
    if (!movingItem || !target) {
      // proceed to next
      // small delay to avoid callstack depth
      setTimeout(() => processNextReassign(queue, target), 50);
      return;
    }

    // check for same-title items in target location (excluding the moving item itself)
    const titleLower = movingItem.title.trim().toLowerCase();
    const duplicatesInTarget = items.filter(i => i.title.trim().toLowerCase() === titleLower && i.location === target && i.id !== movingItem.id);

    if (duplicatesInTarget.length === 0) {
      // safe to move
      const updated = items.map(i => i.id === movingItem.id ? { ...i, location: target } : i);
      await saveItems(updated);
      Alert.alert('Riassegnazione completata', `"${movingItem.title}" spostato in "${target}".`);
      // after move, continue with next
      setTimeout(() => processNextReassign(queue, target), 50);
      return;
    }

    if (duplicatesInTarget.length === 1) {
      // offer aggregate or move anyway
      const targetExisting = duplicatesInTarget[0];
      Alert.alert(
        'Oggetto con stesso titolo presente',
        `In "${target}" esiste già un oggetto "${movingItem.title}" (qta: ${targetExisting.quantity}). Vuoi aggregare la quantità del pezzo spostato (${movingItem.quantity}) o spostare comunque creando un duplicato?`,
        [
          { text: 'Annulla', style: 'cancel', onPress: () => { /* user cancelled this reassign -> skip and continue */ setTimeout(() => processNextReassign(queue, target), 50); } },
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

    // duplicatesInTarget.length > 1 -> force user to choose which to aggregate
    setDuplicateCandidates(duplicatesInTarget);
    setDuplicateContextMode('reassign');
    setDuplicateContextMovingItemId(movingItem.id);
    // open picker to choose target to aggregate into
    setTimeout(() => setDuplicatePickerVisible(true), 200);
    return;
  };

  // called after a candidate was used for aggregation reassign; processNextReassign() is invoked there

  // --- UI and rendering ---
  useEffect(() => {
    const filtered = items.filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase()) || item.location.toLowerCase().includes(searchQuery.toLowerCase()) || item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    setFilteredItems(filtered);
  }, [searchQuery, items]);

  const renderItem = ({ item }: { item: InventoryItem }) => (
    <TouchableOpacity style={styles.itemContainer} onPress={() => openModalForEditItem(item)}>
      <TouchableOpacity onPress={() => openModalForEditItem(item)} onLongPress={() => { if (debugMode && item.images[0]) showImageDebugActions(item.images[0]); }} delayLongPress={2000}>
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
        <TextInput style={styles.searchInput} placeholder="Cerca oggetto, ubicazione o descrizione..." value={searchQuery} onChangeText={setSearchQuery} />
      </View>

      <FlatList data={filteredItems} renderItem={renderItem} keyExtractor={item => item.id} ListEmptyComponent={items.length > 0 ? (<View style={styles.emptyContainer}><Text>Nessun risultato trovato</Text></View>) : null} />

      {/* floating buttons container (location manager + add item) */}
      <View style={styles.fabContainer}>
        <TouchableOpacity style={[styles.fab, { backgroundColor: '#8E8E93', marginRight: 10 }]} onPress={() => setSettingsVisible(true)}>
          <Text style={styles.addButtonText}>Impostazioni</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.fab, { backgroundColor: '#34C759', marginRight: 10 }]} onPress={openLocationManager}>
          <Text style={styles.addButtonText}>Gestione Ubicazioni</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.fab, { backgroundColor: '#007AFF' }]} onPress={openModalForNewItem}>
          <Text style={styles.addButtonText}>+ Aggiungi nuovo oggetto</Text>
        </TouchableOpacity>
      </View>

      {/* Location Manager Modal */}
      <Modal visible={locationMgrVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={{ padding: 20, flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Gestione Ubicazioni</Text>

            <Text style={{ marginBottom: 6 }}>Seleziona Ubicazione:</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
              {locations.length === 0 && <Text>Nessuna ubicazione disponibile.</Text>}
              {locations.map(loc => (
                <TouchableOpacity key={loc} style={[styles.locationChip, selectedLocationForMgr === loc && styles.locationChipActive]} onPress={() => { setSelectedLocationForMgr(loc); setMgrSelectedItemIds([]); }}>
                  <Text style={{ color: selectedLocationForMgr === loc ? '#fff' : '#000' }}>{loc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ marginBottom: 6 }}>Oggetti in: {selectedLocationForMgr || '-'}</Text>
            <ScrollView style={{ flex: 1, marginBottom: 12 }}>
              {selectedLocationForMgr ? (
                items.filter(it => it.location === selectedLocationForMgr).map(it => (
                  <TouchableOpacity key={it.id} style={styles.mgrItemRow} onPress={() => toggleMgrSelectItem(it.id)}>
                    <View style={{ width: 24, height: 24, borderRadius: 4, borderWidth: 1, borderColor: '#888', justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>{mgrSelectedItemIds.includes(it.id) && <View style={{ width: 12, height: 12, backgroundColor: '#007AFF' }} />}</View>
                    <Text style={{ flex: 1 }}>{it.title} (qta: {it.quantity})</Text>
                  </TouchableOpacity>
                ))
              ) : <Text>Seleziona prima un'ubicazione.</Text>}
            </ScrollView>

            <Text style={{ marginBottom: 6 }}>Riassegna selezionati a:</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <TouchableOpacity style={styles.pickerLike} onPress={() => { /* noop - simple list below */ }}>
                  <Text>{mgrTargetLocation || 'Seleziona destinazione'}</Text>
                </TouchableOpacity>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                  {locations.filter(l => l !== selectedLocationForMgr).map(l => (
                    <TouchableOpacity key={l} style={[styles.locationChipSmall, mgrTargetLocation === l && styles.locationChipActive]} onPress={() => setMgrTargetLocation(l)}>
                      <Text style={{ color: mgrTargetLocation === l ? '#fff' : '#000' }}>{l}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={{ marginLeft: 8 }}>
                <Button title="Riassegna" onPress={reassignMgrItems} />
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Button title="Chiudi" onPress={() => setLocationMgrVisible(false)} />
              <Button title="Elimina ubicazione" color="red" onPress={() => { if (selectedLocationForMgr) confirmAndDeleteLocation(selectedLocationForMgr); else Alert.alert('Seleziona ubicazione','Seleziona prima un\'ubicazione da eliminare.'); }} />
            </View>

          </View>
        </SafeAreaView>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={settingsVisible} animationType="slide" onRequestClose={() => setSettingsVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={{ padding: 20, flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Impostazioni</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text>Modalità debug</Text>
              <Switch value={debugMode} onValueChange={(v) => { setDebugMode(v); if (v) Alert.alert('Debug', 'Modalità debug abilitata. Tieni premuta un\'immagine per 2s per azioni di debug.'); }} />
            </View>
            <Text style={{ color: '#666', marginTop: 6 }}>Se la modalità debug è attiva, premendo a lungo (2s) sulle immagini verranno mostrate azioni di debug (info, elimina file locale).</Text>
            <View style={{ marginTop: 18 }}>
                <Button title="Esporta DB (salva file JSON)" onPress={exportDatabase} />
            </View>
            <View style={{ marginTop: 10 }}>
                <Button title="Importa DB (seleziona file JSON)" onPress={importDatabase} />
            </View>
            <View style={{ marginTop: 20 }}>
              <Button title="Chiudi" onPress={() => setSettingsVisible(false)} />
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Duplicate candidates picker modal */}
      <Modal visible={duplicatePickerVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={{ padding: 20, flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Scegli oggetto esistente</Text>
            <Text style={{ marginBottom: 8 }}>{duplicateContextMode === 'create' ? `Seleziona l'oggetto a cui aggiungere la quantità (${duplicateContextNewQuantity})` : `Seleziona l'oggetto nel target su cui aggregare lo spostamento`}</Text>
            <ScrollView style={{ flex: 1, marginBottom: 12 }}>
              {duplicateCandidates.length === 0 ? (
                <Text>Nessun candidato trovato.</Text>
              ) : duplicateCandidates.map(c => (
                <TouchableOpacity key={c.id} style={styles.mgrItemRow} onPress={() => onDuplicateCandidatePress(c)}>
                  <Image source={{ uri: c.images[0] }} style={{ width: 48, height: 48, borderRadius: 6, marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: 'bold' }}>{c.title}</Text>
                    <Text>Ubicazione: {c.location} — Qta: {c.quantity}</Text>
                    <Text numberOfLines={1} ellipsizeMode="tail">{c.description}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Button title="Annulla" color="gray" onPress={() => { setDuplicatePickerVisible(false); setDuplicateCandidates([]); setDuplicateContextNewQuantity(0); setDuplicateContextMode(null); setDuplicateContextMovingItemId(null); /* continue processing queue if reassign */ if (reassignQueue.length > 0) processNextReassign(); }} />
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Item create/edit modal */}
      <Modal visible={modalVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 200 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{editingItem ? 'Modifica Oggetto' : 'Nuovo Oggetto'}</Text>

              <TextInput placeholder="Titolo" value={newTitle} onChangeText={setNewTitle} style={styles.modalInput} />
              <TextInput placeholder="Quantità" value={newQuantity} onChangeText={setNewQuantity} style={styles.modalInput} keyboardType="numeric" />

              {editingItem && (
                <>
                  <View style={{ flexDirection: 'row', marginBottom: 10, alignItems: 'center' }}>
                    <TouchableOpacity style={[styles.adjustButton, adjustmentMode === 'add' && styles.adjustButtonActive]} onPress={() => setAdjustmentMode(adjustmentMode === 'add' ? null : 'add')}>
                      <Text style={[styles.adjustButtonText, adjustmentMode === 'add' && { color: '#fff' }]}>+ Aggiungi</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.adjustButton, adjustmentMode === 'remove' && styles.adjustButtonActive, { marginLeft: 10 }]} onPress={() => setAdjustmentMode(adjustmentMode === 'remove' ? null : 'remove')}>
                      <Text style={[styles.adjustButtonText, adjustmentMode === 'remove' && { color: '#fff' }]}>- Rimuovi</Text>
                    </TouchableOpacity>
                  </View>
                  {adjustmentMode && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                      <TextInput placeholder={adjustmentMode === 'add' ? 'Quantità da aggiungere' : 'Quantità da rimuovere'} value={adjustmentValue} onChangeText={setAdjustmentValue} style={[styles.modalInput, { flex: 1, height: 36, marginBottom: 0, paddingVertical: 0 }]} keyboardType="numeric" />
                      <Button title="Conferma" onPress={handleConfirmAdjustment} />
                      <Button title="Annulla" color="gray" onPress={() => { setAdjustmentMode(null); setAdjustmentValue(''); }} />
                    </View>
                  )}
                </>
              )}

              <TextInput placeholder="Descrizione" value={newDescription} onChangeText={setNewDescription} style={[styles.modalInput, { height: 120, textAlignVertical: 'top' }]} multiline maxLength={500} />

              <Text style={{ marginBottom: 5 }}>Ubicazioni:</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: 5 }}>
                <TouchableOpacity style={[styles.locationButton, { backgroundColor: '#007AFF' }]} onPress={() => setAddingLocation(true)}>
                  <Text style={{ color: '#fff', fontSize: 14 }}>+</Text>
                </TouchableOpacity>
                {locations.map(loc => (
                  <View key={loc} style={styles.locationBlock}>
                    <View style={[styles.locationButton, newLocation === loc && { backgroundColor: '#007AFF' }]}>
                      <TouchableOpacity onPress={() => setNewLocation(loc)} style={{ flex: 1 }}>
                        <Text numberOfLines={1} ellipsizeMode="tail" style={{ color: newLocation === loc ? '#fff' : '#000', fontSize: 12, paddingHorizontal: 8, flexShrink: 1 }}>{loc}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => { setEditingLocation(loc); setEditingLocationNewName(loc); }} style={{ paddingLeft: 10, paddingRight: 6 }}>
                        <Text style={{ fontSize: 12 }}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => confirmAndDeleteLocation(loc)} style={{ paddingLeft: 6 }}>
                        <Text style={{ fontSize: 12, color: 'red' }}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>

              {addingLocation && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput placeholder="Nuova ubicazione" value={newLocationName} onChangeText={setNewLocationName} style={[styles.modalInput, { flex: 1, height: 36, marginBottom: 0, paddingVertical: 0 }]} />
                  <Button title="Aggiungi" onPress={() => { addLocation(newLocationName); setNewLocationName(''); setAddingLocation(false); }} />
                  <Button title="Annulla" color="gray" onPress={() => { setAddingLocation(false); setNewLocationName(''); }} />
                </View>
              )}

              {editingLocation && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                  <TextInput placeholder="Rinomina ubicazione" value={editingLocationNewName} onChangeText={setEditingLocationNewName} style={[styles.modalInput, { flex: 1, height: 36, marginBottom: 0, paddingVertical: 0 }]} />
                  <Button title="Salva" onPress={() => confirmRenameLocation(editingLocation, editingLocationNewName)} />
                  <Button title="Annulla" color="gray" onPress={() => { setEditingLocation(null); setEditingLocationNewName(''); }} />
                </View>
              )}

              <Text style={{ marginBottom: 5, marginTop: 10 }}>Immagini:</Text>
              <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                {newImages.map(uri => (
                  <View key={uri} style={{ position: 'relative', marginRight: 10 }}>
                    <TouchableOpacity onPress={() => setImageToView(uri)} onLongPress={() => { if (debugMode) showImageDebugActions(uri); }} delayLongPress={2000}>
                      <Image source={{ uri }} style={{ width: screenWidth - 40, height: 200, borderRadius: 8, resizeMode: 'cover' }} />
                    </TouchableOpacity>
                    <TouchableOpacity style={{ position: 'absolute', top: 0, right: 5 }} onPress={() => confirmAndRemoveImage(uri)}>
                      <Text style={{ color: 'red', fontSize: 35 }}>X</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {newImages.length < 5 && (
                  <TouchableOpacity style={[styles.imageButtonSmall, { justifyContent: 'center', alignItems: 'center' }]} onPress={openImagePicker}>
                    <Text style={styles.addButtonTextSmall}>+</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
                {editingItem ? (
                  <>
                    <View style={{ flex: 1, marginRight: 6 }}><Button title="Salva Modifiche" onPress={confirmAndSaveItem} /></View>
                    <View style={{ flex: 1, marginHorizontal: 6 }}><Button title="Elimina" color="red" onPress={() => { if (editingItem) confirmAndDeleteItem(editingItem.id); }} /></View>
                    <View style={{ flex: 1, marginLeft: 6 }}><Button title="Annulla" color="gray" onPress={confirmCancel} /></View>
                  </>
                ) : (
                  <>
                    <View style={{ flex: 1, marginRight: 6 }}><Button title="Salva" onPress={confirmAndSaveItem} /></View>
                    <View style={{ flex: 1, marginLeft: 6 }}><Button title="Annulla" color="gray" onPress={resetModal} /></View>
                  </>
                )}
              </View>

              {imageToView && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
                  <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setImageToView(null)} />
                  <Image source={{ uri: imageToView }} style={{ width: '90%', aspectRatio:1, resizeMode: 'contain' }} />
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 50 },
  searchContainer: { padding: 10 },
  searchInput: { height: 40, borderColor: 'gray', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10 },

  itemContainer: { flexDirection: 'row', padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
  itemImageSmall: { width: 40, height: 40, borderRadius: 5 },
  itemDetails: { flex: 1, marginLeft: 10 },
  itemTitle: { fontSize: 16, fontWeight: 'bold' },

  addButtonFixed: { position: 'absolute', bottom: 20, right: 20, padding: 12, backgroundColor: '#007AFF', borderRadius: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5,},
  addButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign:'center' },
  modalInput: { borderWidth: 1, borderColor: 'gray', borderRadius: 8, padding: 10, marginBottom: 15 },

  imageButtonSmall: { width:40, height:40, borderRadius:5, backgroundColor:'#007AFF', marginRight:5 },
  addButtonTextSmall: { color:'#fff', fontSize:12, fontWeight:'bold' },

  emptyContainer: { flex:1, justifyContent:'center', alignItems:'center', padding:20 },

  locationBlock: { width: '42%', margin: '1%' },
  locationButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 40, borderRadius: 6, backgroundColor: '#eee', paddingHorizontal: 10 },

  adjustButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6, borderWidth: 1, borderColor: '#007AFF' },
  adjustButtonActive: { backgroundColor: '#007AFF' },
  adjustButtonText: { color: '#007AFF', fontWeight: 'bold' },

  locationChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#eee', marginRight: 8, marginBottom: 8 },
  locationChipSmall: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#eee', marginRight: 8 },
  locationChipActive: { backgroundColor: '#007AFF' },
  mgrItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  pickerLike: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 10 },

  fabContainer: {position: 'absolute', bottom: 20, right: 20, flexDirection: 'column', alignItems: 'flex-end'},
  fab: {paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3, elevation: 5, marginBottom: 10},

});
