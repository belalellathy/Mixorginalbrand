import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Sparkles, ShieldCheck, Truck, RefreshCw } from 'lucide-react';
import { fetchCategories, fetchFeaturedProducts, fetchBestsellersByRating } from '../lib/supabase';
import { getErrorMessage } from '../lib/utils';
import ProductCard from '../components/ProductCard';
import CategoryCard from '../components/CategoryCard';
import SlideUpText from '../components/ui/SlideUpText';
import { Bone, ProductCardSkeleton } from '../components/ui/Skeleton';

export default function Home() {
  const [categories, setCategories] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [bestsellers, setBestsellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const carouselRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function loadHomeData() {
      try {
        setLoading(true);
        setError(null);

        const [cats, feats, bests] = await Promise.all([
          fetchCategories(),
          fetchFeaturedProducts(),
          fetchBestsellersByRating(8)
        ]);

        if (isMounted) {
          setCategories(cats || []);
          setFeaturedProducts(feats || []);
          setBestsellers(bests || []);
        }
      } catch (err) {
        console.error('Error loading home data:', err);
        if (isMounted) {
          setError(getErrorMessage(err, 'Failed to load products. Please try again.'));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadHomeData();

    return () => {
      isMounted = false;
    };
  }, []);

  const scrollCarousel = (direction) => {
    if (carouselRef.current) {
      const scrollAmount = direction === 'left' ? -340 : 340;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-16 sm:space-y-24 pb-20">

      {/* 1. Hero Banner Section */}
      <section className="relative overflow-hidden bg-neutral-900 text-white min-h-[520px] sm:min-h-[620px] flex items-center">
        {/* Background Editorial Image */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1920&q=80"
            alt="Haute Beauté Elegance"
            className="w-full h-full object-cover object-center opacity-40 mix-blend-screen scale-105 transition-transform duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
        </div>

        <div className="relative z-10 max-w-container mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-2xl space-y-6">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/15">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span className="text-xs uppercase tracking-[0.2em] font-medium text-amber-200">
                L'Art de Vivre
              </span>
            </div>

            <h1 className="font-serif text-4xl sm:text-6xl font-bold tracking-tight text-white leading-tight">
              <SlideUpText split="characters" stagger={0.03}>
                Elegance Distilled. <br />
                Beauty Elevated.
              </SlideUpText>
            </h1>

            <p className="text-base sm:text-lg text-neutral-300 font-light leading-relaxed">
              Explore our curation of world-class extrait de parfums, botanical bio-active skincare, and luxurious editorial makeup.
            </p>

            <div className="flex flex-wrap gap-4 pt-4">
              <a
                href="#categories"
                className="bg-white text-neutral-900 hover:bg-neutral-100 px-7 py-3.5 rounded-[8px] text-xs uppercase tracking-widest font-semibold transition-all shadow-md active:scale-95"
              >
                Explore Collections
              </a>
              <a
                href="#bestsellers"
                className="bg-white/10 hover:bg-white/20 text-white border border-white/30 px-7 py-3.5 rounded-[8px] text-xs uppercase tracking-widest font-semibold transition-all backdrop-blur-sm active:scale-95"
              >
                View Bestsellers
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Error state */}
      {error && (
        <div className="max-w-container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-[12px] flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => window.location.reload()}
              className="text-xs font-semibold underline ml-4 hover:text-red-900"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* 2. Featured Products (Horizontal Carousel) */}
      <section className="max-w-container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 pb-3 border-b border-neutral-100">
          <div>
            <span className="text-xs uppercase tracking-[0.2em] text-neutral-400 font-semibold block mb-1">
              Curated Highlights
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1A1A]">
              Featured Creations
            </h2>
          </div>

          {/* Carousel Arrows */}
          <div className="flex items-center space-x-2 mt-4 sm:mt-0">
            <button
              onClick={() => scrollCarousel('left')}
              className="p-2.5 rounded-full border border-neutral-200 hover:bg-neutral-100 transition-colors focus:outline-none"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-5 h-5 text-neutral-700" />
            </button>
            <button
              onClick={() => scrollCarousel('right')}
              className="p-2.5 rounded-full border border-neutral-200 hover:bg-neutral-100 transition-colors focus:outline-none"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-5 h-5 text-neutral-700" />
            </button>
          </div>
        </div>

        {/* Carousel Container */}
        {loading ? (
          <div className="flex space-x-6 overflow-hidden">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-[280px] sm:w-[320px] flex-shrink-0">
                <ProductCardSkeleton />
              </div>
            ))}
          </div>
        ) : (
          <div
            ref={carouselRef}
            className="flex space-x-6 overflow-x-auto no-scrollbar scroll-smooth pb-4 -mx-4 px-4 sm:mx-0 sm:px-0"
          >
            {featuredProducts.map((product) => (
              <div key={product.id} className="w-[260px] sm:w-[300px] flex-shrink-0">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. Category Cards Section (4 Categories with database accent_color) */}
      <section id="categories" className="max-w-container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-xl mx-auto mb-12">
          <span className="text-xs uppercase tracking-[0.2em] text-neutral-400 font-semibold block mb-1">
            Haute Disciplines
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#1A1A1A] mb-3">
            Shop By Category
          </h2>
          <p className="text-sm text-neutral-500 font-light">
            Each collection is formulated with bespoke artistry, ethically sourced active ingredients, and artisanal elegance.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Bone key={i} height={256} borderRadius={12} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        )}
      </section>

      {/* 4. Bestsellers Section (8 Products) */}
      <section id="bestsellers" className="max-w-container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 pb-3 border-b border-neutral-100">
          <div>
            <span className="text-xs uppercase tracking-[0.2em] text-neutral-400 font-semibold block mb-1">
              Client Favorites
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#1A1A1A]">
              Iconic Bestsellers
            </h2>
          </div>
          <span className="text-xs uppercase tracking-wider text-neutral-400 mt-2 sm:mt-0 font-medium">
            Top Rated Selections
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {[...Array(8)].map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {bestsellers.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* 5. Brand Heritage & Value Section */}
      <section id="about" className="bg-neutral-50 py-16 border-y border-neutral-100">
        <div className="max-w-container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-white rounded-xl shadow-soft text-neutral-800 shrink-0">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-serif text-base font-semibold text-neutral-900 mb-1">
                  Complimentary Delivery
                </h4>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Fast, climate-controlled shipping on all orders nationwide.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="p-3 bg-white rounded-xl shadow-soft text-neutral-800 shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-serif text-base font-semibold text-neutral-900 mb-1">
                  100% Authentic Maison
                </h4>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Direct provenance guarantees original, unopened, fresh batches.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="p-3 bg-white rounded-xl shadow-soft text-neutral-800 shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-serif text-base font-semibold text-neutral-900 mb-1">
                  Luxury Samples
                </h4>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Two complimentary curated discovery vials with every purchase.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="p-3 bg-white rounded-xl shadow-soft text-neutral-800 shrink-0">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-serif text-base font-semibold text-neutral-900 mb-1">
                  Bespoke Concierge
                </h4>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Expert guidance on scent profiling and personalized skincare routines.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
