import React from 'react';

interface OtherProductsProps {
  onNavigate: (page: string) => void; // הפונקציה שמעבירה דפים ב-App.tsx
  products: any[];
}

const OtherProducts: React.FC<OtherProductsProps> = ({ onNavigate, products }) => {
  const publishedProducts = products.filter((p: any) => p.isPublished);

  return (
    <div className="animate-fadeIn pb-24 max-w-7xl mx-auto px-4" dir="rtl">
      <header className="text-center mb-16 pt-12">
        <h1 className="text-5xl md:text-7xl font-black mb-6 bg-gradient-to-r from-white via-amber-200 to-white bg-clip-text text-transparent tracking-tighter uppercase italic italic">
          מוצרים נוספים
        </h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {publishedProducts.map((product: any) => (
          <div 
            key={product.id} 
            className="group bg-slate-900/40 rounded-[2.5rem] border border-slate-800 overflow-hidden hover:bg-slate-800/60 transition-all duration-500 hover:-translate-y-2 shadow-xl flex flex-col"
          >
            {/* תמונה/אייקון */}
            <div className="h-64 bg-slate-950 flex items-center justify-center relative">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain p-6" />
              ) : (
                <span className="text-8xl">{product.image || '📘'}</span>
              )}
            </div>

            {/* פרטים */}
            <div className="p-8 flex flex-col flex-grow text-right">
              <h3 className="text-2xl font-black text-white mb-4 group-hover:text-amber-400 transition-colors">
                {product.name}
              </h3>
              <p className="text-slate-400 text-sm mb-8 flex-grow">
                {product.description}
              </p>
              
              <div className="flex items-center justify-between mt-auto pt-6 border-t border-slate-800/50">
                <span className="text-2xl font-black text-amber-500">
                  {product.price}
                </span>
                
                {/* --- התיקון כאן: הפקודה onNavigate מעבירה לעמוד הפירוט --- */}
                <button 
                  onClick={() => onNavigate(product.id)}
                  className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white text-sm font-black rounded-xl transition-all shadow-lg"
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