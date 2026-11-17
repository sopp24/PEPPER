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

## JALAP — Claude + mode Développement GitHub

JALAP utilise l'API Anthropic Claude via deux fonctions Netlify protégées. Le navigateur ne reçoit jamais les clés Anthropic ou GitHub.

- Mode **Voyage** : Claude Haiku 5.5 (`claude-haiku-5-5`) propose des modifications structurées au carnet local.
- Mode **Développement** : Claude Sonnet 5.5 (`claude-sonnet-5-5`) lit les fichiers actuels du dépôt `sopp24/PEPPER`, prépare des remplacements de code exacts et affiche une prévisualisation. Aucun commit n'est créé avant le clic explicite sur « Valider et commiter sur GitHub ».

### Variables Netlify requises

Dans Netlify → Project configuration → Environment variables, ajoute :

1. `ANTHROPIC_API_KEY` : clé API Anthropic Console, à créer sur https://platform.claude.com/settings/keys.
2. `GITHUB_TOKEN` : fine-grained personal access token, limité au seul dépôt `sopp24/PEPPER`, avec **Contents: Read and write**. Crée-le sur https://github.com/settings/personal-access-tokens/new. L'autorisation Metadata en lecture est ajoutée automatiquement. N'accorde pas Actions, Workflows, Administration ou accès à d'autres dépôts.
3. `PEPPER_API_TOKEN` : jeton privé PEPPER déjà utilisé par le navigateur.
4. `PEPPER_ALLOWED_ORIGIN=https://sopp24.github.io`.

Variables facultatives :
- `JALAP_TRAVEL_MODEL=claude-haiku-5-5`
- `JALAP_DEV_MODEL=claude-sonnet-5-5`

Les clés restent exclusivement côté serveur Netlify. Ne les ajoute jamais au dépôt ou au formulaire PEPPER. Sur le forfait Netlify Free, le choix de scopes dédiés peut ne pas être disponible : dans ce cas, garde le réglage par défaut, sans placer ces variables dans le code public ou dans `netlify.toml`.

### Parcours Développement

1. JALAP récupère les fichiers autorisés sur la branche `main`.
2. Claude propose des changements ciblés sous forme de remplacements exacts.
3. La fonction vérifie que chaque extrait existe une seule fois, que les chemins sont autorisés et qu'aucune chaîne ressemblant à une clé d'accès n'est introduite.
4. PEPPER affiche les fichiers, les raisons et les extraits avant/après.
5. Après validation, la fonction re-télécharge les fichiers et vérifie à nouveau les extraits avant de créer un commit Git unique sur `main`.
6. GitHub Pages déploie le site. Netlify n'a pas besoin de reconstruire le site public.

Le mode Dev ne peut modifier que les fichiers applicatifs listés dans `netlify/functions/jalap-dev.mjs`, y compris le moteur JALAP Voyage et le connecteur transport. Il ne peut pas modifier les workflows GitHub, les secrets, les paramètres Netlify ni son propre endpoint de commit. Les nouveaux fichiers ne sont pas encore pris en charge par les propositions de remplacement ; il faut d'abord les créer ou élargir explicitement la liste autorisée. Le contexte envoyé à Claude est réduit selon la nature de la demande : une demande purement visuelle n'envoie que le HTML et le CSS.

### Modèles et coûts

L'API Claude est facturée séparément d'un abonnement Claude.ai. À la date de dernière vérification, Haiku 5.5 coûte à partir de 0,10 $/million de tokens en entrée et 0,50 $/million en sortie ; Sonnet 5.5 coûte 2 $/million en entrée et 10 $/million en sortie. Les longues demandes de modification de code envoient plus de contexte et coûtent donc davantage qu'un échange de voyage. Configure un budget et une limite de dépense dans Anthropic Console et désactive le rechargement automatique si tu souhaites garder le contrôle.

Le mode Développement écrit directement dans le dépôt public. Les fichiers commités deviennent visibles de tous. Si Netlify a épuisé son quota mensuel, ses nouvelles fonctions ne seront accessibles qu'après le rétablissement du service et un déploiement ; verrouille ensuite l'auto-publication Netlify pour ne plus consommer un déploiement à chaque commit GitHub. GitHub Pages continue de publier le site. Le mode Voyage continue de sauvegarder les modifications du carnet dans le navigateur ; il ne publie pas automatiquement les informations du voyage.

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