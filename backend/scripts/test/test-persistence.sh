#!/bin/bash

# Test script for task persistence

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is not installed. Please install jq to run this script."
    echo "  macOS: brew install jq"
    echo "  Ubuntu/Debian: sudo apt-get install jq"
    echo "  CentOS/RHEL: sudo yum install jq"
    exit 1
fi

echo "🧪 Testing Task Persistence Feature"
echo "=================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# API configuration
API_URL="http://localhost:5000/api"
API_KEY="${API_KEY:-test-key}"

# Note: We don't clean up the data directory anymore since the server creates it
echo -e "${YELLOW}Using existing database from server...${NC}"

# Function to add task to queue
add_task() {
    local instruction="$1"
    local priority="${2:-0}"
    
    response=$(curl -s -X POST "$API_URL/queue/tasks" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"instruction\": \"$instruction\",
            \"priority\": $priority
        }")
    
    echo "$response" | jq -r '.taskId'
}

# Function to get queue stats
get_queue_stats() {
    curl -s -X GET "$API_URL/queue/stats" \
        -H "X-API-Key: $API_KEY"
}

# Function to get task history
get_task_history() {
    local status="$1"
    local query=""
    
    if [ -n "$status" ]; then
        query="?status=$status"
    fi
    
    curl -s -X GET "$API_URL/history/tasks$query" \
        -H "X-API-Key: $API_KEY"
}

# Function to get task details
get_task_details() {
    local taskId="$1"
    curl -s -X GET "$API_URL/history/tasks/$taskId" \
        -H "X-API-Key: $API_KEY"
}

# Wait for server to be ready
echo -e "\n${GREEN}0. Checking server health...${NC}"
for i in {1..10}; do
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:5000/health" | grep -q "200"; then
        echo -e "${GREEN}✓ Server is ready${NC}"
        break
    fi
    if [ $i -eq 10 ]; then
        echo -e "${RED}✗ Server is not responding. Please start the server with 'npm run dev'${NC}"
        exit 1
    fi
    echo "Waiting for server... ($i/10)"
    sleep 1
done

# Start the test
echo -e "\n${GREEN}1. Adding tasks to queue...${NC}"
task1=$(add_task "Calculate fibonacci(10)" 5)
echo "Added task 1: $task1"

task2=$(add_task "List all TypeScript files" 10)
echo "Added task 2: $task2"

task3=$(add_task "Generate a random UUID" 1)
echo "Added task 3: $task3"

# Check queue stats
echo -e "\n${GREEN}2. Checking queue stats...${NC}"
get_queue_stats | jq .

# Pause queue to prevent immediate execution
echo -e "\n${GREEN}3. Pausing queue...${NC}"
curl -s -X POST "$API_URL/queue/pause" -H "X-API-Key: $API_KEY" | jq .

# Give database time to create
sleep 1

# Check database file
echo -e "\n${GREEN}4. Checking database file...${NC}"
# Change to project root directory first
cd "$(dirname "$0")/.." || exit 1

# Wait a bit for database to be created
sleep 2

if [ -f "data/cc-anywhere.db" ]; then
    echo -e "${GREEN}✓ Database file created successfully${NC}"
    echo "Database size: $(ls -lh data/cc-anywhere.db | awk '{print $5}')"
    echo "Database files:"
    ls -lh data/*.db* 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'
else
    echo -e "${RED}✗ Database file not found${NC}"
    echo "Current directory: $(pwd)"
    echo "Looking for: data/cc-anywhere.db"
    echo "Checking data directory contents:"
    ls -la data/ 2>/dev/null || echo "  data directory does not exist"
fi

# Get task history
echo -e "\n${GREEN}5. Getting task history (all tasks)...${NC}"
response=$(get_task_history)
echo "Raw response: $response"
echo "$response" | jq '.data[] | {id, instruction, status, priority}' 2>/dev/null || echo "Failed to parse response"

# Get pending tasks
echo -e "\n${GREEN}6. Getting pending tasks...${NC}"
get_task_history "pending" | jq '.pagination'

# Get specific task details
echo -e "\n${GREEN}7. Getting task details for: $task2${NC}"
get_task_details "$task2" | jq '{id, instruction, status, priority, createdAt}'

# Resume queue and let some tasks complete
echo -e "\n${GREEN}8. Resuming queue...${NC}"
curl -s -X POST "$API_URL/queue/start" -H "X-API-Key: $API_KEY" | jq .

# Wait for tasks to process
echo -e "\n${GREEN}9. Waiting for tasks to process...${NC}"
sleep 5

# Check completed tasks
echo -e "\n${GREEN}10. Getting completed tasks...${NC}"
get_task_history "completed" | jq '.data[] | {id, instruction, status, completedAt}'

# Test pagination
echo -e "\n${GREEN}11. Testing pagination (limit=2)...${NC}"
curl -s -X GET "$API_URL/history/tasks?limit=2&offset=0" \
    -H "X-API-Key: $API_KEY" | jq '.pagination'

# Test search
echo -e "\n${GREEN}12. Testing search (search='fibonacci')...${NC}"
curl -s -X GET "$API_URL/history/tasks?search=fibonacci" \
    -H "X-API-Key: $API_KEY" | jq '.data[] | {id, instruction}'

# Test ordering by priority
echo -e "\n${GREEN}13. Testing ordering by priority...${NC}"
curl -s -X GET "$API_URL/history/tasks?orderBy=priority&orderDirection=DESC" \
    -H "X-API-Key: $API_KEY" | jq '.data[] | {instruction, priority}'

echo -e "\n${GREEN}✅ Task persistence test completed!${NC}"
echo -e "${YELLOW}Note: Database is persisted at ./data/cc-anywhere.db${NC}"
echo -e "${YELLOW}Server restart will restore pending tasks from database.${NC}"