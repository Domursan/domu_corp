import { sb, list, errMsg } from '../api.js';
import { state, saveSettings, applyTheme, resetSettings, activeSeason, DEFAULT_SETTINGS } from '../state.js';
import { esc, icon, toast, toastError, confirmDialog, formModal, downloadFile, todayISO, sortable, moveItem } from '../ui.js';
import { startTour } from '../tour.js';
import { refreshNav } from '../app.js';
import { OPTIONAL } from '../modules/registry.js';

const ACCENTS = ['#3b82f6', '#0ea5e9', '#6366f1', '#8b5cf6', '#14b8a6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899'];

const LISTS = [
  { key: 'tags', label: 'Étiquettes suggérées', icon: 'tag' },
  { key: 'taskStatuses', label: 'Statuts des tâches (colonnes, le dernier = terminé)', icon: 'list-checks' },
  { key: 'bugKinds', label: 'Types (Bugs & idées)', icon: 'bug' },
  { key: 'bugStatuses', label: 'Statuts (Bugs & idées, les 2 derniers = fermés)', icon: 'circle-dot' },
  { key: 'incomeCategories', label: 'Catégories de recettes', icon: 'trending-up' },
  { key: 'expenseCategories', label: 'Catégories de dépenses', icon: 'trending-down' },
  { key: 'balanceOnlyCategories', label: 'Catégories « solde uniquement »', icon: 'piggy-bank' },
  { key: 'inventoryCategories', label: 'Catégories d’inventaire', icon: 'package' },
  { key: 'featureCategories', label: 'Catégories de features', icon: 'blocks' },
  { key: 'deployChecklist', label: 'Checklist de déploiement par défaut', icon: 'rocket' },
];
const OBJ_LISTS = [
  { key: 'categories', label: 'Catégories de projets', icon: 'folder-tree', fields: [{ k: 'icon', ph: '📁', w: 56 }, { k: 'name', ph: 'Nom' }, { k: 'color', type: 'color' }] },
  { key: 'statuses', label: 'Statuts de projets', icon: 'flag', help: '« Archivé » masque le projet du menu et de l’accueil.', fields: [{ k: 'name', ph: 'Statut' }, { k: 'color', type: 'color' }] },
  { key: 'priorities', label: 'Priorités (de la plus basse à la plus haute)', icon: 'signal', fields: [{ k: 'name', ph: 'Priorité' }, { k: 'color', type: 'color' }] },
  { key: 'contactStatuses', label: 'Statuts des contacts', icon: 'contact', fields: [{ k: 'name', ph: 'Statut' }, { k: 'color', type: 'color' }] },
];
const EXPORT = ['d_projects', 'd_contacts', 'd_links', 'd_tasks', 'd_notes', 'd_changelog', 'd_events', 'd_files', 'd_transactions', 'd_inventory', 'd_bugs', 'd_features'];

function objInput(key, i, f, v) {
  const a = `data-ol="${key}:${i}:${f.k}"`;
  if (f.type === 'color') return `<input type="color" class="input-color sm" ${a} value="${esc(v || '#3b82f6')}">`;
  return `<input class="input input-sm" ${a} value="${esc(v ?? '')}" placeholder="${esc(f.ph || '')}" style="${f.w ? `width:${f.w}px;flex:none;text-align:center` : ''}">`;
}

export default async function render({ el }) {
  const { data: profile } = await sb.from('profiles').select('*').eq('id', state.user.id).maybeSingle();
  draw(el, profile);
}

