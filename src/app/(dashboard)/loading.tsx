export default function DashboardLoading() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
      {/* Pipeline summary skeleton */}
      <div className="h-16 rounded-xl bg-bg-surface border border-border-default" />

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="p-4 rounded-xl bg-bg-surface border border-border-default"
          >
            <div className="w-8 h-8 rounded-lg bg-bg-elevated mb-3" />
            <div className="h-7 w-12 bg-bg-elevated rounded mb-1" />
            <div className="h-3.5 w-24 bg-bg-elevated rounded" />
          </div>
        ))}
      </div>

      {/* Upcoming events skeleton */}
      <div className="rounded-xl bg-bg-surface border border-border-default overflow-hidden">
        <div className="px-5 py-4 border-b border-border-default">
          <div className="h-4 w-36 bg-bg-elevated rounded" />
        </div>
        <div className="py-12 flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-bg-elevated" />
          <div className="h-3 w-32 bg-bg-elevated rounded" />
        </div>
      </div>
    </div>
  );
}
