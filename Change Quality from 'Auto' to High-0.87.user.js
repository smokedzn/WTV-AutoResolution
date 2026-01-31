// ==UserScript==
// @name         Change Quality from 'Auto' to High
// @namespace    smokedzn
// @version      0.87
// @description  Selects the best available preferred quality.
// @match        https://w.tv/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  // Ordered fallback list: first match wins
  const QUALITY_PREFERENCE = ["2160p60", "2160p", "1440p60", "1440p", "1080p60", "1080p50", "1050p60", "1050p", "1032p60", "1080p", "1032p", "900p60", "900p", "720p60", "720p", "480p", "360p", "160p", "Auto"];

  // Internal "do it once" latch (per page load)
  let didSetQuality = false;

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function normalizeText(s) {
    return (s || "").replace(/\s+/g, " ").trim();
  }

  function findMenu() {
    return document.querySelector("ul.quality-selector");
  }

  function getItems(ul) {
    return [...ul.querySelectorAll("li.quality-selector__item")];
  }

  function findBestAvailableItem(items) {
    // Build map from label -> <li>
    const byLabel = new Map();
    for (const li of items) {
      const label = normalizeText(li.textContent);
      if (label) byLabel.set(label, li);
    }

    for (const pref of QUALITY_PREFERENCE) {
      // Match exact label first, then "contains" as a fallback
      if (byLabel.has(pref)) return byLabel.get(pref);
      const contains = items.find(li => normalizeText(li.textContent).includes(pref));
      if (contains) return contains;
    }
    return null;
  }

  function clickToSelect(li) {
    if (!li) return false;
    li.click();
    return true;
  }

  function trySelectFromOpenMenu() {
    const ul = findMenu();
    if (!ul) return false;

    const items = getItems(ul);
    if (!items.length) return false;

    const best = findBestAvailableItem(items);
    if (!best) return false;

    return clickToSelect(best);
  }

  async function openMenuAndSelectOnce() {
    if (didSetQuality) return;

    // Only open the menu via its own trigger:
    // <div role="dialog" aria-labelledby="reka-popover-trigger-...">
    const dialog = ul.closest('[role="dialog"][aria-labelledby]');
    if (!dialog) return null;

    const triggerId = dialog.getAttribute("aria-labelledby");
    if (!triggerId) return null;

    return document.getElementById(triggerId);
  }

  function findKnownQualityTrigger() {
    // If menu is already open, select and finish.
    if (trySelectFromOpenMenu()) {
      didSetQuality = true;
      cleanup();
      return;
    }

    // Otherwise, click the trigger to open it.
    const trigger = document.querySelector('button[aria-haspopup="dialog"][id^="reka-popover-trigger"]');
    if (!trigger) return;

    // Open only if not expanded
    if (trigger.getAttribute("aria-expanded") !== "true") trigger.click();

    // Wait briefly for menu to appear, then select
    for (const ms of [0, 30, 80, 150, 300, 600]) {
      await sleep(ms);
      if (trySelectFromOpenMenu()) {
        didSetQuality = true;
        cleanup();
        return;
      }
    }
  }

  // Observers/listeners, removed after first successful selection
  let mo = null;
  let playHandler = null;

  function cleanup() {
    if (mo) mo.disconnect();
    if (playHandler) document.removeEventListener("play", playHandler, true);
  }

  // Watch for popover mounting; act only until we’ve set once.
  mo = new MutationObserver(() => {
    if (didSetQuality) return;
    if (findMenu()) openMenuAndSelectOnce();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // Try when playback starts (often when the player UI becomes ready)
  playHandler = () => openMenuAndSelectOnce();
  document.addEventListener("play", playHandler, true);

  // Initial attempt
  openMenuAndSelectOnce();
})();
