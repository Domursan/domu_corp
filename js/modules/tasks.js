import { list, insert, update, remove } from '../api.js';
import { L } from '../state.js';
import { esc, icon, fmtDate, formModal, confirmDialog, popMenu, toast, toastError, emptyState, todayISO } from '../ui.js';

const prio = (name) => L().priorities.find(x => x.name === name);

async function editTask(ctx, t, defaults = {}) {
  const res = await formModal({
    title: t ? 'Modifier la tâche' : 'Nouvelle tâche', size: 'lg', onDelete: !!t,
    values: t || { status: L().taskStatuses[0], priority: L().priorities[1]?.name, subtasks: [], ...defaults },
    fields: [
      { name: 'title', label: 'Titre', required: true, full: true },
      { name: 'status', label: 'Statut', type: 'select', empty: false, options: () => L().taskStatuses },
      { name: 'priority', label: 'Priorité', type: 'select', options: () => L().priorities.map(p => p.name) },
      { name: 'due_date', label: 'Échéance', type: 'date' },
      { name: 'description', label: 'Description', type: 'textarea', full: true, rows: 4 },
      { name: 'subtasks', label: 'Sous-tâches', type: 'tasks' },
    ],
  });
  if (!res) return false;
  try {
    if (res.__delete) { if (!(await confirmDialog(`Supprimer <b>${esc(t.title)}</b> ?`))) return false; await remove('d_tasks', t.id); toast('Tâche supprimée'); }
    else if (t) await update('d_tasks', t.id, res);
    else await insert('d_tasks', { ...res, project_id: ctx.pid });
    return true;
  } catch (e) { toastError(e); return false; }
}

let view = 'board';
let hideDone = false;

