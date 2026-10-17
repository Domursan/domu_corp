// Notes : liste à gauche, éditeur à droite, enregistrement automatique.
import { list, insert, update, remove } from '../api.js';
import { esc, icon, fmtDateTime, confirmDialog, toast, toastError } from '../ui.js';

let selected = null;
let preview = false;

/** Mise en forme légère : # titres, **gras**, *italique*, `code`, listes, liens. */
function renderMd(src = '') {
  const e = esc(src);
  const inline = (s) => s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\*([^*]+)\*/g, '<i>$1</i>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  let out = '', inList = false;
  for (const line of e.split('\n')) {
    const li = line.match(/^\s*[-*] (.*)/);
    if (li) { if (!inList) { out += '<ul>'; inList = true; } out += `<li>${inline(li[1])}</li>`; continue; }
    if (inList) { out += '</ul>'; inList = false; }
    const h = line.match(/^(#{1,3}) (.*)/);
    if (h) out += `<h${h[1].length + 2}>${inline(h[2])}</h${h[1].length + 2}>`;
    else if (line.trim() === '') out += '<br>';
    else out += `<p>${inline(line)}</p>`;
  }
  return out + (inList ? '</ul>' : '');
}

export default async function render(ctx) {
  const { el, pid } = ctx;
  const notes = await list('d_notes', { project_id: pid }, { order: 'updated_at', asc: false });
  notes.sort((a, b) => b.pinned - a.pinned);
  if (!notes.some(n => n.id === selected)) selected = notes[0]?.id || null;
  const cur = notes.find(n => n.id === selected);

  el.innerHTML = `
    <div class="notes-layout">
      <aside class="notes-side">
        <button class="btn btn-primary btn-block" data-new>${icon('plus')} Nouvelle note</button>
        <div class="panel notes-list">${notes.length ? notes.map(n => `<button class="note-item ${n.id === selected ? 'on' : ''}" data-pick="${n.id}">
          <b>${n.pinned ? icon('pin', 'ic-xs') : ''} ${esc(n.title)}</b><small class="muted">${fmtDateTime(n.updated_at)}</small></button>`).join('') : '<p class="muted small pad">Aucune note.</p>'}</div>
      </aside>
      <section class="panel note-editor">${cur ? `
        <div class="note-head">
          <input class="note-title" data-title value="${esc(cur.title)}" aria-label="Titre">
          <span class="saved-dot" data-saved>${icon('check')} Enregistré</span>
          <div class="seg"><button class="${!preview ? 'on' : ''}" data-mode="edit">${icon('pencil')}</button><button class="${preview ? 'on' : ''}" data-mode="view">${icon('eye')}</button></div>
          <button class="btn-icon" data-pin title="${cur.pinned ? 'Désépingler' : 'Épingler'}">${icon(cur.pinned ? 'pin-off' : 'pin')}</button>
          <button class="btn-icon" data-del title="Supprimer">${icon('trash-2')}</button>
        </div>
        ${preview ? `<div class="note-view">${renderMd(cur.content || '') || '<p class="muted">Note vide.</p>'}</div>`
          : `<textarea class="note-text" data-content placeholder="Écris ici… (# titre, **gras**, - liste, liens automatiques)">${esc(cur.content || '')}</textarea>`}`
        : `<div class="empty">${icon('notebook-pen', 'ic-xl')}<h3>Aucune note</h3><p>Crée ta première note.</p></div>`}
      </section>
    </div>`;

  const again = () => render(ctx);
  el.querySelector('[data-new]').onclick = async () => {
    try { const n = await insert('d_notes', { project_id: pid, title: 'Nouvelle note', content: '' }); selected = n.id; preview = false; await again(); el.querySelector('[data-title]')?.select(); } catch (e) { toastError(e); }
  };
  el.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { selected = b.dataset.pick; again(); });
  if (!cur) return;
  let timer;
  const save = (patch) => {
    Object.assign(cur, patch);
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try { await update('d_notes', cur.id, patch); const s = el.querySelector('[data-saved]'); s?.classList.add('show'); setTimeout(() => s?.classList.remove('show'), 900); } catch (e) { toastError(e); }
    }, 600);
  };
  el.querySelector('[data-title]').oninput = (e) => { save({ title: e.target.value || 'Sans titre' }); const it = el.querySelector(`[data-pick="${cur.id}"] b`); if (it) it.lastChild.textContent = ` ${e.target.value}`; };
  el.querySelector('[data-content]')?.addEventListener('input', (e) => save({ content: e.target.value }));
  el.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { preview = b.dataset.mode === 'view'; again(); });
  el.querySelector('[data-pin]').onclick = async () => { try { await update('d_notes', cur.id, { pinned: !cur.pinned }); again(); } catch (e) { toastError(e); } };
  el.querySelector('[data-del]').onclick = async () => {
    if (!(await confirmDialog(`Supprimer la note <b>${esc(cur.title)}</b> ?`))) return;
    try { await remove('d_notes', cur.id); selected = null; toast('Note supprimée'); again(); } catch (e) { toastError(e); }
  };
}
