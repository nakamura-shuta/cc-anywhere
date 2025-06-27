# Timeout Handling

## Overview

The cc-anywhere project now supports advanced timeout handling with granular control over different execution phases, timeout warnings, and graceful shutdown capabilities.

## Features

### 1. Granular Timeout Control

Tasks can now specify timeouts for different execution phases:

- **Setup Phase**: Time allowed for task initialization and preparation
- **Execution Phase**: Time allowed for the main task execution
- **Cleanup Phase**: Time allowed for graceful shutdown and resource cleanup
- **Total Timeout**: Overall maximum time for the entire task

### 2. Timeout Configuration

#### Simple Timeout (Legacy)
```json
{
  "instruction": "Process data",
  "options": {
    "timeout": 300000  // 5 minutes total timeout
  }
}
```

#### Advanced Timeout Configuration
```json
{
  "instruction": "Process large dataset",
  "options": {
    "timeout": {
      "total": 600000,        // 10 minutes total
      "setup": 30000,         // 30 seconds for setup
      "execution": 540000,    // 9 minutes for execution
      "cleanup": 30000,       // 30 seconds for cleanup
      "warningThreshold": 0.9, // Warn at 90% of timeout
      "behavior": "soft"       // Soft timeout (graceful shutdown)
    }
  }
}
```

### 3. Timeout Warnings

The system emits warnings before timeouts occur:

- **Warning Threshold**: Configurable percentage (default: 90%)
- **Warning Information**: Includes phase, elapsed time, remaining time
- **Logged in Task Logs**: Warnings appear in the task execution logs

Example warning in logs:
```
Task timeout warning: 30000ms remaining in execution phase
```

### 4. Timeout Behaviors

#### Soft Timeout (Default)
- Sends interrupt signal to the task
- Allows cleanup phase to run
- Graceful resource cleanup
- Better for long-running tasks that need proper shutdown

#### Hard Timeout
- Immediate task termination
- No cleanup phase
- Use for tasks that must be stopped immediately

### 5. Timeout Error Messages

Enhanced error messages provide context:

```json
{
  "error": {
    "message": "Task timed out during execution phase after 240000ms (limit: 240000ms, behavior: soft)",
    "phase": "execution",
    "elapsed": 240000,
    "limit": 240000,
    "behavior": "soft"
  }
}
```

## API Examples

### Basic Task with Simple Timeout
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "instruction": "Analyze repository",
    "options": {
      "timeout": 120000
    }
  }'
```

### Task with Advanced Timeout Configuration
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "instruction": "Generate comprehensive report",
    "options": {
      "timeout": {
        "total": 300000,
        "setup": 10000,
        "execution": 270000,
        "cleanup": 20000,
        "warningThreshold": 0.8,
        "behavior": "soft"
      }
    }
  }'
```

### Long-Running Task with Warnings
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "instruction": "Process large dataset with progress updates",
    "options": {
      "timeout": {
        "total": 1800000,
        "setup": 60000,
        "execution": 1680000,
        "cleanup": 60000,
        "warningThreshold": 0.75,
        "behavior": "soft"
      },
      "async": true
    }
  }'
```

## Implementation Details

### TimeoutManager

The `TimeoutManager` class handles all timeout-related logic:

- Tracks elapsed time for each phase
- Emits warnings at configured thresholds
- Supports timeout extension during execution
- Provides graceful shutdown capabilities

### Task Executor Integration

The task executor integrates with TimeoutManager to:

1. Initialize timeout configuration
2. Transition between phases
3. Handle timeout events
4. Clean up resources on timeout

### Phase Transitions

```
SETUP → EXECUTION → CLEANUP → COMPLETE
  ↓         ↓          ↓
TIMEOUT  TIMEOUT   TIMEOUT
```

## Best Practices

1. **Use Soft Timeouts** for tasks that manage resources or state
2. **Set Realistic Timeouts** based on expected task duration
3. **Configure Warning Thresholds** to get early notifications
4. **Use Cleanup Phase** for proper resource disposal
5. **Monitor Task Logs** for timeout warnings and adjust accordingly

## Default Values

- **Total Timeout**: 300000ms (5 minutes)
- **Setup Timeout**: 30000ms (30 seconds)
- **Execution Timeout**: 240000ms (4 minutes)
- **Cleanup Timeout**: 30000ms (30 seconds)
- **Warning Threshold**: 0.9 (90%)
- **Behavior**: soft

## Migration from Legacy Timeout

Existing code using simple numeric timeouts will continue to work:

```json
// This still works
{
  "options": {
    "timeout": 300000
  }
}

// Internally converted to
{
  "options": {
    "timeout": {
      "total": 300000
    }
  }
}
```