import { list, insert, update, remove } from '../api.js';
import { L } from '../state.js';
import { esc, icon, money, confirmDialog, toastError, emptyState, downloadCSV } from '../ui.js';
import { renderGrid } from '../grid.js';

export default async function render(ctx) {
  const { el, pid } = ctx;
  const items = await list('d_inventory', { project_id: pid }, { order: 'name' });
  const low = (i) => i.alert_threshold != null && Number(i.quantity) <= Number(i.alert_threshold);
  const total = items.reduce((a, i) => a + Number(i.quantity || 0) * Number(i.unit_value || 0), 0);

  el.innerHTML = `
    <div class="toolbar"><h2 class="h-sec">${icon('package')} Inventaire <span class="count">${items.length}</span></h2>
      <button class="btn btn-ghost" data-csv>${icon('download')} CSV</button></div>
    <div class="stats kpis-flat">
      <div class="stat"><div><span class="stat-v">${items.length}</span><span class="stat-l">articles</span></div></div>
      <div class="stat"><div><span class="stat-v">${money(total)}</span><span class="stat-l">valeur du stock</span></div></div>
      <div class="stat"><div><span class="stat-v ${items.some(low) ? 'warning' : ''}">${items.filter(low).length}</span><span class="stat-l">en alerte</span></div></div>
    </div>
    <div data-grid></div>`;

  renderGrid(el.querySelector('[data-grid]'), [
    { key: 'name', label: 'Article', width: 200 },
    { key: 'category', label: 'Catégorie', type: 'select', options: () => L().inventoryCategories, width: 130 },
    { key: 'quantity', label: 'Quantité', type: 'number', width: 90 },
    { key: 'alert_threshold', label: 'Seuil', type: 'number', width: 80 },
    { key: 'unit_value', label: 'Valeur unit.', type: 'money', width: 110 },
    { key: '_v', label: 'Valeur', type: 'calc', get: (i) => (i.unit_value == null ? null : Number(i.quantity || 0) * Number(i.unit_value)), total: true },
    { key: 'location', label: 'Emplacement', width: 130 },
    { key: 'notes', label: 'Notes', width: 160 },
  ], {
    rows: items, empty: 'Inventaire vide.', addLabel: 'Ajouter un article',
    onSave: (r, patch) => update('d_inventory', r.id, patch),
    onAdd: async () => { try { await insert('d_inventory', { project_id: pid, name: 'Nouvel article', quantity: 0 }); await render(ctx); el.querySelector('tbody tr:last-child .g-in')?.select(); } catch (e) { toastError(e); } },
    onDelete: async (r) => { if (await confirmDialog(`Supprimer <b>${esc(r.name)}</b> ?`)) { try { await remove('d_inventory', r.id); render(ctx); } catch (e) { toastError(e); } } },
    actions: (r) => (low(r) ? `<span class="badge badge-warn" title="Stock bas">${icon('triangle-alert')}</span>` : ''),
  });
  el.querySelector('[data-csv]').onclick = () => downloadCSV(`inventaire-${ctx.p.name}.csv`.replace(/\s+/g, '_'), items, [
    { label: 'Article', get: i => i.name }, { label: 'Catégorie', get: i => i.category }, { label: 'Quantité', get: i => i.quantity },
    { label: 'Seuil', get: i => i.alert_threshold }, { label: 'Valeur unitaire', get: i => i.unit_value }, { label: 'Emplacement', get: i => i.location },
  ]);
}
