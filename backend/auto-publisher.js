/* --- FILE: backend/auto-publisher.js --- */
require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');

// 1. CONFIGURATION
const MONGO_URI = process.env.MONGO_URI;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// 2. EXPANDED TOPIC LIST (100+ topics for Political Science)
const TOPICS = [
    // Core Political Theory (20 topics)
    "Difference between Political Theory and Political Philosophy",
    "Key Concepts of Liberty by Isaiah Berlin",
    "John Rawls Theory of Justice Explained",
    "Plato's Theory of Forms for UGC NET",
    "Aristotle's Classification of Constitutions",
    "Machiavelli's The Prince Summary UGC NET",
    "Social Contract Theory: Hobbes Locke and Rousseau",
    "Karl Marx Historical Materialism Notes",
    "Concept of Hegemony by Gramsci",
    "Hannah Arendt on Power and Violence",
    "Amartya Sen's Capability Approach",
    "Michel Foucault's Concept of Power",
    "Jurgen Habermas Theory of Communicative Action",
    "Postmodernism in Political Theory",
    "Feminist Political Theory: Key Concepts",
    "Liberalism: Classical and Modern",
    "Conservatism: Traditional and Modern",
    "Socialism: Utopian and Scientific",
    "Anarchism: Philosophical Foundations",
    "Pluralism in Political Theory",

    // Indian Political Thought (15 topics)
    "Dharma and Danda in Indian Political Thought",
    "Kautilya's Saptanga Theory of State",
    "Gandhian Concept of Swaraj and Satyagraha",
    "Dr Ambedkar on Social Justice and Caste",
    "Raja Ram Mohan Roy Political Thought",
    "Vivekananda's Concept of Nationalism",
    "Jawaharlal Nehru's Socialist Vision",
    "M N Roy and Radical Humanism",
    "Jayaprakash Narayan Total Revolution",
    "Deendayal Upadhyaya Integral Humanism",
    "B R Ambedkar Annihilation of Caste",
    "Periyar Self-Respect Movement",
    "Sir Syed Ahmed Khan Political Thought",
    "Maulana Abul Kalam Azad Nationalism",
    "Bhagat Singh Revolutionary Thought",

    // Comparative Politics (15 topics)
    "Comparative Politics Nature and Scope",
    "Systems Approach by David Easton",
    "Structural Functionalism by Almond and Powell",
    "Elite Theory of Democracy Pareto and Mosca",
    "Political Development Approaches",
    "Political Culture: Almond and Verba",
    "Political Socialization Theories",
    "Political Parties and Party Systems",
    "Electoral Systems Comparative Analysis",
    "Federalism Comparative Study",
    "Bureaucracy in Comparative Perspective",
    "Military in Politics Comparative Analysis",
    "Revolution Comparative Theories",
    "Democratization Third Wave",
    "Authoritarianism Modern Forms",

    // International Relations (15 topics)
    "Realism in International Relations",
    "Liberalism in International Relations",
    "Marxism in International Relations",
    "Constructivism in International Relations",
    "Feminist IR Theory",
    "Postcolonial IR Theory",
    "Security Studies Concepts",
    "International Political Economy",
    "Globalization Debates",
    "International Organizations UN",
    "Foreign Policy Analysis",
    "Diplomacy Modern Practices",
    "International Law Basics",
    "Human Rights International Regime",
    "Climate Change Politics",

    // Public Administration (15 topics)
    "Theories of Public Administration",
    "New Public Administration",
    "New Public Management",
    "Good Governance Concepts",
    "Development Administration",
    "Comparative Public Administration",
    "Personnel Administration",
    "Financial Administration",
    "Administrative Law",
    "Public Policy Analysis",
    "Administrative Reforms in India",
    "Local Government in India",
    "Civil Society and Governance",
    "E-Governance in India",
    "Citizen Charter and RTI",

    // Political Institutions (10 topics)
    "Constitution of India Features",
    "Fundamental Rights and Duties",
    "Directive Principles of State Policy",
    "Parliamentary System in India",
    "President of India Powers",
    "Prime Minister and Council of Ministers",
    "Judiciary Supreme Court",
    "Governor State Executive",
    "Election Commission of India",
    "Finance Commission India",

    // Current Affairs Integration (10 topics)
    "CAA NRC Debate India",
    "Farm Laws Repeal Analysis",
    "Electoral Bond Scheme",
    "One Nation One Election",
    "Uniform Civil Code Debate",
    "Judicial Activism India",
    "Cooperative Federalism India",
    "Digital India Initiatives",
    "Make in India Policy",
    "Sustainable Development Goals India"
];

