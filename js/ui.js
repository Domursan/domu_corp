import { state } from './state.js';
import { uploadPhoto, errMsg } from './api.js';

// ---------------------------------------------------------------------
//  Petits utilitaires
// ---------------------------------------------------------------------
export const esc = (v) =>
  v == null ? '' : String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const icon = (name, cls = '') => `<i data-lucide="${name}" class="ic ${cls}"></i>`;

export function money(v) {
  const f = state.settings.format;
  const n = Number(v || 0);
  const s = n.toLocaleString(f.locale || 'fr-CH', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  return f.currencyPosition === 'after' ? `${s} ${f.currency}` : `${f.currency}${s}`;
}

export function fmtDate(d, opts = { day: '2-digit', month: '2-digit', year: 'numeric' }) {
  if (!d) return '';
  const dt = typeof d === 'string' && d.length === 10 ? new Date(d + 'T12:00:00') : new Date(d);
  return dt.toLocaleDateString(state.settings.format.locale || 'fr-CH', opts);
}

export function fmtDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${fmtDate(dt)} ${dt.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}`;
}

export function fmtTime(d) {
  return d ? new Date(d).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' }) : '';
}

export const todayISO = () => toISODate(new Date());
export function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${toISODate(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
}

export function charName(c) {
  return [c.first_name, c.last_name].filter(Boolean).join(' ');
}

export function avatar(url, name, color, size = 40) {
  const st = `width:${size}px;height:${size}px;${color ? `--av:${color};` : ''}`;
  return url
    ? `<img class="avatar" src="${esc(url)}" alt="" style="${st}">`
    : `<span class="avatar avatar-txt" style="${st};font-size:${Math.round(size / 2.6)}px">${esc(initials(name))}</span>`;
}

export function emptyState(title, text = '', action = '') {
  return `<div class="empty">${icon('inbox', 'ic-xl')}<h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${action}</div>`;
}

export const debounce = (fn, ms = 250) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

// ---------------------------------------------------------------------
//  Liens de projets (dev)
// ---------------------------------------------------------------------
export const LINK_KINDS = [
  { key: 'code', label: 'Modifier le code', icon: 'code' },
  { key: 'site', label: 'Voir le site', icon: 'globe' },
  { key: 'apps-script', label: 'Apps Script', icon: 'file-code' },
  { key: 'sheet', label: 'Google Sheet', icon: 'sheet' },
  { key: 'github', label: 'GitHub', icon: 'github' },
  { key: 'pages', label: 'GitHub Pages', icon: 'rocket' },
  { key: 'editor', label: 'Éditeur en ligne', icon: 'square-code' },
  { key: 'doc', label: 'Documentation', icon: 'book-open' },
  { key: 'supabase', label: 'Supabase', icon: 'database' },
  { key: 'drive', label: 'Google Drive', icon: 'hard-drive' },
  { key: 'design', label: 'Design (Canva, Figma…)', icon: 'palette' },
  { key: 'other', label: 'Autre', icon: 'link' },
];
export const linkKind = (k) => LINK_KINDS.find(x => x.key === k) || LINK_KINDS.at(-1);
export function detectLinkKind(url = '') {
  const u = url.toLowerCase();
  if (u.includes('script.google.com')) return 'apps-script';
  if (u.includes('docs.google.com/spreadsheets')) return 'sheet';
  if (u.includes('.github.io')) return 'pages';
  if (u.includes('github.dev') || u.includes('vscode.dev')) return 'code';
  if (u.includes('github.com')) return 'github';
  if (/codepen|replit|codesandbox|stackblitz|glitch|jsfiddle/.test(u)) return 'editor';
  if (u.includes('supabase.co') || u.includes('supabase.com')) return 'supabase';
  if (u.includes('drive.google.com')) return 'drive';
  if (/canva\.|figma\.com/.test(u)) return 'design';
  if (u.includes('docs.google.com') || u.includes('notion.')) return 'doc';
  return 'site';
}
export function linkButtons(links = [], small = false) {
  return links.filter(l => l.url).map(l => {
    const k = linkKind(l.kind);
    return `<a class="btn ${small ? 'btn-xs' : 'btn-sm'} btn-link" href="${esc(l.url)}" target="_blank" rel="noopener" title="${esc(l.url)}">${icon(k.icon)}<span>${esc(l.label || k.label)}</span></a>`;
  }).join('');
}

// ---------------------------------------------------------------------
//  Toasts
// ---------------------------------------------------------------------
export function toast(msg, type = 'ok') {
  let box = document.getElementById('toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    document.body.appendChild(box);
  }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `${icon(type === 'error' ? 'circle-alert' : 'circle-check')}<span>${esc(msg)}</span>`;
  box.appendChild(t);
  setTimeout(() => t.classList.add('out'), 3200);
  setTimeout(() => t.remove(), 3700);
}
export const toastError = (e) => { console.error(e); toast(errMsg(e), 'error'); };

// ---------------------------------------------------------------------
//  Modales
// ---------------------------------------------------------------------
export function modal({ title, body = '', footer = '', size = 'md', onClose } = {}) {
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `
    <div class="modal modal-${size}" role="dialog" aria-modal="true">
      <header class="modal-head"><h2>${esc(title)}</h2>
        <button class="btn-icon" data-close aria-label="Fermer">${icon('x')}</button></header>
      <div class="modal-body">${body}</div>
      ${footer ? `<footer class="modal-foot">${footer}</footer>` : ''}
    </div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('open'));
  const close = (v) => {
    ov.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => ov.remove(), 160);
    onClose?.(v);
  };
  const onKey = (e) => { if (e.key === 'Escape' && ov === document.querySelector('.modal-overlay:last-of-type')) close(null); };
  document.addEventListener('keydown', onKey);
  ov.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => close(null)));
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) ov.dataset.down = '1'; });
  ov.addEventListener('mouseup', (e) => { if (e.target === ov && ov.dataset.down && !ov.querySelector('form')) close(null); delete ov.dataset.down; });
  return { el: ov, close };
}

