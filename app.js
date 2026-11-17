const STORAGE_KEY="pepper-trip-state-v1";
const LEGACY_KEY="jalapentos-state-v1";
const RECOVERY_KEY="pepper-last-good-state-v1";
const API_BASE_KEY="pepper-api-base-url-v1";
const API_TOKEN_KEY="pepper-api-access-token-v1";
const DEFAULT_CHECKLIST=["Vérifier les papiers d’identité et les visas","Confirmer les billets, horaires et formalités d’enregistrement","Confirmer l’hébergement et les heures d’arrivée / départ","Vérifier les conditions de bagages et les documents nécessaires","Prévoir les moyens de paiement et télécharger les documents hors ligne"];
const $=(s,root=document)=>root.querySelector(s),$$=(s,root=document)=>Array.from(root.querySelectorAll(s));
const parse=(v,f)=>{try{return JSON.parse(v)}catch(e){return f}};
const uid=()=>"pepper-"+Math.random().toString(36).slice(2,9)+"-"+Date.now().toString(36);
const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const dateLabel=v=>v?new Intl.DateTimeFormat("fr-FR",{day:"numeric",month:"short",year:"numeric"}).format(new Date(v+"T12:00:00")):"À définir";
const money=(v,c)=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:c||"EUR",maximumFractionDigits:0}).format(Number(v||0));
const icons={train:"🚆",plane:"✈️",car:"🚗",bus:"🚌",ferry:"⛴"};
const modeName={train:"Train",plane:"Avion",car:"Voiture",bus:"Bus",ferry:"Ferry"};
const directionName={outbound:"Aller",return:"Retour",connection:"Correspondance",other:"Étape"};
let state=parse(localStorage.getItem(STORAGE_KEY),null)||parse(localStorage.getItem(RECOVERY_KEY),null)||parse(localStorage.getItem(LEGACY_KEY),null)||{trips:[],activeTripId:null};
state.trips=Array.isArray(state.trips)?state.trips:[];
state.trips.forEach(t=>{t.activities=t.activities||[];t.expenses=t.expenses||[];t.checklist=t.checklist||DEFAULT_CHECKLIST.map(label=>({id:uid(),label,done:false}));t.transport=t.transport||[];t.accommodation=t.accommodation||null});
let map=null,markers=null,mapTripId=null,mapLibraryRetryCount=0,weatherData=null,weatherError="",weatherRequest=0,transportRefreshTimer=null,pepperDbPromise=null;
let jalapMessages=[],jalapPendingProposal=null,jalapPendingTripId=null,jalapBusy=false;
const modalRoot=$("#modal-root");

function openPepperDatabase(){
 if(!("indexedDB" in window))return Promise.resolve(null);
 if(pepperDbPromise)return pepperDbPromise;
 pepperDbPromise=new Promise((resolve,reject)=>{
  const request=indexedDB.open("pepper-private-store",1);
  request.onupgradeneeded=()=>{
   const db=request.result;
   if(!db.objectStoreNames.contains("snapshots"))db.createObjectStore("snapshots");
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||new Error("IndexedDB indisponible"));
  request.onblocked=()=>reject(new Error("La base locale est bloquée par un autre onglet"));
 });
 return pepperDbPromise;
}
async function persistStateToIndexedDB(snapshot){
 try{
  const db=await openPepperDatabase();if(!db)return false;
  await new Promise((resolve,reject)=>{
   const tx=db.transaction("snapshots","readwrite");
   tx.objectStore("snapshots").put({json:snapshot,savedAt:new Date().toISOString()},"current");
   tx.oncomplete=resolve;
   tx.onerror=()=>reject(tx.error||new Error("Écriture IndexedDB impossible"));
   tx.onabort=()=>reject(tx.error||new Error("Écriture IndexedDB annulée"));
  });
  return true;
 }catch(error){return false}
}
async function readStateFromIndexedDB(){
 try{
  const db=await openPepperDatabase();if(!db)return null;
  const saved=await new Promise((resolve,reject)=>{
   const tx=db.transaction("snapshots","readonly");
   const request=tx.objectStore("snapshots").get("current");
   request.onsuccess=()=>resolve(request.result||null);
   request.onerror=()=>reject(request.error||new Error("Lecture IndexedDB impossible"));
  });
  if(!saved||typeof saved.json!=="string")return null;
  const restored=parse(saved.json,null);
  return restored&&Array.isArray(restored.trips)?restored:null;
 }catch(error){return null}
}
async function restoreStateFromIndexedDB(){
 const hasBrowserState=!!(localStorage.getItem(STORAGE_KEY)||localStorage.getItem(RECOVERY_KEY)||localStorage.getItem(LEGACY_KEY));
 if(hasBrowserState)return false;
 const restored=await readStateFromIndexedDB();
 if(!restored)return false;
 state=restored;
 return true;
}

function activeTrip(){return state.trips.find(t=>t.id===state.activeTripId)||state.trips[0]||null}
function save(){const snapshot=JSON.stringify(state);try{const previous=localStorage.getItem(STORAGE_KEY);if(previous)localStorage.setItem(RECOVERY_KEY,previous);localStorage.setItem(STORAGE_KEY,snapshot)}catch(e){toast("Le stockage classique est saturé. La sauvegarde locale étendue est tentée ; exporte aussi un fichier JSON privé.","error")}persistStateToIndexedDB(snapshot)}
function toast(message,type){const n=document.createElement("div");n.className="toast "+(type||"");n.textContent=message;$("#toast-root").appendChild(n);setTimeout(()=>n.remove(),4200)}
function dateTime(date,time){if(!date)return null;const d=new Date(date+"T"+(time||"00:00")+":00");return Number.isNaN(d.getTime())?null:d}
function dateTimeLabel(d){return new Intl.DateTimeFormat("fr-FR",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(d)}
function getAdvice(leg){
 const mode=leg.mode,operator=String(leg.operator||"").toLowerCase();
 if(mode==="train"){
  if(operator.includes("ouigo"))return{minutes:30,title:"OUIGO : viser 30 minutes avant",detail:"SNCF Connect conseille une présentation 30 minutes avant ; l’accès au train n’est plus garanti à moins de 5 minutes du départ. À faire : vérifier la taille et le nombre de bagages autorisés sur le billet, télécharger le billet et garder les justificatifs à portée de main. À éviter : arriver au dernier moment ou compter sur une tolérance après l’heure limite.",url:"https://www.sncf-connect.com/tgv",source:"SNCF Connect"};
  if(operator.includes("tgv inoui")||operator==="inoui")return{minutes:20,title:"TGV INOUI : viser 20 minutes avant",detail:"SNCF Connect conseille d’arriver 20 minutes avant ; l’accès au train peut être fermé 2 minutes avant le départ. À faire : vérifier le quai et la voiture, garder billet et pièce d’identité accessibles, préparer les bagages. À éviter : attendre l’affichage du quai au dernier moment ou dépasser la limite d’accès.",url:"https://www.sncf-connect.com/aide/presentation-a-l-embarquement",source:"SNCF Connect"};
  if(operator.includes("eurostar")&&(String(leg.origin||"")+" "+String(leg.destination||"")).toLowerCase().includes("londres"))return{minutes:60,title:"Eurostar vers Londres : viser 1 heure avant",detail:"Les contrôles d’identité et douaniers imposent une marge plus importante. Les limites d’enregistrement et d’embarquement inscrites sur le billet priment.",url:"https://www.sncf-connect.com/aide/voyager-avec-eurostar",source:"Eurostar / SNCF Connect"};
  return{minutes:null,title:"Marge à confirmer auprès du transporteur",detail:"Renseigne le transporteur et vérifie l’heure de présentation figurant sur ton billet. À faire : télécharger le billet, garder la pièce d’identité et vérifier les règles de bagages / correspondance. À éviter : supposer que toutes les compagnies et toutes les gares ont les mêmes horaires.",url:"https://www.sncf-connect.com/aide/presentation-a-l-embarquement",source:"SNCF Connect"};
 }
 if(mode==="plane"){
  if(operator.includes("air france")){
   if(leg.routeType==="international")return{minutes:180,title:"Air France : repère de 3 h avant l’international",detail:"En l’absence d’une heure différente sur la carte d’embarquement, Air France recommande 3 h avant un vol international. À faire : vérifier la validité des documents, s’enregistrer en ligne si possible, contrôler dimensions et poids des bagages, repérer le terminal et la fin de dépôt bagages. À éviter : se fier à l’heure de décollage pour calculer l’heure d’arrivée à l’aéroport.",url:"https://wwws.airfrance.fr/information/aeroport/enregistrement",source:"Air France"};
   if(leg.routeType==="domestic"||leg.routeType==="europe")return{minutes:120,title:"Air France : repère de 2 h avant France / Europe",detail:"En l’absence d’une heure différente sur la carte d’embarquement, Air France recommande 2 h avant un vol en France ou en Europe. À faire : préparer carte d’embarquement et pièce d’identité, vérifier le bagage cabine / soute et la fermeture du dépôt bagages. À éviter : arriver après l’heure limite d’enregistrement ou d’embarquement.",url:"https://wwws.airfrance.fr/information/aeroport/enregistrement",source:"Air France"};
   return{minutes:null,title:"Air France : préciser le type de vol",detail:"Repère Air France : 2 h pour la France / Europe, 3 h pour l’international, sauf heure différente sur la carte d’embarquement. Indique le type de vol.",url:"https://wwws.airfrance.fr/information/aeroport/enregistrement",source:"Air France"};
  }
  return{minutes:null,title:"Marge à confirmer auprès de la compagnie",detail:"Le temps conseillé dépend de la compagnie, de l’aéroport, du pays, des bagages et des contrôles. À faire : vérifier enregistrement, dépôt bagages, porte, documents de voyage, dimensions / poids et objets interdits auprès de la compagnie et de l’aéroport. À éviter : appliquer automatiquement les règles d’une autre compagnie. L’heure du billet / de la carte d’embarquement est prioritaire.",url:"",source:""};
 }
 if(mode==="car")return{minutes:null,title:"Voiture : prévoir les pauses et les aléas",detail:"Sur un long trajet, la Sécurité routière recommande une pause au moins toutes les 2 h et dès les signes de fatigue. À faire : partir reposé, contrôler pneus / niveaux / feux, vérifier trafic, péages, vignette et zones à faibles émissions. À éviter : conduire sous alcool ou stupéfiants, ignorer une somnolence, prendre le volant avec un médicament qui altère la vigilance ou dépasser les limitations.",url:"https://www.securite-routiere.gouv.fr/dangers-de-la-route/la-fatigue-et-la-conduite",source:"Sécurité routière"};
 return{minutes:null,title:"Marge à confirmer auprès du transporteur",detail:"Les règles de présentation, bagages et embarquement sont propres au transporteur et au trajet. Vérifie le billet et les consignes officielles.",url:"",source:""};
}
function estimatedRoadArrival(leg){
 const departure=dateTime(leg.departureDate,leg.departureTime),driving=Number(leg.drivingDurationMinutes||0);
 if(leg.mode!=="car"||!departure||driving<=0)return null;
 const breaks=Math.floor((driving-1)/120);
 return new Date(departure.getTime()+(driving+breaks*15)*60000);
}
function arrivalInfo(leg){
 const advice=getAdvice(leg),custom=leg.arrivalBufferMinutes!==""&&leg.arrivalBufferMinutes!=null,minutes=custom?Number(leg.arrivalBufferMinutes):advice.minutes,departure=dateTime(leg.departureDate,leg.departureTime);
 if(custom){advice.title="Marge personnalisée : "+minutes+" minutes";advice.detail="Marge saisie manuellement. Vérifie qu’elle respecte les instructions du billet, la fermeture de l’enregistrement et les éventuels contrôles."}
 return{advice:advice,minutes:minutes,arrivalBy:departure&&minutes!=null?new Date(departure.getTime()-minutes*60000):null,estimatedArrival:estimatedRoadArrival(leg),custom:custom};
}
function getWarnings(trip){
 const warnings=[],legs=trip.transport||[],activities=trip.activities||[];
 legs.forEach(leg=>{
  const dep=dateTime(leg.departureDate,leg.departureTime),arr=dateTime(leg.arrivalDate,leg.arrivalTime)||(leg.mode==="car"?estimatedRoadArrival(leg):null),info=arrivalInfo(leg);
  activities.forEach(a=>{
   if(!a.date||!a.startTime)return;
   const start=dateTime(a.date,a.startTime),end=start?new Date(start.getTime()+Number(a.duration||60)*60000):null;if(!start)return;
   if(dep&&a.date===leg.departureDate){const margin=new Date(dep.getTime()-(info.minutes==null?60:info.minutes)*60000);if(end&&end>margin&&start<dep)warnings.push("« "+a.name+" » est proche du départ "+directionName[leg.direction].toLowerCase()+". Vérifie le temps pour rejoindre "+(leg.origin||"le point de départ")+".")}
   if(arr&&a.date===leg.arrivalDate&&start>=arr&&start<new Date(arr.getTime()+90*60000))warnings.push("« "+a.name+" » commence moins de 1 h 30 après l’arrivée du trajet. Prévois débarquement, bagages et déplacement.")
  });
 });
 const stay=trip.accommodation;
 if(stay)(legs||[]).forEach(leg=>{
  const arrival=dateTime(leg.arrivalDate,leg.arrivalTime),departure=dateTime(leg.departureDate,leg.departureTime);
  if(arrival&&stay.checkInDate===leg.arrivalDate&&stay.checkInTime){const check=dateTime(stay.checkInDate,stay.checkInTime);if(check&&arrival>check)warnings.push("L’arrivée du "+directionName[leg.direction].toLowerCase()+" est après le check-in du logement. Confirme une arrivée tardive ou un accès autonome.")}
  if(departure&&stay.checkOutDate===leg.departureDate&&stay.checkOutTime){const out=dateTime(stay.checkOutDate,stay.checkOutTime);if(out&&out>departure)warnings.push("Le check-out est après le départ prévu. Vérifie une consigne à bagages ou un départ anticipé.")}
 });
 return Array.from(new Set(warnings));
}
function render(){
 const t=activeTrip();$("#empty-state").hidden=!!t;$("#trip-workspace").hidden=!t;if(!t)return;
 $("#trip-destination").textContent=t.destination||"Destination";
 $("#trip-dates").textContent=t.startDate?dateLabel(t.startDate)+(t.endDate?" — "+dateLabel(t.endDate):""):"Dates à définir";
 $("#trip-travellers").textContent=(t.people||1)+((t.people||1)===1?" voyageur":" voyageurs");
 const start=t.startDate?new Date(t.startDate+"T00:00:00"):null,end=t.endDate?new Date(t.endDate+"T23:59:59"):null,now=new Date();
 $("#trip-status").textContent=!start?"À organiser":start>now?"À venir":end&&end<now?"Terminé":"En cours";
 if(start){const days=Math.ceil((start-new Date(today()+"T00:00:00"))/86400000);$("#trip-countdown").textContent=days>1?"J - "+days:days===1?"Départ demain":days===0?"C’est le départ !":"Voyage passé"}else $("#trip-countdown").textContent="Dates à définir";
 $("#trip-switcher").innerHTML=state.trips.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===t.id?"selected":"")+'>'+esc(x.destination)+'</option>').join("");
 const q=encodeURIComponent(t.destination||"");$("#link-google-maps").href="https://www.google.com/maps/search/?api=1&query="+q;$("#link-apple-maps").href="https://maps.apple.com/?q="+q;$("#link-waze").href="https://www.waze.com/ul?q="+q+"&navigate=yes";$("#link-fuel").href="https://www.google.com/maps/search/?api=1&query="+encodeURIComponent("station-service carburant "+t.destination);
 renderStay(t);renderTransport(t);renderActivities(t);renderBudget(t);renderChecklist(t);
 if(!t.geo&&t.destination)fetchDestination(t);else{renderMap(t);if(!weatherData||weatherData.tripId!==t.id)fetchWeather(t)}
}
function renderStay(t){
 const s=t.accommodation,node=$("#accommodation-content");if(!s||!s.name){node.innerHTML='<div class="empty-inline">Ajoute ton logement pour connaître les horaires, l’accès, les équipements et les consignes d’arrivée / départ.</div>';return}
 const facts=[["Arrivée / check-in",(s.checkInDate?dateLabel(s.checkInDate):"À confirmer")+" · "+(s.checkInTime||"Horaire à confirmer")],["Départ / check-out",(s.checkOutDate?dateLabel(s.checkOutDate):"À confirmer")+" · "+(s.checkOutTime||"Horaire à confirmer")],["Type",s.type||"Non précisé"],["Contact",s.contact||"À confirmer"],["Téléphone",s.phone||"Non renseigné"],["Équipements",s.amenities||"À préciser"],["Parking",s.parking||"À vérifier"],["Petit-déjeuner",s.breakfast||"À vérifier"]];
 node.innerHTML='<div class="stay-top"><div><div class="stay-name">'+esc(s.name)+'</div><div class="stay-address">'+esc(s.address||"Adresse à préciser")+'</div></div><span class="status-pill">'+esc(s.status||"À confirmer")+'</span></div><div class="stay-grid">'+facts.map(f=>'<div class="stay-fact"><small>'+esc(f[0])+'</small><strong>'+esc(f[1])+'</strong></div>').join("")+'</div>'+(s.access||s.notes?'<div class="stay-notes">'+(s.access?"<strong>Accès / arrivée :</strong> "+esc(s.access)+"<br>":"")+(s.notes?"<strong>Consignes :</strong> "+esc(s.notes):"")+'</div>':"")+'<div class="inline-links">'+(s.bookingUrl?'<a href="'+esc(s.bookingUrl)+'" target="_blank" rel="noopener noreferrer">Réservation ↗</a>':"")+'<a href="https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(s.address||s.name)+'" target="_blank" rel="noopener noreferrer">Itinéraire vers le logement ↗</a></div>';
}

