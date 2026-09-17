import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, Loader2, Megaphone } from 'lucide-react';
import { ExportDialog } from '@/components/ExportDialog';

const EXPORT_OPTIONS = [
  { format: 'markdown', label: 'Markdown', hint: 'Plain text with markdown formatting' },
  { format: 'html', label: 'HTML', hint: 'Full HTML document with SEO meta tags' },
  { format: 'txt', label: 'Plain Text', hint: 'Ready to paste anywhere' },
  { format: 'docx', label: 'Word (DOCX)', hint: 'Editable document with headings and images' },
  { format: 'pdf', label: 'PDF', hint: 'Print-ready, images embedded' },
];

export const ArticleHeader = ({ saving, exporting, onBack, onSave, onExport, onPromote }) => {
  const [exportOpen, setExportOpen] = useState(false);

  const handleExport = async (format) => {
    if (await onExport(format)) setExportOpen(false);
  };

  return (
    <header className="border-b border-border bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-6 md:px-12 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} className="hover:bg-stone-100 h-10 px-3 rounded-none transition-all duration-300" data-testid="back-button">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-medium tracking-tight text-primary" data-testid="editor-title">Edit Article</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onPromote} className="h-10 px-4 rounded-none border-border hover:bg-stone-100 gap-2" data-testid="promote-campaign-button">
            <Megaphone className="w-4 h-4" /> Promote as Campaign
          </Button>
          <ExportDialog open={exportOpen} onOpenChange={setExportOpen} title="Export Article" description="Choose a format to download your article" options={EXPORT_OPTIONS} onExport={handleExport} disabled={exporting} />
          <Button onClick={onSave} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent/90 h-10 px-6 rounded-none font-medium transition-all duration-300 flex items-center gap-2" data-testid="save-button">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </Button>
        </div>
      </div>
    </header>
  );
};
