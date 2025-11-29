let map;
let markers = [];
let lastClickLatLng = null;
let locations = [];

const STORAGE_KEY = "urbex_locations_v2";
const BACKEND_ENABLED = false; // set true later if you build a real backend

// marker colors for each status
const statusStyles = {
  scouted: { fill: "#38bdf8", stroke: "#0ea5e9" }, // sky
  "want-to-check": { fill: "#facc15", stroke: "#eab308" }, // yellow
  "public-legal": { fill: "#34d399", stroke: "#10b981" }, // green
  avoid: { fill: "#fb7185", stroke: "#f97373" }, // red
  default: { fill: "#a855f7", stroke: "#a855f7" },
};

// Called by Google Maps script (callback=initMap in index.html)
function initMap() {
  const salem = { lat: 44.9429, lng: -123.0351 };

  map = new google.maps.Map(document.getElementById("map"), {
    center: salem,
    zoom: 12,
  });

  // click to drop pin
  map.addListener("click", (e) => {
    lastClickLatLng = e.latLng;
    document.getElementById("loc-lat").value = lastClickLatLng
      .lat()
      .toFixed(6);
    document.getElementById("loc-lng").value = lastClickLatLng
      .lng()
      .toFixed(6);
    addSelectionMarker(lastClickLatLng);
    document.getElementById("save-btn").disabled = false;
  });

  wireUI();

  // load saved locations
  loadLocationsFromStorage();
  renderLocationList();
  renderMarkers();

  if (BACKEND_ENABLED) {
    // later: load from backend instead of/in addition to localStorage
    // loadLocationsFromBackend();
  }
}

function wireUI() {
  const form = document.getElementById("location-form");
  const searchInput = document.getElementById("search-input");
  const clearAllBtn = document.getElementById("clear-all");
  const saveBtn = document.getElementById("save-btn");
  const centerSalemBtn = document.getElementById("center-salem");
  const locateMeBtn = document.getElementById("locate-me");
  const filterChips = document.querySelectorAll(".filter-chip");

  if (!document.getElementById("loc-lat").value) {
    saveBtn.disabled = true;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!lastClickLatLng) return;

    const name = document.getElementById("loc-name").value.trim();
    const status = document.getElementById("loc-status").value;
    const notes = document.getElementById("loc-notes").value.trim();

    if (!name) return;

    const newLocation = {
      id: Date.now(),
      name,
      status,
      notes,
      lat: lastClickLatLng.lat(),
      lng: lastClickLatLng.lng(),
      createdAt: new Date().toISOString(),
    };

    locations.push(newLocation);
    saveLocationsToStorage();

    if (BACKEND_ENABLED) {
      try {
        await saveLocationToBackend(newLocation);
      } catch (err) {
        console.error("Backend save failed", err);
      }
    }

    form.reset();
    document.getElementById("loc-lat").value = "";
    document.getElementById("loc-lng").value = "";
    lastClickLatLng = null;
    saveBtn.disabled = true;

    renderLocationList();
    renderMarkers();
  });

  searchInput.addEventListener("input", () => {
    renderLocationList();
    renderMarkers();
  });

  clearAllBtn.addEventListener("click", () => {
    if (!confirm("Clear all saved spots from this browser?")) return;
    locations = [];
    saveLocationsToStorage();
    renderLocationList();
    renderMarkers();
  });

  centerSalemBtn.addEventListener("click", () => {
    map.panTo({ lat: 44.9429, lng: -123.0351 });
    map.setZoom(12);
  });

  locateMeBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        map.panTo(coords);
        map.setZoom(13);
      },
      () => {
        alert("Could not get your location.");
      }
    );
  });

  filterChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const active = chip.dataset.status;
      document.body.dataset.filterStatus = active;

      filterChips.forEach((c) => {
        c.classList.toggle(
          "bg-slate-800",
          c === chip && active !== "all"
        );
        c.classList.toggle(
          "border-slate-600",
          c === chip && active !== "all"
        );
        c.classList.toggle(
          "text-slate-100",
          c === chip && active !== "all"
        );
      });

      renderLocationList();
      renderMarkers();
    });
  });

  // default filter
  document.body.dataset.filterStatus = "all";
}

function addSelectionMarker(latLng) {
  // remove old selection markers
  markers
    .filter((m) => m.__selection)
    .forEach((m) => m.setMap(null));
  markers = markers.filter((m) => !m.__selection);

  const selMarker = new google.maps.Marker({
    position: latLng,
    map,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 7,
      fillColor: "#38bdf8",
      fillOpacity: 1,
      strokeColor: "#0ea5e9",
      strokeWeight: 2,
    },
  });
  selMarker.__selection = true;
  markers.push(selMarker);
}

