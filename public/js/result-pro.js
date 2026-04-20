// result-pro.js — COMPLETE REWRITE v3
// Saraswati UGC NET — Results Manager with Chart.js integration

class ResultsManager {
    constructor() {
        this.allResults = []; // holds all result card data for charts
        this.filters = { sort: 'newest', period: 'all' };
        this.init();
    }

    init() {
        this.collectResultDataForCharts();
        this.calculateAndRenderStats();
        this.setupEventListeners();
        this.checkAutoOpenUrl();
    }

    // ── Collect card data from server-rendered HTML for Chart.js ──
    collectResultDataForCharts() {
        const items = document.querySelectorAll('.result-card-item');
        this.allResults = Array.from(items).map(item => ({
            pct: parseFloat(item.dataset.pct) || 0,
            date: parseInt(item.dataset.date) || 0,
            title: item.dataset.title || '',
        }));

        // Init charts once data is collected
        if (window.initResultCharts) {
            window.initResultCharts(this.allResults);
        }
    }

    calculateAndRenderStats() {
        const items = document.querySelectorAll('.result-card-item');

        if (items.length === 0) {
            ['total-tests', 'average-score', 'best-score', 'total-time'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = id === 'total-tests' ? '0' : '—';
            });
            return;
        }

        let totalPct = 0, bestPct = 0, totalTimeSec = 0;

        items.forEach(item => {
            const pct = parseFloat(item.dataset.pct) || 0;
            totalPct += pct;
            if (pct > bestPct) bestPct = pct;

            // Get time from meta chip
            const chips = item.querySelectorAll('.rci-meta-chip');
            chips.forEach(chip => {
                if (chip.querySelector('.fa-clock')) {
                    const txt = chip.textContent.trim();
                    const mMatch = txt.match(/(\d+)m/);
                    const sMatch = txt.match(/(\d+)s/);
                    if (mMatch) totalTimeSec += parseInt(mMatch[1]) * 60;
                    if (sMatch) totalTimeSec += parseInt(sMatch[1]);
                }
            });
        });

        const count = items.length;
        const avg = totalPct / count;

