/* --- FILE: backend/seo-autopilot.js (FIXED) --- */
require('dotenv').config();
const cron = require('node-cron');
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 1. INITIALIZE GEMINI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 2. DEFINE THE ARTICLE MODEL (The Fix)
// We check if the model exists first. If not, we define it.
let Article;
try {
    Article = mongoose.model('Article');
} catch (error) {
    const ArticleSchema = new mongoose.Schema({
        title: { type: String, required: true, unique: true },
        slug: { type: String, required: true, unique: true, index: true },
        content: { type: String, required: true },
        metaDescription: { type: String },
        keywords: { type: String },
        author: { type: String, default: 'AI Content Team' },
        datePublished: { type: Date, default: Date.now },
        dateModified: { type: Date, default: Date.now }
    });
    Article = mongoose.model('Article', ArticleSchema);
}

// CONFIGURATION
const NICHE = "UGC NET Political Science Exam preparation, syllabus, and career tips";
const ARTICLES_PER_DAY = 200; 

// A. THE RESEARCHER
async function findFreshTopics() {
    console.log("🔍 Researching trending topics...");
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const prompt = `
        Act as a SEO Strategist for: "${NICHE}".
        Generate a list of 3 unique, high-traffic blog post titles.
        Focus on specific questions or "how to" guides.
        OUTPUT JSON ONLY: ["Topic 1", "Topic 2", "Topic 3"]
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
    } catch (e) {
        console.error("❌ Research Error:", e.message);
        return [];
    }
}

// B. THE WRITER
async function writeAndPublish(topic) {
    console.log(`✍️  Writing: "${topic}"...`);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
        Write a comprehensive SEO blog post about: "${topic}".
        STRICT RULES:
        1. Slug: URL-friendly (lowercase-hyphens).
        2. Content: HTML formatted (<h2>, <p>, <ul>). Include a "Conclusion".
        3. Meta: < 160 chars.
        4. Keywords: 5 comma-separated tags.
        5. CRITICAL RULE: Do NOT use Markdown formatting (no **bold**, no ## headings). Use ONLY HTML tags (<strong>, <h2>) directly in the output.
        
        OUTPUT JSON: { "title": "...", "slug": "...", "content": "...", "metaDescription": "...", "keywords": "..." }
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(text);

        const exists = await Article.findOne({ slug: data.slug });
        if (exists) {
            console.log(`⚠️  Skipped duplicate: ${data.slug}`);
            return;
        }

        await Article.create({
            title: data.title,
            slug: data.slug,
            content: data.content,
            metaDescription: data.metaDescription,
            keywords: data.keywords,
            author: "Mayank Shukla (JRF)",
            isPublished: true
        });

        console.log(`✅ PUBLISHED: ${data.title}`);
    } catch (e) {
        console.error("❌ Writing Error:", e.message);
    }
}

// C. THE MANAGER
async function runDailyCycle() {
    console.log("🔄 Starting SEO Cycle...");
    const potentialTopics = await findFreshTopics();
    
    let publishedCount = 0;
    for (const topic of potentialTopics) {
        if (publishedCount >= ARTICLES_PER_DAY) break;
        await writeAndPublish(topic);
        publishedCount++;
        // Cool down
        await new Promise(r => setTimeout(r, 5000));
    }
    console.log("💤 Cycle complete.");
}

// D. THE SCHEDULER (For Server.js)
const startAutopilot = () => {
    // Run every day at 03:00 PM
    cron.schedule('05 12 * * *', () => {
        runDailyCycle();
    });
    console.log("🚀 SEO Autopilot is ARMED (Schedule: Daily 3 PM).");
};

// --- E. MANUAL RUN BLOCK (For Testing) ---
// This allows you to run 'node seo-autopilot.js' in the terminal
if (require.main === module) {
    console.log("🛠️  Running in Manual Mode...");
    mongoose.connect(process.env.MONGO_URI)
        .then(async () => {
            console.log("🔌 Database Connected.");
            await runDailyCycle(); // Run one cycle immediately
            process.exit(0);
        })
        .catch(err => {
            console.error("Connection Error:", err);
            process.exit(1);
        });
}

module.exports = startAutopilot;