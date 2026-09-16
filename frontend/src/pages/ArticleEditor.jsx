import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Save, Loader2, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ExportDialog } from '@/components/ExportDialog';
import { ImageUploadDialog } from '@/components/ImageUploadDialog';
import { SeoFields } from '@/components/SeoFields';
import { downloadText } from '@/lib/platforms';
import { useImageInsert } from '@/hooks/useImageInsert';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const REMARK_PLUGINS = [remarkGfm];
const EXPORT_OPTIONS = [
  { format: 'markdown', label: 'Markdown', hint: 'Plain text with markdown formatting' },
  { format: 'html', label: 'HTML', hint: 'Full HTML document with SEO meta tags' },
  { format: 'txt', label: 'Plain Text', hint: 'Ready to paste anywhere' },
];

const ArticleEditor = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);
  const contentTextareaRef = useRef(null);
  const articleRef = useRef(null);
  articleRef.current = article;
  const { uploading, insertFiles, onDrop, onPaste } = useImageInsert(contentTextareaRef, () => articleRef.current.content, (content) => setArticle((a) => ({ ...a, content })));

  const patch = (fields) => setArticle((a) => ({ ...a, ...fields }));

  const fetchArticle = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/articles/${id}`);
      setArticle(response.data);
    } catch (error) {
      toast.error('Failed to load article');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { fetchArticle(); }, [fetchArticle]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const { title, content, meta_title, meta_description, url_slug } = article;
      await axios.put(`${API}/articles/${id}`, { title, content, meta_title, meta_description, url_slug });
      toast.success('Article saved successfully');
    } catch (error) {
      toast.error('Failed to save article');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (format) => {
    try {
      setExporting(true);
      const { data } = await axios.get(`${API}/articles/${id}/export/${format}`);
      downloadText(data.content, data.filename);
      toast.success(`Article exported as ${format}`);
      setExportDialogOpen(false);
    } catch (error) {
      toast.error('Failed to export article');
    } finally {
      setExporting(false);
    }
  };

  const handleImageUpload = async (event) => {
    await insertFiles(event.target.files);
    setImageDialogOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e) => { setDragging(false); onDrop(e); };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }
  if (!article) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 md:px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/')} className="hover:bg-stone-100 h-10 px-3 rounded-none transition-all duration-300" data-testid="back-button">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-medium tracking-tight text-primary" data-testid="editor-title">Edit Article</h1>
          </div>
          <div className="flex items-center gap-3">
            <ExportDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen} title="Export Article" description="Choose a format to download your article" options={EXPORT_OPTIONS} onExport={handleExport} disabled={exporting} />
            <Button onClick={handleSave} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent/90 h-10 px-6 rounded-none font-medium transition-all duration-300 flex items-center gap-2" data-testid="save-button">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 md:px-12 py-12">
        <div className="max-w-4xl mx-auto">
          <Tabs defaultValue="content" className="w-full">
            <TabsList className="grid w-full grid-cols-3 rounded-none h-12 bg-muted">
              <TabsTrigger value="content" className="rounded-none" data-testid="content-tab">Content</TabsTrigger>
              <TabsTrigger value="preview" className="rounded-none" data-testid="preview-tab">Preview</TabsTrigger>
              <TabsTrigger value="seo" className="rounded-none" data-testid="seo-tab">SEO Metadata</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="mt-8 space-y-6">
              <div>
                <Label htmlFor="title" className="text-base font-medium">Article Title</Label>
                <Input id="title" value={article.title} onChange={(e) => patch({ title: e.target.value })} className="mt-2 h-14 text-2xl font-normal rounded-none border-input focus-visible:ring-1 focus-visible:ring-ring" style={{ fontFamily: 'Playfair Display, serif' }} data-testid="title-input" />
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="content" className="text-base font-medium">Article Content</Label>
                  <ImageUploadDialog open={imageDialogOpen} onOpenChange={setImageDialogOpen} uploading={uploading} fileInputRef={fileInputRef} onFileChange={handleImageUpload} />
                </div>
                <div className="relative" onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} data-testid="content-dropzone">
                  <Textarea ref={contentTextareaRef} id="content" value={article.content} onChange={(e) => patch({ content: e.target.value })} onPaste={onPaste}
                    className={`mt-2 min-h-[600px] rounded-none border-input focus-visible:ring-1 focus-visible:ring-ring editor-content transition-colors ${dragging ? 'border-accent bg-accent/5' : ''}`}
                    style={{ fontFamily: 'Merriweather, serif', lineHeight: '1.8' }} data-testid="content-textarea" />
                  {(dragging || uploading) && (
                    <div className="absolute inset-0 mt-2 flex items-center justify-center bg-white/70 pointer-events-none" data-testid="drop-overlay">
                      <span className="flex items-center gap-2 text-sm font-medium bg-white border border-accent px-4 py-2">
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                        {uploading ? 'Uploading image...' : 'Drop image to insert at cursor'}
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Drag & drop or paste an image into the text to insert it at your cursor · inserted as markdown: ![Image](url)</p>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="mt-8">
              <article className="article-preview" data-testid="article-preview">
                <h1 style={{ fontFamily: 'Playfair Display, serif' }}>{article.title}</h1>
                <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>{article.content}</ReactMarkdown>
              </article>
            </TabsContent>

            <TabsContent value="seo" className="mt-8">
              <SeoFields article={article} onChange={patch} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default ArticleEditor;
