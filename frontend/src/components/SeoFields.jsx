import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export const SeoFields = ({ article, onChange }) => (
  <div className="space-y-6">
    <div>
      <Label htmlFor="meta_title" className="text-base font-medium">Meta Title</Label>
      <Input id="meta_title" value={article.meta_title} onChange={(e) => onChange({ meta_title: e.target.value })} className="mt-2 h-12 rounded-none border-input focus-visible:ring-1 focus-visible:ring-ring" data-testid="meta-title-input" />
      <p className="text-xs text-muted-foreground mt-2">{article.meta_title.length}/60 characters - Optimal: 50-60 characters</p>
    </div>

    <div>
      <Label htmlFor="meta_description" className="text-base font-medium">Meta Description</Label>
      <Textarea id="meta_description" value={article.meta_description} onChange={(e) => onChange({ meta_description: e.target.value })} className="mt-2 min-h-[100px] rounded-none border-input focus-visible:ring-1 focus-visible:ring-ring" data-testid="meta-description-textarea" />
      <p className="text-xs text-muted-foreground mt-2">{article.meta_description.length}/160 characters - Optimal: 150-160 characters</p>
    </div>

    <div>
      <Label htmlFor="url_slug" className="text-base font-medium">URL Slug</Label>
      <Input id="url_slug" value={article.url_slug} onChange={(e) => onChange({ url_slug: e.target.value })} className="mt-2 h-12 rounded-none border-input focus-visible:ring-1 focus-visible:ring-ring font-mono" data-testid="url-slug-input" />
      <p className="text-xs text-muted-foreground mt-2">SEO-friendly URL: lowercase, hyphens, no special characters</p>
    </div>

    <div className="bg-muted p-6 rounded-none mt-8">
      <h3 className="text-sm font-medium mb-4 uppercase tracking-widest text-muted-foreground">SEO Preview</h3>
      <div className="space-y-2">
        <div className="text-xl text-primary hover:underline cursor-pointer">{article.meta_title || article.title}</div>
        <div className="text-sm text-green-700">https://example.com/{article.url_slug}</div>
        <div className="text-sm text-muted-foreground">{article.meta_description}</div>
      </div>
    </div>
  </div>
);
