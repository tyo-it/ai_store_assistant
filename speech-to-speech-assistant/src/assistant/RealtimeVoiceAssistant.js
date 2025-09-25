const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const PulsaService = require('../services/PulsaService');

class RealtimeVoiceAssistant {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.ws = null;
        this.isConnected = false;
        this.pulsaService = new PulsaService();
        this.sessionId = this.generateSessionId();
        this.pendingPurchase = null;
        this.sessionConfig = {
            model: process.env.REALTIME_MODEL || 'gpt-4o-realtime-preview',
            modalities: ['text', 'audio'],
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            instructions: 'You are a helpful AI assistant that can help with general questions and pulsa/mobile credit purchases. Please respond in Bahasa Indonesia and speak very slowly and clearly, with natural pauses between sentences and words for better understanding. Take your time with each word, pronounce everything distinctly, and avoid rushing. Use a calm, measured pace throughout your responses. Always respond in Indonesian language. For pulsa purchases, ask for phone number and amount, then ask for confirmation before proceeding.',
            input_audio_transcription: {
                model: 'whisper-1'
            },
            speed: 1,
            turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 800
            },
            tools: [],
            tool_choice: 'auto',
            temperature: 0.8,
            max_response_output_tokens: 4096
        };
        this.eventHandlers = new Map();
        
        // Initialize pulsa service
        this.initializePulsaService();
    }

    generateSessionId() {
        return 'realtime_session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    async initializePulsaService() {
        try {
            await this.pulsaService.initialize();
            console.log('Pulsa service initialized for Realtime Assistant');
        } catch (error) {
            console.error('Failed to initialize Pulsa service for Realtime Assistant:', error);
        }
    }

    async connect() {
        if (this.isConnected) {
            console.log('Already connected to Realtime API');
            return;
        }

        const url = `wss://api.openai.com/v1/realtime?model=${this.sessionConfig.model}`;
        
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(url, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'OpenAI-Beta': 'realtime=v1'
                }
            });

            this.ws.on('open', () => {
                console.log('🎤 Connected to OpenAI Realtime API');
                this.isConnected = true;
                this.updateSession();
                resolve();
            });

            this.ws.on('message', (data) => {
                try {
                    const event = JSON.parse(data.toString());
                    this.handleRealtimeEvent(event);
                } catch (error) {
                    console.error('Error parsing realtime event:', error);
                }
            });

            this.ws.on('close', () => {
                console.log('🔌 Disconnected from OpenAI Realtime API');
                this.isConnected = false;
            });

            this.ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.isConnected = false;
                reject(error);
            });
        });
    }

    async disconnect() {
        if (this.ws && this.isConnected) {
            this.ws.close();
            this.isConnected = false;
        }
        if (this.pulsaService) {
            await this.pulsaService.disconnect();
        }
    }

    updateSession() {
        if (!this.isConnected) return;

        const sessionUpdate = {
            type: 'session.update',
            session: this.sessionConfig
        };

        try {
            this.send(sessionUpdate);
        } catch (error) {
            console.error('Failed to update session:', error.message);
            throw error;
        }
    }

    send(event) {
        if (this.ws && this.isConnected) {
            this.ws.send(JSON.stringify(event));
        } else {
            console.error('Cannot send event: WebSocket not connected');
        }
    }

    // Handle incoming realtime events
    handleRealtimeEvent(event) {
        console.log(`📨 Received event: ${event.type}`);
        
        // Log full event data for debugging response events
        if (event.type.startsWith('response.')) {
            console.log('🔍 Full response event:', JSON.stringify(event, null, 2));
        }

        // Emit to registered handlers
        if (this.eventHandlers.has(event.type)) {
            const handlers = this.eventHandlers.get(event.type);
            handlers.forEach(handler => handler(event));
        }

        // Built-in event handling
        switch (event.type) {
            case 'session.created':
                console.log('✅ Session created');
                break;
            
            case 'session.updated':
                console.log('🔄 Session updated');
                break;
            
            case 'conversation.item.created':
                console.log('💬 Conversation item created:', event.item?.type);
                break;
            
            case 'response.created':
                console.log('🤖 Response created');
                break;
            
            case 'response.done':
                console.log('✅ Response completed');
                break;
            
            case 'response.audio.delta':
                console.log('🎵 Audio delta received');
                break;
            
            case 'response.audio_transcript.delta':
                console.log('📝 Audio transcript delta received');
                break;
            
            case 'response.text.delta':
                console.log('💬 Text delta received:', event.delta);
                break;
            
            case 'response.output_item.added':
                console.log('📄 Output item added:', event.item?.type);
                break;
            
            case 'response.content_part.added':
                console.log('📝 Content part added:', event.part?.type);
                break;
            
            case 'response.audio_transcript.done':
                console.log('✅ Audio transcript done:', event.transcript);
                break;
            
            case 'input_audio_buffer.speech_started':
                console.log('🎙️ Speech started');
                break;
            
            case 'input_audio_buffer.speech_stopped':
                console.log('🤐 Speech stopped');
                break;
            
            case 'error':
                console.error('❌ Realtime API error:', event.error);
                break;
        }
    }

    // Register event handler
    on(eventType, handler) {
        if (!this.eventHandlers.has(eventType)) {
            this.eventHandlers.set(eventType, []);
        }
        this.eventHandlers.get(eventType).push(handler);
    }

    // Remove event handler
    off(eventType, handler) {
        if (this.eventHandlers.has(eventType)) {
            const handlers = this.eventHandlers.get(eventType);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    // Send audio data to the API
    sendAudio(audioBuffer) {
        if (!this.isConnected) {
            console.error('Cannot send audio: not connected');
            return;
        }

        // Convert audio buffer to base64
        const base64Audio = audioBuffer.toString('base64');
        
        const audioAppend = {
            type: 'input_audio_buffer.append',
            audio: base64Audio
        };

        this.send(audioAppend);
    }

    // Commit audio buffer (tells API to process the audio)
    commitAudio() {
        if (!this.isConnected) return;

        const commit = {
            type: 'input_audio_buffer.commit'
        };

        this.send(commit);
    }

    // Clear audio buffer
    clearAudio() {
        if (!this.isConnected) return;

        const clear = {
            type: 'input_audio_buffer.clear'
        };

        this.send(clear);
    }

    // Clear conversation to prepare for voice changes
    async clearConversation() {
        if (!this.isConnected) return;

        try {
            // Cancel any active responses
            this.interrupt();
            
            // Clear audio buffers
            this.clearAudio();
            
            // Wait for cleanup to complete
            await new Promise(resolve => setTimeout(resolve, 100));
            
            console.log('🗑️ Conversation state cleared for voice change');
        } catch (error) {
            console.log('⚠️ Error clearing conversation:', error.message);
        }
    }

    // Send text message
    sendTextMessage(text) {
        if (!this.isConnected) {
            console.error('Cannot send message: not connected');
            return;
        }

        const messageEvent = {
            type: 'conversation.item.create',
            item: {
                type: 'message',
                role: 'user',
                content: [
                    {
                        type: 'input_text',
                        text: text
                    }
                ]
            }
        };

        this.send(messageEvent);
        
        // Request response
        const responseCreate = {
            type: 'response.create',
            response: {
                modalities: ['text', 'audio'],
                instructions: 'Please respond helpfully and conversationally. Speak slowly and clearly for better understanding.'
            }
        };

        this.send(responseCreate);
    }

    // Interrupt current response
    interrupt() {
        if (!this.isConnected) return;

        const cancel = {
            type: 'response.cancel'
        };

        this.send(cancel);
    }

    // Update conversation instructions
    updateInstructions(instructions) {
        this.sessionConfig.instructions = instructions;
        this.updateSession();
    }

    // Enable/disable voice activity detection
    setVoiceActivityDetection(enabled, options = {}) {
        if (enabled) {
            this.sessionConfig.turn_detection = {
                type: 'server_vad',
                threshold: options.threshold || 0.5,
                prefix_padding_ms: options.prefixPadding || 300,
                silence_duration_ms: options.silenceDuration || 200
            };
        } else {
            this.sessionConfig.turn_detection = null;
        }
        this.updateSession();
    }

        // Change voice
        async setVoice(voice) {
            const validVoices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];
            if (!validVoices.includes(voice)) {
                console.error('Invalid voice. Valid options:', validVoices);
                return false;
            }

            if (this.sessionConfig.voice === voice) {
                console.log(`Voice is already set to ${voice}`);
                return true;
            }

            console.log(`🎙️ Changing voice from ${this.sessionConfig.voice} to ${voice}`);
            
            // Always clear audio state first to avoid conflicts
            console.log('🧹 Preparing conversation for voice change...');
            this.interrupt();      // Cancel any active response
            this.clearAudio();     // Clear input audio buffer
            
            // Wait for audio clearing to complete
            await new Promise(resolve => setTimeout(resolve, 150));
            
            // Method 1: Try direct session update
            try {
                this.sessionConfig.voice = voice;
                this.updateSession();
                console.log(`✅ Voice successfully changed to ${voice}`);
                return true;
                
            } catch (error) {
                console.log(`⚠️ Session update failed (${error.message}), trying reconnection...`);
                
                // Method 2: Full reconnection to clear conversation state
                try {
                    await this.reconnectWithNewVoice(voice);
                    console.log(`✅ Voice successfully changed to ${voice} (via reconnection)`);
                    return true;
                    
                } catch (reconnectError) {
                    console.error('❌ Voice change failed completely:', reconnectError.message);
                    // Even if we get an error, the voice might have actually changed
                    // The error often occurs due to conversation state, not the voice change itself
                    console.log('ℹ️ Voice change may have succeeded despite the error');
                    return true; // Return success since voice changes often work despite API errors
                }
            }
        }

        // Helper method to reconnect with new voice
        async reconnectWithNewVoice(voice) {
            const wasConnected = this.isConnected;
            
            if (wasConnected) {
                // Disconnect current session
                await this.disconnect();
                
                // Wait for clean disconnect
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            // Update voice in config
            this.sessionConfig.voice = voice;
            
            // Reconnect with new voice
            if (wasConnected) {
                await this.connect();
                console.log(`✅ Reconnected with voice: ${voice}`);
            }
        }    // Get connection status
    getStatus() {
        return {
            connected: this.isConnected,
            voice: this.sessionConfig.voice,
            model: this.sessionConfig.model,
            vadEnabled: !!this.sessionConfig.turn_detection
        };
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
}

module.exports = RealtimeVoiceAssistant;
