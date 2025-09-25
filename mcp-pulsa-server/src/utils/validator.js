import Joi from 'joi';

export class PulsaValidator {
  constructor() {
    // Indonesian phone number patterns by provider
    this.providerPatterns = {
      telkomsel: [
        /^(\+62|62|0)8(11|12|13|21|22|23|51|52|53)\d{6,9}$/,
      ],
      xl: [
        /^(\+62|62|0)8(17|18|19|59|77|78)\d{6,9}$/,
      ],
      indosat: [
        /^(\+62|62|0)8(14|15|16|55|56|57|58)\d{6,9}$/,
      ],
      tri: [
        /^(\+62|62|0)8(95|96|97|98|99)\d{6,9}$/,
      ],
      smartfren: [
        /^(\+62|62|0)8(81|82|83|84|85|86|87|88)\d{6,9}$/,
      ]
    };

    // Phone number schema
    this.phoneSchema = Joi.string()
      .pattern(/^(\+62|62|0)8\d{8,13}$/)
      .required()
      .messages({
        'string.pattern.base': 'Phone number must be a valid Indonesian mobile number'
      });

    // Pulsa amount schema
    this.amountSchema = Joi.number()
      .integer()
      .min(5000)
      .max(1000000)
      .required()
      .messages({
        'number.min': 'Pulsa amount must be at least 5,000',
        'number.max': 'Pulsa amount cannot exceed 1,000,000'
      });
  }

  validatePhoneNumber(phoneNumber) {
    try {
      // Validate basic format
      const { error } = this.phoneSchema.validate(phoneNumber);
      if (error) {
        return {
          valid: false,
          error: error.details[0].message,
          phoneNumber: phoneNumber
        };
      }

      // Normalize phone number (remove +62 or 62 prefix, ensure starts with 0)
      const normalized = this.normalizePhoneNumber(phoneNumber);
      
      // Detect provider
      const provider = this.detectProvider(normalized);
      
      if (!provider) {
        return {
          valid: false,
          error: 'Unable to detect mobile provider from phone number',
          phoneNumber: phoneNumber,
          normalized: normalized
        };
      }

      return {
        valid: true,
        phoneNumber: phoneNumber,
        normalized: normalized,
        provider: provider,
        message: `Valid ${provider} number`
      };

    } catch (error) {
      return {
        valid: false,
        error: `Validation error: ${error.message}`,
        phoneNumber: phoneNumber
      };
    }
  }

  validatePulsaAmount(amount) {
    try {
      const { error } = this.amountSchema.validate(amount);
      if (error) {
        return {
          valid: false,
          error: error.details[0].message,
          amount: amount
        };
      }

      return {
        valid: true,
        amount: amount,
        message: `Valid pulsa amount: ${this.formatCurrency(amount)}`
      };

    } catch (error) {
      return {
        valid: false,
        error: `Amount validation error: ${error.message}`,
        amount: amount
      };
    }
  }

  normalizePhoneNumber(phoneNumber) {
    // Remove all non-digit characters except +
    let cleaned = phoneNumber.replace(/[^\d+]/g, '');
    
    // Handle different formats
    if (cleaned.startsWith('+62')) {
      cleaned = '0' + cleaned.substring(3);
    } else if (cleaned.startsWith('62')) {
      cleaned = '0' + cleaned.substring(2);
    }
    
    // Ensure it starts with 0
    if (!cleaned.startsWith('0')) {
      cleaned = '0' + cleaned;
    }
    
    return cleaned;
  }

  detectProvider(phoneNumber) {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    
    for (const [provider, patterns] of Object.entries(this.providerPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(normalized)) {
          return provider;
        }
      }
    }
    
    return null;
  }

  validatePulsaRequest(phoneNumber, amount, provider = null) {
    const phoneValidation = this.validatePhoneNumber(phoneNumber);
    const amountValidation = this.validatePulsaAmount(amount);
    
    if (!phoneValidation.valid) {
      return {
        valid: false,
        error: phoneValidation.error,
        field: 'phoneNumber'
      };
    }
    
    if (!amountValidation.valid) {
      return {
        valid: false,
        error: amountValidation.error,
        field: 'amount'
      };
    }
    
    // Check if provided provider matches detected provider
    if (provider && provider !== phoneValidation.provider) {
      return {
        valid: false,
        error: `Provider mismatch: phone number belongs to ${phoneValidation.provider}, but ${provider} was specified`,
        field: 'provider'
      };
    }
    
    return {
      valid: true,
      phoneNumber: phoneValidation.phoneNumber,
      normalizedPhone: phoneValidation.normalized,
      amount: amountValidation.amount,
      provider: phoneValidation.provider,
      message: `Valid pulsa request: ${this.formatCurrency(amount)} to ${phoneValidation.normalized} (${phoneValidation.provider})`
    };
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  }

  // Helper method to check if amount is a common denomination
  isCommonDenomination(amount) {
    const commonAmounts = [5000, 10000, 15000, 20000, 25000, 50000, 100000, 150000, 200000];
    return commonAmounts.includes(amount);
  }

  // Get suggested amounts for a provider
  getSuggestedAmounts(provider) {
    const suggestions = {
      telkomsel: [5000, 10000, 15000, 20000, 25000, 50000, 100000],
      xl: [5000, 10000, 25000, 50000, 100000],
      indosat: [5000, 10000, 25000, 50000, 100000],
      tri: [5000, 10000, 20000, 50000],
      smartfren: [5000, 10000, 25000, 50000]
    };
    
    return suggestions[provider] || suggestions.telkomsel;
  }
}
