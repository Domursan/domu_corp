import { list, insert, update, remove } from '../api.js';
import { esc, icon, fmtDate, formModal, confirmDialog, toast, toastError, emptyState, todayISO } from '../ui.js';

const FIELDS = [
  { name: 'version', label: 'Version', placeholder: 'ex. 2.7.1' },
  { name: 'date', label: 'Date', type: 'date', required: true },
  { name: 'title', label: 'Titre', required: true, full: true, placeholder: 'ex. Bouton Reroll corrigé' },
  { name: 'details', label: 'Détails', type: 'textarea', full: true, rows: 6, placeholder: 'Une ligne par changement' },
];

export default async function render(ctx) {
  const { el, pid } = ctx;
  const rows = await list('d_changelog', { project_id: pid }, { order: 'date', asc: false });
  rows.sort((a, b) => b.date.localeCompare(a.date) || String(b.created_at).localeCompare(String(a.created_at)));

  const edit = async (c) => {
    const res = await formModal({ title: c ? 'Modifier l’entrée' : 'Nouvelle entrée du journal', fields: FIELDS, values: c || { date: todayISO(), version: suggest(rows[0]?.version) }, onDelete: !!c });
    if (!res) return;
    try {
      if (res.__delete) { if (!(await confirmDialog('Supprimer cette entrée ?'))) return; await remove('d_changelog', c.id); toast('Entrée supprimée'); }
      else if (c) await update('d_changelog', c.id, res);
      else await insert('d_changelog', { ...res, project_id: pid });
      render(ctx);
    } catch (e) { toastError(e); }
  };

  el.innerHTML = `
    <div class="toolbar"><h2 class="h-sec">${icon('history')} Journal des versions <span class="count">${rows.length}</span></h2>
      <button class="btn btn-primary" data-new>${icon('plus')} Nouvelle entrée</button></div>
    ${rows.length ? `<ol class="timeline">${rows.map(c => `<li class="tl-item" data-id="${c.id}" tabindex="0">
        <span class="tl-dot"></span>
        <div class="tl-body">
          <div class="row gap-s wrap">${c.version ? `<span class="badge badge-info">V ${esc(c.version)}</span>` : ''}<b>${esc(c.title)}</b><small class="muted">${fmtDate(c.date)}</small></div>
          ${c.details ? `<ul class="tl-details">${c.details.split('\n').filter(l => l.trim()).map(l => `<li>${esc(l.replace(/^[-*•]\s*/, ''))}</li>`).join('')}</ul>` : ''}
        </div></li>`).join('')}</ol>`
      : emptyState('Journal vide', 'Note chaque version et ce qui a changé : tu retrouveras facilement quand une fonctionnalité est arrivée.')}`;

  el.querySelector('[data-new]').onclick = () => edit(null);
  el.querySelectorAll('.tl-item').forEach(li => { const open = () => edit(rows.find(r => r.id === li.dataset.id)); li.onclick = open; li.onkeydown = (e) => { if (e.key === 'Enter') open(); }; });
}

/** 2.7.1 → 2.7.2 ; 1.4 → 1.5 */
function suggest(v) {
  if (!v) return '1.0';
  const m = String(v).match(/^(.*?)(\d+)$/);
  return m ? `${m[1]}${Number(m[2]) + 1}` : v;
}
