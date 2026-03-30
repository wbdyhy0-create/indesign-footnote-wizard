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
import Promotions from './pages/Promotions';
import ProductDetail from './pages/ProductDetail'; // ייבוא של דף הפירוט החדש
import Videos from './pages/Videos';
import { SCRIPTS as DEFAULT_SCRIPTS, OTHER_PRODUCTS as DEFAULT_PRODUCTS, TORAH_COVER_DESIGNS as DEFAULT_COVERS } from './constants';
import { PromotionBundleData, ScriptData, SiteSettings, VideoItem } from './types';

const ROOT_PAGES = new Set([
  'home',
  'scripts-catalog',
  'promotions',
  'other-products',
  'torah-covers',
  'videos',
  'about',
  'contact',
  'admin',
]);

const staticPathToPage: Record<string, string> = {
  '/': 'home',
  '/scripts-catalog': 'scripts-catalog',
  '/promotions': 'promotions',
  '/other-products': 'other-products',
  '/torah-covers': 'torah-covers',
  '/videos': 'videos',
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
  if (path.startsWith('/promotions/')) {
    return decodeURIComponent(path.slice('/promotions/'.length));
  }
  if (path.startsWith('/products/')) {
    return decodeURIComponent(path.slice('/products/'.length));
  }
  if (path.startsWith('/torah-covers/')) {
    return decodeURIComponent(path.slice('/torah-covers/'.length));
  }
  return 'home';
};

