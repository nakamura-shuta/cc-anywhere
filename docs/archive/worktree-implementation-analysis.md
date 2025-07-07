# Git Worktree Implementation Analysis for CC-Anywhere

## Executive Summary

This document outlines the dependencies and impact areas for implementing git worktree functionality in CC-Anywhere. The goal is to enable isolated execution environments for different repositories or branches without interfering with the main repository state.

## Current Architecture Overview

### Key Components

1. **Task Execution System**
   - `TaskExecutorImpl` - Main execution engine
   - Uses `workingDirectory` from task context
   - Supports Claude Code SDK with cwd option
   - Has abort/cancellation support

2. **Repository Management**
   - Static configuration in `config/repositories.json`
   - Simple path-based repository mapping
   - No dynamic repository discovery

3. **Worker System**
   - Supports multiple worker processes
   - Uses child_process.fork() for isolation
   - Has worker management with auto-restart
   - Currently focused on task concurrency, not repository isolation

4. **File System Operations**
   - Direct fs operations using Node.js fs module
   - Path resolution using path.resolve()
   - Working directory validation in executor

## Impact Areas for Worktree Implementation

### 1. Core Components to Modify

#### TaskExecutorImpl (`src/claude/executor.ts`)
- **Current**: Uses `workingDirectory` from task context
- **Required Changes**:
  - Add worktree creation/management logic
  - Implement cleanup after task completion
  - Handle worktree-specific paths

#### Task Types (`src/claude/types.ts`)
- **Current**: Simple `workingDirectory` string in TaskContext
- **Required Changes**:
  - Add worktree configuration options
  - Support branch/commit specification
  - Add isolation level options

#### Repository Routes (`src/server/routes/repositories.ts`)
- **Current**: Static repository list from JSON file
- **Required Changes**:
  - Dynamic repository discovery
  - Worktree status endpoints
  - Repository health checks

### 2. New Dependencies Needed

#### Git Operations
- **simple-git** or **isomorphic-git** for git operations
  - Worktree creation/deletion
  - Branch management
  - Repository status checks

#### File System Utilities
- **rimraf** or **fs-extra** for safe directory cleanup
- **tmp** or **temp** for temporary directory management

#### Process Isolation (Optional)
- **execa** for better subprocess handling if needed
- Consider Docker integration for stronger isolation

### 3. Configuration Changes

#### Environment Variables
```typescript
// Add to src/config/index.ts
WORKTREE_BASE_PATH: z.string().default("./worktrees"),
WORKTREE_CLEANUP_ON_COMPLETE: z.boolean().default(true),
WORKTREE_MAX_AGE_MINUTES: z.number().default(60),
ENABLE_WORKTREE_ISOLATION: z.boolean().default(false),
```

#### Repository Configuration Enhancement
```typescript
interface Repository {
  name: string;
  path: string;
  defaultBranch?: string;
  worktreeEnabled?: boolean;
  worktreeStrategy?: 'per-task' | 'per-branch' | 'shared';
}
```

### 4. Implementation Patterns

#### Worktree Manager Service
```typescript
class WorktreeManager {
  async createWorktree(repo: string, branch: string): Promise<string>
  async cleanupWorktree(worktreePath: string): Promise<void>
  async listActiveWorktrees(): Promise<WorktreeInfo[]>
  async pruneStaleWorktrees(): Promise<void>
}
```

#### Task Execution Flow Changes
1. Pre-execution: Create worktree if requested
2. Execution: Use worktree path as working directory
3. Post-execution: Cleanup worktree (configurable)
4. Error handling: Ensure cleanup on failures

### 5. Database Schema Updates

Add worktree tracking to task records:
```sql
ALTER TABLE tasks ADD COLUMN worktree_path TEXT;
ALTER TABLE tasks ADD COLUMN worktree_branch TEXT;
ALTER TABLE tasks ADD COLUMN worktree_created_at DATETIME;
ALTER TABLE tasks ADD COLUMN worktree_cleaned_at DATETIME;
```

### 6. API Changes

#### Task Request Enhancement
```typescript
interface TaskRequest {
  instruction: string;
  context?: {
    workingDirectory?: string;
    worktree?: {
      enabled: boolean;
      branch?: string;
      commit?: string;
      cleanupStrategy?: 'immediate' | 'delayed' | 'manual';
    };
  };
}
```

### 7. Security Considerations

- Path traversal prevention in worktree paths
- Resource limits (max worktrees per repository)
- Disk space monitoring
- Process isolation between worktrees

### 8. Performance Considerations

- Worktree creation overhead (~1-5 seconds)
- Disk space usage (full working copy per worktree)
- Cleanup scheduling to avoid blocking operations
- Consider connection pooling for git operations

## Implementation Phases

### Phase 1: Basic Worktree Support
- Add simple-git dependency
- Implement WorktreeManager
- Modify TaskExecutor for worktree creation
- Basic cleanup on task completion

### Phase 2: Enhanced Management
- Persistent worktree tracking
- Cleanup strategies
- API endpoints for worktree management
- Monitoring and metrics

### Phase 3: Advanced Features
- Branch-specific caching
- Worktree templates
- Pre-warmed worktrees
- Advanced isolation options

## Risks and Mitigations

1. **Disk Space Exhaustion**
   - Implement aggressive cleanup policies
   - Monitor disk usage
   - Set limits on concurrent worktrees

2. **Performance Degradation**
   - Cache frequently used worktrees
   - Implement worktree pooling
   - Async cleanup operations

3. **Data Corruption**
   - Use git's built-in worktree management
   - Implement proper locking
   - Validate worktree state before use

## Recommendations

1. Start with simple-git for git operations (mature, well-tested)
2. Implement as opt-in feature initially
3. Use existing worker infrastructure for isolation
4. Add comprehensive logging for debugging
5. Consider integration tests with real git repositories

## Next Steps

1. Create proof-of-concept with simple-git
2. Design detailed API for worktree configuration
3. Implement WorktreeManager service
4. Update TaskExecutor with worktree support
5. Add monitoring and cleanup mechanisms