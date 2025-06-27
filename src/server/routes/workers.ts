import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { WorkerManager } from "../../worker/worker-manager";

// Extend Fastify instance type
declare module "fastify" {
  interface FastifyInstance {
    workerManager?: WorkerManager;
  }
}

export const workerRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Get worker status
  fastify.get("/workers", async (_request, reply) => {
    const { workerManager } = fastify;

    if (!workerManager) {
      return reply.code(404).send({
        error: "Worker manager not available",
        message: "Server is not running in managed worker mode",
      });
    }

    const statuses = workerManager.getAllWorkerStatuses();

    return {
      healthy: workerManager.isHealthy(),
      workerCount: workerManager.getWorkerCount(),
      workers: statuses,
    };
  });

  // Get specific worker status
  fastify.get<{
    Params: { workerId: string };
  }>("/workers/:workerId", async (request, reply) => {
    const { workerManager } = fastify;
    const { workerId } = request.params;

    if (!workerManager) {
      return reply.code(404).send({
        error: "Worker manager not available",
        message: "Server is not running in managed worker mode",
      });
    }

    const status = workerManager.getWorkerStatus(workerId);

    if (!status) {
      return reply.code(404).send({
        error: "Worker not found",
        workerId,
      });
    }

    return status;
  });

  // Start a new worker
  fastify.post<{
    Body: { workerId?: string };
  }>("/workers", async (request, reply) => {
    const { workerManager } = fastify;
    const { workerId = `worker-${Date.now()}` } = request.body;

    if (!workerManager) {
      return reply.code(404).send({
        error: "Worker manager not available",
        message: "Server is not running in managed worker mode",
      });
    }

    try {
      await workerManager.startWorker(workerId);
      return {
        success: true,
        workerId,
        status: workerManager.getWorkerStatus(workerId),
      };
    } catch (error) {
      return reply.code(500).send({
        error: "Failed to start worker",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Stop a worker
  fastify.delete<{
    Params: { workerId: string };
  }>("/workers/:workerId", async (request, reply) => {
    const { workerManager } = fastify;
    const { workerId } = request.params;

    if (!workerManager) {
      return reply.code(404).send({
        error: "Worker manager not available",
        message: "Server is not running in managed worker mode",
      });
    }

    try {
      await workerManager.stopWorker(workerId);
      return {
        success: true,
        workerId,
        message: "Worker stopped successfully",
      };
    } catch (error) {
      return reply.code(500).send({
        error: "Failed to stop worker",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
};
