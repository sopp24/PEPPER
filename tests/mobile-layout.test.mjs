import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const ui = readFileSync(new URL("../ui.css", import.meta.url), "utf8");
const serviceWorker = readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");

test("le carrousel mobile du carnet reste visible et accessible", () => {
  assert.match(index, /id="hub-cards" class="hub-cards" role="region"/);
  assert.match(index, /Cartes d’informations du voyage/);
  assert.match(ui, /\.map-hub \.hub-cards\s*\{\s*display:flex!important/);
  assert.match(ui, /scroll-snap-type:x mandatory/);
  assert.match(ui, /\.map-hub \.hub-dots\s*\{\s*display:flex!important/);
  assert.doesNotMatch(
    ui,
    /\.map-hub \.hub-cards,\s*\.map-hub \.hub-dots\{display:none!important\}/
  );
});

test("les informations météo, logement, activités et transports ont chacune leur panneau complet", () => {
  for (const id of [
    "trip-accommodation",
    "trip-citytransit",
    "trip-transport",
    "trip-weather",
    "trip-itinerary",
    "assistant-panel"
  ]) {
    assert.ok(app.includes('"' + id + '":'), "Métadonnées de panneau absentes : " + id);
  }
  for (const cardType of ["stay", "transit", "trans", "weather", "acts"]) {
    assert.ok(app.includes('hubCard("' + cardType + '"'), "Carte mobile absente : " + cardType);
  }
  assert.ok(app.includes('class="hub-card hub-jalap"'), "Carte JALAP absente.");
  assert.match(ui, /\.map-hub \.hub-card \.hub-body\s*\{[\s\S]*?overflow-y:auto/);
});

test("les cartes activités et météo ne masquent plus leurs données secondaires sur mobile", () => {
  assert.match(ui, /\.map-hub \.hub-acts \.hub-act:nth-of-type\(n\+3\),\s*\.map-hub \.hub-acts \.hub-act-detail\{display:block!important\}/);
  assert.match(ui, /\.map-hub \.hub-weather \.hub-weather-now small:nth-of-type\(n\+3\)\{display:block\}/);
  assert.match(ui, /\.map-hub \.hub-transit-list li:nth-child\(3\)\{display:grid!important\}/);
});

test("les panneaux, formulaires et réglages restent utilisables au toucher", () => {
  assert.match(ui, /\.sheet-body \.assistant-panel \.ai-form\s*\{[\s\S]*?position:sticky/);
  assert.match(ui, /\.sheet-body \.assistant-panel \.chat-actions\{display:grid;grid-template-columns:1fr/);
  assert.match(ui, /\.modal-actions\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(ui, /\.settings-tabs\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
});

test("le cache du site est renouvelé pour charger la nouvelle interface mobile", () => {
  assert.match(serviceWorker, /const CACHE = "pepper-static-v41"/);
});
