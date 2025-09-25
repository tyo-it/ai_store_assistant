const { EventEmitter } = require('events');
const MCPPulsaClient = require('./MCPPulsaClient');

class PulsaService extends EventEmitter {
    constructor() {
        super();
        this.mcpClient = new MCPPulsaClient();
        this.activeSessions = new Map(); // Track user sessions
        this.isConnected = false;
        
        this.setupMCPClientHandlers();
    }

    async initialize() {
        try {
            await this.mcpClient.connect();
            this.isConnected = true;
            console.log('✅ Pulsa Service initialized with MCP client');
        } catch (error) {
            console.error('❌ Failed to initialize Pulsa Service:', error);
            throw error;
        }
    }

    setupMCPClientHandlers() {
        this.mcpClient.on('disconnected', () => {
            this.isConnected = false;
            console.log('⚠️ MCP Pulsa Client disconnected');
        });
    }

    async processSpeechForPulsa(speechText, sessionId) {
        if (!this.isConnected) {
            throw new Error('Pulsa service not connected');
        }

        try {
            console.log(`🎤 Processing speech for pulsa: "${speechText}"`);
            
            // Step 1: Parse the speech command
            const parsedCommand = await this.mcpClient.processSpeechCommand(speechText);
            
            if (!parsedCommand.understood) {
                return {
                    type: 'error',
                    message: parsedCommand.error || 'Tidak dapat memahami perintah pulsa. Coba katakan: "Beli pulsa 10 ribu untuk nomor 08123456789"',
                    suggestions: [
                        'Contoh: "Beli pulsa 10 ribu untuk nomor 08123456789"',
                        'Atau: "Isi pulsa 25000 ke 08567890123"',
                        'Atau: "Topup pulsa lima puluh ribu nomor 08111222333"'
                    ]
                };
            }

            // Step 2: Store session data for confirmation
            this.activeSessions.set(sessionId, {
                phoneNumber: parsedCommand.phoneNumber,
                amount: parsedCommand.amount,
                provider: parsedCommand.provider,
                parsedCommand: parsedCommand,
                timestamp: Date.now(),
                stage: 'confirmation_needed'
            });

            // Step 3: Check availability
            let availabilityResult;
            try {
                availabilityResult = await this.mcpClient.checkPulsaAvailability(
                    parsedCommand.phoneNumber,
                    parsedCommand.amount,
                    parsedCommand.provider
                );
            } catch (error) {
                console.error('Error checking availability:', error);
                return {
                    type: 'error',
                    message: `Tidak dapat memeriksa ketersediaan pulsa: ${error.message}`
                };
            }

            if (!availabilityResult.available) {
                this.activeSessions.delete(sessionId);
                return {
                    type: 'error',
                    message: `Pulsa ${this.formatCurrency(parsedCommand.amount)} untuk ${parsedCommand.phoneNumber} tidak tersedia. ${availabilityResult.message || ''}`
                };
            }

            // Step 4: Request user confirmation
            return {
                type: 'confirmation_needed',
                message: this.generateConfirmationMessage(parsedCommand, availabilityResult),
                data: {
                    phoneNumber: parsedCommand.phoneNumber,
                    amount: parsedCommand.amount,
                    provider: parsedCommand.provider,
                    price: availabilityResult.price,
                    confidence: parsedCommand.confidence
                }
            };

        } catch (error) {
            console.error('Error processing speech for pulsa:', error);
            this.activeSessions.delete(sessionId);
            return {
                type: 'error',
                message: `Terjadi kesalahan saat memproses permintaan pulsa: ${error.message}`
            };
        }
    }

