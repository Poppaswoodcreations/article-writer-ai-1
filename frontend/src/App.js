import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import Dashboard from './pages/Dashboard';
import ArticleGenerator from './pages/ArticleGenerator';
import ArticleEditor from './pages/ArticleEditor';
import './App.css';

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/generate" element={<ArticleGenerator />} />
          <Route path="/editor/:id" element={<ArticleEditor />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;