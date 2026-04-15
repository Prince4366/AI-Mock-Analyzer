import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(form);
      navigate("/app", { replace: true });
    } catch (err) {
      setError(err.message || "Failed to log in");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-container">
      <form onSubmit={onSubmit} className="auth-card">
        <h1>Login</h1>
        {error && <p className="error-message">{error}</p>}
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          required
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={form.password}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, password: e.target.value }))
          }
          required
          minLength={8}
        />
        <button disabled={submitting} type="submit">
          {submitting ? "Logging in..." : "Login"}
        </button>
        <p className="helper-text">
          No account? <Link to="/signup">Sign up</Link>
        </p>
      </form>
    </main>
  );
}
