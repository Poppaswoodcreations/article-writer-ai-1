import React, { useRef, useState } from 'react';
import axios from 'axios';
import { Label } from '@/components/ui/label';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const fileUrl = (path) => `${BACKEND_URL}/api/files/${path}`;

// Manages a list of storage paths with a selected one plus single-file upload
export const useImagePicker = (initialPaths) => {
  const [images, setImages] = useState(initialPaths);
  const [selected, setSelected] = useState(initialPaths[0] || '');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

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

  return { images, selected, setSelected, uploading, upload, fileRef };
};

export const ImagePicker = ({ picker, inputId, columns = 3, testIdPrefix }) => (
  <div>
    <Label className="text-sm font-medium">Base image</Label>
    <div className={`grid gap-2 mt-2 ${columns === 4 ? 'grid-cols-4' : 'grid-cols-3'}`} data-testid={`${testIdPrefix}-image-choices`}>
      {picker.images.map((p) => (
        <button key={p} type="button" onClick={() => picker.setSelected(p)} className={`aspect-square overflow-hidden border-2 ${picker.selected === p ? 'border-accent' : 'border-transparent'}`} data-testid={`${testIdPrefix}-image-option`}>
          <img src={fileUrl(p)} alt="" className="w-full h-full object-cover" />
        </button>
      ))}
      <input ref={picker.fileRef} type="file" accept="image/*" className="hidden" id={inputId} onChange={picker.upload} data-testid={`${testIdPrefix}-upload-input`} />
      <label htmlFor={inputId} className="aspect-square border-2 border-dashed border-border flex flex-col items-center justify-center text-xs text-muted-foreground cursor-pointer hover:bg-stone-50">
        {picker.uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5 mb-1" />}
        Upload
      </label>
    </div>
  </div>
);
