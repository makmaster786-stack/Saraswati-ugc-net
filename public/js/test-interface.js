// public/js/test-interface.js - FIXED VERSION
// Enhanced with better error handling, state management, and network resilience

class TestInterfaceManager {
    constructor() {
        this.testData = null;
        this.userAnswers = [];
        this.currentQuestionIndex = 0;
        this.timerInterval = null;
        this.lang = 'english';

        this.currentAttemptId = null; 
        this.saveInterval = null; 
        this.timerDuration = 0; 
        this.isSubmitting = false;
        this.savedRemainingTime = 0; 
        this.toastTimeout = null;
        this.isSaving = false;
        this.pendingSave = false;
        this.sidebarVisible = true;     
        this.PAPER_1_COUNT = 50; 
        this.COMBINED_TEST_COUNT = 150; 

        this.elements = {
            
            mainContainer: document.querySelector('.test-interface-fullscreen'), 
            testTitle: document.getElementById('test-title'),
            testSubject: document.getElementById('test-subject-badge'), 
            testDifficulty: document.getElementById('test-diff-badge'), 
            timer: document.getElementById('test-timer'),
            currentQ: document.getElementById('current-q'),
            totalQs: document.getElementById('total-qs'),
            questionText: document.getElementById('question-text'),
            optionsContainer: document.getElementById('options-container'),
            paletteContainer: document.getElementById('question-palette'),
            
            saveNextBtn: document.getElementById('save-next'),
            clearBtn: document.getElementById('clear-response'),
            reviewBtn: document.getElementById('mark-review'),
            saveReviewBtn: document.getElementById('save-review'), 
            sidebarToggleBtn: document.getElementById('toggle-sidebar-btn'),
            sidebarPanel: document.querySelector('.sidebar-panel'),
            submitBtn: document.getElementById('submit-test'),
            confirmSubmitBtn: document.getElementById('confirm-submit'),
            cancelSubmitBtn: document.getElementById('cancel-submit'),
            submitModal: document.getElementById('submit-modal'),
            toggleLangBtn: document.getElementById('toggle-lang-btn'),
            sectionTabs: document.getElementById('test-section-tabs'),

            fullscreenBtn: document.getElementById('fullscreen-btn'),
            instructionsBtn: document.getElementById('instructions-btn'),

            // Start Test Modal
            startTestModal: document.getElementById('start-test-modal'),
            confirmStartBtn: document.getElementById('confirm-start-test'),

            // Toast Notification
            toastContainer: document.getElementById('toast-container'),
        };
        
        if (this.elements.mainContainer) {
            // Attach start button listener IMMEDIATELY — before async init()
            // so it works even if the user clicks before the API call completes
            this._pendingStart = false;
            if (this.elements.confirmStartBtn) {
                this.elements.confirmStartBtn.addEventListener('click', () => {
                    if (this._initComplete) {
                        this.handleStartTest();
                    } else {
                        // Mark pending — init() will fire it when ready
                        this._pendingStart = true;
                        this.elements.confirmStartBtn.disabled = true;
                        this.elements.confirmStartBtn.innerHTML =
                            '<i class="fas fa-spinner fa-spin"></i> Loading Test...';
                    }
                });
            }
            this.init();
        } else {
            console.log("Not a test page. TestInterfaceManager will not initialize.");
        }
    }

