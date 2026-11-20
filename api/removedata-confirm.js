// Step 2: the person opened the link in their email and pressed "Confirm".
// Now the request goes to support. This is a POST (not a plain link click) so
// email security scanners that open links can't confirm a request by accident.
const { readToken, sendEmail, readBody } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { token } = readBody(req);
  let request;
  try {
    request = readToken(token);
  } catch (err) {
    const expired = err.message === "expired";
    return res.status(400).json({
      error: expired
        ? "This confirmation link has expired. Please submit the form again."
        : "This confirmation link isn't valid. Please submit the form again.",
    });
  }

  const support = process.env.SUPPORT_EMAIL || "support@crackem.beer";
  const requested = new Date(request.requestedAt || Date.now()).toISOString();
  const confirmed = new Date().toISOString();

  try {
    await sendEmail({
      to: support,
      replyTo: request.email,
      subject: `Data removal request: ${request.email}`,
      text: [
        "A Crackem user has requested that their data be removed.",
        "The requester confirmed they own this email address by opening the link sent to it.",
        "",
        `Crackem user email address: ${request.email}`,
        `Requested: ${requested}`,
        `Confirmed: ${confirmed}`,
        "",
        "Remove all data tied to this account email. Reply to this email to reach the requester.",
      ].join("\n"),
    });
  } catch (err) {
    console.error("removedata-confirm: could not email support", err);
    return res.status(500).json({ error: "We couldn't send your request. Please try again later." });
  }

  return res.status(200).json({ ok: true });
};
