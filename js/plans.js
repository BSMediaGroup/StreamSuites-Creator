(() => {
  "use strict";

  const VALID_TIER_IDS = new Set(["core", "gold", "pro"]);
  const REQUIRED_TIER_ID = "core";
  const tierUtils = window.StreamSuitesTier || {};
  const normalizeTier = tierUtils.normalizeTier;
  const renderTierPill = tierUtils.renderTierPill;
  let initialized = false;

  function normalizeTierId(tierId) {
    if (typeof tierId !== "string") return "";
    const normalized = tierId.trim().toLowerCase();
    return VALID_TIER_IDS.has(normalized) ? normalized : "";
  }

  function normalizeVisibility(visibility) {
    if (typeof visibility !== "string") return "";
    const normalized = visibility.trim().toLowerCase();
    return normalized === "public" || normalized === "soft_locked" ? normalized : "";
  }

  function normalizeEffectiveTier(raw) {
    if (!raw || typeof raw !== "object") return null;
    const tierId = normalizeTierId(raw.tier_id || raw.tierId);
    const tierLabel =
      typeof raw.tier_label === "string"
        ? raw.tier_label.trim()
        : typeof raw.tierLabel === "string"
          ? raw.tierLabel.trim()
          : "";
    const visibility = normalizeVisibility(raw.visibility);

    if (!tierId && !tierLabel && !visibility) return null;

    return {
      tierId,
      tierLabel: tierLabel || (tierId ? tierId.toUpperCase() : ""),
      visibility
    };
  }

  function applyTierState(session) {
    const effectiveTier = normalizeEffectiveTier(session?.effectiveTier || session?.effective_tier);
    const currentTierId = normalizeTierId(effectiveTier?.tierId || session?.tier || "");
    const visibility = effectiveTier?.visibility || "public";

    document.querySelectorAll("[data-tier-id]").forEach((card) => {
      const tierId = normalizeTierId(card.getAttribute("data-tier-id") || "");
      const isCore = tierId === REQUIRED_TIER_ID;
      const isLocked = !isCore || visibility === "soft_locked";
      const isCurrent = isCore && currentTierId === REQUIRED_TIER_ID;
      const labelEl = card.querySelector("[data-tier-label]");
      const actionEl = card.querySelector("[data-tier-action]");

      card.classList.toggle("is-active", isCurrent);
      card.classList.toggle("is-disabled", isLocked);
      if (labelEl && typeof normalizeTier === "function" && typeof renderTierPill === "function") {
        const tierLabel = normalizeTier(tierId || REQUIRED_TIER_ID);
        renderTierPill(labelEl, tierLabel);
      }
      if (actionEl instanceof HTMLButtonElement) {
        if (isLocked) {
          actionEl.textContent = "Not available yet";
          actionEl.disabled = true;
          actionEl.setAttribute("aria-disabled", "true");
        } else {
          actionEl.textContent = isCurrent ? "Current plan" : "Core tier";
          actionEl.disabled = false;
          actionEl.setAttribute("aria-disabled", "false");
        }
      }
      card.dataset.locked = isLocked ? "true" : "false";
    });
  }

  async function init() {
    if (initialized) return;
    initialized = true;
    try {
      const session = await window.StreamSuitesAuth?.loadSession?.();
      applyTierState(session || {});
    } catch (err) {
      applyTierState({});
    }
  }

  function destroy() {
    initialized = false;
  }

  function autoInitWhenPresent() {
    if (!document.querySelector("[data-tier-id]")) return;
    void init();
  }

  window.PlansView = {
    init,
    destroy
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInitWhenPresent, {
      once: true
    });
  } else {
    autoInitWhenPresent();
  }
})();
