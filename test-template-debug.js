import { TemplateEngine } from "./src/services/slash-commands/template-engine.js";

const engine = new TemplateEngine();

// Test loop metadata
const template1 = "{{#each items}}{{index}}: {{this}}{{#if last}} (last){{/if}}\n{{/each}}";
const context1 = {
  parameters: { items: ["first", "second", "third"] },
  args: [],
  options: {},
};
const result1 = engine.render(template1, context1);
console.log("Loop result:", JSON.stringify(result1));
console.log("Loop output:");
console.log(result1);

// Test includes
const template2 = `{{#if analyze}}
Analyzing {{target}}:
{{#each aspects}}
  - {{this}}{{#if includes focus this}} (focused){{/if}}
{{/each}}
{{/if}}`;
const context2 = {
  parameters: {
    analyze: true,
    target: "src",
    aspects: ["security", "performance", "quality"],
    focus: ["security", "quality"],
  },
  args: [],
  options: {},
};
const result2 = engine.render(template2, context2);
console.log("\nIncludes result:");
console.log(result2);