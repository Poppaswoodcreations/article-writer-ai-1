import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Image, Upload, Loader2 } from 'lucide-react';

export const ImageUploadDialog = ({ open, onOpenChange, uploading, fileInputRef, onFileChange }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogTrigger asChild>
      <Button type="button" variant="outline" size="sm" className="h-9 px-4 rounded-none border-border hover:bg-stone-100 transition-all duration-300 flex items-center gap-2" data-testid="add-image-button">
        <Image className="w-4 h-4" />
        Add Image
      </Button>
    </DialogTrigger>
    <DialogContent className="rounded-none">
      <DialogHeader>
        <DialogTitle>Upload Image</DialogTitle>
        <DialogDescription>Upload an image to insert into your article (max 5MB)</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 pt-4">
        <div className="border-2 border-dashed border-border rounded-none p-8 text-center">
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/gif,image/webp" onChange={onFileChange} className="hidden" id="image-upload" data-testid="image-upload-input" />
          <label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center gap-3">
            <Upload className="w-12 h-12 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Click to upload image</p>
              <p className="text-xs text-muted-foreground">JPEG, PNG, GIF, WebP (max 5MB)</p>
            </div>
          </label>
        </div>
        {uploading && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Uploading image...
          </div>
        )}
      </div>
    </DialogContent>
  </Dialog>
);
