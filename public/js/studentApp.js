// ==========================================================================
// STUDENT WEB APP / PWA CONTROLLER
// ==========================================================================

const StudentApp = {
  currentTab: 'home',
  currentUser: null,
  activeVideoTrack: null,
  activeMediaStream: null,
  currentLocation: null,
  isScanning: false,
  tabHistory: ['home'],
  currentFacingMode: 'environment',
  isTorchOn: false,

  isCR() {
    if (!this.currentUser) return false;
    return this.currentUser.is_cr === 1 || this.currentUser.is_cr === true || this.currentUser.is_cr === '1' || Number(this.currentUser.is_cr) === 1;
  },

  async init(user, forceTab = null) {
    this.currentUser = user;
    this.tabHistory = ['home'];

    // Instantly sync latest profile from backend to ensure active CR role and permissions are live
    try {
      const profRes = await API.getProfile();
      if (profRes && profRes.success && profRes.user) {
        this.currentUser = { ...this.currentUser, ...profRes.user };
        API.setUser(this.currentUser);
      }
    } catch (e) {}

    // On login or refresh, always default to 'home' (prevent getting stuck on profile or attendance)
    let initialTab = 'home';
    if (forceTab) {
      initialTab = forceTab;
    } else {
      const hash = window.location.hash.replace('#', '').trim();
      const validSubTabs = ['study', 'timetable'];
      // Only keep hash if it's study or timetable; NEVER default to profile or attendance on refresh/login!
      if (validSubTabs.includes(hash)) {
        initialTab = hash;
      } else {
        initialTab = 'home';
      }
    }

    this.currentTab = initialTab;
    if (initialTab !== 'home') this.tabHistory.push(initialTab);

    try {
      history.replaceState({ role: 'STUDENT', tab: initialTab }, '', '#' + initialTab);
    } catch (e) {}

    this.renderLayout();
    this.bindEvents();

    // Ensure bottom navigation active tab is correctly set
    document.querySelectorAll('.bottom-nav-item').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === initialTab);
    });

    await this.loadTabData(initialTab);
    this.setupNotificationBadge();
    this.initRealtimeSSE();
    this.setupAutoSyncTriggers();
  },

  setupAutoSyncTriggers() {
    // 1. Silent sync on page visibility change (when switching back to browser/app)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.refreshCurrentTabSilent();
        this.setupNotificationBadge();
      }
    });

    // 2. Silent sync on window focus
    window.addEventListener('focus', () => {
      this.refreshCurrentTabSilent();
      this.setupNotificationBadge();
    });

    // 3. Resilient background interval heartbeat (every 15s)
    if (this.backgroundSyncInterval) clearInterval(this.backgroundSyncInterval);
    this.backgroundSyncInterval = setInterval(() => {
      this.setupNotificationBadge();
    }, 15000);
  },

  async refreshCurrentTabSilent() {
    try {
      const container = document.getElementById('student-main-content');
      if (!container) return;

      if (this.currentTab === 'home') {
        await this.renderHomeTab(container);
      } else if (this.currentTab === 'study') {
        if (this.currentStudySubTab) {
          await this.loadStudySubTab(this.currentStudySubTab);
        } else {
          await this.renderStudyTab(container);
        }
      } else if (this.currentTab === 'timetable') {
        await this.loadDayTimetable(this.selectedTimetableDay || this.getCurrentDayName());
      } else if (this.currentTab === 'attendance') {
        await this.renderAttendanceTab(container);
      } else if (this.currentTab === 'profile') {
        await this.renderProfileTab(container);
      }
    } catch (e) {
      console.warn('Silent refresh error:', e);
    }
  },

  initRealtimeSSE() {
    if (this.eventSource) {
      try { this.eventSource.close(); } catch (e) {}
    }
    const token = API.getToken();
    if (!token) return;

    try {
      const es = new EventSource('/api/realtime/events?token=' + encodeURIComponent(token));
      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.type === 'HANDSHAKE') return;

          // 1. CR Status Changes
          if (payload.type === 'CR_STATUS_UPDATED') {
            const myUgid = (this.currentUser && this.currentUser.ug_id) ? this.currentUser.ug_id.toUpperCase() : '';
            const targetUgid = (payload.ug_id || '').toUpperCase();
            if (myUgid === targetUgid || (this.currentUser && this.currentUser.id === payload.student_id)) {
              this.currentUser.is_cr = payload.is_cr;
              this.currentUser.cr_batches = payload.cr_batches;
              API.setUser(this.currentUser);
              this.renderLayout();
              this.loadTabData(this.currentTab);
              if (payload.is_cr === 1) {
                window.App.showToast(`👑 Congratulations! You have been appointed as Class Representative (CR) for ${payload.cr_batches || 'Both batches'}.`, 'success');
              } else {
                window.App.showToast('ℹ️ Your Class Representative (CR) role permissions have been updated.', 'info');
              }
            }
          }
          // 2. Class Notes Updates
          else if (payload.type === 'NOTES_UPDATED') {
            if (payload.message) window.App.showToast(payload.message, 'info');
            if (this.currentTab === 'study') {
              this.loadStudySubTab(this.currentStudySubTab || 'notes');
            } else if (this.currentTab === 'home') {
              this.refreshCurrentTabSilent();
            }
            this.setupNotificationBadge();
          }
          // 3. Study Material Updates
          else if (payload.type === 'MATERIAL_UPDATED') {
            if (payload.message) window.App.showToast(payload.message, 'info');
            if (this.currentTab === 'study') {
              this.loadStudySubTab(this.currentStudySubTab || 'material');
            } else if (this.currentTab === 'home') {
              this.refreshCurrentTabSilent();
            }
            this.setupNotificationBadge();
          }
          // 4. Assignments Updates
          else if (payload.type === 'ASSIGNMENT_UPDATED') {
            if (payload.message) window.App.showToast(payload.message, 'info');
            if (this.currentTab === 'study') {
              this.loadStudySubTab(this.currentStudySubTab || 'assignments');
            } else if (this.currentTab === 'home') {
              this.refreshCurrentTabSilent();
            }
            this.setupNotificationBadge();
          }
          // 5. PYQs / Question Papers Updates
          else if (payload.type === 'PYQ_UPDATED') {
            if (payload.message) window.App.showToast(payload.message, 'info');
            if (this.currentTab === 'study') {
              this.loadStudySubTab(this.currentStudySubTab || 'pyqs');
            } else if (this.currentTab === 'home') {
              this.refreshCurrentTabSilent();
            }
            this.setupNotificationBadge();
          }
          // 6. Announcements / Notices
          else if (payload.type === 'NOTICES_UPDATED') {
            if (payload.message) window.App.showToast(payload.message, 'info');
            if (this.currentTab === 'home') {
              this.refreshCurrentTabSilent();
            }
            const drawer = document.getElementById('notifications-drawer');
            if (drawer) this.openNotificationsDrawer();
            this.setupNotificationBadge();
          }
          // 7. Results / Marks Published
          else if (payload.type === 'RESULTS_UPDATED') {
            const myUgid = (this.currentUser && this.currentUser.ug_id) ? this.currentUser.ug_id.toUpperCase() : '';
            if (!payload.target_ug_id || payload.target_ug_id.toUpperCase() === myUgid) {
              if (payload.message) window.App.showToast(payload.message, 'success');
              if (this.currentTab === 'profile') {
                this.refreshCurrentTabSilent();
              } else if (this.currentTab === 'home') {
                this.refreshCurrentTabSilent();
              }
            }
          }
          // 8. Timetable Updates & Room Changes
          else if (payload.type === 'TIMETABLE_CHANGED') {
            const batchInfo = payload.batch ? ` [${payload.batch}]` : '';
            window.App.showToast(`🔔 Room Changed: ${payload.subject} moved to Room ${payload.new_room}${batchInfo}`, 'info');
            if (this.currentTab === 'home') {
              this.refreshCurrentTabSilent();
            } else if (this.currentTab === 'timetable') {
              this.loadDayTimetable(this.selectedTimetableDay || this.getCurrentDayName());
            }
            this.setupNotificationBadge();
          }
          else if (payload.type === 'TIMETABLE_CANCELLED' || payload.type === 'TIMETABLE_REVERTED' || payload.type === 'TIMETABLE_UPDATED') {
            if (this.currentTab === 'home') {
              this.refreshCurrentTabSilent();
            } else if (this.currentTab === 'timetable') {
              this.loadDayTimetable(this.selectedTimetableDay || this.getCurrentDayName());
            }
          }
          // 9. Attendance Session & Records
          else if (payload.type === 'ATTENDANCE_SESSION_STARTED') {
            if (payload.message) window.App.showToast(payload.message, 'info');
            if (this.currentTab === 'attendance' || this.currentTab === 'home') {
              this.refreshCurrentTabSilent();
            }
          }
          else if (payload.type === 'ATTENDANCE_UPDATED' || payload.type === 'ATTENDANCE_SESSION_STOPPED') {
            if (this.currentTab === 'attendance' || this.currentTab === 'home') {
              this.refreshCurrentTabSilent();
            }
          }
          // 10. Student Data Updated
          else if (payload.type === 'STUDENT_DATA_UPDATED') {
            const myUgid = (this.currentUser && this.currentUser.ug_id) ? this.currentUser.ug_id.toUpperCase() : '';
            if (!payload.ug_id || payload.ug_id.toUpperCase() === myUgid) {
              API.getProfile().then(p => {
                if (p.success && p.user) {
                  this.currentUser = { ...this.currentUser, ...p.user };
                  API.setUser(this.currentUser);
                  this.refreshCurrentTabSilent();
                }
              }).catch(() => {});
            }
          }
        } catch (err) {
          console.warn('Realtime message parse error:', err);
        }
      };
      this.eventSource = es;
    } catch (err) {
      console.warn('Realtime SSE init failed:', err);
    }
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
      if (window.App) window.App.isClosingModal = true;
      history.back();
    }
  },

  closeResultsModal() {
    this.closeModal('results-modal');
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
    return days[new Date().getDay()];
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
      day: realDayName
    });

    const todayData = todayRes && todayRes.success ? todayRes : { classes: [], liveClass: null, nextClass: null };

    // Dynamic client-side verification with current real clock
    let liveClass = todayData.liveClass;
    let nextClass = todayData.nextClass;
    let isSunday = realDayName === 'Sunday' || todayData.isSunday;
    let isHoliday = !!todayData.isHoliday;
    let dayCompleted = false;

    if (todayData.classes && todayData.classes.length > 0 && !isSunday && !isHoliday) {
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
          <div class="meta-chip"><span>Role:</span> <strong>${this.isCR() ? `👑 CR (${u.cr_batches || 'Both'})` : 'Student'}</strong></div>
        </div>
      </section>

      <!-- Next Class Card (Real-Time Synchronized for active lecture days) -->
      ${!isSunday && !isHoliday && (liveClass || nextClass || dayCompleted) ? `
        <section class="next-class-card">
          <div>
            ${liveClass ? `
              <span class="class-status-badge live">● LIVE NOW</span>
              <div class="next-class-subject">${liveClass.subject} ${liveClass.is_lab ? '<span class="lab-chip">LAB</span>' : ''}</div>
              <div class="next-class-details">
                Room: <strong style="color:${liveClass.has_room_change ? '#38bdf8' : '#ffffff'}; font-size:14px;">${liveClass.room}</strong>
                ${liveClass.has_room_change ? `<span class="lab-chip" style="background:rgba(56,189,248,0.2); color:#38bdf8; font-size:10px; margin-left:4px;">🔄 Room Changed (was ${liveClass.original_room})</span>` : ''}
                • ${this.formatSlotRange(liveClass.start_time, liveClass.end_time)} ${liveClass.teacher && liveClass.teacher !== '-' ? `• Faculty: <strong>${liveClass.teacher}</strong>` : ''}
              </div>
              ${liveClass.has_room_change && liveClass.room_change_reason ? `
                <div style="font-size:11px; color:#38bdf8; margin-top:3px;">Note: ${liveClass.room_change_reason}</div>
              ` : ''}
            ` : nextClass ? `
              <span class="class-status-badge upcoming">⏳ Starts in ${nextClass.startsInMinutes} mins</span>
              <div class="next-class-subject">${nextClass.subject} ${nextClass.is_lab ? '<span class="lab-chip">LAB</span>' : ''}</div>
              <div class="next-class-details">
                Room: <strong style="color:${nextClass.has_room_change ? '#38bdf8' : '#ffffff'}; font-size:14px;">${nextClass.room}</strong>
                ${nextClass.has_room_change ? `<span class="lab-chip" style="background:rgba(56,189,248,0.2); color:#38bdf8; font-size:10px; margin-left:4px;">🔄 Room Changed (was ${nextClass.original_room})</span>` : ''}
                • Time: ${this.formatTimeSlot(nextClass.start_time)} ${nextClass.teacher && nextClass.teacher !== '-' ? `• Faculty: <strong>${nextClass.teacher}</strong>` : ''}
              </div>
              ${nextClass.has_room_change && nextClass.room_change_reason ? `
                <div style="font-size:11px; color:#38bdf8; margin-top:3px;">Note: ${nextClass.room_change_reason}</div>
              ` : ''}
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
      ` : ''}

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
        </div>
      </section>

      <!-- Today's Classes List -->
      <section>
        <div class="section-heading">
          <h3>📅 Today's Classes (${isSunday ? 'Sunday' : (todayData.currentDay || realDayName)})</h3>
          <div style="display:flex; align-items:center; gap:8px;">
            ${this.isCR() ? `
              <button class="btn-primary" onclick="StudentApp.openCrRoomChangeSelector()" style="width:auto; margin:0; padding:5px 12px; font-size:11px; background:linear-gradient(135deg, #d97706, #b45309); border:1px solid #f59e0b; color:#ffffff; font-weight:700; border-radius:var(--radius-full); display:inline-flex; align-items:center; gap:5px;" title="CR: Change Classroom Room">
                👑 Change Room
              </button>
            ` : ''}
            <button class="btn-link" onclick="StudentApp.switchTab('timetable')" style="color:var(--accent-cyan); font-size:12px; background:none; font-weight:600;">View Week →</button>
          </div>
        </div>

        <div class="schedule-list">
          ${isSunday ? `
            <!-- Full Slot Sunday Holiday Banner Card -->
            <div class="glass-card" style="padding:28px 20px; text-align:center; background:linear-gradient(135deg, rgba(16,185,129,0.14) 0%, rgba(15,23,42,0.85) 100%); border:1px solid rgba(16,185,129,0.35); border-radius:var(--radius-lg); position:relative; overflow:hidden;">
              <div style="display:inline-flex; align-items:center; gap:6px; padding:4px 14px; border-radius:var(--radius-full); background:rgba(16,185,129,0.2); color:#34d399; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px;">
                🌴 SUNDAY HOLIDAY
              </div>
              <div style="font-size:42px; margin-bottom:8px;">🏖️</div>
              <h4 style="font-size:17px; font-weight:800; color:#ffffff; margin-bottom:6px;">No Classes Scheduled Today</h4>
              <p style="font-size:13px; color:var(--text-secondary); max-width:420px; margin:0 auto 16px; line-height:1.5;">
                It's Sunday! No lectures or practical sessions scheduled today. Next regular session starts Monday at 09:30 AM.
              </p>
              <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
                <button class="btn-primary" style="width:auto; padding:8px 16px; font-size:12px; margin:0; background:rgba(56,189,248,0.18); border:1px solid rgba(56,189,248,0.4); color:#38bdf8;" onclick="StudentApp.switchTab('timetable')">
                  📅 View Weekly Schedule
                </button>
                <button class="btn-primary" style="width:auto; padding:8px 16px; font-size:12px; margin:0; background:rgba(139,92,246,0.18); border:1px solid rgba(139,92,246,0.4); color:#c084fc;" onclick="StudentApp.switchTab('study')">
                  📚 Open Study Hub
                </button>
              </div>
            </div>
          ` : isHoliday ? `
            <!-- Full Slot Declared Holiday Card -->
            <div class="glass-card" style="padding:28px 20px; text-align:center; background:linear-gradient(135deg, rgba(16,185,129,0.14) 0%, rgba(15,23,42,0.85) 100%); border:1px solid rgba(16,185,129,0.35); border-radius:var(--radius-lg);">
              <div style="display:inline-flex; align-items:center; gap:6px; padding:4px 14px; border-radius:var(--radius-full); background:rgba(16,185,129,0.2); color:#34d399; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px;">
                🌴 COLLEGE HOLIDAY
              </div>
              <div style="font-size:42px; margin-bottom:8px;">🎉</div>
              <h4 style="font-size:17px; font-weight:800; color:#ffffff; margin-bottom:6px;">${todayData.holidayInfo ? todayData.holidayInfo.title : 'Official Holiday'}</h4>
              <p style="font-size:13px; color:var(--text-secondary); max-width:420px; margin:0 auto 16px; line-height:1.5;">
                ${todayData.holidayInfo && todayData.holidayInfo.description ? todayData.holidayInfo.description : 'College is closed today for declared holiday. No regular lectures scheduled.'}
              </p>
              <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
                <button class="btn-primary" style="width:auto; padding:8px 16px; font-size:12px; margin:0; background:rgba(139,92,246,0.18); border:1px solid rgba(139,92,246,0.4); color:#c084fc;" onclick="StudentApp.switchTab('study')">
                  📚 Browse Study Hub
                </button>
              </div>
            </div>
          ` : todayData.classes && todayData.classes.length > 0 ? todayData.classes.map(c => `
            <div class="schedule-item-card ${c.status === 'LIVE NOW' ? 'is-live' : ''}" style="${c.is_cancelled ? 'opacity:0.75; border-color:rgba(239,68,68,0.3);' : ''}">
              <div class="schedule-time-box" style="min-width:82px;">
                <div style="font-size:12px; font-weight:800; color:${c.is_cancelled ? '#f87171' : '#38bdf8'};">${StudentApp.formatTimeSlot(c.start_time)}</div>
                <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">${StudentApp.formatTimeSlot(c.end_time)}</div>
              </div>
              <div class="schedule-info" style="flex:1;">
                <div class="schedule-title">
                  <span>${c.subject}</span>
                  ${c.is_lab ? `<span class="lab-chip">LAB</span>` : ''}
                  ${c.is_cancelled ? `<span class="lab-chip" style="background:rgba(239,68,68,0.2); color:#f87171; font-weight:800;">CANCELLED</span>` : ''}
                  ${c.has_room_change ? `<span class="lab-chip" style="background:rgba(56,189,248,0.2); color:#38bdf8; font-size:10px;">🔄 Room Changed</span>` : ''}
                  ${c.status === 'LIVE NOW' ? `<span class="class-status-badge live" style="font-size:9px; padding:1px 6px;">LIVE</span>` : ''}
                </div>
                <div class="schedule-meta" style="margin-top:3px;">
                  ${c.is_cancelled ? `
                    <span style="color:#f87171; font-weight:600;">Reason: ${c.cancel_reason || 'Class cancelled for today'}</span>
                  ` : `
                    Room: <strong style="color:${c.has_room_change ? '#38bdf8' : '#ffffff'}; font-size:13px;">${c.room}</strong>
                    ${c.has_room_change ? `<span style="font-size:11px; color:var(--text-muted); text-decoration:line-through;">${c.original_room}</span>` : ''}
                    • Faculty: <strong>${c.teacher || 'Dept Faculty'}</strong>
                  `}
                </div>
                ${c.has_room_change && c.room_change_reason ? `
                  <div style="font-size:11px; color:#38bdf8; margin-top:2px;">🔄 Note: ${c.room_change_reason}</div>
                ` : ''}
              </div>

              <!-- CR In-line Room Change Button for Upcoming Slots -->
              ${this.isCR() && !c.is_cancelled && c.status !== 'COMPLETED' ? `
                <button class="icon-btn" onclick="StudentApp.openCrRoomChangeModal(${c.id}, '${c.subject}', '${c.start_time}', '${c.end_time}', '${c.room}')" title="Change Room for this slot" style="width:32px; height:32px; color:#fbbf24; background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.3); flex-shrink:0;">
                  🔄
                </button>
              ` : ''}
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
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const currentDay = this.selectedTimetableDay || this.getCurrentDayName();
    this.selectedTimetableDay = currentDay;
    const isCR = this.isCR();

    container.innerHTML = `
      <div style="margin-bottom:14px; display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:8px;">
        <div>
          <h2 style="font-size:20px; font-weight:800; margin-bottom:4px;">📅 Official Timetable</h2>
          <p style="font-size:13px; color:var(--text-secondary);">3CYBER7 • B.Tech Cyber Security • ${u.batch} Schedule ${isCR ? `<span style="color:#fbbf24; font-weight:700;">(👑 CR: ${u.cr_batches || 'Both'})</span>` : ''}</p>
        </div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          ${isCR ? `
            <button class="btn-primary" onclick="StudentApp.openCrRoomChangeSelector()" style="width:auto; margin:0; padding:6px 14px; font-size:11.5px; background:linear-gradient(135deg, #d97706, #b45309); border:1px solid #f59e0b; color:#ffffff; font-weight:700; border-radius:var(--radius-full); display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 10px rgba(217,119,6,0.35);" title="CR: Change Classroom Room">
              👑 Change Room
            </button>
            <button class="btn-primary" onclick="StudentApp.openChangeHistoryModal()" style="width:auto; margin:0; padding:6px 12px; font-size:11.5px; background:rgba(56,189,248,0.15); border:1px solid rgba(56,189,248,0.35); color:#38bdf8; font-weight:700; border-radius:var(--radius-full); display:inline-flex; align-items:center; gap:5px;" title="View Change History">
              📜 History
            </button>
          ` : ''}
          <div style="font-size:11px; color:#38bdf8; background:rgba(56,189,248,0.12); padding:4px 10px; border-radius:12px; border:1px solid rgba(56,189,248,0.25);">
            👈 Swipe Days 👉
          </div>
        </div>
      </div>

      <!-- Day Selector Carousel with Smooth Touch Scrolling & Arrow Controls -->
      <div class="day-scroll-wrapper">
        <button class="scroll-arrow-btn" onclick="StudentApp.scrollDaysCarousel(-140)" title="Scroll Left">‹</button>
        <div class="day-scroll-container" id="timetable-day-pills">
          ${days.map(d => `
            <button class="day-pill-btn ${d === currentDay ? 'active' : ''}" data-day="${d}" onclick="StudentApp.selectTimetableDay('${d}')">
              <span>${d === 'Sunday' ? '🌴' : '📅'}</span>
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
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
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
          StudentApp.stepTimetableDay(1);
        } else {
          StudentApp.stepTimetableDay(-1);
        }
      }
    }, { passive: true });
  },

  bindTimetableDragScroll() {
    const slider = document.getElementById('timetable-day-pills');
    if (!slider) return;

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

    // Special Full-Slot View for Sunday
    if (day === 'Sunday') {
      content.innerHTML = `
        <div class="glass-card" style="padding:36px 20px; text-align:center; animation:fadeIn 0.3s ease; background:linear-gradient(135deg, rgba(16,185,129,0.14) 0%, rgba(15,23,42,0.85) 100%); border:1px solid rgba(16,185,129,0.35); border-radius:var(--radius-lg); position:relative; overflow:hidden;">
          <div style="display:inline-flex; align-items:center; gap:6px; padding:4px 14px; border-radius:var(--radius-full); background:rgba(16,185,129,0.2); color:#34d399; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:14px;">
            🌴 SUNDAY HOLIDAY
          </div>
          <div style="font-size:48px; margin-bottom:10px;">🏖️</div>
          <h3 style="font-size:18px; font-weight:800; color:#ffffff; margin-bottom:6px;">No Classes Scheduled Today</h3>
          <p style="font-size:13px; color:var(--text-secondary); max-width:420px; margin:0 auto 18px; line-height:1.5;">
            All lecture halls and practical labs are closed for Sunday. Next academic session starts Monday morning at 09:30 AM.
          </p>
          <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            <button class="btn-primary" style="width:auto; padding:9px 18px; font-size:12px; margin:0;" onclick="StudentApp.selectTimetableDay('Monday')">
              📅 View Monday Schedule →
            </button>
            <button class="btn-primary" style="width:auto; padding:9px 18px; font-size:12px; margin:0; background:rgba(37,99,235,0.2); border:1px solid rgba(59,130,246,0.4); color:#60a5fa;" onclick="StudentApp.switchTab('study')">
              📚 Browse Study Hub
            </button>
          </div>
        </div>
      `;
      return;
    }

    const res = await API.getStudentTimetable(day);
    const slots = res.success ? res.data : [];
    const isToday = (day === this.getCurrentDayName());
    const isCR = this.isCR();

    if (res.isHoliday) {
      content.innerHTML = `
        <div class="glass-card" style="padding:36px 20px; text-align:center; animation:fadeIn 0.3s ease; background:linear-gradient(135deg, rgba(16,185,129,0.14) 0%, rgba(15,23,42,0.85) 100%); border:1px solid rgba(16,185,129,0.35); border-radius:var(--radius-lg);">
          <div style="display:inline-flex; align-items:center; gap:6px; padding:4px 14px; border-radius:var(--radius-full); background:rgba(16,185,129,0.2); color:#34d399; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:14px;">
            🌴 COLLEGE HOLIDAY
          </div>
          <div style="font-size:48px; margin-bottom:10px;">🎉</div>
          <h3 style="font-size:18px; font-weight:800; color:#ffffff; margin-bottom:6px;">${res.holidayInfo ? res.holidayInfo.title : 'Official Holiday'}</h3>
          <p style="font-size:13px; color:var(--text-secondary); max-width:420px; margin:0 auto 18px; line-height:1.5;">
            ${res.holidayInfo && res.holidayInfo.description ? res.holidayInfo.description : 'College is closed for declared holiday. No regular lectures scheduled.'}
          </p>
          <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            <button class="btn-primary" style="width:auto; padding:9px 18px; font-size:12px; margin:0;" onclick="StudentApp.switchTab('study')">
              📚 Academic Study Hub
            </button>
          </div>
        </div>
      `;
      return;
    }

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
          <div class="schedule-item-card" style="margin-bottom:12px; padding:15px; ${s.is_cancelled ? 'opacity:0.75; border-color:rgba(239,68,68,0.3); background:rgba(239,68,68,0.04);' : s.has_room_change ? 'border-color:rgba(245,158,11,0.4); background:rgba(245,158,11,0.05);' : ''}">
            <div class="schedule-time-box" style="min-width:84px; padding:8px;">
              <div style="font-size:12px; font-weight:800; color:${s.is_cancelled ? '#f87171' : s.has_room_change ? '#fbbf24' : '#38bdf8'};">${StudentApp.formatTimeSlot(s.start_time)}</div>
              <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">${StudentApp.formatTimeSlot(s.end_time)}</div>
            </div>
            <div class="schedule-info" style="flex:1;">
              <div class="schedule-title" style="font-size:15px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <span>${s.subject}</span>
                ${s.is_lab ? `<span class="lab-chip">PRACTICAL LAB</span>` : ''}
                ${s.is_cancelled ? `<span class="lab-chip" style="background:rgba(239,68,68,0.2); color:#f87171; font-weight:800;">CANCELLED TODAY</span>` : ''}
                ${s.has_room_change ? `<span class="lab-chip" style="background:rgba(245,158,11,0.2); color:#fbbf24; font-weight:800; border:1px solid rgba(245,158,11,0.4);">🟠 Room Changed</span>` : ''}
              </div>
              <div class="schedule-meta" style="margin-top:4px;">
                ${s.is_cancelled ? `
                  <span style="color:#f87171; font-weight:600;">Cancelled for today: ${s.cancel_reason || 'Department cancellation'}</span>
                ` : `
                  ${s.has_room_change ? `
                    Room: <span style="font-size:12px; color:var(--text-muted); text-decoration:line-through; margin-right:4px;">Room ${s.original_room}</span> → <strong style="color:#fbbf24; font-size:14px;">Room ${s.room}</strong>
                  ` : `
                    Room: <strong style="color:#ffffff; font-size:14px;">${s.room}</strong>
                  `}
                  • Faculty: <strong>${s.teacher || '-'}</strong>
                `}
              </div>
              ${s.has_room_change && s.room_change_reason ? `
                <div style="font-size:11px; color:#fbbf24; margin-top:3px;">💬 Reason: ${s.room_change_reason}</div>
              ` : ''}
              <div style="font-size:11px; color:var(--text-muted); margin-top:4px; display:flex; align-items:center; gap:6px;">
                <span>Batch:</span>
                <span class="batch-badge ${s.batch === 'Batch 1' ? 'batch-1' : s.batch === 'Batch 2' ? 'batch-2' : ''}">${s.batch}</span>
              </div>
            </div>

            <!-- In-line CR Quick Room Change / Edit Class -->
            ${isCR && !s.is_cancelled ? `
              <button class="icon-btn" onclick="StudentApp.openCrRoomChangeModal(${s.id}, '${s.subject.replace(/'/g, "\\'")}', '${s.start_time}', '${s.end_time}', '${s.room}', '${s.batch}', '${s.day}', '${(s.teacher || '').replace(/'/g, "\\'")}')" title="Edit Class / Room Change as CR" style="width:34px; height:34px; color:#fbbf24; background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.3); flex-shrink:0;">
                🔄
              </button>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  },

  // ==================== CR ROOM CHANGE MODAL & ACTIONS ====================
  async openCrRoomChangeSelector(selectedDay = null) {
    const u = this.currentUser;
    const crBatches = u.cr_batches || u.batch || 'Both';
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let day = selectedDay || this.selectedTimetableDay || this.getCurrentDayName();
    if (day === 'Sunday') day = 'Monday';

    const res = await API.getStudentTimetable(day);
    const classes = res && res.success ? res.data : [];
    const upcoming = classes.filter(c => !c.is_cancelled);

    const modalContainer = document.getElementById('student-modal-container') || document.body;
    let existingModal = document.getElementById('cr-selector-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'cr-selector-modal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-card" style="max-width:520px; width:95%;">
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:18px;">👑</span>
            <h3 style="font-size:16px; font-weight:800; color:#fbbf24;">Select Class to Edit / Change Room</h3>
          </div>
          <button class="icon-btn" onclick="document.getElementById('cr-selector-modal').remove()" style="width:30px; height:30px;">✕</button>
        </div>
        <div class="modal-body">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
            <span style="font-size:12px; color:var(--text-secondary);">Choose Day (Assigned Batches: <strong>${crBatches}</strong>):</span>
            <select id="cr-selector-day-select" class="form-control" style="width:auto; padding:5px 12px; font-size:12px; margin:0;" onchange="StudentApp.openCrRoomChangeSelector(this.value)">
              ${days.map(d => `<option value="${d}" ${d === day ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
          </div>

          <div style="display:flex; flex-direction:column; gap:8px; max-height:55vh; overflow-y:auto;">
            ${upcoming.length > 0 ? upcoming.map(c => `
              <div class="glass-card" style="padding:12px 14px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; border:1px solid var(--border-color);" onclick="document.getElementById('cr-selector-modal').remove(); StudentApp.openCrRoomChangeModal(${c.id}, '${c.subject.replace(/'/g, "\\'")}', '${c.start_time}', '${c.end_time}', '${c.room}', '${c.batch}', '${c.day || day}', '${(c.teacher || '').replace(/'/g, "\\'")}')">
                <div>
                  <div style="font-weight:700; font-size:14px; color:#ffffff;">${c.subject} ${c.is_lab ? '<span class="lab-chip">LAB</span>' : ''}</div>
                  <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                    ${StudentApp.formatSlotRange(c.start_time, c.end_time)} • Current Room: <strong>${c.room}</strong> • <span class="batch-badge ${c.batch === 'Batch 1' ? 'batch-1' : c.batch === 'Batch 2' ? 'batch-2' : ''}">${c.batch}</span>
                  </div>
                </div>
                <button class="btn-primary" style="width:auto; padding:6px 12px; font-size:11px; margin:0; background:linear-gradient(135deg, #d97706, #b45309); border-color:#f59e0b;">
                  Edit Class →
                </button>
              </div>
            `).join('') : `
              <div class="glass-card" style="padding:20px; text-align:center; color:var(--text-muted); font-size:13px;">
                No classes scheduled for ${day}.
              </div>
            `}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-primary" style="width:auto; background:var(--bg-input); border:1px solid var(--border-color); color:var(--text-secondary); margin-top:0;" onclick="document.getElementById('cr-selector-modal').remove()">Cancel</button>
        </div>
      </div>
    `;
    modalContainer.appendChild(modal);
  },

  openCrRoomChangeModal(timetableId, subject, startTime, endTime, currentRoom, currentBatch = 'Batch 2', day = 'Monday', teacher = '-') {
    let existingModal = document.getElementById('cr-room-change-modal');
    if (existingModal) existingModal.remove();

    const u = this.currentUser;
    const crBatches = u.cr_batches || u.batch || 'Both';
    const isDualCR = (crBatches === 'Both');

    // Default target batch based on CR assignment
    let defaultBatch = currentBatch;
    if (crBatches === 'Batch 1') defaultBatch = 'Batch 1';
    else if (crBatches === 'Batch 2') defaultBatch = 'Batch 2';

    // Get today's IST date string
    const now = new Date();
    const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const d = new Date(istString);
    const todayDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const modal = document.createElement('div');
    modal.id = 'cr-room-change-modal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-card" style="max-width:520px; width:95%;">
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:18px;">👑</span>
            <h3 style="font-size:16px; font-weight:800;">CR: Edit Class & Room Change</h3>
          </div>
          <button class="icon-btn" onclick="document.getElementById('cr-room-change-modal').remove()" style="width:30px; height:30px;">✕</button>
        </div>
        <div class="modal-body" style="max-height:75vh; overflow-y:auto;">
          <!-- Conflict Alert Display -->
          <div id="cr-conflict-alert" style="display:none; margin-bottom:14px; padding:12px 14px; border-radius:8px; background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.4); color:#fca5a5; font-size:12.5px; font-weight:600; animation:fadeIn 0.2s ease;"></div>

          <!-- Class Overview Info Box -->
          <div style="background:var(--bg-input); padding:12px 14px; border-radius:var(--radius-sm); margin-bottom:14px; font-size:13px; border:1px solid var(--border-color);">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span style="color:var(--text-muted);">Subject:</span>
              <strong style="color:#ffffff;">${subject}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span style="color:var(--text-muted);">Day & Time:</span>
              <strong>${day}, ${this.formatTimeSlot(startTime)} – ${this.formatTimeSlot(endTime)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span style="color:var(--text-muted);">Faculty:</span>
              <strong>${teacher || '-'}</strong>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--text-muted);">Current Room:</span>
              <strong style="color:#38bdf8;">Room ${currentRoom}</strong>
            </div>
          </div>

          <!-- 1. Target Batch Selector -->
          <div class="form-group">
            <label class="form-label">Assigned Batch *</label>
            ${isDualCR ? `
              <select id="cr-batch-select" class="form-control" required>
                <option value="Batch 1" ${defaultBatch === 'Batch 1' ? 'selected' : ''}>Batch 1 Only (Roll 1–30)</option>
                <option value="Batch 2" ${defaultBatch === 'Batch 2' ? 'selected' : ''}>Batch 2 Only (Roll 31+)</option>
                <option value="Both" ${defaultBatch === 'Both' ? 'selected' : ''}>Batch 1 + Batch 2 (Both Batches)</option>
              </select>
              <span style="font-size:11px; color:#38bdf8; margin-top:2px; display:block;">ℹ️ Dual CR: Changing Batch 2 will NEVER affect Batch 1 timetable.</span>
            ` : `
              <input type="text" id="cr-batch-select" class="form-control" value="${crBatches}" readonly style="background:rgba(255,255,255,0.05); color:#fbbf24; font-weight:700;" />
              <span style="font-size:11px; color:var(--text-muted); margin-top:2px; display:block;">You are designated CR for <strong>${crBatches}</strong>.</span>
            `}
          </div>

          <!-- 2. Change Type -->
          <div class="form-group">
            <label class="form-label">Change Type *</label>
            <select id="cr-change-type" class="form-control" onchange="StudentApp.onCrChangeTypeChange(this.value)" required>
              <option value="TODAY" selected>Only for Today (Temporary)</option>
              <option value="DATE">Specific Date (Temporary)</option>
              <option value="PERMANENT">Permanent (Master Regular Timetable)</option>
            </select>
          </div>

          <!-- 3. Target Date Input (shown when Specific Date is picked) -->
          <div class="form-group" id="cr-date-group" style="display:none;">
            <label class="form-label">Target Date *</label>
            <input type="date" id="cr-target-date" class="form-control" value="${todayDate}" />
          </div>

          <!-- 4. New Room Number -->
          <div class="form-group">
            <label class="form-label">New Room Number * (e.g. 203, 204, NB-204, L-311)</label>
            <input type="text" id="cr-new-room" class="form-control" placeholder="Enter new room number (e.g. 203)" required autofocus />
          </div>

          <!-- 5. Reason for Change -->
          <div class="form-group">
            <label class="form-label">Reason for Room Change *</label>
            <input type="text" id="cr-reason" class="form-control" placeholder="e.g. Projector malfunction, moving to Room 203" required />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-primary" style="width:auto; background:var(--bg-input); border:1px solid var(--border-color); color:var(--text-secondary); margin-top:0;" onclick="document.getElementById('cr-room-change-modal').remove()">Cancel</button>
          <button class="btn-primary" id="btn-submit-cr-rc" style="width:auto; margin-top:0; background:linear-gradient(135deg, #d97706, #b45309); border-color:#f59e0b;" onclick="StudentApp.submitCrRoomChange(${timetableId})">Save Changes & Notify</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  onCrChangeTypeChange(type) {
    const dateGroup = document.getElementById('cr-date-group');
    if (dateGroup) {
      dateGroup.style.display = (type === 'DATE') ? 'block' : 'none';
    }
  },

  async submitCrRoomChange(timetableId) {
    const new_room = document.getElementById('cr-new-room').value.trim();
    const reason = document.getElementById('cr-reason').value.trim();
    const batchSelect = document.getElementById('cr-batch-select');
    const targetBatch = batchSelect ? (batchSelect.value || 'Both') : 'Both';
    const changeTypeSelect = document.getElementById('cr-change-type');
    const change_type = changeTypeSelect ? changeTypeSelect.value : 'TODAY';
    const dateInput = document.getElementById('cr-target-date');

    const alertBox = document.getElementById('cr-conflict-alert');
    if (alertBox) alertBox.style.display = 'none';

    if (!new_room) {
      window.App.showToast('Please enter the new room number.', 'error');
      return;
    }
    if (!reason) {
      window.App.showToast('Please enter the reason for the room change.', 'error');
      return;
    }

    // Determine target date
    let targetDate;
    if (change_type === 'DATE' && dateInput && dateInput.value) {
      targetDate = dateInput.value;
    } else {
      const now = new Date();
      const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
      const d = new Date(istString);
      targetDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    const btn = document.getElementById('btn-submit-cr-rc');
    if (btn) {
      btn.disabled = true;
      btn.innerText = 'Checking & Saving...';
    }

    const res = await API.changeClassRoom({
      timetable_id: timetableId,
      date: targetDate,
      new_room,
      reason,
      batch: targetBatch,
      change_type
    });

    if (btn) {
      btn.disabled = false;
      btn.innerText = 'Save Changes & Notify';
    }

    if (res.conflict) {
      if (alertBox) {
        alertBox.innerHTML = `<strong>⚠️ Room Conflict Detected</strong><br/>${res.conflictDetails || res.message}`;
        alertBox.style.display = 'block';
      } else {
        window.App.showToast(res.message || 'Room conflict detected.', 'error');
      }
      return;
    }

    if (res.success) {
      window.App.showToast(res.message || 'Room changed successfully.', 'success');
      const modal = document.getElementById('cr-room-change-modal');
      if (modal) modal.remove();
      // Refresh current tab
      if (this.currentTab === 'timetable') {
        await this.loadDayTimetable(this.selectedTimetableDay || this.getCurrentDayName());
      } else {
        const container = document.getElementById('student-main-content');
        if (container) await this.renderHomeTab(container);
      }
    } else {
      if (alertBox) {
        alertBox.innerHTML = `<strong>Error:</strong> ${res.message || 'Failed to update room.'}`;
        alertBox.style.display = 'block';
      } else {
        window.App.showToast(res.message || 'Failed to update room.', 'error');
      }
    }
  },

  // ==================== CHANGE HISTORY MODAL ====================
  async openChangeHistoryModal() {
    let existingModal = document.getElementById('student-history-modal');
    if (existingModal) existingModal.remove();

    const res = await API.getOverrideHistory({ limit: 50 });
    const history = res.success ? res.data : [];

    const modal = document.createElement('div');
    modal.id = 'student-history-modal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-card" style="max-width:720px; width:95%;">
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:18px;">📜</span>
            <h3 style="font-size:16px; font-weight:800;">Timetable & Room Change History</h3>
          </div>
          <button class="icon-btn" onclick="document.getElementById('student-history-modal').remove()" style="width:30px; height:30px;">✕</button>
        </div>
        <div class="modal-body" style="max-height:70vh; overflow-y:auto;">
          <p style="font-size:12px; color:var(--text-secondary); margin-bottom:12px;">
            Audit log of all room changes and schedule adjustments for Division 3CYBER7:
          </p>
          ${history.length > 0 ? `
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${history.map(h => `
                <div class="glass-card" style="padding:12px 14px; border:1px solid var(--border-color); font-size:12px;">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px; flex-wrap:wrap; gap:6px;">
                    <div style="font-weight:700; font-size:13px; color:#ffffff;">
                      ${h.subject} <span class="batch-badge ${h.batch === 'Batch 1' ? 'batch-1' : h.batch === 'Batch 2' ? 'batch-2' : ''}">${h.batch || 'Both'}</span>
                    </div>
                    <span class="lab-chip" style="background:${h.action === 'ROOM_CHANGE' ? 'rgba(245,158,11,0.2)' : h.action === 'PERMANENT_CHANGE' ? 'rgba(56,189,248,0.2)' : 'rgba(16,185,129,0.2)'}; color:${h.action === 'ROOM_CHANGE' ? '#fbbf24' : h.action === 'PERMANENT_CHANGE' ? '#38bdf8' : '#34d399'}; font-size:10px;">
                      ${h.action === 'ROOM_CHANGE' ? 'Temporary Room Change' : h.action === 'PERMANENT_CHANGE' ? 'Permanent Schedule Change' : h.action}
                    </span>
                  </div>
                  <div style="margin-bottom:4px; color:var(--text-secondary);">
                    Room Transition: <span style="text-decoration:line-through; color:var(--text-muted);">${h.old_room}</span> → <strong style="color:#fbbf24;">${h.new_room}</strong>
                    • Date: <strong>${h.date || h.day}</strong> (${StudentApp.formatTimeSlot(h.start_time)})
                  </div>
                  ${h.reason ? `<div style="color:var(--text-muted); margin-bottom:4px;">Reason: ${h.reason}</div>` : ''}
                  <div style="font-size:10.5px; color:var(--text-muted); display:flex; justify-content:space-between; border-top:1px solid rgba(255,255,255,0.06); padding-top:6px; margin-top:6px;">
                    <span>Changed by: <strong style="color:${h.changed_by_role === 'CR' ? '#fbbf24' : '#60a5fa'};">${h.changed_by_name} (${h.changed_by_role})</strong></span>
                    <span>${new Date(h.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `
            <div style="text-align:center; padding:30px; color:var(--text-muted);">
              No change history recorded yet.
            </div>
          `}
        </div>
        <div class="modal-footer">
          <button class="btn-primary" style="width:auto; margin-top:0;" onclick="document.getElementById('student-history-modal').remove()">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
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

      <!-- Classroom QR Attendance Action Card -->
      <div class="glass-card" style="padding:18px 20px; margin-bottom:20px; cursor:pointer; background:linear-gradient(135deg, rgba(56,189,248,0.12) 0%, rgba(37,99,235,0.08) 100%); border:1px solid rgba(56,189,248,0.3); border-radius:var(--radius-lg); display:flex; align-items:center; justify-content:space-between; gap:16px;" onclick="StudentApp.openScannerModal()">
        <div style="display:flex; align-items:center; gap:14px;">
          <div style="width:48px; height:48px; border-radius:var(--radius-md); background:rgba(56,189,248,0.2); color:#38bdf8; display:flex; align-items:center; justify-content:center; font-size:24px; flex-shrink:0;">
            📷
          </div>
          <div>
            <h3 style="font-size:16px; font-weight:800; color:#ffffff; margin-bottom:2px;">Scan Classroom QR</h3>
            <p style="font-size:12px; color:var(--text-secondary); margin:0;">Point camera at rotating live QR code to mark attendance</p>
          </div>
        </div>
        <button class="btn-primary" style="width:auto; padding:8px 16px; font-size:12px; margin:0; flex-shrink:0;">
          Open Scanner →
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
                <div style="font-size:11px; color:var(--text-muted);">${h.date} • 📷 QR Scan</div>
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

  // 1. Dynamic QR Scanner Modal (High Performance, Multi-Device, Zero-Crash)
  // 1. Dynamic QR Scanner Modal (High Performance, Multi-Device, Zero-Crash)
  openScannerModal() {
    try {
      history.pushState({ role: 'STUDENT', modal: 'scanner-modal' }, '', '#' + this.currentTab + '-scanner');
    } catch (e) {}

    const modalContainer = document.getElementById('student-modal-container') || document.body;
    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="scanner-modal" onclick="if(event.target===this)StudentApp.closeScannerModal()">
        <div class="modal-card" style="max-width:420px; margin:auto;" onclick="event.stopPropagation()">
          <div class="modal-header" style="padding:16px 20px;">
            <h3 style="font-size:16px; font-weight:800; display:flex; align-items:center; gap:8px;">
              📷 Scan Classroom QR Code
            </h3>
            <button class="icon-btn" onclick="StudentApp.closeScannerModal()" style="width:32px; height:32px;">✕</button>
          </div>
          <div class="modal-body" style="padding:16px 20px;">
            <!-- Status Badge / Banner -->
            <div id="scanner-status-banner" style="padding:8px 12px; background:rgba(56,189,248,0.12); border:1px solid rgba(56,189,248,0.3); border-radius:var(--radius-md); margin-bottom:12px; text-align:center;">
              <span id="scanner-status-text" style="font-size:12px; font-weight:700; color:#38bdf8;">⚡ Initializing Live Camera Scanner...</span>
            </div>

            <!-- Video Viewport -->
            <div class="scanner-viewport-card" id="scanner-viewport-box">
              <video id="qr-video-feed" playsinline webkit-playsinline autoplay muted style="width:100%; height:100%; object-fit:cover; display:block;"></video>
              <div class="scanner-laser" id="scanner-laser-elem"></div>
              <div class="scanner-target-corners"></div>
              
              <!-- Loading Overlay inside viewport -->
              <div class="scanner-loading-overlay" id="scanner-loading-view">
                <div style="width:36px; height:36px; border:3px solid rgba(56,189,248,0.2); border-top-color:#38bdf8; border-radius:50%; animation:spin 0.8s linear infinite;"></div>
                <span style="font-size:12px; color:#94a3b8; font-weight:600;">Requesting Camera Stream...</span>
              </div>
            </div>

            <!-- Controls Grid: Flip Camera, Torch -->
            <div class="scanner-controls-grid">
              <button class="scanner-ctrl-btn" type="button" onclick="StudentApp.flipCamera()" title="Switch Front/Rear Camera">
                <span style="font-size:16px;">🔄</span>
                <span>Flip Camera</span>
              </button>
              <button class="scanner-ctrl-btn" type="button" id="btn-scanner-torch" onclick="StudentApp.toggleTorch()" title="Toggle Flashlight">
                <span style="font-size:16px;">💡</span>
                <span id="txt-scanner-torch">Flashlight</span>
              </button>
            </div>

            <!-- Fallback: Manual Code Input Option -->
            <div style="margin-top:6px;">
              <button type="button" class="scanner-manual-toggle-btn" onclick="StudentApp.toggleManualCodeInput()">
                <span style="font-size:15px;">⌨️</span> <span id="txt-manual-toggle">Enter Attendance Code Manually</span>
              </button>
            </div>

            <div id="manual-code-section" class="scanner-manual-box" style="display:none;">
              <label style="font-size:11px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; margin-bottom:6px; display:block;">Session / QR Token Code</label>
              <div style="display:flex; gap:8px;">
                <input type="text" id="manual-qr-input" class="form-input" placeholder="e.g. 1_172571234_a1b2c3d4" style="flex:1; font-size:13px; font-family:monospace; padding:8px 12px;">
                <button type="button" class="btn-primary" onclick="StudentApp.submitManualQRToken()" style="width:auto; margin:0; padding:8px 16px; font-size:12px; font-weight:700;">Verify</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.startCameraAndGPS();
  },

  async startCameraAndGPS() {
    return this.startCamera();
  },

  async startCamera() {
    this.stopCamera();
    const loadingView = document.getElementById('scanner-loading-view');
    const statusText = document.getElementById('scanner-status-text');
    if (loadingView) {
      loadingView.style.display = 'flex';
      loadingView.innerHTML = `
        <div style="width:36px; height:36px; border:3px solid rgba(56,189,248,0.2); border-top-color:#38bdf8; border-radius:50%; animation:spin 0.8s linear infinite;"></div>
        <span style="font-size:12px; color:#94a3b8; font-weight:600;">Requesting Camera Stream...</span>
      `;
    }
    if (statusText) statusText.textContent = '⚡ Initializing camera stream...';

    // Camera constraint candidate sets (safe fallbacks for all device types & webviews)
    const constraintCandidates = [
      { video: { facingMode: { exact: this.currentFacingMode }, width: { ideal: 1280 }, height: { ideal: 720 } } },
      { video: { facingMode: this.currentFacingMode, width: { ideal: 1280 } } },
      { video: { facingMode: this.currentFacingMode } },
      { video: true }
    ];

    let stream = null;
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      for (const constraints of constraintCandidates) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (stream) break;
        } catch (e) {
          // Try next fallback constraint
        }
      }
    }

    const video = document.getElementById('qr-video-feed');
    if (stream && video) {
      this.activeMediaStream = stream;
      this.activeVideoTrack = stream.getVideoTracks()[0];
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.muted = true;

      try {
        await video.play();
      } catch (playErr) {
        console.warn('Video auto-play error:', playErr);
      }

      if (loadingView) loadingView.style.display = 'none';
      if (statusText) statusText.textContent = '🟢 Camera Active — Point at classroom QR';

      this.startContinuousFrameScanner(video);
    } else {
      if (loadingView) {
        loadingView.innerHTML = `
          <div style="width:44px; height:44px; border-radius:50%; background:rgba(56,189,248,0.15); display:flex; align-items:center; justify-content:center; font-size:22px; margin-bottom:2px;">📷</div>
          <div style="font-size:13px; color:#ffffff; font-weight:800;">Camera Permission Needed</div>
          <p style="font-size:11px; color:#94a3b8; max-width:240px; margin:2px 0 10px; line-height:1.4;">
            Please grant camera permission in your browser or enter session code below.
          </p>
          <button class="btn-primary" onclick="StudentApp.startCamera()" style="width:auto; padding:6px 16px; font-size:12px; margin:0; border-radius:var(--radius-full);">🔄 Start / Allow Camera</button>
        `;
      }
      if (statusText) statusText.innerHTML = '<span style="color:#f87171;">⚠️ Camera Permission Needed</span>';
    }
  },

  flipCamera() {
    this.currentFacingMode = (this.currentFacingMode === 'environment' ? 'user' : 'environment');
    this.isTorchOn = false;
    window.App.showToast(`Switched to ${this.currentFacingMode === 'environment' ? 'Rear / Back' : 'Front'} Camera`, 'info');
    this.startCamera();
  },

  async toggleTorch() {
    if (!this.activeVideoTrack) {
      window.App.showToast('Flashlight requires an active camera stream.', 'info');
      return;
    }
    try {
      const capabilities = this.activeVideoTrack.getCapabilities ? this.activeVideoTrack.getCapabilities() : {};
      if (!capabilities.torch) {
        window.App.showToast('Torch/Flashlight is not supported by this device camera.', 'info');
        return;
      }
      this.isTorchOn = !this.isTorchOn;
      await this.activeVideoTrack.applyConstraints({
        advanced: [{ torch: this.isTorchOn }]
      });
      const btn = document.getElementById('btn-scanner-torch');
      const txt = document.getElementById('txt-scanner-torch');
      if (btn) btn.classList.toggle('active', this.isTorchOn);
      if (txt) txt.textContent = this.isTorchOn ? 'Torch On 💡' : 'Flashlight';
      window.App.showToast(this.isTorchOn ? 'Flashlight Enabled' : 'Flashlight Disabled', 'info');
    } catch (e) {
      window.App.showToast('Unable to toggle flashlight on this device.', 'info');
    }
  },

  toggleManualCodeInput() {
    const section = document.getElementById('manual-code-section');
    const txt = document.getElementById('txt-manual-toggle');
    if (!section) return;
    const isHidden = section.style.display === 'none';
    section.style.display = isHidden ? 'block' : 'none';
    if (txt) txt.textContent = isHidden ? 'Hide Manual Code Entry' : 'Enter Attendance Code Manually';
    if (isHidden) {
      const inp = document.getElementById('manual-qr-input');
      if (inp) inp.focus();
    }
  },

  submitManualQRToken() {
    const inp = document.getElementById('manual-qr-input');
    const val = inp ? inp.value.trim() : '';
    if (!val) {
      window.App.showToast('Please enter or paste the classroom attendance code.', 'error');
      return;
    }
    this.handleScannedToken(val);
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

      // 1. Primary: Universal jsQR Decoder
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

    window.App.showToast('📷 QR Code Detected! Verifying token...', 'info');
    await this.processAttendanceVerification(token);
    this.isProcessingScan = false;
  },

  async processAttendanceVerification(token) {
    const res = await API.submitQRScan({
      token
    });

    if (res.success) {
      window.App.showToast(res.message, 'success');
      this.closeScannerModal();
      this.loadTabData('attendance');
    } else {
      window.App.showToast(res.message || 'Attendance verification failed.', 'error');
      // Allow retry if modal is still open
      if (document.getElementById('scanner-modal') && this.activeVideoTrack) {
        setTimeout(() => {
          this.isProcessingScan = false;
          const video = document.getElementById('qr-video-feed');
          if (video) this.startContinuousFrameScanner(video);
        }, 1500);
      }
    }
  },

  closeScannerModal() {
    this.stopCamera();
    const modal = document.getElementById('scanner-modal');
    if (modal) modal.remove();
    if (history.state && history.state.modal === 'scanner-modal') {
      if (window.App) window.App.isClosingModal = true;
      history.back();
    }
  },

  stopCamera() {
    if (this.cameraScanInterval) {
      clearInterval(this.cameraScanInterval);
      this.cameraScanInterval = null;
    }
    if (this.activeVideoTrack) {
      try { this.activeVideoTrack.stop(); } catch (e) {}
      this.activeVideoTrack = null;
    }
    if (this.activeMediaStream) {
      try {
        this.activeMediaStream.getTracks().forEach(t => {
          try { t.stop(); } catch (e) {}
        });
      } catch (e) {}
      this.activeMediaStream = null;
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
          ${results.length > 0 ? `<button class="btn-link" onclick="StudentApp.openResultsModal()" style="color:var(--accent-cyan); font-size:12px; font-weight:700;">Detailed Marksheet →</button>` : ''}
        </div>
        ${results.length > 0 ? `
          <div class="results-score-banner">
            <div class="results-score-item">
              <span class="results-score-label">Total Score</span>
              <span class="results-score-val" style="color:#38bdf8;">${resRes.summary ? resRes.summary.totalMarksScored : results.reduce((a, b) => a + (parseFloat(b.marks) || 0), 0)}</span>
            </div>
            <div class="results-score-item">
              <span class="results-score-label">Max Marks</span>
              <span class="results-score-val" style="color:#94a3b8;">${resRes.summary ? resRes.summary.maxPossibleMarks : results.reduce((a, b) => a + (parseFloat(b.max_marks) || 100), 0)}</span>
            </div>
            <div class="results-score-item">
              <span class="results-score-label">Overall %</span>
              <span class="results-score-val" style="color:#34d399;">${resRes.summary ? resRes.summary.percentage : '0.00'}%</span>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:8px;">
            ${results.map(r => `
              <div class="subject-mark-card">
                <div class="subject-mark-info">
                  <div class="subject-mark-title">${r.subject}</div>
                  <div class="subject-mark-exam">${r.exam_name} • ${r.semester || '3rd Sem'}</div>
                </div>
                <div class="subject-mark-score">
                  <div class="subject-mark-points">${r.marks} <span class="subject-mark-max">/ ${r.max_marks}</span></div>
                  <span class="batch-badge" style="background:rgba(16,185,129,0.15); color:#34d399; font-size:10px; padding:2px 8px; margin-top:2px; display:inline-block;">
                    Grade ${r.grade}
                  </span>
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="glass-card" style="padding:20px; text-align:center; color:var(--text-muted);">
            No published results yet for this semester.
          </div>
        `}
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

      <!-- Android Mobile App Card -->
      <div class="glass-card" style="padding:16px 20px; margin-bottom:16px; background:linear-gradient(135deg, rgba(56,189,248,0.12) 0%, rgba(99,102,241,0.1) 100%); border:1px solid rgba(56,189,248,0.3); border-radius:var(--radius-lg); display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:42px; height:42px; border-radius:var(--radius-md); background:rgba(56,189,248,0.2); color:#38bdf8; display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0;">
            🤖
          </div>
          <div>
            <h4 style="font-size:14px; font-weight:800; color:#ffffff; margin:0 0 2px;">Official Android APK App</h4>
            <p style="font-size:11px; color:var(--text-secondary); margin:0;">Install full mobile app on your Android phone</p>
          </div>
        </div>
        <a href="/download/apk" download="MGI_Student_Portal.apk" onclick="window.App && window.App.handleAPKDownload(event)" class="btn-primary" style="width:auto; padding:8px 14px; font-size:11px; margin:0; text-decoration:none; display:inline-flex; align-items:center; gap:6px; flex-shrink:0;">
          <span>📲</span> Download APK
        </a>
      </div>

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
      <div class="modal-backdrop" id="photo-modal" onclick="if(event.target===this)StudentApp.closeModal('photo-modal')">
        <div class="modal-card" onclick="event.stopPropagation()">
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

  // ==================== GLOBAL SEARCH MODAL (Requirement #48) ====================
  openSearchModal() {
    try {
      history.pushState({ role: 'STUDENT', modal: 'search-modal' }, '', '#' + this.currentTab + '-search');
    } catch (e) {}

    const modalContainer = document.getElementById('student-modal-container');
    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="search-modal" onclick="if(event.target===this)StudentApp.closeModal('search-modal')">
        <div class="modal-card" style="max-width:540px;" onclick="event.stopPropagation()">
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
      <div class="modal-backdrop" id="notif-modal" onclick="if(event.target===this)StudentApp.closeModal('notif-modal')">
        <div class="modal-card" style="max-width:480px; max-height:80vh;" onclick="event.stopPropagation()">
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

  async openResultsModal() {
    try {
      history.pushState({ role: 'STUDENT', modal: 'results-modal' }, '', '#' + this.currentTab + '-results');
    } catch (e) {}

    const resRes = await API.getStudentResults();
    const results = resRes.success ? resRes.results : [];
    const summary = resRes.summary || {
      totalSubjects: results.length,
      totalMarksScored: results.reduce((acc, r) => acc + (parseFloat(r.marks) || 0), 0),
      maxPossibleMarks: results.reduce((acc, r) => acc + (parseFloat(r.max_marks) || 100), 0),
      percentage: '0.00'
    };
    if (summary.maxPossibleMarks > 0 && (!summary.percentage || summary.percentage === '0.00')) {
      summary.percentage = ((summary.totalMarksScored / summary.maxPossibleMarks) * 100).toFixed(2);
    }

    const u = this.currentUser;

    const modalContainer = document.getElementById('student-modal-container');
    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="results-modal" onclick="if(event.target===this)StudentApp.closeModal('results-modal')">
        <div class="modal-card" style="max-width:550px;" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3 style="font-size:16px; font-weight:800; display:flex; align-items:center; gap:8px;">
              🏆 Official Academic Marksheet
            </h3>
            <button class="icon-btn" onclick="StudentApp.closeModal('results-modal')" style="width:32px; height:32px;">✕</button>
          </div>
          <div class="modal-body" style="max-height:75vh; overflow-y:auto;">
            <!-- Student Header Badge -->
            <div style="padding:14px; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:var(--radius-md); margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <div>
                <h4 style="font-size:15px; font-weight:800; color:#ffffff;">${u.name}</h4>
                <div style="font-size:12px; color:var(--accent-cyan); font-weight:600; margin-top:2px;">${u.ug_id} • Roll #${u.roll_number}</div>
              </div>
              <div style="text-align:right;">
                <span class="batch-badge ${u.batch === 'Batch 1' ? 'batch-1' : 'batch-2'}">${u.batch}</span>
                <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">3CYBER7 • 3rd Sem</div>
              </div>
            </div>

            <!-- Score Summary KPI -->
            <div class="results-score-banner">
              <div class="results-score-item">
                <span class="results-score-label">Total Score</span>
                <span class="results-score-val" style="color:#38bdf8;">${summary.totalMarksScored}</span>
              </div>
              <div class="results-score-item">
                <span class="results-score-label">Total Maximum</span>
                <span class="results-score-val" style="color:#94a3b8;">${summary.maxPossibleMarks}</span>
              </div>
              <div class="results-score-item">
                <span class="results-score-label">Aggregate %</span>
                <span class="results-score-val" style="color:#34d399;">${summary.percentage}%</span>
              </div>
            </div>

            <!-- Subjects Breakdown -->
            ${results.length > 0 ? `
              <div style="display:flex; flex-direction:column; gap:10px;">
                ${results.map(r => {
                  const pct = r.max_marks ? Math.round((r.marks / r.max_marks) * 100) : 0;
                  return `
                    <div class="subject-mark-card" style="margin-bottom:0;">
                      <div class="subject-mark-info">
                        <div class="subject-mark-title">${r.subject}</div>
                        <div class="subject-mark-exam">${r.exam_name} • ${r.semester || '3rd Semester'}</div>
                        <!-- Performance Progress Bar -->
                        <div style="width:100%; height:4px; background:rgba(255,255,255,0.08); border-radius:2px; margin-top:8px; overflow:hidden;">
                          <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, #38bdf8, #34d399); border-radius:2px;"></div>
                        </div>
                        ${r.remarks ? `<div style="font-size:11px; color:#94a3b8; font-style:italic; margin-top:4px;">"${r.remarks}"</div>` : ''}
                      </div>
                      <div class="subject-mark-score" style="margin-left:12px;">
                        <div class="subject-mark-points">${r.marks} <span class="subject-mark-max">/ ${r.max_marks}</span></div>
                        <span class="batch-badge" style="background:rgba(16,185,129,0.18); color:#34d399; font-size:11px; padding:3px 10px; margin-top:4px; display:inline-block;">
                          Grade ${r.grade}
                        </span>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : `
              <div class="glass-card" style="padding:28px; text-align:center; color:var(--text-muted);">
                <div style="font-size:36px; margin-bottom:8px;">📄</div>
                <h4 style="color:#ffffff; font-size:15px; margin-bottom:4px;">No Published Results Yet</h4>
                <p style="font-size:12px; color:var(--text-secondary);">Your examination marks will appear here as soon as they are published by the department.</p>
              </div>
            `}
          </div>
          <div class="modal-footer">
            <button class="btn-primary" onclick="StudentApp.closeResultsModal()" style="width:100%;">
              Close Marksheet
            </button>
          </div>
        </div>
      </div>
    `;
  },

  closeResultsModal() {
    const modal = document.getElementById('results-modal');
    if (modal) modal.remove();
    if (history.state && history.state.modal === 'results-modal') {
      history.back();
    }
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
