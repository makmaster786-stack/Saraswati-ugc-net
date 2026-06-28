/* --- FILE: public/js/courses-pro.js (CORRECTED) --- */
class CoursesManager {
    constructor() {
        this.filters = { category: 'all', price: 'all', sort: 'popular', search: '' };
        this.currentPage = 1;
        this.totalPages = 1;
        this.init();
    }

    init() {
        console.log('📚 Courses Manager Hydrating Page...');
        this.setupEventListeners();
        
        // Only fetch courses if we are on the courses list page
        if (document.getElementById('courses-container')) {
            this.fetchCourses();
        }
        
        // Only fetch enrolled courses if we are on the dashboard (index)
        if (document.getElementById('enrolled-courses')) {
            this.fetchEnrolledCourses();
        }
    }

    async fetchEnrolledCourses() {
        if (!document.getElementById('enrolled-courses')) {
            return; 
        }
        try {
            const response = await fetch('/api/dashboard/stats'); 
            if (!response.ok) return;
            const data = await response.json();
            if (data.success) {
                this.updateEnrolledCourses(data.enrolledCourses);
            }
        } catch (error) {
            console.error('Failed to load enrolled courses:', error);
        }
    }

    setupEventListeners() {
        // Find all filter elements (they might not exist on all pages)
        const categoryFilter = document.getElementById('category-filter');
        const priceFilter = document.getElementById('price-filter');
        const sortFilter = document.getElementById('sort-filter');
        const courseSearch = document.getElementById('course-search');

        // Add listeners only if the elements exist
        if(categoryFilter) categoryFilter.addEventListener('change', () => this.applyFiltersAndFetch());
        if(priceFilter) priceFilter.addEventListener('change', () => this.applyFiltersAndFetch());
        if(sortFilter) sortFilter.addEventListener('change', () => this.applyFiltersAndFetch());
        if(courseSearch) courseSearch.addEventListener('input', ProfessionalUtils.debounce(() => this.applyFiltersAndFetch(), 400));

        // Use event delegation for the main courses list
        const coursesContainer = document.getElementById('courses-container');
        if (coursesContainer) {
            coursesContainer.addEventListener('click', (e) => {
                const enrollBtn = e.target.closest('.enroll-btn');
                if (enrollBtn) {
                    // --- THIS IS THE FIX ---
                    this.handleCourseEnrollment(enrollBtn);
                }
            });
        }
    }

    async applyFiltersAndFetch() {
        this.filters.category = document.getElementById('category-filter').value;
        this.filters.price = document.getElementById('price-filter').value;
        this.filters.sort = document.getElementById('sort-filter').value;
        this.filters.search = document.getElementById('course-search').value;
        this.currentPage = 1; // Reset to first page on filter change
        
        await this.fetchCourses();
    }

    async fetchCourses() {
        try {
            this.showLoading(true);
            const query = new URLSearchParams({ ...this.filters, page: this.currentPage }).toString();
            const response = await fetch(`/api/courses?${query}`);
            const data = await response.json();
            if (!data.success) throw new Error(data.message);
            
            this.totalPages = data.totalPages;
            this.renderCourses(data.courses);
        } catch (error) {
            this.showError('Failed to load courses.');
        } finally {
            this.showLoading(false);
        }
    }

    renderCourses(courses) {
        const container = document.getElementById('courses-container');
        const emptyState = document.getElementById('courses-empty');
        if (!container || !emptyState) return;

        if (courses.length === 0) {
            container.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }
        emptyState.classList.add('hidden');
        container.innerHTML = courses.map(course => this.createCourseCard(course)).join('');
    }