function draw(el, profile) {
  const S = state.settings;
  const a = S.appearance;
  const season = activeSeason();
  const cats = S.lists.categories.map(c => c.name);

  el.innerHTML = `
    <div class="page-head"><div><h1>${icon('settings')} Paramètres</h1><p class="muted">Réglages globaux de Domursan.</p></div></div>
    <div class="settings">
      <nav class="settings-nav">
        <a href="#set-appearance" data-jump>${icon('palette')} Apparence</a>
        <a href="#set-seasons" data-jump>${icon('sparkles')} Thèmes saisonniers</a>
        <a href="#set-objlists" data-jump>${icon('folder-tree')} Catégories & statuts</a>
        <a href="#set-modules" data-jump>${icon('layout-grid')} Onglets par défaut</a>
        <a href="#set-lists" data-jump>${icon('list')} Listes</a>
        <a href="#set-billing" data-jump>${icon('wallet')} Compta & contacts</a>
        <a href="#set-format" data-jump>${icon('coins')} Format</a>
        <a href="#set-account" data-jump>${icon('user')} Compte</a>
        <a href="#set-data" data-jump>${icon('database')} Données</a>
      </nav>
      <div class="settings-body">
        <section class="panel" id="set-appearance">
          <div class="panel-head"><h2>${icon('palette')} Apparence</h2></div>
          <div class="set-row"><div><b>Mode</b><small>Jour, nuit, ou selon ton appareil.</small></div>
            <div class="seg">
              ${[['light', 'sun', 'Jour'], ['dark', 'moon', 'Nuit'], ['system', 'monitor', 'Auto']].map(([v, i, l]) => `<button class="${a.mode === v ? 'on' : ''}" data-mode="${v}">${icon(i)} ${l}</button>`).join('')}
            </div></div>
          <div class="set-row"><div><b>Mode daltonien</b><small>Remplace le rouge / vert par orange / bleu et renforce les contrastes.</small></div>
            <label class="switch"><input type="checkbox" data-colorblind ${a.colorblind ? 'checked' : ''}><span></span></label></div>
          <div class="set-row"><div><b>Couleur principale</b><small>${season ? `Le thème « ${esc(season.name)} » la remplace en ce moment.` : 'Utilisée pour les boutons et éléments actifs.'}</small></div>
            <div class="swatches">${ACCENTS.map(c => `<button class="swatch ${a.accent === c ? 'on' : ''}" style="--sw:${c}" data-accent="${c}" aria-label="${c}"></button>`).join('')}
              <input type="color" class="input-color" value="${esc(a.accent)}" data-accent-custom title="Couleur personnalisée"></div></div>
        </section>

        <section class="panel" id="set-seasons">
          <div class="panel-head"><h2>${icon('sparkles')} Thèmes saisonniers</h2>${season ? `<span class="badge">${season.emoji} ${esc(season.name)} actif</span>` : ''}</div>
          <div class="set-row"><div><b>Activation</b><small>« Automatique » choisit le thème selon la date (le premier de la liste qui correspond).</small></div>
            <select class="input input-sm" data-seasonal>
              <option value="auto" ${a.seasonal === 'auto' ? 'selected' : ''}>Automatique</option>
              <option value="off" ${a.seasonal === 'off' ? 'selected' : ''}>Désactivé</option>
              ${S.seasons.map(s => `<option value="${s.key}" ${a.seasonal === s.key ? 'selected' : ''}>Forcer : ${s.emoji} ${esc(s.name)}</option>`).join('')}
            </select></div>
          <div class="set-row"><div><b>Animation</b><small>Petites particules qui tombent (flocons, feuilles…).</small></div>
            <label class="switch"><input type="checkbox" data-particles ${a.particles ? 'checked' : ''}><span></span></label></div>
          <div class="table-wrap"><table class="table seasons-table">
            <thead><tr><th></th><th>Actif</th><th>Nom</th><th>Emoji</th><th>Du (MM-JJ)</th><th>Au (MM-JJ)</th><th>Couleur</th><th>Particule</th><th></th></tr></thead>
            <tbody data-sort-seasons>${S.seasons.map((s, i) => `<tr data-si="${i}">
              <td class="handle-cell"><span class="drag-handle" title="Glisser pour réordonner">${icon('grip-vertical')}</span></td>
              <td><input type="checkbox" data-sf="enabled" ${s.enabled ? 'checked' : ''}></td>
              <td><input class="input input-sm" data-sf="name" value="${esc(s.name)}"></td>
              <td><input class="input input-sm w-emoji" data-sf="emoji" value="${esc(s.emoji)}"></td>
              <td><input class="input input-sm w-date" data-sf="start" value="${esc(s.start)}" pattern="\\d{2}-\\d{2}"></td>
              <td><input class="input input-sm w-date" data-sf="end" value="${esc(s.end)}" pattern="\\d{2}-\\d{2}"></td>
              <td><input type="color" class="input-color" data-sf="accent" value="${esc(s.accent)}"></td>
              <td><input class="input input-sm w-emoji" data-sf="particle" value="${esc(s.particle || '')}"></td>
              <td class="nowrap"><button class="btn-icon sm" data-sdel="${i}" title="Supprimer">${icon('trash-2')}</button></td>
            </tr>`).join('')}</tbody></table></div>
          <div class="row gap-s pad"><button class="btn btn-sm btn-ghost" data-sadd>${icon('plus')} Ajouter un thème</button><button class="btn btn-sm btn-ghost" data-sreset>${icon('rotate-ccw')} Thèmes par défaut</button></div>
        </section>

        <section class="panel" id="set-objlists">
          <div class="panel-head"><h2>${icon('folder-tree')} Catégories & statuts</h2></div>
          <div class="list-editor">${OBJ_LISTS.map(o => `<div class="le-block"><h3>${icon(o.icon)} ${o.label}</h3>
            ${o.help ? `<small class="muted">${o.help}</small>` : ''}
            <small class="le-hint">${icon('grip-vertical')} Glisse la poignée pour changer l’ordre.</small>
            <div class="obj-rows" data-sort-ol="${o.key}">${(S.lists[o.key] || []).map((row, i) => `<div class="obj-row"><span class="drag-handle" title="Glisser pour réordonner">${icon('grip-vertical')}</span>${o.fields.map(f => objInput(o.key, i, f, row[f.k])).join('')}
              <button class="btn-icon sm" data-ol-del="${o.key}:${i}" aria-label="Retirer">${icon('x')}</button></div>`).join('')}</div>
            <button class="btn btn-sm btn-ghost" data-ol-add="${o.key}">${icon('plus')} Ajouter</button></div>`).join('')}</div>
        </section>

        <section class="panel" id="set-modules">
          <div class="panel-head"><h2>${icon('layout-grid')} Onglets activés à la création d’un projet</h2></div>
          <div class="table-wrap flat"><table class="table module-matrix">
            <thead><tr><th>Onglet</th>${cats.map(c => `<th class="center">${esc(c)}</th>`).join('')}</tr></thead>
            <tbody>${OPTIONAL.map(m => `<tr><td>${icon(m.icon)} ${esc(m.label)}${m.group ? ' <span class="badge">Dev</span>' : ''}</td>${cats.map(c => `<td class="center"><input type="checkbox" data-md="${esc(c)}:${m.key}" ${(S.moduleDefaults[c] || []).includes(m.key) ? 'checked' : ''}></td>`).join('')}</tr>`).join('')}</tbody>
          </table></div>
        </section>

        <section class="panel" id="set-lists">
          <div class="panel-head"><h2>${icon('list')} Listes</h2></div>
          <div class="list-editor">${LISTS.map(l => `<div class="le-block"><h3>${icon(l.icon)} ${l.label}</h3>
            <small class="le-hint">Glisse pour réordonner, clique sur un nom pour le renommer.</small>
            <div class="tags" data-sort-l="${l.key}">${(S.lists[l.key] || []).map((v, i) => `<span class="tag"><span class="drag-handle" title="Glisser pour réordonner">${icon('grip-vertical')}</span><span class="tag-txt" data-l-edit="${l.key}:${i}" title="Cliquer pour renommer">${esc(v)}</span><button data-l-del="${l.key}:${i}" aria-label="Retirer">${icon('x')}</button></span>`).join('')}</div>
            <form class="tag-add" data-l-add="${l.key}"><input class="input input-sm" name="v" placeholder="Ajouter…" required><button class="btn btn-sm btn-ghost">${icon('plus')}</button></form></div>`).join('')}</div>
          <div class="pad"><button class="btn btn-sm btn-ghost" data-lists-reset>${icon('rotate-ccw')} Listes par défaut</button></div>
        </section>

        <section class="panel" id="set-billing">
          <div class="panel-head"><h2>${icon('wallet')} Compta & contacts</h2></div>
          <div class="set-row"><div><b>Plafond de facturation par contact</b><small>Recettes liées au contact sur la période (hors « solde uniquement »). 0 = pas de barre.</small></div>
            <input class="input input-sm" type="number" step="any" data-num="billing.cap" value="${esc(S.billing.cap)}"></div>
          <div class="set-row"><div><b>Durée de la période (jours)</b></div><input class="input input-sm w-date" type="number" data-num="billing.days" value="${esc(S.billing.days)}"></div>
          <div class="set-row"><div><b>Type de période</b><small>Glissante : les N derniers jours. Fixe : remise à zéro tous les N jours.</small></div>
            <div class="row gap-s"><select class="input input-sm" data-txt="billing.mode"><option value="glissant" ${S.billing.mode !== 'fixe' ? 'selected' : ''}>Glissante</option><option value="fixe" ${S.billing.mode === 'fixe' ? 'selected' : ''}>Fixe</option></select>
            ${S.billing.mode === 'fixe' ? `<input class="input input-sm" type="date" data-txt="billing.start" value="${esc(S.billing.start || '')}">` : ''}</div></div>
        </section>

        <section class="panel" id="set-format">
          <div class="panel-head"><h2>${icon('coins')} Format</h2></div>
          <div class="set-row"><div><b>Devise</b><small>Symbole affiché partout.</small></div>
            <div class="row gap-s"><input class="input input-sm w-emoji" data-currency value="${esc(S.format.currency)}">
            <select class="input input-sm" data-curpos><option value="before" ${S.format.currencyPosition === 'before' ? 'selected' : ''}>Avant (${esc(S.format.currency)}100)</option><option value="after" ${S.format.currencyPosition === 'after' ? 'selected' : ''}>Après (100 ${esc(S.format.currency)})</option></select></div></div>
          <div class="set-row"><div><b>Format des nombres et dates</b></div>
            <select class="input input-sm" data-locale>
              ${[['fr-CH', 'Suisse (1’234.50)'], ['fr-FR', 'France (1 234,50)'], ['en-US', 'US (1,234.50)']].map(([v, l]) => `<option value="${v}" ${S.format.locale === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select></div>
        </section>

        <section class="panel" id="set-account">
          <div class="panel-head"><h2>${icon('user')} Compte</h2></div>
          <div class="set-row"><div><b>Email</b><small>${esc(state.user.email)}</small></div></div>
          <div class="set-row"><div><b>Nom affiché</b><small>Visible par les personnes avec qui tu partages une structure.</small></div>
            <form class="row gap-s" data-display><input class="input input-sm" name="n" value="${esc(profile?.display_name || '')}"><button class="btn btn-sm btn-ghost">${icon('check')}</button></form></div>
          <div class="set-row"><div><b>Mot de passe</b></div><button class="btn btn-sm btn-ghost" data-password>${icon('key-round')} Changer</button></div>
          <div class="set-row"><div><b>Déconnexion</b></div><button class="btn btn-sm btn-ghost" data-logout>${icon('log-out')} Se déconnecter</button></div>
        </section>

        <section class="panel" id="set-data">
          <div class="panel-head"><h2>${icon('database')} Données</h2></div>
          <div class="set-row"><div><b>Exporter</b><small>Sauvegarde JSON de tous tes projets, leurs onglets et les features.</small></div><button class="btn btn-sm btn-ghost" data-export>${icon('download')} Exporter</button></div>
          <div class="set-row"><div><b>Importer</b><small>Ajoute le contenu d’une sauvegarde Domursan (crée des copies, ne remplace rien).</small></div>
            <label class="btn btn-sm btn-ghost">${icon('upload')} Importer<input type="file" accept="application/json,.json" hidden data-import></label></div>
          <div class="set-row"><div><b>Visite guidée</b></div><button class="btn btn-sm btn-ghost" data-tour-restart>${icon('route')} Relancer</button></div>
          <div class="set-row"><div><b>Réinitialiser les paramètres</b><small>Tes projets ne sont pas touchés.</small></div><button class="btn btn-sm btn-danger-ghost" data-reset>${icon('rotate-ccw')} Réinitialiser</button></div>
        </section>
      </div>
    </div>`;

  // Ré-affiche la page sans recharger le profil et sans perdre la position de défilement.
  const redraw = () => { const y = window.scrollY; draw(el, profile); window.scrollTo(0, y); };
  const save = (rerender = true) => { applyTheme(); saveSettings(); if (rerender) redraw(); };
  const $ = (s) => el.querySelector(s);
  const $$ = (s) => el.querySelectorAll(s);
  $$('[data-jump]').forEach(l => l.onclick = (e) => { e.preventDefault(); el.querySelector(l.getAttribute('href')).scrollIntoView({ behavior: 'smooth', block: 'start' }); });

  // Apparence
  $$('[data-mode]').forEach(b => b.onclick = () => { a.mode = b.dataset.mode; save(); });
  $('[data-colorblind]').onchange = (e) => { a.colorblind = e.target.checked; save(false); };
  $$('[data-accent]').forEach(b => b.onclick = () => { a.accent = b.dataset.accent; save(); });
  $('[data-accent-custom]').onchange = (e) => { a.accent = e.target.value; save(); };

  // Saisons
  $('[data-seasonal]').onchange = (e) => { a.seasonal = e.target.value; save(); };
  $('[data-particles]').onchange = (e) => { a.particles = e.target.checked; save(false); };
  $$('[data-sf]').forEach(inp => inp.onchange = () => {
    const s = S.seasons[inp.closest('tr').dataset.si];
    const k = inp.dataset.sf;
    if ((k === 'start' || k === 'end') && !/^\d{2}-\d{2}$/.test(inp.value)) { toast('Format attendu : MM-JJ (ex. 12-25)', 'error'); inp.value = s[k]; return; }
    s[k] = inp.type === 'checkbox' ? inp.checked : inp.value;
    save(k === 'name' || k === 'emoji' || k === 'enabled');
  });
  sortable($('[data-sort-seasons]'), { item: 'tr', onEnd: (from, to) => { moveItem(S.seasons, from, to); save(); } });
  $$('[data-sdel]').forEach(b => b.onclick = async () => {
    const s = S.seasons[b.dataset.sdel];
    if (!(await confirmDialog(`Supprimer le thème « ${esc(s.name)} » ?`))) return;
    S.seasons.splice(+b.dataset.sdel, 1);
    if (a.seasonal === s.key) a.seasonal = 'auto';
    save();
  });
  $('[data-sadd]').onclick = () => { S.seasons.push({ key: `custom-${Date.now()}`, name: 'Nouveau thème', emoji: '⭐', start: todayISO().slice(5), end: todayISO().slice(5), accent: '#3b82f6', particle: '⭐', enabled: true }); save(); };
  $('[data-sreset]').onclick = async () => { if (await confirmDialog('Remettre les 7 thèmes saisonniers par défaut ?', { danger: false })) { S.seasons = structuredClone(DEFAULT_SETTINGS.seasons); save(); } };

  // Listes simples
  $$('[data-l-del]').forEach(b => b.onclick = () => { const [k, i] = b.dataset.lDel.split(':'); S.lists[k].splice(+i, 1); save(); });
  $$('[data-l-add]').forEach(f => f.onsubmit = (e) => { e.preventDefault(); const v = f.v.value.trim(); const k = f.dataset.lAdd; if (v && !S.lists[k].includes(v)) { S.lists[k].push(v); save(); } });
  $$('[data-sort-l]').forEach(box => sortable(box, { item: '.tag', onEnd: (from, to) => { moveItem(S.lists[box.dataset.sortL], from, to); save(); } }));
  $$('[data-l-edit]').forEach(t => t.onclick = () => {
    const [k, i] = t.dataset.lEdit.split(':');
    const inp = document.createElement('input');
    inp.className = 'tag-edit'; inp.value = S.lists[k][+i];
    t.replaceWith(inp); inp.focus(); inp.select();
    let done = false;
    const finish = (ok) => {
      if (done) return; done = true;
      const v = inp.value.trim();
      if (ok && v && v !== S.lists[k][+i] && !S.lists[k].includes(v)) { S.lists[k][+i] = v; save(); } else redraw();
    };
    inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); finish(true); } if (e.key === 'Escape') finish(false); };
    inp.onblur = () => finish(true);
  });
  $('[data-lists-reset]').onclick = async () => { if (await confirmDialog('Remettre les listes par défaut (catégories et statuts compris) ?', { danger: false })) { S.lists = structuredClone(DEFAULT_SETTINGS.lists); save(); await refreshNav(); } };
  // Listes détaillées
  $$('[data-ol]').forEach(inp => inp.onchange = async () => {
    const [k, i, f] = inp.dataset.ol.split(':');
    const old = S.lists[k][+i][f];
    S.lists[k][+i][f] = inp.value.trim();
    if (k === 'categories' && f === 'name' && old && S.moduleDefaults[old]) { S.moduleDefaults[inp.value.trim()] = S.moduleDefaults[old]; delete S.moduleDefaults[old]; }
    save(k === 'categories' && f === 'name'); if (k === 'categories') await refreshNav();
  });
  $$('[data-ol-del]').forEach(b => b.onclick = async () => { const [k, i] = b.dataset.olDel.split(':'); S.lists[k].splice(+i, 1); save(); if (k === 'categories') await refreshNav(); });
  $$('[data-sort-ol]').forEach(box => sortable(box, { item: '.obj-row', onEnd: async (from, to) => { const k = box.dataset.sortOl; moveItem(S.lists[k], from, to); save(); if (k === 'categories') await refreshNav(); } }));
  $$('[data-ol-add]').forEach(b => b.onclick = () => { const o = OBJ_LISTS.find(x => x.key === b.dataset.olAdd); S.lists[o.key].push(Object.fromEntries(o.fields.map(f => [f.k, f.type === 'color' ? '#3b82f6' : '']))); save(); });
  // Onglets par défaut
  $$('[data-md]').forEach(cb => cb.onchange = () => {
    const [c, m] = cb.dataset.md.split(':');
    const set = new Set(S.moduleDefaults[c] || []);
    cb.checked ? set.add(m) : set.delete(m);
    S.moduleDefaults[c] = [...set]; save(false);
  });
  // Compta
  const setPath = (path, v) => { const [x, y] = path.split('.'); S[x][y] = v; };
  $$('[data-num]').forEach(inp => inp.onchange = () => { setPath(inp.dataset.num, inp.value === '' ? 0 : Number(inp.value)); save(false); });
  $$('[data-txt]').forEach(inp => inp.onchange = () => { setPath(inp.dataset.txt, inp.value); save(inp.dataset.txt === 'billing.mode'); });

  // Format
  $('[data-currency]').onchange = (e) => { S.format.currency = e.target.value.trim() || '$'; save(); };
  $('[data-curpos]').onchange = (e) => { S.format.currencyPosition = e.target.value; save(); };
  $('[data-locale]').onchange = (e) => { S.format.locale = e.target.value; save(); };

  // Compte
  $('[data-display]').onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await sb.from('profiles').update({ display_name: e.target.n.value.trim() || null }).eq('id', state.user.id);
    error ? toastError(error) : toast('Nom affiché enregistré');
  };
  $('[data-password]').onclick = () => formModal({
    title: 'Changer de mot de passe', size: 'sm',
    fields: [{ name: 'p1', label: 'Nouveau mot de passe', type: 'password', required: true, full: true }, { name: 'p2', label: 'Confirmer', type: 'password', required: true, full: true }],
    onSubmit: async (v) => {
      if (v.p1 !== v.p2) throw new Error('Les deux mots de passe ne correspondent pas.');
      const { error } = await sb.auth.updateUser({ password: v.p1 });
      if (error) throw new Error(errMsg(error));
      toast('Mot de passe modifié');
    },
  });
  $('[data-logout]').onclick = () => sb.auth.signOut();


  // Données
  $('[data-export]').onclick = async () => {
    try {
      const data = {};
      for (const t of EXPORT) data[t] = await list(t, {}, { order: 'created_at' });
      downloadFile(`domursan-sauvegarde-${todayISO()}.json`, JSON.stringify({ app: 'Domursan', version: 1, exported_at: new Date().toISOString(), settings: state.settings, data }, null, 2));
      toast('Sauvegarde téléchargée');
    } catch (e) { toastError(e); }
  };
  $('[data-import]').onchange = async (e) => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      if (json.app !== 'Domursan' || !json.data) throw new Error('Ce fichier n’est pas une sauvegarde Domursan.');
      if (!(await confirmDialog(`Importer ${(json.data.d_projects || []).length} projet(s) et ${(json.data.d_features || []).length} feature(s) ? Des copies seront créées.`, { danger: false, ok: 'Importer' }))) return;
      await importData(json.data); toast('Import terminé'); await refreshNav();
    } catch (err) { toastError(err); }
  };
  $('[data-reset]').onclick = async () => { if (await confirmDialog('Réinitialiser tous les paramètres ?', { ok: 'Réinitialiser' })) { await resetSettings(); toast('Paramètres réinitialisés'); await refreshNav(); redraw(); } };
  $('[data-tour-restart]').onclick = () => { location.hash = '#/'; setTimeout(() => startTour(true), 500); };
}

async function importData(data) {
  const map = {};
  const nid = (old) => (map[old] ??= crypto.randomUUID());
  for (const t of EXPORT) {
    const rows = (data[t] || []).map(r => {
      const { owner_id, created_at, updated_at, ...rest } = r;
      const out = { ...rest, id: nid(r.id) };
      if (out.project_id) out.project_id = map[out.project_id] || null;
      if (out.contact_id) out.contact_id = map[out.contact_id] || null;
      if (t === 'd_features') out.project_ids = (out.project_ids || []).map(id => map[id]).filter(Boolean);
      return out;
    }).filter(r => !('project_id' in r) || r.project_id);
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await sb.from(t).insert(rows.slice(i, i + 200));
      if (error) throw error;
    }
  }
}
