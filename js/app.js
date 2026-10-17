import { sb, list } from './api.js';
import { state, loadSettings, applyTheme, saveSettings, activeSeason, L } from './state.js';
import { esc, icon, toastError } from './ui.js';
import { APP_NAME } from './config.js';
import { renderLogin, renderReset } from './pages/auth.js';
import { startTour, showHelp } from './tour.js';
import { initSearch } from './search.js';

// Rendu automatique des icônes Lucide
let iconQueued = false;
new MutationObserver(() => {
  if (iconQueued) return;
  iconQueued = true;
  requestAnimationFrame(() => { iconQueued = false; window.lucide?.createIcons({ attrs: { 'stroke-width': 1.9 } }); });
}).observe(document.body, { childList: true, subtree: true });

// ---------------------------------------------------------------------
//  Routes
// ---------------------------------------------------------------------
const PAGES = {
  home: () => import('./pages/home.js'),
  features: () => import('./pages/features.js'),
  project: () => import('./pages/project.js'),
  parametres: () => import('./pages/settings.js'),
};

export function parseHash() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (!parts.length) return { name: 'home' };
  if (parts[0] === 'login') return { name: 'login' };
  if (parts[0] === 'reset') return { name: 'reset' };
  if (parts[0] === 'features') return { name: 'features' };
  if (parts[0] === 'parametres') return { name: 'parametres' };
  if (parts[0] === 'p' && parts[1]) return { name: 'project', pid: parts[1], tab: parts[2] || 'overview' };
  return { name: 'home' };
}

export const go = (hash) => { if (location.hash === hash) route(); else location.hash = hash; };
export const projectPath = (pid, tab = '') => `#/p/${pid}${tab ? '/' + tab : ''}`;

let recovering = false;

export async function refreshProjects() {
  state.projects = await list('d_projects', {}, { order: 'name' });
  return state.projects;
}
export const catOf = (name) => L().categories.find(c => c.name === name) || { name: name || 'Sans catégorie', color: '#64748b', icon: '📁' };
export const statusOf = (name) => L().statuses.find(c => c.name === name) || { name: name || '', color: '#64748b' };
export const isArchived = (p) => p.status === 'Archivé';

/** Recharge la liste des projets et redessine le menu. */
export async function refreshNav() {
  await refreshProjects();
  if (document.getElementById('sidebar')) renderSidebar(parseHash());
}

async function route() {
  const r = parseHash();
  document.querySelectorAll('.pop-menu').forEach(x => x.remove());
  if (recovering) { renderReset(); return; }
  if (!state.user) { renderLogin(); return; }
  if (r.name === 'login') return go('#/');
  if (r.name === 'reset') { renderReset(); return; }

  if (r.name === 'project') {
    if (!state.projects.some(p => p.id === r.pid)) await refreshProjects();
    state.project = state.projects.find(p => p.id === r.pid) || null;
    if (!state.project) return go('#/');
  } else state.project = null;

  ensureLayout();
  renderSidebar(r);
  const page = document.getElementById('page');
  page.dataset.page = r.name;
  // Nouveau conteneur à chaque navigation : si un affichage précédent (plus lent)
  // se termine après coup, il écrit dans un élément qui n'est plus à l'écran.
  const holder = document.createElement('div');
  holder.className = 'page-holder';
  holder.innerHTML = '<div class="page-loading"><span class="spinner"></span></div>';
  page.replaceChildren(holder);
  try {
    const mod = await PAGES[r.name]();
    await mod.default({ el: holder, params: r });
  } catch (e) {
    toastError(e);
    holder.innerHTML = `<div class="empty">${icon('circle-alert', 'ic-xl')}<h3>Impossible de charger la page</h3><p>${esc(e.message || e)}</p></div>`;
  }
  page.focus({ preventScroll: true });
  window.scrollTo(0, 0);
  document.body.classList.remove('nav-open');
  if (!state.settings.tourDone && r.name === 'home') setTimeout(() => startTour(), 600);
}

// ---------------------------------------------------------------------
//  Mise en page
// ---------------------------------------------------------------------
function ensureLayout() {
  if (document.getElementById('layout')) return;
  const app = document.getElementById('app');
  app.innerHTML = `
  <div id="layout">
    <aside id="sidebar" data-tour="sidebar"></aside>
    <div class="nav-backdrop" data-nav-close></div>
    <div id="main">
      <header id="topbar">
        <button class="btn-icon burger" data-nav-toggle aria-label="Menu">${icon('menu')}</button>
        <div class="search" data-tour="search">
          ${icon('search')}
          <input id="search-input" type="search" placeholder="Rechercher un projet, un lien, une tâche, une note…" autocomplete="off">
          <kbd>/</kbd>
          <div id="search-results" hidden></div>
        </div>
        <div class="topbar-actions">
          <button class="btn-icon" data-theme-toggle title="Jour / nuit">${icon('sun-moon')}</button>
          <button class="btn-icon" data-help title="Aide de la page" data-tour="help">${icon('circle-help')}</button>
        </div>
      </header>
      <main id="page" tabindex="-1"></main>
    </div>
  </div>`;
  app.addEventListener('click', (e) => {
    if (e.target.closest('[data-nav-toggle]')) document.body.classList.toggle('nav-open');
    if (e.target.closest('[data-nav-close]')) document.body.classList.remove('nav-open');
    if (e.target.closest('[data-help]')) showHelp(parseHash());
    if (e.target.closest('[data-theme-toggle]')) {
      const a = state.settings.appearance;
      a.mode = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(); saveSettings();
    }
    const grp = e.target.closest('[data-grp-toggle]');
    if (grp) {
      const k = grp.dataset.grpToggle;
      const folded = getFolded();
      folded[k] = !folded[k];
      try { localStorage.setItem('domursan.folded', JSON.stringify(folded)); } catch { /* stockage indisponible */ }
      renderSidebar(parseHash());
    }
  });
  initSearch();
}

