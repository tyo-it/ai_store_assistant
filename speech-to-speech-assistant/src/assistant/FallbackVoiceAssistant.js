const OpenAI = require('openai');

class FallbackVoiceAssistant {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        this.conversationHistory = [];
        this.isConnected = false;
        this.eventHandlers = new Map();
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

    disconnect() {
        this.isConnected = false;
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
                        content: 'You are a helpful AI assistant. Please respond ONLY in Bahasa Indonesia. Provide concise, helpful responses suitable for both text and speech output. Keep responses conversational and under 150 words. When your response will be spoken aloud, structure it with natural pauses and clear pronunciation in mind. Use simple, clear Indonesian language that can be easily understood when spoken slowly and distinctly. Always use Indonesian language - never use English.'
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
