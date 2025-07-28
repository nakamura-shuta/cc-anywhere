import { getSharedDbProvider, getSharedRepository } from "../../db/shared-instance";
import { SchedulerService } from "../../services/scheduler-service";

/**
 * Initialize shared services (database, repository, scheduler)
 * @returns Initialized services
 */
export function initializeServices() {
  return {
    dbProvider: getSharedDbProvider(),
    repository: getSharedRepository(),
    schedulerService: new SchedulerService(),
  };
}