function getFolded() {
  try { return JSON.parse(localStorage.getItem('domursan.folded') || '{}'); } catch { return {}; }
}

export function renderSidebar(r) {
  const side = document.getElementById('sidebar');
  if (!side) return;
  const season = activeSeason();
  const folded = getFolded();
  const link = (hash, ic, label, active) => `<a href="${hash}" class="nav-link ${active ? 'active' : ''}">${icon(ic)}<span>${esc(label)}</span></a>`;
  const pLink = (p) => {
    const c = catOf(p.category);
    return `<a href="${projectPath(p.id)}" class="nav-link nav-project ${r.pid === p.id ? 'active' : ''}" style="--pc:${esc(p.color || c.color)}">
      <span class="nav-ico">${p.logo_url ? `<img src="${esc(p.logo_url)}" alt="">` : esc(p.icon || c.icon || '📁')}</span><span>${esc(p.name)}</span></a>`;
  };
  const visible = state.projects.filter(p => !isArchived(p) || r.pid === p.id);
  const pinned = visible.filter(p => p.pinned);
  const cats = [...L().categories.map(c => c.name), ...new Set(visible.map(p => p.category || 'Sans catégorie'))].filter((v, i, a) => a.indexOf(v) === i);
  const groups = cats.map(name => ({ name, items: visible.filter(p => !p.pinned && (p.category || 'Sans catégorie') === name) })).filter(g => g.items.length);
  const archivedCount = state.projects.filter(isArchived).length;

  side.innerHTML = `
    <div class="brand"><a href="#/" class="brand-link"><span class="brand-mark">D</span><span class="brand-name">${APP_NAME}</span><span class="brand-season" data-season-emoji>${season?.emoji || ''}</span></a></div>
    <nav class="nav">
      ${link('#/', 'layout-dashboard', 'Accueil', r.name === 'home')}
      ${link('#/features', 'blocks', 'Features', r.name === 'features')}
      ${pinned.length ? `<div class="nav-label">${icon('pin', 'ic-xs')} Épinglés</div>${pinned.map(pLink).join('')}` : ''}
      ${groups.map(g => {
        const c = catOf(g.name);
        return `<button class="nav-label nav-group" data-grp-toggle="${esc(g.name)}" aria-expanded="${!folded[g.name]}">
            <span>${esc(c.icon || '')} ${esc(g.name)}</span><span class="count">${g.items.length}</span>${icon(folded[g.name] ? 'chevron-right' : 'chevron-down', 'ic-xs')}</button>
          ${folded[g.name] ? '' : g.items.map(pLink).join('')}`;
      }).join('')}
      ${!state.projects.length ? '<p class="muted small pad-x">Aucun projet pour l’instant.</p>' : ''}
      ${archivedCount ? `<a href="#/?archives=1" class="nav-sublabel">${archivedCount} projet(s) archivé(s)</a>` : ''}
    </nav>
    <div class="nav nav-bottom">
      ${link('#/parametres', 'settings', 'Paramètres', r.name === 'parametres')}
      <button class="nav-link" data-logout>${icon('log-out')}<span>Déconnexion</span></button>
    </div>`;
  side.querySelector('[data-logout]').onclick = async () => { await sb.auth.signOut(); };
  side.querySelector('.nav-link.active')?.scrollIntoView({ block: 'nearest' });
}

// ---------------------------------------------------------------------
//  Démarrage
// ---------------------------------------------------------------------
async function onSession(session) {
  const prev = state.user?.id;
  state.user = session?.user || null;
  if (!state.user) {
    state.projects = []; state.project = null;
    document.getElementById('app').innerHTML = '';
    return route();
  }
  if (prev !== state.user.id) {
    document.getElementById('app').innerHTML = '';
    try { await loadSettings(); await refreshProjects(); } catch (e) { toastError(e); }
  }
  route();
}

sb.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') { recovering = true; state.user = session?.user || null; renderReset(); return; }
  if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') { state.user = session?.user || state.user; return; }
  if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
    if (event === 'SIGNED_IN' && state.user?.id === session?.user?.id) return;
    setTimeout(() => onSession(session), 0);
  }
});

export async function endRecovery() {
  recovering = false;
  const { data } = await sb.auth.getSession();
  state.user = null;
  history.replaceState(null, '', location.pathname + '#/');
  onSession(data.session);
}

window.addEventListener('hashchange', route);
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !e.target.closest('input,textarea,select,[contenteditable]')) {
    const s = document.getElementById('search-input');
    if (s) { e.preventDefault(); s.focus(); }
  }
});
