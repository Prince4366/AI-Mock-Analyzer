import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";
import { Skeleton } from "../components/Skeleton";

export function InterviewHistoryPage() {
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [sessionDetail, setSessionDetail] = useState(null);
  const [compareFirst, setCompareFirst] = useState("");
  const [compareSecond, setCompareSecond] = useState("");
  const [comparison, setComparison] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);

  useEffect(() => {
    async function loadHistory() {
      try {
        const data = await apiRequest("/interviews/history");
        setSessions(data.sessions || []);
      } catch (err) {
        setError(err.message || "Failed to load interview history.");
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, []);

  useEffect(() => {
    if (!selectedSessionId) {
      setSessionDetail(null);
      return;
    }
    async function loadDetail() {
      setDetailLoading(true);
      setError("");
      try {
        const data = await apiRequest(`/interviews/${selectedSessionId}/detail`);
        setSessionDetail(data);
      } catch (err) {
        setError(err.message || "Failed to fetch interview details.");
      } finally {
        setDetailLoading(false);
      }
    }
    loadDetail();
  }, [selectedSessionId]);

  const canCompare = useMemo(
    () => Boolean(compareFirst && compareSecond && compareFirst !== compareSecond),
    [compareFirst, compareSecond]
  );

  async function handleCompare() {
    if (!canCompare) {
      setError("Select two different sessions for comparison.");
      return;
    }
    setError("");
    try {
      const data = await apiRequest("/interviews/compare", {
        method: "POST",
        body: JSON.stringify({
          firstSessionId: compareFirst,
          secondSessionId: compareSecond
        })
      });
      setComparison(data.comparison);
    } catch (err) {
      setError(err.message || "Failed to compare sessions.");
    }
  }

  async function handleGenerateAndDownloadReport() {
    if (!selectedSessionId) {
      setError("Select an interview session first.");
      return;
    }
    setReportBusy(true);
    setError("");
    try {
      const created = await apiRequest(`/interviews/${selectedSessionId}/report`, {
        method: "POST"
      });
      const reportId = created?.report?.id;
      if (!reportId) {
        throw new Error("Report generation failed.");
      }

      const token = localStorage.getItem("token");
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api/v1";
      const downloadResponse = await fetch(`${baseUrl}/interviews/reports/${reportId}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!downloadResponse.ok) {
        throw new Error("Failed to download generated report.");
      }
      const blob = await downloadResponse.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `interview-report-${selectedSessionId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err.message || "Failed to generate/download interview report.");
    } finally {
      setReportBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="resume-container">
        <div className="resume-card analytics-card">
          <h1>Interview History</h1>
          <Skeleton lines={6} />
        </div>
      </main>
    );
  }

  return (
    <main className="resume-container">
      <div className="resume-card analytics-card">
        <h1>Interview History</h1>
        {error && <p className="error-message">{error}</p>}

        <section className="preview-section">
          <h2>Past Interviews</h2>
          {sessions.length === 0 ? (
            <p className="helper-text">No interview sessions found yet.</p>
          ) : (
            <ul className="history-list">
              {sessions.map((session) => (
                <li key={session.id} className="history-item">
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => setSelectedSessionId(session.id)}
                  >
                    {session.title} | {session.difficulty} | {session.questionCount} questions |{" "}
                    {new Date(session.createdAt).toLocaleString()}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="preview-section">
          <h2>Session Details & Feedback</h2>
          <button
            type="button"
            onClick={handleGenerateAndDownloadReport}
            disabled={!selectedSessionId || reportBusy}
          >
            {reportBusy ? "Generating PDF..." : "Download Performance PDF Report"}
          </button>
          {detailLoading && <p className="helper-text">Loading details...</p>}
          {!detailLoading && !sessionDetail && (
            <p className="helper-text">Select a session to view detailed feedback.</p>
          )}
          {sessionDetail && (
            <div>
              <p>
                <strong>{sessionDetail.session.title}</strong> -{" "}
                {new Date(sessionDetail.session.createdAt).toLocaleString()}
              </p>
              <h3>Evaluations</h3>
              {sessionDetail.evaluations.length === 0 ? (
                <p className="helper-text">No evaluations stored for this session yet.</p>
              ) : (
                <ul>
                  {sessionDetail.evaluations.map((evaluation) => (
                    <li key={evaluation._id}>
                      <strong>Q{evaluation.questionIndex + 1}:</strong> {evaluation.question}
                      <br />
                      Score: {evaluation.overallScore}/10 | Relevance:{" "}
                      {evaluation.scoreBreakdown.relevance}
                      {" | "}Depth: {evaluation.scoreBreakdown.technicalDepth}
                      {" | "}Clarity: {evaluation.scoreBreakdown.communicationClarity}
                      {" | "}Completeness: {evaluation.scoreBreakdown.completeness}
                    </li>
                  ))}
                </ul>
              )}
              {sessionDetail.session.webcamAnalytics && (
                <div className="preview-section">
                  <h3>Webcam Analysis</h3>
                  <p>
                    Eye contact: {sessionDetail.session.webcamAnalytics.eyeContactPercent}% | Posture:{" "}
                    {sessionDetail.session.webcamAnalytics.postureQualityPercent}% | Confidence:{" "}
                    {sessionDetail.session.webcamAnalytics.confidenceScore}%
                  </p>
                  <p className="helper-text">
                    {sessionDetail.session.webcamAnalytics.feedback?.confidence}
                  </p>
                  <p className="helper-text">
                    {sessionDetail.session.webcamAnalytics.feedback?.posture}
                  </p>
                </div>
              )}
              {Array.isArray(sessionDetail.session.speechAnswerAnalytics) &&
                sessionDetail.session.speechAnswerAnalytics.length > 0 && (
                  <div className="preview-section">
                    <h3>Speech Analysis</h3>
                    <ul>
                      {sessionDetail.session.speechAnswerAnalytics.map((item) => (
                        <li key={`speech-${item.questionIndex}`}>
                          <strong>Q{item.questionIndex + 1}:</strong> {item.wordsPerMinute} WPM | Pauses:{" "}
                          {item.pauseCount} | Fillers: {item.fillerWordRatio}% | Confidence:{" "}
                          {item.confidenceScore}/100
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          )}
        </section>

        <section className="preview-section">
          <h2>Compare Two Sessions</h2>
          <label htmlFor="compareFirst">First Session</label>
          <select
            id="compareFirst"
            value={compareFirst}
            onChange={(event) => setCompareFirst(event.target.value)}
          >
            <option value="">Select first session</option>
            {sessions.map((session) => (
              <option key={`first-${session.id}`} value={session.id}>
                {session.title} - {new Date(session.createdAt).toLocaleDateString()}
              </option>
            ))}
          </select>

          <label htmlFor="compareSecond">Second Session</label>
          <select
            id="compareSecond"
            value={compareSecond}
            onChange={(event) => setCompareSecond(event.target.value)}
          >
            <option value="">Select second session</option>
            {sessions.map((session) => (
              <option key={`second-${session.id}`} value={session.id}>
                {session.title} - {new Date(session.createdAt).toLocaleDateString()}
              </option>
            ))}
          </select>

          <button type="button" onClick={handleCompare} disabled={!canCompare}>
            Compare Sessions
          </button>

          {comparison && (
            <div className="comparison-box">
              <p>
                <strong>{comparison.first.title}</strong> Avg:{" "}
                {comparison.first.averageOverallScore}/10
              </p>
              <p>
                <strong>{comparison.second.title}</strong> Avg:{" "}
                {comparison.second.averageOverallScore}/10
              </p>
              <p>
                <strong>Delta (Second - First):</strong> {comparison.delta.overallScore}
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
