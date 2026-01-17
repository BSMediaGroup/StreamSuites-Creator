(() => {
  "use strict";

  if (!window.Versioning) return;

  const selector = "[data-version-format]";
  if (!document.querySelector(selector)) return;

  window.Versioning.applyVersionToElements({
    version: selector,
    build: selector
  });
})();
