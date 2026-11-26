# PEPPER — compagnon de voyage

PEPPER est une application de voyage statique publiée par GitHub Pages. La carte est l'élément central, le programme est traité comme une liste de tâches et les autres informations sont organisées en cartes adaptatives. Les données sont d'abord enregistrées dans le navigateur (IndexedDB).

## Interface

- **Accueil :** globe de nuit, « Nouveau voyage » et sélecteur de voyage. Pour une vraie photo, ajoute `assets/earth-night.jpg` (sinon une texture est chargée depuis un CDN).
- **Carnet :** carte vectorielle plein cadre (MapLibre GL, embarqué dans `assets/vendor/`) avec styles Sombre (Dark Matter, OpenMapTiles, par défaut) / Satellite / Plan ; carte MapTiler (Dark Matter officiel, clé navigateur dans `MAPTILER_KEY` de `app.js` : à restreindre à ton domaine dans le tableau de bord MapTiler) avec repli automatique sur `assets/vendor/dark-matter/` (licence incluse) + OpenFreeMap, vue 3D, ma position, plein écran, parcours du programme et cartes flottantes en « liquid glass » (hébergement, essentiels, trajet, météo, activités, JALAP). Le bouton ◧ masque les cartes pour voir toute la carte. « Voir plus » ouvre un panneau qui monte du bas avec le détail complet. Sur téléphone, la carte occupe l’écran ; les rubriques restent accessibles depuis la barre de navigation flottante en bas, sans cartes superposées.
- **Suppression d’un voyage :** depuis l’accueil, ouvre le sélecteur et touche « Supprimer » à côté du voyage ; tu peux aussi passer par ✎ → « Supprimer ce voyage ». La suppression est confirmée dans PEPPER et un marqueur évite la réapparition via les synchronisations.
- **Langue :** FR et EN pour toute l’interface (accueil, carnet, formulaires, réglages, messages). Le dictionnaire anglais est dans `lib/i18n-en.mjs` ; il n’est chargé qu’en anglais. JALAP répond dans la langue choisie.
- Les styles de cette interface sont dans `ui.css`.

## Synchronisation entre appareils (Supabase)

Tes voyages peuvent être enregistrés dans **ton** projet Supabase pour les retrouver sur tous tes appareils (téléphone, ordinateur…). Les données sont **privées** : sécurité au niveau des lignes (RLS), chaque compte ne lit que sa propre ligne.

1. Supabase → **SQL Editor** → colle et exécute `supabase/schema.sql` (une seule fois).
2. Supabase → **Authentication → Providers → Email** : laisse « Email » activé. Pour un usage personnel, tu peux désactiver « Confirm email » afin de te connecter tout de suite.
3. Récupère dans **Project Settings → API** l’**URL du projet** et la clé publique **anon / publishable** (jamais la clé `service_role`).
4. Dans PEPPER → Réglages → « Synchronisation entre appareils », colle l’URL et la clé, saisis un e-mail et un mot de passe, puis « Créer un compte ». Sur chaque autre appareil : même URL/clé, puis « Se connecter ».
   Pour que tous tes appareils soient configurés d’office, renseigne `SUPABASE_URL_DEFAULT` et `SUPABASE_ANON_KEY_DEFAULT` en haut du bloc « Synchronisation entre appareils (Supabase) » de `app.js` (valeurs publiques par conception).

Fonctionnement : chaque modification est d’abord enregistrée sur l’appareil, puis synchronisée (≈ 2 s). Les voyages sont fusionnés voyage par voyage (le plus récent l’emporte) et les suppressions sont propagées. L’application resynchronise au retour sur l’onglet et toutes les 2 minutes.

## JALAP — Gemini 3.8 Flash et GitHub en connexion directe

