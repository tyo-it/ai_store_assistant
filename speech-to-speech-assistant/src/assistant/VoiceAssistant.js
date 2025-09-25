const OpenAI = require('openai');
const SpeechRecognition = require('./SpeechRecognition');
const TextToSpeech = require('./TextToSpeech');
const PulsaService = require('../services/PulsaService');

class VoiceAssistant {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        this.speechRecognition = new SpeechRecognition();
        this.textToSpeech = new TextToSpeech();
        this.pulsaService = new PulsaService();
        
        this.conversationHistory = [];
        this.isListening = false;
        this.sessionId = this.generateSessionId();
        
        // Initialize pulsa service
        this.initializePulsaService();
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    async initializePulsaService() {
        try {
            await this.pulsaService.initialize();
            console.log('Pulsa service initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Pulsa service:', error);
        }
    }

    async processVoiceCommand(audioBuffer) {
        try {
            console.log('Processing voice command...');
            
            // Convert speech to text
            const transcript = await this.speechRecognition.transcribe(audioBuffer);
            console.log('Transcript:', transcript);
            
            if (!transcript || transcript.trim().length === 0) {
                return {
                    type: 'error',
                    message: 'Could not understand the voice command'
                };
            }

            // Process the text message
            const aiResponse = await this.processTextMessage(transcript);
            
            // Convert response to speech with slower, clearer settings
            const audioResponse = await this.textToSpeech.synthesize(aiResponse.text, {
                speed: parseFloat(process.env.SPEECH_RATE) || 1,
                pitch: parseFloat(process.env.SPEECH_PITCH) || 0
            });
            
            return {
                type: 'voice',
                transcript: transcript,
                text: aiResponse.text,
                audio: audioResponse,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('Voice command processing error:', error);
            throw new Error('Failed to process voice command');
        }
    }

    async processTextMessage(message) {
        try {
            console.log('Processing text message:', message);
            
            // Check if this is a pulsa-related command
            if (this.pulsaService.isPulsaRelated(message)) {
                return await this.handlePulsaCommand(message);
            }
            
            // Add user message to conversation history
            this.conversationHistory.push({
                role: 'user',
                content: message
            });

            // Generate AI response using OpenAI
            const completion = await this.openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful AI assistant with voice capabilities. You can help with general questions and also assist with pulsa/mobile credit purchases. For pulsa-related requests, you can help users buy mobile credit by asking for their phone number and amount. Provide concise, helpful responses suitable for both text and speech output.'
                    },
                    ...this.conversationHistory.slice(-10) // Keep last 10 messages for context
                ],
                max_tokens: 500,
                temperature: 0.7
            });

            const aiResponse = completion.choices[0].message.content;
            
            // Add AI response to conversation history
            this.conversationHistory.push({
                role: 'assistant',
                content: aiResponse
            });

            return {
                type: 'text',
                text: aiResponse,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Text message processing error:', error);
            
            // Fallback response
            const fallbackMessage = "I'm sorry, I'm having trouble processing your request right now. Please try again.";
            
            return {
                type: 'text',
                text: fallbackMessage,
                timestamp: new Date().toISOString()
            };
        }
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
                    return {
                        type: 'text',
                        text: `Maaf, nomor telepon ${phoneNumber} tidak valid. ${validation.message}`,
                        timestamp: new Date().toISOString()
                    };
                }
                
                // Check availability
                const availability = await this.pulsaService.checkAvailability(phoneNumber, amount);
                if (!availability.success) {
                    return {
                        type: 'text',
                        text: `Maaf, pulsa ${amount} untuk nomor ${phoneNumber} tidak tersedia. ${availability.message}`,
                        timestamp: new Date().toISOString()
                    };
                }
                
                // If available, ask for confirmation
                const confirmationMessage = `Saya akan membelikan pulsa ${amount} rupiah untuk nomor ${phoneNumber}. Apakah Anda yakin ingin melanjutkan?`;
                
                // Store the purchase details for confirmation
                this.pendingPurchase = { phoneNumber, amount };
                
                return {
                    type: 'text',
                    text: confirmationMessage,
                    timestamp: new Date().toISOString(),
                    needsConfirmation: true,
                    confirmationData: { phoneNumber, amount }
                };
                
            } else {
                // Use MCP to process the speech command for more sophisticated parsing
                const result = await this.pulsaService.processPulsaCommand(message, this.sessionId);
                
                return {
                    type: 'text',
                    text: result.message || 'Saya membutuhkan nomor telepon dan jumlah pulsa yang ingin dibeli. Contoh: "Beli pulsa 50 ribu untuk nomor 081234567890"',
                    timestamp: new Date().toISOString(),
                    needsConfirmation: result.needsConfirmation || false,
                    confirmationData: result.data || null
                };
            }
            
        } catch (error) {
            console.error('Error handling pulsa command:', error);
            return {
                type: 'text',
                text: 'Maaf, terjadi kesalahan saat memproses permintaan pulsa Anda. Silakan coba lagi.',
                timestamp: new Date().toISOString()
            };
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

    clearConversationHistory() {
        this.conversationHistory = [];
        console.log('Conversation history cleared');
    }

    getConversationHistory() {
        return this.conversationHistory;
    }

    setListening(isListening) {
        this.isListening = isListening;
        console.log(`Voice assistant ${isListening ? 'started' : 'stopped'} listening`);
    }

    async disconnect() {
        if (this.pulsaService) {
            await this.pulsaService.disconnect();
        }
    }
}

module.exports = VoiceAssistant;
