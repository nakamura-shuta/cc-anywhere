/**
 * Task Groups API Routes
 * Simple multiple task execution endpoints
 */

import type { FastifyPluginAsync } from 'fastify';
import { TaskGroupExecutor } from '../../services/task-group-executor.js';
import { logger } from '../../utils/logger.js';
import type { 
  TaskGroupExecutionRequest,
  TaskGroupExecutionResponse,
  TaskGroup 
} from '../../types/task-groups.js';

const taskGroupsRoute: FastifyPluginAsync = async (fastify) => {
  const executor = new TaskGroupExecutor();

  // Execute a task group
  fastify.post<{
    Body: TaskGroupExecutionRequest;
    Reply: TaskGroupExecutionResponse;
  }>('/execute', {
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          tasks: {
            type: 'array',
            minItems: 1,
            maxItems: 50, // Reasonable limit
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', minLength: 1 },
                name: { type: 'string', minLength: 1 },
                instruction: { type: 'string', minLength: 1 },
                dependencies: {
                  type: 'array',
                  items: { type: 'string' }
                }
              },
              required: ['id', 'name', 'instruction'],
              additionalProperties: false
            }
          },
          execution: {
            type: 'object',
            properties: {
              mode: { 
                type: 'string',
                enum: ['sequential', 'parallel', 'mixed']
              },
              continueSession: { type: 'boolean', enum: [true] },
              continueOnError: { type: 'boolean' },
              timeout: { type: 'number', minimum: 1000, maximum: 600000 }
            },
            required: ['mode', 'continueSession'],
            additionalProperties: false
          },
          context: {
            type: 'object',
            properties: {
              workingDirectory: { type: 'string' },
              repositoryPath: { type: 'string' }
            },
            additionalProperties: false
          }
        },
        required: ['name', 'tasks', 'execution'],
        additionalProperties: false
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            groupId: { type: 'string' },
            message: { type: 'string' },
            totalTasks: { type: 'number' },
            executionPlan: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  tasks: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        instruction: { type: 'string' },
                        dependencies: {
                          type: 'array',
                          items: { type: 'string' }
                        }
                      }
                    }
                  },
                  parallel: { type: 'boolean' }
                }
              }
            }
          },
          additionalProperties: false
        }
      }
    }
  }, async (request, reply) => {
    const { name, tasks, execution, context } = request.body;

    try {
      // Generate group ID
      const groupId = `group-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Create task group
      const taskGroup: TaskGroup = {
        id: groupId,
        name,
        tasks,
        execution
      };

      logger.info('Starting task group execution', {
        groupId,
        name,
        taskCount: tasks.length,
        executionMode: execution.mode
      });

      // Start execution (async)
      const executionPromise = executor.execute(taskGroup, context);

      // Don't wait for completion, return immediately
      executionPromise.catch(error => {
        logger.error('Task group execution failed', {
          groupId,
          error: error instanceof Error ? error.message : String(error)
        });
      });

      // Build execution plan for response
      const executionPlan = executor.buildExecutionPlan(tasks);

      return {
        success: true,
        groupId,
        message: `Task group '${name}' started with ${tasks.length} tasks`,
        totalTasks: tasks.length,
        executionPlan
      };

    } catch (error) {
      logger.error('Failed to start task group execution', {
        name,
        error: error instanceof Error ? error.message : String(error)
      });

      reply.status(400);
      return {
        success: false,
        groupId: '',
        message: error instanceof Error ? error.message : 'Failed to start task group',
        totalTasks: 0,
        executionPlan: []
      };
    }
  });

  // Get task group status
  fastify.get<{
    Params: { groupId: string };
  }>('/:groupId/status', {
    schema: {
      params: {
        type: 'object',
        properties: {
          groupId: { type: 'string', minLength: 1 }
        },
        required: ['groupId'],
        additionalProperties: false
      },
      response: {
        200: {
          type: 'object',
          properties: {
            groupId: { type: 'string' },
            status: { 
              type: 'string',
              enum: ['pending', 'running', 'completed', 'failed', 'cancelled']
            },
            sessionId: { type: 'string' },
            completedTasks: { type: 'number' },
            totalTasks: { type: 'number' },
            progress: { type: 'number' },
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  status: { 
                    type: 'string',
                    enum: ['pending', 'running', 'completed', 'failed']
                  },
                  error: { type: 'string' },
                  startedAt: { type: 'string', format: 'date-time' },
                  completedAt: { type: 'string', format: 'date-time' }
                }
              }
            },
            startedAt: { type: 'string', format: 'date-time' },
            completedAt: { type: 'string', format: 'date-time' }
          },
          additionalProperties: false
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { groupId } = request.params;

    const result = executor.getStatus(groupId);
    if (!result) {
      reply.status(404);
      return {
        error: 'NOT_FOUND',
        message: `Task group '${groupId}' not found`
      };
    }

    return {
      groupId: result.groupId,
      status: result.status,
      sessionId: result.sessionId,
      completedTasks: result.completedTasks,
      totalTasks: result.totalTasks,
      progress: result.progress,
      tasks: result.tasks.map(task => ({
        id: task.id,
        name: task.name,
        status: task.status,
        error: task.error,
        startedAt: task.startedAt?.toISOString(),
        completedAt: task.completedAt?.toISOString()
      })),
      startedAt: result.startedAt.toISOString(),
      completedAt: result.completedAt?.toISOString()
    };
  });

  // Cancel task group execution
  fastify.delete<{
    Params: { groupId: string };
  }>('/:groupId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          groupId: { type: 'string', minLength: 1 }
        },
        required: ['groupId'],
        additionalProperties: false
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request) => {
    const { groupId } = request.params;

    const cancelled = await executor.cancel(groupId);
    
    return {
      success: cancelled,
      message: cancelled 
        ? `Task group '${groupId}' cancelled successfully`
        : `Task group '${groupId}' not found or already completed`
    };
  });

  // Cleanup completed task groups
  fastify.post('/cleanup', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async () => {
    executor.cleanup();
    
    return {
      success: true,
      message: 'Completed task groups cleaned up successfully'
    };
  });
};

export default taskGroupsRoute;