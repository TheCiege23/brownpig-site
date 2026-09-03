/**
 * Brown Pig LLC — static site server.
 * Zero dependencies. Node 18+ (uses global fetch).
 *
 * Serves the HTML files with clean URLs (/work -> work.html) and exposes
 * POST /api/contact, which forwards the enquiry by email via Resend when
 * RESEND_API_KEY is set. Without that key the endpoint still accepts the
 * submission and logs it, so the site never appears broken.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const CONTACT_TO   = process.env.CONTACT_TO   || "hello@brownpigllc.com";
const CONTACT_FROM = process.env.CONTACT_FROM || "Brown Pig site <onboarding@resend.dev>";
const RESEND_KEY   = process.env.RESEND_API_KEY || "";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".woff2":"font/woff2",
  ".txt":  "text/plain; charset=utf-8"
};

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function send(res, code, body, headers) {
  res.writeHead(code, Object.assign({ "X-Content-Type-Options": "nosniff" }, headers || {}));
  res.end(body);
}

function json(res, code, obj) {
  send(res, code, JSON.stringify(obj), { "Content-Type": TYPES[".json"] });
}

/* ------------------------------------------------------------- contact -- */
async function handleContact(req, res) {
  let raw = "";
  let tooBig = false;

  req.on("data", (c) => {
    raw += c;
    if (raw.length > 20000) { tooBig = true; req.destroy(); }
  });

  req.on("end", async () => {
    if (tooBig) { return json(res, 413, { error: "Message too long." }); }

    let d;
    try { d = JSON.parse(raw); } catch { return json(res, 400, { error: "Bad request." }); }

    if (d.website) { return json(res, 200, { ok: true }); }            // honeypot
    if (!d.name || !d.email || !d.message) {
      return json(res, 400, { error: "Name, email and a description are required." });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(d.email))) {
      return json(res, 400, { error: "That email address doesn't look right." });
    }

    const summary =
      `New enquiry from ${d.name} <${d.email}>\n` +
      `Company: ${d.company || "—"}\nType: ${d.type || "—"}\nBudget: ${d.budget || "—"}\n\n${d.message}`;

    if (!RESEND_KEY) {
      console.log("[contact] RESEND_API_KEY not set — logging instead:\n" + summary);
      return json(res, 200, { ok: true, delivered: false });
    }

    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: CONTACT_FROM,
          to: [CONTACT_TO],
          reply_to: d.email,
          subject: `Enquiry — ${d.company || d.name} (${d.type || "general"})`,
          html:
            `<h2>New enquiry</h2>
             <p><strong>Name:</strong> ${esc(d.name)}<br>
                <strong>Email:</strong> ${esc(d.email)}<br>
                <strong>Company:</strong> ${esc(d.company) || "—"}<br>
                <strong>Type:</strong> ${esc(d.type) || "—"}<br>
                <strong>Budget:</strong> ${esc(d.budget) || "—"}</p>
             <hr><p style="white-space:pre-wrap">${esc(d.message)}</p>`
        })
      });

      if (!r.ok) {
        console.error("[contact] resend failed", r.status, await r.text());
        return json(res, 502, { error: "Mail service rejected the message." });
      }
      return json(res, 200, { ok: true, delivered: true });
    } catch (err) {
      console.error("[contact] send error", err);
      return json(res, 502, { error: "Could not send right now." });
    }
  });
}

/* -------------------------------------------------------------- static -- */
function serveFile(res, filePath, code) {
  fs.readFile(filePath, (err, buf) => {
    if (err) { return send(res, 500, "Server error"); }
    const ext = path.extname(filePath).toLowerCase();
    const cache = ext === ".html"
      ? "public, max-age=0, must-revalidate"
      : "public, max-age=31536000, immutable";
    send(res, code || 200, buf, {
      "Content-Type": TYPES[ext] || "application/octet-stream",
      "Cache-Control": cache
    });
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/contact") {
    if (req.method !== "POST") { return json(res, 405, { error: "Method not allowed." }); }
    return handleContact(req, res);
  }
  if (url.pathname === "/healthz") { return send(res, 200, "ok", { "Content-Type": TYPES[".txt"] }); }
  if (req.method !== "GET" && req.method !== "HEAD") { return send(res, 405, "Method not allowed"); }

  // resolve, refusing anything that escapes the project directory
  let rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  if (rel === "") { rel = "index.html"; }
  let target = path.resolve(ROOT, rel);
  if (!target.startsWith(ROOT)) { return send(res, 403, "Forbidden"); }

  const candidates = [target, target + ".html", path.join(target, "index.html")];

  (function tryNext(i) {
    if (i >= candidates.length) {
      const notFound = path.join(ROOT, "404.html");
      return fs.existsSync(notFound)
        ? serveFile(res, notFound, 404)
        : send(res, 404, "Not found", { "Content-Type": TYPES[".txt"] });
    }
    fs.stat(candidates[i], (err, st) => {
      if (!err && st.isFile()) { return serveFile(res, candidates[i]); }
      tryNext(i + 1);
    });
  })(0);
});

server.listen(PORT, () => {
  console.log(`Brown Pig site listening on :${PORT}`);
  if (!RESEND_KEY) {
    console.log("[contact] RESEND_API_KEY not set — enquiries will be logged, not emailed.");
  }
});