function normalizedSearchText(value){return String(value||"").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase()}
const OFFICIAL_LOCAL_NETWORKS=[
 {terms:["athenes","athens"],name:"OASA Telematics — Athènes",url:"https://www.oasa.gr/en/passenger-service/tools/telematics-app/",description:"Horaires, alertes et positions en temps réel des bus et trolleybus."},
 {terms:["bordeaux"],name:"TBM — Bordeaux",url:"https://www.infotbm.com/fr/horaires",description:"Prochains passages en temps réel et horaires des lignes du réseau TBM."},
 {terms:["lyon"],name:"TCL — Lyon",url:"https://www.tcl.fr/infos-trafic",description:"Info trafic, horaires et itinéraires du réseau TCL."},
 {terms:["marseille"],name:"RTM — Marseille",url:"https://www.rtm.fr/information-voyageurs",description:"Horaires, itinéraires et information voyageurs en temps réel."},
 {terms:["nantes"],name:"Naolib — Nantes",url:"https://naolib.fr/fr/application-naolib-1",description:"Horaires en temps réel, itinéraires et info trafic."},
 {terms:["lille"],name:"ilévia — Lille",url:"https://www.ilevia.fr/cms/institutionnel/application-ilevia",description:"Application officielle et perturbations du réseau."},
 {terms:["rennes"],name:"STAR — Rennes",url:"https://www.star.fr/star-et-moi/nouvel-habitant-metropole/star-lappli",description:"Horaires, itinéraires, alertes et passages en temps réel."},
 {terms:["paris","ile-de-france","ile de france"],name:"RATP / Île-de-France Mobilités — Paris",url:"https://www.ratp.fr/aide-contact/questions/preparer-mon-trajet/information-trafic/ou-minformer-cas-perturbation",description:"Info trafic des lignes et applications officielles Bonjour RATP et IDFM."}
];
function suggestedLocalNetwork(destination){const value=normalizedSearchText(destination);return OFFICIAL_LOCAL_NETWORKS.find(item=>item.terms.some(term=>value.includes(term)))||null}
function officialLegSources(leg){
 const op=normalizedSearchText(leg.operator),links=[];
 if(leg.trafficUrl)links.push({label:"Suivi / info trafic officiel renseigné",url:leg.trafficUrl});
 if(leg.mode==="train"){
  if(/sncf|inoui|ouigo|intercites|ter/.test(op)){
   links.push({label:"SNCF Connect — billet et voyage",url:"https://www.sncf-connect.com/"});
   links.push({label:"SNCF Open Data — horaires et circulation",url:"https://ressources.data.sncf.com/explore/dataset/horaires-sncf/"});
   links.push({label:"SNCF Open Data — alertes en temps réel (SIRI / GTFS-RT)",url:"https://ressources.data.sncf.com/explore/dataset/temps-reel-siri-sx-lite/"});
  }else if(op.includes("eurostar"))links.push({label:"Eurostar — informations de voyage",url:"https://www.eurostar.com/fr-fr"});
  else if(op.includes("trenitalia"))links.push({label:"Trenitalia — site officiel",url:"https://www.trenitalia.com/"});
  else if(op.includes("renfe"))links.push({label:"Renfe — site officiel",url:"https://www.renfe.com/es/en"});
 }
 if(leg.mode==="plane"){
  if(op.includes("air france"))links.push({label:"Air France — application et suivi des vols",url:"https://wwws.airfrance.fr/information/prepare/popin_app/fonctionnalites"});
  else if(op.includes("easyjet"))links.push({label:"easyJet — suivi de vol en direct",url:"https://www.easyjet.com/fr/suivi-de-vol-en-direct"});
  else if(op.includes("ryanair"))links.push({label:"Ryanair — site et espace voyage officiel",url:"https://www.ryanair.com/fr/fr"});
 }
 if(leg.mode==="bus"&&op.includes("flixbus"))links.push({label:"FlixBus — suivi du trajet",url:"https://global.flixbus.com/track"});
 if(leg.mode==="car"){
  links.push({label:"Bison Futé — trafic routier en temps réel (France)",url:"https://www4.bison-fute.gouv.fr/maintenant.html"});
  links.push({label:"Bison Futé — trafic des grandes agglomérations",url:"https://www.bison-fute.gouv.fr/trafic-des-agglomerations.html"});
  if(op.includes("vinci"))links.push({label:"VINCI Autoroutes — trafic en direct",url:"https://www.vinci-autoroutes.com/fr/autoroutes-temps-reel/"});
 }
 return links;
}
function renderOfficialLegSources(leg){
 const links=officialLegSources(leg);
 if(!links.length)return "";
 return '<div class="arrival-advice"><strong>Suivi auprès des sources officielles</strong><div class="inline-links">'+links.map(link=>'<a href="'+esc(link.url)+'" target="_blank" rel="noopener noreferrer">'+esc(link.label)+' ↗</a>').join("")+'</div><small>Les informations sont consultées sur le site ou l’application de l’opérateur ; elles ne sont pas synchronisées dans PEPPER.</small></div>';
}
function renderLocalTransitSources(t){
 const inferred=suggestedLocalNetwork(t.destination),name=t.localTransitName||inferred?.name,url=t.localTransitUrl||inferred?.url,traffic=t.localTrafficUrl;
 if(!name&&!url&&!traffic)return '<div class="arrival-advice"><strong>Transports en commun à destination</strong><p>Le réseau officiel de cette ville n’est pas encore référencé. Tu peux ajouter son nom et le lien de son application ou de son info trafic dans « Modifier le voyage ».</p>'+(t.localTransitRef?'<div id="destination-live-status" class="live-status"><strong>Suivi IDFM</strong><small>Préparation des prochains passages pour l’arrêt renseigné.</small></div>':"")+'</div>';
 return '<div class="arrival-advice"><strong>Réseau de transport sur place · '+esc(name||"Source officielle")+'</strong><p>'+esc(inferred?.description||"Utilise le site ou l’application officielle du réseau pour les horaires, les perturbations, les titres et les changements de service.")+'</p><div class="inline-links">'+(url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Ouvrir le site / l’application officielle ↗</a>':"")+(traffic?'<a href="'+esc(traffic)+'" target="_blank" rel="noopener noreferrer">Ouvrir l’info trafic officielle ↗</a>':"")+'</div>'+(t.localTransitRef?'<div id="destination-live-status" class="live-status"><strong>Suivi IDFM</strong><small>Préparation des prochains passages pour l’arrêt renseigné.</small></div>':"")+'<small>PEPPER ouvre la source officielle ; les données temps réel du réseau ne sont disponibles que pour les sources et arrêts configurés.</small></div>';
}


function apiBaseUrl(){return String(localStorage.getItem(API_BASE_KEY)||"").trim().replace(/\/+$/,"")}
function apiAccessToken(){return String(localStorage.getItem(API_TOKEN_KEY)||"").trim()}
function apiRequestHeaders(){return {accept:"application/json",Authorization:"Bearer "+apiAccessToken()}}
function isSNCFRealtimeEligible(leg){
 if(!leg||leg.mode!=="train")return false;
 const operator=normalizedSearchText(leg.operator);
 return !operator.includes("eurostar")&&!operator.includes("transilien")&&/(tgv|inoui|ouigo|intercites|ter)/.test(operator);
}
function liveStatusSlot(leg){
 if(!isSNCFRealtimeEligible(leg))return "";
 return '<div class="live-status" id="live-status-'+esc(leg.id)+'"><strong>Suivi SNCF</strong><small>'+(leg.number?'Préparation du contrôle du train '+esc(leg.number)+'.':'Renseigne le numéro commercial du train pour rechercher les avis SNCF.')+'</small></div>';
}
function renderLiveStatus(data,stale){
 const checked=data.checkedAt?new Date(data.checkedAt):null;
 const when=checked?new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(checked):"heure inconnue";
 if(data.error)return '<strong>Suivi temps réel indisponible</strong><small>'+esc(data.error)+'</small>';
 const alerts=Array.isArray(data.alerts)?data.alerts:[];
 const lead=stale?"Dernières données enregistrées · ":"Actualisé · ";
 if(!alerts.length)return '<strong>Aucun avis trouvé pour ce train</strong><small>'+lead+esc(when)+'. Attention : l’absence d’avis ne confirme pas que le train est à l’heure.</small><a href="'+esc(data.source||"https://www.sncf-connect.com/")+'" target="_blank" rel="noopener noreferrer">Source SNCF ↗</a>';
 return '<strong>⚠ '+alerts.length+' avis SNCF pour ce train</strong><small>'+lead+esc(when)+'</small>'+alerts.map(alert=>'<div class="live-alert"><b>'+esc(alert.title)+'</b>'+(alert.description?'<p>'+esc(alert.description)+'</p>':"")+(alert.severity?'<small>Gravité : '+esc(alert.severity)+'</small>':"")+'</div>').join("")+'<a href="'+esc(data.source||"https://www.sncf-connect.com/")+'" target="_blank" rel="noopener noreferrer">Source SNCF ↗</a>';
}

function renderIdfmStatus(data){
 if(!data.configured)return '<strong>Connecteur IDFM à configurer</strong><small>'+esc(data.message||"Ajoute le jeton API PRIM dans Netlify.")+'</small><a href="'+esc(data.setupUrl||"https://prim.iledefrance-mobilites.fr/")+'" target="_blank" rel="noopener noreferrer">Créer un jeton PRIM ↗</a>';
 const departures=Array.isArray(data.departures)?data.departures:[];
 if(!departures.length)return '<strong>Aucun passage retourné pour cet arrêt</strong><small>'+esc(data.message||"Vérifie la référence MonitoringRef et la couverture du flux.")+'</small>';
 return '<strong>Prochains passages · IDFM</strong><small>Actualisé : '+esc(new Intl.DateTimeFormat("fr-FR",{hour:"2-digit",minute:"2-digit"}).format(new Date(data.checkedAt)))+'</small>'+departures.slice(0,5).map(item=>'<div class="live-alert"><b>'+esc(item.line||"Ligne")+(item.destination?" · "+esc(item.destination):"")+'</b><p>'+(item.expectedTime?"Prévu : "+esc(item.expectedTime):"Horaire prévu non renseigné")+(item.aimedTime&&item.expectedTime?" · théorique : "+esc(item.aimedTime):"")+'</p></div>').join("");
}
async function refreshLocalTransitStatus(trip){
 const target=document.getElementById("destination-live-status");
 if(!target||!trip.localTransitRef)return;
 const base=apiBaseUrl(),cacheKey="pepper-idfm-v1:"+trip.id;
 if(!base||!apiAccessToken()){
  const cached=parse(localStorage.getItem(cacheKey),null);
  target.innerHTML=cached?renderIdfmStatus(cached):'<strong>Suivi local IDFM prêt à activer</strong><small>Déploie le service Netlify, configure PEPPER_API_TOKEN et IDFM_API_KEY côté serveur, puis renseigne le MonitoringRef de l’arrêt.</small>';
  return;
 }
 try{
  const endpoint=base+"/.netlify/functions/transport-status?provider=idfm&monitoringRef="+encodeURIComponent(trip.localTransitRef);
  const response=await fetch(endpoint,{headers:apiRequestHeaders(),signal:AbortSignal.timeout(15000)});
  const data=await response.json();
  if(data.configured===false){target.innerHTML=renderIdfmStatus(data);return;}
  if(!response.ok)throw new Error(data.error||"Réponse PRIM "+response.status);
  localStorage.setItem(cacheKey,JSON.stringify(data));
  if(activeTrip()?.id===trip.id&&document.getElementById("destination-live-status"))document.getElementById("destination-live-status").innerHTML=renderIdfmStatus(data);
 }catch(error){
  const cached=parse(localStorage.getItem(cacheKey),null);
  if(document.getElementById("destination-live-status"))document.getElementById("destination-live-status").innerHTML=cached?renderIdfmStatus(cached)+'<small>Dernières données conservées : connexion indisponible.</small>':'<strong>Suivi IDFM indisponible</strong><small>'+esc(error.message||"Vérifie le jeton et la référence de l’arrêt.")+'</small>';
 }
}

async function refreshLiveTransportStatus(trip){
 const eligible=(trip.transport||[]).filter(isSNCFRealtimeEligible);
 if(!eligible.length)return;
 const base=apiBaseUrl();
 for(const leg of eligible){
  const target=document.getElementById("live-status-"+leg.id);
  if(!target)continue;
  if(!leg.number){
   target.innerHTML="<strong>Suivi SNCF non configuré</strong><small>Ajoute le numéro commercial du train pour consulter les avis associés.</small>";
   continue;
  }
  const cacheKey="pepper-live-status-v1:"+trip.id+":"+leg.id;
  if(!base||!apiAccessToken()){
   const cached=parse(localStorage.getItem(cacheKey),null);
   target.innerHTML=cached?renderLiveStatus(cached,true):'<strong>Connecteur temps réel SNCF à activer</strong><small>Configure l’URL Netlify et le jeton privé PEPPER dans Réglages. Le suivi officiel du billet reste disponible.</small>';
   continue;
  }
  target.innerHTML="<strong>Consultation du flux SNCF…</strong><small>Recherche des avis associés au train "+esc(leg.number)+".</small>";
  try{
   const endpoint=base+"/.netlify/functions/transport-status?provider=sncf&number="+encodeURIComponent(leg.number);
   const response=await fetch(endpoint,{headers:apiRequestHeaders(),signal:AbortSignal.timeout(15000)});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||"Réponse du service "+response.status);
   if(activeTrip()?.id!==trip.id)return;
   localStorage.setItem(cacheKey,JSON.stringify(data));
   const liveTarget=document.getElementById("live-status-"+leg.id);
   if(liveTarget)liveTarget.innerHTML=renderLiveStatus(data,false);
  }catch(error){
   const cached=parse(localStorage.getItem(cacheKey),null);
   const liveTarget=document.getElementById("live-status-"+leg.id);
   if(liveTarget)liveTarget.innerHTML=cached?renderLiveStatus(cached,true):'<strong>Suivi temporairement indisponible</strong><small>'+esc(error.message||"Vérifie la connexion et le service API.")+'</small>';
  }
 }
}
function startLiveRefresh(trip){
 if(transportRefreshTimer)clearInterval(transportRefreshTimer);
 const needsLive=(trip.transport||[]).some(leg=>isSNCFRealtimeEligible(leg)&&leg.number)||!!trip.localTransitRef;
 if(!needsLive||!apiBaseUrl()||!apiAccessToken())return;
 refreshLiveTransportStatus(trip);
 transportRefreshTimer=setInterval(()=>{
  if(document.visibilityState==="visible"&&navigator.onLine&&activeTrip()?.id===trip.id){refreshLiveTransportStatus(trip);refreshLocalTransitStatus(trip)}
 },120000);
}
function haversineKm(a,b){
 const toRad=v=>v*Math.PI/180,lat1=toRad(Number(a.lat)),lat2=toRad(Number(b.lat)),dLat=lat2-lat1,dLon=toRad(Number(b.lon)-Number(a.lon));
 const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
function getPlanningWarnings(trip){
 const warnings=[],items=(trip.activities||[]).filter(a=>!a.done);
 items.forEach((a,i)=>{
  if(a.date&&trip.startDate&&a.date<trip.startDate)warnings.push("« "+a.name+" » est datée avant le début du voyage.");
  if(a.date&&trip.endDate&&a.date>trip.endDate)warnings.push("« "+a.name+" » est datée après la fin du voyage.");
  if(a.bookingRequired&&bookingState!=="booked"&&!a.bookingUrl)warnings.push("« "+a.name+" » nécessite une réservation : ajoute le lien officiel ou confirme le mode de réservation.");
  for(let j=i+1;j<items.length;j++){
   const b=items[j];
   if(!a.date||a.date!==b.date||!a.startTime||!b.startTime)continue;
   const startA=dateTime(a.date,a.startTime),startB=dateTime(b.date,b.startTime);
   if(!startA||!startB)continue;
   const endA=new Date(startA.getTime()+Number(a.duration||60)*60000),endB=new Date(startB.getTime()+Number(b.duration||60)*60000);
   if(startA<endB&&startB<endA)warnings.push("« "+a.name+" » et « "+b.name+" » se chevauchent dans le programme.");
   const earlier=startA<startB?a:b,later=startA<startB?b:a,earlierEnd=startA<startB?endA:endB,laterStart=startA<startB?startB:startA;
   if(earlier.geo&&later.geo){
    const distance=haversineKm(earlier.geo,later.geo),available=(laterStart-earlierEnd)/60000;
    const estimatedWalk=distance/4*60+10;
    if(distance>=0.8&&available>=0&&available<estimatedWalk)warnings.push("Le temps entre « "+earlier.name+" » et « "+later.name+" » semble court pour environ "+distance.toFixed(1)+" km à vol d’oiseau. Vérifie l’itinéraire réel.");
   }
  }
 });
 return Array.from(new Set(warnings));
}
function updateNetworkStatus(){
 const node=$("#network-status");if(!node)return;
 const offline=!navigator.onLine;
 node.hidden=!offline;
 node.textContent=offline?"Hors connexion : tes voyages, activités et sauvegardes locales restent disponibles. Les données live, la météo et les cartes peuvent être indisponibles ou anciennes.":"";
}

function renderTransport(t){
 const node=$("#transport-content"),legs=t.transport||[];if(!legs.length){node.innerHTML='<div class="empty-inline">Aucun trajet renseigné. Ajoute ton aller, ton retour ou une correspondance pour afficher les marges et alertes de planning.</div>'+renderLocalTransitSources(t);startLiveRefresh(t);refreshLocalTransitStatus(t);return}
 node.innerHTML='<div class="transport-list">'+legs.map(leg=>{
  const info=arrivalInfo(leg),dep=dateTime(leg.departureDate,leg.departureTime),arr=dateTime(leg.arrivalDate,leg.arrivalTime),facts=[["Départ",dep?dateTimeLabel(dep):"À préciser"],["Arrivée",arr?dateTimeLabel(arr):"À préciser"],["Voie / terminal",leg.platform||"À vérifier"],["Bagages",leg.baggage||"À vérifier"],["Limite d’embarquement",leg.boardingDeadline||"À vérifier"]];
  const when=info.arrivalBy?"Arrivée conseillée au plus tard : "+dateTimeLabel(info.arrivalBy)+". ":"",roadEta=info.estimatedArrival?"Arrivée voiture indicative : "+dateTimeLabel(info.estimatedArrival)+" (pauses de 15 min / 2 h estimées, hors trafic). ":"";
  const officialSources=renderOfficialLegSources(leg);
  const advice='<div class="arrival-advice"><strong>'+esc(info.advice.title)+'</strong>'+esc(when+roadEta+info.advice.detail)+'<br><small>'+(info.custom?"Marge personnalisée": "Repère transporteur")+(info.advice.source?" · "+esc(info.advice.source):"")+'</small>'+(info.advice.url?'<br><a href="'+esc(info.advice.url)+'" target="_blank" rel="noopener noreferrer">Consigne officielle ↗</a>':"")+'</div>';
  const pauses=leg.mode==="car"&&Number(leg.drivingDurationMinutes)>120?'<div class="transport-warning">Trajet long : prévois une pause au moins toutes les 2 heures et dès les premiers signes de fatigue. '+(leg.plannedStops?"Pauses planifiées : "+esc(leg.plannedStops)+".":"")+'</div>':"";
  return '<article class="transport-card"><div class="transport-card-head"><div class="transport-mode"><span class="transport-mode-icon">'+(icons[leg.mode]||"↗")+'</span><span><strong>'+esc(directionName[leg.direction]||"Trajet")+' · '+esc(modeName[leg.mode]||"Transport")+'</strong><small>'+esc(leg.operator||"Transporteur à préciser")+(leg.service?" · "+esc(leg.service):"")+(leg.number?" · "+esc(leg.number):"")+'</small></span></div><span class="status-pill">À vérifier</span></div><div class="transport-route"><div class="transport-stop"><strong>'+esc(leg.origin||"Départ")+'</strong><small>'+esc(leg.departureDate?dateLabel(leg.departureDate):"Date à préciser")+' · '+esc(leg.departureTime||"—")+'</small></div><span class="transport-line">→</span><div class="transport-stop"><strong>'+esc(leg.destination||"Arrivée")+'</strong><small>'+esc(leg.arrivalDate?dateLabel(leg.arrivalDate):"Date à préciser")+' · '+esc(leg.arrivalTime||"—")+'</small></div></div><div class="transport-facts">'+facts.map(f=>'<div class="transport-fact"><small>'+esc(f[0])+'</small><strong>'+esc(f[1])+'</strong></div>').join("")+'</div>'+advice+officialSources+liveStatusSlot(leg)+pauses+(leg.notes?'<div class="stay-notes">'+esc(leg.notes)+'</div>':"")+'<div class="inline-links">'+(leg.ticketUrl?'<a href="'+esc(leg.ticketUrl)+'" target="_blank" rel="noopener noreferrer">Ouvrir le billet / transporteur ↗</a>':"")+'<a href="https://www.google.com/maps/search/?api=1&query='+encodeURIComponent((leg.origin||"")+" "+(leg.destination||""))+'" target="_blank" rel="noopener noreferrer">Voir le trajet ↗</a></div><div class="transport-actions"><button type="button" data-action="edit-transport" data-id="'+esc(leg.id)+'">Modifier</button><button type="button" data-action="delete-transport" data-id="'+esc(leg.id)+'">Supprimer</button></div></article>';
 }).join("")+'</div>';
 node.innerHTML+=renderLocalTransitSources(t);
 startLiveRefresh(t);refreshLocalTransitStatus(t);
 const warnings=getWarnings(t);if(warnings.length)node.innerHTML+='<div class="transport-warnings">'+warnings.map(w=>'<div class="transport-warning">⚠ '+esc(w)+'</div>').join("")+'</div>';
}
function renderActivities(t){
 const planWarnings=getPlanningWarnings(t);$("#itinerary-warnings").innerHTML=planWarnings.length?'<div class="transport-warnings">'+planWarnings.map(w=>'<div class="transport-warning">⚠ '+esc(w)+'</div>').join("")+'</div>':"";
 const items=(t.activities||[]).slice().sort((a,b)=>((a.date||"9999-99-99")+" "+(a.startTime||"99:99")).localeCompare((b.date||"9999-99-99")+" "+(b.startTime||"99:99")));
 const planned=items.filter(a=>!!a.date),flexible=items.filter(a=>!a.date),done=items.filter(a=>a.done).length;
 $("#itinerary-summary").innerHTML='<span class="summary-chip">'+items.length+' activité(s)</span><span class="summary-chip">'+planned.length+' programmée(s)</span><span class="summary-chip">'+flexible.length+' à planifier</span><span class="summary-chip">'+done+' faite(s)</span>';
 if(!items.length){$("#activities-list").innerHTML='<div class="empty-inline">Ton programme est encore vierge.<br>Ajoute des idées sans date, ou construis ton planning quand tu seras prêt.</div>';return}
 const renderRows=list=>list.map(a=>{
  const d=a.date?new Date(a.date+"T12:00:00"):null,day=d?new Intl.DateTimeFormat("fr-FR",{day:"2-digit"}).format(d):"—",month=d?new Intl.DateTimeFormat("fr-FR",{month:"short"}).format(d).replace(".",""):"à planifier";
  const priority=a.priority==="must"?"Prioritaire":a.priority==="low"?"Option":"À voir",cls=a.priority==="must"?"":a.priority==="low"?"low":"medium";
  const bookingState=a.bookingStatus||(a.bookingRequired?"to_book":"unknown"),bookingLabel=bookingState==="booked"?"Réservée":bookingState==="to_book"?"À réserver":bookingState==="not_required"?"Sans réservation":"";
  const timing=d?(a.startTime||"Horaire à choisir"):"Date libre";
  return '<div class="activity-row '+(a.done?"is-complete":"")+'"><label class="activity-check" title="Marquer comme faite"><input type="checkbox" data-action="toggle-activity" data-id="'+esc(a.id)+'" '+(a.done?"checked":"")+' aria-label="Activité faite : '+esc(a.name)+'"></label><span class="activity-date"><strong>'+day+'</strong><small>'+esc(month)+'</small></span><button class="activity-info" type="button" data-action="activity-detail" data-id="'+esc(a.id)+'"><strong>'+esc(a.name)+'</strong><small>'+esc(a.category||"Visite")+' · '+esc(timing)+(a.duration?" · "+esc(a.duration)+" min":"")+(bookingLabel?" · "+bookingLabel:"")+'</small></button><span class="activity-end">'+(a.done?'<span class="completion-tag">Faite ✓</span>':'<span class="priority '+cls+'">'+priority+'</span>')+'<span>↗</span></span></div>';
 }).join("");
 $("#activities-list").innerHTML=(planned.length?'<div class="itinerary-group-label">PLANNING PROGRAMMÉ</div>'+renderRows(planned):"")+(flexible.length?'<div class="itinerary-group-label">À PLANIFIER · SANS DATE</div>'+renderRows(flexible):"");
}
function renderBudget(t){
 const total=(t.expenses||[]).reduce((s,x)=>s+Number(x.amount||0),0),budget=Number(t.budget||0),pct=budget>0?Math.min(100,Math.round(total/budget*100)):0;
 $("#budget-content").innerHTML='<div class="budget-top"><div><div class="budget-spent">'+money(total,t.currency)+'</div><div class="budget-cap">Dépensé'+(budget>0?" sur "+money(budget,t.currency):"")+'</div></div><div class="budget-cap">'+(budget>0?pct+" % du budget":"Budget non défini")+'</div></div><div class="budget-track"><div class="budget-fill" style="width:'+pct+'%"></div></div><div class="expense-list">'+((t.expenses||[]).slice(-4).reverse().map(x=>'<div class="expense-row"><span>'+esc(x.label)+' <small>'+esc(x.category||"Divers")+'</small></span><strong>'+money(x.amount,t.currency)+'</strong></div>').join("")||'<div class="empty-inline">Aucune dépense enregistrée.</div>')+'</div>';
}
function renderChecklist(t){
 const list=t.checklist||[],done=list.filter(x=>x.done).length;$("#check-progress").textContent=done+" / "+list.length;
 $("#checklist-content").innerHTML=list.map(x=>'<label class="check-row '+(x.done?"done":"")+'"><input type="checkbox" data-action="toggle-check" data-id="'+esc(x.id)+'" '+(x.done?"checked":"")+'><span>'+esc(x.label)+'</span></label>').join("")||'<div class="empty-inline">Aucune tâche.</div>';
}
function renderMap(t){
 if(!window.L){const node=$("#map");if(navigator.onLine&&mapLibraryRetryCount<12){mapLibraryRetryCount++;setTimeout(()=>{if(activeTrip()?.id===t.id)renderMap(t)},300);return}if(node)node.innerHTML='<div class="offline-map-note">La carte nécessite le chargement de Leaflet et des tuiles cartographiques. Les adresses et les étapes restent accessibles hors connexion.</div>';return}
 mapLibraryRetryCount=0;
 const center=t.geo?[t.geo.lat,t.geo.lon]:[20,0];
 if(!map){map=L.map("map",{scrollWheelZoom:false}).setView(center,t.geo?12:2);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);markers=L.layerGroup().addTo(map)}
 if(mapTripId!==t.id){mapTripId=t.id;map.setView(center,t.geo?12:2)}markers.clearLayers();
 if(t.geo){const icon=L.divIcon({className:"",html:'<div class="jalap-map-pin destination"><span>✦</span></div>',iconSize:[28,28],iconAnchor:[13,26]});L.marker(center,{icon}).addTo(markers).bindPopup("<strong>"+esc(t.destination)+"</strong><br>Destination")}
 if(t.accommodation&&t.accommodation.geo){const g=t.accommodation.geo,icon=L.divIcon({className:"",html:'<div class="jalap-map-pin" style="background:#b4d58a"><span>⌂</span></div>',iconSize:[28,28],iconAnchor:[13,26]});L.marker([g.lat,g.lon],{icon}).addTo(markers).bindPopup("<strong>"+esc(t.accommodation.name)+"</strong><br>Hébergement")}
 const points=[];(t.activities||[]).forEach((a,i)=>{if(!a.geo)return;const p=[a.geo.lat,a.geo.lon];points.push(p);const icon=L.divIcon({className:"",html:'<div class="jalap-map-pin"><span>'+(i+1)+'</span></div>',iconSize:[28,28],iconAnchor:[13,26]});L.marker(p,{icon}).addTo(markers).bindPopup("<strong>"+esc(a.name)+"</strong><br>"+esc(a.date?dateLabel(a.date):"Date à définir"))});
 if(points.length>1)L.polyline(points,{color:"#ed78c5",weight:2,opacity:.62,dashArray:"5 7"}).addTo(markers);
 setTimeout(()=>map.invalidateSize(),100);
}
function fitMap(){if(!map)return;const layers=markers?markers.getLayers():[];if(layers.length>1)map.fitBounds(L.featureGroup(layers).getBounds().pad(.18),{maxZoom:14});else if(activeTrip()&&activeTrip().geo)map.setView([activeTrip().geo.lat,activeTrip().geo.lon],13)}
async function geocode(query){if(!query)return null;const r=await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q="+encodeURIComponent(query),{headers:{"Accept-Language":"fr"}});if(!r.ok)throw new Error("Géolocalisation indisponible");const rows=await r.json();if(!rows.length)return null;return{lat:Number(rows[0].lat),lon:Number(rows[0].lon),label:rows[0].display_name}}
async function fetchDestination(t){const id=t.id,q=t.destination;try{const g=await geocode(q);if(activeTrip()&&activeTrip().id===id&&g){t.geo=g;save();renderMap(t);fetchWeather(t)}}catch(e){if(activeTrip()&&activeTrip().id===id)renderMap(t)}}
async function geocodeStay(){const t=activeTrip(),s=t&&t.accommodation;if(!t||!s||!s.address)return;try{const g=await geocode(s.address);if(g&&activeTrip()&&activeTrip().id===t.id){s.geo=g;save();renderMap(t)}}catch(e){}}
const weatherText=c=>({0:"Ciel dégagé",1:"Plutôt dégagé",2:"Partiellement nuageux",3:"Couvert",45:"Brouillard",48:"Brouillard givrant",51:"Bruine légère",53:"Bruine",55:"Bruine dense",61:"Pluie faible",63:"Pluie",65:"Forte pluie",71:"Neige faible",73:"Neige",75:"Forte neige",80:"Averses",81:"Averses",82:"Fortes averses",95:"Orage",96:"Orage et grêle",99:"Orage violent"}[c]||"Conditions variables");
const weatherIcon=c=>c===0?"☀":c<=3?"⛅":c<=48?"☁":c<=67?"🌧":c<=77?"❄":c<=82?"🌦":"⛈";
async function fetchWeather(t){
 if(!t||!t.geo)return;
 const id=++weatherRequest,key="pepper-weather-v1:"+t.id;
 weatherData=null;weatherError="";
 const cached=parse(localStorage.getItem(key),null);
 if(!navigator.onLine){
  if(cached)weatherData={tripId:t.id,data:cached.data,fetchedAt:cached.fetchedAt,stale:true};
  else weatherError="Météo indisponible hors connexion.";
  renderWeather();return;
 }
 if(cached)weatherData={tripId:t.id,data:cached.data,fetchedAt:cached.fetchedAt,stale:true};
 renderWeather();
 try{
  const url="https://api.open-meteo.com/v1/forecast?latitude="+t.geo.lat+"&longitude="+t.geo.lon+"&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=5&timezone=auto";
  const response=await fetch(url,{signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error("Prévisions indisponibles");
  const data=await response.json();
  if(id!==weatherRequest)return;
  const stored={data,fetchedAt:new Date().toISOString()};
  try{localStorage.setItem(key,JSON.stringify(stored))}catch(e){}
  weatherData={tripId:t.id,data,fetchedAt:stored.fetchedAt,stale:false};weatherError="";
  renderWeather();
 }catch(error){
  if(id!==weatherRequest)return;
  if(cached){weatherData={tripId:t.id,data:cached.data,fetchedAt:cached.fetchedAt,stale:true};weatherError="Connexion météo indisponible. Affichage de la dernière prévision enregistrée."}
  else weatherError="La météo n’est pas disponible.";
  renderWeather();
 }
}
function renderWeather(){const n=$("#weather-content");if(!weatherData){n.textContent=weatherError||"Recherche de la météo…";return}const c=weatherData.data.current,d=weatherData.data.daily,stamp=weatherData.fetchedAt?new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(weatherData.fetchedAt)):"heure inconnue";n.innerHTML='<div class="weather-temp">'+Math.round(c.temperature_2m)+'°</div><div class="weather-copy"><strong>'+weatherIcon(c.weather_code)+' '+weatherText(c.weather_code)+'</strong><small>Ressenti '+Math.round(c.apparent_temperature)+'° · Vent '+Math.round(c.wind_speed_10m)+' km/h</small><small>Humidité '+c.relative_humidity_2m+' %</small><small>'+(weatherData.stale?"Dernière donnée connue : ":"Actualisée : ")+esc(stamp)+'</small>'+(weatherError?'<small>'+esc(weatherError)+'</small>':"")+'</div><div class="weather-days">'+d.time.map((x,i)=>'<div class="weather-day"><span>'+["Auj.","Dem.","J+2","J+3","J+4"][i]+'</span><strong>'+weatherIcon(d.weather_code[i])+'</strong><span>'+Math.round(d.temperature_2m_min[i])+'° / '+Math.round(d.temperature_2m_max[i])+'°</span></div>').join("")+'</div>'}
function openModal(title,subtitle,body){modalRoot.innerHTML='<div class="modal-overlay" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" aria-label="'+esc(title)+'"><div class="modal-head"><div><h2>'+esc(title)+'</h2><p>'+esc(subtitle||"")+'</p></div><button class="modal-close" type="button" data-action="close-modal">×</button></div>'+body+'</section></div>';const first=$("input,textarea,select,button",modalRoot);if(first)first.focus({preventScroll:true})}
function closeModal(){modalRoot.innerHTML=""}
function tripForm(t){
 const x=t||{},network=suggestedLocalNetwork(x.destination),body='<form id="trip-form"><input type="hidden" name="id" value="'+esc(x.id||"")+'"><div class="form-grid"><div class="field full"><label>DESTINATION</label><input name="destination" required placeholder="Ex. : Athènes, Grèce" value="'+esc(x.destination||"")+'"></div><div class="field"><label>DATE DE DÉPART</label><input type="date" name="startDate" value="'+esc(x.startDate||today())+'"></div><div class="field"><label>DATE DE RETOUR</label><input type="date" name="endDate" value="'+esc(x.endDate||"")+'"></div><div class="field"><label>VOYAGEURS</label><input type="number" min="1" max="30" name="people" value="'+esc(x.people||1)+'"></div><div class="field"><label>BUDGET TOTAL</label><input type="number" min="0" step="10" name="budget" value="'+esc(x.budget||"")+'"></div><div class="field"><label>DEVISE</label><select name="currency">'+["EUR","USD","GBP","JPY","CHF","CAD","MAD","THB"].map(c=>'<option '+((x.currency||"EUR")===c?"selected":"")+'>'+c+'</option>').join("")+'</select></div><div class="field full"><label>RÉSEAU DE TRANSPORT OFFICIEL SUR PLACE</label><input name="localTransitName" value="'+esc(x.localTransitName||"")+'" placeholder="Ex. : OASA, TBM, TCL…"></div><div class="field full"><label>LIEN DU SITE / DE L’APPLICATION OFFICIELLE</label><input type="url" name="localTransitUrl" value="'+esc(x.localTransitUrl||network?.url||"")+'" placeholder="https://…"></div><div class="field full"><label>LIEN INFO TRAFIC OFFICIELLE (FACULTATIF)</label><input type="url" name="localTrafficUrl" value="'+esc(x.localTrafficUrl||"")+'" placeholder="https://…"></div><div class="field full"><label>RÉFÉRENCE D’ARRÊT IDFM (OPTIONNELLE)</label><input name="localTransitRef" value="'+esc(x.localTransitRef||"")+'" placeholder="MonitoringRef SIRI, ex. STIF:StopPoint:..."><span class="field-help">Uniquement pour un arrêt référencé par Île-de-France Mobilités / PRIM. Sa disponibilité temps réel dépend du périmètre publié.</span></div><div class="field full"><label>NOTES GÉNÉRALES</label><textarea name="notes">'+esc(x.notes||"")+'</textarea></div></div><div class="modal-actions"><button class="secondary-button" type="button" data-action="close-modal">Annuler</button><button class="primary-button" type="submit">Enregistrer</button></div></form>';
 openModal(t?"Modifier le voyage":"Créer un voyage","Les premières informations de ton carnet.",body);
}
function stayForm(){
 const t=activeTrip();if(!t){toast("Crée d’abord un voyage.","error");return}const s=t.accommodation||{};
 const body='<form id="stay-form"><div class="form-grid"><div class="field full"><label>NOM DU LOGEMENT</label><input name="name" required value="'+esc(s.name||"")+'" placeholder="Hôtel, appartement, maison…"></div><div class="field"><label>TYPE</label><select name="type">'+["Hôtel","Appartement","Location","Auberge","Chez des proches","Autre"].map(v=>'<option '+((s.type||"Hôtel")===v?"selected":"")+'>'+v+'</option>').join("")+'</select></div><div class="field"><label>STATUT</label><select name="status">'+["Réservé","À confirmer","Non réservé"].map(v=>'<option '+((s.status||"À confirmer")===v?"selected":"")+'>'+v+'</option>').join("")+'</select></div><div class="field full"><label>ADRESSE COMPLÈTE</label><input name="address" value="'+esc(s.address||"")+'" placeholder="Adresse, ville, pays"></div><div class="field"><label>DATE D’ARRIVÉE</label><input type="date" name="checkInDate" value="'+esc(s.checkInDate||t.startDate||"")+'"></div><div class="field"><label>HEURE DE CHECK-IN</label><input type="time" name="checkInTime" value="'+esc(s.checkInTime||"")+'"></div><div class="field"><label>DATE DE DÉPART</label><input type="date" name="checkOutDate" value="'+esc(s.checkOutDate||t.endDate||"")+'"></div><div class="field"><label>HEURE DE CHECK-OUT</label><input type="time" name="checkOutTime" value="'+esc(s.checkOutTime||"")+'"></div><div class="field"><label>CONTACT / RÉCEPTION</label><input name="contact" value="'+esc(s.contact||"")+'"></div><div class="field"><label>TÉLÉPHONE</label><input name="phone" value="'+esc(s.phone||"")+'"></div><div class="field"><label>PARKING</label><input name="parking" value="'+esc(s.parking||"")+'" placeholder="Inclus, payant, rue…"></div><div class="field"><label>PETIT-DÉJEUNER</label><input name="breakfast" value="'+esc(s.breakfast||"")+'" placeholder="Inclus, horaires…"></div><div class="field full"><label>ÉQUIPEMENTS / SERVICES</label><input name="amenities" value="'+esc(s.amenities||"")+'" placeholder="Wi-Fi, climatisation, cuisine, ascenseur…"></div><div class="field full"><label>ACCÈS / ARRIVÉE</label><textarea name="access">'+esc(s.access||"")+'</textarea></div><div class="field full"><label>CONSIGNES / NOTES</label><textarea name="notes">'+esc(s.notes||"")+'</textarea></div><div class="field full"><label>LIEN DE RÉSERVATION</label><input type="url" name="bookingUrl" value="'+esc(s.bookingUrl||"")+'" placeholder="https://…"></div><div class="field full"><label>CODE DE RÉSERVATION (LOCAL UNIQUEMENT)</label><input name="bookingCode" autocomplete="off" value="'+esc(s.bookingCode||"")+'"><span class="field-help">Reste sur cet appareil. Ne le partage pas dans un dépôt GitHub public.</span></div></div><div class="modal-actions"><button class="secondary-button" type="button" data-action="close-modal">Annuler</button><button class="primary-button" type="submit">Enregistrer le logement</button></div></form>';
 openModal("Ton hébergement","Toutes les informations pratiques de ton lieu de séjour.",body);
}
function transportForm(existing){
 const t=activeTrip(),x=existing||{};
 const body='<form id="transport-form"><input type="hidden" name="id" value="'+esc(x.id||"")+'"><div class="form-grid"><div class="field"><label>SENS DU TRAJET</label><select name="direction">'+[["outbound","Aller"],["return","Retour"],["connection","Correspondance"],["other","Autre étape"]].map(v=>'<option value="'+v[0]+'" '+((x.direction||"outbound")===v[0]?"selected":"")+'>'+v[1]+'</option>').join("")+'</select></div><div class="field"><label>MODE</label><select name="mode">'+[["train","Train"],["plane","Avion"],["car","Voiture"],["bus","Bus"],["ferry","Ferry"]].map(v=>'<option value="'+v[0]+'" '+((x.mode||"train")===v[0]?"selected":"")+'>'+v[1]+'</option>').join("")+'</select></div><div class="field full"><label>COMPAGNIE / TRANSPORTEUR</label><input name="operator" value="'+esc(x.operator||"")+'" placeholder="SNCF TGV INOUI, OUIGO, Air France…"></div><div class="field"><label>LIGNE / VOL / SERVICE</label><input name="service" value="'+esc(x.service||"")+'"></div><div class="field"><label>NUMÉRO DE TRAIN / VOL</label><input name="number" value="'+esc(x.number||"")+'"></div><div class="field full"><label>GARE / AÉROPORT / ADRESSE DE DÉPART</label><input name="origin" required value="'+esc(x.origin||"")+'"></div><div class="field full"><label>GARE / AÉROPORT / ADRESSE D’ARRIVÉE</label><input name="destination" required value="'+esc(x.destination||t.destination||"")+'"></div><div class="field"><label>DATE DE DÉPART</label><input type="date" name="departureDate" value="'+esc(x.departureDate||t.startDate||"")+'"></div><div class="field"><label>HEURE DE DÉPART</label><input type="time" name="departureTime" value="'+esc(x.departureTime||"")+'"></div><div class="field"><label>DATE D’ARRIVÉE</label><input type="date" name="arrivalDate" value="'+esc(x.arrivalDate||"")+'"></div><div class="field"><label>HEURE D’ARRIVÉE</label><input type="time" name="arrivalTime" value="'+esc(x.arrivalTime||"")+'"></div><div class="field"><label>VOIE / QUAI / TERMINAL</label><input name="platform" value="'+esc(x.platform||"")+'"></div><div class="field"><label>BAGAGES / DIMENSIONS</label><input name="baggage" value="'+esc(x.baggage||"")+'" placeholder="Cabine, soute, poids…"></div><div class="field"><label>TYPE DE VOL (AIR FRANCE)</label><select name="routeType"><option value="unknown">À préciser</option><option value="domestic" '+(x.routeType==="domestic"?"selected":"")+'>France</option><option value="europe" '+(x.routeType==="europe"?"selected":"")+'>Europe</option><option value="international" '+(x.routeType==="international"?"selected":"")+'>International</option></select></div><div class="field"><label>MARGE D’ARRIVÉE (MIN)</label><input type="number" name="arrivalBufferMinutes" min="0" step="5" value="'+esc(x.arrivalBufferMinutes==null?"":x.arrivalBufferMinutes)+'" placeholder="Auto selon compagnie"></div><div class="field"><label>DURÉE DE CONDUITE (MIN)</label><input type="number" name="drivingDurationMinutes" min="0" step="15" value="'+esc(x.drivingDurationMinutes||"")+'" placeholder="Si voiture"></div><div class="field"><label>PAUSES PRÉVUES</label><input name="plannedStops" value="'+esc(x.plannedStops||"")+'"></div><div class="field full"><label>HEURE LIMITE / FIN D’EMBARQUEMENT</label><input name="boardingDeadline" value="'+esc(x.boardingDeadline||"")+'" placeholder="Ex. : embarquement clos à 08:40"></div><div class="field full"><label>LIEN DU BILLET / DU TRANSPORTEUR</label><input type="url" name="ticketUrl" value="'+esc(x.ticketUrl||"")+'" placeholder="Lien officiel ou espace de réservation"></div><div class="field full"><label>LIEN OFFICIEL DE SUIVI / INFO TRAFIC (FACULTATIF)</label><input type="url" name="trafficUrl" value="'+esc(x.trafficUrl||"")+'" placeholder="https://…"></div><div class="field full"><label>CODE DE RÉSERVATION (LOCAL UNIQUEMENT)</label><input name="bookingRef" autocomplete="off" value="'+esc(x.bookingRef||"")+'"><span class="field-help">Ne copie pas le code, le QR code ou le billet complet dans GitHub public.</span></div><div class="field full"><label>CONSIGNES / CORRESPONDANCE / NOTES</label><textarea name="notes">'+esc(x.notes||"")+'</textarea></div></div><div class="arrival-helper">PEPPER propose une marge uniquement lorsqu’une règle liée au transporteur est identifiable. Le billet et les consignes de la gare / de l’aéroport priment toujours.</div><div class="modal-actions"><button class="secondary-button" type="button" data-action="close-modal">Annuler</button><button class="primary-button" type="submit">Enregistrer le trajet</button></div></form>';
 openModal(existing?"Modifier le trajet":"Ajouter un trajet","Renseigne les informations visibles sur ton billet ou ton itinéraire.",body);
}
function activityForm(existing){
 const t=activeTrip();if(!t){toast("Crée d’abord un voyage.","error");return}
 const x=existing||{},bookingState=x.bookingStatus||(x.bookingRequired?"to_book":"unknown");
 const body='<form id="activity-form"><input type="hidden" name="id" value="'+esc(x.id||"")+'"><div class="form-grid"><div class="field full"><label>NOM DU LIEU / ACTIVITÉ</label><input name="name" required placeholder="Musée, restaurant, balade…" value="'+esc(x.name||"")+'"></div><div class="field"><label>CATÉGORIE</label><select name="category">'+["Culture","Architecture","Nature","Restaurant","Sortie","Shopping","Transport","Autre"].map(v=>'<option '+((x.category||"Autre")===v?"selected":"")+'>'+v+'</option>').join("")+'</select></div><div class="field"><label>DATE (FACULTATIVE)</label><input type="date" name="date" min="'+esc(t.startDate||"")+'" max="'+esc(t.endDate||"")+'" value="'+esc(x.date||"")+'"><span class="field-help">Laisse vide pour garder cette activité dans « À planifier ». Aucune date ne sera ajoutée automatiquement.</span></div><div class="field"><label>HEURE</label><input type="time" name="startTime" value="'+esc(x.startTime||"")+'"></div><div class="field"><label>DURÉE (MIN)</label><input type="number" name="duration" min="15" step="15" placeholder="90" value="'+esc(x.duration||"")+'"></div><div class="field full"><label>ADRESSE / QUARTIER</label><input name="address" value="'+esc(x.address||"")+'"></div><div class="field"><label>PRIX ESTIMÉ</label><input type="number" name="price" min="0" step="0.5" value="'+esc(x.price==null?"":x.price)+'"></div><div class="field"><label>STATUT DE RÉSERVATION</label><select name="bookingStatus">'+[["unknown","À vérifier / non décidé"],["to_book","À réserver"],["booked","Réservée"],["not_required","Pas de réservation nécessaire"]].map(v=>'<option value="'+v[0]+'" '+(bookingState===v[0]?"selected":"")+'>'+v[1]+'</option>').join("")+'</select><span class="field-help">Le statut de réservation ne fixe pas automatiquement la date.</span></div><div class="field"><label>PRIORITÉ</label><select name="priority">'+[["must","Incontournable"],["medium","Intéressante"],["low","Optionnelle"]].map(v=>'<option value="'+v[0]+'" '+((x.priority||"medium")===v[0]?"selected":"")+'>'+v[1]+'</option>').join("")+'</select></div><div class="field full"><label>LIEN OFFICIEL / RÉSERVATION</label><input type="url" name="bookingUrl" placeholder="https://…" value="'+esc(x.bookingUrl||"")+'"></div><div class="field full"><label>DESCRIPTION / POINTS À RETENIR</label><textarea name="description">'+esc(x.description||"")+'</textarea></div><div class="field full"><label>POINTS CLÉS (UN PAR LIGNE)</label><textarea name="highlights">'+esc((x.highlights||[]).join("\n"))+'</textarea></div></div><div class="modal-actions"><button class="secondary-button" type="button" data-action="close-modal">Annuler</button><button class="primary-button" type="submit">'+(existing?"Enregistrer les modifications":"Ajouter au programme")+'</button></div></form>';
 openModal(existing?"Modifier une activité":"Ajouter une activité",existing?"Modifie les informations ou attribue une date quand tu es prêt.":"Tu peux laisser la date vide : l'activité restera dans la liste à planifier.",body);
}
function expenseForm(){openModal("Ajouter une dépense","Garde une vision simple du budget.",'<form id="expense-form"><div class="form-grid"><div class="field full"><label>LIBELLÉ</label><input name="label" required></div><div class="field"><label>MONTANT</label><input type="number" name="amount" min="0" step="0.01" required></div><div class="field"><label>CATÉGORIE</label><select name="category">'+["Repas","Transport","Hébergement","Visite","Shopping","Divers"].map(v=>'<option>'+v+'</option>').join("")+'</select></div></div><div class="modal-actions"><button class="secondary-button" type="button" data-action="close-modal">Annuler</button><button class="primary-button" type="submit">Ajouter la dépense</button></div></form>')}
function safeBookingUrl(value){
 try{const url=new URL(String(value||""));return ["https:","http:"].includes(url.protocol)?url.href:""}catch(error){return ""}
}
function detailModal(id){
 const t=activeTrip(),a=t.activities.find(x=>x.id===id);if(!a)return;
 const bullets=(a.highlights||[]).map(x=>"<li>"+esc(x)+"</li>").join(""),sources=(a.sources||[]).filter(x=>x.url).map(x=>'<li><a href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer">'+esc(x.title||x.url)+' ↗</a></li>').join(""),bookingState=a.bookingStatus||(a.bookingRequired?"to_book":"unknown"),bookingLabel=bookingState==="booked"?"Réservation confirmée":bookingState==="to_book"?"À réserver":bookingState==="not_required"?"Pas de réservation nécessaire":"À vérifier",bookingUrl=safeBookingUrl(a.bookingUrl);
 const bookingAction=bookingUrl?'<a class="booking-open-link" href="'+esc(bookingUrl)+'" target="_blank" rel="noopener noreferrer">'+bookingLinkLabel+'</a>':'<button class="secondary-button" type="button" data-action="edit-activity" data-id="'+esc(a.id)+'">Ajouter le lien de réservation</button>';
 const bookingLinkLabel=bookingState==="booked"?"Consulter / gérer la réservation ↗":"Ouvrir le site pour réserver ↗";
 const reservationConfirm=bookingState==="booked"?'<div class="booking-confirmed"><span>✓</span> Réservation confirmée dans PEPPER</div>':bookingState==="not_required"?'<div class="booking-confirmed">Aucune réservation nécessaire</div>':'<button class="booking-confirm-button" type="button" data-action="mark-activity-booked" data-id="'+esc(a.id)+'">J’ai terminé la réservation</button>';
 openModal("Détail de l’étape","Fiche pratique, durée, budget et réservation.",'<div class="detail-hero"><h3>'+esc(a.name)+'</h3><p>'+esc(a.description||"Aucune description disponible.")+'</p></div><div class="detail-grid"><div class="detail-item"><small>Date / heure</small><strong>'+esc(a.date?dateLabel(a.date):"À planifier")+' · '+esc(a.startTime||"Libre")+'</strong></div><div class="detail-item"><small>Durée</small><strong>'+esc(a.duration?a.duration+" min":"À confirmer")+'</strong></div><div class="detail-item"><small>Budget</small><strong>'+esc(a.price!=null?money(a.price,t.currency):"À confirmer")+'</strong></div><div class="detail-item"><small>Priorité</small><strong>'+esc(a.priority==="must"?"Incontournable":a.priority==="low"?"Optionnel":"À évaluer")+'</strong></div><div class="detail-item"><small>Réservation</small><strong>'+esc(bookingLabel)+'</strong></div><div class="detail-item"><small>Avancement</small><strong>'+(a.done?"Faite ✓":"À faire")+'</strong></div></div><div class="booking-actions">'+bookingAction+reservationConfirm+'</div><p class="booking-note">La réservation se finalise sur le site du prestataire. PEPPER ne collecte pas le paiement : reviens ici après confirmation pour mettre le statut à jour.</p>'+(bullets?'<div class="detail-section"><h4>À retenir</h4><ul>'+bullets+'</ul></div>':"")+(sources?'<div class="detail-section"><h4>Sources consultées</h4><ul>'+sources+'</ul></div>':"")+'<div class="detail-section"><h4>Localisation</h4><p>'+esc(a.address||"Adresse à préciser")+'</p><a class="text-button" href="https://www.google.com/maps/search/?api=1&query='+encodeURIComponent((a.address||a.name)+" "+t.destination)+'" target="_blank" rel="noopener noreferrer">Ouvrir dans Maps ↗</a></div><div class="modal-actions"><button class="secondary-button" type="button" data-action="delete-activity" data-id="'+esc(a.id)+'">Supprimer</button><button class="secondary-button" type="button" data-action="edit-activity" data-id="'+esc(a.id)+'">Modifier</button><button class="primary-button" type="button" data-action="close-modal">Terminé</button></div>');
}

function saveTripForm(form){
 const d=Object.fromEntries(new FormData(form).entries());if(d.startDate&&d.endDate&&d.endDate<d.startDate){toast("La date de retour doit suivre celle de départ.","error");return}
 let t=state.trips.find(x=>x.id===d.id);if(!t){t={id:uid(),activities:[],transport:[],expenses:[],checklist:DEFAULT_CHECKLIST.map(label=>({id:uid(),label,done:false})),accommodation:null,createdAt:new Date().toISOString()};state.trips.push(t)}
 Object.assign(t,{destination:d.destination.trim(),startDate:d.startDate,endDate:d.endDate,people:Number(d.people||1),budget:Number(d.budget||0),currency:d.currency||"EUR",localTransitName:d.localTransitName||"",localTransitUrl:d.localTransitUrl||"",localTrafficUrl:d.localTrafficUrl||"",localTransitRef:d.localTransitRef||"",notes:d.notes||""});
 state.activeTripId=t.id;weatherData=null;save();closeModal();render();toast("Voyage enregistré sur cet appareil.");
}
function saveStay(form){
 const d=Object.fromEntries(new FormData(form).entries()),t=activeTrip(),old=t.accommodation||{};
 t.accommodation={id:old.id||uid(),name:d.name.trim(),type:d.type,status:d.status,address:d.address,checkInDate:d.checkInDate,checkInTime:d.checkInTime,checkOutDate:d.checkOutDate,checkOutTime:d.checkOutTime,contact:d.contact,phone:d.phone,parking:d.parking,breakfast:d.breakfast,amenities:d.amenities,access:d.access,notes:d.notes,bookingUrl:d.bookingUrl,bookingCode:d.bookingCode};
 save();closeModal();render();geocodeStay();toast("Les informations du logement sont enregistrées localement.");
}
function saveLeg(form){
 const d=Object.fromEntries(new FormData(form).entries()),t=activeTrip();if(d.departureDate&&d.arrivalDate&&d.arrivalDate<d.departureDate){toast("L’arrivée ne peut pas précéder le départ.","error");return}
 let x=t.transport.find(a=>a.id===d.id);if(!x){x={id:uid()};t.transport.push(x)}
 Object.assign(x,{direction:d.direction,mode:d.mode,operator:d.operator,service:d.service,number:d.number,origin:d.origin,destination:d.destination,departureDate:d.departureDate,departureTime:d.departureTime,arrivalDate:d.arrivalDate,arrivalTime:d.arrivalTime,platform:d.platform,baggage:d.baggage,routeType:d.routeType,arrivalBufferMinutes:d.arrivalBufferMinutes===""?null:Number(d.arrivalBufferMinutes),drivingDurationMinutes:d.drivingDurationMinutes===""?null:Number(d.drivingDurationMinutes),plannedStops:d.plannedStops,boardingDeadline:d.boardingDeadline,ticketUrl:d.ticketUrl,trafficUrl:d.trafficUrl,bookingRef:d.bookingRef,notes:d.notes});
 save();closeModal();render();toast("Trajet enregistré. Vérifie la marge et les alertes de cohérence.");
}
async function addActivity(form){
 const d=Object.fromEntries(new FormData(form).entries()),t=activeTrip(),existing=t.activities.find(x=>x.id===d.id),bookingStatus=d.bookingStatus||"unknown";
 const a=existing||{id:uid(),done:false,status:"À organiser",createdAt:new Date().toISOString()};
 Object.assign(a,{name:d.name.trim(),category:d.category,date:d.date||"",startTime:d.date?(d.startTime||""):"",duration:d.duration?Number(d.duration):null,address:d.address,description:d.description,price:d.price===""?null:Number(d.price),bookingStatus,bookingRequired:bookingStatus==="to_book"||bookingStatus==="booked",priority:d.priority||"medium",bookingUrl:d.bookingUrl||"",highlights:(d.highlights||"").split("\n").map(x=>x.trim()).filter(Boolean)});
 if(!existing)t.activities.push(a);
 save();closeModal();render();toast(existing?"Activité modifiée.":"Activité ajoutée au programme.");
 if(a.address&&!a.geo)try{const g=await geocode(a.address+", "+t.destination);if(g){a.geo=g;save();renderMap(t);renderActivities(t)}}catch(e){}
}
function addExpense(form){const d=Object.fromEntries(new FormData(form).entries()),t=activeTrip();t.expenses.push({id:uid(),label:d.label.trim(),amount:Number(d.amount),category:d.category,date:today()});save();closeModal();renderBudget(t);toast("Dépense ajoutée.")}
function deleteActivity(id){const t=activeTrip();t.activities=t.activities.filter(a=>a.id!==id);save();closeModal();render();toast("Activité supprimée.")}
function deleteTransport(id){const t=activeTrip();t.transport=t.transport.filter(a=>a.id!==id);save();render();toast("Trajet supprimé.")}
function markActivity(event){
 const t=activeTrip(),a=t&&t.activities.find(x=>x.id===event.target.dataset.id);if(!a)return;a.done=event.target.checked;a.completedAt=a.done?new Date().toISOString():null;save();renderActivities(t);toast(a.done?"Activité cochée comme faite. Sauvegardée sur cet appareil.":"Activité remise dans les étapes à faire.");
}
function markChecklist(event){const t=activeTrip(),item=t&&t.checklist.find(x=>x.id===event.target.dataset.id);if(!item)return;item.done=event.target.checked;save();renderChecklist(t)}
function addChecklist(){const label=prompt("Quelle tâche veux-tu ajouter à ta checklist ?");if(!label||!label.trim())return;const t=activeTrip();t.checklist.push({id:uid(),label:label.trim(),done:false});save();renderChecklist(t)}
function slug(v){return String(v||"voyage").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"voyage"}
function download(content,name,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)}
function exportJSON(){const t=activeTrip();if(!t)return;const backup={format:"pepper-backup",version:1,exportedAt:new Date().toISOString(),activeTripId:state.activeTripId,trips:state.trips};download(JSON.stringify(backup,null,2),"pepper-sauvegarde-"+today()+".json","application/json")}

function importModal(){
 const body='<form id="import-form"><div class="field full"><label>FICHIER DE SAUVEGARDE JSON</label><input type="file" name="backupFile" accept=".json,application/json" required><span class="field-help">Une sauvegarde PEPPER ou un ancien export de voyage est accepté (10 Mo maximum).</span></div><div class="field full"><label>MODE D’IMPORTATION</label><select name="strategy"><option value="merge">Fusionner avec mes voyages actuels</option><option value="replace">Remplacer tous les voyages de cet appareil</option></select></div><div class="arrival-helper">L’import peut contenir des codes de réservation ou des informations privées. Le fichier est lu localement et n’est pas envoyé à GitHub.</div><div class="modal-actions"><button class="secondary-button" type="button" data-action="close-modal">Annuler</button><button class="primary-button" type="submit">Importer</button></div></form>';
 openModal("Importer une sauvegarde","Restaure un voyage ou un carnet complet sur cet appareil.",body);
}
async function importBackup(form){
 const file=form.elements.backupFile.files?.[0];if(!file){toast("Choisis un fichier JSON.","error");return}
 if(file.size>10*1024*1024){toast("Le fichier dépasse la limite de 10 Mo.","error");return}
 try{
  const parsed=JSON.parse(await file.text());
  let incoming=Array.isArray(parsed.trips)?parsed.trips:(parsed.trip?[parsed.trip]:(parsed.destination?[parsed]:[]));
  if(!incoming.length||incoming.some(t=>!t||typeof t!=="object"||!String(t.destination||"").trim()))throw new Error("Ce fichier ne contient pas de voyage PEPPER valide.");
  incoming=incoming.map(t=>{
   const item=JSON.parse(JSON.stringify(t));
   item.id=item.id||uid();item.activities=Array.isArray(item.activities)?item.activities:[];
   item.transport=Array.isArray(item.transport)?item.transport:[];item.expenses=Array.isArray(item.expenses)?item.expenses:[];
   item.checklist=Array.isArray(item.checklist)?item.checklist:DEFAULT_CHECKLIST.map(label=>({id:uid(),label,done:false}));
   return item;
  });
  const strategy=form.elements.strategy.value;
  if(strategy==="replace"){
   state.trips=incoming;state.activeTripId=incoming.some(t=>t.id===parsed.activeTripId)?parsed.activeTripId:incoming[0].id;
  }else{
   let added=0;
   for(const trip of incoming){
    if(state.trips.some(existing=>existing.id===trip.id||(
      existing.destination===trip.destination&&existing.startDate===trip.startDate&&existing.endDate===trip.endDate
    )))continue;
    state.trips.push(trip);added++;
   }
   if(!activeTrip()&&state.trips.length)state.activeTripId=state.trips[0].id;
   if(!added){toast("Aucun nouveau voyage : ces données semblent déjà présentes.");closeModal();return}
  }
  weatherData=null;weatherError="";save();closeModal();render();
  toast(strategy==="replace"?"Sauvegarde restaurée.":" "+incoming.length+" voyage(s) analysé(s), fusion effectuée.");
 }catch(error){toast(error.message||"Fichier JSON invalide.","error")}
}

function exportICS(){
 const t=activeTrip();if(!t)return;const pad=n=>String(n).padStart(2,"0"),stamp=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
 const events=t.activities.filter(a=>a.date).map(a=>{
  const start=a.date.replace(/-/g,"")+"T"+(a.startTime?a.startTime.replace(":",""):"0900")+"00",endD=new Date(a.date+"T"+(a.startTime||"09:00")+":00");endD.setMinutes(endD.getMinutes()+Number(a.duration||60));
  const end=endD.getFullYear()+pad(endD.getMonth()+1)+pad(endD.getDate())+"T"+pad(endD.getHours())+pad(endD.getMinutes())+"00",clean=v=>String(v||"").replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\n/g,"\\n");
  return"BEGIN:VEVENT\r\nUID:"+a.id+"@pepper\r\nDTSTAMP:"+stamp+"\r\nDTSTART:"+start+"\r\nDTEND:"+end+"\r\nSUMMARY:"+clean(a.name)+"\r\nLOCATION:"+clean(a.address||t.destination)+"\r\nDESCRIPTION:"+clean(a.description)+"\r\nEND:VEVENT";
 }).join("\r\n");download("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//PEPPER//Travel Companion//FR\r\nCALSCALE:GREGORIAN\r\n"+events+"\r\nEND:VCALENDAR",slug(t.destination)+"-pepper.ics","text/calendar;charset=utf-8");
}
function shareContext(t){
 return{
  destination:t.destination,dates:{start:t.startDate,end:t.endDate},travellers:t.people,budget:t.budget,currency:t.currency,localTransport:{name:t.localTransitName||"",officialUrl:t.localTransitUrl||"",trafficUrl:t.localTrafficUrl||"",monitoringRef:t.localTransitRef||""},
  accommodation:t.accommodation?{name:t.accommodation.name,type:t.accommodation.type,address:t.accommodation.address,checkInDate:t.accommodation.checkInDate,checkInTime:t.accommodation.checkInTime,checkOutDate:t.accommodation.checkOutDate,checkOutTime:t.accommodation.checkOutTime,amenities:t.accommodation.amenities,parking:t.accommodation.parking,breakfast:t.accommodation.breakfast}:null,
  transport:t.transport.map(x=>({id:x.id,direction:x.direction,mode:x.mode,operator:x.operator,service:x.service,number:x.number,origin:x.origin,destination:x.destination,departureDate:x.departureDate,departureTime:x.departureTime,arrivalDate:x.arrivalDate,arrivalTime:x.arrivalTime,platform:x.platform,baggage:x.baggage,routeType:x.routeType,arrivalBufferMinutes:x.arrivalBufferMinutes,drivingDurationMinutes:x.drivingDurationMinutes,plannedStops:x.plannedStops,boardingDeadline:x.boardingDeadline,trafficUrl:x.trafficUrl})),
  activities:t.activities.map(x=>({id:x.id,name:x.name,category:x.category,date:x.date||null,startTime:x.startTime||null,duration:x.duration,address:x.address,description:x.description,priority:x.priority,done:!!x.done,bookingRequired:x.bookingRequired,bookingStatus:x.bookingStatus||"unknown",price:x.price,sources:x.sources||[]})),
  planningWarnings:[...getWarnings(t),...getPlanningWarnings(t)],
  checklist:t.checklist.map(x=>({label:x.label,done:!!x.done}))
 };
}
async function copyText(value){
 try{if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(value);return true}}catch(e){}
 const field=document.createElement("textarea");field.value=value;field.style.position="fixed";field.style.opacity="0";document.body.appendChild(field);field.select();let ok=false;try{ok=document.execCommand("copy")}catch(e){}field.remove();return ok;
}
async function copyContext(){
 const t=activeTrip();if(!t)return;
 const value="Voici le contexte actuel de mon voyage dans PEPPER. Vérifie les règles sur les sites officiels, contrôle la cohérence des horaires et pose-moi les questions manquantes.\n\n"+JSON.stringify(shareContext(t),null,2)+"\n\nLes codes de réservation, billets complets, QR codes, téléphones et instructions d’accès privées ne sont pas inclus.";
 if(await copyText(value))toast("Contexte copié. Colle-le dans cette conversation ChatGPT.");else toast("Copie impossible. Exporte le JSON et partage seulement les informations utiles.","error");
}
async function copyRequest(event){
 if(event)event.preventDefault();const t=activeTrip(),idea=$("#idea-input").value.trim();if(!t)return;
 if(!idea){await copyContext();return}
 const value="JALAP, voici une nouvelle demande pour mon voyage. Vérifie les informations officielles à jour, les horaires, les réservations, les temps de déplacement et la cohérence avec mon hébergement et mes trajets. Pose-moi les questions manquantes avant de l’intégrer. Si une mise à jour du code de l’application est nécessaire, modifie le projet GitHub sans publier de données privées.\n\nCONTEXTE :\n"+JSON.stringify(shareContext(t),null,2)+"\n\nNOUVELLE IDÉE / INFORMATION :\n"+idea;
 if(await copyText(value)){toast("Demande copiée. Colle-la dans cette conversation pour que JALAP puisse la traiter.");$("#idea-input").value=""}else toast("Copie impossible. Sélectionne et copie le texte manuellement.","error");
}

