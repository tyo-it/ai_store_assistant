# MCP Pulsa Server

An MCP (Model Context Protocol) server that integrates with Speech-to-Speech Assistant for Indonesian mobile credit (pulsa) purchases using the Fazzagn API.

## Features

- **Speech Recognition**: Process Indonesian voice commands for pulsa purchases
- **Phone Number Validation**: Validate Indonesian mobile numbers and detect providers
- **Fazzagn API Integration**: Check availability and purchase pulsa using third-party API
- **Multi-Provider Support**: Support for Telkomsel, XL, Indosat, Tri, and Smartfren
- **Real-time Speech Integration**: Connect with speech-to-speech assistant via WebSocket

## Installation

1. **Prerequisites**: Node.js 18.20.x
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your Fazzagn API credentials
   ```

## Configuration

Create a `.env` file with the following variables:

```env
# Fazzagn API Configuration
FAZZAGN_API_KEY=your_fazzagn_api_key_here
FAZZAGN_BASE_URL=https://api.fazzagn.com
FAZZAGN_USERNAME=your_fazzagn_username
FAZZAGN_PIN=your_fazzagn_pin

# MCP Server Configuration
MCP_SERVER_PORT=3001
LOG_LEVEL=info

# Speech Assistant Integration
SPEECH_ASSISTANT_URL=http://localhost:3000
```

## Usage

### Start the MCP Server
```bash
npm start
```

### Development Mode
```bash
npm run dev
```

## MCP Tools

The server provides the following MCP tools:

### 1. `check_pulsa_availability`
Check if pulsa is available for a specific phone number and amount.

**Parameters:**
- `phoneNumber` (string): Indonesian mobile number
- `amount` (number): Pulsa amount (e.g., 10000, 25000, 50000)
- `provider` (optional string): Mobile provider

### 2. `purchase_pulsa`
Purchase pulsa for a phone number.

**Parameters:**
- `phoneNumber` (string): Indonesian mobile number
- `amount` (number): Pulsa amount to purchase
- `provider` (string): Mobile provider

### 3. `validate_phone_number`
Validate Indonesian phone number and detect provider.

**Parameters:**
- `phoneNumber` (string): Phone number to validate

### 4. `process_speech_command`
Process speech text for pulsa purchase commands.

**Parameters:**
- `speechText` (string): Transcribed speech containing purchase request

### 5. `get_pulsa_prices`
Get available pulsa denominations and prices for a provider.

**Parameters:**
- `provider` (string): Mobile provider

## Speech Commands

The system understands Indonesian voice commands such as:

- "Beli pulsa 10 ribu untuk nomor 08123456789"
- "Isi pulsa 25000 ke 08567890123"
- "Topup pulsa lima puluh ribu nomor 08111222333"
- "Mau beli pulsa 50000 untuk 08987654321"

## Supported Providers

- **Telkomsel**: 0811, 0812, 0813, 0821, 0822, 0823, 0851, 0852, 0853
- **XL**: 0817, 0818, 0819, 0859, 0877, 0878
- **Indosat**: 0814, 0815, 0816, 0855, 0856, 0857, 0858
- **Tri**: 0895, 0896, 0897, 0898, 0899
- **Smartfren**: 0881, 0882, 0883, 0884, 0885, 0886, 0887, 0888

## API Integration

### Fazzagn API Endpoints Used

1. **Check Availability**: `POST /pulsa/check`
2. **Purchase Pulsa**: `POST /pulsa/topup`
3. **Get Prices**: `GET /pulsa/prices/{provider}`
4. **Check Balance**: `GET /balance`

### Fallback Mode

If the Fazzagn API is not available, the server operates in demo mode with simulated responses for testing.

## Speech Assistant Integration

The server can connect to a speech-to-speech assistant via WebSocket for real-time voice interactions:

1. **Register as Service**: Registers MCP pulsa capabilities
2. **Process Speech**: Receives and processes voice commands
3. **Request Confirmation**: Asks user to confirm purchases
4. **Execute Transactions**: Completes pulsa purchases after confirmation
5. **Provide Feedback**: Sends voice responses back to user

## Error Handling

- **Invalid Phone Numbers**: Validates format and provider detection
- **API Failures**: Graceful fallback to demo mode
- **Network Issues**: Automatic reconnection with exponential backoff
- **Transaction Errors**: Detailed error messages and retry suggestions

## Testing

```bash
npm test
```

## Development

### File Structure
```
src/
├── index.js                 # Main MCP server
├── services/
│   ├── fazzagnAPI.js        # Fazzagn API integration
│   └── speechProcessor.js   # Speech command processing
├── utils/
│   └── validator.js         # Phone number and amount validation
└── integration/
    └── speechAssistantBridge.js # Speech assistant WebSocket bridge
```

### Adding New Features

1. **New Provider Support**: Update `validator.js` with provider patterns
2. **Additional Speech Patterns**: Extend `speechProcessor.js` patterns
3. **API Endpoints**: Add new methods to `fazzagnAPI.js`
4. **MCP Tools**: Register new tools in `index.js`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.