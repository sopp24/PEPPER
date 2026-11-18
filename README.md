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

## Expérience voyage — avant, pendant et après

Le tableau de bord adapte sa vue au cycle du voyage :
- **Avant le départ :** compte à rebours, réservations à traiter, activités encore flexibles et checklist de préparation.
- **Pendant le séjour :** activités programmées aujourd'hui, trajets du jour, carte, météo et accès rapide à JALAP.
- **Après le retour :** récapitulatif des étapes cochées, dépenses et export du carnet.

La navigation par sections permet d'atteindre les transports, activités, hébergement, carte, budget, checklist et JALAP sans parcourir toute la page. La disposition se réorganise en colonnes sur grand écran, en blocs tablette et en parcours vertical avec barre de navigation inférieure sur téléphone.

Les activités peuvent rester sans date dans « À planifier ». Une réservation confirmée n'attribue pas automatiquement de date : le jour et l'heure ne sont définis que lorsqu'ils sont connus.

### Liens officiels d'activités

Les fiches d'activités reconnaissent certains lieux et proposent des raccourcis vers leurs pages officielles :
- Catacombes de Paris : [billetterie Paris Musées](https://www.billetterie-parismusees.paris.fr/). Réservation horodatée fortement recommandée ; billets mis en vente 7 jours avant.
- Tour Eiffel : [billetterie officielle](https://ticket.toureiffel.paris/fr).
- Bateaux-Mouches : [billets promenade officiels](https://www.bateaux-mouches.fr/fr/reservation/billets?subid=billets). Pour la promenade, aucun créneau horaire n'est nécessaire.
- Théâtre Michel : [billetterie officielle](https://billetterie.theatre-michel.fr/).
- Notre-Dame : [réservation gratuite facultative](https://www.notredamedeparis.fr/visiter/reserver-gratuitement/).
- Panthéon : [billetterie du Centre des monuments nationaux](https://tickets.monuments-nationaux.fr/fr-FR/familles?famille=2205941809920401471&site=2007056652440400272).
- Santa Lyna : [site officiel](https://thehungryfamily.com/santa-lyna/) (informations et menu ; aucun module de réservation en ligne n'est affiché sur cette page).
- 59 Rivoli : [site officiel](https://59rivoli.org/) (horaires et informations de visite).

Un lien saisi manuellement dans la fiche reste prioritaire sur le raccourci suggéré. Les liens ouvrent le site du prestataire dans un nouvel onglet : PEPPER ne traite pas le paiement et n'affirme pas qu'une réservation est confirmée. L'utilisateur met lui-même son statut à jour après avoir reçu la confirmation du prestataire.

## Temps réel SNCF et service Netlify (optionnel)

Le dossier `netlify/functions/transport-status.mjs` contient un endpoint serveur qui interroge le flux public SIRI SX de SNCF et filtre les avis par numéro commercial de train. Il concerne les TGV, Intercités, TER et OUIGO ; il ne confirme pas la ponctualité lorsqu’aucun avis n’est trouvé. Le flux SNCF est publié toutes les deux minutes. Eurostar et Transilien ne sont pas couverts.

Pour activer l’affichage live dans PEPPER :
1. Crée un compte Netlify et connecte le dépôt `sopp24/PEPPER`.
2. Garde le répertoire de publication `netlify-site` et le dossier Functions `netlify/functions`, comme dans `netlify.toml`.
3. Déploie le site. L’URL du site Netlify sert ici de base au service de données ; l’application publique peut rester sur GitHub Pages.
4. Copie l’URL `https://...netlify.app`, puis dans PEPPER → Réglages, colle-la dans « URL du service temps réel PEPPER ».
5. Ajoute un trajet SNCF éligible avec le numéro commercial du train pour afficher les avis.

La donnée SNCF est publique, mais l’endpoint PEPPER est protégé par un jeton personnel `PEPPER_API_TOKEN`. Crée ce jeton localement (par exemple `openssl rand -hex 32`), ajoute-le comme variable d’environnement Netlify (scope Functions) et colle la même valeur dans PEPPER → Réglages → Jeton privé. Ajoute `PEPPER_ALLOWED_ORIGIN=https://sopp24.github.io` pour limiter les navigateurs à l’origine de PEPPER ; CORS ne remplace pas l’authentification. Pour activer IDFM, crée un jeton sur PRIM puis ajoute `IDFM_API_KEY` séparément dans les variables d’environnement Netlify (scope Functions), puis redeploie. Dans PEPPER, renseigne le `MonitoringRef` de l’arrêt dans les réglages du voyage. La requête utilise le header `apikey` officiel. Les autres API avec clés doivent être configurées uniquement côté serveur.

## JALAP — Claude et GitHub en connexion directe

PEPPER ne nécessite plus de relais Cloudflare, Netlify, Vercel ou de base de données intermédiaire pour JALAP ni pour la synchronisation du carnet. Le navigateur communique directement avec l'API Anthropic et l'API GitHub.

- **Mode Voyage :** Claude Haiku 5.5 propose des modifications structurées au voyage. Après validation, PEPPER sauvegarde d'abord dans IndexedDB, puis synchronise automatiquement le carnet vers `data/trips.json` dans le dépôt.
- **Mode Développement :** Claude Sonnet 5.5 lit les fichiers de code autorisés, prépare un aperçu avant/après et crée un commit GitHub direct uniquement après validation.
- **Cases cochées et formulaires :** chaque appel à `save()` sauvegarde immédiatement sur l'appareil. Si la synchronisation GitHub est activée, un commit du carnet est envoyé après environ 1,8 seconde sans nouvelle modification.
- **GitHub Pages :** le workflow ignore les commits qui ne changent que `data/trips.json`, afin de ne pas reconstruire l'application pour chaque coche.

### Mise en route

1. Crée une clé API Claude sur https://platform.claude.com/settings/keys.
2. Crée un fine-grained personal access token sur https://github.com/settings/personal-access-tokens/new.
3. Limite le token à **Only select repositories → sopp24/PEPPER**, avec uniquement **Contents: Read and write**. N'accorde pas Workflows, Actions, Administration ou l'accès à d'autres dépôts.
4. Dans PEPPER → Réglages, colle la clé Claude et le jeton GitHub.
5. Active **Synchroniser automatiquement le carnet avec GitHub**.

Les deux identifiants sont conservés dans le stockage local de ce navigateur. Le jeton GitHub est envoyé directement à `api.github.com`. La clé Claude est envoyée directement à `api.anthropic.com` avec l'en-tête `anthropic-dangerous-direct-browser-access: true` pour autoriser CORS. Anthropic recommande officiellement de conserver la clé derrière un backend, car tout JavaScript exécuté dans la page peut potentiellement la lire. Ce mode direct évite le relais serveur, mais implique donc d'utiliser une clé dédiée, avec budget et plafond de dépense dans Anthropic Console. Si l'organisation Anthropic interdit les appels directs depuis un navigateur (par exemple avec certains réglages de conformité ou Zero Data Retention), l'API peut refuser la requête ; il faudra alors réactiver un backend privé.

### Ce que GitHub reçoit

Le dépôt `sopp24/PEPPER` est public. Lorsque la synchronisation est activée, le contenu du carnet (voyages, activités, transports, dépenses, tâches et hébergements) est versionné et visible de tous dans `data/trips.json`. Quelques champs nommés explicitement comme QR codes, mots de passe, codes d'accès et références de réservation sont retirés de la copie publique. Les clés Claude et GitHub ne sont jamais incluses dans ce fichier.

Le stockage local reste la copie de travail immédiate et la sauvegarde hors connexion. En cas d'absence de connexion ou d'erreur GitHub, les changements restent sur l'appareil et le statut indique l'échec ou l'attente de synchronisation ; ils peuvent être réessayés lorsque la connexion revient. La synchronisation directe utilise un commit GitHub par lot de changements, après un court délai de regroupement.

### Mode Développement

JALAP Dev récupère un SHA de référence de la branche `main`, lit les fichiers autorisés, puis demande à Claude de proposer des remplacements exacts. PEPPER vérifie que chaque extrait existe une seule fois et que la proposition ne contient pas de motif ressemblant à un secret. Avant le commit, le navigateur vérifie que la branche n'a pas changé depuis la préparation du diff. Si elle a changé, il demande de recalculer la proposition au lieu d'écraser le travail plus récent.

Le mode Développement peut modifier uniquement les fichiers listés dans `JALAP_DEV_PATHS` dans `app.js`. Il ne peut pas modifier les workflows GitHub, les secrets, ses propres permissions ou créer un fichier non autorisé. Les commits sont visibles dans le dépôt public et GitHub Pages publie les modifications de code.

### Coûts Claude

L'API Claude est facturée séparément d'un abonnement Claude.ai. Les modèles configurés sont `claude-haiku-5-5` pour les tâches de voyage et `claude-sonnet-5-5` pour le développement. Les prix et modèles peuvent évoluer : consulte https://platform.claude.com/docs/en/about-claude/pricing. Configure un budget et une limite de dépense dans Anthropic Console.


## Confidentialité

Le dépôt est public. Si la synchronisation GitHub est activée, tout le carnet synchronisé dans `data/trips.json` est visible de tous. Les champs explicites de type QR code, mot de passe, code d'accès et référence de réservation sont filtrés de la copie publique, mais ne considère jamais ce dépôt comme un espace privé. Les clés Anthropic et GitHub restent dans le navigateur et ne sont jamais commitées. Les exports JSON locaux peuvent contenir davantage d'informations : garde-les dans un espace privé.


## Sauvegarde et mode hors connexion

Les voyages sont stockés localement dans IndexedDB, avec un stockage navigateur de compatibilité et une copie de récupération du dernier état valide. Le bouton « Sauvegarder tous les voyages » exporte un fichier JSON privé. « Restaurer une sauvegarde » permet de fusionner ou remplacer les voyages sur cet appareil ; le fichier est lu localement et n'est pas téléversé. Les prévisions météo déjà consultées restent affichables hors connexion avec leur horodatage. La coquille de l'application et les données du carnet sont conservées ; les tuiles de carte, les sources externes et le suivi temps réel ne sont pas garantis hors connexion. La synchronisation entre appareils est facultative et se fait directement avec le fichier public `data/trips.json` sur GitHub, sans Cloudflare, Netlify, Vercel ou base distante supplémentaire. Elle nécessite un jeton GitHub et rend le carnet synchronisé public.

## Publication GitHub Pages

Le workflow `.github/workflows/deploy-pages.yml` vérifie la syntaxe JavaScript puis publie automatiquement la racine du dépôt sur GitHub Pages à chaque push sur `main`.

**Première activation (une seule fois)** : dans le dépôt GitHub, ouvre **Settings → Pages → Build and deployment → Source**, puis choisis **GitHub Actions** et enregistre. L’intégration GitHub utilisée ici ne possède pas le droit d’activer ce réglage propriétaire à ta place. Une fois cette option sélectionnée, chaque push sur `main` lancera automatiquement le déploiement.

## Technologies

Leaflet, OpenStreetMap / Nominatim, Open-Meteo, JavaScript natif et GitHub Pages. Aucun serveur, Cloudflare Worker, token GitHub ou clé API n'est intégré au navigateur.


### Réservation des activités

Chaque activité peut conserver un lien de réservation. Depuis sa fiche, le bouton « Ouvrir le site pour réserver » ouvre le site du prestataire dans un nouvel onglet. Une fois la réservation confirmée auprès du prestataire, l'utilisateur revient dans PEPPER et clique « J'ai terminé la réservation » : le statut passe alors à « Réservée ». PEPPER ne réalise pas lui-même le paiement et ne confirme jamais automatiquement une réservation.