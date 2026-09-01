/**
 * Workspace PWA registration.
 *
 * Registers the Workspace service worker at '/' scope and keeps the
 * theme-color meta tag in sync with the active theme. Dox and Grids manage
 * their own PWAs separately.
 */
(function () {
  'use strict';

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    // Service workers require a secure context (or localhost for dev).
    if (location.protocol !== 'https:' &&
        location.hostname !== 'localhost' &&
        location.hostname !== '127.0.0.1') {
      return;
    }

    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function (error) {
        console.error('[PWA] Service worker registration failed:', error);
      });
    });
  }

  function setupThemeColor() {
    var updateThemeColor = function () {
      var meta = document.querySelector('meta[name="theme-color"]');
      if (!meta) return;

      var theme = document.documentElement.getAttribute('data-theme');
      var isDark = theme === 'dark' ||
        (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      meta.setAttribute('content', isDark ? '#1a1a1a' : '#4F46E5');
    };

    updateThemeColor();

    // themes.js sets data-theme on <html>; re-run whenever it changes.
    var observer = new MutationObserver(updateThemeColor);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class']
    });
  }

  registerServiceWorker();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupThemeColor);
  } else {
    setupThemeColor();
  }
})();
