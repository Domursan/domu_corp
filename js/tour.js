import { state, saveSettings } from './state.js';
import { esc, icon, modal } from './ui.js';

const STEPS = [
  { sel: null, title: 'Bienvenue sur Domursan 👋', text: 'Domursan référence tous tes projets : dev, RP, perso… Chaque projet a sa fiche, avec les onglets dont il a besoin. Petit tour en 5 étapes.' },
  { sel: '[data-tour="new"]', title: 'Créer un projet', text: 'Choisis une catégorie : les onglets proposés (liens, tâches, notes, compta, fiche technique…) en dépendent, et tu peux les changer ensuite dans « Réglages » du projet.' },
  { sel: '#sidebar .nav', title: 'Tes projets', text: 'Chaque projet a son onglet dans le menu, rangé par catégorie. Épingle les plus utilisés pour les garder en haut.' },
  { sel: '#sidebar .nav a[href="#/features"]', title: 'Features', text: 'Le catalogue de tes fonctionnalités (devis, agenda, connexion…) : une carte par feature, avec les projets qui l’ont déjà.' },
  { sel: '[data-tour="search"]', title: 'Recherche', text: 'Retrouve un projet, un lien, une tâche, une note ou une feature. Raccourci : touche « / ».' },
  { sel: '#sidebar .nav-bottom', title: 'Paramètres', text: 'Apparence (jour, nuit, daltonien, thèmes saisonniers), catégories, statuts, listes et onglets par défaut de chaque catégorie.' },
];

export function startTour(force = false) {
  if (!force && state.settings.tourDone) return;
  if (!document.getElementById('layout')) return;
  let i = 0;
  const ov = document.createElement('div');
  ov.className = 'tour';
  ov.innerHTML = '<div class="tour-spot"></div><div class="tour-pop" role="dialog" aria-live="polite"></div>';
  document.body.appendChild(ov);
  const spot = ov.querySelector('.tour-spot');
  const pop = ov.querySelector('.tour-pop');
  const finish = () => {
    ov.remove(); window.removeEventListener('resize', place); document.body.classList.remove('nav-open');
    if (!state.settings.tourDone) { state.settings.tourDone = true; saveSettings(true); }
  };
  function place() {
    const st = STEPS[i];
    const target = st.sel ? document.querySelector(st.sel) : null;
    if (target && window.innerWidth < 900 && target.closest('#sidebar')) document.body.classList.add('nav-open'); else document.body.classList.remove('nav-open');
    pop.innerHTML = `<div class="tour-step">${i + 1} / ${STEPS.length}</div><h3>${esc(st.title)}</h3><p>${esc(st.text)}</p>
      <div class="row between"><button class="link-btn" data-skip>Passer</button><div class="row gap-s">
        ${i ? `<button class="btn btn-sm btn-ghost" data-prev>${icon('chevron-left')}</button>` : ''}
        <button class="btn btn-sm btn-primary" data-next>${i === STEPS.length - 1 ? 'Terminer' : 'Suivant'} ${icon(i === STEPS.length - 1 ? 'check' : 'chevron-right')}</button></div></div>`;
    setTimeout(() => {
      const r = target?.getBoundingClientRect();
      if (r && r.width) {
        Object.assign(spot.style, { display: 'block', top: `${r.top - 6}px`, left: `${r.left - 6}px`, width: `${r.width + 12}px`, height: `${r.height + 12}px` });
        const pw = pop.offsetWidth, ph = pop.offsetHeight;
        let top = r.bottom + 14, left = r.left;
        if (top + ph > window.innerHeight - 10) top = Math.max(10, r.top - ph - 14);
        if (r.right + pw + 20 < window.innerWidth && r.height > 200) { top = Math.max(10, Math.min(r.top, window.innerHeight - ph - 10)); left = r.right + 16; }
        left = Math.max(10, Math.min(left, window.innerWidth - pw - 10));
        Object.assign(pop.style, { top: `${top}px`, left: `${left}px`, transform: 'none' });
      } else {
        spot.style.display = 'none';
        Object.assign(pop.style, { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' });
      }
    }, window.innerWidth < 900 ? 220 : 0);
    pop.querySelector('[data-skip]').onclick = finish;
    pop.querySelector('[data-prev]')?.addEventListener('click', () => { i--; place(); });
    pop.querySelector('[data-next]').onclick = () => { if (i === STEPS.length - 1) finish(); else { i++; place(); } };
  }
  window.addEventListener('resize', place);
  place();
}

const HELP = {
  home: ['Accueil', [
    'Une carte par projet : clique dessus pour ouvrir son onglet.',
    'Filtre par catégorie ou statut, trie par dernière activité, par nom ou dans ton ordre (glisser-déposer).',
    'Les projets archivés sont masqués (case « Archivés » pour les revoir).']],
  features: ['Features', [
    'Une carte par fonctionnalité : nom, résumé, description, technique (comment c’est fait), liens d’exemple.',
    'Coche les projets qui ont la feature : elle apparaît aussi dans la Vue d’ensemble de ces projets.',
    'Filtre par catégorie ou par projet pour voir rapidement ce qui existe déjà.']],
  project: ['Projet', [
    'Vue d’ensemble : résumé des onglets actifs et features du projet.',
    'Liens : colle une adresse, le type est deviné (Apps Script, Sheet, GitHub…).',
    'Tâches : tableau par colonnes (glisser-déposer) ou liste. Journal : versions et changements.',
    'Fiche technique, Bugs & idées et Déploiements sont pensés pour les projets dev.',
    'Réglages : active ou masque les onglets, archive ou supprime le projet.']],
  parametres: ['Paramètres', [
    'Apparence : jour / nuit / auto, daltonien, couleur principale, thèmes saisonniers.',
    'Catégories (couleur + icône) et statuts des projets, étiquettes, listes des modules.',
    'Onglets par défaut : ceux activés à la création d’un projet, selon sa catégorie.',
    'Données : export / import JSON de tous tes projets.']],
};

export function showHelp(route) {
  const [title, lines] = HELP[route.name] || ['Aide', ['Pas d’aide pour cette page.']];
  const m = modal({
    title: `Aide — ${title}`,
    body: `<ul class="help-list">${lines.map(l => `<li>${icon('check')} <span>${esc(l)}</span></li>`).join('')}</ul>`,
    footer: `<button class="btn btn-ghost mr-auto" data-tour-go>${icon('route')} Visite guidée</button><button class="btn btn-primary" data-close>Compris</button>`,
  });
  m.el.querySelector('[data-tour-go]').onclick = () => { m.close(); if (route.name !== 'home') location.hash = '#/'; setTimeout(() => startTour(true), 500); };
}
