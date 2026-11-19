// Shared helpers for the data removal flow. Files starting with "_" are not
// exposed as routes by Vercel.
const crypto = require("crypto");

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // confirmation links last 24 hours
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(str) {
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function secret() {
  const s = process.env.REMOVEDATA_SECRET;
  if (!s || s.length < 32) throw new Error("REMOVEDATA_SECRET is missing or shorter than 32 characters");
  return s;
}

function sign(payload) {
  return b64url(crypto.createHmac("sha256", secret()).update(payload).digest());
}

// Token = base64url(JSON {e: email, t: requestedAt, x: expiresAt}) + "." + HMAC
function makeToken(email, now = Date.now()) {
  const payload = b64url(JSON.stringify({ e: email, t: now, x: now + TOKEN_TTL_MS }));
  return payload + "." + sign(payload);
}

// Returns {email, requestedAt} or throws with a user-safe message.
function readToken(token, now = Date.now()) {
  if (typeof token !== "string" || !token.includes(".")) throw new Error("invalid");
  const [payload, mac] = token.split(".");
  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error("invalid");
  let data;
  try { data = JSON.parse(fromB64url(payload).toString("utf8")); } catch { throw new Error("invalid"); }
  if (!data || typeof data.e !== "string" || typeof data.x !== "number") throw new Error("invalid");
  if (now > data.x) throw new Error("expired");
  return { email: data.e, requestedAt: data.t };
}

function normalizeEmail(raw) {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return null;
  return email;
}

async function sendEmail({ to, subject, text, replyTo }) {
  const key = process.env.SENDGRID_API_KEY;
  const from = process.env.FROM_EMAIL;
  if (!key || !from) throw new Error("SENDGRID_API_KEY or FROM_EMAIL is not set");
  const body = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: from, name: "Crackem" },
    subject,
    content: [{ type: "text/plain", value: text }],
    tracking_settings: { click_tracking: { enable: false, enable_text: false } },
  };
  if (replyTo) body.reply_to = { email: replyTo };
  const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`SendGrid error ${r.status}: ${await r.text()}`);
}

// Cloudflare Turnstile check. Skipped when TURNSTILE_SECRET_KEY is not set.
async function verifyTurnstile(token, ip) {
  const key = process.env.TURNSTILE_SECRET_KEY;
  if (!key) return true;
  if (!token) return false;
  const form = new URLSearchParams({ secret: key, response: token });
  if (ip) form.set("remoteip", ip);
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  const data = await r.json().catch(() => ({}));
  return data.success === true;
}

function siteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `https://${host}`;
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  return (Array.isArray(fwd) ? fwd[0] : (fwd || "")).split(",")[0].trim() || undefined;
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

module.exports = { makeToken, readToken, normalizeEmail, sendEmail, verifyTurnstile, siteUrl, clientIp, readBody, TOKEN_TTL_MS };
