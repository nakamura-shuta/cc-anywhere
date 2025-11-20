/**
 * Integration tests for ChatSDKClient
 *
 * Tests the 2 critical scenarios:
 * 1. new_session: sdkSessionId is saved
 * 2. resume: 2nd turn uses resume mode
 *
 * Note: These tests require CLAUDE_API_KEY to be set
 */

import { describe, test, expect, beforeAll } from "vitest";
import { ChatSDKClient } from "../../../src/chat/chat-sdk-client.js";
import type { ChatExecutorOptions, ChatStreamEvent } from "../../../src/chat/types.js";

// Skip tests if CLAUDE_API_KEY is not set
const shouldSkip = !process.env.CLAUDE_API_KEY;
const describeOrSkip = shouldSkip ? describe.skip : describe;

describeOrSkip("ChatSDKClient Integration", () => {
  let client: ChatSDKClient;

  beforeAll(() => {
    if (!process.env.CLAUDE_API_KEY) {
      console.log("⚠️  Skipping ChatSDKClient integration tests: CLAUDE_API_KEY not set");
    }
  });

  test("new_session: sdkSessionId is saved", async () => {
    client = new ChatSDKClient();

    const events: ChatStreamEvent[] = [];
    const options: ChatExecutorOptions = {
      sessionId: "test-session-1",
      characterId: "default",
      systemPrompt: "You are a helpful assistant. Respond with just 'Hello!'",
      executor: "claude",
    };

    const result = await client.execute(
      "Say hello",
      options,
      (event) => {
        events.push(event);
      }
    );

    // Verify result
    expect(result.sdkSessionId).toBeDefined();
    expect(result.sdkSessionId).toBeTruthy();
    expect(result.messageId).toBeDefined();
    expect(result.content).toBeTruthy();

    // Verify events
    const startEvent = events.find((e) => e.type === "start");
    expect(startEvent).toBeDefined();

    const doneEvent = events.find((e) => e.type === "done");
    expect(doneEvent).toBeDefined();
    expect(doneEvent?.data.sdkSessionId).toBe(result.sdkSessionId);

    console.log("✅ new_session test passed:", {
      sdkSessionId: result.sdkSessionId,
      messageLength: result.content.length,
      eventCount: events.length,
    });
  }, 30000); // 30 second timeout for API call

  test("resume: 2nd turn uses resume mode", async () => {
    client = new ChatSDKClient();

    // First turn: new session
    const events1: ChatStreamEvent[] = [];
    const options1: ChatExecutorOptions = {
      sessionId: "test-session-2",
      characterId: "default",
      systemPrompt: "You are a helpful assistant. Always respond briefly.",
      executor: "claude",
    };

    const result1 = await client.execute(
      "Say hello briefly",
      options1,
      (event) => {
        events1.push(event);
      }
    );

    expect(result1.sdkSessionId).toBeDefined();
    const firstSessionId = result1.sdkSessionId!;

    console.log("✅ First turn completed:", {
      sdkSessionId: firstSessionId,
      messageLength: result1.content.length,
    });

    // Second turn: resume with same sdkSessionId
    const events2: ChatStreamEvent[] = [];
    const options2: ChatExecutorOptions = {
      sessionId: "test-session-2",
      characterId: "default",
      systemPrompt: "You are a helpful assistant. Always respond briefly.",
      executor: "claude",
      sdkSessionId: firstSessionId, // Resume with previous session
    };

    const result2 = await client.execute(
      "Say goodbye briefly",
      options2,
      (event) => {
        events2.push(event);
      }
    );

    // Verify resume worked
    expect(result2.sdkSessionId).toBeDefined();
    expect(result2.sdkSessionId).toBe(firstSessionId); // Should be same session ID

    console.log("✅ Second turn (resume) completed:", {
      sdkSessionId: result2.sdkSessionId,
      messageLength: result2.content.length,
      sessionMatches: result2.sdkSessionId === firstSessionId,
    });

    // Verify both turns used the same session
    expect(result2.sdkSessionId).toBe(firstSessionId);
  }, 60000); // 60 second timeout for 2 API calls
});

// Summary test that runs even when skipped
describe("ChatSDKClient Integration Test Summary", () => {
  test("should show test configuration", () => {
    const apiKeySet = !!process.env.CLAUDE_API_KEY;
    console.log("\n📊 Integration Test Configuration:");
    console.log(`  - CLAUDE_API_KEY: ${apiKeySet ? "✅ Set" : "❌ Not set"}`);
    console.log(`  - Tests: ${apiKeySet ? "✅ Running" : "⏭️  Skipped"}`);

    expect(true).toBe(true); // Always pass
  });
});
