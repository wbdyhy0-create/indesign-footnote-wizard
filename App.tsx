import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Home from './pages/Home';
import ScriptsCatalog from './pages/ScriptsCatalog';
import ScriptDetail from './pages/ScriptDetail';
import About from './pages/About';
import Contact from './pages/Contact';
import Admin from './pages/Admin';
import { SCRIPTS as DEFAULT_SCRIPTS } from './constants';
import { ScriptData } from './types';

// כל פעם שמעדכנים את constants.tsx, יש להעלות את המספר הזה ב-1
const SCRIPTS_VERSION = '2';

const App: React.FC = () => {
  const [activePage, setActivePage] = useState('home');
  const [scripts, setScripts] = useState<ScriptData[]>(DEFAULT_SCRIPTS);

  useEffect(() => {
    const savedVersion = localStorage.getItem('yosef_scripts_version');
    
    // אם הגרסה ישנה או לא קיימת - טען מ-constants ואפס את localStorage
    if (savedVersion !== SCRIPTS_VERSION) {
      localStorage.setItem('yosef_scripts_data', JSON.stringify(DEFAULT_SCRIPTS));
      localStorage.setItem('yosef_scripts_version', SCRIPTS_VERSION);
      setScripts(DEFAULT_SCRIPTS);
      return;
    }

    // אחרת טען מ-localStorage
    const savedScripts = localStorage.getItem('yosef_scripts_data');
    if (savedScripts) {
      try {
        setScripts(JSON.parse(savedScripts));
      } catch (e) {
        console.error("Failed to load saved scripts", e);
        setScripts(DEFAULT_SCRIPTS);
      }
    }
  }, []);

  const renderContent = () => {
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