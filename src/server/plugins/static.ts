import type { FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import path from "path";

export async function registerStaticPlugin(fastify: FastifyInstance): Promise<void> {
  // Serve static files from the web directory
  await fastify.register(fastifyStatic, {
    root: path.join(process.cwd(), "web"),
    prefix: "/", // Serve at root level
    decorateReply: false, // Don't decorate reply
    // デフォルトでindex.html（高機能版）を使用
    index: ["index.html"],
  });

  // Serve example files from src/examples directory
  await fastify.register(fastifyStatic, {
    root: path.join(process.cwd(), "src/examples"),
    prefix: "/examples/",
    decorateReply: false,
  });
}
