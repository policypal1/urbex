const supabase = window.supabaseClient;

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("spot-form");
  const submitBtn = document.getElementById("submit-btn");
  const ratingSection = document.getElementById("rating-section");

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

  function openPanel() {
    if (!panel) return;
    panel.classList.remove("side-panel-hidden");
    panel.scrollTop = 0;
  }

  function closePanel() {
    if (!panel) return;
    panel.classList.add("side-panel-hidden");
  }

  // Start hidden on load (all sizes)
  closePanel();

  // Open panel buttons
  if (addSpotDesktopBtn) addSpotDesktopBtn.addEventListener("click", openPanel);
  if (addSpotMobileBtn) addSpotMobileBtn.addEventListener("click", openPanel);
  if (panelClose) panelClose.addEventListener("click", closePanel);

  // Chips (form)
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

  // Submit (create only)
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

    const ok = await createSpotInBackend({
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

    if (!ok) return;

    // Reset form
    form.reset();
    submitBtn.textContent = "Save spot";

    statusHidden.value = "pending";
    securityHidden.value = "no";
    squattersHidden.value = "no";
    againHidden.value = "no";
    ratingHidden.value = "0";
    ratingSection.classList.add("hidden");
    ratingChips.forEach((c) => c.classList.remove("rating-active"));

    // Close panel after save
    closePanel();
  });
});

// --- Supabase helper ---
async function createSpotInBackend(payload) {
  const { error } = await supabase.from("spots").insert(payload);

  if (error) {
    console.error(error);
    alert("Could not save spot.");
    return false;
  }
  return true;
}
