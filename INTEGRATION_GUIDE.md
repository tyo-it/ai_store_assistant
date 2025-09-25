# MCP Pulsa Server Integration Guide

This guide explains how to integrate the MCP Pulsa Server with the Speech-to-Speech Assistant for Indonesian mobile credit (pulsa) purchases through voice commands.

## 🏗 Architecture Overview

```
┌─────────────────────────────────────────────┐
│              User Interface                 │
│        (Web Browser/Client)                 │
└─────────────┬───────────────────────────────┘
              │ WebSocket + Voice
              ▼
┌─────────────────────────────────────────────┐
│        Speech-to-Speech Assistant           │
│                                             │
│  ┌─────────────┐    ┌─────────────────────┐ │
│  │   Speech    │    │   Pulsa Service     │ │
│  │  Assistant  │    │  (MCP Integration)  │ │
│  └─────────────┘    └─────────────────────┘ │
└─────────────┬───────────────────────────────┘
              │ MCP Protocol (stdio)
              ▼
┌─────────────────────────────────────────────┐
│           MCP Pulsa Server                  │
│                                             │
│  ┌─────────────┐    ┌─────────────────────┐ │
│  │   Speech    │    │   Fazzagn API       │ │
│  │  Processor  │    │   Integration       │ │
│  └─────────────┘    └─────────────────────┘ │
└─────────────┬───────────────────────────────┘
              │ HTTP API
              ▼
┌─────────────────────────────────────────────┐
│             Fazzagn API                     │
│        (Pulsa Transaction API)              │
└─────────────────────────────────────────────┘
```

## 🔧 Setup Requirements

### 1. Prerequisites
- **Node.js 18.20.x** or newer
- **Fazzagn API Server** running on `http://localhost:3000`
- Both projects in the same parent directory

### 2. Project Structure
```
ai_store_assistant/
├── speech-to-speech-assistant/     # Main voice assistant
├── mcp-pulsa-server/              # MCP server for pulsa
└── INTEGRATION_GUIDE.md           # This guide
```

### 3. Environment Configuration

**MCP Pulsa Server** (`.env`):
```env
FAZZAGN_BASE_URL=http://localhost:3000
FAZZAGN_USER_ID=1
MCP_SERVER_PORT=3001
LOG_LEVEL=info
SPEECH_ASSISTANT_URL=http://localhost:3000
```

**Speech Assistant** (`.env`):
```env
PORT=3000
OPENAI_API_KEY=your_openai_key_here
SPEECH_RATE=1.0
SPEECH_PITCH=0.0
```

## 🚀 Starting the System

### Option 1: Manual Start (Recommended for Development)

1. **Terminal 1 - Start Fazzagn API Server:**
   ```bash
   # Your Fazzagn API server should be running on localhost:3000
   ```

2. **Terminal 2 - Start Speech-to-Speech Assistant:**
   ```bash
   cd speech-to-speech-assistant
   npm install
   npm start
   ```
   Server starts on `http://localhost:3000`

3. **Terminal 3 - MCP Server will be auto-started by Speech Assistant**
   The MCP server is automatically spawned as a child process when needed.

### Option 2: Test MCP Server Standalone
```bash
cd mcp-pulsa-server
npm install
npm start
```

## 🎯 Usage Flow

### 1. **Voice Command Processing**
User speaks Indonesian command:
- *"Beli pulsa 10 ribu untuk nomor 08123456789"*
- *"Isi pulsa 25000 ke 08567890123"*
- *"Topup pulsa lima puluh ribu nomor 08111222333"*

### 2. **System Processing**
1. **Speech Recognition** → Text transcription
2. **Intent Detection** → Identifies pulsa request  
3. **MCP Processing** → Calls MCP Pulsa Server tools
4. **API Integration** → Executes Fazzagn API flow
5. **Response Generation** → Converts to speech

### 3. **Transaction Flow**
```
User Speech → Parse Command → Validate Phone → Check Availability
     ↓
Confirmation Request ← Text-to-Speech ← Format Response
     ↓
User Confirms → Execute Purchase → Transaction Complete
     ↓
Success Message ← Text-to-Speech ← Transaction Result
```

## 🔌 Integration Components

### 1. **MCPPulsaClient.js**
- Manages MCP protocol communication
- Spawns and controls MCP server process
- Handles request/response mapping
- Provides high-level methods for pulsa operations

### 2. **PulsaService.js**
- Business logic for pulsa transactions
- Session management for user confirmations  
- Speech intent detection
- Error handling and user feedback

### 3. **Enhanced Speech Assistant**
- WebSocket event handlers for pulsa events
- Voice integration for confirmations
- Session cleanup and management

## 📡 WebSocket Events

### Client → Server Events
```javascript
// Send text message (potentially pulsa command)
socket.emit('text-message', 'beli pulsa 10 ribu untuk 08123456789');

// Confirm pulsa purchase
socket.emit('pulsa-confirmation', { confirmed: true });

// Cancel pulsa purchase  
socket.emit('pulsa-confirmation', { confirmed: false });
```

