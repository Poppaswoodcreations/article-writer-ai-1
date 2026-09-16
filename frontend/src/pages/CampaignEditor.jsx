import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Save, Download, Loader2, Copy, FileText, Code, AlignLeft } from 'lucide-react';
import { toast } from 'sonner';
import { PLATFORM_META, downloadText } from '@/lib/platforms';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PostCard = ({ platform, value, hashtags, onChange, onHashtagsChange, slug }) => {
  const meta = PLATFORM_META[platform] || { label: platform, color: 'bg-stone-500' };
  const fullText = hashtags !== undefined ? `${value}\n\n${hashtags}`.trim() : value;
  const copy = async () => {
    await navigator.clipboard.writeText(fullText);
    toast.success(`${meta.label} post copied`);
  };
  return (
    <Card className="bg-card border border-border shadow-sm rounded-none p-6" data-testid={`post-card-${platform}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className={`w-2.5 h-2.5 ${meta.color}`} />
          <h3 className="text-lg font-medium">{meta.label}</h3>
          <span className="text-xs text-muted-foreground">{value.length} chars</span>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={copy} className="h-9 px-3 rounded-none hover:bg-stone-100 gap-2" data-testid={`copy-post-${platform}`}>
            <Copy className="w-4 h-4" /> Copy
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => downloadText(fullText, `${slug}-${platform}.txt`)} className="h-9 px-3 rounded-none gap-2" data-testid={`download-post-${platform}`}>
            <Download className="w-4 h-4" /> Download
          </Button>
        </div>
      </div>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} className="min-h-[180px] rounded-none border-input" style={{ lineHeight: '1.7' }} data-testid={`post-content-${platform}`} />
      {hashtags !== undefined && (
        <Input value={hashtags} onChange={(e) => onHashtagsChange(e.target.value)} placeholder="#hashtags" className="mt-3 h-10 rounded-none font-mono text-sm" data-testid={`post-hashtags-${platform}`} />
      )}
    </Card>
  );
};

const CampaignEditor = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    axios.get(`${API}/campaigns/${id}`)
      .then((r) => setCampaign(r.data))
      .catch(() => { toast.error('Failed to load campaign'); navigate('/?tab=campaigns'); })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const updatePost = (idx, patch) => setCampaign((c) => ({ ...c, posts: c.posts.map((p, i) => (i === idx ? { ...p, ...patch } : p)) }));

  const handleSave = async () => {
    try {
      setSaving(true);
      await axios.put(`${API}/campaigns/${id}`, { name: campaign.name, posts: campaign.posts, email_copy: campaign.email_copy });
      toast.success('Campaign saved');
    } catch {
      toast.error('Failed to save campaign');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (format) => {
    try {
      const { data } = await axios.get(`${API}/campaigns/${id}/export/${format}`);
      downloadText(data.content, data.filename);
      toast.success(`Campaign exported as ${format}`);
      setExportOpen(false);
    } catch {
      toast.error('Failed to export campaign');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
  if (!campaign) return null;
  const slug = campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'campaign';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 md:px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/?tab=campaigns')} className="hover:bg-stone-100 h-10 px-3 rounded-none" data-testid="back-button">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-medium tracking-tight text-primary" data-testid="campaign-editor-title">Edit Campaign</h1>
          </div>
          <div className="flex items-center gap-3">
            <Dialog open={exportOpen} onOpenChange={setExportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-10 px-4 rounded-none gap-2" data-testid="campaign-export-button"><Download className="w-4 h-4" /> Export All</Button>
              </DialogTrigger>
              <DialogContent className="rounded-none">
                <DialogHeader>
                  <DialogTitle>Export Campaign</DialogTitle>
                  <DialogDescription>Download every post in one file</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 pt-4">
                  {[['txt', AlignLeft, 'Plain Text', 'Ready to paste into Facebook, TikTok, etc.'], ['markdown', FileText, 'Markdown', 'Formatted with headings per platform'], ['html', Code, 'HTML', 'Web page with every post']].map(([f, Icon, title, desc]) => (
                    <Button key={f} onClick={() => handleExport(f)} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 h-12 rounded-none justify-start gap-3" data-testid={`campaign-export-${f}-button`}>
                      <Icon className="w-5 h-5" />
                      <div className="text-left"><div className="font-medium">{title}</div><div className="text-xs opacity-70">{desc}</div></div>
                    </Button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
            <Button onClick={handleSave} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent/90 h-10 px-6 rounded-none gap-2" data-testid="campaign-save-button">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 md:px-12 py-12">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <Label htmlFor="c-name" className="text-base font-medium">Campaign Name</Label>
            <Input id="c-name" value={campaign.name} onChange={(e) => setCampaign({ ...campaign, name: e.target.value })} className="mt-2 h-14 text-2xl rounded-none" style={{ fontFamily: 'Playfair Display, serif' }} data-testid="campaign-name-input" />
            <p className="text-xs text-muted-foreground mt-2">Topic: {campaign.topic}{campaign.goal ? ` · Goal: ${campaign.goal}` : ''}</p>
          </div>

          {campaign.posts.map((post, idx) => (
            <PostCard key={post.platform} platform={post.platform} value={post.content} hashtags={post.hashtags} slug={slug}
              onChange={(v) => updatePost(idx, { content: v })} onHashtagsChange={(v) => updatePost(idx, { hashtags: v })} />
          ))}

          {campaign.email_copy && (
            <PostCard platform="email" value={campaign.email_copy} slug={slug} onChange={(v) => setCampaign({ ...campaign, email_copy: v })} />
          )}
        </div>
      </main>
    </div>
  );
};

export default CampaignEditor;
