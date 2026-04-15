export function Skeleton({ lines = 4 }) {
  return (
    <div className="skeleton-wrap" aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <div key={`skeleton-${index}`} className="skeleton-line" />
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="chart-wrapper">
      <div className="skeleton-chart" />
    </div>
  );
}
