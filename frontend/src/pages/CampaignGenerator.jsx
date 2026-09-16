import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Megaphone, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ReferenceInputs } from '@/components/ReferenceInputs';
import { PlatformPicker } from '@/components/PlatformPicker';
import { PLATFORM_META } from '@/lib/platforms';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const ALL_PLATFORMS = Object.keys(PLATFORM_META).filter((p) => p !== 'email');
const TONES = ['engaging', 'playful', 'professional', 'bold', 'inspirational', 'urgent'];

const CampaignGenerator = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fromArticle = params.get('from_article');
  const [sourceArticle, setSourceArticle] = useState(null);
  const [form, setForm] = useState({ topic: '', goal: '', keywords: '', tone: 'engaging' });
  const [platforms, setPlatforms] = useState(ALL_PLATFORMS);
  const [includeEmail, setIncludeEmail] = useState(true);
  const [urls, setUrls] = useState([]);
  const [images, setImages] = useState([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!fromArticle) return;
    axios.get(`${API}/articles/${fromArticle}`).then(({ data }) => {
      setSourceArticle(data);
      setForm({ topic: data.title, goal: `Drive readers to the article "${data.title}" — [ARTICLE LINK]`, keywords: data.keywords || '', tone: 'engaging' });
      setImages((data.image_paths || []).map((path) => ({ path, url: `${BACKEND_URL}/api/files/${path}`, name: path.split('/').pop() })));
    }).catch(() => toast.error('Could not load the article to promote'));
  }, [fromArticle]);

  const togglePlatform = (p) => setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.topic.trim()) return toast.error('Please enter a topic or product');
    if (!platforms.length) return toast.error('Select at least one platform');
    try {
      setGenerating(true);
      toast.info('Writing your campaign... This may take 30-90 seconds');
      const { data } = await axios.post(`${API}/campaigns/generate`, {
        ...form,
        platforms: ALL_PLATFORMS.filter((p) => platforms.includes(p)),
        include_email: includeEmail,
        reference_urls: urls,
        image_paths: images.map((img) => img.path),
        source_article_id: fromArticle || null
      });
      toast.success('Campaign generated!');
      navigate(`/campaigns/${data.campaign_id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate campaign');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 md:px-12 py-6 flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/?tab=campaigns')} className="hover:bg-stone-100 h-10 px-3 rounded-none" data-testid="back-button">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl md:text-4xl font-medium tracking-tight text-primary" data-testid="campaign-generator-title">New Campaign</h1>
            <p className="text-sm text-muted-foreground mt-1">Social media posts + email, written for each platform</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 md:px-12 py-12">
        <div className="max-w-3xl mx-auto">
          {sourceArticle && (
            <div className="mb-6 border border-accent/40 bg-accent/5 px-5 py-4 flex items-start gap-3" data-testid="promote-source-banner">
              <Megaphone className="w-5 h-5 text-accent mt-0.5" />
              <div className="text-sm">
                <div className="font-medium">Promoting article: {sourceArticle.title}</div>
                <div className="text-muted-foreground text-xs mt-1">The article's content, keywords and images are pre-filled below. Adjust platforms or tone, then generate.</div>
              </div>
            </div>
          )}
          <Card className="bg-card border border-border shadow-sm rounded-none p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="c-topic" className="text-base font-medium">Topic / Product <span className="text-destructive">*</span></Label>
                <Input id="c-topic" placeholder="e.g., Launch of our new organic coffee blend" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} disabled={generating} className="mt-2 h-12 rounded-none" data-testid="campaign-topic-input" />
              </div>
              <div>
                <Label htmlFor="c-goal" className="text-base font-medium">Goal / Call to Action</Label>
                <Input id="c-goal" placeholder="e.g., Pre-orders open, 20% off this week" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} disabled={generating} className="mt-2 h-12 rounded-none" data-testid="campaign-goal-input" />
              </div>
              <div>
                <Label htmlFor="c-keywords" className="text-base font-medium">Keywords (Optional)</Label>
                <Textarea id="c-keywords" placeholder="e.g., organic, fair trade, small batch" value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} disabled={generating} className="mt-2 min-h-[80px] rounded-none" data-testid="campaign-keywords-input" />
              </div>
              <div>
                <Label className="text-base font-medium">Tone</Label>
                <Select value={form.tone} onValueChange={(v) => setForm({ ...form, tone: v })} disabled={generating}>
                  <SelectTrigger className="mt-2 h-12 rounded-none" data-testid="campaign-tone-select"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-none">
                    {TONES.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <PlatformPicker platforms={ALL_PLATFORMS} selected={platforms} onToggle={togglePlatform} includeEmail={includeEmail} onEmailChange={setIncludeEmail} disabled={generating} />

              <ReferenceInputs urls={urls} onUrlsChange={setUrls} images={images} onImagesChange={setImages} disabled={generating} />

              <Button type="submit" disabled={generating} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-12 rounded-none font-medium tracking-wide flex items-center justify-center gap-2" data-testid="generate-campaign-button">
                {generating ? <><Loader2 className="w-5 h-5 animate-spin" /> Writing Campaign...</> : <><Megaphone className="w-5 h-5" /> Generate Campaign</>}
              </Button>
            </form>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default CampaignGenerator;
