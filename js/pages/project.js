import { insert, update } from '../api.js';
import { state, L } from '../state.js';
import { esc, icon, formModal, toast, toastError, emptyState, fmtDate } from '../ui.js';
import { go, projectPath, refreshNav, catOf, statusOf } from '../app.js';
import { projectTabs, moduleByKey } from '../modules/registry.js';

export const PROJECT_FIELDS = (isNew) => [
  { name: 'name', label: 'Nom du projet', required: true, full: true },
  { name: 'category', label: 'Catégorie', type: 'select', empty: false, options: () => L().categories.map(c => ({ value: c.name, label: `${c.icon || ''} ${c.name}` })) },
  { name: 'status', label: 'Statut', type: 'select', empty: false, options: () => L().statuses.map(s => s.name) },
  { name: 'icon', label: 'Icône (emoji)', placeholder: 'ex. 🍷', help: 'Vide = icône de la catégorie.' },
  { name: 'color', label: 'Couleur', type: 'color', default: '#3b82f6' },
  { name: 'logo_url', label: 'Logo', type: 'photo' },
  { name: 'description', label: 'Description', type: 'textarea', full: true, rows: 3 },
  { name: 'tags', label: 'Étiquettes', full: true, placeholder: 'Séparées par des virgules', help: `Suggestions : ${L().tags.join(', ')}` },
  { name: 'start_date', label: 'Début', type: 'date' },
  { name: 'end_date', label: 'Fin', type: 'date' },
  { name: 'pinned', label: 'Épingler dans le menu', type: 'checkbox', full: true },
  isNew ? { name: '_mod', label: 'Les onglets sont choisis selon la catégorie (modifiable ensuite dans Réglages du projet).', type: 'section', icon: 'info' } : null,
].filter(Boolean);

const tagsIn = (v) => (v || '').split(',').map(x => x.trim()).filter(Boolean);

/** Crée (p = null) ou modifie un projet. Retourne le projet enregistré. */
export async function editProject(p = null) {
  const cat = L().categories[0]?.name;
  const values = p ? { ...p, tags: (p.tags || []).join(', ') } : { category: cat, status: L().statuses[1]?.name || L().statuses[0]?.name, color: catOf(cat).color };
  const res = await formModal({ title: p ? `Modifier — ${p.name}` : 'Nouveau projet', fields: PROJECT_FIELDS(!p), values, size: 'lg' });
  if (!res) return null;
  const row = { ...res, tags: tagsIn(res.tags) };
  delete row._mod;
  try {
    let saved;
    if (p) saved = await update('d_projects', p.id, row);
    else saved = await insert('d_projects', { ...row, modules: state.settings.moduleDefaults?.[row.category] || ['links', 'tasks', 'notes'], position: state.projects.length + 1 });
    toast(p ? 'Projet mis à jour' : 'Projet créé');
    await refreshNav();
    return saved;
  } catch (e) { toastError(e); return null; }
}

export default async function ({ el, params }) {
  const p = state.project;
  const tabs = projectTabs(p);
  const tab = tabs.find(t => t.key === params.tab) || tabs[0];
  const c = catOf(p.category);
  const st = statusOf(p.status);

  el.innerHTML = `
    <div class="proj-head" style="--pc:${esc(p.color || c.color)}">
      <span class="proj-logo">${p.logo_url ? `<img src="${esc(p.logo_url)}" alt="">` : esc(p.icon || c.icon || '📁')}</span>
      <div class="grow">
        <h1>${esc(p.name)}</h1>
        <div class="row gap-s wrap">
          <span class="badge" style="background:${esc(c.color)}26;color:${esc(c.color)}">${esc(c.icon || '')} ${esc(c.name)}</span>
          ${p.status ? `<span class="badge" style="background:${esc(st.color)}26;color:${esc(st.color)}">${esc(p.status)}</span>` : ''}
          ${(p.tags || []).map(t => `<span class="badge">#${esc(t)}</span>`).join('')}
          ${p.start_date ? `<span class="muted small">${icon('calendar')} ${fmtDate(p.start_date)}${p.end_date ? ` → ${fmtDate(p.end_date)}` : ''}</span>` : ''}
        </div>
      </div>
      <div class="row gap-s">
        <button class="btn-icon" data-pin title="${p.pinned ? 'Désépingler' : 'Épingler'}">${icon(p.pinned ? 'pin-off' : 'pin')}</button>
        <button class="btn btn-ghost" data-edit>${icon('pencil')} <span class="hide-sm">Modifier</span></button>
      </div>
    </div>
    <nav class="tabs" data-tour="tabs">${tabs.map(t => `<a class="tab ${t.key === tab.key ? 'on' : ''}" href="${projectPath(p.id, t.key)}">${icon(t.icon)}<span>${esc(t.label)}</span></a>`).join('')}</nav>
    <div class="tab-body"><div class="page-loading"><span class="spinner"></span></div></div>`;

  el.querySelector('[data-edit]').onclick = async () => { if (await editProject(p)) go(projectPath(p.id, tab.key)); };
  el.querySelector('[data-pin]').onclick = async () => {
    try { await update('d_projects', p.id, { pinned: !p.pinned }); await refreshNav(); go(projectPath(p.id, tab.key)); } catch (e) { toastError(e); }
  };

  const body = el.querySelector('.tab-body');
  const ctx = { el: body, p, pid: p.id, reload: () => go(projectPath(p.id, tab.key)) };
  try {
    const mod = await (moduleByKey(tab.key) || tabs[0]).mod();
    await mod.default(ctx);
  } catch (e) {
    toastError(e);
    body.innerHTML = emptyState('Impossible de charger cet onglet', e.message || String(e));
  }
  el.querySelector('.tab.on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
}
