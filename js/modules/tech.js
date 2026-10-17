import { update } from '../api.js';
import { esc, icon, toast, toastError } from '../ui.js';
import { refreshProjects } from '../app.js';

const FIELDS = [
  ['stack', 'Stack', 'ex. HTML/CSS/JS vanilla + Supabase'],
  ['hosting', 'Hébergement', 'ex. GitHub Pages, Apps Script, Cloudflare'],
  ['database', 'Données', 'ex. Supabase « Gestion_RP », Google Sheet'],
  ['repo', 'Dépôt / dossier', 'ex. github.com/… ou C:\\…\\Dev\\…'],
  ['prod_url', 'URL de production', 'https://…'],
  ['test_url', 'URL de test', 'https://…'],
  ['version', 'Version actuelle', 'ex. 2.7.1'],
];

export default async function render(ctx) {
  const { el, p } = ctx;
  const t = { identifiers: [], ...(p.tech || {}) };

  el.innerHTML = `
    <div class="toolbar"><h2 class="h-sec">${icon('cpu')} Fiche technique</h2><span class="saved-dot" data-saved>${icon('check')} Enregistré</span></div>
    <div class="dash-grid">
      <section class="panel">
        <div class="panel-head"><h2>${icon('layers')} Général</h2></div>
        <table class="kv kv-edit">${FIELDS.map(([k, l, ph]) => `<tr><th>${l}</th><td><div class="row gap-s"><input class="input input-sm" data-k="${k}" value="${esc(t[k] || '')}" placeholder="${esc(ph)}">${/url/.test(k) ? `<a class="btn-icon" ${t[k] ? `href="${esc(t[k])}" target="_blank" rel="noopener"` : ''} title="Ouvrir">${icon('external-link')}</a>` : ''}</div></td></tr>`).join('')}</table>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>${icon('key-round')} Identifiants</h2></div>
        <p class="muted small pad-x">ID de Sheet, de projet Supabase, de script… <b>Jamais de mot de passe ni de clé secrète.</b></p>
        <div class="obj-rows pad" data-ids>${t.identifiers.map((x, i) => idRow(x, i)).join('')}</div>
        <div class="pad"><button class="btn btn-sm btn-ghost" data-add-id>${icon('plus')} Ajouter</button></div>
      </section>
      <section class="panel span-2">
        <div class="panel-head"><h2>${icon('file-code')} Notes techniques</h2></div>
        <textarea class="info-text" data-k="notes" rows="8" placeholder="Architecture, fichiers, contraintes (ex. pas de // dans Scripts.html), commandes…">${esc(t.notes || '')}</textarea>
      </section>
    </div>`;

  let timer;
  const save = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        p.tech = t; await update('d_projects', p.id, { tech: t }); await refreshProjects();
        const s = el.querySelector('[data-saved]'); s.classList.add('show'); setTimeout(() => s.classList.remove('show'), 900);
      } catch (e) { toastError(e); }
    }, 500);
  };
  el.querySelectorAll('[data-k]').forEach(inp => inp.addEventListener('input', () => { t[inp.dataset.k] = inp.value; save(); }));
  const box = el.querySelector('[data-ids]');
  box.addEventListener('input', (e) => { const r = e.target.closest('[data-i]'); if (!r) return; t.identifiers[+r.dataset.i][e.target.dataset.f] = e.target.value; save(); });
  box.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const i = +b.closest('[data-i]').dataset.i;
    if (b.dataset.act === 'del') { t.identifiers.splice(i, 1); save(); render(ctx); }
    if (b.dataset.act === 'copy') { try { await navigator.clipboard.writeText(t.identifiers[i].value || ''); toast('Copié'); } catch { toast('Copie impossible', 'error'); } }
  });
  el.querySelector('[data-add-id]').onclick = () => { t.identifiers.push({ label: '', value: '' }); p.tech = t; render(ctx); };
}

function idRow(x, i) {
  return `<div class="obj-row" data-i="${i}"><input class="input input-sm" data-f="label" value="${esc(x.label || '')}" placeholder="Libellé (ex. Sheet ID)" style="max-width:180px">
    <input class="input input-sm mono" data-f="value" value="${esc(x.value || '')}" placeholder="Valeur">
    <button class="btn-icon sm" data-act="copy" title="Copier">${icon('copy')}</button><button class="btn-icon sm" data-act="del" title="Retirer">${icon('x')}</button></div>`;
}
