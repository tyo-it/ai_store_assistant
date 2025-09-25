#!/bin/bash

# Start MCP Pulsa Server in HTTP Mode
echo "🚀 Starting MCP Pulsa Server in HTTP mode..."

# Check if we're in the mcp-pulsa-server directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the mcp-pulsa-server directory"
    exit 1
fi

# Set environment variables for HTTP mode
export MCP_TRANSPORT_MODE=http
export MCP_PORT=3001

echo "🌐 Transport Mode: $MCP_TRANSPORT_MODE"
echo "🔌 Port: $MCP_PORT"
echo ""

# Start the server
npm start