JALAP utilise **Google Gemini 3.8 Flash** (`gemini-3.8-flash`) via l'API Interactions de Google. **Les deux modes utilisent exactement le même modèle et la même clé API Gemini** : aucun compte Groq ou Anthropic n'est nécessaire. Le navigateur communique directement avec Google pour l'IA et avec GitHub pour le carnet et le code. Aucun relais Cloudflare, Netlify, Vercel ou base de données intermédiaire n'est nécessaire pour la version GitHub Pages.

- **Mode Voyage :** Gemini propose des modifications structurées du voyage. Après validation, PEPPER sauvegarde immédiatement dans IndexedDB puis synchronise le carnet vers `data/trips.json` sur GitHub si la synchronisation est activée.
- **Mode Développement :** le même Gemini lit les fichiers applicatifs autorisés, prépare un aperçu avant/après et crée un commit GitHub direct uniquement après validation.
- **Cases cochées et formulaires :** chaque appel à `save()` sauvegarde immédiatement sur l'appareil. Si la synchronisation GitHub est activée, un commit du carnet est envoyé après environ 1,8 seconde sans nouvelle modification.
- **GitHub Pages :** le workflow ignore les commits qui ne changent que `data/trips.json`, afin de ne pas reconstruire l'application pour chaque coche.

### Assistant de configuration de l’IA

Au premier message à JALAP (ou via Réglages → « Assistant de configuration de l’IA »), PEPPER ouvre un guide en trois étapes : créer la clé, la coller, tester la connexion. La clé n’est enregistrée dans le navigateur que si le test auprès de Gemini réussit ; les erreurs (clé refusée, quota, hors ligne) sont expliquées en clair.

### Obtenir une clé Gemini gratuite

