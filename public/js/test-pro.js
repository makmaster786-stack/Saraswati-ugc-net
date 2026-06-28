// tests-pro.js - PROFESSIONAL TESTS MANAGEMENT (HYDRATION MODEL)
class TestsManager {
    constructor() {
        this.filters = {
            search: '',
            category: 'all'
        };
        this.init();
    }

    init() {
        console.log('📝 Tests Manager Hydrating Page...');
        this.setupEventListeners();
        this.applyFiltersAndFetch();
    }

    setupEventListeners() {
        const searchInput = document.getElementById('test-search');
        if (searchInput) {
            searchInput.addEventListener('input', ProfessionalUtils.debounce(() => this.applyFiltersAndFetch(), 300));
        }

        const filterSelect = document.getElementById('test-filter');
        if (filterSelect) {
            filterSelect.addEventListener('change', () => this.applyFiltersAndFetch());
        }
        
        // Logic for the test-taking interface
        if(document.querySelector('.test-interface')) {
            this.initTestInterface();
        }
    }
    
    async applyFiltersAndFetch() {
const urlParams = new URLSearchParams(window.location.search);
        const courseId = urlParams.get('course');

        // --- 2. ADD IT TO YOUR FILTERS OBJECT ---
        this.filters.search = document.getElementById('test-search')?.value || '';
        this.filters.category = document.getElementById('test-filter')?.value || 'all';
        if (courseId) {
            this.filters.course = courseId;
        }

        try {
            this.showLoading();
            const query = new URLSearchParams(this.filters).toString();
            const response = await fetch(`/api/tests?${query}`);
            const data = await response.json();
            if (data.success) {
                this.renderTests(data.tests);
            } else {
                throw new Error('Failed to fetch filtered tests');
            }
        } catch (error) {
            this.showError('Could not update tests.');
        } finally {
            this.hideLoading();
        }
    }

    renderTests(tests) {
        const container = document.getElementById('tests-container');
        const emptyState = document.getElementById('tests-empty');
        if (!container) return;
        
        if (tests.length === 0) {
            container.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }
        emptyState.classList.add('hidden');
        container.innerHTML = tests.map(test => this.createTestCard(test)).join('');
    }

   // REPLACE your existing createTestCard function with this one:

createTestCard(test) {
    // --- 1. Date & Lock Logic ---
    const now = new Date();
    const unlockDate = new Date(test.unlockDate);
    const isLocked = test.unlockDate && unlockDate > now;
    
    // --- 2. Button Logic ---
    const isEnrolled = window.AppConfig.USER?.enrolledCourses?.some(c => c.courseId === test.course?._id);
    const canAccess = test.isFree || isEnrolled;
    
    let buttonHtml = '';
    
    // --- NEW LOGIC HIERARCHY ---
    if (test.isCompleted) {
        // 1. Check for completion FIRST
        buttonHtml = `<a href="/my-results" class="btn btn-outline">View Result</a>`;
    } else if (!canAccess) {
        // 2. Check for enrollment
        buttonHtml = `<a href="/course-details?id=${test.course?._id}" class="btn btn-secondary">Enroll to Access</a>`;
    } else if (isLocked) {
        // 3. Check if locked
        const dateString = unlockDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        buttonHtml = `<button class="btn btn-secondary" disabled title="This test is not yet available.">
                        <i class="fas fa-lock"></i> Locked until ${dateString}
                      </button>`;
    } else {
        // 4. If all checks pass, they can start
        buttonHtml = `<a href="/take-test?id=${test._id}" class="btn btn-primary">Start Test</a>`;
    }
    // --- END NEW LOGIC ---
    

    // --- 3. Date Meta Info Logic (This part is from before and is correct) ---
    let dateMetaHtml = '';
    if (test.unlockDate) {
        const dateString = unlockDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        if (isLocked) {
            dateMetaHtml = `<div class="meta-item" style="color: var(--danger-color, #dc3545);">
                              <i class="fas fa-calendar-alt"></i><span>Unlocks: ${dateString}</span>
                            </div>`;
        } else {
            dateMetaHtml = `<div class="meta-item">
                              <i class="fas fa-calendar-check"></i><span>Available from: ${dateString}</span>
                            </div>`;
        }
    } else {
        dateMetaHtml = `<div class="meta-item">
                          <i class="fas fa-check-circle"></i><span>Available Now</span>
                        </div>`;
    }

    // --- 4. Final HTML ---
    return `
        <div class="test-card" data-test-id="${test._id}">
            <div class="test-header">
                <h3>${ProfessionalUtils.sanitizeHTML(test.title)}</h3>
                ${test.isFree ? '<span class="test-badge free">Free</span>' : ''}
            </div>
            <div class="test-body">
                <p class="test-description">${test.description || ''}</p>
                <div class="test-meta">
                    <div class="meta-item"><i class="fas fa-book"></i><span>${test.course?.title || 'General'}</span></div>
                    <div class="meta-item"><i class="fas fa-question-circle"></i><span>${test.questions?.length || 0} Questions</span></div>
                    <div class="meta-item"><i class="fas fa-clock"></i><span>${test.duration || 180} Minutes</span></div>
                    ${dateMetaHtml} 
                </div>
            </div>
            <div class="test-footer">${buttonHtml}</div>
        </div>
    `;
}

    initTestInterface() {
        // All the logic from your original professional.js `initTestInterface` method goes here
        console.log("Initializing test taking interface...");
    }

    showLoading() { document.getElementById('tests-loading')?.classList.remove('hidden'); }
    hideLoading() { document.getElementById('tests-loading')?.classList.add('hidden'); }
    showError(message) { window.showToast(message, 'error'); }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.tests-page') || document.querySelector('.test-interface')) {
        new TestsManager();
    }
});