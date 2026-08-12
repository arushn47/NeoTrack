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
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
      // Local date YYYY-MM-DD
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

  const [selectedEventType, setSelectedEventType] = useState<'all' | 'test' | 'interview' | 'ppt' | 'deadline'>('all');

  // Filter events by selected category
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

  // Events map by YYYY-MM-DD
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
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'online_test':
      case 'coding_test':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'technical_interview':
      case 'hr_interview':
      case 'final_interview':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'registration_deadline':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      default:
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Month Nav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Placement Calendar</h1>
          <p className="text-sm text-text-secondary mt-1">
            Scheduled PPTs, online assessments, interviews, and deadlines.
          </p>
        </div>

        {/* Month Selector Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleToday}
            className="px-3 py-1.5 rounded-xl bg-bg-surface border border-border-default hover:bg-bg-surface-hover text-xs font-semibold text-text-secondary hover:text-text-primary transition-all"
          >
            Today
          </button>

          <div className="flex items-center gap-1 bg-bg-surface border border-border-default rounded-xl p-1">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-bg-surface-hover text-text-secondary hover:text-text-primary transition-all"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-text-primary px-3 min-w-[140px] text-center">
              {monthNames[month]} {year}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-bg-surface-hover text-text-secondary hover:text-text-primary transition-all"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Event Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
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
                  'px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all',
                  isSelected
                    ? 'bg-accent text-white shadow-sm shadow-accent/20'
                    : 'bg-bg-surface hover:bg-bg-surface-hover text-text-secondary hover:text-text-primary border border-border-default'
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Legend dots */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            PPT
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Test
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Interview
          </span>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="bg-bg-surface border border-border-default rounded-2xl overflow-hidden shadow-sm">
        {/* Day of Week Headers */}
        <div className="grid grid-cols-7 border-b border-border-default bg-bg-elevated/40 text-center py-2.5 text-xs font-semibold text-text-tertiary uppercase tracking-wider">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-border-default/60">
          {calendarDays.map((d, index) => {
            const dayEvents = eventsByDate.get(d.dateString) || [];
            const isToday = d.dateString === todayStr;

            return (
              <div
                key={index}
                className={cn(
                  'min-h-[110px] p-2 flex flex-col justify-between transition-colors',
                  d.isCurrentMonth ? 'bg-bg-surface hover:bg-bg-surface-hover/50' : 'bg-bg-elevated/20 opacity-40',
                  isToday && 'ring-2 ring-inset ring-accent/60 bg-accent/5'
                )}
              >
                {/* Date Number Header */}
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'text-xs font-semibold w-6 h-6 rounded-full flex items-center justify-center',
                      isToday ? 'bg-accent text-white' : 'text-text-secondary'
                    )}
                  >
                    {d.dayNumber}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="text-[10px] text-text-tertiary font-medium">
                      {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
                    </span>
                  )}
                </div>

                {/* Day Events List */}
                <div className="space-y-1 mt-1.5 overflow-hidden">
                  {dayEvents.slice(0, 3).map((evt) => (
                    <button
                      key={evt.id}
                      onClick={() => setSelectedEvent(evt)}
                      className={cn(
                        'w-full text-left px-2 py-1 rounded-md border text-[11px] font-medium truncate block transition-transform hover:scale-[1.02]',
                        getEventBadgeColor(evt.eventType)
                      )}
                    >
                      <span className="font-bold mr-1">{evt.companyName}:</span>
                      <span>{evt.title || evt.eventType}</span>
                    </button>
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-[10px] text-text-tertiary pl-1 block font-medium">
                      +{dayEvents.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Event Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-bg-surface border border-border-default rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent font-bold">
                  {selectedEvent.companyName.charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-primary">{selectedEvent.companyName}</h3>
                  <span
                    className={cn(
                      'inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mt-0.5 border',
                      getEventBadgeColor(selectedEvent.eventType)
                    )}
                  >
                    {selectedEvent.eventType.replace('_', ' ')}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 rounded-lg text-text-tertiary hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 pt-2 text-xs">
              <h4 className="text-sm font-semibold text-text-primary">{selectedEvent.title}</h4>

              {selectedEvent.startTime && (
                <div className="flex items-center gap-2 text-text-secondary">
                  <Clock className="w-4 h-4 text-text-tertiary" />
                  <span>
                    {new Date(selectedEvent.startTime).toLocaleString('en-IN', {
                      dateStyle: 'full',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
              )}

              {selectedEvent.venue && (
                <div className="flex items-center gap-2 text-text-secondary">
                  <MapPin className="w-4 h-4 text-text-tertiary" />
                  <span>{selectedEvent.venue}</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-border-default flex items-center justify-between">
              <Link
                href={`/companies/${selectedEvent.companyId}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
              >
                View Company Profile
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>

              <button
                onClick={() => setSelectedEvent(null)}
                className="px-3 py-1.5 rounded-xl bg-bg-elevated hover:bg-bg-surface-hover text-xs font-medium text-text-secondary"
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