1. Ouvre [Google AI Studio – API Keys](https://aistudio.google.com/api-keys).
2. Connecte-toi avec ton compte Google.
3. Clique sur **Create API Key** et crée une clé pour PEPPER.
4. Dans PEPPER → Réglages, colle-la dans **Clé API Google Gemini**.
5. Consulte les quotas et l'utilisation depuis Google AI Studio et la [page officielle des tarifs Gemini](https://ai.google.dev/gemini-api/docs/pricing).

Le modèle configuré est `gemini-3.8-flash`. Vérifie les quotas et limites de débit affichés dans ton projet Google AI Studio : ils dépendent du niveau d'accès et peuvent évoluer.

### Une seule clé IA pour les deux modes

JALAP utilise l'API Interactions avec une réponse JSON structurée et un niveau de réflexion `low`. Chaque interaction utilise `store: false` : PEPPER ne demande pas à Google de conserver la requête et la réponse pour les tours suivants. L'historique utile est transmis par le navigateur à chaque requête.

**Confidentialité du niveau gratuit :** Google indique que les données envoyées via le niveau sans frais peuvent être utilisées pour améliorer ses produits. Ne transmets pas de mots de passe, coordonnées bancaires, pièces d'identité, QR codes, références de réservation ou autres données sensibles à JALAP.

**Clé côté navigateur :** la clé Gemini est conservée dans le stockage local de ce navigateur et envoyée directement à `generativelanguage.googleapis.com` via l'en-tête `x-goog-api-key`. Elle n'est jamais ajoutée aux fichiers du dépôt. Ce fonctionnement évite un serveur intermédiaire, mais la clé reste accessible au JavaScript exécuté dans cette page et à toute personne ayant accès à ce navigateur. Utilise une clé dédiée, configure les restrictions disponibles dans Google AI Studio, surveille les quotas et ne la committe jamais dans GitHub. Toute personne utilisant un autre navigateur doit saisir sa propre clé.

### Jeton GitHub pour la synchronisation et le mode Développement

La clé Gemini ne donne pas accès à GitHub. Un jeton GitHub distinct est nécessaire pour les commits du mode Développement et, si tu l'actives, pour la synchronisation du carnet.

1. Crée un fine-grained personal access token sur https://github.com/settings/personal-access-tokens/new.
2. Limite-le à **Only select repositories → sopp24/PEPPER**.
3. Accorde uniquement **Contents: Read and write**. N'accorde pas Workflows, Actions, Administration ou l'accès à d'autres dépôts.
4. Dans PEPPER → Réglages, colle le jeton GitHub.
5. Active **Synchroniser automatiquement le carnet avec GitHub** uniquement si tu souhaites publier une copie de ton carnet.

Le jeton est conservé dans le stockage local de ce navigateur et envoyé directement à `api.github.com`. Ni la clé Gemini ni le jeton GitHub ne sont ajoutés aux fichiers du dépôt.

### Ce que GitHub reçoit

Le dépôt `sopp24/PEPPER` est public. Lorsque la synchronisation est activée, le contenu du carnet (voyages, activités, transports, dépenses, tâches et hébergements) est versionné et visible de tous dans `data/trips.json`. Certains champs nommés explicitement comme QR codes, mots de passe et codes d'accès sont retirés de la copie publique. Ne considère jamais ce fichier comme privé.

Le stockage local reste la copie de travail immédiate et la sauvegarde hors connexion. En cas d'absence de connexion ou d'erreur GitHub, les changements restent sur l'appareil et peuvent être synchronisés lorsque la connexion revient.

### Mode Développement

JALAP Dev récupère un SHA de référence de la branche `main`, lit les fichiers autorisés, puis demande au même modèle Gemini 3.8 Flash de proposer des remplacements exacts. PEPPER vérifie que chaque extrait existe une seule fois et bloque les propositions contenant des chaînes ressemblant à des secrets. Avant le commit, le navigateur vérifie que la branche n'a pas changé depuis la préparation du diff. Si elle a changé, il demande de recalculer la proposition au lieu d'écraser le travail plus récent.

Le contexte de code est limité afin de maîtriser les quotas du niveau gratuit. Le mode Développement peut modifier uniquement les fichiers listés dans `JALAP_DEV_PATHS` dans `app.js`. Il ne peut pas modifier les workflows GitHub ni les secrets.

## Confidentialité et sauvegardes

Le dépôt est public. Si la synchronisation GitHub est activée, le carnet synchronisé dans `data/trips.json` est visible de tous. Les clés Gemini et GitHub restent dans le navigateur et ne sont jamais commitées. Les exports JSON locaux peuvent contenir davantage d'informations : garde-les dans un espace privé.

Les voyages sont stockés localement dans IndexedDB, avec une copie de récupération. « Sauvegarder tous les voyages » exporte un fichier JSON privé ; « Restaurer une sauvegarde » permet de le relire localement sans téléversement. Les prévisions météo déjà consultées peuvent rester affichables hors connexion. La coquille de l'application, le module Gemini et les données du carnet sont conservés ; les tuiles de carte, les sources externes et le suivi temps réel ne sont pas garantis hors connexion.

## Présentation de PEPPER

Depuis l’accueil, **Découvrir PEPPER** ouvre une présentation verticale composée de scènes courtes : le problème des informations dispersées, le carnet centralisé, la carte interactive, l’assistant JALAP et le fonctionnement des données. Le texte suit l’ordre de préparation d’un voyage et reste simple et explicite.

La présentation se termine par le **board récapitulatif**. Il conserve une vue réelle de l’application ordinateur et trois vues téléphone chargées en mode démonstration isolé (programme, trajets, JALAP). Le board final seul est exportable en PDF sur une page **A3 paysage (420 × 297 mm)** ou **A3 portrait (297 × 420 mm)**. La mise en page est adaptée à chaque orientation.

## Publication GitHub Pages

Le workflow `.github/workflows/deploy-pages.yml` vérifie la syntaxe JavaScript, exécute les tests puis publie automatiquement la racine du dépôt sur `main`. Les commits qui ne changent que `data/trips.json` sont ignorés par le déploiement Pages.
