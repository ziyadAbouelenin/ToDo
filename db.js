// IndexedDB wrapper for the Weekly Todo PWA.
// Stores:
//   groups  keyed by id, indexed by dateKey  (dateKey = 'YYYY-MM-DD')
//   todos   keyed by id, indexed by groupId
//   strokes keyed by id, indexed by dateKey  (S Pen ink per day)
// Falls back to in-memory + localStorage mirror if IDB is unavailable.

(function (global) {
  const DB_NAME = 'weekly-todo';
  const DB_VERSION = 2;
  const LS_MIRROR_KEY = 'weekly-todo-mirror-v2';

  let dbPromise = null;
  let useFallback = false;
  let memoryStore = null;

  function loadMirror() {
    try {
      const raw = localStorage.getItem(LS_MIRROR_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return { groups: [], todos: [], strokes: [] };
  }

  function saveMirror() {
    if (!memoryStore) return;
    try { localStorage.setItem(LS_MIRROR_KEY, JSON.stringify(memoryStore)); } catch (_) {}
  }

  function openDB() {
    if (dbPromise) return dbPromise;
    if (!global.indexedDB) {
      useFallback = true;
      memoryStore = loadMirror();
      dbPromise = Promise.resolve(null);
      return dbPromise;
    }
    dbPromise = new Promise((resolve) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('groups')) {
          const s = db.createObjectStore('groups', { keyPath: 'id' });
          s.createIndex('dateKey', 'dateKey', { unique: false });
        } else {
          const s = req.transaction.objectStore('groups');
          if (!s.indexNames.contains('dateKey')) s.createIndex('dateKey', 'dateKey', { unique: false });
        }
        if (!db.objectStoreNames.contains('todos')) {
          const s = db.createObjectStore('todos', { keyPath: 'id' });
          s.createIndex('groupId', 'groupId', { unique: false });
        }
        if (!db.objectStoreNames.contains('strokes')) {
          const s = db.createObjectStore('strokes', { keyPath: 'id' });
          s.createIndex('dateKey', 'dateKey', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { useFallback = true; memoryStore = loadMirror(); resolve(null); };
    });
    return dbPromise;
  }

  function tx(stores, mode) {
    return openDB().then((db) => (db ? db.transaction(stores, mode) : null));
  }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function getAll(storeName, fallbackKey) {
    return tx([storeName], 'readonly').then((t) => {
      if (!t) return (memoryStore[fallbackKey] || []).slice();
      return new Promise((res, rej) => {
        const r = t.objectStore(storeName).getAll();
        r.onsuccess = () => res(r.result || []);
        r.onerror = () => rej(r.error);
      });
    });
  }

  function put(storeName, fallbackKey, obj) {
    return tx([storeName], 'readwrite').then((t) => {
      if (!t) {
        const arr = memoryStore[fallbackKey];
        const i = arr.findIndex((x) => x.id === obj.id);
        if (i >= 0) arr[i] = obj; else arr.push(obj);
        saveMirror();
        return obj;
      }
      return new Promise((res, rej) => {
        const r = t.objectStore(storeName).put(obj);
        r.onsuccess = () => res(obj);
        r.onerror = () => rej(r.error);
      });
    });
  }

  function del(storeName, fallbackKey, id) {
    return tx([storeName], 'readwrite').then((t) => {
      if (!t) {
        memoryStore[fallbackKey] = memoryStore[fallbackKey].filter((x) => x.id !== id);
        saveMirror();
        return;
      }
      return new Promise((res, rej) => {
        const r = t.objectStore(storeName).delete(id);
        r.onsuccess = () => res();
        r.onerror = () => rej(r.error);
      });
    });
  }

  async function deleteGroup(id) {
    const t = await tx(['groups', 'todos'], 'readwrite');
    if (!t) {
      memoryStore.groups = memoryStore.groups.filter((g) => g.id !== id);
      memoryStore.todos = memoryStore.todos.filter((td) => td.groupId !== id);
      saveMirror();
      return;
    }
    return new Promise((resolve, reject) => {
      const groupStore = t.objectStore('groups');
      const todoStore = t.objectStore('todos');
      groupStore.delete(id);
      const idx = todoStore.index('groupId');
      idx.openCursor(IDBKeyRange.only(id)).onsuccess = (ev) => {
        const cur = ev.target.result;
        if (cur) { todoStore.delete(cur.primaryKey); cur.continue(); }
      };
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  }

  async function clearStrokesFor(dateKey) {
    const t = await tx(['strokes'], 'readwrite');
    if (!t) {
      memoryStore.strokes = memoryStore.strokes.filter((s) => s.dateKey !== dateKey);
      saveMirror();
      return;
    }
    return new Promise((resolve, reject) => {
      const store = t.objectStore('strokes');
      const idx = store.index('dateKey');
      idx.openCursor(IDBKeyRange.only(dateKey)).onsuccess = (ev) => {
        const cur = ev.target.result;
        if (cur) { store.delete(cur.primaryKey); cur.continue(); }
      };
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  }

  async function migrateV1IfNeeded(weekStartKey) {
    // v1 stored groups with `dayId` ('sat'..'fri') and no `dateKey`.
    // Map weekday → ISO date in the current week.
    const existing = await getAll('groups', 'groups');
    const v1 = existing.filter((g) => g && !g.dateKey && g.dayId);
    if (v1.length === 0) return false;
    const order = ['sat','sun','mon','tue','wed','thu','fri'];
    const ws = fromKeyLocal(weekStartKey);
    for (const g of v1) {
      const idx = order.indexOf(g.dayId);
      const d = new Date(ws); d.setDate(d.getDate() + (idx >= 0 ? idx : 0));
      const y = d.getFullYear();
      const m = String(d.getMonth()+1).padStart(2,'0');
      const da = String(d.getDate()).padStart(2,'0');
      g.dateKey = `${y}-${m}-${da}`;
      delete g.dayId;
      await put('groups', 'groups', g);
    }
    return true;
  }

  function fromKeyLocal(k) {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  async function bulkSeed(groups, todos, weekStartKey) {
    if (weekStartKey) await migrateV1IfNeeded(weekStartKey);
    const existing = await getAll('groups', 'groups');
    const hasNew = existing.some((g) => g && g.dateKey);
    if (hasNew) return false;
    for (const g of groups) await put('groups', 'groups', g);
    for (const td of todos) await put('todos', 'todos', td);
    return true;
  }

  async function exportAll() {
    const [groups, todos, strokes] = await Promise.all([
      getAll('groups','groups'), getAll('todos','todos'), getAll('strokes','strokes'),
    ]);
    return {
      app: 'weekly-todo',
      version: 2,
      exportedAt: new Date().toISOString(),
      groups, todos, strokes,
    };
  }

  async function clearAll() {
    const t = await tx(['groups','todos','strokes'], 'readwrite');
    if (!t) {
      memoryStore.groups = []; memoryStore.todos = []; memoryStore.strokes = [];
      saveMirror(); return;
    }
    return new Promise((resolve, reject) => {
      t.objectStore('groups').clear();
      t.objectStore('todos').clear();
      t.objectStore('strokes').clear();
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  }

  async function importAll(payload, mode) {
    // mode: 'replace' | 'merge'
    if (!payload || !Array.isArray(payload.groups) || !Array.isArray(payload.todos)) {
      throw new Error('Invalid backup file');
    }
    if (mode === 'replace') await clearAll();
    for (const g of payload.groups) {
      if (g && g.id && g.dateKey) await put('groups','groups', g);
    }
    for (const t of payload.todos) {
      if (t && t.id && t.groupId) await put('todos','todos', t);
    }
    for (const s of (payload.strokes || [])) {
      if (s && s.id && s.dateKey) await put('strokes','strokes', s);
    }
  }

  global.WeeklyDB = {
    uid,
    getAllGroups:  () => getAll('groups',  'groups'),
    getAllTodos:   () => getAll('todos',   'todos'),
    getAllStrokes: () => getAll('strokes', 'strokes'),
    putGroup:  (g)  => put('groups',  'groups',  g),
    putTodo:   (t)  => put('todos',   'todos',   t),
    putStroke: (s)  => put('strokes', 'strokes', s),
    deleteGroup,
    deleteTodo:   (id) => del('todos',   'todos',   id),
    deleteStroke: (id) => del('strokes', 'strokes', id),
    clearStrokesFor,
    bulkSeed,
    exportAll,
    importAll,
    clearAll,
    isFallback: () => useFallback,
  };
})(window);
