import React from 'react';

const STEPS = [
  { title: 'Enter Topic', text: 'Provide your topic, optional keywords, reference URLs and images' },
  { title: 'AI Generation', text: 'Claude Sonnet creates a comprehensive, SEO-optimized article from your inputs' },
  { title: 'Edit & Export', text: 'Review, edit, preview and export your article in multiple formats' },
];

export const HowItWorks = () => (
  <div className="mt-12 space-y-6">
    <h2 className="text-2xl font-normal text-foreground">How It Works</h2>
    <div className="grid md:grid-cols-3 gap-6">
      {STEPS.map((step, i) => (
        <div key={step.title} className="bg-card border border-border p-6 rounded-none">
          <div className="w-12 h-12 bg-accent/10 flex items-center justify-center mb-4">
            <span className="text-2xl font-medium text-accent">{i + 1}</span>
          </div>
          <h3 className="text-lg font-medium mb-2">{step.title}</h3>
          <p className="text-sm text-muted-foreground">{step.text}</p>
        </div>
      ))}
    </div>
  </div>
);
