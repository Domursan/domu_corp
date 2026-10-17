// Catalogue des features : des cartes remplies à la main qui résument chaque fonctionnalité
// (devis, agenda, connexion…) et les projets où elle existe.
import { list, insert, update, remove } from '../api.js';
import { state, L } from '../state.js';
import { esc, icon, modal, formModal, confirmDialog, toast, toastError, emptyState, linkButtons } from '../ui.js';
import { projectPath, catOf } from '../app.js';

const FIELDS = () => [
  { name: 'name', label: 'Nom de la feature', required: true, placeholder: 'ex. Devis' },
  { name: 'category', label: 'Catégorie', type: 'combo', options: () => L().featureCategories },
  { name: 'icon', label: 'Icône (emoji)', placeholder: 'ex. 🧾' },
  { name: 'color', label: 'Couleur', type: 'color', default: '#3b82f6' },
  { name: 'summary', label: 'Résumé (affiché sur la carte)', type: 'textarea', full: true, rows: 2 },
  { name: 'description', label: 'Description détaillée', type: 'textarea', full: true, rows: 5, placeholder: 'Ce que fait la feature, les options, les cas d’usage…' },
  { name: 'how_to', label: 'Technique / comment c’est fait', type: 'textarea', full: true, rows: 4, placeholder: 'Fichiers, fonctions, tables, astuces de réutilisation…' },
  { name: 'tags', label: 'Étiquettes', full: true, placeholder: 'Séparées par des virgules' },
  { name: 'project_ids', label: 'Projets qui ont cette feature', type: 'multi', options: () => [...state.projects].sort((a, b) => a.name.localeCompare(b.name, 'fr')).map(p => ({ value: p.id, label: `${p.icon || catOf(p.category).icon || ''} ${p.name}` })) },
  { name: 'links', label: 'Liens (exemples, démo, code)', type: 'links' },
];

let cat = '';
let query = '';
let projectFilter = '';

export async function editFeature(f = null, defaults = {}) {
  const values = f ? { ...f, tags: (f.tags || []).join(', ') } : { color: '#3b82f6', project_ids: [], links: [], ...defaults };
  const res = await formModal({ title: f ? `Modifier — ${f.name}` : 'Nouvelle feature', fields: FIELDS(), values, size: 'lg', onDelete: !!f });
  if (!res) return false;
  try {
    if (res.__delete) {
      if (!(await confirmDialog(`Supprimer la feature <b>${esc(f.name)}</b> ?`))) return false;
      await remove('d_features', f.id); toast('Feature supprimée'); return true;
    }
    const row = { ...res, tags: (res.tags || '').split(',').map(x => x.trim()).filter(Boolean) };
    if (f) await update('d_features', f.id, row); else await insert('d_features', row);
    toast(f ? 'Feature mise à jour' : 'Feature ajoutée');
    return true;
  } catch (e) { toastError(e); return false; }
}

const pName = (id) => state.projects.find(p => p.id === id);
const projChips = (ids = []) => ids.map(pName).filter(Boolean).map(p => `<a class="chip chip-sm" href="${projectPath(p.id)}" data-stop>${esc(p.icon || catOf(p.category).icon || '')} ${esc(p.name)}</a>`).join('');

export function featureCard(f) {
  return `<article class="feature-card" data-id="${f.id}" style="--fc:${esc(f.color || 'var(--accent)')}" tabindex="0">
    <div class="fc-top"><span class="fc-icon">${esc(f.icon || '✨')}</span><div class="grow"><h3>${esc(f.name)}</h3>${f.category ? `<span class="badge">${esc(f.category)}</span>` : ''}</div></div>
    ${f.summary ? `<p class="fc-sum">${esc(f.summary)}</p>` : '<p class="fc-sum muted">Pas encore de résumé.</p>'}
    ${(f.project_ids || []).length ? `<div class="fc-projects">${projChips(f.project_ids)}</div>` : ''}
    ${(f.tags || []).length ? `<div class="pc-tags">${f.tags.map(t => `<span>#${esc(t)}</span>`).join('')}</div>` : ''}
  </article>`;
}

