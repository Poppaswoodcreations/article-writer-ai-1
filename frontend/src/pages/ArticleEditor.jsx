import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Save, Download, Loader2, FileText, Code, Image, Upload } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ArticleEditor = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const fileInputRef = useRef(null);
  const contentTextareaRef = useRef(null);

  useEffect(() => {
    fetchArticle();
  }, [id]);

  const fetchArticle = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/articles/${id}`);
      setArticle(response.data);
    } catch (error) {
      console.error('Error fetching article:', error);
      toast.error('Failed to load article');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await axios.put(`${API}/articles/${id}`, {
        title: article.title,
        content: article.content,
        meta_title: article.meta_title,
        meta_description: article.meta_description,
        url_slug: article.url_slug
      });
      toast.success('Article saved successfully');
    } catch (error) {
      console.error('Error saving article:', error);
      toast.error('Failed to save article');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (format) => {
    try {
      setExporting(true);
      const response = await axios.get(`${API}/articles/${id}/export/${format}`);
      const { content, filename } = response.data;
      
      // Create blob and download
      const blob = new Blob([content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(`Article exported as ${format}`);
      setExportDialogOpen(false);
    } catch (error) {
      console.error('Error exporting article:', error);
      toast.error('Failed to export article');
    } finally {
      setExporting(false);
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Only JPEG, PNG, GIF, and WebP images are allowed');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API}/upload-image`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const imageUrl = `${BACKEND_URL}${response.data.url}`;
      
      // Insert image markdown at cursor position
      const textarea = contentTextareaRef.current;
      const cursorPosition = textarea.selectionStart;
      const textBefore = article.content.substring(0, cursorPosition);
      const textAfter = article.content.substring(cursorPosition);
      const imageMarkdown = `\n\n![Image](${imageUrl})\n\n`;
      
      setArticle({
        ...article,
        content: textBefore + imageMarkdown + textAfter
      });

      toast.success('Image uploaded successfully');
      setImageDialogOpen(false);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

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
      {/* Sticky Header */}
      <header className="border-b border-border bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 md:px-12 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/')}
                className="hover:bg-stone-100 h-10 px-3 rounded-none transition-all duration-300"
                data-testid="back-button"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-xl font-medium tracking-tight text-primary" data-testid="editor-title">
                Edit Article
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-10 px-4 rounded-none border-border hover:bg-stone-100 transition-all duration-300 flex items-center gap-2"
                    data-testid="export-button"
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-none">
                  <DialogHeader>
                    <DialogTitle>Export Article</DialogTitle>
                    <DialogDescription>
                      Choose a format to download your article
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 pt-4">
                    <Button
                      onClick={() => handleExport('markdown')}
                      disabled={exporting}
                      className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 h-12 rounded-none justify-start gap-3"
                      data-testid="export-markdown-button"
                    >
                      <FileText className="w-5 h-5" />
                      <div className="text-left">
                        <div className="font-medium">Markdown</div>
                        <div className="text-xs opacity-70">Plain text with markdown formatting</div>
                      </div>
                    </Button>
                    <Button
                      onClick={() => handleExport('html')}
                      disabled={exporting}
                      className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 h-12 rounded-none justify-start gap-3"
                      data-testid="export-html-button"
                    >
                      <Code className="w-5 h-5" />
                      <div className="text-left">
                        <div className="font-medium">HTML</div>
                        <div className="text-xs opacity-70">Full HTML document with SEO meta tags</div>
                      </div>
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-accent text-accent-foreground hover:bg-accent/90 h-10 px-6 rounded-none font-medium transition-all duration-300 flex items-center gap-2"
                data-testid="save-button"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 md:px-12 py-12">
        <div className="max-w-4xl mx-auto">
          <Tabs defaultValue="content" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-none h-12 bg-muted">
              <TabsTrigger value="content" className="rounded-none" data-testid="content-tab">
                Content
              </TabsTrigger>
              <TabsTrigger value="seo" className="rounded-none" data-testid="seo-tab">
                SEO Metadata
              </TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="mt-8 space-y-6">
              <div>
                <Label htmlFor="title" className="text-base font-medium">
                  Article Title
                </Label>
                <Input
                  id="title"
                  value={article.title}
                  onChange={(e) => setArticle({ ...article, title: e.target.value })}
                  className="mt-2 h-14 text-2xl font-normal rounded-none border-input focus-visible:ring-1 focus-visible:ring-ring"
                  style={{ fontFamily: 'Playfair Display, serif' }}
                  data-testid="title-input"
                />
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="content" className="text-base font-medium">
                    Article Content
                  </Label>
                  <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 px-4 rounded-none border-border hover:bg-stone-100 transition-all duration-300 flex items-center gap-2"
                        data-testid="add-image-button"
                      >
                        <Image className="w-4 h-4" />
                        Add Image
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-none">
                      <DialogHeader>
                        <DialogTitle>Upload Image</DialogTitle>
                        <DialogDescription>
                          Upload an image to insert into your article (max 5MB)
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="border-2 border-dashed border-border rounded-none p-8 text-center">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                            onChange={handleImageUpload}
                            className="hidden"
                            id="image-upload"
                            data-testid="image-upload-input"
                          />
                          <label
                            htmlFor="image-upload"
                            className="cursor-pointer flex flex-col items-center gap-3"
                          >
                            <Upload className="w-12 h-12 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium text-foreground mb-1">
                                Click to upload image
                              </p>
                              <p className="text-xs text-muted-foreground">
                                JPEG, PNG, GIF, WebP (max 5MB)
                              </p>
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
                </div>
                <Textarea
                  ref={contentTextareaRef}
                  id="content"
                  value={article.content}
                  onChange={(e) => setArticle({ ...article, content: e.target.value })}
                  className="mt-2 min-h-[600px] rounded-none border-input focus-visible:ring-1 focus-visible:ring-ring editor-content"
                  style={{ fontFamily: 'Merriweather, serif', lineHeight: '1.8' }}
                  data-testid="content-textarea"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Images will be inserted as markdown: ![Image](url)
                </p>
              </div>
            </TabsContent>

            <TabsContent value="seo" className="mt-8 space-y-6">
              <div>
                <Label htmlFor="meta_title" className="text-base font-medium">
                  Meta Title
                </Label>
                <Input
                  id="meta_title"
                  value={article.meta_title}
                  onChange={(e) => setArticle({ ...article, meta_title: e.target.value })}
                  className="mt-2 h-12 rounded-none border-input focus-visible:ring-1 focus-visible:ring-ring"
                  data-testid="meta-title-input"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {article.meta_title.length}/60 characters - Optimal: 50-60 characters
                </p>
              </div>

              <div>
                <Label htmlFor="meta_description" className="text-base font-medium">
                  Meta Description
                </Label>
                <Textarea
                  id="meta_description"
                  value={article.meta_description}
                  onChange={(e) => setArticle({ ...article, meta_description: e.target.value })}
                  className="mt-2 min-h-[100px] rounded-none border-input focus-visible:ring-1 focus-visible:ring-ring"
                  data-testid="meta-description-textarea"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {article.meta_description.length}/160 characters - Optimal: 150-160 characters
                </p>
              </div>

              <div>
                <Label htmlFor="url_slug" className="text-base font-medium">
                  URL Slug
                </Label>
                <Input
                  id="url_slug"
                  value={article.url_slug}
                  onChange={(e) => setArticle({ ...article, url_slug: e.target.value })}
                  className="mt-2 h-12 rounded-none border-input focus-visible:ring-1 focus-visible:ring-ring font-mono"
                  data-testid="url-slug-input"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  SEO-friendly URL: lowercase, hyphens, no special characters
                </p>
              </div>

              <div className="bg-muted p-6 rounded-none mt-8">
                <h3 className="text-sm font-medium mb-4 uppercase tracking-widest text-muted-foreground">SEO Preview</h3>
                <div className="space-y-2">
                  <div className="text-xl text-primary hover:underline cursor-pointer">
                    {article.meta_title || article.title}
                  </div>
                  <div className="text-sm text-green-700">
                    https://example.com/{article.url_slug}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {article.meta_description}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default ArticleEditor;