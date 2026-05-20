import { AlertTriangle, CheckCircle2, GitPullRequest, RefreshCcw, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReviewFinding, ReviewRunDetail, RiskAssessment } from "@codesentinel/shared";
import { api, type PullRequestListItem, type RepositoryListItem } from "./api";

type LoadState<T> = { status: "idle" | "loading" | "loaded" | "error"; data?: T; error?: string };

export function App() {
  const [repositories, setRepositories] = useState<LoadState<RepositoryListItem[]>>({ status: "idle" });
  const [pullRequests, setPullRequests] = useState<LoadState<PullRequestListItem[]>>({ status: "idle" });
  const [reviewRun, setReviewRun] = useState<LoadState<ReviewRunDetail>>({ status: "idle" });
  const [selectedRepositoryId, setSelectedRepositoryId] = useState<string>();
  const [selectedFindingIds, setSelectedFindingIds] = useState<Set<string>>(new Set());
  const [includeSummary, setIncludeSummary] = useState(true);
  const [posting, setPosting] = useState<string>();

  useEffect(() => {
    void loadRepositories();
  }, []);

  async function loadRepositories() {
    setRepositories({ status: "loading" });
    try {
      setRepositories({ status: "loaded", data: await api.repositories() });
    } catch (error) {
      setRepositories({ status: "error", error: error instanceof Error ? error.message : String(error) });
    }
  }

  async function selectRepository(repositoryId: string) {
    setSelectedRepositoryId(repositoryId);
    setPullRequests({ status: "loading" });
    setReviewRun({ status: "idle" });
    try {
      setPullRequests({ status: "loaded", data: await api.pullRequests(repositoryId) });
    } catch (error) {
      setPullRequests({ status: "error", error: error instanceof Error ? error.message : String(error) });
    }
  }

  async function selectReviewRun(reviewRunId: string) {
    setReviewRun({ status: "loading" });
    try {
      const run = await api.reviewRun(reviewRunId);
      setReviewRun({ status: "loaded", data: run });
      setSelectedFindingIds(new Set(run.findings.map((finding: ReviewFinding & { id: string }) => finding.id)));
      setIncludeSummary(true);
      setPosting(undefined);
    } catch (error) {
      setReviewRun({ status: "error", error: error instanceof Error ? error.message : String(error) });
    }
  }

  async function postSelectedReview() {
    if (reviewRun.status !== "loaded") {
      return;
    }
    const currentRun = reviewRun.data!;
    setPosting("posting");
    try {
      const result = await api.postReview(currentRun.id, [...selectedFindingIds], includeSummary);
      setPosting(`Posted with status: ${result.status}`);
      await selectReviewRun(currentRun.id);
    } catch (error) {
      setPosting(error instanceof Error ? error.message : String(error));
    }
  }

  const selectedRepository = useMemo(
    () => repositories.data?.find((repository) => repository.id === selectedRepositoryId),
    [repositories.data, selectedRepositoryId]
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>CodeSentinel</h1>
          <p>Repository-aware pull request reviews</p>
        </div>
        <button className="icon-button" onClick={() => void loadRepositories()} aria-label="Refresh repositories">
          <RefreshCcw size={18} />
        </button>
      </header>

      <section className="workspace-grid">
        <aside className="panel" aria-label="Repositories">
          <div className="panel-header">
            <h2>Repositories</h2>
          </div>
          {repositories.status === "loading" && <p className="muted">Loading repositories...</p>}
          {repositories.status === "error" && <StateMessage kind="error" message={repositories.error ?? "Failed to load repositories"} />}
          {repositories.status === "loaded" && repositories.data?.length === 0 && <StateMessage message="No repositories yet. Send a PR webhook to create one." />}
          {repositories.data?.map((repository) => (
            <button
              key={repository.id}
              className={`list-row ${selectedRepositoryId === repository.id ? "selected" : ""}`}
              onClick={() => void selectRepository(repository.id)}
            >
              <strong>{repository.fullName}</strong>
              <span>{repository.pullRequests.length} recent PRs</span>
            </button>
          ))}
        </aside>

        <aside className="panel" aria-label="Pull requests">
          <div className="panel-header">
            <h2>{selectedRepository ? selectedRepository.fullName : "Pull Requests"}</h2>
          </div>
          {pullRequests.status === "idle" && <p className="muted">Select a repository.</p>}
          {pullRequests.status === "loading" && <p className="muted">Loading pull requests...</p>}
          {pullRequests.status === "error" && <StateMessage kind="error" message={pullRequests.error ?? "Failed to load pull requests"} />}
          {pullRequests.status === "loaded" && pullRequests.data?.length === 0 && <StateMessage message="No pull requests have been ingested." />}
          {pullRequests.data?.map((pullRequest) => {
            const latestRun = pullRequest.reviewRuns[0];
            return (
              <button
                key={pullRequest.id}
                className="list-row"
                disabled={!latestRun}
                onClick={() => latestRun && void selectReviewRun(latestRun.id)}
              >
                <span className="row-title">
                  <GitPullRequest size={16} /> #{pullRequest.number} {pullRequest.title}
                </span>
                <span>{latestRun ? `${latestRun.status} / ${latestRun.postingStatus}` : "No review run"}</span>
              </button>
            );
          })}
        </aside>

        <section className="review-panel" aria-label="Review detail">
          {reviewRun.status === "idle" && <StateMessage message="Select a review run to inspect the draft." />}
          {reviewRun.status === "loading" && <p className="muted">Loading review...</p>}
          {reviewRun.status === "error" && <StateMessage kind="error" message={reviewRun.error ?? "Failed to load review"} />}
          {reviewRun.status === "loaded" && (
            <ReviewDetail
              reviewRun={reviewRun.data!}
              selectedFindingIds={selectedFindingIds}
              includeSummary={includeSummary}
              posting={posting}
              setIncludeSummary={setIncludeSummary}
              setSelectedFindingIds={setSelectedFindingIds}
              postSelectedReview={postSelectedReview}
            />
          )}
        </section>
      </section>
    </main>
  );
}

