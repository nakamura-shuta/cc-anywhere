import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { logger } from "../utils/logger";
import { v4 as uuidv4 } from "uuid";

export interface TaskPreset {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  settings: {
    sdk?: Record<string, any>;
    timeout?: number;
    useWorktree?: boolean;
    worktree?: Record<string, any>;
    allowedTools?: string[]; // Legacy support
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface PresetsConfig {
  presets: TaskPreset[];
  userPresets: TaskPreset[];
}

export class PresetService {
  private readonly presetsFile: string;

  constructor(presetsFile?: string) {
    this.presetsFile = presetsFile || join(process.cwd(), "config", "task-presets.json");
  }

  /**
   * Load presets from file
   */
  loadPresets(): PresetsConfig {
    try {
      if (!existsSync(this.presetsFile)) {
        // Create default file if not exists
        const defaultConfig: PresetsConfig = {
          presets: [
            {
              id: "default",
              name: "デフォルト設定",
              description: "一般的なタスク用の標準設定",
              isSystem: true,
              settings: {
                sdk: {
                  maxTurns: 3,
                  permissionMode: "default",
                  allowedTools: ["Read", "Write", "Edit"],
                  outputFormat: "text",
                },
                timeout: 600000,
                useWorktree: false,
              },
            },
          ],
          userPresets: [],
        };
        writeFileSync(this.presetsFile, JSON.stringify(defaultConfig, null, 2));
        return defaultConfig;
      }

      const content = readFileSync(this.presetsFile, "utf-8");
      return JSON.parse(content) as PresetsConfig;
    } catch (error) {
      logger.error("Failed to load presets", { error });
      throw new Error("Failed to load presets configuration");
    }
  }

  /**
   * Save presets to file
   */
  savePresets(config: PresetsConfig): void {
    try {
      writeFileSync(this.presetsFile, JSON.stringify(config, null, 2));
    } catch (error) {
      logger.error("Failed to save presets", { error });
      throw new Error("Failed to save presets configuration");
    }
  }

  /**
   * Get a specific preset by ID
   */
  getPreset(id: string): TaskPreset | null {
    const config = this.loadPresets();
    return (
      config.presets.find((p) => p.id === id) || config.userPresets.find((p) => p.id === id) || null
    );
  }

  /**
   * Create a new user preset
   */
  createPreset(
    preset: Omit<TaskPreset, "id" | "isSystem" | "createdAt" | "updatedAt">,
  ): TaskPreset {
    const config = this.loadPresets();
    const newPreset: TaskPreset = {
      ...preset,
      id: uuidv4(),
      isSystem: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    config.userPresets.push(newPreset);
    this.savePresets(config);

    logger.info("Created new preset", { id: newPreset.id, name: preset.name });
    return newPreset;
  }

  /**
   * Update an existing preset
   */
  updatePreset(id: string, updates: Partial<TaskPreset>): TaskPreset {
    const config = this.loadPresets();

    // Check if it's a system preset
    const systemPreset = config.presets.find((p) => p.id === id);
    if (systemPreset) {
      throw new Error("System presets cannot be modified");
    }

    const presetIndex = config.userPresets.findIndex((p) => p.id === id);

    if (presetIndex === -1) {
      throw new Error("Preset not found");
    }

    const current = config.userPresets[presetIndex];
    if (!current) {
      throw new Error("Preset not found");
    }

    const updated: TaskPreset = {
      ...current,
      name: updates.name ?? current.name,
      description: updates.description !== undefined ? updates.description : current.description,
      settings: updates.settings ?? current.settings,
      id: current.id, // Ensure ID cannot be changed
      isSystem: false, // Ensure system flag cannot be changed
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    };

    config.userPresets[presetIndex] = updated;
    this.savePresets(config);

    logger.info("Updated preset", { id });
    return updated;
  }

  /**
   * Delete a user preset
   */
  deletePreset(id: string): void {
    const config = this.loadPresets();

    // Check if it's a system preset
    const systemPreset = config.presets.find((p) => p.id === id);
    if (systemPreset) {
      throw new Error("System presets cannot be deleted");
    }

    const presetIndex = config.userPresets.findIndex((p) => p.id === id);

    if (presetIndex === -1) {
      throw new Error("Preset not found");
    }

    config.userPresets.splice(presetIndex, 1);
    this.savePresets(config);

    logger.info("Deleted preset", { id });
  }
}
