// Simple Pulsa Service for older Node.js versions
// This bypasses the MCP complexity and calls Fazzagn API directly

const axios = require('axios');

class SimplePulsaService {
    constructor() {
        this.baseURL = process.env.FAZZAGN_BASE_URL || 'http://localhost:3000';
        this.userId = process.env.FAZZAGN_USER_ID || 1;
        this.activeSessions = new Map();
        this.isConnected = true; // Assume always connected for simplicity
        
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
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
    }

    // Check if speech contains pulsa intent
    isPulsaIntent(speechText) {
        const pulsaKeywords = [
            'pulsa', 'kredit', 'topup', 'top up', 'isi', 'beli', 'beliakan',
            'recharge', 'saldo'
        ];
        
        const text = speechText.toLowerCase();
        return pulsaKeywords.some(keyword => text.includes(keyword));
    }

    // Check if this is a confirmation response and there's an active session
    isConfirmationResponse(speechText, sessionId) {
        const text = speechText.toLowerCase().trim();
        const confirmationWords = ['ya', 'yes', 'iya', 'ok', 'setuju', 'lanjut', 'lanjutkan'];
        const rejectionWords = ['tidak', 'no', 'batal', 'cancel', 'batalkan'];
        
        const hasActiveSession = this.activeSessions.has(sessionId);
        const isConfirmation = confirmationWords.some(word => text.includes(word));
        const isRejection = rejectionWords.some(word => text.includes(word));
        
        if (hasActiveSession && (isConfirmation || isRejection)) {
            return {
                isConfirmation: true,
                confirmed: isConfirmation
            };
        }
        
        return { isConfirmation: false };
    }

    // Parse Indonesian speech for pulsa commands
    parsePulsaCommand(speechText) {
        const text = speechText.toLowerCase().trim();
        console.log('Parsing speech:', text);
        
        // Extract phone number
        const phonePatterns = [
            /(?:nomor|nomer|hp|handphone|telepon)\s*(?:nya)?\s*(?:adalah|yaitu)?\s*((?:\+62|62|0)?8\d{8,12})/gi,
            /(?:ke|untuk)\s*(?:nomor|nomer)?\s*((?:\+62|62|0)?8\d{8,12})/gi,
            /((?:\+62|62|0)?8\d{8,12})/gi,
        ];
        
        let phoneNumber = null;
        for (const pattern of phonePatterns) {
            const match = pattern.exec(text);
            if (match) {
                phoneNumber = match[1].replace(/\s+/g, '');
                pattern.lastIndex = 0;
                break;
            }
        }
        
        // Extract amount
        const numberWords = {
            'lima ribu': 5000,
            'sepuluh ribu': 10000,
            // Removed problematic entry
            // 'lima belas ribu': 15000,
            'dua puluh ribu': 20000,
            'dua lima ribu': 25000,
            'lima puluh ribu': 50000,
            'seratus ribu': 100000,
        };
        
        let amount = null;
        
        // Check for number words first
        for (const [word, value] of Object.entries(numberWords)) {
            if (text.includes(word)) {
                console.log('Number word matched:', word, '=', value);
                amount = value;
                break;
            }
        }
        
        if (!amount) {
            console.log('No number words found, trying numeric patterns...');
        }
        
        // Then check for numeric patterns - direct regex approach  
        if (!amount) {
            // Look for the specific pattern "pulsa AMOUNT"
            const pulsaAmountMatch = text.match(/pulsa\s+(\d+)/);
            if (pulsaAmountMatch) {
                const num = parseInt(pulsaAmountMatch[1]);
                if (num >= 1000 && num <= 1000000) {
                    amount = num;
                }
            }
            
            // If still not found, extract all numbers and find reasonable ones
            if (!amount) {
                const numbers = text.match(/\d+/g);
                if (numbers) {
                    for (const numStr of numbers) {
                        const num = parseInt(numStr);
                        if (num >= 1000 && num <= 1000000) {
                            amount = num;
                            break;
                        }
                    }
                }
            }
        }
        
        if (!phoneNumber || !amount) {
            return {
                valid: false,
                error: phoneNumber ? 'Jumlah pulsa tidak ditemukan' : 'Nomor HP tidak ditemukan'
            };
        }
        
        const result = {
            valid: true,
            phoneNumber: phoneNumber,
            amount: amount,
            provider: this.detectProvider(phoneNumber),
            originalText: speechText
        };
        
        console.log('Parse result before return:', JSON.stringify(result, null, 2));
        return result;
    }

    // Detect provider from phone number
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

    // Normalize phone number
    normalizePhoneNumber(phoneNumber) {
        let cleaned = phoneNumber.replace(/[^\d+]/g, '');
        
        if (cleaned.startsWith('+62')) {
            cleaned = '0' + cleaned.substring(3);
        } else if (cleaned.startsWith('62')) {
            cleaned = '0' + cleaned.substring(2);
        }
        
        if (!cleaned.startsWith('0')) {
            cleaned = '0' + cleaned;
        }
        
        return cleaned;
    }

