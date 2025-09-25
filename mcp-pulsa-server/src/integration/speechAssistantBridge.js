import { EventEmitter } from 'events';
import WebSocket from 'ws';

export class SpeechAssistantBridge extends EventEmitter {
  constructor(speechAssistantUrl = 'ws://localhost:3000') {
    super();
    this.speechAssistantUrl = speechAssistantUrl;
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async connect() {
    try {
      this.ws = new WebSocket(this.speechAssistantUrl);
      
      this.ws.on('open', () => {
        console.log('Connected to Speech Assistant');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
        
        // Register as MCP Pulsa Service
        this.ws.send(JSON.stringify({
          type: 'service_register',
          service: 'mcp-pulsa',
          capabilities: [
            'pulsa_purchase',
            'pulsa_availability_check',
            'phone_validation',
            'speech_command_processing'
          ]
        }));
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing message from Speech Assistant:', error);
        }
      });

      this.ws.on('close', () => {
        console.log('Disconnected from Speech Assistant');
        this.isConnected = false;
        this.emit('disconnected');
        this.handleReconnection();
      });

      this.ws.on('error', (error) => {
        console.error('Speech Assistant WebSocket error:', error);
        this.emit('error', error);
      });

    } catch (error) {
      console.error('Failed to connect to Speech Assistant:', error);
      this.handleReconnection();
    }
  }

  handleMessage(message) {
    switch (message.type) {
      case 'speech_transcription':
        this.emit('speech_received', {
          text: message.text,
          confidence: message.confidence,
          sessionId: message.sessionId
        });
        break;
        
      case 'user_confirmation_needed':
        this.emit('confirmation_needed', {
          message: message.message,
          sessionId: message.sessionId,
          data: message.data
        });
        break;
        
      case 'user_confirmed':
        this.emit('user_confirmed', {
          confirmed: message.confirmed,
          sessionId: message.sessionId,
          data: message.data
        });
        break;
        
      case 'session_ended':
        this.emit('session_ended', {
          sessionId: message.sessionId,
          reason: message.reason
        });
        break;
        
      default:
        console.log('Unknown message type from Speech Assistant:', message.type);
    }
  }

  // Send response back to speech assistant
  sendResponse(sessionId, response) {
    if (!this.isConnected || !this.ws) {
      console.error('Not connected to Speech Assistant');
      return false;
    }

    try {
      this.ws.send(JSON.stringify({
        type: 'mcp_response',
        sessionId: sessionId,
        response: response
      }));
      return true;
    } catch (error) {
      console.error('Error sending response to Speech Assistant:', error);
      return false;
    }
  }

  // Send speech synthesis request
  sendSpeechSynthesis(sessionId, text, options = {}) {
    if (!this.isConnected || !this.ws) {
      console.error('Not connected to Speech Assistant');
      return false;
    }

    try {
      this.ws.send(JSON.stringify({
        type: 'speech_synthesis_request',
        sessionId: sessionId,
        text: text,
        options: {
          voice: options.voice || 'id-ID-Standard-A',
          speed: options.speed || 1.0,
          pitch: options.pitch || 1.0,
          ...options
        }
      }));
      return true;
    } catch (error) {
      console.error('Error sending speech synthesis request:', error);
      return false;
    }
  }

  // Request user confirmation through speech
  requestConfirmation(sessionId, message, data = {}) {
    if (!this.isConnected || !this.ws) {
      console.error('Not connected to Speech Assistant');
      return false;
    }

    try {
      this.ws.send(JSON.stringify({
        type: 'confirmation_request',
        sessionId: sessionId,
        message: message,
        data: data,
        options: {
          timeout: 30000, // 30 seconds timeout
          retries: 2
        }
      }));
      return true;
    } catch (error) {
      console.error('Error requesting confirmation:', error);
      return false;
    }
  }

  // Send status update
  sendStatus(sessionId, status, message) {
    if (!this.isConnected || !this.ws) {
      return false;
    }

    try {
      this.ws.send(JSON.stringify({
        type: 'status_update',
        sessionId: sessionId,
        status: status, // 'processing', 'success', 'error', 'waiting'
        message: message
      }));
      return true;
    } catch (error) {
      console.error('Error sending status update:', error);
      return false;
    }
  }

  handleReconnection() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
      
