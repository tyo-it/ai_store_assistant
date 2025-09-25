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
import { FazzagnAPI } from "./services/fazzagnAPI.js";
import { PulsaValidator } from "./utils/validator.js";
import { SpeechProcessor } from "./services/speechProcessor.js";

dotenv.config();

class PulsaMCPServer {
  constructor() {
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

    this.fazzagnAPI = new FazzagnAPI({
      apiKey: process.env.FAZZAGN_API_KEY,
      baseURL: process.env.FAZZAGN_BASE_URL,
      username: process.env.FAZZAGN_USERNAME,
      pin: process.env.FAZZAGN_PIN
    });

    this.validator = new PulsaValidator();
    this.speechProcessor = new SpeechProcessor();
    
    this.setupHandlers();
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
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case "check_pulsa_availability":
            return await this.checkPulsaAvailability(args);
          
          case "purchase_pulsa":
            return await this.purchasePulsa(args);
          
          case "validate_phone_number":
            return await this.validatePhoneNumber(args);
          
          case "process_speech_command":
            return await this.processSpeechCommand(args);
          
          case "get_pulsa_prices":
            return await this.getPulsaPrices(args);
          
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        console.error("Tool execution error:", error);
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error.message}`
        );
      }
    });
  }

  async checkPulsaAvailability(args) {
    const { phoneNumber, amount, provider } = args;
    
    // Validate phone number
    const validation = this.validator.validatePhoneNumber(phoneNumber);
    if (!validation.valid) {
      return {
        content: [{
          type: "text",
          text: `Phone number validation failed: ${validation.error}`
        }]
      };
    }

    const detectedProvider = provider || validation.provider;
    
    try {
      const availability = await this.fazzagnAPI.checkPulsaAvailability({
        phoneNumber,
        amount,
        provider: detectedProvider
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            available: availability.available,
            phoneNumber: phoneNumber,
            amount: amount,
            provider: detectedProvider,
            price: availability.price,
            message: availability.message || "Pulsa availability checked successfully"
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error checking pulsa availability: ${error.message}`
        }]
      };
    }
  }

  async purchasePulsa(args) {
    const { phoneNumber, amount, provider } = args;
    
    // Validate phone number
    const validation = this.validator.validatePhoneNumber(phoneNumber);
    if (!validation.valid) {
      return {
        content: [{
          type: "text",
          text: `Phone number validation failed: ${validation.error}`
        }]
      };
    }

    try {
      const transaction = await this.fazzagnAPI.purchasePulsa({
        phoneNumber,
        amount,
        provider
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: transaction.success,
            transactionId: transaction.transactionId,
            phoneNumber: phoneNumber,
            amount: amount,
            provider: provider,
            status: transaction.status,
            message: transaction.message || "Pulsa purchase completed successfully"
          }, null, 2)
        }]
      };
    } catch (error) {
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

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Pulsa MCP server running on stdio");
  }
}

const server = new PulsaMCPServer();
server.run().catch(console.error);