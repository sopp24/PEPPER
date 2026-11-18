# PEPPER — compagnon de voyage

PEPPER est une application de voyage statique publiée par GitHub Pages. La carte est l'élément central, le programme est traité comme une liste de tâches et les autres informations sont organisées en cartes adaptatives. Les données sont d'abord enregistrées dans le navigateur (IndexedDB).

## JALAP — Gemini et GitHub en connexion directe

JALAP utilise **Gemini 3.8 Flash** depuis le navigateur, via l'API Gemini de Google AI Studio. Le dépôt public PEPPER et le navigateur communiquent directement avec l'API GitHub. Aucun relais Cloudflare, Netlify, Vercel ou base de données intermédiaire n'est nécessaire pour JALAP et la synchronisation du carnet.

- **Mode Voyage :** Gemini propose des modifications structurées au voyage. Après validation, PEPPER sauvegarde immédiatement dans IndexedDB et synchronise le carnet dans `data/trips.json` sur GitHub si la synchronisation est activée.
- **Mode Développement :** Gemini lit les fichiers applicatifs autorisés, prépare un aperçu avant/après et crée un commit GitHub direct uniquement après validation.
- **Cases cochées et formulaires :** chaque appel à `save()` sauvegarde immédiatement sur l'appareil. Si la synchronisation GitHub est activée, un commit du carnet est envoyé après environ 1,8 seconde sans nouvelle modification.
- **GitHub Pages :** le workflow ignore les commits qui ne changent que `data/trips.json`, afin de ne pas reconstruire l'application pour chaque coche.

### Obtenir une clé Gemini gratuite

1. Ouvre [Google AI Studio – API Keys](https://aistudio.google.com/api-keys).
2. Connecte-toi à ton compte Google.
3. Crée un projet si Google te le demande, puis clique sur **Create API key**.
4. Copie la clé générée.
5. Dans PEPPER → Réglages, colle-la dans **Clé API Gemini**.

Le modèle configuré est `gemini-3.8-flash`. La page officielle des tarifs affiche actuellement les tokens d'entrée et de sortie de ce modèle à **0 $ sur le niveau Free**. Ce niveau gratuit possède toutefois des quotas et des limites de débit qui peuvent varier selon le compte, le modèle et la région. Vérifie le tableau d'utilisation dans [Google AI Studio](https://aistudio.google.com/usage). Les appels avec outils facturables (Google Search/Maps grounding, par exemple) ne sont pas activés dans JALAP.

**Données et confidentialité :** Google indique que les requêtes du niveau gratuit peuvent être utilisées pour améliorer ses produits. N'envoie donc pas à JALAP de mots de passe, QR codes, billets complets, numéros de réservation ou informations d'accès. Le contexte de voyage partagé avec JALAP filtre déjà plusieurs types de données privées, mais cela ne remplace pas une vérification avant envoi.

**Clé côté navigateur :** la clé Gemini est conservée dans le stockage local de ce navigateur et envoyée directement à Google. Cette architecture évite un serveur intermédiaire, mais elle est moins sûre qu'une clé gardée dans un backend : du code malveillant exécuté dans la page pourrait accéder à la clé. Utilise une clé dédiée, limite-la à l'API Gemini si l'interface Google le permet, ne la committe jamais dans le dépôt et surveille les quotas. Les utilisateurs d'un autre appareil ou navigateur doivent saisir leur propre clé.

### Jeton GitHub pour la synchronisation et le mode Dev

1. Crée un fine-grained personal access token sur https://github.com/settings/personal-access-tokens/new.
2. Limite-le à **Only select repositories → sopp24/PEPPER**.
3. Accorde uniquement **Contents: Read and write**. N'accorde pas Workflows, Actions, Administration ou l'accès à d'autres dépôts.
4. Dans PEPPER → Réglages, colle le jeton GitHub.
5. Active **Synchroniser automatiquement le carnet avec GitHub**.

Le jeton est conservé dans le stockage local de ce navigateur et envoyé directement à `api.github.com`. Ni la clé Gemini ni le jeton GitHub ne sont ajoutés aux fichiers du dépôt.

### Ce que GitHub reçoit

Le dépôt `sopp24/PEPPER` est public. Lorsque la synchronisation est activée, le contenu du carnet (voyages, activités, transports, dépenses, tâches et hébergements) est versionné et visible de tous dans `data/trips.json`. Quelques champs nommés explicitement comme QR codes, mots de passe, codes d'accès et références de réservation sont retirés de la copie publique. Ne considère jamais ce fichier comme privé.

Le stockage local reste la copie de travail immédiate et la sauvegarde hors connexion. En cas d'absence de connexion ou d'erreur GitHub, les changements restent sur l'appareil et le statut indique l'échec ou l'attente de synchronisation ; ils peuvent être réessayés lorsque la connexion revient. La synchronisation directe utilise un commit GitHub par lot de changements, après un court délai de regroupement.

### Mode Développement

JALAP Dev récupère un SHA de référence de la branche `main`, lit les fichiers autorisés, puis demande à Gemini de proposer des remplacements exacts. PEPPER vérifie que chaque extrait existe une seule fois et que la proposition ne contient pas de motif ressemblant à un secret. Avant le commit, le navigateur vérifie que la branche n'a pas changé depuis la préparation du diff. Si elle a changé, il demande de recalculer la proposition au lieu d'écraser le travail plus récent.

Le mode Développement peut modifier uniquement les fichiers listés dans `JALAP_DEV_PATHS` dans `app.js`. Il ne peut pas modifier les workflows GitHub, les secrets, ses propres permissions ou créer un fichier non autorisé. Les commits sont visibles dans le dépôt public et GitHub Pages publie les modifications de code.

## Confidentialité

Le dépôt est public. Si la synchronisation GitHub est activée, tout le carnet synchronisé dans `data/trips.json` est visible de tous. Les champs explicitement nommés comme QR codes, mots de passe, codes d'accès et références de réservation sont filtrés de la copie publique, mais ne considère jamais ce dépôt comme un espace privé. Les clés Gemini et GitHub restent dans le navigateur et ne sont jamais commitées. Les exports JSON locaux peuvent contenir davantage d'informations : garde-les dans un espace privé.

## Sauvegarde et mode hors connexion

Les voyages sont stockés localement dans IndexedDB, avec un stockage navigateur de compatibilité et une copie de récupération du dernier état valide. Le bouton « Sauvegarder tous les voyages » exporte un fichier JSON privé. « Restaurer une sauvegarde » permet de fusionner ou remplacer les voyages sur cet appareil ; le fichier est lu localement et n'est pas téléversé. Les prévisions météo déjà consultées restent affichables hors connexion avec leur horodatage. La coquille de l'application et les données du carnet sont conservées ; les tuiles de carte, les sources externes et le suivi temps réel ne sont pas garantis hors connexion.

## Publication GitHub Pages

Le workflow `.github/workflows/deploy-pages.yml` vérifie la syntaxe JavaScript puis publie automatiquement la racine du dépôt sur GitHub Pages à chaque modification du code sur `main`. Les commits qui ne changent que `data/trips.json` sont ignorés par le déploiement Pages.

