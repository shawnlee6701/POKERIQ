import React, { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';

interface SecondaryPageProps {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}

export const SecondaryPage: React.FC<SecondaryPageProps> = ({ title, onBack, children }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <header className="bg-surface-dim/80 backdrop-blur-md fixed top-0 left-0 w-full z-50 border-b border-white/5">
        <div className="max-w-md mx-auto w-full flex items-center px-4 pt-[env(safe-area-inset-top)] h-[calc(4rem+env(safe-area-inset-top))]">
          <button 
            onClick={onBack}
            className="p-2 mr-2 text-on-surface hover:bg-white/5 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-on-surface text-xl font-headline font-bold uppercase tracking-tight truncate">
            {title}
          </h1>
        </div>
      </header>

      <main className="mt-[calc(5rem+env(safe-area-inset-top))] px-6 pb-12 max-w-2xl mx-auto w-full">
        <div className="bg-surface-container rounded-3xl p-6 border border-white/5 shadow-xl">
          {children}
        </div>
      </main>
    </div>
  );
};
