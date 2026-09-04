// ==========================================================================
// API CLIENT SERVICE
// ==========================================================================

const API = {
  baseUrl: window.location.origin,

  getToken() {
    return localStorage.getItem('pu_auth_token') || null;
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('pu_auth_token', token);
    } else {
      localStorage.removeItem('pu_auth_token');
    }
  },

  getUser() {
    try {
      const user = localStorage.getItem('pu_user');
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  },

  setUser(user) {
    if (user) {
      localStorage.setItem('pu_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('pu_user');
    }
  },

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();

    const headers = {
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const res = await fetch(url, {
        ...options,
        headers
      });

      const data = await res.json();

      if (res.status === 401) {
        // Unauthorized / session expired
        this.setToken(null);
        this.setUser(null);
        if (window.App && window.App.showAuth) {
          window.App.showToast('Session expired. Please log in again.', 'error');
          window.App.showAuth();
        }
        return data;
      }

      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      return {
        success: false,
        message: 'Network error or server unreachable. Please check your connection.'
      };
    }
  },

  // Auth Methods
  unifiedLogin(identifier, password) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password })
    });
  },

  studentLogin(ug_id, password) {
    return this.request('/api/auth/student-login', {
      method: 'POST',
      body: JSON.stringify({ ug_id, password })
    });
  },

  adminLogin(username, password) {
    return this.request('/api/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },

  getProfile() {
    return this.request('/api/auth/profile');
  },

  uploadProfilePhoto(formData) {
    return this.request('/api/auth/upload-photo', {
      method: 'POST',
      body: formData
    });
  },

  // Students (Admin)
  addStudent(studentData) {
    return this.request('/api/admin/students', {
      method: 'POST',
      body: JSON.stringify(studentData)
    });
  },

  getStudents(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/admin/students?${query}`);
  },

  updateStudent(id, studentData) {
    return this.request(`/api/admin/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(studentData)
    });
  },

  deleteStudent(id) {
    return this.request(`/api/admin/students/${id}`, {
      method: 'DELETE'
    });
  },

  toggleCR(id, is_cr) {
    return this.request(`/api/admin/students/${id}/toggle-cr`, {
      method: 'POST',
      body: JSON.stringify({ is_cr })
    });
  },

  // Timetable
  getStudentTimetable(day, date = null) {
    const params = new URLSearchParams();
    if (day) params.append('day', day);
    if (date) params.append('date', date);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/timetable${query}`);
  },

  getTodayClasses(params = {}) {
    let query = '';
    if (typeof params === 'string') {
      query = `?day=${encodeURIComponent(params)}`;
    } else if (params && typeof params === 'object') {
      const q = new URLSearchParams(params).toString();
      query = q ? `?${q}` : '';
    }
    return this.request(`/api/timetable/today${query}`);
  },

  getAllTimetable(date = null) {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return this.request(`/api/admin/timetable${query}`);
  },

  createTimetableEntry(data) {
    return this.request('/api/admin/timetable', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateTimetableEntry(id, data) {
    return this.request(`/api/admin/timetable/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteTimetableEntry(id) {
    return this.request(`/api/admin/timetable/${id}`, {
      method: 'DELETE'
    });
  },

  // Manual Room Change & Class Overrides (Admin & Authorized CR)
  changeClassRoom(data) {
    return this.request('/api/timetable/room-change', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  cancelClass(data) {
    return this.request('/api/timetable/cancel-class', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  revertClassOverride(id, data = {}) {
    if (id) {
      return this.request(`/api/timetable/override/${id}`, {
        method: 'DELETE'
      });
    }
    return this.request('/api/timetable/override/revert', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getOverrideHistory(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/timetable/overrides/history?${query}`);
  },

  getOverridesForDate(date) {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return this.request(`/api/timetable/overrides/today${query}`);
  },

  // Holidays
  getHolidays() {
    return this.request('/api/holidays');
  },

  addHoliday(data) {
    return this.request('/api/admin/holidays', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  deleteHoliday(id) {
    return this.request(`/api/admin/holidays/${id}`, {
      method: 'DELETE'
    });
  },

  // Attendance
  startQRSession(data) {
    return this.request('/api/attendance/session/start', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getLiveQRToken(sessionId) {
    return this.request(`/api/attendance/session/${sessionId}/live-token`);
  },

  stopQRSession(sessionId) {
    return this.request(`/api/attendance/session/${sessionId}/stop`, {
      method: 'POST'
    });
  },

  getSessionScans(sessionId) {
    return this.request(`/api/attendance/session/${sessionId}/scans`);
  },

  submitQRScan(scanData) {
    return this.request('/api/attendance/scan', {
      method: 'POST',
      body: JSON.stringify(scanData)
    });
  },

  submitFaceAttendance(data) {
    return this.request('/api/attendance/face-scan', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getActiveSessions() {
    return this.request('/api/attendance/active-sessions');
  },

  saveManualAttendance(data) {
    return this.request('/api/attendance/manual', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getStudentAttendance() {
    return this.request('/api/attendance/student-summary');
  },

  getAdminAttendanceReport(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/attendance/admin-report?${query}`);
  },

  // Academic Content
  getSubjects() {
    return this.request('/api/academic/subjects');
  },

  getSubjectStudyHub() {
    return this.request('/api/academic/study-hub');
  },

  getClassNotes(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/academic/notes?${query}`);
  },

  uploadClassNote(formData) {
    return this.request('/api/academic/notes', {
      method: 'POST',
      body: formData
    });
  },

  deleteClassNote(id) {
    return this.request(`/api/academic/notes/${id}`, {
      method: 'DELETE'
    });
  },

  getStudyMaterial(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/academic/material?${query}`);
  },

  uploadStudyMaterial(formData) {
    return this.request('/api/academic/material', {
      method: 'POST',
      body: formData
    });
  },

  deleteStudyMaterial(id) {
    return this.request(`/api/academic/material/${id}`, {
      method: 'DELETE'
    });
  },

  getAssignments(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/academic/assignments?${query}`);
  },

  createAssignment(formData) {
    return this.request('/api/academic/assignments', {
      method: 'POST',
      body: formData
    });
  },

  deleteAssignment(id) {
    return this.request(`/api/academic/assignments/${id}`, {
      method: 'DELETE'
    });
  },

  getQuestionPapers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/academic/question-papers?${query}`);
  },

  uploadQuestionPaper(formData) {
    return this.request('/api/academic/question-papers', {
      method: 'POST',
      body: formData
    });
  },

  deleteQuestionPaper(id) {
    return this.request(`/api/academic/question-papers/${id}`, {
      method: 'DELETE'
    });
  },

  getCalendar() {
    return this.request('/api/academic/calendar');
  },

  addCalendarEvent(data) {
    return this.request('/api/academic/calendar', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  deleteCalendarEvent(id) {
    return this.request(`/api/academic/calendar/${id}`, {
      method: 'DELETE'
    });
  },

  getAnnouncements() {
    return this.request('/api/academic/announcements');
  },

  createAnnouncement(data) {
    return this.request('/api/academic/announcements', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  deleteAnnouncement(id) {
    return this.request(`/api/academic/announcements/${id}`, {
      method: 'DELETE'
    });
  },

  // Results
  getStudentResults() {
    return this.request('/api/results/my');
  },

  saveResult(data) {
    return this.request('/api/results', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getAllResults(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/results/all?${query}`);
  },

  deleteResult(id) {
    return this.request(`/api/results/${id}`, {
      method: 'DELETE'
    });
  },

  uploadResultsExcel(formData) {
    return this.request('/api/results/upload-excel', {
      method: 'POST',
      body: formData
    });
  },

  // Notifications
  getStudentNotifications() {
    return this.request('/api/notifications/my');
  },

  sendNotification(data) {
    return this.request('/api/notifications', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getAllNotifications() {
    return this.request('/api/notifications/all');
  },

  deleteNotification(id) {
    return this.request(`/api/notifications/${id}`, {
      method: 'DELETE'
    });
  },

  // AI Assistant
  chatAI(prompt, contextSubject = null) {
    return this.request('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ prompt, contextSubject })
    });
  },

  // Search
  search(query) {
    return this.request(`/api/search?q=${encodeURIComponent(query)}`);
  },

  // Admin Dashboard Stats
  getDashboardStats() {
    return this.request('/api/admin/dashboard-stats');
  },

  // Academic File Download Helper
  getDownloadUrl(fileUrl, fileName) {
    if (!fileUrl) return '#';
    const cleanName = fileName || fileUrl.split('/').pop();
    const token = this.getToken();
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
    return `/api/academic/download?file=${encodeURIComponent(fileUrl)}&name=${encodeURIComponent(cleanName)}${tokenParam}`;
  }
};

window.API = API;
