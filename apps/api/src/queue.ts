import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { AnalyzePrJob } from "@codesentinel/shared";

export interface AnalyzeQueue {
  enqueue(payload: AnalyzePrJob): Promise<string>;
}

export class BullAnalyzeQueue implements AnalyzeQueue {
  private readonly queue: Queue<AnalyzePrJob>;

  constructor(redisUrl: string) {
    const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue<AnalyzePrJob>("analyze-pr", { connection });
  }

  async enqueue(payload: AnalyzePrJob): Promise<string> {
    const jobId = `${payload.repositoryId}:${payload.pullNumber}:${payload.headSha}`;
    const job = await this.queue.add("analyze-pr", payload, {
      jobId,
      attempts: 3,
      backoff: { type: "exponential", delay: 2_000 },
      removeOnComplete: 100,
      removeOnFail: 100
    });
    return String(job.id);
  }
}
