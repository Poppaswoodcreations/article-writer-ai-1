import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
export const VALID_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

const validate = (file) => {
  if (!VALID_IMAGE_TYPES.includes(file.type)) return 'Only JPEG, PNG, GIF, and WebP images are allowed';
  if (file.size > 5 * 1024 * 1024) return 'Image size must be less than 5MB';
  return null;
};

// Uploads image files and inserts markdown at the textarea cursor (or given position)
export const useImageInsert = (textareaRef, getContent, setContent) => {
  const [uploading, setUploading] = useState(false);

  const insertFiles = async (files, position) => {
    const list = Array.from(files || []).filter((f) => f.type.startsWith('image/'));
    if (!list.length) return false;
    const error = list.map(validate).find(Boolean);
    if (error) { toast.error(error); return true; }

    setUploading(true);
    try {
      let content = getContent();
      let cursor = position ?? textareaRef.current?.selectionStart ?? content.length;
      for (const file of list) {
        const formData = new FormData();
        formData.append('file', file);
        const { data } = await axios.post(`${API}/upload-image`, formData);
        const md = `\n\n![Image](${BACKEND_URL}${data.url})\n\n`;
        content = content.slice(0, cursor) + md + content.slice(cursor);
        cursor += md.length;
      }
      setContent(content);
      toast.success(list.length > 1 ? `${list.length} images inserted` : 'Image inserted');
    } catch {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
    return true;
  };

  const onDrop = (e) => {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    insertFiles(e.dataTransfer.files);
  };

  const onPaste = (e) => {
    const files = Array.from(e.clipboardData?.items || []).filter((i) => i.kind === 'file').map((i) => i.getAsFile());
    if (files.length && insertFiles(files)) e.preventDefault();
  };

  return { uploading, insertFiles, onDrop, onPaste };
};
