const SNCF_SITUATIONS_URL = "https://proxy.transport.data.gouv.fr/resource/sncf-siri-lite-situation-exchange";
const SOURCE_URL = "https://ressources.data.sncf.com/explore/dataset/temps-reel-siri-sx-lite/";
const MAX_FEED_BYTES = 12 * 1024 * 1024;

function responseHeaders(origin) {
  const configuredOrigin = globalThis.Netlify?.env?.get?.("PEPPER_ALLOWED_ORIGIN") || process.env.PEPPER_ALLOWED_ORIGIN || "*";
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=30, s-maxage=30, stale-while-revalidate=60",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
    "vary": "Origin"
  };
  if (configuredOrigin === "*" || configuredOrigin === origin) {
    headers["access-control-allow-origin"] = configuredOrigin;
  }
  return headers;
}

function xmlText(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, " ").trim();
}

function tagPattern(name) {
  return new RegExp("<(?:[A-Za-z_][\\w.-]*:)?"+name+"\\b[^>]*>([\\s\\S]*?)</(?:[A-Za-z_][\\w.-]*:)?"+name+"\\s*>", "i");
}

function tagContent(block, tagNames) {
  for (const name of tagNames) {
    const match = block.match(tagPattern(name));
    if (match) {
      const valueMatch = match[1].match(tagPattern("Value"));
      return xmlText(valueMatch ? valueMatch[1] : match[1]);
    }
  }
  return "";
}

function findBlocks(xml, tagName) {
  const pattern = new RegExp("<(?:[A-Za-z_][\\w.-]*:)?"+tagName+"\\b[^>]*>([\\s\\S]*?)</(?:[A-Za-z_][\\w.-]*:)?"+tagName+"\\s*>", "gi");
  return [...xml.matchAll(pattern)].map(match => match[1]);
}

function parseSituations(xml, trainNumber) {
  const needle = trainNumber.toLowerCase().replace(/[^a-z0-9]/g, "");
  const blocks = findBlocks(xml, "PtSituationElement");
  const output = [];
  for (const block of blocks) {
    const refs = [
      ...findBlocks(block, "VehiculeJourneyRef"),
      ...findBlocks(block, "VehicleJourneyRef"),
      ...findBlocks(block, "TrainNumber")
    ].map(xmlText);
    if (!refs.some(ref => ref.toLowerCase().replace(/[^a-z0-9]/g, "") === needle)) continue;

    output.push({
      id: tagContent(block, ["SituationNumber", "SituationRef"]) || "sncf-" + output.length,
      trainNumber,
      severity: tagContent(block, ["Severity"]) || "unknown",
      title: tagContent(block, ["Summary", "SummaryText"]) || "Information SNCF concernant ce train",
      description: tagContent(block, ["Description", "SituationDescription", "Advice"]),
      createdAt: tagContent(block, ["CreationTime", "VersionedAtTime", "PublicationTime"]) || null,
      validFrom: tagContent(block, ["StartTime", "Start"]) || null,
      validUntil: tagContent(block, ["EndTime", "End"]) || null
    });
  }
  return output;
}


function findDeepValues(value, targetKey, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) findDeepValues(item, targetKey, output);
    return output;
  }
  if (!value || typeof value !== "object") return output;
  for (const [key, child] of Object.entries(value)) {
    if (key.toLowerCase() === targetKey.toLowerCase()) {
      if (Array.isArray(child)) output.push(...child);
      else output.push(child);
    } else {
      findDeepValues(child, targetKey, output);
    }
  }
  return output;
}

function firstDeepValue(value, targetKeys) {
  for (const key of targetKeys) {
    const found = findDeepValues(value, key, []);
    for (const item of found) {
      if (typeof item === "string" || typeof item === "number") return String(item);
      if (item && typeof item === "object") {
        if (typeof item.value === "string") return item.value;
        if (typeof item.Value === "string") return item.Value;
      }
    }
  }
  return "";
}

