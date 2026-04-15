import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    // eslint-disable-next-line no-console
    console.error("UI crash captured by ErrorBoundary:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="resume-container">
          <div className="resume-card">
            <h1>Something went wrong</h1>
            <p className="error-message">
              The page crashed unexpectedly. Please refresh and try again.
            </p>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
