# Worker System Documentation

## Overview

The cc-anywhere project supports three different worker modes for processing tasks:

1. **Inline Mode** (default) - Tasks are processed within the main API server process
2. **Standalone Mode** - API server only queues tasks; separate worker processes handle execution
3. **Managed Mode** - API server spawns and manages worker processes automatically

## Worker Modes

### Inline Mode

This is the default mode where tasks are processed directly in the API server process.

**Pros:**
- Simple setup
- Low overhead
- Good for development and small workloads

**Cons:**
- Task processing can affect API responsiveness
- Limited scalability

**Usage:**
```bash
# Development
npm run dev

# Production
npm start
```

### Standalone Mode

In this mode, the API server only accepts and queues tasks. Separate worker processes must be started to process the tasks.

**Pros:**
- Complete separation of API and worker concerns
- Can scale workers independently
- Workers can run on different machines

**Cons:**
- More complex deployment
- Requires managing multiple processes

**Usage:**
```bash
# Start API server in standalone mode
npm run dev:standalone  # Development
npm run start:standalone  # Production

# In separate terminal(s), start worker(s)
npm run dev:worker  # Development
npm run start:worker  # Production
```

### Managed Mode

The API server automatically spawns and manages worker processes.

**Pros:**
- Automatic worker lifecycle management
- Auto-restart on failures
- Single deployment unit

**Cons:**
- All workers run on same machine as API
- More resource usage on API server

**Usage:**
```bash
# Start API server with managed workers
npm run dev:managed  # Development
npm run start:managed  # Production
```

## Configuration

Configure worker behavior through environment variables:

```bash
# Worker mode: inline, standalone, or managed
WORKER_MODE=inline

# Number of concurrent tasks per worker
QUEUE_CONCURRENCY=2

# Number of worker processes (managed mode only)
WORKER_COUNT=1

# Database path (shared between API and workers)
DB_PATH=./data/cc-anywhere.db
```

## Worker Management API (Managed Mode Only)

When running in managed mode, additional API endpoints are available:

### Get All Workers
```http
GET /api/workers
```

Response:
```json
{
  "healthy": true,
  "workerCount": 2,
  "workers": [
    {
      "workerId": "worker-0",
      "pid": 12345,
      "startTime": "2024-01-01T00:00:00.000Z",
      "uptime": 3600000,
      "restartCount": 0,
      "connected": true
    }
  ]
}
```

### Get Worker Status
```http
GET /api/workers/:workerId
```

### Start New Worker
```http
POST /api/workers
Content-Type: application/json

{
  "workerId": "worker-2"  // Optional
}
```

### Stop Worker
```http
DELETE /api/workers/:workerId
```

## Task Lifecycle

1. **Task Submission**: Client submits task via `/api/tasks` endpoint
2. **Queue Addition**: Task is added to queue and persisted to database
3. **Worker Pickup**: Available worker picks up task from queue
4. **Execution**: Worker executes task using Claude Code SDK
5. **Completion**: Task result is saved and client is notified

## Graceful Shutdown

All worker modes support graceful shutdown:

1. **Signal Reception**: Process receives SIGTERM/SIGINT
2. **Stop New Tasks**: Queue stops accepting new tasks
3. **Complete Running**: Running tasks are allowed to complete (with timeout)
4. **Cleanup**: Resources are cleaned up and process exits

## Monitoring

### Health Check
The `/health` endpoint includes worker information:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "queue": {
    "size": 5,
    "pending": 3,
    "running": 2,
    "completed": 100,
    "failed": 2
  },
  "workerMode": "managed",
  "workers": {
    "count": 2,
    "healthy": true
  }
}
```

### Logs
Workers log with `[Worker]` prefix for easy filtering:

```
[Worker] Task completed taskId=123 instruction="..." duration=1234
[Worker] Task failed taskId=456 error="..."
[Worker] Health check healthy=true pending=0 running=1
```

## Best Practices

1. **Development**: Use inline mode for simplicity
2. **Production**: Use standalone or managed mode for better scalability
3. **Scaling**: Start with managed mode, move to standalone for multi-machine setups
4. **Monitoring**: Set up log aggregation and alerting on worker health
5. **Database**: Ensure database can handle concurrent access from multiple workers

## Troubleshooting

### Workers Not Processing Tasks
- Check worker logs for errors
- Verify database connectivity
- Ensure `QUEUE_CONCURRENCY > 0`

### High Memory Usage
- Reduce `QUEUE_CONCURRENCY`
- Check for memory leaks in task handlers
- Monitor task execution time

### Worker Crashes
- Check logs for unhandled errors
- Increase `gracefulShutdownTimeout` for long-running tasks
- Verify Claude API key is valid