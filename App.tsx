
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Home from './pages/Home';
import ScriptsCatalog from './pages/ScriptsCatalog';
import ScriptDetail from './pages/ScriptDetail';
import About from './pages/About';
import Contact from './pages/Contact';
import AIAssistant from './components/AIAssistant';
import Admin from './pages/Admin';
import { SCRIPTS as DEFAULT_SCRIPTS } from './constants';
import { ScriptData } from './types';

const App: React.FC = () => {
  const [activePage, setActivePage] = useState('home');
  const [scripts, setScripts] = useState<ScriptData[]>(DEFAULT_SCRIPTS);

  // Load scripts from localStorage on mount to show edited content
  useEffect(() => {
    const savedScripts = localStorage.getItem('yosef_scripts_data');
    if (savedScripts) {
      try {
        setScripts(JSON.parse(savedScripts));
      } catch (e) {
        console.error("Failed to load saved scripts", e);
      }
    }
  }, []);

  // Listen for changes from Admin page
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('yosef_scripts_data');
      if (saved) setScripts(JSON.parse(saved));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const renderContent = () => {
    // Check if it's a dynamic script detail page
    const script = scripts.find(s => s.id === activePage);
    if (script) {
      return <ScriptDetail script={script} />;
    }

    switch (activePage) {
      case 'home':
        return <Home onNavigateToCatalog={() => setActivePage('scripts-catalog')} />;
      case 'scripts-catalog':
        return <ScriptsCatalog scripts={scripts} onSelectScript={(id) => setActivePage(id)} />;
      case 'about':
        return <About />;
      case 'contact':
        return <Contact />;
      case 'admin':
        return <Admin onDataUpdate={(updated) => setScripts(updated)} />;
      case 'assistant':
        return (
            <div className="animate-fadeIn max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold mb-8 text-center text-indigo-400">יועץ ה-AI של FOOTNOTE WIZARD</h1>
                <AIAssistant scripts={scripts} />
            </div>
        );
      default:
        return <Home onNavigateToCatalog={() => setActivePage('scripts-catalog')} />;
    }
  };

  return (
    <Layout activePage={activePage} setActivePage={setActivePage} scripts={scripts}>
      {renderContent()}
    </Layout>
  );
};

export default App;
