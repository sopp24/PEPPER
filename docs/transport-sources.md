# Sources officielles des transports dans PEPPER

Dernière vérification : 17 novembre 2026.

## Principe

PEPPER doit privilégier les sources qui produisent l'information de transport : compagnie ferroviaire ou aérienne, exploitant de bus ou de ferry, autorité organisatrice locale, gestionnaire d'autoroute ou service public de circulation.

Un comparateur ou un agrégateur peut aider à préparer un trajet, mais il ne doit pas remplacer l'application officielle pour confirmer un horaire, un quai, une porte, une annulation, un retard ou une règle d'embarquement.

Dans l'interface actuelle :
- Chaque trajet aller, retour ou correspondance peut avoir un lien officiel de billet et un lien distinct de suivi / information trafic.
- Le réseau urbain de destination peut être suggéré automatiquement pour Athènes, Paris/Île-de-France, Bordeaux, Lyon, Marseille, Nantes, Lille et Rennes.
- Pour les villes, compagnies et réseaux non répertoriés, les champs de la fiche voyage et du trajet permettent d'ajouter le nom et l'URL officiels.
- Les liens ouvrent le site ou l'application officielle. PEPPER ne prétend pas importer leur flux temps réel dans son écran.

## Sources par type de trajet

### Train

- **SNCF Connect** : billet, réservation et informations voyageurs — https://www.sncf-connect.com/
- **SNCF Open Data – horaires** : horaires théoriques GTFS / NeTEx et informations de circulation — https://ressources.data.sncf.com/explore/dataset/horaires-sncf/
- **SNCF Open Data – alertes temps réel** : SIRI SX Lite / GTFS-RT Service Alerts — https://ressources.data.sncf.com/explore/dataset/temps-reel-siri-sx-lite/
- **Eurostar** : https://www.eurostar.com/fr-fr
- **Trenitalia** : https://www.trenitalia.com/
- **Renfe** : https://www.renfe.com/es/en

Le flux SNCF d'alertes est annoncé avec une mise à jour toutes les deux minutes. Son périmètre comprend les circulations TGV, Intercités et TER, dont OUIGO, mais pas Transilien ni Eurostar. Il faut associer les identifiants des flux temps réel aux données horaires et vérifier les limites de chaque jeu de données.

### Avion

Les informations de référence sont celles du transporteur et de l'aéroport : statut du vol, terminal, porte, enregistrement, dépôt bagages, embarquement, changements et informations bagages.

- **Air France** : l'application annonce le suivi du statut du vol et des informations bagages — https://wwws.airfrance.fr/information/prepare/popin_app/fonctionnalites
- **easyJet** : suivi de vol officiel — https://www.easyjet.com/fr/suivi-de-vol-en-direct
- **Ryanair** : espace officiel — https://www.ryanair.com/fr/fr

Pour les autres compagnies, utiliser le champ « Lien officiel de suivi / info trafic » du trajet. Une heure de départ prévue ne doit pas être confondue avec l'heure de fermeture de l'enregistrement ou de la porte.

### Bus et cars

- **FlixBus – suivi du trajet** : https://global.flixbus.com/track

Pour les autres opérateurs, utiliser leur application officielle ou leur lien de suivi, renseigné dans le trajet. Les horaires d'un agrégateur ne remplacent pas le statut de l'opérateur qui exécute le trajet.

### Voiture et circulation routière

- **Bison Futé – conditions de circulation en direct** : https://www4.bison-fute.gouv.fr/maintenant.html
- **Bison Futé – données du réseau routier national** : événements et trafic publiés notamment en DATEX II — https://www1.bison-fute.gouv.fr/donnees-sur-le-rrn.html
- **VINCI Autoroutes – info trafic en direct** : https://www.vinci-autoroutes.com/fr/autoroutes-temps-reel/

Les données publiques routières couvrent des événements (accidents, bouchons, travaux, obstacles, fermetures) et des indicateurs de trafic sur certains périmètres. L'ETA voiture calculée actuellement par PEPPER n'intègre pas encore ces données : elle part de la durée de conduite saisie et ajoute des pauses estimées.

## Transports en commun dans la destination

