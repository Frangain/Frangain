(function () {
  var browserToggle = document.getElementById('browserNotificationsToggle');
  var miningToggle = document.getElementById('miningRemindersToggle');
  var announcementsToggle = document.getElementById('announcementsToggle');
  var browserStatus = document.getElementById('browserNotificationStatus');
  var notificationMessage = document.getElementById('notificationSettingsMessage');
  var mobileNav = document.getElementById('mobileNav');
  var topbarUser = document.getElementById('topbarUser');
  var userMenuButton = document.getElementById('userMenuButton');
  var topbarAvatar = document.getElementById('topbarAvatar');
  var topbarUsername = document.getElementById('topbarUsername');
  var currentNotifications = null;
  var vapidPublicKey = '';
  var isRendering = false;

  function redirectToLogin() { window.location.href = '/ecosystem/login.html'; }
  function setMessage(message, type) { notificationMessage.textContent = message || ''; notificationMessage.className = 'settings-message' + (type ? ' ' + type : ''); }
  function requestJson(url, options) {
    return fetch(url, options).then(function (response) {
      return response.json().then(function (data) { return { ok: response.ok, status: response.status, data: data }; });
    });
  }
  function getPermissionState() { return 'Notification' in window ? Notification.permission : 'unsupported'; }
  function isPushSupported() { return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window; }
  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = window.atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var index = 0; index < rawData.length; index += 1) outputArray[index] = rawData.charCodeAt(index);
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
    browserStatus.textContent = !isPushSupported()
      ? 'This browser does not support FRANGAIN notifications yet.'
      : permission === 'denied'
        ? 'Browser permission is blocked. Update your browser settings to enable notifications.'
        : enabled ? 'Enabled' : 'Disabled';
    isRendering = false;
  }
  function loadPage() {
    requestJson('/api/profile', { method: 'GET', credentials: 'same-origin' })
      .then(function (result) {
        if (result.status === 401 || !result.ok || !result.data.success) { redirectToLogin(); return null; }
        renderUser(result.data.data.user);
        document.body.classList.add('settings-ready');
        return loadNotificationStatus();
      })
      .catch(function () { redirectToLogin(); });
  }
  function loadNotificationStatus() {
    if (!isPushSupported()) {
      renderNotificationState({ enabled: false, types: {} });
      setMessage('This browser does not support FRANGAIN notifications yet.', 'error');
      return Promise.resolve();
    }
    if (!navigator.onLine) {
      renderNotificationState(currentNotifications || { enabled: false, types: {} });
      setMessage('An internet connection is required to configure notifications.', 'error');
      return Promise.resolve();
    }
    return requestJson('/api/notifications/status', { method: 'GET', credentials: 'same-origin' })
      .then(function (result) {
        if (result.status === 401) { redirectToLogin(); return; }
        if (!result.ok || !result.data.success) { setMessage(result.data.message || 'Unable to load notification settings.', 'error'); return; }
        vapidPublicKey = result.data.data.vapidPublicKey || '';
        renderNotificationState(result.data.data.notifications);
        if (!vapidPublicKey) setMessage('Notifications need VAPID_PUBLIC_KEY before they can be enabled.', 'error');
      })
      .catch(function () { setMessage('Unable to load notification settings.', 'error'); });
  }
  function getPushSubscription() {
    if (!vapidPublicKey) return Promise.reject(new Error('Notifications need VAPID_PUBLIC_KEY before they can be enabled.'));
    return navigator.serviceWorker.ready.then(function (registration) {
      return registration.pushManager.getSubscription().then(function (subscription) {
        return subscription || registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) });
      });
    });
  }
  function enableBrowserNotifications() {
    if (!navigator.onLine) { setMessage('An internet connection is required to enable notifications.', 'error'); renderNotificationState(currentNotifications || { enabled: false, types: selectedNotificationTypes() }); return; }
    if (!isPushSupported()) { setMessage('This browser does not support FRANGAIN notifications yet.', 'error'); renderNotificationState({ enabled: false, types: selectedNotificationTypes() }); return; }
    var permission = getPermissionState();
    browserToggle.disabled = true;
    setMessage('Preparing notifications...', '');
    Promise.resolve()
      .then(function () { return permission === 'default' ? Notification.requestPermission() : permission; })
      .then(function (updatedPermission) {
        if (updatedPermission !== 'granted') throw new Error('Notifications were not enabled. Browser permission is ' + updatedPermission + '.');
        return getPushSubscription().then(function (subscription) {
          return requestJson('/api/notifications/subscribe', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permission: updatedPermission, subscription: subscription.toJSON(), types: selectedNotificationTypes() }) });
        });
      })
      .then(function (result) {
        if (!result.ok || !result.data.success) throw new Error(result.data.message || 'Unable to enable notifications.');
        renderNotificationState(result.data.data.notifications);
        setMessage(result.data.message || 'Notifications enabled.', 'success');
      })
      .catch(function (error) { setMessage(error.message || 'Unable to enable notifications.', 'error'); renderNotificationState(currentNotifications || { enabled: false, types: selectedNotificationTypes() }); });
  }
  function disableBrowserNotifications() {
    if (!navigator.onLine) { setMessage('An internet connection is required to disable notifications.', 'error'); renderNotificationState(currentNotifications || { enabled: true, types: selectedNotificationTypes() }); return; }
    browserToggle.disabled = true;
    setMessage('Disabling notifications...', '');
    navigator.serviceWorker.ready
      .then(function (registration) { return registration.pushManager.getSubscription(); })
      .then(function (subscription) { return subscription ? subscription.unsubscribe() : true; })
      .then(function () { return requestJson('/api/notifications/unsubscribe', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permission: getPermissionState(), types: selectedNotificationTypes() }) }); })
      .then(function (result) {
        if (!result.ok || !result.data.success) throw new Error(result.data.message || 'Unable to disable notifications.');
        renderNotificationState(result.data.data.notifications);
        setMessage(result.data.message || 'Notifications disabled.', 'success');
      })
      .catch(function (error) { setMessage(error.message || 'Unable to disable notifications.', 'error'); renderNotificationState(currentNotifications || { enabled: true, types: selectedNotificationTypes() }); });
  }
  function saveNotificationTypes() {
    if (isRendering || !currentNotifications || currentNotifications.enabled !== true) { renderNotificationState(currentNotifications || { enabled: false, types: selectedNotificationTypes() }); return; }
    if (!navigator.onLine) { setMessage('An internet connection is required to save notification settings.', 'error'); renderNotificationState(currentNotifications); return; }
    setMessage('Saving notification settings...', '');
    getPushSubscription()
      .then(function (subscription) { return requestJson('/api/notifications/subscribe', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permission: getPermissionState(), subscription: subscription.toJSON(), types: selectedNotificationTypes() }) }); })
      .then(function (result) {
        if (!result.ok || !result.data.success) throw new Error(result.data.message || 'Unable to save notification settings.');
        renderNotificationState(result.data.data.notifications);
        setMessage('Notification settings saved.', 'success');
      })
      .catch(function (error) { setMessage(error.message || 'Unable to save notification settings.', 'error'); renderNotificationState(currentNotifications); });
  }
  function logout() { fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).finally(function () { redirectToLogin(); }); }
  browserToggle.addEventListener('change', function () { if (!isRendering) browserToggle.checked ? enableBrowserNotifications() : disableBrowserNotifications(); });
  miningToggle.addEventListener('change', saveNotificationTypes);
  announcementsToggle.addEventListener('change', saveNotificationTypes);
  document.getElementById('logoutButton').addEventListener('click', logout);
  document.getElementById('mobileLogoutButton').addEventListener('click', logout);
  document.getElementById('topbarLogoutButton').addEventListener('click', logout);
  document.getElementById('mobileMenuToggle').addEventListener('click', function () { mobileNav.classList.toggle('open'); });
  userMenuButton.addEventListener('click', function (event) { event.stopPropagation(); var isOpen = topbarUser.classList.toggle('open'); userMenuButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false'); });
  document.addEventListener('click', function () { topbarUser.classList.remove('open'); userMenuButton.setAttribute('aria-expanded', 'false'); });
  document.getElementById('userDropdown').addEventListener('click', function (event) { event.stopPropagation(); });
  window.addEventListener('online', loadNotificationStatus);
  window.addEventListener('offline', function () { setMessage('You are offline. Notification settings can be changed when you reconnect.', 'error'); });
  loadPage();
})();
