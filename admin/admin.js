/* --- FILE: public/admin/admin.js (SIMPLIFIED WORKING VERSION) --- */
// PROFESSIONAL ADMIN MANAGEMENT SYSTEM

class AdminManager {
    constructor() {
        this.baseURL = '/api/admin'; 
        this.currentPage = this.getCurrentPage();
        this.init();
    }

    init() {
        this.setupAuthHeaders();
        if (!this.checkAuth()) return;
        
        this.setupGlobalHandlers();
        this.loadPageSpecificFunctionality();
    }

    // =================================================
    // 1. AUTHENTICATION & SECURITY
    // =================================================
    checkAuth() {
        const token = this.getToken();
        const isLoginPage = (this.currentPage === 'login');
        
        if (!token && !isLoginPage) {
            this.redirectToLogin();
            return false;
        }
        
        if (token && isLoginPage) {
            // 🛑 INFINITE LOOP FIX 🛑
            // If the user lands on the login page but still has a local token, 
            // it means the server's cookie expired and kicked them out. 
            // We MUST clear the old local token so they can type in their password again.
            this.clearAuth();
            return true; 
        }
        
        return true;
    }
    getToken() { return localStorage.getItem('adminAuthToken'); }
    setToken(token) { localStorage.setItem('adminAuthToken', token); }
    clearAuth() { localStorage.removeItem('adminAuthToken'); }
    
    setupAuthHeaders() {
        this.authHeaders = {
            'Authorization': `Bearer ${this.getToken()}`,
            'Content-Type': 'application/json'
        };
    }

    redirectToLogin() { window.location.href = '/admin/login'; }

    logout() {
        if (confirm('Are you sure you want to logout?')) {
            this.clearAuth();
            this.showToast('Logged out successfully', 'success');
            setTimeout(() => this.redirectToLogin(), 1000);
        }
    }

