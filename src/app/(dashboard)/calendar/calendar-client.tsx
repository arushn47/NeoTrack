'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  MapPin,
  X,
  Zap,
  CalendarCheck,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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

const toDateStr = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function getBadgeColor(eventType: string) {
  const map: Record<string, string> = {
    ppt: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    online_test: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    coding_test: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    technical_interview: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    hr_interview: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    final_interview: 'bg-green-500/15 text-green-300 border-green-500/30',
    registration_deadline: 'bg-red-500/15 text-red-300 border-red-500/30',
  };
  return map[eventType] || 'bg-zinc-800 text-zinc-300 border-zinc-700';
}

function getDotColor(eventType: string) {
  const map: Record<string, string> = {
    ppt: 'bg-blue-400',
    online_test: 'bg-amber-400',
    coding_test: 'bg-orange-400',
    technical_interview: 'bg-emerald-400',
    hr_interview: 'bg-teal-400',
    final_interview: 'bg-green-400',
    registration_deadline: 'bg-red-400',
  };
  return map[eventType] || 'bg-indigo-400';
}

function formatTime(iso: string) {
  const d = new Date(iso);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function EventCard({ evt, onClose }: { evt: CalendarEvent; onClose?: () => void }) {
  const gcalUrl = evt.startTime
    ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(evt.title || 'Placement Event')}&dates=${new Date(evt.startTime).toISOString().replace(/-|:|\.\d+/g, '')}/${new Date(new Date(evt.startTime).getTime() + 3600000).toISOString().replace(/-|:|\.\d+/g, '')}&location=${encodeURIComponent(evt.venue || 'VIT Campus / Online')}`
    : null;
  return (
    <div className="flex items-start gap-3 p-3.5 bg-zinc-900/70 hover:bg-zinc-900 rounded-2xl border border-zinc-800/70 hover:border-zinc-700 transition-all group">
      <div className={cn('w-1 self-stretch rounded-full flex-shrink-0', getDotColor(evt.eventType))} />
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/25 flex items-center justify-center text-indigo-300 font-extrabold text-base flex-shrink-0">
        {evt.companyName.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors leading-tight truncate">
              {evt.companyName}
            </p>
            <span className={cn('inline-block mt-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border', getBadgeColor(evt.eventType))}>
              {EVENT_TYPE_LABELS[evt.eventType as EventType] || evt.eventType.replace(/_/g, ' ')}
            </span>
          </div>
          {evt.startTime && (
            <span className="text-[11px] font-bold text-zinc-300 font-mono flex-shrink-0 bg-zinc-800/60 px-2 py-1 rounded-lg border border-zinc-700/50">
              {formatTime(evt.startTime)}
            </span>
          )}
        </div>
        {(evt.venue || evt.mode) && (
          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-zinc-500">
            <MapPin className="w-3 h-3 text-emerald-400 flex-shrink-0" />
            <span className="truncate">{[evt.venue, evt.mode !== 'unknown' ? evt.mode : null].filter(Boolean).join(' · ')}</span>
          </div>
        )}
        <div className="flex items-center gap-2 mt-2.5">
          <Link
            href={`/companies/${evt.companyId}`}
            onClick={onClose}
            className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
          >
            View Drive <ExternalLink className="w-3 h-3" />
          </Link>
          {gcalUrl && (
            <a
              href={gcalUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-auto text-[11px] font-semibold text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <CalendarIcon className="w-3 h-3" /> + Calendar
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CalendarClient({ events }: CalendarClientProps) {
  // Compute today on client-side only to avoid SSR/hydration mismatch
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toDateStr(today), [today]);

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(() => toDateStr(new Date()));
  const [modalDateStr, setModalDateStr] = useState<string | null>(null);
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [viewMode, setViewMode] = useState<'month' | 'timeline'>('month');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll and listen for Escape key when modal is open
  useEffect(() => {
    if (!modalDateStr) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalDateStr(null);
    };
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [modalDateStr]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const evt of events) {
      if (evt.startTime) {
        const key = toDateStr(new Date(evt.startTime));
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(evt);
      }
    }
    return map;
  }, [events]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const days: { dayNumber: number; isCurrentMonth: boolean; dateString: string }[] = [];
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      days.push({ dayNumber: d, isCurrentMonth: false, dateString: toDateStr(new Date(year, month - 1, d)) });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ dayNumber: i, isCurrentMonth: true, dateString: toDateStr(new Date(year, month, i)) });
    }
    const total = days.length <= 35 ? 35 : 42;
    for (let i = 1; i <= total - days.length; i++) {
      days.push({ dayNumber: i, isCurrentMonth: false, dateString: toDateStr(new Date(year, month + 1, i)) });
    }
    return days;
  }, [year, month]);

  const weekDays = useMemo(() => {
    // Guard against empty or invalid selectedDateStr (e.g. '' or 'NaN-NaN-NaN')
    const parsed = new Date(selectedDateStr + 'T00:00:00');
    const selected = isNaN(parsed.getTime()) ? new Date() : parsed;
    const startOfWeek = new Date(selected);
    startOfWeek.setDate(selected.getDate() - selected.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return { date: d, dateString: toDateStr(d), dayNumber: d.getDate(), dayName: DAY_SHORT[d.getDay()] };
    });
  }, [selectedDateStr]);

  const selectedDayEvents = useMemo(
    () => (eventsByDate.get(selectedDateStr) || []).sort((a, b) =>
      new Date(a.startTime || 0).getTime() - new Date(b.startTime || 0).getTime()
    ),
    [eventsByDate, selectedDateStr]
  );

  const nowTime = useMemo(() => new Date(), []);
  const upcomingEvents = useMemo(
    () => events.filter((e) => e.startTime && new Date(e.startTime) >= nowTime)
      .sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime()),
    [events, nowTime]
  );
  const pastTimelineEvents = useMemo(
    () => events.filter((e) => !e.startTime || new Date(e.startTime) < nowTime)
      .sort((a, b) => new Date(b.startTime || 0).getTime() - new Date(a.startTime || 0).getTime()),
    [events, nowTime]
  );

  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month - 1, 1));
    } else {
      const d = new Date(selectedDateStr + 'T00:00:00');
      d.setDate(d.getDate() - 7);
      setSelectedDateStr(toDateStr(d));
    }
  };
  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month + 1, 1));
    } else {
      const d = new Date(selectedDateStr + 'T00:00:00');
      d.setDate(d.getDate() + 7);
      setSelectedDateStr(toDateStr(d));
    }
  };
  const handleToday = () => {
    setCurrentDate(today);
    setSelectedDateStr(todayStr);
  };

  return (
    <div className="animate-fade-in max-w-7xl mx-auto selection:bg-indigo-500/20">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <CalendarIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </span>
            Placement Schedule
          </h1>
          <p className="text-xs text-zinc-500 mt-1 ml-1">Tests, PPTs & interviews — all in one place</p>
        </div>
        <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-2xl p-1 gap-1">
          <button onClick={() => setViewMode('month')} className={cn('px-3 py-1.5 rounded-xl text-xs font-bold transition-all', viewMode === 'month' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-zinc-400 hover:text-zinc-200')}>Month</button>
          <button onClick={() => setViewMode('timeline')} className={cn('px-3 py-1.5 rounded-xl text-xs font-bold transition-all', viewMode === 'timeline' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-zinc-400 hover:text-zinc-200')}>Timeline</button>
        </div>
      </div>

      {/* Nav bar */}
      <div className="flex items-center justify-between mb-4 px-1">
        <button onClick={handleToday} className="text-xs font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-xl transition-all hover:bg-indigo-500/15">Today</button>
        <div className="flex items-center gap-2">
          <button onClick={handlePrev} className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-bold text-white min-w-[130px] text-center">
            {viewMode === 'month' ? `${MONTH_NAMES[month]} ${year}` : `${weekDays[0].dayNumber}\u2013${weekDays[6].dayNumber} ${MONTH_NAMES[new Date(selectedDateStr + 'T00:00:00').getMonth()]} ${year}`}
          </span>
          <button onClick={handleNext} className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs">
          {[['bg-blue-400','PPT'],['bg-amber-400','Test'],['bg-emerald-400','Interview']].map(([color, label]) => (
            <span key={label} className="flex items-center gap-1 text-zinc-400"><span className={cn('w-2 h-2 rounded-full', color)} />{label}</span>
          ))}
        </div>
        <div className="sm:hidden w-16" />
      </div>

      {/* Month view */}
      {viewMode === 'month' && (
        <>
          {/* Desktop grid */}
          <div className="hidden md:block bg-[#101018]/90 backdrop-blur-2xl border border-zinc-800/80 rounded-3xl overflow-hidden shadow-2xl shadow-black/30">
            <div className="grid grid-cols-7 border-b border-zinc-800 bg-zinc-950/80 text-center py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider">
              {DAY_SHORT.map((d) => <span key={d}>{d}</span>)}
            </div>
            <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-zinc-800/60">
              {calendarDays.map((d, idx) => {
                const dayEvents = eventsByDate.get(d.dateString) || [];
                const isToday = d.dateString === todayStr;
                const isSelected = d.dateString === modalDateStr;
                return (
                  <div key={idx} onClick={() => dayEvents.length > 0 && setModalDateStr(d.dateString)} className={cn('min-h-[90px] p-2 transition-all', !d.isCurrentMonth && 'opacity-30', isSelected && 'bg-indigo-500/5', dayEvents.length > 0 ? 'cursor-pointer hover:bg-zinc-900/50' : 'cursor-default')}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold', isToday ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-zinc-800')}>{d.dayNumber}</span>
                      {dayEvents.length > 0 && <span className="text-[9px] font-bold text-zinc-500">{dayEvents.length}</span>}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map((evt) => (
                        <div key={evt.id} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold truncate bg-zinc-900/60 border border-zinc-800/30">
                          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', getDotColor(evt.eventType))} />
                          <span className="truncate text-zinc-300">{evt.companyName}</span>
                        </div>
                      ))}
                      {dayEvents.length > 3 && <p className="text-[9px] text-indigo-400 font-bold pl-1">+{dayEvents.length - 3} more</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile: week strip + day list */}
          <div className="md:hidden space-y-4">
            <div className="bg-[#101018]/90 border border-zinc-800/80 rounded-2xl p-3">
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map((wd) => {
                  const dots = (eventsByDate.get(wd.dateString) || []).slice(0, 3);
                  const isToday = wd.dateString === todayStr;
                  const isSelected = wd.dateString === selectedDateStr;
                  return (
                    <button key={wd.dateString} onClick={() => setSelectedDateStr(wd.dateString)} className="flex flex-col items-center gap-1 py-2 rounded-xl">
                      <span className={cn('text-[10px] font-bold uppercase tracking-wider', isToday ? 'text-indigo-400' : 'text-zinc-500')}>{wd.dayName}</span>
                      <span className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm font-extrabold transition-all', isSelected ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40' : isToday ? 'text-indigo-400 border border-indigo-500/40' : 'text-zinc-300 hover:bg-zinc-800')}>{wd.dayNumber}</span>
                      <div className="flex gap-0.5 h-1.5">
                        {dots.map((e, i) => <span key={i} className={cn('w-1.5 h-1.5 rounded-full', getDotColor(e.eventType))} />)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="bg-[#101018]/90 border border-zinc-800/80 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{new Date(selectedDateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long' })}</p>
                  <p className="text-lg font-extrabold text-white">
                    {new Date(selectedDateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                    {selectedDateStr === todayStr && <span className="ml-2 text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full align-middle">Today</span>}
                  </p>
                </div>
                {selectedDayEvents.length > 0 && <span className="text-xs font-bold text-zinc-400 bg-zinc-800/60 border border-zinc-700/50 px-2.5 py-1 rounded-xl">{selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? 's' : ''}</span>}
              </div>
              {selectedDayEvents.length === 0 ? (
                <div className="py-10 text-center">
                  <CalendarCheck className="w-10 h-10 text-zinc-700 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-zinc-500">No events this day</p>
                  <p className="text-xs text-zinc-700 mt-1">Tap another day to see its schedule</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {selectedDayEvents.map((evt) => <EventCard key={evt.id} evt={evt} />)}
                </div>
              )}
            </div>
          </div>

          {/* Desktop: Day detail modal rendered via Portal to cover entire viewport uniformly */}
          {mounted && modalDateStr && createPortal(
            (() => {
              const modalEvents = (eventsByDate.get(modalDateStr) || []).sort((a, b) =>
                new Date(a.startTime || 0).getTime() - new Date(b.startTime || 0).getTime()
              );
              const modalDate = new Date(modalDateStr + 'T00:00:00');
              return (
                <div
                  className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
                  onClick={() => setModalDateStr(null)}
                >
                  <div
                    className="bg-[#0e0e16] border border-zinc-800/90 rounded-3xl w-full max-w-xl shadow-2xl shadow-black/80 overflow-hidden animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Modal Header */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800/80 bg-zinc-950/40">
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 font-extrabold text-lg">
                          {modalDate.getDate()}
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                            {modalDate.toLocaleDateString('en-IN', { weekday: 'long' })}
                          </p>
                          <h3 className="text-base sm:text-lg font-extrabold text-white leading-tight">
                            {modalDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-[11px] font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full">
                          {modalEvents.length} {modalEvents.length === 1 ? 'event' : 'events'}
                        </span>
                        <button
                          onClick={() => setModalDateStr(null)}
                          className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                          aria-label="Close"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    {/* Event cards */}
                    <div className="p-5 space-y-2.5 max-h-[60vh] overflow-y-auto">
                      {modalEvents.map((evt) => (
                        <EventCard key={evt.id} evt={evt} onClose={() => setModalDateStr(null)} />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })(),
            document.body
          )}
        </>
      )}

      {/* Timeline view */}
      {viewMode === 'timeline' && (
        <div className="bg-[#101018]/90 backdrop-blur-2xl border border-zinc-800/80 rounded-3xl p-5 sm:p-6 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Upcoming</span>
              <span className="text-[10px] text-zinc-600 font-mono bg-zinc-800/60 px-2 py-0.5 rounded-full border border-zinc-700/50">{upcomingEvents.length}</span>
            </div>
            {upcomingEvents.length === 0 ? (
              <div className="py-10 text-center bg-zinc-900/30 rounded-2xl border border-zinc-800/50">
                <CalendarCheck className="w-10 h-10 text-zinc-700 mx-auto mb-2" />
                <p className="text-sm font-semibold text-zinc-500">No upcoming events</p>
                <p className="text-xs text-zinc-700 mt-1">You&apos;ll appear here when shortlisted for new rounds</p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map((evt) => <EventCard key={evt.id} evt={evt} />)}
              </div>
            )}
          </div>
          {pastTimelineEvents.length > 0 && (
            <div className="border-t border-zinc-800/60 pt-5">
              <button onClick={() => setShowPastEvents((v) => !v)} className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800/60 hover:border-zinc-700 transition-all group">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                  <span className="text-xs font-bold text-zinc-600 group-hover:text-zinc-400 uppercase tracking-wider transition-colors">Past Events</span>
                  <span className="text-[10px] font-mono text-zinc-700 bg-zinc-800/80 border border-zinc-700/50 px-2 py-0.5 rounded-full">{pastTimelineEvents.length}</span>
                </div>
                <ChevronDown className={cn('w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-all duration-300', showPastEvents ? 'rotate-180' : '')} />
              </button>
              {showPastEvents && (
                <div className="mt-3 space-y-2 animate-fade-in">
                  {pastTimelineEvents.map((evt) => (
                    <div key={evt.id} className="opacity-40 hover:opacity-70 transition-opacity">
                      <EventCard evt={evt} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
