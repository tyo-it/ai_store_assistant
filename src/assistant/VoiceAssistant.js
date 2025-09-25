const OpenAI = require('openai');
const SpeechRecognition = require('./SpeechRecognition');
const TextToSpeech = require('./TextToSpeech');

class VoiceAssistant {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        this.speechRecognition = new SpeechRecognition();
        this.textToSpeech = new TextToSpeech();
        
        this.conversationHistory = [];
        this.isListening = false;
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
            
            // Convert response to speech
            const audioResponse = await this.textToSpeech.synthesize(aiResponse.text);
            
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
                        content: 'You are a helpful AI assistant with voice capabilities. Provide concise, helpful responses suitable for both text and speech output.'
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
}

module.exports = VoiceAssistant;
