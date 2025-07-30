#!/bin/bash

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is not installed. Please install jq to run this script."
    echo "  macOS: brew install jq"
    echo "  Ubuntu/Debian: sudo apt-get install jq"
    echo "  CentOS/RHEL: sudo yum install jq"
    exit 1
fi

API_URL="http://localhost:5000/api"
API_KEY="test-key"

echo "Testing CC-Anywhere Queue Functionality"
echo "======================================="

# Check queue stats
echo -e "\n1. Checking initial queue stats:"
curl -s -X GET "$API_URL/queue/stats" -H "X-API-Key: $API_KEY" | jq

# Add tasks to queue
echo -e "\n2. Adding tasks to queue:"
echo "   - Low priority task (priority: 1)"
TASK1=$(curl -s -X POST "$API_URL/queue/tasks" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "List all files in the current directory",
    "priority": 1
  }' | jq -r '.taskId')
echo "   Task ID: $TASK1"

echo "   - High priority task (priority: 10)"
TASK2=$(curl -s -X POST "$API_URL/queue/tasks" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "Calculate the sum of 1 to 100",
    "priority": 10
  }' | jq -r '.taskId')
echo "   Task ID: $TASK2"

echo "   - Medium priority task with working directory (priority: 5)"
TASK3=$(curl -s -X POST "$API_URL/queue/tasks" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "Count TypeScript files in src directory",
    "context": {
      "workingDirectory": "$(pwd)"
    },
    "options": {
      "allowedTools": ["Glob", "Read"]
    },
    "priority": 5
  }' | jq -r '.taskId')
echo "   Task ID: $TASK3"

# Check queue stats after adding tasks
echo -e "\n3. Queue stats after adding tasks:"
curl -s -X GET "$API_URL/queue/stats" -H "X-API-Key: $API_KEY" | jq

# List all tasks
echo -e "\n4. Listing all tasks in queue:"
curl -s -X GET "$API_URL/queue/tasks" -H "X-API-Key: $API_KEY" | jq

# Wait for tasks to complete
echo -e "\n5. Waiting for tasks to complete..."
sleep 10

# Check individual task results
echo -e "\n6. Checking task results:"
echo "   - Task 1 ($TASK1):"
curl -s -X GET "$API_URL/queue/tasks/$TASK1" -H "X-API-Key: $API_KEY" | jq '.status, .result'

echo "   - Task 2 ($TASK2):"
curl -s -X GET "$API_URL/queue/tasks/$TASK2" -H "X-API-Key: $API_KEY" | jq '.status, .result'

echo "   - Task 3 ($TASK3):"
curl -s -X GET "$API_URL/queue/tasks/$TASK3" -H "X-API-Key: $API_KEY" | jq '.status, .result'

# Final queue stats
echo -e "\n7. Final queue stats:"
curl -s -X GET "$API_URL/queue/stats" -H "X-API-Key: $API_KEY" | jq

# Test queue control
echo -e "\n8. Testing queue control:"
echo "   - Pausing queue"
curl -s -X POST "$API_URL/queue/pause" -H "X-API-Key: $API_KEY" | jq

echo "   - Changing concurrency to 4"
curl -s -X PUT "$API_URL/queue/concurrency" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"concurrency": 4}' | jq

echo "   - Starting queue again"
curl -s -X POST "$API_URL/queue/start" -H "X-API-Key: $API_KEY" | jq

echo -e "\nQueue testing complete!"