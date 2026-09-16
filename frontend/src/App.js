import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import Dashboard from './pages/Dashboard';
import ArticleGenerator from './pages/ArticleGenerator';
import ArticleEditor from './pages/ArticleEditor';
import CampaignGenerator from './pages/CampaignGenerator';
import CampaignEditor from './pages/CampaignEditor';
import './App.css';

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/generate" element={<ArticleGenerator />} />
          <Route path="/editor/:id" element={<ArticleEditor />} />
          <Route path="/campaigns/new" element={<CampaignGenerator />} />
          <Route path="/campaigns/:id" element={<CampaignEditor />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;