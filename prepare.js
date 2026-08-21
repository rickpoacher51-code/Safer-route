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
          </li>
        `;
      })
      .join("");
  }

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
     ========================================================================== */

  const RV_KEY = "saferoute_rv_plans";

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
            ${row("Duress word", r.duress)}
          </li>
        `;
      })
      .join("");
  }

  const rvForm = document.getElementById("rv-form");
  if (rvForm) {
    rvForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const list = loadList(RV_KEY);
      list.push({
        id: Date.now().toString(36),
        name: document.getElementById("rv-name").value.trim(),
        members: document.getElementById("rv-members").value.trim(),
        primary: document.getElementById("rv-primary").value.trim(),
        fallback: document.getElementById("rv-fallback").value.trim(),
        contact: document.getElementById("rv-contact").value.trim(),
        duress: document.getElementById("rv-duress").value.trim(),
      });
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
