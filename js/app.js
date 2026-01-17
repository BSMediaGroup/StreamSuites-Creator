(() => {
  "use strict";

  if (window.App) {
    return;
  }

  const storage = {
    loadFromLocalStorage(key, fallback = null) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (err) {
        console.warn("[Dashboard][Storage] Failed to load", err);
        return fallback;
      }
    },
    saveToLocalStorage(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (err) {
        console.warn("[Dashboard][Storage] Failed to save", err);
      }
    },
    downloadJson(filename, payload) {
      const data = JSON.stringify(payload ?? {}, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename || "download.json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    },
    exportJsonToDownload(filename, payload) {
      storage.downloadJson(filename, payload);
    },
    importJsonFromFile(file) {
      return new Promise((resolve, reject) => {
        if (!file) {
          reject(new Error("No file provided"));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          try {
            resolve(JSON.parse(reader.result));
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
        reader.readAsText(file);
      });
    }
  };

  window.App = {
    storage,
    state: {}
  };
})();
