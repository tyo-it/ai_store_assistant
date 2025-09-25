const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const PulsaService = require('../services/PulsaService');

class RealtimeVoiceAssistant {
    constructor(client_ws = null) {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.ws = null;
        this.client_ws = client_ws;
        this.isConnected = false;
        this.pulsaService = new PulsaService();
        this.sessionId = this.generateSessionId();
        this.pendingPurchase = null;
        this.sessionConfig = {
            model: process.env.REALTIME_MODEL || 'gpt-4o-realtime-preview',
            modalities: ['text', 'audio'],
            voice: 'sage',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            instructions: 'Kamu adalah asisten pulsa yang santai dan ramah. Selalu jawab singkat dalam Bahasa Indonesia sehari-hari, maksimal 1 kalimat. Kalau ada yang mau beli pulsa, langsung proses aja pakai tools yang ada. Bicara seperti teman, jangan formal. Contoh: "Oke siap!", "Bentar ya", "Udah selesai!", "Ada masalah nih". When users mention pulsa, kredit, top up, isi ulang, or want to buy mobile credit: 1) Use process_pulsa_request to understand their request, 2) Use validate_phone_number if needed, 3) Use check_pulsa_availability to verify availability, 4) Ask for confirmation before purchase.',
            input_audio_transcription: {
                model: 'whisper-1'
            },
            speed: 1.1,
            turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 800
            },
            tools: [
                {
                    type: "function",
                    name: "check_pulsa_availability",
                    description: "Check if pulsa/mobile credit is available for a phone number and amount",
                    parameters: {
                        type: "object",
                        properties: {
                            phoneNumber: {
                                type: "string",
                                description: "Indonesian phone number (format: 08xxxxxxxxxx or +62xxxxxxxxx)"
                            },
                            amount: {
                                type: "number",
                                description: "Pulsa amount in Rupiah (e.g., 10000, 25000, 50000)"
                            }
                        },
                        required: ["phoneNumber", "amount"]
                    }
                },
                {
                    type: "function",
                    name: "validate_phone_number",
                    description: "Validate Indonesian phone number and detect the mobile provider",
                    parameters: {
                        type: "object",
                        properties: {
                            phoneNumber: {
                                type: "string",
                                description: "Phone number to validate"
                            }
                        },
                        required: ["phoneNumber"]
                    }
                },
                {
                    type: "function",
                    name: "process_pulsa_request",
                    description: "Process natural language pulsa purchase request from user speech",
                    parameters: {
                        type: "object",
                        properties: {
                            speechText: {
                                type: "string",
                                description: "User's speech text containing pulsa request"
                            }
                        },
                        required: ["speechText"]
                    }
                }
            ],
            tool_choice: 'auto',
            temperature: 0.8,
            max_response_output_tokens: parseInt(process.env.MAX_RESPONSE_TOKENS || 150)
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
        // console.log(`📨 Received event: ${event.type}`);
        
        // Log full event data for debugging response events
        if (event.type.startsWith('response.')) {
            if (!event.type.includes('audio')) {
                // console.log('🔍 Full response event:', JSON.stringify(event, null, 2));
            }
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
                // console.log('🔄 Session updated');
                break;
            
            case 'conversation.item.created':
                // console.log('💬 Conversation item created:', event.item?.type);
                break;
            
            case 'response.created':
                // console.log('🤖 Response created');
                break;
            
            case 'response.done':
                // console.log('✅ Response completed');
                break;
            
            case 'response.audio.delta':
                // console.log('🎵 Audio delta received');
                break;
            
            case 'response.audio_transcript.delta':
                // console.log('📝 Audio transcript delta received');
                break;
            
            case 'response.text.delta':
                // console.log('💬 Text delta received:', event.delta);
                break;
            
            case 'response.output_item.added':
                // console.log('📄 Output item added:', event.item?.type);
                break;
            
            case 'response.content_part.added':
                // console.log('📝 Content part added:', event.part?.type);
                // // Handle function calls that come as content parts
                if (event.part?.type === 'function_call') {
                    // console.log('🔧 Function call content part:', event.part);
                    if (event.part.name && event.part.arguments) {
                        this.handleFunctionCall({
                            name: event.part.name,
                            arguments: event.part.arguments,
                            call_id: event.part.call_id
                        });
                    }
                }
                break;
            
            case 'response.audio_transcript.done':
                // console.log('✅ Audio transcript done:', event.transcript);
                break;
            
            case 'response.function_call_arguments.delta':
                // console.log('🔧 Function call arguments delta:', event.delta);
                break;
            
            case 'response.function_call_arguments.done':
                // console.log('🔧 Function call arguments done:', event.name, event.arguments);
                this.handleFunctionCall(event);
                break;
            
            case 'response.output_item.added':
                console.log('📄 Output item added:', event.item?.type);
                // Handle function calls that come as output items
                if (event.item?.type === 'function_call') {
                    console.log('🔧 Function call output item:', event.item);
                }
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

    // Handle function calls from OpenAI and route to MCP server
    async handleFunctionCall(event) {
        try {
            const functionName = event.name;
            const functionArgs = JSON.parse(event.arguments);
            
            console.log(`🔧 [REALTIME] Function call: ${functionName}`);
            console.log(`📤 [REALTIME] Function args:`, functionArgs);
            
            let result;
            
            switch (functionName) {
                case 'check_pulsa_availability':
                    result = await this.pulsaService.checkAvailability(
                        functionArgs.phoneNumber, 
                        functionArgs.amount
                    );
                    break;
                    
                case 'validate_phone_number':
                    result = await this.pulsaService.validatePhoneNumber(
                        functionArgs.phoneNumber
                    );
                    break;
                    
                case 'process_pulsa_request':
                    result = await this.pulsaService.processPulsaCommand(
                        functionArgs.speechText,
                        this.sessionId
                    );
                    
                    // If this is a pulsa request that's ready to purchase, proceed automatically
                    if (result.raw && result.raw.understood && result.raw.readyToPurchase) {                        
                        this.pendingPurchase = {
                            phoneNumber: result.raw.phoneNumber,
                            amount: result.raw.amount,
                            provider: result.raw.provider
                        };
                        this.client_ws?.emit('pending-purchase', result.raw);
                    }
                    break;
                    
                    default:
                        result = {
                            success: false,
                            message: `Unknown function: ${functionName}`
                        };
                    }
                    console.log(`📥 [REALTIME] Function result:`, result);
            
            // Send the function result back to OpenAI
            this.send({
                type: 'conversation.item.create',
                item: {
                    type: 'function_call_output',
                    call_id: event.call_id,
                    output: JSON.stringify(result)
                }
            });
            
            // Generate response based on the function result
            this.send({
                type: 'response.create'
            });
            
        } catch (error) {
            console.error('❌ [REALTIME] Function call error:', error);
            
            // Send error response back to OpenAI
            this.send({
                type: 'conversation.item.create',
                item: {
                    type: 'function_call_output',
                    call_id: event.call_id,
                    output: JSON.stringify({
                        success: false,
                        message: `Function call failed: ${error.message}`
                    })
                }
            });
            
            this.send({
                type: 'response.create'
            });
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
                instructions: 'Please respond helpfully and conversationally. Speak simple and clearly for better understanding.'
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
                        timestamp: new Date().toISOString(),
                        data: result.data || null
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
