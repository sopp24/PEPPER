# PEPPER — compagnon de voyage

PEPPER est une application de voyage statique publiée par GitHub Pages. La carte est l'élément central, le programme est traité comme une liste de tâches et les autres informations sont organisées en cartes adaptatives. Les données sont d'abord enregistrées dans le navigateur (IndexedDB).

## JALAP — Groq Free et GitHub en connexion directe

JALAP utilise **GPT-OSS 120B via GroqCloud Free** depuis le navigateur. Le dépôt public PEPPER et le navigateur communiquent directement avec l'API GitHub. Aucun relais Cloudflare, Netlify, Vercel ou base de données intermédiaire n'est nécessaire pour JALAP ni pour la synchronisation du carnet.

- **Mode Voyage :** le modèle propose des modifications structurées du voyage. Après validation, PEPPER sauvegarde immédiatement dans IndexedDB puis synchronise le carnet vers `data/trips.json` sur GitHub si la synchronisation est activée.
- **Mode Développement :** le modèle lit les fichiers applicatifs autorisés, prépare un aperçu avant/après et crée un commit GitHub direct uniquement après validation.
- **Cases cochées et formulaires :** chaque appel à `save()` sauvegarde immédiatement sur l'appareil. Si la synchronisation GitHub est activée, un commit du carnet est envoyé après environ 1,8 seconde sans nouvelle modification.
- **GitHub Pages :** le workflow ignore les commits qui ne changent que `data/trips.json`, afin de ne pas reconstruire l'application pour chaque coche.

### Obtenir une clé Groq gratuite

1. Ouvre [GroqCloud – API Keys](https://console.groq.com/keys).
2. Crée un compte ou connecte-toi.
3. Clique sur **Create API Key**, donne-lui un nom comme `PEPPER-local`, puis copie la clé commençant par `gsk_`.
4. Dans PEPPER → Réglages, colle-la dans **Clé API Groq**.
5. Consulte les limites et l'utilisation sur [GroqCloud – Limits](https://console.groq.com/settings/limits).

Le modèle configuré est `openai/gpt-oss-120b`. Groq Free est limité par modèle et par organisation ; la documentation consultable indique notamment environ 30 requêtes par minute et 1 000 requêtes par jour pour GPT-OSS 120B, avec des plafonds de tokens. Les valeurs exactes peuvent changer et sont à vérifier dans ton compte GroqCloud. Les réponses JSON structurées utilisées par JALAP sont officiellement prises en charge par ce modèle.

**Cadre d'utilisation :** Groq présente GroqCloud comme un service développeur, pas comme un service destiné à l'usage grand public. Cette clé est donc utilisée ici pour le prototypage personnel et le développement de PEPPER, pas pour lancer un service grand public ouvert à tous. Vérifie les conditions de Groq avant d'élargir l'accès de l'application.

**Clé côté navigateur :** la clé Groq est conservée dans le stockage local de ce navigateur et envoyée directement à `api.groq.com`. Groq recommande de ne pas intégrer de clé dans le frontend d'une application publique et de préférer un backend de confiance. Ce choix direct évite un serveur intermédiaire, mais la clé reste accessible au JavaScript exécuté dans cette page. Utilise une clé dédiée, surveille les quotas et ne la committe jamais dans GitHub. Toute personne utilisant un autre navigateur doit saisir sa propre clé.

### Jeton GitHub pour la synchronisation et le mode Dev

1. Crée un fine-grained personal access token sur https://github.com/settings/personal-access-tokens/new.
2. Limite-le à **Only select repositories → sopp24/PEPPER**.
3. Accorde uniquement **Contents: Read and write**. N'accorde pas Workflows, Actions, Administration ou l'accès à d'autres dépôts.
4. Dans PEPPER → Réglages, colle le jeton GitHub.
5. Active **Synchroniser automatiquement le carnet avec GitHub**.

Le jeton est conservé dans le stockage local de ce navigateur et envoyé directement à `api.github.com`. Ni la clé Groq ni le jeton GitHub ne sont ajoutés aux fichiers du dépôt.

### Ce que GitHub reçoit

Le dépôt `sopp24/PEPPER` est public. Lorsque la synchronisation est activée, le contenu du carnet (voyages, activités, transports, dépenses, tâches et hébergements) est versionné et visible de tous dans `data/trips.json`. Quelques champs nommés explicitement comme QR codes, mots de passe, codes d'accès et références de réservation sont retirés de la copie publique. Ne considère jamais ce fichier comme privé.

Le stockage local reste la copie de travail immédiate et la sauvegarde hors connexion. En cas d'absence de connexion ou d'erreur GitHub, les changements restent sur l'appareil et le statut indique l'échec ou l'attente de synchronisation ; ils peuvent être réessayés lorsque la connexion revient. La synchronisation directe utilise un commit GitHub par lot de changements, après un court délai de regroupement.

### Mode Développement

JALAP Dev récupère un SHA de référence de la branche `main`, lit les fichiers autorisés, puis demande à GPT-OSS 120B de proposer des remplacements exacts. PEPPER vérifie que chaque extrait existe une seule fois et que la proposition ne contient pas de motif ressemblant à un secret. Avant le commit, le navigateur vérifie que la branche n'a pas changé depuis la préparation du diff. Si elle a changé, il demande de recalculer la proposition au lieu d'écraser le travail plus récent.

Le contexte de code est limité afin de respecter les quotas du modèle gratuit. Si une demande dépasse cette limite, découpe-la en une modification plus ciblée. Le mode Développement peut modifier uniquement les fichiers listés dans `JALAP_DEV_PATHS` dans `app.js`. Il ne peut pas modifier les workflows GitHub, les secrets, ses propres permissions ou créer un fichier non autorisé.


## Confidentialité

Le dépôt est public. Si la synchronisation GitHub est activée, tout le carnet synchronisé dans `data/trips.json` est visible de tous. Les champs explicitement nommés comme QR codes, mots de passe, codes d'accès et références de réservation sont filtrés de la copie publique, mais ne considère jamais ce dépôt comme un espace privé. Les clés Groq et GitHub restent dans le navigateur et ne sont jamais commitées. Les exports JSON locaux peuvent contenir davantage d'informations : garde-les dans un espace privé.

## Sauvegarde et mode hors connexion

Les voyages sont stockés localement dans IndexedDB, avec un stockage navigateur de compatibilité et une copie de récupération du dernier état valide. Le bouton « Sauvegarder tous les voyages » exporte un fichier JSON privé. « Restaurer une sauvegarde » permet de fusionner ou remplacer les voyages sur cet appareil ; le fichier est lu localement et n'est pas téléversé. Les prévisions météo déjà consultées restent affichables hors connexion avec leur horodatage. La coquille de l'application et les données du carnet sont conservées ; les tuiles de carte, les sources externes et le suivi temps réel ne sont pas garantis hors connexion.

## Publication GitHub Pages

Le workflow `.github/workflows/deploy-pages.yml` vérifie la syntaxe JavaScript puis publie automatiquement la racine du dépôt sur GitHub Pages à chaque modification du code sur `main`. Les commits qui ne changent que `data/trips.json` sont ignorés par le déploiement Pages.

