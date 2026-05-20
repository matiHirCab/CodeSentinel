import {
  type ReviewProviderRequest,
  type ReviewProviderResponse,
  validateProviderResponse
} from "@codesentinel/shared";
import type { WorkerEnv } from "./env";

export interface ReviewProvider {
  name: string;
  review(request: ReviewProviderRequest): Promise<ReviewProviderResponse>;
}

export class MockReviewProvider implements ReviewProvider {
  name = "mock";

  async review(request: ReviewProviderRequest): Promise<ReviewProviderResponse> {
    const firstFile = request.changedFiles[0];
    return {
      summary: `Mock review for ${request.repository.fullName}#${request.pullRequest.number}: ${request.changedFiles.length} changed file(s) analyzed with ${request.contextFiles.length} context file(s).`,
      architectureNotes: "No blocking architecture concerns were identified by the deterministic mock provider.",
      testingRecommendations: "Add or update tests around the changed behavior before merging.",
      riskAssessment: {
        security: { level: "low", reasoning: "No security-sensitive pattern was detected in mock analysis." },
        deployment: { level: "medium", reasoning: "Deployment risk depends on the unverified changed behavior." },
        breakingChange: { level: "low", reasoning: "The mock provider did not detect an API compatibility concern." },
        maintainability: { level: "medium", reasoning: "Review the changed files for consistency with repository guidance." },
        testingConfidence: { level: "medium", reasoning: "The mock provider cannot prove sufficient test coverage." }
      },
      findings: firstFile
        ? [
            {
              filePath: firstFile.path,
              startLine: 1,
              severity: "medium",
              category: "testing",
              title: "Verify changed behavior with focused tests",
              risk: "The pull request changes executable behavior, but the mock provider cannot confirm matching tests.",
              evidence: firstFile.patch?.slice(0, 300) || `${firstFile.path} changed with ${firstFile.additions} additions.`,
              suggestion: "Add tests that cover the changed path and at least one failure or edge case.",
              confidence: 0.72
            }
          ]
        : []
    };
  }
}

export class OpenAICompatibleReviewProvider implements ReviewProvider {
  name = "openai";

  constructor(private readonly env: WorkerEnv) {}

  async review(request: ReviewProviderRequest): Promise<ReviewProviderResponse> {
    if (!this.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required when REVIEW_PROVIDER=openai");
    }

    const response = await fetch(`${this.env.OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: this.env.OPENAI_MODEL,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are CodeSentinel, a senior engineer reviewing a pull request. Return only JSON matching the requested review schema. Prefer high-signal correctness, security, architecture, testing, deployment, observability, and maintainability feedback."
          },
          {
            role: "user",
            content: JSON.stringify({
              schema: "Return { summary, architectureNotes, testingRecommendations, riskAssessment, findings }.",
              request
            })
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI-compatible provider failed: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as any;
    const content = data.choices?.[0]?.message?.content;
    return validateProviderResponse(JSON.parse(content));
  }
}

export function createReviewProvider(env: WorkerEnv): ReviewProvider {
  return env.REVIEW_PROVIDER === "openai" ? new OpenAICompatibleReviewProvider(env) : new MockReviewProvider();
}