    async init() {
        const testId = new URLSearchParams(window.location.search).get('id');
        if (!testId) {
            document.body.innerHTML = '<h1>Error: Test ID not found.</h1>';
            return;
        }

        try {
            // Try to load from localStorage first for resilience
            const cachedData = this.loadFromLocalStorage(testId);
            if (cachedData) {
                console.log('Loaded cached test data');
                this.restoreFromCache(cachedData);
            }

            const response = await fetch(`/api/tests/${testId}/start`, { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (!response.ok) {
                if (cachedData) {
                    this.showToast('Using cached data - connection issue', 'warning');
                    return;
                }
                throw new Error('Failed to load test session.');
            }
            
            const data = await response.json();
            if (!data.success) throw new Error(data.message);
            
            const attempt = data.attempt;
            this.currentAttemptId = attempt._id;
            this.testData = attempt.test; 

            if (!this.testData || !this.testData.questions) {
                console.error("Test data is corrupt or questions are missing.", this.testData);
                throw new Error("Test data is corrupt. Please contact support.");
            }
            if (this.testData.questions.length === 0) {
                console.warn(`Test "${this.testData.title}" (ID: ${this.testData._id}) has 0 questions.`);
                throw new Error("This test has no questions. Please go to the admin panel and add questions to it.");
            }

            // Initialize or merge user answers
            this.initializeUserAnswers(attempt);
            
            if (this.elements.testTitle)    this.elements.testTitle.textContent    = this.testData.title;
            if (this.elements.testSubject)  this.elements.testSubject.textContent  = this.testData.course?.title || 'General';
            if (this.elements.testDifficulty) this.elements.testDifficulty.textContent = this.testData.difficulty || 'Medium';
            if (this.elements.totalQs)      this.elements.totalQs.textContent      = this.testData.questions.length;
            
            if (this.elements.sectionTabs && this.testData.questions.length === this.COMBINED_TEST_COUNT) {
                this.elements.sectionTabs.style.display = 'flex';
            }

            this.renderPalette();
            // Resume from saved position if returning mid-test, otherwise start at Q1
            this.renderQuestion(this.currentQuestionIndex || 0);
            
            let timeInSeconds = Number(attempt.remainingTime);
            
            if (!timeInSeconds || timeInSeconds <= 0) {
                timeInSeconds = (this.testData.duration || 0) * 60;
            }

            if (timeInSeconds <= 0) {
                console.warn("Test has no duration. Defaulting to 10 minutes.");
                timeInSeconds = 600; 
            }

            this.savedRemainingTime = timeInSeconds;
            this.timerDuration = timeInSeconds;
            
            this.updateTimerDisplay();

            this.setupEventListeners();
            this._initComplete = true;

            // If user clicked Start while API was loading, fire it now
            if (this._pendingStart) {
                this._pendingStart = false;
                this.handleStartTest();
            }
            
            // Start auto-save with better error handling
            this.startAutoSave();
            
            // Save to localStorage
            this.saveToLocalStorage();

        } catch (error) {
            console.error('Initialization error:', error);
            this.showToast(`Error: ${error.message}`, 'error');
            setTimeout(() => {
                window.location.href = '/tests';
            }, 3000);
        }
    }

    /* [test-interface.js] FIXED initializeUserAnswers (Handles Deleted Questions) */
    initializeUserAnswers(attempt) {
        // 1. SAFETY: Filter out broken questions from the Test Data first
        if (this.testData && this.testData.questions) {
            this.testData.questions = this.testData.questions.filter(q => q && q._id);
        }

        const savedAnswersMap = new Map();
        if (attempt.answers && attempt.answers.length > 0) {
            attempt.answers.forEach(a => {
                // 2. SAFETY: Only map answers where the question actually still exists
                // If question population failed (null) or ID is missing, skip it.
                if (a.questionId && (a.questionId._id || typeof a.questionId === 'string')) {
                    const id = a.questionId._id ? a.questionId._id.toString() : a.questionId.toString();
                    savedAnswersMap.set(id, a);
                }
            });
        }

        this.userAnswers = this.testData.questions.map((q, index) => {
            // 3. SAFETY: q is guaranteed to exist now due to step 1
            const saved = savedAnswersMap.get(q._id.toString());
            
            if (saved) {
                return {
                    questionId: q._id,
                    status: saved.status || 'not-visited',
                    selectedOptionIndex: saved.selectedOptionIndex,
                    timeSpent: saved.timeSpent || 0,
                    lastUpdated: saved.lastUpdated || new Date().toISOString()
                };
            }
            
            // Check cache logic...
            const cachedAnswer = this.userAnswers[index];
            if (cachedAnswer && cachedAnswer.questionId === q._id.toString()) {
                return cachedAnswer;
            }

            return {
                questionId: q._id,
                status: 'not-visited',
                selectedOptionIndex: null,
                timeSpent: 0,
                lastUpdated: new Date().toISOString()
            };
        });
    }
    // Local Storage methods for resilience
    saveToLocalStorage() {
        if (!this.currentAttemptId) return;
        
        const cacheData = {
            attemptId: this.currentAttemptId,
            testId: this.testData._id,
            userAnswers: this.userAnswers,
            currentQuestionIndex: this.currentQuestionIndex,
            timerDuration: this.timerDuration,
            lastSaved: new Date().toISOString()
        };
        
        try {
            localStorage.setItem(`test_${this.currentAttemptId}`, JSON.stringify(cacheData));
        } catch (e) {
            console.warn('Failed to save to localStorage:', e);
        }
    }

    loadFromLocalStorage(testId) {
        try {
            const keys = Object.keys(localStorage);
            const testKey = keys.find(key => key.startsWith('test_'));
            if (testKey) {
                const data = JSON.parse(localStorage.getItem(testKey));
                // Only return if it's for the current test and not too old (24 hours)
                if (data && data.testId === testId) {
                    const hoursDiff = (new Date() - new Date(data.lastSaved)) / (1000 * 60 * 60);
                    if (hoursDiff < 24) {
                        return data;
                    } else {
                        localStorage.removeItem(testKey);
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to load from localStorage:', e);
        }
        return null;
    }

    restoreFromCache(cachedData) {
        this.currentAttemptId = cachedData.attemptId;
        this.userAnswers = cachedData.userAnswers || [];
        this.currentQuestionIndex = cachedData.currentQuestionIndex || 0;
        this.timerDuration = cachedData.timerDuration || 0;
    }

    startAutoSave() {
        if (this.saveInterval) clearInterval(this.saveInterval);
        
        this.saveInterval = setInterval(async () => {
            if (this.isSaving) {
                this.pendingSave = true;
                return;
            }
            
            await this.saveProgress();
            
            // Handle pending save
            if (this.pendingSave) {
                this.pendingSave = false;
                await this.saveProgress();
            }
        }, 15000); // 15 seconds
    }

    renderQuestion(index) {
        if (index < 0 || index >= this.testData.questions.length) {
            console.error('Invalid question index:', index);
            return;
        }

        this.currentQuestionIndex = index;
        const question = this.testData.questions[index];
        
        this.elements.currentQ.textContent = index + 1;
        
        // Safe question text rendering
        const questionText = question.questionText?.[this.lang] || question.questionText?.english || 'Question text not available';
        this.elements.questionText.innerHTML = questionText;
        
        this.elements.optionsContainer.innerHTML = '';
        
        // Safe options rendering
        question.options.forEach((opt, i) => {
            const optionText = opt?.[this.lang] || opt?.english || `Option ${i + 1}`;
            this.elements.optionsContainer.innerHTML += `
                <div class="option-item">
                    <input type="radio" name="option" id="opt${i}" value="${i}">
                    <label for="opt${i}">${optionText}</label>
                </div>
            `;
        });
        
        const userAnswer = this.userAnswers[index];
        
        if (userAnswer && userAnswer.selectedOptionIndex !== null) {
            const radio = this.elements.optionsContainer.querySelector(`input[value="${userAnswer.selectedOptionIndex}"]`);
            if (radio) radio.checked = true;
        }
        
        // Update status if visiting for the first time
        if (userAnswer && userAnswer.status === 'not-visited') {
            userAnswer.status = 'not-answered';
            userAnswer.lastUpdated = new Date().toISOString();
        }

        this.updatePalette();
        this.updateSectionTabs(index);
    }

    renderPalette() {
        if (!this.elements.paletteContainer) return;
        
        this.elements.paletteContainer.innerHTML = this.testData.questions.map((_, i) => {
            const status = this.userAnswers[i]?.status || 'not-visited';
            return `<button class="palette-btn ${status}" data-index="${i}">${i + 1}</button>`;
        }).join('');
    }

    updatePalette() {
        const buttons = this.elements.paletteContainer.querySelectorAll('.palette-btn');
        const statusClasses = ['not-visited', 'not-answered', 'answered', 'marked-for-review', 'answered-review', 'current'];

        buttons.forEach((btn, i) => {
            if (!this.userAnswers[i]) return;
            
            btn.classList.remove(...statusClasses);
            btn.classList.add(this.userAnswers[i].status);
            
            if (i === this.currentQuestionIndex) {
                btn.classList.add('current');
            }
        });
    }

    setupEventListeners() {
        // Button Clicks
        this.elements.saveNextBtn?.addEventListener('click', () => this.handleSaveAndNext());
        this.elements.reviewBtn?.addEventListener('click', () => this.handleMarkForReview());
        this.elements.saveReviewBtn?.addEventListener('click', () => this.handleSaveAndMarkForReview());
        this.elements.clearBtn?.addEventListener('click', () => this.handleClearResponse());
        this.elements.submitBtn?.addEventListener('click', () => this.openSubmitModal());
        
        // Mobile Sidebar Toggle Logic
    if (this.elements.sidebarToggleBtn && this.elements.sidebarPanel) {
        // Show button only on mobile
        if (window.innerWidth <= 1024) {
            this.elements.sidebarToggleBtn.style.display = 'inline-flex';
        }

        // Toggle Sidebar
        this.elements.sidebarToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent closing immediately
            this.elements.sidebarPanel.classList.toggle('active');
        });

        // Close sidebar when clicking outside of it
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 1024 && 
                this.elements.sidebarPanel.classList.contains('active') && 
                !this.elements.sidebarPanel.contains(e.target) && 
                e.target !== this.elements.sidebarToggleBtn) {
                this.elements.sidebarPanel.classList.remove('active');
            }
        });
    }
        // Palette Click
        this.elements.paletteContainer?.addEventListener('click', (e) => {
            if (e.target.matches('.palette-btn')) {
                const newIndex = parseInt(e.target.dataset.index, 10);
                if (newIndex === this.currentQuestionIndex) return;
                
                this.updateCurrentAnswerState('preserve');
                this.saveProgress().finally(() => {
                    this.renderQuestion(newIndex);
                });
            }
        });

        // Other UI Clicks
        this.elements.cancelSubmitBtn?.addEventListener('click', () => this.closeSubmitModal());
        this.elements.confirmSubmitBtn?.addEventListener('click', () => this.handleSubmit());
        this.elements.toggleLangBtn?.addEventListener('click', () => this.toggleLanguage());
        this.elements.fullscreenBtn?.addEventListener('click', () => this.toggleFullScreen());
        this.elements.confirmStartBtn?.addEventListener('click', () => this.handleStartTest());
        
        // Modals
        this.elements.instructionsBtn?.addEventListener('click', () => {
            document.getElementById('instructions-modal')?.classList.add('active');
        });
        
        document.querySelector('#instructions-modal .modal-close')?.addEventListener('click', () => {
            document.getElementById('instructions-modal')?.classList.remove('active');
        });

        document.querySelector('#submit-modal .modal-close')?.addEventListener('click', () => {
            this.closeSubmitModal();
        });

        // Section Tabs
        if (this.elements.sectionTabs) {
            this.elements.sectionTabs.addEventListener('click', (e) => {
                const tab = e.target.closest('.section-tab');
                if (!tab) return;
                
                let newIndex = 0;
                if (tab.dataset.section === 'p2') newIndex = this.PAPER_1_COUNT;
                
                this.updateCurrentAnswerState('preserve');
                this.saveProgress().finally(() => {
                    this.renderQuestion(newIndex);
                });
            });
        }

        // Window event listeners for resilience
        window.addEventListener('beforeunload', (e) => {
            if (this.currentAttemptId) {
                this.updateCurrentAnswerState('preserve');
                this.saveProgress(true); // Force sync save
                
                // Show warning for modern browsers
                e.preventDefault();
                e.returnValue = 'Your test progress will be saved, but are you sure you want to leave?';
                return e.returnValue;
            }
        });

        window.addEventListener('online', () => {
            this.showToast('Connection restored. Syncing progress...', 'success');
            this.saveProgress();
        });

        window.addEventListener('offline', () => {
            this.showToast('Connection lost. Working offline...', 'warning');
        });
    }

