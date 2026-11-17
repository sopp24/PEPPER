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
- Activités avec fiche détaillée, date facultative, statut de réservation et lien pour ouvrir le site officiel du prestataire puis confirmer la réservation dans PEPPER.
- Audit JALAP préparé depuis le carnet : copie le contexte expurgé des codes privés et des alertes de cohérence dans cette conversation ChatGPT.
- Budget, dépenses, checklist, export ICS et sauvegarde / restauration JSON de tous les voyages.
- Alertes locales de cohérence du programme : chevauchements, dates hors séjour, réservations sans lien et temps de déplacement manifestement courts.
- Prévisions météo précédemment consultées affichées avec leur date lorsqu’on est hors connexion ; données du voyage disponibles localement.
- Données de voyage conservées localement dans IndexedDB avec stockage navigateur de compatibilité et snapshot de récupération.
- Sauvegarde JSON versionnée de tous les voyages, fusion ou remplacement lors de la restauration.
- Aucune synchronisation entre appareils n’est activée tant qu’un service de compte / stockage distant privé n’a pas été configuré.
- **Données temps réel :** le connecteur serveur SNCF (SIRI SX) et l’option IDFM (PRIM) sont codés, mais ils n’apparaîtront dans l’application qu’après déploiement Netlify et configuration des éventuels jetons. Les autres compagnies utilisent leurs liens officiels. Aucun avis SNCF trouvé ne veut pas dire que le train est à l’heure.
- **Mode hors connexion :** l’enveloppe de l’application, les voyages et les dernières prévisions météo consultées peuvent être disponibles sans réseau. Les tuiles de carte, les données live, les sites opérateurs et la météo actualisée nécessitent une connexion.

Les sources officielles utilisées, leur périmètre et les étapes nécessaires pour intégrer de vrais flux temps réel sont décrits dans [docs/transport-sources.md](docs/transport-sources.md).

## Temps réel SNCF et service Netlify (optionnel)

Le dossier `netlify/functions/transport-status.mjs` contient un endpoint serveur qui interroge le flux public SIRI SX de SNCF et filtre les avis par numéro commercial de train. Il concerne les TGV, Intercités, TER et OUIGO ; il ne confirme pas la ponctualité lorsqu’aucun avis n’est trouvé. Le flux SNCF est publié toutes les deux minutes. Eurostar et Transilien ne sont pas couverts.

Pour activer l’affichage live dans PEPPER :
1. Crée un compte Netlify et connecte le dépôt `sopp24/PEPPER`.
2. Garde le répertoire de publication `netlify-site` et le dossier Functions `netlify/functions`, comme dans `netlify.toml`.
3. Déploie le site. L’URL du site Netlify sert ici de base au service de données ; l’application publique peut rester sur GitHub Pages.
4. Copie l’URL `https://...netlify.app`, puis dans PEPPER → Réglages, colle-la dans « URL du service temps réel PEPPER ».
5. Ajoute un trajet SNCF éligible avec le numéro commercial du train pour afficher les avis.

La donnée SNCF est publique, mais l’endpoint PEPPER est protégé par un jeton personnel `PEPPER_API_TOKEN`. Crée ce jeton localement (par exemple `openssl rand -hex 32`), ajoute-le comme variable d’environnement Netlify (scope Functions) et colle la même valeur dans PEPPER → Réglages → Jeton privé. Ajoute `PEPPER_ALLOWED_ORIGIN=https://sopp24.github.io` pour limiter les navigateurs à l’origine de PEPPER ; CORS ne remplace pas l’authentification. Pour activer IDFM, crée un jeton sur PRIM puis ajoute `IDFM_API_KEY` séparément dans les variables d’environnement Netlify (scope Functions), puis redeploie. Dans PEPPER, renseigne le `MonitoringRef` de l’arrêt dans les réglages du voyage. La requête utilise le header `apikey` officiel. Les autres API avec clés doivent être configurées uniquement côté serveur.

## JALAP — assistant conversationnel intégré (optionnel)

Le panneau JALAP de l'application peut appeler le modèle OpenAI via `netlify/functions/jalap.mjs`. Le navigateur transmet uniquement le contexte expurgé du voyage actif et le message saisi. La fonction Netlify conserve la clé OpenAI côté serveur et renvoie une réponse structurée. Les opérations proposées sont affichées dans PEPPER ; aucune modification du carnet n'est enregistrée avant validation explicite. Après validation, les données sont sauvegardées dans le stockage local du navigateur.

