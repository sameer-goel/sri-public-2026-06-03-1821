// ============================================
// Om Sacred Space - Shared Theme Controller
// --------------------------------------------
// The saved theme + glow intensity are applied PRE-PAINT by a tiny inline
// snippet in each page's <head> (prevents flash of wrong theme). This file
// (loaded with `defer`) wires up the settings panel UI and keeps it in sync.
//
// Single source of truth for all pages - do not duplicate this logic inline.
// ============================================
(function () {
  'use strict';

  var THEMES = {
    dark: 'Mystic Dark',
    light: 'Sacred Light',
    forest: 'Forest Temple',
    ocean: 'Ocean Depth',
    rose: 'Rose Quartz',
    sand: 'Desert Sand',
    divine: 'Divine Lights'
  };
  var DEFAULT_THEME = 'divine';

  function $(id) { return document.getElementById(id); }

  function readStore(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function writeStore(key, val) {
    try { localStorage.setItem(key, val); } catch (e) { /* storage blocked */ }
  }

  function currentTheme() {
    var t = document.documentElement.getAttribute('data-theme');
    return THEMES[t] ? t : DEFAULT_THEME;
  }

  // Apply a theme everywhere and sync the panel UI. Safe to call when the
  // panel markup is absent (e.g. a page without the settings drawer).
  function applyTheme(name) {
    if (!THEMES[name]) name = DEFAULT_THEME;
    document.documentElement.setAttribute('data-theme', name);
    writeStore('oss-theme', name);

    var activeNameEl = $('activeThemeName');
    if (activeNameEl) activeNameEl.textContent = THEMES[name];

    var presetsEl = $('themePresets');
    if (presetsEl) {
      presetsEl.querySelectorAll('.tp__preset').forEach(function (b) {
        b.classList.toggle('tp__preset--active', b.dataset.theme === name);
      });
    }
  }

  function init() {
    var panel = $('themePanel');
    var backdrop = $('tpBackdrop');
    var trigger = $('atmosphereTrigger');
    var closeBtn = $('themePanelClose');
    var presetsEl = $('themePresets');

    // Re-sync the panel UI to the theme already applied pre-paint.
    applyTheme(currentTheme());

    function openPanel() {
      if (panel) panel.classList.add('tp--open');
      if (backdrop) backdrop.classList.add('tp__backdrop--open');
      if (trigger) trigger.classList.add('atmosphere-trigger--open');
    }
    function closePanel() {
      if (panel) panel.classList.remove('tp--open');
      if (backdrop) backdrop.classList.remove('tp__backdrop--open');
      if (trigger) trigger.classList.remove('atmosphere-trigger--open');
    }

    if (trigger) {
      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        if (panel && panel.classList.contains('tp--open')) closePanel();
        else openPanel();
      });
    }
    if (closeBtn) closeBtn.addEventListener('click', closePanel);
    if (backdrop) backdrop.addEventListener('click', closePanel);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePanel();
    });

    if (presetsEl) {
      presetsEl.querySelectorAll('.tp__preset').forEach(function (b) {
        b.addEventListener('click', function () { applyTheme(b.dataset.theme); });
      });
    }

    // Glow intensity slider (drives the depth of the Divine Lights animation).
    var glowSlider = $('glowSlider');
    var glowVal = $('glowVal');
    if (glowSlider) {
      var savedGlow = readStore('oss-glow');
      var val = savedGlow !== null ? savedGlow : 50;
      glowSlider.value = val;
      document.documentElement.style.setProperty('--glow-intensity', (val / 100));
      if (glowVal) glowVal.textContent = val + '%';
      glowSlider.addEventListener('input', function () {
        document.documentElement.style.setProperty('--glow-intensity', (glowSlider.value / 100));
        if (glowVal) glowVal.textContent = glowSlider.value + '%';
        writeStore('oss-glow', glowSlider.value);
      });
    }

    // Keep theme in sync across open tabs.
    window.addEventListener('storage', function (e) {
      if (e.key === 'oss-theme' && e.newValue && THEMES[e.newValue]) {
        applyTheme(e.newValue);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
