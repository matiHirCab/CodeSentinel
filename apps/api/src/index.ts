import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { buildServer } from "./server";
import { loadApiEnv } from "./env";
import { BullAnalyzeQueue } from "./queue";
import { createGitHubPoster } from "./github/client";

const env = loadApiEnv();
const prisma = new PrismaClient();
const server = await buildServer({
  env,
  prisma,
  queue: new BullAnalyzeQueue(env.REDIS_URL),
  githubPoster: createGitHubPoster(env)
});

await server.listen({ host: env.API_HOST, port: env.API_PORT });
