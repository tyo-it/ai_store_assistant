#!/bin/bash

# AI Store Assistant - Integrated Startup Script
# This script starts both the MCP Pulsa Server and Speech-to-Speech Assistant

echo "🚀 Starting AI Store Assistant with MCP Integration..."

# Check if we're in the right directory
if [ ! -d "mcp-pulsa-server" ] || [ ! -d "speech-to-speech-assistant" ]; then
    echo "❌ Error: Please run this script from the ai_store_assistant root directory"
    exit 1
fi

# Function to cleanup background processes
cleanup() {
    echo "🛑 Shutting down services..."
    kill $MCP_PID 2>/dev/null
    kill $SPEECH_PID 2>/dev/null
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start MCP Pulsa Server in HTTP mode in background
echo "🔧 Starting MCP Pulsa Server in HTTP mode..."
cd mcp-pulsa-server
MCP_TRANSPORT_MODE=http MCP_PORT=3001 npm start &
MCP_PID=$!
cd ..

# Wait a moment for MCP server to initialize
sleep 2

# Start Speech-to-Speech Assistant
echo "🎤 Starting Speech-to-Speech Assistant..."
cd speech-to-speech-assistant
npm start &
SPEECH_PID=$!
cd ..

echo "✅ Both services are starting up!"
echo "📱 Speech Assistant will be available at: http://localhost:3000"
echo "🔧 MCP Server is running at: http://localhost:3001"
echo ""
echo "📋 Services:"
echo "  - MCP Pulsa Server HTTP (PID: $MCP_PID) - Port 3001"  
echo "  - Speech Assistant (PID: $SPEECH_PID) - Port 3000"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for both processes
wait $SPEECH_PID
wait $MCP_PID