function ReviewDetail(props: {
  reviewRun: ReviewRunDetail;
  selectedFindingIds: Set<string>;
  includeSummary: boolean;
  posting?: string;
  setIncludeSummary: (value: boolean) => void;
  setSelectedFindingIds: (value: Set<string>) => void;
  postSelectedReview: () => Promise<void>;
}) {
  const canPost = props.reviewRun.status === "draft" && props.reviewRun.postingStatus === "not_posted";

  function toggleFinding(id: string) {
    const next = new Set(props.selectedFindingIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    props.setSelectedFindingIds(next);
  }

  return (
    <div className="review-detail">
      <div className="review-title">
        <div>
          <h2>
            {props.reviewRun.pullRequest.repository.fullName} #{props.reviewRun.pullRequest.number}
          </h2>
          <p>{props.reviewRun.pullRequest.title}</p>
        </div>
        <StatusPill label={`${props.reviewRun.status} / ${props.reviewRun.postingStatus}`} />
      </div>

      {props.reviewRun.error && <StateMessage kind="error" message={props.reviewRun.error} />}

      <section>
        <h3>Summary</h3>
        <label className="check-row">
          <input type="checkbox" checked={props.includeSummary} disabled={!canPost} onChange={(event) => props.setIncludeSummary(event.target.checked)} />
          Include summary when posting
        </label>
        <p>{props.reviewRun.summary ?? "No summary has been generated yet."}</p>
      </section>

      {props.reviewRun.riskAssessment && (
        <section>
          <h3>Risks</h3>
          <div className="risk-grid">
            {Object.entries(props.reviewRun.riskAssessment as RiskAssessment).map(([key, value]) => (
              <div className="risk-item" key={key}>
                <strong>{formatLabel(key)}</strong>
                <StatusPill label={value.level} />
                <p>{value.reasoning}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="notes-grid">
        <div>
          <h3>Architecture</h3>
          <p>{props.reviewRun.architectureNotes ?? "No architecture notes."}</p>
        </div>
        <div>
          <h3>Testing</h3>
          <p>{props.reviewRun.testingRecommendations ?? "No testing recommendations."}</p>
        </div>
      </section>

      <section>
        <div className="section-title">
          <h3>Findings</h3>
          <span>{props.selectedFindingIds.size} selected</span>
        </div>
        {props.reviewRun.findings.length === 0 && <StateMessage message="No high-confidence findings were generated." />}
        {props.reviewRun.findings.map((finding: ReviewFinding & { id: string; posted: boolean }) => (
          <article className="finding" key={finding.id}>
            <label className="check-row">
              <input type="checkbox" checked={props.selectedFindingIds.has(finding.id)} disabled={!canPost} onChange={() => toggleFinding(finding.id)} />
              <span className="finding-title">{finding.title}</span>
            </label>
            <div className="finding-meta">
              <StatusPill label={finding.severity} />
              <span>{finding.category}</span>
              <span>{finding.filePath ? `${finding.filePath}:${finding.startLine ?? "?"}` : "summary"}</span>
              {finding.posted && (
                <span className="posted">
                  <CheckCircle2 size={14} /> posted
                </span>
              )}
            </div>
            <p>{finding.risk}</p>
            <p className="muted">Evidence: {finding.evidence}</p>
            {finding.suggestion && <p>Suggested next step: {finding.suggestion}</p>}
          </article>
        ))}
      </section>

      <div className="postbar">
        <button className="primary-button" disabled={!canPost || (!props.includeSummary && props.selectedFindingIds.size === 0)} onClick={() => void props.postSelectedReview()}>
          <Send size={16} /> Post approved output
        </button>
        {props.posting && <span className="muted">{props.posting}</span>}
      </div>
    </div>
  );
}

function StateMessage({ message, kind = "empty" }: { message: string; kind?: "empty" | "error" }) {
  return (
    <div className={`state-message ${kind}`}>
      {kind === "error" && <AlertTriangle size={18} />}
      <span>{message}</span>
    </div>
  );
}

function StatusPill({ label }: { label: string }) {
  return <span className={`status-pill ${label}`}>{label.replace("_", " ")}</span>;
}

function formatLabel(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}
