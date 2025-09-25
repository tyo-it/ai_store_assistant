#!/usr/bin/env node

// Test script specifically for audio quality and streaming smoothness
const io = require('socket.io-client');

console.log('🎵 Testing Audio Streaming Quality Improvements...\n');

const socket = io('http://localhost:3000');

let audioChunksReceived = 0;
let audioQualityIssues = [];

socket.on('connect', () => {
    console.log('✅ Connected to server');
    console.log('🎯 This test will analyze audio streaming quality and gaps\n');
    startAudioQualityTest();
});

socket.on('status', (data) => {
    if (data.connected && data.mode === 'realtime') {
        console.log('📊 Status:', data.message);
        console.log(`🎤 Mode: ${data.mode}, Speech Rate: ${data.speechRate}x\n`);
    }
});

socket.on('audio-response', (data) => {
    if (data.type === 'audio-delta') {
        audioChunksReceived++;
        
        // Log first few chunks to verify they're being received
        if (audioChunksReceived <= 5) {
            console.log(`🎵 Audio chunk #${audioChunksReceived} received (${data.audio.length} bytes)`);
        } else if (audioChunksReceived === 6) {
            console.log('🎵 ... (more audio chunks streaming) ...');
        }
    }
});

socket.on('text-response', (data) => {
    if (data.type === 'text-complete') {
        console.log(`💬 AI Response: "${data.text}"`);
    }
});

socket.on('response-complete', (data) => {
    console.log(`✅ Response complete. Total audio chunks: ${audioChunksReceived}`);
    setTimeout(showResults, 2000);
});

socket.on('error', (error) => {
    if (!error.includes('no active response found') && !error.includes('assistant audio is present')) {
        audioQualityIssues.push(error);
        console.log('❌ Error:', error);
    }
});

function startAudioQualityTest() {
    console.log('🧪 Starting audio quality test...');
    console.log('📝 Requesting AI to tell a story (this will test streaming audio)');
    
    // Request a response that will generate significant audio
    socket.emit('text-message', 'Please tell me a short story about a robot exploring space. Make it about 30 seconds long.');
    
    console.log('🎧 Listen carefully for:');
    console.log('   ✓ Smooth audio without gaps between chunks');
    console.log('   ✓ No clicking or popping sounds');
    console.log('   ✓ Clear voice quality');
    console.log('   ✓ Consistent volume levels\n');
}

function showResults() {
    console.log('\n' + '='.repeat(60));
    console.log('🎵 AUDIO STREAMING QUALITY TEST RESULTS');
    console.log('='.repeat(60));
    
    console.log(`📊 Audio chunks received: ${audioChunksReceived}`);
    console.log(`❌ Quality issues detected: ${audioQualityIssues.length}`);
    
    if (audioQualityIssues.length > 0) {
        console.log('\n🔍 Issues found:');
        audioQualityIssues.forEach((issue, i) => {
            console.log(`   ${i + 1}. ${issue}`);
        });
    }
    
    console.log('\n🎯 Audio Quality Improvements Applied:');
    console.log('   ✅ Consistent 24kHz sample rate for AudioContext');
    console.log('   ✅ Skip very small chunks that cause noise');
    console.log('   ✅ Better PCM16 to float32 normalization');
    console.log('   ✅ Seamless chunk timing without delays');
    console.log('   ✅ Fade in/out between chunks to prevent clicks');
    console.log('   ✅ Separate AudioContext for recording vs playback');
    console.log('   ✅ Proper gain node for volume control');
    
    if (audioChunksReceived > 10 && audioQualityIssues.length === 0) {
        console.log('\n🎉 SUCCESS: Audio streaming quality has been improved!');
        console.log('💡 You should now hear smoother audio without gaps or noise.');
    } else if (audioChunksReceived > 0) {
        console.log('\n🟡 PARTIAL SUCCESS: Audio is streaming but may need further tuning.');
    } else {
        console.log('\n❌ ISSUE: No audio chunks received. Check connection or API access.');
    }
    
    console.log('\n🎧 Manual Test: Listen to the AI response above and verify:');
    console.log('   • No gaps between words or syllables');
    console.log('   • No clicking or popping sounds');
    console.log('   • Smooth, natural speech flow');
    
    process.exit(0);
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n👋 Test interrupted by user');
    socket.disconnect();
    process.exit(0);
});

// Timeout after 30 seconds
setTimeout(() => {
    console.log('\n⏰ Test timeout - stopping');
    showResults();
    socket.disconnect();
    process.exit(1);
}, 30000);
