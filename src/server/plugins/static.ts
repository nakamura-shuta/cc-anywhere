import type { FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import path from "path";

export async function registerStaticPlugin(fastify: FastifyInstance): Promise<void> {
  // Serve static files from the web directory
  await fastify.register(fastifyStatic, {
    root: path.join(process.cwd(), "web"),
    prefix: "/", // Serve at root level
    decorateReply: false, // Don't decorate reply
  });
}
