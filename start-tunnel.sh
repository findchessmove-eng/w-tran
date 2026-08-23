#!/bin/bash

# Terminate background jobs if script is interrupted
cleanup() {
    echo -e "\nStopping local server (PID: $SERVER_PID)..."
    kill $SERVER_PID 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM

echo "================================================="
echo "   Shabd Anuvad - Launching with Port Forwarding"
echo "================================================="

# Start node server in the background
node server.js &
SERVER_PID=$!

# Wait for server to boot up
sleep 1.5

echo ""
echo "Starting Serveo port forwarding tunnel..."
echo "================================================="
echo "👇 Share the URL printed below with your friends:"
echo "================================================="
echo ""

# Start the tunnel in the foreground
ssh -R 80:localhost:3000 serveo.net

# Cleanup on normal exit
cleanup