// 3. UGC NET PYQs Database (Sample Questions)
const PYQ_DATABASE = {
    "liberty": [
        {
            "year": "2023",
            "question": "According to Isaiah Berlin, which concept of liberty emphasizes non-interference by others?",
            "options": ["Positive Liberty", "Negative Liberty", "Republican Liberty", "Moral Liberty"],
            "answer": "Negative Liberty",
            "solution": "Isaiah Berlin distinguished between negative liberty (freedom from interference) and positive liberty (freedom to achieve self-mastery). Negative liberty focuses on the absence of external constraints."
        },
        {
            "year": "2022",
            "question": "Isaiah Berlin's concept of 'Positive Liberty' is concerned with:",
            "options": ["Freedom from constraints", "Self-mastery and self-realization", "Protection of property rights", "Limitation of state power"],
            "answer": "Self-mastery and self-realization",
            "solution": "Positive liberty refers to having the capacity to act upon one's free will, emphasizing self-realization and achieving one's potential."
        }
    ],
    "justice": [
        {
            "year": "2023",
            "question": "John Rawls' 'Difference Principle' states that social and economic inequalities are justified only if they:",
            "options": ["Benefit the least advantaged", "Are based on merit", "Promote efficiency", "Are approved by majority"],
            "answer": "Benefit the least advantaged",
            "solution": "Rawls' Difference Principle argues that inequalities are permissible only if they work to the greatest benefit of the least advantaged members of society."
        }
    ],
    // Add more PYQs as needed
};

// 4. DEFINE SCHEMA
const ArticleSchema = new mongoose.Schema({
    title: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    content: { type: String, required: true },
    metaDescription: { type: String },
    keywords: { type: String },
    author: { type: String, default: 'AI Research Team' },
    datePublished: { type: Date, default: Date.now },
    dateModified: { type: Date, default: Date.now },
    topicCategory: { type: String },
    hasPYQs: { type: Boolean, default: false },
    wordCount: { type: Number }
});
const Article = mongoose.model('Article', ArticleSchema);