const getPageFromLocation = (pathname: string, hash: string) => {
  const pageFromPath = getPageFromPath(pathname);
  if (pageFromPath !== 'home') return pageFromPath;

  const rawHash = (hash || '').trim();
  if (!rawHash) return pageFromPath;

  const normalizedHash = decodeURIComponent(rawHash.replace(/^#\/?/, ''));
  if (!normalizedHash) return pageFromPath;

  if (normalizedHash === 'admin' || normalizedHash.startsWith('admin/')) {
    return 'admin';
  }

  if (ROOT_PAGES.has(normalizedHash)) {
    return normalizedHash;
  }

  return pageFromPath;
};

const App: React.FC = () => {
  const [activePage, setActivePage] = useState('home');
  const [scripts, setScripts] = useState<ScriptData[]>(DEFAULT_SCRIPTS);
  const [products, setProducts] = useState<any[]>(DEFAULT_PRODUCTS);
  const [covers, setCovers] = useState<any[]>(DEFAULT_COVERS);
  const [promotions, setPromotions] = useState<PromotionBundleData[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({
    promotionsPageVisible: true,
    scriptsPageVisible: true,
    productsPageVisible: true,
    coversPageVisible: true,
    videosPageVisible: true,
  });

  const getPathFromPage = (page: string) => {
    if (page === 'home') return '/';
    if (ROOT_PAGES.has(page)) return `/${page}`;

    if (scripts.some((s) => s.id === page)) return `/scripts/${encodeURIComponent(page)}`;
    if (promotions.some((p) => p.id === page)) return `/promotions/${encodeURIComponent(page)}`;
    if (products.some((p: any) => p.id === page)) return `/products/${encodeURIComponent(page)}`;
    if (covers.some((c: any) => c.id === page)) return `/torah-covers/${encodeURIComponent(page)}`;

    return '/';
  };

  const isPageAllowed = (page: string) => {
    if (page === 'scripts-catalog') return siteSettings.scriptsPageVisible !== false;
    if (page === 'other-products') return siteSettings.productsPageVisible !== false;
    if (page === 'torah-covers') return siteSettings.coversPageVisible !== false;
    if (page === 'promotions') return siteSettings.promotionsPageVisible !== false;
    if (page === 'videos') return siteSettings.videosPageVisible !== false;

    const script = scripts.find((s) => s.id === page);
    if (script) return siteSettings.scriptsPageVisible !== false && script.isPublished !== false;

    const product = products.find((p: any) => p.id === page);
    if (product) return siteSettings.productsPageVisible !== false && Boolean(product.isPublished);

    const cover = covers.find((c: any) => c.id === page);
    if (cover) return siteSettings.coversPageVisible !== false && Boolean(cover.isPublished);

    const promotion = promotions.find((p) => p.id === page);
    if (promotion) return siteSettings.promotionsPageVisible !== false && promotion.isPublished !== false;

    return true;
  };

  const navigateToPage = (page: string, options?: { replace?: boolean }) => {
    if (typeof window === 'undefined') return;

    const targetPage = isPageAllowed(page) ? page : 'home';
    setActivePage(targetPage);

    const nextPath = getPathFromPage(targetPage);
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
      const pageFromPath = getPageFromLocation(window.location.pathname, window.location.hash);
      if (pageFromPath === 'admin' && !normalizePath(window.location.pathname).startsWith('/admin')) {
        window.history.replaceState(null, '', '/admin');
      }
      if (
        siteSettings.scriptsPageVisible === false &&
        (pageFromPath === 'scripts-catalog' || scripts.some((s) => s.id === pageFromPath))
      ) {
        setActivePage('home');
        window.history.replaceState(null, '', '/');
        return;
      }

      if (
        siteSettings.productsPageVisible === false &&
        (pageFromPath === 'other-products' || products.some((p: any) => p.id === pageFromPath))
      ) {
        setActivePage('home');
        window.history.replaceState(null, '', '/');
        return;
      }

      if (
        siteSettings.coversPageVisible === false &&
        (pageFromPath === 'torah-covers' || covers.some((c: any) => c.id === pageFromPath))
      ) {
        setActivePage('home');
        window.history.replaceState(null, '', '/');
        return;
      }

      if (
        siteSettings.promotionsPageVisible === false &&
        (pageFromPath === 'promotions' || promotions.some((p) => p.id === pageFromPath))
      ) {
        setActivePage('home');
        window.history.replaceState(null, '', '/');
        return;
      }

      // פריט בודד שמוסתר (isPublished=false) → נשלח הביתה גם אם העמוד עצמו מוצג
      if (!isPageAllowed(pageFromPath)) {
        setActivePage('home');
        window.history.replaceState(null, '', '/');
        return;
      }
      setActivePage(pageFromPath);
    };

    readPageFromLocation();
    window.addEventListener('popstate', readPageFromLocation);
    window.addEventListener('hashchange', readPageFromLocation);
    return () => {
      window.removeEventListener('popstate', readPageFromLocation);
      window.removeEventListener('hashchange', readPageFromLocation);
    };
  }, [
    siteSettings.promotionsPageVisible,
    siteSettings.scriptsPageVisible,
    siteSettings.productsPageVisible,
    siteSettings.coversPageVisible,
    promotions,
    scripts,
    products,
    covers,
  ]);

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

        if (Array.isArray(data?.promotions)) {
          setPromotions(data.promotions);
        } else {
          setPromotions([]);
        }

        if (Array.isArray(data?.videos)) {
          setVideos(data.videos);
        } else {
          setVideos([]);
        }

        if (data?.siteSettings && typeof data.siteSettings === 'object') {
          setSiteSettings({
            promotionsPageVisible: (data.siteSettings as any).promotionsPageVisible !== false,
            scriptsPageVisible: (data.siteSettings as any).scriptsPageVisible !== false,
            productsPageVisible: (data.siteSettings as any).productsPageVisible !== false,
            coversPageVisible: (data.siteSettings as any).coversPageVisible !== false,
            videosPageVisible: (data.siteSettings as any).videosPageVisible !== false,
          });
        } else {
          setSiteSettings({
            promotionsPageVisible: true,
            scriptsPageVisible: true,
            productsPageVisible: true,
            coversPageVisible: true,
            videosPageVisible: true,
          });
        }
      } catch (e) {
        console.warn('Cloud data unavailable, using constants fallback:', e);
        setScripts(DEFAULT_SCRIPTS);
        setProducts(DEFAULT_PRODUCTS);
        setCovers(DEFAULT_COVERS);
        setPromotions([]);
        setVideos([]);
        setSiteSettings({
          promotionsPageVisible: true,
          scriptsPageVisible: true,
          productsPageVisible: true,
          coversPageVisible: true,
          videosPageVisible: true,
        });
      }
    };

    loadLiveData();
  }, []);

  const renderContent = () => {
    // 1. בדיקה אם הגולש לוחץ על סקריפט
    const script =
      siteSettings.scriptsPageVisible === false
        ? null
        : scripts.find((s) => s.id === activePage && s.isPublished !== false);
    if (script) return <ScriptDetail product={script} onBack={() => navigateToPage('scripts-catalog')} />;

    if (siteSettings.promotionsPageVisible) {
      const promotion = promotions.find((p) => p.id === activePage && p.isPublished !== false);
      if (promotion) {
        return <ScriptDetail product={promotion} onBack={() => navigateToPage('promotions')} />;
      }
    }

    // 2. בדיקה אם הגולש לוחץ על מוצר
    const product =
      siteSettings.productsPageVisible === false
        ? null
        : products.find((p: any) => p.id === activePage && Boolean(p.isPublished));
    if (product) {
      // אם כן, פתח את דף הפירוט והעבר לו את נתוני המוצר
      return <ProductDetail product={product} onBack={() => navigateToPage('other-products')} />;
    }

    const cover =
      siteSettings.coversPageVisible === false
        ? null
        : covers.find((c: any) => c.id === activePage && Boolean(c.isPublished));
    if (cover) {
      return <ProductDetail product={cover} onBack={() => navigateToPage('torah-covers')} />;
    }

    // 3. ניווט כללי של האתר
    switch (activePage) {
      case 'home':
        return <Home 
                 onNavigateToCatalog={() => navigateToPage('scripts-catalog')} 
                 onNavigateToVideos={() => navigateToPage('videos')}
               />;
      case 'scripts-catalog':
        return siteSettings.scriptsPageVisible === false
          ? <Home onNavigateToCatalog={() => navigateToPage('scripts-catalog')} onNavigateToVideos={() => navigateToPage('videos')} />
          : <ScriptsCatalog scripts={scripts} onSelectScript={(id) => navigateToPage(id)} />;
      case 'other-products': 
        return siteSettings.productsPageVisible === false
          ? <Home onNavigateToCatalog={() => navigateToPage('scripts-catalog')} onNavigateToVideos={() => navigateToPage('videos')} />
          : <OtherProducts products={products} onNavigate={(page) => navigateToPage(page)} />;
      case 'promotions':
        return siteSettings.promotionsPageVisible
          ? <Promotions promotions={promotions} onSelectPromotion={(id) => navigateToPage(id)} />
          : <Home onNavigateToCatalog={() => navigateToPage('scripts-catalog')} onNavigateToVideos={() => navigateToPage('videos')} />;
      case 'videos':
        return siteSettings.videosPageVisible === false ? (
          <Home onNavigateToCatalog={() => navigateToPage('scripts-catalog')} onNavigateToVideos={() => navigateToPage('videos')} />
        ) : (
          <Videos videos={videos} />
        );
      case 'torah-covers':
        return siteSettings.coversPageVisible === false
          ? <Home onNavigateToCatalog={() => navigateToPage('scripts-catalog')} onNavigateToVideos={() => navigateToPage('videos')} />
          : <TorahCovers covers={covers} onNavigate={(page) => navigateToPage(page)} />;
      case 'about':
        return <About />;
      case 'contact':
        return <Contact />;
      case 'admin':
        return <Admin />;
      default:
        return <Home 
                 onNavigateToCatalog={() => navigateToPage('scripts-catalog')}
                 onNavigateToVideos={() => navigateToPage('videos')}
               />;
    }
  };

  if (activePage === 'admin') {
    return <Admin />;
  }

  return (
    <Layout
      activePage={activePage}
      setActivePage={navigateToPage}
      scripts={scripts}
      promotions={promotions}
      products={products}
      covers={covers}
      siteSettings={siteSettings}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;