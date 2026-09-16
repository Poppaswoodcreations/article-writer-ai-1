import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarDays, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek } from 'date-fns';
import { PLATFORM_META } from '@/lib/platforms';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DayCell = ({ day, month, events, selected, onSelect }) => {
  const inMonth = isSameMonth(day, month);
  return (
    <button type="button" onClick={() => onSelect(day)}
      className={`min-h-[96px] p-2 text-left border-b border-r border-border flex flex-col gap-1 transition-colors hover:bg-stone-50 ${inMonth ? 'bg-card' : 'bg-muted/40 text-muted-foreground'} ${selected ? 'ring-2 ring-inset ring-accent' : ''}`}
      data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}>
      <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center ${isToday(day) ? 'bg-primary text-primary-foreground' : ''}`}>{format(day, 'd')}</span>
      <div className="flex flex-wrap gap-1 mt-auto">
        {events.slice(0, 6).map((e, i) => <span key={`${e.campaign_id}-${e.platform}-${i}`} title={`${PLATFORM_META[e.platform]?.label} · ${e.campaign_name}`} className={`w-2.5 h-2.5 ${PLATFORM_META[e.platform]?.color || 'bg-stone-500'}`} data-testid="calendar-dot" />)}
        {events.length > 6 && <span className="text-[10px] text-muted-foreground">+{events.length - 6}</span>}
      </div>
    </button>
  );
};

const DayDetails = ({ day, events, navigate }) => (
  <div className="border border-border bg-card p-5" data-testid="calendar-day-details">
    <h3 className="text-base font-medium mb-3">{format(day, 'EEEE, MMMM d')}</h3>
    {events.length === 0 ? (
      <p className="text-sm text-muted-foreground" data-testid="calendar-day-empty">Nothing scheduled this day.</p>
    ) : (
      <ul className="space-y-3">
        {events.map((e, i) => (
          <li key={`${e.campaign_id}-${e.platform}-${i}`} className="flex items-start gap-3" data-testid={`calendar-event-${e.platform}`}>
            <span className={`mt-1.5 w-2.5 h-2.5 shrink-0 ${PLATFORM_META[e.platform]?.color || 'bg-stone-500'}`} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{format(new Date(e.scheduled_at), 'HH:mm')} · {PLATFORM_META[e.platform]?.label || e.platform}</div>
              <div className="text-xs text-muted-foreground truncate">{e.campaign_name} — {e.excerpt}</div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate(`/campaigns/${e.campaign_id}`)} className="h-8 px-2 rounded-none gap-1 text-xs" data-testid={`calendar-open-${e.platform}`}>Open <ArrowUpRight className="w-3 h-3" /></Button>
          </li>
        ))}
      </ul>
    )}
  </div>
);

export const CampaignCalendar = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    axios.get(`${API}/schedule`).then((r) => {
      setEvents(r.data);
      if (r.data.length && !r.data.some((e) => isSameMonth(new Date(e.scheduled_at), new Date()))) setMonth(startOfMonth(new Date(r.data[0].scheduled_at)));
    }).catch(() => toast.error('Failed to load schedule'));
  }, []);

  const days = useMemo(() => eachDayOfInterval({ start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) }), [month]);
  const eventsOn = (day) => events.filter((e) => isSameDay(new Date(e.scheduled_at), day));
  const monthCount = events.filter((e) => isSameMonth(new Date(e.scheduled_at), month)).length;

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6" data-testid="campaign-calendar">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-normal" data-testid="calendar-month-label">{format(month, 'MMMM yyyy')}</h2>
            <span className="text-xs text-muted-foreground" data-testid="calendar-month-count">{monthCount} post{monthCount === 1 ? '' : 's'}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setMonth(addMonths(month, -1))} className="h-9 w-9 p-0 rounded-none" data-testid="calendar-prev"><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setMonth(startOfMonth(new Date()))} className="h-9 px-3 rounded-none text-xs" data-testid="calendar-today">Today</Button>
            <Button variant="outline" size="sm" onClick={() => setMonth(addMonths(month, 1))} className="h-9 w-9 p-0 rounded-none" data-testid="calendar-next"><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
        <div className="grid grid-cols-7 border-t border-l border-border">
          {WEEKDAYS.map((d) => <div key={d} className="text-[11px] uppercase tracking-widest text-muted-foreground px-2 py-2 border-b border-r border-border bg-muted">{d}</div>)}
          {days.map((day) => <DayCell key={day.toISOString()} day={day} month={month} events={eventsOn(day)} selected={selected && isSameDay(day, selected)} onSelect={setSelected} />)}
        </div>
        <div className="flex flex-wrap gap-4 mt-4">
          {Object.entries(PLATFORM_META).filter(([k]) => k !== 'email').map(([k, m]) => <span key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={`w-2.5 h-2.5 ${m.color}`} />{m.label}</span>)}
        </div>
      </div>
      <div>
        {selected ? <DayDetails day={selected} events={eventsOn(selected)} navigate={navigate} /> : (
          <div className="border border-dashed border-border p-5 text-sm text-muted-foreground" data-testid="calendar-hint">Click a day to see its posts. Dots are colored by platform.</div>
        )}
      </div>
    </div>
  );
};
