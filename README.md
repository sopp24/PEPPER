# PEPPER — Travel Companion

PEPPER est un compagnon de voyage responsive et installable (PWA), publié depuis ce dépôt GitHub Pages.

## Application

- URL : https://sopp24.github.io/PEPPER/
- Dépôt : https://github.com/sopp24/PEPPER
- Portail SOPP Agents : https://sopp24.github.io/SOPP-agents/

## Fonctionnalités

- Carnets de voyage : dates, destination, voyageurs, budget et devise.
- Hébergement : adresse, type de logement, arrivée/départ, contact, accès, équipements, parking, petit-déjeuner, consignes et lien de réservation.
- Transports : trajets aller, retour et correspondances en train, avion, voiture, bus ou ferry ; transporteur, numéro, gares/aéroports, terminaux/voies, horaires, bagages, marges d'arrivée et lien du billet.
- Conseils contextualisés selon le mode et le transporteur, avec liens vers les applications / pages officielles des compagnies, sources de circulation routière et plusieurs réseaux urbains reconnus à destination.
- Champs personnalisables pour le nom, l’application et l’info trafic officiels du réseau local, si la destination n’est pas reconnue automatiquement.
- Carte OpenStreetMap avec destination, hébergement et activités.
- Prévisions météo Open-Meteo.
- Activités avec fiche détaillée et case « faite ».
- Budget, dépenses, checklist, export ICS et JSON.
- Données de voyage conservées localement dans le navigateur.
- **Limite actuelle des données transport :** PEPPER ne lit pas encore les flux temps réel dans son interface. Il ouvre les sources officielles et l’application du transporteur ; les horaires et retards doivent être vérifiés chez l’opérateur. Les repères d’arrivée et les ETA voiture sont des estimations, pas un statut live.

Les sources officielles utilisées, leur périmètre et les étapes nécessaires pour intégrer de vrais flux temps réel sont décrits dans [docs/transport-sources.md](docs/transport-sources.md).

## PIMI et mises à jour avec ChatGPT

PIMI est piloté depuis la conversation ChatGPT : transmets les informations d'un billet, de l'hébergement, d'une activité ou un changement de statut. ChatGPT peut vérifier les informations sur le web, poser les questions nécessaires, contrôler la cohérence du programme et modifier les fichiers de ce dépôt via l'intégration GitHub connectée.

Dans l'application, le bouton « Préparer ma demande » copie un contexte de voyage expurgé des codes de réservation, numéros de téléphone et données d'accès privées. Colle-le dans la conversation ChatGPT pour continuer.

## Confidentialité

Ce dépôt est public. Les données de voyage restent dans le stockage local du navigateur, pas dans un fichier versionné. Ne publie jamais dans GitHub un QR code, billet complet, pièce d'identité, numéro de réservation, code d'accès au logement ou coordonnées personnelles. Les exports JSON peuvent contenir des données privées : garde-les hors des dépôts publics.

## Publication GitHub Pages

Le workflow `.github/workflows/deploy-pages.yml` vérifie la syntaxe JavaScript puis publie automatiquement la racine du dépôt sur GitHub Pages à chaque push sur `main`.

**Première activation (une seule fois)** : dans le dépôt GitHub, ouvre **Settings → Pages → Build and deployment → Source**, puis choisis **GitHub Actions** et enregistre. L’intégration GitHub utilisée ici ne possède pas le droit d’activer ce réglage propriétaire à ta place. Une fois cette option sélectionnée, chaque push sur `main` lancera automatiquement le déploiement.

## Technologies

Leaflet, OpenStreetMap / Nominatim, Open-Meteo, JavaScript natif et GitHub Pages. Aucun serveur, Cloudflare Worker, token GitHub ou clé API n'est intégré au navigateur.
