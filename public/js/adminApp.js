// ==========================================================================
// ADMIN WEB PANEL CONTROLLER
// ==========================================================================

const AdminApp = {
  currentSection: 'dashboard',
  currentUser: null,
  activeQrInterval: null,
  activeQrSessionId: null,
  sectionHistory: ['dashboard'],

  async init(user) {
    this.currentUser = user;
    this.sectionHistory = ['dashboard'];

    const hash = window.location.hash.replace('#admin-', '').replace('#', '').trim();
    const validSections = ['dashboard', 'students', 'add-student', 'batch-1', 'batch-2', 'qr-attendance', 'manual-attendance', 'attendance-reports', 'timetable-editor', 'academic-uploads', 'assignments-manage', 'results-manage', 'notifications-manage', 'calendar-manage'];
    const initialSection = validSections.includes(hash) ? hash : 'dashboard';
    this.currentSection = initialSection;
    if (initialSection !== 'dashboard') this.sectionHistory.push(initialSection);

    try {
      history.replaceState({ role: 'ADMIN', section: initialSection }, '', '#admin-' + initialSection);
    } catch (e) {}

    this.renderLayout();
    this.bindSidebarEvents();
    await this.loadSectionData(initialSection);
  },

  renderLayout() {
    const root = document.getElementById('app-root');

    root.innerHTML = `
      <div class="admin-layout">
        <!-- Sidebar Navigation -->
        <aside class="admin-sidebar" id="admin-sidebar">
          <div class="sidebar-header">
            <div class="brand-crest">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2.2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div>
              <h2 style="font-size:15px; font-weight:800;">PU ADMIN PANEL</h2>
              <span style="font-size:11px; color:var(--accent-cyan); font-weight:600;">3CYBER7 • B.Tech</span>
            </div>
          </div>

          <div class="sidebar-menu">
            <div class="sidebar-group-title">Overview</div>
            <button class="sidebar-item active" data-section="dashboard">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              Dashboard
            </button>

            <div class="sidebar-group-title">Students & Class</div>
            <button class="sidebar-item" data-section="students">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              All Students
            </button>
            <button class="sidebar-item" data-section="add-student">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
              Add Student
            </button>
            <button class="sidebar-item" data-section="batch-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              Batch 1 (Roll 1–30)
            </button>
            <button class="sidebar-item" data-section="batch-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              Batch 2 (Roll 31+)
            </button>

            <div class="sidebar-group-title">Attendance</div>
            <button class="sidebar-item" data-section="qr-attendance">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/></svg>
              Dynamic QR Session
            </button>
            <button class="sidebar-item" data-section="manual-attendance">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              Manual Attendance
            </button>
            <button class="sidebar-item" data-section="attendance-reports">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              Reports & Export
            </button>

            <div class="sidebar-group-title">Academic & Timetable</div>
            <button class="sidebar-item" data-section="timetable-editor">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Timetable (3CYBER7)
            </button>
            <button class="sidebar-item" data-section="academic-uploads">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              Notes & Materials
            </button>
            <button class="sidebar-item" data-section="assignments-manage">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Assignments
            </button>
            <button class="sidebar-item" data-section="results-manage">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
              Results Entry
            </button>

            <div class="sidebar-group-title">Communication & Setup</div>
            <button class="sidebar-item" data-section="notifications-manage">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              Notifications & Notices
            </button>
            <button class="sidebar-item" data-section="calendar-manage">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Academic Calendar
            </button>
          </div>

          <div class="sidebar-footer">
            <button class="sidebar-item" onclick="window.App.logout()" style="color:#f87171;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Logout
            </button>
          </div>
        </aside>

        <!-- Mobile Sidebar Backdrop Overlay -->
        <div class="admin-sidebar-backdrop" id="admin-sidebar-backdrop" onclick="AdminApp.toggleSidebar(false)"></div>

        <!-- Main Content Area -->
        <main class="admin-main">
          <header class="admin-topbar">
            <div style="display:flex; align-items:center; gap:12px;">
              <button class="icon-btn" id="btn-toggle-sidebar" onclick="AdminApp.toggleSidebar()">☰</button>
              <h2 id="admin-page-title" style="font-size:17px; font-weight:800;">Dashboard Overview</h2>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              <span class="auth-badge" style="margin-top:0; font-size:11px; padding:3px 8px;">MGI • 2026–27</span>
              <button class="icon-btn" onclick="window.App.toggleTheme()" title="Toggle Theme">🌓</button>
            </div>
          </header>

          <div class="admin-body" id="admin-body-content">
            <!-- Dynamic Admin Content -->
          </div>
        </main>
      </div>

      <!-- Modals Container -->
      <div id="admin-modal-container"></div>
    `;
  },

  toggleSidebar(forceState) {
    const sidebar = document.getElementById('admin-sidebar');
    const backdrop = document.getElementById('admin-sidebar-backdrop');
    if (!sidebar) return;

    const isOpen = forceState !== undefined ? forceState : !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', isOpen);
    if (backdrop) backdrop.classList.toggle('open', isOpen);
  },

  bindSidebarEvents() {
    document.querySelectorAll('.admin-sidebar .sidebar-item').forEach(btn => {
      if (btn.dataset.section) {
        btn.addEventListener('click', () => {
          this.toggleSidebar(false);
          this.switchSection(btn.dataset.section);
        });
      }
    });
  },

  switchSection(section, pushState = true) {
    if (pushState) {
      if (this.sectionHistory[this.sectionHistory.length - 1] !== section) {
        this.sectionHistory.push(section);
      }
      try {
        history.pushState({ role: 'ADMIN', section: section }, '', '#admin-' + section);
      } catch (e) {}
    }
    this.currentSection = section;
    document.querySelectorAll('.admin-sidebar .sidebar-item').forEach(b => {
      b.classList.toggle('active', b.dataset.section === section);
    });

    const titles = {
      dashboard: 'Dashboard Overview',
      students: 'Students Management',
      'add-student': 'Create New Student Account',
      'batch-1': 'Batch 1 Students (Roll 1–30)',
      'batch-2': 'Batch 2 Students (Roll 31+)',
      'qr-attendance': 'Dynamic QR Attendance Control Center',
      'manual-attendance': 'Manual Class Attendance',
      'attendance-reports': 'Attendance Analytics & Export',
      'timetable-editor': 'Timetable Management (3CYBER7)',
      'academic-uploads': 'Notes & Study Materials Upload',
      'assignments-manage': 'Assignments Management',
      'results-manage': 'Academic Results Entry',
      'notifications-manage': 'Publish Notifications & Notices',
      'calendar-manage': 'Academic Calendar & Events'
    };

    const titleEl = document.getElementById('admin-page-title');
    if (titleEl) titleEl.innerText = titles[section] || 'Admin Panel';

    this.loadSectionData(section);
  },

  closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.remove();
    if (history.state && history.state.modal === modalId) {
      history.back();
    }
  },

  async loadSectionData(section) {
    const container = document.getElementById('admin-body-content');
    container.innerHTML = `<div style="text-align:center; padding:50px;"><div class="spinner"></div></div>`;

    if (section === 'dashboard') await this.renderDashboard(container);
    else if (section === 'students') await this.renderStudentsList(container);
    else if (section === 'add-student') this.renderAddStudentForm(container);
    else if (section === 'batch-1') await this.renderStudentsList(container, 'Batch 1');
    else if (section === 'batch-2') await this.renderStudentsList(container, 'Batch 2');
    else if (section === 'qr-attendance') await this.renderQRAttendanceCenter(container);
    else if (section === 'manual-attendance') await this.renderManualAttendance(container);
    else if (section === 'attendance-reports') await this.renderAttendanceReports(container);
    else if (section === 'timetable-editor') await this.renderTimetableEditor(container);
    else if (section === 'academic-uploads') await this.renderAcademicUploads(container);
    else if (section === 'assignments-manage') await this.renderAssignmentsManage(container);
    else if (section === 'results-manage') await this.renderResultsManage(container);
    else if (section === 'notifications-manage') await this.renderNotificationsManage(container);
    else if (section === 'calendar-manage') await this.renderCalendarManage(container);
  },

  // ==================== 1. DASHBOARD ====================
  async renderDashboard(container) {
    const res = await API.getDashboardStats();
    const stats = res.success ? res.stats : {
      totalStudents: 11, batch1Students: 5, batch2Students: 6,
      attendanceRate: '92.4%', totalNotes: 6, totalAssignments: 3, totalQuestionPapers: 3, activeNotifications: 3
    };

    container.innerHTML = `
      <!-- Stats Cards Grid -->
      <div class="dashboard-grid">
        <div class="metric-card">
          <div class="metric-icon" style="background:rgba(37,99,235,0.15); color:#60a5fa;">👥</div>
          <div class="metric-info">
            <h3>${stats.totalStudents}</h3>
            <p>Total Active Students</p>
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-icon" style="background:rgba(6,182,212,0.15); color:#38bdf8;">1️⃣</div>
          <div class="metric-info">
            <h3>${stats.batch1Students}</h3>
            <p>Batch 1 Students (Roll 1–30)</p>
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-icon" style="background:rgba(139,92,246,0.15); color:#c084fc;">2️⃣</div>
          <div class="metric-info">
            <h3>${stats.batch2Students}</h3>
            <p>Batch 2 Students (Roll 31+)</p>
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-icon" style="background:rgba(16,185,129,0.15); color:#34d399;">📊</div>
          <div class="metric-info">
            <h3>${stats.attendanceRate}</h3>
            <p>Today's Attendance Rate</p>
          </div>
        </div>
      </div>

      <!-- Quick Action Bar -->
      <div class="glass-card" style="padding:20px; margin-bottom:26px;">
        <h3 style="font-size:15px; font-weight:800; margin-bottom:14px;">⚡ Quick Management Actions</h3>
        <div style="display:flex; flex-wrap:wrap; gap:10px;">
          <button class="btn-primary" style="width:auto; padding:10px 18px; font-size:13px; margin-top:0;" onclick="AdminApp.switchSection('add-student')">
            + Add New Student (4 Fields)
          </button>
          <button class="btn-primary" style="width:auto; padding:10px 18px; font-size:13px; margin-top:0; background:linear-gradient(135deg, #0ea5e9, #6366f1);" onclick="AdminApp.switchSection('qr-attendance')">
            📷 Start Dynamic QR Attendance
          </button>
          <button class="btn-primary" style="width:auto; padding:10px 18px; font-size:13px; margin-top:0; background:rgba(37,99,235,0.2); border:1px solid rgba(59,130,246,0.4); color:#60a5fa;" onclick="AdminApp.switchSection('academic-uploads')">
            📚 Upload Class Notes / PDF
          </button>
          <button class="btn-primary" style="width:auto; padding:10px 18px; font-size:13px; margin-top:0; background:rgba(245,158,11,0.2); border:1px solid rgba(245,158,11,0.4); color:#fbbf24;" onclick="AdminApp.switchSection('assignments-manage')">
            📝 Create Assignment
          </button>
        </div>
      </div>

      <!-- Academic Class Configuration Summary (Requirement #6, #8) -->
      <div class="glass-card" style="padding:22px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <h3 style="font-size:16px; font-weight:800;">🏫 Academic Class Master Structure</h3>
          <span class="auth-badge" style="margin-top:0;">Single Central Source of Truth</span>
        </div>
        <p style="font-size:13px; color:var(--text-secondary); margin-bottom:16px;">
          All new students automatically inherit this structure and immediately gain access to existing notes, assignments, timetable, and notices without manual reassignment.
        </p>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:14px; font-size:13px;">
          <div style="padding:12px; background:var(--bg-input); border-radius:var(--radius-md);">
            <span style="color:var(--text-muted); font-size:11px;">PROGRAM</span>
            <div style="font-weight:800; color:#ffffff; margin-top:2px;">B.Tech Cyber Security</div>
          </div>
          <div style="padding:12px; background:var(--bg-input); border-radius:var(--radius-md);">
            <span style="color:var(--text-muted); font-size:11px;">YEAR / SEMESTER</span>
            <div style="font-weight:800; color:#ffffff; margin-top:2px;">2nd Year • 3rd Semester</div>
          </div>
          <div style="padding:12px; background:var(--bg-input); border-radius:var(--radius-md);">
            <span style="color:var(--text-muted); font-size:11px;">DIVISION</span>
            <div style="font-weight:800; color:#ffffff; margin-top:2px;">3CYBER7</div>
          </div>
          <div style="padding:12px; background:var(--bg-input); border-radius:var(--radius-md);">
            <span style="color:var(--text-muted); font-size:11px;">ACADEMIC YEAR</span>
            <div style="font-weight:800; color:#ffffff; margin-top:2px;">2026–27</div>
          </div>
          <div style="padding:12px; background:var(--bg-input); border-radius:var(--radius-md);">
            <span style="color:var(--text-muted); font-size:11px;">BATCH DETERMINATION</span>
            <div style="font-weight:800; color:#38bdf8; margin-top:2px;">Roll 1–30 $\rightarrow$ Batch 1 | 31+ $\rightarrow$ Batch 2</div>
          </div>
        </div>
      </div>
    `;
  },

  // ==================== 2. ADD STUDENT FORM (STRICTLY 4 FIELDS - Requirement #5, #6, #7, #8) ====================
  renderAddStudentForm(container) {
    container.innerHTML = `
      <div class="glass-card" style="max-width:680px; margin:0 auto; padding:28px;">
        <div style="margin-bottom:20px; border-bottom:1px solid var(--border-color); padding-bottom:14px;">
          <h3 style="font-size:18px; font-weight:800;">➕ Add New Student</h3>
          <p style="font-size:13px; color:var(--text-secondary); margin-top:4px;">
            Enter the 4 required student credentials. The system automatically computes and assigns the Batch, Course, Year, Semester, Division, and Academic Year.
          </p>
        </div>

        <form id="admin-add-student-form" onsubmit="event.preventDefault(); AdminApp.submitAddStudent();">
          <div class="form-group">
            <label class="form-label">1. Student Full Name *</label>
            <input type="text" id="add-student-name" class="form-control" placeholder="e.g. Rahul Sharma" required />
          </div>

          <div class="form-group">
            <label class="form-label">2. Official Student UG ID *</label>
            <input type="text" id="add-student-ugid" class="form-control" placeholder="e.g. 26UG033220" required />
            <small style="color:var(--text-muted); font-size:11px;">Official university unique ID (format: 26UG033XXX)</small>
          </div>

          <div class="form-group">
            <label class="form-label">3. Student Password *</label>
            <input type="password" id="add-student-password" class="form-control" placeholder="e.g. Rahul@123" required />
          </div>

          <div class="form-group">
            <label class="form-label">4. Class Roll Number *</label>
            <input type="number" id="add-student-roll" class="form-control" placeholder="e.g. 35" min="1" max="150" required oninput="AdminApp.updateAutoBatchPreview(this.value)" />
          </div>

          <!-- Automated Class & Batch Live Preview -->
          <div style="padding:16px; border-radius:var(--radius-md); background:rgba(37,99,235,0.1); border:1px solid rgba(59,130,246,0.3); margin:20px 0;">
            <div style="font-size:12px; font-weight:700; color:#60a5fa; margin-bottom:8px;">⚡ AUTOMATIC SYSTEM ASSIGNMENT:</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:12px;">
              <div>• Program: <strong>B.Tech Cyber Security</strong></div>
              <div>• Year / Sem: <strong>2nd Year • 3rd Semester</strong></div>
              <div>• Division: <strong>3CYBER7</strong></div>
              <div>• Academic Year: <strong>2026–27</strong></div>
              <div style="grid-column:span 2;">
                • Automatic Batch: <span id="auto-batch-preview" class="batch-badge batch-2" style="font-size:12px;">Batch 2 (Roll >= 31)</span>
              </div>
            </div>
          </div>

          <button type="submit" class="btn-primary" style="padding:14px; font-size:15px;">
            ✓ Create Student Account & Provision Academic Content
          </button>
        </form>
      </div>
    `;
  },

  updateAutoBatchPreview(rollVal) {
    const roll = parseInt(rollVal, 10);
    const badge = document.getElementById('auto-batch-preview');
    if (!badge) return;

    if (!roll || isNaN(roll)) {
      badge.className = 'batch-badge batch-2';
      badge.innerText = 'Batch 2 (Roll >= 31)';
      return;
    }

    if (roll <= 30) {
      badge.className = 'batch-badge batch-1';
      badge.innerText = `Batch 1 (Roll ${roll} <= 30)`;
    } else {
      badge.className = 'batch-badge batch-2';
      badge.innerText = `Batch 2 (Roll ${roll} >= 31)`;
    }
  },

  async submitAddStudent() {
    const name = document.getElementById('add-student-name').value.trim();
    const ug_id = document.getElementById('add-student-ugid').value.trim();
    const password = document.getElementById('add-student-password').value;
    const roll_number = document.getElementById('add-student-roll').value;

    if (!name || !ug_id || !password || !roll_number) {
      window.App.showToast('All 4 fields are required.', 'error');
      return;
    }

    window.App.showToast('Creating student record...', 'info');
    const res = await API.addStudent({ name, ug_id, password, roll_number });

    if (res.success) {
      window.App.showToast(res.message, 'success');
      this.switchSection('students');
    } else {
      window.App.showToast(res.message || 'Failed to create student.', 'error');
    }
  },

  // ==================== 3. STUDENTS LIST (ALL / BATCH 1 / BATCH 2) ====================
  async renderStudentsList(container, filterBatch = null) {
    const res = await API.getStudents(filterBatch ? { batch: filterBatch } : {});
    const students = res.success ? res.data : [];

    container.innerHTML = `
      <div class="glass-card" style="padding:22px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; flex-wrap:wrap; gap:10px;">
          <div>
            <h3 style="font-size:17px; font-weight:800;">${filterBatch ? filterBatch + ' Roster' : 'All Students (Division 3CYBER7)'}</h3>
            <span style="font-size:12px; color:var(--text-muted);">Total: ${students.length} students enrolled</span>
          </div>
          <div style="display:flex; gap:10px;">
            <input type="text" id="student-search-box" class="form-control" placeholder="Search by name or UG ID..." oninput="AdminApp.searchStudentTable(this.value)" style="width:240px; padding:8px 12px; font-size:13px;" />
            <button class="btn-primary" style="width:auto; padding:8px 16px; margin-top:0; font-size:13px;" onclick="AdminApp.switchSection('add-student')">
              + Add Student
            </button>
          </div>
        </div>

        <div class="table-container">
          <table class="data-table" id="admin-students-table">
            <thead>
              <tr>
                <th>Roll No</th>
                <th>UG ID</th>
                <th>Student Name</th>
                <th>Batch</th>
                <th>Division</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${students.map(s => `
                <tr data-name="${s.name.toLowerCase()}" data-ugid="${s.ug_id.toLowerCase()}">
                  <td><strong>#${s.roll_number}</strong></td>
                  <td><span style="font-family:monospace; color:#38bdf8; font-weight:700;">${s.ug_id}</span></td>
                  <td>${s.name}</td>
                  <td><span class="batch-badge ${s.batch === 'Batch 1' ? 'batch-1' : 'batch-2'}">${s.batch}</span></td>
                  <td>3CYBER7</td>
                  <td><span style="color:#34d399; font-weight:700; font-size:11px;">● ${s.status}</span></td>
                  <td>
                    <button class="icon-btn" onclick="AdminApp.openEditStudentModal(${s.id}, '${s.name}', '${s.ug_id}', ${s.roll_number})" title="Edit" style="width:28px; height:28px; display:inline-flex;">✎</button>
                    <button class="icon-btn" onclick="AdminApp.deleteStudentPrompt(${s.id}, '${s.name}')" title="Delete" style="width:28px; height:28px; display:inline-flex; color:#f87171;">🗑</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  searchStudentTable(query) {
    const q = query.toLowerCase();
    document.querySelectorAll('#admin-students-table tbody tr').forEach(row => {
      const match = row.dataset.name.includes(q) || row.dataset.ugid.includes(q);
      row.style.display = match ? '' : 'none';
    });
  },

  openEditStudentModal(id, name, ug_id, roll) {
    try {
      history.pushState({ role: 'ADMIN', modal: 'edit-student-modal' }, '', '#admin-students-edit');
    } catch (e) {}

    const modalContainer = document.getElementById('admin-modal-container');
    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="edit-student-modal">
        <div class="modal-card">
          <div class="modal-header">
            <h3 style="font-size:16px; font-weight:800;">Edit Student: ${ug_id}</h3>
            <button class="icon-btn" onclick="AdminApp.closeModal('edit-student-modal')" style="width:30px; height:30px;">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Student Name</label>
              <input type="text" id="edit-name" class="form-control" value="${name}" />
            </div>
            <div class="form-group">
              <label class="form-label">Roll Number</label>
              <input type="number" id="edit-roll" class="form-control" value="${roll}" />
            </div>
            <div class="form-group">
              <label class="form-label">Reset Password (leave empty to keep current)</label>
              <input type="password" id="edit-password" class="form-control" placeholder="New Password" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-primary" style="width:auto; background:var(--bg-input); border:1px solid var(--border-color); color:var(--text-secondary); margin-top:0;" onclick="AdminApp.closeModal('edit-student-modal')">Cancel</button>
            <button class="btn-primary" style="width:auto; margin-top:0;" onclick="AdminApp.submitEditStudent(${id})">Save Changes</button>
          </div>
        </div>
      </div>
    `;
  },

  async submitEditStudent(id) {
    const name = document.getElementById('edit-name').value.trim();
    const roll_number = document.getElementById('edit-roll').value;
    const password = document.getElementById('edit-password').value;

    const res = await API.updateStudent(id, { name, roll_number, password: password || undefined });
    if (res.success) {
      window.App.showToast('Student updated successfully.', 'success');
      document.getElementById('edit-student-modal').remove();
      this.switchSection('students');
    } else {
      window.App.showToast(res.message || 'Failed to update student.', 'error');
    }
  },

  async deleteStudentPrompt(id, name) {
    if (confirm(`Are you sure you want to delete student "${name}"? This action cannot be undone.`)) {
      const res = await API.deleteStudent(id);
      if (res.success) {
        window.App.showToast(res.message, 'success');
        this.switchSection('students');
      } else {
        window.App.showToast(res.message || 'Failed to delete.', 'error');
      }
    }
  },

  // ==================== 4. DYNAMIC QR ATTENDANCE CONTROL CENTER (Requirements #30, #31, #32) ====================
  async renderQRAttendanceCenter(container) {
    container.innerHTML = `
      <div class="admin-grid-2col">
        <!-- Left: Start New Dynamic QR Session Form -->
        <div class="glass-card" style="padding:24px;">
          <h3 style="font-size:17px; font-weight:800; margin-bottom:6px;">🚀 Start Live Dynamic QR Session</h3>
          <p style="font-size:13px; color:var(--text-secondary); margin-bottom:18px;">
            Set classroom reference GPS coordinates and allowed radius. The QR refreshes dynamically every 15s to block remote screenshots.
          </p>

          <form id="start-qr-session-form" onsubmit="event.preventDefault(); AdminApp.submitStartQRSession();">
            <div class="form-group">
              <label class="form-label">Subject *</label>
              <select id="qr-subject-select" class="form-control" required>
                <option value="DBMS">Database Management System (DBMS)</option>
                <option value="NCS">Network & Cyber Security (NCS)</option>
                <option value="DSA">Data Structures & Algorithms (DSA)</option>
                <option value="JAVA">Object Oriented Programming with Java</option>
                <option value="COMA">Computer Organization & Architecture (COMA)</option>
                <option value="DM">Discrete Mathematics (DM)</option>
                <option value="FCS">Fundamentals of Cyber Security (FCS)</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Target Batch *</label>
              <select id="qr-batch-select" class="form-control" required>
                <option value="Both">Both Batches (Batch 1 & Batch 2)</option>
                <option value="Batch 1">Batch 1 Only (Roll 1–30)</option>
                <option value="Batch 2">Batch 2 Only (Roll 31+)</option>
              </select>
            </div>

            <div class="form-group" style="margin-bottom:18px;">
              <label class="form-label">QR Refresh Speed</label>
              <select id="qr-refresh-sec" class="form-control">
                <option value="15" selected>Every 15 Seconds (Recommended - Maximum Security)</option>
                <option value="30">Every 30 Seconds</option>
                <option value="60">Every 60 Seconds</option>
              </select>
            </div>

            <button type="submit" class="btn-primary" style="padding:14px; font-size:15px; background:linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%);">
              ⚡ START LIVE ATTENDANCE QR SESSION
            </button>
          </form>
        </div>

        <!-- Right: Live Active QR Screen Display -->
        <div class="glass-card" id="live-qr-display-box" style="padding:24px; text-align:center; display:flex; flex-direction:column; justify-content:center; align-items:center;">
          <div style="font-size:48px; margin-bottom:12px;">📽️</div>
          <h3 style="font-size:18px; font-weight:800;">Classroom Projector View</h3>
          <p style="font-size:13px; color:var(--text-secondary); max-width:320px; margin:8px auto 0;">
            When you click "START LIVE ATTENDANCE QR SESSION", the live rotating QR Code and real-time student count will display here.
          </p>
        </div>
      </div>
    `;
  },

  async submitStartQRSession() {
    const subject = document.getElementById('qr-subject-select').value;
    const batch = document.getElementById('qr-batch-select').value;
    const qr_refresh_interval = document.getElementById('qr-refresh-sec').value;

    const res = await API.startQRSession({
      subject,
      batch,
      qr_refresh_interval
    });

    if (res.success) {
      window.App.showToast('Dynamic QR Session Started!', 'success');
      this.activeQrSessionId = res.session.id;
      this.startLiveQRDisplay(res.session);
    } else {
      window.App.showToast(res.message || 'Failed to start QR session.', 'error');
    }
  },

  startLiveQRDisplay(session) {
    const box = document.getElementById('live-qr-display-box');
    if (!box) return;

    box.innerHTML = `
      <div style="width:100%;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
          <div>
            <span class="class-status-badge live">● LIVE ATTENDANCE SESSION</span>
            <h3 style="font-size:18px; font-weight:800; margin-top:4px;">${session.subject}</h3>
            <span style="font-size:12px; color:var(--text-muted);">Designated: ${session.batch}</span>
          </div>
          <button class="btn-primary" onclick="AdminApp.stopActiveSession()" style="width:auto; padding:6px 14px; background:rgba(239,68,68,0.2); border:1px solid rgba(239,68,68,0.4); color:#f87171; margin-top:0; font-size:12px;">
            ⏹ Stop Session
          </button>
        </div>

        <!-- Rotating QR Code Display (Graphic + Token) -->
        <div style="background:#ffffff; padding:18px; border-radius:var(--radius-xl); display:inline-block; box-shadow:0 0 45px rgba(6,182,212,0.45); margin:12px auto; text-align:center; max-width:100%;">
          <div id="qr-code-canvas-container" style="display:flex; justify-content:center; align-items:center; width:220px; height:220px; margin:0 auto; background:#ffffff; border-radius:10px; overflow:hidden;">
            ${session.initial_qr_image ? `<img id="qr-code-image" src="${session.initial_qr_image}" alt="Classroom QR" style="width:220px; height:220px; display:block; border-radius:8px; object-fit:contain;" />` : `<div style="color:#0f172a; font-weight:700; font-size:13px;">Generating QR Matrix...</div>`}
          </div>

          <div style="margin-top:10px; padding:6px 12px; background:#f1f5f9; border-radius:8px; border:1px solid #cbd5e1;">
            <div style="font-family:monospace; font-size:15px; font-weight:800; color:#0f172a; letter-spacing:0.5px; word-break:break-all;" id="dynamic-qr-token-display">
              ${session.initial_token || 'GENERATING...'}
            </div>
            <div style="font-size:10px; color:#64748b; font-weight:700; margin-top:2px;">
              ROTATING LIVE SECURE TOKEN
            </div>
          </div>
        </div>

        <!-- Timer & Verified Count -->
        <div style="display:flex; justify-content:space-around; align-items:center; margin-top:16px; padding-top:14px; border-top:1px solid var(--border-color);">
          <div>
            <div style="font-size:11px; color:var(--text-muted);">NEXT REFRESH</div>
            <div style="font-size:20px; font-weight:900; color:#38bdf8;" id="qr-countdown-text">${session.qr_refresh_interval || 15}s</div>
          </div>
          <div>
            <div style="font-size:11px; color:var(--text-muted);">PRESENT STUDENTS</div>
            <div style="font-size:22px; font-weight:900; color:#34d399;" id="qr-scanned-count">0</div>
          </div>
        </div>
      </div>
    `;

    // Render initial QR Code
    this.renderGraphicQRCode(session.initial_token, session.initial_qr_image);

    if (this.activeQrInterval) clearInterval(this.activeQrInterval);

    let timeLeft = parseInt(session.qr_refresh_interval, 10) || 15;

    this.activeQrInterval = setInterval(async () => {
      timeLeft--;
      const timerEl = document.getElementById('qr-countdown-text');
      if (timerEl) timerEl.innerText = `${timeLeft}s`;

      // Real-time live sync: refresh scan count and attendance roster every 2 seconds
      if (timeLeft % 2 === 0) {
        API.getSessionScans(session.id).then(scanRes => {
          if (scanRes.success && scanRes.scans) {
            const countEl = document.getElementById('qr-scanned-count');
            if (countEl) countEl.innerText = scanRes.scans.length;
          }
        }).catch(() => {});
      }

      if (timeLeft <= 0) {
        timeLeft = parseInt(session.qr_refresh_interval, 10) || 15;
        // Fetch new rotating token
        const tokenRes = await API.getLiveQRToken(session.id);
        if (tokenRes.success && tokenRes.token) {
          this.updateGraphicQRCode(tokenRes.token, tokenRes.qr_image);
          const displayEl = document.getElementById('dynamic-qr-token-display');
          const countEl = document.getElementById('qr-scanned-count');
          if (displayEl) displayEl.innerText = tokenRes.token;
          if (countEl) countEl.innerText = tokenRes.scannedCount || 0;
        }
      }
    }, 1000);
  },

  renderGraphicQRCode(token, qrImage) {
    const container = document.getElementById('qr-code-canvas-container');
    if (!container) return;

    if (qrImage) {
      container.innerHTML = `<img id="qr-code-image" src="${qrImage}" alt="Classroom QR" style="width:220px; height:220px; display:block; border-radius:8px; object-fit:contain;" />`;
      return;
    }

    container.innerHTML = '';
    if (window.QRCode && token) {
      try {
        this.currentQrCodeInstance = new window.QRCode(container, {
          text: token,
          width: 220,
          height: 220,
          colorDark: "#090d16",
          colorLight: "#ffffff",
          correctLevel: window.QRCode.CorrectLevel.H
        });
      } catch (err) {
        console.warn('Client QR render fallback:', err);
      }
    }
  },

  updateGraphicQRCode(token, qrImage) {
    if (qrImage) {
      const img = document.getElementById('qr-code-image');
      if (img) {
        img.src = qrImage;
      } else {
        this.renderGraphicQRCode(token, qrImage);
      }
      return;
    }

    if (this.currentQrCodeInstance && typeof this.currentQrCodeInstance.makeCode === 'function') {
      try {
        this.currentQrCodeInstance.makeCode(token);
      } catch (err) {
        this.renderGraphicQRCode(token);
      }
    } else {
      this.renderGraphicQRCode(token);
    }
  },

  async stopActiveSession() {
    if (this.activeQrSessionId) {
      await API.stopQRSession(this.activeQrSessionId);
      if (this.activeQrInterval) clearInterval(this.activeQrInterval);
      this.currentQrCodeInstance = null;
      window.App.showToast('Attendance session stopped.', 'info');
      this.switchSection('attendance-reports');
    }
  },

  // ==================== 5. MANUAL ATTENDANCE (Requirement #29, #42) ====================
  async renderManualAttendance(container) {
    const studentsRes = await API.getStudents();
    const students = studentsRes.success ? studentsRes.data : [];
    const todayStr = new Date().toISOString().split('T')[0];

    container.innerHTML = `
      <div class="glass-card" style="padding:22px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; flex-wrap:wrap; gap:10px;">
          <div>
            <h3 style="font-size:17px; font-weight:800;">✍️ Manual Attendance Register</h3>
            <p style="font-size:12px; color:var(--text-secondary);">Manual fallback with automatic audit logging</p>
          </div>
          <div style="display:flex; gap:8px;">
            <input type="date" id="manual-date" class="form-control" value="${todayStr}" style="padding:6px 12px; font-size:12px;" />
            <select id="manual-subject" class="form-control" style="padding:6px 12px; font-size:12px;">
              <option value="DBMS">DBMS</option>
              <option value="NCS">NCS</option>
              <option value="DSA">DSA</option>
              <option value="JAVA">JAVA</option>
              <option value="COMA">COMA</option>
              <option value="DM">DM</option>
              <option value="FCS">FCS</option>
            </select>
            <button class="btn-primary" onclick="AdminApp.saveManualAttendanceRoster()" style="width:auto; padding:8px 18px; margin-top:0; font-size:13px;">
              💾 SAVE ATTENDANCE
            </button>
          </div>
        </div>

        <div class="table-container">
          <table class="data-table" id="manual-roster-table">
            <thead>
              <tr>
                <th>Roll</th>
                <th>UG ID</th>
                <th>Student Name</th>
                <th>Batch</th>
                <th>Mark Status</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${students.map(s => `
                <tr data-ugid="${s.ug_id}" data-name="${s.name}">
                  <td>#${s.roll_number}</td>
                  <td><span style="font-family:monospace; color:#38bdf8; font-weight:700;">${s.ug_id}</span></td>
                  <td>${s.name}</td>
                  <td><span class="batch-badge ${s.batch === 'Batch 1' ? 'batch-1' : 'batch-2'}">${s.batch}</span></td>
                  <td>
                    <div style="display:flex; gap:6px;">
                      <button class="status-toggle-btn active-present" data-ugid="${s.ug_id}" data-status="PRESENT" onclick="AdminApp.toggleStudentStatus('${s.ug_id}', 'PRESENT')">Present</button>
                      <button class="status-toggle-btn" data-ugid="${s.ug_id}" data-status="ABSENT" onclick="AdminApp.toggleStudentStatus('${s.ug_id}', 'ABSENT')">Absent</button>
                      <button class="status-toggle-btn" data-ugid="${s.ug_id}" data-status="LEAVE" onclick="AdminApp.toggleStudentStatus('${s.ug_id}', 'LEAVE')">Leave</button>
                    </div>
                  </td>
                  <td>
                    <input type="text" class="form-control manual-remark-input" data-ugid="${s.ug_id}" placeholder="Remarks..." style="padding:4px 8px; font-size:11px;" />
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  toggleStudentStatus(ugid, status) {
    document.querySelectorAll(`button[data-ugid="${ugid}"]`).forEach(btn => {
      btn.className = 'status-toggle-btn';
      if (btn.dataset.status === status) {
        if (status === 'PRESENT') btn.classList.add('active-present');
        if (status === 'ABSENT') btn.classList.add('active-absent');
        if (status === 'LEAVE') btn.classList.add('active-leave');
      }
    });
  },

  async saveManualAttendanceRoster() {
    const date = document.getElementById('manual-date').value;
    const subject = document.getElementById('manual-subject').value;

    const records = [];
    document.querySelectorAll('#manual-roster-table tbody tr').forEach(row => {
      const ugid = row.dataset.ugid;
      const name = row.dataset.name;
      const activeBtn = row.querySelector('.status-toggle-btn.active-present, .status-toggle-btn.active-absent, .status-toggle-btn.active-leave');
      const status = activeBtn ? activeBtn.dataset.status : 'PRESENT';
      const remarkInput = row.querySelector('.manual-remark-input');
      const remarks = remarkInput ? remarkInput.value : '';

      records.push({
        ug_id: ugid,
        student_name: name,
        status,
        remarks
      });
    });

    window.App.showToast('Saving manual attendance...', 'info');
    const res = await API.saveManualAttendance({ date, subject, records });

    if (res.success) {
      window.App.showToast(res.message, 'success');
      this.switchSection('attendance-reports');
    } else {
      window.App.showToast(res.message || 'Failed to save attendance.', 'error');
    }
  },

  // ==================== 6. ATTENDANCE REPORTS & CSV EXPORT (Requirement #43) ====================
  async renderAttendanceReports(container) {
    const res = await API.getAdminAttendanceReport();
    const records = res.success ? res.records : [];
    const auditLogs = res.success ? res.auditLogs : [];

    container.innerHTML = `
      <div class="glass-card" style="padding:22px; margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div>
            <h3 style="font-size:17px; font-weight:800;">📊 Attendance Reports & Audit Trail</h3>
            <p style="font-size:12px; color:var(--text-secondary);">Comprehensive logs of QR scans, manual overrides, and export</p>
          </div>
          <button class="btn-primary" onclick="AdminApp.exportAttendanceCSV()" style="width:auto; padding:8px 16px; margin-top:0; font-size:13px; background:rgba(16,185,129,0.2); border:1px solid rgba(16,185,129,0.4); color:#34d399;">
            📥 Export Attendance CSV / Excel
          </button>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>UG ID</th>
                <th>Student Name</th>
                <th>Batch</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Marked By</th>
              </tr>
            </thead>
            <tbody>
              ${records.slice(0, 30).map(r => `
                <tr>
                  <td>${r.date}</td>
                  <td><span style="font-family:monospace; color:#38bdf8;">${r.ug_id}</span></td>
                  <td>${r.student_name}</td>
                  <td><span class="batch-badge ${r.batch === 'Batch 1' ? 'batch-1' : 'batch-2'}">${r.batch}</span></td>
                  <td><strong>${r.subject}</strong></td>
                  <td><span style="color:${r.status === 'PRESENT' ? '#34d399' : '#f87171'}; font-weight:700;">● ${r.status}</span></td>
                  <td>${r.marked_by || 'Admin'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Audit Logs Table -->
      <div class="glass-card" style="padding:20px;">
        <h4 style="font-size:15px; font-weight:800; margin-bottom:12px;">🛡️ Security Audit Logs (Manual Changes)</h4>
        <div class="table-container">
          <table class="data-table" style="font-size:12px;">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>UG ID</th>
                <th>Old Status</th>
                <th>New Status</th>
                <th>Changed By</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              ${auditLogs.map(l => `
                <tr>
                  <td>${l.created_at ? l.created_at.split('T')[0] : 'Recent'}</td>
                  <td>${l.ug_id}</td>
                  <td>${l.old_status || '-'}</td>
                  <td><strong style="color:#34d399;">${l.new_status}</strong></td>
                  <td>${l.changed_by}</td>
                  <td>${l.reason || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  exportAttendanceCSV() {
    window.App.showToast('Generating CSV file for download...', 'info');
    // Generate CSV string from records
    let csv = "Date,UG_ID,Student_Name,Batch,Subject,Status,Marked_By\n";
    document.querySelectorAll('.data-table tbody tr').forEach(r => {
      const cols = Array.from(r.querySelectorAll('td')).map(c => `"${c.innerText.replace(/"/g, '""')}"`);
      if (cols.length >= 6) csv += cols.join(',') + "\n";
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Attendance_Report_3CYBER7_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.App.showToast('Attendance report exported successfully.', 'success');
  },

  formatTimeSlot(t) {
    if (!t) return '';
    const parts = t.trim().split(':');
    let h = parseInt(parts[0], 10);
    const m = parts[1] || '00';
    let ampm = 'AM';
    if (h === 12 || (h >= 1 && h <= 7)) {
      ampm = 'PM';
    } else if (h >= 8 && h <= 11) {
      ampm = 'AM';
    }
    const hStr = h < 10 ? `0${h}` : `${h}`;
    return `${hStr}:${m} ${ampm}`;
  },

  // ==================== 7. TIMETABLE EDITOR (Requirement #20, #21, #22, #23) ====================
  selectedAdminDay: 'ALL',

  async renderTimetableEditor(container) {
    const res = await API.getAllTimetable();
    let timetable = res.success ? res.data : [];
    const days = ['ALL', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = this.selectedAdminDay || 'ALL';

    if (currentDay !== 'ALL') {
      timetable = timetable.filter(t => t.day === currentDay);
    }

    container.innerHTML = `
      <div class="glass-card" style="padding:22px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
          <div>
            <h3 style="font-size:17px; font-weight:800;">📅 Timetable Master Schedule (Division: 3CYBER7)</h3>
            <span style="font-size:12px; color:var(--text-muted);">Effective Date: 09-06-2026 • Live Sync to Student App</span>
          </div>
          <button class="btn-primary" onclick="AdminApp.openAddTimetableModal()" style="width:auto; padding:8px 16px; margin-top:0; font-size:13px;">
            + Add Timetable Slot
          </button>
        </div>

        <!-- Scrollable Day Filter Carousel for Admin -->
        <div class="day-scroll-wrapper" style="margin-bottom:16px;">
          <button class="scroll-arrow-btn" onclick="AdminApp.scrollAdminDaysCarousel(-140)" title="Scroll Left">‹</button>
          <div class="day-scroll-container" id="admin-timetable-day-pills">
            ${days.map(d => `
              <button class="day-pill-btn ${d === currentDay ? 'active' : ''}" onclick="AdminApp.filterTimetableByDay('${d}')">
                <span>${d === 'ALL' ? '🌐' : '📅'}</span>
                <span>${d}</span>
              </button>
            `).join('')}
          </div>
          <button class="scroll-arrow-btn" onclick="AdminApp.scrollAdminDaysCarousel(140)" title="Scroll Right">›</button>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Time Slot</th>
                <th>Subject</th>
                <th>Teacher</th>
                <th>Room</th>
                <th>Batch</th>
                <th>Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${timetable.length > 0 ? timetable.map(t => `
                <tr>
                  <td><strong>${t.day}</strong></td>
                  <td><span style="color:#38bdf8; font-weight:700;">${this.formatTimeSlot(t.start_time)}</span> <span style="font-size:11px; color:var(--text-muted);">– ${this.formatTimeSlot(t.end_time)}</span></td>
                  <td><strong style="color:#ffffff;">${t.subject}</strong></td>
                  <td>${t.teacher || '-'}</td>
                  <td><span style="background:var(--bg-input); padding:3px 8px; border-radius:4px; font-weight:700;">${t.room}</span></td>
                  <td><span class="batch-badge ${t.batch === 'Batch 1' ? 'batch-1' : t.batch === 'Batch 2' ? 'batch-2' : ''}">${t.batch}</span></td>
                  <td>${t.is_lab ? '<span class="lab-chip">LAB</span>' : 'Lecture'}</td>
                  <td>
                    <button class="icon-btn" onclick="AdminApp.openEditTimetableModal(${t.id}, '${t.day}', '${t.start_time}', '${t.end_time}', '${t.subject}', '${t.teacher || ''}', '${t.room}', '${t.batch}', ${t.is_lab})" title="Edit" style="width:28px; height:28px; display:inline-flex;">✎</button>
                    <button class="icon-btn" onclick="AdminApp.deleteTimetableSlot(${t.id})" title="Delete" style="width:28px; height:28px; display:inline-flex; color:#f87171;">🗑</button>
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="8" style="text-align:center; padding:24px; color:var(--text-muted);">No timetable entries found for ${currentDay}.</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.bindAdminTimetableScroll();
  },

  scrollAdminDaysCarousel(offset) {
    const el = document.getElementById('admin-timetable-day-pills');
    if (el) el.scrollBy({ left: offset, behavior: 'smooth' });
  },

  bindAdminTimetableScroll() {
    const el = document.getElementById('admin-timetable-day-pills');
    if (!el) return;
    el.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        el.scrollBy({ left: e.deltaY > 0 ? 120 : -120, behavior: 'smooth' });
      }
    }, { passive: false });
  },

  filterTimetableByDay(day) {
    this.selectedAdminDay = day;
    const container = document.getElementById('admin-app-container');
    if (container) this.renderTimetableEditor(container);
  },

  openAddTimetableModal() {
    try {
      history.pushState({ role: 'ADMIN', modal: 'timetable-modal' }, '', '#admin-timetable-add');
    } catch (e) {}

    const modalContainer = document.getElementById('admin-modal-container');
    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="timetable-modal">
        <div class="modal-card">
          <div class="modal-header">
            <h3 style="font-size:16px; font-weight:800;">Add Timetable Slot</h3>
            <button class="icon-btn" onclick="AdminApp.closeModal('timetable-modal')" style="width:30px; height:30px;">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Day</label>
              <select id="tt-day" class="form-control">
                <option value="Monday">Monday</option>
                <option value="Tuesday">Tuesday</option>
                <option value="Wednesday">Wednesday</option>
                <option value="Thursday">Thursday</option>
                <option value="Friday">Friday</option>
                <option value="Saturday">Saturday</option>
              </select>
            </div>
            <div class="modal-grid-2col">
              <div class="form-group">
                <label class="form-label">Start Time</label>
                <input type="text" id="tt-start" class="form-control" placeholder="09:30" />
              </div>
              <div class="form-group">
                <label class="form-label">End Time</label>
                <input type="text" id="tt-end" class="form-control" placeholder="10:25" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Subject</label>
              <input type="text" id="tt-subject" class="form-control" placeholder="e.g. DBMS, DSA, JAVA, NCS" />
            </div>
            <div class="modal-grid-2col">
              <div class="form-group">
                <label class="form-label">Faculty Initial / Name</label>
                <input type="text" id="tt-teacher" class="form-control" placeholder="e.g. NW, RAP, JC" />
              </div>
              <div class="form-group">
                <label class="form-label">Room Number</label>
                <input type="text" id="tt-room" class="form-control" placeholder="e.g. NB-202, L-313" />
              </div>
            </div>
            <div class="modal-grid-2col">
              <div class="form-group">
                <label class="form-label">Batch Scope</label>
                <select id="tt-batch" class="form-control">
                  <option value="Both">Both Batches</option>
                  <option value="Batch 1">Batch 1</option>
                  <option value="Batch 2">Batch 2</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Is Practical Lab?</label>
                <select id="tt-islab" class="form-control">
                  <option value="0">No (Lecture)</option>
                  <option value="1">Yes (Lab)</option>
                </select>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-primary" style="width:auto; background:var(--bg-input); border:1px solid var(--border-color); color:var(--text-secondary); margin-top:0;" onclick="AdminApp.closeModal('timetable-modal')">Cancel</button>
            <button class="btn-primary" style="width:auto; margin-top:0;" onclick="AdminApp.submitAddTimetable()">Save Slot</button>
          </div>
        </div>
      </div>
    `;
  },

  async submitAddTimetable() {
    const day = document.getElementById('tt-day').value;
    const start_time = document.getElementById('tt-start').value;
    const end_time = document.getElementById('tt-end').value;
    const subject = document.getElementById('tt-subject').value;
    const teacher = document.getElementById('tt-teacher').value;
    const room = document.getElementById('tt-room').value;
    const batch = document.getElementById('tt-batch').value;
    const is_lab = parseInt(document.getElementById('tt-islab').value, 10);

    const res = await API.createTimetableEntry({ day, start_time, end_time, subject, teacher, room, batch, is_lab });
    if (res.success) {
      window.App.showToast('Timetable slot added.', 'success');
      this.closeModal('timetable-modal');
      this.switchSection('timetable-editor');
    }
  },

  openEditTimetableModal(id, day, start, end, subject, teacher, room, batch, is_lab) {
    try {
      history.pushState({ role: 'ADMIN', modal: 'edit-tt-modal' }, '', '#admin-timetable-edit');
    } catch (e) {}

    const modalContainer = document.getElementById('admin-modal-container');
    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="edit-tt-modal">
        <div class="modal-card">
          <div class="modal-header">
            <h3 style="font-size:16px; font-weight:800;">Edit Slot: ${subject} (${day})</h3>
            <button class="icon-btn" onclick="AdminApp.closeModal('edit-tt-modal')" style="width:30px; height:30px;">✕</button>
          </div>
          <div class="modal-body">
            <div class="modal-grid-2col">
              <div class="form-group">
                <label class="form-label">Start Time</label>
                <input type="text" id="ett-start" class="form-control" value="${start}" />
              </div>
              <div class="form-group">
                <label class="form-label">End Time</label>
                <input type="text" id="ett-end" class="form-control" value="${end}" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Room Number</label>
              <input type="text" id="ett-room" class="form-control" value="${room}" />
            </div>
            <div class="form-group">
              <label class="form-label">Faculty Name / Code</label>
              <input type="text" id="ett-teacher" class="form-control" value="${teacher}" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-primary" style="width:auto; background:var(--bg-input); border:1px solid var(--border-color); color:var(--text-secondary); margin-top:0;" onclick="AdminApp.closeModal('edit-tt-modal')">Cancel</button>
            <button class="btn-primary" style="width:auto; margin-top:0;" onclick="AdminApp.submitEditTimetable(${id})">Update & Sync</button>
          </div>
        </div>
      </div>
    `;
  },

  async submitEditTimetable(id) {
    const start_time = document.getElementById('ett-start').value;
    const end_time = document.getElementById('ett-end').value;
    const room = document.getElementById('ett-room').value;
    const teacher = document.getElementById('ett-teacher').value;

    const res = await API.updateTimetableEntry(id, { start_time, end_time, room, teacher });
    if (res.success) {
      window.App.showToast(res.message, 'success');
      document.getElementById('edit-tt-modal').remove();
      this.switchSection('timetable-editor');
    }
  },

  async deleteTimetableSlot(id) {
    if (confirm('Delete this timetable slot?')) {
      await API.deleteTimetableEntry(id);
      window.App.showToast('Slot deleted.', 'info');
      this.switchSection('timetable-editor');
    }
  },

  // ==================== 8. ACADEMIC UPLOADS (NOTES, STUDY MATERIALS & QUESTION PAPERS) ====================
  academicUploadTab: 'notes',

  getFileFormatInfo(fileUrl, fileName, fileType) {
    const name = fileName || fileUrl || '';
    let ext = fileType || '';
    if (!ext && name.includes('.')) {
      ext = name.split('.').pop();
    }
    ext = (ext || 'pdf').toLowerCase().replace('.', '');
    const map = {
      pdf: { icon: '📕', label: 'PDF', class: 'pdf' },
      xlsx: { icon: '📊', label: 'EXCEL', class: 'xlsx' },
      xls: { icon: '📊', label: 'EXCEL', class: 'xls' },
      docx: { icon: '📝', label: 'WORD', class: 'docx' },
      doc: { icon: '📝', label: 'WORD', class: 'doc' },
      pptx: { icon: '📽️', label: 'PPT', class: 'pptx' },
      ppt: { icon: '📽️', label: 'PPT', class: 'ppt' },
      txt: { icon: '📄', label: 'TXT', class: 'txt' },
      csv: { icon: '📊', label: 'CSV', class: 'csv' },
      zip: { icon: '📁', label: 'ZIP', class: 'zip' },
      rar: { icon: '📁', label: 'RAR', class: 'rar' }
    };
    return map[ext] || { icon: '📄', label: ext.toUpperCase(), class: 'txt' };
  },

  async renderAcademicUploads(container) {
    const activeTab = this.academicUploadTab || 'notes';

    const [notesRes, matRes, papersRes] = await Promise.all([
      API.getClassNotes(),
      API.getStudyMaterial(),
      API.getQuestionPapers()
    ]);

    const notes = notesRes.success ? notesRes.data : [];
    const materials = matRes.success ? matRes.data : [];
    const papers = papersRes.success ? papersRes.data : [];

    container.innerHTML = `
      <div style="margin-bottom:16px; display:flex; gap:10px; flex-wrap:wrap;">
        <button class="day-pill-btn ${activeTab === 'notes' ? 'active' : ''}" onclick="AdminApp.switchAcademicUploadTab('notes')">
          <span>📚</span> Class Notes (${notes.length})
        </button>
        <button class="day-pill-btn ${activeTab === 'material' ? 'active' : ''}" onclick="AdminApp.switchAcademicUploadTab('material')">
          <span>📖</span> Study Material (${materials.length})
        </button>
        <button class="day-pill-btn ${activeTab === 'papers' ? 'active' : ''}" onclick="AdminApp.switchAcademicUploadTab('papers')">
          <span>📄</span> Question Papers (${papers.length})
        </button>
      </div>

      ${activeTab === 'notes' ? `
        <div class="admin-grid-2col">
          <!-- Upload Form -->
          <div class="glass-card" style="padding:24px;">
            <h3 style="font-size:17px; font-weight:800; margin-bottom:14px;">📤 Upload Official Class Notes</h3>
            <form id="upload-notes-form" onsubmit="event.preventDefault(); AdminApp.submitUploadNote();">
              <div class="form-group">
                <label class="form-label">Subject *</label>
                <select id="note-subject" class="form-control" required>
                  <option value="DBMS">DBMS (Database Management System)</option>
                  <option value="NCS">NCS (Network & Cyber Security)</option>
                  <option value="DSA">DSA (Data Structures & Algorithms)</option>
                  <option value="JAVA">JAVA (Object Oriented Programming)</option>
                  <option value="COMA">COMA (Computer Organization)</option>
                  <option value="DM">DM (Discrete Mathematics)</option>
                  <option value="FCS">FCS (Cyber Security Fundamentals)</option>
                </select>
              </div>
              <div class="modal-grid-2col">
                <div class="form-group">
                  <label class="form-label">Unit *</label>
                  <input type="text" id="note-unit" class="form-control" placeholder="e.g. Unit 1" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Chapter Name</label>
                  <input type="text" id="note-chapter" class="form-control" placeholder="e.g. Relational Model" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Topic / Key Concepts</label>
                <input type="text" id="note-topic" class="form-control" placeholder="e.g. ER-to-Relational Mapping" />
              </div>
              <div class="form-group">
                <label class="form-label">Note Title *</label>
                <input type="text" id="note-title" class="form-control" placeholder="e.g. ER Model Complete Notes" required />
              </div>
              <div class="form-group">
                <label class="form-label">Document File (PDF, Word, Excel, PPT, TXT) *</label>
                <input type="file" id="note-file" class="form-control" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar" style="padding:8px;" />
              </div>
              <button type="submit" class="btn-primary">Upload & Publish to Students</button>
            </form>
          </div>

          <!-- Uploaded Notes List -->
          <div class="glass-card" style="padding:22px;">
            <h3 style="font-size:17px; font-weight:800; margin-bottom:14px;">📚 Published Notes Roster</h3>
            <div style="max-height:550px; overflow-y:auto;">
              ${notes.length > 0 ? notes.map(n => {
                const fmt = AdminApp.getFileFormatInfo(n.file_url, n.file_name, n.file_type);
                const downloadUrl = API.getDownloadUrl(n.file_url, n.file_name || n.title);
                return `
                <div class="glass-card" style="padding:12px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <div style="display:flex; gap:6px; align-items:center;">
                      <span class="lab-chip">${n.subject} • ${n.unit}</span>
                      <span class="format-badge ${fmt.class}">${fmt.icon} ${fmt.label}</span>
                    </div>
                    <div style="font-weight:700; font-size:14px; margin-top:3px;">${n.title}</div>
                    <div style="font-size:11px; color:var(--text-muted);">${n.chapter || ''} • ${n.file_size || ''}</div>
                  </div>
                  <div style="display:flex; gap:6px; align-items:center;">
                    <a href="${downloadUrl}" target="_blank" download="${n.file_name || n.title}" class="icon-btn" title="Download" style="width:28px; height:28px; color:#38bdf8;">📥</a>
                    <button class="icon-btn" onclick="AdminApp.deleteNote(${n.id})" style="color:#f87171; width:28px; height:28px;" title="Delete">🗑</button>
                  </div>
                </div>
              `;
              }).join('') : `<p style="text-align:center; color:var(--text-muted); padding:20px;">No notes uploaded yet.</p>`}
            </div>
          </div>
        </div>
      ` : ''}

      ${activeTab === 'material' ? `
        <div class="admin-grid-2col">
          <!-- Upload Material Form -->
          <div class="glass-card" style="padding:24px;">
            <h3 style="font-size:17px; font-weight:800; margin-bottom:14px;">📖 Upload Study Material & Reference</h3>
            <form id="upload-material-form" onsubmit="event.preventDefault(); AdminApp.submitUploadMaterial();">
              <div class="form-group">
                <label class="form-label">Subject *</label>
                <select id="mat-subject" class="form-control" required>
                  <option value="DBMS">DBMS</option>
                  <option value="NCS">NCS</option>
                  <option value="DSA">DSA</option>
                  <option value="JAVA">JAVA</option>
                  <option value="COMA">COMA</option>
                  <option value="DM">DM</option>
                  <option value="FCS">FCS</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Category *</label>
                <select id="mat-category" class="form-control" required>
                  <option value="REFERENCE">REFERENCE (Cheat Sheet / Summary)</option>
                  <option value="MANUAL">MANUAL (Lab Experiments)</option>
                  <option value="BOOK">BOOK / TEXTBOOK</option>
                  <option value="SLIDES">SLIDES / PRESENTATION</option>
                  <option value="CODE">CODE / EXAMPLES</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Material Title *</label>
                <input type="text" id="mat-title" class="form-control" placeholder="e.g. SQL Cheat Sheet / Lab Manual" required />
              </div>
              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea id="mat-desc" class="form-control" rows="2" placeholder="Brief details about this study resource..."></textarea>
              </div>
              <div class="form-group">
                <label class="form-label">File (PDF, Excel, Word, PPT, ZIP) *</label>
                <input type="file" id="mat-file" class="form-control" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" style="padding:8px;" />
              </div>
              <button type="submit" class="btn-primary">Upload Study Material</button>
            </form>
          </div>

          <!-- Uploaded Materials List -->
          <div class="glass-card" style="padding:22px;">
            <h3 style="font-size:17px; font-weight:800; margin-bottom:14px;">📖 Published Materials Roster</h3>
            <div style="max-height:550px; overflow-y:auto;">
              ${materials.length > 0 ? materials.map(m => {
                const fmt = AdminApp.getFileFormatInfo(m.file_url, m.file_name, m.file_type);
                const downloadUrl = API.getDownloadUrl(m.file_url, m.file_name || m.title);
                return `
                <div class="glass-card" style="padding:12px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <div style="display:flex; gap:6px; align-items:center;">
                      <span class="lab-chip">${m.subject} • ${m.category}</span>
                      <span class="format-badge ${fmt.class}">${fmt.icon} ${fmt.label}</span>
                    </div>
                    <div style="font-weight:700; font-size:14px; margin-top:3px;">${m.title}</div>
                    <div style="font-size:11px; color:var(--text-muted);">${m.description || ''} • ${m.file_size || ''}</div>
                  </div>
                  <div style="display:flex; gap:6px; align-items:center;">
                    <a href="${downloadUrl}" target="_blank" download="${m.file_name || m.title}" class="icon-btn" title="Download" style="width:28px; height:28px; color:#38bdf8;">📥</a>
                    <button class="icon-btn" onclick="AdminApp.deleteMaterial(${m.id})" style="color:#f87171; width:28px; height:28px;" title="Delete">🗑</button>
                  </div>
                </div>
              `;
              }).join('') : `<p style="text-align:center; color:var(--text-muted); padding:20px;">No materials uploaded yet.</p>`}
            </div>
          </div>
        </div>
      ` : ''}

      ${activeTab === 'papers' ? `
        <div class="admin-grid-2col">
          <!-- Upload Papers Form -->
          <div class="glass-card" style="padding:24px;">
            <h3 style="font-size:17px; font-weight:800; margin-bottom:14px;">📄 Upload Previous Question Papers</h3>
            <form id="upload-paper-form" onsubmit="event.preventDefault(); AdminApp.submitUploadPaper();">
              <div class="form-group">
                <label class="form-label">Subject *</label>
                <select id="paper-subject" class="form-control" required>
                  <option value="DBMS">DBMS</option>
                  <option value="NCS">NCS</option>
                  <option value="DSA">DSA</option>
                  <option value="JAVA">JAVA</option>
                  <option value="COMA">COMA</option>
                  <option value="DM">DM</option>
                  <option value="FCS">FCS</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Exam Name *</label>
                <input type="text" id="paper-exam" class="form-control" placeholder="e.g. End-Semester Exam / Mid-Sem Paper" required />
              </div>
              <div class="modal-grid-2col">
                <div class="form-group">
                  <label class="form-label">Semester</label>
                  <input type="text" id="paper-sem" class="form-control" value="3rd Semester" />
                </div>
                <div class="form-group">
                  <label class="form-label">Academic Year</label>
                  <input type="text" id="paper-year" class="form-control" value="2026-27" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Paper File (PDF / Word) *</label>
                <input type="file" id="paper-file" class="form-control" accept=".pdf,.doc,.docx" style="padding:8px;" />
              </div>
              <button type="submit" class="btn-primary">Upload Question Paper</button>
            </form>
          </div>

          <!-- Uploaded Papers List -->
          <div class="glass-card" style="padding:22px;">
            <h3 style="font-size:17px; font-weight:800; margin-bottom:14px;">📄 Published Question Papers</h3>
            <div style="max-height:550px; overflow-y:auto;">
              ${papers.length > 0 ? papers.map(p => {
                const fmt = AdminApp.getFileFormatInfo(p.file_url, p.file_name);
                const downloadUrl = API.getDownloadUrl(p.file_url, p.file_name || `${p.subject}_${p.exam_name}.pdf`);
                return `
                <div class="glass-card" style="padding:12px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <div style="display:flex; gap:6px; align-items:center;">
                      <span class="lab-chip">${p.subject} • ${p.academic_year}</span>
                      <span class="format-badge ${fmt.class}">${fmt.icon} ${fmt.label}</span>
                    </div>
                    <div style="font-weight:700; font-size:14px; margin-top:3px;">${p.exam_name}</div>
                    <div style="font-size:11px; color:var(--text-muted);">${p.semester} • ${p.file_size || ''}</div>
                  </div>
                  <div style="display:flex; gap:6px; align-items:center;">
                    <a href="${downloadUrl}" target="_blank" download="${p.file_name || p.exam_name}" class="icon-btn" title="Download" style="width:28px; height:28px; color:#38bdf8;">📥</a>
                    <button class="icon-btn" onclick="AdminApp.deletePaper(${p.id})" style="color:#f87171; width:28px; height:28px;" title="Delete">🗑</button>
                  </div>
                </div>
              `;
              }).join('') : `<p style="text-align:center; color:var(--text-muted); padding:20px;">No question papers uploaded yet.</p>`}
            </div>
          </div>
        </div>
      ` : ''}
    `;
  },

  switchAcademicUploadTab(tab) {
    this.academicUploadTab = tab;
    const container = document.getElementById('admin-app-container');
    if (container) this.renderAcademicUploads(container);
  },

  async submitUploadNote() {
    const subject = document.getElementById('note-subject').value;
    const unit = document.getElementById('note-unit').value;
    const chapter = document.getElementById('note-chapter').value;
    const topic = document.getElementById('note-topic').value;
    const title = document.getElementById('note-title').value;
    const fileInput = document.getElementById('note-file');

    const formData = new FormData();
    formData.append('subject', subject);
    formData.append('unit', unit);
    formData.append('chapter', chapter);
    formData.append('topic', topic);
    formData.append('title', title);
    if (fileInput.files[0]) formData.append('file', fileInput.files[0]);

    window.App.showToast('Uploading notes to persistent storage...', 'info');
    const res = await API.uploadClassNote(formData);

    if (res.success) {
      window.App.showToast(res.message, 'success');
      this.switchSection('academic-uploads');
    }
  },

  async deleteNote(id) {
    if (confirm('Delete this class note?')) {
      await API.deleteClassNote(id);
      window.App.showToast('Note deleted.', 'info');
      this.switchSection('academic-uploads');
    }
  },

  async submitUploadMaterial() {
    const subject = document.getElementById('mat-subject').value;
    const category = document.getElementById('mat-category').value;
    const title = document.getElementById('mat-title').value;
    const description = document.getElementById('mat-desc').value;
    const fileInput = document.getElementById('mat-file');

    const formData = new FormData();
    formData.append('subject', subject);
    formData.append('category', category);
    formData.append('title', title);
    formData.append('description', description);
    if (fileInput.files[0]) formData.append('file', fileInput.files[0]);

    window.App.showToast('Uploading study material...', 'info');
    const res = await API.uploadStudyMaterial(formData);

    if (res.success) {
      window.App.showToast(res.message, 'success');
      this.switchSection('academic-uploads');
    }
  },

  async deleteMaterial(id) {
    if (confirm('Delete this study material?')) {
      await API.deleteStudyMaterial(id);
      window.App.showToast('Study material deleted.', 'info');
      this.switchSection('academic-uploads');
    }
  },

  async submitUploadPaper() {
    const subject = document.getElementById('paper-subject').value;
    const exam_name = document.getElementById('paper-exam').value;
    const semester = document.getElementById('paper-sem').value;
    const academic_year = document.getElementById('paper-year').value;
    const fileInput = document.getElementById('paper-file');

    const formData = new FormData();
    formData.append('subject', subject);
    formData.append('exam_name', exam_name);
    formData.append('semester', semester);
    formData.append('academic_year', academic_year);
    if (fileInput.files[0]) formData.append('file', fileInput.files[0]);

    window.App.showToast('Uploading question paper...', 'info');
    const res = await API.uploadQuestionPaper(formData);

    if (res.success) {
      window.App.showToast(res.message, 'success');
      this.switchSection('academic-uploads');
    }
  },

  async deletePaper(id) {
    if (confirm('Delete this question paper?')) {
      await API.deleteQuestionPaper(id);
      window.App.showToast('Question paper deleted.', 'info');
      this.switchSection('academic-uploads');
    }
  },

  // ==================== 9. ASSIGNMENTS MANAGEMENT ====================
  async renderAssignmentsManage(container) {
    const res = await API.getAssignments();
    const assignments = res.success ? res.data : [];

    container.innerHTML = `
      <div class="admin-grid-2col">
        <!-- Create Assignment Form -->
        <div class="glass-card" style="padding:24px;">
          <h3 style="font-size:17px; font-weight:800; margin-bottom:14px;">📝 Create New Assignment</h3>
          <form id="create-assignment-form" onsubmit="event.preventDefault(); AdminApp.submitCreateAssignment();">
            <div class="form-group">
              <label class="form-label">Subject *</label>
              <select id="assign-subject" class="form-control" required>
                <option value="DBMS">DBMS</option>
                <option value="NCS">NCS</option>
                <option value="DSA">DSA</option>
                <option value="JAVA">JAVA</option>
                <option value="COMA">COMA</option>
                <option value="DM">DM</option>
                <option value="FCS">FCS</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Assignment Title *</label>
              <input type="text" id="assign-title" class="form-control" placeholder="e.g. Assignment 1: ER Diagram & Normalization" required />
            </div>
            <div class="form-group">
              <label class="form-label">Description & Questions</label>
              <textarea id="assign-desc" class="form-control" rows="3" placeholder="Provide problem statement, guidelines, and submission instructions..."></textarea>
            </div>
            <div class="modal-grid-2col">
              <div class="form-group">
                <label class="form-label">Due Date *</label>
                <input type="date" id="assign-due" class="form-control" required />
              </div>
              <div class="form-group">
                <label class="form-label">Max Marks</label>
                <input type="number" id="assign-marks" class="form-control" value="100" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Attachment (PDF, Word, Excel, PPT, Zip)</label>
              <input type="file" id="assign-file" class="form-control" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" style="padding:8px;" />
            </div>
            <button type="submit" class="btn-primary">Publish Assignment to Students</button>
          </form>
        </div>

        <!-- Assignments List -->
        <div class="glass-card" style="padding:22px;">
          <h3 style="font-size:17px; font-weight:800; margin-bottom:14px;">Active Assignments Roster</h3>
          <div style="max-height:550px; overflow-y:auto;">
            ${assignments.length > 0 ? assignments.map(a => {
              const fmt = a.attachment_url ? AdminApp.getFileFormatInfo(a.attachment_url, a.attachment_name) : null;
              const downloadUrl = a.attachment_url ? API.getDownloadUrl(a.attachment_url, a.attachment_name || a.title) : null;
              return `
              <div class="glass-card" style="padding:14px; margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <div>
                    <div style="display:flex; gap:6px; align-items:center;">
                      <span class="lab-chip">${a.subject}</span>
                      ${fmt ? `<span class="format-badge ${fmt.class}">${fmt.icon} ${fmt.label}</span>` : ''}
                    </div>
                    <strong style="display:block; font-size:14px; margin-top:4px;">${a.title}</strong>
                    <span style="font-size:11px; color:#fbbf24;">Due: ${a.due_date} • Max: ${a.max_marks} Marks</span>
                  </div>
                  <div style="display:flex; gap:6px; align-items:center;">
                    ${downloadUrl ? `<a href="${downloadUrl}" target="_blank" download="${a.attachment_name || a.title}" class="icon-btn" title="Download Attachment" style="width:28px; height:28px; color:#38bdf8;">📥</a>` : ''}
                    <button class="icon-btn" onclick="AdminApp.deleteAssignment(${a.id})" style="color:#f87171; width:28px; height:28px;" title="Delete">🗑</button>
                  </div>
                </div>
              </div>
            `;
            }).join('') : `<p style="text-align:center; color:var(--text-muted); padding:20px;">No assignments created yet.</p>`}
          </div>
        </div>
      </div>
    `;
  },

  async submitCreateAssignment() {
    const subject = document.getElementById('assign-subject').value;
    const title = document.getElementById('assign-title').value;
    const description = document.getElementById('assign-desc').value;
    const due_date = document.getElementById('assign-due').value;
    const max_marks = document.getElementById('assign-marks').value;
    const fileInput = document.getElementById('assign-file');

    const formData = new FormData();
    formData.append('subject', subject);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('due_date', due_date);
    formData.append('max_marks', max_marks);
    if (fileInput.files[0]) formData.append('file', fileInput.files[0]);

    window.App.showToast('Publishing assignment...', 'info');
    const res = await API.createAssignment(formData);

    if (res.success) {
      window.App.showToast(res.message, 'success');
      this.switchSection('assignments-manage');
    }
  },

  async deleteAssignment(id) {
    if (confirm('Delete this assignment?')) {
      await API.deleteAssignment(id);
      window.App.showToast('Assignment deleted.', 'info');
      this.switchSection('assignments-manage');
    }
  },

  // ==================== 10. RESULTS ENTRY & EXCEL BULK IMPORT (Requirement #46) ====================
  async renderResultsManage(container) {
    const res = await API.getAllResults();
    const results = res.success ? res.data : [];

    container.innerHTML = `
      <!-- Bulk Excel Upload Card (Requirement: Auto-fetch by UG Number) -->
      <div class="glass-card" style="padding:22px; margin-bottom:24px; background:linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(6,182,212,0.08) 100%); border-color:rgba(16,185,129,0.35);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:14px;">
          <div>
            <h3 style="font-size:18px; font-weight:800; color:#ffffff; display:flex; align-items:center; gap:8px;">
              📊 Bulk Excel Sheet Import (Auto-Fetch by UG Number)
            </h3>
            <p style="font-size:12.5px; color:var(--text-secondary); margin-top:2px;">
              Upload an Excel/CSV marksheet. System automatically matches each row by <strong>UG Number</strong>, computes grades, and publishes directly to each student's portal!
            </p>
          </div>
          <a href="/api/results/template" download class="btn-secondary" style="width:auto; padding:8px 16px; font-size:12px; display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,0.08);">
            📥 Download Sample Excel Template
          </a>
        </div>

        <!-- Excel Dropzone -->
        <div class="excel-dropzone" id="excel-dropzone" onclick="document.getElementById('excel-file-input').click()">
          <input type="file" id="excel-file-input" accept=".xlsx,.xls,.csv" style="display:none;" onchange="AdminApp.handleExcelFileSelected(event)" />
          <div style="font-size:36px; margin-bottom:8px;">📁</div>
          <h4 style="font-size:15px; font-weight:700; color:#ffffff;" id="excel-drop-text">Click or Drag & Drop Excel File Here (.xlsx, .xls, .csv)</h4>
          <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">Supported headers: UG ID, Subject, Exam Name, Semester, Marks, Max Marks, Remarks</p>
        </div>

        <div id="excel-upload-status" style="margin-top:14px; display:none;"></div>

        <div style="margin-top:14px; display:flex; justify-content:flex-end; gap:10px;">
          <button class="btn-primary" id="btn-upload-excel" onclick="AdminApp.submitExcelUpload()" style="width:auto; padding:10px 24px; display:none; background:linear-gradient(135deg, #10b981 0%, #06b6d4 100%); font-weight:800;">
            ⚡ Import & Auto-Distribute Results
          </button>
        </div>
      </div>

      <div class="admin-grid-1to2col">
        <!-- Enter Marks Form (Single Entry) -->
        <div class="glass-card" style="padding:22px;">
          <h3 style="font-size:17px; font-weight:800; margin-bottom:14px;">🏆 Single Result Entry</h3>
          <form id="enter-result-form" onsubmit="event.preventDefault(); AdminApp.submitResultEntry();">
            <div class="form-group">
              <label class="form-label">Student UG ID *</label>
              <input type="text" id="res-ugid" class="form-control" placeholder="e.g. 26UG033181" required />
            </div>
            <div class="form-group">
              <label class="form-label">Exam Name *</label>
              <select id="res-exam" class="form-control" required>
                <option value="Mid-Semester Exam">Mid-Semester Exam</option>
                <option value="End-Semester Exam">End-Semester Final Exam</option>
                <option value="Unit Test 1">Unit Test 1</option>
                <option value="Practical Exam">Practical Exam</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Subject *</label>
              <select id="res-subject" class="form-control" required>
                <option value="Database Management System">DBMS</option>
                <option value="Network & Cyber Security">NCS</option>
                <option value="Data Structures & Algorithms">DSA</option>
                <option value="Java Programming">Java</option>
                <option value="Computer Organization">COMA</option>
                <option value="Discrete Mathematics">DM</option>
              </select>
            </div>
            <div class="modal-grid-2col">
              <div class="form-group">
                <label class="form-label">Marks Scored *</label>
                <input type="number" step="0.5" id="res-marks" class="form-control" placeholder="28.5" required />
              </div>
              <div class="form-group">
                <label class="form-label">Max Marks</label>
                <input type="number" id="res-max" class="form-control" value="30" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Remarks</label>
              <input type="text" id="res-remarks" class="form-control" placeholder="e.g. Excellent performance" />
            </div>
            <button type="submit" class="btn-primary">Save Result to Student Record</button>
          </form>
        </div>

        <!-- Results Roster -->
        <div class="glass-card" style="padding:22px;">
          <h3 style="font-size:17px; font-weight:800; margin-bottom:14px;">Results Marksheet Archive</h3>
          <div class="table-container" style="max-height:550px; overflow-y:auto;">
            <table class="data-table" style="font-size:12px;">
              <thead>
                <tr>
                  <th>Roll</th>
                  <th>UG ID</th>
                  <th>Student</th>
                  <th>Subject</th>
                  <th>Exam</th>
                  <th>Score</th>
                  <th>Grade</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${results.map(r => `
                  <tr>
                    <td>#${r.roll_number || '-'}</td>
                    <td><span style="font-family:monospace; color:#38bdf8;">${r.ug_id}</span></td>
                    <td>${r.student_name || r.ug_id}</td>
                    <td><strong>${r.subject}</strong></td>
                    <td>${r.exam_name}</td>
                    <td>${r.marks} / ${r.max_marks}</td>
                    <td><span class="batch-badge" style="background:rgba(16,185,129,0.2); color:#34d399;">${r.grade}</span></td>
                    <td>
                      <button class="icon-btn" onclick="AdminApp.deleteResult(${r.id})" style="width:28px; height:28px; color:#f87171; background:rgba(239,68,68,0.15);" title="Delete Result">
                        ✕
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  handleExcelFileSelected(e) {
    const file = e.target.files[0];
    if (!file) return;

    this.selectedExcelFile = file;
    const dropText = document.getElementById('excel-drop-text');
    if (dropText) {
      dropText.innerHTML = `✓ Ready: <strong>${file.name}</strong> (${(file.size / 1024).toFixed(1)} KB)`;
      dropText.style.color = '#34d399';
    }
    const btn = document.getElementById('btn-upload-excel');
    if (btn) btn.style.display = 'inline-block';
  },

  async submitExcelUpload() {
    if (!this.selectedExcelFile) {
      window.App.showToast('Please select an Excel file first.', 'error');
      return;
    }

    const btn = document.getElementById('btn-upload-excel');
    if (btn) {
      btn.disabled = true;
      btn.innerText = '⚡ Processing & Distributing...';
    }

    const formData = new FormData();
    formData.append('file', this.selectedExcelFile);

    const res = await API.uploadResultsExcel(formData);

    if (btn) {
      btn.disabled = false;
      btn.innerText = '⚡ Import & Auto-Distribute Results';
    }

    if (res.success) {
      window.App.showToast(res.message, 'success');
      const statusBox = document.getElementById('excel-upload-status');
      if (statusBox) {
        statusBox.style.display = 'block';
        statusBox.innerHTML = `
          <div style="padding:14px; background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.3); border-radius:var(--radius-md); font-size:13px; color:#34d399;">
            <strong>✓ Success:</strong> Imported ${res.importedCount} student results automatically!
            ${res.skippedCount > 0 ? `<div style="font-size:11.5px; color:#fbbf24; margin-top:4px;">⚠️ Skipped ${res.skippedCount} rows (unmatched UG IDs or invalid format).</div>` : ''}
          </div>
        `;
      }
      this.selectedExcelFile = null;
      setTimeout(() => this.switchSection('results-manage'), 1800);
    } else {
      window.App.showToast(res.message || 'Excel upload failed.', 'error');
    }
  },

  async submitResultEntry() {
    const ug_id = document.getElementById('res-ugid').value.trim();
    const exam_name = document.getElementById('res-exam').value;
    const subject = document.getElementById('res-subject').value;
    const marks = document.getElementById('res-marks').value;
    const max_marks = document.getElementById('res-max').value;
    const remarks = document.getElementById('res-remarks').value;

    const res = await API.saveResult({ ug_id, exam_name, subject, marks, max_marks, remarks });
    if (res.success) {
      window.App.showToast(res.message, 'success');
      this.switchSection('results-manage');
    } else {
      window.App.showToast(res.message || 'Failed to save result.', 'error');
    }
  },

  async deleteResult(id) {
    if (!confirm('Are you sure you want to delete this result entry?')) return;
    const res = await API.deleteResult(id);
    if (res.success) {
      window.App.showToast('Result deleted.', 'info');
      this.switchSection('results-manage');
    } else {
      window.App.showToast(res.message || 'Failed to delete result.', 'error');
    }
  },

  // ==================== 11. NOTIFICATIONS & ANNOUNCEMENTS (Requirement #44, #45) ====================
  async renderNotificationsManage(container) {
    const res = await API.getAllNotifications();
    const notifs = res.success ? res.data : [];

    container.innerHTML = `
      <div class="admin-grid-2col">
        <div class="glass-card" style="padding:24px;">
          <h3 style="font-size:17px; font-weight:800; margin-bottom:14px;">📢 Publish Live Notification</h3>
          <form id="admin-notif-form" onsubmit="event.preventDefault(); AdminApp.submitNotification();">
            <div class="form-group">
              <label class="form-label">Target Audience *</label>
              <select id="notif-target" class="form-control" onchange="AdminApp.toggleTargetInput(this.value)">
                <option value="ALL">All Students (Division 3CYBER7)</option>
                <option value="BATCH_1">Batch 1 Only (Roll 1–30)</option>
                <option value="BATCH_2">Batch 2 Only (Roll 31+)</option>
                <option value="STUDENT">Specific Student (UG ID)</option>
              </select>
            </div>
            <div class="form-group" id="notif-ugid-group" style="display:none;">
              <label class="form-label">Target Student UG ID</label>
              <input type="text" id="notif-ugid" class="form-control" placeholder="e.g. 26UG033181" />
            </div>
            <div class="form-group">
              <label class="form-label">Notice Title *</label>
              <input type="text" id="notif-title" class="form-control" placeholder="e.g. Timetable update / Extra class" required />
            </div>
            <div class="form-group">
              <label class="form-label">Message Content *</label>
              <textarea id="notif-msg" class="form-control" rows="4" placeholder="Write announcement details..." required></textarea>
            </div>
            <button type="submit" class="btn-primary">Broadcast Notification</button>
          </form>
        </div>

        <div class="glass-card" style="padding:22px;">
          <h3 style="font-size:17px; font-weight:800; margin-bottom:14px;">Recent Dispatches</h3>
          <div style="max-height:550px; overflow-y:auto;">
            ${notifs.map(n => `
              <div class="glass-card" style="padding:14px; margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <div>
                    <span class="lab-chip">${n.target_type}</span>
                    <strong style="display:block; font-size:14px; margin-top:3px;">${n.title}</strong>
                    <p style="font-size:12px; color:var(--text-secondary); margin-top:4px;">${n.message}</p>
                  </div>
                  <button class="icon-btn" onclick="AdminApp.deleteNotif(${n.id})" style="color:#f87171; width:28px; height:28px;">🗑</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  },

  toggleTargetInput(val) {
    const grp = document.getElementById('notif-ugid-group');
    if (grp) grp.style.display = val === 'STUDENT' ? 'block' : 'none';
  },

  async submitNotification() {
    const target_type = document.getElementById('notif-target').value;
    const target_ug_id = document.getElementById('notif-ugid') ? document.getElementById('notif-ugid').value : '';
    const title = document.getElementById('notif-title').value;
    const message = document.getElementById('notif-msg').value;

    const res = await API.sendNotification({ target_type, target_ug_id, title, message });
    if (res.success) {
      window.App.showToast('Notification dispatched to students.', 'success');
      this.switchSection('notifications-manage');
    }
  },

  async deleteNotif(id) {
    if (confirm('Delete notification?')) {
      await API.deleteNotification(id);
      window.App.showToast('Deleted.', 'info');
      this.switchSection('notifications-manage');
    }
  },

  // ==================== 12. ACADEMIC CALENDAR ====================
  async renderCalendarManage(container) {
    const res = await API.getCalendar();
    const events = res.success ? res.data : [];

    container.innerHTML = `
      <div class="admin-grid-2col">
        <div class="glass-card" style="padding:24px;">
          <h3 style="font-size:17px; font-weight:800; margin-bottom:14px;">📅 Add University Event / Holiday</h3>
          <form id="admin-cal-form" onsubmit="event.preventDefault(); AdminApp.submitCalendarEvent();">
            <div class="form-group">
              <label class="form-label">Event Type *</label>
              <select id="cal-type" class="form-control" required>
                <option value="HOLIDAY">Holiday</option>
                <option value="EXAM">Examination</option>
                <option value="EVENT">University Event</option>
                <option value="DEADLINE">Academic Deadline</option>
                <option value="WORKSHOP">Workshop / Seminar</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Title *</label>
              <input type="text" id="cal-title" class="form-control" placeholder="e.g. Mid-Sem Exams / Diwali Break" required />
            </div>
            <div class="modal-grid-2col">
              <div class="form-group">
                <label class="form-label">Start Date *</label>
                <input type="date" id="cal-start" class="form-control" required />
              </div>
              <div class="form-group">
                <label class="form-label">End Date</label>
                <input type="date" id="cal-end" class="form-control" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Description</label>
              <input type="text" id="cal-desc" class="form-control" placeholder="Optional event details" />
            </div>
            <button type="submit" class="btn-primary">Add Event to Calendar</button>
          </form>
        </div>

        <div class="glass-card" style="padding:22px;">
          <h3 style="font-size:17px; font-weight:800; margin-bottom:14px;">Calendar Events Roster</h3>
          <div style="max-height:550px; overflow-y:auto;">
            ${events.map(e => `
              <div class="glass-card" style="padding:14px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <span class="lab-chip">${e.event_type}</span>
                  <strong style="display:block; font-size:14px; margin-top:3px;">${e.title}</strong>
                  <div style="font-size:11px; color:var(--text-muted);">${e.start_date} ${e.end_date !== e.start_date ? 'to ' + e.end_date : ''}</div>
                </div>
                <button class="icon-btn" onclick="AdminApp.deleteCalEvent(${e.id})" style="color:#f87171; width:28px; height:28px;">🗑</button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  },

  async submitCalendarEvent() {
    const event_type = document.getElementById('cal-type').value;
    const title = document.getElementById('cal-title').value;
    const start_date = document.getElementById('cal-start').value;
    const end_date = document.getElementById('cal-end').value || start_date;
    const description = document.getElementById('cal-desc').value;

    const res = await API.addCalendarEvent({ event_type, title, start_date, end_date, description });
    if (res.success) {
      window.App.showToast('Event added to calendar.', 'success');
      this.switchSection('calendar-manage');
    }
  },

  async deleteCalEvent(id) {
    if (confirm('Delete calendar event?')) {
      await API.deleteCalendarEvent(id);
      window.App.showToast('Deleted.', 'info');
      this.switchSection('calendar-manage');
    }
  }
};

window.AdminApp = AdminApp;
