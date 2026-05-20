import "dotenv/config";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { loadWorkerEnv } from "./env";
import { createReviewProvider } from "./provider";
import { processAnalyzePr } from "./processor";

const env = loadWorkerEnv();
const prisma = new PrismaClient();
const provider = createReviewProvider(env);
const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

const worker = new Worker(
  "analyze-pr",
  async (job) => {
    await processAnalyzePr({ payload: job.data, prisma, provider, env });
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log(`analyze-pr completed: ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`analyze-pr failed: ${job?.id}`, error);
});
