import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/+esm';
import { SUPABASE_URL, SUPABASE_KEY, PHOTO_BUCKET, FILE_BUCKET } from './config.js';

// Verrou maison : on évite navigator.locks, qui provoque l'erreur
// « Acquiring an exclusive Navigator LockManager lock … immediately failed »
// quand plusieurs requêtes (ou plusieurs onglets) demandent la session en même temps.
const queues = {};
async function simpleLock(name, _timeout, fn) {
  const prev = queues[name] || Promise.resolve();
  let release;
  const next = new Promise(r => (release = r));
  queues[name] = prev.then(() => next);
  await prev;
  try { return await fn(); } finally { release(); }
}

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true, autoRefreshToken: true, detectSessionInUrl: true,
    storageKey: 'domursan-auth',   // séparé d'Airpé si les deux tournent sur la même adresse
    lock: simpleLock,
  },
});

/** Traduit une erreur Supabase en message lisible. */
export function errMsg(e) {
  if (!e) return 'Erreur inconnue';
  const m = e.message || String(e);
  const map = {
    'Invalid login credentials': 'Email ou mot de passe incorrect.',
    'Email not confirmed': 'Ton email n’est pas encore confirmé (regarde ta boîte mail).',
    'User already registered': 'Un compte existe déjà avec cet email.',
    'Password should be at least 6 characters': 'Le mot de passe doit contenir au moins 6 caractères.',
  };
  for (const k in map) if (m.includes(k)) return map[k];
  if (m.includes('row-level security')) return 'Tu n’as pas les droits pour faire ça.';
  return m;
}

function check({ data, error }) {
  if (error) throw error;
  return data;
}

/** Sélection simple : filters = { col: valeur } ou { col: ['in', [..]] } */
export async function list(table, filters = {}, { order = 'created_at', asc = true, select = '*' } = {}) {
  let q = sb.from(table).select(select);
  for (const [k, v] of Object.entries(filters)) {
    if (Array.isArray(v) && v[0] === 'in') {
      if (!v[1].length) return [];
      q = q.in(k, v[1]);
    } else if (v === null) q = q.is(k, null);
    else q = q.eq(k, v);
  }
  if (order) q = q.order(order, { ascending: asc, nullsFirst: false });
  return check(await q);
}

export async function getOne(table, id) {
  return check(await sb.from(table).select('*').eq('id', id).maybeSingle());
}

export async function insert(table, row) {
  return check(await sb.from(table).insert(row).select().single());
}

export async function update(table, id, patch) {
  return check(await sb.from(table).update(patch).eq('id', id).select().single());
}

export async function upsert(table, row) {
  return check(await sb.from(table).upsert(row).select().single());
}

export async function remove(table, id) {
  check(await sb.from(table).delete().eq('id', id));
}

export async function rpc(fn, args) {
  return check(await sb.rpc(fn, args));
}

/** Redimensionne une image côté navigateur puis l'envoie dans le bucket photos. */
export async function uploadPhoto(file, userId) {
  const blob = await resizeImage(file, 1400);
  const path = `${userId}/${crypto.randomUUID()}.webp`;
  check(await sb.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/webp', upsert: false }));
  return sb.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Envoie un fichier quelconque (documents, captures…) dans le bucket des fichiers. */
export async function uploadFile(file, userId, projectId) {
  const safe = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.\-]+/g, '_');
  const path = `${userId}/${projectId}/${Date.now()}_${safe}`;
  check(await sb.storage.from(FILE_BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false }));
  return { path, url: sb.storage.from(FILE_BUCKET).getPublicUrl(path).data.publicUrl };
}
export async function deleteFile(path) {
  if (path) await sb.storage.from(FILE_BUCKET).remove([path]);
}

export async function deletePhoto(url) {
  if (!url || !url.includes(`/object/public/${PHOTO_BUCKET}/`)) return;
  const path = url.split(`/object/public/${PHOTO_BUCKET}/`)[1];
  await sb.storage.from(PHOTO_BUCKET).remove([path]);
}

function resizeImage(file, max) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * r);
      c.height = Math.round(img.height * r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => (b ? resolve(b) : reject(new Error('Image illisible'))), 'image/webp', 0.85);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('Image illisible'));
    img.src = URL.createObjectURL(file);
  });
}
