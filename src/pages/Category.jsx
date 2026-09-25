import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronRight, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { fetchProductsByCategorySlug } from '../lib/supabase';
import { getErrorMessage } from '../lib/utils';
import ProductCard from '../components/ProductCard';
import { ProductCardSkeleton } from '../components/ui/Skeleton';

export default function Category() {
  const { slug } = useParams();
  const [category, setCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [sortBy, setSortBy] = useState('default');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadCategoryData() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetchProductsByCategorySlug(slug, sortBy);
        if (res.error) throw res.error;

        if (isMounted) {
          setCategory(res.category);
          setProducts(res.data || []);
        }
      } catch (err) {
        console.error('Error fetching category products:', err);
        if (isMounted) {
          setError(getErrorMessage(err, 'Failed to load products. Please try again.'));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadCategoryData();

    return () => {
      isMounted = false;
    };
  }, [slug, sortBy]);

  // Determine readable text color based on accent brightness
  const getContrastColor = (hex) => {
    if (!hex) return '#FFFFFF';
    const c = hex.replace('#', '');
    const r = parseInt(c.substr(0, 2), 16);
    const g = parseInt(c.substr(2, 2), 16);
    const b = parseInt(c.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 155 ? '#1A1A1A' : '#FFFFFF';
  };

  const accentColor = category?.accent_color || '#1A1A1A';
  const textColor = getContrastColor(accentColor);
  const isLightBg = textColor === '#1A1A1A';

  return (
    <div className="pb-24">
      
      {/* 1. Header Banner using category's accent_color */}
      <section
        style={{ backgroundColor: accentColor }}
        className="relative py-12 sm:py-16 transition-colors duration-500 overflow-hidden"
      >
        <div className="max-w-container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          {/* Breadcrumbs */}
          <nav className="flex items-center space-x-2 text-xs mb-4 font-medium" style={{ color: textColor, opacity: 0.85 }}>
            <Link to="/" className="hover:underline">
              Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="font-semibold">{category?.name || 'Category'}</span>
          </nav>

          <div className="max-w-2xl">
            <h1
              style={{ color: textColor }}
              className="font-serif text-3xl sm:text-5xl font-bold tracking-tight mb-3"
            >
              {category?.name || 'Exclusive Collection'}
            </h1>
            {category?.description && (
              <p
                style={{ color: textColor }}
                className={`text-sm sm:text-base font-light leading-relaxed max-w-xl ${
                  isLightBg ? 'text-neutral-800' : 'text-white/90'
                }`}
              >
                {category.description}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-container mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        {/* Controls Bar: Filter & Sort */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-neutral-100">
          <div className="flex items-center space-x-2 text-xs uppercase tracking-wider text-neutral-500 font-semibold">
            <SlidersHorizontal className="w-4 h-4" />
            <span>Showing {products.length} Products</span>
          </div>

          {/* Price Sorting Filter */}
          <div className="flex items-center space-x-3 self-end sm:self-auto">
            <label htmlFor="price-sort" className="text-xs uppercase tracking-wider text-neutral-400 font-semibold flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Sort:</span>
            </label>
            <select
              id="price-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-neutral-50 border border-neutral-200 text-xs text-neutral-800 font-medium py-2 px-3 rounded-[8px] focus:outline-none focus:border-neutral-400 cursor-pointer"
            >
              <option value="default">Featured</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-[12px] mb-8">
            {error}
          </div>
        )}

        {/* Product Grid: 2 columns on mobile, 4 columns on desktop */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 bg-neutral-50 rounded-[12px] border border-neutral-100">
            <h3 className="font-serif text-xl font-medium text-neutral-700 mb-2">
              No products found in this category
            </h3>
            <p className="text-xs text-neutral-400 mb-6">
              Please check back soon for our newest artisanal formulations.
            </p>
            <Link
              to="/"
              className="inline-block bg-[#1A1A1A] text-white text-xs font-semibold uppercase tracking-widest px-6 py-3 rounded-[8px] hover:bg-neutral-800"
            >
              Return to Home
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                accentColor={accentColor}
              />
            ))}
          </div>
        )}

      </main>

    </div>
  );
}
