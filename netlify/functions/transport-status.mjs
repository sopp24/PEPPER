const SNCF_SITUATIONS_URL = "https://proxy.transport.data.gouv.fr/resource/sncf-siri-lite-situation-exchange";
const SOURCE_URL = "https://ressources.data.sncf.com/explore/dataset/temps-reel-siri-sx-lite/";
const MAX_FEED_BYTES = 12 * 1024 * 1024;

function responseHeaders(origin) {
  const allowed = Netlify.env.get("PEPPER_ALLOWED_ORIGIN") || "*";
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=30, s-maxage=30, stale-while-revalidate=60",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
    "vary": "Origin"
  };
  if (allowed === "*" || allowed === origin) headers["access-control-allow-origin"] = allowed;
  return headers;
}

function xmlText(value) {
  return String(value || "")
    .replace(/<\\/?(?:[A-Za-z_][\\w.-]*:)?[A-Za-z_][\\w.-]*\\b[^>]*>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\\s+/g, " ").trim();
}

function tagContent(block, tagNames) {
  for (const name of tagNames) {
    const escaped = name.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
    const pattern = new RegExp("<(?:[A-Za-z_][\\w.-]*:)?"+escaped+"\\b[^>]*>([\\s\\S]*?)</(?:[A-Za-z_][\\w.-]*:)?"+escaped+"\\s*>", "i");
    const match = block.match(pattern);
    if (match) {
      const inner = match[1];
      const valueMatch = inner.match(/<(?:[A-Za-z_][\\w.-]*:)?Value\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z_][\\w.-]*:)?Value\\s*>/i);
      return xmlText(valueMatch ? valueMatch[1] : inner);
    }
  }
  return "";
}

function findBlocks(xml, tagName) {
  const escaped = tagName.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
  const pattern = new RegExp("<(?:[A-Za-z_][\\w.-]*:)?"+escaped+"\\b[^>]*>([\\s\\S]*?)</(?:[A-Za-z_][\\w.-]*:)?"+escaped+"\\s*>", "gi");
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
    const matched = refs.some(ref => ref.toLowerCase().replace(/[^a-z0-9]/g, "").includes(needle));
    if (!matched) continue;
    const summary = tagContent(block, ["Summary", "SummaryText"]);
    const description = tagContent(block, ["Description", "SituationDescription", "Advice"]);
    const severity = tagContent(block, ["Severity"]);
    const created = tagContent(block, ["CreationTime", "VersionedAtTime", "PublicationTime"]);
    const start = tagContent(block, ["StartTime", "Start"]);
    const end = tagContent(block, ["EndTime", "End"]);
    const id = tagContent(block, ["SituationNumber", "SituationRef"]);
    output.push({
      id: id || "sncf-" + output.length,
      trainNumber,
      severity: severity || "unknown",
      title: summary || "Information SNCF concernant ce train",
      description: description || "",
      createdAt: created || null,
      validFrom: start || null,
      validUntil: end || null
    });
  }
  return output;
}

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
  if (provider !== "sncf") {
    return Response.json({
      error: "Cette source n'est pas encore activée.",
      provider,
      availableProviders: ["sncf"],
      note: "Les connecteurs IDFM, aérien, autocar et route nécessitent des accès ou des flux propres à chaque opérateur."
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
