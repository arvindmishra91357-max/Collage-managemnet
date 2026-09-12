// ==========================================================================
// TEACHER WEB APP / PORTAL CONTROLLER (MGI 3CYBER7)
// ==========================================================================

const TeacherApp = {
  currentSection: 'dashboard',
  currentUser: null,
  activeQrInterval: null,
  activeQrSessionId: null,
  activeQrSecret: null,
  sectionHistory: ['dashboard'],

  async init(user, forceSection = null) {
    this.currentUser = user;
    this.sectionHistory = ['dashboard'];

    // Instantly sync latest profile from backend
    try {
      const profRes = await API.getTeacherProfile();
      if (profRes && profRes.success && profRes.data) {
        this.currentUser = { ...this.currentUser, ...profRes.data };
        API.setUser(this.currentUser);
      }
    } catch (e) {}

    let initialSection = 'dashboard';
    if (forceSection) {
      initialSection = forceSection;
    } else {
      const hash = window.location.hash.replace('#teacher-', '').replace('#', '').trim();
      const validSections = ['dashboard', 'timetable', 'attendance', 'students', 'notes', 'assignments', 'results', 'announcements', 'profile'];
      if (validSections.includes(hash)) {
        initialSection = hash;
      }
    }

    this.currentSection = initialSection;
    if (initialSection !== 'dashboard') this.sectionHistory.push(initialSection);

    try {
      history.replaceState({ role: 'TEACHER', section: initialSection }, '', '#teacher-' + initialSection);
    } catch (e) {}

    this.renderLayout();
    this.bindSidebarEvents();
    this.initRealtimeSSE();

    await this.loadSectionData(initialSection);
  },

  renderLayout() {
    const root = document.getElementById('app-root');
    const user = this.currentUser || {};
    const photoUrl = user.profile_photo_url || './favicon.svg';

    root.innerHTML = `
      <div class="admin-layout teacher-layout">
        <!-- Sidebar Navigation -->
        <aside class="admin-sidebar" id="teacher-sidebar">
          <div class="sidebar-header">
            <div class="brand-crest" style="background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2.2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            </div>
            <div>
              <h2 style="font-size:14.5px; font-weight:800; letter-spacing:0.3px;">MGI FACULTY</h2>
              <span style="font-size:11px; color:#38bdf8; font-weight:700;">Division 3CYBER7</span>
            </div>
          </div>

          <div class="sidebar-menu">
            <div class="sidebar-group-title">Overview</div>
            <button class="sidebar-item ${this.currentSection === 'dashboard' ? 'active' : ''}" data-section="dashboard">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              Dashboard
            </button>

            <div class="sidebar-group-title">Academic & Schedule</div>
            <button class="sidebar-item ${this.currentSection === 'timetable' ? 'active' : ''}" data-section="timetable">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              My Timetable
            </button>
            <button class="sidebar-item ${this.currentSection === 'attendance' ? 'active' : ''}" data-section="attendance">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="7" y="7" width="10" height="10"/></svg>
              Attendance Hub
            </button>
            <button class="sidebar-item ${this.currentSection === 'students' ? 'active' : ''}" data-section="students">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              My Students
            </button>

            <div class="sidebar-group-title">Course Work & Evaluation</div>
            <button class="sidebar-item ${this.currentSection === 'notes' ? 'active' : ''}" data-section="notes">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              Notes & Materials
            </button>
            <button class="sidebar-item ${this.currentSection === 'assignments' ? 'active' : ''}" data-section="assignments">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Assignments & Grading
            </button>
            <button class="sidebar-item ${this.currentSection === 'results' ? 'active' : ''}" data-section="results">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
              Marks / Results
            </button>

            <div class="sidebar-group-title">Communication & Account</div>
            <button class="sidebar-item ${this.currentSection === 'announcements' ? 'active' : ''}" data-section="announcements">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              Announcements
            </button>
            <button class="sidebar-item ${this.currentSection === 'profile' ? 'active' : ''}" data-section="profile">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>
              My Profile
            </button>
          </div>

          <div style="padding:14px 16px; margin-top:auto; border-top:1px solid var(--border-color); display:flex; align-items:center; gap:10px;">
            <img src="${photoUrl}" alt="Faculty" style="width:34px; height:34px; border-radius:50%; object-fit:cover; border:1px solid var(--border-color);" onerror="this.src='./favicon.svg'" />
            <div style="flex:1; min-width:0;">
              <div style="font-size:12.5px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${user.name || 'Faculty Member'}</div>
              <div style="font-size:11px; color:var(--text-muted);">${user.teacher_id || 'TEACHER'}</div>
            </div>
            <button onclick="App.logout()" title="Logout" style="background:transparent; border:none; color:#f87171; font-size:16px; cursor:pointer;">⎋</button>
          </div>
        </aside>

        <!-- Main Content Area -->
        <main class="admin-main">
          <header class="admin-topbar">
            <div style="display:flex; align-items:center; gap:12px;">
              <button class="icon-btn" id="teacher-sidebar-toggle" style="display:none; width:36px; height:36px;">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              </button>
              <div>
                <h1 class="admin-page-title" id="teacher-page-title">Dashboard Overview</h1>
                <div style="font-size:11.5px; color:var(--text-muted);">Mishra Group Institute • Faculty Portal</div>
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:10px;">
              <span class="badge" style="background:rgba(56,189,248,0.12); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); font-size:11.5px; font-weight:700; padding:4px 10px; border-radius:var(--radius-full);">
                ${user.department || 'Cyber Security'}
              </span>
              <button class="icon-btn" onclick="App.toggleTheme()" title="Toggle Theme" style="width:36px; height:36px;">
                🌓
              </button>
              <button class="btn-sec" onclick="App.logout()" style="padding:6px 14px; font-size:12px; margin:0; display:inline-flex; align-items:center; gap:6px;">
                <span>Sign Out</span>
              </button>
            </div>
          </header>

          <div class="admin-content" id="teacher-content">
            <div style="display:flex; justify-content:center; align-items:center; min-height:300px;">
              <div style="width:32px; height:32px; border:3px solid rgba(255,255,255,0.1); border-top-color:#38bdf8; border-radius:50%; animation:spin 0.8s linear infinite;"></div>
            </div>
          </div>
        </main>
      </div>

      <div class="sidebar-backdrop" id="teacher-sidebar-backdrop"></div>
    `;

    // Responsive Mobile sidebar toggle
    const toggleBtn = document.getElementById('teacher-sidebar-toggle');
    const sidebar = document.getElementById('teacher-sidebar');
    const backdrop = document.getElementById('teacher-sidebar-backdrop');

    if (window.innerWidth <= 960 && toggleBtn) {
      toggleBtn.style.display = 'inline-flex';
    }

    const toggleSidebar = () => {
      sidebar.classList.toggle('open');
      if (backdrop) backdrop.classList.toggle('show');
    };

    if (toggleBtn) toggleBtn.onclick = toggleSidebar;
    if (backdrop) backdrop.onclick = toggleSidebar;
  },

  bindSidebarEvents() {
    const items = document.querySelectorAll('#teacher-sidebar .sidebar-item');
    items.forEach(item => {
      item.onclick = async (e) => {
        e.preventDefault();
        const sec = item.dataset.section;
        if (!sec) return;

        items.forEach(i => i.classList.toggle('active', i === item));
        this.currentSection = sec;
        this.sectionHistory.push(sec);

        try {
          history.pushState({ role: 'TEACHER', section: sec }, '', '#teacher-' + sec);
        } catch (err) {}

        const titles = {
          dashboard: 'Dashboard Overview',
          timetable: 'My Teaching Schedule',
          attendance: 'Attendance Management Hub',
          students: 'Enrolled Students Roster',
          notes: 'Course Notes & Study Materials',
          assignments: 'Assignments & Submissions',
          results: 'Marks & Academic Results',
          announcements: 'Class Announcements',
          profile: 'Faculty Profile'
        };
        const titleEl = document.getElementById('teacher-page-title');
        if (titleEl) titleEl.innerText = titles[sec] || 'Faculty Portal';

        // Close sidebar on mobile
        const sidebar = document.getElementById('teacher-sidebar');
        const backdrop = document.getElementById('teacher-sidebar-backdrop');
        if (sidebar) sidebar.classList.remove('open');
        if (backdrop) backdrop.classList.remove('show');

        // Clear active QR polling if leaving attendance
        if (sec !== 'attendance' && this.activeQrInterval) {
          clearInterval(this.activeQrInterval);
          this.activeQrInterval = null;
        }

        await this.loadSectionData(sec);
      };
    });
  },

  async loadSectionData(section) {
    const container = document.getElementById('teacher-content');
    if (!container) return;

    container.innerHTML = `
      <div style="display:flex; justify-content:center; align-items:center; min-height:260px;">
        <div style="width:30px; height:30px; border:3px solid rgba(255,255,255,0.1); border-top-color:#38bdf8; border-radius:50%; animation:spin 0.8s linear infinite;"></div>
      </div>
    `;

    try {
      switch (section) {
        case 'dashboard':
          await this.renderDashboard();
          break;
        case 'timetable':
          await this.renderTimetable();
          break;
        case 'attendance':
          await this.renderAttendance();
          break;
        case 'students':
          await this.renderStudents();
          break;
        case 'notes':
          await this.renderNotes();
          break;
        case 'assignments':
          await this.renderAssignments();
          break;
        case 'results':
          await this.renderResults();
          break;
        case 'announcements':
          await this.renderAnnouncements();
          break;
        case 'profile':
          await this.renderProfile();
          break;
        default:
          await this.renderDashboard();
      }
    } catch (err) {
      console.error(`[TeacherApp] Error rendering section ${section}:`, err);
      container.innerHTML = `
        <div class="card" style="padding:24px; text-align:center;">
          <div style="font-size:32px; margin-bottom:10px;">⚠️</div>
          <h3 style="font-size:16px; font-weight:700; margin-bottom:6px;">Failed to load section</h3>
          <p style="color:var(--text-secondary); font-size:13px; margin-bottom:14px;">${err.message || 'An unexpected error occurred.'}</p>
          <button class="btn-primary" onclick="TeacherApp.loadSectionData('${section}')">Retry</button>
        </div>
      `;
    }
  },

  // ==========================================================================
  // SECTION 1: DASHBOARD
  // ==========================================================================
  async renderDashboard() {
    const container = document.getElementById('teacher-content');
    const res = await API.getTeacherDashboard();

    if (!res || !res.success || !res.data) {
      container.innerHTML = `<div class="card" style="padding:20px;">Could not load dashboard data. Please try again.</div>`;
      return;
    }

    const { teacher, today, stats, assignments, recentNotices, recentSubmissions } = res.data;

    let nextClassHtml = '';
    if (today.ongoingClass) {
      nextClassHtml = `
        <div class="card" style="background:linear-gradient(135deg, rgba(6,182,212,0.15) 0%, rgba(37,99,235,0.15) 100%); border:1px solid rgba(6,182,212,0.4); padding:20px; margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
            <span class="badge" style="background:#06b6d4; color:#0b0f19; font-weight:800; font-size:11px; padding:4px 8px; border-radius:4px;">● ONGOING CLASS NOW</span>
            <span style="font-size:12px; color:var(--text-muted);">${today.date} • ${today.day}</span>
          </div>
          <h2 style="font-size:22px; font-weight:800; color:#38bdf8; margin:0 0 6px 0;">${today.ongoingClass.subject}</h2>
          <div style="display:flex; flex-wrap:wrap; gap:16px; font-size:13px; color:var(--text-secondary); margin-top:8px;">
            <div>🕒 <strong>${today.ongoingClass.start_time} – ${today.ongoingClass.end_time}</strong></div>
            <div>📍 Room: <strong>${today.ongoingClass.room}</strong></div>
            <div>👥 Batch: <strong>${today.ongoingClass.batch}</strong></div>
          </div>
          <div style="margin-top:14px;">
            <button class="btn-primary" onclick="TeacherApp.openQuickQRModal('${today.ongoingClass.subject}', '${today.ongoingClass.batch}')" style="padding:8px 16px; font-size:12.5px; width:auto; margin:0;">
              ⚡ Launch QR Attendance for this Class
            </button>
          </div>
        </div>
      `;
    } else if (today.nextClass) {
      nextClassHtml = `
        <div class="card" style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); padding:20px; margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
            <span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; font-weight:700; font-size:11px; padding:4px 8px; border-radius:4px;">⏳ UPCOMING NEXT</span>
            <span style="font-size:12px; color:var(--text-muted);">${today.date} • ${today.day}</span>
          </div>
          <h3 style="font-size:19px; font-weight:800; margin:0 0 6px 0;">${today.nextClass.subject}</h3>
          <div style="display:flex; flex-wrap:wrap; gap:16px; font-size:13px; color:var(--text-secondary);">
            <div>🕒 Time: <strong>${today.nextClass.start_time} – ${today.nextClass.end_time}</strong></div>
            <div>📍 Room: <strong>${today.nextClass.room}</strong></div>
            <div>👥 Batch: <strong>${today.nextClass.batch}</strong></div>
          </div>
        </div>
      `;
    } else {
      nextClassHtml = `
        <div class="card" style="padding:16px 20px; margin-bottom:20px; background:rgba(255,255,255,0.02); border:1px solid var(--border-color); display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:12px;">
            <span style="font-size:24px;">🎉</span>
            <div>
              <div style="font-weight:700; font-size:14px;">No upcoming classes scheduled today</div>
              <div style="font-size:12px; color:var(--text-muted);">${today.day}, ${today.date}</div>
            </div>
          </div>
          <button class="btn-sec" onclick="TeacherApp.loadSectionData('timetable')" style="padding:6px 14px; font-size:12px; margin:0;">View Full Week</button>
        </div>
      `;
    }

    container.innerHTML = `
      <!-- Greeting Banner -->
      <div style="margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div>
          <h2 style="font-size:20px; font-weight:800; margin:0;">Welcome, ${teacher.name} 👋</h2>
          <div style="font-size:12.5px; color:var(--text-secondary); margin-top:2px;">
            ${teacher.designation} • ${teacher.department}
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-primary" onclick="TeacherApp.loadSectionData('attendance')" style="padding:8px 16px; font-size:12.5px; width:auto; margin:0; display:inline-flex; align-items:center; gap:6px;">
            <span>📷</span> <span>Start Attendance</span>
          </button>
        </div>
      </div>

      <!-- Quick Metrics Grid -->
      <div class="admin-stats-grid" style="margin-bottom:20px;">
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">Today's Classes</span>
            <span class="stat-icon">📅</span>
          </div>
          <div class="stat-value">${stats.todayClassesCount}</div>
          <div class="stat-desc">Scheduled for ${today.day}</div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">Assigned Students</span>
            <span class="stat-icon">🎓</span>
          </div>
          <div class="stat-value">${stats.totalStudents}</div>
          <div class="stat-desc">Scope: ${stats.assignedBatch}</div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">Today's Attendance</span>
            <span class="stat-icon">📊</span>
          </div>
          <div class="stat-value" style="color:#10b981;">${stats.attendanceToday.present} <span style="font-size:14px; color:var(--text-muted);">/ ${stats.attendanceToday.totalMarked || stats.totalStudents}</span></div>
          <div class="stat-desc">${stats.attendanceToday.absent} Absent marked today</div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">Assignments</span>
            <span class="stat-icon">📝</span>
          </div>
          <div class="stat-value">${stats.pendingAssignmentsCount}</div>
          <div class="stat-desc">Active course assignments</div>
        </div>
      </div>

      <!-- Next / Ongoing Class Card -->
      ${nextClassHtml}

      <!-- Two-Column Layout for Schedule and Activity -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:20px; margin-bottom:20px;">
        <!-- Today's Schedule Card -->
        <div class="card" style="padding:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <h3 style="font-size:15px; font-weight:800; margin:0; display:flex; align-items:center; gap:8px;">
              <span>🗓️</span> Today's Schedule (${today.day})
            </h3>
            <span style="font-size:12px; color:var(--text-muted); font-weight:600;">${today.classes.length} Classes</span>
          </div>

          ${today.classes.length === 0 ? `
            <div style="padding:30px 10px; text-align:center; color:var(--text-muted); font-size:13px;">
              No lectures scheduled for you today.
            </div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${today.classes.map(c => `
                <div style="padding:12px 14px; border-radius:var(--radius-sm); background:rgba(255,255,255,0.03); border:1px solid ${c.is_cancelled ? 'rgba(239,68,68,0.3)' : 'var(--border-color)'}; display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <div style="font-weight:700; font-size:14px; ${c.is_cancelled ? 'text-decoration:line-through; color:#ef4444;' : ''}">
                      ${c.subject} ${c.is_lab ? '<span class="badge" style="background:#8b5cf6; font-size:10px;">LAB</span>' : ''}
                    </div>
                    <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">
                      Room: <strong>${c.room}</strong> • Batch: ${c.batch}
                    </div>
                  </div>
                  <div style="text-align:right;">
                    <span class="badge" style="background:rgba(56,189,248,0.1); color:#38bdf8; font-size:12px; font-family:monospace; font-weight:700;">
                      ${c.start_time} - ${c.end_time}
                    </span>
                    ${c.is_cancelled ? '<div style="font-size:11px; color:#ef4444; margin-top:2px;">Cancelled</div>' : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Recent Student Submissions -->
        <div class="card" style="padding:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <h3 style="font-size:15px; font-weight:800; margin:0; display:flex; align-items:center; gap:8px;">
              <span>📥</span> Recent Assignment Submissions
            </h3>
            <button class="btn-sec" onclick="TeacherApp.loadSectionData('assignments')" style="padding:4px 10px; font-size:11px; margin:0;">View All</button>
          </div>

          ${recentSubmissions.length === 0 ? `
            <div style="padding:30px 10px; text-align:center; color:var(--text-muted); font-size:13px;">
              No recent student submissions.
            </div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${recentSubmissions.map(s => `
                <div style="padding:10px 12px; border-radius:var(--radius-sm); background:rgba(255,255,255,0.02); border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <div style="font-weight:700; font-size:13px;">${s.student_name}</div>
                    <div style="font-size:11.5px; color:var(--text-secondary);">${s.assignment_title} • <span style="color:#38bdf8;">${s.assignment_subject}</span></div>
                  </div>
                  <div style="text-align:right;">
                    <span class="badge" style="background:${s.status === 'GRADED' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'}; color:${s.status === 'GRADED' ? '#10b981' : '#f59e0b'}; font-size:11px; font-weight:700;">
                      ${s.status}
                    </span>
                    ${s.marks_obtained !== null && s.marks_obtained !== undefined ? `<div style="font-size:11px; color:#10b981; font-weight:700; margin-top:2px;">${s.marks_obtained} marks</div>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  },

  // Quick launch modal from Ongoing class
  openQuickQRModal(subject, batch) {
    this.loadSectionData('attendance');
    setTimeout(() => {
      const subInput = document.getElementById('qr-subject-select');
      const batchInput = document.getElementById('qr-batch-select');
      if (subInput) subInput.value = subject;
      if (batchInput) batchInput.value = batch;
    }, 200);
  },

  // ==========================================================================
  // SECTION 2: MY TIMETABLE
  // ==========================================================================
  async renderTimetable() {
    const container = document.getElementById('teacher-content');
    const res = await API.getTeacherTimetable();

    if (!res || !res.success || !res.data) {
      container.innerHTML = `<div class="card" style="padding:20px;">Could not load timetable.</div>`;
      return;
    }

    const { groupedByDay, teacher } = res.data;
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = getIndianDayName();

    container.innerHTML = `
      <div class="card" style="padding:20px; margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <h3 style="font-size:16px; font-weight:800; margin:0;">Official Teaching Schedule</h3>
            <p style="font-size:12px; color:var(--text-secondary); margin:2px 0 0 0;">
              Assigned Subjects: <strong>${teacher.subjects || 'All'}</strong> • Division 3CYBER7 (2026-27)
            </p>
          </div>
          <span class="badge" style="background:rgba(16,185,129,0.15); color:#10b981; font-weight:700; padding:6px 12px;">
            🔒 Official Timetable (Admin Controlled)
          </span>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:16px;">
        ${days.map(day => {
          const slots = groupedByDay[day] || [];
          const isToday = currentDay === day;
          return `
            <div class="card" style="padding:18px; border-left: 4px solid ${isToday ? '#38bdf8' : 'var(--border-color)'};">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h4 style="font-size:15px; font-weight:800; margin:0; display:flex; align-items:center; gap:8px;">
                  <span>${day}</span>
                  ${isToday ? '<span class="badge" style="background:#38bdf8; color:#0b0f19; font-size:10px; font-weight:800; padding:2px 6px;">TODAY</span>' : ''}
                </h4>
                <span style="font-size:12px; color:var(--text-muted);">${slots.length} Classes</span>
              </div>

              ${slots.length === 0 ? `
                <div style="font-size:12.5px; color:var(--text-muted); font-style:italic;">No lectures scheduled on ${day}.</div>
              ` : `
                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:12px;">
                  ${slots.map(s => `
                    <div style="padding:12px; border-radius:var(--radius-sm); background:rgba(255,255,255,0.02); border:1px solid var(--border-color);">
                      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <span style="font-weight:800; font-size:14px; color:#38bdf8;">${s.subject}</span>
                        ${s.is_lab ? '<span class="badge" style="background:#8b5cf6; color:#fff; font-size:10px;">LAB</span>' : ''}
                      </div>
                      <div style="font-size:12.5px; color:var(--text-secondary); margin:6px 0 2px 0;">
                        🕒 ${s.start_time} – ${s.end_time}
                      </div>
                      <div style="font-size:12px; color:var(--text-muted); display:flex; justify-content:space-between;">
                        <span>📍 Room: <strong>${s.room}</strong></span>
                        <span>👥 Batch: <strong>${s.batch}</strong></span>
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  // ==========================================================================
  // SECTION 3: ATTENDANCE HUB (DYNAMIC QR + MANUAL + REPORTS)
  // ==========================================================================
  async renderAttendance() {
    const container = document.getElementById('teacher-content');
    const teacher = this.currentUser || {};
    const subjects = (teacher.subjects || 'DBMS, NCS').split(',').map(s => s.trim()).filter(Boolean);
    const todayStr = getIndianDateString();

    container.innerHTML = `
      <!-- Subtabs Navigation -->
      <div style="display:flex; gap:10px; margin-bottom:20px; border-bottom:1px solid var(--border-color); padding-bottom:10px; overflow-x:auto;">
        <button class="btn-primary" id="btn-tab-qr" onclick="TeacherApp.switchAttendanceSubtab('qr')" style="padding:7px 16px; font-size:12.5px; width:auto; margin:0;">
          📷 Dynamic QR Session
        </button>
        <button class="btn-sec" id="btn-tab-manual" onclick="TeacherApp.switchAttendanceSubtab('manual')" style="padding:7px 16px; font-size:12.5px; width:auto; margin:0;">
          ✍️ Manual Roll Call
        </button>
        <button class="btn-sec" id="btn-tab-reports" onclick="TeacherApp.switchAttendanceSubtab('reports')" style="padding:7px 16px; font-size:12.5px; width:auto; margin:0;">
          📊 Attendance Reports
        </button>
      </div>

      <!-- Subtab Container -->
      <div id="attendance-subtab-content"></div>
    `;

    this.switchAttendanceSubtab('qr');
  },

  switchAttendanceSubtab(subtab) {
    const btnQr = document.getElementById('btn-tab-qr');
    const btnManual = document.getElementById('btn-tab-manual');
    const btnReports = document.getElementById('btn-tab-reports');
    const content = document.getElementById('attendance-subtab-content');

    if (btnQr) btnQr.className = subtab === 'qr' ? 'btn-primary' : 'btn-sec';
    if (btnManual) btnManual.className = subtab === 'manual' ? 'btn-primary' : 'btn-sec';
    if (btnReports) btnReports.className = subtab === 'reports' ? 'btn-primary' : 'btn-sec';

    if (!content) return;

    if (subtab === 'qr') {
      this.renderQRSubtab(content);
    } else if (subtab === 'manual') {
      this.renderManualSubtab(content);
    } else if (subtab === 'reports') {
      this.renderReportsSubtab(content);
    }
  },

  // Subtab 1: Dynamic QR Generator
  renderQRSubtab(container) {
    const teacher = this.currentUser || {};
    const subjects = (teacher.subjects || 'DBMS, NCS').split(',').map(s => s.trim()).filter(Boolean);

    container.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
        <!-- QR Launcher Form -->
        <div class="card" style="padding:24px;">
          <h3 style="font-size:16px; font-weight:800; margin:0 0 14px 0; display:flex; align-items:center; gap:8px;">
            <span>⚡</span> Start Dynamic QR Session
          </h3>
          <p style="font-size:12px; color:var(--text-secondary); margin-bottom:16px;">
            Starts a 15-second rotating cryptographic QR session with GPS geofencing. Students scan directly using their student portal camera.
          </p>

          <form id="teacher-start-qr-form" onsubmit="event.preventDefault(); TeacherApp.handleStartQRSession();">
            <div class="form-group">
              <label class="form-label">Subject *</label>
              <select id="qr-subject-select" class="form-control" required>
                ${subjects.map(s => `<option value="${s}">${s}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Target Batch *</label>
              <select id="qr-batch-select" class="form-control" required>
                ${teacher.batch === 'Batch 1' ? '<option value="Batch 1">Batch 1 Only (Roll 1–30)</option>' : ''}
                ${teacher.batch === 'Batch 2' ? '<option value="Batch 2">Batch 2 Only (Roll 31+)</option>' : ''}
                ${(!teacher.batch || teacher.batch === 'Both') ? `
                  <option value="Both">Both Batches (All 66 Students)</option>
                  <option value="Batch 1">Batch 1 Only (Roll 1–30)</option>
                  <option value="Batch 2">Batch 2 Only (Roll 31+)</option>
                ` : ''}
              </select>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="form-group">
                <label class="form-label">Duration (Minutes)</label>
                <input type="number" id="qr-duration" class="form-control" value="45" min="5" max="180" required />
              </div>
              <div class="form-group">
                <label class="form-label">QR Rotation (Seconds)</label>
                <input type="number" id="qr-interval" class="form-control" value="15" min="10" max="60" required />
              </div>
            </div>

            <button type="submit" id="btn-start-qr" class="btn-primary" style="margin-top:10px; height:44px; font-weight:800;">
              Launch Live Dynamic QR
            </button>
          </form>
        </div>

        <!-- Live QR Code Display Card -->
        <div class="card" id="teacher-live-qr-box" style="padding:24px; text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:360px;">
          <div style="font-size:44px; margin-bottom:10px;">📷</div>
          <h4 style="font-size:16px; font-weight:700; margin:0 0 6px 0;">No Active QR Session</h4>
          <p style="font-size:12.5px; color:var(--text-secondary); max-width:280px; margin:0;">
            Select your assigned subject and batch on the left, then click <strong>Launch Live Dynamic QR</strong>.
          </p>
        </div>
      </div>

      <!-- Live Scans Counter & Table -->
      <div class="card" id="teacher-live-scans-panel" style="padding:20px; margin-top:20px; display:none;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
          <h3 style="font-size:15px; font-weight:800; margin:0;">Live Scanned Students</h3>
          <div style="display:flex; gap:10px; align-items:center;">
            <span class="badge" style="background:#10b981; color:#fff; font-size:12px; font-weight:800;" id="live-scan-count">0 Scanned</span>
            <button class="btn-sec" onclick="TeacherApp.refreshLiveScans()" style="padding:4px 10px; font-size:11.5px; margin:0;">↻ Refresh</button>
          </div>
        </div>
        <div id="live-scans-table-box" style="overflow-x:auto;"></div>
      </div>
    `;
  },

  async handleStartQRSession() {
    const subject = document.getElementById('qr-subject-select').value;
    const batch = document.getElementById('qr-batch-select').value;
    const duration = document.getElementById('qr-duration').value;
    const interval = document.getElementById('qr-interval').value;
    const btn = document.getElementById('btn-start-qr');

    if (!subject) return;

    if (btn) {
      btn.disabled = true;
      btn.innerText = 'Initializing Secure QR...';
    }

    const res = await API.startTeacherQRSession({
      subject,
      batch,
      duration_minutes: duration,
      qr_refresh_interval: interval
    });

    if (btn) {
      btn.disabled = false;
      btn.innerText = 'Launch Live Dynamic QR';
    }

    if (res && res.success && res.session) {
      App.showToast(`Dynamic QR session launched for ${subject}!`, 'success');
      this.displayActiveQR(res.session);
    } else {
      App.showToast(res.message || 'Failed to start QR session.', 'error');
    }
  },

  displayActiveQR(session) {
    this.activeQrSessionId = session.id;
    const qrBox = document.getElementById('teacher-live-qr-box');
    const scansPanel = document.getElementById('teacher-live-scans-panel');

    if (scansPanel) scansPanel.style.display = 'block';

    if (qrBox) {
      qrBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center; margin-bottom:12px;">
          <span class="badge" style="background:#10b981; color:#0b0f19; font-weight:800; font-size:11px;">● ACTIVE LIVE QR</span>
          <button class="btn-sec" onclick="TeacherApp.stopActiveQRSession(${session.id})" style="color:#ef4444; border-color:rgba(239,68,68,0.4); padding:4px 10px; font-size:11px; margin:0;">
            ⏹ Stop Session
          </button>
        </div>

        <h3 style="font-size:18px; font-weight:800; margin:0 0 2px 0;">${session.subject}</h3>
        <div style="font-size:12px; color:var(--text-muted); margin-bottom:14px;">Scope: ${session.batch} • Refresh: Every ${session.qr_refresh_interval || 15}s</div>

        <div style="background:#ffffff; padding:16px; border-radius:12px; display:inline-block; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
          <img id="active-qr-img" src="${session.initial_qr_image}" alt="Attendance QR Code" style="width:230px; height:230px; display:block;" />
        </div>

        <div style="margin-top:14px; font-size:12px; color:var(--text-secondary); display:flex; align-items:center; gap:8px;">
          <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10b981; animation:pulse 1s infinite;"></span>
          Auto-refreshing dynamic token to prevent proxies
        </div>
      `;
    }

    // Start auto polling for scans & token refresh
    if (this.activeQrInterval) clearInterval(this.activeQrInterval);
    this.refreshLiveScans();

    this.activeQrInterval = setInterval(async () => {
      // Refresh token
      try {
        const liveTokRes = await fetch(`${API.baseUrl}/api/attendance/session/${session.id}/live-token`);
        const tokData = await liveTokRes.json();
        if (tokData && tokData.success && tokData.token) {
          const qrImg = document.getElementById('active-qr-img');
          if (qrImg && typeof QRCode !== 'undefined') {
            const dataUrl = await QRCode.toDataURL(tokData.token, { width: 320, margin: 1 });
            qrImg.src = dataUrl;
          }
        }
      } catch (e) {}

      // Refresh scans
      this.refreshLiveScans();
    }, 6000);
  },

  async refreshLiveScans() {
    if (!this.activeQrSessionId) return;
    const res = await API.getTeacherLiveSessionScans(this.activeQrSessionId);
    if (!res || !res.success) return;

    const countEl = document.getElementById('live-scan-count');
    if (countEl) countEl.innerText = `${res.stats.presentCount} / ${res.stats.totalEnrolled} Scanned (${res.stats.percentage}%)`;

    const tableBox = document.getElementById('live-scans-table-box');
    if (!tableBox) return;

    tableBox.innerHTML = `
      <table class="table" style="font-size:12.5px; width:100%;">
        <thead>
          <tr>
            <th>Roll No</th>
            <th>UG ID</th>
            <th>Student Name</th>
            <th>Scan Time</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${res.scans.length === 0 ? `
            <tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:20px;">No students have scanned yet.</td></tr>
          ` : res.scans.map(s => `
            <tr>
              <td><strong>#${s.roll_number}</strong></td>
              <td><code>${s.ug_id}</code></td>
              <td><strong>${s.student_name}</strong></td>
              <td style="color:var(--text-muted);">${new Date(s.marked_at).toLocaleTimeString()}</td>
              <td><span class="badge" style="background:#10b981; color:#fff; font-size:11px;">PRESENT</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  async stopActiveQRSession(id) {
    if (!confirm('Are you sure you want to stop this QR attendance session?')) return;
    if (this.activeQrInterval) {
      clearInterval(this.activeQrInterval);
      this.activeQrInterval = null;
    }
    const res = await API.stopTeacherQRSession(id);
    if (res && res.success) {
      App.showToast('Attendance session stopped.', 'info');
      this.switchAttendanceSubtab('qr');
    } else {
      App.showToast('Failed to stop session.', 'error');
    }
  },

  // Subtab 2: Manual Roll Call
  async renderManualSubtab(container) {
    const teacher = this.currentUser || {};
    const subjects = (teacher.subjects || 'DBMS, NCS').split(',').map(s => s.trim()).filter(Boolean);
    const todayStr = getIndianDateString();

    container.innerHTML = `
      <div class="card" style="padding:20px; margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
          <h3 style="font-size:16px; font-weight:800; margin:0;">✍️ Manual Attendance Register</h3>
          <div style="display:flex; gap:8px;">
            <button class="btn-sec" onclick="TeacherApp.markAllManualStatus('PRESENT')" style="padding:6px 12px; font-size:12px; margin:0; color:#10b981;">
              ✓ Mark All Present
            </button>
            <button class="btn-sec" onclick="TeacherApp.markAllManualStatus('ABSENT')" style="padding:6px 12px; font-size:12px; margin:0; color:#ef4444;">
              ✕ Mark All Absent
            </button>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-bottom:16px;">
          <div>
            <label class="form-label" style="font-size:12px;">Subject</label>
            <select id="manual-subject-select" class="form-control" onchange="TeacherApp.loadManualRoster()">
              ${subjects.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label" style="font-size:12px;">Batch</label>
            <select id="manual-batch-select" class="form-control" onchange="TeacherApp.loadManualRoster()">
              ${teacher.batch === 'Batch 1' ? '<option value="Batch 1">Batch 1 Only (1-30)</option>' : ''}
              ${teacher.batch === 'Batch 2' ? '<option value="Batch 2">Batch 2 Only (31+)</option>' : ''}
              ${(!teacher.batch || teacher.batch === 'Both') ? `
                <option value="Both">Both Batches (All 66)</option>
                <option value="Batch 1">Batch 1 (Roll 1-30)</option>
                <option value="Batch 2">Batch 2 (Roll 31+)</option>
              ` : ''}
            </select>
          </div>
          <div>
            <label class="form-label" style="font-size:12px;">Date</label>
            <input type="date" id="manual-date-input" class="form-control" value="${todayStr}" onchange="TeacherApp.loadManualRoster()" />
          </div>
        </div>

        <div id="manual-roster-box" style="overflow-x:auto;">
          <div style="text-align:center; padding:20px; color:var(--text-muted);">Loading students roster...</div>
        </div>

        <div style="display:flex; justify-content:flex-end; margin-top:16px;">
          <button class="btn-primary" id="btn-save-manual" onclick="TeacherApp.saveManualRoster()" style="padding:10px 24px; font-size:13px; width:auto; margin:0; font-weight:800;">
            💾 Save Attendance Register
          </button>
        </div>
      </div>
    `;

    await this.loadManualRoster();
  },

  async loadManualRoster() {
    const rosterBox = document.getElementById('manual-roster-box');
    if (!rosterBox) return;

    const batch = document.getElementById('manual-batch-select').value;
    const subject = document.getElementById('manual-subject-select').value;
    const date = document.getElementById('manual-date-input').value;

    rosterBox.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted);">Loading roster...</div>`;

    const res = await API.getTeacherStudents('', batch);
    if (!res || !res.success || !res.data) {
      rosterBox.innerHTML = `<div style="padding:20px; text-align:center; color:#ef4444;">Failed to load roster.</div>`;
      return;
    }

    const students = res.data;

    // Check existing marks for this date and subject
    const repRes = await API.getTeacherAttendanceReports(subject, date, batch);
    const existingRecords = (repRes && repRes.success && repRes.data) ? repRes.data : [];
    const statusMap = {};
    existingRecords.forEach(r => {
      statusMap[r.ug_id.toUpperCase()] = r.status;
    });

    rosterBox.innerHTML = `
      <table class="table" style="font-size:12.5px; width:100%;">
        <thead>
          <tr>
            <th style="width:60px;">Roll</th>
            <th>UG ID</th>
            <th>Student Name</th>
            <th style="width:90px;">Batch</th>
            <th style="width:200px; text-align:center;">Attendance Status</th>
          </tr>
        </thead>
        <tbody>
          ${students.map(s => {
            const currentStatus = statusMap[s.ug_id.toUpperCase()] || 'PRESENT';
            return `
              <tr data-ug="${s.ug_id}" data-name="${s.name}" data-roll="${s.roll_number}" data-batch="${s.batch}">
                <td><strong>#${s.roll_number}</strong></td>
                <td><code>${s.ug_id}</code></td>
                <td><strong>${s.name}</strong></td>
                <td><span class="badge" style="background:rgba(255,255,255,0.06); font-size:11px;">${s.batch}</span></td>
                <td style="text-align:center;">
                  <div style="display:inline-flex; gap:6px;">
                    <button type="button" class="btn-status-pill ${currentStatus === 'PRESENT' ? 'active-present' : ''}" onclick="TeacherApp.setStatusPill(this, 'PRESENT')">P</button>
                    <button type="button" class="btn-status-pill ${currentStatus === 'ABSENT' ? 'active-absent' : ''}" onclick="TeacherApp.setStatusPill(this, 'ABSENT')">A</button>
                    <button type="button" class="btn-status-pill ${currentStatus === 'LEAVE' ? 'active-leave' : ''}" onclick="TeacherApp.setStatusPill(this, 'LEAVE')">L</button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <style>
        .btn-status-pill {
          width: 32px;
          height: 30px;
          border-radius: 6px;
          border: 1px solid var(--border-color);
          background: rgba(255,255,255,0.04);
          color: var(--text-muted);
          font-weight: 800;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-status-pill.active-present {
          background: #10b981 !important;
          color: #ffffff !important;
          border-color: #10b981 !important;
        }
        .btn-status-pill.active-absent {
          background: #ef4444 !important;
          color: #ffffff !important;
          border-color: #ef4444 !important;
        }
        .btn-status-pill.active-leave {
          background: #f59e0b !important;
          color: #ffffff !important;
          border-color: #f59e0b !important;
        }
      </style>
    `;
  },

  setStatusPill(btn, status) {
    const parent = btn.parentElement;
    parent.querySelectorAll('.btn-status-pill').forEach(b => {
      b.classList.remove('active-present', 'active-absent', 'active-leave');
    });
    if (status === 'PRESENT') btn.classList.add('active-present');
    if (status === 'ABSENT') btn.classList.add('active-absent');
    if (status === 'LEAVE') btn.classList.add('active-leave');
  },

  markAllManualStatus(status) {
    const rows = document.querySelectorAll('#manual-roster-box tbody tr');
    rows.forEach(r => {
      const pills = r.querySelectorAll('.btn-status-pill');
      pills.forEach(p => p.classList.remove('active-present', 'active-absent', 'active-leave'));
      if (status === 'PRESENT' && pills[0]) pills[0].classList.add('active-present');
      if (status === 'ABSENT' && pills[1]) pills[1].classList.add('active-absent');
      if (status === 'LEAVE' && pills[2]) pills[2].classList.add('active-leave');
    });
  },

  async saveManualRoster() {
    const subject = document.getElementById('manual-subject-select').value;
    const batch = document.getElementById('manual-batch-select').value;
    const date = document.getElementById('manual-date-input').value;
    const saveBtn = document.getElementById('btn-save-manual');

    const rows = document.querySelectorAll('#manual-roster-box tbody tr');
    const records = [];

    rows.forEach(r => {
      const ug_id = r.dataset.ug;
      const name = r.dataset.name;
      let status = 'PRESENT';
      if (r.querySelector('.active-absent')) status = 'ABSENT';
      if (r.querySelector('.active-leave')) status = 'LEAVE';

      records.push({ ug_id, name, status });
    });

    if (records.length === 0) {
      App.showToast('No students to save.', 'warning');
      return;
    }

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerText = 'Saving Register...';
    }

    const res = await API.saveTeacherManualAttendance({
      subject,
      batch,
      date,
      records
    });

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerText = '💾 Save Attendance Register';
    }

    if (res && res.success) {
      App.showToast(res.message || 'Attendance saved successfully.', 'success');
    } else {
      App.showToast(res.message || 'Failed to save attendance.', 'error');
    }
  },

  // Subtab 3: Attendance Reports
  async renderReportsSubtab(container) {
    const teacher = this.currentUser || {};
    const subjects = (teacher.subjects || 'DBMS, NCS').split(',').map(s => s.trim()).filter(Boolean);
    const todayStr = getIndianDateString();

    container.innerHTML = `
      <div class="card" style="padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
          <div>
            <h3 style="font-size:16px; font-weight:800; margin:0;">📊 Attendance Reports & Export</h3>
            <p style="font-size:12px; color:var(--text-secondary); margin:2px 0 0 0;">View verified attendance records for your assigned subjects.</p>
          </div>
          <button class="btn-sec" onclick="TeacherApp.exportAttendanceCSV()" style="padding:6px 14px; font-size:12px; margin:0; display:inline-flex; align-items:center; gap:6px;">
            <span>📥</span> <span>Export CSV</span>
          </button>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-bottom:16px;">
          <div>
            <label class="form-label" style="font-size:12px;">Subject</label>
            <select id="report-subject-select" class="form-control" onchange="TeacherApp.fetchReports()">
              <option value="ALL">All Assigned Subjects</option>
              ${subjects.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label" style="font-size:12px;">Filter Date</label>
            <input type="date" id="report-date-select" class="form-control" value="${todayStr}" onchange="TeacherApp.fetchReports()" />
          </div>
          <div>
            <label class="form-label" style="font-size:12px;">Batch</label>
            <select id="report-batch-select" class="form-control" onchange="TeacherApp.fetchReports()">
              <option value="ALL">All Batches</option>
              <option value="Batch 1">Batch 1</option>
              <option value="Batch 2">Batch 2</option>
            </select>
          </div>
        </div>

        <div id="reports-output-box"></div>
      </div>
    `;

    await this.fetchReports();
  },

  async fetchReports() {
    const box = document.getElementById('reports-output-box');
    if (!box) return;

    const subject = document.getElementById('report-subject-select').value;
    const date = document.getElementById('report-date-select').value;
    const batch = document.getElementById('report-batch-select').value;

    box.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted);">Loading reports...</div>`;

    const res = await API.getTeacherAttendanceReports(subject === 'ALL' ? '' : subject, date, batch === 'ALL' ? '' : batch);
    if (!res || !res.success) {
      box.innerHTML = `<div style="padding:20px; color:#ef4444; text-align:center;">Failed to load reports.</div>`;
      return;
    }

    const { stats, data } = res;

    box.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:12px; margin-bottom:16px;">
        <div style="padding:12px; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:8px; text-align:center;">
          <div style="font-size:11px; color:var(--text-muted);">TOTAL MARKED</div>
          <div style="font-size:18px; font-weight:800;">${stats.totalRecords}</div>
        </div>
        <div style="padding:12px; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.25); border-radius:8px; text-align:center;">
          <div style="font-size:11px; color:#10b981; font-weight:700;">PRESENT</div>
          <div style="font-size:18px; font-weight:800; color:#10b981;">${stats.present}</div>
        </div>
        <div style="padding:12px; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25); border-radius:8px; text-align:center;">
          <div style="font-size:11px; color:#ef4444; font-weight:700;">ABSENT</div>
          <div style="font-size:18px; font-weight:800; color:#ef4444;">${stats.absent}</div>
        </div>
        <div style="padding:12px; background:rgba(56,189,248,0.08); border:1px solid rgba(56,189,248,0.25); border-radius:8px; text-align:center;">
          <div style="font-size:11px; color:#38bdf8; font-weight:700;">PERCENTAGE</div>
          <div style="font-size:18px; font-weight:800; color:#38bdf8;">${stats.percentage}%</div>
        </div>
      </div>

      <div style="overflow-x:auto;">
        <table class="table" style="font-size:12.5px; width:100%;">
          <thead>
            <tr>
              <th>Date</th>
              <th>UG ID</th>
              <th>Student Name</th>
              <th>Subject</th>
              <th>Batch</th>
              <th>Status</th>
              <th>Marked By</th>
            </tr>
          </thead>
          <tbody>
            ${data.length === 0 ? `
              <tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:20px;">No records found for the selected criteria.</td></tr>
            ` : data.map(r => `
              <tr>
                <td>${r.date}</td>
                <td><code>${r.ug_id}</code></td>
                <td><strong>${r.student_name}</strong></td>
                <td><span style="color:#38bdf8;">${r.subject}</span></td>
                <td><span class="badge" style="background:rgba(255,255,255,0.06); font-size:10.5px;">${r.batch}</span></td>
                <td>
                  <span class="badge" style="background:${r.status === 'PRESENT' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color:${r.status === 'PRESENT' ? '#10b981' : '#ef4444'}; font-weight:800; font-size:11px;">
                    ${r.status}
                  </span>
                </td>
                <td style="color:var(--text-muted); font-size:11.5px;">${r.marked_by || 'Faculty'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  exportAttendanceCSV() {
    const table = document.querySelector('#reports-output-box table');
    if (!table) return;

    let csv = [];
    const rows = table.querySelectorAll('tr');
    rows.forEach(r => {
      const cols = r.querySelectorAll('th, td');
      const rowData = [];
      cols.forEach(c => rowData.push(`"${c.innerText.replace(/"/g, '""').trim()}"`));
      csv.push(rowData.join(','));
    });

    const csvContent = "data:text/csv;charset=utf-8," + csv.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendance_report_${getIndianDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  // ==========================================================================
  // SECTION 4: MY STUDENTS
  // ==========================================================================
  async renderStudents() {
    const container = document.getElementById('teacher-content');
    const teacher = this.currentUser || {};

    container.innerHTML = `
      <div class="card" style="padding:20px; margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <h3 style="font-size:16px; font-weight:800; margin:0;">Enrolled Students</h3>
            <p style="font-size:12px; color:var(--text-secondary); margin:2px 0 0 0;">
              Scope: <strong>${teacher.batch || 'Both Batches'}</strong> • Division 3CYBER7
            </p>
          </div>
          <div style="display:flex; gap:8px;">
            <input type="text" id="student-search-input" class="form-control" placeholder="Search by name, roll, or UG..." style="width:240px; font-size:12.5px;" oninput="TeacherApp.filterStudentsList()" />
          </div>
        </div>
      </div>

      <div class="card" style="padding:0; overflow:hidden;">
        <div id="teacher-students-table-box" style="overflow-x:auto;">
          <div style="text-align:center; padding:30px; color:var(--text-muted);">Loading students...</div>
        </div>
      </div>

      <!-- Student Profile Modal Container -->
      <div id="student-profile-modal-container"></div>
    `;

    await this.filterStudentsList();
  },

  async filterStudentsList() {
    const searchInput = document.getElementById('student-search-input');
    const query = searchInput ? searchInput.value.trim() : '';
    const tableBox = document.getElementById('teacher-students-table-box');
    if (!tableBox) return;

    const res = await API.getTeacherStudents(query);
    if (!res || !res.success || !res.data) {
      tableBox.innerHTML = `<div style="padding:20px; color:#ef4444; text-align:center;">Failed to load students.</div>`;
      return;
    }

    const students = res.data;

    tableBox.innerHTML = `
      <table class="table" style="font-size:13px; width:100%;">
        <thead>
          <tr>
            <th style="width:70px;">Roll</th>
            <th>UG ID</th>
            <th>Student Name</th>
            <th>Batch</th>
            <th>Attendance %</th>
            <th>Status</th>
            <th style="text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${students.length === 0 ? `
            <tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:30px;">No matching students found.</td></tr>
          ` : students.map(s => `
            <tr>
              <td><strong>#${s.roll_number}</strong></td>
              <td><code>${s.ug_id}</code></td>
              <td>
                <div style="display:flex; align-items:center; gap:8px;">
                  <img src="${s.profile_photo_url || './favicon.svg'}" alt="" style="width:26px; height:26px; border-radius:50%; object-fit:cover;" onerror="this.src='./favicon.svg'" />
                  <strong>${s.name}</strong>
                </div>
              </td>
              <td><span class="badge" style="background:rgba(255,255,255,0.06); font-size:11px;">${s.batch}</span></td>
              <td>
                <span class="badge" style="background:${s.attendance_percentage >= 75 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color:${s.attendance_percentage >= 75 ? '#10b981' : '#ef4444'}; font-weight:800; font-size:11.5px;">
                  ${s.attendance_percentage}%
                </span>
              </td>
              <td>
                <span class="badge" style="background:rgba(16,185,129,0.1); color:#10b981; font-size:11px;">${s.status}</span>
              </td>
              <td style="text-align:right;">
                <button class="btn-sec" onclick="TeacherApp.openStudentProfileModal('${s.ug_id}')" style="padding:4px 10px; font-size:11.5px; margin:0;">
                  View Profile
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  async openStudentProfileModal(ug_id) {
    const modalContainer = document.getElementById('student-profile-modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="teacher-student-modal" onclick="if(event.target===this) this.remove();">
        <div class="modal-card" style="max-width:600px; padding:24px;" onclick="event.stopPropagation()">
          <div style="text-align:center; padding:30px;"><div style="width:30px; height:30px; border:3px solid rgba(255,255,255,0.1); border-top-color:#38bdf8; border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto;"></div></div>
        </div>
      </div>
    `;

    const res = await API.getTeacherStudentProfile(ug_id);
    const modal = document.getElementById('teacher-student-modal');
    if (!modal) return;

    if (!res || !res.success || !res.data) {
      modal.innerHTML = `
        <div class="modal-card" style="max-width:400px; padding:24px; text-align:center;">
          <h3>Error loading profile</h3>
          <p style="color:var(--text-muted); font-size:13px;">${res.message || 'Could not load student profile.'}</p>
          <button class="btn-sec" onclick="document.getElementById('teacher-student-modal').remove()">Close</button>
        </div>
      `;
      return;
    }

    const { student, attendanceHistory, submissions, results } = res.data;

    modal.innerHTML = `
      <div class="modal-card" style="max-width:640px; padding:24px; max-height:85vh; overflow-y:auto;" onclick="event.stopPropagation()">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
          <div style="display:flex; align-items:center; gap:14px;">
            <img src="${student.profile_photo_url || './favicon.svg'}" alt="" style="width:52px; height:52px; border-radius:50%; object-fit:cover; border:2px solid #38bdf8;" onerror="this.src='./favicon.svg'" />
            <div>
              <h3 style="font-size:17px; font-weight:800; margin:0;">${student.name}</h3>
              <div style="font-size:12.5px; color:var(--text-secondary); margin-top:2px;">
                Roll #${student.roll_number} • <code>${student.ug_id}</code> • ${student.batch}
              </div>
            </div>
          </div>
          <button class="icon-btn" onclick="document.getElementById('teacher-student-modal').remove()" style="width:28px; height:28px;">✕</button>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:12.5px; margin-bottom:18px; padding:12px; background:rgba(255,255,255,0.02); border-radius:8px; border:1px solid var(--border-color);">
          <div>Division: <strong>${student.division}</strong></div>
          <div>Program: <strong>${student.program}</strong></div>
          <div>Phone: <strong>${student.phone_number || 'Not registered'}</strong></div>
          <div>Status: <strong style="color:#10b981;">${student.status}</strong></div>
        </div>

        <!-- Attendance Records in Teacher's Subjects -->
        <h4 style="font-size:14px; font-weight:800; margin:16px 0 8px 0;">Attendance in Your Subjects</h4>
        <div style="max-height:160px; overflow-y:auto; border:1px solid var(--border-color); border-radius:6px; margin-bottom:16px;">
          <table class="table" style="font-size:12px; width:100%; margin:0;">
            <thead><tr><th>Date</th><th>Subject</th><th>Status</th><th>Remarks</th></tr></thead>
            <tbody>
              ${attendanceHistory.length === 0 ? `
                <tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:12px;">No recorded attendance in your subjects.</td></tr>
              ` : attendanceHistory.map(a => `
                <tr>
                  <td>${a.date}</td>
                  <td>${a.subject}</td>
                  <td><span class="badge" style="background:${a.status === 'PRESENT' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color:${a.status === 'PRESENT' ? '#10b981' : '#ef4444'}; font-size:10.5px;">${a.status}</span></td>
                  <td style="color:var(--text-muted);">${a.remarks || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Submissions in Teacher's Subjects -->
        <h4 style="font-size:14px; font-weight:800; margin:16px 0 8px 0;">Assignment Submissions</h4>
        <div style="max-height:160px; overflow-y:auto; border:1px solid var(--border-color); border-radius:6px; margin-bottom:16px;">
          <table class="table" style="font-size:12px; width:100%; margin:0;">
            <thead><tr><th>Assignment</th><th>Subject</th><th>Marks</th><th>Status</th></tr></thead>
            <tbody>
              ${submissions.length === 0 ? `
                <tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:12px;">No submissions submitted yet.</td></tr>
              ` : submissions.map(sub => `
                <tr>
                  <td><strong>${sub.assignment_title}</strong></td>
                  <td>${sub.assignment_subject}</td>
                  <td><strong>${sub.marks_obtained !== null ? sub.marks_obtained : '-'}</strong> / ${sub.max_marks}</td>
                  <td><span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; font-size:10.5px;">${sub.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div style="display:flex; justify-content:flex-end;">
          <button class="btn-sec" onclick="document.getElementById('teacher-student-modal').remove()">Close Profile</button>
        </div>
      </div>
    `;
  },

  // ==========================================================================
  // SECTION 5: NOTES & STUDY MATERIALS
  // ==========================================================================
  async renderNotes() {
    const container = document.getElementById('teacher-content');
    const teacher = this.currentUser || {};
    const subjects = (teacher.subjects || 'DBMS, NCS').split(',').map(s => s.trim()).filter(Boolean);

    container.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
        <!-- Upload Form Card -->
        <div class="card" style="padding:22px;">
          <h3 style="font-size:16px; font-weight:800; margin:0 0 14px 0; display:flex; align-items:center; gap:8px;">
            <span>📤</span> Upload Class Notes / Material
          </h3>

          <form id="teacher-upload-note-form" onsubmit="event.preventDefault(); TeacherApp.handleUploadNote();">
            <div class="form-group">
              <label class="form-label">Subject *</label>
              <select id="note-subject" class="form-control" required>
                ${subjects.map(s => `<option value="${s}">${s}</option>`).join('')}
              </select>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="form-group">
                <label class="form-label">Unit *</label>
                <input type="text" id="note-unit" class="form-control" placeholder="e.g. Unit 1" required />
              </div>
              <div class="form-group">
                <label class="form-label">Chapter</label>
                <input type="text" id="note-chapter" class="form-control" placeholder="e.g. ER Modeling" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Title *</label>
              <input type="text" id="note-title" class="form-control" placeholder="e.g. Complete Relational Algebra Notes" required />
            </div>

            <div class="form-group">
              <label class="form-label">Description / Instructions</label>
              <textarea id="note-description" class="form-control" rows="2" placeholder="Summary of notes or topics covered..."></textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Attachment File (PDF, DOCX, PPTX) *</label>
              <input type="file" id="note-file" class="form-control" accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,.png,.jpg" required />
            </div>

            <button type="submit" id="btn-upload-note" class="btn-primary" style="margin-top:10px; height:44px; font-weight:800;">
              Upload & Publish to Students
            </button>
          </form>
        </div>

        <!-- Materials List -->
        <div class="card" style="padding:22px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <h3 style="font-size:16px; font-weight:800; margin:0;">📚 Published Materials</h3>
            <button class="btn-sec" onclick="TeacherApp.loadNotesList()" style="padding:4px 10px; font-size:11.5px; margin:0;">↻ Refresh</button>
          </div>
          <div id="teacher-notes-list-box" style="max-height:480px; overflow-y:auto; display:flex; flex-direction:column; gap:10px;">
            <div style="text-align:center; padding:30px; color:var(--text-muted);">Loading materials...</div>
          </div>
        </div>
      </div>
    `;

    await this.loadNotesList();
  },

  async loadNotesList() {
    const box = document.getElementById('teacher-notes-list-box');
    if (!box) return;

    const res = await API.getTeacherNotes();
    if (!res || !res.success || !res.data) {
      box.innerHTML = `<div style="color:#ef4444; padding:20px; text-align:center;">Failed to load notes.</div>`;
      return;
    }

    const notes = res.data;
    if (notes.length === 0) {
      box.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted); font-size:13px;">No study materials uploaded yet. Use the form to upload.</div>`;
      return;
    }

    box.innerHTML = notes.map(n => `
      <div style="padding:12px; border-radius:var(--radius-sm); background:rgba(255,255,255,0.02); border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
        <div style="flex:1; min-width:0; padding-right:12px;">
          <div style="font-weight:700; font-size:13.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${n.title}</div>
          <div style="font-size:11.5px; color:var(--text-secondary); margin-top:2px;">
            <span style="color:#38bdf8; font-weight:600;">${n.subject}</span> • ${n.unit} ${n.chapter ? `• ${n.chapter}` : ''}
          </div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
            Size: ${n.file_size || 'PDF'} • By: ${n.uploaded_by || 'You'}
          </div>
        </div>
        <div style="display:flex; gap:6px;">
          <a href="${API.getDownloadUrl(n.file_url, n.file_name)}" target="_blank" class="btn-sec" style="padding:6px 10px; font-size:11px; text-decoration:none;">Download</a>
          <button class="btn-sec" onclick="TeacherApp.deleteNote(${n.id})" style="padding:6px 10px; font-size:11px; color:#ef4444; border-color:rgba(239,68,68,0.3);">Delete</button>
        </div>
      </div>
    `).join('');
  },

  async handleUploadNote() {
    const subject = document.getElementById('note-subject').value;
    const unit = document.getElementById('note-unit').value;
    const chapter = document.getElementById('note-chapter').value;
    const title = document.getElementById('note-title').value;
    const description = document.getElementById('note-description').value;
    const fileInput = document.getElementById('note-file');
    const btn = document.getElementById('btn-upload-note');

    if (!fileInput.files || !fileInput.files[0]) {
      App.showToast('Please select a file to upload.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('subject', subject);
    formData.append('unit', unit);
    formData.append('chapter', chapter);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('file', fileInput.files[0]);

    if (btn) {
      btn.disabled = true;
      btn.innerText = 'Uploading File...';
    }

    const res = await API.uploadTeacherNote(formData);
    if (btn) {
      btn.disabled = false;
      btn.innerText = 'Upload & Publish to Students';
    }

    if (res && res.success) {
      App.showToast('Note uploaded and published to students!', 'success');
      document.getElementById('teacher-upload-note-form').reset();
      this.loadNotesList();
    } else {
      App.showToast(res.message || 'Failed to upload note.', 'error');
    }
  },

  async deleteNote(id) {
    if (!confirm('Are you sure you want to delete this study note?')) return;
    const res = await API.deleteTeacherNote(id);
    if (res && res.success) {
      App.showToast('Note deleted successfully.', 'info');
      this.loadNotesList();
    } else {
      App.showToast(res.message || 'Failed to delete note.', 'error');
    }
  },

  // ==========================================================================
  // SECTION 6: ASSIGNMENTS & SUBMISSION GRADING
  // ==========================================================================
  async renderAssignments() {
    const container = document.getElementById('teacher-content');
    const teacher = this.currentUser || {};
    const subjects = (teacher.subjects || 'DBMS, NCS').split(',').map(s => s.trim()).filter(Boolean);

    container.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
        <!-- Create Assignment Card -->
        <div class="card" style="padding:22px;">
          <h3 style="font-size:16px; font-weight:800; margin:0 0 14px 0; display:flex; align-items:center; gap:8px;">
            <span>📝</span> Create New Assignment
          </h3>

          <form id="teacher-create-assignment-form" onsubmit="event.preventDefault(); TeacherApp.handleCreateAssignment();">
            <div class="form-group">
              <label class="form-label">Subject *</label>
              <select id="assign-subject" class="form-control" required>
                ${subjects.map(s => `<option value="${s}">${s}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Assignment Title *</label>
              <input type="text" id="assign-title" class="form-control" placeholder="e.g. Lab Assignment 2: SQL Normalization" required />
            </div>

            <div class="form-group">
              <label class="form-label">Description & Problem Statement *</label>
              <textarea id="assign-description" class="form-control" rows="3" placeholder="Provide assignment instructions, questions, and submission guidelines..." required></textarea>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="form-group">
                <label class="form-label">Due Date *</label>
                <input type="date" id="assign-due-date" class="form-control" required />
              </div>
              <div class="form-group">
                <label class="form-label">Maximum Marks</label>
                <input type="number" id="assign-max-marks" class="form-control" value="100" min="10" max="500" required />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Target Batch</label>
              <select id="assign-batch" class="form-control">
                ${teacher.batch === 'Batch 1' ? '<option value="Batch 1">Batch 1 Only</option>' : ''}
                ${teacher.batch === 'Batch 2' ? '<option value="Batch 2">Batch 2 Only</option>' : ''}
                ${(!teacher.batch || teacher.batch === 'Both') ? `
                  <option value="Both">Both Batches (All Students)</option>
                  <option value="Batch 1">Batch 1</option>
                  <option value="Batch 2">Batch 2</option>
                ` : ''}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Optional Attachment (Question Sheet / Template)</label>
              <input type="file" id="assign-attachment" class="form-control" accept=".pdf,.doc,.docx,.zip,.txt" />
            </div>

            <button type="submit" id="btn-create-assign" class="btn-primary" style="margin-top:10px; height:44px; font-weight:800;">
              Publish Assignment
            </button>
          </form>
        </div>

        <!-- Assignments List -->
        <div class="card" style="padding:22px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <h3 style="font-size:16px; font-weight:800; margin:0;">Active Assignments</h3>
            <button class="btn-sec" onclick="TeacherApp.loadAssignmentsList()" style="padding:4px 10px; font-size:11.5px; margin:0;">↻ Refresh</button>
          </div>
          <div id="teacher-assignments-list-box" style="display:flex; flex-direction:column; gap:12px;">
            <div style="text-align:center; padding:30px; color:var(--text-muted);">Loading assignments...</div>
          </div>
        </div>
      </div>

      <!-- Submissions Modal Container -->
      <div id="teacher-submissions-modal-box"></div>
    `;

    // Set default due date to 7 days from now
    const nextWeek = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0];
    const dueEl = document.getElementById('assign-due-date');
    if (dueEl) dueEl.value = nextWeek;

    await this.loadAssignmentsList();
  },

  async loadAssignmentsList() {
    const box = document.getElementById('teacher-assignments-list-box');
    if (!box) return;

    const res = await API.getTeacherAssignments();
    if (!res || !res.success || !res.data) {
      box.innerHTML = `<div style="color:#ef4444; padding:20px; text-align:center;">Failed to load assignments.</div>`;
      return;
    }

    const assignments = res.data;
    if (assignments.length === 0) {
      box.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted); font-size:13px;">No assignments created yet.</div>`;
      return;
    }

    box.innerHTML = assignments.map(a => `
      <div style="padding:14px; border-radius:var(--radius-sm); background:rgba(255,255,255,0.02); border:1px solid var(--border-color);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
          <h4 style="font-size:14.5px; font-weight:800; margin:0; color:#38bdf8;">${a.title}</h4>
          <span class="badge" style="background:rgba(245,158,11,0.15); color:#f59e0b; font-size:11px; font-weight:700;">
            Due: ${a.due_date}
          </span>
        </div>
        <div style="font-size:12.5px; color:var(--text-secondary); margin-bottom:8px;">
          Subject: <strong>${a.subject}</strong> • Max Marks: <strong>${a.max_marks}</strong> • Batch: ${a.batch || 'Both'}
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-color); padding-top:10px; margin-top:6px;">
          <div style="font-size:12px; color:var(--text-muted);">
            📥 <strong>${a.total_submissions}</strong> Submissions (${a.graded_submissions} graded)
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn-primary" onclick="TeacherApp.openSubmissionsModal(${a.id})" style="padding:5px 12px; font-size:11.5px; width:auto; margin:0;">
              Review & Grade
            </button>
            <button class="btn-sec" onclick="TeacherApp.deleteAssignment(${a.id})" style="padding:5px 10px; font-size:11.5px; color:#ef4444; border-color:rgba(239,68,68,0.3); margin:0;">
              Delete
            </button>
          </div>
        </div>
      </div>
    `).join('');
  },

  async handleCreateAssignment() {
    const subject = document.getElementById('assign-subject').value;
    const title = document.getElementById('assign-title').value;
    const description = document.getElementById('assign-description').value;
    const due_date = document.getElementById('assign-due-date').value;
    const max_marks = document.getElementById('assign-max-marks').value;
    const batch = document.getElementById('assign-batch').value;
    const fileInput = document.getElementById('assign-attachment');
    const btn = document.getElementById('btn-create-assign');

    const formData = new FormData();
    formData.append('subject', subject);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('due_date', due_date);
    formData.append('max_marks', max_marks);
    formData.append('batch', batch);
    if (fileInput.files && fileInput.files[0]) {
      formData.append('file', fileInput.files[0]);
    }

    if (btn) {
      btn.disabled = true;
      btn.innerText = 'Publishing...';
    }

    const res = await API.createTeacherAssignment(formData);
    if (btn) {
      btn.disabled = false;
      btn.innerText = 'Publish Assignment';
    }

    if (res && res.success) {
      App.showToast('Assignment published successfully to students!', 'success');
      document.getElementById('teacher-create-assignment-form').reset();
      this.loadAssignmentsList();
    } else {
      App.showToast(res.message || 'Failed to create assignment.', 'error');
    }
  },

  async deleteAssignment(id) {
    if (!confirm('Are you sure you want to delete this assignment? All associated student submissions will also be deleted.')) return;
    const res = await API.deleteTeacherAssignment(id);
    if (res && res.success) {
      App.showToast('Assignment deleted.', 'info');
      this.loadAssignmentsList();
    } else {
      App.showToast(res.message || 'Failed to delete assignment.', 'error');
    }
  },

  async openSubmissionsModal(assignmentId) {
    const modalBox = document.getElementById('teacher-submissions-modal-box');
    if (!modalBox) return;

    modalBox.innerHTML = `
      <div class="modal-backdrop" id="submissions-modal" onclick="if(event.target===this) this.remove();">
        <div class="modal-card" style="max-width:720px; padding:24px;" onclick="event.stopPropagation()">
          <div style="text-align:center; padding:30px;"><div style="width:30px; height:30px; border:3px solid rgba(255,255,255,0.1); border-top-color:#38bdf8; border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto;"></div></div>
        </div>
      </div>
    `;

    const res = await API.getTeacherAssignmentSubmissions(assignmentId);
    const modal = document.getElementById('submissions-modal');
    if (!modal) return;

    if (!res || !res.success || !res.data) {
      modal.innerHTML = `
        <div class="modal-card" style="max-width:400px; padding:24px; text-align:center;">
          <h3>Error</h3>
          <p style="color:var(--text-muted); font-size:13px;">${res.message || 'Could not load submissions.'}</p>
          <button class="btn-sec" onclick="document.getElementById('submissions-modal').remove()">Close</button>
        </div>
      `;
      return;
    }

    const { assignment, submissions, unsubmittedStudents, stats } = res;

    modal.innerHTML = `
      <div class="modal-card" style="max-width:760px; padding:24px; max-height:85vh; overflow-y:auto;" onclick="event.stopPropagation()">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
          <div>
            <h3 style="font-size:17px; font-weight:800; margin:0;">${assignment.title}</h3>
            <div style="font-size:12.5px; color:var(--text-secondary); margin-top:2px;">
              Subject: <strong>${assignment.subject}</strong> • Max Marks: <strong>${assignment.max_marks}</strong>
            </div>
          </div>
          <button class="icon-btn" onclick="document.getElementById('submissions-modal').remove()" style="width:28px; height:28px;">✕</button>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:10px; margin-bottom:16px;">
          <div style="padding:10px; background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:6px; text-align:center;">
            <div style="font-size:11px; color:var(--text-muted);">ENROLLED</div>
            <div style="font-size:16px; font-weight:800;">${stats.totalEnrolled}</div>
          </div>
          <div style="padding:10px; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.25); border-radius:6px; text-align:center;">
            <div style="font-size:11px; color:#10b981; font-weight:700;">SUBMITTED</div>
            <div style="font-size:16px; font-weight:800; color:#10b981;">${stats.submittedCount}</div>
          </div>
          <div style="padding:10px; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.25); border-radius:6px; text-align:center;">
            <div style="font-size:11px; color:#f59e0b; font-weight:700;">GRADED</div>
            <div style="font-size:16px; font-weight:800; color:#f59e0b;">${stats.gradedCount}</div>
          </div>
          <div style="padding:10px; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25); border-radius:6px; text-align:center;">
            <div style="font-size:11px; color:#ef4444; font-weight:700;">PENDING SUBMISSION</div>
            <div style="font-size:16px; font-weight:800; color:#ef4444;">${stats.unsubmittedCount}</div>
          </div>
        </div>

        <h4 style="font-size:14px; font-weight:800; margin:16px 0 10px 0;">Received Submissions (${submissions.length})</h4>
        <div style="overflow-x:auto; margin-bottom:18px;">
          <table class="table" style="font-size:12.5px; width:100%;">
            <thead>
              <tr>
                <th>UG ID</th>
                <th>Student Name</th>
                <th>Submitted File</th>
                <th>Submission Time</th>
                <th style="width:90px;">Marks</th>
                <th>Feedback</th>
                <th style="text-align:right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${submissions.length === 0 ? `
                <tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:20px;">No student submissions received yet.</td></tr>
              ` : submissions.map(sub => `
                <tr id="sub-row-${sub.id}">
                  <td><code>${sub.ug_id}</code></td>
                  <td><strong>${sub.student_name}</strong></td>
                  <td>
                    <a href="${API.getDownloadUrl(sub.file_url, sub.file_name)}" target="_blank" style="color:#38bdf8; text-decoration:underline;">
                      ${sub.file_name || 'Download'}
                    </a>
                  </td>
                  <td style="color:var(--text-muted); font-size:11.5px;">${new Date(sub.submitted_at).toLocaleDateString()}</td>
                  <td>
                    <input type="number" id="sub-marks-${sub.id}" class="form-control" value="${sub.marks_obtained !== null ? sub.marks_obtained : ''}" placeholder="/${assignment.max_marks}" style="width:75px; padding:4px 6px; font-size:12px;" />
                  </td>
                  <td>
                    <input type="text" id="sub-feedback-${sub.id}" class="form-control" value="${sub.feedback || ''}" placeholder="Feedback..." style="min-width:110px; padding:4px 6px; font-size:12px;" />
                  </td>
                  <td style="text-align:right;">
                    <button class="btn-primary" onclick="TeacherApp.saveGrade(${sub.id})" style="padding:4px 10px; font-size:11px; width:auto; margin:0;">
                      Save
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div style="display:flex; justify-content:flex-end;">
          <button class="btn-sec" onclick="document.getElementById('submissions-modal').remove()">Done</button>
        </div>
      </div>
    `;
  },

  async saveGrade(submissionId) {
    const marksEl = document.getElementById(`sub-marks-${submissionId}`);
    const feedbackEl = document.getElementById(`sub-feedback-${submissionId}`);

    const marks_obtained = marksEl ? marksEl.value : null;
    const feedback = feedbackEl ? feedbackEl.value : '';

    const res = await API.gradeTeacherSubmission(submissionId, { marks_obtained, feedback });
    if (res && res.success) {
      App.showToast('Grade and feedback saved.', 'success');
      this.loadAssignmentsList();
    } else {
      App.showToast(res.message || 'Failed to save grade.', 'error');
    }
  },

  // ==========================================================================
  // SECTION 7: MARKS / RESULTS ENTRY
  // ==========================================================================
  async renderResults() {
    const container = document.getElementById('teacher-content');
    const teacher = this.currentUser || {};
    const subjects = (teacher.subjects || 'DBMS, NCS').split(',').map(s => s.trim()).filter(Boolean);

    container.innerHTML = `
      <div class="card" style="padding:20px; margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <h3 style="font-size:16px; font-weight:800; margin:0;">📊 Academic Marks Entry</h3>
            <p style="font-size:12px; color:var(--text-secondary); margin:2px 0 0 0;">
              Record & publish marks for your assigned subjects. Published marks appear immediately in the Student Portal.
            </p>
          </div>
          <button class="btn-primary" onclick="TeacherApp.saveAllResultsSheet()" id="btn-save-all-marks" style="padding:7px 18px; font-size:12.5px; width:auto; margin:0; font-weight:800;">
            💾 Save All Entered Marks
          </button>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-top:14px;">
          <div>
            <label class="form-label" style="font-size:12px;">Subject *</label>
            <select id="marks-subject-select" class="form-control" onchange="TeacherApp.loadMarksSpreadsheet()">
              ${subjects.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label" style="font-size:12px;">Assessment / Exam *</label>
            <select id="marks-exam-select" class="form-control" onchange="TeacherApp.loadMarksSpreadsheet()">
              <option value="Mid-Semester Exam">Mid-Semester Exam</option>
              <option value="End-Semester Exam">End-Semester Exam</option>
              <option value="Unit Test 1">Unit Test 1</option>
              <option value="Unit Test 2">Unit Test 2</option>
              <option value="Internal Assessment">Internal Assessment</option>
            </select>
          </div>
          <div>
            <label class="form-label" style="font-size:12px;">Batch</label>
            <select id="marks-batch-select" class="form-control" onchange="TeacherApp.loadMarksSpreadsheet()">
              ${teacher.batch === 'Batch 1' ? '<option value="Batch 1">Batch 1 Only</option>' : ''}
              ${teacher.batch === 'Batch 2' ? '<option value="Batch 2">Batch 2 Only</option>' : ''}
              ${(!teacher.batch || teacher.batch === 'Both') ? `
                <option value="Both">Both Batches</option>
                <option value="Batch 1">Batch 1</option>
                <option value="Batch 2">Batch 2</option>
              ` : ''}
            </select>
          </div>
          <div>
            <label class="form-label" style="font-size:12px;">Maximum Marks</label>
            <input type="number" id="marks-max-input" class="form-control" value="100" min="10" max="500" onchange="TeacherApp.updateMaxMarksForAll(this.value)" />
          </div>
        </div>
      </div>

      <div class="card" style="padding:0; overflow:hidden;">
        <div id="marks-spreadsheet-box" style="overflow-x:auto;">
          <div style="text-align:center; padding:30px; color:var(--text-muted);">Loading students for marks entry...</div>
        </div>
      </div>
    `;

    await this.loadMarksSpreadsheet();
  },

  async loadMarksSpreadsheet() {
    const box = document.getElementById('marks-spreadsheet-box');
    if (!box) return;

    const subject = document.getElementById('marks-subject-select').value;
    const exam = document.getElementById('marks-exam-select').value;
    const batch = document.getElementById('marks-batch-select').value;
    const maxMarks = document.getElementById('marks-max-input').value || 100;

    box.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted);">Loading student records...</div>`;

    const [stdRes, resRes] = await Promise.all([
      API.getTeacherStudents('', batch),
      API.getTeacherResults(subject, exam)
    ]);

    if (!stdRes || !stdRes.success || !stdRes.data) {
      box.innerHTML = `<div style="padding:20px; color:#ef4444; text-align:center;">Failed to load students.</div>`;
      return;
    }

    const students = stdRes.data;
    const existingResults = (resRes && resRes.success && resRes.data) ? resRes.data : [];
    const resultMap = {};
    existingResults.forEach(r => {
      resultMap[r.ug_id.toUpperCase()] = r;
    });

    box.innerHTML = `
      <table class="table" style="font-size:13px; width:100%; margin:0;">
        <thead>
          <tr>
            <th style="width:60px;">Roll</th>
            <th>UG ID</th>
            <th>Student Name</th>
            <th style="width:80px;">Batch</th>
            <th style="width:110px;">Marks Scored</th>
            <th style="width:80px;">Max</th>
            <th style="width:80px;">Grade</th>
            <th>Remarks</th>
            <th style="text-align:right; width:90px;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${students.map(s => {
            const ex = resultMap[s.ug_id.toUpperCase()] || {};
            const scored = ex.marks !== undefined ? ex.marks : '';
            const grade = ex.grade || '-';
            const remarks = ex.remarks || '';
            return `
              <tr data-ug="${s.ug_id}" data-name="${s.name}" data-roll="${s.roll_number}">
                <td><strong>#${s.roll_number}</strong></td>
                <td><code>${s.ug_id}</code></td>
                <td><strong>${s.name}</strong></td>
                <td><span class="badge" style="background:rgba(255,255,255,0.06); font-size:11px;">${s.batch}</span></td>
                <td>
                  <input type="number" step="0.5" class="form-control marks-score-input" value="${scored}" placeholder="0" style="width:90px; padding:4px 8px; font-size:12.5px; font-weight:700;" oninput="TeacherApp.previewGrade(this)" />
                </td>
                <td style="color:var(--text-muted); font-size:12px;">/${maxMarks}</td>
                <td>
                  <span class="badge grade-badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; font-weight:800; font-size:11px;">
                    ${grade}
                  </span>
                </td>
                <td>
                  <input type="text" class="form-control marks-remarks-input" value="${remarks}" placeholder="Good, Needs Improvement..." style="font-size:12px; padding:4px 8px;" />
                </td>
                <td style="text-align:right;">
                  <button class="btn-sec" onclick="TeacherApp.saveSingleResultRow(this)" style="padding:4px 10px; font-size:11px; margin:0;">
                    Save
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  },

  previewGrade(input) {
    const row = input.closest('tr');
    const badge = row.querySelector('.grade-badge');
    const maxMarks = parseFloat(document.getElementById('marks-max-input').value) || 100;
    const val = parseFloat(input.value);

    if (isNaN(val) || !badge) return;
    const pct = (val / maxMarks) * 100;

    let g = 'FF';
    if (pct >= 90) g = 'AA';
    else if (pct >= 80) g = 'AB';
    else if (pct >= 70) g = 'BB';
    else if (pct >= 60) g = 'BC';
    else if (pct >= 50) g = 'CC';
    else if (pct >= 40) g = 'CD';

    badge.innerText = g;
    badge.style.color = g === 'FF' ? '#ef4444' : '#38bdf8';
  },

  updateMaxMarksForAll(val) {
    const rows = document.querySelectorAll('#marks-spreadsheet-box tbody tr');
    rows.forEach(r => {
      const tdMax = r.querySelectorAll('td')[5];
      if (tdMax) tdMax.innerText = `/${val}`;
      const input = r.querySelector('.marks-score-input');
      if (input) this.previewGrade(input);
    });
  },

  async saveSingleResultRow(btn) {
    const row = btn.closest('tr');
    const ug_id = row.dataset.ug;
    const subject = document.getElementById('marks-subject-select').value;
    const exam_name = document.getElementById('marks-exam-select').value;
    const max_marks = document.getElementById('marks-max-input').value || 100;
    const marksInput = row.querySelector('.marks-score-input');
    const remarksInput = row.querySelector('.marks-remarks-input');
    const badge = row.querySelector('.grade-badge');

    const marks = marksInput.value;
    if (marks === '') {
      App.showToast('Please enter marks before saving.', 'warning');
      return;
    }

    btn.disabled = true;
    btn.innerText = 'Saving...';

    const res = await API.saveTeacherResult({
      ug_id,
      subject,
      exam_name,
      marks,
      max_marks,
      grade: badge.innerText !== '-' ? badge.innerText : null,
      remarks: remarksInput.value
    });

    btn.disabled = false;
    btn.innerText = 'Save';

    if (res && res.success) {
      App.showToast(res.message || 'Marks saved.', 'success');
    } else {
      App.showToast(res.message || 'Failed to save marks.', 'error');
    }
  },

  async saveAllResultsSheet() {
    const subject = document.getElementById('marks-subject-select').value;
    const exam_name = document.getElementById('marks-exam-select').value;
    const max_marks = document.getElementById('marks-max-input').value || 100;
    const saveBtn = document.getElementById('btn-save-all-marks');

    const rows = document.querySelectorAll('#marks-spreadsheet-box tbody tr');
    let savedCount = 0;

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerText = 'Saving All Marks...';
    }

    for (const row of rows) {
      const ug_id = row.dataset.ug;
      const marksInput = row.querySelector('.marks-score-input');
      const remarksInput = row.querySelector('.marks-remarks-input');
      const badge = row.querySelector('.grade-badge');

      if (!marksInput || marksInput.value === '') continue;

      await API.saveTeacherResult({
        ug_id,
        subject,
        exam_name,
        marks: marksInput.value,
        max_marks,
        grade: badge.innerText !== '-' ? badge.innerText : null,
        remarks: remarksInput ? remarksInput.value : ''
      });
      savedCount++;
    }

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerText = '💾 Save All Entered Marks';
    }

    App.showToast(`Saved marks for ${savedCount} students!`, 'success');
  },

  // ==========================================================================
  // SECTION 8: ANNOUNCEMENTS
  // ==========================================================================
  async renderAnnouncements() {
    const container = document.getElementById('teacher-content');
    const teacher = this.currentUser || {};
    const subjects = (teacher.subjects || 'DBMS, NCS').split(',').map(s => s.trim()).filter(Boolean);

    container.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
        <!-- Publish Announcement Card -->
        <div class="card" style="padding:22px;">
          <h3 style="font-size:16px; font-weight:800; margin:0 0 14px 0; display:flex; align-items:center; gap:8px;">
            <span>📢</span> Post Class Announcement
          </h3>
          <p style="font-size:12px; color:var(--text-secondary); margin-bottom:16px;">
            Broadcast targeted notifications directly to student portal notification hubs and real-time alerts.
          </p>

          <form id="teacher-announcement-form" onsubmit="event.preventDefault(); TeacherApp.handleCreateAnnouncement();">
            <div class="form-group">
              <label class="form-label">Subject</label>
              <select id="ann-subject" class="form-control">
                <option value="">General (No Subject Prefix)</option>
                ${subjects.map(s => `<option value="${s}">${s}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Announcement Title *</label>
              <input type="text" id="ann-title" class="form-control" placeholder="e.g. Lab Session Room Change or Assignment Extended" required />
            </div>

            <div class="form-group">
              <label class="form-label">Message Details *</label>
              <textarea id="ann-message" class="form-control" rows="4" placeholder="Enter complete notice details for students..." required></textarea>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="form-group">
                <label class="form-label">Target Batch</label>
                <select id="ann-batch" class="form-control">
                  ${teacher.batch === 'Batch 1' ? '<option value="Batch 1">Batch 1 Only</option>' : ''}
                  ${teacher.batch === 'Batch 2' ? '<option value="Batch 2">Batch 2 Only</option>' : ''}
                  ${(!teacher.batch || teacher.batch === 'Both') ? `
                    <option value="Both">Both Batches (All)</option>
                    <option value="Batch 1">Batch 1</option>
                    <option value="Batch 2">Batch 2</option>
                  ` : ''}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Priority</label>
                <select id="ann-priority" class="form-control">
                  <option value="NORMAL">Normal Priority</option>
                  <option value="URGENT">Urgent / Important</option>
                </select>
              </div>
            </div>

            <button type="submit" id="btn-post-ann" class="btn-primary" style="margin-top:10px; height:44px; font-weight:800;">
              Broadcast Announcement
            </button>
          </form>
        </div>

        <!-- Recent Announcements -->
        <div class="card" style="padding:22px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <h3 style="font-size:16px; font-weight:800; margin:0;">Recent Broadcasts</h3>
            <button class="btn-sec" onclick="TeacherApp.loadAnnouncementsList()" style="padding:4px 10px; font-size:11.5px; margin:0;">↻ Refresh</button>
          </div>
          <div id="teacher-announcements-list-box" style="display:flex; flex-direction:column; gap:12px;">
            <div style="text-align:center; padding:30px; color:var(--text-muted);">Loading announcements...</div>
          </div>
        </div>
      </div>
    `;

    await this.loadAnnouncementsList();
  },

  async loadAnnouncementsList() {
    const box = document.getElementById('teacher-announcements-list-box');
    if (!box) return;

    const res = await API.getTeacherNotifications();
    if (!res || !res.success || !res.data) {
      box.innerHTML = `<div style="color:#ef4444; padding:20px; text-align:center;">Failed to load announcements.</div>`;
      return;
    }

    const notices = res.data;
    if (notices.length === 0) {
      box.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted); font-size:13px;">No announcements posted yet.</div>`;
      return;
    }

    box.innerHTML = notices.map(n => `
      <div style="padding:14px; border-radius:var(--radius-sm); background:rgba(255,255,255,0.02); border:1px solid var(--border-color);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
          <h4 style="font-size:14px; font-weight:800; margin:0; color:#38bdf8;">${n.title}</h4>
          <span style="font-size:11px; color:var(--text-muted);">${new Date(n.created_at).toLocaleDateString()}</span>
        </div>
        <p style="font-size:12.5px; color:var(--text-secondary); margin:4px 0 6px 0; line-height:1.4;">${n.message}</p>
        <div style="font-size:11px; color:var(--text-muted);">Target: <span class="badge" style="background:rgba(255,255,255,0.06); font-size:10px;">${n.target_type}</span></div>
      </div>
    `).join('');
  },

  async handleCreateAnnouncement() {
    const subject = document.getElementById('ann-subject').value;
    const title = document.getElementById('ann-title').value;
    const message = document.getElementById('ann-message').value;
    const batch = document.getElementById('ann-batch').value;
    const priority = document.getElementById('ann-priority').value;
    const btn = document.getElementById('btn-post-ann');

    if (!title || !message) return;

    if (btn) {
      btn.disabled = true;
      btn.innerText = 'Broadcasting...';
    }

    const res = await API.createTeacherNotification({
      subject,
      title,
      message,
      batch,
      priority
    });

    if (btn) {
      btn.disabled = false;
      btn.innerText = 'Broadcast Announcement';
    }

    if (res && res.success) {
      App.showToast('Announcement broadcasted to student portal!', 'success');
      document.getElementById('teacher-announcement-form').reset();
      this.loadAnnouncementsList();
    } else {
      App.showToast(res.message || 'Failed to post announcement.', 'error');
    }
  },

  // ==========================================================================
  // SECTION 9: FACULTY PROFILE & SETTINGS
  // ==========================================================================
  async renderProfile() {
    const container = document.getElementById('teacher-content');
    const teacher = this.currentUser || {};
    const photoUrl = teacher.profile_photo_url || './favicon.svg';

    container.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
        <!-- Profile Card -->
        <div class="card" style="padding:24px; text-align:center;">
          <div style="position:relative; width:90px; height:90px; margin:0 auto 14px auto;">
            <img id="teacher-profile-img" src="${photoUrl}" alt="Faculty Photo" style="width:90px; height:90px; border-radius:50%; object-fit:cover; border:3px solid #38bdf8; box-shadow:0 6px 20px rgba(0,0,0,0.4);" onerror="this.src='./favicon.svg'" />
            <label for="teacher-photo-input" style="position:absolute; bottom:0; right:0; width:28px; height:28px; border-radius:50%; background:#38bdf8; color:#0b0f19; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:13px; font-weight:800;" title="Change Photo">
              ✎
            </label>
            <input type="file" id="teacher-photo-input" accept="image/*" style="display:none;" onchange="TeacherApp.handleUploadProfilePhoto(this)" />
          </div>

          <h3 style="font-size:18px; font-weight:800; margin:0;">${teacher.name}</h3>
          <div style="font-size:13px; color:#38bdf8; font-weight:700; margin-top:2px;">${teacher.designation || 'Faculty Member'}</div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">${teacher.department}</div>

          <div style="display:flex; justify-content:center; gap:8px; margin-top:12px;">
            <span class="badge" style="background:rgba(56,189,248,0.12); color:#38bdf8; font-weight:700; font-size:11px;">
              ID: ${teacher.teacher_id}
            </span>
            <span class="badge" style="background:rgba(16,185,129,0.12); color:#10b981; font-weight:700; font-size:11px;">
              Status: ${teacher.status || 'ACTIVE'}
            </span>
          </div>

          <div style="text-align:left; margin-top:20px; border-top:1px solid var(--border-color); padding-top:16px; font-size:13px; display:flex; flex-direction:column; gap:10px;">
            <div>📖 Assigned Subjects: <strong>${teacher.subjects || 'All'}</strong></div>
            <div>🏛️ Division: <strong>${teacher.division || '3CYBER7'}</strong></div>
            <div>👥 Batch Assignment: <strong>${teacher.batch || 'Both Batches'}</strong></div>
          </div>
        </div>

        <!-- Edit Profile & Security Forms -->
        <div style="display:flex; flex-direction:column; gap:20px;">
          <!-- Contact Details Form -->
          <div class="card" style="padding:22px;">
            <h3 style="font-size:15px; font-weight:800; margin:0 0 14px 0;">Contact & Professional Details</h3>
            <form id="teacher-profile-form" onsubmit="event.preventDefault(); TeacherApp.handleSaveProfile();">
              <div class="form-group">
                <label class="form-label">Phone Number</label>
                <input type="tel" id="prof-phone" class="form-control" value="${teacher.phone || ''}" placeholder="e.g. 9876543210" />
              </div>

              <div class="form-group">
                <label class="form-label">Official Email</label>
                <input type="email" id="prof-email" class="form-control" value="${teacher.email || ''}" placeholder="faculty@mishragroup.ac.in" />
              </div>

              <div class="form-group">
                <label class="form-label">Designation</label>
                <input type="text" id="prof-designation" class="form-control" value="${teacher.designation || ''}" placeholder="Assistant Professor" />
              </div>

              <button type="submit" id="btn-save-profile" class="btn-primary" style="padding:8px 16px; font-size:12.5px; width:auto;">
                Save Profile Changes
              </button>
            </form>
          </div>

          <!-- Change Password Form -->
          <div class="card" style="padding:22px;">
            <h3 style="font-size:15px; font-weight:800; margin:0 0 14px 0;">Change Account Password</h3>
            <form id="teacher-password-form" onsubmit="event.preventDefault(); TeacherApp.handleChangePassword();">
              <div class="form-group">
                <label class="form-label">Current Password *</label>
                <input type="password" id="pass-current" class="form-control" required />
              </div>

              <div class="form-group">
                <label class="form-label">New Password (min. 6 characters) *</label>
                <input type="password" id="pass-new" class="form-control" required minlength="6" />
              </div>

              <div class="form-group">
                <label class="form-label">Confirm New Password *</label>
                <input type="password" id="pass-confirm" class="form-control" required minlength="6" />
              </div>

              <button type="submit" id="btn-change-pass" class="btn-primary" style="padding:8px 16px; font-size:12.5px; width:auto;">
                Update Password
              </button>
            </form>
          </div>
        </div>
      </div>
    `;
  },

  async handleSaveProfile() {
    const phone = document.getElementById('prof-phone').value;
    const email = document.getElementById('prof-email').value;
    const designation = document.getElementById('prof-designation').value;
    const btn = document.getElementById('btn-save-profile');

    if (btn) {
      btn.disabled = true;
      btn.innerText = 'Saving...';
    }

    const res = await API.updateTeacherProfile({ phone, email, designation });
    if (btn) {
      btn.disabled = false;
      btn.innerText = 'Save Profile Changes';
    }

    if (res && res.success) {
      App.showToast('Profile details updated successfully.', 'success');
      this.currentUser = { ...this.currentUser, phone, email, designation };
      API.setUser(this.currentUser);
    } else {
      App.showToast(res.message || 'Failed to update profile.', 'error');
    }
  },

  async handleChangePassword() {
    const current_password = document.getElementById('pass-current').value;
    const new_password = document.getElementById('pass-new').value;
    const confirm_password = document.getElementById('pass-confirm').value;
    const btn = document.getElementById('btn-change-pass');

    if (new_password !== confirm_password) {
      App.showToast('New passwords do not match.', 'error');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerText = 'Updating...';
    }

    const res = await API.changePassword(current_password, new_password);
    if (btn) {
      btn.disabled = false;
      btn.innerText = 'Update Password';
    }

    if (res && res.success) {
      App.showToast('Password updated successfully.', 'success');
      document.getElementById('teacher-password-form').reset();
    } else {
      App.showToast(res.message || 'Failed to change password.', 'error');
    }
  },

  async handleUploadProfilePhoto(input) {
    if (!input.files || !input.files[0]) return;

    const formData = new FormData();
    formData.append('photo', input.files[0]);

    App.showToast('Uploading profile photo...', 'info');
    const res = await API.uploadTeacherPhoto(formData);

    if (res && res.success && res.profile_photo_url) {
      App.showToast('Profile photo updated!', 'success');
      const img = document.getElementById('teacher-profile-img');
      if (img) img.src = res.profile_photo_url;
      this.currentUser.profile_photo_url = res.profile_photo_url;
      API.setUser(this.currentUser);
    } else {
      App.showToast(res.message || 'Failed to update photo.', 'error');
    }
  },

  // ==========================================================================
  // REALTIME SERVER-SENT EVENTS (SSE) INTEGRATION
  // ==========================================================================
  initRealtimeSSE() {
    const token = API.getToken();
    if (!token || typeof EventSource === 'undefined') return;

    const base = API.baseUrl ? API.baseUrl.replace(/\/+$/, '') : '';
    const sseUrl = `${base}/api/realtime/events?token=${encodeURIComponent(token)}`;

    try {
      const eventSource = new EventSource(sseUrl);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ATTENDANCE_RECORD_MARKED') {
            if (this.currentSection === 'attendance' && this.activeQrSessionId) {
              this.refreshLiveScans();
            }
          } else if (data.type === 'ASSIGNMENT_UPDATED' || data.type === 'SUBMISSION_RECEIVED') {
            if (this.currentSection === 'assignments') {
              this.loadAssignmentsList();
            }
          }
        } catch (e) {}
      };

      eventSource.onerror = () => {
        eventSource.close();
      };
    } catch (e) {}
  }
};

window.TeacherApp = TeacherApp;
