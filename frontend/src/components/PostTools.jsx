import React, { useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { RefreshCw, Loader2, CalendarClock, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const RegeneratePopover = ({ campaignId, platform, onDone }) => {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    try {
      setBusy(true);
      const { data } = await axios.post(`${API}/campaigns/${campaignId}/posts/${platform}/regenerate`, { instruction });
      onDone(data);
      toast.success('Post rewritten');
      setOpen(false);
      setInstruction('');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to regenerate');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-9 px-3 rounded-none hover:bg-stone-100 gap-2" data-testid={`regenerate-post-${platform}`}>
          <RefreshCw className="w-4 h-4" /> Regenerate
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 rounded-none p-4 space-y-3" align="end">
        <p className="text-sm font-medium">How should this post change?</p>
        <Input value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder='e.g. "shorter and funnier"' disabled={busy}
          onKeyDown={(e) => { if (e.key === 'Enter') run(); }} className="h-10 rounded-none" data-testid={`regenerate-instruction-${platform}`} />
        <Button type="button" onClick={run} disabled={busy} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-10 rounded-none gap-2" data-testid={`regenerate-submit-${platform}`}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Rewrite this post
        </Button>
      </PopoverContent>
    </Popover>
  );
};

const toLocalTime = (iso) => (iso ? format(new Date(iso), 'HH:mm') : '09:00');

export const SchedulePicker = ({ platform, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const date = value ? new Date(value) : undefined;
  const time = toLocalTime(value);

  const apply = (day, hhmm) => {
    if (!day) return onChange(null);
    const [h, m] = (hhmm || '09:00').split(':').map(Number);
    const d = new Date(day);
    d.setHours(h, m, 0, 0);
    onChange(d.toISOString());
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant={value ? 'secondary' : 'ghost'} size="sm" className="h-9 px-3 rounded-none gap-2" data-testid={`schedule-post-${platform}`}>
          <CalendarClock className="w-4 h-4" />
          {value ? format(new Date(value), 'MMM d, HH:mm') : 'Schedule'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto rounded-none p-3" align="end">
        <Calendar mode="single" selected={date} onSelect={(d) => apply(d, time)} initialFocus data-testid={`schedule-calendar-${platform}`} />
        <div className="flex items-center gap-2 mt-2">
          <Input type="time" value={time} onChange={(e) => apply(date || new Date(), e.target.value)} className="h-9 rounded-none" data-testid={`schedule-time-${platform}`} />
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => { onChange(null); setOpen(false); }} className="h-9 rounded-none gap-1" data-testid={`schedule-clear-${platform}`}>
              <X className="w-4 h-4" /> Clear
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
