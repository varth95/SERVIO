/**
 * Servio Auth Module
 * Handles login, registration, and session state.
 */

const Auth = {
  currentUser: null,

  async init() {
    const res = await Api.auth.me();
    if (res.ok) {
      Auth.currentUser = res.data;
      return true;
    }
    return false;
  },

  async login(email, password) {
    const res = await Api.auth.login(email, password);
    if (res.ok) {
      Auth.currentUser = res.data.user;
    }
    return res;
  },

  async logout() {
    await Api.auth.logout();
    Auth.currentUser = null;
  },

  async register(formData) {
    return await Api.auth.register(formData);
  },

  isLoggedIn() {
    return !!Auth.currentUser;
  },

  getRole() {
    return Auth.currentUser?.role || null;
  },
};

// ===== DOM BINDINGS =====

function initAuthUI() {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const tabLoginBtn = document.getElementById("tab-login-btn");
  const tabRegisterBtn = document.getElementById("tab-register-btn");
  const regRole = document.getElementById("reg-role");
  const regCertGroup = document.getElementById("reg-cert-group");
  const certInput = document.getElementById("reg-certificate");
  const certFileName = document.getElementById("cert-file-name");
  const getLocationBtn = document.getElementById("get-location-btn");
  const logoutBtn = document.getElementById("logout-btn");

  // Tab switching
  tabLoginBtn.addEventListener("click", () => {
    tabLoginBtn.classList.add("active");
    tabRegisterBtn.classList.remove("active");
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
  });

  tabRegisterBtn.addEventListener("click", () => {
    tabRegisterBtn.classList.add("active");
    tabLoginBtn.classList.remove("active");
    registerForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
  });

  // Show certificate upload for donors
  regRole.addEventListener("change", () => {
    const role = regRole.value;
    regCertGroup.style.display = role === "donor" ? "block" : "none";
  });

  // File name display
  certInput.addEventListener("change", () => {
    certFileName.textContent = certInput.files[0]?.name || "";
  });

  // Get GPS location
  getLocationBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      showToast("Geolocation not supported by your browser.", "error");
      return;
    }
    getLocationBtn.textContent = "📍 Getting location...";
    getLocationBtn.disabled = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        document.getElementById("reg-lat").value = pos.coords.latitude;
        document.getElementById("reg-lon").value = pos.coords.longitude;
        getLocationBtn.textContent = "✅ Location captured";
        getLocationBtn.disabled = false;
      },
      () => {
        showToast("Could not get location. Please enter address manually.", "warning");
        getLocationBtn.textContent = "📍 Use My Location";
        getLocationBtn.disabled = false;
      }
    );
  });

  // Login form submit
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    const errorEl = document.getElementById("login-error");
    const submitBtn = loginForm.querySelector("button[type=submit]");

    errorEl.classList.add("hidden");
    submitBtn.textContent = "Logging in...";
    submitBtn.disabled = true;

    const res = await Auth.login(email, password);

    submitBtn.textContent = "Login";
    submitBtn.disabled = false;

    if (res.ok) {
      App.onLogin();
    } else {
      errorEl.textContent = res.data.error || "Login failed.";
      errorEl.classList.remove("hidden");
    }
  });

  // Register form submit
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("reg-error");
    const successEl = document.getElementById("reg-success");
    const submitBtn = registerForm.querySelector("button[type=submit]");

    errorEl.classList.add("hidden");
    successEl.classList.add("hidden");

    const role = document.getElementById("reg-role").value;
    const formData = new FormData();
    formData.append("name", document.getElementById("reg-name").value);
    formData.append("email", document.getElementById("reg-email").value);
    formData.append("password", document.getElementById("reg-password").value);
    formData.append("role", role);
    formData.append("phone", document.getElementById("reg-phone").value);
    formData.append("address", document.getElementById("reg-address").value);
    formData.append("latitude", document.getElementById("reg-lat").value);
    formData.append("longitude", document.getElementById("reg-lon").value);

    if (role === "donor") {
      const certFile = document.getElementById("reg-certificate").files[0];
      if (certFile) formData.append("certificate", certFile);
    }

    submitBtn.textContent = "Creating account...";
    submitBtn.disabled = true;

    const res = await Auth.register(formData);

    submitBtn.textContent = "Create Account";
    submitBtn.disabled = false;

    if (res.ok) {
      successEl.textContent = "Account created! Please log in.";
      successEl.classList.remove("hidden");
      registerForm.reset();
      setTimeout(() => {
        tabLoginBtn.click();
      }, 1500);
    } else {
      errorEl.textContent = res.data.error || "Registration failed.";
      errorEl.classList.remove("hidden");
    }
  });

  // Logout
  logoutBtn.addEventListener("click", async () => {
    await Auth.logout();
    App.onLogout();
  });
}
