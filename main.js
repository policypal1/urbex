const STORAGE_KEY = "urbex_spots_v1";

let spots = [];

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("spot-form");
  const clearAllBtn = document.getElementById("clear-all");
  const searchInput = document.getElementById("search-input");
  const filterChips = document.querySelectorAll(".filter-chip");

  // Set default filter
  document.body.dataset.filterStatus = "all";

  // Load existing spots
  loadSpotsFromStorage();
  renderSpotList();

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const nameEl = document.getElementById("spot-name");
    const locEl = document.getElementById("spot-location");
    const statusEl = document.getElementById("spot-status");
    const notesEl = document.getElementById("spot-notes");

    const name = nameEl.value.trim();
    const location = locEl.value.trim();
    const status = statusEl.value;
    const notes = notesEl.value.trim();

    if (!name || !location) return;

    const spot = {
      id: Date.now(),
      name,
      location,
      status,
      notes,
      createdAt: new Date().toISOString(),
    };

    spots.push(spot);
    saveSpotsToStorage();
    renderSpotList();

    form.reset();
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

  filterChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const active = chip.dataset.status;
      document.body.dataset.filterStatus = active;

      filterChips.forEach((c) => {
        c.classList.toggle("filter-active", c === chip);
      });

      renderSpotList();
    });
  });
});

function renderSpotList() {
  const list = document.getElementById("spots-list");
  const filterStatus = document.body.dataset.filterStatus || "all";
  const searchValue = document
    .getElementById("search-input")
    .value.toLowerCase()
    .trim();

  let filtered = spots.slice();

  if (filterStatus !== "all") {
    filtered = filtered.filter((s) => s.status === filterStatus);
  }

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
      '<p class="text-xs text-slate-500">No spots yet. Add one on the right after you find it on the map.</p>';
    return;
  }

  list.innerHTML = "";

  filtered
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach((spot) => {
      const item = document.createElement("div");
      item.className =
        "w-full px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col gap-1";

      const statusLabel = prettyStatus(spot.status);

      item.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <span class="font-medium text-sm truncate">${escapeHtml(
            spot.name
          )}</span>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
            ${escapeHtml(statusLabel)}
          </span>
        </div>
        <p class="text-[11px] text-slate-400 truncate">
          ${escapeHtml(spot.location)}
        </p>
        ${
          spot.notes
            ? `<p class="text-xs text-slate-200 whitespace-pre-wrap max-h-16 overflow-hidden">${escapeHtml(
                spot.notes
              )}</p>`
            : ""
        }
        <div class="flex gap-2 mt-1">
          <button class="text-[11px] px-2 py-1 rounded-lg bg-slate-100 text-slate-900 hover:bg-white transition open-maps-btn">
            Open in Maps
          </button>
          <button class="text-[11px] px-2 py-1 rounded-lg border border-slate-700 text-slate-300 hover:border-red-500 hover:text-red-200 transition delete-spot-btn">
            Delete
          </button>
        </div>
      `;

      const openBtn = item.querySelector(".open-maps-btn");
      openBtn.addEventListener("click", () => {
        const url =
          "https://www.google.com/maps/search/?api=1&query=" +
          encodeURIComponent(spot.location);
        window.open(url, "_blank", "noopener");
      });

      const deleteBtn = item.querySelector(".delete-spot-btn");
      deleteBtn.addEventListener("click", () => {
        if (!confirm("Delete this spot?")) return;
        spots = spots.filter((s) => s.id !== spot.id);
        saveSpotsToStorage();
        renderSpotList();
      });

      list.appendChild(item);
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

function prettyStatus(status) {
  switch (status) {
    case "scouted":
      return "Scouted";
    case "want-to-check":
      return "Want to check";
    case "public-legal":
      return "Public / legal";
    case "avoid":
      return "Avoid / unsafe";
    default:
      return status;
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