    // Process speech for pulsa
    async processSpeechForPulsa(speechText, sessionId) {
        try {
            console.log('🎤 Processing speech for pulsa:', speechText);
            
            // Parse the speech command
            const parsedCommand = this.parsePulsaCommand(speechText);
            console.log('Parsed result:', JSON.stringify(parsedCommand, null, 2));
            
            if (!parsedCommand.valid) {
                return {
                    type: 'error',
                    message: parsedCommand.error + '. Coba katakan: "Beli pulsa 10 ribu untuk nomor 08123456789"',
                    suggestions: [
                        'Contoh: "Beli pulsa 10 ribu untuk nomor 08123456789"',
                        'Atau: "Isi pulsa 25000 ke 08567890123"'
                    ]
                };
            }

            // Store session data
            this.activeSessions.set(sessionId, {
                phoneNumber: parsedCommand.phoneNumber,
                amount: parsedCommand.amount,
                provider: parsedCommand.provider,
                timestamp: Date.now(),
                stage: 'confirmation_needed'
            });

            // Check availability via Fazzagn API
            try {
                const inquireResponse = await this.client.post('/api/v1/transactions/recharges/inquire', {
                    recharge: {
                        recharge_type: 'phone_credit',
                        amount: parsedCommand.amount,
                        customer_number: parsedCommand.phoneNumber
                    }
                });

                const referenceNumber = inquireResponse.data.reference_number;
                
                if (referenceNumber) {
                    // Store reference number for later use
                    const sessionData = this.activeSessions.get(sessionId);
                    sessionData.referenceNumber = referenceNumber;
                    
                    return {
                        type: 'confirmation_needed',
                        message: this.generateConfirmationMessage(parsedCommand),
                        data: {
                            phoneNumber: parsedCommand.phoneNumber,
                            amount: parsedCommand.amount,
                            provider: parsedCommand.provider,
                            referenceNumber: referenceNumber
                        }
                    };
                } else {
                    this.activeSessions.delete(sessionId);
                    return {
                        type: 'error',
                        message: 'Tidak dapat memproses pulsa untuk nomor tersebut'
                    };
                }

            } catch (error) {
                console.error('Fazzagn API error:', error.message);
                // Fallback - still allow confirmation for testing
                return {
                    type: 'confirmation_needed',
                    message: this.generateConfirmationMessage(parsedCommand) + ' (Mode simulasi)',
                    data: {
                        phoneNumber: parsedCommand.phoneNumber,
                        amount: parsedCommand.amount,
                        provider: parsedCommand.provider,
                        simulation: true
                    }
                };
            }

        } catch (error) {
            console.error('Error processing speech for pulsa:', error);
            this.activeSessions.delete(sessionId);
            return {
                type: 'error',
                message: 'Terjadi kesalahan saat memproses permintaan pulsa'
            };
        }
    }

    // Handle user confirmation
    async handleUserConfirmation(sessionId, confirmed) {
        const sessionData = this.activeSessions.get(sessionId);
        
        if (!sessionData) {
            return {
                type: 'error',
                message: 'Sesi telah berakhir. Silakan mulai kembali.'
            };
        }

        if (!confirmed) {
            this.activeSessions.delete(sessionId);
            return {
                type: 'cancelled',
                message: 'Pembelian pulsa dibatalkan.'
            };
        }

        try {
            console.log('💳 Executing pulsa purchase for session', sessionId);
            
            if (sessionData.referenceNumber) {
                // Real API flow
                const orderResponse = await this.client.post('/api/v1/transactions/recharges/order', {
                    recharge: {
                        recharge_type: 'phone_credit',
                        amount: sessionData.amount,
                        customer_number: sessionData.phoneNumber,
                        reference_number: sessionData.referenceNumber,
                        user_id: this.userId
                    }
                });

                const uniqueId = orderResponse.data.unique_id;
                
                if (uniqueId) {
                    const payResponse = await this.client.post('/api/v1/transactions/recharges/pay', {
                        payment: { unique_id: uniqueId }
                    });

                    this.activeSessions.delete(sessionId);

                    return {
                        type: 'success',
                        message: 'Pulsa ' + this.formatCurrency(sessionData.amount) + ' berhasil dikirim ke nomor ' + sessionData.phoneNumber + '. ID transaksi: ' + uniqueId,
                        data: {
                            transactionId: uniqueId,
                            phoneNumber: sessionData.phoneNumber,
                            amount: sessionData.amount,
                            provider: sessionData.provider
                        }
                    };
                }
            }
            
            // Fallback simulation
            this.activeSessions.delete(sessionId);
            const simulatedTransactionId = 'SIM_' + Date.now();
            
            return {
                type: 'success',
                message: 'Simulasi: Pulsa ' + this.formatCurrency(sessionData.amount) + ' berhasil dikirim ke nomor ' + sessionData.phoneNumber + '. ID simulasi: ' + simulatedTransactionId,
                data: {
                    transactionId: simulatedTransactionId,
                    phoneNumber: sessionData.phoneNumber,
                    amount: sessionData.amount,
                    provider: sessionData.provider,
                    simulation: true
                }
            };

        } catch (error) {
            console.error('Error executing pulsa purchase:', error);
            this.activeSessions.delete(sessionId);
            return {
                type: 'error',
                message: 'Terjadi kesalahan saat pembelian: ' + error.message
            };
        }
    }

    // Generate confirmation message
    generateConfirmationMessage(parsedCommand) {
        const formattedAmount = this.formatCurrency(parsedCommand.amount);
        let message = 'Apakah Anda yakin ingin membeli pulsa ' + formattedAmount + ' untuk nomor ' + parsedCommand.phoneNumber;
        
        if (parsedCommand.provider) {
            message += ' (' + parsedCommand.provider + ')';
        }
        
        message += '? Katakan "ya" untuk melanjutkan atau "tidak" untuk membatalkan.';
        
        return message;
    }

    // Format currency
    formatCurrency(amount) {
        return 'Rp ' + amount.toLocaleString('id-ID');
    }

    // Clean up expired sessions
    cleanupExpiredSessions() {
        const now = Date.now();
        const expireTime = 5 * 60 * 1000; // 5 minutes
        
        for (const [sessionId, sessionData] of this.activeSessions.entries()) {
            if (now - sessionData.timestamp > expireTime) {
                console.log('🧹 Cleaning up expired session:', sessionId);
                this.activeSessions.delete(sessionId);
            }
        }
    }
}

module.exports = SimplePulsaService;