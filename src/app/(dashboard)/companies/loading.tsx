export default function CompaniesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="h-7 w-48 bg-bg-elevated rounded mb-2" />
          <div className="h-3.5 w-72 bg-bg-surface rounded" />
        </div>
        <div className="h-9 w-full sm:w-72 bg-bg-surface border border-border-default rounded-xl" />
      </div>

      {/* Filter tabs skeleton */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="h-8 rounded-xl bg-bg-surface border border-border-default"
            style={{ width: `${60 + Math.random() * 40}px` }}
          />
        ))}
      </div>

      {/* Cards grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="p-5 bg-bg-surface border border-border-default rounded-2xl space-y-4"
          >
            {/* Company header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-bg-elevated" />
                <div className="space-y-1.5">
                  <div className="h-4 w-28 bg-bg-elevated rounded" />
                  <div className="h-3 w-40 bg-bg-elevated/60 rounded" />
                </div>
              </div>
              <div className="h-5 w-16 bg-bg-elevated rounded-full" />
            </div>

            {/* CTC/location badges */}
            <div className="flex gap-2">
              <div className="h-6 w-20 bg-bg-elevated/50 rounded-lg" />
              <div className="h-6 w-24 bg-bg-elevated/50 rounded-lg" />
            </div>

            {/* Progress bar */}
            <div className="h-10 w-full bg-bg-elevated/40 rounded-xl" />

            {/* Footer */}
            <div className="pt-3 border-t border-border-default/60 flex justify-between">
              <div className="h-3 w-20 bg-bg-elevated/50 rounded" />
              <div className="h-3 w-12 bg-bg-elevated/50 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
