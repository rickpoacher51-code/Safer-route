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
      document.getElementById(tab.dataset.target).hidden = false;
      window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    });
  });

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
      `;
      hospitalListEl.appendChild(li);
    });
  }

  // Initial render, unsorted, so the list isn't empty before location is granted.
  renderHospitals(HOSPITALS, null);

  locateBtn.addEventListener("click", () => {
    if (!("geolocation" in navigator)) {
      locateStatus.textContent = "Location isn't available on this device or browser.";
      return;
    }
    locateStatus.textContent = "Finding your location…";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const sorted = [...HOSPITALS].sort(
          (a, b) =>
            distanceKm(userCoords.lat, userCoords.lng, a.lat, a.lng) -
            distanceKm(userCoords.lat, userCoords.lng, b.lat, b.lng)
        );
        renderHospitals(sorted, userCoords);
        locateStatus.textContent = "Sorted by distance from your location.";
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

      wrap.innerHTML = `
        <button class="accordion-item__trigger">
          <span>${tagHtml}${item.title}</span>
          <span class="chev" aria-hidden="true">▾</span>
        </button>
        <div class="accordion-item__panel">
          <ol>${stepsHtml}</ol>
          ${noteHtml}
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

  /* ---------- Service worker (offline support) ---------- */

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {
        // Fails silently — app still works online without offline caching.
      });
    });
  }
})();
