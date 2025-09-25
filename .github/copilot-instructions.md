# OpenAI Realtime Voice AI Assistant

This project is a Node.js-based voice AI assistant using OpenAI's Realtime API for native voice-to-voice conversations.

## Project Overview

- **Technology Stack**: Node.js, Express, Socket.IO, OpenAI Realtime API
- **Features**: Real-time voice conversation, multiple AI voices, web interface
- **Architecture**: WebSocket-based streaming audio with PCM16 format
- **API Integration**: OpenAI GPT-4o Realtime Preview model

## Key Components

- `src/index.js`: Main server with WebSocket handling for real-time audio streaming
- `src/assistant/RealtimeVoiceAssistant.js`: Core OpenAI Realtime API integration
- `public/index.html`: Modern web interface with real-time audio processing
- Environment configured for OpenAI Realtime API with GPT-4o model

## Development Notes

- Requires OpenAI API key with Realtime API access (beta program)
- Uses PCM16 audio format at 24kHz sample rate for optimal quality
- WebSocket streaming for low-latency voice communication
- Voice Activity Detection (VAD) for natural conversation flow
- Support for 6 different AI voices and conversation interruption

## Setup Complete

All project components have been successfully created and configured. Add your OpenAI API key to `.env` file and run `npm start` to launch the voice assistant.
