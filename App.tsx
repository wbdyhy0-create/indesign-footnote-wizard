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

const ROOT_PAGES = new Set([
  'home',
  'scripts-catalog',
  'other-products',
  'torah-covers',
  'about',
  'contact',
  'admin',
]);

const App: React.FC = () => {
  const [activePage, setActivePage] = useState('home');
  const [scripts, setScripts] = useState<ScriptData[]>(DEFAULT_SCRIPTS);
  const [products, setProducts] = useState<any[]>(DEFAULT_PRODUCTS);
  const [covers, setCovers] = useState<any[]>(DEFAULT_COVERS);

  // ניווט מבוסס hash: מאפשר גישה ישירה לעמוד מנהל דרך /#admin
  useEffect(() => {
    const readPageFromHash = () => {
      if (typeof window === 'undefined') return;
      const raw = decodeURIComponent(window.location.hash.replace(/^#/, '').trim());
      if (raw && ROOT_PAGES.has(raw)) {
        setActivePage(raw);
      } else if (!raw) {
        setActivePage('home');
      }
    };

    readPageFromHash();
    window.addEventListener('hashchange', readPageFromHash);
    return () => window.removeEventListener('hashchange', readPageFromHash);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const targetHash = activePage === 'home' ? '' : `#${encodeURIComponent(activePage)}`;
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, '', `${window.location.pathname}${targetHash}`);
    }
  }, [activePage]);

  // טעינת תוכן מהענן לאתר החי (fallback לקבועים במקרה כשל)
  useEffect(() => {
    const loadLiveData = async () => {
      try {
        const response = await fetch('/api/update-scripts');
        if (!response.ok) throw new Error('Failed to load cloud data');
        const data = await response.json();

        if (Array.isArray(data?.scripts) && data.scripts.length > 0) {
          setScripts(data.scripts);
        } else {
          setScripts(DEFAULT_SCRIPTS);
        }

        if (Array.isArray(data?.products) && data.products.length > 0) {
          setProducts(data.products);
        } else {
          setProducts(DEFAULT_PRODUCTS);
        }

        if (Array.isArray(data?.covers) && data.covers.length > 0) {
          setCovers(data.covers);
        } else {
          setCovers(DEFAULT_COVERS);
        }
      } catch (e) {
        console.warn('Cloud data unavailable, using constants fallback:', e);
        setScripts(DEFAULT_SCRIPTS);
        setProducts(DEFAULT_PRODUCTS);
        setCovers(DEFAULT_COVERS);
      }
    };

    loadLiveData();
  }, []);

  const renderContent = () => {
    // 1. בדיקה אם הגולש לוחץ על סקריפט
    const script = scripts.find(s => s.id === activePage);
    if (script) {
      return <ScriptDetail product={script} onBack={() => setActivePage('scripts-catalog')} />;
    }

    // 2. בדיקה אם הגולש לוחץ על מוצר
    const product = products.find((p: any) => p.id === activePage);
    if (product) {
      // אם כן, פתח את דף הפירוט והעבר לו את נתוני המוצר
      return <ProductDetail product={product} onBack={() => setActivePage('other-products')} />;
    }

    const cover = covers.find((c: any) => c.id === activePage);
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
        return <OtherProducts products={products} onNavigate={(page) => setActivePage(page)} />;
      case 'torah-covers':
        return <TorahCovers covers={covers} onNavigate={(page) => setActivePage(page)} />;
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