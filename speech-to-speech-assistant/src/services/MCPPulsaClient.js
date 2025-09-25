const { spawn } = require('child_process');
const { EventEmitter } = require('events');

class MCPPulsaClient extends EventEmitter {
    constructor() {
        super();
        this.mcpProcess = null;
        this.isConnected = false;
        this.messageId = 0;
        this.pendingRequests = new Map();
    }

    async connect() {
        try {
            // Start the MCP Pulsa Server process
            this.mcpProcess = spawn('node', ['../mcp-pulsa-server/src/index.js'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            this.mcpProcess.stdout.on('data', (data) => {
                try {
                    const messages = data.toString().split('\n').filter(line => line.trim());
                    messages.forEach(message => {
                        if (message.trim()) {
                            const parsed = JSON.parse(message);
                            this.handleMCPMessage(parsed);
                        }
                    });
                } catch (error) {
                    console.error('Error parsing MCP message:', error);
                }
            });

            this.mcpProcess.stderr.on('data', (data) => {
                console.error('MCP Server error:', data.toString());
            });

            this.mcpProcess.on('exit', (code) => {
                console.log('MCP Server exited with code:', code);
                this.isConnected = false;
                this.emit('disconnected');
            });

            // Initialize MCP connection
            await this.initializeMCP();
            this.isConnected = true;
            console.log('✅ Connected to MCP Pulsa Server');
            
        } catch (error) {
            console.error('Failed to connect to MCP Pulsa Server:', error);
            throw error;
        }
    }

    async initializeMCP() {
        // Send initialize request
        const initResponse = await this.sendRequest({
            jsonrpc: '2.0',
            id: this.getNextMessageId(),
            method: 'initialize',
            params: {
                protocolVersion: '2024-11-05',
                capabilities: {
                    roots: {
                        listChanged: false
                    }
                },
                clientInfo: {
                    name: 'speech-assistant',
                    version: '1.0.0'
                }
            }
        });

        // Send initialized notification
        this.sendNotification({
            jsonrpc: '2.0',
            method: 'notifications/initialized'
        });
    }

    async sendRequest(request) {
        return new Promise((resolve, reject) => {
            if (!this.mcpProcess) {
                reject(new Error('MCP Server not connected'));
                return;
            }

            this.pendingRequests.set(request.id, { resolve, reject });
            this.mcpProcess.stdin.write(JSON.stringify(request) + '\n');
            
            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(request.id)) {
                    this.pendingRequests.delete(request.id);
                    reject(new Error('Request timeout'));
                }
            }, 30000);
        });
    }

    sendNotification(notification) {
        if (this.mcpProcess) {
            this.mcpProcess.stdin.write(JSON.stringify(notification) + '\n');
        }
    }

    handleMCPMessage(message) {
        if (message.id && this.pendingRequests.has(message.id)) {
            const { resolve, reject } = this.pendingRequests.get(message.id);
            this.pendingRequests.delete(message.id);
            
            if (message.error) {
                reject(new Error(message.error.message || 'MCP Error'));
            } else {
                resolve(message.result);
            }
        }
    }

    getNextMessageId() {
        return ++this.messageId;
    }

    // MCP Tool Methods
    async processSpeechCommand(speechText) {
        try {
            const result = await this.sendRequest({
                jsonrpc: '2.0',
                id: this.getNextMessageId(),
                method: 'tools/call',
                params: {
                    name: 'process_speech_command',
                    arguments: {
                        speechText: speechText
                    }
                }
            });
            
            return JSON.parse(result.content[0].text);
        } catch (error) {
            console.error('Error processing speech command:', error);
            throw error;
        }
    }

    async checkPulsaAvailability(phoneNumber, amount, provider) {
        try {
            const result = await this.sendRequest({
                jsonrpc: '2.0',
                id: this.getNextMessageId(),
                method: 'tools/call',
                params: {
                    name: 'check_pulsa_availability',
                    arguments: {
                        phoneNumber: phoneNumber,
                        amount: amount,
                        provider: provider
                    }
                }
            });
            
            return JSON.parse(result.content[0].text);
        } catch (error) {
            console.error('Error checking pulsa availability:', error);
            throw error;
        }
    }

    async purchasePulsa(phoneNumber, amount, provider, referenceNumber) {
        try {
            const result = await this.sendRequest({
                jsonrpc: '2.0',
                id: this.getNextMessageId(),
                method: 'tools/call',
                params: {
                    name: 'purchase_pulsa',
                    arguments: {
                        phoneNumber: phoneNumber,
                        amount: amount,
                        provider: provider,
                        referenceNumber: referenceNumber
                    }
                }
            });
            
            return JSON.parse(result.content[0].text);
        } catch (error) {
            console.error('Error purchasing pulsa:', error);
            throw error;
        }
    }

    async validatePhoneNumber(phoneNumber) {
        try {
            const result = await this.sendRequest({
                jsonrpc: '2.0',
                id: this.getNextMessageId(),
                method: 'tools/call',
                params: {
                    name: 'validate_phone_number',
                    arguments: {
                        phoneNumber: phoneNumber
                    }
                }
            });
            
            return JSON.parse(result.content[0].text);
        } catch (error) {
            console.error('Error validating phone number:', error);
            throw error;
        }
    }

    async checkTransactionStatus(uniqueId) {
        try {
            const result = await this.sendRequest({
                jsonrpc: '2.0',
                id: this.getNextMessageId(),
                method: 'tools/call',
                params: {
                    name: 'check_transaction_status',
                    arguments: {
                        uniqueId: uniqueId
                    }
                }
            });
            
            return JSON.parse(result.content[0].text);
        } catch (error) {
            console.error('Error checking transaction status:', error);
            throw error;
        }
    }

    disconnect() {
        if (this.mcpProcess) {
            this.mcpProcess.kill();
            this.mcpProcess = null;
        }
        this.isConnected = false;
        this.pendingRequests.clear();
    }
}

module.exports = MCPPulsaClient;