export default async function render(ctx) {
  const { el, pid } = ctx;
  const tasks = await list('d_tasks', { project_id: pid }, { order: 'position' });
  const statuses = [...L().taskStatuses, ...new Set(tasks.map(t => t.status).filter(s => s && !L().taskStatuses.includes(s)))];
  const done = L().taskStatuses.at(-1);
  const today = todayISO();
  const late = (t) => t.due_date && t.due_date < today && t.status !== done;
  const prioRank = (t) => { const i = L().priorities.findIndex(p => p.name === t.priority); return i < 0 ? -1 : i; };
  const sorted = tasks.slice().sort((a, b) => prioRank(b) - prioRank(a) || String(a.due_date || '9999').localeCompare(String(b.due_date || '9999')));
  const listed = sorted.filter(t => !hideDone || t.status !== done);

  const card = (t) => {
    const sub = t.subtasks || []; const sd = sub.filter(s => s.done).length; const pr = prio(t.priority);
    return `<article class="task-card" data-id="${t.id}" draggable="true" style="${pr ? `--tc:${pr.color}` : ''}">
      <div class="row between gap-s"><b class="grow">${esc(t.title)}</b><button class="btn-icon sm" data-menu="${t.id}">${icon('ellipsis')}</button></div>
      <div class="row gap-s wrap small">
        ${pr ? `<span class="badge" style="background:${pr.color}26;color:${pr.color}">${esc(pr.name)}</span>` : ''}
        ${t.due_date ? `<span class="${late(t) ? 'danger' : 'muted'}">${icon('calendar', 'ic-xs')} ${fmtDate(t.due_date)}</span>` : ''}
        ${sub.length ? `<span class="muted">${icon('list-checks', 'ic-xs')} ${sd}/${sub.length}</span>` : ''}
      </div>
    </article>`;
  };

  el.innerHTML = `
    <div class="toolbar">
      <div class="row gap-s wrap">
        <div class="seg"><button class="${view === 'board' ? 'on' : ''}" data-view="board">${icon('columns-3')} Tableau</button><button class="${view === 'list' ? 'on' : ''}" data-view="list">${icon('list')} Liste</button></div>
        <label class="check small"><input type="checkbox" data-hide ${hideDone ? 'checked' : ''}><span>Masquer « ${esc(done)} »</span></label>
      </div>
      <form class="row gap-s quick-add" data-quick><input class="input input-sm" name="t" placeholder="Nouvelle tâche…" required><button class="btn btn-primary btn-sm">${icon('plus')} Ajouter</button></form>
    </div>
    ${!tasks.length ? emptyState('Aucune tâche', 'Ajoute ta première tâche ci-dessus.') : view === 'board'
      ? `<div class="board">${statuses.filter(s => !hideDone || s !== done).map(s => `<section class="board-col" data-status="${esc(s)}"><header><h3>${esc(s)}</h3><span class="count">${tasks.filter(t => t.status === s).length}</span></header>
          <div class="board-list">${sorted.filter(t => t.status === s).map(card).join('') || '<p class="muted small center pad">—</p>'}</div></section>`).join('')}</div>`
      : `<div class="table-wrap"><table class="table"><thead><tr><th></th><th>Tâche</th><th>Statut</th><th>Priorité</th><th>Échéance</th></tr></thead><tbody>
          ${listed.map(t => `<tr class="clickable" data-id="${t.id}"><td class="center" data-stop><input type="checkbox" data-done="${t.id}" ${t.status === done ? 'checked' : ''}></td>
            <td><b class="${t.status === done ? 'strike' : ''}">${esc(t.title)}</b></td><td><span class="badge">${esc(t.status || '')}</span></td>
            <td>${prio(t.priority) ? `<span class="badge" style="background:${prio(t.priority).color}26;color:${prio(t.priority).color}">${esc(t.priority)}</span>` : ''}</td>
            <td class="${late(t) ? 'danger' : ''}">${fmtDate(t.due_date) || '—'}</td></tr>`).join('')}</tbody></table></div>`}`;

  const again = () => render(ctx);
  const byId = (id) => tasks.find(t => t.id === id);
  const setStatus = async (t, s) => { try { await update('d_tasks', t.id, { status: s }); again(); } catch (e) { toastError(e); } };
  el.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { view = b.dataset.view; again(); });
  el.querySelector('[data-hide]').onchange = (e) => { hideDone = e.target.checked; again(); };
  el.querySelector('[data-quick]').onsubmit = async (e) => {
    e.preventDefault();
    try { await insert('d_tasks', { project_id: pid, title: e.target.t.value.trim(), status: L().taskStatuses[0], priority: L().priorities[1]?.name, position: tasks.length + 1 }); again(); } catch (err) { toastError(err); }
  };
  el.querySelectorAll('.task-card, tr[data-id]').forEach(c => c.addEventListener('click', async (e) => {
    if (e.target.closest('[data-menu],[data-stop]')) return;
    if (await editTask(ctx, byId(c.dataset.id))) again();
  }));
  el.querySelectorAll('[data-done]').forEach(cb => cb.onchange = () => setStatus(byId(cb.dataset.done), cb.checked ? done : L().taskStatuses[0]));
  el.querySelectorAll('[data-menu]').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const t = byId(b.dataset.menu);
    popMenu(b, [
      { label: 'Modifier', icon: 'pencil', action: async () => { if (await editTask(ctx, t)) again(); } },
      '-',
      ...statuses.filter(s => s !== t.status).map(s => ({ label: `Passer en « ${s} »`, icon: 'arrow-right', action: () => setStatus(t, s) })),
      '-',
      { label: 'Supprimer', icon: 'trash-2', danger: true, action: async () => { if (await confirmDialog(`Supprimer <b>${esc(t.title)}</b> ?`)) { await remove('d_tasks', t.id); again(); } } },
    ]);
  }));
  if (view === 'board') {
    el.querySelectorAll('.task-card').forEach(c => {
      c.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', c.dataset.id); c.classList.add('dragging'); });
      c.addEventListener('dragend', () => c.classList.remove('dragging'));
    });
    el.querySelectorAll('.board-col').forEach(col => {
      col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drop'); });
      col.addEventListener('dragleave', () => col.classList.remove('drop'));
      col.addEventListener('drop', (e) => { e.preventDefault(); col.classList.remove('drop'); const t = byId(e.dataTransfer.getData('text/plain')); if (t && t.status !== col.dataset.status) setStatus(t, col.dataset.status); });
    });
  }
}
