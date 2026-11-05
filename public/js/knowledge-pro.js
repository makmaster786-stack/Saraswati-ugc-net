/* --- FILE: public/js/knowledge-pro.js (FINAL FIXED) --- */
class KnowledgeManager {
    constructor() {
        this.container = document.getElementById('articles-container');
        this.searchInput = document.getElementById('knowledge-search');
        this.init();
    }

    init() {
        console.log('📚 Knowledge Base Manager Initialized');
        // 1. Load articles immediately when page opens
        this.fetchArticles(); 
        this.setupEventListeners();
    }

    setupEventListeners() {
        if (this.searchInput) {
            // 2. Use the internal debounce function (Fixes ReferenceError)
            this.searchInput.addEventListener('input', this.debounce((e) => {
                const searchTerm = e.target.value.trim();
                this.fetchArticles(searchTerm);
            }, 500));
        }
    }

    // 3. Fetch Data from the new Server Route
    async fetchArticles(search = '') {
        try {
            this.showLoading();
            let url = '/api/articles';
            if(search) url += `?search=${encodeURIComponent(search)}`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.success) {
                this.renderArticles(data.articles);
            } else {
                this.container.innerHTML = '<p class="error-state">Failed to load articles.</p>';
            }
        } catch (error) {
            console.error('Error fetching articles:', error);
            this.container.innerHTML = '<p class="error-state">Something went wrong.</p>';
        }
    }

    // 4. Generate the HTML Cards
    renderArticles(articles) {
        if (!this.container) return;
        
        if (articles.length === 0) {
            this.container.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 40px;">
                    <i class="fas fa-search" style="font-size: 40px; color: #ddd; margin-bottom: 15px;"></i>
                    <p>No articles found matching your search.</p>
                </div>`;
            return;
        }

        this.container.innerHTML = articles.map(article => `
            <article class="article-card" style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); transition: transform 0.2s;">
                <div class="article-content">
                    <div class="article-meta" style="color: #666; font-size: 0.85em; margin-bottom: 10px;">
                        <span class="date"><i class="fas fa-calendar-alt"></i> ${new Date(article.datePublished).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        <span class="author" style="margin-left: 10px;"><i class="fas fa-user"></i> ${article.author || 'Team'}</span>
                    </div>
                    
                    <h3 style="margin: 0 0 10px 0; font-size: 1.2rem;">
                        <a href="/article/${article.slug}" style="text-decoration: none; color: #2c3e50;">${article.title}</a>
                    </h3>
                    
                    <p style="color: #666; font-size: 0.95rem; line-height: 1.5; margin-bottom: 15px;">
                        ${article.metaDescription || 'Click to read the full article...'}
                    </p>
                    
                    <div class="article-tags" style="margin-bottom: 15px;">
                        ${article.keywords ? article.keywords.split(',').slice(0, 3).map(tag => 
                            `<span class="tag" style="background: #eef2ff; color: #4f46e5; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; margin-right: 5px;">${tag.trim()}</span>`
                        ).join('') : ''}
                    </div>
                    
                    <a href="/article/${article.slug}" class="btn-text" style="color: #2563eb; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 5px;">
                        Read Article <i class="fas fa-arrow-right"></i>
                    </a>
                </div>
            </article>
        `).join('');
    }

    // 5. Internal Utility to fix "ProfessionalUtils is not defined"
    debounce(func, wait) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }
    
    showLoading() {
        if(this.container) {
            this.container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px;"><div class="spinner"></div></div>';
        }
    }
}

// Initialize safely
document.addEventListener('DOMContentLoaded', () => {
    // Check if the container exists before starting
    if (document.getElementById('articles-container')) {
        new KnowledgeManager();
    }
});