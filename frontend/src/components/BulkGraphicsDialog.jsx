import React, { useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Images, Loader2, Sparkles, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { PLATFORM_META } from '@/lib/platforms';
import { ImagePicker, useImagePicker } from '@/components/ImagePicker';
import { OptionToggle } from '@/components/OptionToggle';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const useBulkGraphics = (campaignId, onDone, close) => {
  const [busy, setBusy] = useState(false);

  const run = async (payload) => {
    if (!payload.image_path) return toast.error('Pick or upload a base image first');
    try {
      setBusy(true);
      const { data } = await axios.post(`${API}/campaigns/${campaignId}/graphics/all`, payload);
      onDone(data.posts);
      if (data.failed.length) toast.warning(`Created ${data.created.length}, failed: ${data.failed.join(', ')}`);
      else toast.success(`${data.created.length} graphics created`);
      close();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create graphics');
    } finally {
      setBusy(false);
    }
  };

  return { busy, run };
};

const BulkForm = ({ campaignId, posts, imagePaths, onDone, close }) => {
  const picker = useImagePicker(imagePaths);
  const [handle, setHandle] = useState('');
  const [useBrand, setUseBrand] = useState(true);
  const [aiEnhance, setAiEnhance] = useState(false);
  const [overwrite, setOverwrite] = useState(true);
  const { busy, run } = useBulkGraphics(campaignId, onDone, close);
  const existing = posts.filter((p) => p.graphic_path).length;

  return (
    <div className="space-y-4 pt-2">
      <ImagePicker picker={picker} inputId="bulk-upload" columns={4} testIdPrefix="bulk" />
      <div>
        <Label htmlFor="bulk-handle" className="text-sm font-medium">Handle / footer (optional)</Label>
        <Input id="bulk-handle" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Leave empty to use Brand Kit handle" className="mt-1 h-10 rounded-none" data-testid="bulk-handle-input" />
      </div>
      <OptionToggle checked={useBrand} onChange={setUseBrand} icon={Palette} title="Apply Brand Kit" hint="Accent color, handle and logo" testId="bulk-use-brand" />
      <OptionToggle checked={aiEnhance} onChange={setAiEnhance} icon={Sparkles} title="AI enhance each image" hint={`Restyles the photo per platform (uses credits, ~30s × ${posts.length})`} testId="bulk-ai-enhance" />
      {existing > 0 && <OptionToggle checked={overwrite} onChange={setOverwrite} icon={Images} title={`Replace ${existing} existing graphic${existing > 1 ? 's' : ''}`} hint="Uncheck to only fill in posts that have none yet" testId="bulk-overwrite" />}
      <Button type="button" disabled={busy} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-11 rounded-none gap-2" data-testid="bulk-generate-button"
        onClick={() => run({ image_path: picker.selected, handle: handle || null, ai_enhance: aiEnhance, use_brand: useBrand, overwrite })}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Images className="w-4 h-4" />} {busy ? `Creating ${posts.length} graphics...` : `Create ${posts.length} graphics`}
      </Button>
    </div>
  );
};

export const BulkGraphicsDialog = ({ campaignId, posts, imagePaths, onDone }) => {
  const [open, setOpen] = useState(false);
  const platformList = posts.map((p) => PLATFORM_META[p.platform]?.label || p.platform).join(', ');

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
          <DialogDescription>One base image → a sized, on-brand graphic for every post ({platformList}). Headlines come from each post's first sentence.</DialogDescription>
        </DialogHeader>
        {open && <BulkForm campaignId={campaignId} posts={posts} imagePaths={imagePaths} onDone={onDone} close={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
};
