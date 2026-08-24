(function () {
  "use strict";

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
  async function checkOdsStatus(hospitalName) {
    const url = `https://directory.spineservices.nhs.uk/ORD/2-0-0/organisations?Name=${encodeURIComponent(
      hospitalName
    )}&Status=Active`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
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

      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${h.lat},${h.lng}`;

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
        <button class="verify-btn" type="button" data-hospital="${h.name.replace(/"/g, "&quot;")}">Check live NHS status</button>
        <p class="verify-result" hidden></p>
      `;
      hospitalListEl.appendChild(li);
    });
  }

  hospitalListEl.addEventListener("click", async (e) => {
    const btn = e.target.closest(".verify-btn");
    if (!btn) return;
    const resultEl = btn.nextElementSibling;
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
      resultEl.textContent = "Couldn't reach the live NHS register right now — try again, or use nhs.uk/service-search directly.";
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
            : "Couldn't get your location — showing unsorted list.";
      },
      { enableHighAccuracy: true, timeout: 10000 }
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
              : "Couldn't get your location.";
        },
        { enableHighAccuracy: true, timeout: 10000 }
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
      navigator.serviceWorker.register("service-worker.js").catch(() => {
        // Fails silently — app still works online without offline caching.
      });
    });
  }
})();
