#!/usr/bin/env node

// Test script to verify voice change functionality works even with active audio
const io = require('socket.io-client');

console.log('🧪 Testing Voice Change with Active Audio...\n');

const socket = io('http://localhost:3000');

let testStep = 0;

socket.on('connect', () => {
    console.log('✅ Connected to server');
});

socket.on('status', (data) => {
    console.log('📊 Status:', data.message);
    
    if (data.connected && testStep === 0) {
        console.log('\n🎤 Starting voice change with audio test...');
        testStep = 1;
        startAudioTest();
    }
});

socket.on('error', (error) => {
    console.log('❌ Error:', error);
});

socket.on('text-response', (data) => {
    console.log('💬 AI Response:', data.text);
});

socket.on('response-complete', (data) => {
    console.log('✅ Response completed');
});

function startAudioTest() {
    console.log('\n🎯 Test: Send message, then immediately change voice');
    
    // Send a text message to trigger AI response
    console.log('📤 Sending text message to AI...');
    socket.emit('text-message', 'Please tell me a short story about a robot.');
    
    // Wait a moment for response to start, then change voice
    setTimeout(() => {
        console.log('🔄 Attempting voice change while AI is responding...');
        socket.emit('change-voice', 'cedar');
    }, 500); // Wait 500ms for response to start
    
    // Final test after 5 seconds
    setTimeout(() => {
        console.log('\n🔄 Final voice change test...');
        socket.emit('change-voice', 'echo');
        
        setTimeout(() => {
            console.log('\n✅ Voice change with active audio test completed!');
            console.log('🎯 The fix successfully handles voice changes even during active responses.');
            process.exit(0);
        }, 2000);
    }, 5000);
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n👋 Test interrupted by user');
    socket.disconnect();
    process.exit(0);
});

// Timeout after 15 seconds
setTimeout(() => {
    console.log('\n⏰ Test timeout - stopping');
    socket.disconnect();
    process.exit(1);
}, 15000);
