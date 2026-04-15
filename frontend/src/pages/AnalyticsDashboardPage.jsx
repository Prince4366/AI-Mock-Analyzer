import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { apiRequest } from "../api/client";
import { ChartSkeleton, Skeleton } from "../components/Skeleton";

export function AnalyticsDashboardPage() {
  const [data, setData] = useState(null);
  const [webcamSummary, setWebcamSummary] = useState(null);
  const [speechSummary, setSpeechSummary] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [roleTrack, setRoleTrack] = useState("All");

  const roleOptions = [
    "All",
    "Software Engineer",
    "Data Analyst",
    "AIML Engineer",
    "Product Manager",
    "HR/Behavioral"
  ];

  useEffect(() => {
    async function fetchData() {
      try {
        const query =
          roleTrack === "All" ? "" : `?roleTrack=${encodeURIComponent(roleTrack)}`;
        const response = await apiRequest(`/analytics/dashboard${query}`);
        const webcam = await apiRequest("/interviews/webcam-summary");
        const speech = await apiRequest("/interviews/speech-summary");
        setData(response);
        setWebcamSummary(webcam.summary || null);
        setSpeechSummary(speech.summary || null);
      } catch (err) {
        setError(err.message || "Failed to load analytics dashboard");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [roleTrack]);

  if (loading) {
    return (
      <main className="resume-container">
        <div className="resume-card analytics-card">
          <h1>Analytics Dashboard</h1>
          <Skeleton lines={2} />
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="resume-container">
        <div className="resume-card">
          <h1>Analytics Dashboard</h1>
          <p className="error-message">{error}</p>
        </div>
      </main>
    );
  }

  const charts = data?.charts || {};

  return (
    <main className="resume-container">
      <div className="resume-card analytics-card">
        <h1>Analytics Dashboard</h1>
        <label htmlFor="roleFilter">Role Track</label>
        <select
          id="roleFilter"
          value={roleTrack}
          onChange={(event) => {
            setLoading(true);
            setRoleTrack(event.target.value);
          }}
        >
          {roleOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <section className="preview-section">
          <h2>Confidence & Posture Summary</h2>
          {!webcamSummary ? (
            <p className="helper-text">
              Complete an interview with webcam analysis enabled to see posture and confidence metrics.
            </p>
          ) : (
            <div className="webcam-summary-grid">
              <div className="webcam-summary-item">
                <strong>{webcamSummary.eyeContactPercent}%</strong>
                <span>Avg Eye Contact</span>
              </div>
              <div className="webcam-summary-item">
                <strong>{webcamSummary.postureQualityPercent}%</strong>
                <span>Avg Posture Quality</span>
              </div>
              <div className="webcam-summary-item">
                <strong>{webcamSummary.smileFrequencyPercent}%</strong>
                <span>Smile Frequency</span>
              </div>
              <div className="webcam-summary-item">
                <strong>{webcamSummary.confidenceScore}%</strong>
                <span>Confidence Score</span>
              </div>
            </div>
          )}
        </section>

        <section className="preview-section">
          <h2>Speech Delivery Summary</h2>
          {!speechSummary ? (
            <p className="helper-text">
              Submit spoken answers to view pace, pause, filler-word, and confidence analytics.
            </p>
          ) : (
            <div className="webcam-summary-grid">
              <div className="webcam-summary-item">
                <strong>{speechSummary.averageWordsPerMinute}</strong>
                <span>Average WPM</span>
              </div>
              <div className="webcam-summary-item">
                <strong>{speechSummary.averagePauseCount}</strong>
                <span>Average Pause Count</span>
              </div>
              <div className="webcam-summary-item">
                <strong>{speechSummary.averageFillerWordRatio}%</strong>
                <span>Filler Word Ratio</span>
              </div>
              <div className="webcam-summary-item">
                <strong>{speechSummary.averageConfidenceScore}/100</strong>
                <span>Speech Confidence</span>
              </div>
            </div>
          )}
          {speechSummary?.strengths?.length > 0 && (
            <p className="helper-text">Strengths: {speechSummary.strengths.join(" ")}</p>
          )}
          {speechSummary?.weaknesses?.length > 0 && (
            <p className="helper-text">Weaknesses: {speechSummary.weaknesses.join(" ")}</p>
          )}
        </section>

        <section className="preview-section">
          <h2>Overall Score Trend</h2>
          <ChartContainer>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={charts.overallScoreTrend || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="index" />
                <YAxis domain={[0, 10]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="score" stroke="#4f46e5" name="Score" />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </section>

        <section className="preview-section">
          <h2>Topic-wise Performance</h2>
          <ChartContainer>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.topicPerformance || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="topic" />
                <YAxis domain={[0, 10]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="score" fill="#16a34a" name="Avg Score" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </section>

        <section className="preview-section">
          <h2>Weakness Radar</h2>
          <ChartContainer>
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={charts.weaknessRadar || []}>
                <PolarAngleAxis dataKey="dimension" />
                <PolarRadiusAxis domain={[0, 10]} />
                <Radar name="Score" dataKey="score" stroke="#dc2626" fill="#fecaca" fillOpacity={0.7} />
                <Legend />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </section>

        <section className="preview-section">
          <h2>Interview History Timeline</h2>
          <ChartContainer>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={charts.interviewTimeline || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis domain={[0, 10]} />
                <Tooltip
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                  formatter={(value, _name, entry) => [value, entry.payload.question]}
                />
                <Line type="monotone" dataKey="score" stroke="#0ea5e9" />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </section>

        <section className="preview-section">
          <h2>Improvement Over Time</h2>
          <ChartContainer>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={charts.improvementOverTime || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="point" />
                <YAxis domain={[0, 10]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="score" stroke="#9333ea" name="Score" />
                <Line
                  type="monotone"
                  dataKey="runningAvg"
                  stroke="#f59e0b"
                  name="Running Average"
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </section>
      </div>
    </main>
  );
}

function ChartContainer({ children }) {
  return <div className="chart-wrapper">{children}</div>;
}
