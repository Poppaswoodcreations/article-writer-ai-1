import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { PenLine, Trash2, Eye, Sparkles, FileText } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = () => {
  const navigate = useNavigate();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/articles`);
      setArticles(response.data);
    } catch (error) {
      console.error('Error fetching articles:', error);
      toast.error('Failed to load articles');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (articleId) => {
    try {
      await axios.delete(`${API}/articles/${articleId}`);
      toast.success('Article deleted successfully');
      fetchArticles();
    } catch (error) {
      console.error('Error deleting article:', error);
      toast.error('Failed to delete article');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 md:px-12 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-medium tracking-tight text-primary" data-testid="dashboard-title">
                Article Writer
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Create SEO-optimized content with AI</p>
            </div>
            <Button
              onClick={() => navigate('/generate')}
              className="bg-accent text-accent-foreground hover:bg-accent/90 h-10 px-6 rounded-none font-medium tracking-wide transition-all duration-300 flex items-center gap-2"
              data-testid="new-article-button"
            >
              <Sparkles className="w-4 h-4" />
              New Article
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 md:px-12 py-12">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-muted shimmer" />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24" data-testid="empty-state">
            <FileText className="w-24 h-24 text-muted-foreground mb-6" strokeWidth={1} />
            <h2 className="text-2xl font-normal text-foreground mb-2">No articles yet</h2>
            <p className="text-muted-foreground mb-8 text-center max-w-md">
              Start creating SEO-optimized articles with AI. Click the button above to generate your first article.
            </p>
            <Button
              onClick={() => navigate('/generate')}
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 rounded-none font-medium transition-all duration-300"
              data-testid="empty-new-article-button"
            >
              Create Your First Article
            </Button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-normal text-foreground">
                Your Articles <span className="text-muted-foreground">({articles.length})</span>
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.map((article) => (
                <Card
                  key={article.id}
                  className="bg-card border border-border shadow-sm rounded-none p-6 hover:border-stone-400 transition-all duration-300 card-hover cursor-pointer"
                  data-testid={`article-card-${article.id}`}
                >
                  <div onClick={() => navigate(`/editor/${article.id}`)}>
                    <h3 className="text-lg font-normal text-foreground mb-2 line-clamp-2" data-testid="article-title">
                      {article.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      {formatDate(article.created_at)}
                    </p>
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                      {article.meta_description}
                    </p>
                    {article.keywords && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {article.keywords.split(',').slice(0, 3).map((keyword, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-1 bg-secondary text-secondary-foreground"
                          >
                            {keyword.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <Separator className="my-4" />
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/editor/${article.id}`)}
                      className="flex-1 hover:bg-stone-100 h-9 px-3 rounded-none transition-all duration-300 flex items-center justify-center gap-2"
                      data-testid="edit-article-button"
                    >
                      <PenLine className="w-4 h-4" />
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="hover:bg-stone-100 hover:text-destructive h-9 px-3 rounded-none transition-all duration-300"
                          data-testid="delete-article-button"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-none">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Article</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this article? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-none">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(article.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-none"
                            data-testid="confirm-delete-button"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;