export function showFeature(f, onChange) {
  const m = modal({
    title: `${f.icon || '✨'} ${f.name}`,
    size: 'lg',
    body: `
      <div class="row gap-s wrap mb">${f.category ? `<span class="badge">${esc(f.category)}</span>` : ''}${(f.tags || []).map(t => `<span class="badge">#${esc(t)}</span>`).join('')}</div>
      ${f.summary ? `<p class="lead">${esc(f.summary)}</p>` : ''}
      ${f.description ? `<h3 class="h-sec mt">${icon('text')} Description</h3><p class="prewrap">${esc(f.description)}</p>` : ''}
      ${f.how_to ? `<h3 class="h-sec mt">${icon('wrench')} Technique</h3><pre class="code-block">${esc(f.how_to)}</pre>` : ''}
      <h3 class="h-sec mt">${icon('folder-kanban')} Projets</h3>
      ${(f.project_ids || []).length ? `<div class="row gap-s wrap">${projChips(f.project_ids)}</div>` : '<p class="muted">Aucun projet lié.</p>'}
      ${(f.links || []).length ? `<h3 class="h-sec mt">${icon('link')} Liens</h3><div class="row gap-s wrap">${linkButtons(f.links)}</div>` : ''}`,
    footer: `<button class="btn btn-ghost mr-auto" data-close>Fermer</button><button class="btn btn-primary" data-edit>${icon('pencil')} Modifier</button>`,
  });
  m.el.querySelectorAll('.chip[href]').forEach(a => a.addEventListener('click', () => m.close()));
  m.el.querySelector('[data-edit]').onclick = async () => { m.close(); if (await editFeature(f)) onChange?.(); };
}

export default async function render({ el }) {
  const feats = await list('d_features', {}, { order: 'name' });
  const q = query.toLowerCase();
  const shown = feats.filter(f => (!cat || f.category === cat) && (!projectFilter || (f.project_ids || []).includes(projectFilter))
    && (!q || [f.name, f.summary, f.description, f.how_to, ...(f.tags || [])].some(x => x?.toLowerCase().includes(q))));
  const cats = [...new Set([...L().featureCategories, ...feats.map(f => f.category).filter(Boolean)])].filter(c => feats.some(f => f.category === c));

  el.innerHTML = `
    <div class="page-head">
      <div><h1>${icon('blocks')} Features</h1><p class="muted">Le catalogue de toutes tes fonctionnalités, et les projets où elles existent déjà.</p></div>
      <div class="actions"><button class="btn btn-primary" data-new>${icon('plus')} Nouvelle feature</button></div>
    </div>
    <div class="toolbar">
      <div class="chips">
        <button class="chip ${!cat ? 'on' : ''}" data-cat="">Toutes <b>${feats.length}</b></button>
        ${cats.map(c => `<button class="chip ${cat === c ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)} <b>${feats.filter(f => f.category === c).length}</b></button>`).join('')}
      </div>
      <div class="row gap-s">
        <select class="input input-sm" data-proj><option value="">Tous les projets</option>${[...state.projects].sort((a, b) => a.name.localeCompare(b.name, 'fr')).map(p => `<option value="${p.id}" ${p.id === projectFilter ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
        <input class="input input-sm" type="search" placeholder="Filtrer…" value="${esc(query)}" data-q>
      </div>
    </div>
    ${shown.length ? `<div class="feature-grid">${shown.map(featureCard).join('')}</div>`
      : emptyState(feats.length ? 'Aucune feature ne correspond' : 'Aucune feature', feats.length ? '' : 'Crée une carte par fonctionnalité (devis, agenda, connexion, export d’image…) et coche les projets qui l’ont.')}`;

  const again = () => render({ el });
  el.querySelector('[data-new]').onclick = async () => { if (await editFeature(null)) again(); };
  el.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { cat = b.dataset.cat; again(); });
  el.querySelector('[data-proj]').onchange = (e) => { projectFilter = e.target.value; again(); };
  const qi = el.querySelector('[data-q]');
  qi.oninput = () => { query = qi.value; clearTimeout(qi._t); qi._t = setTimeout(async () => { await again(); const n = el.querySelector('[data-q]'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 200); };
  el.querySelectorAll('.feature-card').forEach(c => {
    const open = (e) => { if (e?.target?.closest('[data-stop]')) return; showFeature(feats.find(f => f.id === c.dataset.id), again); };
    c.onclick = open; c.onkeydown = (e) => { if (e.key === 'Enter') open(e); };
  });
}