export function confirmDialog(text, { title = 'Confirmer', ok = 'Confirmer', danger = true, typeToConfirm = null } = {}) {
  return new Promise((resolve) => {
    const m = modal({
      title,
      size: 'sm',
      body: `<p>${text}</p>${typeToConfirm ? `<label class="field"><span>Tape <b>${esc(typeToConfirm)}</b> pour confirmer</span><input class="input" data-confirm-input autocomplete="off"></label>` : ''}`,
      footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok ${typeToConfirm ? 'disabled' : ''}>${esc(ok)}</button>`,
      onClose: (v) => resolve(!!v),
    });
    const okBtn = m.el.querySelector('[data-ok]');
    const inp = m.el.querySelector('[data-confirm-input]');
    inp?.addEventListener('input', () => (okBtn.disabled = inp.value.trim() !== typeToConfirm));
    inp?.focus();
    okBtn.addEventListener('click', () => m.close(true));
  });
}

// ---------------------------------------------------------------------
//  Formulaires générés
// ---------------------------------------------------------------------
function optionList(opts) {
  return (typeof opts === 'function' ? opts() : opts || []).map(o => (typeof o === 'object' ? o : { value: o, label: o }));
}

function fieldHTML(f, v) {
  const id = `f_${f.name}`;
  const req = f.required ? 'required' : '';
  const ph = f.placeholder ? `placeholder="${esc(f.placeholder)}"` : '';
  const wrap = (inner, cls = '') =>
    `<label class="field ${f.full ? 'full' : ''} ${cls}" for="${id}"><span>${esc(f.label)}${f.required ? ' *' : ''}</span>${inner}${f.help ? `<small>${esc(f.help)}</small>` : ''}</label>`;
  switch (f.type) {
    case 'section':
      return `<div class="form-section full">${f.icon ? icon(f.icon) : ''}<span>${esc(f.label)}</span></div>`;
    case 'textarea':
      return wrap(`<textarea class="input" id="${id}" name="${f.name}" rows="${f.rows || 3}" ${ph} ${req}>${esc(v)}</textarea>`);
    case 'select': {
      const opts = optionList(f.options);
      const has = opts.some(o => String(o.value) === String(v ?? ''));
      return wrap(`<select class="input" id="${id}" name="${f.name}" ${req}>
        ${f.empty !== false ? `<option value="">${esc(f.emptyLabel || '—')}</option>` : ''}
        ${!has && v ? `<option value="${esc(v)}" selected>${esc(v)}</option>` : ''}
        ${opts.map(o => `<option value="${esc(o.value)}" ${String(o.value) === String(v ?? '') ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
      </select>`);
    }
    case 'combo': {
      const opts = optionList(f.options);
      return wrap(`<input class="input" id="${id}" name="${f.name}" list="${id}_dl" value="${esc(v)}" ${ph} ${req} autocomplete="off">
        <datalist id="${id}_dl">${opts.map(o => `<option value="${esc(o.value)}">`).join('')}</datalist>`);
    }
    case 'money':
    case 'number':
      return wrap(`<div class="input-wrap">${f.type === 'money' ? `<span class="input-prefix">${esc(state.settings.format.currency)}</span>` : ''}
        <input class="input" type="number" id="${id}" name="${f.name}" value="${v ?? ''}" step="${f.step || (f.type === 'money' ? '0.01' : '1')}" ${f.min != null ? `min="${f.min}"` : ''} ${ph} ${req}></div>`);
    case 'date':
      return wrap(`<input class="input" type="date" id="${id}" name="${f.name}" value="${esc(v || '')}" ${req}>`);
    case 'datetime':
      return wrap(`<input class="input" type="datetime-local" id="${id}" name="${f.name}" value="${toLocalInput(v)}" ${req}>`);
    case 'color':
      return wrap(`<input class="input input-color" type="color" id="${id}" name="${f.name}" value="${esc(v || f.default || '#3b82f6')}">`);
    case 'multi': {
      const opts = optionList(f.options); const sel = (v || []).map(String);
      return `<div class="field full"><span>${esc(f.label)}</span><div class="multi" data-multi="${f.name}">${opts.length ? opts.map(o => `<label class="multi-opt"><input type="checkbox" value="${esc(o.value)}" ${sel.includes(String(o.value)) ? 'checked' : ''}><span>${esc(o.label)}</span></label>`).join('') : '<small class="muted">Aucun choix disponible.</small>'}</div>${f.help ? `<small>${esc(f.help)}</small>` : ''}</div>`;
    }
    case 'checkbox':
      return `<label class="check ${f.full ? 'full' : ''}"><input type="checkbox" name="${f.name}" ${v ? 'checked' : ''}><span>${esc(f.label)}</span></label>`;
    case 'photo':
      return wrap(`<div class="photo-field" data-photo="${f.name}">
          <div class="photo-preview">${v ? `<img src="${esc(v)}" alt="">` : icon('image', 'ic-lg')}</div>
          <div class="photo-actions">
            <button type="button" class="btn btn-sm btn-ghost" data-photo-pick>${icon('upload')} Choisir une image</button>
            <button type="button" class="btn btn-sm btn-ghost" data-photo-url>${icon('link')} Lien</button>
            <button type="button" class="btn btn-sm btn-ghost" data-photo-clear ${v ? '' : 'hidden'}>${icon('x')} Retirer</button>
          </div>
          <input type="file" accept="image/*" hidden data-photo-file>
          <input type="hidden" name="${f.name}" value="${esc(v || '')}">
        </div>`, 'full');
    case 'links':
      return `<div class="field full"><span>${esc(f.label)}</span>
        <div class="links-editor" data-links="${f.name}">${(v || []).map(linkRowHTML).join('')}</div>
        <div class="row gap-s wrap">
          <button type="button" class="btn btn-sm btn-ghost" data-link-add>${icon('plus')} Ajouter un lien</button>
          <button type="button" class="btn btn-sm btn-ghost" data-link-add="code">${icon('code')} Modifier le code</button>
          <button type="button" class="btn btn-sm btn-ghost" data-link-add="site">${icon('globe')} Voir le site</button>
        </div>${f.help ? `<small>${esc(f.help)}</small>` : ''}</div>`;
    case 'tasks':
      return `<div class="field full"><span>${esc(f.label)}</span>
        <div class="tasks-editor" data-tasks="${f.name}">${(v || []).map(taskRowHTML).join('')}</div>
        <button type="button" class="btn btn-sm btn-ghost" data-task-add>${icon('plus')} Ajouter une tâche</button></div>`;
    default:
      return wrap(`<input class="input" type="${f.type || 'text'}" id="${id}" name="${f.name}" value="${esc(v)}" ${ph} ${req} ${f.autofocus ? 'autofocus' : ''}>`);
  }
}

function linkRowHTML(l = {}) {
  return `<div class="link-row">
    <select class="input" data-k="kind">${LINK_KINDS.map(k => `<option value="${k.key}" ${k.key === (l.kind || 'site') ? 'selected' : ''}>${k.label}</option>`).join('')}</select>
    <input class="input" data-k="label" placeholder="Libellé (optionnel)" value="${esc(l.label || '')}">
    <input class="input" data-k="url" type="url" placeholder="https://…" value="${esc(l.url || '')}">
    <button type="button" class="btn-icon" data-row-del title="Retirer">${icon('trash-2')}</button>
  </div>`;
}
function taskRowHTML(t = {}) {
  return `<div class="task-row"><input type="checkbox" data-k="done" ${t.done ? 'checked' : ''}>
    <input class="input" data-k="text" value="${esc(t.text || '')}" placeholder="Tâche…">
    <button type="button" class="btn-icon" data-row-del title="Retirer">${icon('trash-2')}</button></div>`;
}

export function readForm(form, fields) {
  const out = {};
  for (const f of fields) {
    if (f.type === 'section') continue;
    if (f.type === 'links') {
      out[f.name] = [...form.querySelectorAll(`[data-links="${f.name}"] .link-row`)].map(r => ({
        kind: r.querySelector('[data-k=kind]').value,
        label: r.querySelector('[data-k=label]').value.trim(),
        url: r.querySelector('[data-k=url]').value.trim(),
      })).filter(l => l.url);
      continue;
    }
    if (f.type === 'multi') {
      out[f.name] = [...form.querySelectorAll(`[data-multi="${f.name}"] input:checked`)].map(i => i.value);
      continue;
    }
    if (f.type === 'tasks') {
      out[f.name] = [...form.querySelectorAll(`[data-tasks="${f.name}"] .task-row`)].map(r => ({
        done: r.querySelector('[data-k=done]').checked,
        text: r.querySelector('[data-k=text]').value.trim(),
      })).filter(t => t.text);
      continue;
    }
    const el = form.elements[f.name];
    if (!el) continue;
    if (f.type === 'checkbox') out[f.name] = el.checked;
    else if (f.type === 'number' || f.type === 'money') out[f.name] = el.value === '' ? null : Number(el.value);
    else if (f.type === 'datetime') out[f.name] = el.value ? new Date(el.value).toISOString() : null;
    else out[f.name] = el.value.trim() === '' ? null : el.value.trim();
  }
  return out;
}

function bindFormWidgets(root) {
  root.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.matches('[data-row-del]')) t.parentElement.remove();
    if (t.matches('[data-link-add]')) {
      const box = t.closest('.field').querySelector('.links-editor');
      const kind = t.dataset.linkAdd || 'site';
      box.insertAdjacentHTML('beforeend', linkRowHTML({ kind, label: kind === 'code' ? 'Modifier le code' : kind === 'site' ? 'Voir le site' : '' }));
      box.lastElementChild.querySelector('[data-k=url]').focus();
    }
    if (t.matches('[data-task-add]')) {
      const box = t.closest('.field').querySelector('.tasks-editor');
      box.insertAdjacentHTML('beforeend', taskRowHTML());
      box.lastElementChild.querySelector('[data-k=text]').focus();
    }
    const pf = t.closest('[data-photo]');
    if (pf) {
      const hidden = pf.querySelector('input[type=hidden]');
      const prev = pf.querySelector('.photo-preview');
      const clear = pf.querySelector('[data-photo-clear]');
      const set = (url) => {
        hidden.value = url || '';
        prev.innerHTML = url ? `<img src="${esc(url)}" alt="">` : icon('image', 'ic-lg');
        clear.hidden = !url;
      };
      if (t.matches('[data-photo-pick]')) pf.querySelector('[data-photo-file]').click();
      if (t.matches('[data-photo-clear]')) set('');
      if (t.matches('[data-photo-url]')) {
        const url = prompt('Colle le lien direct de l’image :', hidden.value);
        if (url !== null) set(url.trim());
      }
      pf._set = set;
    }
  });
  root.addEventListener('input', (e) => {
    const urlInput = e.target.closest('.link-row [data-k=url]');
    if (urlInput) {
      const row = urlInput.closest('.link-row');
      const kindSel = row.querySelector('[data-k=kind]');
      if (!row.dataset.touched) kindSel.value = detectLinkKind(urlInput.value);
    }
  });
  root.addEventListener('change', async (e) => {
    if (e.target.matches('.link-row [data-k=kind]')) e.target.closest('.link-row').dataset.touched = '1';
    if (!e.target.matches('[data-photo-file]')) return;
    const file = e.target.files[0];
    if (!file) return;
    const pf = e.target.closest('[data-photo]');
    const prev = pf.querySelector('.photo-preview');
    prev.innerHTML = '<span class="spinner"></span>';
    try {
      const url = await uploadPhoto(file, state.user.id);
      pf.querySelector('input[type=hidden]').value = url;
      prev.innerHTML = `<img src="${esc(url)}" alt="">`;
      pf.querySelector('[data-photo-clear]').hidden = false;
    } catch (err) {
      prev.innerHTML = icon('image', 'ic-lg');
      toastError(err);
    }
    e.target.value = '';
  });
}

