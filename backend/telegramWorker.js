// --- FILE: backend/telegramWorker.js ---
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');

function initTelegramQuiz() {
    // Only initialize if the token exists
    if (!process.env.TELEGRAM_BOT_TOKEN) {
        console.warn("⚠️ Telegram Bot Token missing. Quiz automation disabled.");
        return;
    }

    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
    const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || "@saraswatiugcnet"; 
    
    // Grab the existing Question model compiled in server.js
    const Question = mongoose.model('Question'); 
    
    function cleanText(text) {
        if (!text) return "";
        // 1. Remove all HTML tags (e.g., <p>, <br>, <strong>)
        let cleaned = text.replace(/<[^>]*>?/gm, '');
        // 2. Decode common HTML entities
        cleaned = cleaned.replace(/&nbsp;/g, ' ')
                         .replace(/&amp;/g, '&')
                         .replace(/&lt;/g, '<')
                         .replace(/&gt;/g, '>')
                         .replace(/&quot;/g, '"')
                         .replace(/&#39;/g, "'");
        // 3. Remove excessive newlines/spaces
        return cleaned.replace(/\n\s*\n/g, '\n').trim();
    }
// --- 1. Validation Logic ---
    function isValidForTelegram(q, lang) {
        const TG_QUESTION_LIMIT = 300;
        const TG_OPTION_LIMIT = 100;

        // Clean the text before checking the length!
        const rawQuestion = lang === 'english' ? q.questionText.english : q.questionText.hindi;
        const questionText = cleanText(rawQuestion);
        
        if (!questionText || questionText.length > TG_QUESTION_LIMIT) {
            console.warn(`[Skip] ${lang} question exceeds 300 chars. ID: ${q._id}`);
            return false;
        }

        for (let opt of q.options) {
            const rawOption = lang === 'english' ? opt.english : opt.hindi;
            const optionText = cleanText(rawOption);
            if (!optionText || optionText.length > TG_OPTION_LIMIT) {
                console.warn(`[Skip] ${lang} option exceeds 100 chars. ID: ${q._id}`);
                return false;
            }
        }
        return true;
    }

    // --- 2. Sending Logic ---
    async function sendLanguageQuiz(q, lang) {
        // Clean the text before sending it to Telegram
        const rawQuestion = lang === 'english' ? q.questionText.english : q.questionText.hindi;
        const questionText = lang === 'english' ? `(EN) ${cleanText(rawQuestion)}` : `(HI) ${cleanText(rawQuestion)}`;
        
        const pollOptions = q.options.map(opt => {
            const rawOption = lang === 'english' ? opt.english : opt.hindi;
            return cleanText(rawOption);
        });
        
        let rawExplanation = lang === 'english' ? q.explanation?.english : q.explanation?.hindi;
        let explanation = cleanText(rawExplanation);
        
        // Explanations also have a 200 char limit in Telegram Quiz mode
        if (explanation && explanation.length > 200) {
            explanation = explanation.substring(0, 197) + "...";
        }

        await bot.sendPoll(CHANNEL_ID, questionText, pollOptions, {
            type: 'quiz',
            correct_option_id: q.correctAnswerIndex,
            explanation: explanation || "Check your notes!",
            is_anonymous: false
        });
    }
    // --- 3. Main Routine ---
    async function runDailyRoutine() {
        try {
            console.log("🚀 Starting Daily Telegram Quiz Routine...");

            // Fetch 5 Paper 2 and 3 Paper 1 questions, excluding DI/Comprehension
            const paper2Questions = await Question.aggregate([
                { $match: { paper: 'Paper 2', unit: { $nin: ["Data Interpretation", "Comprehension", "Reading Comprehension", "DI"] } } },
                { $sample: { size: 5 } }
            ]);

            const paper1Questions = await Question.aggregate([
                { $match: { paper: 'Paper 1', unit: { $nin: ["Data Interpretation", "Comprehension", "Reading Comprehension", "DI"] } } },
                { $sample: { size: 3 } }
            ]);

            const allQuestions = [...paper2Questions, ...paper1Questions];

            for (const q of allQuestions) {
                const isEnglishValid = isValidForTelegram(q, 'english');
                const isHindiValid = isValidForTelegram(q, 'hindi');

                if (!isEnglishValid || !isHindiValid) continue;

                await sendLanguageQuiz(q, 'english');
                await new Promise(res => setTimeout(res, 2000)); // 2 sec gap

                await sendLanguageQuiz(q, 'hindi');
                await new Promise(res => setTimeout(res, 60000)); // 1 min gap between distinct questions
            }

            console.log("✅ Daily Telegram Quiz Routine Completed.");
        } catch (err) {
            console.error("❌ Telegram Quiz Routine Error:", err);
        }
    }

    // --- 4. Scheduler ---
   cron.schedule('0 10,19 * * *', () => {
        runDailyRoutine();
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });

    console.log("⏱️ Telegram Quiz Scheduler initialized (Runs daily at 10:00 AM and 7:00 PM IST)");
}

module.exports = initTelegramQuiz;