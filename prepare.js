(function () {
  "use strict";

  /* ==========================================================================
     Storage helpers. Everything here is localStorage — on-device only,
     nothing transmitted. See README for the outstanding gap: this data
     isn't encrypted or PIN-protected, and it probably should be before
     this app is used by anyone other than you.
     ========================================================================== */

  function loadList(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveList(key, list) {
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch (e) {
      // Storage full or unavailable (e.g. private browsing) — fail silently,
      // the form still works for the current session even if it can't persist.
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  // Shares (native share sheet) or copies (fallback) a plain-text summary
  // of a saved plan — used by both recce and RV cards. Never called with
  // duress-word content; see rvToShareText below, which excludes it by
  // construction rather than by a flag someone could accidentally leave on.
  async function sharePlanText(title, text, statusEl) {
    if (navigator.share) {
      try {
        await navigator.share({ title, text });
        return;
      } catch (e) {
        // User cancelled the share sheet, or share failed — fall through
        // to clipboard as a working fallback rather than doing nothing.
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      if (statusEl) {
        statusEl.textContent = "Copied to clipboard.";
        setTimeout(() => {
          statusEl.textContent = "";
        }, 4000);
      }
    } catch (e) {
      if (statusEl) statusEl.textContent = "Couldn't share or copy — select and copy the text manually.";
    }
  }

  // Shared delete handler for every saved-card list in this tab.
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".saved-card__delete");
    if (!btn) return;
    const store = btn.dataset.store;
    const id = btn.dataset.id;
    const list = loadList(store).filter((item) => item.id !== id);
    saveList(store, list);
    if (store === RECCE_KEY) renderRecceList();
    if (store === RV_KEY) renderRvList();
    if (store === BASELINE_KEY) renderBaselineNotes();
  });

  /* ==========================================================================
     Route & venue recce
     ========================================================================== */

  const RECCE_KEY = "saferoute_recces";

  function renderRecceList() {
    const el = document.getElementById("recce-list");
    if (!el) return;
    const list = loadList(RECCE_KEY);
    if (!list.length) {
      el.innerHTML = `<li class="saved-list__empty">No recces saved yet.</li>`;
      return;
    }
    el.innerHTML = list
      .slice()
      .reverse()
      .map((r) => {
        const row = (label, val) =>
          val ? `<p><strong>${label}:</strong> ${escapeHtml(val)}</p>` : "";
        return `
          <li class="saved-card">
            <div class="saved-card__top">
              <span class="saved-card__title">${escapeHtml(r.venue)}</span>
              <button class="saved-card__delete" data-id="${r.id}" data-store="${RECCE_KEY}" aria-label="Delete">✕</button>
            </div>
            ${r.when ? `<p class="saved-card__meta">${escapeHtml(r.when)}</p>` : ""}
            ${row("In", r.entry)}
            ${row("Out", r.exit)}
            ${row("Choke points", r.chokepoints)}
            ${row("Nearest help", r.help)}
            ${row("If separated", r.rv)}
            ${row("Notes", r.notes)}
            <button class="share-btn" type="button" data-share-recce="${r.id}">Share plan</button>
            <p class="share-status" hidden></p>
          </li>
        `;
      })
      .join("");
  }

  // Every field here is safe to share — the recce form never collects
  // anything as sensitive as the RV form's duress word.
  function recceToShareText(r) {
    const lines = [`SafeRoute recce — ${r.venue}`];
    if (r.when) lines.push(`When: ${r.when}`);
    if (r.entry) lines.push(`Entry: ${r.entry}`);
    if (r.exit) lines.push(`Exit: ${r.exit}`);
    if (r.chokepoints) lines.push(`Choke points: ${r.chokepoints}`);
    if (r.help) lines.push(`Nearest help: ${r.help}`);
    if (r.rv) lines.push(`If separated, meet at: ${r.rv}`);
    if (r.notes) lines.push(`Notes: ${r.notes}`);
    return lines.join("\n");
  }

  document.addEventListener("click", (e) => {
    const shareBtn = e.target.closest("[data-share-recce]");
    if (!shareBtn) return;
    const id = shareBtn.dataset.shareRecce;
    const record = loadList(RECCE_KEY).find((r) => r.id === id);
    if (!record) return;
    const statusEl = shareBtn.closest(".saved-card").querySelector(".share-status");
    if (statusEl) statusEl.hidden = false;
    sharePlanText(`SafeRoute recce — ${record.venue}`, recceToShareText(record), statusEl);
  });

  const recceForm = document.getElementById("recce-form");
  if (recceForm) {
    recceForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const list = loadList(RECCE_KEY);
      list.push({
        id: Date.now().toString(36),
        venue: document.getElementById("recce-venue").value.trim(),
        when: document.getElementById("recce-when").value.trim(),
        entry: document.getElementById("recce-entry").value.trim(),
        exit: document.getElementById("recce-exit").value.trim(),
        chokepoints: document.getElementById("recce-chokepoints").value.trim(),
        help: document.getElementById("recce-help").value.trim(),
        rv: document.getElementById("recce-rv").value.trim(),
        notes: document.getElementById("recce-notes").value.trim(),
      });
      saveList(RECCE_KEY, list);
      recceForm.reset();
      renderRecceList();
    });
  }

  /* ==========================================================================
     RV point & duress word
     ---
     Every field here saves in plaintext, same as before — except the duress
     word, which is encrypted with a key derived from a PIN via PBKDF2
     (100,000 iterations, SHA-256) and stored as AES-GCM ciphertext, not as
     plain text. Nothing is stored that lets the PIN itself be recovered:
     the "check" value below exists only to detect a wrong PIN, using
     AES-GCM's own authentication tag rather than a separate weaker hash.
     Requires a secure context (HTTPS or localhost) for crypto.subtle —
     GitHub Pages serves HTTPS, so this is fine once deployed.
     ========================================================================== */

  const RV_KEY = "saferoute_rv_plans";
  const PIN_META_KEY = "saferoute_duress_pin_meta";
  const PIN_CHECK_PHRASE = "saferoute-duress-check-v1";
  const PBKDF2_ITERATIONS = 100000;

  let cachedKey = null; // memory-only for this tab session, never persisted

  function cryptoAvailable() {
    return !!(window.crypto && window.crypto.subtle);
  }

  function bufToB64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  }

  function b64ToBuf(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  async function deriveKey(pin, saltB64) {
    const salt = new Uint8Array(b64ToBuf(saltB64));
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      "raw",
      enc.encode(pin),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  function hasPinConfigured() {
    return !!localStorage.getItem(PIN_META_KEY);
  }

  async function setupPin(pin) {
    const saltBuf = crypto.getRandomValues(new Uint8Array(16));
    const saltB64 = bufToB64(saltBuf.buffer);
    const key = await deriveKey(pin, saltB64);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const ct = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      enc.encode(PIN_CHECK_PHRASE)
    );
    localStorage.setItem(
      PIN_META_KEY,
      JSON.stringify({ salt: saltB64, checkIv: bufToB64(iv.buffer), checkCt: bufToB64(ct) })
    );
    cachedKey = key;
    return key;
  }

  async function verifyPin(pin) {
    const metaRaw = localStorage.getItem(PIN_META_KEY);
    if (!metaRaw) return null;
    const meta = JSON.parse(metaRaw);
    try {
      const key = await deriveKey(pin, meta.salt);
      const iv = new Uint8Array(b64ToBuf(meta.checkIv));
      const ptBuf = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        b64ToBuf(meta.checkCt)
      );
      // AES-GCM's auth tag already rejects a wrong key by throwing before
      // we get here — this string check is just belt-and-braces.
      if (new TextDecoder().decode(ptBuf) === PIN_CHECK_PHRASE) {
        cachedKey = key;
        return key;
      }
      return null;
    } catch (e) {
      return null; // wrong PIN — GCM authentication failed
    }
  }

  function resetPin() {
    localStorage.removeItem(PIN_META_KEY);
    cachedKey = null;
    // Strip encrypted duress words — they're unrecoverable without the old
    // PIN by design. Everything else in each saved plan is kept.
    const list = loadList(RV_KEY);
    list.forEach((r) => {
      delete r.duressEnc;
    });
    saveList(RV_KEY, list);
  }

  async function encryptDuress(key, plaintext) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));
    return { iv: bufToB64(iv.buffer), ct: bufToB64(ct) };
  }

  async function decryptDuress(key, encObj) {
    const iv = new Uint8Array(b64ToBuf(encObj.iv));
    const ptBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      b64ToBuf(encObj.ct)
    );
    return new TextDecoder().decode(ptBuf);
  }

  // Minimal PIN modal. Returns a Promise<string|null> — the entered PIN,
  // or null if cancelled. mode "setup" asks twice and must match; mode
  // "verify" asks once and offers a reset link.
  function showPinModal({ title, message, mode }) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "pin-modal-overlay";
      overlay.innerHTML = `
        <div class="pin-modal" role="dialog" aria-modal="true">
          <h3 class="pin-modal__title">${escapeHtml(title)}</h3>
          <p class="pin-modal__message">${escapeHtml(message)}</p>
          <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" class="pin-modal__input" id="pin-input-1" placeholder="6-digit PIN" autocomplete="off">
          ${
            mode === "setup"
              ? `<input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" class="pin-modal__input" id="pin-input-2" placeholder="Confirm PIN" autocomplete="off">`
              : ""
          }
          <p class="pin-modal__error" id="pin-modal-error" hidden></p>
          <div class="btn-row">
            <button class="btn btn--secondary" id="pin-modal-cancel" type="button">Cancel</button>
            <button class="btn btn--primary" id="pin-modal-ok" type="button">${
              mode === "setup" ? "Set PIN" : "Unlock"
            }</button>
          </div>
          ${
            mode === "verify"
              ? `<button class="pin-modal__forgot" id="pin-modal-forgot" type="button">Forgot PIN? Reset (deletes saved duress words)</button>`
              : ""
          }
        </div>
      `;
      document.body.appendChild(overlay);
      document.getElementById("pin-input-1").focus();

      const cleanup = (result) => {
        overlay.remove();
        resolve(result);
      };

      document.getElementById("pin-modal-cancel").addEventListener("click", () => cleanup(null));

      document.getElementById("pin-modal-ok").addEventListener("click", () => {
        const v1 = document.getElementById("pin-input-1").value.trim();
        const errEl = document.getElementById("pin-modal-error");
        if (!/^\d{4,6}$/.test(v1)) {
          errEl.textContent = "Enter a 4–6 digit PIN.";
          errEl.hidden = false;
          return;
        }
        if (mode === "setup") {
          const v2 = document.getElementById("pin-input-2").value.trim();
          if (v1 !== v2) {
            errEl.textContent = "PINs don't match.";
            errEl.hidden = false;
            return;
          }
        }
        cleanup(v1);
      });

      if (mode === "verify") {
        document.getElementById("pin-modal-forgot").addEventListener("click", () => {
          if (
            confirm(
              "Reset PIN? This permanently deletes any saved duress words — the rest of each plan is kept. This can't be undone."
            )
          ) {
            resetPin();
            cleanup(null);
            renderRvList();
          }
        });
      }
    });
  }

  // Gets a usable key for encrypt/decrypt: cached in memory if already
  // unlocked this session, otherwise prompts setup (no PIN exists yet) or
  // verify (PIN exists) via the modal. Returns null if the user cancels or
  // enters the wrong PIN.
  async function getKeyForDuress(promptTitle, promptMessage) {
    if (cachedKey) return cachedKey;
    if (!hasPinConfigured()) {
      const pin = await showPinModal({
        title: "Protect your duress word",
        message: "This word is only useful if it stays secret. Set a PIN — you'll need it again to view saved duress words on this device.",
        mode: "setup",
      });
      if (!pin) return null;
      return setupPin(pin);
    }
    const pin = await showPinModal({ title: promptTitle, message: promptMessage, mode: "verify" });
    if (!pin) return null;
    const key = await verifyPin(pin);
    if (!key) alert("Incorrect PIN.");
    return key;
  }

  function renderRvList() {
    const el = document.getElementById("rv-list");
    if (!el) return;
    const list = loadList(RV_KEY);
    if (!list.length) {
      el.innerHTML = `<li class="saved-list__empty">No plans saved yet.</li>`;
      return;
    }
    el.innerHTML = list
      .slice()
      .reverse()
      .map((r) => {
        const row = (label, val) =>
          val ? `<p><strong>${label}:</strong> ${escapeHtml(val)}</p>` : "";
        const duressRow = r.duressEnc
          ? `<p><strong>Duress word:</strong>
               <button class="reveal-btn" data-reveal-id="${r.id}" type="button">•••• Reveal</button>
               <span class="reveal-value" id="reveal-value-${r.id}" hidden></span>
             </p>`
          : "";
        return `
          <li class="saved-card">
            <div class="saved-card__top">
              <span class="saved-card__title">${escapeHtml(r.name)}</span>
              <button class="saved-card__delete" data-id="${r.id}" data-store="${RV_KEY}" aria-label="Delete">✕</button>
            </div>
            ${row("Covers", r.members)}
            ${row("Primary RV", r.primary)}
            ${row("Fallback RV", r.fallback)}
            ${row("Out-of-area contact", r.contact)}
            ${duressRow}
            <button class="share-btn" type="button" data-share-rv="${r.id}">Share plan</button>
            <p class="share-status" hidden></p>
          </li>
        `;
      })
      .join("");
  }

  // Deliberately takes only the four safe fields as arguments — not the
  // whole record — so there is no code path by which the duress word (or
  // its ciphertext) can end up in shared text, now or in any future edit
  // to this function. If someone needs the duress word, they use the
  // Reveal button and read it themselves; it never goes through share.
  function rvToShareText(name, members, primary, fallback, contact) {
    const lines = [`SafeRoute RV plan — ${name}`];
    if (members) lines.push(`Covers: ${members}`);
    if (primary) lines.push(`Primary RV: ${primary}`);
    if (fallback) lines.push(`Fallback RV: ${fallback}`);
    if (contact) lines.push(`Out-of-area contact: ${contact}`);
    return lines.join("\n");
  }

  document.addEventListener("click", (e) => {
    const shareBtn = e.target.closest("[data-share-rv]");
    if (!shareBtn) return;
    const id = shareBtn.dataset.shareRv;
    const record = loadList(RV_KEY).find((r) => r.id === id);
    if (!record) return;
    const statusEl = shareBtn.closest(".saved-card").querySelector(".share-status");
    if (statusEl) statusEl.hidden = false;
    const text = rvToShareText(record.name, record.members, record.primary, record.fallback, record.contact);
    sharePlanText(`SafeRoute RV plan — ${record.name}`, text, statusEl);
  });

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".reveal-btn");
    if (!btn) return;
    const id = btn.dataset.revealId;
    const list = loadList(RV_KEY);
    const record = list.find((r) => r.id === id);
    if (!record || !record.duressEnc) return;

    const key = await getKeyForDuress(
      "Enter PIN",
      "Enter your PIN to reveal this duress word."
    );
    if (!key) return;

    try {
      const plain = await decryptDuress(key, record.duressEnc);
      const valEl = document.getElementById(`reveal-value-${id}`);
      valEl.textContent = plain;
      valEl.hidden = false;
      btn.hidden = true;
      setTimeout(() => {
        valEl.hidden = true;
        btn.hidden = false;
      }, 20000);
    } catch (err) {
      alert("Couldn't decrypt this — the PIN may not match what this word was saved with.");
    }
  });

  const rvForm = document.getElementById("rv-form");
  const rvStatus = document.getElementById("rv-status");

  if (rvForm) {
    rvForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const duressPlain = document.getElementById("rv-duress").value.trim();

      const record = {
        id: Date.now().toString(36),
        name: document.getElementById("rv-name").value.trim(),
        members: document.getElementById("rv-members").value.trim(),
        primary: document.getElementById("rv-primary").value.trim(),
        fallback: document.getElementById("rv-fallback").value.trim(),
        contact: document.getElementById("rv-contact").value.trim(),
      };

      if (duressPlain) {
        if (!cryptoAvailable()) {
          if (rvStatus) rvStatus.textContent = "This browser can't encrypt — plan saved without the duress word.";
        } else {
          const key = await getKeyForDuress(
            "Enter PIN",
            "Enter your PIN to save this duress word."
          );
          if (key) {
            record.duressEnc = await encryptDuress(key, duressPlain);
            if (rvStatus) rvStatus.textContent = "Plan saved. Duress word encrypted.";
          } else if (rvStatus) {
            rvStatus.textContent = "Plan saved without the duress word — PIN was cancelled or incorrect.";
          }
        }
      } else if (rvStatus) {
        rvStatus.textContent = "";
      }

      const list = loadList(RV_KEY);
      list.push(record);
      saveList(RV_KEY, list);
      rvForm.reset();
      renderRvList();
    });
  }

  /* ==========================================================================
     Baseline awareness — guided, filled-in-the-moment, not a static list
     ========================================================================== */

  const BASELINE_KEY = "saferoute_baseline_notes";

  function renderBaselinePicker() {
    const el = document.getElementById("baseline-picker");
    if (!el) return;
    el.innerHTML = "";
    BASELINE_ENVIRONMENTS.forEach((env) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pill-btn";
      btn.textContent = env.label;
      btn.addEventListener("click", () => runBaseline(env));
      el.appendChild(btn);
    });
  }

  function runBaseline(env) {
    const runEl = document.getElementById("baseline-run");
    if (!runEl) return;
    runEl.hidden = false;

    runEl.innerHTML = `
      <h4 class="baseline-run__title">${escapeHtml(env.label)}</h4>
      <div id="baseline-prompts"></div>
      <button class="btn btn--primary" id="baseline-save">Save this baseline note</button>
    `;

    const promptsEl = document.getElementById("baseline-prompts");
    env.prompts.forEach((p, i) => {
      const wrap = document.createElement("label");
      wrap.className = "baseline-prompt";
      wrap.innerHTML = `<span>${escapeHtml(p)}</span><textarea rows="2" data-prompt-index="${i}"></textarea>`;
      promptsEl.appendChild(wrap);
    });

    document.getElementById("baseline-save").addEventListener("click", () => {
      const answers = env.prompts.map((p, i) => ({
        prompt: p,
        answer: promptsEl.querySelector(`[data-prompt-index="${i}"]`).value.trim(),
      }));
      const list = loadList(BASELINE_KEY);
      list.push({
        id: Date.now().toString(36),
        env: env.label,
        date: new Date().toLocaleString(),
        answers,
      });
      saveList(BASELINE_KEY, list);
      renderBaselineNotes();
      runEl.hidden = true;
    });
  }

  function renderBaselineNotes() {
    let container = document.getElementById("baseline-notes");
    if (!container) {
      container = document.createElement("ul");
      container.className = "saved-list";
      container.id = "baseline-notes";
      const runEl = document.getElementById("baseline-run");
      if (runEl) runEl.insertAdjacentElement("afterend", container);
    }
    const list = loadList(BASELINE_KEY);
    if (!list.length) {
      container.innerHTML = "";
      return;
    }
    container.innerHTML = list
      .slice()
      .reverse()
      .map((n) => {
        const answersHtml = n.answers
          .filter((a) => a.answer)
          .map(
            (a) =>
              `<p><strong>${escapeHtml(a.prompt)}</strong><br>${escapeHtml(a.answer)}</p>`
          )
          .join("");
        return `
          <li class="saved-card">
            <div class="saved-card__top">
              <span class="saved-card__title">${escapeHtml(n.env)}</span>
              <button class="saved-card__delete" data-id="${n.id}" data-store="${BASELINE_KEY}" aria-label="Delete">✕</button>
            </div>
            <p class="saved-card__meta">${escapeHtml(n.date)}</p>
            ${answersHtml || `<p class="saved-card__meta">No notes recorded.</p>`}
          </li>
        `;
      })
      .join("");
  }

  /* ---------- init ---------- */

  renderRecceList();
  renderRvList();
  renderBaselinePicker();
  renderBaselineNotes();
})();
