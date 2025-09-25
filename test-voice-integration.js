// Test script to verify voice assistant MCP integration
const RealtimeVoiceAssistant = require('./speech-to-speech-assistant/src/assistant/RealtimeVoiceAssistant');
const FallbackVoiceAssistant = require('./speech-to-speech-assistant/src/assistant/FallbackVoiceAssistant');

async function testVoiceAssistantIntegration() {
    console.log('🧪 Testing Voice Assistant MCP Integration...');
    
    try {
        // Test 1: Fallback Assistant (easier to test)
        console.log('\n1️⃣ Testing Fallback Voice Assistant...');
        const fallbackAssistant = new FallbackVoiceAssistant();
        
        // Wait a bit for pulsa service to initialize
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (fallbackAssistant.pulsaService.isConnected) {
            console.log('✅ Fallback Assistant connected to MCP server');
            
            // Test pulsa detection
            const testMessage = "Saya ingin beli pulsa 50 ribu untuk nomor 081234567890";
            console.log('🎤 Testing message:', testMessage);
            
            const isPulsaRelated = fallbackAssistant.pulsaService.isPulsaRelated(testMessage);
            console.log('📋 Is pulsa related:', isPulsaRelated);
            
            if (isPulsaRelated) {
                const extracted = fallbackAssistant.pulsaService.extractPulsaInfo(testMessage);
                console.log('📱 Extracted info:', extracted);
            }
            
        } else {
            console.log('❌ Fallback Assistant not connected to MCP server');
        }
        
        // Test 2: Realtime Assistant (if OpenAI key is available)
        if (process.env.OPENAI_API_KEY) {
            console.log('\n2️⃣ Testing Realtime Voice Assistant...');
            const realtimeAssistant = new RealtimeVoiceAssistant();
            
            // Wait a bit for initialization
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            if (realtimeAssistant.pulsaService.isConnected) {
                console.log('✅ Realtime Assistant connected to MCP server');
                console.log('🛠️ Session config tools:', realtimeAssistant.sessionConfig.tools.map(t => t.name));
            } else {
                console.log('❌ Realtime Assistant not connected to MCP server');
            }
        } else {
            console.log('\n⚠️ Skipping Realtime Assistant test - no OPENAI_API_KEY');
        }
        
        console.log('\n🎉 Voice Assistant Integration test completed!');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('💡 Make sure the MCP server is running:');
        console.error('   cd mcp-pulsa-server && MCP_TRANSPORT_MODE=http MCP_PORT=3001 npm start');
    }
}

// Run the test
testVoiceAssistantIntegration();
