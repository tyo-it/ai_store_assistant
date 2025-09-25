const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const RealtimeVoiceAssistant = require('./assistant/RealtimeVoiceAssistant');
const FallbackVoiceAssistant = require('./assistant/FallbackVoiceAssistant');
require('dotenv').config();

class AIAssistantApp {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        this.port = process.env.PORT || 3000;
        this.realtimeAssistant = new RealtimeVoiceAssistant();
        this.clientSessions = new Map(); // Track client sessions

        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketHandlers();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static('public'));
    }

    setupRoutes() {
        this.app.get('/', (req, res) => {
            res.json({
                message: 'Voice AI Assistant is running!',
                status: 'active',
                endpoints: {
                    health: '/health',
                    voice: '/voice',
                    chat: '/chat'
                }
            });
        });

        this.app.get('/health', (req, res) => {
            res.json({ status: 'healthy', timestamp: new Date().toISOString() });
        });

        this.app.post('/chat', async (req, res) => {
            try {
                const { message } = req.body;
                // For REST API, we'll need a separate session
                // In practice, use WebSocket for realtime features
                res.json({
                    response: 'Please use the WebSocket connection for real-time voice chat',
                    suggestion: 'Use the web interface for full voice capabilities'
                });
            } catch (error) {
                console.error('Chat error:', error);
                res.status(500).json({ error: 'Failed to process message' });
            }
        });

        // Payment page route
        this.app.get('/payment/:unique_id', (req, res) => {
            res.sendFile('payment.html', { root: './public' });
        });

        // Payment API endpoint
        this.app.post('/api/v1/transactions/recharges/pay', async (req, res) => {
            try {
                const { unique_id } = req.body;

                if (!unique_id) {
                    return res.status(400).json({
                        error: 'Missing required field: unique_id',
                        message: 'unique_id is required for payment processing'
                    });
                }

                console.log(`💳 Processing payment for unique_id: ${unique_id}`);

                // Here you would integrate with your actual payment microservice
                // For now, we'll simulate the API call
                const paymentResult = await this.processPayment(unique_id);

                if (paymentResult.success) {
                    console.log(`✅ Payment successful for unique_id: ${unique_id}`);
                    res.json({
                        success: true,
                        message: 'Payment processed successfully',
                        unique_id: unique_id,
                        transaction_id: paymentResult.transaction_id,
                        timestamp: new Date().toISOString()
                    });
                } else {
                    console.log(`❌ Payment failed for unique_id: ${unique_id}`);
                    res.status(400).json({
                        success: false,
                        error: 'Payment processing failed',
                        message: paymentResult.message || 'Payment could not be processed',
                        unique_id: unique_id
                    });
                }
            } catch (error) {
                console.error('Payment API error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Internal server error',
                    message: 'An error occurred while processing payment'
                });
            }
        });
    }

    async processPayment(unique_id) {
        const axios = require('axios');
        const fazz_backend_url = process.env.FAZZ_AGEN_BACKEND_SERVICE_URL;

        if (!fazz_backend_url) {
            console.error('FAZZ_AGEN_BACKEND_SERVICE_URL not configured');
            return {
                success: false,
                message: 'Payment service not configured'
            };
        }

        try {
            console.log(`🔄 Calling Fazz Agen Backend Service: ${fazz_backend_url}/api/v1/transactions/recharges/pay`);

            const response = await axios.post(
                `${fazz_backend_url}/api/v1/transactions/recharges/pay`,
                {
                    payment: {
                        unique_id: unique_id
                    }
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000 // 10 second timeout
                }
            );

            // Handle successful response
            if (response.status === 200 && response.data && response.data.data) {
                const paymentData = response.data.data;
                console.log(`✅ Payment successful from Fazz Agen Backend:`, paymentData);

                return {
                    success: true,
                    reference_number: paymentData.reference_number,
                    unique_id: paymentData.unique_id,
                    status: paymentData.status,
                    amount: paymentData.amount,
                    recharge_type: paymentData.recharge_type,
                    message: 'Payment processed successfully'
                };
            } else {
                console.log(`❌ Unexpected response format from Fazz Agen Backend:`, response.data);
                return {
                    success: false,
                    message: 'Invalid response from payment service'
                };
            }
        } catch (error) {
            console.error('Payment processing error:', error.message);

            // Handle HTTP errors
            if (error.response) {
                const status = error.response.status;
                const errorData = error.response.data;

                console.log(`❌ Fazz Agen Backend returned error ${status}:`, errorData);

                return {
                    success: false,
                    message: errorData?.message || `Payment service error (${status})`,
                    error_code: status
                };
            }

            // Handle network/timeout errors
            if (error.code === 'ECONNREFUSED') {
                return {
                    success: false,
                    message: 'Payment service unavailable'
                };
            }

            if (error.code === 'ETIMEDOUT') {
                return {
                    success: false,
                    message: 'Payment service timeout'
                };
            }

            return {
                success: false,
                message: 'Payment service temporarily unavailable'
            };
        }
    }

    setupSocketHandlers() {
        this.io.on('connection', async (socket) => {
            console.log('Client connected:', socket.id);

            // Try Realtime API first, fallback to regular API
            let clientAssistant;
            let usingFallback = false;

            try {
                // Try Realtime API first
                clientAssistant = new RealtimeVoiceAssistant();
                await clientAssistant.connect();
                console.log('✅ Using OpenAI Realtime API');
                socket.emit('status', {
                    connected: true,
                    message: 'Connected to OpenAI Realtime API',
                    mode: 'realtime',
                    speechRate: parseFloat(process.env.SPEECH_RATE) || 1,
                    speechPitch: parseFloat(process.env.SPEECH_PITCH) || 0
                });
            } catch (realtimeError) {
                console.log('⚠️ Realtime API not available, using fallback mode');

                // Use fallback assistant
                clientAssistant = new FallbackVoiceAssistant();
                await clientAssistant.connect();
                usingFallback = true;
                console.log('✅ Using OpenAI Chat API (fallback mode)');
                socket.emit('status', {
                    connected: true,
                    message: 'Connected to OpenAI Chat API (Fallback Mode)',
                    mode: 'fallback',
                    speechRate: parseFloat(process.env.SPEECH_RATE) || 1,
                    speechPitch: parseFloat(process.env.SPEECH_PITCH) || 0
                });
            }

            this.clientSessions.set(socket.id, { assistant: clientAssistant, usingFallback });

            // Set up event handlers for this client's assistant
            if (usingFallback) {
                this.setupFallbackHandlers(clientAssistant, socket);
            } else {
                this.setupRealtimeHandlers(clientAssistant, socket);
            }

            // Handle audio streaming from client
            socket.on('audio-stream', (audioData) => {
                const clientSession = this.clientSessions.get(socket.id);
                if (clientSession && clientSession.assistant && clientSession.assistant.isConnected) {
                    // Convert incoming audio data to buffer
                    const audioBuffer = Buffer.from(audioData, 'base64');
                    clientSession.assistant.sendAudio(audioBuffer);
                }
            });

            // Handle audio stream end
            socket.on('audio-stream-end', () => {
                const clientSession = this.clientSessions.get(socket.id);
                if (clientSession && clientSession.assistant && clientSession.assistant.isConnected) {
                    clientSession.assistant.commitAudio();
                }
            });

            // Handle text messages
            socket.on('text-message', async (message) => {
                const clientSession = this.clientSessions.get(socket.id);
                if (clientSession && clientSession.assistant && clientSession.assistant.isConnected) {
                    if (clientSession.assistant.sendTextMessage) {
                        // Realtime API
                        clientSession.assistant.sendTextMessage(message);
                    } else if (clientSession.assistant.processTextMessage) {
                        // Fallback API
                        try {
                            await clientSession.assistant.processTextMessage(message);
                        } catch (error) {
                            socket.emit('error', 'Failed to process message: ' + error.message);
                        }
                    }
                }
            });

            // Handle voice settings changes
            socket.on('change-voice', async (voice) => {
                const clientSession = this.clientSessions.get(socket.id);
                if (clientSession && clientSession.assistant && clientSession.assistant.isConnected) {
                    try {
                        console.log(`🎙️ Voice change request from client: ${voice}`);
                        socket.emit('status', { message: `Clearing audio and changing voice to ${voice}...` });

                        const success = await clientSession.assistant.setVoice(voice);

                        if (success) {
                            console.log(`✅ Voice change successful: ${voice}`);
                            socket.emit('status', {
                                message: `Voice successfully changed to ${voice}`,
                                connected: true,
                                mode: clientSession.usingFallback ? 'fallback' : 'realtime',
                                speechRate: parseFloat(process.env.SPEECH_RATE) || 1,
                                speechPitch: parseFloat(process.env.SPEECH_PITCH) || 0
                            });
                        } else {
                            console.log(`❌ Voice change failed: ${voice}`);
                            socket.emit('error', `Failed to change voice to ${voice}. Please try again.`);
                        }
                    } catch (error) {
                        console.error('Voice change error:', error.message);
                        if (error.message.includes('assistant audio is present')) {
                            socket.emit('error', `Voice change partially failed: Audio is still present. Voice may have changed despite the error.`);
                        } else {
                            socket.emit('error', `Voice change failed: ${error.message}`);
                        }
                    }
                } else {
                    socket.emit('error', 'Assistant not connected');
                }
            });

            // Handle pulsa confirmation
            socket.on('pulsa-confirmation', async (data) => {
                const clientSession = this.clientSessions.get(socket.id);
                if (clientSession && clientSession.assistant) {
                    try {
                        const response = await clientSession.assistant.confirmPulsaPurchase(data.confirmed);
                        if (response) {
                            socket.emit('text-response', {
                                type: 'text-complete',
                                text: response.text
                            });

                            // Also generate audio response
                            if (clientSession.assistant.textToSpeech) {
                                const audioResponse = await clientSession.assistant.textToSpeech.synthesize(response.text, {
                                    speed: parseFloat(process.env.SPEECH_RATE) || 1,
                                    pitch: parseFloat(process.env.SPEECH_PITCH) || 0
                                });

                                socket.emit('audio-response', {
                                    type: 'audio-complete',
                                    audio: audioResponse
                                });
                            }
                        }
                    } catch (error) {
                        console.error('Error handling pulsa confirmation:', error);
                        socket.emit('error', 'Failed to process pulsa confirmation');
                    }
                }
            });

            // Handle interruption
            socket.on('interrupt', () => {
                const clientSession = this.clientSessions.get(socket.id);
                if (clientSession && clientSession.assistant && clientSession.assistant.isConnected) {
                    clientSession.assistant.interrupt();
                }
            });

            // Handle disconnect
            socket.on('disconnect', async () => {
                console.log('Client disconnected:', socket.id);
                const clientSession = this.clientSessions.get(socket.id);
                if (clientSession && clientSession.assistant) {
                    if (clientSession.assistant.disconnect) {
                        await clientSession.assistant.disconnect();
                    }
                    this.clientSessions.delete(socket.id);
                }
            });
        });
    }

    setupRealtimeHandlers(assistant, socket) {
        // Handle audio responses from OpenAI
        assistant.on('response.audio.delta', (event) => {
            socket.emit('audio-response', {
                type: 'audio-delta',
                audio: event.delta
            });
        });

        // Handle text responses from OpenAI
        assistant.on('response.text.delta', (event) => {
            socket.emit('text-response', {
                type: 'text-delta',
                text: event.delta
            });
        });

        // Handle output item added (contains the response content)
        assistant.on('response.output_item.added', (event) => {
            console.log('📦 Output item added:', event);
            if (event.item && event.item.content) {
                event.item.content.forEach(content => {
                    if (content.type === 'text' && content.text) {
                        socket.emit('text-response', {
                            type: 'text-complete',
                            text: content.text
                        });
                    }
                });
            }
        });

        // Handle content part added
        assistant.on('response.content_part.added', (event) => {
            console.log('📝 Content part added:', event);
            if (event.part && event.part.type === 'text' && event.part.text) {
                socket.emit('text-response', {
                    type: 'text-delta',
                    text: event.part.text
                });
            }
        });

        // Handle response completion
        assistant.on('response.done', (event) => {
            socket.emit('response-complete', {
                type: 'response-done',
                response: event.response
            });
        });

        // Handle speech detection
        assistant.on('input_audio_buffer.speech_started', (event) => {
            socket.emit('speech-status', {
                type: 'speech-started',
                message: 'Listening...'
            });
        });

        assistant.on('input_audio_buffer.speech_stopped', (event) => {
            socket.emit('speech-status', {
                type: 'speech-stopped',
                message: 'Processing...'
            });
        });

        // Handle transcription
        assistant.on('conversation.item.input_audio_transcription.completed', (event) => {
            socket.emit('transcription', {
                type: 'transcription',
                text: event.transcript
            });
        });

        // Handle AI response audio transcript
        assistant.on('response.audio_transcript.done', (event) => {
            console.log('✅ Audio transcript done:', event.transcript);
            socket.emit('text-response', {
                type: 'text-complete',
                text: event.transcript
            });
        });

        // Handle errors
        assistant.on('error', (event) => {
            socket.emit('error', event.error.message || 'An error occurred');
        });
    }

    setupFallbackHandlers(assistant, socket) {
        // Handle text responses (complete responses, not streaming)
        assistant.on('response.text.complete', async (event) => {
            // Send text response first
            socket.emit('text-response', {
                type: 'text-complete',
                text: event.text
            });

            // Apply TTS to convert text to speech
            try {
                const TextToSpeech = require('./assistant/TextToSpeech');
                const tts = new TextToSpeech();

                console.log('🔊 Converting AI response to speech:', event.text);
                const audioResponse = await tts.synthesize(event.text, {
                    speed: parseFloat(process.env.SPEECH_RATE) || 0.6,
                    pitch: parseFloat(process.env.SPEECH_PITCH) || 0
                });

                // Send audio response to client
                socket.emit('audio-response', {
                    type: 'audio-complete',
                    audio: audioResponse,
                    text: event.text
                });

                console.log('✅ Audio response sent to client');
            } catch (error) {
                console.error('❌ TTS Error:', error.message);
                // Still send a fallback message even if TTS fails
                socket.emit('audio-response', {
                    type: 'audio-fallback',
                    message: 'Text-to-speech not available',
                    text: event.text
                });
            }
        });

        // Handle response completion
        assistant.on('response.done', (event) => {
            socket.emit('response-complete', {
                type: 'response-done',
                response: event.response
            });
        });

        // Handle audio processing (browser-side)
        assistant.on('audio.received', (event) => {
            socket.emit('speech-status', {
                type: 'audio-received',
                message: 'Audio received, processing with browser speech recognition...'
            });
        });

        assistant.on('audio.committed', (event) => {
            socket.emit('speech-status', {
                type: 'audio-committed',
                message: 'Processing audio...'
            });
        });

        // Handle voice changes (browser-side)
        assistant.on('voice.changed', (event) => {
            socket.emit('status', {
                message: `Voice changed to ${event.voice} (browser synthesis)`
            });
        });

        // Handle errors
        assistant.on('error', (event) => {
            socket.emit('error', event.error || 'An error occurred');
        });
    }

    start() {
        this.server.listen(this.port, () => {
            console.log(`🚀 Voice AI Assistant running on port ${this.port}`);
            console.log(`📡 WebSocket server ready for voice commands`);
            console.log(`🌐 Visit http://localhost:${this.port} to get started`);
        });
    }
}

// Start the application
const app = new AIAssistantApp();
app.start();

module.exports = AIAssistantApp;
