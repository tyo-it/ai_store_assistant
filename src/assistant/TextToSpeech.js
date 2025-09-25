const fs = require('fs');
const path = require('path');

class TextToSpeech {
    constructor() {
        this.isGoogleCloudAvailable = false;
        this.isSayAvailable = false;
        this.initializeServices();
    }

    async initializeServices() {
        try {
            // Try to initialize Google Cloud Text-to-Speech
            const textToSpeech = require('@google-cloud/text-to-speech');
            this.ttsClient = new textToSpeech.TextToSpeechClient();
            this.isGoogleCloudAvailable = true;
            console.log('Google Cloud Text-to-Speech initialized');
        } catch (error) {
            console.log('Google Cloud Text-to-Speech not available');
        }

        try {
            // Check if 'say' module is available (for local TTS)
            this.say = require('say');
            this.isSayAvailable = true;
            console.log('Local TTS (say) initialized');
        } catch (error) {
            console.log('Local TTS (say) not available');
        }
    }

    async synthesize(text, options = {}) {
        try {
            const synthesisOptions = {
                voice: options.voice || 'en-US-Standard-A',
                speed: options.speed || 1.0,
                pitch: options.pitch || 0,
                ...options
            };

            if (this.isGoogleCloudAvailable) {
                return await this.synthesizeWithGoogleCloud(text, synthesisOptions);
            } else if (this.isSayAvailable) {
                return await this.synthesizeWithSay(text, synthesisOptions);
            } else {
                return await this.synthesizeWithFallback(text, synthesisOptions);
            }
        } catch (error) {
            console.error('TTS synthesis error:', error);
            throw new Error('Failed to synthesize speech');
        }
    }

    async synthesizeWithGoogleCloud(text, options) {
        try {
            const request = {
                input: { text: text },
                voice: {
                    languageCode: 'en-US',
                    name: options.voice,
                    ssmlGender: 'NEUTRAL'
                },
                audioConfig: {
                    audioEncoding: 'MP3',
                    speakingRate: options.speed,
                    pitch: options.pitch
                },
            };

            const [response] = await this.ttsClient.synthesizeSpeech(request);
            
            return {
                type: 'audio',
                format: 'mp3',
                data: response.audioContent.toString('base64'),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Google Cloud TTS error:', error);
            throw error;
        }
    }

    async synthesizeWithSay(text, options) {
        return new Promise((resolve, reject) => {
            try {
                // Use local system TTS
                this.say.speak(text, options.voice || null, options.speed || 1.0, (err) => {
                    if (err) {
                        console.error('Say TTS error:', err);
                        reject(err);
                    } else {
                        resolve({
                            type: 'audio',
                            format: 'system',
                            message: 'Audio played via system TTS',
                            timestamp: new Date().toISOString()
                        });
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    async synthesizeWithFallback(text, options) {
        // Fallback method when no TTS service is available
        console.log('TTS Fallback - Text to speak:', text);
        
        return {
            type: 'text',
            format: 'fallback',
            data: text,
            message: 'TTS service not available - returning text',
            timestamp: new Date().toISOString()
        };
    }

    // Method to save audio to file (useful for debugging)
    async saveAudioToFile(audioData, filename) {
        try {
            const audioDir = path.join(process.cwd(), 'temp', 'audio');
            
            // Create directory if it doesn't exist
            if (!fs.existsSync(audioDir)) {
                fs.mkdirSync(audioDir, { recursive: true });
            }

            const filePath = path.join(audioDir, filename);
            
            if (audioData.format === 'mp3') {
                const buffer = Buffer.from(audioData.data, 'base64');
                fs.writeFileSync(filePath, buffer);
            }
            
            console.log(`Audio saved to: ${filePath}`);
            return filePath;
        } catch (error) {
            console.error('Error saving audio file:', error);
            throw error;
        }
    }

    // Get available voices (Google Cloud)
    async getAvailableVoices() {
        if (!this.isGoogleCloudAvailable) {
            return ['system-default'];
        }

        try {
            const [result] = await this.ttsClient.listVoices({});
            const voices = result.voices;
            
            return voices.map(voice => ({
                name: voice.name,
                language: voice.languageCodes[0],
                gender: voice.ssmlGender
            }));
        } catch (error) {
            console.error('Error getting voices:', error);
            return ['en-US-Standard-A', 'en-US-Standard-B'];
        }
    }
}

module.exports = TextToSpeech;
