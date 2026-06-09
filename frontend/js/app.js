/**
 * Servio Main App Controller
 * Handles routing, page switching, and initialization.
 */

const App = {
  currentPage: null,
  pageHistory: [],
  historyInitialized: false,

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
        App.showPage('landing');
        document.getElementById('navbar').classList.remove('hidden');
        document.getElementById('bottom-nav').classList.add('hidden');
        
        // Show public nav sections
        document.getElementById('nav-links-public').classList.remove('hidden');
        document.getElementById('nav-links-private').classList.add('hidden');
        document.getElementById('nav-user-public').classList.remove('hidden');
        document.getElementById('nav-user-private').classList.add('hidden');
      }
    }, 1800);

    // Init all UI modules
    initAuthUI();
    initPostFoodUI();
    initVerifyUI();
    initFoodFilters();
    initNotificationsUI();
    AI.init();
    App.initNavigation();
    HeroSlideshow.init();
    ScrollReveal.init();
    App.initGlassInteractions();
    App.initModals();
    App.initHistory();
  },

  onLogin() {
    const user = Auth.currentUser;
    document.getElementById('navbar').classList.remove('hidden');
    document.getElementById('bottom-nav').classList.remove('hidden');

    // Switch to private nav
    document.getElementById('nav-links-public').classList.add('hidden');
    document.getElementById('nav-links-private').classList.remove('hidden');
    document.getElementById('nav-user-public').classList.add('hidden');
    document.getElementById('nav-user-private').classList.remove('hidden');

    document.getElementById('nav-username').textContent = user.name;
    document.getElementById('nav-role-badge').textContent = user.role;

    App.showPage('dashboard');
    App.pageHistory = [];
    if (App.historyInitialized) history.replaceState({page: 'dashboard'}, '', window.location.pathname);
    App.loadDashboard();
    Notifications.updateBadge();

    // Poll notifications every 30 seconds
    if (App._notifInterval) clearInterval(App._notifInterval);
    App._notifInterval = setInterval(() => Notifications.updateBadge(), 30000);
  },

  onLogout() {
    if (App._notifInterval) clearInterval(App._notifInterval);
    document.getElementById('navbar').classList.remove('hidden');
    document.getElementById('bottom-nav').classList.add('hidden');

    // Switch to public nav
    document.getElementById('nav-links-public').classList.remove('hidden');
    document.getElementById('nav-links-private').classList.add('hidden');
    document.getElementById('nav-user-public').classList.remove('hidden');
    document.getElementById('nav-user-private').classList.add('hidden');

    App.showPage('landing');
    App.pageHistory = [];
    if (App.historyInitialized) history.replaceState({page: 'landing'}, '', window.location.pathname);
    showToast('Logged out successfully.', 'success');
  },

  showPage(pageId, {replaceState = false, fromHistory = false} = {}) {
    if (pageId === App.currentPage) return;

    const page = document.getElementById(`page-${pageId}`);
    if (!page) return;

    if (App.currentPage && !fromHistory) {
      App.pageHistory.push(App.currentPage);
    }

    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));

    page.classList.remove('hidden');
    page.classList.add('page-enter');
    setTimeout(() => page.classList.remove('page-enter'), 400);

    App.currentPage = pageId;

    if (App.historyInitialized) {
      if (replaceState) {
        history.replaceState({page: pageId}, '', window.location.pathname);
      } else if (!fromHistory) {
        history.pushState({page: pageId}, '', window.location.pathname);
      }
    }

    // Toggle public links visibility based on current page
    const pubLinks = document.getElementById('nav-links-public');
    if (pubLinks) {
      if (pageId === 'landing') {
        pubLinks.classList.remove('hidden');
      } else {
        pubLinks.classList.add('hidden');
      }
    }

    // Hide Sign In button on auth pages
    const signInBtn = document.getElementById('nav-get-started-btn');
    if (signInBtn) {
      if (pageId === 'login') {
        signInBtn.style.display = 'none';
      } else {
        signInBtn.style.display = '';
      }
    }

    // Update top nav active state
    document.querySelectorAll('#nav-links-private .nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.page === pageId);
    });

    // Update bottom nav active state
    document.querySelectorAll('.bottom-nav-item[data-page]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === pageId);
    });

    // Page-specific init
    if (pageId === 'food-list') {
      Food.loadList();
    } else if (pageId === 'map') {
      setTimeout(() => MapView.init(), 100);
    } else if (pageId === 'notifications') {
      Notifications.loadAndRender();
    }

    App.updatePageBackButtons();
  },

  initNavigation() {
    // Top nav brand click (logo)
    document.querySelector('.nav-brand').style.cursor = 'pointer';
    document.querySelector('.nav-brand').addEventListener('click', (e) => {
      e.preventDefault();
      if (Auth.isLoggedIn()) {
        App.showPage('dashboard');
      } else {
        App.showPage('landing');
      }
    });

    // Public Sign In / Get Started triggers
    const showLoginPanel = () => {
      App.showPage('login');
    };
    
    document.getElementById('nav-get-started-btn')?.addEventListener('click', showLoginPanel);
    document.getElementById('landing-hero-start-btn')?.addEventListener('click', showLoginPanel);
    document.querySelectorAll('.page-back-btn').forEach(btn => btn.addEventListener('click', () => App.navigateBack()));

    // Top private links click
    document.querySelectorAll('#nav-links-private .nav-link').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        if (!Auth.isLoggedIn()) return;
        if (link.dataset.page === 'food-list' && typeof Food !== 'undefined') {
          Food.searchQuery = '';
          Food.categoryFilter = 'all';
          const searchInput = document.getElementById('search-input');
          if (searchInput) searchInput.value = '';
          document.querySelectorAll('.quick-action-btn').forEach(b => b.classList.remove('active'));
          document.getElementById('qa-all')?.classList.add('active');
        }
        App.showPage(link.dataset.page);
      });
    });

    document.getElementById('back-from-detail').addEventListener('click', () => {
      App.showPage('food-list');
    });

    // Dashboard action buttons — click on card container or the button inside
    document.getElementById('open-post-food-btn')?.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON' || e.currentTarget === e.target) openModal('modal-post-food');
    });
    document.getElementById('browse-food-btn')?.addEventListener('click', () => App.showPage('food-list'));
    document.getElementById('browse-food-ind-btn')?.addEventListener('click', () => App.showPage('food-list'));
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

  initHistory() {
    const initialPage = App.currentPage || 'landing';
    history.replaceState({page: initialPage}, '', window.location.pathname);
    App.historyInitialized = true;

    window.addEventListener('popstate', (event) => {
      const targetPage = event.state && event.state.page ? event.state.page : App.getBackFallback(App.currentPage);
      App.showPage(targetPage, {replaceState: true, fromHistory: true});
    });
  },

  navigateBack() {
    if (App.pageHistory.length > 0) {
      window.history.back();
      return;
    }

    const fallback = App.getBackFallback(App.currentPage);
    App.showPage(fallback, {replaceState: true, fromHistory: true});
  },

  getBackFallback(pageId) {
    if (pageId === 'login') return 'landing';
    if (pageId === 'food-detail') return 'food-list';
    if (Auth.isLoggedIn()) return 'dashboard';
    return 'landing';
  },

  updatePageBackButtons() {
    document.querySelectorAll('.page-back-btn').forEach(btn => {
      const alwaysVisible = btn.dataset.alwaysVisible === 'true';
      btn.style.display = alwaysVisible || App.pageHistory.length > 0 ? 'inline-flex' : 'none';
    });
  },

  initGlassInteractions() {
    const selectors = [
      '.hero-visual-card',
      '.impact-card',
      '.feature-detail-card',
      '.testimonial-card',
      '.card',
      '.quick-action-btn',
      '.action-card',
      '.stat-card',
      '.food-card',
      '.detail-card',
      '.notif-item'
    ].join(',');

    const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const attach = (root = document) => {
      const cards = [];
      if (root.matches?.(selectors)) cards.push(root);
      root.querySelectorAll?.(selectors).forEach(card => cards.push(card));

      cards.forEach(card => {
        if (card.dataset.glassReady === 'true') return;
        card.dataset.glassReady = 'true';
        card.classList.add('glass-reactive');
        card.style.setProperty('--pointer-x', '50%');
        card.style.setProperty('--pointer-y', '0%');
        card.style.setProperty('--shine-offset', '0px');

        if (isTouch || reduceMotion) return;

        card.addEventListener('pointermove', event => {
          const rect = card.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          const px = Math.max(0, Math.min(100, (x / rect.width) * 100));
          const py = Math.max(0, Math.min(100, (y / rect.height) * 100));
          const tiltY = ((px - 50) / 50) * 5.2;
          const tiltX = -((py - 50) / 50) * 4.2;
          const shineOffset = ((px - 50) / 50) * 18;

          card.style.setProperty('--pointer-x', `${px.toFixed(2)}%`);
          card.style.setProperty('--pointer-y', `${py.toFixed(2)}%`);
          card.style.setProperty('--tilt-x', `${tiltX.toFixed(2)}deg`);
          card.style.setProperty('--tilt-y', `${tiltY.toFixed(2)}deg`);
          card.style.setProperty('--shine-offset', `${shineOffset.toFixed(2)}px`);
        }, { passive: true });

        card.addEventListener('pointerleave', () => {
          card.style.setProperty('--pointer-x', '50%');
          card.style.setProperty('--pointer-y', '0%');
          card.style.setProperty('--tilt-x', '0deg');
          card.style.setProperty('--tilt-y', '0deg');
          card.style.setProperty('--shine-offset', '0px');
        });
      });
    };

    attach(document);

    const appRoot = document.getElementById('app') || document.body;
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) attach(node);
        });
      });
    });
    observer.observe(appRoot, { childList: true, subtree: true });
  },

  async loadDashboard() {
    const role = Auth.getRole();
    const user = Auth.currentUser;

    // Show role-specific action cards
    document.getElementById('donor-actions').style.display = role === 'donor' ? 'block' : 'none';
    document.getElementById('recipient-actions').style.display = role === 'recipient' ? 'block' : 'none';
    document.getElementById('individual-actions').style.display = role === 'individual' ? 'block' : 'none';
    document.querySelector('.dashboard-content')?.classList.toggle('volunteer-dashboard-row', role === 'individual');

    // Greeting
    const hour = new Date().getHours();
    const greeting = hour < 6 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    const greetEl = document.getElementById('dashboard-greeting');
    const timeIconEl = document.getElementById('dashboard-time-icon');
    const heroTitleEl = document.getElementById('hero-title');

    if (greetEl) greetEl.textContent = `${greeting}, ${user.name}!`;
    if (timeIconEl) timeIconEl.textContent = '';

    const subtitles = {
      donor: 'Ready to share some food today?',
      recipient: 'Check what\'s available near you.',
      individual: 'Help bridge the gap between donors and recipients.',
    };
    const subtitleEl = document.getElementById('dashboard-subtitle');
    if (subtitleEl) subtitleEl.textContent = subtitles[role] || 'Here\'s what\'s happening today.';

    // Load stats
    await App.loadStats();

    // Load recent activity
    await App.loadRecentActivity();
  },

  async loadStats() {
    const statsGrid = document.getElementById('stats-grid');
    const role = Auth.getRole();

    const [availableRes, myRes] = await Promise.all([
      Api.food.list('available'),
      Api.food.my(),
    ]);

    const available = availableRes.ok ? availableRes.data.length : 0;
    const myPosts = myRes.ok ? myRes.data.length : 0;
    const delivered = myRes.ok ? myRes.data.filter(f => f.status === 'delivered').length : 0;

    // Update hero stats
    const heroMeals = document.getElementById('hero-meals');
    const heroKg = document.getElementById('hero-kg');
    const heroVol = document.getElementById('hero-vol');
    if (heroMeals) heroMeals.textContent = (available * 3 + delivered * 8).toLocaleString();
    if (heroKg) heroKg.textContent = (available + myPosts).toLocaleString();
    if (heroVol) heroVol.textContent = Math.max(12, available * 2 + myPosts + 5).toLocaleString();

    // Stat cards (icons removed)
    const stats = [
      { value: available, label: 'Available Now', color: 'teal', icon: 'package' },
      { value: myPosts, label: role === 'donor' ? 'My Donations' : 'My Claims', color: 'orange', icon: 'file' },
      { value: delivered, label: 'Delivered', color: 'green', icon: 'check' },
    ];

    statsGrid.innerHTML = stats.map(s => `
      <div class="stat-card slide-up">
        <div class="stat-icon-wrap ${s.color}"><span class="stat-icon" data-icon="${s.icon}"></span></div>
        <div class="stat-info">
          <h4>${s.value}</h4>
          <p>${s.label}</p>
        </div>
      </div>
    `).join('');

    Icons.attach();
  },

  async loadRecentActivity() {
    const container = document.getElementById('recent-activity');
    const res = await Api.food.my();

    if (!res.ok || !res.data.length) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-state-icon" data-icon="bell-off"></span>
          <span>No recent activity.</span>
        </div>`;
      Icons.attach();
      return;
    }

    const recent = res.data.slice(0, 5);
    const statusIcons = {
      available: '<span class="activity-icon-inner" data-icon="package"></span>',
      waiting: '<span class="activity-icon-inner" data-icon="clock"></span>',
      claimed: '<span class="activity-icon-inner" data-icon="users"></span>',
      delivered: '<span class="activity-icon-inner" data-icon="check"></span>',
      expired: '<span class="activity-icon-inner" data-icon="info"></span>'
    };

    container.innerHTML = recent.map(f => `
      <div class="activity-item" onclick="Food.showDetail(${f.id}); App.showPage('food-detail');" style="cursor:pointer;">
        <div class="activity-icon">${statusIcons[f.status] || ''}</div>
        <div style="flex:1;min-width:0;">
          <div class="activity-text" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(f.org_name)} — ${f.quantity}kg</div>
          <div class="activity-time">${new Date(f.created_at).toLocaleDateString()} · <span style="font-weight:600;color:var(--teal);">${f.status}</span></div>
        </div>
      </div>
    `).join('');
    Icons.attach();
  },

  // Decomposition dashboard and actions removed from client
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
  const toastIcons = {
    success: '<span class="toast-icon" data-icon="check-circle"></span>',
    error: '<span class="toast-icon" data-icon="alert-circle"></span>',
    warning: '<span class="toast-icon" data-icon="alert-triangle"></span>',
    info: '<span class="toast-icon" data-icon="info"></span>',
    default: '<span class="toast-icon" data-icon="info"></span>'
  };
  const iconHtml = toastIcons[type] || toastIcons.default;
  toast.innerHTML = `${iconHtml} <span>${message}</span>`;
  toast.className = `toast ${type}`;
  toast.classList.remove("hidden");
  Icons.attach();
  setTimeout(() => toast.classList.add("hidden"), 3500);
}

// ===== HERO SLIDESHOW =====
const HeroSlideshow = {
  currentIndex: 0,
  timer: null,
  interval: 5200,
  init() {
    this.root = document.querySelector('.hero-slideshow-frame');
    if (!this.root) return;

    this.slides = Array.from(this.root.querySelectorAll('.hero-slide'));
    this.dots = Array.from(document.querySelectorAll('.hero-slide-dot'));
    if (!this.slides.length || !this.dots.length) return;

    this.slides.forEach((slide, index) => {
      const img = slide.querySelector('img');
      if (!img) return;
      img.addEventListener('load', () => {
        console.info('Hero slideshow image loaded:', img.src);
      });
      img.addEventListener('error', () => this._handleImageError(slide, index, img));
      if (img.complete && img.naturalWidth === 0) {
        this._handleImageError(slide, index, img);
      }
    });

    this.dots.forEach((dot, index) => {
      dot.addEventListener('click', () => this.goTo(index));
    });

    this.update();
    this.play();
  },
  _handleImageError(slide, index, img) {
    console.warn('Hero slideshow image failed to load:', img.src);
    slide.style.display = 'none';
    const dot = this.dots[index];
    if (dot) dot.style.display = 'none';
    this.slides = this.slides.filter(s => s.style.display !== 'none');
    this.dots = this.dots.filter(d => d.style.display !== 'none');
    if (this.currentIndex >= this.slides.length) this.currentIndex = 0;
    this.update();
  },
  update() {
    if (!this.slides.length) return;
    this.slides.forEach((slide, index) => slide.classList.toggle('active', index === this.currentIndex));
    this.dots.forEach((dot, index) => dot.classList.toggle('active', index === this.currentIndex));
  },
  goTo(index) {
    if (index < 0 || index >= this.slides.length) return;
    this.currentIndex = index;
    this.update();
    this.restart();
  },
  next() {
    if (!this.slides.length) return;
    this.currentIndex = (this.currentIndex + 1) % this.slides.length;
    this.update();
  },
  play() {
    this.pause();
    this.timer = setInterval(() => this.next(), this.interval);
  },
  pause() {
    if (this.timer) clearInterval(this.timer);
  },
  restart() {
    this.pause();
    this.play();
  }
};

// ===== SCROLL REVEAL =====
const ScrollReveal = {
  observer: null,
  groups: [
    { selector: '#landing-impact', targets: ['.landing-section-header > *', '.impact-card'] },
    { selector: '#landing-features', targets: ['.landing-section-header > *', '.feature-detail-card'] },
    { selector: '#landing-testimonials', targets: ['.landing-section-header > *', '.testimonial-card'] }
  ],
  init() {
    if (!('IntersectionObserver' in window)) return;
    this.observer = new IntersectionObserver(this.handleIntersect.bind(this), {
      root: null,
      rootMargin: '0px 0px -20% 0px',
      threshold: 0.15,
    });

    this.groups.forEach(group => {
      const section = document.querySelector(group.selector);
      if (!section) return;
      const items = section.querySelectorAll(group.targets.join(', '));
      items.forEach((item, index) => {
        item.classList.add('scroll-reveal');
        item.style.transitionDelay = `${index * 120}ms`;
        this.observer.observe(item);
      });
    });
  },
  handleIntersect(entries) {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const target = entry.target;
      target.classList.add('visible');
      this.observer.unobserve(target);
    });
  }
};

// ===== BOOT =====
document.addEventListener("DOMContentLoaded", () => App.init());
