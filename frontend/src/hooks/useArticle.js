import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { downloadText, downloadBlob } from '@/lib/platforms';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BINARY_FORMATS = ['docx', 'pdf'];

export const useArticle = (id, onMissing) => {
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchArticle = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/articles/${id}`);
      setArticle(response.data);
    } catch {
      toast.error('Failed to load article');
      onMissing();
    } finally {
      setLoading(false);
    }
  }, [id, onMissing]);

  useEffect(() => { fetchArticle(); }, [fetchArticle]);

  const patch = (fields) => setArticle((a) => ({ ...a, ...fields }));

  const save = async () => {
    try {
      setSaving(true);
      const { title, content, meta_title, meta_description, url_slug } = article;
      await axios.put(`${API}/articles/${id}`, { title, content, meta_title, meta_description, url_slug });
      toast.success('Article saved successfully');
    } catch {
      toast.error('Failed to save article');
    } finally {
      setSaving(false);
    }
  };

  const exportAs = async (format) => {
    try {
      setExporting(true);
      if (BINARY_FORMATS.includes(format)) {
        const res = await axios.get(`${API}/articles/${id}/download/${format}`, { responseType: 'blob' });
        downloadBlob(res.data, `${article.url_slug || 'article'}.${format}`);
      } else {
        const { data } = await axios.get(`${API}/articles/${id}/export/${format}`);
        downloadText(data.content, data.filename);
      }
      toast.success(`Article exported as ${format}`);
      return true;
    } catch {
      toast.error('Failed to export article');
      return false;
    } finally {
      setExporting(false);
    }
  };

  return { article, loading, saving, exporting, patch, save, exportAs };
};
