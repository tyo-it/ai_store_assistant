# OpenAI Realtime Voice AI Assistant

A cutting-edge Node.js-based voice AI assistant powered by OpenAI's Realtime API, featuring native voice-to-voice conversations with minimal latency.

## Features

- 🎤 **Native Voice-to-Voice**: Direct audio communication with OpenAI's Realtime API
- ⚡ **Ultra-Low Latency**: Real-time conversation with ~300ms response time
- �️ **Natural Speech**: 6 different AI voices (Alloy, Echo, Fable, Onyx, Nova, Shimmer)
- � **Advanced AI**: Powered by GPT-4o Realtime Preview model
- 🌐 **Modern Web Interface**: Responsive browser-based UI
- 📡 **WebSocket Streaming**: Real-time audio streaming
- 🎛️ **Voice Activity Detection**: Automatic speech start/stop detection
- 🔄 **Interruption Support**: Natural conversation flow with interruptions

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- **OpenAI API key with Realtime API access** (GPT-4o Realtime Preview)
- Modern web browser (Chrome/Edge recommended for best audio support)
- Microphone access for voice commands
- HTTPS connection (required for microphone access in production)

### Installation

1. **Clone and navigate to the project:**

   ```bash
   cd voice-ai-assistant
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Set up environment variables:**

   ```bash
   cp .env.example .env
   ```

   Edit the `.env` file and add your OpenAI API key:

   PORT=3000

   ```

   **⚠️ Important**: You need an OpenAI API key with access to the Realtime API (GPT-4o Realtime Preview). This may require joining the beta program at [OpenAI's platform](https://platform.openai.com).

   ```

4. **Start the server:**

   ```bash
   npm start
   ```

   For development with auto-reload:

   ```bash
   npm run dev
   ```

5. **Open your browser:**
   Navigate to `http://localhost:3000`

## Usage

### Web Interface

1. Open the web interface at `http://localhost:3000`
2. Click "🎤 Click to Speak" to start voice recording
3. Speak your command and click "⏹️ Stop Recording"
4. Or type your message in the text input field

### API Endpoints

- `GET /` - Main interface and API information
- `GET /health` - Health check endpoint
- `POST /chat` - Send text messages to the AI
- WebSocket connection for real-time voice and text communication

### Voice Commands

The assistant can understand and respond to various voice commands:

- General questions and conversations
- Requests for information
- Commands and instructions
- Natural language interactions

## Configuration

### Environment Variables

| Variable                         | Description                   | Required |
| -------------------------------- | ----------------------------- | -------- |
| `OPENAI_API_KEY`                 | Your OpenAI API key           | Yes      |
| `PORT`                           | Server port (default: 3000)   | No       |
| `GOOGLE_APPLICATION_CREDENTIALS` | Google Cloud credentials path | No       |
| `DEFAULT_VOICE`                  | Default TTS voice             | No       |
| `AI_MODEL`                       | OpenAI model to use           | No       |

### Speech Services

The assistant supports multiple speech service providers:

1. **Google Cloud Speech & Text-to-Speech** (Recommended)

   - High-quality speech recognition and synthesis
   - Multiple voice options and languages
   - Requires Google Cloud credentials

2. **Local TTS** (Fallback)

   - Uses system built-in text-to-speech
   - Available on most operating systems

3. **Placeholder Mode** (Development)
   - For testing without cloud services
   - Returns mock responses

## Project Structure

```
src/
├── index.js                      # Main application server with WebSocket handling
├── assistant/
│   ├── RealtimeVoiceAssistant.js # OpenAI Realtime API integration
│   ├── VoiceAssistant.js         # Legacy assistant (for reference)
│   ├── SpeechRecognition.js      # Legacy speech processing
│   └── TextToSpeech.js           # Legacy TTS processing
public/
├── index.html                    # Modern web interface with real-time audio
.env                              # Environment variables (add your API key here)
.env.example                      # Environment variables template
package.json                      # Dependencies and scripts
README.md                         # This documentation
```

## Development

### Scripts

- `npm start` - Start the production server
- `npm run dev` - Start development server with auto-reload
- `npm test` - Run tests (when implemented)

### Adding New Features

1. **Custom Voice Commands**: Extend the `VoiceAssistant.js` class
2. **New Speech Providers**: Implement in `SpeechRecognition.js` or `TextToSpeech.js`
3. **UI Improvements**: Modify `public/index.html`
4. **API Extensions**: Add routes in `src/index.js`

### Troubleshooting

#### Common Issues

1. **Microphone Access Denied**

   - Ensure browser permissions are granted
   - Use HTTPS in production for microphone access

2. **OpenAI API Errors**

   - Verify API key is correct in `.env`
   - Check API usage limits and billing

3. **Speech Recognition Not Working**

   - Check browser compatibility (Chrome/Edge recommended)
   - Verify microphone is working in other applications

4. **No Audio Output**
   - Check system volume settings
   - Verify browser audio permissions

## API Integration Examples

### Text Chat

```javascript
fetch("/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: "Hello, assistant!" }),
})
  .then((response) => response.json())
  .then((data) => console.log(data.response));
```

### WebSocket Connection

```javascript
const socket = io();

// Send text message
socket.emit("text-message", "Hello!");

// Send voice data
socket.emit("voice-command", audioBuffer);

// Receive responses
socket.on("assistant-response", (response) => {
  console.log(response.text);
});
```

## Security Considerations

- Store API keys securely in environment variables
- Use HTTPS in production for microphone access
- Implement rate limiting for API endpoints
- Validate and sanitize all user inputs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:

1. Check the troubleshooting section
2. Review the configuration options
3. Open an issue on the repository
4. Check the API documentation

---

**Note**: This is a development version. For production use, implement proper error handling, security measures, and monitoring.
