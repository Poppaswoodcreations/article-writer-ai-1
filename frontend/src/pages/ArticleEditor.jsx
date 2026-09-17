import React, { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArticleHeader } from '@/components/ArticleHeader';
import { ContentEditor } from '@/components/ContentEditor';
import { SeoFields } from '@/components/SeoFields';
import { useArticle } from '@/hooks/useArticle';

const REMARK_PLUGINS = [remarkGfm];

const ArticleEditor = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const goHome = useCallback(() => navigate('/'), [navigate]);
  const { article, loading, saving, exporting, patch, save, exportAs } = useArticle(id, goHome);

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
      <ArticleHeader saving={saving} exporting={exporting} onBack={goHome} onSave={save} onExport={exportAs} onPromote={() => navigate(`/campaigns/new?from_article=${id}`)} />

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
              <ContentEditor content={article.content} onContentChange={(content) => patch({ content })} />
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
