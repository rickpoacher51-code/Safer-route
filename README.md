# SafeRoute — MVP (Option B scope)

Static PWA. No backend, no build step, no external network dependency at runtime.
Same pattern as Close Protection Ops: vanilla JS, deployable straight to GitHub Pages.

## What's actually in this build

- **A&E finder** — geolocation-based distance sort against a hardcoded
  ~28-hospital dataset (`data.js`). This is a **starter dataset, not verified
  against the NHS Organisation Data Service**. It is flagged as such directly
  in the app UI. Do not represent this as authoritative before it's replaced
  with a real, refreshable NHS data source.
- **First aid** — 9 modules (choking, CPR, severe bleeding, stabbing, gunshot
  wound, burns, seizure, anaphylaxis, unresponsive/recovery position).
  Written for this app, structurally checked against British Red Cross,
  citizenAID and accredited UK first-aid provider guidance rather than
  written from memory alone — but still **not clinically reviewed or
  licensed**. Treat this as a well-sourced placeholder, not a finished
  deliverable.
- **On Foot** — pedestrian/lone-walking awareness, 3 modules.
- **On the Move** — driving and public transport awareness, 5 modules,
  including the Silent Solution (999 + 55) and BTP 61016 text line.
- **Respond** — exact location sharing (raw GPS coordinates, always
  accurate, zero dependencies) plus what3words hand-off, and 4 threat
  guidance modules: unwanted approaches, carjacking, terrorist incident
  (Run, Hide, Tell), and reporting something suspicious.
- **Prepare** — three planning tools, the actual differentiator: route/venue
  recce checklist (entry/exit points, choke points, nearest help, RV if
  separated), a family/group RV point and duress word planner (duress word
  is PIN-encrypted, AES-GCM via PBKDF2 — see below), and a guided "baseline
  awareness" tool (pick a setting, actively answer prompts about what's
  normal there, rather than read static bullets). All three persist locally
  via `localStorage` and are editable/deletable. Saved recce and RV plans
  each have a "Share plan" button (native share sheet, clipboard-copy
  fallback) so a plan can be sent to someone else before you go —
  **`rvToShareText` takes only the four non-sensitive fields as arguments,
  not the record itself, so the duress word has no code path into shared
  text, now or after a future edit.** If that function's signature ever
  changes to take the whole record instead, treat that as a regression to
  catch in review, not a convenience.
- **Live position map ("my location")** — a continuously-updating blue dot
  (Leaflet + OpenStreetMap tiles, `navigator.geolocation.watchPosition`),
  shown on the A&E tab alongside hospital markers and on the Respond tab to
  visually confirm your position before sharing it. **This is the one part
  of the app that needs an internet connection** — map tiles are images,
  there's no meaningful way to cache a useful area offline in a static PWA.
  Everything else degrades gracefully without it; the map itself shows a
  plain text fallback message instead of crashing if Leaflet or the tiles
  fail to load.
- **Trusted contact + direct location text** — set a name and phone number
  once (Respond tab, `localStorage`, plaintext — not encrypted, disclosed
  same as recce/RV plan data below), and a one-tap button texts your
  current coordinates plus a what3words link straight to them via an
  `sms:` link — no OS share sheet, no picking a recipient each time.
  **Desktop browsers do not support `sms:` links** — this only works on an
  actual phone. Testing it on a Mac/PC will silently do nothing; that's
  expected, not a bug. The `sms:` URI's body-parameter separator
  (`?body=` vs `;body=`) also isn't fully standardised across every
  Android build — if a specific phone opens Messages with an empty body,
  that's the platform, not a broken location fetch.
- **Live NHS status check** — a "Check live NHS status" button per hospital
  card, on-demand only (not automatic), queries the NHS Organisation Data
  Service by name and shows current postcode, active/closed status, and
  when NHS last updated the record. See the caveat below before treating
  this as a permanent feature.

### NHS Organisation Data Service (ORD API)

Free, no key required, confirmed working via direct browser `fetch()` with
no CORS block. Used only for the on-demand "Check live NHS status" button —
not for expanding the hospital list's geographic coverage, and not
automatically on page load (rate limit is 5 requests/second and NHS Digital
describe it as "not designed for high volume usage").

**Two real limits, not hypothetical ones:**
1. NHS Digital's own documentation for this API says it's **"under review
   for deprecation."** It's the best free option available today, not a
   guaranteed-permanent one. If it stops responding, the "Check live NHS
   status" button should fail gracefully to its error message — verify that
   still happens if/when NHS actually retires this.
2. There is **no clean "has an A&E department" filter** in this API — role
   codes classify organisation type (trust, trust site, GP practice,
   pathology lab), not service type. This is why the hospital *list* is
   still the same ~28 hand-picked entries from the original starter
   dataset, not a live search across all of England — a true "find A&E
   near me nationwide" would need a second data source this project
   doesn't currently have access to.

### what3words

No API key is wired in by default. Without one, the app shows raw
coordinates (reliable, works today) and links out to what3words.com to
resolve the words — that deep-link URL pattern is commonly used but has
**not been independently verified** against their current site behaviour.
To get a guaranteed-accurate three-word result shown directly in the app:

1. Register a free account at developer.what3words.com
2. Check their current API terms and rate limits before relying on it for
   anything beyond low-volume personal use
3. Paste the key into `W3W_API_KEY` at the top of `data.js`
4. Consider domain-restricting the key from their dashboard — it's visible
   in the page source on a static site like this one

## What's deliberately NOT in this build

- Live incidents feed — no verified data source identified, see prior
  discussion. Do not add a fake/placeholder feed; an app that looks live but
  isn't is worse than no feature.
- Safe havens directory — undefined term, no data source. Needs a defined
  scheme (council/BID partnership) before this is buildable responsibly.

## Before this goes anywhere near the public

1. Replace the hospital dataset with a verified, refreshable NHS source.
2. Get the first aid content reviewed — either license St John
   Ambulance/British Red Cross content properly, or have it checked by
   someone clinically qualified. Right now it's "sounds right," not "signed
   off."
2a. Verify the Run, Hide, Tell content in the Respond tab against the
   current official wording at protectuk.police.uk before this goes
   anywhere near the public. It's reproduced from memory of the published
   framework, attributed, not pasted from a live source — check it.
2b. **Duress words are now PIN-encrypted** (AES-GCM, PBKDF2-derived key,
   100,000 iterations) — closed, for that one field. Recce notes and the
   rest of the RV plan (name, members, RV points, contact) are still
   plaintext in `localStorage`, unencrypted, no PIN. Decide if that's
   acceptable before this goes to anyone but you — a PIN on just the
   duress word protects the one thing whose entire value depends on
   secrecy, but doesn't protect where you're planning to be or who you're
   meeting. If that needs covering too, that's the CP Ops-style full-tab
   lock, not this.
3. Solicitor review of the disclaimers in `index.html` (same gate you set
   for CP Ops — this app carries more public-facing liability, not less).
4. Decide on professional indemnity insurance coverage for a consumer safety
   app specifically, separate from any CP Ops cover.
5. Host a real privacy policy — geolocation is requested but never
   transmitted or stored anywhere in this build (it's used client-side only,
   for the distance sort), but you should say so in writing somewhere
   findable.

## Deploy

Push this folder to a GitHub repo, enable GitHub Pages on the main branch.
No build step, no dependencies, no API keys required.

## Icons

`icon-192.png` / `icon-512.png` are placeholder marks generated for this
build (dark square, red cross). Swap for real brand icons before launch.