    async handleUserConfirmation(sessionId, confirmed) {
        const sessionData = this.activeSessions.get(sessionId);
        
        if (!sessionData) {
            return {
                type: 'error',
                message: 'Sesi telah berakhir. Silakan mulai kembali dengan menyebutkan permintaan pulsa Anda.'
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
            // Update session stage
            sessionData.stage = 'processing';
            
            // Execute the purchase
            console.log(`💳 Executing pulsa purchase for session ${sessionId}`);
            
            const purchaseResult = await this.mcpClient.purchasePulsa(
                sessionData.phoneNumber,
                sessionData.amount,
                sessionData.provider
            );

            // Clean up session
            this.activeSessions.delete(sessionId);

            if (purchaseResult.success) {
                return {
                    type: 'success',
                    message: this.generateSuccessMessage(sessionData, purchaseResult),
                    data: {
                        transactionId: purchaseResult.transactionId || purchaseResult.uniqueId,
                        phoneNumber: sessionData.phoneNumber,
                        amount: sessionData.amount,
                        provider: sessionData.provider,
                        status: purchaseResult.status
                    }
                };
            } else {
                return {
                    type: 'error',
                    message: `Pembelian pulsa gagal: ${purchaseResult.message || 'Silakan coba lagi.'}`
                };
            }

        } catch (error) {
            console.error('Error executing pulsa purchase:', error);
            this.activeSessions.delete(sessionId);
            return {
                type: 'error',
                message: `Terjadi kesalahan saat pembelian: ${error.message}`
            };
        }
    }

    async checkTransactionStatus(uniqueId) {
        if (!this.isConnected) {
            throw new Error('Pulsa service not connected');
        }

        try {
            const status = await this.mcpClient.checkTransactionStatus(uniqueId);
            return {
                type: 'status',
                data: status,
                message: `Status transaksi ${uniqueId}: ${status.status}`
            };
        } catch (error) {
            console.error('Error checking transaction status:', error);
            return {
                type: 'error',
                message: `Tidak dapat memeriksa status transaksi: ${error.message}`
            };
        }
    }

    // Helper method to detect if speech contains pulsa intent
    isPulsaIntent(speechText) {
        const pulsaKeywords = [
            'pulsa', 'kredit', 'topup', 'top up', 'isi', 'beli', 'beliakan',
            'recharge', 'saldo'
        ];
        
        const text = speechText.toLowerCase();
        return pulsaKeywords.some(keyword => text.includes(keyword));
    }

    generateConfirmationMessage(parsedCommand, availabilityResult) {
        const formattedAmount = this.formatCurrency(parsedCommand.amount);
        const formattedPrice = availabilityResult.price ? this.formatCurrency(availabilityResult.price) : formattedAmount;
        
        let message = `Apakah Anda yakin ingin membeli pulsa ${formattedAmount} untuk nomor ${parsedCommand.phoneNumber}`;
        
        if (parsedCommand.provider) {
            message += ` (${parsedCommand.provider})`;
        }
        
        if (availabilityResult.price && availabilityResult.price !== parsedCommand.amount) {
            message += ` dengan harga ${formattedPrice}`;
        }
        
        message += '? Katakan "ya" untuk melanjutkan atau "tidak" untuk membatalkan.';
        
        return message;
    }

    generateSuccessMessage(sessionData, purchaseResult) {
        const formattedAmount = this.formatCurrency(sessionData.amount);
        let message = `✅ Pulsa ${formattedAmount} berhasil dikirim ke nomor ${sessionData.phoneNumber}`;
        
        if (purchaseResult.transactionId || purchaseResult.uniqueId) {
            message += `. ID transaksi: ${purchaseResult.transactionId || purchaseResult.uniqueId}`;
        }
        
        if (purchaseResult.serialNumber) {
            message += `. Serial number: ${purchaseResult.serialNumber}`;
        }
        
        message += '. Terima kasih!';
        
        return message;
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    }

    // Clean up expired sessions (older than 5 minutes)
    cleanupExpiredSessions() {
        const now = Date.now();
        const expireTime = 5 * 60 * 1000; // 5 minutes
        
        for (const [sessionId, sessionData] of this.activeSessions.entries()) {
            if (now - sessionData.timestamp > expireTime) {
                console.log(`🧹 Cleaning up expired session: ${sessionId}`);
                this.activeSessions.delete(sessionId);
            }
        }
    }

    // Start cleanup timer
    startCleanupTimer() {
        setInterval(() => {
            this.cleanupExpiredSessions();
        }, 60000); // Check every minute
    }

    disconnect() {
        if (this.mcpClient) {
            this.mcpClient.disconnect();
        }
        this.activeSessions.clear();
        this.isConnected = false;
    }
}

module.exports = PulsaService;