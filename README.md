# SafeRoute — MVP (Option B scope)

Static PWA. No backend, no build step, no external network dependency at runtime.
Same pattern as Close Protection Ops: vanilla JS, deployable straight to GitHub Pages.

## What's actually in this build

- **A&E finder** — geolocation-based distance sort against a hardcoded
  ~28-hospital dataset (`data.js`). This is a **starter dataset, not verified
  against the NHS Organisation Data Service**. It is flagged as such directly
  in the app UI. Do not represent this as authoritative before it's replaced
  with a real, refreshable NHS data source.
- **First aid** — 7 modules (choking, CPR, severe bleeding, burns, seizure,
  anaphylaxis, unresponsive/recovery position). Written fresh for this app,
  not copied from St John Ambulance / British Red Cross material — so there's
  no licensing dependency blocking you shipping this, but it also means it
  has **not been clinically reviewed**. Treat this as a placeholder for
  properly sourced/licensed content, not a finished deliverable.
- **On Foot** — pedestrian/lone-walking awareness, 3 modules.
- **On the Move** — driving and public transport awareness, 5 modules,
  including the Silent Solution (999 + 55) and BTP 61016 text line.
- **Respond** — exact location sharing (raw GPS coordinates, always
  accurate, zero dependencies) plus what3words hand-off, and 4 threat
  guidance modules: unwanted approaches, carjacking, terrorist incident
  (Run, Hide, Tell), and reporting something suspicious.

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
