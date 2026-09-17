import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';

export const OptionToggle = ({ checked, onChange, icon: Icon, title, hint, testId }) => (
  <label className="flex items-start gap-3 border border-border px-3 py-3 cursor-pointer">
    <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} className="rounded-none mt-0.5" data-testid={testId} />
    <span className="text-sm">
      <span className="font-medium flex items-center gap-1"><Icon className="w-3.5 h-3.5" /> {title}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </span>
  </label>
);
