# crackem.us placeholder

Static pages served at crackem.us while the full site is rebuilt. No build step: Vercel serves them as-is (Framework preset: Other). `vercel.json` turns on clean URLs, so `removedata.html` is served at `/removedata`.

The checkup button links to https://checkup.crackem.us/?src=site so signups from here are tagged "site".

## Privacy policy (`/reviox_privacy_policy`)

Copied word for word from the old WordPress page (last updated November 01, 2021). Keep this URL as is: the app store listings link to it. `/privacy` and the old trailing-slash URL redirect here. Section 13's request link now points to `/removedata`.

## Data removal form (`/removedata`)

Keep this URL as is. Google Play's listing points to it for account deletion requests.

How it works:

1. A user enters their account email and presses Send. `api/removedata.js` emails that address a confirmation link (good for 24 hours). Nothing goes to support yet.
2. The user opens the link and presses "Confirm removal". `api/removedata-confirm.js` checks the link and emails the request to support, with reply-to set to the user's address.

The link is signed, so nothing is stored. Spam protection is a hidden honeypot field, plus Cloudflare Turnstile once its keys are set.

### Environment variables (Vercel → Project → Settings → Environment Variables)

| Name | Required | Value |
| --- | --- | --- |
| `SENDGRID_API_KEY` | yes | SendGrid API key with Mail Send permission |
| `FROM_EMAIL` | yes | A sender verified in SendGrid, e.g. `noreply@crackem.beer` |
| `REMOVEDATA_SECRET` | yes | Any random string of 32+ characters (signs the confirmation links) |
| `SUPPORT_EMAIL` | no | Where confirmed requests go. Defaults to `support@crackem.beer` |
| `SITE_URL` | no | e.g. `https://crackem.us`. Defaults to the host the request came in on |
| `TURNSTILE_SECRET_KEY` | no | Cloudflare Turnstile secret. When set, also put the site key in `TURNSTILE_SITE_KEY` near the bottom of `removedata.html` |

Generate a secret with: `openssl rand -hex 32`
