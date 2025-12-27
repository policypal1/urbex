const supabase = window.supabaseClient;

let spots = [];

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("spot-form");
  const submitBtn = document.getElementById("submit-btn");
  const ratingSection = document.getElementById("rating-section");
  const saveStatus = document.getElementById("save-status");

  const statusHidden = document.getElementById("spot-status-hidden");
  const securityHidden = document.getElementById("spot-security");
  const squattersHidden = document.getElementById("spot-squatters");
  const againHidden = document.getElementById("spot-again");
  const ratingHidden = document.getElementById("spot-rating");

  const chips = document.querySelectorAll(".yn-chip");
  const ratingChips = document.querySelectorAll(".rating-chip");

  const panel = document.getElementById("side-panel");
  const panelClose = document.getElementById("panel-close");

  const addSpotDesktopBtn = document.getElementById("add-spot-desktop");
  const addSpotMobileBtn = document.getElementById("add-spot-mobile");

  const spotsList = document.getElementById("spots-list");
  const refreshBtn = document.getElementById("refresh-spots");

  function openPanel() {
    if (!panel) return;
    panel.classList.remove("side-panel-hidden");
    panel.scrollTop = 0;
  }

  function closePanel() {
    if (!panel) return;
    panel.classList.add("side-panel-hidden");
  }

  // Start hidden on load (desktop + mobile)
  closePanel();

  // Button handlers
  if (addSpotDesktopBtn) addSpotDesktopBtn.addEventListener("click", openPanel);
  if (addSpotMobileBtn) addSpotMobileBtn.addEventListener("click", openPanel);
  if (panelClose) panelClose.addEventListener("click", closePanel);

  // Chips behavior
  chips.forEach((chip) => {
    const group = chip.dataset.group;
    if (!group) return;

    chip.addEventListener("click", () => {
      const value = chip.dataset.value;

      chips.forEach((c) => {
        if (c.dataset.group === group) c.classList.remove("yn-active");
      });
      chip.classList.add("yn-active");

      if (group === "status") {
        statusHidden.value = value;
        if (value === "completed") ratingSection.classList.remove("hidden");
        else ratingSection.classList.add("hidden");
      }
      if (group === "security") securityHidden.value = value;
      if (group === "squatters") squattersHidden.value = value;
      if (group === "again") againHidden.value = value;
    });
  });

  ratingChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      ratingHidden.value = chip.dataset.value;
      ratingChips.forEach((c) => c.classList.toggle("rating-active", c === chip));
    });
  });

  // Load list on page load
  (async () => {
    await loadSpotsFromBackend();
    renderSpotsList();
  })();

  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      await loadSpotsFromBackend();
      renderSpotsList();
    });
  }

  // Submit (create)
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("spot-name").value.trim();
    const location = document.getElementById("spot-location").value.trim();
    const tier = document.getElementById("spot-tier").value;
    const status = statusHidden.value;
    const exploreType = document.getElementById("spot-explore").value;
    const security = securityHidden.value;
    const squatters = squattersHidden.value;
    const notes = document.getElementById("spot-notes").value.trim();
    const rating =
      status === "completed" ? (parseInt(ratingHidden.value || "0", 10) || 0) : 0;
    const again = againHidden.value;

    if (!name || !location) return;

    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";
    if (saveStatus) {
      saveStatus.classList.add("hidden");
      saveStatus.textContent = "";
    }

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

    submitBtn.disabled = false;
    submitBtn.textContent = "Save spot";

    if (!created) {
      if (saveStatus) {
        saveStatus.textContent = "Could not save spot.";
        saveStatus.classList.remove("hidden");
      }
      return;
    }

    // Refresh list + show success
    await loadSpotsFromBackend();
    renderSpotsList();

    if (saveStatus) {
      saveStatus.textContent = "Saved.";
      saveStatus.classList.remove("hidden");
      setTimeout(() => saveStatus.classList.add("hidden"), 1200);
    }

    // Reset
    form.reset();
    statusHidden.value = "pending";
    securityHidden.value = "no";
    squattersHidden.value = "no";
    againHidden.value = "no";
    ratingHidden.value = "0";
    ratingSection.classList.add("hidden");
    ratingChips.forEach((c) => c.classList.remove("rating-active"));

    // Keep panel open so you can add more quickly (change to closePanel() if you want)
    // closePanel();
  });

  function renderSpotsList() {
    if (!spotsList) return;

    if (!spots.length) {
      spotsList.innerHTML =
        `<p class="text-xs text-slate-400">No spots yet. Add one above.</p>`;
      return;
    }

    spotsList.innerHTML = "";

    spots.slice(0, 25).forEach((s) => {
      const card = document.createElement("div");
      card.className = "spot-card";

      card.innerHTML = `
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="spot-name">${escapeHtml(s.name)}</div>
            <div class="spot-sub">${escapeHtml(prettyStatus(s.status))} · ${escapeHtml(prettyExplore(s.explore_type))}</div>
            <div class="spot-loc">${escapeHtml(s.location)}</div>
          </div>

          <button class="spot-del" type="button" title="Delete">✕</button>
        </div>
      `;

      card.querySelector(".spot-del").addEventListener("click", async () => {
        const pass = prompt("Enter passcode to delete this spot:");
        if (pass !== "1111") {
          if (pass !== null) alert("Incorrect passcode.");
          return;
        }
        const ok = await deleteSpotInBackend(s.id);
        if (!ok) return;

        await loadSpotsFromBackend();
        renderSpotsList();
      });

      spotsList.appendChild(card);
    });
  }
});

// --- Supabase helpers ---
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
    console.error(error);
    spots = [];
    return;
  }
  spots = (data || []).map(rowToSpot);
}

async function createSpotInBackend(payload) {
  const { data, error } = await supabase
    .from("spots")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.error(error);
    alert("Could not save spot.");
    return null;
  }
  return data;
}

async function deleteSpotInBackend(id) {
  const { error } = await supabase.from("spots").delete().eq("id", id);
  if (error) {
    console.error(error);
    alert("Could not delete spot.");
    return false;
  }
  return true;
}

// --- display helpers ---
function prettyStatus(status) {
  switch (status) {
    case "pending": return "Pending";
    case "completed": return "Completed";
    default: return status || "";
  }
}
function prettyExplore(type) {
  switch (type) {
    case "urbex": return "Urbex";
    case "roofing": return "Roofing";
    case "drain": return "Drain/Tunnel";
    case "other": return "Other";
    default: return type || "";
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
