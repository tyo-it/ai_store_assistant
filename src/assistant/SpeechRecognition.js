const fs = require('fs');
const path = require('path');
const wav = require('node-wav');

class SpeechRecognition {
    constructor() {
        this.isGoogleCloudAvailable = false;
        this.initializeGoogleCloud();
    }

    async initializeGoogleCloud() {
        try {
            // Try to initialize Google Cloud Speech-to-Text
            const speech = require('@google-cloud/speech');
            this.speechClient = new speech.SpeechClient();
            this.isGoogleCloudAvailable = true;
            console.log('Google Cloud Speech-to-Text initialized');
        } catch (error) {
            console.log('Google Cloud Speech-to-Text not available, using fallback method');
            this.isGoogleCloudAvailable = false;
        }
    }

    async transcribe(audioBuffer) {
        try {
            if (this.isGoogleCloudAvailable) {
                return await this.transcribeWithGoogleCloud(audioBuffer);
            } else {
                return await this.transcribeWithFallback(audioBuffer);
            }
        } catch (error) {
            console.error('Transcription error:', error);
            throw new Error('Failed to transcribe audio');
        }
    }

    async transcribeWithGoogleCloud(audioBuffer) {
        try {
            // Configure the request
            const request = {
                audio: {
                    content: audioBuffer.toString('base64'),
                },
                config: {
                    encoding: 'WEBM_OPUS',
                    sampleRateHertz: 16000,
                    languageCode: 'en-US',
                    alternativeLanguageCodes: ['en-GB', 'en-AU'],
                    enableAutomaticPunctuation: true,
                    model: 'latest_short'
                },
            };

            // Perform the speech recognition request
            const [response] = await this.speechClient.recognize(request);
            const transcription = response.results
                .map(result => result.alternatives[0].transcript)
                .join('\n');

            return transcription;
        } catch (error) {
            console.error('Google Cloud transcription error:', error);
            throw error;
        }
    }

    async transcribeWithFallback(audioBuffer) {
        // Fallback method for when Google Cloud is not available
        // In a real implementation, you might use other services like:
        // - OpenAI Whisper API
        // - Azure Speech Services
        // - Amazon Transcribe
        // - Local speech recognition libraries
        
        console.log('Using fallback transcription method');
        
        // For demo purposes, return a placeholder
        // In production, implement actual speech recognition here
        return "Hello, this is a placeholder transcription. Please configure a speech recognition service.";
    }

    // Method to handle different audio formats
    processAudioData(audioData, format = 'wav') {
        try {
            switch (format.toLowerCase()) {
                case 'wav':
                    const result = wav.decode(audioData);
                    return {
                        audioBuffer: audioData,
                        sampleRate: result.sampleRate,
                        channels: result.channelData.length
                    };
                case 'webm':
                case 'opus':
                    // Handle WebM/Opus format (common in browsers)
                    return {
                        audioBuffer: audioData,
                        sampleRate: 16000, // Default
                        channels: 1
                    };
                default:
                    return {
                        audioBuffer: audioData,
                        sampleRate: 16000,
                        channels: 1
                    };
            }
        } catch (error) {
            console.error('Audio processing error:', error);
            throw new Error('Failed to process audio data');
        }
    }
}

module.exports = SpeechRecognition;