    // =================================================
    // 2. API CLIENT
    // =================================================
    async apiCall(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const config = {
            headers: { ...this.authHeaders, ...options.headers },
            ...options
        };

        if (options.body instanceof FormData) {
            delete config.headers['Content-Type'];
        }

        try {
            this.showLoading();
            const response = await fetch(url, config);
            
            if (response.status === 401) {
                this.clearAuth();
                this.redirectToLogin();
                throw new Error('Session expired. Please login again.');
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('API Call failed:', error);
            this.showToast(error.message, 'error');
            throw error;
        } finally {
            this.hideLoading();
        }
    }

    // =================================================
    // 3. UI COMPONENTS
    // =================================================
    showToast(message, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
        toast.innerHTML = `<i class="fas ${icons[type] || 'fa-info-circle'}"></i> <span>${message}</span>`;
        
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    showLoading(selector = 'body') {
        const element = document.querySelector(selector);
        if (element) element.classList.add('loading');
    }

    hideLoading(selector = 'body') {
        const element = document.querySelector(selector);
        if (element) element.classList.remove('loading');
    }

    escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    stripHTML(html) {
        if (!html) return '';
        const tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    }

    // =================================================
    // 4. GLOBAL EVENT HANDLERS
    // =================================================
    setupGlobalHandlers() {
        // Handle form submissions
        document.addEventListener('submit', async (e) => {
            const form = e.target;
            
            // Handle full edit form submission
            if (form.id === 'fullEditForm') {
                e.preventDefault();
                await this.handleFullEditSubmit(form);
                return;
            }
            
            // Handle other forms
            if (form.id && (form.id.includes('Form') || form.id === 'pyqForm')) {
                e.preventDefault();
                if(form.id === 'pyqForm') {
                    await this.handlePyqUpload(form);
                } else {
                    await this.handleFormSubmit(form);
                }
            }
        });

        // Handle click events
        document.addEventListener('click', async (e) => {
            // AI Generation buttons
            if (e.target.closest('#generateAiBtn')) { 
                e.preventDefault(); 
                await this.handleAiGeneration(); 
            }
            if (e.target.closest('#generateArticleBtn')) { 
                e.preventDefault(); 
                await this.handleAiArticleGeneration(); 
            }
            if (e.target.closest('#autoTranslateBtn')) { 
                e.preventDefault(); 
                await this.handleAutoTranslateUI(e.target.closest('#autoTranslateBtn')); 
            }
            
            // Auto Classify button
            if (e.target.closest('#autoClassifyBtn')) {
                e.preventDefault();
                await this.handleAutoClassify(e.target.closest('#autoClassifyBtn'));
            }
            
            // Logout button
            if (e.target.closest('#admin-logout')) { 
                e.preventDefault(); 
                this.logout(); 
            }
            
            // Close modal buttons
            if (e.target.closest('[data-close-modal]')) {
                e.preventDefault();
                const modal = document.getElementById('fullEditModal');
                if (modal) {
                    modal.style.display = 'none';
                    // Destroy TinyMCE editors
                    ['edit-q-en', 'edit-q-hi', 'edit-expl'].forEach(id => {
                        const editor = tinymce.get(id);
                        if (editor) editor.remove();
                    });
                }
            }
            
            // Close modal by clicking outside
            if (e.target.id === 'fullEditModal') {
                const modal = document.getElementById('fullEditModal');
                modal.style.display = 'none';
                // Destroy TinyMCE editors
                ['edit-q-en', 'edit-q-hi', 'edit-expl'].forEach(id => {
                    const editor = tinymce.get(id);
                    if (editor) editor.remove();
                });
            }
            
            // Delete Buttons (for questions page)
            const deleteBtn = e.target.closest('.action-btn.delete');
            if (deleteBtn && deleteBtn.dataset.id) {
                e.preventDefault();
                const id = deleteBtn.dataset.id;
                const type = deleteBtn.dataset.type || 'question';
                await this.handleDelete(id, type);
            }

            // Edit Buttons (for courses/tests)
            const editBtn = e.target.closest('.action-btn.edit');
            if (editBtn && editBtn.dataset.id) {
                e.preventDefault();
                this.handleEdit(editBtn.dataset.id, editBtn.dataset.type || 'course');
            }
            
            // View/Edit buttons in question bank
            const viewEditBtn = e.target.closest('.view-edit');
            if (viewEditBtn && viewEditBtn.dataset.id) {
                e.preventDefault();
                const questionId = viewEditBtn.dataset.id;
                await this.openFullEditModal(questionId);
            }
            
            // Apply filters button (questions page)
            if (e.target.closest('#applyFiltersBtn')) {
                e.preventDefault();
                await this.fetchQuestions(1);
            }
            
            // Bulk delete button (questions page)
            if (e.target.closest('#bulkDeleteBtn')) {
                e.preventDefault();
                await this.handleBulkDelete();
            }
            
            // Question pagination
            if (e.target.closest('#qPagination button')) {
                e.preventDefault();
                const button = e.target.closest('button');
                const page = button.getAttribute('data-page');
                if (page) {
                    await this.fetchQuestions(parseInt(page));
                }
            }
            
            // Student pagination (for students page)
            if (e.target.closest('#studentPagination button')) {
                e.preventDefault();
                const button = e.target.closest('button');
                const page = button.getAttribute('data-page');
                if (page) {
                    await this.loadStudentsPage(parseInt(page));
                }
            }
            
            // View student details (for students page)
            if (e.target.closest('.action-btn.view') && e.target.closest('.action-btn.view').dataset.id) {
                e.preventDefault();
                const studentId = e.target.closest('.action-btn.view').dataset.id;
                await this.viewStudentDetails(studentId);
            }
            
            // Close student modal
            if (e.target.closest('#closeStudentModal')) {
                e.preventDefault();
                const modal = document.getElementById('studentModal');
                if (modal) {
                    modal.classList.add('hidden');
                    modal.style.display = 'none';
                }
            }
        });

        // Handle input events for search (questions page)
        document.addEventListener('input', (e) => {
            // Question search with debounce
            if (e.target.id === 'qSearch') {
                this.debounce(async () => {
                    await this.fetchQuestions(1);
                }, 500)();
            }
            
            // Student search with debounce (students page)
            if (e.target.id === 'studentSearch') {
                this.debounce(async () => {
                    await this.loadStudentsPage(1);
                }, 500)();
            }
        });

        // Handle select change events (questions page)
        document.addEventListener('change', (e) => {
            // Auto-fetch when filters change
            if (e.target.id === 'qPaper' || e.target.id === 'qYear' || 
                e.target.id === 'qMonth' || e.target.id === 'qUnit') {
                this.debounce(async () => {
                    await this.fetchQuestions(1);
                }, 300)();
            }
            
            // Paper change updates units dropdown in question bank
            if (e.target.id === 'qPaper') {
                const paperSelect = document.getElementById('qPaper');
                const unitSelect = document.getElementById('qUnit');
                if (paperSelect && unitSelect) {
                    const p1Units = ["Teaching Aptitude", "Research Aptitude", "Comprehension", "Communication", "Mathematical Reasoning", "Logical Reasoning", "Data Interpretation", "ICT", "People & Environment", "Higher Education"];
                    const p2Units = ["Political Theory", "Western Political Thought", "Indian Political Thought", "Comparative Politics", "International Relations", "India's Foreign Policy", "Political Institutions", "Political Processes", "Public Administration", "Governance"];
                    
                    const list = paperSelect.value === 'Paper 1' ? p1Units : 
                                 (paperSelect.value === 'Paper 2' ? p2Units : []);
                    
                    unitSelect.innerHTML = '<option value="">All Units</option>' + 
                        list.map(u => `<option value="${u}">${u}</option>`).join('') +
                        '<option value="General">General</option>';
                }
            }
            
            // Paper change in edit modal
            if (e.target.id === 'edit-paper') {
                this.populateEditUnits(e.target.value);
            }
        });

        // Handle key events
        document.addEventListener('keydown', (e) => {
            // Close modals with Escape key
            if (e.key === 'Escape') {
                const modal = document.getElementById('fullEditModal');
                if (modal && modal.style.display === 'flex') {
                    modal.style.display = 'none';
                    // Destroy TinyMCE editors
                    ['edit-q-en', 'edit-q-hi', 'edit-expl'].forEach(id => {
                        const editor = tinymce.get(id);
                        if (editor) editor.remove();
                    });
                }
                
                const studentModal = document.getElementById('studentModal');
                if (studentModal && studentModal.style.display === 'flex') {
                    studentModal.classList.add('hidden');
                    studentModal.style.display = 'none';
                }
            }
        });
    }

    inferTypeFromContext(button) {
        if (button.closest('.question-item')) return 'question';
        const table = button.closest('table');
        if (!table) return 'item';
        const tableId = table.id;
        if (tableId.includes('students')) return 'user';
        if (tableId.includes('courses')) return 'course';
        if (tableId.includes('tests')) return 'test';
        if (tableId.includes('articles')) return 'article';
        if (tableId.includes('resources')) return 'resource';
        return 'item';
    }

    // =================================================
    // 5. AI & TRANSLATION HANDLERS
    // =================================================
    async handleAiGeneration() {
        const topicInput = document.getElementById('aiTopicInput');
        const paperSelect = document.getElementById('aiPaperType'); 
        const btn = document.getElementById('generateAiBtn');
        
        const topic = topicInput ? topicInput.value.trim() : '';
        const paper = paperSelect ? paperSelect.value : 'Paper 2';

        if (!topic) return this.showToast("Please enter a topic first.", "warning");

        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        btn.disabled = true;

        try {
            const result = await this.apiCall('/generate-question', {
                method: 'POST',
                body: JSON.stringify({ topic, paper })
            });

            if (result.success && result.data) {
                const d = result.data;
                if (tinymce.get('q-text-en')) tinymce.get('q-text-en').setContent(d.q_text_en);
                if (tinymce.get('q-text-hi')) tinymce.get('q-text-hi').setContent(d.q_text_hi);
                
                const combinedExpl = `<p>${d.explanation_en}</p><hr><p><strong>(Hindi):</strong> ${d.explanation_hi}</p>`;
                if (tinymce.get('questionExplanation')) tinymce.get('questionExplanation').setContent(combinedExpl);

                document.getElementById('q-opt1-en').value = d.opt1_en;
                document.getElementById('q-opt1-hi').value = d.opt1_hi;
                document.getElementById('q-opt2-en').value = d.opt2_en;
                document.getElementById('q-opt2-hi').value = d.opt2_hi;
                document.getElementById('q-opt3-en').value = d.opt3_en;
                document.getElementById('q-opt3-hi').value = d.opt3_hi;
                document.getElementById('q-opt4-en').value = d.opt4_en;
                document.getElementById('q-opt4-hi').value = d.opt4_hi;

                const radios = document.getElementsByName('correctAnswer');
                if (radios[d.correct_answer_index]) radios[d.correct_answer_index].checked = true;

                const formPaperSelect = document.getElementById('paperSelector');
                if (formPaperSelect && d.paper) {
                    formPaperSelect.value = d.paper;
                }

                if (document.getElementById('unitSelector') && d.unit) {
                    const select = document.getElementById('unitSelector');
                    const target = d.unit.toLowerCase().trim();
                    let found = false;

                    for(let i=0; i < select.options.length; i++) {
                        const optionVal = select.options[i].value.toLowerCase();
                        if(optionVal === target || optionVal.includes(target) || target.includes(optionVal)) {
                            select.selectedIndex = i;
                            found = true;
                            
                            select.style.backgroundColor = '#dcfce7'; 
                            select.style.borderColor = '#22c55e';
                            setTimeout(() => {
                                select.style.backgroundColor = '';
                                select.style.borderColor = '#cbd5e1';
                            }, 2000);
                            break;
                        }
                    }
                    if(!found) select.value = 'General';
                }

                this.showToast("✨ Question Generated & Sorted!", "success");
            }
        } catch (error) {
            console.error(error);
            this.showToast("AI Generation failed", "error");
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    async handleAutoClassify(btn) {
        let qText = '';
        if (typeof tinymce !== 'undefined' && tinymce.get('q-text-en')) {
            qText = tinymce.get('q-text-en').getContent({ format: 'text' });
        } else {
            qText = document.getElementById('q-text-en')?.value || '';
        }

        if (!qText || qText.trim().length < 5) {
            return this.showToast('Please enter the question text first.', 'warning');
        }

        const paperContext = document.getElementById('paperSelector') ? document.getElementById('paperSelector').value : 'Paper 2';

        const originalContent = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking ' + paperContext + '...';
        btn.disabled = true;

        try {
            const result = await this.apiCall('/classify-question', {
                method: 'POST',
                body: JSON.stringify({ 
                    questionText: qText,
                    paperContext: paperContext
                })
            });

            if (result.success && result.unit) {
                const select = document.getElementById('unitSelector');
                const target = result.unit.toLowerCase().replace(/unit \d+:/, '').trim();
                let found = false;

                for (let i = 0; i < select.options.length; i++) {
                    if (select.options[i].value.toLowerCase().includes(target)) {
                        select.selectedIndex = i;
                        found = true;
                        
                        select.style.border = '2px solid #22c55e';
                        select.style.background = '#f0fdf4';
                        setTimeout(() => {
                            select.style.border = '1px solid #cbd5e1';
                            select.style.background = 'white';
                        }, 1500);
                        break;
                    }
                }
                
                if (found) {
                    this.showToast(`Classified as: ${result.unit}`, 'success');
                } else {
                    this.showToast(`AI suggested "${result.unit}" but matches were unclear.`, 'warning');
                }

            } else {
                throw new Error("No unit returned");
            }
        } catch (error) {
            console.error(error);
            this.showToast('Classification failed.', 'error');
        } finally {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    }

    async handleAiArticleGeneration() {
        const topicInput = document.getElementById('aiArticleTopic');
        const btn = document.getElementById('generateArticleBtn');
        const topic = topicInput ? topicInput.value.trim() : '';

        if (!topic) return this.showToast("Please enter a topic first.", "warning");

        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SEO Writing...';
        btn.disabled = true;

        try {
            const result = await this.apiCall('/generate-article', {
                method: 'POST',
                body: JSON.stringify({ topic })
            });

            if (result.success && result.data) {
                const { title, content, slug, metaDescription, keywords } = result.data;

                if(document.getElementById('articleTitle')) document.getElementById('articleTitle').value = title;
                if(document.getElementById('articleSlug')) document.getElementById('articleSlug').value = slug;
                if(document.getElementById('metaDescription')) document.getElementById('metaDescription').value = metaDescription;
                if(document.getElementById('articleKeywords') && keywords) {
                    document.getElementById('articleKeywords').value = Array.isArray(keywords) ? keywords.join(', ') : keywords;
                }

                if (typeof tinymce !== 'undefined' && tinymce.get('articleContent')) {
                    tinymce.get('articleContent').setContent(content);
                } else {
                    document.getElementById('articleContent').value = content;
                }

                this.showToast("✨ SEO-Optimized Article Generated!", "success");
            }
        } catch (error) {
            this.showToast(error.message || "AI Generation failed", "error");
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    async handleAutoTranslateUI(btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Translating...';
        btn.disabled = true;

        try {
            const qText = tinymce.get('q-text-en') ? tinymce.get('q-text-en').getContent() : document.getElementById('q-text-en').value;
            const explText = tinymce.get('questionExplanation') ? tinymce.get('questionExplanation').getContent() : document.getElementById('questionExplanation').value;
            
            const inputs = {
                q_text: qText,
                expl: explText,
                opt1: document.getElementById('q-opt1-en').value,
                opt2: document.getElementById('q-opt2-en').value,
                opt3: document.getElementById('q-opt3-en').value,
                opt4: document.getElementById('q-opt4-en').value,
            };

            if (!inputs.q_text || inputs.q_text.trim() === '') throw new Error("Please enter an English Question first.");

            const response = await fetch('/api/admin/translate-bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.getToken()}` },
                body: JSON.stringify({ inputs: inputs, targetLang: 'hi' })
            });

            const result = await response.json();

            if (result.success) {
                const t = result.translations;
                if (tinymce.get('q-text-hi')) tinymce.get('q-text-hi').setContent(t.q_text);
                
                if (t.expl && t.expl.trim() !== '') {
                    const editor = tinymce.get('questionExplanation');
                    if (editor && !editor.getContent().includes('(Hindi):')) {
                        editor.setContent(editor.getContent() + `<br><hr><strong>(Hindi Translation):</strong><br> ${t.expl}`);
                    }
                }

                document.getElementById('q-opt1-hi').value = t.opt1;
                document.getElementById('q-opt2-hi').value = t.opt2;
                document.getElementById('q-opt3-hi').value = t.opt3;
                document.getElementById('q-opt4-hi').value = t.opt4;

                this.showToast('Auto-translation complete!', 'success');
            } else {
                throw new Error(result.message || "Translation API failed");
            }
        } catch (error) {
            this.showToast(error.message, 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    // =================================================
    // 6. FORM HANDLERS
    // =================================================
    async handleFormSubmit(form) {
        const formId = form.id;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        try {
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            submitBtn.disabled = true;

            let result;
            switch (formId) {
                case 'adminLoginForm': result = await this.handleLogin(form); break;
                case 'addCourseForm': result = await this.handleAddCourse(form); break;
                case 'editCourseForm': result = await this.handleEditCourse(form); break;
                case 'addTestForm': result = await this.handleAddTest(form); break;
                case 'editTestForm': result = await this.handleEditTest(form); break;
                case 'addQuestionForm': result = await this.handleAddQuestion(form); break;
                case 'addArticleForm': result = await this.handleAddArticle(form); break;
                case 'addResourceForm': result = await this.handleAddResource(form); break;
                case 'pyqForm': result = await this.handlePyqUpload(form); break;
                default: throw new Error(`Unknown form: ${formId}`);
            }

            if (result.success) {
                if (form.id === 'adminLoginForm') {
                    this.setToken(result.token);
                    window.location.href = '/admin/dashboard';
                } else if (form.id === 'editCourseForm' || form.id === 'editTestForm') {
                    this.showToast(result.message, 'success');
                    setTimeout(() => window.location.href = `/admin/${form.id === 'editCourseForm' ? 'courses' : 'tests'}`, 1500);
                } else {
                    this.showToast(result.message || 'Success!', 'success');
                    form.reset();
                    // Reset editors
                    if (typeof tinymce !== 'undefined') {
                        tinymce.get('q-text-en')?.setContent('');
                        tinymce.get('q-text-hi')?.setContent('');
                        tinymce.get('questionExplanation')?.setContent('');
                        tinymce.get('articleContent')?.setContent('');
                    }
                    this.refreshPageData();
                }
            }
        } catch (error) {
            // Toast already shown
        } finally {
            if(submitBtn) {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        }
    }

    /* [admin.js] UPDATED UPLOAD HANDLER */

    async handlePyqUpload(form) {
        const btn = form.querySelector('button');
        const loading = document.getElementById('processingState');
        const bar = document.getElementById('progressBar');
        const fileInput = document.getElementById('pdfFile');
        const file = fileInput?.files[0];

        if (!file) return this.showToast("Please select a PDF or Word file first", "warning");

        // 1. Lock UI & Show Loading
        btn.disabled = true;
        form.style.opacity = '0.5';
        if (loading) loading.style.display = 'block';
        
        btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Uploading to AI...';

        try {
            const formData = new FormData(form);

            // 2. Start Upload Request
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/admin/upload-pyq', true);
            xhr.setRequestHeader('Authorization', `Bearer ${this.getToken()}`);

            // 3. Fake Progress Bar (To keep you patient for 2 mins)
            let percent = 0;
            const timer = setInterval(() => {
                if (percent < 95) {
                    percent += 1; 
                    if (bar) bar.style.width = percent + '%';
                    
                    // Reassuring messages
                    if (percent > 20) btn.innerHTML = '<i class="fas fa-brain"></i> AI Reading Document...';
                    if (percent > 50) btn.innerHTML = '<i class="fas fa-pen-fancy"></i> Generating Questions...';
                    if (percent > 80) btn.innerHTML = '<i class="fas fa-save"></i> Saving to Database...';
                }
            }, 1200); // Slower increment to match AI processing time

            // 4. Handle Success/Error
            xhr.onload = () => {
                clearInterval(timer);
                if (xhr.status === 200) {
                    if (bar) bar.style.width = '100%';
                    let data;
                    try { data = JSON.parse(xhr.responseText); } catch(e) {}
                    
                    this.showToast(`✅ Success! ${data?.count || 'All'} questions added.`, 'success');
                    
                    // Reload page to clear form
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    let msg = "Upload failed";
                    try { msg = JSON.parse(xhr.responseText).message; } catch(e) {}
                    this.showToast("❌ Error: " + msg, 'error');
                    this.resetUploadUI(form, btn, loading);
                }
            };

            xhr.onerror = () => {
                clearInterval(timer);
                this.showToast("❌ Network connection failed.", 'error');
                this.resetUploadUI(form, btn, loading);
            };

            xhr.send(formData);

        } catch (err) {
            console.error(err);
            this.showToast("Error: " + err.message, 'error');
            this.resetUploadUI(form, btn, loading);
        }
    }

    resetUploadUI(form, btn, loading) {
        form.style.opacity = '1';
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-robot"></i> Generate Questions via AI';
        if (loading) loading.style.display = 'none';
    }

    // Helper to send the actual request
    async uploadSingleBatch(originalForm, fileBlob, fileName, barElement, startProgress, endProgress) {
        const formData = new FormData(originalForm);
        const fileInput = originalForm.querySelector('input[type="file"]');
        const inputName = fileInput.name || 'pdfFile'; // Detected name or default
        
        // Replace the file in formData with our specific blob
        formData.set(inputName, fileBlob, fileName);

        // Fake progress for this batch
        let p = startProgress;
        const interval = setInterval(() => { 
            if (p < endProgress - 5) { p++; if (barElement) barElement.style.width = p + '%'; }
        }, 100);

        const res = await fetch('/api/admin/upload-pyq', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.getToken()}` },
            body: formData
        });

        clearInterval(interval);
        if (barElement) barElement.style.width = endProgress + '%';

        const data = await res.json();
        if (!data.success) throw new Error(data.message || "Batch failed");
        return data;
    }
    async handleLogin(form) {
        const data = { email: form.email.value, password: form.password.value };
        const response = await fetch(`${this.baseURL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (!response.ok) { this.showToast(result.message, 'error'); throw new Error(result.message); }
        return result;
    }

    async handleAddQuestion(form) {
        const testId = new URLSearchParams(window.location.search).get('id');
        const qEn = tinymce.get('q-text-en').getContent();
        const qHi = tinymce.get('q-text-hi').getContent();
        const explanationEn = tinymce.get('questionExplanation').getContent();

        if (!qEn || !qHi) {
            this.showToast('Please fill in both English and Hindi question text.', 'error');
            throw new Error('Required fields missing');
        }

        const questionData = {
            questionText: { english: qEn, hindi: qHi },
            options: [
                { english: form['q-opt1-en'].value, hindi: form['q-opt1-hi'].value },
                { english: form['q-opt2-en'].value, hindi: form['q-opt2-hi'].value },
                { english: form['q-opt3-en'].value, hindi: form['q-opt3-hi'].value },
                { english: form['q-opt4-en'].value, hindi: form['q-opt4-hi'].value }
            ],
            correctAnswerIndex: parseInt(form.correctAnswer.value),
            explanation: { english: explanationEn, hindi: explanationEn },
            
            paper: document.getElementById('paperSelector') ? document.getElementById('paperSelector').value : 'Paper 2',
            unit: document.getElementById('unitSelector') ? document.getElementById('unitSelector').value : 'General'
        };

        return await this.apiCall(`/tests/${testId}/questions`, { method: 'POST', body: JSON.stringify(questionData) });
    }

    async handleAddArticle(form) {
        let content = '';
        if (typeof tinymce !== 'undefined' && tinymce.get('articleContent')) {
            content = tinymce.get('articleContent').getContent();
        } else {
            content = form.articleContent.value;
        }

        if (!content || content.trim() === '') {
            this.showToast('Article content cannot be empty', 'warning');
            throw new Error('Content required');
        }

        const data = {
            title: form.articleTitle.value,
            slug: form.articleSlug ? form.articleSlug.value : undefined, 
            metaDescription: form.metaDescription ? form.metaDescription.value : undefined,
            keywords: form.articleKeywords ? form.articleKeywords.value : undefined,
            content: content 
        };

        return await this.apiCall('/articles', { method: 'POST', body: JSON.stringify(data) });
    }
        async handleAddCourse(form) {
        const originalPriceInput = document.getElementById('courseOriginalPrice');
        const data = {
            title: form.courseTitle.value,
            description: form.courseDescription.value,
            price: parseFloat(form.coursePrice.value),
            originalPrice: (originalPriceInput && originalPriceInput.value) ? parseFloat(originalPriceInput.value) : null,
            isPublished: form.isPublished.checked
        };
        return await this.apiCall('/courses', { method: 'POST', body: JSON.stringify(data) });
    }

    async handleEditCourse(form) {
        const courseId = new URLSearchParams(window.location.search).get('id');
        const originalPriceInput = document.getElementById('courseOriginalPrice');
        const data = {
            title: form.courseTitle.value,
            description: form.courseDescription.value,
            price: parseFloat(form.coursePrice.value),
            originalPrice: (originalPriceInput && originalPriceInput.value) ? parseFloat(originalPriceInput.value) : null,
            isPublished: form.isPublished.checked
        };
        return await this.apiCall(`/courses/${courseId}`, { method: 'PUT', body: JSON.stringify(data) });
    }
    async handleAddTest(form) {
        const data = {
            title: form.testTitle.value,
            courseId: form.testCourse.value,
            duration: parseInt(form.testDuration.value, 10),
            isFree: form.isFreeTest.checked,
            unlockDate: form.unlockDate.value || null
        };
        return await this.apiCall('/tests', { method: 'POST', body: JSON.stringify(data) });
    }

    async handleEditTest(form) {
        const testId = new URLSearchParams(window.location.search).get('id');
        const data = {
            title: form.testTitle.value,
            courseId: form.testCourse.value,
            duration: parseInt(form.testDuration.value, 10),
            isFree: form.isFreeTest.checked,
            unlockDate: form.unlockDate.value || null
        };
        return await this.apiCall(`/tests/${testId}`, { method: 'PUT', body: JSON.stringify(data) });
    }

    async handleAddResource(form) {
        const formData = new FormData(form);
        return await this.apiCall('/resources', { method: 'POST', body: formData });
    }

    async handleDelete(id, type) {
        if (!confirm(`Are you sure you want to delete this ${type}?`)) return;
        try {
            let endpoint = '';
            if (type === 'user') endpoint = `/users/${id}`;
            else if (type === 'question') endpoint = `/questions/${id}`;
            else endpoint = `/${type}s/${id}`; 
            
            const result = await this.apiCall(endpoint, { method: 'DELETE' });
            this.showToast(result.message, 'success');
            this.refreshPageData();
        } catch (error) { }
    }

    async handleBulkDelete() {
        const paper = document.getElementById('qPaper')?.value || '';
        const year = document.getElementById('qYear')?.value || '';
        const month = document.getElementById('qMonth')?.value || '';
        const unit = document.getElementById('qUnit')?.value || '';
        const countText = document.getElementById('total-questions-count')?.textContent || '0';

        if (!paper && !year && !month && !unit) {
            return this.showToast("Please select at least one filter to delete.", "warning");
        }

        const confirmMsg = `⚠️ DANGER ZONE ⚠️\n\n` +
            `You are about to DELETE ALL questions matching:\n` +
            `• Paper: ${paper || 'All'}\n` +
            `• Year: ${year || 'All'}\n` +
            `• Month: ${month || 'All'}\n` +
            `• Unit: ${unit || 'All'}\n\n` +
            `This will remove ${countText}.\n\n` +
            `THIS ACTION CANNOT BE UNDONE!\n\n` +
            `Are you absolutely sure?`;

        if (!confirm(confirmMsg)) {
            return;
        }

        try {
            const result = await this.apiCall('/questions/bulk', {
                method: 'DELETE',
                body: JSON.stringify({ paper, year, month, unit })
            });

            this.showToast(result.message, 'success');
            this.fetchQuestions(1);
        } catch (e) {
            this.showToast("Delete failed: " + e.message, 'error');
        }
    }

    async handleFullEditSubmit(form) {
        const id = document.getElementById('edit-q-id').value;
        
        // Get TinyMCE content safely
        const getEditorContent = (editorId) => {
            const editor = tinymce.get(editorId);
            return editor ? editor.getContent() : document.getElementById(editorId)?.value || '';
        };
        
        // Get radio value safely
        const correctAnswerEl = document.querySelector('input[name="editCorrect"]:checked');
        const correctAnswerIndex = correctAnswerEl ? parseInt(correctAnswerEl.value) : 0;
        
        const data = {
            paper: document.getElementById('edit-paper').value,
            unit: document.getElementById('edit-unit').value,
            questionText: { 
                english: getEditorContent('edit-q-en'),
                hindi: getEditorContent('edit-q-hi')
            },
            options: [
                { 
                    english: document.getElementById('edit-opt1-en').value || '',
                    hindi: document.getElementById('edit-opt1-hi').value || ''
                },
                { 
                    english: document.getElementById('edit-opt2-en').value || '',
                    hindi: document.getElementById('edit-opt2-hi').value || ''
                },
                { 
                    english: document.getElementById('edit-opt3-en').value || '',
                    hindi: document.getElementById('edit-opt3-hi').value || ''
                },
                { 
                    english: document.getElementById('edit-opt4-en').value || '',
                    hindi: document.getElementById('edit-opt4-hi').value || ''
                }
            ],
            correctAnswerIndex: correctAnswerIndex,
            explanation: { 
                english: getEditorContent('edit-expl'),
                hindi: ''
            }
        };

        try {
            const result = await this.apiCall(`/questions/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            
            if (result.success) {
                this.showToast("✅ Question updated successfully!", "success");
                
                // Close modal
                const modal = document.getElementById('fullEditModal');
                if (modal) {
                    modal.style.display = 'none';
                    // Destroy TinyMCE editors
                    ['edit-q-en', 'edit-q-hi', 'edit-expl'].forEach(id => {
                        const editor = tinymce.get(id);
                        if (editor) editor.remove();
                    });
                }
                
                // Refresh the question list
                await this.fetchQuestions(this.currentPage || 1);
            }
        } catch(err) {
            this.showToast("❌ Update failed: " + err.message, "error");
        }
    }

    handleEdit(id, type) {
        const currentPage = document.querySelector('.pagination-btn.active')?.dataset.page || 1; 
        if (type === 'course') window.location.href = `/admin/edit-course?id=${id}`;
        else if (type === 'test') window.location.href = `/admin/edit-test?id=${id}`;
        else if (type === 'question') {
            window.location.href = `/admin/questions?edit=${id}&page=${currentPage}`; 
        }
        else this.showToast('Edit functionality not implemented', 'warning');
    }

    refreshPageData() {
        switch (this.currentPage) {
            case 'dashboard': this.fetchDashboardData(); break;
            case 'students': this.loadStudentsPage(); break;
            case 'courses': this.fetchCourses(); break;
            case 'tests': this.fetchTests(); break;
            case 'test-details': this.fetchTestDetails(); break;
            case 'knowledge-base': this.fetchArticles(); break;
            case 'questions': this.fetchQuestions(); break;
        }
    }

    loadPageSpecificFunctionality() {
        switch (this.currentPage) {
            case 'dashboard': this.setupDashboard(); break;
            case 'students': this.setupStudentsPage(); break;
            case 'courses': this.setupCoursesPage(); break;
            case 'edit-course': this.setupEditCoursePage(); break;
            case 'tests': this.setupTestsPage(); break;
            case 'edit-test': this.setupEditTestPage(); break;
            case 'test-details': this.setupTestDetailsPage(); break;
            case 'knowledge-base': this.setupKnowledgeBasePage(); break;
            case 'resources': this.setupResourcesPage(); break;
            case 'questions': this.setupQuestionsPage(); break;
        }
    }

    getCurrentPage() {
        const path = window.location.pathname.split('/').pop();
        if (path === 'admin' || path === '') return 'dashboard';
        return path;
    }

    // =================================================
    // 7. DASHBOARD FUNCTIONALITY
    // =================================================
    async setupDashboard() { 
        await this.fetchDashboardData(); 
    }
    
    async fetchDashboardData() {
        try {
            const [stats, recent] = await Promise.all([
                this.apiCall('/stats'), 
                this.apiCall('/recent-students')
            ]);
            
            if (stats.success) {
                document.getElementById('stats-students').textContent = stats.stats.studentCount;
                document.getElementById('stats-courses').textContent = stats.stats.courseCount;
                document.getElementById('stats-tests').textContent = stats.stats.testCount;
                document.getElementById('stats-articles').textContent = stats.stats.articleCount;
            }
            
            if (recent.success) {
                const tbody = document.getElementById('recent-students-table');
                if (!tbody) return;
                tbody.innerHTML = recent.students.length ? 
                    recent.students.map(s => `
                        <tr>
                            <td><strong>${this.escapeHTML(s.fullname)}</strong></td>
                            <td>${this.escapeHTML(s.email)}</td>
                            <td>${new Date(s.dateRegistered).toLocaleDateString()}</td>
                        </tr>
                    `).join('') : 
                    '<tr><td colspan="3">No students.</td></tr>';
            }
        } catch (e) {
            console.error('Dashboard error:', e);
        }
    }

    // =================================================
    // 8. STUDENTS PAGE FUNCTIONALITY (SEPARATE)
    // =================================================
    async setupStudentsPage() {
        await this.loadStudentsPage(1);
    }
    
    async loadStudentsPage(page = 1) {
        try {
            this.showLoading('#studentsTable');
            const searchQuery = document.getElementById('studentSearch')?.value || '';
            let endpoint = `/users?page=${page}&limit=10`;
            if (searchQuery) endpoint += `&search=${encodeURIComponent(searchQuery)}`;
            
            const data = await this.apiCall(endpoint);
            
            this.renderStudentsTable(data.users);
            this.renderStudentPagination(data.pagination);
            
        } catch (error) {
            console.error(error);
            const tbody = document.getElementById('studentsTable');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">Error loading student data</td></tr>';
            }
        } finally {
            this.hideLoading('#studentsTable');
        }
    }
    
    renderStudentsTable(users) {
        const tbody = document.getElementById('studentsTable');
        if (!tbody) return;
        
        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">No students found</td></tr>';
            return;
        }
        
        tbody.innerHTML = users.map(user => {
            let coursesHtml = '<span style="color: #999;">Not Enrolled</span>';
            if (user.enrolledCourses && user.enrolledCourses.length > 0) {
                coursesHtml = user.enrolledCourses.map(c => 
                    `<div class="badge">${this.escapeHTML(c.courseId?.title || 'Unknown Course')}</div>`
                ).join('');
            }
            const avgScore = user.averageScore ? Math.round(user.averageScore) : 0;
            const scoreClass = avgScore >= 60 ? 'score-high' : (avgScore >= 40 ? 'score-avg' : 'score-low');
            return `
            <tr>
                <td><strong>${this.escapeHTML(user.fullname)}</strong></td>
                <td>
                    <div><i class="fas fa-envelope"></i> ${this.escapeHTML(user.email)}</div>
                    <div style="font-size: 0.9em; color: #666;"><i class="fas fa-phone"></i> ${this.escapeHTML(user.phone || 'N/A')}</div>
                </td>
                <td>${coursesHtml}</td>
                <td>
                    <div>Tests Taken: <strong>${user.testAttempts || 0}</strong></div>
                    <div>Avg Score: <span class="${scoreClass}">${avgScore}%</span></div>
                </td>
                <td>${new Date(user.dateRegistered).toLocaleDateString('en-IN')}</td>
                <td>
                    <button class="action-btn view" data-id="${user._id}"><i class="fas fa-eye"></i> View</button>
                    <button class="action-btn delete" data-id="${user._id}" data-type="user"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        }).join('');
    }
    
    renderStudentPagination(pagination) {
        const container = document.getElementById('studentPagination');
        const summary = document.getElementById('pagination-summary');
        if (!container || !pagination) {
            if(container) container.innerHTML = '';
            if(summary) summary.innerHTML = 'No data';
            return;
        }
        
        const { currentPage, totalPages, totalUsers } = pagination;
        
        if (summary) {
            const start = totalUsers === 0 ? 0 : (currentPage - 1) * 10 + 1;
            const end = Math.min(currentPage * 10, totalUsers);
            summary.textContent = `Showing ${start}-${end} of ${totalUsers} Students`;
        }
        
        if (totalPages <= 1) { 
            container.innerHTML = ''; 
            return; 
        }
        
        let buttons = '';
        
        // Previous button
        if (currentPage > 1) {
            buttons += `<button class="btn btn-outline" data-page="${currentPage - 1}">Prev</button>`;
        }
        
        // Page numbers
        buttons += `<span style="padding: 10px;">Page ${currentPage} of ${totalPages}</span>`;
        
        // Next button
        if (currentPage < totalPages) {
            buttons += `<button class="btn btn-outline" data-page="${currentPage + 1}">Next</button>`;
        }
        
        container.innerHTML = buttons;
    }
    
    async viewStudentDetails(studentId) {
        const modal = document.getElementById('studentModal');
        try {
            modal.classList.remove('hidden'); 
            modal.style.display = 'flex';
            document.getElementById('modalTestHistory').innerHTML = '<tr><td colspan="4">Loading details...</td></tr>';

            const data = await this.apiCall(`/users/${studentId}/details`);
            if(data.success) {
                const u = data.user;
                const r = data.results;
                document.getElementById('modalStudentName').textContent = u.fullname;
                document.getElementById('modalEmail').textContent = u.email;
                document.getElementById('modalPhone').textContent = u.phone || 'N/A';
                document.getElementById('modalEducation').textContent = `${u.highestQualification || 'N/A'} (${u.subject || ''})`;
                document.getElementById('modalTarget').textContent = `${u.preparationLevel || ''}`;

                const historyBody = document.getElementById('modalTestHistory');
                if(r.length === 0) historyBody.innerHTML = '<tr><td colspan="4">No tests completed yet.</td></tr>';
                else {
                    historyBody.innerHTML = r.map(res => `
                        <tr>
                            <td>${this.escapeHTML(res.test?.title || 'Deleted Test')}</td>
                            <td>${res.score} / ${res.test?.totalMarks || 100}</td>
                            <td><span class="${res.percentage >= 60 ? 'score-high' : 'score-low'}">${Math.round(res.percentage)}%</span></td>
                            <td>${new Date(res.submittedAt).toLocaleDateString('en-IN')} ${new Date(res.submittedAt).toLocaleTimeString('en-IN')}</td>
                        </tr>
                    `).join('');
                }
            }
        } catch(error) {
            this.showToast('Failed to load student details', 'error');
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
    }

    // =================================================
    // 9. OTHER PAGES (SIMPLIFIED)
    // =================================================
    async setupCoursesPage() { 
        await this.fetchCourses(); 
    }
    
    async fetchCourses() {
        try { 
            const data = await this.apiCall('/courses'); 
            this.renderCoursesTable(data.courses); 
        } catch (e) { 
            console.error('Courses error:', e);
            this.renderCoursesTable([]); 
        }
    }
    
    renderCoursesTable(courses) {
        const tbody = document.querySelector('#coursesTable tbody');
        if (!tbody) return;
        tbody.innerHTML = courses && courses.length ? courses.map(c => `
            <tr>
                <td>${this.escapeHTML(c.title)}</td>
                <td>₹${c.price}</td>
                <td><span class="status-badge ${c.isPublished?'published':'unpublished'}">${c.isPublished?'Live':'Draft'}</span></td>
                <td>
                    <button class="action-btn edit" data-id="${c._id}" data-type="course"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete" data-id="${c._id}" data-type="course"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('') : '<tr><td colspan="4" style="text-align:center;">No courses.</td></tr>';
    }
    async setupEditCoursePage() {
        const id = new URLSearchParams(window.location.search).get('id');
        if (id) {
            try {
                const data = await this.apiCall(`/courses/${id}`);
                if (data.success) {
                    document.getElementById('courseTitle').value = data.course.title;
                    document.getElementById('courseDescription').value = data.course.description;
                    document.getElementById('coursePrice').value = data.course.price;
                    
                    // Populate the Original Price field if it exists in the database
                    if (document.getElementById('courseOriginalPrice') && data.course.originalPrice) {
                        document.getElementById('courseOriginalPrice').value = data.course.originalPrice;
                    }
                    
                    document.getElementById('isPublished').checked = data.course.isPublished;
                }
            } catch (e) {
                console.error('Edit course error:', e);
            }
        }
    }

    async setupTestsPage() { 
        await this.fetchTests(); 
    }
    
    async fetchTests() {
        try { 
            const data = await this.apiCall('/tests'); 
            this.renderTestsTable(data.tests); 
        } catch (e) { 
            console.error('Tests error:', e);
            this.renderTestsTable([]); 
        }
    }
    
    renderTestsTable(tests) {
        const tbody = document.querySelector('#testsTable tbody');
        if (!tbody) return;
        
        tbody.innerHTML = tests && tests.length ? tests.map(t => {
            let statusText = 'Paid';
            let statusClass = 'published';
            
            if (t.isFree) {
                statusText = 'Free (Demo)';
            } else if (t.unlockDate && new Date(t.unlockDate) > new Date()) {
                statusText = 'Locked';
                statusClass = 'locked';
            }

            return `
                <tr>
                    <td>${this.escapeHTML(t.title)}</td>
                    <td>${t.course ? this.escapeHTML(t.course.title) : 'N/A'}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <a href="/admin/test-details?id=${t._id}" class="action-btn view"><i class="fas fa-plus"></i></a>
                        <button class="action-btn edit" data-id="${t._id}" data-type="test"><i class="fas fa-edit"></i></button>
                        <button class="action-btn delete" data-id="${t._id}" data-type="test"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join('') : '<tr><td colspan="4" style="text-align:center;">No tests.</td></tr>';
    }
    
    async setupEditTestPage() {
        const id = new URLSearchParams(window.location.search).get('id');
        if (!id) return;

        // STEP 1: Fetch and Populate Courses First
        try {
            const courseRes = await this.apiCall('/courses'); // Fetch all courses
            const courseSelect = document.getElementById('testCourse');
            
            if (courseRes.success && courseSelect) {
                // Populate the dropdown options
                courseSelect.innerHTML = '<option value="">-- Select Course --</option>' + 
                    courseRes.courses.map(c => `<option value="${c._id}">${this.escapeHTML(c.title)}</option>`).join('');
            }
        } catch (e) {
            console.error('Failed to load courses:', e);
            this.showToast('Could not load course list', 'error');
        }

        // STEP 2: Fetch Test Details and Set Values
        try {
            const data = await this.apiCall(`/tests/${id}`);
            if (data.success) {
                const t = data.test;
                
                if(document.getElementById('testTitle')) 
                    document.getElementById('testTitle').value = t.title;
                
                if(document.getElementById('testCourse')) {
                    // Safe check for course ID (it might be an object or a string string)
                    const courseId = t.course && t.course._id ? t.course._id : t.course;
                    document.getElementById('testCourse').value = courseId;
                }

                if(document.getElementById('testDuration')) 
                    document.getElementById('testDuration').value = t.duration;
                
                if(document.getElementById('isFreeTest')) 
                    document.getElementById('isFreeTest').checked = t.isFree;
                
                // Handle unlockDate if your edit form has it
                if(document.getElementById('unlockDate') && t.unlockDate) {
                    const dateVal = new Date(t.unlockDate).toISOString().split('T')[0];
                    document.getElementById('unlockDate').value = dateVal;
                }
            }
        } catch (e) {
            console.error('Edit test error:', e);
            this.showToast('Failed to load test details', 'error');
        }
    }    
    async setupTestDetailsPage() { 
        await this.fetchTestDetails(); 
    }
    
    async fetchTestDetails() {
        const id = new URLSearchParams(window.location.search).get('id');
        if (!id) return;
        try {
            const data = await this.apiCall(`/tests/${id}`);
            if (data.success) {
                document.getElementById('test-title-header').textContent = `Test: ${data.test.title}`;
                document.getElementById('questions-count').textContent = data.test.questions.length;
                document.getElementById('question-count').textContent = `${data.test.questions.length} Questions`;
                
                const list = document.getElementById('questions-list');
                if(data.test.questions.length === 0) { 
                    list.innerHTML = '<div style="text-align:center;padding:2rem;">No questions yet.</div>'; 
                    return; 
                }
                list.innerHTML = data.test.questions.map((q, i) => `
                    <div class="question-item" style="border:1px solid #eee; padding:15px; margin-bottom:10px; background:white; border-radius:8px;">
                        <div style="display:flex; justify-content:space-between;">
                            <strong>Q${i+1}: ${this.escapeHTML(q.questionText.english)}</strong>
                            <button class="action-btn delete" data-id="${q._id}" data-type="question"><i class="fas fa-trash"></i></button>
                        </div>
                        <div style="color:#666; font-size:0.9em; margin-top:5px;">${q.paper || 'Paper 2'} | ${q.unit || 'General'}</div>
                    </div>
                `).join('');
            }
        } catch (e) {
            console.error('Test details error:', e);
        }
    }

    async setupKnowledgeBasePage() {
        try {
            const data = await this.apiCall('/articles');
            const tbody = document.querySelector('#articlesTable tbody');
            if(!tbody) return;
            tbody.innerHTML = data.articles && data.articles.length ? data.articles.map(a => `
                <tr>
                    <td>${this.escapeHTML(a.title)}</td>
                    <td>${new Date(a.datePublished).toLocaleDateString()}</td>
                    <td>
                        <button class="action-btn delete" data-id="${a._id}" data-type="article"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `).join('') : '<tr><td colspan="3" style="text-align:center;">No articles.</td></tr>';
        } catch (e) {
            console.error('Knowledge base error:', e);
        }
    }

    async setupResourcesPage() { 
        await this.fetchCourses(); 
    }
    
    // =================================================
    // 10. QUESTIONS PAGE (SEPARATE)
    // =================================================
    // =================================================
// QUESTIONS PAGE FUNCTIONALITY (FIXED VERSION)
// =================================================
async setupQuestionsPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const initialPage = parseInt(urlParams.get('page')) || 1;
    this.currentPage = initialPage;
    
    console.log('Setting up questions page...');
    
    // Initialize General filter button
    this.initGeneralFilter();
    
    // Setup paper and unit dropdowns
    const paperSelect = document.getElementById('qPaper');
    const unitSelect = document.getElementById('qUnit');
    
    if (paperSelect && unitSelect) {
        // Initialize units based on current paper selection
        this.updateUnitDropdown(paperSelect.value);
        
        paperSelect.addEventListener('change', () => {
            this.updateUnitDropdown(paperSelect.value);
        });
    }

    // Setup apply filters button
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Apply filters clicked');
            this.fetchQuestions(1);
        });
    }

    // Setup bulk delete button
    const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
    if (bulkDeleteBtn) {
        bulkDeleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleBulkDelete();
        });
    }

    // Setup search input
    const searchInput = document.getElementById('qSearch');
    if (searchInput) {
        searchInput.addEventListener('input', this.debounce(() => {
            this.fetchQuestions(1);
        }, 500));
    }

    // Setup filter select changes
    ['qYear', 'qMonth', 'qUnit'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', () => {
                this.fetchQuestions(1);
            });
        }
    });

    // Initial load
    await this.fetchQuestions();
}

// Initialize General filter button
initGeneralFilter() {
    const generalFilterBtn = document.getElementById('generalFilterBtn');
    if (!generalFilterBtn) return;
    
    // Check saved state
    const isActive = localStorage.getItem('generalUnitFilter') === 'true';
    if (isActive) {
        generalFilterBtn.classList.remove('btn-secondary');
        generalFilterBtn.classList.add('btn-primary');
        generalFilterBtn.style.cssText = 'height: 42px; background: #e0f2fe; color: #0369a1; border: 2px solid #0284c7; font-weight: bold;';
        generalFilterBtn.innerHTML = '<i class="fas fa-star"></i> General First ✓';
    }
    
    // Add click handler
    generalFilterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleGeneralFilter();
    });
}

// Toggle General filter
toggleGeneralFilter() {
    const btn = document.getElementById('generalFilterBtn');
    const isActive = btn.classList.contains('btn-primary');
    
    if (isActive) {
        // Remove filter
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
        btn.style.cssText = 'height: 42px; background: #f0f9ff; color: #0369a1; border: 1px solid #bae6fd;';
        btn.innerHTML = '<i class="fas fa-star"></i> General First';
        localStorage.removeItem('generalUnitFilter');
    } else {
        // Apply filter
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary');
        btn.style.cssText = 'height: 42px; background: #e0f2fe; color: #0369a1; border: 2px solid #0284c7; font-weight: bold;';
        btn.innerHTML = '<i class="fas fa-star"></i> General First ✓';
        localStorage.setItem('generalUnitFilter', 'true');
    }
    
    // Refresh questions
    this.fetchQuestions(1);
}

updateUnitDropdown(paper) {
    const unitSelect = document.getElementById('qUnit');
    if (!unitSelect) return;
    
    const p1Units = ["Teaching Aptitude", "Research Aptitude", "Comprehension", "Communication", "Mathematical Reasoning", "Logical Reasoning", "Data Interpretation", "ICT", "People & Environment", "Higher Education"];
    const p2Units = ["Political Theory", "Western Political Thought", "Indian Political Thought", "Comparative Politics", "International Relations", "India's Foreign Policy", "Political Institutions", "Political Processes", "Public Administration", "Governance"];
    
    const list = paper === 'Paper 1' ? p1Units : (paper === 'Paper 2' ? p2Units : []);
    
    unitSelect.innerHTML = '<option value="">All Units</option>' + 
        list.map(u => `<option value="${u}">${u}</option>`).join('') +
        '<option value="General">General</option>';
}

async fetchQuestions(page = 1) {
    const container = document.getElementById('questions-container');
    const loader = document.getElementById('questions-loader');
    
    console.log('Fetching questions, page:', page);
    
    // Get filter values
    const search = document.getElementById('qSearch')?.value || '';
    const paper = document.getElementById('qPaper')?.value || '';
    const year = document.getElementById('qYear')?.value || '';
    const month = document.getElementById('qMonth')?.value || '';
    const unit = document.getElementById('qUnit')?.value || '';
    
    this.currentPage = page;
    
    const query = new URLSearchParams({ 
        page, 
        limit: 20, 
        search, 
        paper, 
        year, 
        month, 
        unit 
    }).toString();

    // Show loader
    if(loader) loader.style.display = 'block';
    if(container) container.innerHTML = '';

    try {
        console.log('Making API call to:', `/all-questions?${query}`);
        const data = await this.apiCall(`/all-questions?${query}`);
        console.log('API response received:', data);
        
        const countElement = document.getElementById('total-questions-count');
        if(countElement) {
            countElement.textContent = `${data.pagination?.totalQuestions || 0} Questions Found`;
        }

        if (!data.questions || data.questions.length === 0) {
            if(container) {
                container.innerHTML = '<div style="text-align:center; padding:40px; color:#666;">No questions match your filters.</div>';
            }
        } else {
            if(container) {
                // Check if General filter is active
                const showGeneralFirst = localStorage.getItem('generalUnitFilter') === 'true';
                let questions = [...data.questions];
                
                // Sort if General filter is active
                if (showGeneralFirst) {
                    questions.sort((a, b) => {
                        const aIsGeneral = (a.unit || '').toLowerCase() === 'general';
                        const bIsGeneral = (b.unit || '').toLowerCase() === 'general';
                        
                        if (aIsGeneral && !bIsGeneral) return -1; // General first
                        if (!aIsGeneral && bIsGeneral) return 1;  // Non-general after
                        return 0; // Keep original order
                    });
                }
                
                container.innerHTML = questions.map(q => {
                    const isGeneralUnit = (q.unit || '').toLowerCase() === 'general';
                    const unitClass = isGeneralUnit ? 'q-tag unit general' : 'q-tag unit';
                    const unitText = q.unit || 'General';
                    
                    return `
                        <div class="q-card" data-id="${q._id}">
                            <div class="q-meta">
                                <span class="q-tag paper">${q.paper || 'N/A'}</span>
                                <span class="q-tag">${q.year || ''}</span>
                                ${q.month ? `<span class="q-tag" style="background:#fff7ed; color:#c2410c;">${q.month}</span>` : ''}
                                <span class="${unitClass}">
                                    ${unitText}
                                    ${isGeneralUnit ? ' ⭐' : ''}
                                </span>
                            </div>
                            
                            <div class="q-text">
                                ${this.stripHTML(q.questionText?.english || '').substring(0, 150)}...
                            </div>
                            
                            <div class="q-actions">
                                <button class="view-edit" data-id="${q._id}"
                                    style="background: #e0f2fe; color: #0284c7; padding: 5px 12px; border:none; border-radius:4px; cursor:pointer;">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                                <button class="action-btn delete" data-id="${q._id}" data-type="question" style="color:#ef4444;">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        this.renderQuestionPagination(data.pagination);

    } catch (e) {
        console.error('Error fetching questions:', e);
        if(container) {
            container.innerHTML = '<p style="color:red; text-align:center;">Error loading questions. Please try again.</p>';
        }
    } finally {
        if(loader) loader.style.display = 'none';
    }
}

renderQuestionPagination(pagination) {
    const container = document.getElementById('qPagination');
    if (!container) return;
    if (!pagination || pagination.totalPages <= 1) { 
        container.innerHTML = ''; 
        return; 
    }

    const { currentPage, totalPages } = pagination;
    
    container.innerHTML = `
        <button class="btn btn-outline" data-page="${currentPage - 1}" 
            ${currentPage === 1 ? 'disabled' : ''}>
            Prev
        </button>
        <span style="padding: 10px;">Page ${currentPage} of ${totalPages}</span>
        <button class="btn btn-outline" data-page="${currentPage + 1}" 
            ${currentPage === totalPages ? 'disabled' : ''}>
            Next
        </button>
    `;
}

// Handle Bulk Delete
async handleBulkDelete() {
    const paper = document.getElementById('qPaper')?.value || '';
    const year = document.getElementById('qYear')?.value || '';
    const month = document.getElementById('qMonth')?.value || '';
    const unit = document.getElementById('qUnit')?.value || '';
    const countText = document.getElementById('total-questions-count')?.textContent || '0';

    if (!paper && !year && !month && !unit) {
        return this.showToast("Please select at least one filter to delete.", "warning");
    }

    const confirmMsg = `⚠️ DANGER ZONE ⚠️\n\n` +
        `You are about to DELETE ALL questions matching:\n` +
        `• Paper: ${paper || 'All'}\n` +
        `• Year: ${year || 'All'}\n` +
        `• Month: ${month || 'All'}\n` +
        `• Unit: ${unit || 'All'}\n\n` +
        `This will remove ${countText}.\n\n` +
        `THIS ACTION CANNOT BE UNDONE!\n\n` +
        `Are you absolutely sure?`;

    if (!confirm(confirmMsg)) {
        return;
    }

    try {
        const result = await this.apiCall('/questions/bulk', {
            method: 'DELETE',
            body: JSON.stringify({ paper, year, month, unit })
        });

        this.showToast(result.message, 'success');
        this.fetchQuestions(1);
    } catch (e) {
        this.showToast("Delete failed: " + e.message, 'error');
    }
}

// Open Edit Modal
async openFullEditModal(id) {
    const modal = document.getElementById('fullEditModal');
    
    try {
        // Show modal first (but make it almost invisible)
        modal.style.display = 'flex';
        modal.style.opacity = '0.1';
        
        // Fetch question data
        const response = await fetch(`/api/admin/questions/${id}`, {
            headers: { 'Authorization': `Bearer ${this.getToken()}` }
        });
        const data = await response.json();
        
        if(!data.success) throw new Error("Could not fetch question");
        const q = data.question;

        console.log('Editing question:', q);

        // Populate form fields
        document.getElementById('edit-q-id').value = q._id;
        document.getElementById('edit-paper').value = q.paper || 'Paper 2';
        
        // Populate units based on paper
        this.populateEditUnits(q.paper || 'Paper 2');
        
        // Set the selected unit
        document.getElementById('edit-unit').value = q.unit || 'General';

        // Populate options
        q.options.forEach((opt, idx) => {
            if(idx < 4) {
                document.getElementById(`edit-opt${idx+1}-en`).value = opt.english || '';
                document.getElementById(`edit-opt${idx+1}-hi`).value = opt.hindi || '';
            }
        });

        // Set correct answer
        const radios = document.getElementsByName('editCorrect');
        if(radios[q.correctAnswerIndex]) {
            radios[q.correctAnswerIndex].checked = true;
        }

        // Destroy old TinyMCE instances
        ['edit-q-en', 'edit-q-hi', 'edit-expl'].forEach(id => {
            const editor = tinymce.get(id);
            if (editor) editor.remove();
        });

        // Make modal visible
        modal.style.opacity = '1';
        
        // Initialize editors with delay
        setTimeout(() => {
            // English question editor
            tinymce.init({
                selector: '#edit-q-en',
                height: 150,
                menubar: false,
                plugins: 'lists link table',
                toolbar: 'bold italic underline | table | bullist numlist',
                setup: (editor) => {
                    editor.on('init', () => {
                        editor.setContent(q.questionText?.english || '');
                    });
                }
            });

            // Hindi question editor
            tinymce.init({
                selector: '#edit-q-hi',
                height: 150,
                menubar: false,
                plugins: 'lists link table',
                toolbar: 'bold italic underline | table | bullist numlist',
                setup: (editor) => {
                    editor.on('init', () => {
                        editor.setContent(q.questionText?.hindi || '');
                    });
                }
            });

            // Explanation editor
            tinymce.init({
                selector: '#edit-expl',
                height: 200,
                menubar: false,
                plugins: 'lists link table',
                toolbar: 'bold italic underline | table | bullist numlist',
                setup: (editor) => {
                    editor.on('init', () => {
                        const explText = (q.explanation?.english || '') + 
                            (q.explanation?.hindi ? 
                                `<br><hr><strong>Hindi:</strong> ${q.explanation.hindi}` : 
                                '');
                        editor.setContent(explText || '');
                    });
                }
            });
        }, 100);

    } catch (e) {
        console.error('Error loading question:', e);
        this.showToast("Error loading question: " + e.message, 'error');
        modal.style.display = 'none';
    }
}

// Populate edit modal units
populateEditUnits(paper) {
    const p1Units = [
        "Teaching Aptitude", 
        "Research Aptitude", 
        "Comprehension", 
        "Communication", 
        "Mathematical Reasoning", 
        "Logical Reasoning", 
        "Data Interpretation", 
        "ICT", 
        "People & Environment", 
        "Higher Education"
    ];
    
    const p2Units = [
        "Political Theory", 
        "Western Political Thought", 
        "Indian Political Thought", 
        "Comparative Politics", 
        "International Relations", 
        "India's Foreign Policy", 
        "Political Institutions", 
        "Political Processes", 
        "Public Administration", 
        "Governance"
    ];
    
    const select = document.getElementById('edit-unit');
    if (!select) return;
    
    // Clear existing options
    select.innerHTML = '';
    
    // Add units based on paper
    let units = [];
    if (paper === 'Paper 1') {
        units = p1Units;
    } else if (paper === 'Paper 2') {
        units = p2Units;
    }
    
    // Add unit options
    units.forEach(unit => {
        const option = document.createElement('option');
        option.value = unit;
        option.textContent = unit;
        select.appendChild(option);
    });
    
    // Add General option at the end
    const generalOption = document.createElement('option');
    generalOption.value = 'General';
    generalOption.textContent = 'General';
    select.appendChild(generalOption);
}
    async fetchQuestions(page = 1) {
        const container = document.getElementById('questions-container');
        const loader = document.getElementById('questions-loader');
        
        // Get filter values
        const search = document.getElementById('qSearch')?.value || '';
        const paper = document.getElementById('qPaper')?.value || '';
        const year = document.getElementById('qYear')?.value || '';
        const month = document.getElementById('qMonth')?.value || '';
        const unit = document.getElementById('qUnit')?.value || '';
        
        this.currentPage = page;
        
        const query = new URLSearchParams({ 
            page, 
            limit: 20, 
            search, 
            paper, 
            year, 
            month, 
            unit 
        }).toString();

        if(loader) loader.style.display = 'block';
        if(container) container.innerHTML = '';

        try {
            const data = await this.apiCall(`/all-questions?${query}`);
            
            const countElement = document.getElementById('total-questions-count');
            if(countElement) {
                countElement.textContent = `${data.pagination?.totalQuestions || 0} Questions Found`;
            }

            if (!data.questions || data.questions.length === 0) {
                if(container) {
                    container.innerHTML = '<div style="text-align:center; padding:40px; color:#666;">No questions match your filters.</div>';
                }
            } else {
                if(container) {
                    container.innerHTML = data.questions.map(q => `
                        <div class="q-card">
                            <div class="q-meta">
                                <span class="q-tag paper">${q.paper || 'N/A'}</span>
                                <span class="q-tag">${q.year || ''}</span>
                                ${q.month ? `<span class="q-tag" style="background:#fff7ed; color:#c2410c;">${q.month}</span>` : ''}
                                <span class="q-tag unit">${q.unit || 'General'}</span>
                            </div>
                            
                            <div class="q-text" style="font-size: 1.1em; color: #333;">
                                ${this.stripHTML(q.questionText?.english || '').substring(0, 150)}...
                            </div>
                            
                            <div class="q-actions" style="display:flex; gap:10px; justify-content:flex-end;">
                                <button class="action-btn view-edit" data-id="${q._id}"
                                    style="background: #e0f2fe; color: #0284c7; padding: 5px 12px; border:none; border-radius:4px; cursor:pointer;">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                                <button class="action-btn delete" data-id="${q._id}" data-type="question" style="color:#ef4444;">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            </div>
                        </div>
                    `).join('');
                }
            }

            this.renderQuestionPagination(data.pagination);

        } catch (e) {
            console.error('Questions error:', e);
            if(container) {
                container.innerHTML = '<p style="color:red; text-align:center;">Error loading questions.</p>';
            }
        } finally {
            if(loader) loader.style.display = 'none';
        }
    }

    renderQuestionPagination(pagination) {
        const container = document.getElementById('qPagination');
        if (!container) return;
        if (!pagination || pagination.totalPages <= 1) { 
            container.innerHTML = ''; 
            return; 
        }

        const { currentPage, totalPages } = pagination;
        
        container.innerHTML = `
            <button class="btn btn-outline" data-page="${currentPage - 1}" 
                ${currentPage === 1 ? 'disabled' : ''}>
                Prev
            </button>
            <span style="padding: 10px;">Page ${currentPage} of ${totalPages}</span>
            <button class="btn btn-outline" data-page="${currentPage + 1}" 
                ${currentPage === totalPages ? 'disabled' : ''}>
                Next
            </button>
        `;
    }

    async openFullEditModal(id) {
        const modal = document.getElementById('fullEditModal');
        
        try {
            // Show modal first
            modal.style.display = 'flex';
            modal.style.opacity = '0.1';
            
            // Fetch question data
            const response = await fetch(`/api/admin/questions/${id}`, {
                headers: { 'Authorization': `Bearer ${this.getToken()}` }
            });
            const data = await response.json();
            
            if(!data.success) throw new Error("Could not fetch question");
            const q = data.question;

            // Populate form fields
            document.getElementById('edit-q-id').value = q._id;
            document.getElementById('edit-paper').value = q.paper || 'Paper 2';
            
            // Populate units based on paper
            this.populateEditUnits(q.paper || 'Paper 2');
            
            // Set the selected unit
            document.getElementById('edit-unit').value = q.unit || 'General';

            // Populate options
            q.options.forEach((opt, idx) => {
                if(idx < 4) {
                    document.getElementById(`edit-opt${idx+1}-en`).value = opt.english || '';
                    document.getElementById(`edit-opt${idx+1}-hi`).value = opt.hindi || '';
                }
            });

            // Set correct answer
            const radios = document.getElementsByName('editCorrect');
            if(radios[q.correctAnswerIndex]) radios[q.correctAnswerIndex].checked = true;

            // Destroy old TinyMCE instances
            ['edit-q-en', 'edit-q-hi', 'edit-expl'].forEach(id => {
                const editor = tinymce.get(id);
                if (editor) editor.remove();
            });

            // Make modal visible
            modal.style.opacity = '1';
            
            // Initialize editors with delay
            setTimeout(() => {
                // English question editor
                tinymce.init({
                    selector: '#edit-q-en',
                    height: 150,
                    menubar: false,
                    plugins: 'lists link table',
                    toolbar: 'bold italic underline | table | bullist numlist',
                    setup: (editor) => {
                        editor.on('init', () => {
                            editor.setContent(q.questionText?.english || '');
                        });
                    }
                });

                // Hindi question editor
                tinymce.init({
                    selector: '#edit-q-hi',
                    height: 150,
                    menubar: false,
                    plugins: 'lists link table',
                    toolbar: 'bold italic underline | table | bullist numlist',
                    setup: (editor) => {
                        editor.on('init', () => {
                            editor.setContent(q.questionText?.hindi || '');
                        });
                    }
                });

                // Explanation editor
                tinymce.init({
                    selector: '#edit-expl',
                    height: 200,
                    menubar: false,
                    plugins: 'lists link table',
                    toolbar: 'bold italic underline | table | bullist numlist',
                    setup: (editor) => {
                        editor.on('init', () => {
                            const explText = (q.explanation?.english || '') + 
                                (q.explanation?.hindi ? 
                                    `<br><hr><strong>Hindi:</strong> ${q.explanation.hindi}` : 
                                    '');
                            editor.setContent(explText || '');
                        });
                    }
                });
            }, 100);

        } catch (e) {
            console.error('Edit modal error:', e);
            this.showToast("Error loading question: " + e.message, 'error');
            modal.style.display = 'none';
        }
    }

    // =================================================
    // 11. EDIT MODAL UNIT POPULATION
    // =================================================
    populateEditUnits(paper) {
        const p1Units = [
            "Teaching Aptitude", 
            "Research Aptitude", 
            "Comprehension", 
            "Communication", 
            "Mathematical Reasoning", 
            "Logical Reasoning", 
            "Data Interpretation", 
            "ICT", 
            "People & Environment", 
            "Higher Education"
        ];
        
        const p2Units = [
            "Political Theory", 
            "Western Political Thought", 
            "Indian Political Thought", 
            "Comparative Politics", 
            "International Relations", 
            "India's Foreign Policy", 
            "Political Institutions", 
            "Political Processes", 
            "Public Administration", 
            "Governance"
        ];
        
        const select = document.getElementById('edit-unit');
        if (!select) return;
        
        // Save current value
        const currentValue = select.value;
        
        // Clear existing options
        select.innerHTML = '';
        
        // Add default option
        select.innerHTML = '<option value="">Select Unit</option>';
        
        // Add units based on paper
        let units = [];
        if (paper === 'Paper 1') {
            units = p1Units;
        } else if (paper === 'Paper 2') {
            units = p2Units;
        }
        
        // Add unit options
        units.forEach(unit => {
            const option = document.createElement('option');
            option.value = unit;
            option.textContent = unit;
            select.appendChild(option);
        });
        
        // Add General option at the end
        const generalOption = document.createElement('option');
        generalOption.value = 'General';
        generalOption.textContent = 'General';
        select.appendChild(generalOption);
        
        // Try to restore previous value
        if (currentValue) {
            select.value = currentValue;
        }
    }

    // =================================================
    // 12. UTILITY FUNCTIONS
    // =================================================
    debounce(func, wait) { 
        let timeout; 
        return function(...args) { 
            clearTimeout(timeout); 
            timeout = setTimeout(() => func.apply(this, args), wait); 
        }; 
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => { 
    window.adminManager = new AdminManager(); 
});