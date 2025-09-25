#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { FazzagnAPI } from "./services/fazzagnAPI.js";
import { PulsaValidator } from "./utils/validator.js";
import { SpeechProcessor } from "./services/speechProcessor.js";

dotenv.config();

class PulsaMCPServer {
  constructor() {
    console.log('🚀 [MCP SERVER] Initializing Pulsa MCP Server...');
    console.log('🚀 [MCP SERVER] Environment variables:');
    console.log('   - FAZZAGN_BASE_URL:', process.env.FAZZAGN_BASE_URL || 'NOT SET');
    console.log('   - FAZZAGN_USER_ID:', process.env.FAZZAGN_USER_ID || 'NOT SET');

    this.server = new Server(
      {
        name: "pulsa-purchase-server",
        version: "1.0.0",
        description: "MCP Server for Pulsa Purchase with Speech Integration"
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    console.log('🔧 [MCP SERVER] Initializing Fazzagn API client...');
    this.fazzagnAPI = new FazzagnAPI({
      baseURL: process.env.FAZZAGN_BASE_URL,
      userId: process.env.FAZZAGN_USER_ID
    });

    console.log('🔧 [MCP SERVER] Initializing validator and speech processor...');
    this.validator = new PulsaValidator();
    this.speechProcessor = new SpeechProcessor();

    console.log('🔧 [MCP SERVER] Setting up request handlers...');
    this.setupHandlers();

    console.log('✅ [MCP SERVER] Pulsa MCP Server initialization complete!');
  }

  // Generate a random transaction ID
  generateTransactionId() {
    const timestamp = Date.now().toString();
    const random1 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const random2 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const prefix = 'TRX';
    return `${prefix}-${timestamp}-${random1}${random2}`;
  }

  // Generate a random purchase reference ID
  generatePurchaseId() {
    const timestamp = Date.now().toString();
    const random1 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const random2 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const prefix = 'PUR';
    return `${prefix}-${timestamp}-${random1}${random2}`;
  }

  // Generate a random check/availability ID
  generateCheckId() {
    const timestamp = Date.now().toString();
    const random1 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const random2 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const prefix = 'CHK';
    return `${prefix}-${timestamp}-${random1}${random2}`;
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "check_pulsa_availability",
            description: "Check pulsa/mobile credit availability for a phone number and amount",
            inputSchema: {
              type: "object",
              properties: {
                phoneNumber: {
                  type: "string",
                  description: "Phone number to check pulsa availability for"
                },
                amount: {
                  type: "number",
                  description: "Pulsa amount to check (e.g., 10000, 25000, 50000)"
                },
                provider: {
                  type: "string",
                  description: "Mobile provider (telkomsel, xl, indosat, tri, smartfren)",
                  enum: ["telkomsel", "xl", "indosat", "tri", "smartfren"]
                }
              },
              required: ["phoneNumber", "amount"]
            }
          },
          {
            name: "purchase_pulsa",
            description: "Purchase pulsa/mobile credit for a phone number",
            inputSchema: {
              type: "object",
              properties: {
                phoneNumber: {
                  type: "string",
                  description: "Phone number to purchase pulsa for"
                },
                amount: {
                  type: "number",
                  description: "Pulsa amount to purchase"
                },
                provider: {
                  type: "string",
                  description: "Mobile provider",
                  enum: ["telkomsel", "xl", "indosat", "tri", "smartfren"]
                }
              },
              required: ["phoneNumber", "amount", "provider"]
            }
          },
          {
            name: "validate_phone_number",
            description: "Validate Indonesian phone number and detect provider",
            inputSchema: {
              type: "object",
              properties: {
                phoneNumber: {
                  type: "string",
                  description: "Phone number to validate"
                }
              },
              required: ["phoneNumber"]
            }
          },
          {
            name: "process_speech_command",
            description: "Process speech command for pulsa purchase",
            inputSchema: {
              type: "object",
              properties: {
                speechText: {
                  type: "string",
                  description: "Transcribed speech text containing pulsa purchase request"
                }
              },
              required: ["speechText"]
            }
          },
          {
            name: "get_pulsa_prices",
            description: "Get available pulsa denominations and prices for a provider",
            inputSchema: {
              type: "object",
              properties: {
                provider: {
                  type: "string",
                  description: "Mobile provider",
                  enum: ["telkomsel", "xl", "indosat", "tri", "smartfren"]
                }
              },
              required: ["provider"]
            }
          },
          {
            name: "check_transaction_status",
            description: "Check the status of a pulsa transaction using unique_id",
            inputSchema: {
              type: "object",
              properties: {
                uniqueId: {
                  type: "string",
                  description: "Unique transaction ID from purchase response"
                }
              },
              required: ["uniqueId"]
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        console.log(`🔧 [MCP SERVER] Tool called: ${name}`);
        console.log(`📥 [MCP SERVER] Tool arguments:`, JSON.stringify(args, null, 2));

        switch (name) {
          case "check_pulsa_availability":
            console.log(`🔍 [MCP SERVER] Executing check_pulsa_availability...`);
            return await this.checkPulsaAvailability(args);

          case "purchase_pulsa":
            console.log(`💳 [MCP SERVER] Executing purchase_pulsa...`);
            return await this.purchasePulsa(args);

          case "validate_phone_number":
            console.log(`📱 [MCP SERVER] Executing validate_phone_number...`);
            return await this.validatePhoneNumber(args);

          case "process_speech_command":
            console.log(`🎤 [MCP SERVER] Executing process_speech_command...`);
            return await this.processSpeechCommand(args);

          case "get_pulsa_prices":
            console.log(`💰 [MCP SERVER] Executing get_pulsa_prices...`);
            return await this.getPulsaPrices(args);

          case "check_transaction_status":
            console.log(`📊 [MCP SERVER] Executing check_transaction_status...`);
            return await this.checkTransactionStatus(args);

          default:
            console.error(`❌ [MCP SERVER] Unknown tool: ${name}`);
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        console.error(`❌ [MCP SERVER] Tool execution error for ${request.params.name}:`, error);
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error.message}`
        );
      }
    });
  }

  async checkPulsaAvailability(args) {
    const { phoneNumber, amount, provider } = args;

    console.log(`🔍 [MCP SERVER] checkPulsaAvailability called with:`, { phoneNumber, amount, provider });

    // Validate phone number
    const validation = this.validator.validatePhoneNumber(phoneNumber);
    if (!validation.valid) {
      console.log(`❌ [MCP SERVER] Phone number validation failed:`, validation);
      return {
        content: [{
          type: "text",
          text: `Phone number validation failed: ${validation.error}`
        }]
      };
    }

    const detectedProvider = provider || validation.provider;

    console.log(`📞 [MCP SERVER] Calling Fazzagn API checkPulsaAvailability with provider:`, detectedProvider);

    try {
      const availability = await this.fazzagnAPI.checkPulsaAvailability({
        phoneNumber,
        amount,
        provider: detectedProvider
      });

      console.log(`✅ [MCP SERVER] Fazzagn API response:`, availability);

      const result = {
        content: [{
          type: "text",
          text: JSON.stringify({
            available: availability.available,
            phoneNumber: phoneNumber,
            amount: amount,
            provider: detectedProvider,
            price: availability.price,
            checkId: this.generateCheckId(), // ID for tracking availability checks
            message: availability.message || "Pulsa availability checked successfully"
          }, null, 2)
        }]
      };

      console.log(`📤 [MCP SERVER] Returning result:`, JSON.stringify(result, null, 2));
      return result;

    } catch (error) {
      console.error(`❌ [MCP SERVER] Fazzagn API error:`, error.message);
      return {
        content: [{
          type: "text",
          text: `Error checking pulsa availability: ${error.message}`
        }]
      };
    }
  }

  async purchasePulsa(args) {
    const { phoneNumber, amount, provider, referenceNumber } = args;

    console.log(`💳 [MCP SERVER] purchasePulsa called with:`, { phoneNumber, amount, provider, referenceNumber });

    // Validate phone number
    const validation = this.validator.validatePhoneNumber(phoneNumber);
    if (!validation.valid) {
      console.log(`❌ [MCP SERVER] Phone number validation failed:`, validation);
      return {
        content: [{
          type: "text",
          text: `Phone number validation failed: ${validation.error}`
        }]
      };
    }

    console.log(`📞 [MCP SERVER] Calling Fazzagn API purchasePulsa...`);

    try {
      const transaction = await this.fazzagnAPI.purchasePulsa({
        phoneNumber,
        amount,
        provider,
        referenceNumber
      });

      console.log(`✅ [MCP SERVER] Fazzagn API purchase response:`, transaction);

      const result = {
        content: [{
          type: "text",
          text: JSON.stringify({
            phoneNumber: phoneNumber,
            amount: amount,
            provider: provider,
            uniqueId: transaction.uniqueId,
            message: transaction.message || "Pulsa purchase completed successfully"
          }, null, 2)
        }]
      };

      console.log(`📤 [MCP SERVER] Returning purchase result:`, JSON.stringify(result, null, 2));
      return result;

    } catch (error) {
      console.error(`❌ [MCP SERVER] Fazzagn API purchase error:`, error.message);
      return {
        content: [{
          type: "text",
          text: `Error purchasing pulsa: ${error.message}`
        }]
      };
    }
  }

  async validatePhoneNumber(args) {
    const { phoneNumber } = args;
    const validation = this.validator.validatePhoneNumber(phoneNumber);

    return {
      content: [{
        type: "text",
        text: JSON.stringify(validation, null, 2)
      }]
    };
  }

  async processSpeechCommand(args) {
    const { speechText } = args;

    try {
      const parsedCommand = this.speechProcessor.parsePulsaCommand(speechText);

      if (!parsedCommand.valid) {
        return {
          content: [{
            type: "text",
            text: `Unable to understand the pulsa purchase request. ${parsedCommand.error || 'Please specify phone number and amount clearly.'}`
          }]
        };
      }

      // First validate the phone number
      const validation = this.validator.validatePhoneNumber(parsedCommand.phoneNumber);
      if (!validation.valid) {
        return {
          content: [{
            type: "text",
            text: `Phone number validation failed: ${validation.error}`
          }]
        };
      }

      // Check availability first
      const availability = await this.fazzagnAPI.checkPulsaAvailability({
        phoneNumber: parsedCommand.phoneNumber,
        amount: parsedCommand.amount,
        provider: validation.provider
      });

      if (!availability.available) {
        return {
          content: [{
            type: "text",
            text: `Pulsa ${parsedCommand.amount} for ${parsedCommand.phoneNumber} is currently not available. ${availability.message || ''}`
          }]
        };
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            understood: true,
            phoneNumber: parsedCommand.phoneNumber,
            amount: parsedCommand.amount,
            provider: validation.provider,
            available: true,
            price: availability.price,
            readyToPurchase: true,
            referenceNumber: availability.referenceNumber,
            message: `Ready to purchase pulsa ${parsedCommand.amount} for ${parsedCommand.phoneNumber} (${validation.provider}). Price: ${availability.price}`
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error processing speech command: ${error.message}`
        }]
      };
    }
  }

  async getPulsaPrices(args) {
    const { provider } = args;

    try {
      const prices = await this.fazzagnAPI.getPulsaPrices(provider);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            provider: provider,
            denominations: prices
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error getting pulsa prices: ${error.message}`
        }]
      };
    }
  }

  async checkTransactionStatus(args) {
    const { uniqueId } = args;

    try {
      const status = await this.fazzagnAPI.getTransactionStatus(uniqueId);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            uniqueId: uniqueId,
            status: status.status,
            message: status.message,
            amount: status.amount,
            customerNumber: status.customerNumber,
            createdAt: status.createdAt,
            completedAt: status.completedAt
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error checking transaction status: ${error.message}`
        }]
      };
    }
  }

  async run() {
    const mode = process.env.MCP_TRANSPORT_MODE || 'stdio';
    const port = process.env.MCP_PORT || 3001;

    console.log('🌐 [MCP SERVER] Starting MCP server transport...');
    console.log('🌐 [MCP SERVER] Transport mode:', mode);

    if (mode === 'http' || mode === 'websocket') {
      // HTTP/WebSocket transport for external connections
      console.log(`🌐 [MCP SERVER] Starting HTTP server on port ${port}...`);
      await this.startHttpServer(port);
    } else {
      // Default stdio transport
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error("✅ [MCP SERVER] Pulsa MCP server running on stdio");
    }

    console.error("🎯 [MCP SERVER] Server ready to receive tool calls");
  }

  async startHttpServer(port) {
    const app = express();

    app.use(cors());
    app.use(express.json());

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy', server: 'mcp-pulsa-server' });
    });

    // MCP tools endpoint
    app.get('/tools', async (req, res) => {
      try {
        const tools = [
          {
            name: "check_pulsa_availability",
            description: "Check pulsa/mobile credit availability for a phone number and amount"
          },
          {
            name: "purchase_pulsa",
            description: "Purchase pulsa/mobile credit for a phone number"
          },
          {
            name: "validate_phone_number",
            description: "Validate Indonesian phone number and detect provider"
          },
          {
            name: "process_speech_command",
            description: "Process natural language speech command for pulsa operations"
          }
        ];
        res.json({ tools });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // MCP tool call endpoint
    app.post('/tools/:toolName', async (req, res) => {
      try {
        const { toolName } = req.params;
        const args = req.body;

        console.log(`🔧 [MCP SERVER] HTTP Tool called: ${toolName}`);
        console.log(`📥 [MCP SERVER] HTTP Tool arguments:`, JSON.stringify(args, null, 2));

        let result;
        switch (toolName) {
          case 'check_pulsa_availability':
            result = await this.checkPulsaAvailability(args);
            break;
          case 'purchase_pulsa':
            result = await this.purchasePulsa(args);
            break;
          case 'validate_phone_number':
            result = await this.validatePhoneNumber(args);
            break;
          case 'process_speech_command':
            result = await this.processSpeechCommand(args);
            break;
          default:
            return res.status(404).json({ error: `Unknown tool: ${toolName}` });
        }

        console.log(`📤 [MCP SERVER] HTTP Tool result:`, JSON.stringify(result, null, 2));
        res.json(result);

      } catch (error) {
        console.error(`❌ [MCP SERVER] HTTP Tool error:`, error);
        res.status(500).json({ error: error.message });
      }
    });

    const server = app.listen(port, () => {
      console.log(`✅ [MCP SERVER] HTTP server running on http://localhost:${port}`);
    });

    return server;
  }
}

console.log('🎬 [MCP SERVER] Starting Pulsa MCP Server...');
const server = new PulsaMCPServer();
server.run().catch((error) => {
  console.error('❌ [MCP SERVER] Server startup failed:', error);
  process.exit(1);
});
