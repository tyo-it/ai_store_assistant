const OpenAI = require('openai');
const PulsaService = require('../services/PulsaService');

class FallbackVoiceAssistant {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        this.conversationHistory = [];
        this.isConnected = false;
        this.eventHandlers = new Map();
        this.pulsaService = new PulsaService();
        this.sessionId = this.generateSessionId();
        this.pendingPurchase = null;
        
        // Initialize pulsa service
        this.initializePulsaService();
    }

    generateSessionId() {
        return 'fallback_session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    async initializePulsaService() {
        try {
            await this.pulsaService.initialize();
            console.log('Pulsa service initialized for Fallback Assistant');
        } catch (error) {
            console.error('Failed to initialize Pulsa service for Fallback Assistant:', error);
        }
    }

    async connect() {
        // Test OpenAI connection with a simple request
        try {
            await this.openai.chat.completions.create({
                model: process.env.FALLBACK_MODEL || 'gpt-4o-mini',
                messages: [{ role: 'user', content: 'Hello' }],
                max_tokens: 5
            });
            this.isConnected = true;
            console.log('✅ Connected to OpenAI Chat Completions API (fallback mode)');
            return true;
        } catch (error) {
            console.error('❌ Failed to connect to OpenAI API:', error.message);
            throw error;
        }
    }

    async disconnect() {
        this.isConnected = false;
        if (this.pulsaService) {
            await this.pulsaService.disconnect();
        }
        console.log('🔌 Disconnected from OpenAI API');
    }

    // Register event handler
    on(eventType, handler) {
        if (!this.eventHandlers.has(eventType)) {
            this.eventHandlers.set(eventType, []);
        }
        this.eventHandlers.get(eventType).push(handler);
    }

    // Emit event to handlers
    emit(eventType, event) {
        if (this.eventHandlers.has(eventType)) {
            const handlers = this.eventHandlers.get(eventType);
            handlers.forEach(handler => handler(event));
        }
    }

    async processTextMessage(text) {
        if (!this.isConnected) {
            throw new Error('Not connected to OpenAI API');
        }

        try {
            // Check if this is a pulsa-related command
            if (this.pulsaService.isPulsaRelated(text)) {
                return await this.handlePulsaCommand(text);
            }
            
            // Add user message to conversation history
            this.conversationHistory.push({
                role: 'user',
                content: text
            });

            // Emit text received event
            this.emit('text.received', { text });

            console.log('💬 Processing text message:', text);

            // Generate AI response using OpenAI Chat Completions
            const completion = await this.openai.chat.completions.create({
                model: process.env.FALLBACK_MODEL || 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful AI assistant that can help with general questions and pulsa/mobile credit purchases. Please respond ONLY in Bahasa Indonesia. Provide concise, helpful responses suitable for both text and speech output. Keep responses conversational and under 150 words. When your response will be spoken aloud, structure it with natural pauses and clear pronunciation in mind. Use simple, clear Indonesian language that can be easily understood when spoken slowly and distinctly. Always use Indonesian language - never use English. For pulsa purchases, ask for phone number and amount, then ask for confirmation before proceeding.'
                    },
                    ...this.conversationHistory.slice(-10) // Keep last 10 messages for context
                ],
                max_tokens: 300,
                temperature: 0.7
            });

            const responseText = completion.choices[0].message.content;

            // Add AI response to conversation history
            this.conversationHistory.push({
                role: 'assistant',
                content: responseText
            });

            console.log('🤖 Generated response:', responseText);

            // Emit response events
            this.emit('response.text.complete', { text: responseText });
            this.emit('response.done', { 
                response: { 
                    text: responseText,
                    usage: completion.usage 
                } 
            });

            return responseText;

        } catch (error) {
            console.error('❌ Error processing text message:', error);
            this.emit('error', { error: error.message });
            throw error;
        }
    }

    // Simulate audio processing (will be handled by browser)
    sendAudio(audioBuffer) {
        console.log('🎵 Audio received (will be processed by browser speech recognition)');
        this.emit('audio.received', { audioBuffer });
    }

    commitAudio() {
        console.log('✅ Audio committed for processing');
        this.emit('audio.committed', {});
    }

    clearAudio() {
        console.log('🗑️ Audio buffer cleared');
        this.emit('audio.cleared', {});
    }

    interrupt() {
        console.log('⏹️ Response interrupted');
        this.emit('response.interrupted', {});
    }

    setVoice(voice) {
        console.log(`🗣️ Voice changed to: ${voice} (handled by browser)`);
        this.emit('voice.changed', { voice });
    }

    clearConversationHistory() {
        this.conversationHistory = [];
        console.log('🗑️ Conversation history cleared');
    }

    async handlePulsaCommand(message) {
        try {
            console.log('Handling pulsa command:', message);
            
            // Extract phone number and amount from the message
            const { phoneNumber, amount } = this.pulsaService.extractPulsaInfo(message);
            
            // If we have both phone number and amount, process the purchase
            if (phoneNumber && amount) {
                console.log(`Processing pulsa purchase: ${phoneNumber}, ${amount}`);
                
                // First validate the phone number
                const validation = await this.pulsaService.validatePhoneNumber(phoneNumber);
                if (!validation.success) {
                    const responseText = `Maaf, nomor telepon ${phoneNumber} tidak valid. ${validation.message}`;
                    this.emit('response.text.complete', { text: responseText });
                    this.emit('response.done', { 
                        response: { 
                            text: responseText,
                            timestamp: new Date().toISOString()
                        }
                    });
                    return;
                }
                
                // Check availability
                const availability = await this.pulsaService.checkAvailability(phoneNumber, amount);
                if (!availability.success) {
                    const responseText = `Maaf, pulsa ${amount} untuk nomor ${phoneNumber} tidak tersedia. ${availability.message}`;
                    this.emit('response.text.complete', { text: responseText });
                    this.emit('response.done', { 
                        response: { 
                            text: responseText,
                            timestamp: new Date().toISOString()
                        }
                    });
                    return;
                }
                
                // If available, ask for confirmation
                const confirmationMessage = `Saya akan membelikan pulsa ${amount} rupiah untuk nomor ${phoneNumber}. Apakah Anda yakin ingin melanjutkan?`;
                
                // Store the purchase details for confirmation
                this.pendingPurchase = { phoneNumber, amount };
                
                this.emit('response.text.complete', { text: confirmationMessage });
                this.emit('response.done', { 
                    response: { 
                        text: confirmationMessage,
                        timestamp: new Date().toISOString(),
                        needsConfirmation: true,
                        confirmationData: { phoneNumber, amount }
                    }
                });
                
            } else {
                // Use MCP to process the speech command for more sophisticated parsing
                const result = await this.pulsaService.processPulsaCommand(message, this.sessionId);
                
                const responseText = result.message || 'Saya membutuhkan nomor telepon dan jumlah pulsa yang ingin dibeli. Contoh: "Beli pulsa 50 ribu untuk nomor 081234567890"';
                
                this.emit('response.text.complete', { text: responseText });
                this.emit('response.done', { 
                    response: { 
                        text: responseText,
                        timestamp: new Date().toISOString(),
                        needsConfirmation: result.needsConfirmation || false,
                        confirmationData: result.data || null
                    }
                });
            }
            
        } catch (error) {
            console.error('Error handling pulsa command:', error);
            const responseText = 'Maaf, terjadi kesalahan saat memproses permintaan pulsa Anda. Silakan coba lagi.';
            this.emit('response.text.complete', { text: responseText });
            this.emit('response.done', { 
                response: { 
                    text: responseText,
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    async confirmPulsaPurchase(confirmed) {
        try {
            if (!this.pendingPurchase) {
                return {
                    type: 'text',
                    text: 'Tidak ada pembelian pulsa yang menunggu konfirmasi.',
                    timestamp: new Date().toISOString()
                };
            }
            
            const { phoneNumber, amount } = this.pendingPurchase;
            
            if (confirmed) {
                console.log(`Confirming pulsa purchase: ${phoneNumber}, ${amount}`);
                const result = await this.pulsaService.purchasePulsa(phoneNumber, amount, true);
                
                this.pendingPurchase = null;
                
                if (result.success) {
                    return {
                        type: 'text',
                        text: `Pembelian pulsa berhasil! ${result.message}`,
                        timestamp: new Date().toISOString()
                    };
                } else {
                    return {
                        type: 'text',
                        text: `Pembelian pulsa gagal. ${result.message}`,
                        timestamp: new Date().toISOString()
                    };
                }
            } else {
                this.pendingPurchase = null;
                return {
                    type: 'text',
                    text: 'Pembelian pulsa dibatalkan.',
                    timestamp: new Date().toISOString()
                };
            }
            
        } catch (error) {
            console.error('Error confirming pulsa purchase:', error);
            this.pendingPurchase = null;
            return {
                type: 'text',
                text: 'Terjadi kesalahan saat mengkonfirmasi pembelian pulsa.',
                timestamp: new Date().toISOString()
            };
        }
    }

    getStatus() {
        return {
            connected: this.isConnected,
            model: 'gpt-3.5-turbo',
            mode: 'fallback',
            conversationLength: this.conversationHistory.length
        };
    }
}

module.exports = FallbackVoiceAssistant;
