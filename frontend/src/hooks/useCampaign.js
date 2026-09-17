import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { downloadText, downloadBlob } from '@/lib/platforms';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'campaign';

export const useCampaign = (id, onMissing) => {
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState({});

  useEffect(() => {
    axios.get(`${API}/campaigns/${id}`)
      .then((res) => setCampaign(res.data))
      .catch(() => { toast.error('Failed to load campaign'); onMissing(); })
      .finally(() => setLoading(false));
  }, [id, onMissing]);

  const withBusy = async (key, fn, errorMsg) => {
    try {
      setBusy((b) => ({ ...b, [key]: true }));
      await fn();
    } catch {
      toast.error(errorMsg);
    } finally {
      setBusy((b) => ({ ...b, [key]: false }));
    }
  };

  const updatePost = (idx, fields) => {
    setDirty(true);
    setCampaign((c) => ({ ...c, posts: c.posts.map((p, i) => (i === idx ? { ...p, ...fields } : p)) }));
  };

  const setPosts = (posts) => setCampaign((c) => ({ ...c, posts }));
  const patch = (fields) => { setDirty(true); setCampaign((c) => ({ ...c, ...fields })); };

  const save = () => withBusy('save', async () => {
    await axios.put(`${API}/campaigns/${id}`, { name: campaign.name, posts: campaign.posts, email_copy: campaign.email_copy });
    setDirty(false);
    toast.success('Campaign saved');
  }, 'Failed to save campaign');

  const exportAs = (format) => withBusy('export', async () => {
    const { data } = await axios.get(`${API}/campaigns/${id}/export/${format}`);
    downloadText(data.content, data.filename);
    toast.success(`Campaign exported as ${format}`);
  }, 'Failed to export campaign');

  const downloadFile = (key, path, filename, successMsg, errorMsg) => withBusy(key, async () => {
    const res = await axios.get(`${API}/campaigns/${id}/${path}`, { responseType: 'blob' });
    downloadBlob(res.data, filename);
    toast.success(successMsg);
  }, errorMsg);

  const slug = campaign ? slugify(campaign.name) : 'campaign';
  const downloadDeck = () => downloadFile('deck', 'deck.pdf', `${slug}-deck.pdf`, 'Deck downloaded', 'Failed to build deck');
  const downloadZip = () => downloadFile('zip', 'graphics.zip', `${slug}-graphics.zip`, 'Graphics downloaded', 'No graphics to download yet');

  return { campaign, loading, dirty, busy, slug, updatePost, setPosts, patch, save, exportAs, downloadDeck, downloadZip };
};
