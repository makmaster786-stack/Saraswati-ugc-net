/* --- FILE: backend/generate-free-tests.js --- */
require('dotenv').config();
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- 1. SETUP ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MONGO_URI = process.env.MONGO_URI;

// Define Model Safely
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
        author: { type: String, default: 'Dr. Rajesh Mishra' },
        datePublished: { type: Date, default: Date.now }
    });
    Article = mongoose.model('Article', ArticleSchema);
}

// --- 2. CONFIGURATION ---
const TARGET_COUNT = 20; 
const BATCH_SIZE = 5;    

// --- 3. THE BRAIN (RESEARCHER) ---
async function findWinningTopics(existingTitles) {
    console.log("🔍 Researching 'Free Test' keywords...");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `
        Act as a Conversion Copywriter for an EdTech site.
        Generate a list of ${BATCH_SIZE} highly specific, click-worthy blog post titles targeting students looking for FREE UGC NET resources.
        
        CRITICAL RULES:
        1. EVERY title MUST contain the word "Free" and "UGC NET".
        2. Vary the intent:
           - "How to get..."
           - "Best sources for..."
           - "Downloadable..."
           - "Online Practice..."
        3. Do NOT use these titles: ${JSON.stringify(existingTitles)}.
        
        OUTPUT JSON ONLY: ["Title 1", "Title 2", "Title 3"...]
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

// --- 4. THE HAND (WRITER) ---
async function writeSalesArticle(topic) {
    console.log(`✍️  Writing Sales Page: "${topic}"...`);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // --- UPDATED PROMPT WITH HARDCODED DOMAIN ---
    const prompt = `
        Write a high-ranking SEO article about: "${topic}".
        
        STRUCTURE REQUIREMENTS:
        1. **Tone**: Helpful, urgent, and professional.
        2. **H1 Title**: Use the topic.
        3. **Introduction**: Acknowledge that paid tests are expensive and explain why free practice is vital.
        4. **Key Section**: "Features of our Free Mock Test Series" (Mention: NTA Pattern, Timer, Instant Result).
        5. **CALL TO ACTION (CRITICAL)**: 
           - You MUST include this HTML link exactly 2 times in the body.
           - USE THIS EXACT CODE (Do not change the URL):
           - <div style="text-align:center; margin: 30px 0;"><a href="https://saraswatiugcnet.com/available-tests" class="btn btn-primary" style="background:#2563eb; color:white; padding:15px 30px; text-decoration:none; border-radius:5px; font-weight:bold;">👉 Start Free UGC NET Mock Test Now</a></div>
        6. **Meta Description**: Persuasive snippet (under 160 chars).
        7. **Keywords**: "free ugc net mock test, online test series, nta net practice,free ugc net test".
        8. **CRITICAL RULE: Do NOT use Markdown formatting (no **bold**, no ## headings). Use ONLY HTML tags (<strong>, <h2>) directly in the output.
        OUTPUT JSON: { "title": "...", "slug": "...", "content": "...", "metaDescription": "...", "keywords": "..." }
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(text);

        // Duplicate Check
        const exists = await Article.findOne({ slug: data.slug });
        if (exists) {
            console.log(`⚠️  Skipped duplicate: ${data.slug}`);
            return false;
        }

        await Article.create({
            title: data.title,
            slug: data.slug,
            content: data.content,
            metaDescription: data.metaDescription,
            keywords: data.keywords,
            isPublished: true
        });

        console.log(`✅ PUBLISHED: ${data.title}`);
        return true;
    } catch (e) {
        console.error("❌ Writing Error:", e.message);
        return false;
    }
}

// --- 5. EXECUTION LOOP ---
async function runCampaign() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("🔌 Database Connected. Starting 'Free Test' Dominance Campaign...");

        let count = 0;
        let recentTitles = [];

        while (count < TARGET_COUNT) {
            // 1. Get Batch
            const topics = await findWinningTopics(recentTitles);
            
            if (!topics || topics.length === 0) {
                console.log("⚠️ No topics found. Waiting...");
                await new Promise(r => setTimeout(r, 5000));
                continue;
            }

            // 2. Process Batch
            for (const topic of topics) {
                if (count >= TARGET_COUNT) break;

                const success = await writeSalesArticle(topic);
                if (success) {
                    count++;
                    recentTitles.push(topic);
                    console.log(`📊 Progress: ${count}/${TARGET_COUNT}`);
                    
                    // Safety Delay (Avoid hitting rate limits)
                    await new Promise(r => setTimeout(r, 8000)); 
                }
            }
        }

        console.log("\n🎉 CAMPAIGN COMPLETE!");
        console.log("20 SEO Landing Pages have been created.");
        process.exit(0);

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

// Run it
runCampaign();