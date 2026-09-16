import React, { useRef, useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link2, ImagePlus, X, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const ReferenceInputs = ({ urls, onUrlsChange, images, onImagesChange, disabled }) => {
  const [urlDraft, setUrlDraft] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const addUrl = () => {
    const value = urlDraft.trim();
    if (!value) return;
    if (!/^https?:\/\//i.test(value)) {
      toast.error('URL must start with http:// or https://');
      return;
    }
    if (urls.length >= 5) {
      toast.error('Maximum 5 reference URLs');
      return;
    }
    onUrlsChange([...urls, value]);
    setUrlDraft('');
  };

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    if (images.length + files.length > 5) {
      toast.error('Maximum 5 images');
      return;
    }
    setUploading(true);
    const added = [];
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is larger than 5MB`);
        continue;
      }
      try {
        const formData = new FormData();
        formData.append('file', file);
        const { data } = await axios.post(`${API}/upload-image`, formData);
        added.push({ path: data.url.replace('/api/files/', ''), url: `${BACKEND_URL}${data.url}`, name: file.name });
      } catch (err) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    onImagesChange([...images, ...added]);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-6" data-testid="reference-inputs">
      <div>
        <Label className="text-base font-medium flex items-center gap-2">
          <Link2 className="w-4 h-4" /> Reference URLs (Optional)
        </Label>
        <div className="flex gap-2 mt-2">
          <Input
            placeholder="https://example.com/source-article"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }}
            disabled={disabled}
            className="h-12 rounded-none border-input focus-visible:ring-1 focus-visible:ring-ring"
            data-testid="reference-url-input"
          />
          <Button type="button" variant="outline" onClick={addUrl} disabled={disabled} className="h-12 px-4 rounded-none" data-testid="add-url-button">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">We read these pages and use them as research for your content</p>
        {urls.length > 0 && (
          <ul className="mt-3 space-y-2" data-testid="reference-url-list">
            {urls.map((u, i) => (
              <li key={i} className="flex items-center justify-between gap-3 bg-muted px-3 py-2 text-sm" data-testid={`reference-url-item-${i}`}>
                <span className="truncate font-mono text-xs">{u}</span>
                <button type="button" onClick={() => onUrlsChange(urls.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive" data-testid={`remove-url-${i}`}>
                  <X className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <Label className="text-base font-medium flex items-center gap-2">
          <ImagePlus className="w-4 h-4" /> Reference Images (Optional)
        </Label>
        <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleFiles} className="hidden" id="reference-images" data-testid="reference-image-input" />
        <label htmlFor="reference-images" className={`mt-2 border-2 border-dashed border-border p-6 flex flex-col items-center gap-2 cursor-pointer hover:bg-stone-50 transition-colors ${disabled ? 'pointer-events-none opacity-60' : ''}`} data-testid="reference-image-dropzone">
          {uploading ? <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /> : <ImagePlus className="w-8 h-8 text-muted-foreground" />}
          <span className="text-sm font-medium">{uploading ? 'Uploading...' : 'Click to upload images'}</span>
          <span className="text-xs text-muted-foreground">AI will look at them and write about what they show · JPEG, PNG, GIF, WebP · max 5MB each</span>
        </label>
        {images.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mt-3" data-testid="reference-image-list">
            {images.map((img, i) => (
              <div key={img.path} className="relative group aspect-square bg-muted overflow-hidden" data-testid={`reference-image-item-${i}`}>
                <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                <button type="button" onClick={() => onImagesChange(images.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-white/90 p-1 opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`remove-image-${i}`}>
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
