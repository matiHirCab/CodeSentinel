CREATE TYPE "ReviewRunStatus" AS ENUM ('pending', 'running', 'draft', 'failed', 'posted', 'superseded');
CREATE TYPE "PostingStatus" AS ENUM ('not_posted', 'posting', 'posted', 'failed', 'partial');
CREATE TYPE "FindingSeverity" AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE "FindingCategory" AS ENUM ('correctness', 'security', 'architecture', 'performance', 'testing', 'observability', 'maintainability', 'devex', 'deployment');

CREATE TABLE "GitHubInstallation" (
  "id" TEXT NOT NULL,
  "installationId" BIGINT NOT NULL,
  "accountLogin" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GitHubInstallation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Repository" (
  "id" TEXT NOT NULL,
  "githubId" BIGINT NOT NULL,
  "installationId" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "defaultBranch" TEXT NOT NULL,
  "private" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PullRequest" (
  "id" TEXT NOT NULL,
  "repositoryId" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "authorLogin" TEXT NOT NULL,
  "baseBranch" TEXT NOT NULL,
  "headBranch" TEXT NOT NULL,
  "headSha" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "draft" BOOLEAN NOT NULL DEFAULT false,
  "htmlUrl" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PullRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChangedFile" (
  "id" TEXT NOT NULL,
  "pullRequestId" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "additions" INTEGER NOT NULL DEFAULT 0,
  "deletions" INTEGER NOT NULL DEFAULT 0,
  "patch" TEXT,
  "previousPath" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChangedFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalysisJob" (
  "id" TEXT NOT NULL,
  "repositoryId" TEXT NOT NULL,
  "pullRequestId" TEXT NOT NULL,
  "installationId" BIGINT NOT NULL,
  "pullNumber" INTEGER NOT NULL,
  "headSha" TEXT NOT NULL,
  "status" "ReviewRunStatus" NOT NULL DEFAULT 'pending',
  "bullJobId" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnalysisJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReviewRun" (
  "id" TEXT NOT NULL,
  "analysisJobId" TEXT NOT NULL,
  "pullRequestId" TEXT NOT NULL,
  "headSha" TEXT NOT NULL,
  "status" "ReviewRunStatus" NOT NULL DEFAULT 'pending',
  "postingStatus" "PostingStatus" NOT NULL DEFAULT 'not_posted',
  "provider" TEXT NOT NULL,
  "summary" TEXT,
  "architectureNotes" TEXT,
  "testingRecommendations" TEXT,
  "riskAssessment" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReviewRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Finding" (
  "id" TEXT NOT NULL,
  "reviewRunId" TEXT NOT NULL,
  "filePath" TEXT,
  "startLine" INTEGER,
  "endLine" INTEGER,
  "severity" "FindingSeverity" NOT NULL,
  "category" "FindingCategory" NOT NULL,
  "title" TEXT NOT NULL,
  "risk" TEXT NOT NULL,
  "evidence" TEXT NOT NULL,
  "suggestion" TEXT,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
  "approved" BOOLEAN NOT NULL DEFAULT false,
  "posted" BOOLEAN NOT NULL DEFAULT false,
  "githubCommentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PostingAttempt" (
  "id" TEXT NOT NULL,
  "reviewRunId" TEXT NOT NULL,
  "status" "PostingStatus" NOT NULL,
  "selectedFindingIds" TEXT[],
  "includeSummary" BOOLEAN NOT NULL DEFAULT true,
  "error" TEXT,
  "githubReviewId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PostingAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GitHubInstallation_installationId_key" ON "GitHubInstallation"("installationId");
CREATE UNIQUE INDEX "Repository_githubId_key" ON "Repository"("githubId");
CREATE UNIQUE INDEX "Repository_owner_name_key" ON "Repository"("owner", "name");
CREATE UNIQUE INDEX "PullRequest_repositoryId_number_key" ON "PullRequest"("repositoryId", "number");
CREATE UNIQUE INDEX "ChangedFile_pullRequestId_path_key" ON "ChangedFile"("pullRequestId", "path");
CREATE UNIQUE INDEX "AnalysisJob_repositoryId_pullNumber_headSha_key" ON "AnalysisJob"("repositoryId", "pullNumber", "headSha");
CREATE UNIQUE INDEX "ReviewRun_pullRequestId_headSha_provider_key" ON "ReviewRun"("pullRequestId", "headSha", "provider");

ALTER TABLE "Repository" ADD CONSTRAINT "Repository_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "GitHubInstallation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PullRequest" ADD CONSTRAINT "PullRequest_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChangedFile" ADD CONSTRAINT "ChangedFile_pullRequestId_fkey" FOREIGN KEY ("pullRequestId") REFERENCES "PullRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnalysisJob" ADD CONSTRAINT "AnalysisJob_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnalysisJob" ADD CONSTRAINT "AnalysisJob_pullRequestId_fkey" FOREIGN KEY ("pullRequestId") REFERENCES "PullRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewRun" ADD CONSTRAINT "ReviewRun_analysisJobId_fkey" FOREIGN KEY ("analysisJobId") REFERENCES "AnalysisJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewRun" ADD CONSTRAINT "ReviewRun_pullRequestId_fkey" FOREIGN KEY ("pullRequestId") REFERENCES "PullRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_reviewRunId_fkey" FOREIGN KEY ("reviewRunId") REFERENCES "ReviewRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PostingAttempt" ADD CONSTRAINT "PostingAttempt_reviewRunId_fkey" FOREIGN KEY ("reviewRunId") REFERENCES "ReviewRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