function markerIconForStatus(status) {
  const style = statusStyles[status] || statusStyles.default;
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 6,
    fillColor: style.fill,
    fillOpacity: 1,
    strokeColor: style.stroke,
    strokeWeight: 2,
  };
}

function renderMarkers() {
  // remove all non-selection markers
  markers
    .filter((m) => !m.__selection)
    .forEach((m) => m.setMap(null));
  markers = markers.filter((m) => m.__selection);

  const filterStatus = document.body.dataset.filterStatus || "all";
  const searchValue = document
    .getElementById("search-input")
    .value.toLowerCase()
    .trim();

  let filtered = locations;

  if (filterStatus !== "all") {
    filtered = filtered.filter((loc) => loc.status === filterStatus);
  }
  if (searchValue) {
    filtered = filtered.filter((loc) => {
      return (
        loc.name.toLowerCase().includes(searchValue) ||
        (loc.notes || "").toLowerCase().includes(searchValue)
      );
    });
  }

  filtered.forEach((loc) => {
    const marker = new google.maps.Marker({
      position: { lat: loc.lat, lng: loc.lng },
      map,
      title: loc.name,
      icon: markerIconForStatus(loc.status),
    });

    const infoContent = `
      <div style="font-size:13px; max-width:230px;">
        <div style="font-weight:600; margin-bottom:2px;">${escapeHtml(
          loc.name
        )}</div>
        <div style="font-size:11px; color:#64748b; margin-bottom:4px;">
          Status: ${escapeHtml(loc.status)}
        </div>
        ${
          loc.notes
            ? `<div style="white-space:pre-wrap; margin-bottom:4px;">${escapeHtml(
                loc.notes
              )}</div>`
            : ""
        }
        <div style="font-size:10px; color:#94a3b8;">
          ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}
        </div>
      </div>
    `;

    const infoWindow = new google.maps.InfoWindow({ content: infoContent });

    marker.addListener("click", () => {
      infoWindow.open(map, marker);
    });

    markers.push(marker);
  });
}

function renderLocationList() {
  const list = document.getElementById("locations-list");
  const filterStatus = document.body.dataset.filterStatus || "all";
  const searchValue = document
    .getElementById("search-input")
    .value.toLowerCase()
    .trim();

  let filtered = locations;

  if (filterStatus !== "all") {
    filtered = filtered.filter((loc) => loc.status === filterStatus);
  }
  if (searchValue) {
    filtered = filtered.filter((loc) => {
      return (
        loc.name.toLowerCase().includes(searchValue) ||
        (loc.notes || "").toLowerCase().includes(searchValue)
      );
    });
  }

  if (!filtered.length) {
    list.innerHTML =
      '<p class="text-xs text-slate-500">No spots yet. Click on the map to drop a pin and save your first one.</p>';
    return;
  }

  list.innerHTML = "";
  filtered
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach((loc) => {
      const item = document.createElement("button");
      item.className =
        "w-full text-left px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-sky-500 hover:bg-slate-900/80 transition flex flex-col gap-1";

      item.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <span class="font-medium text-sm truncate">${escapeHtml(
            loc.name
          )}</span>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
            ${escapeHtml(statusPretty(loc.status))}
          </span>
        </div>
        ${
          loc.notes
            ? `<p class="text-xs text-slate-300 line-clamp-2">${escapeHtml(
                loc.notes
              )}</p>`
            : ""
        }
        <p class="text-[10px] text-slate-500">${loc.lat.toFixed(
          4
        )}, ${loc.lng.toFixed(4)}</p>
      `;

      item.addEventListener("click", () => {
        map.panTo({ lat: loc.lat, lng: loc.lng });
        map.setZoom(15);
      });

      list.appendChild(item);
    });
}

function statusPretty(status) {
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

function saveLocationsToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
}

function loadLocationsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      locations = parsed;
    }
  } catch (err) {
    console.error("Failed to load locations from storage", err);
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

/* BACKEND STUBS – fill in later once you pick a backend */
async function saveLocationToBackend(location) {
  // Example for later:
  // await fetch("/api/locations", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify(location),
  // });
}

async function loadLocationsFromBackend() {
  // Example for later:
  // const res = await fetch("/api/locations");
  // const data = await res.json();
  // locations = data;
  // saveLocationsToStorage();
  // renderLocationList();
  // renderMarkers();
}
