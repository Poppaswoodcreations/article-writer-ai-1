import React, { useRef, useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Images, Loader2, Sparkles, Upload, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { PLATFORM_META } from '@/lib/platforms';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Toggle = ({ checked, onChange, icon: Icon, title, hint, testId }) => (
  <label className="flex items-start gap-3 border border-border px-3 py-3 cursor-pointer">
    <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} className="rounded-none mt-0.5" data-testid={testId} />
    <span className="text-sm"><span className="font-medium flex items-center gap-1"><Icon className="w-3.5 h-3.5" /> {title}</span><span className="text-xs text-muted-foreground">{hint}</span></span>
  </label>
);

export const BulkGraphicsDialog = ({ campaignId, posts, imagePaths, onDone }) => {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState(imagePaths);
  const [selected, setSelected] = useState(imagePaths[0] || '');
  const [handle, setHandle] = useState('');
  const [useBrand, setUseBrand] = useState(true);
  const [aiEnhance, setAiEnhance] = useState(false);
  const [overwrite, setOverwrite] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const existing = posts.filter((p) => p.graphic_path).length;

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

  const run = async () => {
    if (!selected) return toast.error('Pick or upload a base image first');
    try {
      setBusy(true);
      const { data } = await axios.post(`${API}/campaigns/${campaignId}/graphics/all`, { image_path: selected, handle: handle || null, ai_enhance: aiEnhance, use_brand: useBrand, overwrite });
      onDone(data.posts);
      if (data.failed.length) toast.warning(`Created ${data.created.length}, failed: ${data.failed.join(', ')}`);
      else toast.success(`${data.created.length} graphics created`);
      setOpen(false);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create graphics');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-10 px-4 rounded-none border-border hover:bg-stone-100 gap-2" data-testid="bulk-graphics-button">
          <Images className="w-4 h-4" /> Generate All Graphics
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-none max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate All Graphics</DialogTitle>
          <DialogDescription>One base image → a sized, on-brand graphic for every post ({posts.map((p) => PLATFORM_META[p.platform]?.label || p.platform).join(', ')}). Headlines come from each post's first sentence.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-sm font-medium">Base image</Label>
            <div className="grid grid-cols-4 gap-2 mt-2" data-testid="bulk-image-choices">
              {images.map((p) => (
                <button key={p} type="button" onClick={() => setSelected(p)} className={`aspect-square overflow-hidden border-2 ${selected === p ? 'border-accent' : 'border-transparent'}`} data-testid="bulk-image-option">
                  <img src={`${BACKEND_URL}/api/files/${p}`} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" id="bulk-upload" onChange={upload} data-testid="bulk-upload-input" />
              <label htmlFor="bulk-upload" className="aspect-square border-2 border-dashed border-border flex flex-col items-center justify-center text-xs text-muted-foreground cursor-pointer hover:bg-stone-50">
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5 mb-1" />} Upload
              </label>
            </div>
          </div>
          <div>
            <Label htmlFor="bulk-handle" className="text-sm font-medium">Handle / footer (optional)</Label>
            <Input id="bulk-handle" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Leave empty to use Brand Kit handle" className="mt-1 h-10 rounded-none" data-testid="bulk-handle-input" />
          </div>
          <Toggle checked={useBrand} onChange={setUseBrand} icon={Palette} title="Apply Brand Kit" hint="Accent color, handle and logo" testId="bulk-use-brand" />
          <Toggle checked={aiEnhance} onChange={setAiEnhance} icon={Sparkles} title="AI enhance each image" hint={`Restyles the photo per platform (uses credits, ~30s × ${posts.length})`} testId="bulk-ai-enhance" />
          {existing > 0 && <Toggle checked={overwrite} onChange={setOverwrite} icon={Images} title={`Replace ${existing} existing graphic${existing > 1 ? 's' : ''}`} hint="Uncheck to only fill in posts that have none yet" testId="bulk-overwrite" />}
          <Button type="button" onClick={run} disabled={busy} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-11 rounded-none gap-2" data-testid="bulk-generate-button">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Images className="w-4 h-4" />} {busy ? `Creating ${posts.length} graphics...` : `Create ${posts.length} graphics`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
