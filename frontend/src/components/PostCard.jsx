import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Download, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { PLATFORM_META, downloadText } from '@/lib/platforms';

export const PostCard = ({ platform, value, hashtags, onChange, onHashtagsChange, slug }) => {
  const meta = PLATFORM_META[platform] || { label: platform, color: 'bg-stone-500' };
  const fullText = hashtags !== undefined ? `${value}\n\n${hashtags}`.trim() : value;

  const copy = async () => {
    await navigator.clipboard.writeText(fullText);
    toast.success(`${meta.label} post copied`);
  };

  return (
    <Card className="bg-card border border-border shadow-sm rounded-none p-6" data-testid={`post-card-${platform}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className={`w-2.5 h-2.5 ${meta.color}`} />
          <h3 className="text-lg font-medium">{meta.label}</h3>
          <span className="text-xs text-muted-foreground">{value.length} chars</span>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={copy} className="h-9 px-3 rounded-none hover:bg-stone-100 gap-2" data-testid={`copy-post-${platform}`}><Copy className="w-4 h-4" /> Copy</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => downloadText(fullText, `${slug}-${platform}.txt`)} className="h-9 px-3 rounded-none gap-2" data-testid={`download-post-${platform}`}><Download className="w-4 h-4" /> Download</Button>
        </div>
      </div>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} className="min-h-[180px] rounded-none border-input" style={{ lineHeight: '1.7' }} data-testid={`post-content-${platform}`} />
      {hashtags !== undefined && (
        <Input value={hashtags} onChange={(e) => onHashtagsChange(e.target.value)} placeholder="#hashtags" className="mt-3 h-10 rounded-none font-mono text-sm" data-testid={`post-hashtags-${platform}`} />
      )}
    </Card>
  );
};
