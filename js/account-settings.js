(() => {
  "use strict";

  function detectApiBase() {
    const host = (window.location.hostname || "").toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://127.0.0.1:18087";
    }
    return "https://api.streamsuites.app";
  }

  const API_BASE = detectApiBase();
  const AUTH_METHODS_ENDPOINT = `${API_BASE}/api/account/auth-methods`;
  const AUTH_UNLINK_ENDPOINT = `${API_BASE}/api/account/auth-methods/unlink`;
  const EMAIL_CHANGE_REQUEST_ENDPOINT = `${API_BASE}/api/account/email/change/request`;

  function setMessage(selector, message, tone) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.textContent = message || "";
    el.dataset.tone = tone || "neutral";
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: "include",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch (err) {
      payload = null;
    }
    if (!response.ok) {
      const message = payload?.error || payload?.message || `Request failed (${response.status})`;
      const error = new Error(message);
      error.payload = payload;
      throw error;
    }
    return payload || {};
  }

  function oauthStartUrl(provider) {
    const normalized = String(provider || "").trim().toLowerCase();
    const returnTo = `${window.location.origin}/views/account.html`;
    if (normalized === "twitch") {
      return `${API_BASE}/oauth/twitch/start?surface=creator&mode=link&return_to=${encodeURIComponent(returnTo)}`;
    }
    if (normalized === "x") {
      return `${API_BASE}/auth/x/start?surface=creator&mode=link&return_to=${encodeURIComponent(returnTo)}`;
    }
    return `${API_BASE}/auth/${normalized}?surface=creator&mode=link&return_to=${encodeURIComponent(returnTo)}`;
  }

  function setProviderButtons(provider, linked) {
    const connectButton = document.querySelector(`[data-account-provider-connect="${provider}"]`);
    const disconnectButton = document.querySelector(`[data-account-provider-disconnect="${provider}"]`);
    if (connectButton instanceof HTMLButtonElement) {
      connectButton.disabled = !!linked;
    }
    if (disconnectButton instanceof HTMLButtonElement) {
      disconnectButton.disabled = !linked;
    }
  }

  function setPendingEmailStatus(payload) {
    const pendingEmail = payload?.pending_email || "";
    const expiresAt = payload?.email_change_expires_at || payload?.expires_at || "";
    if (pendingEmail) {
      setMessage(
        "[data-account-email-change-status=\"true\"]",
        `Pending verification: ${pendingEmail}${expiresAt ? ` (expires ${expiresAt})` : ""}`,
        "warning"
      );
    }
  }

  function applyAuthMethods(payload) {
    const linked = new Set(Array.isArray(payload?.linked_providers) ? payload.linked_providers : []);
    const passwordStatus = document.querySelector("[data-account-password-status=\"true\"]");
    if (passwordStatus) {
      passwordStatus.textContent = payload?.password_set
        ? "Password is set for this account."
        : "Password is not set. Use OAuth or ask admin to issue a password-set email.";
    }
    ["google", "github", "discord", "x", "twitch", "email"].forEach((provider) => {
      const isLinked = linked.has(provider);
      setProviderButtons(provider, isLinked);
    });
    setPendingEmailStatus(payload);
  }

  async function refreshAuthMethods() {
    const payload = await requestJson(AUTH_METHODS_ENDPOINT, { method: "GET" });
    applyAuthMethods(payload);
    return payload;
  }

  function wireProviderButtons() {
    document.querySelectorAll("[data-account-provider-connect]").forEach((button) => {
      button.addEventListener("click", () => {
        const provider = button.getAttribute("data-account-provider-connect") || "";
        if (!provider) return;
        window.location.assign(oauthStartUrl(provider));
      });
    });

    document.querySelectorAll("[data-account-provider-disconnect]").forEach((button) => {
      button.addEventListener("click", async () => {
        const provider = button.getAttribute("data-account-provider-disconnect") || "";
        if (!provider) return;
        try {
          const payload = await requestJson(AUTH_UNLINK_ENDPOINT, {
            method: "POST",
            body: JSON.stringify({ provider }),
          });
          applyAuthMethods(payload);
          setMessage("[data-account-provider-status-message=\"true\"]", `Disconnected ${provider}.`, "success");
        } catch (err) {
          setMessage(
            "[data-account-provider-status-message=\"true\"]",
            err?.message || `Unable to disconnect ${provider}.`,
            "danger"
          );
        }
      });
    });
  }

  function wireEmailChange() {
    const input = document.querySelector("[data-account-email-change-input=\"true\"]");
    const button = document.querySelector("[data-account-email-change-request=\"true\"]");
    if (!(input instanceof HTMLInputElement) || !(button instanceof HTMLButtonElement)) {
      return;
    }
    button.addEventListener("click", async () => {
      const newEmail = String(input.value || "").trim().toLowerCase();
      if (!newEmail) {
        setMessage("[data-account-email-change-status=\"true\"]", "Enter a new email address.", "danger");
        return;
      }
      button.disabled = true;
      setMessage("[data-account-email-change-status=\"true\"]", "Sending verification email...", "neutral");
      try {
        const payload = await requestJson(EMAIL_CHANGE_REQUEST_ENDPOINT, {
          method: "POST",
          body: JSON.stringify({ new_email: newEmail }),
        });
        setPendingEmailStatus(payload);
        await refreshAuthMethods();
      } catch (err) {
        setMessage(
          "[data-account-email-change-status=\"true\"]",
          err?.message || "Unable to send verification email.",
          "danger"
        );
      } finally {
        button.disabled = false;
      }
    });
  }

  async function init() {
    if (!window.location.pathname.endsWith("/views/account.html")) return;
    wireProviderButtons();
    wireEmailChange();
    try {
      const payload = await refreshAuthMethods();
      if (window.location.search.includes("linked_provider=")) {
        setMessage(
          "[data-account-provider-status-message=\"true\"]",
          `Linked ${window.location.search.split("linked_provider=")[1]?.split("&")[0] || "provider"}.`,
          "success"
        );
      } else if (payload?.pending_email) {
        setPendingEmailStatus(payload);
      }
    } catch (err) {
      setMessage("[data-account-provider-status-message=\"true\"]", err?.message || "Unable to load sign-in methods.", "danger");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
