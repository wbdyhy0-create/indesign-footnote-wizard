import React from 'react';

interface OtherProductsProps {
  onNavigate: (page: string) => void; // הפונקציה שמעבירה דפים ב-App.tsx
  products: any[];
}

const OtherProducts: React.FC<OtherProductsProps> = ({ onNavigate, products }) => {
  const publishedProducts = products.filter((p: any) => p.isPublished);
  const gridClasses =
    publishedProducts.length === 1
      ? 'grid grid-cols-1 justify-items-center gap-8'
      : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8';

  return (
    <div className="animate-fadeIn pb-16 max-w-6xl mx-auto px-4" dir="rtl">
      <header className="text-center mb-10 pt-6">
        <h1 className="text-3xl md:text-4xl font-black mb-3 bg-gradient-to-r from-white via-amber-200 to-white bg-clip-text text-transparent tracking-tighter uppercase italic italic">
          מוצרים נוספים
        </h1>
      </header>

      <div className={gridClasses}>
        {publishedProducts.map((product: any) => (
          <div 
            key={product.id} 
            className="group w-full max-w-md bg-slate-900/40 rounded-[2rem] border border-slate-800 overflow-hidden hover:bg-slate-800/60 transition-all duration-500 hover:-translate-y-2 shadow-xl flex flex-col"
          >
            {/* תמונה/אייקון */}
            <div className="h-52 bg-slate-950 flex items-center justify-center relative">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain p-5" />
              ) : (
                <span className="text-6xl">{product.image || '📘'}</span>
              )}
            </div>

            {/* פרטים */}
            <div className="p-6 flex flex-col flex-grow text-right">
              <h3 className="text-lg md:text-xl font-black text-white mb-2 group-hover:text-amber-400 transition-colors">
                {product.name}
              </h3>
              <p className="text-slate-400 text-sm mb-6 flex-grow">
                {product.description}
              </p>
              
              <div className="flex items-center justify-between mt-auto pt-5 border-t border-slate-800/50">
                <span className="text-lg md:text-xl font-black text-amber-500">
                  {product.price}
                </span>
                
                {/* --- התיקון כאן: הפקודה onNavigate מעבירה לעמוד הפירוט --- */}
                <button 
                  onClick={() => onNavigate(product.id)}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-black rounded-xl transition-all shadow-lg"
                >
                  לפרטים ורכישה
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OtherProducts;