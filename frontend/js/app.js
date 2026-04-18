/**
 * Servio Main App Controller
 * Handles routing, page switching, and initialization.
 */

const App = {
  currentPage: null,

  async init() {
    // Show loading screen, then boot
    setTimeout(async () => {
      const loadingScreen = document.getElementById("loading-screen");
      const appEl = document.getElementById("app");

      const isLoggedIn = await Auth.init();

      loadingScreen.classList.add("fade-out");
      setTimeout(() => loadingScreen.classList.add("hidden"), 500);

      appEl.classList.remove("hidden");

      if (isLoggedIn) {
        App.onLogin();
      } else {
        App.showPage("login");
        document.getElementById("navbar").classList.add("hidden");
      }
    }, 1800);

    // Init all UI modules
    initAuthUI();
    initPostFoodUI();
    initDecompUI();
    initVerifyUI();
    initFoodFilters();
    initNotificationsUI();
    AI.init();
    App.initNavigation();
    App.initModals();
  },

  onLogin() {
    const user = Auth.currentUser;
    document.getElementById("navbar").classList.remove("hidden");
    document.getElementById("nav-username").textContent = user.name;
    document.getElementById("nav-role-badge").textContent = user.role;

    App.showPage("dashboard");
    App.loadDashboard();
    Notifications.updateBadge();

    // Poll notifications every 30 seconds
    if (App._notifInterval) clearInterval(App._notifInterval);
    App._notifInterval = setInterval(() => Notifications.updateBadge(), 30000);
  },

  onLogout() {
    if (App._notifInterval) clearInterval(App._notifInterval);
    document.getElementById("navbar").classList.add("hidden");
    App.showPage("login");
    showToast("Logged out successfully.", "success");
  },

  showPage(pageId) {
    // Hide all pages
    document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));

    const page = document.getElementById(`page-${pageId}`);
    if (page) {
      page.classList.remove("hidden");
      page.classList.add("page-enter");
      setTimeout(() => page.classList.remove("page-enter"), 400);
    }

    App.currentPage = pageId;

    // Update nav active state
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.classList.toggle("active", link.dataset.page === pageId);
    });

    // Page-specific init
    if (pageId === "food-list") {
      Food.loadList();
    } else if (pageId === "map") {
      setTimeout(() => MapView.init(), 100); // slight delay for DOM
    } else if (pageId === "notifications") {
      Notifications.loadAndRender();
    }
  },

  initNavigation() {
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        if (!Auth.isLoggedIn()) return;
        App.showPage(link.dataset.page);
      });
    });

    document.getElementById("back-from-detail").addEventListener("click", () => {
      App.showPage("food-list");
    });

    // Dashboard action buttons
    document.getElementById("open-post-food-btn")?.addEventListener("click", () => openModal("modal-post-food"));
    document.getElementById("open-decomp-btn")?.addEventListener("click", () => openModal("modal-decomp"));
    document.getElementById("browse-food-btn")?.addEventListener("click", () => App.showPage("food-list"));
    document.getElementById("browse-food-ind-btn")?.addEventListener("click", () => App.showPage("food-list"));
    document.getElementById("view-decomp-btn")?.addEventListener("click", () => App.loadDecompDashboard());
  },

  initModals() {
    // Close modal on overlay click or close button
    document.querySelectorAll(".modal-overlay").forEach((overlay) => {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.classList.add("hidden");
      });
    });

    document.querySelectorAll(".modal-close, [data-modal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const modalId = btn.dataset.modal;
        if (modalId) closeModal(modalId);
      });
    });
  },

  async loadDashboard() {
    const role = Auth.getRole();

    // Show role-specific action cards
    document.getElementById("donor-actions").style.display = role === "donor" ? "block" : "none";
    document.getElementById("recipient-actions").style.display = role === "recipient" ? "block" : "none";
    document.getElementById("individual-actions").style.display = role === "individual" ? "block" : "none";
    document.getElementById("decomp-actions").style.display = role === "decomposition" ? "block" : "none";

    // Greeting
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    document.getElementById("dashboard-greeting").textContent = `${greeting}, ${Auth.currentUser.name}! 👋`;

    const subtitles = {
      donor: "Ready to share some food today?",
      recipient: "Check what's available near you.",
      individual: "Help bridge the gap between donors and recipients.",
      decomposition: "Manage your composting requests.",
    };
    document.getElementById("dashboard-subtitle").textContent = subtitles[role] || "";

    // Load stats
    await App.loadStats();

    // Load recent activity (my food posts / claims)
    await App.loadRecentActivity();
  },

  async loadStats() {
    const statsGrid = document.getElementById("stats-grid");
    const role = Auth.getRole();

    const [availableRes, myRes] = await Promise.all([
      Api.food.list("available"),
      Api.food.my(),
    ]);

    const available = availableRes.ok ? availableRes.data.length : 0;
    const myPosts = myRes.ok ? myRes.data.length : 0;
    const delivered = myRes.ok ? myRes.data.filter((f) => f.status === "delivered").length : 0;

    const stats = [
      { icon: "🍱", value: available, label: "Available Now" },
      { icon: role === "donor" ? "📤" : "📥", value: myPosts, label: role === "donor" ? "My Posts" : "My Claims" },
      { icon: "✅", value: delivered, label: "Delivered" },
    ];

    statsGrid.innerHTML = stats
      .map(
        (s) => `
      <div class="stat-card slide-up">
        <div class="stat-icon">${s.icon}</div>
        <div class="stat-info">
          <h4>${s.value}</h4>
          <p>${s.label}</p>
        </div>
      </div>
    `
      )
      .join("");
  },

  async loadRecentActivity() {
    const container = document.getElementById("recent-activity");
    const res = await Api.food.my();

    if (!res.ok || !res.data.length) {
      container.innerHTML = '<p class="empty-state">No recent activity.</p>';
      return;
    }

    const recent = res.data.slice(0, 5);
    container.innerHTML = recent
      .map((f) => {
        const statusIcons = {
          available: "🟢",
          waiting: "🟡",
          claimed: "🔵",
          delivered: "✅",
          expired: "🔴",
        };
        return `
        <div class="activity-item" onclick="Food.showDetail(${f.id}); App.showPage('food-detail');" style="cursor:pointer;">
          <div class="activity-icon">${statusIcons[f.status] || "🍱"}</div>
          <div>
            <div class="activity-text">${escapeHtml(f.org_name)} — ${f.quantity}kg</div>
            <div class="activity-time">${new Date(f.created_at).toLocaleDateString()} · ${f.status}</div>
          </div>
        </div>
      `;
      })
      .join("");
  },

  async loadDecompDashboard() {
    // For decomposition centers — show their requests
    const res = await Api.decomposition.list();
    if (!res.ok) {
      showToast("Failed to load decomposition requests.", "error");
      return;
    }

    const container = document.getElementById("recent-activity");
    if (!res.data.length) {
      container.innerHTML = '<p class="empty-state">No decomposition requests assigned.</p>';
      return;
    }

    container.innerHTML = res.data
      .map(
        (r) => `
      <div class="activity-item">
        <div class="activity-icon">♻️</div>
        <div style="flex:1;">
          <div class="activity-text">${r.requester_name} — ${r.quantity}kg ${r.food_type || ""}</div>
          <div class="activity-time">${r.address || "No address"} · ${r.status}</div>
        </div>
        ${
          r.status === "assigned"
            ? `<button class="btn btn-success btn-sm" onclick="App.collectDecomp(${r.id})">Collect</button>`
            : ""
        }
      </div>
    `
      )
      .join("");
  },

  async collectDecomp(id) {
    const res = await Api.decomposition.collect(id);
    if (res.ok) {
      showToast("Marked as collected!", "success");
      App.loadDecompDashboard();
    } else {
      showToast(res.data.error || "Failed.", "error");
    }
  },
};

// ===== MODAL HELPERS =====

function openModal(id) {
  document.getElementById(id)?.classList.remove("hidden");
}

function closeModal(id) {
  document.getElementById(id)?.classList.add("hidden");
}

// ===== TOAST =====

function showToast(message, type = "default") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3500);
}

// ===== BOOT =====
document.addEventListener("DOMContentLoaded", () => App.init());