### Server → Client Events
```javascript
// Pulsa confirmation needed
socket.on('pulsa-confirmation-needed', (data) => {
  // data.message: confirmation question
  // data.data: transaction details
});

// Pulsa transaction success
socket.on('pulsa-success', (result) => {
  // result.data.transactionId: transaction ID
  // result.message: success message
});

// Pulsa transaction error
socket.on('pulsa-error', (error) => {
  // error.message: error description
  // error.suggestions: helpful suggestions
});

// Regular text response (for voice synthesis)
socket.on('text-response', (response) => {
  // response.text: text to be spoken
  // response.type: 'text-complete'
});
```

## 🛠 MCP Tools Available

The MCP server provides these tools:

1. **`process_speech_command`** - Parse Indonesian voice commands
2. **`validate_phone_number`** - Validate Indonesian mobile numbers
3. **`check_pulsa_availability`** - Check if pulsa is available
4. **`purchase_pulsa`** - Execute complete purchase flow
5. **`get_pulsa_prices`** - Get denomination prices
6. **`check_transaction_status`** - Monitor transaction status

## 🔍 Debugging & Monitoring

### Log Output Locations
- **Speech Assistant**: Console output with `🎤`, `💳`, `✅`, `❌` prefixes
- **MCP Server**: stderr output with detailed API calls
- **Fazzagn API**: HTTP request/response logs

### Common Issues

1. **"MCP Server not connected"**
   - Check Node.js version (requires 18.20.x+)
   - Verify MCP server path in MCPPulsaClient.js
   - Check file permissions

2. **"Pulsa service not connected"**  
   - Ensure Fazzagn API is running on localhost:3000
   - Check network connectivity
   - Verify API endpoints match specification

3. **"Authentication failed"**
   - Not applicable with current API (no auth required)
   - Check base URL configuration

4. **Speech not recognized as pulsa**
   - Use keywords: "beli", "pulsa", "isi", "topup"
   - Include phone number and amount clearly
   - Speak in Indonesian

## 🧪 Testing

### Manual Testing via WebSocket
```javascript
// Connect to WebSocket
const socket = io('http://localhost:3000');

// Test pulsa command
socket.emit('text-message', 'beli pulsa 10 ribu untuk 08123456789');

// Listen for confirmation request
socket.on('pulsa-confirmation-needed', (data) => {
  console.log('Confirmation:', data.message);
  // Respond with confirmation
  socket.emit('pulsa-confirmation', { confirmed: true });
});
```

### REST API Testing
```bash
curl -X POST http://localhost:3000/pulsa \
  -H "Content-Type: application/json" \
  -d '{
    "action": "process_speech",
    "speechText": "beli pulsa 15000 untuk 08123456789"
  }'
```

### Fazzagn API Testing
```bash
# Test the complete flow manually
curl -X POST http://localhost:3000/api/v1/transactions/recharges/inquire \
  -H "Content-Type: application/json" \
  -d '{"recharge": {"recharge_type": "phone_credit", "amount": 15000, "customer_number": "081212345678"}}'
```

## 🔄 Production Deployment

### Process Management
```bash
# Use PM2 for production
npm install -g pm2

# Start Speech Assistant (will auto-start MCP server)
pm2 start speech-to-speech-assistant/src/index.js --name "speech-assistant"

# Monitor processes
pm2 monit

# Check logs
pm2 logs speech-assistant
```

### Health Monitoring
```bash
# Health check endpoints
curl http://localhost:3000/health
# Response includes both speech and pulsa service status

# Service status
curl http://localhost:3000/
# Shows active services and capabilities
```

## 📝 Customization

### Adding New Providers
1. Update `validator.js` with new provider patterns
2. Add provider to enum in MCP tools
3. Update price lists in `fazzagnAPI.js`

### Extending Speech Recognition
1. Add patterns to `speechProcessor.js`
2. Update `numberWords` mapping for local language
3. Test with new command variations

### API Integration Changes
1. Modify `fazzagnAPI.js` for different endpoints
2. Update request/response mapping
3. Adjust error handling as needed

## 🚨 Security Considerations

- **No API Keys**: Current integration doesn't use authentication
- **Input Validation**: All phone numbers and amounts are validated
- **Session Management**: Automatic cleanup prevents memory leaks
- **Error Handling**: Sensitive information not exposed in errors

## 📞 Support

For issues with:
- **Speech Recognition**: Check OpenAI API configuration
- **Pulsa Integration**: Verify MCP server logs and Fazzagn API
- **WebSocket Connection**: Check network and CORS settings
- **Indonesian Language**: Verify speech patterns in speechProcessor.js

The integration is now ready for Indonesian pulsa purchases through natural voice commands! 🎯