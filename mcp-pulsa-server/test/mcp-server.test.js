import { jest } from '@jest/globals';
import { PulsaValidator } from '../src/utils/validator.js';
import { SpeechProcessor } from '../src/services/speechProcessor.js';
import { FazzagnAPI } from '../src/services/fazzagnAPI.js';

describe('Pulsa Validator', () => {
  let validator;

  beforeEach(() => {
    validator = new PulsaValidator();
  });

  describe('Phone Number Validation', () => {
    test('should validate Telkomsel numbers', () => {
      const result = validator.validatePhoneNumber('08123456789');
      expect(result.valid).toBe(true);
      expect(result.provider).toBe('telkomsel');
    });

    test('should validate XL numbers', () => {
      const result = validator.validatePhoneNumber('08787654321');
      expect(result.valid).toBe(true);
      expect(result.provider).toBe('xl');
    });

    test('should reject invalid numbers', () => {
      const result = validator.validatePhoneNumber('021234567');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('valid Indonesian mobile number');
    });

    test('should reject non-numeric input', () => {
      const result = validator.validatePhoneNumber('invalid');
      expect(result.valid).toBe(false);
    });
  });

  describe('Pulsa Amount Validation', () => {
    test('should accept valid amounts', () => {
      [5000, 10000, 25000, 50000, 100000].forEach(amount => {
        const result = validator.validatePulsaAmount(amount);
        expect(result.valid).toBe(true);
      });
    });

    test('should reject amounts below minimum', () => {
      const result = validator.validatePulsaAmount(1000);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 5,000');
    });

    test('should reject amounts above maximum', () => {
      const result = validator.validatePulsaAmount(2000000);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot exceed 1,000,000');
    });
  });
});

describe('Speech Processor', () => {
  let speechProcessor;

  beforeEach(() => {
    speechProcessor = new SpeechProcessor();
  });

  describe('Command Parsing', () => {
    test('should parse written numbers correctly', () => {
      const result = speechProcessor.parsePulsaCommand('Topup pulsa lima puluh ribu nomor 08111222333');
      expect(result.valid).toBe(true);
      expect(result.amount).toBe(50000);
      expect(result.phoneNumber).toBe('08111222333');
    });

    test('should parse numeric amounts', () => {
      const result = speechProcessor.parsePulsaCommand('Mau beli pulsa seratus ribu untuk 08149876543');
      expect(result.valid).toBe(true);
      expect(result.amount).toBe(100000);
      expect(result.phoneNumber).toBe('08149876543');
    });

    test('should reject non-pulsa commands', () => {
      const result = speechProcessor.parsePulsaCommand('Hello world');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('No pulsa purchase intent detected');
    });
  });

  describe('Response Generation', () => {
    test('should generate appropriate response', () => {
      const parsedCommand = {
        phoneNumber: '08123456789',
        amount: 10000,
        confidence: 95
      };
      const response = speechProcessor.generateResponse(parsedCommand);
      expect(response).toContain('08123456789');
      expect(response).toContain('10000');
    });
  });
});

describe('Fazzagn API', () => {
  let fazzagnAPI;
  const mockConfig = {
    apiKey: 'test_key',
    baseURL: 'https://api.test.com',
    username: 'test_user',
    pin: '1234'
  };

  beforeEach(() => {
    fazzagnAPI = new FazzagnAPI(mockConfig);
  });

  describe('Configuration', () => {
    test('should initialize with provided config', () => {
      expect(fazzagnAPI.config.apiKey).toBe('test_key');
      expect(fazzagnAPI.config.username).toBe('test_user');
    });
  });

  describe('Demo Mode Operations', () => {
    test('should check availability in demo mode', async () => {
      const result = await fazzagnAPI.checkPulsaAvailability({
        phoneNumber: '08123456789',
        amount: 10000,
        provider: 'telkomsel'
      });
      
      expect(result.available).toBe(true);
      expect(result.price).toBeDefined();
    });

    test('should simulate purchase in demo mode', async () => {
      const result = await fazzagnAPI.purchasePulsa({
        phoneNumber: '08123456789',
        amount: 10000,
        provider: 'telkomsel'
      });
      
      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
    });

    test('should return price list in demo mode', async () => {
      const prices = await fazzagnAPI.getPulsaPrices('telkomsel');
      
      expect(Array.isArray(prices)).toBe(true);
      expect(prices.length).toBeGreaterThan(0);
      expect(prices[0]).toHaveProperty('amount');
      expect(prices[0]).toHaveProperty('price');
    });
  });
});

describe('Integration Tests', () => {
  let validator, speechProcessor, fazzagnAPI;

  beforeEach(() => {
    validator = new PulsaValidator();
    speechProcessor = new SpeechProcessor();
    fazzagnAPI = new FazzagnAPI({
      apiKey: 'test_key',
      baseURL: 'https://api.test.com',
      username: 'test_user',
      pin: '1234'
    });
  });

  test('should process complete workflow', async () => {
    const speechCommand = 'Topup pulsa lima puluh ribu nomor 08111222333';
    
    // Step 1: Parse speech
    const speechResult = speechProcessor.parsePulsaCommand(speechCommand);
    expect(speechResult.valid).toBe(true);
    
    // Step 2: Validate phone
    const phoneValidation = validator.validatePhoneNumber(speechResult.phoneNumber);
    expect(phoneValidation.valid).toBe(true);
    
    // Step 3: Validate amount
    const amountValidation = validator.validatePulsaAmount(speechResult.amount);
    expect(amountValidation.valid).toBe(true);
    
    // Step 4: Check availability
    const availability = await fazzagnAPI.checkPulsaAvailability({
      phoneNumber: speechResult.phoneNumber,
      amount: speechResult.amount,
      provider: phoneValidation.provider
    });
    expect(availability.available).toBe(true);
    
    // Step 5: Purchase
    const purchase = await fazzagnAPI.purchasePulsa({
      phoneNumber: speechResult.phoneNumber,
      amount: speechResult.amount,
      provider: phoneValidation.provider
    });
    expect(purchase.success).toBe(true);
  });
});
