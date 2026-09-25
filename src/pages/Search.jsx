import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ChevronRight, Search as SearchIcon, ArrowLeft } from 'lucide-react';
import { searchProducts } from '../lib/supabase';
import { getErrorMessage } from '../lib/utils';
import ProductCard from '../components/ProductCard';
import { ProductCardSkeleton } from '../components/ui/Skeleton';

export default function Search() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestRef = useRef(0);

  const displayQuery = query.length > 60 ? query.slice(0, 60) + '...' : query;

  useEffect(() => {
    if (!query.trim()) {
      requestRef.current++;
      setProducts([]);
      setLoading(false);
      setError(null);
      return;
    }

    // Debounce 300ms — wait until the query settles before searching
    const timer = setTimeout(async () => {
      const requestId = ++requestRef.current;
      setLoading(true);
      setError(null);
      try {
        // searchProducts accepts no abort signal, so a request-id guard
        // drops stale responses instead (same net effect as aborting).
        const data = await searchProducts(query.trim().slice(0, 100));
        if (requestRef.current === requestId) {
          setProducts(data);
        }
      } catch (err) {
        console.error('Error searching products:', err);
        if (requestRef.current === requestId) {
          setError(getErrorMessage(err, 'Failed to load products. Please try again.'));
        }
      } finally {
        if (requestRef.current === requestId) {
          setLoading(false);
        }
      }
    }, 300);

    // Cleanup: cancel timer (and invalidate any in-flight request) if query changes
    return () => {
      clearTimeout(timer);
      requestRef.current++;
    };
  }, [query]);

  return (
    <div className="pb-24">
      {/* Header Banner */}
      <section className="bg-neutral-900 text-white py-12 sm:py-16">
        <div className="max-w-container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumbs */}
          <nav className="flex items-center space-x-2 text-xs mb-4 font-medium text-neutral-400">
            <Link to="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-white font-semibold">Search</span>
          </nav>

          <div className="max-w-2xl">
            <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight mb-2">
              {query.trim() ? `Search Results` : `Search Mix Originals`}
            </h1>
            {query.trim() ? (
              <p className="text-sm sm:text-base text-neutral-400 font-light">
                {loading
                  ? `Searching for "${displayQuery}"...`
                  : `${products.length} ${products.length === 1 ? 'result' : 'results'} found for "${displayQuery}"`}
              </p>
            ) : (
              <p className="text-sm sm:text-base text-neutral-400 font-light">
                Enter keywords to find your favorite perfumes, skincare, and makeup.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-container mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Error message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-[12px] mb-8">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : !query.trim() ? (
          /* Empty initial search state */
          <div className="text-center py-20 bg-neutral-50 rounded-[12px] border border-neutral-100">
            <SearchIcon className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
            <h3 className="font-serif text-xl font-medium text-neutral-700 mb-2">
              Start your search
            </h3>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-sm mx-auto mb-6">
              Use the search bar above to look for fragrances, clean skincare, or editorial makeup.
            </p>
            <Link
              to="/"
              className="inline-flex items-center space-x-2 bg-[#1A1A1A] text-white text-xs font-semibold uppercase tracking-widest px-6 py-3 rounded-[8px] hover:bg-neutral-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </Link>
          </div>
        ) : products.length === 0 ? (
          /* No products found */
          <div className="text-center py-20 bg-neutral-50 rounded-[12px] border border-neutral-100">
            <SearchIcon className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <h3 className="font-serif text-xl sm:text-2xl font-medium text-neutral-800 mb-2">
              No products found for "{displayQuery}"
            </h3>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-md mx-auto mb-6">
              We couldn't find any products matching your search. Try checking your spelling or using more general keywords.
            </p>
            <Link
              to="/"
              className="inline-flex items-center space-x-2 bg-[#1A1A1A] text-white text-xs font-semibold uppercase tracking-widest px-6 py-3 rounded-[8px] hover:bg-neutral-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </Link>
          </div>
        ) : (
          /* Product Grid */
          <div className="space-y-6">
            <div className="text-xs uppercase tracking-wider text-neutral-500 font-semibold border-b border-neutral-100 pb-4">
              Showing {products.length} {products.length === 1 ? 'Product' : 'Products'}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
