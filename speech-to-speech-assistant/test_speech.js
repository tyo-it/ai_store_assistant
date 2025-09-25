const TextToSpeech = require('./src/assistant/TextToSpeech');
require('dotenv').config();

async function testSpeech() {
    console.log('🎤 Testing improved speech synthesis...');
    
    const tts = new TextToSpeech();
    
    // Test text that is often spoken too quickly
    const testTexts = [
        "Hello, I am your AI assistant. I will now speak more slowly and clearly.",
        "This is a test of the improved speech synthesis with slower speech rate and better pronunciation.",
        "Each word should be pronounced distinctly with natural pauses between sentences."
    ];
    
    console.log('Current settings:');
    console.log('- Speech Rate:', process.env.SPEECH_RATE || 'default');
    console.log('- Speech Pitch:', process.env.SPEECH_PITCH || 'default');
    console.log('- Default Voice:', process.env.DEFAULT_VOICE || 'default');
    
    for (let i = 0; i < testTexts.length; i++) {
        const text = testTexts[i];
        console.log(`\n📝 Test ${i + 1}: "${text}"`);
        
        try {
            const result = await tts.synthesize(text);
            console.log(`✅ Generated audio (${result.format} format)`);
            
            if (result.format === 'mp3') {
                // If using Google Cloud TTS, save to file for inspection
                const filename = `test_speech_${i + 1}.mp3`;
                await tts.saveAudioToFile(result, filename);
            }
        } catch (error) {
            console.error(`❌ Error with test ${i + 1}:`, error.message);
        }
    }
    
    console.log('\n🎉 Speech test completed!');
    console.log('The voice should now speak:');
    console.log('- 40% slower than before (rate: 0.6 instead of 1.0)');
    console.log('- With clearer pronunciation');
    console.log('- With natural pauses between words and sentences');
}

testSpeech().catch(console.error);
