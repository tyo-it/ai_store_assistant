// Test script to verify improved pulsa intent recognition
const PulsaService = require('./speech-to-speech-assistant/src/services/PulsaService');

async function testPulsaIntentRecognition() {
    console.log('🧪 Testing Improved Pulsa Intent Recognition...');
    
    const pulsaService = new PulsaService();
    
    // Test cases with various Indonesian speech patterns
    const testCases = [
        "tolong isi ulang pulsa 25 ribu ke nomor 085621234243",
        "beli pulsa 50 ribu untuk nomor 081234567890", 
        "saya ingin isi pulsa 10 ribu ke 08123456789",
        "mohon topup pulsa 100 ribu nomor 085612345678",
        "belikan pulsa lima puluh ribu untuk 08567890123",
        "isi ulang pulsa 25rb ke nomor 081234567890",
        "pulsa 30 ribu ke 085621234243",
        "tolong belikan kredit 20 ribu ke 08123456789"
    ];
    
    console.log('\n📋 Testing each case:\n');
    
    testCases.forEach((testCase, index) => {
        console.log(`${index + 1}. "${testCase}"`);
        
        // Test intent recognition
        const isPulsaRelated = pulsaService.isPulsaRelated(testCase);
        console.log(`   🎯 Is pulsa related: ${isPulsaRelated ? '✅ YES' : '❌ NO'}`);
        
        if (isPulsaRelated) {
            // Test extraction
            const extracted = pulsaService.extractPulsaInfo(testCase);
            console.log(`   📱 Phone: ${extracted.phoneNumber || '❌ Not found'}`);
            console.log(`   💰 Amount: ${extracted.amount ? `Rp ${extracted.amount.toLocaleString('id-ID')}` : '❌ Not found'}`);
            
            if (extracted.phoneNumber && extracted.amount) {
                console.log(`   ✅ SUCCESSFULLY EXTRACTED ALL INFO`);
            } else {
                console.log(`   ⚠️ PARTIAL EXTRACTION`);
            }
        }
        
        console.log('');
    });
    
    console.log('🎉 Pulsa Intent Recognition test completed!');
}

// Run the test
testPulsaIntentRecognition().catch(console.error);
