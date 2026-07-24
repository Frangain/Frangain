(function () {
  var installPromptEvent = null;
  var installButtons = Array.prototype.slice.call(document.querySelectorAll('[data-pwa-install]'));
  var statusTargets = Array.prototype.slice.call(document.querySelectorAll('[data-pwa-status]'));
  var browserOpenButtons = [];
  var offlineMessage = 'An internet connection is required for this FRANGAIN Ecosystem action.';
  var userAgent = window.navigator.userAgent || '';
  var isIos = /iphone|ipad|ipod/i.test(userAgent);
  var isAndroid = /android/i.test(userAgent);
  var isInAppBrowser = /(FBAN|FBAV|FBIOS|FB_IAB|Messenger|Instagram|Line\/|Twitter|TikTok|Snapchat|Pinterest)/i.test(userAgent);
  var originalFetch = window.fetch ? window.fetch.bind(window) : null;
  var installCompletionTimer = null;

  function isStandaloneMode() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function createBrowserOpenButton(target) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'site-btn secondary-action pwa-browser-action';
    button.textContent = 'Open in Browser';
    button.addEventListener('click', function () {
      if (isAndroid) {
        var currentUrl = window.location.href.replace(/^https?:\/\//, '');
        window.location.href = 'intent://' + currentUrl + '#Intent;scheme=https;package=com.android.chrome;end';
        return;
      }

      window.location.href = window.location.href;
    });
    target.parentNode.insertBefore(button, target.nextSibling);
    browserOpenButtons.push(button);
  }

  function setupBrowserOpenButtons() {
    statusTargets.forEach(function (target) {
      createBrowserOpenButton(target);
    });
  }

  function setStatus(message, type) {
    statusTargets.forEach(function (target) {
      target.textContent = message;
      target.className = 'pwa-status' + (type ? ' ' + type : '');
    });
  }

  function showInstallButtons() {
    hideBrowserOpenButtons();
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

  function showBrowserOpenButtons() {
    browserOpenButtons.forEach(function (button) {
      button.hidden = false;
    });
  }

  function hideBrowserOpenButtons() {
    browserOpenButtons.forEach(function (button) {
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
    if (installCompletionTimer) {
      window.clearTimeout(installCompletionTimer);
      installCompletionTimer = null;
    }

    hideInstallButtons();
    hideBrowserOpenButtons();
    setStatus('FRANGAIN is installed on this device.', 'success');
  }

  function showIosInstallHelp() {
    hideInstallButtons();
    hideBrowserOpenButtons();
    setStatus('On iPhone, use Share, then Add to Home Screen to install FRANGAIN.', '');
  }

  function showUnsupportedInstallHelp() {
    hideInstallButtons();
    hideBrowserOpenButtons();
    setStatus('App installation is not supported in this browser. Please open FRANGAIN in Chrome on Android or Safari on iPhone to install the app.', '');
  }

  function showInAppBrowserHelp() {
    hideInstallButtons();
    showBrowserOpenButtons();
    setStatus('App installation is not supported inside this browser. Please open FRANGAIN in Chrome on Android or Safari on iPhone to install the app.', 'error');
  }

  function showWaitingForPrompt() {
    hideInstallButtons();
    hideBrowserOpenButtons();
    setStatus('', '');
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

  setupBrowserOpenButtons();
  hideInstallButtons();
  hideBrowserOpenButtons();

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    installPromptEvent = event;

    if (!isInAppBrowser && !isStandaloneMode()) {
      showInstallButtons();
      setStatus('Install FRANGAIN on this device.', '');
    }
  });

  installButtons.forEach(function (button) {
    button.addEventListener('click', function (event) {
      event.preventDefault();

      if (isStandaloneMode()) {
        markInstalled();
        return;
      }

      if (installPromptEvent) {
        var promptEvent = installPromptEvent;
        installPromptEvent = null;
        hideInstallButtons();
        setStatus('', '');
        promptEvent.prompt();
        promptEvent.userChoice.then(function (choice) {
          if (choice.outcome === 'accepted') {
            setStatus('Completing FRANGAIN installation...', '');
            installCompletionTimer = window.setTimeout(function () {
              installCompletionTimer = null;
              showInstallButtons();
              setStatus('FRANGAIN installation did not complete. Please try again.', 'error');
            }, 30000);
          } else {
            showInstallButtons();
            setStatus('You can install FRANGAIN anytime from this page.', '');
          }
        }).catch(function () {
          showInstallButtons();
          setStatus('FRANGAIN installation did not start. Please try again.', 'error');
        });
        return;
      }

      if (isInAppBrowser) {
        showInAppBrowserHelp();
        return;
      }

      if (isIos) {
        showIosInstallHelp();
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

  if (isStandaloneMode()) {
    markInstalled();
  } else if (isInAppBrowser) {
    showInAppBrowserHelp();
  } else if (isIos) {
    showIosInstallHelp();
  } else {
    showWaitingForPrompt();
  }
})();
