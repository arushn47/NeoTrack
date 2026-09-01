'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from 'recharts';
import {
  TrendingUp,
  Award,
  Briefcase,
  Sparkles,
  PieChart,
  CheckCircle2,
  XCircle,
  Activity,
} from 'lucide-react';

export interface AnalyticsApplication {
  id: string;
  company_id: string;
  status: string;
  ctc: string | null;
  applied_at: string | null;
  last_updated: string | null;
}

export interface AnalyticsEvent {
  id: string;
  company_id: string;
  event_type: string;
  start_time: string | null;
}

interface AnalyticsClientProps {
  applications: AnalyticsApplication[];
  events: AnalyticsEvent[];
}

export default function AnalyticsClient({
  applications,
  events,
}: AnalyticsClientProps) {
  // 1. Calculate Funnel Data
  const funnelData = useMemo(() => {
    let applied = 0;
    let shortlisted = 0;
    let tested = 0;
    let interviewed = 0;
    let selected = 0;

    applications.forEach((app) => {
      // Exclude drives the user opted out of or never registered for
      if (['not_applied', 'withdrawn', 'declined'].includes(app.status)) return;
      applied++;

      const isShortlistedForTest = [
        'shortlisted',
        'test_scheduled',
        'interview_scheduled',
        'selected',
        'offer_received',
        'rejected', // Wrote test and was eliminated post-test
      ].includes(app.status);

      const isTested = [
        'test_scheduled',
        'interview_scheduled',
        'selected',
        'offer_received',
        'rejected',
      ].includes(app.status);

      const isInterviewed = [
        'interview_scheduled',
        'selected',
        'offer_received',
      ].includes(app.status);

      const isSelected = [
        'selected',
        'offer_received',
      ].includes(app.status);

      if (isShortlistedForTest) shortlisted++;
      if (isTested) tested++;
      if (isInterviewed) interviewed++;
      if (isSelected) selected++;
    });

    return [
      { name: 'Applied', value: applied, fill: '#6366f1' },
      { name: 'Shortlisted', value: shortlisted, fill: '#06b6d4' },
      { name: 'Tested', value: tested, fill: '#f59e0b' },
      { name: 'Interviewed', value: interviewed, fill: '#10b981' },
      { name: 'Selected', value: selected, fill: '#ec4899' },
    ];
  }, [applications]);

  // 2. Compute timeline data
  const timelineData = useMemo(() => {
    const months = new Map<string, number>();

    applications.forEach((app) => {
      if (!app.applied_at && !app.last_updated) return;
      const rawDate = app.applied_at || app.last_updated;
      if (!rawDate) return;
      const date = new Date(rawDate);
      if (isNaN(date.getTime())) return;

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.set(monthKey, (months.get(monthKey) || 0) + 1);
    });

    return Array.from(months.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, count]) => {
        const [year, m] = month.split('-');
        const date = new Date(parseInt(year, 10), parseInt(m, 10) - 1, 1);
        return {
          month: date.toLocaleString('default', { month: 'short', year: '2-digit' }),
          applications: count,
        };
      });
  }, [applications]);

  // Exact sync with Companies page "In Progress" (active) filter
  const activeCount = applications.filter(
    (a) => !['not_applied', 'withdrawn', 'declined', 'not_shortlisted', 'rejected', 'selected'].includes(a.status)
  ).length;
  const notShortlistedCount = applications.filter((a) => a.status === 'not_shortlisted').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in selection:bg-indigo-500/20">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <PieChart className="w-6 h-6 text-indigo-400" />
          <span>Placement Intelligence & Funnel</span>
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          Detailed breakdown of your hiring pipeline conversion ratios and drive frequency.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 stagger-children">
        <div className="bg-[#101018]/90 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-5 shadow-lg shadow-black/20 hover:border-indigo-500/30 transition-all">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-semibold">Shortlist Conversion</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white font-mono">
              {funnelData[0].value > 0
                ? Math.round((funnelData[1].value / funnelData[0].value) * 100)
                : 0}
              %
            </span>
            <span className="text-xs text-zinc-500 font-medium">Applied → Shortlisted</span>
          </div>
        </div>

        <div className="bg-[#101018]/90 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-5 shadow-lg shadow-black/20 hover:border-indigo-500/30 transition-all">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-semibold">Active Opportunities</span>
            <Briefcase className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white font-mono">{activeCount}</span>
            <span className="text-xs text-zinc-500 font-medium">In Pipeline</span>
          </div>
        </div>

        <div className="bg-[#101018]/90 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-5 shadow-lg shadow-black/20 hover:border-indigo-500/30 transition-all">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-semibold">Offer Conversion</span>
            <Award className="w-4 h-4 text-pink-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white font-mono">
              {funnelData[3].value > 0
                ? Math.round((funnelData[4].value / funnelData[3].value) * 100)
                : 0}
              %
            </span>
            <span className="text-xs text-zinc-500 font-medium">Interview → Selected</span>
          </div>
        </div>
        
        <div className="bg-[#101018]/90 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-5 shadow-lg shadow-black/20 hover:border-rose-500/30 transition-all">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-semibold">Not Shortlisted</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white font-mono">{notShortlistedCount}</span>
            <span className="text-xs text-zinc-500 font-medium">Companies</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel Chart */}
        <div className="bg-[#101018]/90 backdrop-blur-2xl border border-zinc-800/80 rounded-3xl p-6 sm:p-7 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-white">Hiring Funnel Progression</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Stages reached across all registered companies</p>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Live Aggregate
            </span>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={funnelData}
                layout="vertical"
                margin={{ top: 0, right: 30, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1f1f2e" />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9494a8', fontSize: 12, fontWeight: 500 }}
                  width={90}
                />
                <Tooltip
                  cursor={{ fill: '#ffffff08' }}
                  contentStyle={{
                    backgroundColor: '#12121c',
                    border: '1px solid #27273a',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  itemStyle={{ color: '#fff', fontWeight: 600 }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Timeline Chart */}
        <div className="bg-[#101018]/90 backdrop-blur-2xl border border-zinc-800/80 rounded-3xl p-6 sm:p-7 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-white">Application Volume Over Time</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Placement drives received per month</p>
            </div>
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="h-[280px] w-full">
            {timelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f1f2e" />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#9494a8', fontSize: 11 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#9494a8', fontSize: 11 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#12121c',
                      border: '1px solid #27273a',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="applications"
                    stroke="#818cf8"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorApps)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
                Sync more emails to generate historical volume charts.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
