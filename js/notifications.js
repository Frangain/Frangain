(function () {
  var statusText = document.getElementById('notificationStatus');
  var permissionText = document.getElementById('notificationPermission');
  var deliveryText = document.getElementById('notificationDelivery');
  var messageText = document.getElementById('notificationMessage');
  var enableButton = document.getElementById('enableNotificationsButton');
  var disableButton = document.getElementById('disableNotificationsButton');
  var saveButton = document.getElementById('saveNotificationPreferencesButton');
  var typeInputs = Array.prototype.slice.call(document.querySelectorAll('[data-notification-type]'));
  var currentNotifications = null;
  var vapidPublicKey = '';

  if (!statusText || !permissionText || !deliveryText || !enableButton || !disableButton || !saveButton) {
    return;
  }

  function setMessage(message, type) {
    messageText.textContent = message || '';
    messageText.className = 'notification-message' + (type ? ' ' + type : '');
  }

  function setBusy(isBusy) {
    enableButton.disabled = isBusy;
    disableButton.disabled = isBusy;
    saveButton.disabled = isBusy;
  }

  function getPermissionState() {
    if (!('Notification' in window)) {
      return 'unsupported';
    }

    return Notification.permission;
  }

  function isPushSupported() {
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  }

  function selectedTypes() {
    return typeInputs.reduce(function (types, input) {
      types[input.getAttribute('data-notification-type')] = input.checked;
      return types;
    }, {});
  }

  function renderTypes(types) {
    typeInputs.forEach(function (input) {
      var key = input.getAttribute('data-notification-type');
      input.checked = !types || types[key] !== false;
    });
  }

  function renderStatus(notifications) {
    currentNotifications = notifications || {};
    var permission = getPermissionState();
    var enabled = currentNotifications.enabled === true;

    statusText.textContent = enabled ? 'Enabled' : 'Disabled';
    permissionText.textContent = permission.charAt(0).toUpperCase() + permission.slice(1);
    deliveryText.textContent = enabled && currentNotifications.pushSubscription ? 'Ready' : 'Not Active';
    enableButton.disabled = enabled || permission === 'denied' || !isPushSupported();
    disableButton.disabled = !enabled;
    saveButton.disabled = !enabled;
    renderTypes(currentNotifications.types);
  }

  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = window.atob(base64);
    var outputArray = new Uint8Array(rawData.length);

    for (var index = 0; index < rawData.length; index += 1) {
      outputArray[index] = rawData.charCodeAt(index);
    }

    return outputArray;
  }

  function requestJson(url, options) {
    return fetch(url, options).then(function (response) {
      return response.json().then(function (data) {
        return { ok: response.ok, status: response.status, data: data };
      });
    });
  }

  function loadNotificationStatus() {
    if (!isPushSupported()) {
      renderStatus({ enabled: false, types: {} });
      setMessage('This browser does not support FRANGAIN notifications yet.', 'error');
      return Promise.resolve();
    }

    if (!navigator.onLine) {
      renderStatus(currentNotifications || { enabled: false, types: {} });
      setMessage('An internet connection is required to configure notifications.', 'error');
      return Promise.resolve();
    }

    return requestJson('/api/notifications/status', {
      method: 'GET',
      credentials: 'same-origin',
    }).then(function (result) {
      if (!result.ok || !result.data.success) {
        setMessage(result.data.message || 'Unable to load notification settings.', 'error');
        return;
      }

      vapidPublicKey = result.data.data.vapidPublicKey || '';
      renderStatus(result.data.data.notifications);

      if (!vapidPublicKey) {
        setMessage('Notifications need VAPID_PUBLIC_KEY before they can be enabled.', 'error');
      }
    }).catch(function () {
      setMessage('Unable to load notification settings.', 'error');
    });
  }

  function getPushSubscription() {
    if (!vapidPublicKey) {
      return Promise.reject(new Error('Notifications need VAPID_PUBLIC_KEY before they can be enabled.'));
    }

    return navigator.serviceWorker.ready.then(function (registration) {
      return registration.pushManager.getSubscription().then(function (subscription) {
        if (subscription) {
          return subscription;
        }

        return registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      });
    });
  }

  function enableNotifications() {
    if (!navigator.onLine) {
      setMessage('An internet connection is required to enable notifications.', 'error');
      return;
    }

    if (!isPushSupported()) {
      setMessage('This browser does not support FRANGAIN notifications yet.', 'error');
      return;
    }

    var permission = getPermissionState();

    setBusy(true);
    setMessage('Preparing notifications...', '');

    Promise.resolve()
      .then(function () {
        if (permission === 'default') {
          return Notification.requestPermission();
        }

        return permission;
      })
      .then(function (updatedPermission) {
        if (updatedPermission !== 'granted') {
          renderStatus({ enabled: false, permission: updatedPermission, types: selectedTypes() });
          throw new Error('Notifications were not enabled. Browser permission is ' + updatedPermission + '.');
        }

        return getPushSubscription().then(function (subscription) {
          return requestJson('/api/notifications/subscribe', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              permission: updatedPermission,
              subscription: subscription.toJSON(),
              types: selectedTypes(),
            }),
          });
        });
      })
      .then(function (result) {
        if (!result.ok || !result.data.success) {
          throw new Error(result.data.message || 'Unable to enable notifications.');
        }

        renderStatus(result.data.data.notifications);
        setMessage(result.data.message || 'Notifications enabled.', 'success');
      })
      .catch(function (error) {
        setMessage(error.message || 'Unable to enable notifications.', 'error');
      })
      .finally(function () {
        setBusy(false);
        renderStatus(currentNotifications || { enabled: false, types: selectedTypes() });
      });
  }

  function disableNotifications() {
    if (!navigator.onLine) {
      setMessage('An internet connection is required to disable notifications.', 'error');
      return;
    }

    setBusy(true);
    setMessage('Disabling notifications...', '');

    navigator.serviceWorker.ready
      .then(function (registration) {
        return registration.pushManager.getSubscription();
      })
      .then(function (subscription) {
        if (subscription) {
          return subscription.unsubscribe();
        }

        return true;
      })
      .then(function () {
        return requestJson('/api/notifications/unsubscribe', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            permission: getPermissionState(),
            types: selectedTypes(),
          }),
        });
      })
      .then(function (result) {
        if (!result.ok || !result.data.success) {
          throw new Error(result.data.message || 'Unable to disable notifications.');
        }

        renderStatus(result.data.data.notifications);
        setMessage(result.data.message || 'Notifications disabled.', 'success');
      })
      .catch(function (error) {
        setMessage(error.message || 'Unable to disable notifications.', 'error');
      })
      .finally(function () {
        setBusy(false);
        renderStatus(currentNotifications || { enabled: false, types: selectedTypes() });
      });
  }

  function savePreferences() {
    if (!currentNotifications || currentNotifications.enabled !== true) {
      setMessage('Enable notifications before saving notification preferences.', 'error');
      return;
    }

    if (!navigator.onLine) {
      setMessage('An internet connection is required to save notification preferences.', 'error');
      return;
    }

    setBusy(true);
    setMessage('Saving notification preferences...', '');

    navigator.serviceWorker.ready
      .then(function (registration) {
        return registration.pushManager.getSubscription();
      })
      .then(function (subscription) {
        if (!subscription) {
          throw new Error('Notification subscription was not found. Enable notifications again.');
        }

        return requestJson('/api/notifications/subscribe', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            permission: getPermissionState(),
            subscription: subscription.toJSON(),
            types: selectedTypes(),
          }),
        });
      })
      .then(function (result) {
        if (!result.ok || !result.data.success) {
          throw new Error(result.data.message || 'Unable to save notification preferences.');
        }

        renderStatus(result.data.data.notifications);
        setMessage('Notification preferences saved.', 'success');
      })
      .catch(function (error) {
        setMessage(error.message || 'Unable to save notification preferences.', 'error');
      })
      .finally(function () {
        setBusy(false);
        renderStatus(currentNotifications || { enabled: false, types: selectedTypes() });
      });
  }

  enableButton.addEventListener('click', enableNotifications);
  disableButton.addEventListener('click', disableNotifications);
  saveButton.addEventListener('click', savePreferences);
  window.addEventListener('online', loadNotificationStatus);
  window.addEventListener('offline', function () {
    setMessage('You are offline. Notification settings can be changed when you reconnect.', 'error');
  });

  loadNotificationStatus();
})();
