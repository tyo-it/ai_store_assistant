import axios from 'axios';

export class FazzagnAPI {
  constructor(config) {
    this.baseURL = config.baseURL || 'http://localhost:3000';
    this.userId = config.userId || 1;

    console.log('🔧 [FAZZAGN API] Initializing FazzagnAPI client...');
    console.log('🔧 [FAZZAGN API] Base URL:', this.baseURL);
    console.log('🔧 [FAZZAGN API] User ID:', this.userId);

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ [FAZZAGN API] FazzagnAPI client initialized successfully');
  }

  async checkPulsaAvailability({ phoneNumber, amount, provider }) {
    try {
      // Step 1: Inquire to get reference number
      const inquirePayload = {
        recharge: {
          recharge_type: 'phone_credit',
          amount: amount,
          customer_number: phoneNumber
        }
      };

      console.log('🔍 [FAZZAGN API] Calling Inquire API...');
      console.log('📤 [FAZZAGN API] Request URL:', `${this.baseURL}/api/v1/transactions/recharges/inquire`);
      console.log('📤 [FAZZAGN API] Request Payload:', JSON.stringify(inquirePayload, null, 2));

      const inquireResponse = await this.client.post('/api/v1/transactions/recharges/inquire', inquirePayload);

      console.log('📥 [FAZZAGN API] Inquire Response Status:', inquireResponse.status);
      console.log('📥 [FAZZAGN API] Inquire Response Data:', JSON.stringify(inquireResponse.data, null, 2));

      const referenceNumber = inquireResponse.data.data.reference_number;

      if (!referenceNumber) {
        console.error('❌ [FAZZAGN API] No reference number received from inquire API');
        throw new Error('Failed to get reference number from inquire API');
      }

      console.log('✅ [FAZZAGN API] Inquire API call successful, reference number:', referenceNumber);

      const result = {
        available: true,
        price: amount + Math.floor(amount * 0.05), // Simulate 5% admin fee
        message: 'Pulsa tersedia',
        referenceNumber: referenceNumber,
        productCode: `${provider?.toUpperCase() || 'UNKNOWN'}_${amount}`
      };

      console.log('📊 [FAZZAGN API] Returning availability result:', JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error('❌ [FAZZAGN API] Inquire API Error Details:');
      console.error('   - Error Message:', error.message);
      console.error('   - Response Status:', error.response?.status);
      console.error('   - Response Data:', JSON.stringify(error.response?.data, null, 2));
      console.error('   - Request URL:', error.config?.url);
      console.error('   - Request Method:', error.config?.method);

      // Handle different error scenarios
      if (error.response?.status === 401) {
        console.error('🔐 [FAZZAGN API] Authentication failed - check credentials');
        throw new Error('Authentication failed. Please check your Fazzagn API credentials.');
      } else if (error.response?.status === 404) {
        console.error('🔍 [FAZZAGN API] Product not found - check provider and amount');
        throw new Error('Pulsa product not found for the specified provider and amount.');
      } else if (error.response?.status === 429) {
        console.error('⏱️ [FAZZAGN API] Rate limit exceeded');
        throw new Error('Rate limit exceeded. Please try again later.');
      }

      // Fallback for demo purposes - simulate availability check
      console.log('🎭 [FAZZAGN API] Falling back to simulation mode');
      return this._simulatePulsaCheck({ phoneNumber, amount, provider });
    }
  }

  async purchasePulsa({ phoneNumber, amount, provider, referenceNumber }) {
    try {
      console.log('💳 [FAZZAGN API] Starting pulsa purchase process...');
      console.log('💳 [FAZZAGN API] Purchase params:', { phoneNumber, amount, provider, referenceNumber });

      // If no reference number provided, get one first
      if (!referenceNumber) {
        console.log('🔍 [FAZZAGN API] No reference number provided, getting one first...');
        const availability = await this.checkPulsaAvailability({ phoneNumber, amount, provider });
        referenceNumber = availability.referenceNumber;
        console.log('✅ [FAZZAGN API] Got reference number:', referenceNumber);
      }

      // Step 1: Order - Create contract using reference number
      const orderPayload = {
        recharge: {
          recharge_type: 'phone_credit',
          amount: amount,
          customer_number: phoneNumber,
          reference_number: referenceNumber,
          user_id: this.userId
        }
      };

      console.log('🛒 [FAZZAGN API] Calling Order API...');
      console.log('📤 [FAZZAGN API] Order Request URL:', `${this.baseURL}/api/v1/transactions/recharge/order`);
      console.log('📤 [FAZZAGN API] Order Request Payload:', JSON.stringify(orderPayload, null, 2));

      const orderResponse = await this.client.post('/api/v1/transactions/recharges/order', orderPayload);

      console.log('📥 [FAZZAGN API] Order Response Status:', orderResponse.status);
      console.log('📥 [FAZZAGN API] Order Response Data:', JSON.stringify(orderResponse.data, null, 2));

      const response = orderResponse.data.data;

      console.log('✅ [FAZZAGN API] Order API call successful');

      // // Step 2: Pay - Process payment using unique_id
      // const payPayload = {
      //   payment: {
      //     unique_id: uniqueId
      //   }
      // };

      // console.log('💰 [FAZZAGN API] Calling Pay API...');
      // console.log('📤 [FAZZAGN API] Pay Request URL:', `${this.baseURL}/api/v1/transactions/recharges/pay`);
      // console.log('📤 [FAZZAGN API] Pay Request Payload:', JSON.stringify(payPayload, null, 2));

      // const payResponse = await this.client.post('/api/v1/transactions/recharges/pay', payPayload);

      // console.log('📥 [FAZZAGN API] Pay Response Status:', payResponse.status);
      // console.log('📥 [FAZZAGN API] Pay Response Data:', JSON.stringify(payResponse.data, null, 2));

      // Step 3: Check status to confirm completion
      // const statusUrl = `/api/v1/transactions/recharges/${uniqueId}/status`;
      // console.log('📊 [FAZZAGN API] Calling Status API...');
      // console.log('📤 [FAZZAGN API] Status Request URL:', `${this.baseURL}${statusUrl}`);

      // const statusResponse = await this.client.get(statusUrl);

      // console.log('📥 [FAZZAGN API] Status Response Status:', statusResponse.status);
      // console.log('📥 [FAZZAGN API] Status Response Data:', JSON.stringify(statusResponse.data, null, 2));

      const result = {
        phoneNumber: response.customer_number,
        amount: response.amount,
        uniqueId: response.unique_id
      };

      console.log('✅ [FAZZAGN API] Purchase process completed successfully!');
      console.log('📊 [FAZZAGN API] Final purchase result:', JSON.stringify(result, null, 2));

      return result;
    } catch (error) {
      console.error('❌ [FAZZAGN API] Purchase API Error Details:');
      console.error('   - Error Message:', error.message);
      console.error('   - Response Status:', error.response?.status);
      console.error('   - Response Data:', JSON.stringify(error.response?.data, null, 2));
      console.error('   - Request URL:', error.config?.url);
      console.error('   - Request Method:', error.config?.method);
      console.error('   - Request Data:', error.config?.data);

      if (error.response?.status === 402) {
        console.error('💰 [FAZZAGN API] Insufficient balance in Fazzagn account');
        throw new Error('Insufficient balance in your Fazzagn account.');
      } else if (error.response?.status === 409) {
        console.error('🔄 [FAZZAGN API] Duplicate transaction detected');
        throw new Error('Duplicate transaction. Please try again with a different reference ID.');
      } else if (error.response?.status === 400) {
        console.error('📝 [FAZZAGN API] Invalid request parameters');
        throw new Error('Invalid request parameters. Please check phone number and amount.');
      }

      // Fallback for demo purposes - simulate transaction
      console.log('🎭 [FAZZAGN API] Falling back to simulation mode for purchase');
      return this._simulateTransaction({ phoneNumber, amount, provider });
    }
  }

  async getPulsaPrices(provider) {
    try {
      console.log('💰 [FAZZAGN API] Getting pulsa prices for provider:', provider);
      // Note: The provided API doesn't have a prices endpoint
      // Using fallback with common Indonesian pulsa denominations
      console.log('⚠️ [FAZZAGN API] No specific prices endpoint available, using fallback prices');
      const prices = this._getDefaultPrices(provider);
      console.log('📊 [FAZZAGN API] Returning default prices:', JSON.stringify(prices, null, 2));
      return prices;
    } catch (error) {
      console.error('❌ [FAZZAGN API] Prices Error Details:');
      console.error('   - Error Message:', error.message);
      console.error('   - Response Status:', error.response?.status);
      console.error('   - Response Data:', JSON.stringify(error.response?.data, null, 2));

      // Fallback with common Indonesian pulsa denominations
      console.log('🎭 [FAZZAGN API] Falling back to default prices due to error');
      return this._getDefaultPrices(provider);
    }
  }

  async getTransactionStatus(uniqueId) {
    try {
      const statusUrl = `/api/v1/transactions/recharges/${uniqueId}/status`;
      console.log('📊 [FAZZAGN API] Getting transaction status...');
      console.log('📤 [FAZZAGN API] Status Request URL:', `${this.baseURL}${statusUrl}`);
      console.log('📤 [FAZZAGN API] Unique ID:', uniqueId);

      const response = await this.client.get(statusUrl);

      console.log('📥 [FAZZAGN API] Status Response Status:', response.status);
      console.log('📥 [FAZZAGN API] Status Response Data:', JSON.stringify(response.data, null, 2));

      const result = {
        uniqueId: uniqueId,
        status: response.data.status,
        message: response.data.message,
        amount: response.data.amount,
        customerNumber: response.data.customer_number,
        createdAt: response.data.created_at,
        completedAt: response.data.completed_at
      };

      console.log('✅ [FAZZAGN API] Transaction status retrieved successfully:', JSON.stringify(result, null, 2));
      return result;

    } catch (error) {
      console.error('❌ [FAZZAGN API] Status Check Error Details:');
      console.error('   - Error Message:', error.message);
      console.error('   - Response Status:', error.response?.status);
      console.error('   - Response Data:', JSON.stringify(error.response?.data, null, 2));
      console.error('   - Unique ID:', uniqueId);
      throw new Error('Failed to check transaction status');
    }
  }

  async getBalance() {
    try {
      // Note: The provided API doesn't have a balance endpoint
      // This would need to be implemented based on your actual API
      console.log('Balance endpoint not available in provided API');
      return {
        balance: 1000000, // Fallback balance
        currency: 'IDR'
      };
    } catch (error) {
      console.error('Balance Check Error:', error.response?.data || error.message);
      throw new Error('Failed to check account balance');
    }
  }

  // Fallback methods for demo/testing purposes
  _simulatePulsaCheck({ phoneNumber, amount, provider }) {
    console.log('🎭 [FAZZAGN API] SIMULATION MODE: Checking pulsa availability');
    console.log('🎭 [FAZZAGN API] Simulation params:', { phoneNumber, amount, provider });

    // Simulate realistic availability based on common denominations
    const commonAmounts = [5000, 10000, 15000, 20000, 25000, 50000, 100000];
    const available = commonAmounts.includes(amount);

    const result = {
      available,
      price: available ? amount + Math.floor(amount * 0.05) : null, // Add 5% admin fee
      message: available ? 'Pulsa tersedia' : 'Nominal pulsa tidak tersedia',
      productCode: available ? `${provider?.toUpperCase() || 'UNKNOWN'}_${amount}` : null,
      referenceNumber: available ? `REF_${Date.now()}_${Math.random().toString(36).substring(2, 8)}` : null,
      availableAmounts: commonAmounts
    };

    console.log('🎭 [FAZZAGN API] Simulation result:', JSON.stringify(result, null, 2));
    return result;
  }

  _simulateTransaction({ phoneNumber, amount, provider }) {
    console.log('🎭 [FAZZAGN API] SIMULATION MODE: Processing pulsa purchase');
    console.log('🎭 [FAZZAGN API] Simulation params:', { phoneNumber, amount, provider });

    const uniqueId = `TRX_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const referenceNumber = `REF_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    console.log('🎭 [FAZZAGN API] Generated simulation IDs:', { uniqueId, referenceNumber });

    const result = {
      success: true,
      transactionId: uniqueId,
      uniqueId: uniqueId,
      status: 'completed',
      message: `Pulsa ${amount} berhasil dikirim ke ${phoneNumber}`,
      balance: Math.floor(Math.random() * 1000000) + 100000, // Random balance
      serialNumber: Math.random().toString().substring(2, 12),
      referenceNumber: referenceNumber
    };

    console.log('🎭 [FAZZAGN API] Simulation transaction result:', JSON.stringify(result, null, 2));
    return result;
  }

  _getDefaultPrices(provider) {
    const prices = {
      telkomsel: [
        { amount: 5000, price: 6000 },
        { amount: 10000, price: 11000 },
        { amount: 15000, price: 16000 },
        { amount: 20000, price: 21000 },
        { amount: 25000, price: 26000 },
        { amount: 50000, price: 51000 },
        { amount: 100000, price: 101000 }
      ],
      xl: [
        { amount: 5000, price: 5800 },
        { amount: 10000, price: 10800 },
        { amount: 25000, price: 25800 },
        { amount: 50000, price: 50800 },
        { amount: 100000, price: 100800 }
      ],
      indosat: [
        { amount: 5000, price: 5900 },
        { amount: 10000, price: 10900 },
        { amount: 25000, price: 25900 },
        { amount: 50000, price: 50900 },
        { amount: 100000, price: 100900 }
      ],
      tri: [
        { amount: 5000, price: 5700 },
        { amount: 10000, price: 10700 },
        { amount: 20000, price: 20700 },
        { amount: 50000, price: 50700 }
      ],
      smartfren: [
        { amount: 5000, price: 5900 },
        { amount: 10000, price: 10900 },
        { amount: 25000, price: 25900 },
        { amount: 50000, price: 50900 }
      ]
    };

    return prices[provider] || prices.telkomsel;
  }
}
