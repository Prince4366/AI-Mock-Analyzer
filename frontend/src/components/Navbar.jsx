import { Link, useLocation } from "react-router-dom";
import { ThemeToggleButton } from "./ThemeToggleButton";
import { useAuth } from "../hooks/useAuth";

const protectedLinks = [
  { to: "/app", label: "Home" },
  { to: "/interview-session", label: "Interview" },
  { to: "/interview-history", label: "History" },
  { to: "/analytics-dashboard", label: "Analytics" }
];

const publicLinks = [
  { to: "/#preview", label: "Preview" },
  { to: "/login", label: "Login" },
  { to: "/signup", label: "Get Started" }
];

export function Navbar() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to={isAuthenticated ? "/app" : "/"} className="brand-link">
          AI Mock Analyzer
        </Link>

        {isAuthenticated && (
          <nav className="topbar-nav" aria-label="Primary navigation">
            {protectedLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`topbar-nav-link ${
                  location.pathname === item.to ? "active" : ""
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
        {!isAuthenticated && (
          <nav className="topbar-nav" aria-label="Primary navigation">
            {publicLinks.map((item) => (
              <Link key={item.to} to={item.to} className="topbar-nav-link">
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        <ThemeToggleButton />
      </div>
    </header>
  );
}