    handleStartTest() {
        if (this.elements.startTestModal) {
            this.elements.startTestModal.classList.remove('active');
        }
        // Fullscreen must come from a direct user gesture — try silently, never block test start
        try {
            const el = this.elements.mainContainer;
            if (el && el.requestFullscreen) el.requestFullscreen().catch(() => {});
        } catch(e) {}
        this.startTimer(this.timerDuration);
    }

    updateSectionTabs(index) {
        if (!this.elements.sectionTabs || this.testData.questions.length !== this.COMBINED_TEST_COUNT) return; 
        const tabs = this.elements.sectionTabs.querySelectorAll('.section-tab');
        if (!tabs || tabs.length < 2) return; 
        
        tabs[0].classList.remove('active');
        tabs[1].classList.remove('active');
        
        if (index < this.PAPER_1_COUNT) {
            tabs[0].classList.add('active'); 
        } else {
            tabs[1].classList.add('active'); 
        }
    }

    updateCurrentAnswerState(mode = 'preserve') {
        const answer = this.userAnswers[this.currentQuestionIndex];
        if (!answer) return false;

        const selected = this.elements.optionsContainer.querySelector('input[name="option"]:checked');
        const selectedIndex = selected ? parseInt(selected.value, 10) : null;

        switch (mode) {
            case 'finalize': // "Save & Next"
                answer.selectedOptionIndex = selectedIndex;
                answer.status = selectedIndex !== null ? 'answered' : 'not-answered';
                break;
            
            case 'review': // "Mark for Review & Next"
                answer.selectedOptionIndex = selectedIndex;
                answer.status = selectedIndex !== null ? 'answered-review' : 'marked-for-review';
                break;
            
            case 'save_review': // "Save & Mark for Review"
                if (selectedIndex === null) {
                    this.showToast('Please select an option to "Save & Mark for Review"', 'warning');
                    return false;
                }
                answer.selectedOptionIndex = selectedIndex;
                answer.status = 'answered-review';
                break;

            case 'clear': // "Clear Response"
                answer.selectedOptionIndex = null;
                answer.status = 'not-answered';
                if (selected) selected.checked = false;
                break;

            case 'preserve': // Palette clicks, tab clicks, auto-save
            default:
                answer.selectedOptionIndex = selectedIndex;
                if (answer.status === 'marked-for-review' || answer.status === 'answered-review') {
                    answer.status = selectedIndex !== null ? 'answered-review' : 'marked-for-review';
                } else {
                    answer.status = selectedIndex !== null ? 'answered' : 'not-answered';
                }
                break;
        }
        
        answer.lastUpdated = new Date().toISOString();
        return true;
    }

