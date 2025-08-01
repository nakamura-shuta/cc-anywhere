import { getSharedDbProvider, getSharedRepository } from "../../db/shared-instance";
import { SchedulerService } from "../../services/scheduler-service";
import type { WebSocketServer } from "../../websocket/websocket-server";

/**
 * Initialize shared services (database, repository, scheduler)
 * @param wsServer Optional WebSocket server for real-time updates
 * @returns Initialized services
 */
export function initializeServices(wsServer?: WebSocketServer) {
  return {
    dbProvider: getSharedDbProvider(),
    repository: getSharedRepository(),
    schedulerService: new SchedulerService(wsServer),
  };
}
