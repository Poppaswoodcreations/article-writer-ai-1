import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ArticleGenerator = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    topic: '',
    keywords: '',
    tone: 'professional'
  });
  const [generating, setGenerating] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.topic.trim()) {
      toast.error('Please enter a topic');
      return;
    }

    try {
      setGenerating(true);
      toast.info('Generating your article... This may take 30-60 seconds');
      
      const response = await axios.post(`${API}/articles/generate`, formData);
      
      toast.success('Article generated successfully!');
      navigate(`/editor/${response.data.article_id}`);
    } catch (error) {
      console.error('Error generating article:', error);
      toast.error(error.response?.data?.detail || 'Failed to generate article');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 md:px-12 py-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="hover:bg-stone-100 h-10 px-3 rounded-none transition-all duration-300"
              data-testid="back-button"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl md:text-4xl font-medium tracking-tight text-primary" data-testid="generator-title">
                Generate Article
              </h1>
              <p className="text-sm text-muted-foreground mt-1">AI-powered content creation</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 md:px-12 py-12">
        <div className="max-w-3xl mx-auto">
          <Card className="bg-card border border-border shadow-sm rounded-none p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="topic" className="text-base font-medium">
                  Article Topic <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="topic"
                  placeholder="e.g., Benefits of Renewable Energy"
                  value={formData.topic}
                  onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                  className="mt-2 h-12 rounded-none border-input focus-visible:ring-1 focus-visible:ring-ring"
                  disabled={generating}
                  data-testid="topic-input"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Enter the main topic or subject for your article
                </p>
              </div>

              <div>
                <Label htmlFor="keywords" className="text-base font-medium">
                  Keywords (Optional)
                </Label>
                <Textarea
                  id="keywords"
                  placeholder="e.g., solar power, wind energy, sustainability"
                  value={formData.keywords}
                  onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                  className="mt-2 min-h-[100px] rounded-none border-input focus-visible:ring-1 focus-visible:ring-ring"
                  disabled={generating}
                  data-testid="keywords-input"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Comma-separated keywords to focus on for SEO optimization
                </p>
              </div>

              <div>
                <Label htmlFor="tone" className="text-base font-medium">
                  Writing Tone
                </Label>
                <Select
                  value={formData.tone}
                  onValueChange={(value) => setFormData({ ...formData, tone: value })}
                  disabled={generating}
                >
                  <SelectTrigger className="mt-2 h-12 rounded-none" data-testid="tone-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="conversational">Conversational</SelectItem>
                    <SelectItem value="academic">Academic</SelectItem>
                    <SelectItem value="persuasive">Persuasive</SelectItem>
                    <SelectItem value="informative">Informative</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">
                  Choose the tone that best fits your target audience
                </p>
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={generating}
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-12 rounded-none font-medium tracking-wide transition-all duration-300 flex items-center justify-center gap-2"
                  data-testid="generate-button"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating Article...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate Article
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Card>

          {/* Info Section */}
          <div className="mt-12 space-y-6">
            <h2 className="text-2xl font-normal text-foreground">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-card border border-border p-6 rounded-none">
                <div className="w-12 h-12 bg-accent/10 flex items-center justify-center mb-4">
                  <span className="text-2xl font-medium text-accent">1</span>
                </div>
                <h3 className="text-lg font-medium mb-2">Enter Topic</h3>
                <p className="text-sm text-muted-foreground">
                  Provide your article topic and optional keywords for SEO focus
                </p>
              </div>
              <div className="bg-card border border-border p-6 rounded-none">
                <div className="w-12 h-12 bg-accent/10 flex items-center justify-center mb-4">
                  <span className="text-2xl font-medium text-accent">2</span>
                </div>
                <h3 className="text-lg font-medium mb-2">AI Generation</h3>
                <p className="text-sm text-muted-foreground">
                  Claude Sonnet 4 creates a comprehensive, SEO-optimized article
                </p>
              </div>
              <div className="bg-card border border-border p-6 rounded-none">
                <div className="w-12 h-12 bg-accent/10 flex items-center justify-center mb-4">
                  <span className="text-2xl font-medium text-accent">3</span>
                </div>
                <h3 className="text-lg font-medium mb-2">Edit & Export</h3>
                <p className="text-sm text-muted-foreground">
                  Review, edit, and export your article in multiple formats
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ArticleGenerator;