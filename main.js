// main.js – Supabase-backed with passcode delete + mobile panel + spot browser modal

const supabase = window.supabaseClient;
let spots = [];
let editingId = null;

// filters for the browser modal
let filterStatus = "all";
let filterExplore = "all";
let filterSearch = "";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("spot-form");
  const clearAllBtn = document.getElementById("clear-all");
  const submitBtn = document.getElementById("submit-btn");
  const ratingSection = document.getElementById("rating-section");

  const statusHidden = document.getElementById("spot-status-hidden");
  const securityHidden = document.getElementById("spot-security");
  const squattersHidden = document.getElementById("spot-squatters");
  const againHidden = document.getElementById("spot-again");
  const ratingHidden = document.getElementById("spot-rating");

  const chips = document.querySelectorAll(".yn-chip");
  const ratingChips = document.querySelectorAll(".rating-chip");

  // panel + modal elements
  const panel = document.getElementById("side-panel");
  const panelToggle = document.getElementById("panel-toggle");
  const seeSpotsBtn = document.getElementById("see-spots");
  const modal = document.getElementById("spots-modal");
  const modalClose = document.getElementById("spots-modal-close");
  const modalSearchInput = document.getElementById("modal-search-input");
  const statusFilterChips = document.querySelectorAll(".status-filter-chip");
  const exploreFilterSelect = document.getElementById("explore-filter");

  // closed by default on mobile, open on desktop
  let panelHidden = window.innerWidth < 768;

  // helper: set panel visibility classes (only matters on mobile)
  function setPanelVisibility() {
    if (!panel) return;

    if (window.innerWidth >= 768) {
      panelHidden = false;
      if (panelToggle) {
        panelToggle.style.display = "none";
      }
      panel.classList.remove(
        "translate-x-[140%]",
        "opacity-0",
        "pointer-events-none"
      );
      panel.classList.add("translate-x-[-50%]", "opacity-100", "pointer-events-auto");
      return;
    }

    if (panelToggle) {
      panelToggle.style.display = "flex";
      panelToggle.textContent = panelHidden ? "⮜" : "⮞";
    }

    if (panelHidden) {
      panel.classList.add(
        "translate-x-[140%]",
        "opacity-0",
        "pointer-events-none"
      );
      panel.classList.remove("translate-x-[-50%]", "opacity-100", "pointer-events-auto");
    } else {
      panel.classList.remove(
        "translate-x-[140%]",
        "opacity-0",
        "pointer-events-none"
      );
      panel.classList.add("translate-x-[-50%]", "opacity-100", "pointer-events-auto");
    }
  }

  // init visibility
  setPanelVisibility();

  // Mobile panel toggle
  if (panelToggle) {
    panelToggle.addEventListener("click", () => {
      if (window.innerWidth >= 768) return;
      panelHidden = !panelHidden;
      setPanelVisibility();
    });
  }

  window.addEventListener("resize", () => {
    // on resize, recompute mobile/desktop state
    if (window.innerWidth >= 768) {
      panelHidden = false;
    }
    setPanelVisibility();
  });

  // Open / close browser modal
  function openModal() {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    renderSpotList();
  }

  function closeModal() {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }

  if (seeSpotsBtn) seeSpotsBtn.addEventListener("click", openModal);
  if (modalClose) modalClose.addEventListener("click", closeModal);

  // close when clicking outside card
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // Filter: status
  statusFilterChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const value = chip.dataset.value;
      filterStatus = value;

      statusFilterChips.forEach((c) => c.classList.remove("yn-active"));
      chip.classList.add("yn-active");

      renderSpotList();
    });
  });

  // Filter: explore type
  exploreFilterSelect.addEventListener("change", () => {
    filterExplore = exploreFilterSelect.value;
    renderSpotList();
  });

  // Filter: search
  modalSearchInput.addEventListener("input", () => {
    filterSearch = modalSearchInput.value.toLowerCase().trim();
    renderSpotList();
  });

  // Chip logic (status, security, squatters, again) for the form
  chips.forEach((chip) => {
    const group = chip.dataset.group;
    if (!group) return; // filter chips don't have data-group

    chip.addEventListener("click", () => {
      const value = chip.dataset.value;

      chips.forEach((c) => {
        if (c.dataset.group === group) {
          c.classList.remove("yn-active");
        }
      });
      chip.classList.add("yn-active");

      if (group === "status") {
        statusHidden.value = value;
        if (value === "completed") {
          ratingSection.classList.remove("hidden");
        } else {
          ratingSection.classList.add("hidden");
        }
      }
      if (group === "security") securityHidden.value = value;
      if (group === "squatters") squattersHidden.value = value;
      if (group === "again") againHidden.value = value;
    });
  });

  // Rating chips 1–5
  ratingChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const value = chip.dataset.value;
      ratingHidden.value = value;
      ratingChips.forEach((c) =>
        c.classList.toggle("rating-active", c === chip)
      );
    });
  });

  // Load existing spots from Supabase
  (async () => {
    await loadSpotsFromBackend();
    renderSpotList();
  })();

  // Form submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nameEl = document.getElementById("spot-name");
    const locEl = document.getElementById("spot-location");
    const tierEl = document.getElementById("spot-tier");
    const exploreEl = document.getElementById("spot-explore");
    const notesEl = document.getElementById("spot-notes");

    const name = nameEl.value.trim();
    const location = locEl.value.trim();
    const tier = tierEl.value;
    const status = statusHidden.value;
    const exploreType = exploreEl.value;
    const security = securityHidden.value;
    const squatters = squattersHidden.value;
    const notes = notesEl.value.trim();
    const rating =
      status === "completed"
        ? parseInt(ratingHidden.value || "0", 10) || 0
        : 0;
    const again = againHidden.value;

    if (!name || !location) return;

    if (editingId) {
      const updated = await updateSpotInBackend(editingId, {
        name,
        location,
        tier,
        status,
        explore_type: exploreType,
        security,
        squatters,
        notes,
        rating,
        again,
      });
      if (!updated) return;

      const idx = spots.findIndex((s) => s.id === editingId);
      if (idx !== -1) spots[idx] = rowToSpot(updated);
    } else {
      const created = await createSpotInBackend({
        name,
        location,
        tier,
        status,
        explore_type: exploreType,
        security,
        squatters,
        notes,
        rating,
        again,
      });
      if (!created) return;
      spots.push(rowToSpot(created));
    }

    renderSpotList();
    updateMapToLocation(location);

    // reset form + editing state
    form.reset();
    editingId = null;
    submitBtn.textContent = "Save spot";

    statusHidden.value = "pending";
    securityHidden.value = "no";
    squattersHidden.value = "no";
    againHidden.value = "no";
    ratingHidden.value = "0";
    ratingSection.classList.add("hidden");
    ratingChips.forEach((c) => c.classList.remove("rating-active"));

    chips.forEach((c) => {
      const group = c.dataset.group;
      if (group === "status") {
        c.classList.toggle("yn-active", c.dataset.value === "pending");
      }
      if (group === "security") {
        c.classList.toggle("yn-active", c.dataset.value === "no");
      }
      if (group === "squatters") {
        c.classList.toggle("yn-active", c.dataset.value === "no");
      }
      if (group === "again") {
        c.classList.toggle("yn-active", c.dataset.value === "no");
      }
    });
  });

  // Clear all (with passcode)
  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", async () => {
      const pass = prompt("Enter passcode to clear ALL spots:");
      if (pass !== "1111") {
        if (pass !== null) alert("Incorrect passcode.");
        return;
      }

      await deleteAllSpotsInBackend();
      spots = [];
      renderSpotList();
    });
  }
});

