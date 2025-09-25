const axios = require('axios');
const { EventEmitter } = require('events');

class MCPClient extends EventEmitter {
    constructor(serverUrl = 'http://localhost:3001') {
        super();
        this.serverUrl = serverUrl;
        this.isConnected = false;
        this.tools = [];
        
        // Create axios client with timeout
        this.client = axios.create({
            baseURL: this.serverUrl,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async connect() {
        try {
            console.log('🔌 [MCP CLIENT] Connecting to MCP server at:', this.serverUrl);
            
            // Test connection with health check
            const healthResponse = await this.client.get('/health');
            console.log('✅ [MCP CLIENT] Health check response:', healthResponse.data);
            
            // Get available tools
            await this.listTools();
            
            this.isConnected = true;
            console.log('✅ [MCP CLIENT] Connected to MCP server successfully');
            this.emit('connected');
            
        } catch (error) {
            console.error('❌ [MCP CLIENT] Failed to connect to MCP server:', error.message);
            if (error.code === 'ECONNREFUSED') {
                console.error('❌ [MCP CLIENT] Make sure the MCP server is running on', this.serverUrl);
            }
            throw error;
        }
    }

    // HTTP-based connection doesn't need complex initialization
    async initialize() {
        // Already handled in connect() method
        console.log('🔧 [MCP CLIENT] Client initialized for HTTP communication');
    }

    async listTools() {
        try {
            console.log('📋 [MCP CLIENT] Fetching available tools...');
            const response = await this.client.get('/tools');
            this.tools = response.data.tools || [];
            console.log('✅ [MCP CLIENT] Available MCP tools:', this.tools.map(t => t.name));
            return this.tools;
        } catch (error) {
            console.error('❌ [MCP CLIENT] Failed to fetch tools:', error.message);
            throw error;
        }
    }

    async callTool(name, arguments_) {
        try {
            console.log(`🔧 [MCP CLIENT] Calling tool: ${name}`);
            console.log(`📤 [MCP CLIENT] Tool arguments:`, JSON.stringify(arguments_, null, 2));
            
            const response = await this.client.post(`/tools/${name}`, arguments_ || {});
            
            console.log(`📥 [MCP CLIENT] Tool response:`, JSON.stringify(response.data, null, 2));
            return response.data;
            
        } catch (error) {
            console.error(`❌ [MCP CLIENT] Error calling tool ${name}:`, error.message);
            if (error.response) {
                console.error(`❌ [MCP CLIENT] Response status:`, error.response.status);
                console.error(`❌ [MCP CLIENT] Response data:`, error.response.data);
            }
            throw error;
        }
    }

    async disconnect() {
        this.isConnected = false;
        console.log('🔌 [MCP CLIENT] Disconnected from MCP server');
        this.emit('disconnected');
    }

    // Helper methods for pulsa-specific operations
    async checkPulsaAvailability(phoneNumber, amount, provider = null) {
        return await this.callTool('check_pulsa_availability', {
            phoneNumber: phoneNumber,
            amount: amount,
            provider: provider
        });
    }

    async purchasePulsa(phoneNumber, amount, userConfirmation = false, provider = null) {
        return await this.callTool('purchase_pulsa', {
            phoneNumber: phoneNumber,
            amount: amount,
            provider: provider,
            user_confirmation: userConfirmation
        });
    }

    async validatePhoneNumber(phoneNumber) {
        return await this.callTool('validate_phone_number', {
            phoneNumber: phoneNumber
        });
    }

    async processSpeechCommand(speechText, sessionId) {
        return await this.callTool('process_speech_command', {
            speechText: speechText
        });
    }
}

module.exports = MCPClient;