function settingsModal(){
 const t=activeTrip(),api=apiBaseUrl(),token=apiAccessToken();
 const body='<div class="detail-section"><h4>Stockage et confidentialité</h4><p>Les carnets de voyage, billets, références de réservation et cases à cocher sont enregistrés localement dans ce navigateur (stockage du site et IndexedDB). Ils ne sont pas synchronisés avec GitHub ni envoyés dans le dépôt public.</p><p>Pour conserver une copie, exporte tous les voyages au format JSON et garde ce fichier dans un espace privé.</p></div><div class="detail-grid"><div class="detail-item"><small>Voyages enregistrés</small><strong>'+state.trips.length+'</strong></div><div class="detail-item"><small>Voyage actif</small><strong>'+esc(t?.destination||"Aucun")+'</strong></div></div>';
 openModal("Réglages de PEPPER","Stockage local, sauvegarde et confidentialité.",'<form id="settings-form"><div class="field full"><label>URL DU SERVICE TEMPS RÉEL PEPPER (NETLIFY)</label><input type="url" name="apiBaseUrl" value="'+esc(api)+'" placeholder="https://ton-service.netlify.app"><span class="field-help">URL publique de ton service. Elle ne contient aucun secret.</span></div><div class="field full"><label>JETON PRIVÉ D’ACCÈS PEPPER</label><input type="password" name="apiAccessToken" value="'+esc(token)+'" autocomplete="off" placeholder="Colle ici le jeton créé dans Netlify"><span class="field-help">Ce jeton reste dans ce navigateur et est transmis en HTTPS. Il doit être identique à PEPPER_API_TOKEN côté Netlify. Ne le colle jamais dans GitHub ni dans une conversation.</span></div><div class="modal-actions"><button class="secondary-button" type="button" data-action="close-modal">Fermer</button><button class="primary-button" type="submit">Enregistrer</button></div></form><div class="modal-actions"><button class="secondary-button" type="button" data-action="import-json">Importer une sauvegarde</button><button class="primary-button" type="button" data-action="export-json">Exporter tous les voyages</button></div>'+body);
}