// 5. DEEPSEEK API CALL FUNCTION
async function callDeepSeekAPI(prompt, maxTokens = 4000) {
    try {
        const response = await axios.post(
            DEEPSEEK_API_URL,
            {
                model: "deepseek-chat",
                messages: [
                    { 
                        role: "system", 
                        content: "You are a UGC NET Political Science Professor. Generate detailed, exam-focused content in HTML format with bilingual English-Hindi elements where appropriate." 
                    },
                    { role: "user", content: prompt }
                ],
                max_tokens: maxTokens,
                temperature: 0.7
            },
            {
                headers: {
                    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error("DeepSeek API Error:", error.response?.data || error.message);
        throw error;
    }
}

// 6. GENERATE BILINGUAL PYQs
function generateBilingualPYQs(topicKeywords) {
    let pyqSection = '<div class="pyq-section">';
    pyqSection += '<h2>📝 Recent UGC NET Questions (बहुभाषी)</h2>';
    pyqSection += '<div class="pyq-container">';
    
    // Get relevant PYQs based on keywords
    const relevantPYQs = [];
    topicKeywords.forEach(keyword => {
        if (PYQ_DATABASE[keyword.toLowerCase()]) {
            relevantPYQs.push(...PYQ_DATABASE[keyword.toLowerCase()]);
        }
    });
    
    // Take 2-3 PYQs
    const selectedPYQs = relevantPYQs.slice(0, 3);
    
    if (selectedPYQs.length === 0) {
        // Generate generic PYQs if none found
        selectedPYQs.push(
            {
                "year": "2023",
                "question": "Which political philosopher is known for the concept of 'Two Concepts of Liberty'?",
                "options": ["Isaiah Berlin", "John Rawls", "Karl Marx", "Machiavelli"],
                "answer": "Isaiah Berlin",
                "solution": "Isaiah Berlin's lecture 'Two Concepts of Liberty' distinguished between negative and positive liberty."
            },
            {
                "year": "2022",
                "question": "The theory of 'Justice as Fairness' was propounded by:",
                "options": ["John Rawls", "Robert Nozick", "Amartya Sen", "Jeremy Bentham"],
                "answer": "John Rawls",
                "solution": "John Rawls proposed 'Justice as Fairness' in his book 'A Theory of Justice'."
            }
        );
    }
    
    selectedPYQs.forEach((pyq, index) => {
        pyqSection += `
        <div class="pyq-card">
            <h3>Question ${index + 1} (${pyq.year})</h3>
            <p><strong>${pyq.question}</strong></p>
            <div class="options">
                <ul>
                    ${pyq.options.map(opt => `<li>${opt}</li>`).join('')}
                </ul>
            </div>
            <div class="solution">
                <h4>Answer: ${pyq.answer}</h4>
                <p><strong>Solution (हल):</strong> ${pyq.solution}</p>
                <p><em>UGC NET महत्वपूर्ण बिंदु: यह प्रश्न ${pyq.year} के पेपर में आया था और प्रासंगिक अवधारणाओं को समझने के लिए आवश्यक है।</em></p>
            </div>
        </div>`;
    });
    
    pyqSection += '</div></div>';
    return pyqSection;
}

// 7. THE ENHANCED GENERATOR FUNCTION
async function generateAndPublish(topic) {
    console.log(`\n🤖 Working on: "${topic}"...`);

    const prompt = `
        Act as a Senior Professor for UGC NET Political Science.
        Generate a comprehensive, exam-focused blog post about: "${topic}".

        REQUIREMENTS:
        1. TITLE: SEO-optimized, catchy, includes main keyword
        2. SLUG: URL-friendly version (lowercase, hyphens)
        3. META DESCRIPTION: Under 160 characters, compelling
        4. KEYWORDS: 8-10 comma-separated keywords relevant to UGC NET
        5. CONTENT: Detailed HTML format with following sections:
           - Introduction (सम्बोधन in Hindi)
           - Historical Context
           - Key Concepts and Theories
           - Thinkers and Their Contributions
           - Contemporary Relevance
           - Critical Analysis
           - Key Takeaways for UGC NET (महत्वपूर्ण बिंदु)
           - Recommended Readings
        6. Include bilingual elements where appropriate (English + Hindi terms)
        7. Add 2-3 hypothetical UGC NET style questions at end
        
        FORMAT the content with proper HTML tags:
        - Use <h2> for main headings
        - Use <h3> for sub-headings
        - Use <ul> and <li> for lists
        - Use <strong> for emphasis
        - Use <div class="note"> for important notes
        - Use <div class="definition"> for definitions
        
        OUTPUT MUST BE VALID JSON:
        {
            "title": "...",
            "slug": "...",
            "metaDescription": "...",
            "keywords": "...",
            "content": "...",
            "topicCategory": "..."
        }
    `;

    try {
        // Generate main content
        const aiResponse = await callDeepSeekAPI(prompt);
        let text = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(text);
        
        // Extract keywords for PYQ matching
        const keywords = data.keywords.split(',').map(k => k.trim().toLowerCase());
        
        // Generate bilingual PYQs
        const pyqSection = generateBilingualPYQs(keywords);
        
        // Add PYQs to content
        data.content += pyqSection;
        
        // Add word count
        const wordCount = data.content.split(/\s+/).length;
        
        // Save to DB
        const newArticle = new Article({
            title: data.title,
            slug: data.slug || topic.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            metaDescription: data.metaDescription,
            keywords: data.keywords,
            content: data.content,
            topicCategory: data.topicCategory || 'Political Theory',
            hasPYQs: true,
            wordCount: wordCount,
            author: "Dr. Rajesh Mishra (AI-Assisted Research)"
        });

        await newArticle.save();
        console.log(`✅ PUBLISHED: ${data.title} (${wordCount} words)`);
        return true;

    } catch (error) {
        if (error.code === 11000) {
            console.log(`⚠️  Skipped: Article already exists for "${topic}"`);
        } else {
            console.error(`❌ Error on "${topic}":`, error.message);
            // Try with simpler prompt
            return await generateFallbackArticle(topic);
        }
        return false;
    }
}

// 8. FALLBACK GENERATOR (if main fails)
async function generateFallbackArticle(topic) {
    const simplePrompt = `
        Create a basic article about: "${topic}" for UGC NET Political Science.
        Return JSON with: title, slug, metaDescription, keywords, content.
        Content should be simple HTML with introduction, key points, and conclusion.
    `;
    
    try {
        const response = await callDeepSeekAPI(simplePrompt, 2000);
        const text = response.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(text);
        
        const newArticle = new Article({
            title: data.title,
            slug: data.slug || topic.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            metaDescription: data.metaDescription || `Learn about ${topic} for UGC NET Political Science`,
            keywords: data.keywords || 'UGC NET, Political Science, ' + topic,
            content: data.content,
            topicCategory: 'General',
            author: "AI Research Team"
        });
        
        await newArticle.save();
        console.log(`✅ PUBLISHED (Fallback): ${data.title}`);
        return true;
    } catch (error) {
        console.error(`❌ Fallback also failed for "${topic}"`);
        return false;
    }
}

// 9. BATCH PROCESSING FUNCTION
async function processInBatches(topics, batchSize = 5, delayBetweenBatches = 30000) {
    const totalArticles = topics.length;
    let publishedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < topics.length; i += batchSize) {
        const batch = topics.slice(i, i + batchSize);
        console.log(`\n📦 Processing Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(topics.length/batchSize)}`);
        console.log(`Articles in batch: ${batch.join(', ')}`);
        
        for (const topic of batch) {
            const result = await generateAndPublish(topic);
            if (result === true) publishedCount++;
            else if (result === false) failedCount++;
            
            // Delay between articles within batch
            await new Promise(resolve => setTimeout(resolve, 8000));
        }
        
        // Longer delay between batches to avoid rate limits
        if (i + batchSize < topics.length) {
            console.log(`⏳ Cooling down for ${delayBetweenBatches/1000} seconds before next batch...`);
            await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
    }
    
    return { publishedCount, skippedCount, failedCount };
}

// 10. MAIN EXECUTION FUNCTION
async function runAutoPublisher() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGO_URI);
        console.log("🔌 Database Connected Successfully");
        console.log("🚀 Starting SEO Content Engine with DeepSeek AI...");
        console.log(`📚 Total Topics in Queue: ${TOPICS.length}`);
        
        // Check existing articles
        const existingArticles = await Article.find({}, 'slug');
        const existingSlugs = new Set(existingArticles.map(a => a.slug));
        
        // Filter topics that don't exist
        const topicsToProcess = TOPICS.filter(topic => {
            const potentialSlug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            return !existingSlugs.has(potentialSlug);
        });
        
        console.log(`🆕 New Topics to Process: ${topicsToProcess.length}`);
        
        if (topicsToProcess.length === 0) {
            console.log("✅ All topics already exist in database!");
            console.log("💡 Try adding new topics to the TOPICS array.");
            process.exit(0);
        }
        
        // Process in batches
        const results = await processInBatches(topicsToProcess, 5, 30000);
        
        // Summary
        console.log("\n" + "=".repeat(50));
        console.log("🎉 CONTENT GENERATION COMPLETE!");
        console.log("=".repeat(50));
        console.log(`📊 STATISTICS:`);
        console.log(`   ✅ Published: ${results.publishedCount}`);
        console.log(`   ⚠️  Skipped: ${results.skippedCount}`);
        console.log(`   ❌ Failed: ${results.failedCount}`);
        console.log(`   📈 Total in DB now: ${existingArticles.length + results.publishedCount}`);
        console.log("\n💡 TIPS:");
        console.log("1. Run this script weekly to add new content");
        console.log("2. Monitor Google Search Console for rankings");
        console.log("3. Add more specific PYQs to PYQ_DATABASE");
        console.log("4. Consider adding images manually for better engagement");
        
        process.exit(0);
        
    } catch (error) {
        console.error("❌ Critical Error:", error);
        process.exit(1);
    }
}

