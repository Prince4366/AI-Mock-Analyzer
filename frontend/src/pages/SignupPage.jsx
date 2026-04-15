import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signup(form);
      navigate("/app", { replace: true });
    } catch (err) {
      setError(err.message || "Failed to sign up");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-container">
      <form onSubmit={onSubmit} className="auth-card">
        <h1>Sign Up</h1>
        {error && <p className="error-message">{error}</p>}
        <label htmlFor="name">Name</label>
        <input
          id="name"
          type="text"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          required
          minLength={2}
        />
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
          {submitting ? "Creating account..." : "Create account"}
        </button>
        <p className="helper-text">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </main>
  );
}
