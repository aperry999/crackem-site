// Step 1: someone submits the form. We email that address a confirmation link.
// Nothing goes to support until the link is used.
const { makeToken, normalizeEmail, sendEmail, verifyTurnstile, siteUrl, clientIp, readBody } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = readBody(req);

  // Honeypot: people never see this field, bots fill it in. Pretend it worked.
  if (body.website) return res.status(200).json({ ok: true });

  const email = normalizeEmail(body.email);
  if (!email) return res.status(400).json({ error: "Enter a valid email address." });

  const human = await verifyTurnstile(body.turnstileToken, clientIp(req));
  if (!human) return res.status(400).json({ error: "The spam check didn't go through. Please try again." });

  try {
    const link = `${siteUrl(req)}/removedata?token=${encodeURIComponent(makeToken(email))}`;
    await sendEmail({
      to: email,
      subject: "Confirm your Crackem data removal request",
      text: [
        "Someone asked to remove all Crackem data tied to this email address.",
        "",
        "If that was you, confirm the request here:",
        link,
        "",
        "This link works for 24 hours. If you didn't ask for this, ignore this email and nothing will change.",
        "",
        "Crackem",
      ].join("\n"),
    });
  } catch (err) {
    console.error("removedata: could not send confirmation email", err);
    return res.status(500).json({ error: "We couldn't send the confirmation email. Please try again later." });
  }

  // Same answer whether or not the address has an account, so the form can't be
  // used to find out who uses Crackem.
  return res.status(200).json({ ok: true });
};
