(function () {
  "use strict";

  /* ==========================================================================
     Live position map ("my location", blue dot). Uses Leaflet + OpenStreetMap
     tiles loaded from a CDN — this is the one part of the app that needs an
     internet connection to actually render (tiles are images, can't be
     meaningfully cached offline). Everything else in the app keeps working
     without it; a missing map here degrades to a text message, not a crash.

     This is a continuously-updating position (navigator.geolocation.
     watchPosition), not a one-off "where am I right now" snapshot — that's
     the actual difference from the existing "Use my location" buttons
     elsewhere, and it's what makes this behave like the blue dot on Apple/
     Google Maps rather than a single GPS read.
     ========================================================================== */

  const MAP_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const MAP_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

  let watchId = null;
  const activeMaps = {}; // containerId -> { map, dotMarker, accuracyCircle }

  function leafletLoaded() {
    return typeof L !== "undefined";
  }

  function blueDotIcon() {
    return L.divIcon({
      className: "my-location-dot",
      iconSize: [18, 18],
      html: `<span class="my-location-dot__pulse"></span><span class="my-location-dot__core"></span>`,
    });
  }

  // Initialises a map in the given container. Safe to call more than once —
  // returns the existing instance if already set up. hospitals is optional:
  // an array of {name, address, lat, lng} to plot as markers (A&E tab only).
  function initMap(containerId, hospitals) {
    if (activeMaps[containerId]) return activeMaps[containerId];

    const el = document.getElementById(containerId);
    if (!el) return null;

    if (!leafletLoaded()) {
      el.innerHTML = `<p class="map-fallback">Map couldn't load — this needs an internet connection. Location sorting and sharing above still work without it.</p>`;
      return null;
    }

    let map;
    try {
      map = L.map(containerId, { zoomControl: true }).setView([52.55, -1.5], 6);
      L.tileLayer(MAP_TILE_URL, { attribution: MAP_ATTRIBUTION, maxZoom: 19 }).addTo(map);
    } catch (e) {
      el.innerHTML = `<p class="map-fallback">Map couldn't load.</p>`;
      return null;
    }

    const entry = { map, dotMarker: null, accuracyCircle: null, hospitalMarkers: {} };
    activeMaps[containerId] = entry;

    if (hospitals && hospitals.length) {
      hospitals.forEach((h) => {
        const marker = L.marker([h.lat, h.lng])
          .addTo(map)
          .bindPopup(`<strong>${h.name}</strong><br>${h.address}`);
        entry.hospitalMarkers[h.name] = marker;
      });
    }

    return entry;
  }

  // Pans/zooms the map to a specific hospital's marker and opens its popup —
  // used when the user taps "Show on map" on a hospital card in the list.
  function focusHospital(containerId, hospitalName) {
    const entry = activeMaps[containerId];
    if (!entry || !entry.hospitalMarkers) return;
    const marker = entry.hospitalMarkers[hospitalName];
    if (!marker) return;
    entry.map.setView(marker.getLatLng(), 15);
    marker.openPopup();
  }

  // Call after a map's container becomes visible (e.g. its tab is opened) —
  // Leaflet renders tiles wrong if initialised inside a hidden [display:none]
  // element, this fixes the sizing once it's actually on screen.
  function refreshMapSize(containerId) {
    const entry = activeMaps[containerId];
    if (entry) entry.map.invalidateSize();
  }

  function updateDot(containerId, lat, lng, accuracy) {
    const entry = activeMaps[containerId];
    if (!entry) return;
    if (!entry.dotMarker) {
      entry.dotMarker = L.marker([lat, lng], { icon: blueDotIcon(), zIndexOffset: 1000 }).addTo(entry.map);
      entry.map.setView([lat, lng], 15);
    } else {
      entry.dotMarker.setLatLng([lat, lng]);
    }
    if (accuracy) {
      if (!entry.accuracyCircle) {
        entry.accuracyCircle = L.circle([lat, lng], {
          radius: accuracy,
          className: "my-location-accuracy",
        }).addTo(entry.map);
      } else {
        entry.accuracyCircle.setLatLng([lat, lng]).setRadius(accuracy);
      }
    }
  }

  // Starts (or continues) watching position and updating the blue dot on
  // every map container in containerIds. One watch covers every map — no
  // need for a separate GPS stream per tab.
  function startWatching(containerIds) {
    if (!("geolocation" in navigator)) return;
    if (watchId !== null) return;
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        containerIds.forEach((id) => {
          if (activeMaps[id]) {
            updateDot(id, pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
          }
        });
      },
      () => {
        // Permission denied or unavailable — map still shows, just without
        // a live dot. The existing "Use my location" / "Share my exact
        // location" buttons elsewhere are unaffected by this failing.
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  }

  function stopWatching() {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  }

  window.SafeRouteMap = { initMap, refreshMapSize, startWatching, stopWatching, focusHospital };
})();
