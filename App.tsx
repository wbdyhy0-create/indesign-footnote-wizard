import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Home from './pages/Home';
import ScriptsCatalog from './pages/ScriptsCatalog';
import ScriptDetail from './pages/ScriptDetail';
import About from './pages/About';
import Contact from './pages/Contact';
import Admin from './pages/Admin';
import OtherProducts from './pages/OtherProducts';
import TorahCovers from './pages/TorahCovers';
import ProductDetail from './pages/ProductDetail'; // ייבוא של דף הפירוט החדש
import { SCRIPTS as DEFAULT_SCRIPTS, OTHER_PRODUCTS as DEFAULT_PRODUCTS, TORAH_COVER_DESIGNS as DEFAULT_COVERS } from './constants';
import { ScriptData } from './types';

const SCRIPTS_VERSION = '2';

const App: React.FC = () => {
  const [activePage, setActivePage] = useState('home');
  const [scripts, setScripts] = useState<ScriptData[]>(DEFAULT_SCRIPTS);
  
  // טעינת המוצרים פעם אחת (הגרסה שתישמר היא זו מהמנהל אם קיימת)
  const [products] = useState<any[]>(() => {
    const savedProducts = typeof window !== 'undefined'
      ? localStorage.getItem('yosef_admin_products_backup')
      : null;
    return savedProducts ? JSON.parse(savedProducts) : DEFAULT_PRODUCTS;
  });

  const [covers] = useState<any[]>(() => {
    const savedCovers = typeof window !== 'undefined'
      ? localStorage.getItem('yosef_admin_covers_backup')
      : null;
    return savedCovers ? JSON.parse(savedCovers) : DEFAULT_COVERS;
  });

  useEffect(() => {
    const savedVersion = localStorage.getItem('yosef_scripts_version');
    
    if (savedVersion !== SCRIPTS_VERSION) {
      localStorage.setItem('yosef_scripts_data', JSON.stringify(DEFAULT_SCRIPTS));
      localStorage.setItem('yosef_scripts_version', SCRIPTS_VERSION);
      setScripts(DEFAULT_SCRIPTS);
      return;
    }

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
    // 1. בדיקה אם הגולש לוחץ על סקריפט
    const script = scripts.find(s => s.id === activePage);
    if (script) {
      return <ScriptDetail product={script} onBack={() => setActivePage('scripts-catalog')} />;
    }

    // 2. בדיקה אם הגולש לוחץ על מוצר (התוספת החדשה שלנו!)
    // תמיד קוראים את המוצרים העדכניים מ-localStorage כדי ששינויים במנהל יופיעו מיד
    let productsSource = products;
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('yosef_admin_products_backup');
        if (saved) productsSource = JSON.parse(saved);
      } catch {
        productsSource = products;
      }
    }
    const product = productsSource.find((p: any) => p.id === activePage);
    if (product) {
      // אם כן, פתח את דף הפירוט והעבר לו את נתוני המוצר
      return <ProductDetail product={product} onBack={() => setActivePage('other-products')} />;
    }

    let coversSource = covers;
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('yosef_admin_covers_backup');
        if (saved) coversSource = JSON.parse(saved);
      } catch {
        coversSource = covers;
      }
    }
    const cover = coversSource.find((c: any) => c.id === activePage);
    if (cover) {
      return <ProductDetail product={cover} onBack={() => setActivePage('torah-covers')} />;
    }

    // 3. ניווט כללי של האתר
    switch (activePage) {
      case 'home':
        return <Home 
                 onNavigateToCatalog={() => setActivePage('scripts-catalog')} 
                 onNavigateToProducts={() => setActivePage('other-products')} 
               />;
      case 'scripts-catalog':
        return <ScriptsCatalog scripts={scripts} onSelectScript={(id) => setActivePage(id)} />;
      case 'other-products': 
        return <OtherProducts onNavigate={(page) => setActivePage(page)} />;
      case 'torah-covers':
        return <TorahCovers onNavigate={(page) => setActivePage(page)} />;
      case 'about':
        return <About />;
      case 'contact':
        return <Contact />;
      case 'admin':
        return <Admin />;
      default:
        return <Home 
                 onNavigateToCatalog={() => setActivePage('scripts-catalog')}
                 onNavigateToProducts={() => setActivePage('other-products')}
               />;
    }
  };

  return (
    <Layout activePage={activePage} setActivePage={setActivePage} scripts={scripts}>
      {renderContent()}
    </Layout>
  );
};

export default App;