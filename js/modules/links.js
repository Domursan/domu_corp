import { list, insert, update, remove } from '../api.js';
import { esc, icon, confirmDialog, toastError, LINK_KINDS, linkKind, detectLinkKind, linkButtons } from '../ui.js';
import { renderGrid } from '../grid.js';

export default async function render(ctx) {
  const { el, pid } = ctx;
  const rows = await list('d_links', { project_id: pid }, { order: 'position' });

  el.innerHTML = `
    <div class="toolbar"><h2 class="h-sec">${icon('link')} Liens <span class="count">${rows.length}</span></h2>
      <form class="row gap-s quick-add" data-quick>
        <input class="input input-sm" name="url" type="url" placeholder="Colle un lien (https://…)" required>
        <input class="input input-sm" name="label" placeholder="Libellé (optionnel)">
        <button class="btn btn-primary btn-sm">${icon('plus')} Ajouter</button>
      </form>
    </div>
    ${rows.length ? `<section class="panel mb"><div class="pad row gap-s wrap">${linkButtons(rows)}</div></section>` : ''}
    <div data-grid></div>
    <p class="muted small mt">Le type est deviné à partir de l’adresse (Apps Script, Google Sheet, GitHub, GitHub Pages, Supabase…). Tu peux le changer dans le tableau.</p>`;

  renderGrid(el.querySelector('[data-grid]'), [
    { key: 'kind', label: 'Type', type: 'select', options: LINK_KINDS.map(k => ({ value: k.key, label: k.label })), width: 150 },
    { key: 'label', label: 'Libellé', width: 200 },
    { key: 'url', label: 'Adresse', width: 380 },
  ], {
    rows, empty: 'Aucun lien. Colle une adresse ci-dessus.',
    onSave: (r, patch) => update('d_links', r.id, patch),
    onDelete: async (r) => { if (await confirmDialog(`Supprimer le lien <b>${esc(r.label || r.url)}</b> ?`)) { try { await remove('d_links', r.id); render(ctx); } catch (e) { toastError(e); } } },
    actions: (r) => `<a class="btn-icon sm" href="${esc(r.url)}" target="_blank" rel="noopener" title="Ouvrir">${icon(linkKind(r.kind).icon)}</a>
      <button class="btn-icon sm" data-up="${r.id}" title="Monter">${icon('arrow-up')}</button>`,
  });

  el.querySelector('[data-quick]').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target; const url = f.url.value.trim();
    const kind = detectLinkKind(url);
    try {
      await insert('d_links', { project_id: pid, url, label: f.label.value.trim() || linkKind(kind).label, kind, position: rows.length + 1 });
      render(ctx);
    } catch (err) { toastError(err); }
  };
  el.querySelectorAll('[data-up]').forEach(b => b.onclick = async () => {
    const i = rows.findIndex(r => r.id === b.dataset.up);
    if (i <= 0) return;
    const order = rows.slice(); [order[i - 1], order[i]] = [order[i], order[i - 1]];
    try { await Promise.all(order.map((r, k) => update('d_links', r.id, { position: k + 1 }))); render(ctx); } catch (e) { toastError(e); }
  });
}
