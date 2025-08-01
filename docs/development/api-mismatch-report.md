# API Data Format Compatibility Report

This report documents all mismatches between the backend API response formats and frontend type definitions for the cc-anywhere project.

## Executive Summary

Several critical mismatches have been identified between the backend API responses and frontend type definitions. These mismatches are causing runtime errors and preventing the frontend from properly displaying data.

## 1. Tasks API (`/api/tasks`)

### GET /api/tasks - List Tasks

**Backend Response Format:**
```typescript
{
  tasks: TaskResponse[],
  total: number,
  limit: number,
  offset: number
}
```

**Frontend Expected Format:**
```typescript
{
  data: TaskResponse[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number,
    hasNext?: boolean,
    hasPrev?: boolean
  }
}
```

**Mismatches:**
- Backend uses `tasks` property, frontend expects `data`
- Backend uses flat structure with `offset`, frontend expects nested `pagination` object
- Frontend expects `page` and `totalPages`, backend provides `offset`
- Frontend expects optional `hasNext` and `hasPrev` properties

### TaskResponse Object

**Backend Response Properties:**
```typescript
{
  taskId: string,
  status: string,
  instruction: string,
  createdAt: string,
  startedAt?: string,
  completedAt?: string,
  result?: any,
  error?: {
    message: string,
    code: string
  },
  logs?: string[],
  retryMetadata?: any,
  allowedTools?: string[],
  workingDirectory?: string,
  todos?: any,
  continuedFrom?: string,
  repositoryName?: string,
  groupId?: string,
  progressData?: any
}
```

**Frontend Expected Properties:**
```typescript
{
  taskId: string,
  status: TaskStatus,
  instruction: string,
  createdAt: string,
  startedAt?: string,
  completedAt?: string,
  workingDirectory?: string,
  context?: TaskContext,
  result?: any,
  error?: {
    message: string,
    code: string
  },
  logs?: string[]
}
```

**Mismatches:**
- Backend includes many extra properties not defined in frontend: `retryMetadata`, `allowedTools`, `todos`, `continuedFrom`, `repositoryName`, `groupId`, `progressData`
- Frontend expects `context` property, backend doesn't provide it in the response
- Status is string in backend but expected as TaskStatus enum in frontend

## 2. Task Cancel API

**Backend Response (DELETE /api/tasks/:taskId):**
```typescript
{
  message: string,
  taskId: string
}
```

**Frontend Expected:**
The frontend service tries to handle this as a `TaskResponse` object, but backend returns a simple cancel confirmation.

**Issue:**
Frontend `cancelTask` method expects a full TaskResponse but backend returns TaskCancelResponse.

## 3. Task Logs API

**Backend Response Format:**
```typescript
{
  taskId: string,
  logs: string[]
}
```

**Frontend Expected Format:**
```typescript
{
  logs: string[],
  status: TaskStatus,
  completed: boolean
}
```

**Mismatches:**
- Frontend expects `status` and `completed` fields that backend doesn't provide
- Backend includes `taskId` which frontend type doesn't define

## 4. Batch Tasks API

**Backend Response Format (POST /api/batch/tasks):**
```typescript
{
  groupId: string,
  tasks: {
    taskId: string,
    repository: string,
    status: string
  }[]
}
```

**Frontend Expected Format:**
```typescript
{
  groupId: string,
  tasks: TaskResponse[],
  createdAt: string
}
```

**Mismatches:**
- Backend task objects only have `taskId`, `repository`, and `status`
- Frontend expects full `TaskResponse` objects
- Frontend expects `createdAt` field that backend doesn't provide

## 5. Batch Task Status API

**Backend Response Format:**
```typescript
{
  groupId: string,
  summary: {
    total: number,
    pending: number,
    running: number,
    completed: number,
    failed: number
  },
  tasks: {
    taskId: string,
    repository: string,
    status: string,
    duration?: number,
    result?: any,
    error?: any
  }[]
}
```

**Frontend Expected Format:**
```typescript
{
  groupId: string,
  total: number,
  completed: number,
  failed: number,
  pending: number,
  running: number,
  tasks: TaskResponse[]
}
```

**Mismatches:**
- Backend uses nested `summary` object, frontend expects flat structure
- Backend task objects are simplified, frontend expects full `TaskResponse` objects

## 6. Sessions API

**Backend Response Format:**
The sessions API endpoints return different formats than what the frontend types define:

- Session objects include `userId`, `userEmail`, and other properties not in frontend types
- Continue session response includes `turnNumber` not defined in frontend

## 7. Error Handling

**Backend Error Format:**
```typescript
{
  error: {
    message: string,
    statusCode: number,
    code: string,
    originalMessage?: string
  }
}
```

**Frontend Error Handling:**
Frontend `ApiError` class expects:
- `status` (not `statusCode`)
- `statusText`
- `data` (optional)

## Recommendations

1. **Immediate Fixes Required:**
   - Update frontend `taskService.list()` to properly transform backend response to expected format
   - Fix the taskStore initialization to handle the correct data structure
   - Update error handling to map backend error format to frontend expectations

2. **Backend Alignment Options:**
   - Modify backend to return data in the format frontend expects
   - OR update frontend types to match backend responses
   - OR create transformation layers in the service methods

3. **Type Safety Improvements:**
   - Share type definitions between backend and frontend
   - Use code generation from OpenAPI spec
   - Implement runtime validation

4. **Critical Path Issues:**
   - The `/tasks` page is broken due to pagination format mismatch
   - Task cancellation may not work properly due to response type mismatch
   - Log viewing functionality expects additional fields not provided

## Impact Analysis

- **High Impact:** Tasks list page completely broken
- **Medium Impact:** Task details, logs, and batch operations may have issues
- **Low Impact:** Some properties are extra/missing but don't break functionality

## Next Steps

1. Fix the immediate pagination issue in `taskService.list()`
2. Update frontend types to match backend reality
3. Add transformation layers where needed
4. Consider implementing shared types package