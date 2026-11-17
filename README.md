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
- Conseils contextualisés selon le mode et le transporteur, avec sources officielles et alertes de cohérence entre trajets, logement et activités.
- Carte OpenStreetMap avec destination, hébergement et activités.
- Prévisions météo Open-Meteo.
- Activités avec fiche détaillée et case « faite ».
- Budget, dépenses, checklist, export ICS et JSON.
- Données de voyage conservées localement dans le navigateur.

## PIMI et mises à jour avec ChatGPT

PIMI est piloté depuis la conversation ChatGPT : transmets les informations d'un billet, de l'hébergement, d'une activité ou un changement de statut. ChatGPT peut vérifier les informations sur le web, poser les questions nécessaires, contrôler la cohérence du programme et modifier les fichiers de ce dépôt via l'intégration GitHub connectée.

Dans l'application, le bouton « Préparer ma demande » copie un contexte de voyage expurgé des codes de réservation, numéros de téléphone et données d'accès privées. Colle-le dans la conversation ChatGPT pour continuer.

## Confidentialité

Ce dépôt est public. Les données de voyage restent dans le stockage local du navigateur, pas dans un fichier versionné. Ne publie jamais dans GitHub un QR code, billet complet, pièce d'identité, numéro de réservation, code d'accès au logement ou coordonnées personnelles. Les exports JSON peuvent contenir des données privées : garde-les hors des dépôts publics.

## Publication GitHub Pages

Le workflow `.github/workflows/deploy-pages.yml` vérifie la syntaxe JavaScript puis publie automatiquement la racine du dépôt sur GitHub Pages à chaque push sur `main`.

Dans les paramètres du dépôt, vérifie que **Settings → Pages → Build and deployment → Source** est réglé sur **GitHub Actions**.

## Technologies

Leaflet, OpenStreetMap / Nominatim, Open-Meteo, JavaScript natif et GitHub Pages. Aucun serveur, Cloudflare Worker, token GitHub ou clé API n'est intégré au navigateur.
