import { list, insert, update, remove, uploadFile, deleteFile } from '../api.js';
import { state } from '../state.js';
import { esc, icon, fmtDate, confirmDialog, toast, toastError, emptyState, formModal } from '../ui.js';

const size = (b) => (b == null ? '' : b < 1024 ? `${b} o` : b < 1048576 ? `${(b / 1024).toFixed(0)} Ko` : `${(b / 1048576).toFixed(1)} Mo`);
const isImg = (f) => (f.mime || '').startsWith('image/');
const fileIcon = (f) => (isImg(f) ? 'image' : /pdf/.test(f.mime) ? 'file-text' : /zip|rar|7z/.test(f.mime) ? 'file-archive' : /sheet|excel|csv/.test(f.mime) ? 'sheet' : 'file');

export default async function render(ctx) {
  const { el, pid } = ctx;
  const files = await list('d_files', { project_id: pid }, { order: 'created_at', asc: false });

  el.innerHTML = `
    <div class="toolbar"><h2 class="h-sec">${icon('folder-open')} Fichiers <span class="count">${files.length}</span></h2>
      <div class="row gap-s">
        <button class="btn btn-ghost" data-link>${icon('link')} Ajouter un lien d’image</button>
        <label class="btn btn-primary">${icon('upload')} Envoyer des fichiers<input type="file" multiple hidden data-input></label>
      </div></div>
    <div class="dropzone" data-drop>${icon('cloud-upload', 'ic-lg')}<span>Glisse tes fichiers ici (25 Mo max par fichier)</span></div>
    ${files.length ? `<div class="file-grid">${files.map(f => `
      <article class="file-card" data-id="${f.id}">
        <a class="file-thumb" href="${esc(f.url)}" target="_blank" rel="noopener">${isImg(f) ? `<img src="${esc(f.url)}" alt="" loading="lazy">` : icon(fileIcon(f), 'ic-xl')}</a>
        <div class="file-body">
          <b title="${esc(f.name)}">${esc(f.name)}</b>
          <small class="muted">${[size(f.size), fmtDate(f.created_at)].filter(Boolean).join(' · ')}</small>
          ${f.note ? `<small>${esc(f.note)}</small>` : ''}
        </div>
        <div class="file-actions">
          <button class="btn-icon sm" data-copy="${f.id}" title="Copier le lien">${icon('copy')}</button>
          <button class="btn-icon sm" data-note="${f.id}" title="Renommer / note">${icon('pencil')}</button>
          <button class="btn-icon sm" data-del="${f.id}" title="Supprimer">${icon('trash-2')}</button>
        </div>
      </article>`).join('')}</div>` : emptyState('Aucun fichier', 'Captures, logos, documents… tout ce qui concerne le projet.')}
    <p class="muted small mt">Les fichiers sont accessibles par leur lien direct (pratique pour les intégrer ailleurs). N’y mets rien de confidentiel.</p>`;

  const again = () => render(ctx);
  const send = async (list_) => {
    const arr = [...list_];
    if (!arr.length) return;
    toast(`Envoi de ${arr.length} fichier(s)…`);
    for (const file of arr) {
      try {
        const { path, url } = await uploadFile(file, state.user.id, pid);
        await insert('d_files', { project_id: pid, name: file.name, url, path, mime: file.type || null, size: file.size });
      } catch (e) { toastError(e); }
    }
    again();
  };
  el.querySelector('[data-input]').onchange = (e) => send(e.target.files);
  const dz = el.querySelector('[data-drop]');
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('on'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('on'));
  dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('on'); send(e.dataTransfer.files); });
  el.querySelector('[data-link]').onclick = async () => {
    const v = await formModal({ title: 'Ajouter un lien', size: 'sm', fields: [{ name: 'url', label: 'Lien direct', type: 'url', required: true, full: true }, { name: 'name', label: 'Nom', full: true }, { name: 'note', label: 'Note', full: true }] });
    if (!v) return;
    try { await insert('d_files', { project_id: pid, url: v.url, name: v.name || v.url.split('/').pop(), note: v.note, mime: /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(v.url) ? 'image/*' : null }); again(); } catch (e) { toastError(e); }
  };
  const byId = (id) => files.find(f => f.id === id);
  el.querySelectorAll('[data-copy]').forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(byId(b.dataset.copy).url); toast('Lien copié'); } catch { toast('Copie impossible', 'error'); } });
  el.querySelectorAll('[data-note]').forEach(b => b.onclick = async () => {
    const f = byId(b.dataset.note);
    const v = await formModal({ title: 'Fichier', size: 'sm', fields: [{ name: 'name', label: 'Nom', required: true, full: true }, { name: 'note', label: 'Note', type: 'textarea', full: true }], values: f });
    if (v) { try { await update('d_files', f.id, v); again(); } catch (e) { toastError(e); } }
  });
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    const f = byId(b.dataset.del);
    if (!(await confirmDialog(`Supprimer <b>${esc(f.name)}</b> ? Le fichier sera effacé du stockage.`))) return;
    try { await deleteFile(f.path); await remove('d_files', f.id); toast('Fichier supprimé'); again(); } catch (e) { toastError(e); }
  });
}
