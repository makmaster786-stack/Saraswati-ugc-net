// backend/test-ai.js
const API_KEY = "AIzaSyBAZwPTjbNs3MsYrQ4Umuqj4bNBmaWQ7y4"; // <--- PASTE KEY HERE

async function checkModels() {
    console.log("🔍 Checking available models for your API Key...");
    
    try {
        // 1. Direct call to Google's API to list models
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        const data = await response.json();

        if (data.error) {
            console.error("❌ API Error:", data.error.message);
            return;
        }

        if (!data.models) {
            console.error("❌ No models found. Your API Key might be new or restricted.");
            return;
        }

        console.log("✅ SUCCESS! Here are the models you can use:");
        console.log("------------------------------------------------");
        
        // 2. Filter for models that support 'generateContent'
        const availableModels = data.models
            .filter(m => m.supportedGenerationMethods.includes("generateContent"))
            .map(m => m.name.replace('models/', '')); // Clean up the name

        console.log(availableModels.join('\n'));
        console.log("------------------------------------------------");
        
        if (availableModels.length > 0) {
            console.log(`\n💡 RECOMMENDATION: Change your server.js to use: model: "${availableModels[0]}"`);
        }

    } catch (error) {
        console.error("Network Error:", error.message);
    }
}

checkModels();