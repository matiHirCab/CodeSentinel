import { z } from "zod";

export const apiEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_ORIGIN: z.string().default("http://localhost:5173"),
  GITHUB_WEBHOOK_SECRET: z.string().min(1),
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_PRIVATE_KEY: z.string().optional(),
  GITHUB_POSTING_MODE: z.enum(["mock", "github"]).default("mock")
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function loadApiEnv(source = process.env): ApiEnv {
  return apiEnvSchema.parse(source);
}