// ---------- Map helper ----------

function updateMapToLocation(location) {
  const frame = document.getElementById("map-frame");
  if (!frame) return;
  const loc = location.trim();
  if (!loc) return;
  const url =
    "https://www.google.com/maps?q=" +
    encodeURIComponent(loc) +
    "&output=embed";
  frame.src = url;
}

// ---------- Render list in modal ----------

function renderSpotList() {
  const list = document.getElementById("spots-modal-list");
  if (!list) return;

  let filtered = spots.slice();

  if (filterStatus !== "all") {
    filtered = filtered.filter((s) => s.status === filterStatus);
  }
  if (filterExplore !== "all") {
    filtered = filtered.filter((s) => s.explore_type === filterExplore);
  }

  if (filterSearch) {
    filtered = filtered.filter((s) => {
      return (
        s.name.toLowerCase().includes(filterSearch) ||
        s.location.toLowerCase().includes(filterSearch) ||
        (s.notes || "").toLowerCase().includes(filterSearch)
      );
    });
  }

  if (!filtered.length) {
    list.innerHTML =
      '<p class="text-xs text-slate-300">No spots match right now. Add a spot or adjust your filters.</p>';
    return;
  }

  list.innerHTML = "";

  const submitBtn = document.getElementById("submit-btn");

  filtered
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .forEach((spot) => {
      const div = document.createElement("div");
      div.className = "spot-card text-xs";

      const tierLabel = prettyTier(spot.tier);
      const statusLabel = prettyStatus(spot.status);
      const exploreLabel = prettyExplore(spot.explore_type);
      const securityLabel =
        spot.security === "yes" ? "Security / cameras" : "No obvious security";
      const squattersLabel =
        spot.squatters === "yes" ? "Squatters likely" : "Squatters unlikely";

      let ratingLine = "";
      if (spot.status === "completed" && spot.rating && spot.rating > 0) {
        const againText =
          spot.again === "yes" ? "Would go again" : "Wouldn’t go again";
        ratingLine = `Rating: ${spot.rating}/5 · ${againText}`;
      }

      div.innerHTML = `
        <div class="flex items-center justify-between gap-2 mb-1">
          <span class="font-semibold text-sm truncate">${escapeHtml(
            spot.name
          )}</span>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-200">
            ${escapeHtml(statusLabel)}
          </span>
        </div>
        <p class="text-[11px] text-slate-400 truncate mb-1">
          ${escapeHtml(spot.location)}
        </p>
        <p class="text-[11px] text-slate-300 mb-1">
          ${escapeHtml(exploreLabel)} · ${escapeHtml(tierLabel)}
        </p>
        <p class="text-[11px] text-slate-300">
          • ${escapeHtml(securityLabel)}<br/>
          • ${escapeHtml(squattersLabel)}
        </p>
        ${
          ratingLine
            ? `<p class="mt-1 text-[11px] text-amber-200">${escapeHtml(
                ratingLine
              )}</p>`
            : ""
        }
        ${
          spot.notes
            ? `<p class="mt-1 text-[11px] text-slate-200 whitespace-pre-wrap max-h-16 overflow-hidden">${escapeHtml(
                spot.notes
              )}</p>`
            : ""
        }
        <div class="flex flex-wrap gap-2 mt-2">
          <button class="text-[11px] px-2 py-1 rounded-lg bg-slate-100 text-slate-900 hover:bg-white transition show-on-map-btn">
            Show on map
          </button>
          <button class="text-[11px] px-2 py-1 rounded-lg bg-slate-800 text-slate-100 hover:bg-slate-700 transition open-maps-btn">
            Open in Maps
          </button>
          <button class="text-[11px] px-2 py-1 rounded-lg bg-slate-800 text-slate-100 hover:bg-slate-700 transition edit-spot-btn">
            Edit
          </button>
          <button class="text-[11px] px-2 py-1 rounded-lg border border-slate-700 text-slate-300 hover:border-red-500 hover:text-red-200 transition delete-spot-btn">
            Delete
          </button>
        </div>
      `;

      // show on map
      div.querySelector(".show-on-map-btn").addEventListener("click", () => {
        updateMapToLocation(spot.location);
      });

      // open in full Google Maps
      div.querySelector(".open-maps-btn").addEventListener("click", () => {
        const loc = spot.location.trim();
        let url;
        if (loc.startsWith("http")) {
          url = loc;
        } else {
          url =
            "https://www.google.com/maps/search/?api=1&query=" +
            encodeURIComponent(loc);
        }
        window.open(url, "_blank", "noopener");
      });

      // edit – auto-close modal so the panel is visible to edit
      div.querySelector(".edit-spot-btn").addEventListener("click", () => {
        editingId = spot.id;
        submitBtn.textContent = "Update spot";

        document.getElementById("spot-name").value = spot.name;
        document.getElementById("spot-location").value = spot.location;
        document.getElementById("spot-tier").value = spot.tier;
        document.getElementById("spot-explore").value = spot.explore_type;
        document.getElementById("spot-notes").value = spot.notes || "";

        const statusHidden = document.getElementById("spot-status-hidden");
        const securityHidden = document.getElementById("spot-security");
        const squattersHidden = document.getElementById("spot-squatters");
        const againHidden = document.getElementById("spot-again");
        const ratingHidden = document.getElementById("spot-rating");
        const ratingSection = document.getElementById("rating-section");
        const chips = document.querySelectorAll(".yn-chip");
        const ratingChips = document.querySelectorAll(".rating-chip");

        statusHidden.value = spot.status;
        securityHidden.value = spot.security;
        squattersHidden.value = spot.squatters;
        againHidden.value = spot.again || "no";
        ratingHidden.value = spot.rating || 0;

        if (spot.status === "completed") {
          ratingSection.classList.remove("hidden");
        } else {
          ratingSection.classList.add("hidden");
        }

        chips.forEach((c) => {
          const group = c.dataset.group;
          if (group === "status") {
            c.classList.toggle("yn-active", c.dataset.value === spot.status);
          }
          if (group === "security") {
            c.classList.toggle("yn-active", c.dataset.value === spot.security);
          }
          if (group === "squatters") {
            c.classList.toggle(
              "yn-active",
              c.dataset.value === spot.squatters
            );
          }
          if (group === "again") {
            c.classList.toggle(
              "yn-active",
              c.dataset.value === (spot.again || "no")
            );
          }
        });

        ratingChips.forEach((c) => {
          c.classList.toggle(
            "rating-active",
            parseInt(c.dataset.value, 10) === (spot.rating || 0)
          );
        });

        // close the modal screen so the panel is visible for editing
        const modal = document.getElementById("spots-modal");
        modal.classList.add("hidden");
        modal.classList.remove("flex");
      });

      // delete with passcode
      div
        .querySelector(".delete-spot-btn")
        .addEventListener("click", async () => {
          const pass = prompt("Enter passcode to delete this spot:");
          if (pass !== "1111") {
            if (pass !== null) alert("Incorrect passcode.");
            return;
          }

          const ok = await deleteSpotInBackend(spot.id);
          if (!ok) return;

          spots = spots.filter((s) => s.id !== spot.id);
          renderSpotList();
        });

      list.appendChild(div);
    });
}