Les liens de référence préremplis dans PEPPER sont :

| Destination | Réseau officiel | Informations |
|---|---|---|
| Athènes | [OASA Telematics](https://www.oasa.gr/en/passenger-service/tools/telematics-app/) | Positions et passages des bus / trolleybus, alertes |
| Paris / Île-de-France | [RATP](https://www.ratp.fr/aide-contact/questions/preparer-mon-trajet/information-trafic/ou-minformer-cas-perturbation) / [PRIM IDFM](https://prim.iledefrance-mobilites.fr/) | Trafic, prochains passages, données réseau |
| Bordeaux | [TBM](https://www.infotbm.com/fr/horaires) | Horaires, prochains passages |
| Lyon | [TCL](https://www.tcl.fr/infos-trafic) | Info trafic et horaires |
| Marseille | [RTM](https://www.rtm.fr/information-voyageurs) | Horaires et info voyageurs |
| Nantes | [Naolib](https://naolib.fr/fr/application-naolib-1) | Application et info trafic |
| Lille | [ilévia](https://www.ilevia.fr/cms/institutionnel/application-ilevia) | Application et perturbations |
| Rennes | [STAR](https://www.star.fr/star-et-moi/nouvel-habitant-metropole/star-lappli) | Horaires, alertes et info trafic |

Le portail **PRIM d'Île-de-France Mobilités** propose des API de prochains passages et de données dynamiques en SIRI Lite. Certaines API nécessitent un compte et des droits d'accès ; le périmètre des arrêts disponibles peut être partiel. Les estimations de prochains passages restent des prévisions et peuvent différer du passage réel.

## Ce qu'il faut pour intégrer le vrai temps réel dans PEPPER

L'application est hébergée en site statique sur GitHub Pages. Elle ne doit contenir aucun secret d'API ni identifiant privé dans son JavaScript public.

Pour afficher directement les retards et passages dans PEPPER, plutôt que d'ouvrir l'application du transporteur, il faudra :

1. Créer un service intermédiaire sécurisé (par exemple une fonction Vercel ou Netlify, sans Cloudflare si ce choix est maintenu).
2. Stocker les éventuelles clés API côté serveur, jamais dans le dépôt public ni dans le navigateur.
3. Commencer par un périmètre limité : flux SNCF en temps réel et un réseau urbain choisi, puis ajouter le trafic routier DATEX II / Bison Futé.
4. Normaliser les données dans un format commun : opérateur, ligne, numéro de course, arrêt, horaire prévu, horaire estimé, retard, statut, heure de dernière mise à jour et source.
5. Afficher la source et l'heure de fraîcheur, gérer les flux indisponibles, et toujours conserver un lien de secours vers l'application officielle.

Les données de vols, de bus, de ferries et de réseaux étrangers nécessitent ensuite des intégrations spécifiques : il n'existe pas un flux ouvert unique qui couvre tous les transporteurs et toutes les villes.

## Règle d'affichage

Tant qu'un flux n'est pas réellement connecté, PEPPER doit afficher « Ouvrir la source officielle » et non « En direct ». Un lien vers une application officielle ne constitue pas une synchronisation de ses données.


## Intégrations prêtes à activer

Le connecteur Netlify `netlify/functions/transport-status.mjs` interroge les avis SNCF SIRI SX en direct et filtre le résultat par numéro commercial du train. Le flux est actualisé toutes les deux minutes pour son périmètre publié. L'application ne présente pas « à l'heure » lorsqu'aucun avis n'est présent : elle indique seulement qu'aucun avis correspondant n'a été trouvé. Le service doit être déployé sur Netlify puis son URL de base configurée dans Réglages PEPPER.

L'accès PRIM Île-de-France Mobilités nécessite une inscription, un abonnement à l'API et une clé conservée dans une fonction serveur. Les données en temps réel ne couvrent actuellement qu'une partie des arrêts. Le trafic Bison Futé expose des données DATE/DATE II ; certaines données événementielles du réseau national non concédé sont libres, alors que les flux des autoroutes concédées ou Action B/C peuvent nécessiter des identifiants. Ces deux connecteurs restent à compléter après accès aux comptes / flux correspondants.
