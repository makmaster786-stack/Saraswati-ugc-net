/**
 * TEST INTERFACE UPGRADE PATCH — v3
 * Saraswati UGC NET
 * 
 * HOW TO APPLY:
 * This file PATCHES your existing test-interface.js by overriding specific methods.
 * 
 * Step 1: Keep your existing test-interface.js UNCHANGED.
 * Step 2: Add this script AFTER test-interface.js loads in footer-professional.ejs:
 *         <script src="/js/test-interface-upgrade.js"></script>
 * Step 3: Done — no other changes needed.
 * 
 * What this patch adds:
 * - Live sidebar stats (Answered / Skipped / Marked / Unseen counts)
 * - Auto-save visual indicator (saving... / saved ✓)
 * - Timer colour states (warning at 10min, danger at 5min)
 * - Current question status badge update
 * - Subject + difficulty badge in header
 * - Instruction modal data injection
 * - Option div click → radio checked + .selected class
 */

(function patchTestInterface() {
    // Wait for TestInterfaceManager to be initialized
    let patchRetries = 0;
    const patchInterval = setInterval(() => {
        patchRetries++;
        if (patchRetries > 40) { clearInterval(patchInterval); return; }

        // Find the live instance
        const manager = window.__testManager;
        if (!manager) return;
        clearInterval(patchInterval);

        console.log('[PATCH] TestInterface upgrade patch applied');
        applyPatch(manager);
    }, 250);

    function applyPatch(mgr) {

        // ── 1. OVERRIDE updatePalette to also update sidebar stats + q status badge ──
        const origUpdatePalette = mgr.updatePalette.bind(mgr);
        mgr.updatePalette = function() {
            origUpdatePalette();
            updateSidebarStats();
            updateCurrentQBadge();
            updateNavArrows();
        };

        // ── 2. OVERRIDE saveProgress to show autosave indicator ──
        const origSaveProgress = mgr.saveProgress.bind(mgr);
        mgr.saveProgress = async function(forceSync = false) {
            showAutosaveState('saving');
            try {
                await origSaveProgress(forceSync);
                showAutosaveState('saved');
            } catch(e) {
                showAutosaveState('offline');
            }
        };

        // ── 3. OVERRIDE startTimer to add colour warning ──
        const origStartTimer = mgr.startTimer.bind(mgr);
        mgr.startTimer = function(durationInSeconds) {
            origStartTimer(durationInSeconds);
            // Patch the interval to also update colour
            const origInterval = mgr.timerInterval;
            if (mgr.timerInterval) {
                clearInterval(mgr.timerInterval);
            }
            mgr.timerInterval = setInterval(() => {
                if (mgr.timerDuration <= 1) {
                    clearInterval(mgr.timerInterval);
                    mgr.timerDuration = 0;
                    mgr.updateTimerDisplay();
                    setTimerColor(0);
                    mgr.showToast("Time's up! Submitting automatically.", 'warning');
                    mgr.handleSubmit();
                } else {
                    mgr.timerDuration--;
                    mgr.updateTimerDisplay();
                    setTimerColor(mgr.timerDuration);
                }
            }, 1000);
        };

        // ── 4. After test data loads, inject meta into header ──
        const origRenderQuestion = mgr.renderQuestion.bind(mgr);
        mgr.renderQuestion = function(index) {
            origRenderQuestion(index);
            updateCurrentQBadge();
            updateNavArrows();
            // Inject subject/difficulty on first question
            if (mgr.testData) {
                const subjectBadge = document.getElementById('test-subject-badge');
                const diffBadge = document.getElementById('test-diff-badge');
                if (subjectBadge && mgr.testData.course) subjectBadge.textContent = mgr.testData.course.title || '—';
                if (diffBadge && mgr.testData.difficulty) {
                    const diff = (mgr.testData.difficulty || 'medium').toLowerCase();
                    diffBadge.textContent = diff.charAt(0).toUpperCase() + diff.slice(1);
                    diffBadge.className = `test-meta-badge diff-${diff}`;
                }
                // Instructions modal
                const instTotal = document.getElementById('inst-total-q');
                const instDur = document.getElementById('inst-duration');
                if (instTotal) instTotal.textContent = mgr.testData.questions?.length || 100;
                if (instDur) instDur.textContent = (mgr.testData.duration || 180) + ' minutes';
            }
        };

        // ── HELPER FUNCTIONS ──

        function updateSidebarStats() {
            if (!mgr.userAnswers) return;
            let answered = 0, notAnswered = 0, marked = 0, notVisited = 0;
            mgr.userAnswers.forEach(a => {
                if (!a) return;
                const s = a.status || 'not-visited';
                if (s === 'answered') answered++;
                else if (s === 'not-answered') notAnswered++;
                else if (s === 'marked-for-review' || s === 'answered-review') marked++;
                else notVisited++;
            });
            setText('stat-answered', answered);
            setText('stat-not-answered', notAnswered);
            setText('stat-marked', marked);
            setText('stat-not-visited', notVisited);
        }

        function updateCurrentQBadge() {
            if (!mgr.userAnswers || mgr.currentQuestionIndex === undefined) return;
            const answer = mgr.userAnswers[mgr.currentQuestionIndex];
            const status = answer?.status || 'not-visited';
            if (window.updateQStatusBadge) window.updateQStatusBadge(status);
        }

        function updateNavArrows() {
            const current = mgr.currentQuestionIndex || 0;
            const total = mgr.testData?.questions?.length || 0;
            const prevBtn = document.getElementById('prev-q-btn');
            const nextBtn = document.getElementById('next-q-btn');
            if (prevBtn) prevBtn.disabled = current <= 0;
            if (nextBtn) nextBtn.disabled = current >= total - 1;
        }

        function showAutosaveState(state) {
            if (window.showAutosaveState) window.showAutosaveState(state);
        }

        function setTimerColor(seconds) {
            if (window.setTimerWarning) {
                if (seconds <= 300) window.setTimerWarning('danger');       // 5 min
                else if (seconds <= 600) window.setTimerWarning('warning'); // 10 min
                else window.setTimerWarning('normal');
            }
        }

        function setText(id, val) {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        }

        // ── 5. Option items — make full div clickable with .selected class ──
        document.getElementById('options-container')?.addEventListener('click', (e) => {
            const item = e.target.closest('.option-item');
            if (!item) return;
            const radio = item.querySelector('input[type="radio"]');
            if (radio) {
                radio.checked = true;
                document.querySelectorAll('.option-item').forEach(o => o.classList.remove('selected'));
                item.classList.add('selected');
            }
        });

        // ── 6. Expose manager globally for direct access ──
        window.__testManagerInstance = mgr;
    }

})();
