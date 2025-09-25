const MCPClient = require('./MCPClient');

class PulsaService {
    constructor() {
        // Connect to the MCP pulsa server via HTTP
        const mcpServerUrl = process.env.MCP_SERVER_URL || 'http://localhost:3001';
        console.log('🔌 [PULSA SERVICE] Connecting to MCP server at:', mcpServerUrl);
        this.mcpClient = new MCPClient(mcpServerUrl);
        this.isConnected = false;
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.mcpClient.on('connected', () => {
            console.log('Pulsa MCP service connected');
            this.isConnected = true;
        });

        this.mcpClient.on('disconnected', () => {
            console.log('Pulsa MCP service disconnected');
            this.isConnected = false;
        });

        this.mcpClient.on('error', (error) => {
            console.error('Pulsa MCP service error:', error);
        });
    }

    async initialize() {
        try {
            await this.mcpClient.connect();
            return true;
        } catch (error) {
            console.error('Failed to initialize Pulsa service:', error);
            return false;
        }
    }

    async processPulsaCommand(speechText, sessionId) {
        if (!this.isConnected) {
            throw new Error('Pulsa service is not connected');
        }

        try {
            // Use the MCP server to process the speech command
            const result = await this.mcpClient.processSpeechCommand(speechText, sessionId);
            return this.formatResponse(result);
        } catch (error) {
            console.error('Error processing pulsa command:', error);
            throw error;
        }
    }

    async checkAvailability(phoneNumber, amount) {
        if (!this.isConnected) {
            throw new Error('Pulsa service is not connected');
        }

        try {
            const result = await this.mcpClient.checkPulsaAvailability(phoneNumber, amount);
            return this.formatResponse(result);
        } catch (error) {
            console.error('Error checking pulsa availability:', error);
            throw error;
        }
    }

    async purchasePulsa(phoneNumber, amount, confirmed = false) {
        if (!this.isConnected) {
            throw new Error('Pulsa service is not connected');
        }

        try {
            const result = await this.mcpClient.purchasePulsa(phoneNumber, amount, confirmed);
            return this.formatResponse(result);
        } catch (error) {
            console.error('Error purchasing pulsa:', error);
            throw error;
        }
    }

    async validatePhoneNumber(phoneNumber) {
        if (!this.isConnected) {
            throw new Error('Pulsa service is not connected');
        }

        try {
            const result = await this.mcpClient.validatePhoneNumber(phoneNumber);
            return this.formatResponse(result);
        } catch (error) {
            console.error('Error validating phone number:', error);
            throw error;
        }
    }

    formatResponse(mcpResult) {
        if (!mcpResult) {
            return {
                success: false,
                message: 'No response from pulsa service'
            };
        }

        // Handle different response formats from MCP
        if (mcpResult.content && Array.isArray(mcpResult.content)) {
            const textContent = mcpResult.content.find(item => item.type === 'text');
            if (textContent) {
                try {
                    const parsedContent = JSON.parse(textContent.text);
                    return {
                        success: parsedContent.success || false,
                        message: parsedContent.message || parsedContent.response || textContent.text,
                        data: parsedContent.data || null,
                        needsConfirmation: parsedContent.needs_confirmation || false,
                        confirmationMessage: parsedContent.confirmation_message || null
                    };
                } catch (error) {
                    // If not JSON, return as plain text
                    return {
                        success: true,
                        message: textContent.text,
                        data: null
                    };
                }
            }
        }

        // Fallback for other response formats
        return {
            success: true,
            message: mcpResult.message || JSON.stringify(mcpResult),
            data: mcpResult.data || null
        };
    }

    // Check if the speech text is related to pulsa operations
    isPulsaRelated(speechText) {
        const pulsaKeywords = [
            'pulsa', 'kredit', 'top up', 'topup', 'isi ulang', 
            'beli pulsa', 'tambah pulsa', 'credit', 'saldo',
            'nomor', 'telepon', 'hp', 'handphone', 'phone',
            'ribu', '000', 'rb', 'rupiah'
        ];

        const lowerText = speechText.toLowerCase();
        return pulsaKeywords.some(keyword => lowerText.includes(keyword));
    }

    // Extract phone number and amount from speech text
    extractPulsaInfo(speechText) {
        const phoneRegex = /(\+?62|0)[\s-]?(\d{2,4})[\s-]?(\d{3,4})[\s-]?(\d{3,5})/g;
        const amountRegex = /(\d+)[\s]?(ribu|rb|000|rupiah)/gi;

        let phoneNumber = null;
        let amount = null;

        // Extract phone number
        const phoneMatch = phoneRegex.exec(speechText);
        if (phoneMatch) {
            phoneNumber = phoneMatch[0].replace(/[\s-]/g, '');
            // Normalize phone number format
            if (phoneNumber.startsWith('0')) {
                phoneNumber = '+62' + phoneNumber.substring(1);
            } else if (!phoneNumber.startsWith('+62')) {
                phoneNumber = '+62' + phoneNumber;
            }
        }

        // Extract amount
        const amountMatch = amountRegex.exec(speechText);
        if (amountMatch) {
            let value = parseInt(amountMatch[1]);
            const unit = amountMatch[2].toLowerCase();
            
            if (unit === 'ribu' || unit === 'rb') {
                amount = value * 1000;
            } else if (unit === '000') {
                amount = value * 1000;
            } else {
                amount = value;
            }
        }

        return { phoneNumber, amount };
    }

    async disconnect() {
        if (this.mcpClient) {
            await this.mcpClient.disconnect();
        }
        this.isConnected = false;
    }
}

module.exports = PulsaService;
