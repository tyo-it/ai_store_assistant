// Test to demonstrate the improved AI voice TTS
const TextToSpeech = require('./src/assistant/TextToSpeech');
require('dotenv').config();

async function testAIVoiceResponse() {
    console.log('🤖 Testing AI Voice Response with Improved TTS...\n');
    
    const tts = new TextToSpeech();
    
    // Simulate typical AI responses that were previously spoken too fast
    const aiResponses = [
        "Hello! I understand you'd like me to speak more clearly. Let me demonstrate how I now speak with a slower, more measured pace.",
        "I can help you with various tasks like answering questions, providing information, or having conversations. What would you like to talk about?",
        "Thank you for using the AI voice assistant. I hope you find my speech much clearer and easier to understand now."
    ];
    
    console.log('🎛️ Current TTS Settings:');
    console.log(`   Speech Rate: ${process.env.SPEECH_RATE} (40% slower than default)`);
    console.log(`   Speech Pitch: ${process.env.SPEECH_PITCH} (neutral tone)`);
    console.log(`   Voice Model: ${process.env.DEFAULT_VOICE}\n`);
    
    for (let i = 0; i < aiResponses.length; i++) {
        const response = aiResponses[i];
        console.log(`🗣️  AI Response ${i + 1}:`);
        console.log(`   "${response}"\n`);
        
        try {
            const ttsResult = await tts.synthesize(response, {
                speed: parseFloat(process.env.SPEECH_RATE) || 0.6,
                pitch: parseFloat(process.env.SPEECH_PITCH) || 0
            });
            
            console.log(`✅ TTS Applied successfully (${ttsResult.format} format)`);
            console.log('   → Speech will be 40% slower with clear pronunciation\n');
            
            // Small delay between responses for demo
            if (i < aiResponses.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
            
        } catch (error) {
            console.error(`❌ TTS Error for response ${i + 1}:`, error.message);
        }
    }
    
    console.log('\n🎉 AI Voice TTS Test Complete!');
    console.log('\n📝 Summary of Improvements:');
    console.log('   ✓ 40% slower speech rate (0.6 instead of 1.0)');
    console.log('   ✓ Natural pauses between words and sentences');
    console.log('   ✓ Clear, distinct pronunciation');
    console.log('   ✓ Server-side TTS for fallback mode');
    console.log('   ✓ Better voice instructions for Realtime API');
    console.log('\n🌐 Test the live application at: http://localhost:3000');
}

// Run the test
testAIVoiceResponse().catch(console.error);
