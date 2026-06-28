// public/js/dashboard-pro.js - UPDATED & FIXED
class DashboardManager {
    constructor() {
        this.user = window.AppConfig?.USER || null;
        if (!this.user) {
            console.warn('No user data found in dashboard');
            return;
        }
        this.init();
    }

    async init() {
        console.log('📊 Dashboard Manager Initialized for:', this.user.fullname);
        this.showLoading();
        try {
            const data = await this.fetchDashboardData();
            if (data && data.success) {
                this.updateStatsCards(data.stats);
                this.updateEnrolledCourses(data.enrolledCourses);
                this.updateRecentActivity(data.recentTests);
            } else {
                this.showError('Failed to load dashboard data');
            }
        } catch (error) {
            console.error('Dashboard initialization error:', error);
            this.showError('Failed to load dashboard. Please refresh the page.');
        } finally {
            this.hideLoading();
        }
        this.updatePersonalizedGreeting();
        this.updateLastActiveTime();
        this.setupEventListeners();
    }

    async fetchDashboardData() {
        try {
            const response = await fetch('/api/dashboard/stats');
            if (response.status === 401) {
                window.location.href = '/login';
                return null;
            }
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Dashboard loading error:', error);
            throw error;
        }
    }

    updateStatsCards(stats) {
        if (!stats) return;
        
        const elements = {
            'stats-tests-taken': stats.testsTaken || 0,
            'stats-avg-score': `${Math.round(stats.averageScore) || 0}%`,
            'stats-best-score': `${Math.round(stats.bestScore) || 0}%`,
            'stats-enrolled-courses': stats.enrolledCourses || 0
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });

        // Update last active display from stats
        if (stats.lastActive) {
            this.user.lastActive = stats.lastActive;
            this.updateLastActiveTime();
        }
    }
    // REPLACE your existing _createTestButton function with this one:

