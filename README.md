# Domursan

Référencement de tous mes projets (dev, RP, perso…). HTML/CSS/JS vanilla sur GitHub Pages, données sur Supabase (projet `Gestion_RP`, tables `d_*`).

## Ce que fait le site

- **Accueil** : une carte par projet (raccourci vers son onglet), filtres catégorie / statut, tri par activité, nom ou ordre manuel (glisser-déposer).
- **Menu** : un onglet par projet, groupé par catégorie (repliable), projets épinglés en haut. Les projets « Archivé » sont masqués.
- **Features** : catalogue de cartes remplies à la main (devis, agenda, connexion…) avec description, technique, liens et projets qui ont la feature.
- **Fiche projet** : onglets à la carte, activables dans « Réglages » du projet :
  Vue d’ensemble · Liens · Tâches · Notes · Journal · Agenda · Fichiers · Comptabilité · Contacts · Inventaire · Fiche technique · Bugs & idées · Déploiements.
- **Paramètres** : apparence (jour / nuit / auto, daltonien, 7 thèmes saisonniers), catégories (couleur + icône), statuts, priorités, listes, onglets par défaut selon la catégorie, export / import JSON.

## Structure

```
Domursan/
├── index.html
├── css/        theme.css, app.css
├── js/
│   ├── config.js, api.js, state.js, ui.js, grid.js, calc.js, app.js, search.js, tour.js
│   ├── pages/      auth, home, features, project, settings
│   └── modules/    registry + un fichier par onglet
└── supabase/schema.sql
```
