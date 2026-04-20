/* --- FILE: backend/repair-articles.js --- */
require('dotenv').config();
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 1. Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const Article = mongoose.model('Article', new mongoose.Schema({}, { strict: false }));

async function repairFormatting() {
    console.log("🔌 Connecting to Database...");
    await mongoose.connect(process.env.MONGO_URI);
    
    // Find all articles
    const articles = await Article.find({});
    console.log(`🔍 Found ${articles.length} articles. Checking formatting...`);

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    for (const article of articles) {
        // Check if article has Markdown symbols (Hashes or Stars)
        if (article.content && (article.content.includes('**') || article.content.includes('##'))) {
            
            console.log(`🛠️  Fixing formatting for: "${article.title}"...`);

            try {
                // Ask AI to convert Markdown to HTML
                const prompt = `
                    You are an HTML Converter. 
                    Convert the following text from Markdown to clean HTML.
                    
                    RULES:
                    1. Convert **text** to <strong>text</strong>.
                    2. Convert ## Heading to <h2>Heading</h2>.
                    3. Convert * lists to <ul><li>list</li></ul>.
                    4. Keep existing HTML tags (like <a href...>) exactly as they are.
                    5. Output ONLY the raw HTML string. No JSON, no markdown blocks.

                    INPUT TEXT:
                    ${article.content}
                `;

                const result = await model.generateContent(prompt);
                const newContent = result.response.text().replace(/```html/g, '').replace(/```/g, '').trim();

                // Save the fixed content
                article.content = newContent;
                await article.save();
                console.log(`✅ Fixed!`);

                // Safety delay to respect API limits
                await new Promise(r => setTimeout(r, 2000));

            } catch (error) {
                console.error(`❌ Failed to fix ${article.title}:`, error.message);
            }
        }
    }

    console.log("\n🎉 ALL ARTICLES REPAIRED!");
    process.exit(0);
}

repairFormatting();