        this._setText('total-tests', count);
        this._setText('average-score', avg.toFixed(1) + '%');
        this._setText('best-score', bestPct.toFixed(1) + '%');
        this._setText('total-time',
            `${Math.floor(totalTimeSec / 3600)}h ${Math.floor((totalTimeSec % 3600) / 60)}m`);
    }

    _setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    checkAutoOpenUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const viewId = urlParams.get('view');
        if (viewId) {
            window.history.replaceState({}, document.title, window.location.pathname);
            this.handleViewResult(viewId);
        }
    }

    setupEventListeners() {
        // Sort / Filter selects
        document.getElementById('sort-results')?.addEventListener('change', () => this.applyFiltersAndFetch());
        document.getElementById('time-filter')?.addEventListener('change', () => this.applyFiltersAndFetch());

        // Delegated click: view result + modal close
        document.body.addEventListener('click', (e) => {
            const viewBtn = e.target.closest('.view-result-btn');
            if (viewBtn) {
                this.handleViewResult(viewBtn.dataset.resultId);
                return;
            }
            if (e.target.closest('#modal-close-btn')) {
                this.closeModal();
                return;
            }
            if (e.target.id === 'result-modal') {
                this.closeModal();
                return;
            }
        });

        // ESC key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });
    }

    // ── OPEN ANALYSIS MODAL ──
    async handleViewResult(resultId) {
        if (!resultId) return;
        const modal = document.getElementById('result-modal');
        const loading = document.getElementById('modal-loading-state');
        const content = document.getElementById('modal-results-content');

        if (!modal) return;
        modal.classList.add('active');
        if (loading) loading.style.display = 'flex';
        if (content) content.classList.add('hidden');

        try {
            const data = await this.apiCall(`/api/results/${resultId}`);
            if (!data.success) throw new Error(data.message || 'Failed to load result');
            this.populateModal(data.result);
            if (loading) loading.style.display = 'none';
            if (content) content.classList.remove('hidden');
        } catch (err) {
            console.error('Result fetch error:', err);
            if (loading) loading.style.display = 'none';
            this.showToast(err.message || 'Could not load result', 'error');
            this.closeModal();
        }
    }

    closeModal() {
        document.getElementById('result-modal')?.classList.remove('active');
    }

    // ── POPULATE MODAL ──
    populateModal(result) {
        // Title & date
        this._setText('modal-test-title', result.test?.title || 'Test Analysis');
        const dateStr = new Date(result.submittedAt || Date.now()).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        this._setText('modal-test-date', dateStr);

        // Score
        const maxMarks = (result.totalQuestions || 0) * 2;
        this._setText('modal-score', `${result.score * 2 || result.score} / ${maxMarks}`);

        // Percentage
        const pct = result.percentage || 0;
        const pctEl = document.getElementById('modal-percentage');
        if (pctEl) {
            pctEl.textContent = pct.toFixed(1) + '%';
            pctEl.style.color = pct >= 70 ? '#16a34a' : pct >= 40 ? '#d97706' : '#dc2626';
        }

        // Grade badge
        const grade = pct >= 70 ? 'A' : pct >= 55 ? 'B' : pct >= 40 ? 'C' : 'F';
        const gradeBadge = document.getElementById('modal-status-badge');
        if (gradeBadge) {
            gradeBadge.textContent = `Grade ${grade}`;
            gradeBadge.className = `badge-pro grade-badge grade-${grade}`;
        }

        // Accuracy
        let correct = 0, attempted = 0;
        result.answers.forEach(ans => {
            if (ans.selectedOptionIndex !== null && ans.selectedOptionIndex !== undefined) {
                attempted++;
                if (ans.questionId && ans.selectedOptionIndex === ans.questionId.correctAnswerIndex) {
                    correct++;
                }
            }
        });
        const accuracy = attempted > 0 ? ((correct / attempted) * 100).toFixed(1) : '0.0';
        this._setText('modal-accuracy', accuracy + '%');

        // Time
        const timeSec = result.timeTaken || 0;
        this._setText('modal-time', `${Math.floor(timeSec / 60)}m ${timeSec % 60}s`);

        // Unit-wise analysis
        this.renderUnitAnalysis(result);

        // Question review list
        this.renderQuestionList(result);

        // Reset filter tabs to 'all'
        document.querySelectorAll('.review-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.filter === 'all');
        });
        document.querySelectorAll('.review-card').forEach(c => c.style.display = '');
    }

    // ── UNIT-WISE ANALYSIS (bar chart style) ──
    renderUnitAnalysis(result) {
        const container = document.getElementById('modal-analysis-container');
        if (!container) return;

        const unitStats = {};
        result.answers.forEach(ans => {
            if (!ans.questionId) return;
            const unit = ans.questionId.unit || 'General';
            if (!unitStats[unit]) unitStats[unit] = { total: 0, correct: 0 };
            unitStats[unit].total++;
            const u = ans.selectedOptionIndex;
            const c = ans.questionId.correctAnswerIndex;
            if (u !== null && u !== undefined && u === c) unitStats[unit].correct++;
        });

        const sorted = Object.entries(unitStats).sort((a, b) => b[1].total - a[1].total);

        if (sorted.length === 0) {
            container.innerHTML = '<p style="font-size:.82rem;color:var(--gray-400);">No unit data available.</p>';
            return;
        }

        container.innerHTML = sorted.map(([unit, stats]) => {
            const pct = Math.round((stats.correct / stats.total) * 100);
            const barColor = pct >= 70 ? '#16a34a' : pct >= 40 ? '#f59e0b' : '#dc2626';
            return `
            <div class="unit-bar-row">
              <div class="unit-bar-label">
                <span>${unit}</span>
                <strong style="color:${barColor};">${pct}% &nbsp;<span style="font-weight:400;color:var(--gray-400);font-size:.72rem;">(${stats.correct}/${stats.total})</span></strong>
              </div>
              <div class="unit-bar-track">
                <div class="unit-bar-fill" style="width:${pct}%;background:${barColor};"></div>
              </div>
            </div>`;
        }).join('');
    }

    // ── QUESTION REVIEW LIST ──
    renderQuestionList(result) {
        const container = document.getElementById('modal-questions-list');
        if (!container) return;

        container.innerHTML = result.answers.map((ans, idx) => {
            const q = ans.questionId;
            if (!q) return '';

            const userOpt = ans.selectedOptionIndex;
            const correctOpt = q.correctAnswerIndex;

            let status = 'skipped', statusLabel = 'Skipped', statusIcon = 'fa-minus-circle';
            let marks = '0';

            if (userOpt !== null && userOpt !== undefined) {
                if (userOpt === correctOpt) {
                    status = 'correct'; statusLabel = 'Correct'; statusIcon = 'fa-check-circle'; marks = '+2';
                } else {
                    status = 'wrong'; statusLabel = 'Wrong'; statusIcon = 'fa-times-circle'; marks = '0';
                }
            }

            const optLetters = ['A', 'B', 'C', 'D'];
            const optionsHtml = (q.options || []).map((opt, i) => {
                let cls = 'review-option';
                let icon = `<i class="far fa-circle" style="color:var(--gray-300);"></i>`;
                if (i === correctOpt) {
                    cls += ' opt-is-correct';
                    icon = `<i class="fas fa-check-circle"></i>`;
                } else if (i === userOpt && i !== correctOpt) {
                    cls += ' opt-is-wrong';
                    icon = `<i class="fas fa-times-circle"></i>`;
                }
                const text = opt?.english || opt?.text || opt || `Option ${i + 1}`;
                return `<div class="${cls}">
                    <span class="opt-icon">${icon}</span>
                    <span style="font-weight:700;margin-right:.35rem;opacity:.6;">${optLetters[i]}.</span>
                    <span class="opt-text">${text}</span>
                </div>`;
            }).join('');

            const questionText = q.questionText?.english || q.questionText || 'Question text unavailable';
            const explanation = q.explanation?.english || q.explanation || 'No explanation available for this question.';

            return `
            <div class="review-card ${status}">
              <div class="review-header">
                <div class="review-q-meta">
                  <span class="review-q-num">Q${idx + 1}</span>
                  <span class="review-status-badge ${status}">
                    <i class="fas ${statusIcon}"></i> ${statusLabel}
                  </span>
                </div>
                <span class="review-marks ${status === 'correct' ? 'got' : 'lost'}">${marks} Marks</span>
              </div>
              <div class="review-question-text">${questionText}</div>
              <div class="review-options-grid">${optionsHtml}</div>
              <div class="review-explanation">
                <div class="exp-label"><i class="fas fa-lightbulb"></i> Explanation</div>
                ${explanation}
              </div>
            </div>`;
        }).filter(Boolean).join('');
    }

    // ── FILTERS + FETCH ──
    async applyFiltersAndFetch() {
        this.filters.sort = document.getElementById('sort-results')?.value || 'newest';
        this.filters.period = document.getElementById('time-filter')?.value || 'all';

        const loadEl = document.getElementById('results-loading');
        if (loadEl) loadEl.style.display = 'flex';

        try {
            const query = new URLSearchParams(this.filters).toString();
            const data = await this.apiCall(`/api/results/my-results?${query}`);
            if (data.success) {
                this.renderResultCards(data.results);
                setTimeout(() => {
                    this.collectResultDataForCharts();
                    this.calculateAndRenderStats();
                }, 100);
            }
        } catch (err) {
            this.showToast('Could not update results.', 'error');
        } finally {
            if (loadEl) loadEl.style.display = 'none';
        }
    }

    renderResultCards(results) {
        const container = document.getElementById('results-table-body');
        if (!container) return;

        if (!results.length) {
            container.innerHTML = `
            <div class="results-empty">
              <i class="fas fa-search"></i>
              <h3>No results found</h3>
              <p>Try changing the filter settings.</p>
            </div>`;
            return;
        }

        container.innerHTML = results.map(r => {
            const pct = r.percentage || Math.round((r.score / (r.totalQuestions || 1)) * 100);
            const grade = pct >= 70 ? 'A' : pct >= 55 ? 'B' : pct >= 40 ? 'C' : 'F';
            const ringColor = pct >= 70 ? '#16a34a' : pct >= 40 ? '#f59e0b' : '#dc2626';
            const circ = (2 * Math.PI * 20).toFixed(1);
            const offset = (circ - (pct / 100) * circ).toFixed(1);
            const dur = r.timeTaken ? `${Math.floor(r.timeTaken/60)}m ${r.timeTaken%60}s` : 'N/A';
            const dateStr = new Date(r.submittedAt).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'});

            return `
            <div class="result-card-item" data-pct="${pct}" data-date="${new Date(r.submittedAt).getTime()}" data-title="${(r.test?.title||'').toLowerCase()}">
              <div class="rci-score-ring">
                <svg class="rci-ring-svg" width="52" height="52" viewBox="0 0 52 52">
                  <circle class="rci-ring-bg" cx="26" cy="26" r="20"/>
                  <circle class="rci-ring-fill" cx="26" cy="26" r="20" stroke="${ringColor}" stroke-dasharray="${circ}" stroke-dashoffset="${offset}"/>
                </svg>
                <div class="rci-ring-pct">${pct}%</div>
              </div>
              <div class="rci-info">
                <div class="rci-title">${r.test?.title || 'Deleted Test'}</div>
                <div class="rci-meta">
                  <span class="rci-meta-chip"><i class="far fa-calendar-alt"></i> ${dateStr}</span>
                  <span class="rci-meta-chip"><i class="far fa-clock"></i> ${dur}</span>
                  <span class="rci-meta-chip"><i class="fas fa-check-square"></i> ${r.score}/${r.totalQuestions}</span>
                </div>
              </div>
              <div class="rci-grade">
                <span class="grade-badge grade-${grade}">Grade ${grade}</span>
                <span class="grade-score">${pct}%</span>
              </div>
              <button class="btn-view-result view-result-btn" data-result-id="${r._id}">
                <i class="fas fa-chart-bar"></i> Analysis
              </button>
            </div>`;
        }).join('');
    }

    // ── UTILS ──
    async apiCall(endpoint) {
        const res = await fetch(endpoint);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `HTTP ${res.status}`);
        }
        return res.json();
    }

    showToast(message, type = 'info') {
        if (window.showToast) { window.showToast(message, type); return; }
        console.warn(`[${type}] ${message}`);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.results-page') || document.getElementById('results-table-body')) {
        new ResultsManager();
    }
});
