import React, { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { PostCard } from '@/components/PostCard';
import { RegeneratePopover, SchedulePicker } from '@/components/PostTools';
import { GraphicDialog } from '@/components/GraphicDialog';
import { SchedulePanel } from '@/components/SchedulePanel';
import { CampaignHeader } from '@/components/CampaignHeader';
import { useCampaign } from '@/hooks/useCampaign';

const CampaignEditor = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const goBack = useCallback(() => navigate('/?tab=campaigns'), [navigate]);
  const { campaign, loading, dirty, busy, slug, updatePost, setPosts, patch, save, exportAs, downloadDeck, downloadZip } = useCampaign(id, goBack);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
  if (!campaign) return null;

  const postTools = (post, idx) => (
    <>
      <RegeneratePopover campaignId={id} platform={post.platform} onDone={(p) => updatePost(idx, { content: p.content, hashtags: p.hashtags })} />
      <SchedulePicker platform={post.platform} value={post.scheduled_at} onChange={(v) => updatePost(idx, { scheduled_at: v })} />
      <GraphicDialog campaignId={id} platform={post.platform} post={post} imagePaths={campaign.image_paths || []} onCreated={(path) => updatePost(idx, { graphic_path: path })} />
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <CampaignHeader id={id} campaign={campaign} busy={busy} onBack={goBack} onSave={save} onExport={exportAs} onDeck={downloadDeck} onZip={downloadZip} onPostsUpdated={setPosts} />

      <main className="container mx-auto px-6 md:px-12 py-12">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <Label htmlFor="c-name" className="text-base font-medium">Campaign Name</Label>
            <Input id="c-name" value={campaign.name} onChange={(e) => patch({ name: e.target.value })} className="mt-2 h-14 text-2xl rounded-none" style={{ fontFamily: 'Playfair Display, serif' }} data-testid="campaign-name-input" />
            <p className="text-xs text-muted-foreground mt-2">Topic: {campaign.topic}{campaign.goal ? ` · Goal: ${campaign.goal}` : ''}</p>
          </div>

          <SchedulePanel campaignId={id} posts={campaign.posts} unsaved={dirty} />

          {campaign.posts.map((post, idx) => (
            <PostCard key={post.platform} platform={post.platform} value={post.content} hashtags={post.hashtags} slug={slug}
              onChange={(v) => updatePost(idx, { content: v })} onHashtagsChange={(v) => updatePost(idx, { hashtags: v })} tools={postTools(post, idx)} />
          ))}

          {campaign.email_copy && (
            <PostCard platform="email" value={campaign.email_copy} slug={slug} onChange={(v) => patch({ email_copy: v })} />
          )}
        </div>
      </main>
    </div>
  );
};

export default CampaignEditor;
