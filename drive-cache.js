// Account-scoped, bounded browser cache for small Drive asset packages.
// Tokens and credentials are never persisted here.
(function () {
"use strict";
const DB_NAME = "cosmi.drive.assets.v1", STORE = "packages", SCHEMA = 1;
const PREF_KEY = "cosmi.drive.preferences.v1";
const MAX_PACKAGE_BYTES = 24 * 1024 * 1024;
const MAX_TOTAL_BYTES = 80 * 1024 * 1024;
const MAX_PACKAGES = 80;
const DEFAULTS = Object.freeze({cacheEnabled:true,autoSync:true,ttlMinutes:60});
const TTL_VALUES = [15,60,360,1440];
let dbPromise;

function preferences() {
 let saved = {};
 try { saved = JSON.parse(window.localStorage?.getItem(PREF_KEY) || "{}") || {}; } catch (_) {}
 return {
  cacheEnabled: typeof saved.cacheEnabled === "boolean" ? saved.cacheEnabled : DEFAULTS.cacheEnabled,
  autoSync: typeof saved.autoSync === "boolean" ? saved.autoSync : DEFAULTS.autoSync,
  ttlMinutes: TTL_VALUES.includes(saved.ttlMinutes) ? saved.ttlMinutes : DEFAULTS.ttlMinutes
 };
}
function updatePreferences(patch) {
 const current = preferences(), next = {...current};
 if (typeof patch.cacheEnabled === "boolean") next.cacheEnabled = patch.cacheEnabled;
 if (typeof patch.autoSync === "boolean") next.autoSync = patch.autoSync;
 if (TTL_VALUES.includes(Number(patch.ttlMinutes))) next.ttlMinutes = Number(patch.ttlMinutes);
 try { window.localStorage?.setItem(PREF_KEY, JSON.stringify(next)); } catch (_) {}
 return next;
}
function namespace(rootId, permissionId) {
 if (!rootId || !permissionId) return "";
 return "v" + SCHEMA + ":" + encodeURIComponent(rootId) + ":" + encodeURIComponent(permissionId);
}
function getDb() {
 if (!dbPromise) dbPromise = new Promise(resolve => {
  if (!window.indexedDB) return resolve(null);
  let req;
  try { req = window.indexedDB.open(DB_NAME, SCHEMA); } catch (_) { return resolve(null); }
  req.onupgradeneeded = () => {
   const db = req.result;
   if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, {keyPath:"key"});
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => resolve(null);
  req.onblocked = () => resolve(null);
 });
 return dbPromise;
}
function operation(db, mode, run) {
 return new Promise(resolve => {
  try {
   const tx = db.transaction(STORE,mode), store = tx.objectStore(STORE);
   let result = null;
   tx.oncomplete = () => resolve(result);
   tx.onerror = () => resolve(null);
   tx.onabort = () => resolve(null);
   run(store, value => { result = value; });
  } catch (_) { resolve(null); }
 });
}
async function records(ns) {
 const db = await getDb();
 if (!db || !ns) return [];
 const all = await operation(db,"readonly",(store,done) => {
  const req = store.getAll();
  req.onsuccess = () => done(req.result);
 });
 return (all || []).filter(x => x && x.namespace === ns && x.schema === SCHEMA);
}
async function getPackages(ns, ttlMinutes = preferences().ttlMinutes) {
 if (!preferences().cacheEnabled) return [];
 const now = Date.now(), ttl = ttlMinutes * 60 * 1000;
 const list = await records(ns);
 return list.filter(x => now >= x.savedAt && now - x.savedAt <= ttl)
   .sort((a,b) => b.savedAt - a.savedAt);
}
function bytesOf(raw) {
 return Object.values(raw || {}).reduce((sum, value) => sum + (value?.byteLength || 0), 0);
}
async function prune(ns) {
 const list = (await records(ns)).sort((a,b) => b.savedAt - a.savedAt);
 const keep = [], remove = []; let bytes = 0;
 for (const record of list) {
  if (keep.length >= MAX_PACKAGES || bytes + record.bytes > MAX_TOTAL_BYTES) remove.push(record.key);
  else { keep.push(record); bytes += record.bytes; }
 }
 if (!remove.length) return;
 const db = await getDb();
 if (db) await operation(db,"readwrite",store => remove.forEach(key => store.delete(key)));
}
async function putPackage(ns, data) {
 if (!ns || !preferences().cacheEnabled || !data?.entry?.id || !data.raw) return false;
 const bytes = bytesOf(data.raw);
 if (!bytes || bytes > MAX_PACKAGE_BYTES) return false;
 const db = await getDb();
 if (!db) return false;
 const key = ns + "|" + data.entry.id;
 const record = { ...data, key, namespace:ns, schema:SCHEMA, bytes, savedAt:Date.now() };
 const result = await operation(db,"readwrite",(store,done) => {
  const req = store.put(record);
  req.onsuccess = () => done(true);
 });
 if (result) await prune(ns);
 return !!result;
}
async function removePackage(ns, folderId) {
 const db = await getDb();
 if (!db || !ns || !folderId) return false;
 const key = ns + "|" + folderId;
 return !!(await operation(db,"readwrite",(store,done) => {
  const req = store.delete(key);
  req.onsuccess = () => done(true);
 }));
}
async function clear(ns) {
 const db = await getDb();
 if (!db || !ns) return false;
 const keys = (await records(ns)).map(x => x.key);
 if (!keys.length) return true;
 return !!(await operation(db,"readwrite",(store,done) => {
  keys.forEach(key => store.delete(key));
  done(true);
 }));
}
async function stats(ns) {
 const list = await records(ns);
 return {count:list.length,bytes:list.reduce((sum,x) => sum + (x.bytes || 0),0),
  supported:!!(await getDb())};
}
window.COSMI_DRIVE_CACHE = Object.freeze({
 preferences,updatePreferences,namespace,getPackages,putPackage,removePackage,clear,stats
});
})();
