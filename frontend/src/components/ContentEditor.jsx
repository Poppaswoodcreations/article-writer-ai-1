import React, { useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ImagePlus } from 'lucide-react';
import { ImageUploadDialog } from '@/components/ImageUploadDialog';
import { useImageInsert } from '@/hooks/useImageInsert';

export const ContentEditor = ({ content, onContentChange }) => {
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const contentRef = useRef(content);
  contentRef.current = content;
  const { uploading, insertFiles, onDrop, onPaste } = useImageInsert(textareaRef, () => contentRef.current, onContentChange);

  const handleDialogUpload = async (event) => {
    await insertFiles(event.target.files);
    setImageDialogOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e) => { setDragging(false); onDrop(e); };
  const overlayText = uploading ? 'Uploading image...' : 'Drop image to insert at cursor';

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label htmlFor="content" className="text-base font-medium">Article Content</Label>
        <ImageUploadDialog open={imageDialogOpen} onOpenChange={setImageDialogOpen} uploading={uploading} fileInputRef={fileInputRef} onFileChange={handleDialogUpload} />
      </div>
      <div className="relative" onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} data-testid="content-dropzone">
        <Textarea ref={textareaRef} id="content" value={content} onChange={(e) => onContentChange(e.target.value)} onPaste={onPaste}
          className={`mt-2 min-h-[600px] rounded-none border-input focus-visible:ring-1 focus-visible:ring-ring editor-content transition-colors ${dragging ? 'border-accent bg-accent/5' : ''}`}
          style={{ fontFamily: 'Merriweather, serif', lineHeight: '1.8' }} data-testid="content-textarea" />
        {(dragging || uploading) && (
          <div className="absolute inset-0 mt-2 flex items-center justify-center bg-white/70 pointer-events-none" data-testid="drop-overlay">
            <span className="flex items-center gap-2 text-sm font-medium bg-white border border-accent px-4 py-2">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
              {overlayText}
            </span>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-2">Drag & drop or paste an image into the text to insert it at your cursor · inserted as markdown: ![Image](url)</p>
    </div>
  );
};
