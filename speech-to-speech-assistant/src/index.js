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
    }

    setupSocketHandlers() {
        this.io.on('connection', async (socket) => {
            console.log('Client connected:', socket.id);

            // Try Realtime API first, fallback to regular API
            let clientAssistant;
            let usingFallback = true;

            try {
                // Try Realtime API first
                clientAssistant = new FallbackVoiceAssistant();
                await clientAssistant.connect();
                console.log('✅ Using OpenAI Realtime API');
                socket.emit('status', { 
                    connected: true, 
                    message: 'Connected to OpenAI Realtime API',
                    mode: 'realtime',
                    speechRate: parseFloat(process.env.SPEECH_RATE) || 0.5,
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
                    speechRate: parseFloat(process.env.SPEECH_RATE) || 0.5,
                    speechPitch: parseFloat(process.env.SPEECH_PITCH) || 0
                });
            }

            this.clientSessions.set(socket.id, clientAssistant);

            // Set up event handlers for this client's assistant
            if (usingFallback) {
                this.setupFallbackHandlers(clientAssistant, socket);
            } else {
                this.setupRealtimeHandlers(clientAssistant, socket);
            }

            // Handle audio streaming from client
            socket.on('audio-stream', (audioData) => {
                const assistant = this.clientSessions.get(socket.id);
                if (assistant && assistant.isConnected) {
                    // Convert incoming audio data to buffer
                    const audioBuffer = Buffer.from(audioData, 'base64');
                    assistant.sendAudio(audioBuffer);
                }
            });

            // Handle audio stream end
            socket.on('audio-stream-end', () => {
                const assistant = this.clientSessions.get(socket.id);
                if (assistant && assistant.isConnected) {
                    assistant.commitAudio();
                }
            });

            // Handle text messages
            socket.on('text-message', async (message) => {
                const assistant = this.clientSessions.get(socket.id);
                if (assistant && assistant.isConnected) {
                    if (assistant.sendTextMessage) {
                        // Realtime API
                        assistant.sendTextMessage(message);
                    } else if (assistant.processTextMessage) {
                        // Fallback API
                        try {
                            await assistant.processTextMessage(message);
                        } catch (error) {
                            socket.emit('error', 'Failed to process message: ' + error.message);
                        }
                    }
                }
            });

            // Handle voice settings changes
            socket.on('change-voice', (voice) => {
                const assistant = this.clientSessions.get(socket.id);
                if (assistant && assistant.isConnected) {
                    assistant.setVoice(voice);
                    socket.emit('status', { message: `Voice changed to ${voice}` });
                }
            });

            // Handle interruption
            socket.on('interrupt', () => {
                const assistant = this.clientSessions.get(socket.id);
                if (assistant && assistant.isConnected) {
                    assistant.interrupt();
                }
            });

            // Handle disconnect
            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
                const assistant = this.clientSessions.get(socket.id);
                if (assistant) {
                    assistant.disconnect();
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