    createCourseCard(course) {
        const isFree = course.price === 0;
        const shortDesc = course.shortDescription || (course.description ? course.description.substring(0, 100) + '...' : 'No description available.');

        return `
            <div class="course-card-pro" data-course-id="${course._id}">
                <a href="/course/${course._id}" class="course-card-header">
                    <img src="${course.thumbnail || '/images/course-placeholder.jpg'}" alt="${course.title}">
                </a>
                <div class="course-card-body">
                    <div class="course-category">${course.category || 'General'}</div>
                    <h3 class="course-title">
                        <a href="/course/${course._id}">${course.title}</a>
                    </h3>
                    <p class="course-description">${shortDesc}</p>
                </div>
                <div class="course-card-footer">
                    <div class="course-price">
                        ${isFree ? '<span class="price-free">Free</span>' : `<span class="price-current">₹${course.price}</span>`}
                        ${(course.originalPrice && course.originalPrice > course.price) ? `<span class="price-original">₹${course.originalPrice}</span>` : ''}
                    </div>
                    
                    <div class="card-buttons" style="display: flex; gap: 0.5rem;">
                        <a href="/course/${course._id}" class="btn btn-secondary btn-sm">
                            View
                        </a>
                        <button class="btn btn-primary btn-sm enroll-btn" 
                                data-course-id="${course._id}" 
                                data-course-price="${course.price}" 
                                data-course-title="${course.title}">
                            ${isFree ? 'Enroll' : 'Enroll'}
                        </button>
                    </div>
                </div>
            </div>`;
    }

    updateEnrolledCourses(courses) {
        const container = document.getElementById('enrolled-courses');
        if (!container) return;

        if (!courses || courses.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 2rem; grid-column: 1 / -1;">
                    <i class="fas fa-book-open fa-2x" style="color: var(--gray-400); margin-bottom: 1rem;"></i>
                    <h4>No courses enrolled</h4>
                    <p>Start learning by enrolling in a course.</p>
                </div>`;
            return;
        }

        container.innerHTML = courses.map(ec => `
            <div class="course-card-pro" data-course-id="${ec.courseId}">
                <div class="course-card-header">
                    <img src="${ec.thumbnail || '/images/course-placeholder.jpg'}" alt="${ec.title}">
                </div>
                <div class="course-card-body">
                    <h3 class="course-title">${window.ProfessionalUtils?.sanitizeHTML(ec.title) || ec.title}</h3>
                    <div class="progress-container" style="margin-top: 1rem; margin-bottom: 0.5rem;">
                        <div class="progress-bar">
                            <div class="progress" style="width: ${ec.progress || 0}%"></div>
                        </div>
                        <span class="progress-text">${ec.progress || 0}% Complete</span>
                    </div>
                </div>
                <div class="course-card-footer">
                    <a href="/course/${ec.courseId}" class="btn btn-primary btn-sm btn-block">
                        <i class="fas fa-play"></i> ${ec.progress > 0 ? 'Continue Course' : 'Start Course'}
                    </a>
                </div>
            </div>
        `).join('');
    }

    async handleCourseEnrollment(button) {
        const courseId = button.dataset.courseId;
        const coursePrice = parseFloat(button.dataset.coursePrice);

        if (!window.AppConfig.USER) {
            window.showToast('Please log in to enroll.', 'info');
            setTimeout(() => window.location.href = '/login', 1500);
            return;
        }

        if (coursePrice === 0) {
            // --- FREE ENROLL LOGIC ---
            button.disabled = true;
            button.textContent = 'Enrolling...';
            try {
                const response = await fetch('/api/courses/enroll-free', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ courseId })
                });
                
                const result = await response.json();
                if (result.success) {
                    window.showToast('Successfully enrolled!', 'success');
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    window.showToast(result.message || 'Enrollment failed', 'error');
                    button.disabled = false;
                    button.textContent = 'Enroll';
                }
            } catch (error) {
                window.showToast('Network error. Please try again.', 'error');
                button.disabled = false;
                button.textContent = 'Enroll';
            }
        } else {
            // Paid course - redirect to course details AND trigger checkout
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing Checkout...';
            window.location.href = `/course-details?id=${courseId}&checkout=true`;
        }
    }

    showLoading(isLoading) {
        const initialSpinner = document.getElementById('courses-loading'); 
        const container = document.getElementById('courses-container'); 
        if (!container || !initialSpinner) return;

        if (isLoading) {
            initialSpinner.classList.add('hidden');
            container.innerHTML = `<div class="loading-state" style="display:flex; justify-content:center; padding: 4rem;"><div class="spinner"></div></div>`;
        } else {
            initialSpinner.classList.add('hidden');
        }
    }
    
    showError(message) { 
        window.showToast(message, 'error'); 
        this.showLoading(false);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // This will now run on both the courses list page and the course details page
    if (document.querySelector('.courses-page') || document.querySelector('.course-details-page')) {
        new CoursesManager();
    }
});