_createTestButton(tests, courseId) {
    if (!tests || tests.length === 0) {
        return ''; // No tests, no button
    }

    // Check if ALL tests in this course are complete
    const allComplete = tests.every(t => t.isCompleted);
    if (allComplete && tests.length > 0) {
        return `<a href="/my-results" class="btn btn-outline btn-sm">View Results</a>`;
    }

    // If only one test, check its status
    if (tests.length === 1) {
        const test = tests[0];
        if (test.isCompleted) {
            return `<a href="/my-results" class="btn btn-outline btn-sm">View Result</a>`;
        }
        return `<a href="/take-test?id=${test._id}" class="btn btn-primary btn-sm">Take Test</a>`;
    }

    // Multiple tests, some incomplete. Link to the filtered list.
    return `<a href="/available-tests?course=${courseId}" class="btn btn-primary btn-sm">View ${tests.length} Tests</a>`;
}

 // REPLACE your old function with this corrected one:

   // REPLACE your old function with this new, corrected one:

   
    updateEnrolledCourses(courses) {
        const container = document.getElementById('enrolled-courses');
        if (!container) return;

        if (!courses || courses.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align:center;padding:2rem;grid-column:1/-1;">
                    <i class="fas fa-book-open fa-2x" style="color:var(--gray-400);margin-bottom:1rem;"></i>
                    <h4>No courses enrolled</h4>
                    <p>Start learning by enrolling in a course.</p>
                    <a href="/courses" class="btn btn-primary" style="margin-top:1rem;">Browse Courses</a>
                </div>`;
            return;
        }

        container.innerHTML = courses.map(ec => {
            const pct = Math.min(100, Math.max(0, ec.progress || 0));
            const circumference = 2 * Math.PI * 22; // r=22
            const offset = circumference - (pct / 100) * circumference;
            const ringClass = pct >= 100 ? 'done' : pct >= 50 ? 'mid' : '';

            // Progress label
            let progressLabel = 'Not started yet';
            let progressSub = 'Start your first lesson';
            if (pct > 0 && pct < 100) {
                progressLabel = `${pct}% Complete`;
                progressSub = 'Keep going — you\'re on track!';
            } else if (pct >= 100) {
                progressLabel = '✅ Completed!';
                progressSub = 'Excellent work — course done!';
            }

            const title = window.ProfessionalUtils?.sanitizeHTML(ec.title) || ec.title || 'Course';
            const thumb = ec.thumbnail;

            return `
            <div class="course-card-pro">
                <!-- Top: Thumbnail + Title -->
                <div class="ccp-top">
                    ${thumb
                        ? `<img src="${thumb}" alt="${title}" class="ccp-thumb" loading="lazy">`
                        : `<div class="ccp-thumb-placeholder"><i class="fas fa-graduation-cap"></i></div>`
                    }
                    <div class="ccp-info">
                        <div class="ccp-title">${title}</div>
                        <div class="ccp-category">${ec.category || 'UGC NET Course'}</div>
                    </div>
                </div>

                <!-- Progress Ring -->
                <div class="ccp-ring-row">
                    <div class="progress-ring-wrap">
                        <svg class="progress-ring-svg" width="56" height="56" viewBox="0 0 56 56">
                            <circle class="pr-bg" cx="28" cy="28" r="22"/>
                            <circle class="pr-fill ${ringClass}" cx="28" cy="28" r="22"
                                stroke-dasharray="${circumference.toFixed(1)}"
                                stroke-dashoffset="${offset.toFixed(1)}"/>
                        </svg>
                        <div class="pr-pct">${pct}%</div>
                    </div>
                    <div class="ccp-ring-text">
                        <h4>${progressLabel}</h4>
                        <p>${progressSub}</p>
                    </div>
                </div>

                <!-- Actions -->
                <div class="ccp-actions">
                    <a href="/course-details?id=${ec.courseId}" class="ccp-btn-continue">
                        <i class="fas fa-${pct >= 100 ? 'redo' : 'play'}"></i>
                        ${pct >= 100 ? 'Review Course' : pct > 0 ? 'Continue' : 'Start Now'}
                    </a>
                    ${this._createTestButton(ec.tests, ec.courseId)}
                </div>
            </div>`;
        }).join('');

        // Animate rings on load with a small delay so transition fires
        setTimeout(() => {
            container.querySelectorAll('.pr-fill').forEach(ring => {
                const offset = ring.getAttribute('stroke-dashoffset');
                ring.style.strokeDashoffset = ring.getAttribute('stroke-dasharray');
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        ring.style.strokeDashoffset = offset;
                    });
                });
            });
        }, 100);
    }


    updateRecentActivity(tests) {
        const container = document.querySelector('.activity-list');
        if (!container) return;
        
        if (!tests || tests.length === 0) {
            container.innerHTML = `<div class="empty-state" style="padding: 1rem;"><p>No recent test activity found.</p></div>`;
            return;
        }

        container.innerHTML = tests.map(test => {
            const scoreClass = test.percentage >= 70 ? 'score-excellent' : 
                             test.percentage >= 50 ? 'score-good' : 'score-poor';
            return `
                <div class="activity-item">
                    <div class="activity-icon"><i class="fas fa-check-circle"></i></div>
                    <div class="activity-content">
                        <p>Completed <strong>${window.ProfessionalUtils?.sanitizeHTML(test.title) || test.title}</strong></p>
                        <span class="activity-time">${window.ProfessionalUtils?.formatDate(test.submittedAt) || test.submittedAt}</span>
                    </div>
                    <div class="activity-score ${scoreClass}">${Math.round(test.percentage)}%</div>
                </div>
            `;
        }).join('');
    }

    updatePersonalizedGreeting() {
        const greetingElement = document.querySelector('.welcome-content h1');
        if (greetingElement && this.user) {
            const firstName = this.user.fullname.split(' ')[0];
            greetingElement.innerHTML = `Welcome back, <span class="user-name">${firstName}</span>! 👋`;
        }
    }

    updateLastActiveTime() {
        const el = document.getElementById('last-active-time');
        if (!el) return;
        // Update lastActive on server silently
        fetch('/api/auth/ping', { method: 'POST' }).catch(() => {});
        // Show friendly time
        const lastActive = this.user?.lastActive;
        if (!lastActive) { el.textContent = 'Just now'; return; }
        const diff = Math.floor((Date.now() - new Date(lastActive)) / 60000);
        if (diff < 1)  el.textContent = 'Just now';
        else if (diff < 60) el.textContent = `${diff}m ago`;
        else if (diff < 1440) el.textContent = `${Math.floor(diff/60)}h ago`;
        else el.textContent = `${Math.floor(diff/1440)}d ago`;
    }

    setupEventListeners() {
        // Handle course enrollment buttons
        document.addEventListener('click', (e) => {
            const enrollBtn = e.target.closest('.enroll-btn');
            if (enrollBtn) {
                this.handleCourseEnrollment(enrollBtn);
            }
        });
    }

    async handleCourseEnrollment(button) {
        const courseId = button.dataset.courseId;
        const coursePrice = parseFloat(button.dataset.coursePrice);
        const courseTitle = button.dataset.courseTitle;

        if (coursePrice === 0) {
            // Free course enrollment
            try {
                const response = await fetch('/api/courses/enroll-free', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ courseId })
                });
                
                const result = await response.json();
                if (result.success) {
                    window.showToast('Successfully enrolled in the course!', 'success');
                    // Refresh the page to show updated enrollment
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    window.showToast(result.message || 'Enrollment failed', 'error');
                }
            } catch (error) {
                window.showToast('Network error. Please try again.', 'error');
            }
        } else {
            // Paid course - redirect to course details AND trigger checkout
            window.location.href = `/course-details?id=${courseId}&checkout=true`;
        }
    }

    showLoading() {
        const container = document.getElementById('enrolled-courses');
        if (container) container.classList.add('loading');
    }

    hideLoading() {
        const container = document.getElementById('enrolled-courses');
        if (container) container.classList.remove('loading');
    }

    showError(message) {
        if (window.showToast) {
            window.showToast(message, 'error');
        } else {
            console.error('Dashboard Error:', message);
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.dashboard-pro')) {
        new DashboardManager();
    }
});