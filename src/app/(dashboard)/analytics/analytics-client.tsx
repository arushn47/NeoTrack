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

    const companyToEvents = new Map<string, string[]>();
    events.forEach((evt) => {
      const types = companyToEvents.get(evt.company_id) || [];
      types.push(evt.event_type);
      companyToEvents.set(evt.company_id, types);
    });

    applications.forEach((app) => {
      // Exclude withdrawn
      if (app.status === 'withdrawn') return;
      
      applied++;

      const evtTypes = companyToEvents.get(app.company_id) || [];
      const hasTest = evtTypes.some((t) => ['online_test', 'coding_test'].includes(t));
      const hasInterview = evtTypes.some((t) =>
        ['technical_interview', 'hr_interview', 'final_interview'].includes(t)
      );

      if (
        app.status === 'shortlisted' ||
        app.status === 'interview_scheduled' ||
        app.status === 'selected' ||
        hasTest ||
        hasInterview
      ) {
        shortlisted++;
      }

      if (
        hasTest ||
        app.status === 'interview_scheduled' ||
        app.status === 'selected' ||
        hasInterview
      ) {
        tested++;
      }

      if (hasInterview || app.status === 'interview_scheduled' || app.status === 'selected') {
        interviewed++;
      }

      if (app.status === 'selected') {
        selected++;
      }
    });

    return [
      { name: 'Applied', value: applied, fill: '#3b82f6' },
      { name: 'Shortlisted', value: shortlisted, fill: '#8b5cf6' },
      { name: 'Tested', value: tested, fill: '#f59e0b' },
      { name: 'Interviewed', value: interviewed, fill: '#10b981' },
      { name: 'Selected', value: selected, fill: '#ec4899' },
    ];
  }, [applications, events]);

  // 2. Compute timeline data (Applications per month)
  const timelineData = useMemo(() => {
    const months = new Map<string, number>();

    applications.forEach((app) => {
      if (!app.applied_at) return;
      const date = new Date(app.applied_at);
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

  // 3. Compute basic stats
  const activeCount = applications.filter((a) => !['withdrawn', 'selected', 'declined'].includes(a.status)).length;
  const notShortlistedCount = applications.filter((a) => a.status === 'not_shortlisted').length;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#111113] border border-white/10 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-zinc-400 mb-1">Conversion Rate</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">
              {funnelData[0].value > 0
                ? Math.round((funnelData[1].value / funnelData[0].value) * 100)
                : 0}
              %
            </span>
            <span className="text-sm text-zinc-500 font-medium">Applied → Shortlisted</span>
          </div>
        </div>

        <div className="bg-[#111113] border border-white/10 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-zinc-400 mb-1">Active Pipeline</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{activeCount}</span>
            <span className="text-sm text-zinc-500 font-medium">Opportunities</span>
          </div>
        </div>

        <div className="bg-[#111113] border border-white/10 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-zinc-400 mb-1">Select Rate</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">
              {funnelData[3].value > 0
                ? Math.round((funnelData[4].value / funnelData[3].value) * 100)
                : 0}
              %
            </span>
            <span className="text-sm text-zinc-500 font-medium">Interview → Selected</span>
          </div>
        </div>
        
        <div className="bg-[#111113] border border-red-900/30 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-zinc-400 mb-1">Not Shortlisted</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{notShortlistedCount}</span>
            <span className="text-sm text-zinc-500 font-medium">Companies</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel Chart */}
        <div className="bg-[#111113] border border-white/10 rounded-xl p-6">
          <h3 className="text-base font-semibold text-white mb-6">Placement Funnel</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={funnelData}
                layout="vertical"
                margin={{ top: 0, right: 30, left: 20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#333" />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9ca3af', fontSize: 13 }}
                  width={90}
                />
                <Tooltip
                  cursor={{ fill: '#ffffff0a' }}
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                  itemStyle={{ color: '#fff', fontWeight: 500 }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Timeline Chart */}
        <div className="bg-[#111113] border border-white/10 rounded-xl p-6">
          <h3 className="text-base font-semibold text-white mb-6">Application Timeline</h3>
          <div className="h-[300px] w-full">
            {timelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: '1px solid #3f3f46',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="applications"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorApps)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                Not enough data to display timeline.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