    // --- BUTTON HANDLERS ---

    async handleSaveAndNext() { 
        if (!this.updateCurrentAnswerState('finalize')) return;

        this.toggleButtonState(this.elements.saveNextBtn, true, 'Saving...');
        
        try {
            await this.saveProgress();
            
            if (this.currentQuestionIndex < this.testData.questions.length - 1) {
                this.renderQuestion(this.currentQuestionIndex + 1);
            } else {
                this.updatePalette();
                this.showToast('You are at the last question.', 'info');
            }
        } catch (error) {
            console.error('Save failed:', error);
            this.showToast('Failed to save progress', 'error');
        } finally {
            this.toggleButtonState(this.elements.saveNextBtn, false, 'Save & Next');
        }
    }

    async handleSaveAndMarkForReview() {
        if (!this.updateCurrentAnswerState('save_review')) return;

        try {
            await this.saveProgress();
            
            if (this.currentQuestionIndex < this.testData.questions.length - 1) {
                this.renderQuestion(this.currentQuestionIndex + 1);
            } else {
                this.updatePalette();
                this.showToast('You are at the last question.', 'info');
            }
        } catch (error) {
            console.error('Save failed:', error);
            this.showToast('Failed to save progress', 'error');
        }
    }

    async handleMarkForReview() {
        this.updateCurrentAnswerState('review');

        try {
            await this.saveProgress();
            
            if (this.currentQuestionIndex < this.testData.questions.length - 1) {
                this.renderQuestion(this.currentQuestionIndex + 1);
            } else {
                this.updatePalette();
                this.showToast('You are at the last question.', 'info');
            }
        } catch (error) {
            console.error('Save failed:', error);
            this.showToast('Failed to save progress', 'error');
        }
    }

