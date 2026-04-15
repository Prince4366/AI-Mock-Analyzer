import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";

export function DashboardPage() {
  const { user, logout } = useAuth();
  const [streak, setStreak] = useState(null);
  const [loadingStreak, setLoadingStreak] = useState(true);
  const [badges, setBadges] = useState([]);
  const [recentUnlocks, setRecentUnlocks] = useState([]);
  const [progress, setProgress] = useState(null);
  const [weeklyGoal, setWeeklyGoal] = useState(null);
  const [goalInput, setGoalInput] = useState("3");
  const [benchmark, setBenchmark] = useState(null);

  useEffect(() => {
    async function loadStreak() {
      try {
        const data = await apiRequest("/streak/me");
        setStreak(data.streak);
      } finally {
        setLoadingStreak(false);
      }
    }
    loadStreak();
  }, []);

  useEffect(() => {
    async function loadBenchmark() {
      try {
        const data = await apiRequest("/benchmark/me");
        setBenchmark(data.benchmark);
      } catch {
        setBenchmark(null);
      }
    }
    loadBenchmark();
  }, []);

  useEffect(() => {
    async function loadGoal() {
      try {
        const data = await apiRequest("/weekly-goals/me");
        setWeeklyGoal(data.goal);
        setGoalInput(String(data.goal.targetInterviews));
      } catch {
        setWeeklyGoal(null);
      }
    }
    loadGoal();
  }, []);

  async function handleGoalUpdate(event) {
    event.preventDefault();
    const targetInterviews = Number(goalInput);
    if (!Number.isInteger(targetInterviews) || targetInterviews < 1 || targetInterviews > 50) {
      return;
    }

    const data = await apiRequest("/weekly-goals/me", {
      method: "POST",
      body: JSON.stringify({ targetInterviews })
    });
    setWeeklyGoal(data.goal);
  }

  useEffect(() => {
    async function loadProgress() {
      try {
        const data = await apiRequest("/progress/me");
        setProgress(data.progress);
      } catch {
        setProgress(null);
      }
    }
    loadProgress();
  }, []);

  useEffect(() => {
    async function loadBadges() {
      try {
        const data = await apiRequest("/badges/me");
        setBadges(data.showcase || []);
        setRecentUnlocks(data.recentUnlocks || []);
      } catch {
        setBadges([]);
      }
    }
    loadBadges();
  }, []);

  const weekProgress = useMemo(() => {
    if (!streak?.weeklyStatus) {
      return 0;
    }
    return Math.min(
      100,
      Math.round((streak.weeklyStatus.completedDays / streak.weeklyStatus.targetDays) * 100)
    );
  }, [streak]);

  return (
    <main className="dashboard-container">
      <div className="dashboard-card">
        <h1>AI Mock Interview Analyzer</h1>
        <p>Welcome, {user?.name}</p>
        <p className="helper-text">{user?.email}</p>
        <section className="level-card">
          <div className="streak-header">
            <h2>⭐ Level {progress?.level || 1}</h2>
            <p className="helper-text">{progress?.totalXp || 0} XP total</p>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${progress?.progressPercent || 0}%` }}
            />
          </div>
          <p className="helper-text">
            {progress?.xpIntoCurrentLevel || 0}/{progress?.xpForNextLevel || 100} XP to next
            level
          </p>
        </section>
        <section className="streak-card">
          <div className="streak-header">
            <h2>
              🔥 {loadingStreak ? "..." : streak?.currentDailyStreak || 0} Day Streak
            </h2>
            <p className="helper-text">
              Weekly streak: {loadingStreak ? "..." : streak?.currentWeeklyStreak || 0}
            </p>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${weekProgress}%` }} />
          </div>
          <p className="helper-text">
            {loadingStreak
              ? "Loading streak..."
              : `${streak?.weeklyStatus?.completedDays || 0}/${
                  streak?.weeklyStatus?.targetDays || 3
                } interview days this week`}
          </p>
          <div className="streak-days">
            {(streak?.recent7Days || []).map((day) => (
              <div
                key={day.date}
                className={`streak-day ${day.completed ? "active" : ""}`}
                title={`${new Date(day.date).toLocaleDateString()} ${
                  day.completed ? "- completed" : "- missed"
                }`}
              >
                {new Date(day.date).toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1)}
              </div>
            ))}
          </div>
        </section>
        <section className="goal-card">
          <div className="streak-header">
            <h2>🎯 Weekly Interview Goal</h2>
            <p className="helper-text">
              {weeklyGoal?.completedInterviews || 0}/{weeklyGoal?.targetInterviews || 0} done
            </p>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${weeklyGoal?.progressPercent || 0}%` }} />
          </div>
          <form className="goal-form" onSubmit={handleGoalUpdate}>
            <label htmlFor="goalTarget">Set weekly target</label>
            <div className="goal-row">
              <input
                id="goalTarget"
                type="number"
                min="1"
                max="50"
                value={goalInput}
                onChange={(event) => setGoalInput(event.target.value)}
              />
              <button type="submit">Update Goal</button>
            </div>
          </form>
        </section>
        <section className="benchmark-card">
          <div className="streak-header">
            <h2>📈 Peer Benchmark</h2>
            <p className="helper-text">Percentile against platform users</p>
          </div>
          <p className="benchmark-statement">
            {benchmark?.overall?.statement || "Complete evaluated interviews to unlock benchmark."}
          </p>
          <div className="benchmark-bar">
            <div
              className="benchmark-fill"
              style={{ width: `${benchmark?.overall?.percentile || 0}%` }}
            />
          </div>
          <div className="benchmark-grid">
            {(benchmark?.byCategory || []).slice(0, 3).map((item) => (
              <article key={item.category} className="benchmark-item">
                <strong>{item.category}</strong>
                <p className="helper-text">{item.percentile}% percentile</p>
                <div className="benchmark-bar">
                  <div className="benchmark-fill" style={{ width: `${item.percentile}%` }} />
                </div>
              </article>
            ))}
          </div>
          {(benchmark?.byTopic || []).length > 0 && (
            <div>
              <p className="helper-text">Top topic benchmarks</p>
              <ul className="topic-benchmark-list">
                {benchmark.byTopic.slice(0, 3).map((topic) => (
                  <li key={topic.topic}>
                    <span>{topic.topic}</span>
                    <strong>{topic.percentile}%</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
        {recentUnlocks.length > 0 && (
          <section className="unlock-toast" role="status" aria-live="polite">
            <strong>🎉 New badge unlocked:</strong> {recentUnlocks[0].title}
          </section>
        )}
        <section className="badge-card">
          <div className="streak-header">
            <h2>🏅 Achievements</h2>
            <p className="helper-text">
              {badges.filter((badge) => badge.unlocked).length}/{badges.length} unlocked
            </p>
          </div>
          <div className="badge-grid">
            {badges.map((badge) => (
              <article
                key={badge.key}
                className={`badge-item ${badge.unlocked ? "unlocked" : "locked"}`}
                title={badge.description}
              >
                <span className="badge-icon">{badge.icon}</span>
                <div>
                  <strong>{badge.title}</strong>
                  <p className="helper-text">{badge.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <Link className="link-button" to="/resumes">
          Upload Resume
        </Link>
        <Link className="link-button" to="/job-descriptions">
          Add Job Description
        </Link>
        <Link className="link-button" to="/interview-session">
          Start Interview Session
        </Link>
        <Link className="link-button" to="/analytics-dashboard">
          View Analytics Dashboard
        </Link>
        <Link className="link-button" to="/interview-history">
          Interview History
        </Link>
        <button onClick={logout} type="button">
          Logout
        </button>
      </div>
    </main>
  );
}