async function copyJalapAudit(){
 const t=activeTrip();if(!t){toast("Crée d’abord un voyage.","error");return}
 const warnings=[...getWarnings(t),...getPlanningWarnings(t)];
 const prompt="JALAP, réalise un audit complet de mon voyage avant de proposer des changements. Vérifie les horaires et les règles sur les sources officielles des transporteurs, les perturbations connues, la cohérence des allers-retours et correspondances, les marges d'arrivée, les horaires du logement, les chevauchements d'activités, les temps de déplacement et les réservations. Distingue toujours les faits confirmés, les estimations et les informations à vérifier. Ne suppose jamais qu'une absence d'alerte signifie qu'un transport est à l'heure. N'invente aucun horaire, tarif ou lien. Commence par les risques prioritaires et pose uniquement les questions indispensables. Propose les modifications du programme avant de les intégrer. Les codes de réservation, téléphones et accès privés ont été volontairement exclus.\n\nCONTEXTE PEPPER :\n"+JSON.stringify(shareContext(t),null,2)+"\n\nALERTES LOCALES DÉTECTÉES :\n"+(warnings.length?warnings.map(x=>"- "+x).join("\n"):"Aucune alerte locale détectée.") ;
 if(await copyText(prompt))toast("Audit JALAP copié. Colle-le dans cette conversation ChatGPT.");else toast("Copie impossible. Réessaie depuis le bouton de contexte.","error");
}


