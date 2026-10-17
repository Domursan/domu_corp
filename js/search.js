import { sb } from './api.js';
import { state } from './state.js';
import { esc, icon, debounce } from './ui.js';

const clean = (q) => q.replace(/[%,()*\\:"]/g, ' ').trim();

export function initSearch() {
  const input = document.getElementById('search-input');
  const box = document.getElementById('search-results');
  if (!input) return;
  let sel = -1;
  const close = () => { box.hidden = true; sel = -1; };
  const pName = (id) => state.projects.find(p => p.id === id)?.name || '';

  const run = debounce(async () => {
    const q = clean(input.value);
    if (q.length < 2) { close(); return; }
    const like = `%${q}%`;
    const lo = q.toLowerCase();
    const [links, tasks, notes, feats, bugs] = await Promise.all([
      sb.from('d_links').select('id,project_id,label,url').or(`label.ilike.${like},url.ilike.${like}`).limit(6),
      sb.from('d_tasks').select('id,project_id,title,status').ilike('title', like).limit(6),
      sb.from('d_notes').select('id,project_id,title').or(`title.ilike.${like},content.ilike.${like}`).limit(6),
      sb.from('d_features').select('id,name,summary').or(`name.ilike.${like},summary.ilike.${like},description.ilike.${like}`).limit(6),
      sb.from('d_bugs').select('id,project_id,title,kind').ilike('title', like).limit(6),
    ]);
    const projects = state.projects.filter(p => [p.name, p.description, ...(p.tags || [])].some(x => x?.toLowerCase().includes(lo))).slice(0, 6);
    const groups = [
      ['Projets', 'folder-kanban', projects.map(p => ({ h: `#/p/${p.id}`, t: `${p.icon || ''} ${p.name}`, s: p.category || '' }))],
      ['Liens', 'link', (links.data || []).map(l => ({ h: l.url, t: l.label || l.url, s: pName(l.project_id), ext: true }))],
      ['Tâches', 'list-checks', (tasks.data || []).map(t => ({ h: `#/p/${t.project_id}/tasks`, t: t.title, s: `${pName(t.project_id)} · ${t.status || ''}` }))],
      ['Notes', 'notebook-pen', (notes.data || []).map(n => ({ h: `#/p/${n.project_id}/notes`, t: n.title, s: pName(n.project_id) }))],
      ['Bugs & idées', 'bug', (bugs.data || []).map(b => ({ h: `#/p/${b.project_id}/bugs`, t: b.title, s: `${pName(b.project_id)} · ${b.kind}` }))],
      ['Features', 'blocks', (feats.data || []).map(f => ({ h: '#/features', t: f.name, s: f.summary || '' }))],
    ].filter(g => g[2].length);
    box.innerHTML = groups.length ? groups.map(([label, ic, items]) => `<div class="sr-group"><div class="sr-label">${icon(ic)} ${label}</div>
      ${items.map(it => `<a class="sr-item" href="${esc(it.h)}" ${it.ext ? 'target="_blank" rel="noopener"' : ''}><b>${esc(it.t)}</b><small>${esc(it.s)}</small></a>`).join('')}</div>`).join('')
      : `<div class="sr-empty">Aucun résultat pour « ${esc(q)} »</div>`;
    box.hidden = false; sel = -1;
  }, 250);

  input.addEventListener('input', run);
  input.addEventListener('focus', () => { if (box.innerHTML && input.value.length >= 2) box.hidden = false; });
  input.addEventListener('keydown', (e) => {
    const items = [...box.querySelectorAll('.sr-item')];
    if (e.key === 'Escape') { close(); input.blur(); }
    if (!items.length || box.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((x, i) => x.classList.toggle('on', i === sel));
      items[sel].scrollIntoView({ block: 'nearest' });
    }
    if (e.key === 'Enter') { e.preventDefault(); (items[sel] || items[0]).click(); }
  });
  box.addEventListener('click', (e) => { if (e.target.closest('.sr-item')) { close(); input.value = ''; } });
  document.addEventListener('click', (e) => { if (!e.target.closest('.search')) close(); });
}
