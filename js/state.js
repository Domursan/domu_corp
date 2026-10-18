import { sb } from './api.js';

export const DEFAULT_SETTINGS = {
  appearance: {
    mode: 'dark',            // dark | light | system
    colorblind: false,
    accent: '#3b82f6',
    seasonal: 'auto',        // auto | off | <clé d'un thème>
    particles: true,
  },
  seasons: [
    { key: 'halloween', name: 'Halloween', emoji: '🎃', start: '10-20', end: '11-02', accent: '#f97316', particle: '🦇', enabled: true },
    { key: 'noel', name: 'Noël', emoji: '🎄', start: '12-01', end: '12-31', accent: '#ef4444', particle: '❄️', enabled: true },
    { key: 'valentin', name: 'Saint-Valentin', emoji: '💘', start: '02-07', end: '02-15', accent: '#ec4899', particle: '💗', enabled: true },
    { key: 'hiver', name: 'Hiver', emoji: '❄️', start: '12-21', end: '03-19', accent: '#7dd3fc', particle: '❄️', enabled: true },
    { key: 'printemps', name: 'Printemps', emoji: '🌸', start: '03-20', end: '06-20', accent: '#f472b6', particle: '🌸', enabled: true },
    { key: 'ete', name: 'Été', emoji: '☀️', start: '06-21', end: '09-21', accent: '#fbbf24', particle: '✨', enabled: true },
    { key: 'automne', name: 'Automne', emoji: '🍂', start: '09-22', end: '12-20', accent: '#fb923c', particle: '🍂', enabled: true },
  ],
  lists: {
    categories: [
      { name: 'Dev', color: '#3b82f6', icon: '💻' }, { name: 'RP', color: '#a855f7', icon: '🎭' },
      { name: 'Perso', color: '#22c55e', icon: '🏠' }, { name: 'Pro', color: '#f59e0b', icon: '💼' },
      { name: 'Autre', color: '#64748b', icon: '📁' },
    ],
    statuses: [
      { name: 'Idée', color: '#94a3b8' }, { name: 'En cours', color: '#3b82f6' }, { name: 'En pause', color: '#f59e0b' },
      { name: 'Terminé', color: '#22c55e' }, { name: 'Archivé', color: '#64748b' },
    ],
    tags: ['Google Sheet', 'Apps Script', 'GitHub Pages', 'Supabase', 'FiveM', 'Jeu'],
    taskStatuses: ['À faire', 'En cours', 'En test', 'Terminé'],
    priorities: [{ name: 'Basse', color: '#94a3b8' }, { name: 'Normale', color: '#3b82f6' }, { name: 'Haute', color: '#f59e0b' }, { name: 'Urgente', color: '#ef4444' }],
    bugKinds: ['Bug', 'Idée', 'Amélioration'],
    bugStatuses: ['Ouvert', 'En cours', 'Corrigé', 'Abandonné'],
    incomeCategories: ['Vente', 'Prestation', 'Graphisme', 'Développement web', 'Conseil', 'Don', 'Autre'],
    expenseCategories: ['Matériel', 'Abonnement', 'Hébergement', 'Publicité', 'Salaire', 'Autre'],
    balanceOnlyCategories: ['Salaire'],
    inventoryCategories: ['Matériel', 'Consommable', 'Licence', 'Autre'],
    contactStatuses: [{ name: 'Prospect', color: '#8fa6c7' }, { name: 'En cours', color: '#4c9bff' }, { name: 'Terminé', color: '#3fa35b' }],
    featureCategories: ['Gestion', 'Comptabilité', 'Agenda', 'Documents', 'Calculateur', 'Interface', 'Accès & comptes', 'Données', 'Autre'],
    deployChecklist: ['Numéro de version augmenté', 'Testé sur la version de test', 'Fichiers déployés', 'Vérifié en ligne'],
  },
  moduleDefaults: {
    Dev: ['links', 'tasks', 'notes', 'changelog', 'tech', 'bugs', 'deploy'],
    RP: ['links', 'tasks', 'notes', 'changelog', 'agenda', 'accounting', 'contacts'],
    Perso: ['links', 'tasks', 'notes', 'agenda', 'files'],
    Pro: ['links', 'tasks', 'notes', 'agenda', 'accounting', 'contacts', 'files'],
    Autre: ['links', 'tasks', 'notes'],
  },
  home: { sort: 'activity', showArchived: false },
  billing: { cap: 100000, days: 14, mode: 'glissant', start: '' },
  format: { currency: '$', currencyPosition: 'before', locale: 'fr-CH' },
  tourDone: false,
  version: 1,
};

