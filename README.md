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
- Budget, dépenses, checklist, export ICS et sauvegarde / restauration JSON de tous les voyages.
- Alertes locales de cohérence du programme : chevauchements, dates hors séjour, réservations sans lien et temps de déplacement manifestement courts.
- Prévisions météo précédemment consultées affichées avec leur date lorsqu’on est hors connexion ; données du voyage disponibles localement.
- Données de voyage conservées localement dans le navigateur.
- **Limite actuelle des données transport :** PEPPER ne lit pas encore les flux temps réel dans son interface. Il ouvre les sources officielles et l’application du transporteur ; les horaires et retards doivent être vérifiés chez l’opérateur. Les repères d’arrivée et les ETA voiture sont des estimations, pas un statut live.

Les sources officielles utilisées, leur périmètre et les étapes nécessaires pour intégrer de vrais flux temps réel sont décrits dans [docs/transport-sources.md](docs/transport-sources.md).

## Temps réel SNCF et service Netlify (optionnel)

Le dossier `netlify/functions/transport-status.mjs` contient un endpoint serveur qui interroge le flux public SIRI SX de SNCF et filtre les avis par numéro commercial de train. Il concerne les TGV, Intercités, TER et OUIGO ; il ne confirme pas la ponctualité lorsqu’aucun avis n’est trouvé. Le flux SNCF est publié toutes les deux minutes. Eurostar et Transilien ne sont pas couverts.

Pour activer l’affichage live dans PEPPER :
1. Crée un compte Netlify et connecte le dépôt `sopp24/PEPPER`.
2. Garde le répertoire de publication `netlify-site` et le dossier Functions `netlify/functions`, comme dans `netlify.toml`.
3. Déploie le site. L’URL du site Netlify sert ici de base au service de données ; l’application publique peut rester sur GitHub Pages.
4. Copie l’URL `https://...netlify.app`, puis dans PEPPER → Réglages, colle-la dans « URL du service temps réel PEPPER ».
5. Ajoute un trajet SNCF éligible avec le numéro commercial du train pour afficher les avis.

La fonction n’exige pas de clé pour le flux SNCF public. La variable `PEPPER_ALLOWED_ORIGIN` peut être définie sur `https://sopp24.github.io` pour limiter l’accès navigateur à l’origine de PEPPER (par défaut, le service accepte les origines publiques, car la donnée SNCF est publique). Pour activer IDFM, crée un jeton sur PRIM puis ajoute `IDFM_API_KEY` dans les variables d’environnement Netlify (scope Functions), puis redeploie. Dans PEPPER, renseigne le `MonitoringRef` de l’arrêt dans les réglages du voyage. La requête utilise le header `apikey` officiel. Les autres API avec clés doivent être configurées uniquement côté serveur.

## PIMI et mises à jour avec ChatGPT

PIMI est piloté depuis la conversation ChatGPT : transmets les informations d'un billet, de l'hébergement, d'une activité ou un changement de statut. ChatGPT peut vérifier les informations sur le web, poser les questions nécessaires, contrôler la cohérence du programme et modifier les fichiers de ce dépôt via l'intégration GitHub connectée.

Dans l'application, le bouton « Préparer ma demande » copie un contexte de voyage expurgé des codes de réservation, numéros de téléphone et données d'accès privées. Colle-le dans la conversation ChatGPT pour continuer.

## Confidentialité

Ce dépôt est public. Les données de voyage restent dans le stockage local du navigateur, pas dans un fichier versionné. Ne publie jamais dans GitHub un QR code, billet complet, pièce d'identité, numéro de réservation, code d'accès au logement ou coordonnées personnelles. Les exports JSON peuvent contenir des données privées : garde-les hors des dépôts publics.

## Sauvegarde et mode hors connexion

Les voyages sont stockés localement dans le navigateur. Le bouton « Sauvegarder tous les voyages » exporte un fichier JSON privé. « Restaurer une sauvegarde » permet de fusionner ou remplacer les voyages sur cet appareil. Une copie locale de récupération conserve également l’état précédent du carnet. Les prévisions météo déjà consultées restent affichables hors connexion avec leur horodatage. La carte, les tuiles et les sources externes ne sont pas garanties hors connexion.

## Publication GitHub Pages

Le workflow `.github/workflows/deploy-pages.yml` vérifie la syntaxe JavaScript puis publie automatiquement la racine du dépôt sur GitHub Pages à chaque push sur `main`.

**Première activation (une seule fois)** : dans le dépôt GitHub, ouvre **Settings → Pages → Build and deployment → Source**, puis choisis **GitHub Actions** et enregistre. L’intégration GitHub utilisée ici ne possède pas le droit d’activer ce réglage propriétaire à ta place. Une fois cette option sélectionnée, chaque push sur `main` lancera automatiquement le déploiement.

## Technologies

Leaflet, OpenStreetMap / Nominatim, Open-Meteo, JavaScript natif et GitHub Pages. Aucun serveur, Cloudflare Worker, token GitHub ou clé API n'est intégré au navigateur.
