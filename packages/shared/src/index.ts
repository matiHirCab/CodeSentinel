import { z } from "zod";

export const reviewSeveritySchema = z.enum(["critical", "high", "medium", "low"]);
export type ReviewSeverity = z.infer<typeof reviewSeveritySchema>;

export const reviewCategorySchema = z.enum([
  "correctness",
  "security",
  "architecture",
  "performance",
  "testing",
  "observability",
  "maintainability",
  "devex",
  "deployment"
]);
export type ReviewCategory = z.infer<typeof reviewCategorySchema>;

export const reviewRunStatusSchema = z.enum(["pending", "running", "draft", "failed", "posted", "superseded"]);
export type ReviewRunStatus = z.infer<typeof reviewRunStatusSchema>;

export const postingStatusSchema = z.enum(["not_posted", "posting", "posted", "failed", "partial"]);
export type PostingStatus = z.infer<typeof postingStatusSchema>;

export const riskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export type RiskLevel = z.infer<typeof riskLevelSchema>;

export const riskAssessmentSchema = z.object({
  security: z.object({ level: riskLevelSchema, reasoning: z.string().min(1) }),
  deployment: z.object({ level: riskLevelSchema, reasoning: z.string().min(1) }),
  breakingChange: z.object({ level: riskLevelSchema, reasoning: z.string().min(1) }),
  maintainability: z.object({ level: riskLevelSchema, reasoning: z.string().min(1) }),
  testingConfidence: z.object({ level: riskLevelSchema, reasoning: z.string().min(1) })
});
export type RiskAssessment = z.infer<typeof riskAssessmentSchema>;

export const changedFileSchema = z.object({
  path: z.string().min(1),
  status: z.string().min(1),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  patch: z.string().optional(),
  previousPath: z.string().optional()
});
export type ChangedFile = z.infer<typeof changedFileSchema>;

export const contextFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  priority: z.number().int().positive(),
  reason: z.string().min(1)
});
export type ContextFile = z.infer<typeof contextFileSchema>;

export const reviewFindingSchema = z.object({
  filePath: z.string().min(1).optional(),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  severity: reviewSeveritySchema,
  category: reviewCategorySchema,
  title: z.string().min(1).max(160),
  risk: z.string().min(1),
  evidence: z.string().min(1),
  suggestion: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0.75)
});
export type ReviewFinding = z.infer<typeof reviewFindingSchema>;

export const reviewProviderRequestSchema = z.object({
  repository: z.object({
    owner: z.string().min(1),
    name: z.string().min(1),
    fullName: z.string().min(1),
    defaultBranch: z.string().min(1)
  }),
  pullRequest: z.object({
    number: z.number().int().positive(),
    title: z.string(),
    body: z.string().optional(),
    authorLogin: z.string().min(1),
    baseBranch: z.string().min(1),
    headBranch: z.string().min(1),
    headSha: z.string().min(7)
  }),
  changedFiles: z.array(changedFileSchema),
  contextFiles: z.array(contextFileSchema)
});
export type ReviewProviderRequest = z.infer<typeof reviewProviderRequestSchema>;

export const reviewProviderResponseSchema = z.object({
  summary: z.string().min(1),
  architectureNotes: z.string().optional(),
  testingRecommendations: z.string().optional(),
  riskAssessment: riskAssessmentSchema,
  findings: z.array(reviewFindingSchema).max(25)
});
export type ReviewProviderResponse = z.infer<typeof reviewProviderResponseSchema>;

export const analyzePrJobSchema = z.object({
  installationId: z.number().int().positive(),
  repositoryId: z.string().min(1),
  owner: z.string().min(1),
  repo: z.string().min(1),
  pullNumber: z.number().int().positive(),
  headSha: z.string().min(7)
});
export type AnalyzePrJob = z.infer<typeof analyzePrJobSchema>;

export const postReviewRequestSchema = z.object({
  selectedFindingIds: z.array(z.string().min(1)).default([]),
  includeSummary: z.boolean().default(true)
});
export type PostReviewRequest = z.infer<typeof postReviewRequestSchema>;

export const reviewRunDetailSchema = z.object({
  id: z.string(),
  status: reviewRunStatusSchema,
  postingStatus: postingStatusSchema,
  provider: z.string(),
  summary: z.string().nullable(),
  architectureNotes: z.string().nullable(),
  testingRecommendations: z.string().nullable(),
  riskAssessment: riskAssessmentSchema.nullable(),
  error: z.string().nullable(),
  headSha: z.string(),
  findings: z.array(reviewFindingSchema.extend({
    id: z.string(),
    approved: z.boolean(),
    posted: z.boolean(),
    githubCommentId: z.string().nullable()
  })),
  pullRequest: z.object({
    number: z.number(),
    title: z.string(),
    htmlUrl: z.string(),
    repository: z.object({ fullName: z.string() })
  })
});
export type ReviewRunDetail = z.infer<typeof reviewRunDetailSchema>;

export function validateProviderResponse(response: unknown): ReviewProviderResponse {
  return reviewProviderResponseSchema.parse(response);
}
