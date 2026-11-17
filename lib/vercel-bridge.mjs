export function createVercelBridge(handler) {
  return async function vercelHandler(req, res) {
    try {
      const headers = new Headers();
      for (const name of ["origin", "authorization", "accept", "content-type"]) {
        const value = req.headers?.[name];
        if (typeof value === "string") headers.set(name, value);
        else if (Array.isArray(value)) headers.set(name, value.join(", "));
      }
      let body;
      if (!["GET", "HEAD", "OPTIONS"].includes(String(req.method || "GET").toUpperCase())) {
        if (typeof req.body === "string") body = req.body;
        else if (req.body !== undefined) body = JSON.stringify(req.body);
        else {
          const chunks = [];
          for await (const chunk of req) chunks.push(Buffer.from(chunk));
          body = Buffer.concat(chunks).toString("utf8");
        }
      }
      const host = String(req.headers?.host || "localhost");
      const url = new URL(req.url || "/", "https://" + host);
      const request = new Request(url, {
        method: req.method || "GET",
        headers,
        ...(body === undefined ? {} : { body })
      });
      const response = await handler(request);
      res.statusCode = response.status;
      response.headers.forEach((value, name) => res.setHeader(name, value));
      res.end(await response.text());
    } catch (error) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.setHeader("cache-control", "no-store");
      res.end(JSON.stringify({ error: error?.message || "Erreur du service PEPPER." }));
    }
  };
}
