(function () {
  var browserToggle = document.getElementById('browserNotificationsToggle');
  var miningToggle = document.getElementById('miningRemindersToggle');
  var announcementsToggle = document.getElementById('announcementsToggle');
  var browserStatus = document.getElementById('browserNotificationStatus');
  var notificationMessage = document.getElementById('notificationSettingsMessage');
  var changePasswordForm = document.getElementById('changePasswordForm');
  var changeEmailForm = document.getElementById('changeEmailForm');
  var changePasswordButton = document.getElementById('changePasswordButton');
  var changeEmailButton = document.getElementById('changeEmailButton');
  var passwordMessage = document.getElementById('passwordSettingsMessage');
  var emailMessage = document.getElementById('emailSettingsMessage');
  var mobileNav = document.getElementById('mobileNav');
  var topbarUser = document.getElementById('topbarUser');
  var userMenuButton = document.getElementById('userMenuButton');
  var topbarAvatar = document.getElementById('topbarAvatar');
  var topbarUsername = document.getElementById('topbarUsername');
  var currentNotifications = null;
  var vapidPublicKey = '';
  var isRendering = false;

  function redirectToLogin() {
    window.location.href = '/ecosystem/login.html';
  }

  function setMessage(element, message, type) {
    element.textContent = message || '';
    element.className = 'settings-message' + (type ? ' ' + type : '');
  }

  function setAccountBusy(button, isBusy, busyText, idleText) {
    button.disabled = isBusy;
    button.textContent = isBusy ? busyText : idleText;
  }

  function requestJson(url, options) {
    return fetch(url, options).then(function (response) {
      return response.json().then(function (data) {
        return { ok: response.ok, status: response.status, data: data };
      });
    });
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

  function selectedNotificationTypes() {
    var currentTypes = currentNotifications && currentNotifications.types ? currentNotifications.types : {};

    return {
      memoryMiningReady: currentTypes.memoryMiningReady !== false,
      miningSessionAvailable: miningToggle.checked,
      frangainAnnouncements: announcementsToggle.checked,
    };
  }

  function renderUser(user) {
    var name = user.displayName || user.username || 'FRANGAIN User';
    var initial = name.slice(0, 1).toUpperCase() || 'F';

    topbarUsername.textContent = name;
    topbarAvatar.textContent = initial;
    topbarAvatar.style.backgroundImage = '';
    topbarAvatar.classList.remove('has-image');

    if (user.profileImage) {
      topbarAvatar.style.backgroundImage = 'url("' + user.profileImage + '")';
      topbarAvatar.classList.add('has-image');
    }
  }

  function renderNotificationState(notifications) {
    var permission = getPermissionState();
    var enabled = notifications && notifications.enabled === true;
    var types = notifications && notifications.types ? notifications.types : {};

    isRendering = true;
    currentNotifications = notifications || {};
    browserToggle.checked = enabled;
    miningToggle.checked = types.miningSessionAvailable !== false;
    announcementsToggle.checked = types.frangainAnnouncements !== false;
    miningToggle.disabled = !enabled;
    announcementsToggle.disabled = !enabled;
    browserToggle.disabled = permission === 'denied' || !isPushSupported();

    if (!isPushSupported()) {
      browserStatus.textContent = 'This browser does not support FRANGAIN notifications yet.';
    } else if (permission === 'denied') {
      browserStatus.textContent = 'Browser permission is blocked. Update your browser settings to enable notifications.';
    } else if (enabled) {
      browserStatus.textContent = 'Enabled';
    } else {
      browserStatus.textContent = 'Disabled';
    }

    isRendering = false;
  }

  function loadSettings() {
    requestJson('/api/profile', {
      method: 'GET',
      credentials: 'same-origin',
    })
      .then(function (result) {
        if (result.status === 401) {
          redirectToLogin();
          return null;
        }

        if (result.status === 503 && !navigator.onLine) {
          document.body.classList.add('settings-ready');
          setMessage(notificationMessage, result.data.message || 'An internet connection is required for FRANGAIN Ecosystem settings.', 'error');
          return null;
        }

        if (!result.ok || !result.data.success) {
          redirectToLogin();
          return null;
        }

        renderUser(result.data.data.user);
        document.body.classList.add('settings-ready');
        return loadNotificationStatus();
      })
      .catch(function () {
        redirectToLogin();
      });
  }

  function loadNotificationStatus() {
    if (!isPushSupported()) {
      renderNotificationState({ enabled: false, types: {} });
      setMessage(notificationMessage, 'This browser does not support FRANGAIN notifications yet.', 'error');
      return Promise.resolve();
    }

    if (!navigator.onLine) {
      renderNotificationState(currentNotifications || { enabled: false, types: {} });
      setMessage(notificationMessage, 'An internet connection is required to configure notifications.', 'error');
      return Promise.resolve();
    }

    return requestJson('/api/notifications/status', {
      method: 'GET',
      credentials: 'same-origin',
    })
      .then(function (result) {
        if (result.status === 401) {
          redirectToLogin();
          return;
        }

        if (!result.ok || !result.data.success) {
          setMessage(notificationMessage, result.data.message || 'Unable to load notification settings.', 'error');
          return;
        }

        vapidPublicKey = result.data.data.vapidPublicKey || '';
        renderNotificationState(result.data.data.notifications);

        if (!vapidPublicKey) {
          setMessage(notificationMessage, 'Notifications need VAPID_PUBLIC_KEY before they can be enabled.', 'error');
        }
      })
      .catch(function () {
        setMessage(notificationMessage, 'Unable to load notification settings.', 'error');
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

  function enableBrowserNotifications() {
    if (!navigator.onLine) {
      setMessage(notificationMessage, 'An internet connection is required to enable notifications.', 'error');
      renderNotificationState(currentNotifications || { enabled: false, types: selectedNotificationTypes() });
      return;
    }

    if (!isPushSupported()) {
      setMessage(notificationMessage, 'This browser does not support FRANGAIN notifications yet.', 'error');
      renderNotificationState({ enabled: false, types: selectedNotificationTypes() });
      return;
    }

    var permission = getPermissionState();
    browserToggle.disabled = true;
    setMessage(notificationMessage, 'Preparing notifications...', '');

    Promise.resolve()
      .then(function () {
        if (permission === 'default') {
          return Notification.requestPermission();
        }

        return permission;
      })
      .then(function (updatedPermission) {
        if (updatedPermission !== 'granted') {
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
              types: selectedNotificationTypes(),
            }),
          });
        });
      })
      .then(function (result) {
        if (!result.ok || !result.data.success) {
          throw new Error(result.data.message || 'Unable to enable notifications.');
        }

        renderNotificationState(result.data.data.notifications);
        setMessage(notificationMessage, result.data.message || 'Notifications enabled.', 'success');
      })
      .catch(function (error) {
        setMessage(notificationMessage, error.message || 'Unable to enable notifications.', 'error');
        renderNotificationState(currentNotifications || { enabled: false, types: selectedNotificationTypes() });
      });
  }

  function disableBrowserNotifications() {
    if (!navigator.onLine) {
      setMessage(notificationMessage, 'An internet connection is required to disable notifications.', 'error');
      renderNotificationState(currentNotifications || { enabled: true, types: selectedNotificationTypes() });
      return;
    }

    browserToggle.disabled = true;
    setMessage(notificationMessage, 'Disabling notifications...', '');

    navigator.serviceWorker.ready
      .then(function (registration) {
        return registration.pushManager.getSubscription();
      })
      .then(function (subscription) {
        return subscription ? subscription.unsubscribe() : true;
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
            types: selectedNotificationTypes(),
          }),
        });
      })
      .then(function (result) {
        if (!result.ok || !result.data.success) {
          throw new Error(result.data.message || 'Unable to disable notifications.');
        }

        renderNotificationState(result.data.data.notifications);
        setMessage(notificationMessage, result.data.message || 'Notifications disabled.', 'success');
      })
      .catch(function (error) {
        setMessage(notificationMessage, error.message || 'Unable to disable notifications.', 'error');
        renderNotificationState(currentNotifications || { enabled: true, types: selectedNotificationTypes() });
      });
  }

  function saveNotificationTypes() {
    if (isRendering || !currentNotifications || currentNotifications.enabled !== true) {
      renderNotificationState(currentNotifications || { enabled: false, types: selectedNotificationTypes() });
      return;
    }

    if (!navigator.onLine) {
      setMessage(notificationMessage, 'An internet connection is required to save notification settings.', 'error');
      renderNotificationState(currentNotifications);
      return;
    }

    setMessage(notificationMessage, 'Saving notification settings...', '');

    getPushSubscription()
      .then(function (subscription) {
        return requestJson('/api/notifications/subscribe', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            permission: getPermissionState(),
            subscription: subscription.toJSON(),
            types: selectedNotificationTypes(),
          }),
        });
      })
      .then(function (result) {
        if (!result.ok || !result.data.success) {
          throw new Error(result.data.message || 'Unable to save notification settings.');
        }

        renderNotificationState(result.data.data.notifications);
        setMessage(notificationMessage, 'Notification settings saved.', 'success');
      })
      .catch(function (error) {
        setMessage(notificationMessage, error.message || 'Unable to save notification settings.', 'error');
        renderNotificationState(currentNotifications);
      });
  }

  function changePassword(event) {
    event.preventDefault();

    if (!navigator.onLine) {
      setMessage(passwordMessage, 'An internet connection is required to change your password.', 'error');
      return;
    }

    setAccountBusy(changePasswordButton, true, 'Changing Password...', 'Change Password');
    setMessage(passwordMessage, 'Changing password...', '');

    requestJson('/api/profile', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'change-password',
        currentPassword: document.getElementById('currentPassword').value,
        newPassword: document.getElementById('newPassword').value,
        confirmPassword: document.getElementById('confirmPassword').value,
      }),
    })
      .then(function (result) {
        if (result.status === 401) {
          if (result.data && result.data.errors && result.data.errors.currentPassword) {
            setMessage(passwordMessage, result.data.message, 'error');
            return;
          }

          redirectToLogin();
          return;
        }

        if (!result.ok || !result.data.success) {
          setMessage(passwordMessage, result.data.message || 'Unable to change password.', 'error');
          return;
        }

        changePasswordForm.reset();
        setMessage(passwordMessage, result.data.message || 'Password changed successfully.', 'success');
      })
      .catch(function () {
        setMessage(passwordMessage, 'Unable to change password. Please try again later.', 'error');
      })
      .finally(function () {
        setAccountBusy(changePasswordButton, false, 'Changing Password...', 'Change Password');
      });
  }

  function changeEmail(event) {
    event.preventDefault();

    if (!navigator.onLine) {
      setMessage(emailMessage, 'An internet connection is required to change your email.', 'error');
      return;
    }

    setAccountBusy(changeEmailButton, true, 'Changing Email...', 'Change Email');
    setMessage(emailMessage, 'Changing email...', '');

    requestJson('/api/profile', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'change-email',
        currentPassword: document.getElementById('emailPassword').value,
        newEmail: document.getElementById('newEmail').value,
      }),
    })
      .then(function (result) {
        if (result.status === 401) {
          if (result.data && result.data.errors && result.data.errors.currentPassword) {
            setMessage(emailMessage, result.data.message, 'error');
            return;
          }

          redirectToLogin();
          return;
        }

        if (!result.ok || !result.data.success) {
          setMessage(emailMessage, result.data.message || 'Unable to change email.', 'error');
          return;
        }

        changeEmailForm.reset();
        renderUser(result.data.data.user);
        setMessage(emailMessage, result.data.message || 'Email changed successfully.', 'success');
      })
      .catch(function () {
        setMessage(emailMessage, 'Unable to change email. Please try again later.', 'error');
      })
      .finally(function () {
        setAccountBusy(changeEmailButton, false, 'Changing Email...', 'Change Email');
      });
  }

  function logout() {
    if (!navigator.onLine) {
      setMessage(emailMessage, 'An internet connection is required to sign out of the FRANGAIN Ecosystem.', 'error');
      return;
    }

    fetch('/api/logout', {
      method: 'POST',
      credentials: 'same-origin',
    }).finally(function () {
      redirectToLogin();
    });
  }

  browserToggle.addEventListener('change', function () {
    if (isRendering) {
      return;
    }

    if (browserToggle.checked) {
      enableBrowserNotifications();
    } else {
      disableBrowserNotifications();
    }
  });
  miningToggle.addEventListener('change', saveNotificationTypes);
  announcementsToggle.addEventListener('change', saveNotificationTypes);
  changePasswordForm.addEventListener('submit', changePassword);
  changeEmailForm.addEventListener('submit', changeEmail);
  document.getElementById('logoutButton').addEventListener('click', logout);
  document.getElementById('mobileLogoutButton').addEventListener('click', logout);
  document.getElementById('topbarLogoutButton').addEventListener('click', logout);
  document.getElementById('accountLogoutButton').addEventListener('click', logout);
  document.getElementById('mobileMenuToggle').addEventListener('click', function () {
    mobileNav.classList.toggle('open');
  });
  userMenuButton.addEventListener('click', function (event) {
    event.stopPropagation();
    var isOpen = topbarUser.classList.toggle('open');
    userMenuButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
  document.addEventListener('click', function () {
    topbarUser.classList.remove('open');
    userMenuButton.setAttribute('aria-expanded', 'false');
  });
  document.getElementById('userDropdown').addEventListener('click', function (event) {
    event.stopPropagation();
  });
  window.addEventListener('online', loadNotificationStatus);
  window.addEventListener('offline', function () {
    setMessage(notificationMessage, 'You are offline. Notification settings can be changed when you reconnect.', 'error');
  });

  loadSettings();
})();