/**
 * Ouvre un formulaire dans une modale.
 * Résout avec les valeurs, `{ __delete: true }` si l'utilisateur supprime, ou null.
 */
export function formModal({ title, fields, values = {}, submit = 'Enregistrer', onDelete = false, size = 'md', intro = '', onSubmit }) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({
      title,
      size,
      body: `${intro ? `<p class="muted mb">${intro}</p>` : ''}<form class="form-grid" novalidate>${fields.map(f => fieldHTML(f, values[f.name])).join('')}<button type="submit" hidden></button></form>`,
      footer: `${onDelete ? `<button class="btn btn-danger-ghost mr-auto" data-del>${icon('trash-2')} Supprimer</button>` : ''}
        <button class="btn btn-ghost" data-close>Annuler</button>
        <button class="btn btn-primary" data-submit>${icon('check')} ${esc(submit)}</button>`,
      onClose: (v) => { if (!done) resolve(v ?? null); },
    });
    const form = m.el.querySelector('form');
    bindFormWidgets(form);
    const first = form.querySelector('input:not([type=hidden]):not([type=checkbox]),textarea,select');
    setTimeout(() => first?.focus(), 50);
    const go = async () => {
      if (!form.reportValidity()) return;
      const v = readForm(form, fields);
      if (onSubmit) {
        const btn = m.el.querySelector('[data-submit]');
        btn.disabled = true;
        try { await onSubmit(v); } catch (err) { toastError(err); btn.disabled = false; return; }
      }
      done = true; resolve(v); m.close(v);
    };
    m.el.querySelector('[data-submit]').addEventListener('click', go);
    form.addEventListener('submit', (e) => { e.preventDefault(); go(); });
    m.el.querySelector('[data-del]')?.addEventListener('click', () => { done = true; resolve({ __delete: true }); m.close(true); });
  });
}

