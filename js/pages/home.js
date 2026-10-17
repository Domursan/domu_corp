import { update } from '../api.js';
import { state, saveSettings, L } from '../state.js';
import { esc, icon, emptyState, toastError } from '../ui.js';
import { go, projectPath, catOf, statusOf, isArchived, refreshProjects } from '../app.js';
import { editProject } from './project.js';

let cat = '';
let status = '';
let query = '';

function ago(iso) {
  if (!iso) return '';
  const d = (Date.now() - new Date(iso)) / 1000;
  if (d < 60) return 'à l’instant';
  if (d < 3600) return `il y a ${Math.floor(d / 60)} min`;
  if (d < 86400) return `il y a ${Math.floor(d / 3600)} h`;
  if (d < 86400 * 30) return `il y a ${Math.floor(d / 86400)} j`;
  return new Date(iso).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function render({ el }) {
  await refreshProjects();
  const H = state.settings.home;
  if (location.hash.includes('archives=1')) { H.showArchived = true; history.replaceState(null, '', '#/'); }
  const all = state.projects;
  const q = query.toLowerCase();
  let shown = all.filter(p => (H.showArchived || !isArchived(p)) && (!cat || p.category === cat) && (!status || p.status === status)
    && (!q || [p.name, p.description, ...(p.tags || [])].some(x => x?.toLowerCase().includes(q))));
  const sorters = {
    activity: (a, b) => String(b.last_activity).localeCompare(String(a.last_activity)),
    name: (a, b) => a.name.localeCompare(b.name, 'fr'),
    manual: (a, b) => (a.position ?? 1e9) - (b.position ?? 1e9) || a.name.localeCompare(b.name, 'fr'),
  };
  shown = shown.sort((a, b) => (b.pinned - a.pinned) || sorters[H.sort || 'activity'](a, b));
  const cats = [...new Set([...L().categories.map(c => c.name), ...all.map(p => p.category).filter(Boolean)])];
  const count = (c) => all.filter(p => p.category === c && (H.showArchived || !isArchived(p))).length;

  const card = (p) => {
    const c = catOf(p.category); const st = statusOf(p.status);
    return `<a class="project-card ${isArchived(p) ? 'is-archived' : ''}" href="${projectPath(p.id)}" data-id="${p.id}" draggable="${H.sort === 'manual'}" style="--pc:${esc(p.color || c.color)}">
      <div class="pc-top">
        <span class="pc-logo">${p.logo_url ? `<img src="${esc(p.logo_url)}" alt="" loading="lazy">` : esc(p.icon || c.icon || '📁')}</span>
        <div class="grow"><h3>${esc(p.name)}</h3>
          <div class="row gap-s wrap"><span class="badge" style="background:${esc(c.color)}26;color:${esc(c.color)}">${esc(c.name)}</span>
          ${p.status ? `<span class="badge" style="background:${esc(st.color)}26;color:${esc(st.color)}">${esc(p.status)}</span>` : ''}</div></div>
        ${p.pinned ? `<span class="pc-pin" title="Épinglé">${icon('pin')}</span>` : ''}
      </div>
      ${p.description ? `<p class="pc-desc">${esc(p.description)}</p>` : '<p class="pc-desc muted">Pas de description.</p>'}
      <div class="pc-foot">
        <span class="pc-tags">${(p.tags || []).slice(0, 3).map(t => `<span>#${esc(t)}</span>`).join('')}</span>
        <span class="muted small">${icon('clock', 'ic-xs')} ${ago(p.last_activity)}</span>
      </div>
    </a>`;
  };

  el.innerHTML = `
    <div class="page-head">
      <div><h1>${icon('layout-dashboard')} Mes projets</h1><p class="muted">${all.filter(p => !isArchived(p)).length} projet(s) actif(s)${all.some(isArchived) ? ` · ${all.filter(isArchived).length} archivé(s)` : ''}</p></div>
      <div class="actions"><button class="btn btn-primary" data-new data-tour="new">${icon('plus')} Nouveau projet</button></div>
    </div>
    <div class="toolbar">
      <div class="chips">
        <button class="chip ${!cat ? 'on' : ''}" data-cat="">Tous</button>
        ${cats.map(c => `<button class="chip ${cat === c ? 'on' : ''}" data-cat="${esc(c)}">${esc(catOf(c).icon || '')} ${esc(c)} <b>${count(c)}</b></button>`).join('')}
      </div>
      <div class="row gap-s wrap">
        <input class="input input-sm" type="search" placeholder="Filtrer…" value="${esc(query)}" data-q>
        <select class="input input-sm" data-status><option value="">Tous les statuts</option>${L().statuses.map(s => `<option ${s.name === status ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
        <select class="input input-sm" data-sort>
          <option value="activity" ${H.sort === 'activity' ? 'selected' : ''}>Dernière activité</option>
          <option value="name" ${H.sort === 'name' ? 'selected' : ''}>Nom</option>
          <option value="manual" ${H.sort === 'manual' ? 'selected' : ''}>Ordre manuel (glisser)</option>
        </select>
        <label class="check small"><input type="checkbox" data-arch ${H.showArchived ? 'checked' : ''}><span>Archivés</span></label>
      </div>
    </div>
    ${shown.length ? `<div class="project-grid" data-grid>${shown.map(card).join('')}</div>`
      : emptyState(all.length ? 'Aucun projet ne correspond' : 'Aucun projet', all.length ? 'Change les filtres.' : 'Crée ton premier projet avec « Nouveau projet ».')}`;

  const again = () => render({ el });
  el.querySelector('[data-new]').onclick = async () => { const p = await editProject(null); if (p) go(projectPath(p.id)); };
  el.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { cat = b.dataset.cat; again(); });
  el.querySelector('[data-status]').onchange = (e) => { status = e.target.value; again(); };
  el.querySelector('[data-sort]').onchange = (e) => { H.sort = e.target.value; saveSettings(); again(); };
  el.querySelector('[data-arch]').onchange = (e) => { H.showArchived = e.target.checked; saveSettings(); again(); };
  const qi = el.querySelector('[data-q]');
  qi.oninput = () => { query = qi.value; clearTimeout(qi._t); qi._t = setTimeout(async () => { await again(); const n = el.querySelector('[data-q]'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 200); };

  // Ordre manuel par glisser-déposer
  if (H.sort === 'manual') {
    const grid = el.querySelector('[data-grid]');
    let dragged = null;
    grid?.addEventListener('dragstart', (e) => { dragged = e.target.closest('.project-card'); dragged?.classList.add('dragging'); });
    grid?.addEventListener('dragend', () => dragged?.classList.remove('dragging'));
    grid?.addEventListener('dragover', (e) => {
      e.preventDefault();
      const over = e.target.closest('.project-card');
      if (!dragged || !over || over === dragged) return;
      const r = over.getBoundingClientRect();
      grid.insertBefore(dragged, (e.clientX - r.left) > r.width / 2 ? over.nextSibling : over);
    });
    grid?.addEventListener('drop', async (e) => {
      e.preventDefault();
      const ids = [...grid.querySelectorAll('.project-card')].map(c => c.dataset.id);
      try { await Promise.all(ids.map((id, i) => update('d_projects', id, { position: i + 1 }))); await refreshProjects(); } catch (err) { toastError(err); }
    });
  }
}
