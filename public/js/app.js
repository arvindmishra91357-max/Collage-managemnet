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
              <div style="display:flex; justify-content:flex-end; margin-top:6px;">
                <a href="javascript:void(0)" onclick="App.showForgotPasswordModal()" style="color:#38bdf8; font-size:12px; font-weight:600; text-decoration:none;">Forgot Password?</a>
              </div>
            </div>

            <button type="submit" class="btn-primary" id="login-submit-btn" style="margin-top:14px; font-weight:800; letter-spacing:0.5px; height:46px;">
              Sign In to Portal
            </button>

            <div style="text-align:center; margin-top:16px; padding-top:12px; border-top:1px solid var(--border-color); font-size:12px; color:var(--text-muted);">
              🛡️ Unified portal authentication for Division 3CYBER7 Students & Faculty
            </div>

            <div style="margin-top:14px; text-align:center; display:flex; flex-direction:column; gap:8px; align-items:center;">
              <a href="/apk/MGI_Student_Portal.apk" download="MGI_Student_Portal.apk" onclick="App.handleAPKDownload(event)" style="display:inline-flex; align-items:center; gap:8px; padding:8px 16px; font-size:12px; font-weight:700; text-decoration:none; border-radius:var(--radius-full); background:rgba(56,189,248,0.12); border:1px solid rgba(56,189,248,0.35); color:#38bdf8; transition:all 0.2s ease;">
                <span>🤖</span> <span>Download Android App (.apk)</span>
              </a>
              <button type="button" onclick="App.openServerConfigModal()" style="background:transparent; border:none; color:var(--text-muted); font-size:11.5px; cursor:pointer; display:inline-flex; align-items:center; gap:5px; text-decoration:underline;">
                <span>⚙️</span> <span>Server Connection Settings</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  handleAPKDownload(e) {
    this.showToast('Starting Official Android APK download (169 KB)... Check browser downloads.', 'info');
  },

  openServerConfigModal() {
    const existing = document.getElementById('server-config-modal');
    if (existing) existing.remove();

    const currentUrl = API.baseUrl || 'https://mishra-group-institute-portal.onrender.com';

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'server-config-modal';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div class="modal-card" style="max-width:440px; padding:24px;" onclick="event.stopPropagation()">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <h3 style="font-size:16px; font-weight:800; display:flex; align-items:center; gap:8px; margin:0;">
            <span>🌐</span> Server Connection Settings
          </h3>
          <button class="icon-btn" onclick="document.getElementById('server-config-modal').remove()" style="width:28px; height:28px;">✕</button>
        </div>

        <p style="font-size:12px; color:var(--text-secondary); line-height:1.5; margin-bottom:14px;">
          The portal automatically connects to your live Cloud Backend. If you have deployed a custom backend (Render, Railway, or Localhost), specify its URL below.
        </p>

        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label" style="font-size:12px;">Server API Base URL</label>
          <input type="url" id="cfg-server-url" class="form-control" value="${currentUrl}" placeholder="https://your-backend.onrender.com" style="font-family:monospace; font-size:12px; padding:8px 12px;" />
        </div>

        <div id="cfg-ping-result" style="font-size:12px; margin-bottom:14px; padding:8px 12px; border-radius:6px; background:rgba(255,255,255,0.04); display:flex; align-items:center; justify-content:space-between;">
          <span id="cfg-ping-status" style="color:var(--text-muted);">Status: Untested</span>
          <button type="button" class="btn-sec" onclick="App.testServerConnection()" style="padding:4px 10px; font-size:11px; margin:0;">Ping Server</button>
        </div>

        <div style="display:flex; gap:10px; justify-content:flex-end;">
          <button type="button" class="btn-sec" onclick="App.resetServerConfig()" style="padding:8px 14px; font-size:12px; margin:0;">Reset Default</button>
          <button type="button" class="btn-primary" onclick="App.saveServerConfig()" style="padding:8px 18px; font-size:12px; margin:0; width:auto;">Save & Connect</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  async testServerConnection() {
    const statusEl = document.getElementById('cfg-ping-status');
    const inputEl = document.getElementById('cfg-server-url');
    if (!statusEl || !inputEl) return;

    statusEl.innerHTML = '⏳ Testing connection...';
    const target = inputEl.value.trim();
    const res = await API.pingServer(target);

    if (res.online) {
      statusEl.innerHTML = `<span style="color:#34d399; font-weight:700;">🟢 Online (${res.latency}ms)</span>`;
      this.showToast(`Server is online and reachable (${res.latency}ms)!`, 'success');
    } else {
      statusEl.innerHTML = `<span style="color:#f87171; font-weight:700;">🔴 Unreachable (${res.status || 'Offline'})</span>`;
      this.showToast('Could not reach backend server. Netlify offline failsafe is active.', 'warning');
    }
  },

  saveServerConfig() {
    const inputEl = document.getElementById('cfg-server-url');
    if (!inputEl) return;
    const url = inputEl.value.trim();
    if (!url) {
      this.showToast('Please enter a valid URL.', 'error');
      return;
    }
    API.setBaseUrl(url);
    this.showToast(`Backend server set to: ${url}`, 'success');
    const modal = document.getElementById('server-config-modal');
    if (modal) modal.remove();
  },

  resetServerConfig() {
    try {
      localStorage.removeItem('mgi_api_server_url');
    } catch (e) {}
    API.baseUrl = 'https://mishra-group-institute-portal.onrender.com';
    const inputEl = document.getElementById('cfg-server-url');
    if (inputEl) inputEl.value = API.baseUrl;
    this.showToast('Server URL reset to default cloud backend.', 'info');
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
        this.showToast(res.isOffline ? 'Admin login verified (Netlify Standalone Mode).' : 'Admin login verified. Opening Admin Dashboard...', 'success');
        AdminApp.init(res.user, 'dashboard');
      } else {
        try {
          history.replaceState({ role: 'STUDENT', tab: 'home' }, '', '#home');
        } catch (e) {}
        this.showToast(`Welcome back, ${res.user.name}!${res.isOffline ? ' (Failsafe Active)' : ''}`, 'success');
        StudentApp.init(res.user, 'home');
      }
    } else {
      this.showToast(res.message || 'Login failed. Please check credentials.', 'error');
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
    const existing = document.querySelectorAll('.toast');
    existing.forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
        <span>${message}</span>
      </div>
    `;

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('hide');
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
      const reg = () => {
        navigator.serviceWorker.register('/sw.js')
          .then(r => console.log('[PWA] Service Worker registered:', r.scope))
          .catch(err => console.warn('[PWA] SW registration failed:', err));
      };
      if (document.readyState === 'complete') {
        reg();
      } else {
        window.addEventListener('load', reg);
      }
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
  isClosingModal: false,

  setupRouter() {
    window.addEventListener('popstate', (e) => {
      this.handlePopState(e);
    });
  },

  handlePopState(e) {
    // 0. If a modal was closed programmatically via closeModal(), consume the popstate event and do nothing further
    if (this.isClosingModal) {
      this.isClosingModal = false;
      return;
    }

    // 1. Check if any modal backdrop or drawer is currently active in DOM (e.g. user pressed hardware back button)
    const openModals = document.querySelectorAll('.modal-backdrop, #photo-modal, #ai-tutor-modal, #search-modal, #notif-modal, #results-modal, #scanner-modal, #student-modal, #timetable-modal, #edit-tt-modal, #notice-modal, #event-modal, #server-config-modal');
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
      // If history state specifies the target tab, directly go there without popping previous stack
      if (e.state && e.state.tab) {
        if (window.StudentApp.currentTab !== e.state.tab) {
          window.StudentApp.switchTab(e.state.tab, false);
        }
        return;
      }
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
      if (e.state && e.state.section) {
        if (window.AdminApp.currentSection !== e.state.section) {
          window.AdminApp.switchSection(e.state.section, false);
        }
        return;
      }
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
  },

  showForgotPasswordModal() {
    const existing = document.getElementById('forgot-password-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'forgot-password-modal';
    modal.className = 'modal-backdrop active';
    modal.innerHTML = `
      <div class="modal-card" style="max-width:420px; width:92%; margin:auto; background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:24px; box-shadow:var(--shadow-lg); animation:fadeIn 0.2s ease;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
          <div>
            <h3 style="margin:0; font-size:18px; font-weight:800; color:var(--text-primary);">Reset Portal Password</h3>
            <p style="margin:4px 0 0 0; font-size:12px; color:var(--text-muted);">Verify your Student ID & Registered Mobile</p>
          </div>
          <button type="button" onclick="document.getElementById('forgot-password-modal').remove()" style="background:none; border:none; color:var(--text-muted); font-size:22px; cursor:pointer;">&times;</button>
        </div>

        <form id="forgot-password-form" onsubmit="event.preventDefault(); App.handleForgotPasswordSubmit();">
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label" style="font-size:12px;">Official UG ID *</label>
            <div class="input-container">
              <span class="input-icon">🆔</span>
              <input type="text" id="fp-ug-id" class="form-control" placeholder="e.g. 26UG033181" required style="font-size:13px;" />
            </div>
          </div>

          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label" style="font-size:12px;">Registered Mobile Number *</label>
            <div class="input-container">
              <span class="input-icon">📱</span>
              <input type="tel" id="fp-phone" class="form-control" placeholder="10-digit registered number" required style="font-size:13px;" />
            </div>
          </div>

          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label" style="font-size:12px;">New Password (min 6 chars) *</label>
            <div class="input-container">
              <span class="input-icon">🔒</span>
              <input type="password" id="fp-new-pass" class="form-control" placeholder="••••••••" required style="font-size:13px;" />
            </div>
          </div>

          <div class="form-group" style="margin-bottom:18px;">
            <label class="form-label" style="font-size:12px;">Confirm New Password *</label>
            <div class="input-container">
              <span class="input-icon">🔒</span>
              <input type="password" id="fp-confirm-pass" class="form-control" placeholder="••••••••" required style="font-size:13px;" />
            </div>
          </div>

          <div style="display:flex; gap:10px;">
            <button type="button" onclick="document.getElementById('forgot-password-modal').remove()" class="btn-secondary" style="flex:1; height:42px; font-weight:600;">Cancel</button>
            <button type="submit" id="fp-submit-btn" class="btn-primary" style="flex:2; height:42px; font-weight:700;">Reset Password</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
  },

  async handleForgotPasswordSubmit() {
    const ugId = document.getElementById('fp-ug-id').value.trim();
    const phone = document.getElementById('fp-phone').value.trim();
    const newPass = document.getElementById('fp-new-pass').value;
    const confirmPass = document.getElementById('fp-confirm-pass').value;
    const btn = document.getElementById('fp-submit-btn');

    if (!ugId || !phone || !newPass) {
      this.showToast('Please fill in all fields.', 'error');
      return;
    }

    if (newPass.length < 6) {
      this.showToast('Password must be at least 6 characters.', 'error');
      return;
    }

    if (newPass !== confirmPass) {
      this.showToast('Passwords do not match.', 'error');
      return;
    }

    btn.disabled = true;
    btn.innerText = 'Verifying...';

    const res = await API.forgotPassword(ugId, phone, newPass);
    btn.disabled = false;
    btn.innerText = 'Reset Password';

    if (res.success) {
      this.showToast('Password reset successfully! Please log in.', 'success');
      const modal = document.getElementById('forgot-password-modal');
      if (modal) modal.remove();
      const loginIdInput = document.getElementById('login-identifier');
      if (loginIdInput) loginIdInput.value = ugId;
      const loginPassInput = document.getElementById('login-password');
      if (loginPassInput) loginPassInput.focus();
    } else {
      this.showToast(res.message || 'Failed to reset password.', 'error');
    }
  }
};

window.App = App;

// Bulletproof Bootstrap on DOM Ready (Guarantees execution even if DOMContentLoaded already fired)
function bootstrapApp() {
  try {
    App.setupRouter();
    App.init();
  } catch (err) {
    console.error('[App Bootstrap Error]:', err);
    try { App.showAuth(); } catch (e) {}
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapApp);
} else {
  bootstrapApp();
}