### Activation

1. Crée une clé API dans ton projet OpenAI depuis https://platform.openai.com/api-keys. L'accès à l'API et sa facturation sont distincts d'un abonnement ChatGPT.
2. Dans Netlify → Project configuration → Environment variables, ajoute `OPENAI_API_KEY` avec cette clé et le scope **Functions**.
3. Garde également `PEPPER_API_TOKEN` et `PEPPER_ALLOWED_ORIGIN=https://sopp24.github.io` déjà configurés.
4. Redéploie le site Netlify pour appliquer la variable.
5. Dans PEPPER, ouvre Réglages et vérifie que l'URL Netlify et le jeton PEPPER sont renseignés. Ouvre ensuite un voyage et écris dans le panneau JALAP.

Le modèle par défaut est `gpt-6-luna` pour limiter le coût des échanges courants. Le modèle peut être remplacé côté serveur avec la variable facultative `JALAP_MODEL`. Vérifie les tarifs en vigueur dans la documentation OpenAI. La clé `OPENAI_API_KEY` ne doit jamais être mise dans GitHub, dans le code navigateur, dans les réglages PEPPER ou dans une conversation.

JALAP reçoit un contexte expurgé des codes de réservation, téléphones, détails privés d'accès et références de billets. Les messages et l'historique de la session de chat restent en mémoire dans l'onglet ; le carnet et les modifications validées restent dans le stockage local. JALAP ne dispose pas encore d'une recherche web dans cette première version : il ne doit pas affirmer avoir vérifié des horaires, prix ou disponibilités en direct.

Les actions actuellement proposées sont les ajouts / modifications / suppressions d'activités, les ajouts / modifications de trajets, les mises à jour des informations générales du voyage, les dépenses et les tâches de checklist. Les propositions sont validées côté navigateur puis sauvegardées localement.

Le bouton « Copier le contexte du voyage » reste disponible pour utiliser cette conversation ChatGPT en complément.

## Confidentialité

Ce dépôt est public. Les données de voyage restent dans le stockage local du navigateur, pas dans un fichier versionné. Ne publie jamais dans GitHub un QR code, billet complet, pièce d'identité, numéro de réservation, code d'accès au logement ou coordonnées personnelles. Les exports JSON peuvent contenir des données privées : garde-les hors des dépôts publics.

## Sauvegarde et mode hors connexion

Les voyages sont stockés localement dans IndexedDB, avec un stockage navigateur de compatibilité et une copie de récupération du dernier état valide. Le bouton « Sauvegarder tous les voyages » exporte un fichier JSON privé. « Restaurer une sauvegarde » permet de fusionner ou remplacer les voyages sur cet appareil ; le fichier est lu localement et n'est pas téléversé. Les prévisions météo déjà consultées restent affichables hors connexion avec leur horodatage. La coquille de l'application et les données du carnet sont conservées ; les tuiles de carte, les sources externes et le suivi temps réel ne sont pas garantis hors connexion. La synchronisation entre appareils n'est pas encore activée : elle demandera un service d'authentification et de stockage distant privé.

## Publication GitHub Pages

Le workflow `.github/workflows/deploy-pages.yml` vérifie la syntaxe JavaScript puis publie automatiquement la racine du dépôt sur GitHub Pages à chaque push sur `main`.

**Première activation (une seule fois)** : dans le dépôt GitHub, ouvre **Settings → Pages → Build and deployment → Source**, puis choisis **GitHub Actions** et enregistre. L’intégration GitHub utilisée ici ne possède pas le droit d’activer ce réglage propriétaire à ta place. Une fois cette option sélectionnée, chaque push sur `main` lancera automatiquement le déploiement.

## Technologies

Leaflet, OpenStreetMap / Nominatim, Open-Meteo, JavaScript natif et GitHub Pages. Aucun serveur, Cloudflare Worker, token GitHub ou clé API n'est intégré au navigateur.


### Réservation des activités

Chaque activité peut conserver un lien de réservation. Depuis sa fiche, le bouton « Ouvrir le site pour réserver » ouvre le site du prestataire dans un nouvel onglet. Une fois la réservation confirmée auprès du prestataire, l'utilisateur revient dans PEPPER et clique « J'ai terminé la réservation » : le statut passe alors à « Réservée ». PEPPER ne réalise pas lui-même le paiement et ne confirme jamais automatiquement une réservation.