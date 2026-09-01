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
              <svg viewBox="0 0 512 512" width="44" height="44">
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
            <h1 class="auth-title">PARUL UNIVERSITY</h1>
            <p class="auth-subtitle">Faculty of Engineering & Technology</p>
            <span class="auth-badge">B.TECH CYBER SECURITY • 3CYBER7</span>
          </div>

          <!-- Auth Mode Toggle Tabs (Requirement #1) -->
          <div class="auth-toggle-tabs">
            <button class="auth-toggle-btn ${this.currentAuthMode === 'student' ? 'active' : ''}" id="btn-tab-student" onclick="App.setAuthMode('student')">
              👨‍🎓 Student Portal
            </button>
            <button class="auth-toggle-btn ${this.currentAuthMode === 'admin' ? 'active' : ''}" id="btn-tab-admin" onclick="App.setAuthMode('admin')">
              🛡️ Admin Panel
            </button>
          </div>

          <!-- Student Login Form -->
          <form id="student-login-form" style="display:${this.currentAuthMode === 'student' ? 'block' : 'none'};" onsubmit="event.preventDefault(); App.handleStudentLogin();">
            <div class="form-group">
              <label class="form-label">Official Student UG ID *</label>
              <div class="input-container">
                <span class="input-icon">🆔</span>
                <input type="text" id="student-ugid" class="form-control" placeholder="e.g. 26UG033181" required />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Password *</label>
              <div class="input-container">
                <span class="input-icon">🔒</span>
                <input type="password" id="student-password" class="form-control" placeholder="••••••••" required />
              </div>
            </div>

            <button type="submit" class="btn-primary">
              Log In to Student Portal
            </button>

            <!-- Pre-Configured Demo Account Card (Requirement #9) -->
            <div class="demo-credentials-box">
              <strong style="display:block; margin-bottom:2px;">✨ Demo Student Account:</strong>
              <div class="demo-row"><span>UG ID:</span> <strong>26UG033181</strong></div>
              <div class="demo-row"><span>Password:</span> <strong>Demo@123</strong></div>
              <div class="demo-row"><span>Assigned:</span> <strong>Batch 2 (Roll 31)</strong></div>
              <button type="button" class="demo-btn-fill" onclick="App.fillDemoStudent()">
                ⚡ Auto-Fill Demo Credentials
              </button>
            </div>
          </form>

          <!-- Admin Login Form -->
          <form id="admin-login-form" style="display:${this.currentAuthMode === 'admin' ? 'block' : 'none'};" onsubmit="event.preventDefault(); App.handleAdminLogin();">
            <div class="form-group">
              <label class="form-label">Admin ID / Username *</label>
              <div class="input-container">
                <span class="input-icon">👤</span>
                <input type="text" id="admin-username" class="form-control" placeholder="e.g. admin" required />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Password *</label>
              <div class="input-container">
                <span class="input-icon">🔒</span>
                <input type="password" id="admin-password" class="form-control" placeholder="••••••••" required />
              </div>
            </div>

            <button type="submit" class="btn-primary" style="background:linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%);">
              Log In to Admin Panel
            </button>

            <div class="demo-credentials-box" style="background:rgba(37,99,235,0.1); border-color:rgba(59,130,246,0.3); color:#60a5fa;">
              <strong style="display:block; margin-bottom:2px;">🛡️ Administrator Login:</strong>
              <div class="demo-row"><span>Admin ID:</span> <strong>admin</strong></div>
              <div class="demo-row"><span>Password:</span> <strong>Admin@123</strong></div>
              <button type="button" class="demo-btn-fill" style="background:rgba(37,99,235,0.2); border-color:rgba(59,130,246,0.4); color:#60a5fa;" onclick="App.fillDemoAdmin()">
                ⚡ Auto-Fill Admin Credentials
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  setAuthMode(mode) {
    this.currentAuthMode = mode;
    document.getElementById('btn-tab-student').classList.toggle('active', mode === 'student');
    document.getElementById('btn-tab-admin').classList.toggle('active', mode === 'admin');
    document.getElementById('student-login-form').style.display = mode === 'student' ? 'block' : 'none';
    document.getElementById('admin-login-form').style.display = mode === 'admin' ? 'block' : 'none';
  },

  fillDemoStudent() {
    document.getElementById('student-ugid').value = '26UG033181';
    document.getElementById('student-password').value = 'Demo@123';
  },

  fillDemoAdmin() {
    document.getElementById('admin-username').value = 'admin';
    document.getElementById('admin-password').value = 'Admin@123';
  },

  async handleStudentLogin() {
    const ug_id = document.getElementById('student-ugid').value.trim();
    const password = document.getElementById('student-password').value;

    if (!ug_id || !password) {
      this.showToast('Please enter UG ID and Password.', 'error');
      return;
    }

    this.showToast('Authenticating student credentials...', 'info');
    const res = await API.studentLogin(ug_id, password);

    if (res.success) {
      API.setToken(res.token);
      API.setUser(res.user);
      this.showToast(`Welcome back, ${res.user.name}!`, 'success');
      StudentApp.init(res.user);
    } else {
      this.showToast(res.message || 'Login failed. Check your UG ID and Password.', 'error');
    }
  },

  async handleAdminLogin() {
    const username = document.getElementById('admin-username').value.trim();
    const password = document.getElementById('admin-password').value;

    if (!username || !password) {
      this.showToast('Please enter Admin ID and Password.', 'error');
      return;
    }

    this.showToast('Verifying admin privileges...', 'info');
    const res = await API.adminLogin(username, password);

    if (res.success) {
      API.setToken(res.token);
      API.setUser(res.user);
      this.showToast('Admin login verified.', 'success');
      AdminApp.init(res.user);
    } else {
      this.showToast(res.message || 'Invalid admin credentials.', 'error');
    }
  },

  logout() {
    API.setToken(null);
    API.setUser(null);
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
  }
};

window.App = App;

// Bootstrap on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
