(function () {
  var pageMessage = document.getElementById('profilePageMessage');
  var profileForm = document.getElementById('profileForm');
  var displayNameInput = document.getElementById('displayName');
  var displayNameValue = document.getElementById('displayNameValue');
  var usernameValue = document.getElementById('usernameValue');
  var emailValue = document.getElementById('emailValue');
  var usernameReadonly = document.getElementById('usernameReadonly');
  var emailReadonly = document.getElementById('emailReadonly');
  var walletAddressInput = document.getElementById('walletAddress');
  var countryInput = document.getElementById('country');
  var profileImageInput = document.getElementById('profileImageInput');
  var avatarPreview = document.getElementById('avatarPreview');
  var avatarInitial = document.getElementById('avatarInitial');
  var removeImageButton = document.getElementById('removeImageButton');
  var saveButton = document.getElementById('saveProfileButton');
  var mobileNav = document.getElementById('mobileNav');
  var topbarUser = document.getElementById('topbarUser');
  var userMenuButton = document.getElementById('userMenuButton');
  var topbarAvatar = document.getElementById('topbarAvatar');
  var topbarUsername = document.getElementById('topbarUsername');
  var joinDateValue = document.getElementById('joinDateValue');
  var frangBalanceValue = document.getElementById('frangBalanceValue');
  var frangBalanceDetailValue = document.getElementById('frangBalanceDetailValue');
  var memoryReserveValue = document.getElementById('memoryReserveValue');
  var miningRateValue = document.getElementById('miningRateValue');
  var totalFrangMinedValue = document.getElementById('totalFrangMinedValue');
  var miningStatusValue = document.getElementById('miningStatusValue');
  var lastMiningCompletedValue = document.getElementById('lastMiningCompletedValue');
  var circleMembersValue = document.getElementById('circleMembersValue');
  var miningBonusValue = document.getElementById('miningBonusValue');
  var legacyTotalMinedValue = document.getElementById('legacyTotalMinedValue');
  var lastMiningTimeValue = document.getElementById('lastMiningTimeValue');
  var accountStatusValue = document.getElementById('accountStatusValue');
  var createdAtValue = document.getElementById('createdAtValue');
  var updatedAtValue = document.getElementById('updatedAtValue');
  var currentProfileImage = '';

  function redirectToLogin() {
    window.location.href = '/ecosystem/login.html';
  }

  function setMessage(message, type) {
    pageMessage.textContent = message || '';
    pageMessage.className = 'profile-message' + (type ? ' ' + type : '');
  }

  function setBusy(isBusy) {
    saveButton.disabled = isBusy;
    saveButton.textContent = isBusy ? 'Saving Profile...' : 'Save Profile';
  }

  function formatDate(value) {
    if (!value) {
      return 'Not available';
    }

    var date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Not available';
    }

    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function formatDateTime(value) {
    if (!value) {
      return 'Not available';
    }

    var date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Not available';
    }

    return date.toLocaleString();
  }

  function formatFrang(value) {
    var amount = Number(value) || 0;
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' FRANG';
  }

  function formatMiningRate(value) {
    var rate = Number(value) || 1;
    return rate.toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    }) + 'x';
  }

  function getProfileName(user) {
    return user.displayName || user.username || 'FRANGAIN User';
  }

  function renderAvatar(user) {
    var name = getProfileName(user);
    var initial = name.slice(0, 1).toUpperCase() || 'F';

    avatarInitial.textContent = initial;
    topbarAvatar.textContent = initial;
    avatarPreview.style.backgroundImage = '';
    topbarAvatar.style.backgroundImage = '';
    avatarPreview.classList.remove('has-image');
    topbarAvatar.classList.remove('has-image');

    if (user.profileImage) {
      avatarPreview.style.backgroundImage = 'url("' + user.profileImage + '")';
      topbarAvatar.style.backgroundImage = 'url("' + user.profileImage + '")';
      avatarPreview.classList.add('has-image');
      topbarAvatar.classList.add('has-image');
    }
  }

  function renderUser(user) {
    var displayName = user.displayName || '';
    var username = user.username || 'FRANGAIN User';

    currentProfileImage = user.profileImage || '';
    displayNameInput.value = displayName;
    displayNameValue.textContent = displayName || username;
    usernameValue.textContent = username;
    emailValue.textContent = user.email || 'Email not available';
    usernameReadonly.value = username;
    emailReadonly.value = user.email || 'Email not available';
    walletAddressInput.value = user.walletAddress || '';
    countryInput.value = user.country || '';
    topbarUsername.textContent = displayName || username;
    joinDateValue.textContent = formatDate(user.createdAt);
    frangBalanceValue.textContent = formatFrang(user.memoryReserve);
    frangBalanceDetailValue.textContent = formatFrang(user.memoryReserve);
    memoryReserveValue.textContent = formatFrang(user.memoryReserve);
    miningRateValue.textContent = formatMiningRate(user.miningRate);
    totalFrangMinedValue.textContent = formatFrang(user.totalFrangMined);
    miningStatusValue.textContent = user.miningActive ? 'Mining in Progress' : 'Ready';
    lastMiningCompletedValue.textContent = formatDateTime(user.lastMiningCompletedAt);
    circleMembersValue.textContent = String(Number(user.circleMembers) || 0);
    miningBonusValue.textContent = formatMiningRate(user.miningBonus || 0);
    legacyTotalMinedValue.textContent = formatFrang(user.totalMined);
    lastMiningTimeValue.textContent = formatDateTime(user.lastMiningTime);
    accountStatusValue.textContent = 'Registered';
    createdAtValue.textContent = formatDate(user.createdAt);
    updatedAtValue.textContent = formatDate(user.updatedAt);
    renderAvatar(user);
    document.body.classList.add('profile-ready');
  }

  function requestJson(url, options) {
    return fetch(url, options).then(function (response) {
      return response.json().then(function (data) {
        return { ok: response.ok, status: response.status, data: data };
      });
    });
  }

  function loadProfile() {
    requestJson('/api/profile', {
      method: 'GET',
      credentials: 'same-origin',
    })
      .then(function (result) {
        if (result.status === 401) {
          redirectToLogin();
          return;
        }

        if (result.status === 503 && !navigator.onLine) {
          document.body.classList.add('profile-ready');
          setMessage(result.data.message || 'An internet connection is required for profile updates.', 'error');
          return;
        }

        if (!result.ok || !result.data.success) {
          redirectToLogin();
          return;
        }

        renderUser(result.data.data.user);
      })
      .catch(function () {
        redirectToLogin();
      });
  }

  function saveProfile(event) {
    event.preventDefault();

    if (!navigator.onLine) {
      setMessage('An internet connection is required to update your profile.', 'error');
      return;
    }

    setBusy(true);
    setMessage('Saving your profile...', '');

    requestJson('/api/profile', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        displayName: displayNameInput.value,
        walletAddress: walletAddressInput.value,
        country: countryInput.value,
        profileImage: currentProfileImage,
      }),
    })
      .then(function (result) {
        if (result.status === 401) {
          redirectToLogin();
          return;
        }

        if (!result.ok || !result.data.success) {
          setMessage(result.data.message || 'Unable to save profile.', 'error');
          return;
        }

        renderUser(result.data.data.user);
        setMessage('Profile updated successfully.', 'success');
      })
      .catch(function () {
        setMessage('Unable to save profile. Please try again later.', 'error');
      })
      .finally(function () {
        setBusy(false);
      });
  }

  function logout() {
    if (!navigator.onLine) {
      setMessage('An internet connection is required to sign out of the FRANGAIN Ecosystem.', 'error');
      return;
    }

    fetch('/api/logout', {
      method: 'POST',
      credentials: 'same-origin',
    }).finally(function () {
      redirectToLogin();
    });
  }

  profileImageInput.addEventListener('change', function () {
    var file = profileImageInput.files && profileImageInput.files[0];

    if (!file) {
      return;
    }

    if (!/^image\/(png|jpeg|jpg|webp)$/.test(file.type)) {
      setMessage('Profile picture must be a PNG, JPG, or WEBP image.', 'error');
      profileImageInput.value = '';
      return;
    }

    if (file.size > 500 * 1024) {
      setMessage('Profile picture must be smaller than 500 KB.', 'error');
      profileImageInput.value = '';
      return;
    }

    var reader = new FileReader();
    reader.onload = function () {
      currentProfileImage = reader.result;
      renderAvatar({
        displayName: displayNameInput.value,
        username: usernameValue.textContent,
        profileImage: currentProfileImage,
      });
      setMessage('Profile picture ready. Save your profile to keep this change.', 'success');
    };
    reader.readAsDataURL(file);
  });

  removeImageButton.addEventListener('click', function () {
    currentProfileImage = '';
    profileImageInput.value = '';
    renderAvatar({
      displayName: displayNameInput.value,
      username: usernameValue.textContent,
      profileImage: '',
    });
    setMessage('Profile picture removed. Save your profile to keep this change.', 'success');
  });

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
  profileForm.addEventListener('submit', saveProfile);

  loadProfile();
})();
