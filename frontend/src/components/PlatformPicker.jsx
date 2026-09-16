import React from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { PLATFORM_META } from '@/lib/platforms';

const Option = ({ id, label, checked, onToggle, disabled }) => (
  <label className={`flex items-center gap-3 border px-4 py-3 cursor-pointer transition-colors ${checked ? 'border-accent bg-accent/5' : 'border-border hover:bg-stone-50'}`}>
    <Checkbox checked={checked} onCheckedChange={onToggle} disabled={disabled} className="rounded-none" data-testid={`platform-checkbox-${id}`} />
    <span className="text-sm font-medium">{label}</span>
  </label>
);

export const PlatformPicker = ({ platforms, selected, onToggle, includeEmail, onEmailChange, disabled }) => (
  <div>
    <Label className="text-base font-medium">Platforms</Label>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3" data-testid="platform-checkboxes">
      {platforms.map((p) => (
        <Option key={p} id={p} label={PLATFORM_META[p].label} checked={selected.includes(p)} onToggle={() => onToggle(p)} disabled={disabled} />
      ))}
      <Option id="email" label="Email blast" checked={includeEmail} onToggle={(v) => onEmailChange(!!v)} disabled={disabled} />
    </div>
  </div>
);
