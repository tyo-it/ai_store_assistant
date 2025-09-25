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
                        success: parsedContent.success || parsedContent.valid || parsedContent.available || false,
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
            'pulsa', 'kredit', 'top up', 'topup', 'isi ulang', 'isi',
            'beli pulsa', 'tambah pulsa', 'credit', 'saldo',
            'nomor', 'telepon', 'hp', 'handphone', 'phone',
            'ribu', '000', 'rb', 'rupiah', 'tolong', 'mohon'
        ];

        const lowerText = speechText.toLowerCase();
        
        // Check for keywords
        const hasKeywords = pulsaKeywords.some(keyword => lowerText.includes(keyword));
        
        // Check for intent patterns
        const intentPatterns = [
            /(?:beli|beliakan|purchase|topup|top\s*up|isi(?:\s*ulang)?)\s*(?:pulsa|kredit|saldo)/gi,
            /(?:mau|ingin|minta|pengen)\s*(?:beli|isi|topup|top\s*up)\s*(?:pulsa|kredit)/gi,
            /(?:tolong|please|mohon)\s*(?:belikan|isi(?:\s*ulang)?|topup|top\s*up)\s*(?:pulsa|kredit)/gi,
        ];
        
        const hasIntent = intentPatterns.some(pattern => pattern.test(lowerText));
        
        return hasKeywords || hasIntent;
    }

    // Extract phone number and amount from speech text
    extractPulsaInfo(speechText) {
        const text = speechText.toLowerCase();
        
        // Enhanced phone number patterns
        const phonePatterns = [
            /(?:nomor|nomer|hp|handphone|telepon)\s*(?:nya)?\s*(?:adalah|yaitu)?\s*((?:\+62|62|0)?8\d{8,12})/gi,
            /(?:ke|untuk)\s*(?:nomor|nomer)?\s*((?:\+62|62|0)?8\d{8,12})/gi,
            /(?:ke|untuk)\s*((?:\+62|62|0)?8\d{8,12})/gi,
            /((?:\+62|62|0)?8\d{8,12})/gi,
        ];

        // Enhanced amount patterns
        const amountPatterns = [
            /(\d{1,3})\s*ribu/gi,  // "25 ribu"
            /(\d{1,3}(?:\.\d{3})*)\s*(?:ribu|rb|k)/gi,
            /(\d+)[\s]?(ribu|rb|000|rupiah)/gi,
        ];

        let phoneNumber = null;
        let amount = null;

        // Extract phone number
        for (const pattern of phonePatterns) {
            const match = pattern.exec(text);
            if (match) {
                phoneNumber = match[1].replace(/[\s-]/g, '');
                
                // Normalize phone number format
                if (phoneNumber.startsWith('0')) {
                    phoneNumber = phoneNumber; // Keep original format for Indonesian numbers
                } else if (phoneNumber.startsWith('62')) {
                    phoneNumber = '0' + phoneNumber.substring(2);
                } else if (phoneNumber.startsWith('+62')) {
                    phoneNumber = '0' + phoneNumber.substring(3);
                }
                break;
            }
            pattern.lastIndex = 0; // Reset regex global flag
        }

        // Extract amount
        for (const pattern of amountPatterns) {
            const match = pattern.exec(text);
            if (match) {
                let value = parseInt(match[1]);
                const unit = match[2] ? match[2].toLowerCase() : 'ribu';
                
                if (unit === 'ribu' || unit === 'rb' || unit === 'k') {
                    amount = value * 1000;
                } else if (unit === '000') {
                    amount = value * 1000;
                } else if (unit === 'rupiah') {
                    amount = value;
                } else {
                    // If no unit specified but pattern matched, assume thousands
                    amount = value * 1000;
                }
                
                // Validate reasonable pulsa amounts
                if (amount >= 1000 && amount <= 1000000) {
                    break;
                }
            }
            pattern.lastIndex = 0; // Reset regex global flag
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
