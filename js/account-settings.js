(function () {
  var changePasswordForm = document.getElementById('changePasswordForm');
  var changePasswordButton = document.getElementById('changePasswordButton');
  var passwordMessage = document.getElementById('passwordSettingsMessage');
  var mobileNav = document.getElementById('mobileNav');
  var topbarUser = document.getElementById('topbarUser');
  var userMenuButton = document.getElementById('userMenuButton');
  var topbarAvatar = document.getElementById('topbarAvatar');
  var topbarUsername = document.getElementById('topbarUsername');

  function redirectToLogin() {
    window.location.href = '/ecosystem/login.html';
  }

  function setPasswordMessage(message, type) {
    passwordMessage.textContent = message || '';
    passwordMessage.className = 'settings-message' + (type ? ' ' + type : '');
  }

  function requestJson(url, options) {
    return fetch(url, options).then(function (response) {
      return response.json().then(function (data) {
        return { ok: response.ok, status: response.status, data: data };
      });
    });
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

  function logout() {
    fetch('/api/logout', {
      method: 'POST',
      credentials: 'same-origin',
    }).finally(function () {
      redirectToLogin();
    });
  }

  function loadAccountShell() {
    requestJson('/api/profile', {
      method: 'GET',
      credentials: 'same-origin',
    })
      .then(function (result) {
        if (result.status === 401 || !result.ok || !result.data.success) {
          redirectToLogin();
          return;
        }

        renderUser(result.data.data.user);
        document.body.classList.add('settings-ready');
      })
      .catch(function () {
        redirectToLogin();
      });
  }

  function handleChangePassword(event) {
    event.preventDefault();

    var payload = {
      action: 'change-password',
      currentPassword: document.getElementById('currentPassword').value,
      newPassword: document.getElementById('newPassword').value,
      confirmPassword: document.getElementById('confirmPassword').value,
    };

    changePasswordButton.disabled = true;
    setPasswordMessage('Changing password...', '');

    requestJson('/api/profile', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (result) {
        if (result.status === 401 && !(result.data.errors && result.data.errors.currentPassword)) {
          redirectToLogin();
          return;
        }

        if (!result.ok || !result.data.success) {
          throw new Error(result.data.message || 'Unable to change password.');
        }

        changePasswordForm.reset();
        setPasswordMessage(result.data.message || 'Password changed successfully.', 'success');
      })
      .catch(function (error) {
        setPasswordMessage(error.message || 'Unable to change password.', 'error');
      })
      .finally(function () {
        changePasswordButton.disabled = false;
      });
  }

  changePasswordForm.addEventListener('submit', handleChangePassword);
  document.getElementById('logoutButton').addEventListener('click', logout);
  document.getElementById('mobileLogoutButton').addEventListener('click', logout);
  document.getElementById('topbarLogoutButton').addEventListener('click', logout);
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

  loadAccountShell();
})();
