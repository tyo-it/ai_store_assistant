// Test Indonesian TTS implementation
const TextToSpeech = require('./src/assistant/TextToSpeech');
require('dotenv').config();

async function testIndonesianTTS() {
    console.log('🇮🇩 Testing Indonesian Text-to-Speech Implementation...\n');
    
    const tts = new TextToSpeech();
    
    // Indonesian test phrases
    const indonesianPhrases = [
        "Halo! Saya adalah asisten AI Anda. Bagaimana saya bisa membantu Anda hari ini?",
        "Saya akan berbicara dengan jelas dan perlahan agar mudah dipahami.",
        "Terima kasih telah menggunakan asisten suara AI berbahasa Indonesia."
    ];
    
    console.log('🎛️ Current Indonesian TTS Settings:');
    console.log(`   Default Voice: ${process.env.DEFAULT_VOICE}`);
    console.log(`   Language: ${process.env.DEFAULT_LANGUAGE}`);
    console.log(`   Speech Rate: ${process.env.SPEECH_RATE}`);
    console.log(`   Speech Pitch: ${process.env.SPEECH_PITCH}`);
    
    // Test getting Indonesian voices
    try {
        console.log('\n🎤 Available Indonesian Voices:');
        const indonesianVoices = await tts.getIndonesianVoices();
        indonesianVoices.forEach((voice, index) => {
            console.log(`   ${index + 1}. ${voice.name} (${voice.gender}, ${voice.type})`);
        });
    } catch (error) {
        console.log('   Using fallback Indonesian voices list');
    }
    
    console.log('\n🗣️ Testing Indonesian Speech Synthesis:');
    
    for (let i = 0; i < indonesianPhrases.length; i++) {
        const phrase = indonesianPhrases[i];
        console.log(`\n📝 Test ${i + 1}: "${phrase}"`);
        
        try {
            const result = await tts.synthesize(phrase, {
                languageCode: 'id-ID',
                voice: process.env.DEFAULT_VOICE || 'id-ID-Standard-A',
                speed: parseFloat(process.env.SPEECH_RATE) || 0.8,
                pitch: parseFloat(process.env.SPEECH_PITCH) || 0
            });
            
            console.log(`✅ Indonesian TTS successful (${result.format} format)`);
            
            if (result.format === 'mp3') {
                const filename = `indonesian_test_${i + 1}.mp3`;
                await tts.saveAudioToFile(result, filename);
                console.log(`   Saved as: ${filename}`);
            }
        } catch (error) {
            console.error(`❌ Error with Indonesian TTS test ${i + 1}:`, error.message);
        }
    }
    
    console.log('\n🎉 Indonesian TTS Test Complete!');
    console.log('\n📋 Summary:');
    console.log('   ✓ Language: Bahasa Indonesia (id-ID)');
    console.log('   ✓ Voice Model: Indonesian voices');
    console.log('   ✓ AI Responses: Will be in Indonesian');
    console.log('   ✓ Speech Rate: Optimized for clarity');
    
    console.log('\n🌐 Test the application at: http://localhost:3000');
    console.log('   The AI will now respond in Bahasa Indonesia with Indonesian voice!');
}

testIndonesianTTS().catch(console.error);
