import React, { useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CalendarDays, Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { PLATFORM_META, downloadText } from '@/lib/platforms';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const SchedulePanel = ({ campaignId, posts, unsaved }) => {
  const [busy, setBusy] = useState(false);
  const scheduled = posts.filter((p) => p.scheduled_at).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));

  const download = async (fmt) => {
    try {
      setBusy(true);
      const { data } = await axios.get(`${API}/campaigns/${campaignId}/schedule/${fmt}`);
      downloadText(data.content, data.filename);
      toast.success(`Schedule downloaded (${fmt.toUpperCase()})`);
    } catch {
      toast.error('Failed to download schedule');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="bg-card border border-border shadow-sm rounded-none p-6" data-testid="schedule-panel">
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-5 h-5 text-accent" />
          <h3 className="text-lg font-medium">Publishing Schedule</h3>
          <span className="text-xs text-muted-foreground" data-testid="schedule-count">{scheduled.length}/{posts.length} posts scheduled</span>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => download('csv')} disabled={busy || !scheduled.length} className="h-9 px-3 rounded-none gap-2" data-testid="schedule-download-csv">
            <FileSpreadsheet className="w-4 h-4" /> CSV
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => download('ics')} disabled={busy || !scheduled.length} className="h-9 px-3 rounded-none gap-2" data-testid="schedule-download-ics">
            <Download className="w-4 h-4" /> Calendar (.ics)
          </Button>
        </div>
      </div>
      {unsaved && scheduled.length > 0 && <p className="text-xs text-amber-700 mb-3" data-testid="schedule-unsaved-hint">Save the campaign to include your latest dates in the download.</p>}
      {scheduled.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="schedule-empty">Use the <span className="font-medium">Schedule</span> button on each post to pick a publish date and time.</p>
      ) : (
        <ol className="relative border-l border-border ml-2 space-y-4" data-testid="schedule-list">
          {scheduled.map((p) => (
            <li key={p.platform} className="ml-5" data-testid={`schedule-item-${p.platform}`}>
              <span className={`absolute -left-[5px] mt-1.5 w-2.5 h-2.5 ${PLATFORM_META[p.platform]?.color || 'bg-stone-500'}`} />
              <div className="text-sm font-medium">{format(new Date(p.scheduled_at), 'EEE, MMM d · HH:mm')}</div>
              <div className="text-xs text-muted-foreground">{PLATFORM_META[p.platform]?.label || p.platform} · {p.content.slice(0, 80)}{p.content.length > 80 ? '…' : ''}</div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
};