// ---------- Supabase helpers ----------

function rowToSpot(row) {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    tier: row.tier,
    status: row.status,
    explore_type: row.explore_type,
    security: row.security,
    squatters: row.squatters,
    notes: row.notes,
    rating: row.rating,
    again: row.again,
    created_at: row.created_at,
  };
}

async function loadSpotsFromBackend() {
  const { data, error } = await supabase
    .from("spots")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading spots from Supabase:", error);
    spots = [];
    return;
  }

  spots = data.map(rowToSpot);
}

async function createSpotInBackend(payload) {
  const { data, error } = await supabase
    .from("spots")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.error("Error creating spot:", error);
    alert("Could not save spot to backend.");
    return null;
  }
  return data;
}

async function updateSpotInBackend(id, payload) {
  const { data, error } = await supabase
    .from("spots")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("Error updating spot:", error);
    alert("Could not update spot.");
    return null;
  }
  return data;
}

async function deleteSpotInBackend(id) {
  const { error } = await supabase.from("spots").delete().eq("id", id);
  if (error) {
    console.error("Error deleting spot:", error);
    alert("Could not delete spot.");
    return false;
  }
  return true;
}

async function deleteAllSpotsInBackend() {
  const { error } = await supabase.from("spots").delete().gt("id", 0);
  if (error) {
    console.error("Error clearing spots:", error);
    alert("Could not clear spots.");
  }
}

// ---------- Misc helpers ----------

function prettyTier(tier) {
  switch (tier) {
    case "no_power":
      return "No power";
    case "graffiti_no_power":
      return "Graffiti (no power)";
    case "graffiti_power":
      return "Graffiti (power)";
    case "no_graffiti":
      return "No graffiti";
    default:
      return tier;
  }
}

function prettyStatus(status) {
  switch (status) {
    case "pending":
      return "Pending visit";
    case "completed":
      return "Completed visit";
    default:
      return status;
  }
}

function prettyExplore(type) {
  switch (type) {
    case "urbex":
      return "Urbex (abandoned)";
    case "roofing":
      return "Roofing";
    case "drain":
      return "Drain / Tunnel";
    case "mixed":
      return "Mixed / both";
    case "other":
      return "Other / not listed";
    default:
      return type;
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