async function getIdfmStatus(monitoringRef) {
  const apiKey = process.env.IDFM_API_KEY || globalThis.Netlify?.env?.get?.("IDFM_API_KEY");
  if (!apiKey) {
    return {
      configured: false,
      provider: "IDFM",
      message: "Le jeton PRIM n'est pas encore configuré dans les variables Netlify (IDFM_API_KEY).",
      setupUrl: "https://prim.iledefrance-mobilites.fr/"
    };
  }
  const endpoint = "https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=" + encodeURIComponent(monitoringRef);
  const upstream = await fetch(endpoint, {
    headers: { apikey: apiKey, accept: "application/json" },
    signal: AbortSignal.timeout(12000)
  });
  if (!upstream.ok) throw new Error("PRIM IDFM indisponible (" + upstream.status + ").");
  const payload = await upstream.json();
  const visits = findDeepValues(payload, "MonitoredStopVisit", []);
  const departures = visits.map(visit => {
    const journey = firstDeepValue(visit, ["LineRef", "PublishedLineName"]);
    const destination = firstDeepValue(visit, ["DestinationDisplay", "DestinationName"]);
    const aimed = firstDeepValue(visit, ["AimedArrivalTime", "AimedDepartureTime"]);
    const expected = firstDeepValue(visit, ["ExpectedArrivalTime", "ExpectedDepartureTime"]);
    const vehicleAtStop = firstDeepValue(visit, ["VehicleAtStop"]);
    return { line: journey, destination, aimedTime: aimed, expectedTime: expected, vehicleAtStop };
  }).filter(item => item.line || item.expectedTime || item.aimedTime);
  return {
    configured: true,
    provider: "IDFM / PRIM",
    monitoringRef,
    checkedAt: new Date().toISOString(),
    source: "https://prim.iledefrance-mobilites.fr/",
    departures,
    message: departures.length ? "Prochains passages reçus depuis PRIM." : "Aucun passage n'est retourné pour cet arrêt. Le service peut ne pas couvrir ce point."
  };
}

export { parseSituations };

export default async (request) => {
  const origin = request.headers.get("origin") || "";
  const headers = responseHeaders(origin);
  if (headers["access-control-allow-origin"] === undefined) {
    return Response.json({ error: "Origin non autorisée." }, { status: 403, headers });
  }
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "GET") return Response.json({ error: "Méthode non autorisée." }, { status: 405, headers });

  const url = new URL(request.url);
  const provider = (url.searchParams.get("provider") || "sncf").toLowerCase();
  if (provider === "idfm") {
    const monitoringRef = (url.searchParams.get("monitoringRef") || "").trim().slice(0, 180);
    if (!monitoringRef) return Response.json({ error: "Ajoute la référence d'arrêt SIRI PRIM (MonitoringRef)." }, { status: 400, headers });
    try {
      const status = await getIdfmStatus(monitoringRef);
      if (!status.configured) return Response.json(status, { status: 503, headers });
      return Response.json(status, { status: 200, headers: { ...headers, "cache-control": "public, max-age=45, s-maxage=60" } });
    } catch (error) {
      return Response.json({ error: "Impossible de consulter PRIM Île-de-France Mobilités.", detail: error instanceof Error ? error.message : "Erreur inconnue", checkedAt: new Date().toISOString() }, { status: 502, headers });
    }
  }
  if (provider !== "sncf") {
    return Response.json({
      error: "Cette source n'est pas encore activée.",
      provider,
      availableProviders: ["sncf", "idfm"],
      note: "Les connecteurs aérien, autocar et route nécessitent des accès ou des flux propres à chaque opérateur."
    }, { status: 501, headers });
  }

  const trainNumber = (url.searchParams.get("number") || "").trim().slice(0, 20);
  if (!/^[a-z0-9 -]{2,20}$/i.test(trainNumber)) {
    return Response.json({ error: "Ajoute un numéro de train valide (ex. 8511)." }, { status: 400, headers });
  }

  try {
    const upstream = await fetch(SNCF_SITUATIONS_URL, {
      headers: { accept: "application/xml, text/xml;q=0.9" },
      signal: AbortSignal.timeout(12000)
    });
    if (!upstream.ok) throw new Error("Flux SNCF indisponible (" + upstream.status + ").");
    const contentLength = Number(upstream.headers.get("content-length") || 0);
    if (contentLength > MAX_FEED_BYTES) throw new Error("Flux SNCF trop volumineux.");
    const xml = await upstream.text();
    if (xml.length > MAX_FEED_BYTES) throw new Error("Flux SNCF trop volumineux.");

    const alerts = parseSituations(xml, trainNumber);
    return Response.json({
      provider: "SNCF",
      trainNumber,
      checkedAt: new Date().toISOString(),
      feedUpdatedAt: upstream.headers.get("last-modified") || null,
      source: SOURCE_URL,
      sourceFrequencyMinutes: 2,
      scope: "TGV, Intercités, TER et OUIGO. Transilien et Eurostar ne sont pas couverts.",
      status: alerts.length ? "alerts" : "no_matching_alert",
      alerts,
      message: alerts.length
        ? "Avis SNCF associé à ce numéro de train."
        : "Aucun avis associé à ce numéro dans le flux d'incidents. Cela ne confirme pas que le train est à l'heure."
    }, { status: 200, headers });
  } catch (error) {
    return Response.json({
      error: "Impossible de consulter le flux SNCF pour le moment.",
      detail: error instanceof Error ? error.message : "Erreur inconnue",
      checkedAt: new Date().toISOString(),
      source: SOURCE_URL
    }, { status: 502, headers });
  }
};
