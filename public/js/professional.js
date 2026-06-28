/* =================================================================== */
/* PROFESSIONAL.JS — GLOBAL UTILITIES                                  */
/* Handles: navbar scroll, logout, toast system, loading spinner       */
/* =================================================================== */

class ProfessionalApp {
    constructor() {
        if (window.ProfessionalApp) return; // Singleton
        window.ProfessionalApp = this;
        this.init();
    }

    init() {
        this.setupGlobalUtilities();
        this.setupNavbar();
        this.setupLogout();
        this.hideLoadingSpinner();
        document.dispatchEvent(new CustomEvent('professionalapp:ready'));
    }

    /* ── TOAST SYSTEM ── */
    setupGlobalUtilities() {
        window.showToast = (message, type = 'info', duration = 5000) => {
            const container = document.getElementById('toast-container') || this._createToastContainer();
            const icons = {
                success: 'fa-check-circle',
                error:   'fa-exclamation-circle',
                warning: 'fa-exclamation-triangle',
                info:    'fa-info-circle'
            };
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.innerHTML = `
                <i class="fas ${icons[type] || icons.info}" aria-hidden="true"></i>
                <span class="toast-message">${message}</span>
                <button class="toast-close" aria-label="Close notification">&times;</button>`;
            container.appendChild(toast);

            requestAnimationFrame(() => toast.classList.add('show'));

            const hide = () => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 400);
            };
            toast.querySelector('.toast-close').addEventListener('click', hide);
            setTimeout(hide, duration);
        };

        window.ProfessionalUtils = {
            debounce(fn, wait) {
                let t;
                return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
            },
            sanitizeHTML(str) {
                if (!str) return '';
                const el = document.createElement('div');
                el.textContent = str;
                return el.innerHTML;
            },
            formatDate(dateStr) {
                if (!dateStr) return 'N/A';
                return new Date(dateStr).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric'
                });
            },
            formatScore(pct) {
                const p = Math.round(pct);
                if (p >= 80) return { text: `${p}%`, cls: 'score-excellent' };
                if (p >= 60) return { text: `${p}%`, cls: 'score-good' };
                if (p >= 40) return { text: `${p}%`, cls: 'score-average' };
                return { text: `${p}%`, cls: 'score-poor' };
            }
        };
    }

    _createToastContainer() {
        const c = document.createElement('div');
        c.id = 'toast-container';
        c.className = 'toast-container';
        document.body.appendChild(c);
        return c;
    }

    /* ── NAVBAR SCROLL EFFECT ── */
    setupNavbar() {
        const navbar = document.querySelector('.navbar-pro');
        if (!navbar) return;
        const onScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 50);
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll(); // Check on load
        this.setupDropdown();
    }

    /* ── PROFILE DROPDOWN ── */
    /* Uses position:fixed + appended to body to escape:
       1. backdrop-filter stacking context on .navbar-pro
       2. overflow-x:hidden stacking context on body
       Both of these trap position:absolute dropdowns and kill pointer-events */
    setupDropdown() {
        const avatar   = document.querySelector('.user-avatar');
        const dropdown = document.querySelector('.dropdown-menu');
        if (!avatar || !dropdown) return;

        // Move to <body> so it escapes every stacking context
        document.body.appendChild(dropdown);
        dropdown.style.position = 'fixed';
        dropdown.style.zIndex   = '99999';
        dropdown.style.margin   = '0';
        dropdown.style.display  = 'block';

        const positionDropdown = () => {
            const rect  = avatar.getBoundingClientRect();
            const dropW = dropdown.offsetWidth || 200;
            dropdown.style.top  = (rect.bottom + 6) + 'px';
            dropdown.style.left = Math.max(8, rect.right - dropW) + 'px';
        };

        const open   = () => { positionDropdown(); dropdown.classList.add('active');    avatar.setAttribute('aria-expanded', 'true');  };
        const close  = () => {                     dropdown.classList.remove('active'); avatar.setAttribute('aria-expanded', 'false'); };
        const toggle = () => dropdown.classList.contains('active') ? close() : open();

        avatar.addEventListener('click',   (e) => { e.stopPropagation(); toggle(); });
        avatar.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
            if (e.key === 'Escape') close();
        });
        document.addEventListener('click', (e) => {
            if (!avatar.contains(e.target) && !dropdown.contains(e.target)) close();
        });
        window.addEventListener('resize', () => {
            if (dropdown.classList.contains('active')) positionDropdown();
        });
    }

    /* ── LOGOUT ── */
    setupLogout() {
        document.querySelectorAll('#logout-btn, #mobile-logout-btn').forEach(btn => {
            if (!btn) return;
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    await fetch('/api/auth/logout', { method: 'POST' });
                } catch (err) {
                    console.warn('Logout API failed silently:', err);
                } finally {
                    window.showToast('You have been signed out.', 'info', 2000);
                    setTimeout(() => { window.location.href = '/login'; }, 1500);
                }
            });
        });
    }

    /* ── HIDE INITIAL LOADING SPINNER ── */
    hideLoadingSpinner() {
        const spinner = document.getElementById('loading-spinner');
        if (!spinner) return;
        // Small delay so page content paints first
        setTimeout(() => {
            spinner.style.opacity = '0';
            spinner.style.transition = 'opacity 0.3s ease';
            setTimeout(() => spinner.remove(), 350);
        }, 100);
    }
}

/* Bootstrap the app */
document.addEventListener('DOMContentLoaded', () => { new ProfessionalApp(); });
