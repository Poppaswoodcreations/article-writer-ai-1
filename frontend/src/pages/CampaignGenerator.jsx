import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Megaphone, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ReferenceInputs } from '@/components/ReferenceInputs';
import { PLATFORM_META } from '@/lib/platforms';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const ALL_PLATFORMS = Object.keys(PLATFORM_META);

const CampaignGenerator = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ topic: '', goal: '', keywords: '', tone: 'engaging' });
  const [platforms, setPlatforms] = useState(ALL_PLATFORMS);
  const [includeEmail, setIncludeEmail] = useState(true);
  const [urls, setUrls] = useState([]);
  const [images, setImages] = useState([]);
  const [generating, setGenerating] = useState(false);

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
        image_paths: images.map((img) => img.path)
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
                    {['engaging', 'playful', 'professional', 'bold', 'inspirational', 'urgent'].map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-base font-medium">Platforms</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3" data-testid="platform-checkboxes">
                  {ALL_PLATFORMS.map((p) => (
                    <label key={p} className={`flex items-center gap-3 border px-4 py-3 cursor-pointer transition-colors ${platforms.includes(p) ? 'border-accent bg-accent/5' : 'border-border hover:bg-stone-50'}`}>
                      <Checkbox checked={platforms.includes(p)} onCheckedChange={() => togglePlatform(p)} disabled={generating} className="rounded-none" data-testid={`platform-checkbox-${p}`} />
                      <span className="text-sm font-medium">{PLATFORM_META[p].label}</span>
                    </label>
                  ))}
                  <label className={`flex items-center gap-3 border px-4 py-3 cursor-pointer transition-colors ${includeEmail ? 'border-accent bg-accent/5' : 'border-border hover:bg-stone-50'}`}>
                    <Checkbox checked={includeEmail} onCheckedChange={(v) => setIncludeEmail(!!v)} disabled={generating} className="rounded-none" data-testid="platform-checkbox-email" />
                    <span className="text-sm font-medium">Email blast</span>
                  </label>
                </div>
              </div>

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
