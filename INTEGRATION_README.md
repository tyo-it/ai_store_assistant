# AI Store Assistant - MCP Integration

This project integrates the Speech-to-Speech Assistant with the MCP Pulsa Server to enable voice-controlled pulsa (mobile credit) purchases.

## Architecture

```
┌─────────────────────────┐    ┌──────────────────────────┐    ┌─────────────────────┐
│                         │    │                          │    │                     │
│  Speech-to-Speech       │    │     MCP Pulsa Server     │    │   Fazzagn API       │
│  Assistant              │◄──►│      (HTTP Mode)         │◄──►│                     │
│  (Port 3000)            │    │      (Port 3001)         │    │                     │
│                         │    │                          │    │                     │
│  - Voice Recognition    │    │  - HTTP API Endpoints    │    │  - Pulsa Purchase   │
│  - Text-to-Speech       │    │  - Phone Validation      │    │  - Balance Check    │
│  - User Interface       │    │  - Availability Check    │    │  - Transaction API  │
│  - HTTP MCP Client      │    │  - Purchase Processing   │    │                     │
│                         │    │                          │    │                     │
└─────────────────────────┘    └──────────────────────────┘    └─────────────────────┘
       HTTP/REST API                    MCP Tools                    External API
```

## Features

### 🎤 Voice Commands

- **Indonesian Language Support**: All interactions in Bahasa Indonesia
- **Natural Voice Processing**: Recognizes pulsa-related commands naturally
- **Confirmation Flow**: Asks for user confirmation before purchases

### 📱 Pulsa Operations

- **Phone Number Validation**: Validates Indonesian phone numbers
- **Availability Check**: Checks if pulsa amount is available
- **Secure Purchase**: Requires explicit user confirmation
- **Real-time Status**: Updates user on transaction progress

### 🔧 Technical Integration

- **HTTP MCP Client**: HTTP-based MCP client for communication with pulsa server
- **Port-based Communication**: MCP server runs on dedicated port (3001)
- **RESTful API**: Clean HTTP endpoints for tool calls
- **Error Handling**: Robust error handling and fallback responses
- **Session Management**: Tracks user sessions and pending purchases

## Installation

1. **Install Dependencies**

   ```bash
   cd mcp-pulsa-server
   npm install
   cd ../speech-to-speech-assistant
   npm install
   ```

2. **Environment Setup**
   Create `.env` files in both directories:

   **mcp-pulsa-server/.env:**

   ```
   FAZZAGN_BASE_URL=your_fazzagn_api_url
   FAZZAGN_USER_ID=your_user_id
   ```

   **speech-to-speech-assistant/.env:**

   ```
   OPENAI_API_KEY=your_openai_api_key
   PORT=3000
   SPEECH_RATE=0.9
   SPEECH_PITCH=0
   ```

## Usage

### Quick Start

```bash
# From the root directory
./start-integrated.sh
```

This will start both services:

- MCP Pulsa Server (background)
- Speech-to-Speech Assistant (http://localhost:3000)

### Manual Start

```bash
# Terminal 1: Start MCP Server in HTTP Mode
cd mcp-pulsa-server
MCP_TRANSPORT_MODE=http MCP_PORT=3001 npm start
# OR use the convenience script:
# ./start-http.sh

# Terminal 2: Start Speech Assistant
cd speech-to-speech-assistant
npm start
```

### Voice Commands Examples

**Indonesian Voice Commands:**

- "Beli pulsa 50 ribu untuk nomor 081234567890"
- "Isi pulsa 25000 ke 08123456789"
- "Top up pulsa seratus ribu untuk 0812-3456-7890"

**Confirmation Flow:**

1. User speaks pulsa request
2. System validates phone number and checks availability
3. System asks for confirmation: "Saya akan membelikan pulsa X untuk nomor Y. Apakah yakin?"
4. User confirms: "Ya" or "Tidak"
5. System processes or cancels the purchase

## API Integration

### MCP Tools Available

- `check_pulsa_availability`: Check if pulsa is available
- `purchase_pulsa`: Execute pulsa purchase
- `validate_phone_number`: Validate Indonesian phone numbers
- `process_speech_command`: Process natural language commands

### Speech Assistant Integration

- **MCPClient**: Handles communication with MCP server
- **PulsaService**: Manages pulsa-related operations
- **VoiceAssistant**: Updated to handle pulsa commands
- **Frontend**: Added confirmation UI elements

## File Structure

```
ai_store_assistant/
├── mcp-pulsa-server/           # MCP Server for pulsa operations
│   ├── src/
│   │   ├── index.js           # Main MCP server
│   │   ├── services/          # API and speech processing
│   │   └── utils/             # Validation utilities
│   └── package.json
├── speech-to-speech-assistant/ # Voice interface
│   ├── src/
│   │   ├── index.js           # Main server
│   │   ├── assistant/         # Voice assistant classes
│   │   └── services/          # MCP client and pulsa service
│   ├── public/
│   │   └── index.html         # Frontend with confirmation UI
│   └── package.json
├── start-integrated.sh         # Startup script
└── README.md                  # This file
```

## Development

### Testing MCP Integration

```bash
cd mcp-pulsa-server
npm test
```

### Testing Speech Commands

1. Open http://localhost:3000
2. Click "Hold to Talk" button
3. Say: "Beli pulsa lima puluh ribu untuk nomor zero eight one two three four five six seven eight nine zero"
4. Confirm when prompted

### Debugging

- Check browser console for frontend issues
- Check terminal output for backend issues
- MCP server logs show detailed processing information

## Troubleshooting

### Common Issues

1. **MCP Server Not Starting**

   - Check if all dependencies are installed
   - Verify environment variables are set
   - Ensure ports are not in use

2. **Voice Recognition Not Working**

   - Check microphone permissions in browser
   - Ensure HTTPS or localhost for speech recognition
   - Verify OpenAI API key is valid

3. **Pulsa Commands Not Recognized**
   - Speak clearly in Indonesian
   - Include both phone number and amount
   - Try different phrasings

### Environment Variables

Make sure all required environment variables are set:

- `OPENAI_API_KEY`: Required for voice processing
- `FAZZAGN_BASE_URL`: Required for pulsa API
- `FAZZAGN_USER_ID`: Required for pulsa API

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see individual package.json files for details.
