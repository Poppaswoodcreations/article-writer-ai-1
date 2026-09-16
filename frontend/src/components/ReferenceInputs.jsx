import React, { useRef, useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link2, ImagePlus, X, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const MAX_ITEMS = 5;
const MAX_SIZE = 5 * 1024 * 1024;

const validateUrl = (value, urls) => {
  if (!/^https?:\/\//i.test(value)) return 'URL must start with http:// or https://';
  if (urls.includes(value)) return 'That URL is already added';
  if (urls.length >= MAX_ITEMS) return `Maximum ${MAX_ITEMS} reference URLs`;
  return null;
};

const uploadOne = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await axios.post(`${API}/upload-image`, formData);
  return { path: data.url.replace('/api/files/', ''), url: `${BACKEND_URL}${data.url}`, name: file.name };
};

const UrlList = ({ urls, onChange, disabled }) => {
  const [draft, setDraft] = useState('');

  const addUrl = () => {
    const value = draft.trim();
    if (!value) return;
    const error = validateUrl(value, urls);
    if (error) return toast.error(error);
    onChange([...urls, value]);
    setDraft('');
  };

  return (
    <div>
      <Label className="text-base font-medium flex items-center gap-2"><Link2 className="w-4 h-4" /> Reference URLs (Optional)</Label>
      <div className="flex gap-2 mt-2">
        <Input placeholder="https://example.com/source-article" value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }} disabled={disabled}
          className="h-12 rounded-none border-input focus-visible:ring-1 focus-visible:ring-ring" data-testid="reference-url-input" />
        <Button type="button" variant="outline" onClick={addUrl} disabled={disabled} className="h-12 px-4 rounded-none" data-testid="add-url-button"><Plus className="w-4 h-4" /></Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">We read these pages and use them as research for your content</p>
      {urls.length > 0 && (
        <ul className="mt-3 space-y-2" data-testid="reference-url-list">
          {urls.map((u, i) => (
            <li key={u} className="flex items-center justify-between gap-3 bg-muted px-3 py-2 text-sm" data-testid={`reference-url-item-${i}`}>
              <span className="truncate font-mono text-xs">{u}</span>
              <button type="button" onClick={() => onChange(urls.filter((x) => x !== u))} className="text-muted-foreground hover:text-destructive" data-testid={`remove-url-${i}`}><X className="w-4 h-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const ImageUploader = ({ images, onChange, disabled }) => {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    if (images.length + files.length > MAX_ITEMS) return toast.error(`Maximum ${MAX_ITEMS} images`);
    setUploading(true);
    const results = await Promise.allSettled(files.map((f) => (f.size > MAX_SIZE ? Promise.reject(new Error('too large')) : uploadOne(f))));
    results.forEach((r, i) => { if (r.status === 'rejected') toast.error(`Failed to upload ${files[i].name}`); });
    onChange([...images, ...results.filter((r) => r.status === 'fulfilled').map((r) => r.value)]);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div>
      <Label className="text-base font-medium flex items-center gap-2"><ImagePlus className="w-4 h-4" /> Reference Images (Optional)</Label>
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
              <button type="button" onClick={() => onChange(images.filter((x) => x.path !== img.path))} className="absolute top-1 right-1 bg-white/90 p-1 opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`remove-image-${i}`}><X className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const ReferenceInputs = ({ urls, onUrlsChange, images, onImagesChange, disabled }) => (
  <div className="space-y-6" data-testid="reference-inputs">
    <UrlList urls={urls} onChange={onUrlsChange} disabled={disabled} />
    <ImageUploader images={images} onChange={onImagesChange} disabled={disabled} />
  </div>
);