function appendJalapMessage(role,content){
 const thread=$("#jalap-thread");if(!thread)return;
 if(role==="assistant"){
  const line=document.createElement("div");line.className="chat-line";
  const avatar=document.createElement("img");avatar.className="chat-mascot";avatar.src="./assets/jalap.svg";avatar.alt="JALAP";
  const node=document.createElement("div");node.className="chat-message assistant-message";node.textContent=String(content||"");
  line.append(avatar,node);thread.appendChild(line);
 }else{
  const node=document.createElement("div");node.className="chat-message user-message";node.textContent=String(content||"");thread.appendChild(node);
 }
 thread.scrollTop=thread.scrollHeight;
}
function jalapOperationTitle(op){
 const labels={activity_add:"Ajouter une activité",activity_update:"Modifier une activité",activity_delete:"Supprimer une activité",transport_add:"Ajouter un trajet",transport_update:"Modifier un trajet",trip_update:"Modifier les informations du voyage",expense_add:"Ajouter une dépense",checklist_add:"Ajouter une tâche"};
 const name=op.data?.name||op.data?.label||op.data?.taskLabel;
 return (labels[op.action]||"Modification")+(name?" : "+name:"");
}
function renderJalapProposal(){
 const panel=$("#jalap-proposal"),content=$("#jalap-proposal-content");if(!panel||!content)return;
 if(!jalapPendingProposal||!jalapPendingProposal.length){panel.hidden=true;content.textContent="";return}
 panel.hidden=false;
 content.innerHTML=jalapPendingProposal.map((op,i)=>'<div class="jalap-change"><strong>'+(i+1)+'. '+esc(jalapOperationTitle(op))+'</strong><span>'+esc(op.reason||"Modification proposée")+'</span></div>').join("");
}
const JALAP_ACTIVITY_FIELDS=["name","category","date","startTime","duration","address","description","price","bookingRequired","bookingStatus","priority","bookingUrl","highlights"];
const JALAP_TRANSPORT_FIELDS=["direction","mode","operator","service","number","origin","destination","departureDate","departureTime","arrivalDate","arrivalTime","platform","baggage","ticketUrl","trafficUrl","notes"];
function jalapCleanData(data,fields){
 const cleaned={};
 for(const field of fields){
  const value=data?.[field];if(value===null&&["date","startTime"].includes(field)){cleaned[field]="";continue}if(value===null||value===undefined||value==="")continue;
  if(typeof value==="string")cleaned[field]=value.trim().slice(0,1200);
  else if(typeof value==="number"&&Number.isFinite(value))cleaned[field]=value;
  else if(typeof value==="boolean")cleaned[field]=value;
  else if(field==="highlights"&&Array.isArray(value))cleaned[field]=value.filter(x=>typeof x==="string").slice(0,12).map(x=>x.slice(0,240));
 }
 return cleaned;
}
function validateJalapProposal(operations,trip){
 if(!Array.isArray(operations))return [];
 const allowed=["activity_add","activity_update","activity_delete","transport_add","transport_update","trip_update","expense_add","checklist_add"];
 return operations.slice(0,8).filter(op=>{
  if(!op||!allowed.includes(op.action)||!op.data||typeof op.data!=="object")return false;
  if(["activity_update","activity_delete"].includes(op.action)&&!trip.activities.some(a=>a.id===op.targetId))return false;
  if(op.action==="transport_update"&&!trip.transport.some(x=>x.id===op.targetId))return false;
  if(op.action==="activity_add"&&!String(op.data.name||"").trim())return false;
  if(op.action==="transport_add"&&(!["train","plane","car","bus","ferry"].includes(op.data.mode)||!["outbound","return","connection","other"].includes(op.data.direction)||!op.data.origin||!op.data.destination))return false;
  if(op.action==="expense_add"&&(!String(op.data.label||"").trim()||!Number.isFinite(Number(op.data.amount))||Number(op.data.amount)<0))return false;
  if(op.action==="checklist_add"&&!String(op.data.taskLabel||"").trim())return false;
  for(const key of ["date","departureDate","arrivalDate","startDate","endDate"])if(op.data[key]!=null&&!/^\d{4}-\d{2}-\d{2}$/.test(String(op.data[key])))return false;
  return true;
 }).map(op=>({...op,data:op.data}));
}
async function sendJalapMessage(event){
 if(event)event.preventDefault();
 if(jalapBusy)return;
 const input=$("#idea-input"),message=input?.value.trim(),trip=activeTrip();
 if(!trip){toast("Crée ou importe d’abord un voyage pour discuter avec JALAP.","error");return}
 if(!message){input?.focus();return}
 const base=apiBaseUrl(),token=apiAccessToken();
 if(!base||!token){toast("Configure d’abord l’URL Netlify et le jeton PEPPER dans Réglages.","error");return}
 jalapMessages.push({role:"user",content:message});appendJalapMessage("user",message);
 input.value="";jalapBusy=true;
 const button=$("#idea-form button[type=submit]");if(button){button.disabled=true;button.textContent="…"}
 const pending=document.createElement("div");pending.id="jalap-pending";pending.className="chat-message assistant-message";pending.textContent="JALAP analyse ton voyage…";$("#jalap-thread")?.appendChild(pending);
 try{
  const response=await fetch(base+"/.netlify/functions/jalap",{method:"POST",headers:{...apiRequestHeaders(),"content-type":"application/json"},body:JSON.stringify({message,context:shareContext(trip),history:jalapMessages.slice(-10)}),signal:AbortSignal.timeout(50000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||"JALAP est indisponible ("+response.status+").");
  if(activeTrip()?.id!==trip.id)throw new Error("Le voyage actif a changé pendant l'analyse. Relance ta demande depuis le bon voyage.");
  const answer=String(data.message||"Je n'ai pas réussi à formuler une réponse.");
  jalapMessages.push({role:"assistant",content:answer});appendJalapMessage("assistant",answer);
  jalapPendingProposal=validateJalapProposal(data.operations,trip);jalapPendingTripId=trip.id;renderJalapProposal();
  if(data.operations?.length&&!jalapPendingProposal.length)appendJalapMessage("assistant","Je n'ai pas pu sécuriser les modifications proposées. Précise ta demande et je réessaierai.");
 }catch(error){appendJalapMessage("assistant",error.message||"Connexion à JALAP impossible. Vérifie le service Netlify.");}
 finally{
  $("#jalap-pending")?.remove();jalapBusy=false;if(button){button.disabled=false;button.textContent="↗"}
 }
}
function applyJalapProposal(){
 const trip=activeTrip(),operations=jalapPendingProposal;if(!trip||!operations?.length)return;
 if(trip.id!==jalapPendingTripId){toast("Le voyage actif a changé. Relance la demande JALAP.","error");jalapPendingProposal=null;renderJalapProposal();return}
 const applied=[];
 for(const op of operations){
  const data=op.data||{};
  if(op.action==="activity_add"){
   const fields=jalapCleanData(data,JALAP_ACTIVITY_FIELDS),activity={id:uid(),...fields,done:false,status:"À organiser",createdAt:new Date().toISOString()};
   if(!activity.category)activity.category="Autre";if(!activity.priority)activity.priority="medium";if(!activity.bookingStatus)activity.bookingStatus="unknown";
   activity.bookingRequired=activity.bookingStatus==="to_book"||activity.bookingStatus==="booked"||data.bookingRequired===true;
   trip.activities.push(activity);applied.push("activité ajoutée");
  }else if(op.action==="activity_update"||op.action==="activity_delete"){
   const activity=trip.activities.find(x=>x.id===op.targetId);if(!activity)continue;
   if(op.action==="activity_delete"){trip.activities=trip.activities.filter(x=>x.id!==op.targetId);applied.push("activité supprimée");}
   else{const fields=jalapCleanData(data,JALAP_ACTIVITY_FIELDS);Object.assign(activity,fields);if(fields.bookingStatus)activity.bookingRequired=fields.bookingStatus==="to_book"||fields.bookingStatus==="booked";applied.push("activité modifiée");}
  }else if(op.action==="transport_add"){
   const fields=jalapCleanData(data,JALAP_TRANSPORT_FIELDS);
   trip.transport.push({id:uid(),...fields,routeType:"unknown",arrivalBufferMinutes:null,createdAt:new Date().toISOString()});applied.push("trajet ajouté");
  }else if(op.action==="transport_update"){
   const leg=trip.transport.find(x=>x.id===op.targetId);if(!leg)continue;
   Object.assign(leg,jalapCleanData(data,JALAP_TRANSPORT_FIELDS));applied.push("trajet modifié");
  }else if(op.action==="trip_update"){
   const fields=jalapCleanData(data,["destination","startDate","endDate","people","budget","currency","notes"]);
   const nextStart=fields.startDate||trip.startDate,nextEnd=fields.endDate||trip.endDate;
   if(nextStart&&nextEnd&&nextEnd<nextStart){appendJalapMessage("assistant","J'ai écarté une modification des dates car la date de retour serait antérieure au départ.");continue;}
   Object.assign(trip,fields);applied.push("voyage mis à jour");
  }else if(op.action==="expense_add"){
   trip.expenses.push({id:uid(),label:String(data.label||"Dépense").slice(0,120),amount:Number(data.amount),category:String(data.category||"Divers").slice(0,60),date:today()});applied.push("dépense ajoutée");
  }else if(op.action==="checklist_add"){
   trip.checklist.push({id:uid(),label:String(data.taskLabel||"Tâche").slice(0,180),done:false});applied.push("tâche ajoutée");
  }
 }
 if(!applied.length){toast("Aucune modification valide à appliquer.","error");return;}
 jalapPendingProposal=null;jalapPendingTripId=null;save();weatherData=null;render();renderJalapProposal();
 const summary="C'est fait : "+applied.join(", ")+". Les changements sont enregistrés dans ce navigateur.";
 jalapMessages.push({role:"assistant",content:summary});appendJalapMessage("assistant",summary);toast("Modifications JALAP enregistrées localement.");
}
function cancelJalapProposal(){jalapPendingProposal=null;jalapPendingTripId=null;renderJalapProposal();appendJalapMessage("assistant","D'accord, je n'ai rien modifié dans ton voyage.");}

function markActivityBooked(id){
 const t=activeTrip(),activity=t?.activities.find(x=>x.id===id);if(!activity)return;
 activity.bookingStatus="booked";activity.bookingRequired=true;activity.reservationConfirmedAt=new Date().toISOString();
 save();render();detailModal(id);toast("Réservation marquée comme confirmée dans PEPPER.");
}
function onAction(event){
 const el=event.target.closest("[data-action]");if(!el)return;const n=el.dataset.action,id=el.dataset.id;
 if(n==="jalap-apply"){applyJalapProposal();return}if(n==="jalap-cancel"){cancelJalapProposal();return}
 if(n==="close-modal"){if(event.target===el||el.matches("button"))closeModal();return}
 if(n==="settings"){settingsModal();return}if(n==="import-json"){importModal();return}
 if(n==="create-trip"){tripForm(null);return}if(n==="edit-trip"){tripForm(activeTrip());return}
 if(n==="edit-accommodation"){stayForm();return}if(n==="add-transport"){transportForm(null);return}
 if(n==="edit-transport"){transportForm(activeTrip().transport.find(x=>x.id===id));return}if(n==="delete-transport"){if(confirm("Supprimer ce trajet ?"))deleteTransport(id);return}
 if(n==="add-activity"){activityForm();return}if(n==="edit-activity"){const activity=activeTrip()?.activities.find(x=>x.id===id);if(activity)activityForm(activity);return}if(n==="add-expense"){expenseForm();return}
 if(n==="activity-detail"){detailModal(id);return}if(n==="mark-activity-booked"){markActivityBooked(id);return}if(n==="delete-activity"){if(confirm("Supprimer cette activité ?"))deleteActivity(id);return}
 if(n==="fit-map"){fitMap();return}if(n==="export-ics"){exportICS();return}if(n==="export-json"){exportJSON();return}
 if(n==="add-check"){addChecklist();return}if(n==="copy-trip-context"){copyContext();return}if(n==="copy-jalap-request"){copyRequest();return}if(n==="copy-jalap-audit"){copyJalapAudit();return}
}
document.addEventListener("click",onAction);
document.addEventListener("change",e=>{
 if(e.target.id==="trip-switcher"){state.activeTripId=e.target.value;weatherData=null;weatherError="";save();render()}
 if(e.target.matches('[data-action="toggle-activity"]'))markActivity(e);
 if(e.target.matches('[data-action="toggle-check"]'))markChecklist(e);
});
document.addEventListener("submit",e=>{
 const f=e.target;
 if(f.id==="settings-form"){e.preventDefault();localStorage.setItem(API_BASE_KEY,String(new FormData(f).get("apiBaseUrl")||"").trim().replace(/\/+$/,""));localStorage.setItem(API_TOKEN_KEY,String(new FormData(f).get("apiAccessToken")||"").trim());closeModal();if(activeTrip())renderTransport(activeTrip());toast("Réglages enregistrés sur cet appareil.");}
 if(f.id==="import-form"){e.preventDefault();importBackup(f)}
 if(f.id==="trip-form"){e.preventDefault();saveTripForm(f)}
 if(f.id==="stay-form"){e.preventDefault();saveStay(f)}
 if(f.id==="transport-form"){e.preventDefault();saveLeg(f)}
 if(f.id==="activity-form"){e.preventDefault();addActivity(f)}
 if(f.id==="expense-form"){e.preventDefault();addExpense(f)}
 if(f.id==="idea-form")sendJalapMessage(e);
});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});
$$("[data-scroll]").forEach(b=>b.addEventListener("click",()=>{const id=b.dataset.scroll,node=id==="assistant-panel"?$(".assistant-panel"):$("#"+id);if(node)node.scrollIntoView({behavior:"smooth",block:"start"})}));
async function initialise(){await restoreStateFromIndexedDB();if(state.trips.length&&!state.activeTripId)state.activeTripId=state.trips[0].id;save();render();updateNetworkStatus();if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});window.addEventListener("online",()=>{updateNetworkStatus();const t=activeTrip();if(t){renderMap(t);fetchWeather(t);refreshLiveTransportStatus(t);refreshLocalTransitStatus(t)}});window.addEventListener("offline",updateNetworkStatus);if("serviceWorker" in navigator)navigator.serviceWorker.register("./service-worker.js",{updateViaCache:"none"}).catch(()=>{})}
initialise();