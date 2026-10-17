// Tableau éditable « à la Tane » : saisie directe dans les cellules, groupes de colonnes,
// première colonne figée, totaux en pied de tableau, enregistrement automatique.
import { esc, icon, money, toastError } from './ui.js';

/**
 * cols : [{ key, label, type, options, group, total, get, width, placeholder }]
 *   type : text | money | number | select | check | date | calc | ref
 *   options : tableau (ou fonction) de valeurs / {value,label}
 *   get : (row) => valeur pour les colonnes calc
 * opts : { rows, onSave(row, patch), onDelete(row), onAdd(), actions(row) => html, empty, addLabel, readonly }
 */
export function renderGrid(el, cols, opts) {
  const rows = opts.rows;
  const groups = [];
  cols.forEach(c => {
    const g = c.group || '';
    if (groups.length && groups.at(-1).name === g) groups.at(-1).span++;
    else groups.push({ name: g, span: 1 });
  });
  const hasGroups = groups.some(g => g.name);
  const opt = (c) => (typeof c.options === 'function' ? c.options() : c.options || []).map(o => (typeof o === 'object' ? o : { value: o, label: o }));
  const fmt = (c, v) => (v == null || v === '' ? '' : c.type === 'money' || c.type === 'calc' ? money(v) : esc(v));

  const cell = (c, r) => {
    const v = r[c.key];
    const ro = opts.readonly || c.readonly;
    if (c.type === 'calc') return `<td class="g-calc ${c.cls || ''}">${fmt(c, c.get(r))}</td>`;
    if (c.type === 'html') return `<td class="${c.cls || ''}">${c.get(r)}</td>`;
    if (ro) return `<td class="${c.type === 'money' ? 'right' : ''}">${c.type === 'check' ? (v ? icon('check', 'success') : '') : c.type === 'ref' || c.type === 'select' ? esc(opt(c).find(o => String(o.value) === String(v))?.label || v || '') : fmt(c, v)}</td>`;
    const a = `data-k="${c.key}" data-id="${r.id}"`;
    switch (c.type) {
      case 'check': return `<td class="center"><input type="checkbox" class="g-check" ${a} ${v ? 'checked' : ''} aria-label="${esc(c.label)}"></td>`;
      case 'select': case 'ref': {
        const os = opt(c);
        return `<td><select class="g-in" ${a}><option value=""></option>${!os.some(o => String(o.value) === String(v ?? '')) && v ? `<option selected>${esc(v)}</option>` : ''}${os.map(o => `<option value="${esc(o.value)}" ${String(o.value) === String(v ?? '') ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></td>`;
      }
      case 'money': case 'number':
        return `<td><input class="g-in right" type="number" step="any" ${a} value="${v ?? ''}" placeholder="${esc(c.placeholder || '')}"></td>`;
      case 'date':
        return `<td><input class="g-in" type="date" ${a} value="${esc(v || '')}"></td>`;
      default:
        return `<td><input class="g-in" ${a} value="${esc(v ?? '')}" placeholder="${esc(c.placeholder || '')}"></td>`;
    }
  };

  const totals = () => cols.map((c, i) => {
    if (!c.total) return i === 0 ? '<td><b>Total</b></td>' : '<td></td>';
    const vals = rows.map(r => (c.type === 'calc' ? c.get(r) : r[c.key])).filter(v => v != null && v !== '');
    return `<td class="right"><b>${vals.length ? money(vals.reduce((a, v) => a + Number(v), 0)) : ''}</b></td>`;
  }).join('') + (opts.actions || opts.onDelete ? '<td></td>' : '');

  el.innerHTML = `
    <div class="grid-wrap"><table class="grid">
      <thead>
        ${hasGroups ? `<tr class="g-groups">${groups.map(g => `<th colspan="${g.span}">${esc(g.name)}</th>`).join('')}${opts.actions || opts.onDelete ? '<th></th>' : ''}</tr>` : ''}
        <tr>${cols.map(c => `<th class="${c.type === 'money' || c.type === 'calc' ? 'right' : c.type === 'check' ? 'center' : ''}" style="${c.width ? `min-width:${c.width}px` : ''}">${esc(c.label)}</th>`).join('')}${opts.actions || opts.onDelete ? '<th></th>' : ''}</tr>
      </thead>
      <tbody>${rows.length ? rows.map(r => `<tr data-row="${r.id}">${cols.map(c => cell(c, r)).join('')}${opts.actions || opts.onDelete ? `<td class="g-act nowrap">${opts.actions ? opts.actions(r) : ''}${opts.onDelete && !opts.readonly ? `<button class="btn-icon sm" data-del="${r.id}" title="Supprimer">${icon('trash-2')}</button>` : ''}</td>` : ''}</tr>`).join('')
        : `<tr><td colspan="${cols.length + 1}" class="muted center pad">${esc(opts.empty || 'Aucune ligne.')}</td></tr>`}</tbody>
      ${cols.some(c => c.total) && rows.length ? `<tfoot><tr>${totals()}</tr></tfoot>` : ''}
    </table></div>
    ${opts.onAdd && !opts.readonly ? `<button class="btn btn-sm btn-ghost mt-s" data-add-row>${icon('plus')} ${esc(opts.addLabel || 'Ajouter une ligne')}</button>` : ''}`;

  const refreshCalc = (row) => {
    const tr = el.querySelector(`tr[data-row="${row.id}"]`);
    cols.forEach((c, i) => { if (c.type === 'calc') tr.children[i].innerHTML = fmt(c, c.get(row)); });
    const tf = el.querySelector('tfoot tr');
    if (tf) tf.innerHTML = totals();
  };

  const save = async (input) => {
    const row = rows.find(r => r.id === input.dataset.id);
    const c = cols.find(x => x.key === input.dataset.k);
    let v = c.type === 'check' ? input.checked : input.value;
    if (c.type === 'money' || c.type === 'number') v = v === '' ? null : Number(v);
    else if (c.type !== 'check' && v === '') v = null;
    if (row[c.key] === v) return;
    const prev = row[c.key];
    row[c.key] = v;
    input.classList.add('saving');
    try {
      await opts.onSave(row, { [c.key]: v });
      input.classList.remove('saving');
      input.classList.add('saved');
      setTimeout(() => input.classList.remove('saved'), 700);
      refreshCalc(row);
    } catch (e) { row[c.key] = prev; input.classList.remove('saving'); toastError(e); }
  };
  el.querySelectorAll('.g-in, .g-check').forEach(i => i.addEventListener('change', () => save(i)));
  el.querySelectorAll('.g-in').forEach(i => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') i.blur(); }));
  el.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => opts.onDelete(rows.find(r => r.id === b.dataset.del))));
  el.querySelector('[data-add-row]')?.addEventListener('click', () => opts.onAdd());
}
