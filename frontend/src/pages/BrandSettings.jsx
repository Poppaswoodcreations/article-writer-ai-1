import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Loader2, Upload, Palette, X } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const CORNERS = [['top-left', 'Top left'], ['top-right', 'Top right'], ['bottom-left', 'Bottom left'], ['bottom-right', 'Bottom right']];

const ColorField = ({ id, label, value, onChange, hint }) => (
  <div>
    <Label htmlFor={id} className="text-base font-medium">{label}</Label>
    <div className="flex items-center gap-3 mt-2">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="w-12 h-12 border border-border cursor-pointer bg-transparent" data-testid={`${id}-picker`} />
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-12 rounded-none font-mono w-40" data-testid={`${id}-input`} />
    </div>
    <p className="text-xs text-muted-foreground mt-2">{hint}</p>
  </div>
);

const BrandPreview = ({ brand, logoUrl }) => (
  <div className="relative aspect-[1200/630] bg-stone-700 overflow-hidden" data-testid="brand-preview" style={{ background: 'linear-gradient(180deg,#6b4b3a 0%,#1a1a1f 100%)' }}>
    {logoUrl && <img src={logoUrl} alt="logo" className={`absolute w-[16%] ${brand.logo_corner.includes('top') ? 'top-[7%]' : 'bottom-[7%]'} ${brand.logo_corner.includes('left') ? 'left-[7%]' : 'right-[7%]'}`} />}
    <div className="absolute left-[7%] right-[7%] bottom-[14%]">
      <div className="h-1 w-[10%] mb-3" style={{ background: brand.accent_color }} />
      <div className="text-white font-bold leading-tight" style={{ fontSize: 'clamp(14px, 2.6vw, 30px)' }}>Your headline lands here, on-brand every time</div>
      <div className="mt-2 text-xs font-semibold" style={{ color: brand.primary_color }}>{brand.handle || '@yourbrand'}</div>
    </div>
  </div>
);

const BrandSettings = () => {
  const navigate = useNavigate();
  const [brand, setBrand] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    axios.get(`${API}/brand`).then((r) => setBrand(r.data)).catch(() => toast.error('Failed to load brand kit'));
  }, []);

  const patch = (fields) => setBrand((b) => ({ ...b, ...fields }));

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await axios.post(`${API}/upload-image`, formData);
      patch({ logo_path: data.url.replace('/api/files/', '') });
      toast.success('Logo uploaded');
    } catch {
      toast.error('Logo upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async () => {
    try {
      setSaving(true);
      const { data } = await axios.put(`${API}/brand`, brand);
      setBrand(data);
      toast.success('Brand kit saved — new graphics will use it');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save brand kit');
    } finally {
      setSaving(false);
    }
  };

  if (!brand) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
  const logoUrl = brand.logo_path ? `${BACKEND_URL}/api/files/${brand.logo_path}` : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 md:px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/')} className="hover:bg-stone-100 h-10 px-3 rounded-none" data-testid="back-button"><ArrowLeft className="w-5 h-5" /></Button>
            <div>
              <h1 className="text-xl font-medium tracking-tight text-primary flex items-center gap-2" data-testid="brand-title"><Palette className="w-5 h-5" /> Brand Kit</h1>
              <p className="text-xs text-muted-foreground">Applied automatically to every campaign graphic</p>
            </div>
          </div>
          <Button onClick={save} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent/90 h-10 px-6 rounded-none gap-2" data-testid="brand-save-button">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-6 md:px-12 py-12">
        <div className="max-w-5xl mx-auto grid lg:grid-cols-[1fr_1.1fr] gap-10">
          <Card className="bg-card border border-border shadow-sm rounded-none p-8 space-y-8">
            <div>
              <Label htmlFor="brand-name" className="text-base font-medium">Brand name</Label>
              <Input id="brand-name" value={brand.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Acme Coffee Co." className="mt-2 h-12 rounded-none" data-testid="brand-name-input" />
            </div>
            <div>
              <Label htmlFor="brand-handle" className="text-base font-medium">Handle</Label>
              <Input id="brand-handle" value={brand.handle} onChange={(e) => patch({ handle: e.target.value })} placeholder="@acmecoffee" className="mt-2 h-12 rounded-none" data-testid="brand-handle-input" />
              <p className="text-xs text-muted-foreground mt-2">Shown as the footer on every graphic</p>
            </div>
            <ColorField id="accent-color" label="Accent color" value={brand.accent_color} onChange={(v) => patch({ accent_color: v })} hint="Used for the headline bar" />
            <ColorField id="primary-color" label="Text accent color" value={brand.primary_color} onChange={(v) => patch({ primary_color: v })} hint="Used for the handle text" />

            <div>
              <Label className="text-base font-medium">Logo</Label>
              <div className="flex items-center gap-4 mt-2">
                <div className="w-24 h-24 border border-border bg-stone-100 flex items-center justify-center overflow-hidden" data-testid="brand-logo-preview">
                  {logoUrl ? <img src={logoUrl} alt="logo" className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-muted-foreground">No logo</span>}
                </div>
                <div className="space-y-2">
                  <input ref={fileRef} type="file" accept="image/png,image/webp,image/jpeg" className="hidden" id="brand-logo" onChange={uploadLogo} data-testid="brand-logo-input" />
                  <label htmlFor="brand-logo" className="inline-flex items-center gap-2 border border-border px-4 h-10 text-sm cursor-pointer hover:bg-stone-50">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {logoUrl ? 'Replace logo' : 'Upload logo'}
                  </label>
                  {logoUrl && <Button type="button" variant="ghost" size="sm" onClick={() => patch({ logo_path: null })} className="rounded-none h-8 gap-1 text-muted-foreground" data-testid="brand-logo-remove"><X className="w-3 h-3" /> Remove</Button>}
                  <p className="text-xs text-muted-foreground">PNG with transparent background works best</p>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-base font-medium">Logo position</Label>
              <Select value={brand.logo_corner} onValueChange={(v) => patch({ logo_corner: v })}>
                <SelectTrigger className="mt-2 h-12 rounded-none" data-testid="brand-corner-select"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-none">
                  {CORNERS.map(([v, l]) => <SelectItem key={v} value={v} data-testid={`brand-corner-${v}`}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </Card>

          <div className="space-y-4">
            <h2 className="text-lg font-medium">Live preview</h2>
            <BrandPreview brand={brand} logoUrl={logoUrl} />
            <p className="text-sm text-muted-foreground">This is how the headline bar, handle and logo will sit on a Facebook-sized graphic. Real graphics use your uploaded photo behind it.</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default BrandSettings;
