import React, { useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ImageIcon, Loader2, Download, Sparkles, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { PLATFORM_META } from '@/lib/platforms';
import { ImagePicker, useImagePicker, fileUrl } from '@/components/ImagePicker';
import { OptionToggle } from '@/components/OptionToggle';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const SIZE_LABEL = { facebook: '1200×630', instagram: '1080×1080', linkedin: '1200×627', twitter: '1600×900', tiktok: '1080×1920' };

const firstSentence = (text) => (text.replace(/\[[^\]]*\]/g, '').trim().split(/(?<=[.!?])\s+/)[0] || '').slice(0, 110);

const downloadUrl = async (url, filename) => {
  const blob = await (await fetch(url)).blob();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

const generateLabel = (busy, aiEnhance) => {
  if (!busy) return 'Generate Graphic';
  return aiEnhance ? 'Enhancing & rendering...' : 'Rendering...';
};

const GraphicResult = ({ platform, graphicUrl, label }) => (
  <div className="space-y-3">
    <Label className="text-sm font-medium">Result</Label>
    <div className="bg-muted border border-border flex items-center justify-center min-h-[240px]" data-testid={`graphic-preview-${platform}`}>
      {graphicUrl ? <img src={graphicUrl} alt={`${label} graphic`} className="max-h-[420px] w-auto max-w-full" data-testid={`graphic-image-${platform}`} /> : <span className="text-xs text-muted-foreground">Your graphic will appear here</span>}
    </div>
    {graphicUrl && (
      <Button type="button" variant="outline" onClick={() => downloadUrl(graphicUrl, `${platform}-graphic.png`)} className="w-full h-10 rounded-none gap-2" data-testid={`graphic-download-${platform}`}>
        <Download className="w-4 h-4" /> Download PNG
      </Button>
    )}
  </div>
);

const GraphicForm = ({ campaignId, platform, post, picker, onCreated }) => {
  const [headline, setHeadline] = useState(firstSentence(post.content));
  const [handle, setHandle] = useState('');
  const [aiEnhance, setAiEnhance] = useState(false);
  const [useBrand, setUseBrand] = useState(true);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    if (!picker.selected) return toast.error('Pick or upload an image first');
    if (!headline.trim()) return toast.error('Add a headline');
    try {
      setBusy(true);
      const { data } = await axios.post(`${API}/campaigns/${campaignId}/posts/${platform}/graphic`, { image_path: picker.selected, headline, handle: handle || null, ai_enhance: aiEnhance, use_brand: useBrand });
      onCreated(data.path);
      toast.success('Graphic ready');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create graphic');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <ImagePicker picker={picker} inputId={`gfx-upload-${platform}`} testIdPrefix="graphic" />
      <div>
        <Label htmlFor={`headline-${platform}`} className="text-sm font-medium">Headline on image</Label>
        <Textarea id={`headline-${platform}`} value={headline} onChange={(e) => setHeadline(e.target.value)} className="mt-1 min-h-[80px] rounded-none" data-testid={`graphic-headline-${platform}`} />
      </div>
      <div>
        <Label htmlFor={`handle-${platform}`} className="text-sm font-medium">Handle / footer (optional)</Label>
        <Input id={`handle-${platform}`} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Leave empty to use Brand Kit handle" className="mt-1 h-10 rounded-none" data-testid={`graphic-handle-${platform}`} />
      </div>
      <OptionToggle checked={useBrand} onChange={setUseBrand} icon={Palette} title="Apply Brand Kit" hint="Your accent color, handle and logo (set up under Brand Kit)" testId={`graphic-use-brand-${platform}`} />
      <OptionToggle checked={aiEnhance} onChange={setAiEnhance} icon={Sparkles} title="AI enhance" hint="Restyle the photo into a polished ad visual first (uses credits, ~30s)" testId={`graphic-ai-enhance-${platform}`} />
      <Button type="button" onClick={generate} disabled={busy} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-11 rounded-none gap-2" data-testid={`graphic-generate-${platform}`}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />} {generateLabel(busy, aiEnhance)}
      </Button>
    </div>
  );
};

export const GraphicDialog = ({ campaignId, platform, post, imagePaths, onCreated }) => {
  const [open, setOpen] = useState(false);
  const picker = useImagePicker(imagePaths);
  const meta = PLATFORM_META[platform] || { label: platform };
  const graphicUrl = post.graphic_path ? fileUrl(post.graphic_path) : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={post.graphic_path ? 'secondary' : 'ghost'} size="sm" className="h-9 px-3 rounded-none gap-2" data-testid={`graphic-post-${platform}`}>
          <ImageIcon className="w-4 h-4" /> {post.graphic_path ? 'Graphic' : 'Create Graphic'}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-none max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{meta.label} Graphic · {SIZE_LABEL[platform] || ''}</DialogTitle>
          <DialogDescription>Overlay your headline on an image, sized for {meta.label}</DialogDescription>
        </DialogHeader>
        <div className="grid md:grid-cols-2 gap-6 pt-2">
          <GraphicForm campaignId={campaignId} platform={platform} post={post} picker={picker} onCreated={onCreated} />
          <GraphicResult platform={platform} graphicUrl={graphicUrl} label={meta.label} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
