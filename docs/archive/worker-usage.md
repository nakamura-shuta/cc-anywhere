# Worker System Usage Examples

## 1. Inline Mode (Default)

This is the simplest mode where tasks are processed in the same process as the API server.

```bash
# Start the server with inline workers
npm run dev

# In another terminal, submit a task
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-key" \
  -d '{
    "instruction": "Calculate the sum of 1 to 100",
    "options": {
      "timeout": 30000
    }
  }'
```

## 2. Standalone Mode

API server and workers run as separate processes.

### Terminal 1: Start API Server
```bash
# Set worker mode to standalone
export WORKER_MODE=standalone

# Start the API server
npm run dev:standalone
```

### Terminal 2: Start Worker
```bash
# Start a worker process
npm run dev:worker
```

### Terminal 3: Submit Tasks
```bash
# Submit tasks to the queue
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-key" \
  -d '{
    "instruction": "Generate a Python function to sort a list",
    "context": {
      "workingDirectory": "/path/to/your/project"
    }
  }'

# Check queue status
curl http://localhost:3000/api/queue/stats \
  -H "X-API-Key: test-key"
```

## 3. Managed Mode

API server automatically manages worker processes.

```bash
# Configure managed mode with 3 workers
export WORKER_MODE=managed
export WORKER_COUNT=3
export QUEUE_CONCURRENCY=2

# Start the server
npm run dev:managed

# Check worker status
curl http://localhost:3000/api/workers \
  -H "X-API-Key: test-key"

# Response:
{
  "healthy": true,
  "workerCount": 3,
  "workers": [
    {
      "workerId": "worker-0",
      "pid": 12345,
      "startTime": "2024-01-01T00:00:00.000Z",
      "uptime": 60000,
      "restartCount": 0,
      "connected": true
    },
    ...
  ]
}
```

## 4. Production Deployment

### Docker Compose Example

```yaml
version: '3.8'

services:
  api:
    build: .
    environment:
      - WORKER_MODE=standalone
      - DB_PATH=/data/cc-anywhere.db
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data
    command: npm start:standalone

  worker-1:
    build: .
    environment:
      - DB_PATH=/data/cc-anywhere.db
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - QUEUE_CONCURRENCY=3
    volumes:
      - ./data:/data
    command: npm start:worker
    depends_on:
      - api

  worker-2:
    build: .
    environment:
      - DB_PATH=/data/cc-anywhere.db
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - QUEUE_CONCURRENCY=3
    volumes:
      - ./data:/data
    command: npm start:worker
    depends_on:
      - api
```

### Kubernetes Example

```yaml
# API Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cc-anywhere-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: cc-anywhere-api
  template:
    metadata:
      labels:
        app: cc-anywhere-api
    spec:
      containers:
      - name: api
        image: cc-anywhere:latest
        env:
        - name: WORKER_MODE
          value: "standalone"
        - name: DB_PATH
          value: "/data/cc-anywhere.db"
        ports:
        - containerPort: 3000
        volumeMounts:
        - name: data
          mountPath: /data
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: cc-anywhere-data

---
# Worker Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cc-anywhere-worker
spec:
  replicas: 5
  selector:
    matchLabels:
      app: cc-anywhere-worker
  template:
    metadata:
      labels:
        app: cc-anywhere-worker
    spec:
      containers:
      - name: worker
        image: cc-anywhere:latest
        command: ["npm", "run", "start:worker"]
        env:
        - name: DB_PATH
          value: "/data/cc-anywhere.db"
        - name: QUEUE_CONCURRENCY
          value: "2"
        volumeMounts:
        - name: data
          mountPath: /data
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: cc-anywhere-data
```

## 5. Monitoring

### Check Queue Status
```bash
curl http://localhost:3000/api/queue/stats \
  -H "X-API-Key: test-key"
```

### Check Worker Health (Managed Mode)
```bash
curl http://localhost:3000/api/workers \
  -H "X-API-Key: test-key"
```

### View Task History
```bash
curl "http://localhost:3000/api/history?status=completed&limit=10" \
  -H "X-API-Key: test-key"
```

### Health Check
```bash
curl http://localhost:3000/health
```

## 6. Scaling Strategies

### Horizontal Scaling
- **Standalone Mode**: Add more worker processes
- **Managed Mode**: Increase `WORKER_COUNT`
- **Kubernetes**: Scale worker deployment replicas

### Vertical Scaling
- Increase `QUEUE_CONCURRENCY` for more concurrent tasks per worker
- Allocate more CPU/memory to worker processes

### Task-Based Scaling
- Monitor queue size and pending tasks
- Auto-scale workers based on queue depth
- Use metrics like average task duration to optimize concurrency