// ==========================================================================
// APP CONTROLLER & CENTRAL ROUTER
// ==========================================================================

const App = {
  currentAuthMode: 'student', // 'student' | 'admin'
  deferredPrompt: null,

  init() {
    this.setupTheme();
    this.registerServiceWorker();
    this.setupPWAInstallPrompt();

    // Check existing session
    const token = API.getToken();
    const user = API.getUser();

    if (token && user) {
      if (user.role === 'ADMIN') {
        AdminApp.init(user);
      } else {
        StudentApp.init(user);
      }
    } else {
      this.showAuth();
    }
  },

  showAuth() {
    const root = document.getElementById('app-root');
    root.innerHTML = `
      <div class="auth-wrapper">
        <div class="auth-card">
          <div class="auth-header">
            <div class="auth-logo">
              <svg viewBox="0 0 512 512" width="48" height="48">
                <defs>
                  <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#ffffff" />
                    <stop offset="100%" stop-color="#38bdf8" />
                  </linearGradient>
                </defs>
                <path d="M256 40 L440 110 C440 330 256 440 256 470 C256 440 72 330 72 110 Z" fill="none" stroke="url(#shieldGrad)" stroke-width="28" />
                <circle cx="256" cy="220" r="40" fill="#38bdf8" />
                <path d="M256 260 L256 360 M230 310 L282 310" stroke="#38bdf8" stroke-width="20" stroke-linecap="round" />
              </svg>
            </div>
            <h1 class="auth-title">MISHRA GROUP INSTITUTE</h1>
            <p class="auth-subtitle">Faculty of Engineering & Technology</p>
            <span class="auth-badge">B.TECH CYBER SECURITY • 3CYBER7</span>
          </div>

          <!-- Unified Single Login Form for Students and Admins -->
          <form id="unified-login-form" onsubmit="event.preventDefault(); App.handleUnifiedLogin();" style="margin-top:10px;">
            <div class="form-group">
              <label class="form-label">Enter UG ID *</label>
              <div class="input-container">
                <span class="input-icon">🆔</span>
                <input type="text" id="login-identifier" class="form-control" placeholder="Enter UG ID (e.g. 26UG033181) or Admin ID" autocomplete="username" required />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Password *</label>
              <div class="input-container">
                <span class="input-icon">🔒</span>
                <input type="password" id="login-password" class="form-control" placeholder="••••••••" autocomplete="current-password" required />
              </div>
            </div>

            <button type="submit" class="btn-primary" id="login-submit-btn" style="margin-top:18px; font-weight:800; letter-spacing:0.5px; height:46px;">
              Sign In to Portal
            </button>

            <div style="text-align:center; margin-top:16px; padding-top:12px; border-top:1px solid var(--border-color); font-size:12px; color:var(--text-muted);">
              🛡️ Unified portal authentication for Division 3CYBER7 Students & Faculty
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async handleUnifiedLogin() {
    const identifier = document.getElementById('login-identifier').value.trim();
    const password = document.getElementById('login-password').value;
    const submitBtn = document.getElementById('login-submit-btn');

    if (!identifier || !password) {
      this.showToast('Please enter UG ID and Password.', 'error');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Verifying Credentials...';
    }

    this.showToast('Authenticating with Cyber Portal...', 'info');
    const res = await API.unifiedLogin(identifier, password);

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Sign In to Portal';
    }

    if (res.success) {
      API.setToken(res.token);
      API.setUser(res.user);

      if (res.user.role === 'ADMIN') {
        try {
          history.replaceState({ role: 'ADMIN', section: 'dashboard' }, '', '#admin-dashboard');
        } catch (e) {}
        this.showToast('Admin login verified. Opening Admin Dashboard...', 'success');
        AdminApp.init(res.user, 'dashboard');
      } else {
        try {
          history.replaceState({ role: 'STUDENT', tab: 'home' }, '', '#home');
        } catch (e) {}
        this.showToast(`Welcome back, ${res.user.name}!`, 'success');
        StudentApp.init(res.user, 'home');
      }
    } else {
      this.showToast(res.message || 'Login failed. Invalid UG ID or Password.', 'error');
    }
  },

  setAuthMode(mode) {
    this.currentAuthMode = mode;
  },

  async handleStudentLogin() {
    return this.handleUnifiedLogin();
  },

  async handleAdminLogin() {
    return this.handleUnifiedLogin();
  },

  logout() {
    API.setToken(null);
    API.setUser(null);
    try {
      history.replaceState(null, '', window.location.pathname);
      window.location.hash = '';
    } catch (e) {}
    this.showToast('Logged out successfully.', 'info');
    this.showAuth();
  },

  // Toast Notification System
  showToast(message, type = 'info') {
    let container = document.getElementById('global-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'global-toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  // Theme Management
  setupTheme() {
    const savedTheme = localStorage.getItem('pu_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('pu_theme', next);
    this.showToast(`Switched to ${next} theme`, 'info');
  },

  // Service Worker Registration for PWA (Requirement #56)
  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(reg => console.log('[PWA] Service Worker registered:', reg.scope))
          .catch(err => console.warn('[PWA] SW registration failed:', err));
      });
    }
  },

  // PWA Install Prompt Listener
  setupPWAInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      console.log('[PWA] App install prompt captured.');
    });
  },

  // ==================== IN-APP ROUTING & BACK BUTTON HISTORY CONTROLLER ====================
  lastBackPressTime: 0,

  setupRouter() {
    window.addEventListener('popstate', (e) => {
      this.handlePopState(e);
    });
  },

  handlePopState(e) {
    // 1. Check if any modal backdrop or drawer is currently active
    const openModals = document.querySelectorAll('.modal-backdrop, #photo-modal, #ai-tutor-modal, #search-modal, #notif-modal, #scanner-modal, #student-modal, #timetable-modal, #edit-tt-modal, #notice-modal, #event-modal');
    if (openModals.length > 0) {
      const topModal = openModals[openModals.length - 1];
      if (topModal.id === 'scanner-modal' && window.StudentApp) {
        window.StudentApp.stopCamera();
      }
      topModal.remove();
      return;
    }

    // 2. Check if mobile sidebar is open in Admin Panel
    const adminSidebar = document.getElementById('admin-sidebar');
    if (adminSidebar && adminSidebar.classList.contains('open')) {
      if (window.AdminApp) window.AdminApp.toggleSidebar(false);
      return;
    }

    const user = API.getUser();
    if (!user) return;

    // 3. Student App Back Navigation
    if (user.role === 'STUDENT' && window.StudentApp) {
      if (window.StudentApp.tabHistory && window.StudentApp.tabHistory.length > 1) {
        window.StudentApp.tabHistory.pop(); // Remove current
        const prevTab = window.StudentApp.tabHistory[window.StudentApp.tabHistory.length - 1] || 'home';
        window.StudentApp.switchTab(prevTab, false);
        return;
      } else if (window.StudentApp.currentTab !== 'home') {
        window.StudentApp.switchTab('home', false);
        return;
      } else {
        // Double-back to exit protection on Home tab
        const now = Date.now();
        if (now - this.lastBackPressTime < 2500) {
          return; // Allow standard browser exit
        }
        this.lastBackPressTime = now;
        this.showToast('Press back again to exit', 'info');
        history.pushState({ role: 'STUDENT', tab: 'home' }, '', '#home');
        return;
      }
    }

    // 4. Admin App Back Navigation
    if (user.role === 'ADMIN' && window.AdminApp) {
      if (window.AdminApp.sectionHistory && window.AdminApp.sectionHistory.length > 1) {
        window.AdminApp.sectionHistory.pop(); // Remove current
        const prevSection = window.AdminApp.sectionHistory[window.AdminApp.sectionHistory.length - 1] || 'dashboard';
        window.AdminApp.switchSection(prevSection, false);
        return;
      } else if (window.AdminApp.currentSection !== 'dashboard') {
        window.AdminApp.switchSection('dashboard', false);
        return;
      } else {
        const now = Date.now();
        if (now - this.lastBackPressTime < 2500) {
          return;
        }
        this.lastBackPressTime = now;
        this.showToast('Press back again to exit', 'info');
        history.pushState({ role: 'ADMIN', section: 'dashboard' }, '', '#admin-dashboard');
        return;
      }
    }
  }
};

window.App = App;

// Bootstrap on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  App.setupRouter();
  App.init();
});
