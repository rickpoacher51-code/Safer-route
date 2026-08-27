(function () {
  "use strict";

  /* ---------- Disclaimer gate ----------
     Versioned key: if the disclaimer text changes materially, bump _v1 to
     _v2 so returning users see the new version once, rather than silently
     carrying forward an acknowledgement of text that no longer exists. */

  const DISCLAIMER_KEY = "saferoute_disclaimer_ack_v1";
  const disclaimerGate = document.getElementById("disclaimer-gate");
  const disclaimerAcceptBtn = document.getElementById("btn-disclaimer-accept");

  if (disclaimerGate) {
    let alreadyAccepted = false;
    try {
      alreadyAccepted = localStorage.getItem(DISCLAIMER_KEY) === "1";
    } catch (e) {
      // Storage unavailable (e.g. private browsing) — show the gate every
      // time in that case rather than silently skip it.
    }

    if (!alreadyAccepted) {
      disclaimerGate.hidden = false;
    }

    if (disclaimerAcceptBtn) {
      disclaimerAcceptBtn.addEventListener("click", () => {
        try {
          localStorage.setItem(DISCLAIMER_KEY, "1");
        } catch (e) {
          // Can't persist it — gate will just show again next visit,
          // not a failure worth blocking on.
        }
        disclaimerGate.hidden = true;
      });
    }
  }

  /* ---------- Tab navigation ---------- */

  const tabs = document.querySelectorAll(".tabbar__item");
  const panels = document.querySelectorAll("[data-panel]");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => {
        t.classList.remove("is-active");
        t.setAttribute("aria-selected", "false");
      });
      panels.forEach((p) => (p.hidden = true));

      tab.classList.add("is-active");
      tab.setAttribute("aria-selected", "true");
      const targetId = tab.dataset.target;
      document.getElementById(targetId).hidden = false;
      window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });

      // Lazy map init — Leaflet renders wrong inside a hidden container, so
      // maps are only created the first time their tab is actually opened,
      // then just resized on later visits.
      if (window.SafeRouteMap) {
        if (targetId === "panel-ae") {
          window.SafeRouteMap.initMap("ae-map", HOSPITALS);
          window.SafeRouteMap.startWatching(["ae-map", "respond-map"]);
          window.SafeRouteMap.refreshMapSize("ae-map");
        } else if (targetId === "panel-respond") {
          window.SafeRouteMap.initMap("respond-map");
          window.SafeRouteMap.startWatching(["ae-map", "respond-map"]);
          window.SafeRouteMap.refreshMapSize("respond-map");
        }
      }
    });
  });

  // A&E is the default-active tab on load, so it never gets a click event —
  // init its map directly rather than only from the tab-switch handler.
  if (window.SafeRouteMap) {
    window.SafeRouteMap.initMap("ae-map", HOSPITALS);
    window.SafeRouteMap.startWatching(["ae-map", "respond-map"]);
  }

  /* ---------- Connectivity indicator ---------- */

  const connEl = document.getElementById("connectivity-indicator");
  function updateConnectivity() {
    connEl.textContent = navigator.onLine ? "Online" : "Offline-ready";
  }
  window.addEventListener("online", updateConnectivity);
  window.addEventListener("offline", updateConnectivity);
  updateConnectivity();

  /* ---------- Distance calc (haversine, km) ---------- */

  function distanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /* ---------- Hospital list rendering ---------- */

  const hospitalListEl = document.getElementById("hospital-list");
  const locateStatus = document.getElementById("locate-status");
  const locateBtn = document.getElementById("btn-locate");
  const aeW3wLink = document.getElementById("ae-w3w-link");

  // NHS Organisation Data Service — open-access, no key, confirmed working
  // via direct browser fetch (no CORS block) and confirmed to support a
  // Name= search returning postcode/status/last-changed. NHS Digital's own
  // docs flag this API as "under review for deprecation" — it's the best
  // free option today, not a guaranteed-permanent one. Rate limit is 5
  // req/sec and it's explicitly "not designed for high volume", which is
  // why this is an on-demand per-card check, not an automatic bulk refresh
  // of the whole list on every load.
  //
  // fetch() has NO default timeout — if this API is slow or unresponsive,
  // the request can hang indefinitely with the button stuck on "Checking…"
  // forever. AbortController forces it to give up after 10 seconds and
  // report a clear failure instead of hanging silently.
  async function checkOdsStatus(hospitalName) {
    const url = `https://directory.spineservices.nhs.uk/ORD/2-0-0/organisations?Name=${encodeURIComponent(
      hospitalName
    )}&Status=Active`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let res;
    try {
      res = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    } catch (e) {
      if (e.name === "AbortError") {
        throw new Error("ODS request timed out");
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) throw new Error("ODS request failed");
    const json = await res.json();
    const orgs = (json && json.Organisations) || [];
    if (!orgs.length) return null;
    // Prefer the actual site record (RO198, "NHS TRUST SITE") over the
    // parent trust's own legal-entity record if both come back — the site
    // is the one with a postcode that actually matches a physical building.
    const site = orgs.find((o) => o.PrimaryRoleId === "RO198") || orgs[0];
    return site;
  }

  function renderHospitals(list, userCoords) {
    hospitalListEl.innerHTML = "";
    list.forEach((h) => {
      const li = document.createElement("li");
      li.className = "hospital-card";

      const distanceLabel = userCoords
        ? `${distanceKm(userCoords.lat, userCoords.lng, h.lat, h.lng).toFixed(1)} km`
        : "";

      // dir (not search) — this actually starts turn-by-turn navigation.
      // No origin specified: Google Maps defaults to the device's current
      // location automatically, same as it does for a native Directions
      // tap, and independent of whether this app's own "Use my location"
      // has been granted — Maps handles that permission itself if needed.
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}`;

      li.innerHTML = `
        <div class="hospital-card__top">
          <span class="hospital-card__name">${h.name}</span>
          ${distanceLabel ? `<span class="hospital-card__distance">${distanceLabel}</span>` : ""}
        </div>
        <p class="hospital-card__address">${h.address}</p>
        <div class="hospital-card__actions">
          <a href="${mapsUrl}" target="_blank" rel="noopener">Directions</a>
          <a class="secondary" href="tel:${h.phone}">Call</a>
        </div>
        <div class="hospital-card__secondary-actions">
          <button class="show-on-map-btn" type="button" data-hospital="${h.name.replace(/"/g, "&quot;")}">Show on map</button>
          <button class="verify-btn" type="button" data-hospital="${h.name.replace(/"/g, "&quot;")}">Check live NHS status</button>
        </div>
        <p class="verify-result" hidden></p>
      `;
      hospitalListEl.appendChild(li);
    });
  }

  hospitalListEl.addEventListener("click", async (e) => {
    const mapBtn = e.target.closest(".show-on-map-btn");
    if (mapBtn) {
      if (window.SafeRouteMap) window.SafeRouteMap.focusHospital("ae-map", mapBtn.dataset.hospital);
      const mapEl = document.getElementById("ae-map");
      if (mapEl) mapEl.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const btn = e.target.closest(".verify-btn");
    if (!btn) return;
    const resultEl = btn.closest(".hospital-card").querySelector(".verify-result");
    if (!resultEl) return;
    btn.disabled = true;
    btn.textContent = "Checking…";
    resultEl.hidden = false;
    resultEl.textContent = "";

    try {
      const site = await checkOdsStatus(btn.dataset.hospital);
      if (!site) {
        resultEl.textContent = "Not found in the NHS register under this name — verify manually via nhs.uk/service-search.";
      } else {
        resultEl.innerHTML = `<strong>${site.Status}</strong> — postcode ${site.PostCode}, NHS record last updated ${site.LastChangeDate}.`;
      }
    } catch (err) {
      resultEl.textContent =
        err.message === "ODS request timed out"
          ? "The NHS register took too long to respond — it may be slow right now. Try again, or use nhs.uk/service-search directly."
          : "Couldn't reach the live NHS register right now — try again, or use nhs.uk/service-search directly.";
    } finally {
      btn.disabled = false;
      btn.textContent = "Check live NHS status";
    }
  });

  // Initial render, unsorted, so the list isn't empty before location is granted.
  renderHospitals(HOSPITALS, null);

  locateBtn.addEventListener("click", () => {
    if (!("geolocation" in navigator)) {
      locateStatus.textContent = "Location isn't available on this device or browser.";
      return;
    }
    locateStatus.textContent = "Finding your location…";
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const sorted = [...HOSPITALS].sort(
          (a, b) =>
            distanceKm(userCoords.lat, userCoords.lng, a.lat, a.lng) -
            distanceKm(userCoords.lat, userCoords.lng, b.lat, b.lng)
        );
        renderHospitals(sorted, userCoords);
        locateStatus.textContent = "Sorted by distance from your location, nearest first.";

        // what3words as an option here too, same pattern as the Respond tab —
        // helpful if you need to describe exactly where you are relative to
        // a hospital, not just get directions to one.
        if (aeW3wLink) {
          if (W3W_API_KEY) {
            try {
              const res = await fetch(
                `https://api.what3words.com/v3/convert-to-3wa?coordinates=${userCoords.lat},${userCoords.lng}&key=${W3W_API_KEY}&format=json`
              );
              const json = await res.json();
              if (json && json.words) {
                aeW3wLink.textContent = `///${json.words} — open in what3words →`;
                aeW3wLink.href = `https://what3words.com/${json.words}`;
                aeW3wLink.hidden = false;
              }
            } catch (e) {
              aeW3wLink.hidden = true;
            }
          } else {
            aeW3wLink.textContent = "Open my location in what3words →";
            aeW3wLink.href = `https://what3words.com/${userCoords.lat},${userCoords.lng}`;
            aeW3wLink.hidden = false;
          }
        }
      },
      (err) => {
        locateStatus.textContent =
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — showing unsorted list. You can still search manually."
            : "Couldn't get your location — this can happen on laptops without GPS, which rely on slower WiFi-based positioning. Try again, ideally with WiFi on.";
      },
      // 20s, not 10 — WiFi-based positioning (laptops with no GPS chip) can
      // genuinely take longer than GPS does on a phone. maximumAge: 30000
      // lets it accept a position obtained up to 30s ago instead of always
      // forcing a brand new fix, which helps a retry succeed faster.
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 }
    );
  });

  /* ---------- Accordions (first aid / on foot / on the move) ---------- */

  function buildAccordion(containerId, items, opts) {
    opts = opts || {};
    const container = document.getElementById(containerId);
    items.forEach((item) => {
      const wrap = document.createElement("div");
      wrap.className = "accordion-item";

      const tagHtml = opts.showCriticalTag
        ? item.critical
          ? `<span class="tag tag--critical">Critical</span>`
          : `<span class="tag tag--general">General</span>`
        : "";

      const stepsHtml = item.steps.map((s) => `<li>${s}</li>`).join("");
      const noteHtml = item.note ? `<p class="step-note">${item.note}</p>` : "";
      const sjaHtml = item.sjaLink
        ? `<a class="sja-link" href="${item.sjaLink}" target="_blank" rel="noopener">Full guide at St John Ambulance →</a>`
        : "";

      wrap.innerHTML = `
        <button class="accordion-item__trigger">
          <span>${tagHtml}${item.title}</span>
          <span class="chev" aria-hidden="true">▾</span>
        </button>
        <div class="accordion-item__panel">
          <ol>${stepsHtml}</ol>
          ${noteHtml}
          ${sjaHtml}
        </div>
      `;

      wrap.querySelector(".accordion-item__trigger").addEventListener("click", () => {
        wrap.classList.toggle("is-open");
      });

      container.appendChild(wrap);
    });
  }

  buildAccordion("first-aid-accordion", FIRST_AID, { showCriticalTag: true });
  buildAccordion("walking-accordion", WALKING, {});
  buildAccordion("travel-accordion", TRAVEL, {});
  buildAccordion("respond-accordion", RESPOND, { showCriticalTag: true });

  /* ---------- Respond tab: trusted contact + direct SMS location text ----------
     Stored in localStorage, plaintext — same disclosed limitation as the rest
     of the Prepare tab's data, not encrypted like the duress word. A name and
     phone number on their own aren't in the same risk category as a duress
     word, but say so plainly rather than let it go unstated.
     ------------------------------------------------------------------------ */

  const CONTACT_KEY = "saferoute_trusted_contact";
  const contactForm = document.getElementById("contact-form");
  const contactNameInput = document.getElementById("contact-name");
  const contactPhoneInput = document.getElementById("contact-phone");
  const contactStatus = document.getElementById("contact-status");
  const textLocationBtn = document.getElementById("btn-text-location");
  const textLocationStatus = document.getElementById("text-location-status");

  function loadContact() {
    try {
      return JSON.parse(localStorage.getItem(CONTACT_KEY)) || null;
    } catch (e) {
      return null;
    }
  }

  function refreshTextButtonLabel() {
    const contact = loadContact();
    if (contact && contact.name && contact.phone) {
      textLocationBtn.disabled = false;
      textLocationBtn.textContent = `Text my location to ${contact.name}`;
    } else {
      textLocationBtn.disabled = true;
      textLocationBtn.textContent = "Set a trusted contact to enable texting your location";
    }
  }

  if (contactForm) {
    // Pre-fill the form if a contact is already saved, so re-opening the
    // tab doesn't look like it forgot what you set.
    const existing = loadContact();
    if (existing) {
      contactNameInput.value = existing.name || "";
      contactPhoneInput.value = existing.phone || "";
    }

    contactForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = contactNameInput.value.trim();
      const phone = contactPhoneInput.value.trim();
      if (!name || !phone) {
        contactStatus.textContent = "Enter both a name and a phone number.";
        return;
      }
      try {
        localStorage.setItem(CONTACT_KEY, JSON.stringify({ name, phone }));
        contactStatus.textContent = "Contact saved on this device.";
      } catch (e) {
        contactStatus.textContent = "Couldn't save — storage may be full or unavailable.";
      }
      refreshTextButtonLabel();
    });
  }

  refreshTextButtonLabel();

  if (textLocationBtn) {
    textLocationBtn.addEventListener("click", () => {
      const contact = loadContact();
      if (!contact) return; // button is disabled in this state, belt and braces

      if (!("geolocation" in navigator)) {
        textLocationStatus.textContent = "Location isn't available on this device or browser.";
        return;
      }
      textLocationStatus.textContent = "Finding your location…";

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const body =
            `My location: ${lat.toFixed(6)}, ${lng.toFixed(6)}\n` +
            `https://what3words.com/${lat},${lng}\n\n(sent via SafeRoute)`;

          // The phone number must NOT be percent-encoded the way the body
          // is — a literal "+" needs to stay a literal "+" for the phone's
          // SMS handler to recognise it as a recipient. encodeURIComponent
          // turns "+" into "%2B", which some phones then fail to parse as a
          // valid number, leaving the "to" field empty even though the
          // message body comes through fine. Strip spaces/dashes/brackets
          // instead of encoding, and leave the leading "+" untouched.
          const cleanPhone = contact.phone.replace(/[\s\-()]/g, "");

          // sms: URI separator is inconsistent across platforms — "?body="
          // is what current iOS Safari and Android Chrome both accept; some
          // older Android builds historically wanted ";body=" instead. If
          // this opens Messages with an empty body on a given phone, that
          // platform quirk is the reason, not a broken location fetch.
          const smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(body)}`;
          textLocationStatus.textContent = `Opening a text to ${contact.name}…`;
          window.location.href = smsUrl;
        },
        (err) => {
          textLocationStatus.textContent =
            err.code === err.PERMISSION_DENIED
              ? "Location permission denied."
              : "Couldn't get your location — this can happen on laptops without GPS. Try again.";
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 }
      );
    });
  }

  /* ---------- Respond tab: exact location sharing ---------- */

  const shareLocationBtn = document.getElementById("btn-share-location");
  const respondStatus = document.getElementById("respond-locate-status");
  const coordReadout = document.getElementById("coord-readout");
  const coordValueEl = document.getElementById("coord-value");
  const copyCoordsBtn = document.getElementById("btn-copy-coords");
  const nativeShareBtn = document.getElementById("btn-share-native");
  const w3wLink = document.getElementById("w3w-link");

  let lastCoords = null;

  if (shareLocationBtn) {
    shareLocationBtn.addEventListener("click", () => {
      if (!("geolocation" in navigator)) {
        respondStatus.textContent = "Location isn't available on this device or browser.";
        return;
      }
      respondStatus.textContent = "Finding your location…";

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          lastCoords = { lat, lng };

          coordValueEl.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          coordReadout.hidden = false;
          respondStatus.textContent =
            "Location found. These coordinates work with or without what3words — you can read them directly to a 999 operator.";

          if (navigator.share) nativeShareBtn.hidden = false;

          if (W3W_API_KEY) {
            try {
              const res = await fetch(
                `https://api.what3words.com/v3/convert-to-3wa?coordinates=${lat},${lng}&key=${W3W_API_KEY}&format=json`
              );
              const json = await res.json();
              if (json && json.words) {
                w3wLink.textContent = `///${json.words} — open in what3words →`;
                w3wLink.href = `https://what3words.com/${json.words}`;
                w3wLink.hidden = false;
              } else {
                w3wLink.hidden = true;
              }
            } catch (e) {
              // API call failed — coordinates above remain the reliable fallback.
              w3wLink.hidden = true;
            }
          } else {
            // No API key configured: hand off to what3words' own site to
            // resolve the words. See the note in data.js about this link
            // pattern not being independently verified.
            w3wLink.textContent = "Open exact location in what3words →";
            w3wLink.href = `https://what3words.com/${lat},${lng}`;
            w3wLink.hidden = false;
          }
        },
        (err) => {
          respondStatus.textContent =
            err.code === err.PERMISSION_DENIED
              ? "Location permission denied — you can still describe landmarks to a 999 operator."
              : "Couldn't get your location — this can happen on laptops without GPS, which rely on slower WiFi-based positioning. Try again, ideally with WiFi on.";
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 }
      );
    });
  }

  if (copyCoordsBtn) {
    copyCoordsBtn.addEventListener("click", async () => {
      if (!lastCoords) return;
      const text = `${lastCoords.lat.toFixed(6)}, ${lastCoords.lng.toFixed(6)}`;
      try {
        await navigator.clipboard.writeText(text);
        respondStatus.textContent = "Coordinates copied.";
      } catch (e) {
        respondStatus.textContent = "Couldn't copy — the coordinates above are visible, read them out directly.";
      }
    });
  }

  if (nativeShareBtn) {
    nativeShareBtn.addEventListener("click", () => {
      if (!lastCoords || !navigator.share) return;
      navigator
        .share({
          title: "My location",
          text: `My location: ${lastCoords.lat.toFixed(6)}, ${lastCoords.lng.toFixed(6)}`,
          url: `https://what3words.com/${lastCoords.lat},${lastCoords.lng}`,
        })
        .catch(() => {
          // User cancelled the share sheet — not an error.
        });
    });
  }

  /* ---------- Service worker (offline support) ---------- */

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      // updateViaCache: "none" makes the browser always fetch service-worker.js
      // itself fresh over the network when checking for updates, rather than
      // potentially reusing an HTTP-cached copy and never noticing a new
      // version exists. Without this, GitHub Pages' own cache headers can
      // hide an update for several minutes even across repeated reloads.
      navigator.serviceWorker
        .register("service-worker.js", { updateViaCache: "none" })
        .catch(() => {
          // Fails silently — app still works online without offline caching.
        });

      // Once a new service worker actually takes control, reload once so
      // the page picks up the fresh assets automatically — no more manual
      // "delete and re-add to home screen" needed for future updates.
      let hasReloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (hasReloaded) return;
        hasReloaded = true;
        window.location.reload();
      });
    });
  }
})();
