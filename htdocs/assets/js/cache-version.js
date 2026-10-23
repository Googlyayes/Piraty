(function () {
  // IMPORTANT:
  // Change PIRATY_VERSION on every deploy.
  // Example: "2026.10.22.008"
  const PIRATY_VERSION = '2026.10.22.009';
  const VERSION_KEY = 'piraty-release-version';
  const CLEANUP_KEY = 'piraty-cache-cleanup-version';
  const RELOAD_KEY = 'piraty_reloaded_for_version';
  const LOCAL_URL_RE = /^(?![a-z][a-z0-9+.-]*:|\/\/|#)/i;

  window.PIRATY_VERSION = PIRATY_VERSION;

  function withVersion(url) {
    if (!url) return url;
    const value = String(url);

    if (!LOCAL_URL_RE.test(value)) {
      try {
        const parsed = new URL(value, window.location.href);
        if (parsed.origin !== window.location.origin) return url;
        parsed.searchParams.set('v', PIRATY_VERSION);
        return parsed.href;
      } catch (error) {
        return url;
      }
    }

    const [path, hash = ''] = value.split('#');
    const [base, query = ''] = path.split('?');
    const params = new URLSearchParams(query);
    params.set('v', PIRATY_VERSION);
    return `${base}?${params.toString()}${hash ? `#${hash}` : ''}`;
  }

  function applyCacheVersion(el) {
    if (!el || el.dataset.cacheApplied === PIRATY_VERSION) return;

    if (el.dataset.cacheHref) {
      el.setAttribute('href', withVersion(el.dataset.cacheHref));
    }

    if (el.dataset.cacheSrc) {
      if (el.tagName === 'SCRIPT') {
        el.async = false;
      }
      el.setAttribute('src', withVersion(el.dataset.cacheSrc));
      if (el.tagName === 'SOURCE' && el.parentElement?.load) {
        el.parentElement.load();
      }
    }

    if (el.dataset.cachePoster) {
      el.setAttribute('poster', withVersion(el.dataset.cachePoster));
    }

    el.dataset.cacheApplied = PIRATY_VERSION;
  }

  function scan(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope
      .querySelectorAll('[data-cache-href], [data-cache-src], [data-cache-poster]')
      .forEach(applyCacheVersion);
  }

  async function clearOldOriginCaches() {
    try {
      if (localStorage.getItem(CLEANUP_KEY) === PIRATY_VERSION) return;
    } catch (error) {}

    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(registration => registration.unregister()));
      }
    } catch (error) {}

    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      }
    } catch (error) {}

    try {
      localStorage.setItem(CLEANUP_KEY, PIRATY_VERSION);
    } catch (error) {}
  }

  async function runVersionCheck() {
    const storedVersion = (() => {
      try {
        return localStorage.getItem(VERSION_KEY);
      } catch (error) {
        return null;
      }
    })();

    if (storedVersion && storedVersion !== PIRATY_VERSION) {
      try {
        localStorage.setItem(VERSION_KEY, PIRATY_VERSION);
      } catch (error) {}

      await clearOldOriginCaches();

      try {
        if (sessionStorage.getItem(RELOAD_KEY) !== PIRATY_VERSION) {
          sessionStorage.setItem(RELOAD_KEY, PIRATY_VERSION);
          window.location.reload();
          return;
        }
      } catch (error) {}
    } else if (!storedVersion) {
      try {
        localStorage.setItem(VERSION_KEY, PIRATY_VERSION);
      } catch (error) {}
      await clearOldOriginCaches();
    } else {
      await clearOldOriginCaches();
    }
  }

  window.PiraTYCache = {
    VERSION: PIRATY_VERSION,
    withVersion,
    applyCacheVersion,
    scan
  };

  scan(document);

  new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        applyCacheVersion(node);
        scan(node);
      });
    });
  }).observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('DOMContentLoaded', () => scan(document));

  runVersionCheck().catch(() => {});
})();
