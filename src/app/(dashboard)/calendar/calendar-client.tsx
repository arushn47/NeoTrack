'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Building2,
  ExternalLink,
  X,
  Sparkles,
  LayoutGrid,
  List,
  Zap,
  CalendarCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/utils';
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from '@/constants/event-types';
import type { EventType } from '@/constants/event-types';

export interface CalendarEvent {
  id: string;
  companyId: string;
  companyName: string;
  eventType: string;
  title: string | null;
  startTime: string | null;
  endTime: string | null;
  venue: string | null;
  mode: string | null;
}

interface CalendarClientProps {
  events: CalendarEvent[];
}

export default function CalendarClient({ events }: CalendarClientProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');
  const [selectedEventType, setSelectedEventType] = useState<'all' | 'test' | 'interview' | 'ppt' | 'deadline'>('all');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Calendar month days calculation
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: { dayNumber: number; isCurrentMonth: boolean; dateString: string }[] = [];

    // Prev month padding
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, d);
      days.push({
        dayNumber: d,
        isCurrentMonth: false,
        dateString: prevDate.toISOString().split('T')[0],
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const currDate = new Date(year, month, i);
      const yyyy = currDate.getFullYear();
      const mm = String(currDate.getMonth() + 1).padStart(2, '0');
      const dd = String(currDate.getDate()).padStart(2, '0');
      days.push({
        dayNumber: i,
        isCurrentMonth: true,
        dateString: `${yyyy}-${mm}-${dd}`,
      });
    }

    // Next month padding to fill complete grid of 35 or 42
    const totalSlots = days.length <= 35 ? 35 : 42;
    const remaining = totalSlots - days.length;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      const yyyy = nextDate.getFullYear();
      const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
      const dd = String(nextDate.getDate()).padStart(2, '0');
      days.push({
        dayNumber: i,
        isCurrentMonth: false,
        dateString: `${yyyy}-${mm}-${dd}`,
      });
    }

    return days;
  }, [year, month]);

  const filteredEvents = useMemo(() => {
    if (selectedEventType === 'all') return events;
    if (selectedEventType === 'test') {
      return events.filter((e) => ['online_test', 'coding_test'].includes(e.eventType));
    }
    if (selectedEventType === 'interview') {
      return events.filter((e) => ['technical_interview', 'hr_interview', 'final_interview'].includes(e.eventType));
    }
    if (selectedEventType === 'ppt') {
      return events.filter((e) => e.eventType === 'ppt');
    }
    if (selectedEventType === 'deadline') {
      return events.filter((e) => e.eventType === 'registration_deadline');
    }
    return events;
  }, [events, selectedEventType]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const evt of filteredEvents) {
      if (evt.startTime) {
        const d = new Date(evt.startTime);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const key = `${yyyy}-${mm}-${dd}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(evt);
      }
    }
    return map;
  }, [filteredEvents]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const getEventBadgeColor = (type: string) => {
    switch (type) {
      case 'ppt':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/25';
      case 'online_test':
      case 'coding_test':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25';
      case 'technical_interview':
      case 'hr_interview':
      case 'final_interview':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25';
      case 'registration_deadline':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25';
      default:
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30 hover:bg-purple-500/25';
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const todayEvents = eventsByDate.get(todayStr) || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in selection:bg-indigo-500/20">
      {/* Header & Month Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <CalendarIcon className="w-6 h-6 text-indigo-400" />
            <span>Placement Schedule</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Visual calendar and action timeline for upcoming tests, interview slots, and drive sessions.
          </p>
        </div>

        {/* View Switcher & Month Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Grid vs Timeline View Toggle */}
          <div className="flex items-center bg-[#101018] border border-zinc-800 rounded-xl p-1 shadow-sm">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                viewMode === 'grid'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grid</span>
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                viewMode === 'timeline'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <List className="w-3.5 h-3.5" />
              <span>Timeline</span>
            </button>
          </div>

          <button
            onClick={handleToday}
            className="px-3.5 py-1.5 rounded-xl bg-[#101018] border border-zinc-800 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition-all shadow-sm"
          >
            Today
          </button>

          {/* Month Selector */}
          <div className="flex items-center gap-1 bg-[#101018] border border-zinc-800 rounded-xl p-1 shadow-sm">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs sm:text-sm font-bold text-white px-3 min-w-[130px] text-center font-mono">
              {monthNames[month]} {year}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Event Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: 'all' as const, label: 'All Events' },
            { id: 'test' as const, label: 'Online Tests' },
            { id: 'interview' as const, label: 'Interviews' },
            { id: 'ppt' as const, label: 'PPTs' },
            { id: 'deadline' as const, label: 'Deadlines' },
          ].map((tab) => {
            const isSelected = selectedEventType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedEventType(tab.id)}
                className={cn(
                  'px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 active:scale-95',
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-[#101018] hover:bg-[#141420] text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Legend dots */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            PPT
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Assessment
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Interview
          </span>
        </div>
      </div>

      {/* Mode 1: Month Grid View */}
      {viewMode === 'grid' && (
        <div className="bg-[#101018]/90 backdrop-blur-2xl border border-zinc-800/80 rounded-3xl overflow-hidden shadow-2xl shadow-black/30">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 border-b border-zinc-800 bg-zinc-950/80 text-center py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-zinc-800/60">
            {calendarDays.map((d, index) => {
              const dayEvents = eventsByDate.get(d.dateString) || [];
              const isToday = d.dateString === todayStr;

              return (
                <div
                  key={index}
                  className={cn(
                    'min-h-[120px] p-2.5 flex flex-col justify-between transition-colors',
                    d.isCurrentMonth ? 'bg-[#101018] hover:bg-zinc-900/60' : 'bg-zinc-950/40 opacity-30',
                    isToday && 'ring-2 ring-inset ring-indigo-500/80 bg-indigo-500/5'
                  )}
                >
                  {/* Date Number Header */}
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center font-mono',
                        isToday ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40' : 'text-zinc-400'
                      )}
                    >
                      {d.dayNumber}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] text-zinc-500 font-bold font-mono">
                        {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
                      </span>
                    )}
                  </div>

                  {/* Day Events List */}
                  <div className="space-y-1.5 mt-2 overflow-hidden">
                    {dayEvents.slice(0, 3).map((evt) => (
                      <button
                        key={evt.id}
                        onClick={() => setSelectedEvent(evt)}
                        className={cn(
                          'w-full text-left px-2 py-1 rounded-lg border text-[11px] font-semibold truncate block transition-all hover:scale-[1.02] shadow-sm',
                          getEventBadgeColor(evt.eventType)
                        )}
                      >
                        <span className="font-bold mr-1">{evt.companyName}:</span>
                        <span>{evt.title || evt.eventType}</span>
                      </button>
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-[10px] text-indigo-400 pl-1 block font-bold">
                        +{dayEvents.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mode 2: Timeline / List View */}
      {viewMode === 'timeline' && (
        <div className="bg-[#101018]/90 backdrop-blur-2xl border border-zinc-800/80 rounded-3xl overflow-hidden shadow-2xl p-5 sm:p-6 space-y-4">
          {filteredEvents.length === 0 ? (
            <div className="py-16 text-center">
              <CalendarCheck className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">No Scheduled Events</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                No active placement assessments or interview rounds found for the selected filter.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {filteredEvents.map((evt) => {
                const eventColors = EVENT_TYPE_COLORS[evt.eventType as EventType] || EVENT_TYPE_COLORS.other;
                return (
                  <div
                    key={evt.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 hover:bg-zinc-900/40 rounded-2xl px-3 transition-all group"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className={cn('w-3 h-3 rounded-full mt-1.5 flex-shrink-0', eventColors.dot)} />
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/companies/${evt.companyId}`}
                            className="text-sm font-bold text-white hover:text-indigo-400 transition-colors"
                          >
                            {evt.companyName}
                          </Link>
                          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider', getEventBadgeColor(evt.eventType))}>
                            {EVENT_TYPE_LABELS[evt.eventType as EventType] || evt.eventType}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300 font-medium mt-1">
                          {evt.title || 'Placement Session'}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1 font-mono">
                          {evt.venue && <span>📍 {evt.venue}</span>}
                          {evt.mode && <span>· {evt.mode}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center flex-shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-semibold text-zinc-200">
                          {evt.startTime ? formatDateTime(evt.startTime) : 'Date TBA'}
                        </p>
                      </div>
                      {evt.startTime && (
                        <a
                          href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(evt.title || 'Placement Event')}&dates=${new Date(evt.startTime).toISOString().replace(/-|:|\.\d+/g, '')}/${new Date(new Date(evt.startTime).getTime() + 3600000).toISOString().replace(/-|:|\.\d+/g, '')}&location=${encodeURIComponent(evt.venue || 'VIT Campus / Online')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-all flex items-center gap-1.5"
                          title="Add to Google Calendar"
                        >
                          <CalendarIcon className="w-3.5 h-3.5" />
                          <span>Sync</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Selected Event Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="bg-[#12121c]/95 border border-zinc-800 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-extrabold text-lg">
                  {selectedEvent.companyName.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedEvent.companyName}</h3>
                  <span
                    className={cn(
                      'inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider mt-1 border',
                      getEventBadgeColor(selectedEvent.eventType)
                    )}
                  >
                    {selectedEvent.eventType.replace('_', ' ')}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1.5 rounded-xl text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 pt-2 text-xs bg-zinc-950/60 p-4 rounded-2xl border border-zinc-800/80">
              <h4 className="text-sm font-bold text-zinc-200">{selectedEvent.title}</h4>

              {selectedEvent.startTime && (
                <div className="flex items-center gap-2.5 text-zinc-400">
                  <Clock className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <span className="font-mono text-zinc-300">
                    {new Date(selectedEvent.startTime).toLocaleString('en-IN', {
                      dateStyle: 'full',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
              )}

              {selectedEvent.venue && (
                <div className="flex items-center gap-2.5 text-zinc-400">
                  <MapPin className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>{selectedEvent.venue}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <Link
                href={`/companies/${selectedEvent.companyId}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                View Company Profile
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>

              <div className="flex items-center gap-2">
                {selectedEvent.startTime && (
                  <a
                    href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(selectedEvent.title || 'Placement Event')}&dates=${new Date(selectedEvent.startTime).toISOString().replace(/-|:|\.\d+/g, '')}/${new Date(new Date(selectedEvent.startTime).getTime() + 3600000).toISOString().replace(/-|:|\.\d+/g, '')}&location=${encodeURIComponent(selectedEvent.venue || 'VIT Campus / Online')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/25 transition-all flex items-center gap-1.5"
                  >
                    <CalendarIcon className="w-3.5 h-3.5" />
                    Add to Calendar
                  </a>
                )}
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-all border border-zinc-800"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
