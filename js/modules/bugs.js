import { list, insert, update, remove } from '../api.js';
import { L } from '../state.js';
import { esc, icon, fmtDate, formModal, confirmDialog, toast, toastError, emptyState } from '../ui.js';

let kindF = '';
let showClosed = false;
const CLOSED = () => L().bugStatuses.slice(-2);
const prioColor = (n) => L().priorities.find(p => p.name === n)?.color;

async function editBug(ctx, b, defaults = {}) {
  const res = await formModal({
    title: b ? 'Modifier' : 'Nouveau bug / idée', size: 'lg', onDelete: !!b,
    values: b || { kind: L().bugKinds[0], status: L().bugStatuses[0], priority: L().priorities[1]?.name, version: ctx.p.tech?.version, ...defaults },
    fields: [
      { name: 'title', label: 'Titre', required: true, full: true },
      { name: 'kind', label: 'Type', type: 'select', empty: false, options: () => L().bugKinds },
      { name: 'status', label: 'Statut', type: 'select', empty: false, options: () => L().bugStatuses },
      { name: 'priority', label: 'Priorité', type: 'select', options: () => L().priorities.map(p => p.name) },
      { name: 'version', label: 'Version concernée' },
      { name: 'description', label: 'Description / étapes pour reproduire', type: 'textarea', full: true, rows: 5 },
    ],
  });
  if (!res) return false;
  try {
    if (res.__delete) { if (!(await confirmDialog(`Supprimer <b>${esc(b.title)}</b> ?`))) return false; await remove('d_bugs', b.id); toast('Supprimé'); }
    else if (b) await update('d_bugs', b.id, res);
    else await insert('d_bugs', { ...res, project_id: ctx.pid });
    return true;
  } catch (e) { toastError(e); return false; }
}

export default async function render(ctx) {
  const { el, pid } = ctx;
  const rows = await list('d_bugs', { project_id: pid }, { order: 'created_at', asc: false });
  const closed = CLOSED();
  const shown = rows.filter(b => (!kindF || b.kind === kindF) && (showClosed || !closed.includes(b.status)));
  const kinds = [...new Set([...L().bugKinds, ...rows.map(r => r.kind)])];

  el.innerHTML = `
    <div class="toolbar">
      <div class="row gap-s wrap">
        <div class="chips"><button class="chip ${!kindF ? 'on' : ''}" data-k="">Tout <b>${rows.filter(b => showClosed || !closed.includes(b.status)).length}</b></button>
          ${kinds.map(k => `<button class="chip ${kindF === k ? 'on' : ''}" data-k="${esc(k)}">${esc(k)} <b>${rows.filter(b => b.kind === k && (showClosed || !closed.includes(b.status))).length}</b></button>`).join('')}</div>
        <label class="check small"><input type="checkbox" data-closed ${showClosed ? 'checked' : ''}><span>Afficher ${esc(closed.join(' / '))}</span></label>
      </div>
      <button class="btn btn-primary" data-new>${icon('plus')} Nouveau</button>
    </div>
    ${shown.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Type</th><th>Titre</th><th>Statut</th><th>Priorité</th><th>Version</th><th>Créé</th></tr></thead><tbody>
      ${shown.map(b => `<tr class="clickable" data-id="${b.id}"><td><span class="badge ${b.kind === 'Bug' ? 'badge-danger' : 'badge-info'}">${icon(b.kind === 'Bug' ? 'bug' : 'lightbulb')} ${esc(b.kind)}</span></td>
        <td><b class="${closed.includes(b.status) ? 'strike' : ''}">${esc(b.title)}</b>${b.description ? `<div class="muted small clamp-2">${esc(b.description)}</div>` : ''}</td>
        <td><select class="input input-sm" data-status="${b.id}">${L().bugStatuses.map(s => `<option ${s === b.status ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></td>
        <td>${b.priority ? `<span class="badge" style="${prioColor(b.priority) ? `background:${prioColor(b.priority)}26;color:${prioColor(b.priority)}` : ''}">${esc(b.priority)}</span>` : ''}</td>
        <td class="mono">${esc(b.version || '')}</td><td class="nowrap muted">${fmtDate(b.created_at)}</td></tr>`).join('')}</tbody></table></div>`
      : emptyState(rows.length ? 'Rien d’ouvert' : 'Aucun bug ni idée', 'Note les bugs à corriger et les idées d’amélioration au fil de l’eau.')}`;

  const again = () => render(ctx);
  el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { kindF = b.dataset.k; again(); });
  el.querySelector('[data-closed]').onchange = (e) => { showClosed = e.target.checked; again(); };
  el.querySelector('[data-new]').onclick = async () => { if (await editBug(ctx, null)) again(); };
  el.querySelectorAll('[data-status]').forEach(s => { s.onclick = (e) => e.stopPropagation(); s.onchange = async () => { try { await update('d_bugs', s.dataset.status, { status: s.value }); again(); } catch (e) { toastError(e); } }; });
  el.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = async (e) => { if (e.target.closest('select')) return; if (await editBug(ctx, rows.find(b => b.id === tr.dataset.id))) again(); });
}