    handleClearResponse() {
        this.updateCurrentAnswerState('clear');
        this.updatePalette();
        this.saveProgress(); // Don't await, let it happen in background
    }

    // --- MODAL AND SUBMIT ---

    async openSubmitModal() {
        this.updateCurrentAnswerState('preserve');
        await this.saveProgress();
        
        const stats = this.calculateStats();
        
        const _set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        _set('final-answered',        stats.answered);
        _set('final-marked',          stats.marked);
        _set('final-answered-marked', stats.answeredMarked);
        _set('final-not-answered',    stats.notAnswered);
        _set('final-not-visited',     stats.notVisited);
        
        this.elements.submitModal.classList.add('active');
    }

    calculateStats() {
        const total = this.userAnswers.length;
        const answered = this.userAnswers.filter(a => a.status === 'answered').length;
        const marked = this.userAnswers.filter(a => a.status === 'marked-for-review').length;
        const answeredMarked = this.userAnswers.filter(a => a.status === 'answered-review').length;
        const notVisited = this.userAnswers.filter(a => a.status === 'not-visited').length;
        const notAnswered = total - answered - marked - answeredMarked - notVisited;

        return { answered, marked, answeredMarked, notAnswered, notVisited };
    }
    
    closeSubmitModal() {
        this.elements.submitModal.classList.remove('active');
    }

