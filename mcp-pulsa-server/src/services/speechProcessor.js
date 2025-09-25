export class SpeechProcessor {
  constructor() {
    // Indonesian language patterns for pulsa purchase commands
    this.patterns = {
      // Phone number extraction patterns
      phoneNumber: [
        /(?:nomor|nomer|hp|handphone|telepon)\s*(?:nya)?\s*(?:adalah|yaitu)?\s*((?:\+62|62|0)?8\d{8,12})/gi,
        /(?:ke|untuk)\s*(?:nomor|nomer)?\s*((?:\+62|62|0)?8\d{8,12})/gi,
        /((?:\+62|62|0)?8\d{8,12})/gi,
      ],
      
      // Amount extraction patterns
      amount: [
        /(?:pulsa|kredit|saldo)\s*(?:sebesar|senilai)?\s*(?:rp\.?\s*)?(\d{1,3}(?:\.\d{3})*(?:\.000)?|lima ribu|sepuluh ribu|dua puluh ribu|lima puluh ribu|seratus ribu)/gi,
        /(?:isi|top\s*up|topup)\s*(?:pulsa)?\s*(?:sebesar|senilai)?\s*(?:rp\.?\s*)?(\d{1,3}(?:\.\d{3})*(?:\.000)?|lima ribu|sepuluh ribu|dua puluh ribu|lima puluh ribu|seratus ribu)/gi,
        /(?:beli|beliakan|purchase)\s*(?:pulsa)?\s*(?:sebesar|senilai)?\s*(?:rp\.?\s*)?(\d{1,3}(?:\.\d{3})*(?:\.000)?|lima ribu|sepuluh ribu|dua puluh ribu|lima puluh ribu|seratus ribu)/gi,
      ],
      
      // Intent detection patterns
      intent: [
        /(?:beli|beliakan|purchase|topup|top\s*up|isi)\s*(?:pulsa|kredit|saldo)/gi,
        /(?:mau|ingin|minta)\s*(?:beli|isi|topup|top\s*up)\s*(?:pulsa|kredit)/gi,
        /(?:tolong|please)\s*(?:belikan|isi|topup|top\s*up)\s*(?:pulsa|kredit)/gi,
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
      'lima ribu': 5000,
      'sepuluh ribu': 10000,
      'lima belas ribu': 15000,
      'dua puluh ribu': 20000,
      'dua lima ribu': 25000,
      'lima puluh ribu': 50000,
      'seratus ribu': 100000,
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
    return this.patterns.intent.some(pattern => pattern.test(text));
  }

  extractPhoneNumber(text) {
    for (const pattern of this.patterns.phoneNumber) {
      const match = pattern.exec(text);
      if (match) {
        let phoneNumber = match[1];
        // Clean and normalize the phone number
        phoneNumber = phoneNumber.replace(/\s+/g, '');
        
        // Validate basic format
        if (/^((\+62|62|0)?8\d{8,12})$/.test(phoneNumber)) {
          return phoneNumber;
        }
      }
      pattern.lastIndex = 0; // Reset regex global flag
    }
    return null;
  }

  extractAmount(text) {
    // First check for number words
    for (const [word, value] of Object.entries(this.numberWords)) {
      if (text.includes(word)) {
        return value;
      }
    }

    // Then check for numeric patterns
    for (const pattern of this.patterns.amount) {
      const match = pattern.exec(text);
      if (match) {
        let amountStr = match[1];
        
        // Handle different number formats
        if (amountStr.includes('.')) {
          // Handle format like "10.000" or "50.000"
          amountStr = amountStr.replace(/\./g, '');
        }
        
        const amount = parseInt(amountStr);
        
        // Validate reasonable pulsa amounts
        if (amount >= 1000 && amount <= 1000000) {
          // If amount is less than 1000, assume it's in thousands
          if (amount < 1000) {
            return amount * 1000;
          }
          return amount;
        }
      }
      pattern.lastIndex = 0; // Reset regex global flag
    }
    
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
    if (/\b(beli|topup|isi)\b/.test(text)) confidence += 10;
    if (/\b(pulsa|kredit)\b/.test(text)) confidence += 10;
    
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
