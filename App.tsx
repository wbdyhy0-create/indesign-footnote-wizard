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

const staticPathToPage: Record<string, string> = {
  '/': 'home',
  '/scripts-catalog': 'scripts-catalog',
  '/other-products': 'other-products',
  '/torah-covers': 'torah-covers',
  '/about': 'about',
  '/contact': 'contact',
  '/admin': 'admin',
};

const normalizePath = (pathname: string) => {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
};

const getPageFromPath = (pathname: string) => {
  const path = normalizePath(pathname);
  if (staticPathToPage[path]) return staticPathToPage[path];
  if (path.startsWith('/admin/')) return 'admin';

  if (path.startsWith('/scripts/')) {
    return decodeURIComponent(path.slice('/scripts/'.length));
  }
  if (path.startsWith('/products/')) {
    return decodeURIComponent(path.slice('/products/'.length));
  }
  if (path.startsWith('/torah-covers/')) {
    return decodeURIComponent(path.slice('/torah-covers/'.length));
  }
  return 'home';
};

const App: React.FC = () => {
  const [activePage, setActivePage] = useState('home');
  const [scripts, setScripts] = useState<ScriptData[]>(DEFAULT_SCRIPTS);
  const [products, setProducts] = useState<any[]>(DEFAULT_PRODUCTS);
  const [covers, setCovers] = useState<any[]>(DEFAULT_COVERS);

  const getPathFromPage = (page: string) => {
    if (page === 'home') return '/';
    if (ROOT_PAGES.has(page)) return `/${page}`;

    if (scripts.some((s) => s.id === page)) return `/scripts/${encodeURIComponent(page)}`;
    if (products.some((p: any) => p.id === page)) return `/products/${encodeURIComponent(page)}`;
    if (covers.some((c: any) => c.id === page)) return `/torah-covers/${encodeURIComponent(page)}`;

    return '/';
  };

  const navigateToPage = (page: string, options?: { replace?: boolean }) => {
    setActivePage(page);
    if (typeof window === 'undefined') return;

    const nextPath = getPathFromPage(page);
    const currentPath = normalizePath(window.location.pathname);
    if (currentPath === nextPath) return;

    if (options?.replace) {
      window.history.replaceState(null, '', nextPath);
    } else {
      window.history.pushState(null, '', nextPath);
    }
  };

  useEffect(() => {
    const readPageFromLocation = () => {
      if (typeof window === 'undefined') return;
      const pageFromPath = getPageFromPath(window.location.pathname);
      setActivePage(pageFromPath);
    };

    readPageFromLocation();
    window.addEventListener('popstate', readPageFromLocation);
    return () => window.removeEventListener('popstate', readPageFromLocation);
  }, []);

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
      return <ScriptDetail product={script} onBack={() => navigateToPage('scripts-catalog')} />;
    }

    // 2. בדיקה אם הגולש לוחץ על מוצר
    const product = products.find((p: any) => p.id === activePage);
    if (product) {
      // אם כן, פתח את דף הפירוט והעבר לו את נתוני המוצר
      return <ProductDetail product={product} onBack={() => navigateToPage('other-products')} />;
    }

    const cover = covers.find((c: any) => c.id === activePage);
    if (cover) {
      return <ProductDetail product={cover} onBack={() => navigateToPage('torah-covers')} />;
    }

    // 3. ניווט כללי של האתר
    switch (activePage) {
      case 'home':
        return <Home 
                 onNavigateToCatalog={() => navigateToPage('scripts-catalog')} 
                 onNavigateToProducts={() => navigateToPage('other-products')} 
               />;
      case 'scripts-catalog':
        return <ScriptsCatalog scripts={scripts} onSelectScript={(id) => navigateToPage(id)} />;
      case 'other-products': 
        return <OtherProducts products={products} onNavigate={(page) => navigateToPage(page)} />;
      case 'torah-covers':
        return <TorahCovers covers={covers} onNavigate={(page) => navigateToPage(page)} />;
      case 'about':
        return <About />;
      case 'contact':
        return <Contact />;
      case 'admin':
        return <Admin />;
      default:
        return <Home 
                 onNavigateToCatalog={() => navigateToPage('scripts-catalog')}
                 onNavigateToProducts={() => navigateToPage('other-products')}
               />;
    }
  };

  return (
    <Layout activePage={activePage} setActivePage={navigateToPage} scripts={scripts} products={products} covers={covers}>
      {renderContent()}
    </Layout>
  );
};

export default App;