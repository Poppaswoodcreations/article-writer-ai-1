import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { PenLine, Trash2, Sparkles, FileText, Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { PLATFORM_META } from '@/lib/platforms';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const DeleteButton = ({ label, onConfirm, testId }) => (
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button variant="ghost" size="sm" className="hover:bg-stone-100 hover:text-destructive h-9 px-3 rounded-none" data-testid={testId}>
        <Trash2 className="w-4 h-4" />
      </Button>
    </AlertDialogTrigger>
    <AlertDialogContent className="rounded-none">
      <AlertDialogHeader>
        <AlertDialogTitle>Delete {label}</AlertDialogTitle>
        <AlertDialogDescription>Are you sure? This action cannot be undone.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel className="rounded-none">Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-none" data-testid="confirm-delete-button">Delete</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

const EmptyState = ({ icon: Icon, title, text, cta, onClick, testId }) => (
  <div className="flex flex-col items-center justify-center py-24" data-testid={testId}>
    <Icon className="w-24 h-24 text-muted-foreground mb-6" strokeWidth={1} />
    <h2 className="text-2xl font-normal text-foreground mb-2">{title}</h2>
    <p className="text-muted-foreground mb-8 text-center max-w-md">{text}</p>
    <Button onClick={onClick} className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 rounded-none" data-testid={`${testId}-cta`}>{cta}</Button>
  </div>
);

const ArticleCard = ({ article, onDelete, navigate }) => (
  <Card className="bg-card border border-border shadow-sm rounded-none p-6 hover:border-stone-400 transition-all duration-300 card-hover" data-testid={`article-card-${article.id}`}>
    <div onClick={() => navigate(`/editor/${article.id}`)} className="cursor-pointer">
      <h3 className="text-lg font-normal text-foreground mb-2 line-clamp-2" data-testid="article-title">{article.title}</h3>
      <p className="text-xs text-muted-foreground mb-4">{formatDate(article.created_at)}</p>
      <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{article.meta_description}</p>
      {article.keywords && (
        <div className="flex flex-wrap gap-2 mb-4">
          {article.keywords.split(',').slice(0, 3).map((k, i) => <span key={i} className="text-xs px-2 py-1 bg-secondary text-secondary-foreground">{k.trim()}</span>)}
        </div>
      )}
    </div>
    <Separator className="my-4" />
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={() => navigate(`/editor/${article.id}`)} className="flex-1 hover:bg-stone-100 h-9 px-3 rounded-none gap-2" data-testid="edit-article-button"><PenLine className="w-4 h-4" /> Edit</Button>
      <DeleteButton label="Article" onConfirm={() => onDelete(article.id)} testId="delete-article-button" />
    </div>
  </Card>
);

const CampaignCard = ({ campaign, onDelete, navigate }) => (
  <Card className="bg-card border border-border shadow-sm rounded-none p-6 hover:border-stone-400 transition-all duration-300 card-hover" data-testid={`campaign-card-${campaign.id}`}>
    <div onClick={() => navigate(`/campaigns/${campaign.id}`)} className="cursor-pointer">
      <h3 className="text-lg font-normal text-foreground mb-2 line-clamp-2" data-testid="campaign-name">{campaign.name}</h3>
      <p className="text-xs text-muted-foreground mb-4">{formatDate(campaign.created_at)}</p>
      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{campaign.topic}</p>
      <div className="flex flex-wrap gap-2 mb-2">
        {campaign.posts.map((p) => (
          <span key={p.platform} className="flex items-center gap-1.5 text-xs px-2 py-1 bg-secondary text-secondary-foreground">
            <span className={`w-1.5 h-1.5 ${PLATFORM_META[p.platform]?.color || 'bg-stone-500'}`} />{PLATFORM_META[p.platform]?.label || p.platform}
          </span>
        ))}
        {campaign.email_copy && <span className="text-xs px-2 py-1 bg-secondary text-secondary-foreground">Email</span>}
      </div>
    </div>
    <Separator className="my-4" />
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={() => navigate(`/campaigns/${campaign.id}`)} className="flex-1 hover:bg-stone-100 h-9 px-3 rounded-none gap-2" data-testid="edit-campaign-button"><PenLine className="w-4 h-4" /> Edit</Button>
      <DeleteButton label="Campaign" onConfirm={() => onDelete(campaign.id)} testId="delete-campaign-button" />
    </div>
  </Card>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'campaigns' ? 'campaigns' : 'articles';
  const [articles, setArticles] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [a, c] = await Promise.all([axios.get(`${API}/articles`), axios.get(`${API}/campaigns`)]);
      setArticles(a.data);
      setCampaigns(c.data);
    } catch {
      toast.error('Failed to load content');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const remove = async (kind, id) => {
    try {
      await axios.delete(`${API}/${kind}/${id}`);
      toast.success(`${kind === 'articles' ? 'Article' : 'Campaign'} deleted`);
      fetchAll();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const isArticles = tab === 'articles';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 md:px-12 py-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-medium tracking-tight text-primary" data-testid="dashboard-title">Content Studio</h1>
            <p className="text-sm text-muted-foreground mt-1">SEO articles and social campaigns, written with AI</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate('/campaigns/new')} className="h-10 px-5 rounded-none border-border hover:bg-stone-100 gap-2" data-testid="new-campaign-button">
              <Megaphone className="w-4 h-4" /> New Campaign
            </Button>
            <Button onClick={() => navigate('/generate')} className="bg-accent text-accent-foreground hover:bg-accent/90 h-10 px-6 rounded-none font-medium gap-2" data-testid="new-article-button">
              <Sparkles className="w-4 h-4" /> New Article
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 md:px-12 py-12">
        <Tabs value={tab} onValueChange={(v) => setParams(v === 'campaigns' ? { tab: 'campaigns' } : {})} className="mb-10">
          <TabsList className="rounded-none h-12 bg-muted">
            <TabsTrigger value="articles" className="rounded-none px-6" data-testid="articles-tab">Articles <span className="ml-2 text-muted-foreground">({articles.length})</span></TabsTrigger>
            <TabsTrigger value="campaigns" className="rounded-none px-6" data-testid="campaigns-tab">Campaigns <span className="ml-2 text-muted-foreground">({campaigns.length})</span></TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{[1, 2, 3].map((i) => <div key={i} className="h-64 bg-muted shimmer" />)}</div>
        ) : isArticles ? (
          articles.length === 0 ? (
            <EmptyState icon={FileText} title="No articles yet" text="Generate SEO-optimized articles from a topic, reference URLs and images." cta="Create Your First Article" onClick={() => navigate('/generate')} testId="empty-state" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="articles-grid">
              {articles.map((a) => <ArticleCard key={a.id} article={a} navigate={navigate} onDelete={(id) => remove('articles', id)} />)}
            </div>
          )
        ) : campaigns.length === 0 ? (
          <EmptyState icon={Megaphone} title="No campaigns yet" text="Write Facebook, Instagram, LinkedIn, X and TikTok posts plus an email in one go." cta="Create Your First Campaign" onClick={() => navigate('/campaigns/new')} testId="campaigns-empty-state" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="campaigns-grid">
            {campaigns.map((c) => <CampaignCard key={c.id} campaign={c} navigate={navigate} onDelete={(id) => remove('campaigns', id)} />)}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