/** Petit menu contextuel attaché à un bouton. items = [{label, icon, action, danger}] */
export function popMenu(anchor, items) {
  document.querySelectorAll('.pop-menu').forEach(x => x.remove());
  const menu = document.createElement('div');
  menu.className = 'pop-menu';
  menu.innerHTML = items.filter(Boolean).map((it, i) =>
    it === '-' ? '<hr>' : `<button data-i="${i}" class="${it.danger ? 'danger' : ''}">${icon(it.icon || 'dot')}<span>${esc(it.label)}</span></button>`).join('');
  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  const w = menu.offsetWidth;
  menu.style.top = `${Math.min(r.bottom + 4 + window.scrollY, window.scrollY + window.innerHeight - menu.offsetHeight - 8)}px`;
  menu.style.left = `${Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8))}px`;
  const list = items.filter(Boolean);
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    menu.remove();
    list[b.dataset.i]?.action?.();
  });
  setTimeout(() => document.addEventListener('click', function off(e) {
    if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', off); }
  }), 0);
}

/** Exporte un tableau d'objets en CSV téléchargeable. */
export function downloadCSV(filename, rows, cols) {
  const escCSV = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.map(c => escCSV(c.label)).join(';'), ...rows.map(r => cols.map(c => escCSV(c.get(r))).join(';'))].join('\n');
  downloadFile(filename, '﻿' + csv, 'text/csv;charset=utf-8');
}
export function downloadFile(filename, content, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Réordonner par glisser-déposer (souris + tactile) via une poignée.
// onEnd(from, to) est appelé avec les index avant / après le déplacement.
export function sortable(container, { item, handle = '.drag-handle', onEnd }) {
  if (!container) return;
  container.addEventListener('pointerdown', (e) => {
    if (e.button && e.button !== 0) return;
    const h = e.target.closest(handle);
    if (!h || !container.contains(h) || e.target.closest('button, input, select, textarea, a')) return;
    const it = h.closest(item);
    if (!it || it.parentElement !== container) return;
    e.preventDefault();
    const items = () => [...container.children].filter(x => x.matches(item));
    const from = items().indexOf(it);
    const cs = getComputedStyle(container);
    const horizontal = cs.display.includes('flex') && !cs.flexDirection.startsWith('column');
    it.classList.add('dragging');
    document.body.classList.add('is-sorting');
    const move = (ev) => {
      const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(item);
      if (!over || over === it || over.parentElement !== container) return;
      const r = over.getBoundingClientRect();
      const after = horizontal ? ev.clientX > r.left + r.width / 2 : ev.clientY > r.top + r.height / 2;
      container.insertBefore(it, after ? over.nextSibling : over);
    };
    const up = (ev) => {
      if (ev?.type === 'pointerup') move(ev);
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      it.classList.remove('dragging'); document.body.classList.remove('is-sorting');
      const to = items().indexOf(it);
      if (to !== from && to > -1) onEnd(from, to);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  });
}
export const moveItem = (arr, from, to) => { arr.splice(to, 0, arr.splice(from, 1)[0]); return arr; };
