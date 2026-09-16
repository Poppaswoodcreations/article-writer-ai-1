import React, { useRef, useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ImageIcon, Loader2, Download, Sparkles, Upload, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { PLATFORM_META } from '@/lib/platforms';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const SIZE_LABEL = { facebook: '1200×630', instagram: '1080×1080', linkedin: '1200×627', twitter: '1600×900', tiktok: '1080×1920' };

const firstSentence = (text) => (text.replace(/\[[^\]]*\]/g, '').trim().split(/(?<=[.!?])\s+/)[0] || '').slice(0, 110);

const downloadUrl = async (url, filename) => {
  const res = await fetch(url);
  const blob = await res.blob();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

export const GraphicDialog = ({ campaignId, platform, post, imagePaths, onCreated }) => {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState(imagePaths);
  const [selected, setSelected] = useState(imagePaths[0] || '');
  const [headline, setHeadline] = useState(firstSentence(post.content));
  const [handle, setHandle] = useState('');
  const [aiEnhance, setAiEnhance] = useState(false);
  const [useBrand, setUseBrand] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const meta = PLATFORM_META[platform] || { label: platform };
  const graphicUrl = post.graphic_path ? `${BACKEND_URL}/api/files/${post.graphic_path}` : null;

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await axios.post(`${API}/upload-image`, formData);
      const path = data.url.replace('/api/files/', '');
      setImages((prev) => [...prev, path]);
      setSelected(path);
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const generate = async () => {
    if (!selected) return toast.error('Pick or upload an image first');
    if (!headline.trim()) return toast.error('Add a headline');
    try {
      setBusy(true);
      const { data } = await axios.post(`${API}/campaigns/${campaignId}/posts/${platform}/graphic`, { image_path: selected, headline, handle: handle || null, ai_enhance: aiEnhance, use_brand: useBrand });
      onCreated(data.path);
      toast.success('Graphic ready');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create graphic');
    } finally {
      setBusy(false);
    }
  };

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
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Base image</Label>
              <div className="grid grid-cols-3 gap-2 mt-2" data-testid="graphic-image-choices">
                {images.map((p) => (
                  <button key={p} type="button" onClick={() => setSelected(p)} className={`aspect-square overflow-hidden border-2 ${selected === p ? 'border-accent' : 'border-transparent'}`} data-testid={`graphic-image-option`}>
                    <img src={`${BACKEND_URL}/api/files/${p}`} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" id={`gfx-upload-${platform}`} onChange={upload} data-testid={`graphic-upload-input-${platform}`} />
                <label htmlFor={`gfx-upload-${platform}`} className="aspect-square border-2 border-dashed border-border flex flex-col items-center justify-center text-xs text-muted-foreground cursor-pointer hover:bg-stone-50">
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5 mb-1" />}
                  Upload
                </label>
              </div>
            </div>
            <div>
              <Label htmlFor={`headline-${platform}`} className="text-sm font-medium">Headline on image</Label>
              <Textarea id={`headline-${platform}`} value={headline} onChange={(e) => setHeadline(e.target.value)} className="mt-1 min-h-[80px] rounded-none" data-testid={`graphic-headline-${platform}`} />
            </div>
            <div>
              <Label htmlFor={`handle-${platform}`} className="text-sm font-medium">Handle / footer (optional)</Label>
              <Input id={`handle-${platform}`} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Leave empty to use Brand Kit handle" className="mt-1 h-10 rounded-none" data-testid={`graphic-handle-${platform}`} />
            </div>
            <label className="flex items-start gap-3 border border-border px-3 py-3 cursor-pointer">
              <Checkbox checked={useBrand} onCheckedChange={(v) => setUseBrand(!!v)} className="rounded-none mt-0.5" data-testid={`graphic-use-brand-${platform}`} />
              <span className="text-sm"><span className="font-medium flex items-center gap-1"><Palette className="w-3.5 h-3.5" /> Apply Brand Kit</span><span className="text-xs text-muted-foreground">Your accent color, handle and logo (set up under Brand Kit)</span></span>
            </label>
            <label className="flex items-start gap-3 border border-border px-3 py-3 cursor-pointer">
              <Checkbox checked={aiEnhance} onCheckedChange={(v) => setAiEnhance(!!v)} className="rounded-none mt-0.5" data-testid={`graphic-ai-enhance-${platform}`} />
              <span className="text-sm"><span className="font-medium flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> AI enhance</span><span className="text-xs text-muted-foreground">Restyle the photo into a polished ad visual first (uses credits, ~30s)</span></span>
            </label>
            <Button type="button" onClick={generate} disabled={busy} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-11 rounded-none gap-2" data-testid={`graphic-generate-${platform}`}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />} {busy ? (aiEnhance ? 'Enhancing & rendering...' : 'Rendering...') : 'Generate Graphic'}
            </Button>
          </div>
          <div className="space-y-3">
            <Label className="text-sm font-medium">Result</Label>
            <div className="bg-muted border border-border flex items-center justify-center min-h-[240px]" data-testid={`graphic-preview-${platform}`}>
              {graphicUrl ? <img src={graphicUrl} alt={`${meta.label} graphic`} className="max-h-[420px] w-auto max-w-full" data-testid={`graphic-image-${platform}`} /> : <span className="text-xs text-muted-foreground">Your graphic will appear here</span>}
            </div>
            {graphicUrl && (
              <Button type="button" variant="outline" onClick={() => downloadUrl(graphicUrl, `${platform}-graphic.png`)} className="w-full h-10 rounded-none gap-2" data-testid={`graphic-download-${platform}`}>
                <Download className="w-4 h-4" /> Download PNG
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
