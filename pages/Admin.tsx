import React, { useState, useEffect } from 'react';
import { SCRIPTS as initialScripts, OTHER_PRODUCTS as initialProducts, TORAH_COVER_DESIGNS as initialCovers } from '../constants';
import { Lead, PromotionBundleData, PurchaseOrder, SiteSettings } from '../types';
import { setOwnerSkipVisitBump, shouldSkipVisitBump } from '../utils/visitTracking';

const ADMIN_VIEWS = ['scripts', 'promotions', 'products', 'covers', 'orders', 'leads', 'json'] as const;
type AdminViewMode = (typeof ADMIN_VIEWS)[number];

const isAdminViewMode = (value: string): value is AdminViewMode =>
  (ADMIN_VIEWS as readonly string[]).includes(value);

const normalizePath = (pathname: string) => {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
};

const getAdminViewFromPath = (pathname: string): AdminViewMode => {
  const path = normalizePath(pathname);
  if (path === '/admin') return 'scripts';
  if (!path.startsWith('/admin/')) return 'scripts';

  const next = decodeURIComponent(path.slice('/admin/'.length));
  return isAdminViewMode(next) ? next : 'scripts';
};

const ADMIN_CODE = '1967';

const AdminPortal: React.FC = () => {

  // טעינת סקריפטים מהזיכרון המקומי
  const [scripts, setScripts] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('yosef_admin_backup');
      if (saved) return JSON.parse(saved);
    }
    return initialScripts;
  });
  const [promotions, setPromotions] = useState<PromotionBundleData[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('yosef_admin_promotions_backup');
      if (saved) return JSON.parse(saved);
    }
    return [];
  });
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('yosef_admin_site_settings_backup');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          promotionsPageVisible: parsed?.promotionsPageVisible !== false,
          scriptsPageVisible: parsed?.scriptsPageVisible !== false,
          productsPageVisible: parsed?.productsPageVisible !== false,
          coversPageVisible: parsed?.coversPageVisible !== false,
        };
      }
    }
    return {
      promotionsPageVisible: true,
      scriptsPageVisible: true,
      productsPageVisible: true,
      coversPageVisible: true,
    };
  });

  // --- תוספת חדשה: טעינת מוצרים מהזיכרון ---
  const [products, setProducts] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('yosef_admin_products_backup');
      if (saved) return JSON.parse(saved);
    }
    return initialProducts || [];
  });
  const [covers, setCovers] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('yosef_admin_covers_backup');
      if (saved) return JSON.parse(saved);
    }
    return initialCovers || [];
  });
  
  const [editingScript, setEditingScript] = useState<any>(null);
  const [editingPromotion, setEditingPromotion] = useState<PromotionBundleData | null>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editingProductKind, setEditingProductKind] = useState<'products' | 'covers'>('products');
  const [viewMode, setViewMode] = useState<AdminViewMode>('scripts');
  const [isPublishingLive, setIsPublishingLive] = useState(false);
  const [publishStatus, setPublishStatus] = useState<string | null>(null);
  const [isUploadingCoverImage, setIsUploadingCoverImage] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLeadsLoading, setIsLeadsLoading] = useState(false);
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [isMarkingOrderPaid, setIsMarkingOrderPaid] = useState<string | null>(null);
  const [orderCodeFilter, setOrderCodeFilter] = useState('');
  const [skipVisitCountOnThisDevice, setSkipVisitCountOnThisDevice] = useState(false);

  useEffect(() => {
    setSkipVisitCountOnThisDevice(shouldSkipVisitBump());
  }, []);

  const loadLeads = async () => {
    try {
      setIsLeadsLoading(true);
      setLeadsError(null);
      const response = await fetch('/api/leads');
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || 'שגיאה בטעינת הלידים');
      }
      setLeads(Array.isArray(data?.leads) ? data.leads : []);
    } catch (error: any) {
      setLeadsError(error?.message || 'שגיאה בטעינת הלידים');
      setLeads([]);
    } finally {
      setIsLeadsLoading(false);
    }
  };

  const loadOrders = async () => {
    try {
      setIsOrdersLoading(true);
      setOrdersError(null);
      const response = await fetch(`/api/orders?adminCode=${encodeURIComponent(ADMIN_CODE)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || 'שגיאה בטעינת ההזמנות');
      }
      setOrders(Array.isArray(data?.orders) ? data.orders : []);
    } catch (error: any) {
      setOrdersError(error?.message || 'שגיאה בטעינת ההזמנות');
      setOrders([]);
    } finally {
      setIsOrdersLoading(false);
    }
  };

  const markOrderAsPaid = async (orderId: string) => {
    try {
      setIsMarkingOrderPaid(orderId);
      setOrdersError(null);
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark-paid',
          orderId,
          adminCode: ADMIN_CODE,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || 'לא הצלחנו לאשר את התשלום');
      }

      if (data?.emailSent) {
        alert('התשלום אושר וקישור ההורדה נשלח ללקוח במייל!\n\nשים לב: המייל עלול להגיע לתיקיית הספאם של הלקוח.\nמומלץ להודיע לו בוואטסאפ לבדוק שם.');
      } else {
        const reason = data?.emailError || 'סיבה לא ידועה';
        alert(`התשלום אושר, אך שליחת המייל נכשלה: ${reason}\nהלקוח עדיין יכול להוריד מהאתר.`);
      }

      await loadOrders();
    } catch (error: any) {
      setOrdersError(error?.message || 'לא הצלחנו לאשר את התשלום');
    } finally {
      setIsMarkingOrderPaid(null);
    }
  };

  const goToClientHome = () => {
    if (typeof window === 'undefined') return;
    window.location.href = '/';
  };

  const fileToDataUrl = (selectedFile: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(selectedFile);
    });

  const uploadImageFileToCloud = async (file: File) => {
    const dataUrl = await fileToDataUrl(file);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch('/api/upload-cover-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || 'image/png',
          dataUrl,
        }),
        signal: controller.signal,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.url) {
        if (response.status === 501) {
          throw new Error('העלאה לענן לא זמינה כרגע בסביבה הזו. נסה באתר החי או הדבק קישור תמונה ידני.');
        }
        throw new Error(result?.error || 'העלאת התמונה נכשלה');
      }
      return String(result.url);
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error('העלאת התמונה נמשכה יותר מדי זמן ונעצרה. נסה שוב או העלה תמונה קטנה יותר.');
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const stripDataUrl = (value: any) =>
    value && String(value).startsWith('data:') ? '' : (value || '');

  // העלאת תמונת מוצר/כריכה מהמחשב (נשמרת בענן כ-https)
  const handleProductImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setCoverUploadError(null);
      setIsUploadingCoverImage(true);
      const imageUrl = await uploadImageFileToCloud(file);
      setEditingProduct((prev: any) => (prev ? { ...prev, imageUrl } : prev));
    } catch (error: any) {
      const message = error?.message || 'שגיאה בהעלאת התמונה';
      setCoverUploadError(message);
      alert(`❌ ${message}`);
    } finally {
      setIsUploadingCoverImage(false);
      event.target.value = '';
    }
  };

  // העלאת תמונת סקריפט מהמחשב (נשמרת בענן כ-https)
  const handleScriptImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setCoverUploadError(null);
      setIsUploadingCoverImage(true);
      const imageUrl = await uploadImageFileToCloud(file);
      setEditingScript((prev: any) => (prev ? { ...prev, imageUrl } : prev));
    } catch (error: any) {
      const message = error?.message || 'שגיאה בהעלאת תמונת הסקריפט';
      setCoverUploadError(message);
      alert(`❌ ${message}`);
    } finally {
      setIsUploadingCoverImage(false);
      event.target.value = '';
    }
  };

  const handlePromotionImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setCoverUploadError(null);
      setIsUploadingCoverImage(true);
      const imageUrl = await uploadImageFileToCloud(file);
      setEditingPromotion((prev: any) => (prev ? { ...prev, imageUrl } : prev));
    } catch (error: any) {
      const message = error?.message || 'שגיאה בהעלאת תמונת המבצע';
      setCoverUploadError(message);
      alert(`❌ ${message}`);
    } finally {
      setIsUploadingCoverImage(false);
      event.target.value = '';
    }
  };

  const mapFeaturesToText = (features: any): string => {
    if (!features) return '';
    if (Array.isArray(features)) {
      return features
        .map((f: any) => {
          if (typeof f === 'string') return f;
          if (!f) return '';
          if (f.title && f.description) return `${f.title} - ${f.description}`;
          return f.title || f.description || '';
        })
        .filter(Boolean)
        .join('\n');
    }
    return '';
  };

  const handlePublishToLive = async () => {
    try {
      setIsPublishingLive(true);
      setPublishStatus(null);
      const payloadScripts = scripts.map((s: any) => ({ ...s, imageUrl: stripDataUrl(s.imageUrl) }));
      const payloadPromotions = promotions.map((s: any) => ({ ...s, imageUrl: stripDataUrl(s.imageUrl) }));
      const payloadProducts = products.map((p: any) => ({ ...p, imageUrl: stripDataUrl(p.imageUrl) }));
      const payloadCovers = covers.map((c: any) => ({ ...c, imageUrl: stripDataUrl(c.imageUrl) }));
      const response = await fetch('/api/update-scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scripts: payloadScripts,
          promotions: payloadPromotions,
          products: payloadProducts,
          covers: payloadCovers,
          siteSettings,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || 'שגיאה בפרסום לאתר החי');
      }
      setPublishStatus('✅ פורסם בהצלחה לאתר החי');
    } catch (error: any) {
      setPublishStatus(`❌ ${error?.message || 'שגיאה בפרסום לאתר החי'}`);
    } finally {
      setIsPublishingLive(false);
    }
  };

  // טעינה ראשונית מהענן כדי לסנכרן בין כל המכשירים
  useEffect(() => {
    const loadCloudData = async () => {
      try {
        const response = await fetch('/api/update-scripts');
        if (!response.ok) throw new Error('Failed to load cloud data');
        const data = await response.json();

        if (Array.isArray(data?.scripts)) {
          setScripts(data.scripts);
        }
        if (Array.isArray(data?.promotions)) {
          setPromotions(data.promotions);
        }
        if (Array.isArray(data?.products)) {
          setProducts(data.products);
        }
        if (Array.isArray(data?.covers)) {
          setCovers(data.covers);
        }
        if (data?.siteSettings && typeof data.siteSettings === 'object') {
          setSiteSettings({
            promotionsPageVisible: (data.siteSettings as any).promotionsPageVisible !== false,
            scriptsPageVisible: (data.siteSettings as any).scriptsPageVisible !== false,
            productsPageVisible: (data.siteSettings as any).productsPageVisible !== false,
            coversPageVisible: (data.siteSettings as any).coversPageVisible !== false,
          });
        }
      } catch (error) {
        console.warn('Cloud sync load failed, using local data:', error);
      }
    };

    loadCloudData();
    loadLeads();
  }, []);

  useEffect(() => {
    if (viewMode === 'leads') {
      loadLeads();
    }
    if (viewMode === 'orders') {
      loadOrders();
    }
  }, [viewMode]);

  // סנכרון URL -> לשונית אדמין (כולל Back/Forward)
  useEffect(() => {
    const syncViewFromUrl = () => {
      if (typeof window === 'undefined') return;
      setViewMode(getAdminViewFromPath(window.location.pathname));
      const filterFromUrl = new URLSearchParams(window.location.search).get('orderCode') || '';
      setOrderCodeFilter(filterFromUrl.trim());
    };

    syncViewFromUrl();
    window.addEventListener('popstate', syncViewFromUrl);
    return () => window.removeEventListener('popstate', syncViewFromUrl);
  }, []);

  // סנכרון לשונית אדמין -> URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const targetPath = viewMode === 'scripts' ? '/admin' : `/admin/${viewMode}`;
    const currentPath = normalizePath(window.location.pathname);
    const targetSearch =
      viewMode === 'orders' && orderCodeFilter.trim()
        ? `?orderCode=${encodeURIComponent(orderCodeFilter.trim())}`
        : '';
    const currentSearch = window.location.search || '';
    if (currentPath !== targetPath || currentSearch !== targetSearch) {
      window.history.pushState(null, '', `${targetPath}${targetSearch}`);
    }
  }, [viewMode, orderCodeFilter]);

  const filteredOrders = orders.filter((order) =>
    orderCodeFilter.trim()
      ? order.orderCode.toLowerCase().includes(orderCodeFilter.trim().toLowerCase())
      : true,
  );

  // שמירה אוטומטית לזיכרון המקומי בכל פעם שיש שינוי
  useEffect(() => {
    localStorage.setItem('yosef_admin_backup', JSON.stringify(scripts));
    localStorage.setItem('yosef_admin_promotions_backup', JSON.stringify(promotions));
    localStorage.setItem('yosef_admin_products_backup', JSON.stringify(products));
    localStorage.setItem('yosef_admin_covers_backup', JSON.stringify(covers));
    localStorage.setItem('yosef_admin_site_settings_backup', JSON.stringify(siteSettings));
    setPublishStatus(null);
  }, [scripts, promotions, products, covers, siteSettings]);

  // מנגנון התיקון האוטומטי ליוטיוב
  const formatYouTubeUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('embed')) return url;
    const videoId = url.split('v=')[1]?.split('&')[0] || url.split('/').pop();
    return `https://www.youtube.com/embed/${videoId}`;
  };

  const toDirectDriveDownloadUrl = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return '';
    const fileIdMatch = trimmed.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (!fileIdMatch) return '';
    return `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
  };

  const downloadLeadsCSV = () => {
    const escapeCsv = (value: string) => `"${String(value || '').replace(/"/g, '""')}"`;
    const headers = 'ID,Name,Email,Date,Script\n';
    const rows = leads
      .map((lead) =>
        [
          escapeCsv(lead.id),
          escapeCsv(lead.name),
          escapeCsv(lead.email),
          escapeCsv(new Date(lead.timestamp).toISOString().slice(0, 10)),
          escapeCsv(lead.scriptName),
        ].join(','),
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "leads_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyCode = () => {
    const preparedScripts = scripts.map((s: any) => ({
      ...s,
      videoUrl: formatYouTubeUrl(s.videoUrl),
      imageUrl: stripDataUrl(s.imageUrl),
    }));
    const preparedPromotions = promotions.map((p: any) => ({
      ...p,
      videoUrl: formatYouTubeUrl(p.videoUrl),
      imageUrl: stripDataUrl(p.imageUrl),
    }));
    // מוצרים: מחליפים תמונות Base64 במחרוזת ריקה כדי שה-JSON לא יתנפח (מיליוני תווים)
    const preparedProducts = products.map((p: any) => {
      const imageUrl = stripDataUrl(p.imageUrl);
      return { ...p, imageUrl };
    });
    const preparedCovers = covers.map((c: any) => {
      const imageUrl = stripDataUrl(c.imageUrl);
      return { ...c, imageUrl };
    });
    const fullData = {
      SCRIPTS: preparedScripts,
      PROMOTIONS: preparedPromotions,
      OTHER_PRODUCTS: preparedProducts,
      TORAH_COVER_DESIGNS: preparedCovers,
      SITE_SETTINGS: siteSettings,
    };
    navigator.clipboard.writeText(JSON.stringify(fullData, null, 2));
    alert("✅ הקוד הועתק בהצלחה!\n(קישורי יוטיוב תוקנו. תמונות Base64 הוחלפו בריק כדי למנוע JSON ענק. מומלץ להשתמש בהעלאה לענן או בקישור https.)");
  };

  const promotionZipUrl = editingPromotion?.downloadUrl?.trim() || '';
  const directDriveZipUrl = toDirectDriveDownloadUrl(promotionZipUrl);
  const isDriveViewZipUrl =
    Boolean(promotionZipUrl) &&
    /drive\.google\.com\/file\/d\//.test(promotionZipUrl) &&
    !/uc\?export=download/i.test(promotionZipUrl);

  return (
    <div className="min-h-screen bg-[#060b14] p-6 md:p-12 text-right text-white font-sans" dir="rtl">
      <div className="max-w-6xl mx-auto">
        
        {/* סרגל עליון */}
        <div className="bg-[#0b1121] border border-slate-800 rounded-3xl p-6 md:p-8 mb-8 flex flex-col md:flex-row-reverse justify-between items-center gap-6 shadow-xl">
          <div className="text-center md:text-right">
            <h1 className="text-3xl font-black text-[#f59e0b] tracking-wide">ניהול המערכת</h1>
            <p className="text-slate-500 text-xs font-bold mt-1">השינויים נשמרים מקומית אוטומטית. לפרסום באתר החי לחץ "פרסם לאתר החי".</p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 items-center">
            <button
              onClick={goToClientHome}
              className="bg-slate-800/50 text-slate-400 px-5 py-2.5 rounded-xl font-bold border border-slate-700/50 text-sm hover:bg-slate-800 transition"
            >
              מעבר לאתר
            </button>
            <button
              type="button"
              onClick={() => {
                const next = !skipVisitCountOnThisDevice;
                setOwnerSkipVisitBump(next);
                setSkipVisitCountOnThisDevice(next);
              }}
              className={`px-5 py-2.5 rounded-xl font-bold border text-sm transition max-w-[min(100%,280px)] text-center leading-tight ${
                skipVisitCountOnThisDevice
                  ? 'bg-emerald-900/50 text-emerald-200 border-emerald-500/40'
                  : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-slate-200'
              }`}
              title="נשמר בדפדפן הזה בלבד. גולשים אחרים עדיין נספרים במונה."
            >
              {skipVisitCountOnThisDevice
                ? '✓ מכשיר בעלים — כניסות לא נספרות'
                : 'סמן מכשיר זה: אל תספור את הכניסות שלי'}
            </button>
            <button
              onClick={() => { setEditingScript(null); setEditingPromotion(null); setEditingProduct(null); setOrderCodeFilter(''); setViewMode('orders'); }}
              className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition ${
                viewMode === 'orders'
                  ? 'bg-indigo-700 text-white'
                  : 'bg-indigo-700/30 text-indigo-300 hover:bg-indigo-700/50 border border-indigo-400/20'
              }`}
            >
              💳 הזמנות ({orders.length})
            </button>
            <button onClick={() => { setEditingScript(null); setEditingPromotion(null); setEditingProduct(null); setViewMode('leads'); }} className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition ${viewMode === 'leads' ? 'bg-[#064e3b] text-white' : 'bg-[#064e3b]/30 text-[#10b981] hover:bg-[#064e3b]/50 border border-[#10b981]/20'}`}>👤 לידים ({leads.length})</button>
            
            {/* --- לשוניות ניווט --- */}
            <div className="flex bg-slate-800/50 p-1 rounded-xl mx-2 border border-slate-700/50">
              <button onClick={() => { setEditingScript(null); setEditingPromotion(null); setEditingProduct(null); setViewMode('scripts'); }} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition ${viewMode === 'scripts' ? 'bg-[#f59e0b] text-slate-950' : 'text-slate-400 hover:text-white'}`}>סקריפטים</button>
              <button onClick={() => { setEditingScript(null); setEditingPromotion(null); setEditingProduct(null); setViewMode('promotions'); }} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition ${viewMode === 'promotions' ? 'bg-[#f97316] text-white' : 'text-slate-400 hover:text-white'}`}>מבצעים</button>
              <button onClick={() => { setEditingScript(null); setEditingPromotion(null); setEditingProduct(null); setViewMode('products'); }} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition ${viewMode === 'products' ? 'bg-[#5c5cfc] text-white' : 'text-slate-400 hover:text-white'}`}>מוצרים</button>
              <button onClick={() => { setEditingScript(null); setEditingPromotion(null); setEditingProduct(null); setViewMode('covers'); }} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition ${viewMode === 'covers' ? 'bg-[#14b8a6] text-white' : 'text-slate-400 hover:text-white'}`}>כריכות</button>
            </div>

            {/* כפתור הוספה מתחלף בהתאם ללשונית */}
            {viewMode === 'scripts' && (
              <button onClick={() => { setEditingScript({ id: Date.now().toString(), name: '', price: '₪250', originalPrice: '₪450', videoUrl: '', downloadUrl: '', trialDownloadUrl: '', guideUrl: '', description: '', shortDesc: '', color: 'blue', imageUrl: '', isPublished: true }); }} className="bg-[#f59e0b] hover:bg-[#d97706] text-slate-950 px-6 py-2.5 rounded-xl font-black shadow-lg transition">+ הוסף סקריפט</button>
            )}
            {viewMode === 'promotions' && (
              <button
                onClick={() => {
                  setEditingPromotion({
                    id: `promo-${Date.now()}`,
                    name: '',
                    price: '₪450',
                    originalPrice: '₪900',
                    videoUrl: '',
                    downloadUrl: '',
                    trialDownloadUrl: '',
                    guideUrl: '',
                    description: '',
                    shortDesc: '',
                    color: 'blue',
                    imageUrl: '',
                    isPublished: true,
                    bundleScriptLinks: [],
                  });
                }}
                className="bg-[#f97316] hover:bg-[#ea580c] text-white px-6 py-2.5 rounded-xl font-black shadow-lg transition"
              >
                + הוסף מבצע
              </button>
            )}
            {viewMode === 'products' && (
              <button
                onClick={() => {
                  setEditingProductKind('products');
                  setEditingProduct({
                    id: Date.now().toString(),
                    name: '',
                    price: '₪100',
                    description: '',
                    fullDesc: '',
                    videoUrl: '',
                    pdfPreviewUrl: '',
                    downloadUrl: '',
                    imageUrl: '',
                    features: [],
                    featuresText: '',
                    isPublished: true,
                  });
                }}
                className="bg-[#5c5cfc] hover:bg-[#4a4af0] text-white px-6 py-2.5 rounded-xl font-black shadow-lg transition"
              >
                + הוסף מוצר
              </button>
            )}
            {viewMode === 'covers' && (
              <button
                onClick={() => {
                  setEditingProductKind('covers');
                  setEditingProduct({
                    id: `cover-${Date.now()}`,
                    name: '',
                    price: '₪1200',
                    description: '',
                    fullDesc: '',
                    videoUrl: '',
                    pdfPreviewUrl: '',
                    downloadUrl: '',
                    imageUrl: '',
                    features: [],
                    featuresText: '',
                    isPublished: true,
                  });
                }}
                className="bg-[#14b8a6] hover:bg-[#0d9488] text-white px-6 py-2.5 rounded-xl font-black shadow-lg transition"
              >
                + הוסף כריכה
              </button>
            )}

            <button
              onClick={handlePublishToLive}
              disabled={isPublishingLive}
              className={`px-6 py-2.5 rounded-xl font-black shadow-lg transition flex items-center gap-2 ${isPublishingLive ? 'bg-emerald-700 text-white cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
            >
              {isPublishingLive ? 'מפרסם...' : '🚀 פרסם לאתר החי'}
            </button>
            <button onClick={handleCopyCode} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-black shadow-lg transition flex items-center gap-2">📋 העתק קוד לעדכון קבוע</button>
            <button onClick={() => { setEditingScript(null); setEditingPromotion(null); setEditingProduct(null); setViewMode('json'); }} className="bg-slate-800/50 text-slate-300 px-5 py-2.5 rounded-xl font-bold border border-slate-700 text-sm hover:bg-slate-700 transition">תצוגת JSON</button>
          </div>
        </div>
        {publishStatus && (
          <div className="mb-6 text-sm font-bold text-center bg-slate-900/70 border border-slate-700 rounded-xl py-3 px-4">
            {publishStatus}
          </div>
        )}

        {/* --- אזור התוכן המשתנה --- */}

        {editingScript ? (
          // שחזור מדויק של חלונית העריכה המקורית של הסקריפטים - ללא שום שינוי!
          <div className="bg-[#0b1121] border border-[#f59e0b] rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative animate-in fade-in zoom-in-95 duration-300">
            
            <div className="flex justify-between items-center mb-10 pb-6 border-b border-slate-800">
              <div className="flex gap-4">
                <button onClick={() => setScripts(scripts.filter(i => i.id !== editingScript.id))} className="w-12 h-12 flex items-center justify-center border border-red-500/30 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition">🗑️</button>
                <button onClick={() => setEditingScript(null)} className="bg-[#f59e0b] text-slate-950 px-8 py-2 rounded-xl font-black hover:bg-[#d97706] transition">סגור עריכה</button>
              </div>
              <h2 className="text-3xl font-black text-white">{editingScript.name || 'סקריפט חדש'}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 max-h-[50vh] overflow-y-auto px-2 custom-scrollbar">
              {/* טור ימין */}
              <div className="space-y-6">
                <div>
                  <label className="block text-slate-500 text-sm font-bold mb-2">שם הסקריפט</label>
                  <input value={editingScript.name} onChange={(e) => setEditingScript({...editingScript, name: e.target.value})} className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-white font-black outline-none focus:border-[#f59e0b] transition" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[#f59e0b] text-sm font-bold mb-2">מחיר נוכחי</label>
                    <input value={editingScript.price} onChange={(e) => setEditingScript({...editingScript, price: e.target.value})} className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-white font-black text-left outline-none focus:border-[#f59e0b]" />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-sm font-bold mb-2">מחיר מקורי (למבצע)</label>
                    <input value={editingScript.originalPrice} onChange={(e) => setEditingScript({...editingScript, originalPrice: e.target.value})} className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-slate-400 text-left outline-none focus:border-[#f59e0b]" />
                  </div>
                </div>
                <div>
                  <label className="block text-[#5c5cfc] text-sm font-bold mb-2">לינק הורדה (קובץ מלא)</label>
                  <input value={editingScript.downloadUrl} onChange={(e) => setEditingScript({...editingScript, downloadUrl: e.target.value})} className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-slate-300 font-mono text-sm text-left outline-none focus:border-[#5c5cfc]" />
                </div>
                <div>
                  <label className="block text-[#5c5cfc] text-sm font-bold mb-2">לינק הורדה (גרסת ניסיון)</label>
                  <input value={editingScript.trialDownloadUrl} onChange={(e) => setEditingScript({...editingScript, trialDownloadUrl: e.target.value})} className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-slate-300 font-mono text-sm text-left outline-none focus:border-[#5c5cfc]" />
                </div>
              </div>

              {/* טור שמאל */}
              <div className="space-y-6">
                <div>
                  <label className="block text-slate-500 text-sm font-bold mb-2">YouTube Video URL</label>
                  <input value={editingScript.videoUrl} onChange={(e) => setEditingScript({...editingScript, videoUrl: e.target.value})} className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-slate-300 font-mono text-sm text-left outline-none focus:border-red-500" />
                </div>
                <div>
                  <label className="block text-slate-500 text-sm font-bold mb-2">צבע ערכת נושא (blue / emerald / purple)</label>
                  <input value={editingScript.color} onChange={(e) => setEditingScript({...editingScript, color: e.target.value})} className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-white font-bold text-center outline-none focus:border-[#f59e0b]" />
                </div>
                <div>
                  <label className="block text-slate-500 text-sm font-bold mb-2">תיאור קצר (בקטלוג)</label>
                  <textarea value={editingScript.shortDesc} onChange={(e) => setEditingScript({...editingScript, shortDesc: e.target.value})} className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-white text-sm h-[6.5rem] outline-none focus:border-[#f59e0b]" />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sky-400 text-sm font-bold mb-2">קישור מדריך (גוגל דרייב / PDF)</label>
                <input
                  placeholder="https://drive.google.com/file/d/... או קישור צפייה בדרייב"
                  value={editingScript.guideUrl ?? ''}
                  onChange={(e) => setEditingScript({ ...editingScript, guideUrl: e.target.value })}
                  className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-slate-300 font-mono text-sm text-left outline-none focus:border-sky-500"
                />
                <p className="text-[11px] text-slate-500 mt-1.5">יוצג באתר ככפתור &quot;מדריך&quot; ליד הרכישה כשהשדה מלא.</p>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-slate-500 text-sm font-bold mb-2">תיאור מלא ומפורט (עמוד מוצר)</label>
                <textarea value={editingScript.description} onChange={(e) => setEditingScript({...editingScript, description: e.target.value})} className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-white text-sm h-32 outline-none focus:border-[#f59e0b]" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[#10b981] text-sm font-bold mb-2">תמונת הסקריפט (קישור או העלאה לענן)</label>
                <div className="space-y-3">
                  <input
                    placeholder="הדבק כאן קישור לתמונה .jpg או .png"
                    value={editingScript.imageUrl || ''}
                    onChange={(e) => setEditingScript({ ...editingScript, imageUrl: e.target.value })}
                    className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-white text-left outline-none focus:border-[#10b981]"
                  />
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold cursor-pointer">
                      {isUploadingCoverImage ? 'מעלה לענן...' : 'בחר תמונה'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleScriptImageUpload}
                        disabled={isUploadingCoverImage}
                        className="hidden"
                      />
                    </label>
                    <span className="text-xs text-slate-500">הקובץ יועלה לענן ויישמר כלינק ציבורי (https).</span>
                  </div>
                  {coverUploadError && (
                    <p className="text-xs text-red-400 font-bold">{coverUploadError}</p>
                  )}
                  {editingScript.imageUrl && (
                    <div className="mt-2">
                      <p className="text-xs text-slate-500 mb-1">תצוגה מקדימה:</p>
                      <img
                        src={editingScript.imageUrl}
                        alt=""
                        className="w-24 h-24 rounded-xl object-cover border border-slate-700"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800">
              <button 
                onClick={() => {
                  const exists = scripts.find(i => i.id === editingScript.id);
                  if (exists) {
                    setScripts(scripts.map(i => i.id === editingScript.id ? editingScript : i));
                  } else {
                    setScripts([...scripts, editingScript]);
                  }
                  setEditingScript(null);
                }}
                className="w-full py-5 bg-[#f59e0b] text-slate-950 font-black rounded-2xl text-xl shadow-xl hover:bg-[#d97706] transition-all"
              >
                שמור סקריפט במערכת
              </button>
            </div>

          </div>

        ) : editingPromotion ? (

          <div className="bg-[#0b1121] border border-[#f97316] rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative animate-in fade-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-10 pb-6 border-b border-slate-800">
              <div className="flex gap-4">
                <button onClick={() => setPromotions(promotions.filter(i => i.id !== editingPromotion.id))} className="w-12 h-12 flex items-center justify-center border border-red-500/30 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition">🗑️</button>
                <button onClick={() => setEditingPromotion(null)} className="bg-[#f97316] text-white px-8 py-2 rounded-xl font-black hover:bg-[#ea580c] transition">סגור עריכה</button>
              </div>
              <h2 className="text-3xl font-black text-white">{editingPromotion.name || 'מבצע חדש'}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 max-h-[50vh] overflow-y-auto px-2 custom-scrollbar">
              <div className="space-y-6">
                <div>
                  <label className="block text-slate-500 text-sm font-bold mb-2">שם החבילה</label>
                  <input value={editingPromotion.name || ''} onChange={(e) => setEditingPromotion({ ...editingPromotion, name: e.target.value })} className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-white font-black outline-none focus:border-[#f97316] transition" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[#f97316] text-sm font-bold mb-2">מחיר מבצע</label>
                    <input value={editingPromotion.price || ''} onChange={(e) => setEditingPromotion({ ...editingPromotion, price: e.target.value })} className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-white font-black text-left outline-none focus:border-[#f97316]" />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-sm font-bold mb-2">מחיר מקורי</label>
                    <input value={editingPromotion.originalPrice || ''} onChange={(e) => setEditingPromotion({ ...editingPromotion, originalPrice: e.target.value })} className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-slate-300 text-left outline-none focus:border-[#f97316]" />
                  </div>
                </div>
                <div>
                  <label className="block text-[#5c5cfc] text-sm font-bold mb-2">לינק ZIP לחבילה (נשלח למייל אחרי אישור תשלום)</label>
                  <input
                    value={editingPromotion.downloadUrl || ''}
                    onChange={(e) => setEditingPromotion({ ...editingPromotion, downloadUrl: e.target.value })}
                    placeholder="https://drive.google.com/uc?export=download&id=..."
                    className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-slate-300 font-mono text-sm text-left outline-none focus:border-[#5c5cfc]"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5">שים כאן ZIP אחד עם כל הסקריפטים בחבילה. זה הקישור שיישלח אוטומטית ללקוח במייל.</p>
                  {isDriveViewZipUrl && (
                    <div className="mt-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                      <p className="text-[11px] text-amber-200 font-bold mb-2">
                        זוהה קישור Google Drive מסוג צפייה (view). מומלץ להשתמש בקישור הורדה ישיר כדי שה-ZIP ירד מיד.
                      </p>
                      {directDriveZipUrl && (
                        <button
                          type="button"
                          onClick={() => setEditingPromotion({ ...editingPromotion, downloadUrl: directDriveZipUrl })}
                          className="text-[11px] px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-black transition"
                        >
                          המר אוטומטית לקישור הורדה ישיר
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[#5c5cfc] text-sm font-bold mb-2">לינק ניסיון (אופציונלי)</label>
                  <input value={editingPromotion.trialDownloadUrl || ''} onChange={(e) => setEditingPromotion({ ...editingPromotion, trialDownloadUrl: e.target.value })} className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-slate-300 font-mono text-sm text-left outline-none focus:border-[#5c5cfc]" />
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-slate-500 text-sm font-bold mb-2">YouTube Video URL</label>
                  <input value={editingPromotion.videoUrl || ''} onChange={(e) => setEditingPromotion({ ...editingPromotion, videoUrl: e.target.value })} className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-slate-300 font-mono text-sm text-left outline-none focus:border-red-500" />
                </div>
                <div>
                  <label className="block text-slate-500 text-sm font-bold mb-2">צבע ערכת נושא (blue / emerald / purple)</label>
                  <input value={editingPromotion.color || 'blue'} onChange={(e) => setEditingPromotion({ ...editingPromotion, color: e.target.value })} className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-white font-bold text-center outline-none focus:border-[#f97316]" />
                </div>
                <div>
                  <label className="block text-slate-500 text-sm font-bold mb-2">תיאור קצר (בקטלוג מבצעים)</label>
                  <textarea value={editingPromotion.shortDesc || ''} onChange={(e) => setEditingPromotion({ ...editingPromotion, shortDesc: e.target.value })} className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-white text-sm h-[6.5rem] outline-none focus:border-[#f97316]" />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sky-400 text-sm font-bold mb-2">קישור מדריך (גוגל דרייב / PDF)</label>
                <input
                  placeholder="https://drive.google.com/file/d/... או קישור צפייה בדרייב"
                  value={editingPromotion.guideUrl || ''}
                  onChange={(e) => setEditingPromotion({ ...editingPromotion, guideUrl: e.target.value })}
                  className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-slate-300 font-mono text-sm text-left outline-none focus:border-sky-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-500 text-sm font-bold mb-2">תיאור מלא של המבצע</label>
                <textarea value={editingPromotion.description || ''} onChange={(e) => setEditingPromotion({ ...editingPromotion, description: e.target.value })} className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-white text-sm h-32 outline-none focus:border-[#f97316]" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-amber-400 text-sm font-bold mb-2">קישורי סקריפטים בחבילה (כל שורה קישור)</label>
                <textarea
                  value={(editingPromotion.bundleScriptLinks || []).join('\n')}
                  onChange={(e) => setEditingPromotion({
                    ...editingPromotion,
                    bundleScriptLinks: e.target.value.split('\n').map((line) => line.trim()).filter(Boolean),
                  })}
                  className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-white text-sm h-32 outline-none focus:border-amber-500"
                  placeholder="https://...\nhttps://..."
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[#10b981] text-sm font-bold mb-2">תמונת המבצע (קישור או העלאה לענן)</label>
                <div className="space-y-3">
                  <input
                    placeholder="הדבק כאן קישור לתמונה .jpg או .png"
                    value={editingPromotion.imageUrl || ''}
                    onChange={(e) => setEditingPromotion({ ...editingPromotion, imageUrl: e.target.value })}
                    className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-white text-left outline-none focus:border-[#10b981]"
                  />
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold cursor-pointer">
                      {isUploadingCoverImage ? 'מעלה לענן...' : 'בחר תמונה'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePromotionImageUpload}
                        disabled={isUploadingCoverImage}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {coverUploadError && (
                    <p className="text-xs text-red-400 font-bold">{coverUploadError}</p>
                  )}
                  {editingPromotion.imageUrl && (
                    <div className="mt-2">
                      <p className="text-xs text-slate-500 mb-1">תצוגה מקדימה:</p>
                      <img
                        src={editingPromotion.imageUrl}
                        alt=""
                        className="w-24 h-24 rounded-xl object-cover border border-slate-700"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-slate-700 bg-slate-900/40 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="text-sm font-bold text-slate-100">עמוד מבצעים באתר החי</div>
              <button
                type="button"
                onClick={() =>
                  setSiteSettings((prev) => ({
                    ...prev,
                    promotionsPageVisible: prev.promotionsPageVisible === false ? true : false,
                  }))
                }
                className={`px-4 py-2 rounded-xl text-sm font-black transition ${
                  siteSettings.promotionsPageVisible === false
                    ? 'bg-red-900/40 text-red-300 border border-red-500/40'
                    : 'bg-emerald-900/40 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {siteSettings.promotionsPageVisible === false ? 'העמוד מוסתר באתר (לחץ להצגה)' : 'העמוד מוצג באתר (לחץ להסתרה)'}
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800">
              <button
                onClick={() => {
                  const exists = promotions.find(i => i.id === editingPromotion.id);
                  if (exists) {
                    setPromotions(promotions.map(i => i.id === editingPromotion.id ? editingPromotion : i));
                  } else {
                    setPromotions([...promotions, editingPromotion]);
                  }
                  setEditingPromotion(null);
                }}
                className="w-full py-5 bg-[#f97316] text-white font-black rounded-2xl text-xl shadow-xl hover:bg-[#ea580c] transition-all"
              >
                שמור מבצע במערכת
              </button>
            </div>
          </div>

        ) : editingProduct ? (
          
          // --- ממשק עריכה למוצרים/כריכות ---
          <div className="bg-[#0b1121] border border-[#5c5cfc] rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative animate-in fade-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-10 pb-6 border-b border-slate-800">
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    if (editingProductKind === 'covers') {
                      setCovers(covers.filter(i => i.id !== editingProduct.id));
                    } else {
                      setProducts(products.filter(i => i.id !== editingProduct.id));
                    }
                  }}
                  className="w-12 h-12 flex items-center justify-center border border-red-500/30 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition"
                >
                  🗑️
                </button>
                <button onClick={() => setEditingProduct(null)} className="bg-[#5c5cfc] text-white px-8 py-2 rounded-xl font-black hover:bg-[#4a4af0] transition">סגור עריכה</button>
              </div>
              <h2 className="text-3xl font-black text-white">{editingProduct.name || (editingProductKind === 'covers' ? 'כריכה חדשה' : 'מוצר חדש')}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 max-h-[50vh] overflow-y-auto px-2 custom-scrollbar">
              <div>
                <label className="block text-slate-500 text-sm font-bold mb-2">שם המוצר / הספר</label>
                <input value={editingProduct.name} onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})} className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-white font-black outline-none focus:border-[#5c5cfc]" />
              </div>
              <div>
                <label className="block text-slate-500 text-sm font-bold mb-2">מחיר (₪)</label>
                <input value={editingProduct.price} onChange={(e) => setEditingProduct({...editingProduct, price: e.target.value})} className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-white font-black text-left outline-none focus:border-[#5c5cfc]" />
              </div>
              
              {/* שדה לתמונת המוצר - קישור או העלאה מהמחשב */}
              <div>
                <label className="block text-[#10b981] text-sm font-bold mb-2">תמונת המוצר (קישור או העלאה מהמחשב)</label>
                <div className="space-y-3">
                  <input
                    placeholder="הדבק כאן קישור לתמונה .jpg או .png"
                    value={editingProduct.imageUrl}
                    onChange={(e) => setEditingProduct({ ...editingProduct, imageUrl: e.target.value })}
                    className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-white text-left outline-none focus:border-[#10b981]"
                  />
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold cursor-pointer">
                      {isUploadingCoverImage ? 'מעלה לענן...' : 'בחר תמונה'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProductImageUpload}
                        disabled={isUploadingCoverImage}
                        className="hidden"
                      />
                    </label>
                    <span className="text-xs text-slate-500">
                      הקובץ יועלה לענן ויישמר כלינק ציבורי (https).
                    </span>
                  </div>
                  {isUploadingCoverImage && (
                    <p className="text-xs text-amber-400 font-bold">שומר תמונה בענן... נא להמתין.</p>
                  )}
                  {coverUploadError && (
                    <p className="text-xs text-red-400 font-bold">{coverUploadError}</p>
                  )}
                  {editingProduct.imageUrl && (
                    <div className="mt-2">
                      <p className="text-xs text-slate-500 mb-1">תצוגה מקדימה:</p>
                      <img
                        src={editingProduct.imageUrl}
                        alt=""
                        className="w-24 h-24 rounded-xl object-cover border border-slate-700"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[#5c5cfc] text-sm font-bold mb-2">קישור להורדת המוצר (Google Drive וכדומה)</label>
                <input placeholder="הדבק כאן את הקישור להורדה" value={editingProduct.downloadUrl} onChange={(e) => setEditingProduct({...editingProduct, downloadUrl: e.target.value})} className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-indigo-400 font-mono text-sm text-left outline-none focus:border-[#5c5cfc]" />
              </div>

              <div>
                <label className="block text-slate-500 text-sm font-bold mb-2">קישור לסרטון YouTube (הדגמת המוצר)</label>
                <input
                  placeholder="הדבק כאן קישור לסרטון יוטיוב"
                  value={editingProduct.videoUrl || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, videoUrl: e.target.value })}
                  className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-slate-300 font-mono text-sm text-left outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-slate-500 text-sm font-bold mb-2">קישור לדוגמת PDF (תצוגה מקדימה נגללת)</label>
                <input
                  placeholder="קישור ל-PDF או Google Drive – לדוגמה: הגדה של פסח"
                  value={editingProduct.pdfPreviewUrl || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, pdfPreviewUrl: e.target.value })}
                  className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-slate-300 font-mono text-sm text-left outline-none focus:border-amber-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-500 text-sm font-bold mb-2">תיאור קצר (לכרטיס המוצר)</label>
                <textarea
                  value={editingProduct.description}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-white text-sm h-24 outline-none focus:border-[#5c5cfc]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-500 text-sm font-bold mb-2">תיאור מלא (לעמוד הפירוט)</label>
                <textarea
                  value={editingProduct.fullDesc || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, fullDesc: e.target.value })}
                  className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-white text-sm h-28 outline-none focus:border-[#5c5cfc]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-500 text-sm font-bold mb-2">
                  יכולות / הוראות (features) – כל שורה היא יכולת נפרדת
                </label>
                <textarea
                  placeholder="לדוגמה:\nעימוד אוטומטי של הערות שוליים\nניקוי טקסט מיובא מוורד"
                  value={editingProduct.featuresText || ''}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      featuresText: e.target.value,
                    })
                  }
                  className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-white text-sm h-32 outline-none focus:border-[#10b981]"
                />
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800">
              <button 
                onClick={() => {
                  const text = (editingProduct.featuresText || '').trim();
                  let featuresValue = editingProduct.features;
                  if (text) {
                    const lines = text
                      .split('\n')
                      .map((l: string) => l.trim())
                      .filter(Boolean);
                    featuresValue = lines;
                  }

                  const productToSave = {
                    ...editingProduct,
                    features: featuresValue,
                  };

                  const currentList = editingProductKind === 'covers' ? covers : products;
                  const exists = currentList.find(i => i.id === editingProduct.id);
                  if (exists) {
                    const nextList = currentList.map(i => i.id === editingProduct.id ? productToSave : i);
                    if (editingProductKind === 'covers') setCovers(nextList);
                    else setProducts(nextList);
                  } else {
                    const nextList = [...currentList, productToSave];
                    if (editingProductKind === 'covers') setCovers(nextList);
                    else setProducts(nextList);
                  }
                  setEditingProduct(null);
                }}
                className="w-full py-5 bg-[#5c5cfc] text-white font-black rounded-2xl text-xl shadow-xl hover:bg-[#4a4af0] transition-all"
              >
                {editingProductKind === 'covers' ? 'שמור כריכה במערכת' : 'שמור מוצר במערכת'}
              </button>
            </div>
          </div>

        ) : viewMode === 'orders' ? (

          <div className="bg-[#0b1121] border border-slate-800 rounded-[2.5rem] p-8 md:p-12 shadow-xl animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
              <h2 className="text-3xl font-black text-indigo-400">הזמנות ותשלומים</h2>
              <div className="flex items-center gap-3">
                <input
                  value={orderCodeFilter}
                  onChange={(e) => setOrderCodeFilter(e.target.value)}
                  placeholder="סינון לפי קוד הזמנה"
                  className="bg-[#060b14] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-400"
                />
                {orderCodeFilter && (
                  <button
                    onClick={() => setOrderCodeFilter('')}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl text-xs font-bold transition"
                  >
                    נקה סינון
                  </button>
                )}
                <button
                  onClick={loadOrders}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold transition shadow-lg flex items-center gap-2"
                >
                  רענן הזמנות
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800 text-sm">
                    <th className="pb-4 px-4 font-bold">קוד הזמנה</th>
                    <th className="pb-4 px-4 font-bold">לקוח</th>
                    <th className="pb-4 px-4 font-bold">מוצר</th>
                    <th className="pb-4 px-4 font-bold">סכום</th>
                    <th className="pb-4 px-4 font-bold">סטטוס</th>
                    <th className="pb-4 px-4 font-bold">פעולה</th>
                  </tr>
                </thead>
                <tbody>
                  {isOrdersLoading && (
                    <tr>
                      <td colSpan={6} className="py-10 px-4 text-center text-slate-400 font-bold">
                        טוען הזמנות...
                      </td>
                    </tr>
                  )}
                  {!isOrdersLoading && ordersError && (
                    <tr>
                      <td colSpan={6} className="py-10 px-4 text-center text-red-400 font-bold">
                        {ordersError}
                      </td>
                    </tr>
                  )}
                  {!isOrdersLoading && !ordersError && filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 px-4 text-center text-slate-500 font-bold">
                        {orders.length === 0 ? 'עדיין לא התקבלו הזמנות רכישה.' : 'לא נמצאו הזמנות עבור קוד זה.'}
                      </td>
                    </tr>
                  )}
                  {!isOrdersLoading && !ordersError && filteredOrders.map((order) => (
                    <tr key={order.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition">
                      <td className="py-5 px-4 text-indigo-300 font-mono font-bold text-xs">{order.orderCode}</td>
                      <td className="py-5 px-4 text-slate-200">
                        <div className="font-bold">{order.customerName}</div>
                        <div className="text-xs text-slate-400">{order.customerEmail}</div>
                      </td>
                      <td className="py-5 px-4 text-slate-300 font-bold">{order.productName}</td>
                      <td className="py-5 px-4 text-amber-400 font-bold">{order.priceLabel}</td>
                      <td className="py-5 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-black ${order.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-300'}`}>
                          {order.status === 'paid' ? 'שולם' : 'ממתין לאישור'}
                        </span>
                      </td>
                      <td className="py-5 px-4">
                        {order.status === 'paid' ? (
                          <span className="text-emerald-400 text-xs font-bold block">
                            {order.paidAt ? (
                              <>
                                אושר {new Date(order.paidAt).toLocaleDateString('he-IL')}
                                <span className="block text-slate-400 font-normal mt-0.5">
                                  {new Date(order.paidAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </>
                            ) : 'אושר'}
                          </span>
                        ) : (
                          <button
                            onClick={() => markOrderAsPaid(order.id)}
                            disabled={isMarkingOrderPaid === order.id}
                            className={`px-4 py-2 rounded-lg text-xs font-black transition ${
                              isMarkingOrderPaid === order.id
                                ? 'bg-emerald-900 text-emerald-200 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            }`}
                          >
                            {isMarkingOrderPaid === order.id ? 'מאשר...' : 'אשר תשלום'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        ) : viewMode === 'leads' ? (
          
          <div className="bg-[#0b1121] border border-slate-800 rounded-[2.5rem] p-8 md:p-12 shadow-xl animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
              <h2 className="text-3xl font-black text-emerald-500">פירוט לידים מהאתר</h2>
              <button onClick={downloadLeadsCSV} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold transition shadow-lg flex items-center gap-2">⬇️ הורד קובץ CSV</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800 text-lg">
                    <th className="pb-4 px-4 font-bold">שם</th>
                    <th className="pb-4 px-4 font-bold">אימייל</th>
                    <th className="pb-4 px-4 font-bold">תאריך הרשמה</th>
                    <th className="pb-4 px-4 font-bold">התעניינות במוצר</th>
                  </tr>
                </thead>
                <tbody>
                  {isLeadsLoading && (
                    <tr>
                      <td colSpan={4} className="py-10 px-4 text-center text-slate-400 font-bold">
                        טוען לידים...
                      </td>
                    </tr>
                  )}
                  {!isLeadsLoading && leadsError && (
                    <tr>
                      <td colSpan={4} className="py-10 px-4 text-center text-red-400 font-bold">
                        {leadsError}
                      </td>
                    </tr>
                  )}
                  {!isLeadsLoading && !leadsError && leads.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-10 px-4 text-center text-slate-500 font-bold">
                        עדיין לא התקבלו לידים מהאתר.
                      </td>
                    </tr>
                  )}
                  {!isLeadsLoading && !leadsError && leads.map((l) => (
                    <tr key={l.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition">
                      <td className="py-6 px-4 text-slate-200 font-bold">{l.name}</td>
                      <td className="py-6 px-4 font-mono text-indigo-400 font-bold">{l.email}</td>
                      <td className="py-6 px-4 text-slate-300">{new Date(l.timestamp).toLocaleDateString('he-IL')}</td>
                      <td className="py-6 px-4 text-slate-300 font-bold">{l.scriptName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        ) : viewMode === 'json' ? (
          
          <div className="bg-[#0b1121] border border-slate-800 rounded-[2.5rem] p-8 shadow-xl animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-indigo-400">קוד המערכת המלא (JSON)</h2>
              <button onClick={() => { localStorage.removeItem('yosef_admin_backup'); localStorage.removeItem('yosef_admin_promotions_backup'); localStorage.removeItem('yosef_admin_products_backup'); localStorage.removeItem('yosef_admin_covers_backup'); localStorage.removeItem('yosef_admin_site_settings_backup'); alert('הזיכרון אופס בהצלחה!'); }} className="text-sm text-red-500 hover:underline">אפס זיכרון דפדפן</button>
            </div>
            <pre className="bg-[#060b14] border border-slate-800 p-6 rounded-2xl overflow-x-auto text-left font-mono text-xs text-emerald-400 h-[60vh] scrollbar-thin">
              {JSON.stringify(
                {
                  SCRIPTS: scripts.map((s: any) => ({
                    ...s,
                    imageUrl: stripDataUrl(s.imageUrl)
                  })),
                  PROMOTIONS: promotions.map((p: any) => ({
                    ...p,
                    imageUrl: p.imageUrl && String(p.imageUrl).startsWith('data:') ? '[תמונה Base64 – הוסרה לתצוגה]' : (p.imageUrl || '')
                  })),
                  OTHER_PRODUCTS: products.map((p: any) => ({
                    ...p,
                    imageUrl: p.imageUrl && String(p.imageUrl).startsWith('data:') ? '[תמונה Base64 – הוסרה לתצוגה]' : (p.imageUrl || '')
                  })),
                  TORAH_COVER_DESIGNS: covers.map((c: any) => ({
                    ...c,
                    imageUrl: c.imageUrl && String(c.imageUrl).startsWith('data:') ? '[תמונה Base64 – הוסרה לתצוגה]' : (c.imageUrl || '')
                  })),
                  SITE_SETTINGS: siteSettings
                },
                null,
                2
              )}
            </pre>
          </div>

        ) : viewMode === 'promotions' ? (

          <div className="grid gap-6 animate-in fade-in duration-300">
            <div className="rounded-2xl border border-slate-700 bg-slate-900/40 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="text-sm font-bold text-slate-100">עמוד מבצעים באתר החי</div>
              <button
                type="button"
                onClick={() =>
                  setSiteSettings((prev) => ({
                    ...prev,
                    promotionsPageVisible: prev.promotionsPageVisible === false ? true : false,
                  }))
                }
                className={`px-4 py-2 rounded-xl text-sm font-black transition ${
                  siteSettings.promotionsPageVisible === false
                    ? 'bg-red-900/40 text-red-300 border border-red-500/40'
                    : 'bg-emerald-900/40 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {siteSettings.promotionsPageVisible === false ? 'העמוד מוסתר באתר (לחץ להצגה)' : 'העמוד מוצג באתר (לחץ להסתרה)'}
              </button>
            </div>

            {promotions.map((p) => (
              <div key={p.id} className="bg-[#0b1121] border border-slate-800 p-8 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center shadow-lg hover:border-slate-700 transition">
                <div className="flex items-center gap-6 mb-4 md:mb-0">
                  <button onClick={() => setPromotions(promotions.filter(i => i.id !== p.id))} className="text-red-500 hover:scale-110 transition-transform bg-red-500/10 p-3 rounded-xl">🗑️</button>
                  <div>
                    <h3 className="text-2xl font-black text-white">{p.name}</h3>
                    <p className="text-slate-400 text-sm">{p.price}</p>
                  </div>
                </div>
                <button onClick={() => setEditingPromotion(p)} className="bg-slate-800 hover:bg-[#f97316] hover:text-white px-10 py-3 rounded-2xl font-black text-[#f97316] transition-all border border-slate-700 w-full md:w-auto">ערוך מבצע</button>
              </div>
            ))}
          </div>

        ) : viewMode === 'products' ? (

          <div className="grid gap-6 animate-in fade-in duration-300">
            <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="text-sm font-bold text-slate-100">עמוד מוצרים באתר החי</div>
              <button
                type="button"
                onClick={() =>
                  setSiteSettings((prev) => ({
                    ...prev,
                    productsPageVisible: prev.productsPageVisible === false ? true : false,
                  }))
                }
                className={`px-4 py-2 rounded-xl text-sm font-black transition ${
                  siteSettings.productsPageVisible === false
                    ? 'bg-red-900/40 text-red-300 border border-red-500/40'
                    : 'bg-emerald-900/40 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {siteSettings.productsPageVisible === false ? 'העמוד מוסתר באתר (לחץ להצגה)' : 'העמוד מוצג באתר (לחץ להסתרה)'}
              </button>
            </div>
            {products.map((p) => (
              <div key={p.id} className="bg-[#0b1121] border border-slate-800 p-8 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center shadow-lg hover:border-slate-700 transition">
                <div className="flex items-center gap-6 mb-4 md:mb-0">
                  <button onClick={() => setProducts(products.filter(i => i.id !== p.id))} className="text-red-500 hover:scale-110 transition-transform bg-red-500/10 p-3 rounded-xl">🗑️</button>
                  <button
                    type="button"
                    onClick={() =>
                      setProducts(
                        products.map((i) =>
                          i.id === p.id ? { ...i, isPublished: !(i.isPublished !== false) } : i
                        )
                      )
                    }
                    className={`px-3 py-2 rounded-xl text-xs font-black transition border ${
                      p.isPublished === false
                        ? 'bg-red-900/30 text-red-300 border-red-500/30'
                        : 'bg-emerald-900/30 text-emerald-300 border-emerald-500/30'
                    }`}
                    title="הצג/הסתר מוצר באתר"
                  >
                    {p.isPublished === false ? 'מוסתר' : 'מוצג'}
                  </button>
                  {/* הצגת תמונה קטנה ברשימה אם קיימת, אחרת אימוג'י */}
                  {p.imageUrl ? (
                    <img src={p.imageUrl} className="w-12 h-12 rounded-lg object-cover" alt="" />
                  ) : (
                    <span className="text-4xl">📘</span>
                  )}
                  <div>
                    <h3 className="text-2xl font-black text-white">{p.name}</h3>
                    <p className="text-slate-400 text-sm">{p.price}</p>
                    {p.videoUrl && (
                      <p className="text-[11px] text-red-400 mt-1 font-bold">כולל סרטון הדגמה</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() =>
                    {
                      setEditingProductKind('products');
                      setEditingProduct({
                        ...p,
                        featuresText: p.featuresText || mapFeaturesToText(p.features),
                      });
                    }
                  }
                  className="bg-slate-800 hover:bg-[#5c5cfc] hover:text-white px-10 py-3 rounded-2xl font-black text-[#5c5cfc] transition-all border border-slate-700 w-full md:w-auto"
                >
                  ערוך מוצר
                </button>
              </div>
            ))}
          </div>

        ) : viewMode === 'covers' ? (

          <div className="grid gap-6 animate-in fade-in duration-300">
            <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="text-sm font-bold text-slate-100">עמוד כריכות באתר החי</div>
              <button
                type="button"
                onClick={() =>
                  setSiteSettings((prev) => ({
                    ...prev,
                    coversPageVisible: prev.coversPageVisible === false ? true : false,
                  }))
                }
                className={`px-4 py-2 rounded-xl text-sm font-black transition ${
                  siteSettings.coversPageVisible === false
                    ? 'bg-red-900/40 text-red-300 border border-red-500/40'
                    : 'bg-emerald-900/40 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {siteSettings.coversPageVisible === false ? 'העמוד מוסתר באתר (לחץ להצגה)' : 'העמוד מוצג באתר (לחץ להסתרה)'}
              </button>
            </div>
            {covers.map((c) => (
              <div key={c.id} className="bg-[#0b1121] border border-slate-800 p-8 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center shadow-lg hover:border-slate-700 transition">
                <div className="flex items-center gap-6 mb-4 md:mb-0">
                  <button onClick={() => setCovers(covers.filter(i => i.id !== c.id))} className="text-red-500 hover:scale-110 transition-transform bg-red-500/10 p-3 rounded-xl">🗑️</button>
                  <button
                    type="button"
                    onClick={() =>
                      setCovers(
                        covers.map((i) =>
                          i.id === c.id ? { ...i, isPublished: !(i.isPublished !== false) } : i
                        )
                      )
                    }
                    className={`px-3 py-2 rounded-xl text-xs font-black transition border ${
                      c.isPublished === false
                        ? 'bg-red-900/30 text-red-300 border-red-500/30'
                        : 'bg-emerald-900/30 text-emerald-300 border-emerald-500/30'
                    }`}
                    title="הצג/הסתר כריכה באתר"
                  >
                    {c.isPublished === false ? 'מוסתר' : 'מוצג'}
                  </button>
                  {c.imageUrl ? (
                    <img src={c.imageUrl} className="w-12 h-12 rounded-lg object-cover" alt="" />
                  ) : (
                    <span className="text-4xl">🖼️</span>
                  )}
                  <div>
                    <h3 className="text-2xl font-black text-white">{c.name}</h3>
                    <p className="text-slate-400 text-sm">{c.price}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingProductKind('covers');
                    setEditingProduct({
                      ...c,
                      featuresText: c.featuresText || mapFeaturesToText(c.features),
                    });
                  }}
                  className="bg-slate-800 hover:bg-[#14b8a6] hover:text-white px-10 py-3 rounded-2xl font-black text-[#14b8a6] transition-all border border-slate-700 w-full md:w-auto"
                >
                  ערוך כריכה
                </button>
              </div>
            ))}
          </div>

        ) : (

          <div className="grid gap-6 animate-in fade-in duration-300">
            <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="text-sm font-bold text-slate-100">עמוד סקריפטים באתר החי</div>
              <button
                type="button"
                onClick={() =>
                  setSiteSettings((prev) => ({
                    ...prev,
                    scriptsPageVisible: prev.scriptsPageVisible === false ? true : false,
                  }))
                }
                className={`px-4 py-2 rounded-xl text-sm font-black transition ${
                  siteSettings.scriptsPageVisible === false
                    ? 'bg-red-900/40 text-red-300 border border-red-500/40'
                    : 'bg-emerald-900/40 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {siteSettings.scriptsPageVisible === false ? 'העמוד מוסתר באתר (לחץ להצגה)' : 'העמוד מוצג באתר (לחץ להסתרה)'}
              </button>
            </div>
            {scripts.map((s) => (
              <div key={s.id} className="bg-[#0b1121] border border-slate-800 p-8 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center shadow-lg hover:border-slate-700 transition">
                <div className="flex items-center gap-6 mb-4 md:mb-0">
                  <button onClick={() => setScripts(scripts.filter(i => i.id !== s.id))} className="text-red-500 hover:scale-110 transition-transform bg-red-500/10 p-3 rounded-xl">🗑️</button>
                  <button
                    type="button"
                    onClick={() =>
                      setScripts(
                        scripts.map((i) =>
                          i.id === s.id ? { ...i, isPublished: !(i.isPublished !== false) } : i
                        )
                      )
                    }
                    className={`px-3 py-2 rounded-xl text-xs font-black transition border ${
                      s.isPublished === false
                        ? 'bg-red-900/30 text-red-300 border-red-500/30'
                        : 'bg-emerald-900/30 text-emerald-300 border-emerald-500/30'
                    }`}
                    title="הצג/הסתר סקריפט באתר"
                  >
                    {s.isPublished === false ? 'מוסתר' : 'מוצג'}
                  </button>
                  <h3 className="text-2xl font-black text-white">{s.name}</h3>
                </div>
                <button onClick={() => setEditingScript(s)} className="bg-slate-800 hover:bg-[#f59e0b] hover:text-slate-950 px-10 py-3 rounded-2xl font-black text-[#f59e0b] transition-all border border-slate-700 w-full md:w-auto">ערוך סקריפט</button>
              </div>
            ))}
          </div>
          
        )}
      </div>
    </div>
  );
};

export default AdminPortal;