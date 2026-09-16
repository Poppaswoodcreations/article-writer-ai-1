import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Download, FileText, Code, AlignLeft } from 'lucide-react';

const ICONS = { markdown: FileText, html: Code, txt: AlignLeft };

export const ExportDialog = ({ open, onOpenChange, title, description, options, onExport, disabled, testIdPrefix = 'export', triggerLabel = 'Export' }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogTrigger asChild>
      <Button variant="outline" className="h-10 px-4 rounded-none border-border hover:bg-stone-100 transition-all duration-300 flex items-center gap-2" data-testid={`${testIdPrefix}-button`}>
        <Download className="w-4 h-4" />
        {triggerLabel}
      </Button>
    </DialogTrigger>
    <DialogContent className="rounded-none">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="space-y-3 pt-4">
        {options.map(({ format, label, hint }) => {
          const Icon = ICONS[format];
          return (
            <Button key={format} onClick={() => onExport(format)} disabled={disabled} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 h-12 rounded-none justify-start gap-3" data-testid={`${testIdPrefix}-${format}-button`}>
              <Icon className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">{label}</div>
                <div className="text-xs opacity-70">{hint}</div>
              </div>
            </Button>
          );
        })}
      </div>
    </DialogContent>
  </Dialog>
);
