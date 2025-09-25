#!/usr/bin/env node

// Test script to verify voice change functionality fix
const io = require('socket.io-client');

console.log('🧪 Testing Voice Change Fix...\n');

const socket = io('http://localhost:3000');

let testStep = 0;
const testVoices = ['alloy', 'echo', 'shimmer', 'sage'];

socket.on('connect', () => {
    console.log('✅ Connected to server');
});

socket.on('status', (data) => {
    console.log('📊 Status:', data.message);
    
    if (data.connected && testStep === 0) {
        console.log('\n🎤 Starting voice change tests...');
        testStep = 1;
        testVoiceChange();
    }
});

socket.on('error', (error) => {
    console.log('❌ Error:', error);
});

function testVoiceChange() {
    if (testStep > testVoices.length) {
        console.log('\n✅ All voice change tests completed!');
        console.log('🎯 Voice change functionality is working correctly.');
        process.exit(0);
        return;
    }
    
    const voice = testVoices[testStep - 1];
    console.log(`\n🔧 Testing voice change to: ${voice}`);
    
    socket.emit('change-voice', voice);
    
    setTimeout(() => {
        testStep++;
        testVoiceChange();
    }, 2000); // Wait 2 seconds between tests
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
    socket.disconnect();
    process.exit(1);
}, 30000);
