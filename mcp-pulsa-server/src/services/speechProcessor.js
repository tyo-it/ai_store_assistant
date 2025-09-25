class SpeechProcessor {
  constructor() {
    // Indonesian language patterns for pulsa purchase commands
    this.patterns = {
      // Phone number extraction patterns
      phoneNumber: [
        /(?:nomor|nomer|hp|handphone|telepon)\s*(?:nya)?\s*(?:adalah|yaitu)?\s*((?:\+62|62|0)?8\d{8,12})/gi,
        /(?:ke|untuk)\s*(?:nomor|nomer)?\s*((?:\+62|62|0)?8\d{8,12})/gi,
        /(?:ke|untuk)\s*((?:\+62|62|0)?8\d{8,12})/gi,
        /((?:\+62|62|0)?8\d{8,12})/gi,
      ],

      // Amount extraction patterns - enhanced for better recognition
      amount: [
        // Match amount before "ribu" (e.g., "25 ribu", "lima puluh ribu")
        /(\d{1,3})\s*ribu/gi,
        /(\d{1,3}(?:\.\d{3})*)\s*(?:ribu|rb|k)/gi,
        // Match amount with currency indicators
        /(?:pulsa|kredit|saldo)\s*(?:sebesar|senilai|nominal)?\s*(?:rp\.?\s*)?(\d{1,3}(?:\.\d{3})*(?:\.000)?)/gi,
        /(?:isi|top\s*up|topup|ulang)\s*(?:pulsa)?\s*(?:sebesar|senilai|nominal)?\s*(?:rp\.?\s*)?(\d{1,3}(?:\.\d{3})*(?:\.000)?)/gi,
        /(?:beli|beliakan|purchase)\s*(?:pulsa)?\s*(?:sebesar|senilai|nominal)?\s*(?:rp\.?\s*)?(\d{1,3}(?:\.\d{3})*(?:\.000)?)/gi,
        // Match standalone numbers that could be amounts
        /(?:^|\s)(\d{1,3}(?:\.\d{3})*(?:\.000)?)(?:\s|$)/gi,
      ],

      // Intent detection patterns - enhanced for variations
      intent: [
        /(?:beli|belikan|purchase|topup|top\s*up|isi(?:\s*ulang)?|lanjut)\s*(?:pulsa|kredit|saldo)/gi,
        /(?:mau|ingin|minta|pengen)\s*(?:beli|isi|topup|top\s*up|lanjut)\s*(?:pulsa|kredit)/gi,
        /(?:tolong|please|mohon)\s*(?:belikan|isi(?:\s*ulang)?|topup|top\s*up|lanjut)\s*(?:pulsa|kredit)/gi,
        /(?:pulsa|kredit|saldo).*(?:beli|isi|topup|top\s*up|lanjut)/gi,
      ],

      // Provider detection patterns (optional, can be inferred from phone number)
      provider: [
        /(?:telkomsel|simpati|kartu as|as)/gi,
        /(?:xl|extra large)/gi,
        /(?:indosat|ooredoo|im3|mentari)/gi,
        /(?:three|tri|3)/gi,
        /(?:smartfren|smart)/gi,
      ]
    };

    // Number word to digit mapping for Indonesian
    this.numberWords = {
      // Basic amounts
      'lima ribu': 5000,
      'sepuluh ribu': 10000,
      'lima belas ribu': 15000,
      'dua puluh ribu': 20000,
      'dua lima ribu': 25000,
      'tiga puluh ribu': 30000,
      'lima puluh ribu': 50000,
      'seratus ribu': 100000,
      'dua ratus ribu': 200000,

      // Short forms
      '5 ribu': 5000,
      '10 ribu': 10000,
      '15 ribu': 15000,
      '20 ribu': 20000,
      '25 ribu': 25000,
      '30 ribu': 30000,
      '50 ribu': 50000,
      '100 ribu': 100000,

      // Abbreviated forms
      '5rb': 5000,
      '10rb': 10000,
      '15rb': 15000,
      '20rb': 20000,
      '25rb': 25000,
      '30rb': 30000,
      '50rb': 50000,
      '100rb': 100000,
    };
  }

  parsePulsaCommand(speechText) {
    try {
      const text = speechText.toLowerCase().trim();

      // Check if this is a pulsa purchase intent
      const hasIntent = this.detectPulsaIntent(text);
      if (!hasIntent) {
        return {
          valid: false,
          error: 'No pulsa purchase intent detected in speech'
        };
      }

      // Extract phone number
      const phoneNumber = this.extractPhoneNumber(text);
      if (!phoneNumber) {
        return {
          valid: false,
          error: 'No valid phone number found in speech'
        };
      }

      // Extract amount
      const amount = this.extractAmount(text);
      if (!amount) {
        return {
          valid: false,
          error: 'No valid pulsa amount found in speech'
        };
      }

      // Extract provider (optional)
      const provider = this.extractProvider(text);

      return {
        valid: true,
        phoneNumber: phoneNumber,
        amount: amount,
        provider: provider,
        originalText: speechText,
        confidence: this.calculateConfidence(text, phoneNumber, amount)
      };

    } catch (error) {
      return {
        valid: false,
        error: `Speech processing error: ${error.message}`
      };
    }
  }

  detectPulsaIntent(text) {
    // return true; // Always true for broader matching
    console.log('🔍 [SPEECH PROCESSOR] Detecting pulsa intent for:', text);

    const hasIntent = this.patterns.intent.some(pattern => {
      const result = pattern.test(text);
      console.log(`   Pattern: ${pattern} -> ${result ? '✅ MATCH' : '❌ NO MATCH'}`);
      pattern.lastIndex = 0; // Reset regex global flag to prevent state persistence
      return result;
    });

    console.log('🎯 [SPEECH PROCESSOR] Overall intent detection:', hasIntent ? '✅ DETECTED' : '❌ NOT DETECTED');
    return hasIntent;
  }

  extractPhoneNumber(text) {
    console.log('📞 [SPEECH PROCESSOR] Extracting phone number from:', text);

    for (const pattern of this.patterns.phoneNumber) {
      const match = pattern.exec(text);
      if (match) {
        let phoneNumber = match[1];
        console.log(`   Phone pattern match: ${pattern} found "${phoneNumber}"`);

        // Clean and normalize the phone number
        phoneNumber = phoneNumber.replace(/\s+/g, '');

        // Validate basic format
        if (/^((\+62|62|0)?8\d{8,14})$/.test(phoneNumber)) {
          console.log(`   ✅ Valid phone number: ${phoneNumber}`);
          return phoneNumber;
        } else {
          console.log(`   ❌ Invalid phone format: ${phoneNumber}`);
        }
      }
      pattern.lastIndex = 0; // Reset regex global flag
    }

    console.log('   ❌ No phone number found');
    return null;
  }

  extractAmount(text) {
    console.log('💰 [SPEECH PROCESSOR] Extracting amount from:', text);

    // First check for number words (exact matches)
    for (const [word, value] of Object.entries(this.numberWords)) {
      if (text.includes(word)) {
        console.log(`   Number word match: "${word}" -> ${value}`);
        return value;
      }
    }

    // Special handling for "X ribu" pattern (e.g., "25 ribu")
    const ribusPattern = /(\d{1,3})\s*ribu/gi;
    const ribusMatch = ribusPattern.exec(text);
    ribusPattern.lastIndex = 0; // Reset regex global flag
    if (ribusMatch) {
      const number = parseInt(ribusMatch[1]);
      if (number > 0 && number <= 999) {
        const amount = number * 1000;
        console.log(`   Ribu pattern match: ${number} ribu -> ${amount}`);
        return amount;
      }
    }

    // Then check for numeric patterns
    for (const pattern of this.patterns.amount) {
      const match = pattern.exec(text);
      if (match) {
        let amountStr = match[1];
        console.log(`   Amount pattern match: ${pattern} found "${amountStr}"`);

        // Handle different number formats
        if (amountStr.includes('.')) {
          // Handle format like "10.000" or "50.000"
          amountStr = amountStr.replace(/\./g, '');
        }

        const amount = parseInt(amountStr);

        // Validate reasonable pulsa amounts
        if (amount >= 1000 && amount <= 1000000) {
          console.log(`   ✅ Valid amount: ${amount}`);
          return amount;
        } else if (amount < 1000 && amount > 0) {
          // If amount is less than 1000, assume it's in thousands
          const adjustedAmount = amount * 1000;
          console.log(`   ✅ Adjusted amount: ${amount} -> ${adjustedAmount}`);
          return adjustedAmount;
        } else {
          console.log(`   ❌ Invalid amount: ${amount} (outside valid range)`);
        }
      }
      pattern.lastIndex = 0; // Reset regex global flag
    }

    console.log('   ❌ No amount found');
    return null;
  }

  extractProvider(text) {
    const providerMap = {
      'telkomsel': ['telkomsel', 'simpati', 'kartu as', 'as'],
      'xl': ['xl', 'extra large'],
      'indosat': ['indosat', 'ooredoo', 'im3', 'mentari'],
      'tri': ['three', 'tri', '3'],
      'smartfren': ['smartfren', 'smart']
    };

    for (const [provider, keywords] of Object.entries(providerMap)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          return provider;
        }
      }
    }

    return null;
  }

  calculateConfidence(text, phoneNumber, amount) {
    let confidence = 0;

    // Base confidence for finding required elements
    if (phoneNumber) confidence += 40;
    if (amount) confidence += 40;

    // Bonus points for clear intent words
    if (/\b(beli|topup|isi|ulang)\b/.test(text)) confidence += 10;
    if (/\b(pulsa|kredit|saldo)\b/.test(text)) confidence += 10;

    // Extra points for polite forms
    if (/\b(tolong|mohon|please)\b/.test(text)) confidence += 5;

    // Bonus for specific number patterns
    if (/\d+\s*ribu/.test(text)) confidence += 5;

    return Math.min(confidence, 100);
  }

  // Helper method to convert speech to structured command for the assistant
  speechToCommand(speechText) {
    const parsed = this.parsePulsaCommand(speechText);

    if (!parsed.valid) {
      return {
        type: 'error',
        message: parsed.error,
        suggestions: [
          'Try saying: "Beli pulsa 10 ribu untuk nomor 08123456789"',
          'Or: "Isi pulsa 25000 ke 08567890123"',
          'Or: "Topup pulsa lima puluh ribu nomor 08111222333"'
        ]
      };
    }

    return {
      type: 'pulsa_purchase_request',
      phoneNumber: parsed.phoneNumber,
      amount: parsed.amount,
      provider: parsed.provider,
      confidence: parsed.confidence,
      originalSpeech: speechText,
      message: `Understood: Buy pulsa ${this.formatAmount(parsed.amount)} for ${parsed.phoneNumber}${parsed.provider ? ` (${parsed.provider})` : ''}`
    };
  }

  formatAmount(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  }

  // Generate natural language response
  generateResponse(result) {
    if (!result.valid) {
      return `Maaf, saya tidak bisa memahami permintaan pulsa Anda. ${result.error}. Coba katakan "Beli pulsa 10 ribu untuk nomor 08123456789".`;
    }

    const formattedAmount = this.formatAmount(result.amount);
    let response = `Baik, saya akan memproses pembelian pulsa ${formattedAmount} untuk nomor ${result.phoneNumber}`;

    if (result.provider) {
      response += ` (${result.provider})`;
    }

    response += '. Apakah Anda yakin ingin melanjutkan?';

    return response;
  }
}

export { SpeechProcessor };
