export default function CalendarLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header + nav skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-32 bg-bg-elevated rounded" />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-bg-surface border border-border-default" />
          <div className="h-5 w-36 bg-bg-elevated rounded" />
          <div className="w-8 h-8 rounded-lg bg-bg-surface border border-border-default" />
        </div>
      </div>

      {/* Calendar grid skeleton */}
      <div className="rounded-xl bg-bg-surface border border-border-default overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border-default">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="px-3 py-2 text-center">
              <div className="h-3 w-8 bg-bg-elevated rounded mx-auto" />
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        {Array.from({ length: 5 }).map((_, row) => (
          <div key={row} className="grid grid-cols-7 border-b border-border-default last:border-b-0">
            {Array.from({ length: 7 }).map((_, col) => (
              <div key={col} className="min-h-[80px] p-2 border-r border-border-default last:border-r-0">
                <div className="h-3 w-4 bg-bg-elevated/60 rounded mb-2" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
