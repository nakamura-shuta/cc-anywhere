import type { CommandContext } from "../../types/slash-commands";
import { logger } from "../../utils/logger";

export class TemplateEngine {
  private readonly maxDepth = 10;
  private readonly maxIterations = 1000;

  /**
   * Render a template with the given context
   */
  render(template: string, context: CommandContext): string {
    try {
      return this.processTemplate(template, context, 0);
    } catch (error) {
      logger.error("Template rendering failed", { error });
      throw error instanceof Error
        ? error
        : new Error(`Template rendering failed: ${String(error)}`);
    }
  }

  /**
   * Process template with depth tracking
   */
  private processTemplate(template: string, context: CommandContext, depth: number): string {
    if (depth > this.maxDepth) {
      throw new Error("Maximum template depth exceeded");
    }

    let result = template;

    // Process loops first (they create new contexts)
    result = this.processLoops(result, context, depth);

    // Then process conditionals
    result = this.processConditionals(result, context, depth);

    // Finally process variables
    result = this.processVariables(result, context);

    return result;
  }

  /**
   * Process variable substitutions {{variable}} and $VARIABLE
   */
  private processVariables(template: string, context: CommandContext): string {
    // First, process $VARIABLE style (Claude Code compatible)
    let result = template.replace(/\$([A-Z_]+)/g, (match, varName: string) => {
      // Special handling for $ARGUMENTS
      if (varName === "ARGUMENTS") {
        return this.formatValue(context.args);
      }
      // Check if it's in parameters
      const lowerVarName = varName.toLowerCase();
      if (lowerVarName in context.parameters) {
        return this.formatValue(context.parameters[lowerVarName]);
      }
      // Return original if not found
      return match;
    });

    // Then process {{variable}} style (Handlebars-like)
    const variableRegex = /\{\{([^}]+)\}\}/g;
    result = result.replace(variableRegex, (_match, expression: string) => {
      const value = this.evaluateExpression(expression.trim(), context);
      return this.formatValue(value);
    });

    return result;
  }

  /**
   * Process conditional blocks {{#if condition}}...{{/if}}
   */
  private processConditionals(template: string, context: CommandContext, depth: number): string {
    const conditionalRegex = /\{\{#if\s+(.+?)\}\}([\s\S]*?)\{\{\/if\}\}/g;

    return template.replace(conditionalRegex, (_match, condition: string, content: string) => {
      const evaluated = this.evaluateExpression(condition.trim(), context);

      if (this.isTruthy(evaluated)) {
        return this.processTemplate(content, context, depth + 1);
      }

      return "";
    });
  }

  /**
   * Process loops {{#each array}}...{{/each}}
   */
  private processLoops(template: string, context: CommandContext, depth: number): string {
    const loopRegex = /\{\{#each\s+(.+?)\}\}([\s\S]*?)\{\{\/each\}\}/g;
    let iterations = 0;

    return template.replace(loopRegex, (_match, expression: string, content: string) => {
      const items = this.evaluateExpression(expression.trim(), context);

      if (!Array.isArray(items)) {
        logger.warn("Expression did not evaluate to an array", { expression });
        return "";
      }

      const results: string[] = [];

      for (let i = 0; i < items.length; i++) {
        if (++iterations > this.maxIterations) {
          throw new Error("Maximum iteration count exceeded");
        }

        // Create a new context that preserves parent parameters
        const itemContext: CommandContext = {
          ...context,
          parameters: {
            ...context.parameters,
            this: items[i],
            index: i,
            first: i === 0,
            last: i === items.length - 1,
          },
        };

        results.push(this.processTemplate(content, itemContext, depth + 1));
      }

      return results.join("");
    });
  }

  /**
   * Evaluate an expression in the context
   */
  private evaluateExpression(expression: string, context: CommandContext): unknown {
    // Handle special expressions first
    if (expression.startsWith("eq ")) {
      return this.evaluateComparison(expression.substring(3), context, "eq");
    }

    if (expression.startsWith("includes ")) {
      return this.evaluateIncludes(expression.substring(9), context);
    }

    if (expression.includes(" >= ")) {
      const [left, right] = expression.split(" >= ");
      return this.evaluateComparison(`${left} ${right}`, context, "gte");
    }

    // Handle quoted strings
    if (
      (expression.startsWith('"') && expression.endsWith('"')) ||
      (expression.startsWith("'") && expression.endsWith("'"))
    ) {
      return expression.slice(1, -1);
    }

    // Handle numbers
    if (/^-?\d+(\.\d+)?$/.test(expression)) {
      return parseFloat(expression);
    }

    // Handle booleans
    if (expression === "true") return true;
    if (expression === "false") return false;

    // Handle dot notation (e.g., context.files)
    const parts = expression.split(".");
    let value: unknown = this.getMergedContext(context);

    for (const part of parts) {
      if (value && typeof value === "object" && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Merge all context sources into a single object
   */
  private getMergedContext(context: CommandContext): Record<string, unknown> {
    return {
      ...context.parameters,
      ...context.options,
      args: context.args,
      context: context.context,
    };
  }

  /**
   * Evaluate comparison expressions
   */
  private evaluateComparison(
    expression: string,
    context: CommandContext,
    operator: "eq" | "gte",
  ): boolean {
    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 2) return false;

    const left = this.evaluateExpression(parts[0]!, context);
    const right = this.evaluateExpression(parts[1]!, context);

    switch (operator) {
      case "eq":
        return left === right;
      case "gte":
        return Number(left) >= Number(right);
      default:
        return false;
    }
  }

  /**
   * Evaluate includes expression
   */
  private evaluateIncludes(expression: string, context: CommandContext): boolean {
    // Find the first space to split array name from value expression
    const firstSpace = expression.trim().indexOf(" ");
    if (firstSpace === -1) return false;

    const arrayExpr = expression.substring(0, firstSpace).trim();
    const valueExpr = expression.substring(firstSpace + 1).trim();

    const array = this.evaluateExpression(arrayExpr, context);
    const value = this.evaluateExpression(valueExpr, context);

    if (Array.isArray(array)) {
      return array.includes(value);
    }

    return false;
  }

  /**
   * Check if a value is truthy
   */
  private isTruthy(value: unknown): boolean {
    if (value === null || value === undefined || value === false) {
      return false;
    }

    if (Array.isArray(value) && value.length === 0) {
      return false;
    }

    if (typeof value === "string" && value.trim() === "") {
      return false;
    }

    if (typeof value === "number" && (value === 0 || isNaN(value))) {
      return false;
    }

    return true;
  }

  /**
   * Format a value for output
   */
  private formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return "";
    }

    if (Array.isArray(value)) {
      return value.join(", ");
    }

    if (typeof value === "object") {
      return JSON.stringify(value);
    }

    return String(value);
  }

  /**
   * Register a helper function (for future extension)
   */
  registerHelper(name: string, _fn: (...args: unknown[]) => unknown): void {
    // This will be implemented in a future version
    // For now, we support basic functionality
    logger.debug("Helper registration not yet implemented", { name });
  }
}
