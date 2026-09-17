import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, Loader2, Presentation, FolderDown } from 'lucide-react';
import { ExportDialog } from '@/components/ExportDialog';
import { BulkGraphicsDialog } from '@/components/BulkGraphicsDialog';

const EXPORT_OPTIONS = [
  { format: 'txt', label: 'Plain Text', hint: 'Ready to paste into Facebook, TikTok, etc.' },
  { format: 'markdown', label: 'Markdown', hint: 'Formatted with headings per platform' },
  { format: 'html', label: 'HTML', hint: 'Web page with every post' },
];

const BusyIcon = ({ busy, icon: Icon }) => (busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />);

export const CampaignHeader = ({ id, campaign, busy, onBack, onSave, onExport, onDeck, onZip, onPostsUpdated }) => {
  const [exportOpen, setExportOpen] = useState(false);
  const graphicCount = campaign.posts.filter((p) => p.graphic_path).length;

  const handleExport = async (format) => {
    await onExport(format);
    setExportOpen(false);
  };

  return (
    <header className="border-b border-border bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-6 md:px-12 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} className="hover:bg-stone-100 h-10 px-3 rounded-none" data-testid="back-button"><ArrowLeft className="w-5 h-5" /></Button>
          <h1 className="text-xl font-medium tracking-tight text-primary" data-testid="campaign-editor-title">Edit Campaign</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <BulkGraphicsDialog campaignId={id} posts={campaign.posts} imagePaths={campaign.image_paths || []} onDone={onPostsUpdated} />
          <Button variant="outline" onClick={onZip} disabled={busy.zip || !graphicCount} title={graphicCount ? `${graphicCount} graphics` : 'Create graphics first'} className="h-10 px-4 rounded-none border-border hover:bg-stone-100 gap-2" data-testid="graphics-zip-button">
            <BusyIcon busy={busy.zip} icon={FolderDown} /> Graphics ZIP{graphicCount ? ` (${graphicCount})` : ''}
          </Button>
          <Button variant="outline" onClick={onDeck} disabled={busy.deck} className="h-10 px-4 rounded-none border-border hover:bg-stone-100 gap-2" data-testid="campaign-deck-button">
            <BusyIcon busy={busy.deck} icon={Presentation} /> Deck (PDF)
          </Button>
          <ExportDialog open={exportOpen} onOpenChange={setExportOpen} title="Export Campaign" description="Download every post in one file" options={EXPORT_OPTIONS} onExport={handleExport} disabled={busy.export} testIdPrefix="campaign-export" triggerLabel="Export All" />
          <Button onClick={onSave} disabled={busy.save} className="bg-accent text-accent-foreground hover:bg-accent/90 h-10 px-6 rounded-none gap-2" data-testid="campaign-save-button">
            <BusyIcon busy={busy.save} icon={Save} /> Save
          </Button>
        </div>
      </div>
    </header>
  );
};
