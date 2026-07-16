(function () {
  var installPromptEvent = null;
  var installButtons = Array.prototype.slice.call(document.querySelectorAll('[data-pwa-install]'));
  var statusTargets = Array.prototype.slice.call(document.querySelectorAll('[data-pwa-status]'));
  var offlineMessage = 'An internet connection is required for this FRANGAIN Ecosystem action.';
  var isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  var isChromiumInstallBrowser = /(chrome|chromium|crios|edg|opr|samsungbrowser)/i.test(window.navigator.userAgent) && !isIos;
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  var originalFetch = window.fetch ? window.fetch.bind(window) : null;

  function setStatus(message, type) {
    statusTargets.forEach(function (target) {
      target.textContent = message;
      target.className = 'pwa-status' + (type ? ' ' + type : '');
    });
  }

  function showInstallButtons() {
    installButtons.forEach(function (button) {
      button.hidden = false;
      button.disabled = false;
    });
  }

  function hideInstallButtons() {
    installButtons.forEach(function (button) {
      button.hidden = true;
    });
  }

  function setButtonLabel(button, label) {
    var labelTarget = button.querySelector('p');

    if (labelTarget) {
      labelTarget.textContent = label;
      return;
    }

    button.textContent = label;
  }

  function markInstalled() {
    hideInstallButtons();
    setStatus('FRANGAIN is installed on this device.', 'success');
  }

  function showIosInstallHelp() {
    showInstallButtons();
    installButtons.forEach(function (button) {
      setButtonLabel(button, button.getAttribute('data-ios-label') || 'Add to Home Screen');
    });
    setStatus('On iPhone, use Share, then Add to Home Screen to install FRANGAIN.', '');
  }

  function showUnsupportedInstallHelp() {
    showInstallButtons();
    setStatus('Use your browser menu to install FRANGAIN on this device.', '');
  }

  function isApiUrl(resource) {
    var url = '';

    if (typeof resource === 'string') {
      url = resource;
    } else if (resource && resource.url) {
      url = resource.url;
    }

    if (!url) {
      return false;
    }

    try {
      return new URL(url, window.location.origin).pathname.indexOf('/api/') === 0;
    } catch (error) {
      return false;
    }
  }

  function offlineApiResponse() {
    return Promise.resolve(
      new Response(
        JSON.stringify({
          success: false,
          message: offlineMessage,
          errors: {}
        }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    );
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker
        .register('/sw.js')
        .then(function (registration) {
          registration.update();
        })
        .catch(function () {
          setStatus('Offline browsing will be available after your next successful online visit.', 'error');
        });
    });
  }

  if (originalFetch) {
    window.fetch = function (resource, options) {
      if (!navigator.onLine && isApiUrl(resource)) {
        setStatus(offlineMessage, 'error');
        return offlineApiResponse();
      }

      return originalFetch(resource, options);
    };
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    installPromptEvent = event;
    showInstallButtons();
    setStatus('Install FRANGAIN on this device.', '');
  });

  installButtons.forEach(function (button) {
    button.addEventListener('click', function (event) {
      event.preventDefault();

      if (isStandalone) {
        markInstalled();
        return;
      }

      if (installPromptEvent) {
        var promptEvent = installPromptEvent;
        installPromptEvent = null;
        promptEvent.prompt();
        promptEvent.userChoice.then(function (choice) {
          if (choice.outcome === 'accepted') {
            markInstalled();
          } else {
            setStatus('You can install FRANGAIN anytime from this page.', '');
          }
        });
        return;
      }

      if (isIos) {
        showIosInstallHelp();
        return;
      }

      if (isChromiumInstallBrowser) {
        setStatus('FRANGAIN installation will open as soon as your browser confirms the app is ready to install.', '');
        return;
      }

      showUnsupportedInstallHelp();
    });
  });

  window.addEventListener('appinstalled', markInstalled);

  window.addEventListener('online', function () {
    setStatus('You are back online. FRANGAIN Ecosystem actions are available.', 'success');
  });

  window.addEventListener('offline', function () {
    setStatus('You are offline. Previously visited pages remain available for browsing.', 'error');
  });

  if (isStandalone) {
    markInstalled();
  } else if (isIos) {
    showIosInstallHelp();
  } else {
    showInstallButtons();
  }
})();