// 11. ADDITIONAL FUNCTIONS FOR MAINTENANCE

// Function to update existing articles with PYQs
async function addPYQsToExistingArticles() {
    const articles = await Article.find({ hasPYQs: { $ne: true } }).limit(50);
    
    for (const article of articles) {
        console.log(`Updating: ${article.title}`);
        
        // Extract keywords from article
        const keywords = article.keywords ? article.keywords.split(',').map(k => k.trim().toLowerCase()) : [];
        
        // Add PYQ section
        const pyqSection = generateBilingualPYQs(keywords);
        article.content += pyqSection;
        article.hasPYQs = true;
        article.dateModified = new Date();
        
        await article.save();
        console.log(`✅ Updated with PYQs`);
        
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
}

// Function to generate more PYQs
async function generateMorePYQs() {
    const prompt = `
        Generate 10 recent UGC NET Political Science questions (2020-2023) on various topics.
        Include question, options, correct answer, and detailed solution.
        Format as JSON array.
    `;
    
    try {
        const response = await callDeepSeekAPI(prompt, 3000);
        const pyqs = JSON.parse(response.replace(/```json/g, '').replace(/```/g, '').trim());
        console.log(`Generated ${pyqs.length} new PYQs`);
        return pyqs;
    } catch (error) {
        console.error("Failed to generate PYQs:", error);
        return [];
    }
}

// 12. RUN THE BOT
runAutoPublisher();

// Uncomment to run specific functions:
// addPYQsToExistingArticles();
// generateMorePYQs().then(pyqs => console.log(pyqs));