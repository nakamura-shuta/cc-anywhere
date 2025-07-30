import type { Database } from "better-sqlite3";
import type {
  IQueryableRepository,
  PaginationOptions,
  PaginatedResult,
  QueryFilter,
} from "./types.js";
import { logger } from "../utils/logger.js";

/**
 * Base repository implementation for SQLite
 */
export abstract class BaseRepository<T extends { id: string }, ID = string>
  implements IQueryableRepository<T, ID>
{
  protected abstract tableName: string;

  constructor(protected db: Database) {}

  async findById(id: ID): Promise<T | null> {
    try {
      const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`);
      const row = stmt.get(id as string);
      return row ? this.mapRowToEntity(row) : null;
    } catch (error) {
      logger.error(`Error finding ${this.tableName} by id`, { id, error });
      throw error;
    }
  }

  async findAll(): Promise<T[]> {
    try {
      const stmt = this.db.prepare(`SELECT * FROM ${this.tableName}`);
      const rows = stmt.all();
      return rows.map((row) => this.mapRowToEntity(row));
    } catch (error) {
      logger.error(`Error finding all ${this.tableName}`, { error });
      throw error;
    }
  }

  async create(entity: T): Promise<T> {
    try {
      const data = this.serializeEntity(entity);
      const columns = Object.keys(data).join(", ");
      const placeholders = Object.keys(data)
        .map(() => "?")
        .join(", ");
      const values = Object.values(data);

      const stmt = this.db.prepare(
        `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders})`,
      );
      stmt.run(...values);

      return entity;
    } catch (error) {
      logger.error(`Error creating ${this.tableName}`, { entity, error });
      throw error;
    }
  }

  async update(id: ID, updates: Partial<T>): Promise<T | null> {
    try {
      const data = this.serializeEntity(updates as T);
      const setClause = Object.keys(data)
        .map((key) => `${key} = ?`)
        .join(", ");
      const values = [...Object.values(data), id as string];

      const stmt = this.db.prepare(`UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`);
      const result = stmt.run(...values);

      if (result.changes === 0) {
        return null;
      }

      return this.findById(id);
    } catch (error) {
      logger.error(`Error updating ${this.tableName}`, { id, updates, error });
      throw error;
    }
  }

  async delete(id: ID): Promise<boolean> {
    try {
      const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`);
      const result = stmt.run(id as string);
      return result.changes > 0;
    } catch (error) {
      logger.error(`Error deleting ${this.tableName}`, { id, error });
      throw error;
    }
  }

  async findOne(filters: QueryFilter[]): Promise<T | null> {
    try {
      const { whereClause, values } = this.buildWhereClause(filters);
      const query = `SELECT * FROM ${this.tableName} ${whereClause} LIMIT 1`;
      const stmt = this.db.prepare(query);
      const row = stmt.get(...values);
      return row ? this.mapRowToEntity(row) : null;
    } catch (error) {
      logger.error(`Error finding one ${this.tableName}`, { filters, error });
      throw error;
    }
  }

  async findMany(filters: QueryFilter[], options?: PaginationOptions): Promise<PaginatedResult<T>> {
    try {
      const { whereClause, values } = this.buildWhereClause(filters);
      const countQuery = `SELECT COUNT(*) as total FROM ${this.tableName} ${whereClause}`;
      const countStmt = this.db.prepare(countQuery);
      const countResult = countStmt.get(...values) as { total: number };
      const total = countResult.total;

      if (total === 0) {
        return {
          items: [],
          total: 0,
          page: options?.page || 1,
          limit: options?.limit || 50,
          totalPages: 0,
        };
      }

      let query = `SELECT * FROM ${this.tableName} ${whereClause}`;

      if (options?.sortBy) {
        query += ` ORDER BY ${options.sortBy} ${options.sortOrder || "asc"}`;
      }

      if (options?.limit) {
        const offset = ((options.page || 1) - 1) * options.limit;
        query += ` LIMIT ${options.limit} OFFSET ${offset}`;
      }

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...values);
      const items = rows.map((row) => this.mapRowToEntity(row));

      return {
        items,
        total,
        page: options?.page || 1,
        limit: options?.limit || 50,
        totalPages: Math.ceil(total / (options?.limit || 50)),
      };
    } catch (error) {
      logger.error(`Error finding many ${this.tableName}`, { filters, options, error });
      throw error;
    }
  }

  async count(filters?: QueryFilter[]): Promise<number> {
    try {
      const { whereClause, values } = filters
        ? this.buildWhereClause(filters)
        : { whereClause: "", values: [] };
      const query = `SELECT COUNT(*) as total FROM ${this.tableName} ${whereClause}`;
      const stmt = this.db.prepare(query);
      const result = stmt.get(...values) as { total: number };
      return result.total;
    } catch (error) {
      logger.error(`Error counting ${this.tableName}`, { filters, error });
      throw error;
    }
  }

  async exists(id: ID): Promise<boolean> {
    try {
      const stmt = this.db.prepare(
        `SELECT EXISTS(SELECT 1 FROM ${this.tableName} WHERE id = ?) as exists`,
      );
      const result = stmt.get(id as string) as { exists: number };
      return result.exists === 1;
    } catch (error) {
      logger.error(`Error checking existence in ${this.tableName}`, { id, error });
      throw error;
    }
  }

  protected buildWhereClause(filters: QueryFilter[]): {
    whereClause: string;
    values: unknown[];
  } {
    if (filters.length === 0) {
      return { whereClause: "", values: [] };
    }

    const conditions: string[] = [];
    const values: unknown[] = [];

    for (const filter of filters) {
      switch (filter.operator) {
        case "eq":
          conditions.push(`${filter.field} = ?`);
          values.push(filter.value);
          break;
        case "ne":
          conditions.push(`${filter.field} != ?`);
          values.push(filter.value);
          break;
        case "gt":
          conditions.push(`${filter.field} > ?`);
          values.push(filter.value);
          break;
        case "gte":
          conditions.push(`${filter.field} >= ?`);
          values.push(filter.value);
          break;
        case "lt":
          conditions.push(`${filter.field} < ?`);
          values.push(filter.value);
          break;
        case "lte":
          conditions.push(`${filter.field} <= ?`);
          values.push(filter.value);
          break;
        case "in":
          if (Array.isArray(filter.value)) {
            const placeholders = filter.value.map(() => "?").join(", ");
            conditions.push(`${filter.field} IN (${placeholders})`);
            values.push(...filter.value);
          }
          break;
        case "like":
          conditions.push(`${filter.field} LIKE ?`);
          values.push(filter.value);
          break;
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return { whereClause, values };
  }

  protected abstract mapRowToEntity(row: unknown): T;

  protected serializeEntity(entity: Partial<T>): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(entity)) {
      if (value instanceof Date) {
        data[key] = value.toISOString();
      } else if (value !== undefined && value !== null) {
        // Serialize objects as JSON strings for SQLite storage
        if (typeof value === "object" && !Array.isArray(value)) {
          data[key] = JSON.stringify(value);
        } else if (Array.isArray(value)) {
          data[key] = JSON.stringify(value);
        } else {
          data[key] = value;
        }
      }
    }
    return data;
  }
}
