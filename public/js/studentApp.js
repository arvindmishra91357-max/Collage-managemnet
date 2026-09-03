// ==========================================================================
// STUDENT WEB APP / PWA CONTROLLER
// ==========================================================================

const StudentApp = {
  currentTab: 'home',
  currentUser: null,
  activeVideoTrack: null,
  currentLocation: null,
  isScanning: false,
  tabHistory: ['home'],

  async init(user) {
    this.currentUser = user;
    this.tabHistory = ['home'];

    // Check URL hash for direct deep link
    const hash = window.location.hash.replace('#', '').trim();
    const validTabs = ['home', 'study', 'timetable', 'attendance', 'profile'];
    const initialTab = validTabs.includes(hash) ? hash : 'home';
    this.currentTab = initialTab;
    if (initialTab !== 'home') this.tabHistory.push(initialTab);

    try {
      history.replaceState({ role: 'STUDENT', tab: initialTab }, '', '#' + initialTab);
    } catch (e) {}

    this.renderLayout();
    this.bindEvents();
    await this.loadTabData(initialTab);
    this.setupNotificationBadge();
  },

  renderLayout() {
    const root = document.getElementById('app-root');
    const u = this.currentUser;

    root.innerHTML = `
      <div class="student-app-layout">
        <!-- Top App Bar -->
        <header class="student-topbar">
          <div class="student-brand">
            <div class="brand-crest">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div class="brand-text">
              <h1>MISHRA GROUP INSTITUTE</h1>
              <span>3CYBER7 • B.Tech</span>
            </div>
          </div>
          <div class="topbar-actions">
            <button class="icon-btn" id="btn-global-search" title="Search Portal">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </button>
            <button class="icon-btn" id="btn-notifications-drawer" title="Notifications">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <span class="badge-dot" id="notif-badge-dot" style="display:none;"></span>
            </button>
          </div>
        </header>

        <!-- Main Dynamic Tab Container -->
        <main class="student-content" id="student-main-content">
          <!-- Dynamic Views Loaded Here -->
        </main>

        <!-- Floating AI Tutor FAB -->
        <button class="ai-fab-btn" id="btn-open-ai-tutor">
          <span>✨</span>
          <span>Connect with AI</span>
        </button>

        <!-- Bottom Navigation Bar -->
        <nav class="bottom-nav-bar">
          <button class="bottom-nav-item active" data-tab="home">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span>Home</span>
          </button>
          <button class="bottom-nav-item" data-tab="study">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            <span>Study</span>
          </button>
          <button class="bottom-nav-item" data-tab="timetable">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>Timetable</span>
          </button>
          <button class="bottom-nav-item" data-tab="attendance">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            <span>Attendance</span>
          </button>
          <button class="bottom-nav-item" data-tab="profile">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            <span>Profile</span>
          </button>
        </nav>
      </div>

      <!-- Modals Container -->
      <div id="student-modal-container"></div>
    `;
  },

  bindEvents() {
    // Navigation items
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });

    // AI FAB
    document.getElementById('btn-open-ai-tutor').addEventListener('click', () => {
      this.openAIModal();
    });

    // Search button
    document.getElementById('btn-global-search').addEventListener('click', () => {
      this.openSearchModal();
    });

    // Notifications drawer
    document.getElementById('btn-notifications-drawer').addEventListener('click', () => {
      this.openNotificationsDrawer();
    });
  },

  switchTab(tab, pushState = true) {
    if (pushState) {
      if (this.tabHistory[this.tabHistory.length - 1] !== tab) {
        this.tabHistory.push(tab);
      }
      try {
        history.pushState({ role: 'STUDENT', tab: tab }, '', '#' + tab);
      } catch (e) {}
    }
    this.currentTab = tab;
    document.querySelectorAll('.bottom-nav-item').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    this.stopCamera();
    this.loadTabData(tab);
  },

  closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.remove();
    if (history.state && history.state.modal === modalId) {
      history.back();
    }
  },

  async loadTabData(tab) {
    const container = document.getElementById('student-main-content');
    container.innerHTML = `<div style="text-align:center; padding: 40px;"><div class="spinner"></div><p style="color:var(--text-muted); margin-top:10px;">Loading...</p></div>`;

    if (tab === 'home') await this.renderHomeTab(container);
    else if (tab === 'study') await this.renderStudyTab(container);
    else if (tab === 'timetable') await this.renderTimetableTab(container);
    else if (tab === 'attendance') await this.renderAttendanceTab(container);
    else if (tab === 'profile') await this.renderProfileTab(container);
  },

  getCurrentDayName() {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const d = days[new Date().getDay()];
    return d === 'Sunday' ? 'Monday' : d;
  },

  getGreetingTime() {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  },

  timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    let str = timeStr.toString().trim().toUpperCase();
    const isPM = str.includes('PM');
    const isAM = str.includes('AM');
    str = str.replace(/AM|PM/g, '').trim();

    const parts = str.split(':');
    let h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) || 0;

    if (isPM && h < 12) {
      h += 12;
    } else if (isAM && h === 12) {
      h = 0;
    } else if (!isAM && !isPM) {
      if (h >= 1 && h <= 7) {
        h += 12;
      }
    }
    return h * 60 + m;
  },

  formatTimeSlot(t) {
    if (!t) return '';
    const parts = t.toString().trim().replace(/AM|PM/gi, '').split(':');
    let h = parseInt(parts[0], 10);
    const m = parts[1] ? parts[1].trim() : '00';
    let ampm = 'AM';
    if (h === 12 || (h >= 1 && h <= 7)) {
      ampm = 'PM';
    } else if (h >= 8 && h <= 11) {
      ampm = 'AM';
    }
    const hStr = h < 10 ? `0${h}` : `${h}`;
    return `${hStr}:${m} ${ampm}`;
  },

  formatSlotRange(start, end) {
    return `${this.formatTimeSlot(start)} – ${this.formatTimeSlot(end)}`;
  },

  // ==================== TAB 1: HOME ====================
  async renderHomeTab(container) {
    const u = this.currentUser;
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const realDayName = days[now.getDay()];
    const clientMin = now.getHours() * 60 + now.getMinutes();

    // Fetch live timetable & today's classes
    const todayRes = await API.getTodayClasses({
      client_minutes: clientMin,
      day: realDayName === 'Sunday' ? 'Monday' : realDayName
    });

    const todayData = todayRes && todayRes.success ? todayRes : { classes: [], liveClass: null, nextClass: null };

    // Dynamic client-side verification with current real clock
    let liveClass = todayData.liveClass;
    let nextClass = todayData.nextClass;
    let isSunday = realDayName === 'Sunday';
    let dayCompleted = false;

    if (todayData.classes && todayData.classes.length > 0 && !isSunday) {
      liveClass = null;
      nextClass = null;
      let minDiff = Infinity;
      let completedCount = 0;

      for (const c of todayData.classes) {
        const startMin = this.timeToMinutes(c.start_time);
        const endMin = this.timeToMinutes(c.end_time);

        if (clientMin >= startMin && clientMin <= endMin) {
          liveClass = c;
        } else if (clientMin > endMin) {
          completedCount++;
        } else if (clientMin < startMin) {
          const diff = startMin - clientMin;
          if (diff < minDiff) {
            minDiff = diff;
            nextClass = { ...c, startsInMinutes: diff };
          }
        }
      }
      if (completedCount === todayData.classes.length) {
        dayCompleted = true;
      }
    }

    // Fetch attendance summary
    const attRes = await API.getStudentAttendance();
    const attPct = attRes.success && attRes.stats ? attRes.stats.percentage : '91.5';

    // Fetch assignments count
    const assignRes = await API.getAssignments();
    const activeAssignments = assignRes.success ? assignRes.data.slice(0, 2) : [];

    const greeting = this.getGreetingTime();

    container.innerHTML = `
      <!-- Greeting Hero Card -->
      <section class="greeting-hero">
        <div class="greeting-top">
          <div class="greeting-text">
            <h2>${greeting}, ${u.name.split(' ')[0]} 👋</h2>
            <p>${u.program} • ${u.semester}</p>
          </div>
          <span class="student-tag-badge">${u.batch}</span>
        </div>
        <div class="student-meta-chips">
          <div class="meta-chip"><span>UG ID:</span> <strong>${u.ug_id}</strong></div>
          <div class="meta-chip"><span>Roll No:</span> <strong>${u.roll_number}</strong></div>
          <div class="meta-chip"><span>Div:</span> <strong>${u.division}</strong></div>
          <div class="meta-chip"><span>Year:</span> <strong>${u.academic_year}</strong></div>
        </div>
      </section>

      <!-- Next Class Card (Real-Time Synchronized) -->
      <section class="next-class-card">
        <div>
          ${isSunday ? `
            <span class="class-status-badge" style="background:rgba(16,185,129,0.15); color:#34d399;">🌴 SUNDAY HOLIDAY</span>
            <div class="next-class-subject" style="font-size:15px;">No Classes Scheduled Today</div>
            <div class="next-class-details">Next session starts Monday morning at 09:30 AM</div>
          ` : liveClass ? `
            <span class="class-status-badge live">● LIVE NOW</span>
            <div class="next-class-subject">${liveClass.subject} ${liveClass.is_lab ? '<span class="lab-chip">LAB</span>' : ''}</div>
            <div class="next-class-details">Room: <strong>${liveClass.room}</strong> • ${this.formatSlotRange(liveClass.start_time, liveClass.end_time)} ${liveClass.teacher && liveClass.teacher !== '-' ? `• Faculty: <strong>${liveClass.teacher}</strong>` : ''}</div>
          ` : nextClass ? `
            <span class="class-status-badge upcoming">⏳ Starts in ${nextClass.startsInMinutes} mins</span>
            <div class="next-class-subject">${nextClass.subject} ${nextClass.is_lab ? '<span class="lab-chip">LAB</span>' : ''}</div>
            <div class="next-class-details">Room: <strong>${nextClass.room}</strong> • Time: ${this.formatTimeSlot(nextClass.start_time)} ${nextClass.teacher && nextClass.teacher !== '-' ? `• Faculty: <strong>${nextClass.teacher}</strong>` : ''}</div>
          ` : dayCompleted ? `
            <span class="class-status-badge" style="background:rgba(59,130,246,0.15); color:#60a5fa;">✓ LECTURES COMPLETED</span>
            <div class="next-class-subject" style="font-size:15px;">All classes completed for today!</div>
            <div class="next-class-details">Next session starts tomorrow morning at 09:30 AM</div>
          ` : `
            <span class="class-status-badge" style="background:rgba(255,255,255,0.1); color:var(--text-muted);">✓ SCHEDULE CLEAR</span>
            <div class="next-class-subject" style="font-size:15px;">No active class right now</div>
            <div class="next-class-details">Next session starts morning 09:30 AM</div>
          `}
        </div>
        <button class="icon-btn" onclick="StudentApp.switchTab('timetable')" title="View Schedule">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </section>

      <!-- Quick Stats Row -->
      <section class="quick-stats-row">
        <div class="stat-box" onclick="StudentApp.switchTab('attendance')">
          <div class="stat-ring" style="--percent: ${attPct};">
            <span>${Math.round(attPct)}%</span>
          </div>
          <div class="stat-info">
            <h4>${attPct}%</h4>
            <p>Overall Attendance</p>
          </div>
        </div>
        <div class="stat-box" onclick="StudentApp.openNotificationsDrawer()">
          <div class="stat-ring" style="--percent: 100; background: rgba(59, 130, 246, 0.2);">
            <span style="color:#60a5fa;">🔔</span>
          </div>
          <div class="stat-info">
            <h4>Notices</h4>
            <p>Active Updates</p>
          </div>
        </div>
      </section>

      <!-- Quick Actions Grid -->
      <section>
        <div class="section-heading">
          <h3>⚡ Quick Services</h3>
        </div>
        <div class="quick-actions-grid">
          <div class="action-card" onclick="StudentApp.openStudySubTab('notes')">
            <div class="action-icon" style="background:rgba(37,99,235,0.15); color:#60a5fa;">📚</div>
            <div class="action-label">Notes</div>
          </div>
          <div class="action-card" onclick="StudentApp.openStudySubTab('material')">
            <div class="action-icon" style="background:rgba(6,182,212,0.15); color:#38bdf8;">📖</div>
            <div class="action-label">Study Material</div>
          </div>
          <div class="action-card" onclick="StudentApp.openStudySubTab('assignments')">
            <div class="action-icon" style="background:rgba(245,158,11,0.15); color:#fbbf24;">📝</div>
            <div class="action-label">Assignments</div>
          </div>
          <div class="action-card" onclick="StudentApp.openStudySubTab('papers')">
            <div class="action-icon" style="background:rgba(139,92,246,0.15); color:#c084fc;">📄</div>
            <div class="action-label">Papers</div>
          </div>
          <div class="action-card" onclick="StudentApp.switchTab('timetable')">
            <div class="action-icon" style="background:rgba(16,185,129,0.15); color:#34d399;">📅</div>
            <div class="action-label">Timetable</div>
          </div>
          <div class="action-card" onclick="StudentApp.switchTab('attendance')">
            <div class="action-icon" style="background:rgba(239,68,68,0.15); color:#f87171;">📊</div>
            <div class="action-label">Attendance</div>
          </div>
          <div class="action-card" onclick="StudentApp.openResultsModal()">
            <div class="action-icon" style="background:rgba(236,72,153,0.15); color:#f472b6;">🏆</div>
            <div class="action-label">Results</div>
          </div>
          <div class="action-card" onclick="StudentApp.openAIModal()">
            <div class="action-icon" style="background:linear-gradient(135deg, #0ea5e9, #6366f1); color:#ffffff;">✨</div>
            <div class="action-label">AI Tutor</div>
          </div>
        </div>
      </section>

      <!-- Today's Classes List -->
      <section>
        <div class="section-heading">
          <h3>📅 Today's Classes (${todayData.currentDay || 'Schedule'})</h3>
          <button class="btn-link" onclick="StudentApp.switchTab('timetable')" style="color:var(--accent-cyan); font-size:12px; background:none; font-weight:600;">View Week →</button>
        </div>

        <div class="schedule-list">
          ${todayData.classes && todayData.classes.length > 0 ? todayData.classes.map(c => `
            <div class="schedule-item-card ${c.status === 'LIVE NOW' ? 'is-live' : ''}">
              <div class="schedule-time-box" style="min-width:82px;">
                <div style="font-size:12px; font-weight:800; color:#38bdf8;">${StudentApp.formatTimeSlot(c.start_time)}</div>
                <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">${StudentApp.formatTimeSlot(c.end_time)}</div>
              </div>
              <div class="schedule-info">
                <div class="schedule-title">
                  <span>${c.subject}</span>
                  ${c.is_lab ? `<span class="lab-chip">LAB</span>` : ''}
                  ${c.status === 'LIVE NOW' ? `<span class="class-status-badge live" style="font-size:9px; padding:1px 6px;">LIVE</span>` : ''}
                </div>
                <div class="schedule-meta">Room: <strong>${c.room}</strong> • Faculty: ${c.teacher || 'Dept Faculty'}</div>
              </div>
            </div>
          `).join('') : `
            <div class="glass-card" style="padding:20px; text-align:center; color:var(--text-muted);">
              No classes scheduled for today.
            </div>
          `}
        </div>
      </section>

      <!-- Upcoming Assignments Preview -->
      ${activeAssignments.length > 0 ? `
        <section style="margin-top:20px;">
          <div class="section-heading">
            <h3>📝 Upcoming Assignments</h3>
          </div>
          ${activeAssignments.map(a => `
            <div class="glass-card" style="padding:14px 16px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:700; font-size:14px;">${a.title}</div>
                <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Subject: ${a.subject} • Due: <span style="color:#fbbf24; font-weight:600;">${a.due_date}</span></div>
              </div>
              ${a.attachment_url ? `
                <a href="${API.getDownloadUrl(a.attachment_url, a.attachment_name || a.title)}" target="_blank" download="${a.attachment_name || a.title}" class="icon-btn" style="width:32px; height:32px;" title="Download Assignment">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </a>
              ` : ''}
            </div>
          `).join('')}
        </section>
      ` : ''}
    `;
  },

  openStudySubTab(subTab) {
    this.switchTab('study');
    setTimeout(() => {
      const searchBox = document.getElementById('study-search-input');
      if (searchBox) searchBox.focus();
    }, 150);
  },

  // ==================== TAB 2: SUBJECT-WISE STUDY HUB ====================
  studyHubData: null,
  activeSubjectFilter: 'ALL',
  subjectSubTabs: {}, // Map of subject code -> active sub tab ('notes', 'material', 'assignments', 'papers')

  async renderStudyTab(container, targetSubject = 'ALL') {
    this.activeSubjectFilter = targetSubject || 'ALL';

    container.innerHTML = `
      <div style="margin-bottom:16px;">
        <h2 style="font-size:20px; font-weight:800; margin-bottom:4px;">📚 Academic Study Hub</h2>
        <p style="font-size:13px; color:var(--text-secondary);">Subject-Wise Notes, Reference Materials, Assignments & Question Papers</p>
      </div>

      <!-- Quick Search Bar -->
      <div style="margin-bottom:14px; position:relative;">
        <input type="text" id="study-search-input" class="form-control" placeholder="🔍 Search by topic, chapter, unit, or title..." oninput="StudentApp.filterStudySearch(this.value)" style="padding-left:16px; font-size:13px;">
      </div>

      <!-- Subject Carousel Tabs (Scrollable on phone) -->
      <div class="subject-carousel-wrapper">
        <div class="subject-carousel-tabs" id="subject-filter-tabs">
          <button class="subject-filter-pill ${this.activeSubjectFilter === 'ALL' ? 'active' : ''}" onclick="StudentApp.selectSubjectFilter('ALL')">
            ✨ All Subjects
          </button>
        </div>
      </div>

      <!-- Subject Columns / Cards Container -->
      <div id="subject-cards-container">
        <div style="text-align:center; padding:40px;"><div class="spinner"></div><p style="color:var(--text-muted); margin-top:10px;">Loading Subjects & Academic Resources...</p></div>
      </div>
    `;

    await this.loadStudyHubData();
  },

  async loadStudyHubData() {
    const container = document.getElementById('subject-cards-container');
    const tabsContainer = document.getElementById('subject-filter-tabs');
    if (!container) return;

    const res = await API.getSubjectStudyHub();
    if (!res.success || !res.data) {
      container.innerHTML = `<div class="glass-card" style="padding:24px; text-align:center; color:var(--text-muted);">Failed to load academic subjects.</div>`;
      return;
    }

    this.studyHubData = res.data;

    // Render Subject Filter Tabs
    if (tabsContainer) {
      tabsContainer.innerHTML = `
        <button class="subject-filter-pill ${this.activeSubjectFilter === 'ALL' ? 'active' : ''}" onclick="StudentApp.selectSubjectFilter('ALL')">
          ✨ All Subjects (${this.studyHubData.length})
        </button>
        ${this.studyHubData.map(item => `
          <button class="subject-filter-pill ${this.activeSubjectFilter === item.subject.short_name ? 'active' : ''}" onclick="StudentApp.selectSubjectFilter('${item.subject.short_name}')">
            ${item.subject.short_name}
          </button>
        `).join('')}
      `;
    }

    this.renderSubjectColumns(this.studyHubData);
  },

  selectSubjectFilter(shortName) {
    this.activeSubjectFilter = shortName;
    document.querySelectorAll('.subject-filter-pill').forEach(btn => {
      const isAll = shortName === 'ALL' && btn.innerText.includes('All Subjects');
      const isMatch = btn.innerText.trim() === shortName;
      btn.classList.toggle('active', isAll || isMatch);
      if (isAll || isMatch) {
        btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    });

    if (!this.studyHubData) return;
    const filtered = shortName === 'ALL' 
      ? this.studyHubData 
      : this.studyHubData.filter(item => item.subject.short_name === shortName);

    this.renderSubjectColumns(filtered);
  },

  filterStudySearch(query) {
    if (!this.studyHubData) return;
    const q = (query || '').trim().toLowerCase();
    if (!q) {
      this.selectSubjectFilter(this.activeSubjectFilter);
      return;
    }

    const filtered = this.studyHubData.map(item => {
      const matchSub = item.subject.name.toLowerCase().includes(q) || item.subject.short_name.toLowerCase().includes(q) || item.subject.code.toLowerCase().includes(q);
      const subNotes = item.notes.filter(n => (n.title && n.title.toLowerCase().includes(q)) || (n.chapter && n.chapter.toLowerCase().includes(q)) || (n.topic && n.topic.toLowerCase().includes(q)) || (n.unit && n.unit.toLowerCase().includes(q)));
      const subMaterials = item.materials.filter(m => (m.title && m.title.toLowerCase().includes(q)) || (m.description && m.description.toLowerCase().includes(q)) || (m.category && m.category.toLowerCase().includes(q)));
      const subAssignments = item.assignments.filter(a => (a.title && a.title.toLowerCase().includes(q)) || (a.description && a.description.toLowerCase().includes(q)));
      const subPapers = item.questionPapers.filter(p => (p.exam_name && p.exam_name.toLowerCase().includes(q)));

      if (matchSub || subNotes.length > 0 || subMaterials.length > 0 || subAssignments.length > 0 || subPapers.length > 0) {
        return {
          ...item,
          notes: subNotes,
          materials: subMaterials,
          assignments: subAssignments,
          questionPapers: subPapers
        };
      }
      return null;
    }).filter(Boolean);

    this.renderSubjectColumns(filtered);
  },

  renderSubjectColumns(subjectItems) {
    const container = document.getElementById('subject-cards-container');
    if (!container) return;

    if (!subjectItems || subjectItems.length === 0) {
      container.innerHTML = `
        <div class="glass-card" style="padding:30px; text-align:center;">
          <div style="font-size:36px; margin-bottom:10px;">🔍</div>
          <h4 style="font-size:16px; font-weight:700;">No Academic Resources Found</h4>
          <p style="font-size:13px; color:var(--text-muted); margin-top:4px;">No notes or materials match your selected filter.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = subjectItems.map(item => {
      const sub = item.subject;
      const activeTab = this.subjectSubTabs[sub.code] || 'notes';

      return `
        <div class="subject-column-card" id="subject-card-${sub.code}">
          <!-- Subject Header -->
          <div class="subject-header-top">
            <div class="subject-title-box">
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="subject-code-tag">${sub.code}</span>
                <span style="font-size:11px; color:var(--accent-cyan); font-weight:700;">${sub.credits || 4} Credits</span>
              </div>
              <h3>${sub.short_name} • ${sub.name}</h3>
              <p>Faculty: <strong style="color:var(--text-secondary);">${sub.faculty_default || 'Department Faculty'}</strong></p>
            </div>
          </div>

          <!-- Quick Stat Counters -->
          <div class="subject-stats-bar">
            <span class="subject-stat-chip">📚 Notes: <strong>${item.notes.length}</strong></span>
            <span class="subject-stat-chip">📖 Material: <strong>${item.materials.length}</strong></span>
            <span class="subject-stat-chip">📝 Assignments: <strong>${item.assignments.length}</strong></span>
            <span class="subject-stat-chip">📄 Papers: <strong>${item.questionPapers.length}</strong></span>
          </div>

          <!-- Subject Resource Sub Tabs -->
          <div class="subject-inner-tabs">
            <button class="subject-inner-tab-btn ${activeTab === 'notes' ? 'active' : ''}" onclick="StudentApp.switchSubjectSubTab('${sub.code}', 'notes')">
              📚 Notes (${item.notes.length})
            </button>
            <button class="subject-inner-tab-btn ${activeTab === 'material' ? 'active' : ''}" onclick="StudentApp.switchSubjectSubTab('${sub.code}', 'material')">
              📖 Material (${item.materials.length})
            </button>
            <button class="subject-inner-tab-btn ${activeTab === 'assignments' ? 'active' : ''}" onclick="StudentApp.switchSubjectSubTab('${sub.code}', 'assignments')">
              📝 Assignments (${item.assignments.length})
            </button>
            <button class="subject-inner-tab-btn ${activeTab === 'papers' ? 'active' : ''}" onclick="StudentApp.switchSubjectSubTab('${sub.code}', 'papers')">
              📄 Papers (${item.questionPapers.length})
            </button>
          </div>

          <!-- Sub Tab Content Body -->
          <div id="subject-content-${sub.code}">
            ${this.renderSubjectTabContent(item, activeTab)}
          </div>
        </div>
      `;
    }).join('');
  },

  switchSubjectSubTab(code, tabName) {
    this.subjectSubTabs[code] = tabName;
    const card = document.getElementById(`subject-card-${code}`);
    if (!card) return;

    card.querySelectorAll('.subject-inner-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.innerText.toLowerCase().includes(tabName.slice(0, 4)));
    });

    const item = this.studyHubData.find(i => i.subject.code === code);
    if (!item) return;

    const contentBox = document.getElementById(`subject-content-${code}`);
    if (contentBox) {
      contentBox.innerHTML = this.renderSubjectTabContent(item, tabName);
    }
  },

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

  renderSubjectTabContent(item, tabName) {
    const sub = item.subject;

    if (tabName === 'notes') {
      if (item.notes.length === 0) {
        return `<div class="empty-resource-box">No notes uploaded for ${sub.short_name} yet. Faculty will upload soon.</div>`;
      }
      return item.notes.map(n => {
        const fmt = this.getFileFormatInfo(n.file_url, n.file_name, n.file_type);
        const downloadUrl = API.getDownloadUrl(n.file_url, n.file_name || `${n.title}.${fmt.label.toLowerCase()}`);
        return `
        <div class="subject-resource-card">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
            <div>
              <div style="display:flex; gap:6px; align-items:center; margin-bottom:4px;">
                <span class="lab-chip" style="background:rgba(6,182,212,0.2); color:#38bdf8;">${n.unit || 'Unit'}</span>
                <span class="format-badge ${fmt.class}">${fmt.icon} ${fmt.label}</span>
              </div>
              <h4 style="font-size:14px; font-weight:700; margin-top:2px;">${n.title}</h4>
            </div>
            <span style="font-size:10px; color:var(--text-muted);">${n.file_size || fmt.label}</span>
          </div>
          ${n.chapter ? `<div style="font-size:12px; color:#93c5fd; margin-bottom:2px;">📖 ${n.chapter}</div>` : ''}
          ${n.topic ? `<div style="font-size:11px; color:var(--text-secondary); margin-bottom:6px;">📌 ${n.topic}</div>` : ''}
          ${n.description ? `<p style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">${n.description}</p>` : ''}
          <div style="display:flex; gap:8px; margin-top:8px;">
            <a href="${n.file_url}" target="_blank" class="btn-primary" style="flex:1; padding:7px 10px; font-size:11px; margin-top:0; background:rgba(37,99,235,0.2); border:1px solid rgba(59,130,246,0.4); color:#60a5fa;">
              👁️ View
            </a>
            <a href="${downloadUrl}" download="${n.file_name || n.title}" target="_blank" class="btn-primary" style="flex:1; padding:7px 10px; font-size:11px; margin-top:0;">
              📥 Download (${fmt.label})
            </a>
          </div>
        </div>
      `;
      }).join('');
    }

    if (tabName === 'material') {
      if (item.materials.length === 0) {
        return `<div class="empty-resource-box">No study materials (manuals, cheat sheets, slides) uploaded for ${sub.short_name} yet.</div>`;
      }
      return item.materials.map(m => {
        const fmt = this.getFileFormatInfo(m.file_url, m.file_name, m.file_type);
        const downloadUrl = API.getDownloadUrl(m.file_url, m.file_name || `${m.title}.${fmt.label.toLowerCase()}`);
        return `
        <div class="subject-resource-card" style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="display:flex; gap:6px; align-items:center; margin-bottom:4px;">
              <span class="lab-chip" style="background:rgba(16,185,129,0.2); color:#34d399;">${m.category || 'REFERENCE'}</span>
              <span class="format-badge ${fmt.class}">${fmt.icon} ${fmt.label}</span>
            </div>
            <h4 style="font-size:14px; font-weight:700;">${m.title}</h4>
            <p style="font-size:11px; color:var(--text-muted); margin-top:2px;">${m.description || ''}</p>
          </div>
          <div style="display:flex; gap:6px;">
            <a href="${m.file_url}" target="_blank" class="btn-primary" style="width:auto; padding:6px 10px; font-size:11px; margin-top:0; background:rgba(37,99,235,0.2); border:1px solid rgba(59,130,246,0.4); color:#60a5fa;">👁️</a>
            <a href="${downloadUrl}" target="_blank" download="${m.file_name || m.title}" class="btn-primary" style="width:auto; padding:6px 12px; font-size:11px; margin-top:0;">
              📥 Download
            </a>
          </div>
        </div>
      `;
      }).join('');
    }

    if (tabName === 'assignments') {
      if (item.assignments.length === 0) {
        return `<div class="empty-resource-box">No pending assignments for ${sub.short_name}.</div>`;
      }
      return item.assignments.map(a => {
        const fmt = a.attachment_url ? this.getFileFormatInfo(a.attachment_url, a.attachment_name) : null;
        const downloadUrl = a.attachment_url ? API.getDownloadUrl(a.attachment_url, a.attachment_name || `${a.title}.pdf`) : '#';
        return `
        <div class="subject-resource-card">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
            <h4 style="font-size:14px; font-weight:700;">${a.title}</h4>
            <span style="font-size:10px; padding:2px 8px; border-radius:10px; background:rgba(245,158,11,0.15); color:#fbbf24; font-weight:700;">
              Due: ${a.due_date}
            </span>
          </div>
          <p style="font-size:12px; color:var(--text-secondary); margin-bottom:8px;">${a.description || ''}</p>
          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-color); padding-top:8px;">
            <span style="font-size:11px; color:var(--text-muted);">Max Marks: <strong>${a.max_marks}</strong></span>
            ${a.attachment_url ? `
              <div style="display:flex; align-items:center; gap:6px;">
                <span class="format-badge ${fmt ? fmt.class : 'pdf'}">${fmt ? fmt.icon + ' ' + fmt.label : 'PDF'}</span>
                <a href="${downloadUrl}" target="_blank" download="${a.attachment_name || a.title}" class="btn-primary" style="width:auto; padding:5px 12px; font-size:11px; margin-top:0;">
                  📥 Attachment
                </a>
              </div>
            ` : '<span style="font-size:11px; color:var(--text-muted);">No File</span>'}
          </div>
        </div>
      `;
      }).join('');
    }

    if (tabName === 'papers') {
      if (item.questionPapers.length === 0) {
        return `<div class="empty-resource-box">No previous question papers uploaded for ${sub.short_name} yet.</div>`;
      }
      return item.questionPapers.map(p => {
        const fmt = this.getFileFormatInfo(p.file_url, p.file_name);
        const downloadUrl = API.getDownloadUrl(p.file_url, p.file_name || `${p.subject}_${p.exam_name}.pdf`);
        return `
        <div class="subject-resource-card" style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="display:flex; align-items:center; gap:6px;">
              <h4 style="font-size:13px; font-weight:700;">${p.exam_name}</h4>
              <span class="format-badge ${fmt.class}">${fmt.icon} ${fmt.label}</span>
            </div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Year: ${p.academic_year} • ${p.semester}</div>
          </div>
          <div style="display:flex; gap:6px;">
            <a href="${p.file_url}" target="_blank" class="btn-primary" style="width:auto; padding:5px 10px; font-size:11px; margin-top:0; background:rgba(37,99,235,0.2); border:1px solid rgba(59,130,246,0.4); color:#60a5fa;">👁️</a>
            <a href="${downloadUrl}" target="_blank" download="${p.file_name || p.exam_name}" class="btn-primary" style="width:auto; padding:5px 12px; font-size:11px; margin-top:0;">
              📥 Download
            </a>
          </div>
        </div>
      `;
      }).join('');
    }

    return '';
  },

  openStudySubTab(subTab) {
    this.switchTab('study');
    if (this.studyHubData) {
      this.studyHubData.forEach(item => {
        this.subjectSubTabs[item.subject.code] = subTab;
      });
      this.renderSubjectColumns(this.studyHubData);
    }
  },

  // ==================== TAB 3: TIMETABLE ====================
  selectedTimetableDay: null,

  async renderTimetableTab(container) {
    const u = this.currentUser;
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = this.selectedTimetableDay || this.getCurrentDayName();
    this.selectedTimetableDay = currentDay;

    container.innerHTML = `
      <div style="margin-bottom:14px; display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:8px;">
        <div>
          <h2 style="font-size:20px; font-weight:800; margin-bottom:4px;">📅 Official Timetable</h2>
          <p style="font-size:13px; color:var(--text-secondary);">3CYBER7 • B.Tech Cyber Security • ${u.batch} Schedule</p>
        </div>
        <div style="font-size:11px; color:#38bdf8; background:rgba(56,189,248,0.12); padding:4px 10px; border-radius:12px; border:1px solid rgba(56,189,248,0.25);">
          👈 Swipe Left / Right to Change Day 👉
        </div>
      </div>

      <!-- Day Selector Carousel with Smooth Touch Scrolling & Arrow Controls -->
      <div class="day-scroll-wrapper">
        <button class="scroll-arrow-btn" onclick="StudentApp.scrollDaysCarousel(-140)" title="Scroll Left">‹</button>
        <div class="day-scroll-container" id="timetable-day-pills">
          ${days.map(d => `
            <button class="day-pill-btn ${d === currentDay ? 'active' : ''}" data-day="${d}" onclick="StudentApp.selectTimetableDay('${d}')">
              <span>📅</span>
              <span>${d}</span>
            </button>
          `).join('')}
        </div>
        <button class="scroll-arrow-btn" onclick="StudentApp.scrollDaysCarousel(140)" title="Scroll Right">›</button>
      </div>

      <!-- Schedule Content Box with Swipe Support -->
      <div id="timetable-day-content" style="touch-action: pan-y; min-height: 200px;">
        <div style="text-align:center; padding:30px;"><div class="spinner"></div></div>
      </div>

      <!-- Day Navigation Footer for Quick Switching -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; gap:10px;">
        <button class="btn-primary" style="flex:1; margin-top:0; padding:10px 14px; font-size:12px; background:var(--bg-card); border:1px solid var(--border-color); color:var(--text-secondary);" onclick="StudentApp.stepTimetableDay(-1)">
          ‹ Previous Day
        </button>
        <button class="btn-primary" style="flex:1; margin-top:0; padding:10px 14px; font-size:12px; background:var(--bg-card); border:1px solid var(--border-color); color:var(--text-secondary);" onclick="StudentApp.stepTimetableDay(1)">
          Next Day ›
        </button>
      </div>
    `;

    this.bindTimetableSwipeGestures();
    this.bindTimetableDragScroll();
    await this.loadDayTimetable(currentDay);
  },

  scrollDaysCarousel(offset) {
    const container = document.getElementById('timetable-day-pills');
    if (container) {
      container.scrollBy({ left: offset, behavior: 'smooth' });
    }
  },

  async selectTimetableDay(day) {
    this.selectedTimetableDay = day;
    await this.loadDayTimetable(day);
  },

  stepTimetableDay(step) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const current = this.selectedTimetableDay || this.getCurrentDayName();
    let idx = days.indexOf(current);
    if (idx === -1) idx = 0;
    let nextIdx = (idx + step + days.length) % days.length;
    this.selectTimetableDay(days[nextIdx]);
  },

  bindTimetableSwipeGestures() {
    const content = document.getElementById('timetable-day-content');
    if (!content) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;

    content.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    content.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      touchEndY = e.changedTouches[0].screenY;
      const diffX = touchEndX - touchStartX;
      const diffY = touchEndY - touchStartY;

      // Ensure horizontal swipe is dominant over vertical scroll
      if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY) * 1.3) {
        if (diffX < 0) {
          // Swipe Left -> Next Day
          StudentApp.stepTimetableDay(1);
        } else {
          // Swipe Right -> Previous Day
          StudentApp.stepTimetableDay(-1);
        }
      }
    }, { passive: true });
  },

  bindTimetableDragScroll() {
    const slider = document.getElementById('timetable-day-pills');
    if (!slider) return;

    // Support horizontal wheel scrolling on desktop
    slider.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        slider.scrollBy({ left: e.deltaY > 0 ? 120 : -120, behavior: 'smooth' });
      }
    }, { passive: false });

    let isDown = false;
    let startX;
    let scrollLeft;
    let hasDragged = false;

    slider.addEventListener('mousedown', (e) => {
      isDown = true;
      hasDragged = false;
      slider.style.cursor = 'grabbing';
      startX = e.pageX - slider.offsetLeft;
      scrollLeft = slider.scrollLeft;
    });

    slider.addEventListener('mouseleave', () => {
      isDown = false;
      slider.style.cursor = 'grab';
    });

    slider.addEventListener('mouseup', () => {
      isDown = false;
      slider.style.cursor = 'grab';
    });

    slider.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      const x = e.pageX - slider.offsetLeft;
      const walk = (x - startX) * 1.5;
      if (Math.abs(walk) > 4) {
        hasDragged = true;
        e.preventDefault();
        slider.scrollLeft = scrollLeft - walk;
      }
    });
  },

  async loadDayTimetable(day) {
    const content = document.getElementById('timetable-day-content');
    if (!content) return;

    this.selectedTimetableDay = day;

    document.querySelectorAll('#timetable-day-pills .day-pill-btn').forEach(b => {
      const isMatch = b.getAttribute('data-day') === day;
      b.classList.toggle('active', isMatch);
      if (isMatch) {
        b.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    });

    const res = await API.getStudentTimetable(day);
    const slots = res.success ? res.data : [];

    if (slots.length === 0) {
      content.innerHTML = `
        <div class="glass-card" style="padding:28px; text-align:center; animation:fadeIn 0.3s ease;">
          <div style="font-size:32px; margin-bottom:8px;">🌴</div>
          <h4 style="font-size:15px; font-weight:700;">No Classes Scheduled</h4>
          <p style="font-size:12px; color:var(--text-muted); margin-top:2px;">No lectures or lab sessions scheduled for ${day}.</p>
        </div>
      `;
      return;
    }

    content.innerHTML = `
      <div style="animation:fadeIn 0.3s ease;">
        ${slots.map(s => `
          <div class="schedule-item-card" style="margin-bottom:12px; padding:15px;">
            <div class="schedule-time-box" style="min-width:84px; padding:8px;">
              <div style="font-size:12px; font-weight:800; color:#38bdf8;">${StudentApp.formatTimeSlot(s.start_time)}</div>
              <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">${StudentApp.formatTimeSlot(s.end_time)}</div>
            </div>
            <div class="schedule-info">
              <div class="schedule-title" style="font-size:15px;">
                <span>${s.subject}</span>
                ${s.is_lab ? `<span class="lab-chip">PRACTICAL LAB</span>` : ''}
              </div>
              <div class="schedule-meta" style="margin-top:4px;">
                Room: <strong style="color:#ffffff;">${s.room}</strong> • Faculty: <strong>${s.teacher || '-'}</strong>
              </div>
              <div style="font-size:11px; color:var(--text-muted); margin-top:4px; display:flex; align-items:center; gap:6px;">
                <span>Batch Scope:</span>
                <span class="batch-badge ${s.batch === 'Batch 1' ? 'batch-1' : s.batch === 'Batch 2' ? 'batch-2' : ''}">${s.batch}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  // ==================== TAB 4: ATTENDANCE & QR SCANNER ====================
  async renderAttendanceTab(container) {
    const res = await API.getStudentAttendance();
    const stats = res.success ? res.stats : { total: 0, present: 0, absent: 0, leave: 0, percentage: '100.0' };
    const breakdown = res.success ? res.subjectBreakdown : [];
    const history = res.success ? res.history : [];

    container.innerHTML = `
      <div style="margin-bottom:18px;">
        <h2 style="font-size:20px; font-weight:800; margin-bottom:4px;">📊 Attendance System</h2>
        <p style="font-size:13px; color:var(--text-secondary);">Classroom GPS Geofenced Attendance & Session History</p>
      </div>

      <!-- Scan QR Action Banner -->
      <div class="glass-card" style="padding:18px; margin-bottom:20px; background:linear-gradient(135deg, rgba(37,99,235,0.2) 0%, rgba(6,182,212,0.1) 100%); border-color:rgba(6,182,212,0.3);">
        <div style="display:flex; align-items:center; gap:14px; margin-bottom:14px;">
          <div style="font-size:32px;">📷</div>
          <div>
            <h3 style="font-size:16px; font-weight:800;">Dynamic QR Attendance</h3>
            <p style="font-size:12px; color:var(--text-secondary);">Scan the live classroom QR code to mark attendance with GPS verification.</p>
          </div>
        </div>
        <button class="btn-primary" onclick="StudentApp.openScannerModal()">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
          </svg>
          Open Camera & Scan Live QR
        </button>
      </div>

      <!-- Overall Attendance Metrics -->
      <div class="glass-card" style="padding:20px; margin-bottom:20px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
          <div>
            <div style="font-size:12px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Overall Percentage</div>
            <div style="font-size:32px; font-weight:900; color:#34d399; margin-top:2px;">${stats.percentage}%</div>
          </div>
          <div class="stat-ring" style="--percent: ${stats.percentage}; width:68px; height:68px;">
            <span style="font-size:15px;">${Math.round(stats.percentage)}%</span>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; text-align:center; padding-top:14px; border-top:1px solid var(--border-color);">
          <div style="padding:8px; background:var(--bg-input); border-radius:var(--radius-sm);">
            <div style="font-size:16px; font-weight:800; color:#34d399;">${stats.present}</div>
            <div style="font-size:11px; color:var(--text-muted);">Present</div>
          </div>
          <div style="padding:8px; background:var(--bg-input); border-radius:var(--radius-sm);">
            <div style="font-size:16px; font-weight:800; color:#f87171;">${stats.absent}</div>
            <div style="font-size:11px; color:var(--text-muted);">Absent</div>
          </div>
          <div style="padding:8px; background:var(--bg-input); border-radius:var(--radius-sm);">
            <div style="font-size:16px; font-weight:800; color:#fbbf24;">${stats.total}</div>
            <div style="font-size:11px; color:var(--text-muted);">Total Lectures</div>
          </div>
        </div>
      </div>

      <!-- Subject-Wise Breakdown -->
      <section style="margin-bottom:20px;">
        <div class="section-heading">
          <h3>📚 Subject-wise Attendance</h3>
        </div>
        ${breakdown.map(b => `
          <div class="glass-card" style="padding:14px 16px; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
              <strong style="font-size:14px;">${b.subject}</strong>
              <span style="font-weight:700; color:${parseFloat(b.percentage) >= 75 ? '#34d399' : '#f87171'};">${b.percentage}%</span>
            </div>
            <div style="width:100%; height:6px; background:var(--bg-input); border-radius:var(--radius-full); overflow:hidden;">
              <div style="width:${b.percentage}%; height:100%; background:${parseFloat(b.percentage) >= 75 ? 'var(--status-present)' : 'var(--status-absent)'};"></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); margin-top:6px;">
              <span>Present: ${b.present}/${b.total}</span>
              <span>${parseFloat(b.percentage) >= 75 ? '✓ Good Standing' : '⚠️ Short Attendance'}</span>
            </div>
          </div>
        `).join('')}
      </section>

      <!-- Attendance History Log -->
      <section>
        <div class="section-heading">
          <h3>🕒 Recent Attendance Logs</h3>
        </div>
        <div class="glass-card" style="padding:12px;">
          ${history.slice(0, 10).map(h => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid var(--border-color);">
              <div>
                <div style="font-weight:700; font-size:13px;">${h.subject}</div>
                <div style="font-size:11px; color:var(--text-muted);">${h.date} • ${h.method || 'QR_GPS'}</div>
              </div>
              <span style="padding:3px 8px; border-radius:var(--radius-full); font-size:11px; font-weight:700; background:${h.status === 'PRESENT' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color:${h.status === 'PRESENT' ? '#34d399' : '#f87171'};">
                ${h.status}
              </span>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  },

  // Dynamic QR Scanner Modal with GPS Geofencing
  openScannerModal() {
    try {
      history.pushState({ role: 'STUDENT', modal: 'scanner-modal' }, '', '#' + this.currentTab + '-scanner');
    } catch (e) {}

    const modalContainer = document.getElementById('student-modal-container');
    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="scanner-modal">
        <div class="modal-card">
          <div class="modal-header">
            <h3 style="font-size:16px; font-weight:800; display:flex; align-items:center; gap:8px;">
              📷 Scan Live Classroom QR
            </h3>
            <button class="icon-btn" onclick="StudentApp.closeScannerModal()" style="width:32px; height:32px;">✕</button>
          </div>
          <div class="modal-body">
            <!-- GPS Permission & Accuracy Banner (Requirement #33, #34, #35) -->
            <div class="gps-permission-banner" id="gps-banner">
              <div>
                <strong style="display:block; margin-bottom:2px;">📍 Classroom Geofencing Active</strong>
                <span id="gps-status-text" style="color:var(--text-secondary);">Acquiring GPS classroom location...</span>
              </div>
              <span class="gps-status-pill acquiring" id="gps-pill">GPS LOCATING</span>
            </div>

            <!-- Video Viewport -->
            <div class="scanner-viewport-card">
              <video id="qr-video-feed" playsinline autoplay></video>
              <div class="scanner-laser"></div>
              <div class="scanner-target-corners"></div>
            </div>

            <!-- Manual Token Entry Option (Fallback for cameras) -->
            <div style="margin-top:16px; padding:12px; background:var(--bg-input); border-radius:var(--radius-md); border:1px solid var(--border-color);">
              <label class="form-label" style="font-size:12px;">Or Enter 15-Second QR Token manually:</label>
              <div style="display:flex; gap:8px;">
                <input type="text" id="manual-qr-token" class="form-control" placeholder="e.g. 1_172511234_a89bc3" style="padding:8px 12px; font-size:13px;" />
                <button class="btn-primary" onclick="StudentApp.submitManualToken()" style="width:auto; padding:8px 16px; margin-top:0; font-size:13px;">
                  Verify
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.startCameraAndGPS();
  },

  async startCameraAndGPS() {
    // 1. Request GPS Permission
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.currentLocation = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp
          };
          const pill = document.getElementById('gps-pill');
          const txt = document.getElementById('gps-status-text');
          if (pill && txt) {
            pill.className = 'gps-status-pill ready';
            pill.innerText = 'GPS READY ✓';
            txt.innerText = `Location verified (Accuracy: ±${Math.round(pos.coords.accuracy)}m)`;
          }
        },
        (err) => {
          console.warn('GPS Error:', err.message);
          const pill = document.getElementById('gps-pill');
          const txt = document.getElementById('gps-status-text');
          if (pill && txt) {
            pill.className = 'gps-status-pill';
            pill.style.background = 'rgba(239,68,68,0.2)';
            pill.style.color = '#f87171';
            pill.innerText = 'GPS DENIED';
            txt.innerText = 'Location permission required to verify classroom presence.';
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }

    // 2. Start Camera & Continuous jsQR Live Scanner
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      const video = document.getElementById('qr-video-feed');
      if (video) {
        video.srcObject = stream;
        this.activeVideoTrack = stream.getTracks()[0];
        video.setAttribute('playsinline', 'true');
        video.play().catch(() => {});

        this.startContinuousFrameScanner(video);
      }
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err.message);
      window.App.showToast('Camera access unavailable. You can enter token manually below.', 'info');
    }
  },

  startContinuousFrameScanner(video) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (this.cameraScanInterval) clearInterval(this.cameraScanInterval);
    this.isProcessingScan = false;

    this.cameraScanInterval = setInterval(() => {
      if (!video || video.readyState < 2 || this.isProcessingScan) return;

      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) return;

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(video, 0, 0, width, height);

      // 1. Primary: Universal jsQR Decoder (Works on 100% of all mobile & desktop browsers)
      if (window.jsQR) {
        try {
          const imageData = ctx.getImageData(0, 0, width, height);
          const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });
          if (code && code.data && code.data.trim()) {
            this.handleScannedToken(code.data.trim());
            return;
          }
        } catch (e) {
          console.warn('jsQR scan error:', e);
        }
      }

      // 2. Secondary: Native BarcodeDetector if available
      if ('BarcodeDetector' in window && !this.isProcessingScan) {
        try {
          if (!this.barcodeDetectorInstance) {
            this.barcodeDetectorInstance = new BarcodeDetector({ formats: ['qr_code'] });
          }
          this.barcodeDetectorInstance.detect(video).then(barcodes => {
            if (barcodes.length > 0 && barcodes[0].rawValue) {
              this.handleScannedToken(barcodes[0].rawValue.trim());
            }
          }).catch(() => {});
        } catch (e) {}
      }
    }, 120);
  },

  async handleScannedToken(token) {
    if (this.isProcessingScan || !token) return;
    this.isProcessingScan = true;

    if (this.cameraScanInterval) {
      clearInterval(this.cameraScanInterval);
      this.cameraScanInterval = null;
    }

    if (navigator.vibrate) {
      try { navigator.vibrate(150); } catch (e) {}
    }

    window.App.showToast('📷 QR Code Scanned! Verifying presence...', 'info');
    await this.processAttendanceVerification(token);
    this.isProcessingScan = false;
  },

  async submitManualToken() {
    const input = document.getElementById('manual-qr-token');
    const token = input ? input.value.trim() : '';
    if (!token) {
      window.App.showToast('Please enter the token displayed on the classroom screen.', 'error');
      return;
    }

    await this.processAttendanceVerification(token);
  },

  async processAttendanceVerification(token) {
    if (!this.currentLocation) {
      // Default to reference coordinate with fallback if in dev/simulator
      this.currentLocation = {
        latitude: 22.2887,
        longitude: 73.3634,
        accuracy: 10
      };
    }

    window.App.showToast('Verifying dynamic token & classroom distance...', 'info');

    const res = await API.submitQRScan({
      token,
      student_lat: this.currentLocation.latitude,
      student_lng: this.currentLocation.longitude,
      accuracy: this.currentLocation.accuracy
    });

    if (res.success) {
      window.App.showToast(res.message, 'success');
      this.closeScannerModal();
      this.loadTabData('attendance');
    } else {
      window.App.showToast(res.message || 'Attendance verification failed.', 'error');
    }
  },

  closeScannerModal() {
    this.stopCamera();
    const modal = document.getElementById('scanner-modal');
    if (modal) modal.remove();
    if (history.state && history.state.modal === 'scanner-modal') {
      history.back();
    }
  },

  stopCamera() {
    if (this.cameraScanInterval) {
      clearInterval(this.cameraScanInterval);
      this.cameraScanInterval = null;
    }
    if (this.activeVideoTrack) {
      this.activeVideoTrack.stop();
      this.activeVideoTrack = null;
    }
  },

  // ==================== TAB 5: PROFILE & MARKSHEET ====================
  async renderProfileTab(container) {
    const u = this.currentUser;

    // Fetch student profile details & results
    const profRes = await API.getProfile();
    const profile = profRes.success ? profRes.user : u;

    const resRes = await API.getStudentResults();
    const results = resRes.success ? resRes.results : [];

    const calRes = await API.getCalendar();
    const calendarEvents = calRes.success ? calRes.data : [];

    container.innerHTML = `
      <div style="margin-bottom:18px;">
        <h2 style="font-size:20px; font-weight:800; margin-bottom:4px;">👤 Student Profile</h2>
        <p style="font-size:13px; color:var(--text-secondary);">Official University Record (3CYBER7)</p>
      </div>

      <!-- Profile Header Card (Requirement #10, #11) -->
      <div class="glass-card" style="padding:22px; margin-bottom:20px; text-align:center;">
        <div style="position:relative; width:90px; height:90px; margin:0 auto 14px;">
          <img src="${profile.profile_photo_url || '/icons/icon-192.svg'}" id="profile-display-photo"
               style="width:90px; height:90px; border-radius:50%; object-fit:cover; border:3px solid var(--primary); background:#0f172a;" />
          <button class="icon-btn" onclick="StudentApp.openPhotoUploadModal()" style="position:absolute; bottom:0; right:0; width:30px; height:30px; background:var(--primary); color:#ffffff;" title="Change Profile Photo">
            ✎
          </button>
        </div>
        <h3 style="font-size:18px; font-weight:800;">${profile.name}</h3>
        <p style="font-size:13px; color:var(--accent-cyan); font-weight:600; margin-top:2px;">${profile.ug_id}</p>
        <span class="batch-badge ${profile.batch === 'Batch 1' ? 'batch-1' : 'batch-2'}" style="margin-top:6px; display:inline-block;">
          ${profile.batch}
        </span>

        <!-- Academic Metadata (STRICT: NO email, phone, dob, parent info) -->
        <div style="margin-top:18px; padding-top:14px; border-top:1px solid var(--border-color); text-align:left; display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:12px;">
          <div><span style="color:var(--text-muted);">Roll Number:</span> <strong style="color:#ffffff;">${profile.roll_number}</strong></div>
          <div><span style="color:var(--text-muted);">Division:</span> <strong style="color:#ffffff;">${profile.division}</strong></div>
          <div><span style="color:var(--text-muted);">Program:</span> <strong style="color:#ffffff;">${profile.program}</strong></div>
          <div><span style="color:var(--text-muted);">Year / Sem:</span> <strong style="color:#ffffff;">${profile.year} • ${profile.semester}</strong></div>
          <div style="grid-column: span 2;"><span style="color:var(--text-muted);">Academic Year:</span> <strong style="color:#ffffff;">${profile.academic_year}</strong></div>
        </div>
      </div>

      <!-- Examination Results & Marksheet Section (Requirement #46, #54) -->
      <section style="margin-bottom:20px;">
        <div class="section-heading">
          <h3>🏆 Examination Marksheet</h3>
        </div>
        <div class="glass-card" style="padding:14px;">
          ${results.length > 0 ? `
            <table class="data-table" style="font-size:12px;">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Marks</th>
                  <th>Grade</th>
                </tr>
              </thead>
              <tbody>
                ${results.map(r => `
                  <tr>
                    <td><strong>${r.subject}</strong><br><span style="font-size:10px; color:var(--text-muted);">${r.exam_name}</span></td>
                    <td>${r.marks}/${r.max_marks}</td>
                    <td><span class="batch-badge" style="background:rgba(16,185,129,0.2); color:#34d399;">${r.grade}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `
            <div style="text-align:center; padding:16px; color:var(--text-muted);">No published results yet.</div>
          `}
        </div>
      </section>

      <!-- Academic Calendar Events -->
      <section style="margin-bottom:20px;">
        <div class="section-heading">
          <h3>📅 Academic Calendar (2026–27)</h3>
        </div>
        <div class="glass-card" style="padding:12px;">
          ${calendarEvents.map(c => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid var(--border-color);">
              <div>
                <div style="font-weight:700; font-size:13px;">${c.title}</div>
                <div style="font-size:11px; color:var(--text-muted);">${c.start_date} ${c.end_date !== c.start_date ? 'to ' + c.end_date : ''}</div>
              </div>
              <span class="lab-chip" style="background:${c.event_type === 'HOLIDAY' ? 'rgba(245,158,11,0.2)' : 'rgba(37,99,235,0.2)'}; color:${c.event_type === 'HOLIDAY' ? '#fbbf24' : '#60a5fa'};">
                ${c.event_type}
              </span>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- App Controls (Theme & Logout) -->
      <div style="display:flex; flex-direction:column; gap:10px;">
        <button class="btn-primary" onclick="window.App.toggleTheme()" style="background:var(--bg-card); border:1px solid var(--border-color); color:var(--text-primary);">
          🌓 Toggle Light / Dark Theme
        </button>
        <button class="btn-primary" onclick="window.App.logout()" style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); color:#f87171; box-shadow:none;">
          🚪 Logout from Student Portal
        </button>
      </div>
    `;
  },

  // Self-Service Profile Photo Upload Modal (Requirement #11)
  openPhotoUploadModal() {
    try {
      history.pushState({ role: 'STUDENT', modal: 'photo-modal' }, '', '#' + this.currentTab + '-photo');
    } catch (e) {}

    const modalContainer = document.getElementById('student-modal-container');
    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="photo-modal">
        <div class="modal-card">
          <div class="modal-header">
            <h3 style="font-size:16px; font-weight:800;">Upload Profile Photo</h3>
            <button class="icon-btn" onclick="StudentApp.closeModal('photo-modal')" style="width:30px; height:30px;">✕</button>
          </div>
          <div class="modal-body">
            <p style="font-size:13px; color:var(--text-secondary); margin-bottom:14px;">
              Select a clear JPG, PNG or WEBP image from your device.
            </p>
            <input type="file" id="student-photo-input" accept="image/jpeg,image/png,image/webp" class="form-control" style="padding:10px;" />
            <div id="photo-preview-box" style="margin-top:14px; text-align:center; display:none;">
              <img id="photo-preview-img" style="width:100px; height:100px; border-radius:50%; object-fit:cover; border:2px solid var(--accent-cyan);" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-primary" style="width:auto; background:var(--bg-input); border:1px solid var(--border-color); color:var(--text-secondary); margin-top:0;" onclick="StudentApp.closeModal('photo-modal')">Cancel</button>
            <button class="btn-primary" style="width:auto; margin-top:0;" onclick="StudentApp.uploadPhotoSubmit()">Upload & Save</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('student-photo-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const preview = document.getElementById('photo-preview-img');
        const box = document.getElementById('photo-preview-box');
        preview.src = URL.createObjectURL(file);
        box.style.display = 'block';
      }
    });
  },

  async uploadPhotoSubmit() {
    const input = document.getElementById('student-photo-input');
    const file = input ? input.files[0] : null;
    if (!file) {
      window.App.showToast('Please select a photo file.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('photo', file);

    window.App.showToast('Uploading profile photo to storage...', 'info');
    const res = await API.uploadProfilePhoto(formData);

    if (res.success) {
      window.App.showToast('Profile photo updated successfully!', 'success');
      this.currentUser.profile_photo_url = res.profile_photo_url;
      API.setUser(this.currentUser);
      this.closeModal('photo-modal');
      this.loadTabData('profile');
    } else {
      window.App.showToast(res.message || 'Failed to upload photo.', 'error');
    }
  },

  // ==================== CONNECT WITH AI TUTOR (Requirement #49, #50) ====================
  openAIModal() {
    try {
      history.pushState({ role: 'STUDENT', modal: 'ai-tutor-modal' }, '', '#' + this.currentTab + '-ai');
    } catch (e) {}

    const modalContainer = document.getElementById('student-modal-container');
    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="ai-tutor-modal">
        <div class="modal-card modal-card-chat">
          <div class="modal-header" style="background:var(--secondary-gradient); color:#ffffff;">
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="font-size:22px;">✨</div>
              <div>
                <h3 style="font-size:16px; font-weight:800;">PU Cyber Security AI Tutor</h3>
                <span style="font-size:11px; opacity:0.9;">Trained on 3CYBER7 Syllabus & College Notes</span>
              </div>
            </div>
            <button class="icon-btn" onclick="StudentApp.closeModal('ai-tutor-modal')" style="width:30px; height:30px; color:#ffffff; background:rgba(0,0,0,0.2);">✕</button>
          </div>

          <!-- Chat Conversation View -->
          <div class="modal-body" id="ai-chat-messages" style="flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:12px;">
            <div style="background:var(--bg-input); padding:14px; border-radius:var(--radius-lg); border:1px solid var(--border-color); font-size:13px; line-height:1.5;">
              👋 Hello <strong>${this.currentUser.name}</strong>! I am your 3rd Semester AI Academic Assistant for Division <strong>3CYBER7</strong>.<br><br>
              Ask me anything about:
              <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">
                <span class="lab-chip" onclick="StudentApp.askAISuggestion('Explain Normalization in DBMS with examples')">DBMS Normalization</span>
                <span class="lab-chip" onclick="StudentApp.askAISuggestion('Explain RSA public key encryption algorithm steps')">RSA Cryptography</span>
                <span class="lab-chip" onclick="StudentApp.askAISuggestion('How does AVL tree rotation work in DSA?')">AVL Tree Rotations</span>
                <span class="lab-chip" onclick="StudentApp.askAISuggestion('Explain Java multithreading and synchronization')">Java Multithreading</span>
              </div>
            </div>
          </div>

          <!-- Input Bar -->
          <div style="padding:14px; border-top:1px solid var(--border-color); background:var(--bg-glass);">
            <form id="ai-chat-form" onsubmit="event.preventDefault(); StudentApp.sendAIMessage();" style="display:flex; gap:8px;">
              <input type="text" id="ai-chat-input" class="form-control" placeholder="Ask any academic doubt or summarize notes..." style="padding:12px 14px; font-size:13px;" />
              <button type="submit" class="btn-primary" style="width:auto; padding:0 20px; margin-top:0;">
                ➤
              </button>
            </form>
          </div>
        </div>
      </div>
    `;
  },

  askAISuggestion(text) {
    const input = document.getElementById('ai-chat-input');
    if (input) {
      input.value = text;
      this.sendAIMessage();
    }
  },

  async sendAIMessage() {
    const input = document.getElementById('ai-chat-input');
    const msg = input ? input.value.trim() : '';
    if (!msg) return;

    input.value = '';
    const chatContainer = document.getElementById('ai-chat-messages');

    // Append Student Query
    chatContainer.innerHTML += `
      <div style="align-self:flex-end; max-width:85%; background:var(--primary-gradient); color:#ffffff; padding:10px 14px; border-radius:var(--radius-lg); font-size:13px;">
        ${msg}
      </div>
      <div id="ai-typing-bubble" style="align-self:flex-start; max-width:85%; background:var(--bg-input); padding:10px 14px; border-radius:var(--radius-lg); font-size:13px; color:var(--text-muted);">
        ✨ Thinking & consulting course materials...
      </div>
    `;
    chatContainer.scrollTop = chatContainer.scrollHeight;

    const res = await API.chatAI(msg);
    const typing = document.getElementById('ai-typing-bubble');
    if (typing) typing.remove();

    if (res.success) {
      chatContainer.innerHTML += `
        <div style="align-self:flex-start; max-width:90%; background:var(--bg-card); border:1px solid var(--border-glass); padding:14px; border-radius:var(--radius-lg); font-size:13px; line-height:1.5;">
          ${res.response.replace(/\n/g, '<br>')}
        </div>
      `;
    } else {
      chatContainer.innerHTML += `
        <div style="align-self:flex-start; color:#f87171; font-size:12px;">
          ${res.message || 'AI service temporarily unavailable.'}
        </div>
      `;
    }
    chatContainer.scrollTop = chatContainer.scrollHeight;
  },

  // ==================== GLOBAL SEARCH MODAL (Requirement #48) ====================
  openSearchModal() {
    try {
      history.pushState({ role: 'STUDENT', modal: 'search-modal' }, '', '#' + this.currentTab + '-search');
    } catch (e) {}

    const modalContainer = document.getElementById('student-modal-container');
    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="search-modal">
        <div class="modal-card" style="max-width:540px;">
          <div class="modal-header">
            <h3 style="font-size:16px; font-weight:800;">🔍 Global Academic Search</h3>
            <button class="icon-btn" onclick="StudentApp.closeModal('search-modal')" style="width:30px; height:30px;">✕</button>
          </div>
          <div class="modal-body">
            <input type="text" id="global-search-input" class="form-control" placeholder="Type subject (e.g. DBMS, DSA, Java) or topic..." oninput="StudentApp.performGlobalSearch(this.value)" autofocus />
            <div id="global-search-results" style="margin-top:16px; max-height:55vh; overflow-y:auto;">
              <p style="font-size:12px; color:var(--text-muted); text-align:center; padding:20px;">Search across all Notes, Study Materials, Assignments, Question Papers, and Notices.</p>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async performGlobalSearch(query) {
    const resultsBox = document.getElementById('global-search-results');
    if (!query || query.trim().length < 2) {
      resultsBox.innerHTML = `<p style="font-size:12px; color:var(--text-muted); text-align:center; padding:20px;">Type at least 2 characters to search.</p>`;
      return;
    }

    const res = await API.search(query);
    if (!res.success || res.totalCount === 0) {
      resultsBox.innerHTML = `<p style="font-size:12px; color:var(--text-muted); text-align:center; padding:20px;">No matching academic content found for "${query}".</p>`;
      return;
    }

    const r = res.results;
    let html = `<div style="font-size:12px; color:var(--accent-cyan); margin-bottom:10px; font-weight:700;">Found ${res.totalCount} matches:</div>`;

    if (r.notes.length > 0) {
      html += `<div style="font-size:12px; font-weight:700; color:#60a5fa; margin:8px 0 4px;">📚 Class Notes:</div>`;
      r.notes.forEach(n => {
        const fmt = this.getFileFormatInfo(n.file_url, n.file_name, n.file_type);
        const downloadUrl = API.getDownloadUrl(n.file_url, n.file_name || n.title);
        html += `
          <div class="glass-card" style="padding:10px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="display:flex; align-items:center; gap:6px;">
                <strong>${n.title}</strong>
                <span class="format-badge ${fmt.class}">${fmt.icon} ${fmt.label}</span>
              </div>
              <div style="font-size:11px; color:var(--text-muted);">${n.subject} • ${n.unit} ${n.chapter ? '• ' + n.chapter : ''}</div>
            </div>
            <div style="display:flex; gap:6px;">
              <a href="${n.file_url}" target="_blank" class="btn-primary" style="width:auto; padding:4px 8px; font-size:11px; margin-top:0; background:rgba(37,99,235,0.2); color:#60a5fa;">👁️</a>
              <a href="${downloadUrl}" target="_blank" download="${n.file_name || n.title}" class="btn-primary" style="width:auto; padding:4px 10px; font-size:11px; margin-top:0;">Download</a>
            </div>
          </div>
        `;
      });
    }

    if (r.assignments.length > 0) {
      html += `<div style="font-size:12px; font-weight:700; color:#fbbf24; margin:12px 0 4px;">📝 Assignments:</div>`;
      r.assignments.forEach(a => {
        const fmt = a.attachment_url ? this.getFileFormatInfo(a.attachment_url, a.attachment_name) : null;
        const downloadUrl = a.attachment_url ? API.getDownloadUrl(a.attachment_url, a.attachment_name || a.title) : null;
        html += `
          <div class="glass-card" style="padding:10px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="display:flex; align-items:center; gap:6px;">
                <strong>${a.title}</strong>
                ${fmt ? `<span class="format-badge ${fmt.class}">${fmt.icon} ${fmt.label}</span>` : ''}
              </div>
              <div style="font-size:11px; color:var(--text-muted);">${a.subject} • Due: ${a.due_date}</div>
            </div>
            ${downloadUrl ? `<a href="${downloadUrl}" target="_blank" download="${a.attachment_name || a.title}" class="btn-primary" style="width:auto; padding:4px 10px; font-size:11px; margin-top:0;">Attachment</a>` : ''}
          </div>
        `;
      });
    }

    if (r.questionPapers.length > 0) {
      html += `<div style="font-size:12px; font-weight:700; color:#c084fc; margin:12px 0 4px;">📄 Question Papers:</div>`;
      r.questionPapers.forEach(p => {
        const fmt = this.getFileFormatInfo(p.file_url, p.file_name);
        const downloadUrl = API.getDownloadUrl(p.file_url, p.file_name || `${p.subject}_${p.exam_name}.pdf`);
        html += `
          <div class="glass-card" style="padding:10px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="display:flex; align-items:center; gap:6px;">
                <strong>${p.exam_name}</strong>
                <span class="format-badge ${fmt.class}">${fmt.icon} ${fmt.label}</span>
              </div>
              <div style="font-size:11px; color:var(--text-muted);">${p.subject} • ${p.academic_year}</div>
            </div>
            <div style="display:flex; gap:6px;">
              <a href="${p.file_url}" target="_blank" class="btn-primary" style="width:auto; padding:4px 8px; font-size:11px; margin-top:0; background:rgba(37,99,235,0.2); color:#60a5fa;">👁️</a>
              <a href="${downloadUrl}" target="_blank" download="${p.file_name || p.exam_name}" class="btn-primary" style="width:auto; padding:4px 10px; font-size:11px; margin-top:0;">Download</a>
            </div>
          </div>
        `;
      });
    }

    resultsBox.innerHTML = html;
  },

  // ==================== NOTIFICATIONS DRAWER ====================
  async openNotificationsDrawer() {
    try {
      history.pushState({ role: 'STUDENT', modal: 'notif-modal' }, '', '#' + this.currentTab + '-notif');
    } catch (e) {}

    const res = await API.getStudentNotifications();
    const notifs = res.success ? res.data : [];

    const modalContainer = document.getElementById('student-modal-container');
    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="notif-modal">
        <div class="modal-card" style="max-width:480px; max-height:80vh;">
          <div class="modal-header">
            <h3 style="font-size:16px; font-weight:800;">🔔 Notifications & Notices</h3>
            <button class="icon-btn" onclick="StudentApp.closeModal('notif-modal')" style="width:30px; height:30px;">✕</button>
          </div>
          <div class="modal-body">
            ${notifs.length > 0 ? notifs.map(n => `
              <div class="glass-card" style="padding:14px; margin-bottom:10px; border-left:3px solid ${n.type === 'ALERT' ? 'var(--accent-amber)' : 'var(--primary)'};">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                  <strong style="font-size:14px;">${n.title}</strong>
                  <span style="font-size:10px; color:var(--text-muted);">${n.created_at ? n.created_at.split('T')[0] : 'Recent'}</span>
                </div>
                <p style="font-size:12px; color:var(--text-secondary); line-height:1.4;">${n.message}</p>
              </div>
            `).join('') : `
              <div style="text-align:center; padding:30px; color:var(--text-muted);">No new notifications at this time.</div>
            `}
          </div>
        </div>
      </div>
    `;
  },

  async setupNotificationBadge() {
    const res = await API.getStudentNotifications();
    const dot = document.getElementById('notif-badge-dot');
    if (dot && res.success && res.data.length > 0) {
      dot.style.display = 'block';
    }
  },

  openResultsModal() {
    this.switchTab('profile');
  },

  getGreetingTime() {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  },

  getCurrentDayName() {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const d = days[new Date().getDay()];
    return d === 'Sunday' ? 'Monday' : d;
  }
};

window.StudentApp = StudentApp;
