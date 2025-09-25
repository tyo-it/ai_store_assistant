#!/usr/bin/env node

import { PulsaValidator } from '../src/utils/validator.js';
import { SpeechProcessor } from '../src/services/speechProcessor.js';
import { FazzagnAPI } from '../src/services/fazzagnAPI.js';

console.log('🧪 Running MCP Server Unit Tests\n');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ ${message}`);
    testsPassed++;
  } else {
    console.log(`❌ ${message}`);
    testsFailed++;
  }
}

// Test Phone Number Validation
console.log('📱 Testing Phone Number Validation...');
const validator = new PulsaValidator();

// Test valid numbers
assert(validator.validatePhoneNumber('08123456789').valid, 'Telkomsel number validation');
assert(validator.validatePhoneNumber('08787654321').valid, 'XL number validation');
assert(validator.validatePhoneNumber('08149876543').valid, 'Indosat number validation');
assert(validator.validatePhoneNumber('08951234567').valid, 'Tri number validation');
assert(validator.validatePhoneNumber('08819876543').valid, 'Smartfren number validation');

// Test invalid numbers
assert(!validator.validatePhoneNumber('021234567').valid, 'Landline rejection');
assert(!validator.validatePhoneNumber('invalid').valid, 'Invalid format rejection');

// Test provider detection
assert(validator.validatePhoneNumber('08123456789').provider === 'telkomsel', 'Telkomsel provider detection');
assert(validator.validatePhoneNumber('08787654321').provider === 'xl', 'XL provider detection');

console.log('\n💰 Testing Pulsa Amount Validation...');

// Test valid amounts
[5000, 10000, 25000, 50000, 100000].forEach(amount => {
  assert(validator.validatePulsaAmount(amount).valid, `Valid amount ${amount}`);
});

// Test invalid amounts
assert(!validator.validatePulsaAmount(1000).valid, 'Below minimum amount rejection');
assert(!validator.validatePulsaAmount(2000000).valid, 'Above maximum amount rejection');

console.log('\n🎤 Testing Speech Processing...');
const speechProcessor = new SpeechProcessor();

// Test valid commands
const validCommand = speechProcessor.parsePulsaCommand('Topup pulsa lima puluh ribu nomor 08111222333');
assert(validCommand.valid, 'Valid speech command parsing');
assert(validCommand.amount === 50000, 'Correct amount parsing from speech');
assert(validCommand.phoneNumber === '08111222333', 'Correct phone number extraction');

const validCommand2 = speechProcessor.parsePulsaCommand('Mau beli pulsa seratus ribu untuk 08149876543');
assert(validCommand2.valid, 'Another valid speech command parsing');
assert(validCommand2.amount === 100000, 'Correct amount parsing (seratus ribu)');

// Test invalid commands
const invalidCommand = speechProcessor.parsePulsaCommand('Hello world');
assert(!invalidCommand.valid, 'Invalid command rejection');

console.log('\n🔗 Testing Fazzagn API (Demo Mode)...');
const fazzagnAPI = new FazzagnAPI({
  apiKey: 'test_key',
  baseURL: 'https://api.test.com',
  username: 'test_user',
  pin: '1234'
});

// Test availability check
try {
  const availability = await fazzagnAPI.checkPulsaAvailability({
    phoneNumber: '08123456789',
    amount: 10000,
    provider: 'telkomsel'
  });
  assert(availability.available === true, 'Availability check returns true in demo mode');
  assert(typeof availability.price === 'number', 'Price is returned as number');
} catch (error) {
  assert(false, `Availability check failed: ${error.message}`);
}

// Test purchase simulation
try {
  const purchase = await fazzagnAPI.purchasePulsa({
    phoneNumber: '08123456789',
    amount: 10000,
    provider: 'telkomsel'
  });
  assert(purchase.success === true, 'Purchase simulation returns success');
  assert(typeof purchase.transactionId === 'string', 'Transaction ID is returned');
} catch (error) {
  assert(false, `Purchase simulation failed: ${error.message}`);
}

// Test price list
try {
  const prices = await fazzagnAPI.getPulsaPrices('telkomsel');
  assert(Array.isArray(prices), 'Price list returns array');
  assert(prices.length > 0, 'Price list contains items');
  assert(prices[0].hasOwnProperty('amount'), 'Price items have amount property');
  assert(prices[0].hasOwnProperty('price'), 'Price items have price property');
} catch (error) {
  assert(false, `Price list failed: ${error.message}`);
}

console.log('\n🔄 Testing Complete Workflow...');

// Test complete workflow
try {
  const speechCommand = 'Topup pulsa lima puluh ribu nomor 08111222333';
  
  // Step 1: Parse speech
  const speechResult = speechProcessor.parsePulsaCommand(speechCommand);
  assert(speechResult.valid, 'Workflow Step 1: Speech parsing');
  
  // Step 2: Validate phone
  const phoneValidation = validator.validatePhoneNumber(speechResult.phoneNumber);
  assert(phoneValidation.valid, 'Workflow Step 2: Phone validation');
  
  // Step 3: Validate amount
  const amountValidation = validator.validatePulsaAmount(speechResult.amount);
  assert(amountValidation.valid, 'Workflow Step 3: Amount validation');
  
  // Step 4: Check availability
  const availability = await fazzagnAPI.checkPulsaAvailability({
    phoneNumber: speechResult.phoneNumber,
    amount: speechResult.amount,
    provider: phoneValidation.provider
  });
  assert(availability.available, 'Workflow Step 4: Availability check');
  
  // Step 5: Purchase
  const purchase = await fazzagnAPI.purchasePulsa({
    phoneNumber: speechResult.phoneNumber,
    amount: speechResult.amount,
    provider: phoneValidation.provider
  });
  assert(purchase.success, 'Workflow Step 5: Purchase execution');
  
  console.log('✅ Complete workflow test passed');
} catch (error) {
  assert(false, `Complete workflow failed: ${error.message}`);
}

console.log('\n📊 Test Results:');
console.log(`✅ Tests Passed: ${testsPassed}`);
console.log(`❌ Tests Failed: ${testsFailed}`);
console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);

if (testsFailed === 0) {
  console.log('\n🎉 All tests passed! Your MCP server is ready to use.');
} else {
  console.log('\n⚠️  Some tests failed. Please review the issues above.');
  process.exit(1);
}