      console.log(`Attempting to reconnect to Speech Assistant in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('Max reconnection attempts reached. Manual intervention required.');
      this.emit('max_reconnect_reached');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}

// Enhanced MCP Server with Speech Assistant Integration
export class EnhancedPulsaMCPServer {
  constructor(mcpServer, speechAssistantUrl) {
    this.mcpServer = mcpServer;
    this.bridge = new SpeechAssistantBridge(speechAssistantUrl);
    this.activeSessions = new Map();
    
    this.setupBridgeHandlers();
  }

  setupBridgeHandlers() {
    // Handle incoming speech from assistant
    this.bridge.on('speech_received', async (data) => {
      const { text, sessionId } = data;
      
      try {
        // Update session status
        this.bridge.sendStatus(sessionId, 'processing', 'Memproses permintaan pulsa...');
        
        // Process speech command using MCP server's speech processor
        const result = await this.mcpServer.processSpeechCommand({ speechText: text });
        
        if (result.content && result.content[0] && result.content[0].text) {
          const parsedResult = JSON.parse(result.content[0].text);
          
          if (parsedResult.understood) {
            // Store session data
            this.activeSessions.set(sessionId, {
              phoneNumber: parsedResult.phoneNumber,
              amount: parsedResult.amount,
              provider: parsedResult.provider,
              timestamp: Date.now()
            });
            
            // Request user confirmation
            const confirmationMessage = `Apakah Anda yakin ingin membeli pulsa ${this.formatCurrency(parsedResult.amount)} untuk nomor ${parsedResult.phoneNumber}?`;
            
            this.bridge.requestConfirmation(sessionId, confirmationMessage, {
              action: 'pulsa_purchase',
              details: parsedResult
            });
          } else {
            // Send error response
            this.bridge.sendSpeechSynthesis(sessionId, 'Maaf, saya tidak dapat memahami permintaan pulsa Anda. Silakan coba lagi dengan format: beli pulsa 10 ribu untuk nomor 08123456789.');
          }
        }
      } catch (error) {
        console.error('Error processing speech command:', error);
        this.bridge.sendStatus(sessionId, 'error', 'Terjadi kesalahan saat memproses permintaan.');
        this.bridge.sendSpeechSynthesis(sessionId, 'Maaf, terjadi kesalahan sistem. Silakan coba lagi.');
      }
    });

    // Handle user confirmations
    this.bridge.on('user_confirmed', async (data) => {
      const { confirmed, sessionId } = data;
      const sessionData = this.activeSessions.get(sessionId);
      
      if (!sessionData) {
        this.bridge.sendSpeechSynthesis(sessionId, 'Sesi telah berakhir. Silakan mulai kembali.');
        return;
      }

      if (confirmed) {
        try {
          // Update status
          this.bridge.sendStatus(sessionId, 'processing', 'Sedang memproses pembelian pulsa...');
          
          // Execute pulsa purchase
          const purchaseResult = await this.mcpServer.purchasePulsa({
            phoneNumber: sessionData.phoneNumber,
            amount: sessionData.amount,
            provider: sessionData.provider
          });
          
          if (purchaseResult.content && purchaseResult.content[0]) {
            const result = JSON.parse(purchaseResult.content[0].text);
            
            if (result.success) {
              this.bridge.sendStatus(sessionId, 'success', 'Pembelian pulsa berhasil!');
              this.bridge.sendSpeechSynthesis(sessionId, 
                `Pulsa ${this.formatCurrency(sessionData.amount)} berhasil dikirim ke nomor ${sessionData.phoneNumber}. ID transaksi: ${result.transactionId}`
              );
            } else {
              this.bridge.sendStatus(sessionId, 'error', 'Pembelian pulsa gagal.');
              this.bridge.sendSpeechSynthesis(sessionId, `Maaf, pembelian pulsa gagal. ${result.message || 'Silakan coba lagi.'}`);
            }
          }
        } catch (error) {
          console.error('Error executing pulsa purchase:', error);
          this.bridge.sendStatus(sessionId, 'error', 'Terjadi kesalahan saat pembelian.');
          this.bridge.sendSpeechSynthesis(sessionId, 'Maaf, terjadi kesalahan saat memproses pembelian. Silakan coba lagi.');
        }
      } else {
        this.bridge.sendSpeechSynthesis(sessionId, 'Pembelian pulsa dibatalkan.');
      }
      
      // Clean up session
      this.activeSessions.delete(sessionId);
    });

    // Handle session cleanup
    this.bridge.on('session_ended', (data) => {
      this.activeSessions.delete(data.sessionId);
    });
  }

  async start() {
    await this.bridge.connect();
    console.log('Enhanced Pulsa MCP Server with Speech Assistant integration started');
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  }
}