export const state = {
  user: null,
  settings: structuredClone(DEFAULT_SETTINGS),
  projects: [],
  project: null,       // projet affiché
};

function deepMerge(base, extra) {
  if (Array.isArray(base)) return Array.isArray(extra) ? extra : base;
  if (typeof base !== 'object' || base === null) return extra === undefined ? base : extra;
  const out = { ...base };
  for (const k in extra || {}) out[k] = k in base ? deepMerge(base[k], extra[k]) : extra[k];
  return out;
}

export async function loadSettings() {
  const { data } = await sb.from('d_settings').select('settings').eq('user_id', state.user.id).maybeSingle();
  if (!data) await sb.from('d_settings').insert({ user_id: state.user.id, settings: {} });
  const saved = data?.settings || {};
  state.settings = deepMerge(structuredClone(DEFAULT_SETTINGS), saved);
  state.settings.version = DEFAULT_SETTINGS.version;
  applyTheme();
}

let saveTimer;
export function saveSettings(immediate = false) {
  clearTimeout(saveTimer);
  // .then() est indispensable : une requête Supabase n'est envoyée que lorsqu'on l'attend.
  const run = () => sb.from('d_settings').upsert({ user_id: state.user.id, settings: state.settings })
    .then(({ error }) => { if (error) console.error('Enregistrement des paramètres impossible :', error); return { error }; });
  if (immediate) return run();
  saveTimer = setTimeout(run, 500);
}

export function resetSettings() {
  const keep = { tourDone: state.settings.tourDone };
  state.settings = { ...structuredClone(DEFAULT_SETTINGS), ...keep };
  applyTheme();
  return saveSettings(true);
}

/** Thème saisonnier actif (ou null). */
export function activeSeason() {
  const a = state.settings.appearance;
  if (a.seasonal === 'off') return null;
  const seasons = state.settings.seasons.filter(s => s.enabled);
  if (a.seasonal !== 'auto') return state.settings.seasons.find(s => s.key === a.seasonal) || null;
  const now = new Date();
  const md = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return seasons.find(s => (s.start <= s.end ? md >= s.start && md <= s.end : md >= s.start || md <= s.end)) || null;
}

const mq = window.matchMedia('(prefers-color-scheme: light)');
mq.addEventListener?.('change', () => applyTheme());

export function applyTheme() {
  const a = state.settings.appearance;
  const root = document.documentElement;
  const mode = a.mode === 'system' ? (mq.matches ? 'light' : 'dark') : a.mode;
  root.dataset.theme = mode;
  root.dataset.colorblind = a.colorblind ? 'true' : 'false';
  const season = activeSeason();
  const accent = season?.accent || a.accent;
  root.style.setProperty('--accent', accent);
  root.dataset.season = season?.key || '';
  document.querySelectorAll('[data-season-emoji]').forEach(el => (el.textContent = season?.emoji || ''));
  renderParticles(season && a.particles ? season.particle || season.emoji : null);
}

function renderParticles(char) {
  let layer = document.getElementById('particles');
  if (!char) { layer?.remove(); return; }
  if (layer && layer.dataset.char === char) return;
  layer?.remove();
  layer = document.createElement('div');
  layer.id = 'particles';
  layer.dataset.char = char;
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 10; i++) {
    const s = document.createElement('span');
    s.textContent = char;
    s.style.left = `${Math.random() * 100}%`;
    s.style.animationDuration = `${12 + Math.random() * 14}s`;
    s.style.animationDelay = `${-Math.random() * 20}s`;
    s.style.fontSize = `${10 + Math.random() * 12}px`;
    layer.appendChild(s);
  }
  document.body.appendChild(layer);
}

export const L = () => state.settings.lists;
