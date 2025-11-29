const STORAGE_KEY = "urbex_spots_v2";
let spots = [];

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("spot-form");
  const clearAllBtn = document.getElementById("clear-all");
  const searchInput = document.getElementById("search-input");

  const securityHidden = document.getElementById("spot-security");
  const squattersHidden = document.getElementById("spot-squatters");
  const ynChips = document.querySelectorAll(".yn-chip");

  // Yes/No chip logic
  ynChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const group = chip.dataset.group;
      const value = chip.dataset.value;

      // deactivate all chips in group
      ynChips.forEach((c) => {
        if (c.dataset.group === group) {
          c.classList.remove("yn-active");
        }
      });
      chip.classList.add("yn-active");

      if (group === "security") {
        securityHidden.value = value;
      } else if (group === "squatters") {
        squattersHidden.value = value;
      }
    });
  });

  // Load existing spots
  loadSpotsFromStorage();
  renderSpotList();

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const nameEl = document.getElementById("spot-name");
    const locEl = document.getElementById("spot-location");
    const tierEl = document.getElementById("spot-tier");
    const notesEl = document.getElementById("spot-notes");

    const name = nameEl.value.trim();
    const location = locEl.value.trim();
    const tier = tierEl.value;
    const security = securityHidden.value;
    const squatters = squattersHidden.value;
    const notes = notesEl.value.trim();

    if (!name || !location) return;

    const spot = {
      id: Date.now(),
      name,
      location,
      tier,
      security,
      squatters,
      notes,
      createdAt: new Date().toISOString(),
    };

    spots.push(spot);
    saveSpotsToStorage();
    renderSpotList();

    form.reset();
    // reset hidden defaults (no security, no squatters)
    securityHidden.value = "no";
    squattersHidden.value = "no";
    // reset chips
    ynChips.forEach((c) => {
      if (c.dataset.group === "security") {
        c.classList.toggle("yn-active", c.dataset.value === "no");
      }
      if (c.dataset.group === "squatters") {
        c.classList.toggle("yn-active", c.dataset.value === "no");
      }
    });
  });

  clearAllBtn.addEventListener("click", () => {
    if (!confirm("Clear all saved spots from this browser?")) return;
    spots = [];
    saveSpotsToStorage();
    renderSpotList();
  });

  searchInput.addEventListener("input", () => {
    renderSpotList();
  });
});

function renderSpotList() {
  const list = document.getElementById("spots-list");
  const searchValue = document
    .getElementById("search-input")
    .value.toLowerCase()
    .trim();

  let filtered = spots.slice();

  if (searchValue) {
    filtered = filtered.filter((s) => {
      return (
        s.name.toLowerCase().includes(searchValue) ||
        s.location.toLowerCase().includes(searchValue) ||
        (s.notes || "").toLowerCase().includes(searchValue)
      );
    });
  }

  if (!filtered.length) {
    list.innerHTML =
      '<p class="text-xs text-slate-300">No spots yet. Find a place on the map, fill the form, and hit “Save spot”.</p>';
    return;
  }

  list.innerHTML = "";

  filtered
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach((spot) => {
      const div = document.createElement("div");
      div.className = "spot-card text-xs";

      const tierLabel = prettyTier(spot.tier);
      const securityLabel =
        spot.security === "yes" ? "Security/cameras" : "No obvious security";
      const squattersLabel =
        spot.squatters === "yes" ? "Squatters likely" : "Squatters unlikely";

      div.innerHTML = `
        <div class="flex items-center justify-between gap-2 mb-1">
          <span class="font-semibold text-sm truncate">${escapeHtml(
            spot.name
          )}</span>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-200">
            ${escapeHtml(tierLabel)}
          </span>
        </div>
        <p class="text-[11px] text-slate-400 truncate mb-1">
          ${escapeHtml(spot.location)}
        </p>
        <p class="text-[11px] text-slate-300">
          • ${escapeHtml(securityLabel)}<br/>
          • ${escapeHtml(squattersLabel)}
        </p>
        ${
          spot.notes
            ? `<p class="mt-1 text-[11px] text-slate-200 whitespace-pre-wrap max-h-16 overflow-hidden">${escapeHtml(
                spot.notes
              )}</p>`
            : ""
        }
        <div class="flex gap-2 mt-2">
          <button class="text-[11px] px-2 py-1 rounded-lg bg-slate-100 text-slate-900 hover:bg-white transition open-maps-btn">
            Open in Maps
          </button>
          <button class="text-[11px] px-2 py-1 rounded-lg border border-slate-700 text-slate-300 hover:border-red-500 hover:text-red-200 transition delete-spot-btn">
            Delete
          </button>
        </div>
      `;

      const openBtn = div.querySelector(".open-maps-btn");
      openBtn.addEventListener("click", () => {
        const loc = spot.location.trim();
        let url;

        // if they pasted a full google maps link, just open it.
        if (loc.startsWith("http")) {
          url = loc;
        } else {
          url =
            "https://www.google.com/maps/search/?api=1&query=" +
            encodeURIComponent(loc);
        }
        window.open(url, "_blank", "noopener");
      });

      const deleteBtn = div.querySelector(".delete-spot-btn");
      deleteBtn.addEventListener("click", () => {
        if (!confirm("Delete this spot?")) return;
        spots = spots.filter((s) => s.id !== spot.id);
        saveSpotsToStorage();
        renderSpotList();
      });

      list.appendChild(div);
    });
}

function saveSpotsToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(spots));
}

function loadSpotsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      spots = parsed;
    }
  } catch (err) {
    console.error("Failed to load spots from storage", err);
  }
}

function prettyTier(tier) {
  switch (tier) {
    case "graffiti_no_power":
      return "Graffiti · no power";
    case "graffiti_power":
      return "Graffiti · has power";
    case "graffiti_plus_power":
      return "Graffiti++ · power";
    default:
      return tier;
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
