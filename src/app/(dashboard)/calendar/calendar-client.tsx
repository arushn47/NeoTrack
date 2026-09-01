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

  const [selectedDayData, setSelectedDayData] = useState<{
    dateString: string;
    dayNumber: number;
    date: Date;
    events: CalendarEvent[];
  } | null>(null);

  const formatChipText = (evt: CalendarEvent) => {
    let cleanTitle = evt.title || evt.eventType;
    if (cleanTitle.toLowerCase().startsWith(evt.companyName.toLowerCase())) {
      cleanTitle = cleanTitle.slice(evt.companyName.length).replace(/^[\s\-–—:]+/, '').trim();
    }
    return `${evt.companyName} · ${cleanTitle || evt.eventType}`;
  };

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

  const getEventBadgeColor = (eventType: string) => {
    const colors: Record<string, string> = {
      ppt: 'bg-blue-500/15 text-blue-300 border-blue-500/30 hover:bg-blue-500/25',
      online_test: 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25',
      coding_test: 'bg-orange-500/15 text-orange-300 border-orange-500/30 hover:bg-orange-500/25',
      technical_interview: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25',
      hr_interview: 'bg-teal-500/15 text-teal-300 border-teal-500/30 hover:bg-teal-500/25',
      final_interview: 'bg-green-500/15 text-green-300 border-green-500/30 hover:bg-green-500/25',
      registration_deadline: 'bg-red-500/15 text-red-300 border-red-500/30 hover:bg-red-500/25',
    };
    return colors[eventType] || 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700';
  };

  const todayStr = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto selection:bg-indigo-500/20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span className="p-2 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-md shadow-indigo-500/10">
              <CalendarIcon className="w-6 h-6" />
            </span>
            Placement Schedule
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Visual calendar and action timeline for upcoming tests, interview slots, and drive sessions.
          </p>
        </div>

        {/* View mode toggle + Month navigator */}
        <div className="flex items-center gap-3 self-start sm:self-center flex-wrap">
          {/* Grid vs Timeline mode toggle */}
          <div className="flex items-center p-1 bg-[#101018] rounded-2xl border border-zinc-800">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all',
                viewMode === 'grid'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Grid
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all',
                viewMode === 'timeline'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <List className="w-3.5 h-3.5" />
              Timeline
            </button>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center gap-1.5 bg-[#101018] px-2 py-1 rounded-2xl border border-zinc-800">
            <button
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
            >
              Today
            </button>
            <div className="h-4 w-px bg-zinc-800" />
            <button
              onClick={handlePrevMonth}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
              aria-label="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-white px-2 min-w-[120px] text-center font-mono">
              {monthNames[month]} {year}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
              aria-label="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        {/* Category Pills */}
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
                  onClick={() => {
                    setSelectedDayData({
                      dateString: d.dateString,
                      dayNumber: d.dayNumber,
                      date: new Date(`${d.dateString}T00:00:00`),
                      events: dayEvents,
                    });
                  }}
                  className={cn(
                    'min-h-[120px] p-2.5 flex flex-col justify-between transition-all cursor-pointer group select-none',
                    d.isCurrentMonth
                      ? 'bg-[#101018] hover:bg-zinc-900/80 hover:shadow-inner'
                      : 'bg-zinc-950/40 opacity-35 hover:opacity-75',
                    isToday && 'ring-2 ring-inset ring-indigo-500/80 bg-indigo-500/5'
                  )}
                >
                  {/* Date Number Header */}
                  <div className="flex items-center justify-between pointer-events-none">
                    <span
                      className={cn(
                        'text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center font-mono transition-transform group-hover:scale-110',
                        isToday
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40'
                          : dayEvents.length > 0
                          ? 'bg-zinc-800 text-white font-extrabold'
                          : 'text-zinc-400'
                      )}
                    >
                      {d.dayNumber}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] text-indigo-400 font-bold font-mono px-1.5 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20">
                        {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
                      </span>
                    )}
                  </div>

                  {/* Day Events List */}
                  <div className="space-y-1.5 mt-2 overflow-hidden">
                    {dayEvents.slice(0, 3).map((evt) => (
                      <div
                        key={evt.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDayData({
                            dateString: d.dateString,
                            dayNumber: d.dayNumber,
                            date: new Date(`${d.dateString}T00:00:00`),
                            events: dayEvents,
                          });
                        }}
                        className={cn(
                          'w-full text-left px-2 py-1 rounded-lg border text-[11px] font-semibold truncate block transition-all hover:scale-[1.02] shadow-sm',
                          getEventBadgeColor(evt.eventType)
                        )}
                        title={evt.title || evt.eventType}
                      >
                        <span>{formatChipText(evt)}</span>
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-[10px] text-indigo-400 pl-1 block font-bold">
                        +{dayEvents.length - 3} more (tap to view)
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
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 hover:bg-zinc-900/40 transition-all rounded-2xl px-3 group"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className={cn('w-3 h-3 rounded-full mt-1.5 flex-shrink-0', eventColors.dot)} />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                            {evt.companyName}
                          </h4>
                          <span
                            className={cn(
                              'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border',
                              getEventBadgeColor(evt.eventType)
                            )}
                          >
                            {EVENT_TYPE_LABELS[evt.eventType as EventType] || evt.eventType.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300 mt-0.5">{evt.title || evt.companyName}</p>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                          {evt.venue && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-emerald-400" />
                              {evt.venue}
                            </span>
                          )}
                          {evt.venue && evt.mode && <span>·</span>}
                          {evt.mode && <span className="capitalize">{evt.mode}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-center">
                      <div className="text-right">
                        <span className="text-xs font-semibold text-zinc-200 font-mono block">
                          {evt.startTime
                            ? new Date(evt.startTime).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Date TBA'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/companies/${evt.companyId}`}
                          className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition-all border border-zinc-800"
                        >
                          View Drive
                        </Link>
                        {evt.startTime && (
                          <a
                            href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(evt.title || 'Placement Event')}&dates=${new Date(evt.startTime).toISOString().replace(/-|:|\.\d+/g, '')}/${new Date(new Date(evt.startTime).getTime() + 3600000).toISOString().replace(/-|:|\.\d+/g, '')}&location=${encodeURIComponent(evt.venue || 'VIT Campus / Online')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 transition-all flex items-center justify-center"
                            title="Add to Google Calendar"
                          >
                            <CalendarIcon className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Interactive Day Schedule Popup Modal (Tasks Drawer) */}
      {selectedDayData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
          onClick={() => setSelectedDayData(null)}
        >
          <div
            className="bg-[#12121c]/95 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-zinc-800/80 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-extrabold text-xl shadow-lg shadow-indigo-500/10">
                  {selectedDayData.dayNumber}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                    {selectedDayData.date.toLocaleDateString('en-IN', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] font-semibold text-indigo-400 font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                      {selectedDayData.events.length} {selectedDayData.events.length === 1 ? 'Placement Event' : 'Placement Events'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedDayData(null)}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Events List for Selected Day */}
            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
              {selectedDayData.events.length === 0 ? (
                <div className="py-10 text-center bg-zinc-950/40 rounded-2xl border border-zinc-800/60 p-6">
                  <CalendarCheck className="w-10 h-10 text-zinc-600 mx-auto mb-2.5" />
                  <p className="text-sm font-bold text-zinc-300">No events scheduled for this date</p>
                  <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">
                    You can schedule PPTs, assessments, or interviews anytime via the AI Assistant chat!
                  </p>
                </div>
              ) : (
                selectedDayData.events.map((evt) => {
                  const eventColors = EVENT_TYPE_COLORS[evt.eventType as EventType] || EVENT_TYPE_COLORS.other;
                  return (
                    <div
                      key={evt.id}
                      className="p-4 bg-zinc-950/70 rounded-2xl border border-zinc-800/80 hover:border-zinc-700 transition-all space-y-3 group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-extrabold text-base">
                            {evt.companyName.charAt(0)}
                          </div>
                          <div>
                            <h4 className="text-sm font-extrabold text-white group-hover:text-indigo-300 transition-colors">
                              {evt.companyName}
                            </h4>
                            <span
                              className={cn(
                                'inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider mt-0.5 border',
                                getEventBadgeColor(evt.eventType)
                              )}
                            >
                              {EVENT_TYPE_LABELS[evt.eventType as EventType] || evt.eventType.replace('_', ' ')}
                            </span>
                          </div>
                        </div>

                        {evt.startTime && (
                          <span className="text-xs font-bold text-zinc-200 font-mono bg-zinc-900 px-2.5 py-1 rounded-xl border border-zinc-800">
                            {new Date(evt.startTime).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-semibold text-zinc-300 pl-0.5">
                        {evt.title || evt.companyName}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 pt-1 border-t border-zinc-900">
                        {evt.venue && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            <span>{evt.venue}</span>
                          </div>
                        )}
                        {evt.mode && evt.mode !== 'unknown' && (
                          <span className="capitalize px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-[11px]">
                            {evt.mode}
                          </span>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-2 flex items-center justify-between gap-2 border-t border-zinc-900">
                        <Link
                          href={`/companies/${evt.companyId}`}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          View Drive Profile
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>

                        {evt.startTime && (
                          <a
                            href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(evt.title || 'Placement Event')}&dates=${new Date(evt.startTime).toISOString().replace(/-|:|\.\d+/g, '')}/${new Date(new Date(evt.startTime).getTime() + 3600000).toISOString().replace(/-|:|\.\d+/g, '')}&location=${encodeURIComponent(evt.venue || 'VIT Campus / Online')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all active:scale-95"
                          >
                            <CalendarIcon className="w-3.5 h-3.5" />
                            Add to Google Calendar
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-2 flex items-center justify-between text-xs text-zinc-500 border-t border-zinc-800/80">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Tap any date to inspect scheduled rounds
              </span>
              <button
                onClick={() => setSelectedDayData(null)}
                className="px-4 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition-all border border-zinc-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
