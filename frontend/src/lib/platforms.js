export const PLATFORM_META = {
  facebook: { label: 'Facebook', color: 'bg-[#1877F2]' },
  instagram: { label: 'Instagram', color: 'bg-[#E1306C]' },
  linkedin: { label: 'LinkedIn', color: 'bg-[#0A66C2]' },
  twitter: { label: 'X / Twitter', color: 'bg-black' },
  tiktok: { label: 'TikTok', color: 'bg-[#010101]' },
  email: { label: 'Email', color: 'bg-stone-600' },
};

export const downloadText = (content, filename) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
