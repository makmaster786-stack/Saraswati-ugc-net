/* --- FILE: backend/fix-links.js --- */
require('dotenv').config();
const mongoose = require('mongoose');

// 1. Define a Flexible Schema (allows us to edit any article)
const Article = mongoose.model('Article', new mongoose.Schema({
    title: String,
    content: String,
    dateModified: Date
}, { strict: false }));

async function fixAllLinks() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("🔌 Connected to Database. Scanning articles...");

        const articles = await Article.find({});
        let count = 0;

        for (const article of articles) {
            if (!article.content) continue;

            let originalContent = article.content;
            let newContent = originalContent;

            // FIX 1: Replace "localhost:5000" with your domain
            newContent = newContent.replace(/http:\/\/localhost:5000/g, "https://saraswatiugcnet.com");

            // FIX 2: Replace relative links (e.g. href="/available-tests") with absolute links
            // This ensures they work even if scraped or viewed externally
            newContent = newContent.replace(/href="\/available-tests"/g, 'href="https://saraswatiugcnet.com/available-tests"');
            newContent = newContent.replace(/href="\/courses"/g, 'href="https://saraswatiugcnet.com/courses"');

            // If we made changes, save them
            if (originalContent !== newContent) {
                article.content = newContent;
                article.dateModified = new Date(); // Update timestamp for Sitemap
                await article.save();
                console.log(`✅ Fixed links in: ${article.title}`);
                count++;
            }
        }

        console.log(`\n🎉 SUCCESS! Updated ${count} articles.`);
        console.log("All links now point to https://saraswatiugcnet.com");
        process.exit(0);

    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

fixAllLinks();