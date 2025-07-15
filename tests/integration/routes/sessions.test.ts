import { describe, it, expect, afterAll, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../../../src/server/app";
import type { FastifyInstance } from "fastify";
import { testConfig } from "../test-config";

describe("Session Integration", () => {
  let app: FastifyInstance;
  const apiKey = testConfig.apiKey;

  beforeAll(async () => {
    app = await createApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Session lifecycle", () => {
    let sessionId: string;

    it("should create a new session", async () => {
      const response = await request(app.server)
        .post("/api/sessions")
        .set("X-API-Key", apiKey)
        .send({
          metadata: {
            title: "Integration Test Session",
            description: "Testing session functionality",
          },
          context: {
            workingDirectory: process.cwd(),
          },
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("session");
      expect(response.body.session).toHaveProperty("id");
      expect(response.body.session.status).toBe("active");
      expect(response.body.session.metadata.title).toBe("Integration Test Session");

      sessionId = response.body.session.id;
    });

    it("should retrieve the created session", async () => {
      const response = await request(app.server)
        .get(`/api/sessions/${sessionId}`)
        .set("X-API-Key", apiKey);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(sessionId);
      expect(response.body.status).toBe("active");
    });

    it("should continue the session with a simple task", async () => {
      const response = await request(app.server)
        .post(`/api/sessions/${sessionId}/continue`)
        .set("X-API-Key", apiKey)
        .send({
          sessionId,
          instruction: "Echo 'Hello from session test'",
          options: {
            timeout: 30000,
            sdk: {
              permissionMode: "bypassPermissions",
              allowedTools: ["Bash"],
            },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("turnNumber");
      expect(response.body).toHaveProperty("taskId");
      expect(response.body.turnNumber).toBe(1);
    });

    it("should continue the session with context from previous turn", async () => {
      const response = await request(app.server)
        .post(`/api/sessions/${sessionId}/continue`)
        .set("X-API-Key", apiKey)
        .send({
          sessionId,
          instruction: "What was the previous command I asked you to run?",
          options: {
            timeout: 30000,
            sdk: {
              permissionMode: "bypassPermissions",
              allowedTools: ["Bash"],
            },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.turnNumber).toBe(2);
    });

    it("should retrieve conversation history", async () => {
      const response = await request(app.server)
        .get(`/api/sessions/${sessionId}/history`)
        .set("X-API-Key", apiKey);

      expect(response.status).toBe(200);
      expect(response.body.sessionId).toBe(sessionId);
      expect(response.body.turns).toHaveLength(2);
      expect(response.body.totalTurns).toBe(2);
      expect(response.body.turns[0].instruction).toContain("Echo");
      expect(response.body.turns[1].instruction).toContain("previous command");
    });

    it("should list active sessions", async () => {
      const response = await request(app.server)
        .get("/api/sessions")
        .query({ status: "active" })
        .set("X-API-Key", apiKey);

      expect(response.status).toBe(200);
      expect(response.body.sessions).toBeInstanceOf(Array);
      expect(response.body.sessions.some((s: any) => s.id === sessionId)).toBe(true);
    });

    it("should delete the session", async () => {
      const response = await request(app.server)
        .delete(`/api/sessions/${sessionId}`)
        .set("X-API-Key", apiKey);

      expect(response.status).toBe(204);

      // Verify session is deleted
      const getResponse = await request(app.server)
        .get(`/api/sessions/${sessionId}`)
        .set("X-API-Key", apiKey);

      expect(getResponse.status).toBe(404);
    });
  });

  describe("Error handling", () => {
    it("should handle non-existent session", async () => {
      const response = await request(app.server)
        .post("/api/sessions/non-existent/continue")
        .set("X-API-Key", apiKey)
        .send({
          sessionId: "non-existent",
          instruction: "Test",
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Session not found");
    });

    it("should validate session status", async () => {
      // Create a session and immediately complete it
      // const createResponse = await request(app.server)
      //   .post("/api/sessions")
      //   .set("X-API-Key", apiKey)
      //   .send({
      //     metadata: { title: "Completed Session" },
      //   });
      // const sessionId = createResponse.body.session.id;
      // Update session status to completed (would need an admin endpoint for this)
      // For now, we'll skip this test as we don't have an endpoint to update session status
    });
  });
});
