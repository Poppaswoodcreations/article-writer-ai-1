import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, Loader2, Presentation, FolderDown } from 'lucide-react';
import { toast } from 'sonner';
import { ExportDialog } from '@/components/ExportDialog';
import { PostCard } from '@/components/PostCard';
import { RegeneratePopover, SchedulePicker } from '@/components/PostTools';
import { GraphicDialog } from '@/components/GraphicDialog';
import { SchedulePanel } from '@/components/SchedulePanel';
import { BulkGraphicsDialog } from '@/components/BulkGraphicsDialog';
import { downloadText, downloadBlob } from '@/lib/platforms';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const EXPORT_OPTIONS = [
  { format: 'txt', label: 'Plain Text', hint: 'Ready to paste into Facebook, TikTok, etc.' },
  { format: 'markdown', label: 'Markdown', hint: 'Formatted with headings per platform' },
  { format: 'html', label: 'HTML', hint: 'Web page with every post' },
];
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'campaign';

const CampaignEditor = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [deckBusy, setDeckBusy] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    axios.get(`${API}/campaigns/${id}`)
      .then((res) => setCampaign(res.data))
      .catch(() => { toast.error('Failed to load campaign'); navigate('/?tab=campaigns'); })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const updatePost = (idx, fields) => { setDirty(true); setCampaign((c) => ({ ...c, posts: c.posts.map((p, i) => (i === idx ? { ...p, ...fields } : p)) })); };

  const handleSave = async () => {
    try {
      setSaving(true);
      await axios.put(`${API}/campaigns/${id}`, { name: campaign.name, posts: campaign.posts, email_copy: campaign.email_copy });
      setDirty(false);
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

  const downloadDeck = async () => {
    try {
      setDeckBusy(true);
      const res = await axios.get(`${API}/campaigns/${id}/deck.pdf`, { responseType: 'blob' });
      downloadBlob(res.data, `${slugify(campaign.name)}-deck.pdf`);
      toast.success('Deck downloaded');
    } catch {
      toast.error('Failed to build deck');
    } finally {
      setDeckBusy(false);
    }
  };

  const downloadZip = async () => {
    try {
      setZipBusy(true);
      const res = await axios.get(`${API}/campaigns/${id}/graphics.zip`, { responseType: 'blob' });
      downloadBlob(res.data, `${slugify(campaign.name)}-graphics.zip`);
      toast.success('Graphics downloaded');
    } catch {
      toast.error('No graphics to download yet');
    } finally {
      setZipBusy(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
  if (!campaign) return null;
  const slug = slugify(campaign.name);
  const graphicCount = campaign.posts.filter((p) => p.graphic_path).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 md:px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/?tab=campaigns')} className="hover:bg-stone-100 h-10 px-3 rounded-none" data-testid="back-button"><ArrowLeft className="w-5 h-5" /></Button>
            <h1 className="text-xl font-medium tracking-tight text-primary" data-testid="campaign-editor-title">Edit Campaign</h1>
          </div>
          <div className="flex items-center gap-3">
            <BulkGraphicsDialog campaignId={id} posts={campaign.posts} imagePaths={campaign.image_paths || []} onDone={(posts) => setCampaign((c) => ({ ...c, posts }))} />
            <Button variant="outline" onClick={downloadZip} disabled={zipBusy || !graphicCount} title={graphicCount ? `${graphicCount} graphics` : 'Create graphics first'} className="h-10 px-4 rounded-none border-border hover:bg-stone-100 gap-2" data-testid="graphics-zip-button">
              {zipBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderDown className="w-4 h-4" />} Graphics ZIP{graphicCount ? ` (${graphicCount})` : ''}
            </Button>
            <Button variant="outline" onClick={downloadDeck} disabled={deckBusy} className="h-10 px-4 rounded-none border-border hover:bg-stone-100 gap-2" data-testid="campaign-deck-button">
              {deckBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Presentation className="w-4 h-4" />} Deck (PDF)
            </Button>
            <ExportDialog open={exportOpen} onOpenChange={setExportOpen} title="Export Campaign" description="Download every post in one file" options={EXPORT_OPTIONS} onExport={handleExport} testIdPrefix="campaign-export" triggerLabel="Export All" />
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

          <SchedulePanel campaignId={id} posts={campaign.posts} unsaved={dirty} />

          {campaign.posts.map((post, idx) => (
            <PostCard key={post.platform} platform={post.platform} value={post.content} hashtags={post.hashtags} slug={slug}
              onChange={(v) => updatePost(idx, { content: v })} onHashtagsChange={(v) => updatePost(idx, { hashtags: v })}
              tools={(
                <>
                  <RegeneratePopover campaignId={id} platform={post.platform} onDone={(p) => updatePost(idx, { content: p.content, hashtags: p.hashtags })} />
                  <SchedulePicker platform={post.platform} value={post.scheduled_at} onChange={(v) => updatePost(idx, { scheduled_at: v })} />
                  <GraphicDialog campaignId={id} platform={post.platform} post={post} imagePaths={campaign.image_paths || []} onCreated={(path) => updatePost(idx, { graphic_path: path })} />
                </>
              )} />
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
