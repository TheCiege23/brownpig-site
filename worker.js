/**
 * Brown Pig LLC — Cloudflare Worker.
 *
 * Static pages are served by Cloudflare's asset layer (see wrangler.jsonc).
 * This script only handles the two dynamic routes, which run_worker_first
 * routes here before the asset lookup:
 *
 *   POST /api/contact  — forwards the enquiry by email via Resend when
 *                        RESEND_API_KEY is set. Without that key it still
 *                        accepts the submission and logs it, so the form
 *                        never appears broken. Same contract as server.js.
 *   GET  /healthz      — liveness.
 *
 * Behaviour, status codes and validation deliberately match server.js so the
 * Railway and Cloudflare deployments respond identically.
 */

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const json = (code, obj) =>
  new Response(JSON.stringify(obj), {
    status: code,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff"
    }
  });

async function handleContact(request, env) {
  const raw = await request.text();

  // server.js destroys the socket past 20000 bytes; here the body is already
  // buffered, so the equivalent is to reject it at the same threshold.
  if (raw.length > 20000) return json(413, { error: "Message too long." });

  let d;
  try {
    d = JSON.parse(raw);
  } catch {
    return json(400, { error: "Bad request." });
  }

  if (d.website) return json(200, { ok: true }); // honeypot
  if (!d.name || !d.email || !d.message) {
    return json(400, { error: "Name, email and a description are required." });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(d.email))) {
    return json(400, { error: "That email address doesn't look right." });
  }

  const summary =
    `New enquiry from ${d.name} <${d.email}>\n` +
    `Company: ${d.company || "—"}\nType: ${d.type || "—"}\nBudget: ${d.budget || "—"}\n\n${d.message}`;

  const key = env.RESEND_API_KEY || "";
  if (!key) {
    console.log("[contact] RESEND_API_KEY not set — logging instead:\n" + summary);
    return json(200, { ok: true, delivered: false });
  }

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: env.CONTACT_FROM || "Brown Pig site <onboarding@resend.dev>",
        to: [env.CONTACT_TO || "support@brownpigllc.com"],
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
      return json(502, { error: "Mail service rejected the message." });
    }
    return json(200, { ok: true, delivered: true });
  } catch (err) {
    console.error("[contact] send error", err);
    return json(502, { error: "Could not send right now." });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/contact") {
      if (request.method !== "POST") {
        return json(405, { error: "Method not allowed." });
      }
      return handleContact(request, env);
    }

    if (url.pathname === "/healthz") {
      return new Response("ok", {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }

    // Anything else run_worker_first sends here falls back to the asset layer,
    // which applies not_found_handling ("404-page").
    return env.ASSETS.fetch(request);
  }
};