    // REPLACE your handleSubmit function (around line 520) with this:

    // REPLACE your handleSubmit function (around line 520) with this:

    // REPLACE your handleSubmit function (around line 520) with this:

    async handleSubmit() {
        // 1. AGGRESSIVE CHECK: Stop if already submitting
        if (this.isSubmitting) return;
        
        // 2. LOCK DOWN: Set flag and disable UI immediately
        this.isSubmitting = true;
        const confirmBtn = this.elements.confirmSubmitBtn;
        
        // Disable button visually and functionally
        if (confirmBtn) {
            confirmBtn.style.pointerEvents = 'none'; // Prevent clicks even if JS lags
            confirmBtn.style.opacity = '0.7';
            this.toggleButtonState(confirmBtn, true, 'Submitting...');
        }
        
        clearInterval(this.timerInterval); 
        clearInterval(this.saveInterval); 

        try {
            const totalDuration = (this.testData.duration || 0) * 60;
            const timeTaken = totalDuration - this.timerDuration;

            // 3. Add a Timeout to the fetch (Mobile networks can hang)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

            const response = await fetch(`/api/tests/attempt/${this.currentAttemptId}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    answers: this.userAnswers, 
                    timeTaken: Math.max(0, timeTaken) 
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Submission failed');
            }
            
            const result = await response.json();
            
            // Clean up localStorage
            localStorage.removeItem(`test_${this.currentAttemptId}`);

            this.showToast('Test submitted! Redirecting...', 'success');

            setTimeout(() => {
                window.location.href = result.resultId ? `/my-results?view=${result.resultId}` : '/my-results';
            }, 1000);

        } catch (error) {
            console.error('Submission error:', error);
            
            // 4. NETWORK ERROR HANDLING
            if (error.name === 'AbortError') {
                 this.showToast('Network timeout. Please check internet and try again.', 'error');
            } else {
                 this.showToast(error.message || 'Submission failed.', 'error');
            }
            
            // 5. UNLOCK ONLY ON FAILURE
            this.isSubmitting = false;
            if (confirmBtn) {
                confirmBtn.style.pointerEvents = 'auto';
                confirmBtn.style.opacity = '1';
                this.toggleButtonState(confirmBtn, false, 'Yes, Submit Test');
            }
            
            // Resume timers so they don't lose time during the error
            this.startTimer(this.timerDuration);
        }
    }

    // --- LANGUAGE AND FULLSCREEN ---

    toggleLanguage() {
        this.lang = this.lang === 'english' ? 'hindi' : 'english';
        this.elements.toggleLangBtn.innerHTML = this.lang === 'english' 
            ? '<i class="fas fa-language"></i> View in Hindi'
            : '<i class="fas fa-language"></i> View in English';
        this.renderQuestion(this.currentQuestionIndex);
    }

    toggleFullScreen() {
        const mainEl = this.elements.mainContainer;
        const icon = this.elements.fullscreenBtn.querySelector('i');
        
        if (!document.fullscreenElement) {
            if (mainEl.requestFullscreen) mainEl.requestFullscreen();
            else if (mainEl.mozRequestFullScreen) mainEl.mozRequestFullScreen();
            else if (mainEl.webkitRequestFullscreen) mainEl.webkitRequestFullscreen();
            else if (mainEl.msRequestFullscreen) mainEl.msRequestFullscreen();
            
            if (icon) {
                icon.classList.remove('fa-expand');
                icon.classList.add('fa-compress');
            }
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            else if (document.msExitFullscreen) document.msExitFullscreen();

            if (icon) {
                icon.classList.remove('fa-compress');
                icon.classList.add('fa-expand');
            }
        }
    }

    // --- TIMER ---

    startTimer(durationInSeconds) {
        if (this.timerInterval) clearInterval(this.timerInterval);

        this.timerDuration = Math.max(0, Number(durationInSeconds) || 0);

        const updateDisplay = () => {
            this.updateTimerDisplay();
        };

        updateDisplay();

        if (this.timerDuration > 0) {
            this.timerInterval = setInterval(() => {
                if (this.timerDuration <= 1) {
                    clearInterval(this.timerInterval);
                    this.timerDuration = 0;
                    updateDisplay();
                    this.showToast("Time's up! Submitting your test automatically.", 'warning');
                    this.handleSubmit();
                } else {
                    this.timerDuration--;
                    updateDisplay();
                }
            }, 1000);
        }
    }

    updateTimerDisplay() {
        const h = String(Math.floor(this.timerDuration / 3600)).padStart(2, '0');
        const m = String(Math.floor((this.timerDuration % 3600) / 60)).padStart(2, '0');
        const s = String(this.timerDuration % 60).padStart(2, '0');
        this.elements.timer.textContent = `${h}:${m}:${s}`;
    }
    
    // --- CORE SAVE FUNCTION (Network) ---
    async saveProgress(forceSync = false) {
        if (!this.currentAttemptId || this.isSaving) {
            if (forceSync) {
                // For beforeunload, save to localStorage only
                this.saveToLocalStorage();
            }
            return;
        }

        this.isSaving = true;

        try {
            // Always update localStorage first for immediate resilience
            this.saveToLocalStorage();

            // Then try to sync with server if online
            if (navigator.onLine) {
                const response = await fetch(`/api/tests/attempt/${this.currentAttemptId}/save`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        answers: this.userAnswers, 
                        remainingTime: this.timerDuration 
                    })
                });

                if (!response.ok) throw new Error('Server save failed');
                
                const data = await response.json();
                if (!data.success) throw new Error(data.message);
                
                console.log('Progress saved at', data.lastSaved);
            } else {
                console.log('Offline - progress saved locally only');
            }
        } catch (error) {
            console.warn('Save failed:', error);
            // Don't show toast for auto-save failures to avoid annoying user
            if (forceSync) {
                this.showToast('Progress saved locally (offline)', 'warning');
            }
        } finally {
            this.isSaving = false;
        }
    }
    
    // --- UTILITIES ---

    toggleButtonState(button, isLoading, loadingText = 'Loading...') {
        if (!button) return;
        if (isLoading) {
            button.disabled = true;
            if(!button.dataset.originalText) {
                 button.dataset.originalText = button.innerHTML;
            }
            button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
        } else {
            button.disabled = false;
            if (button.dataset.originalText) {
                button.innerHTML = button.dataset.originalText;
            }
        }
    }

    showToast(message, type = 'info') {
        if (!this.elements.toastContainer) return;

        // Clear existing timeout and toasts
        if (this.toastTimeout) {
            clearTimeout(this.toastTimeout);
        }
        this.elements.toastContainer.innerHTML = '';

        const toast = document.createElement('div');
        toast.className = `toast-notification ${type}`;
        toast.textContent = message;

        this.elements.toastContainer.appendChild(toast);

        // Trigger animation
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        // Auto remove
        this.toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.parentElement.removeChild(toast);
                }
            }, 500);
        }, 4000);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // FIX: Assign to window so the button can access it
        window.__testManager = new TestInterfaceManager();
    });
} else {
    // FIX: Assign to window so the button can access it
    window.__testManager = new TestInterfaceManager();
}