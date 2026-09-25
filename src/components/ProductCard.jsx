import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Star, StarHalf, Plus } from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { formatEGP } from '../lib/format';
import { getCategoryBySlug } from '../config/categories';

const CATEGORY_ACCENTS = {
  'mens-perfumes': '#1A2E4A',
  'womens-perfumes': '#C9A0A0',
  'skincare': '#8FAF8F',
  'makeup': '#7D2335',
};

function accentForCategoryId(categoryId) {
  const slug = typeof categoryId === 'string' ? categoryId.replace(/^cat-/, '') : '';
  const category = getCategoryBySlug(slug);
  if (!category) return '#1A1A1A';
  return CATEGORY_ACCENTS[category.slug] || '#1A1A1A';
}

export default function ProductCard({ product, accentColor, avg_rating, review_count }) {
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  const [stockMessage, setStockMessage] = useState('');
  const addToCart = useCartStore((state) => state.addToCart);
  const cartItems = useCartStore((state) => state.cartItems);

  // Determine accent color from prop or category relation
  const categoryAccent = accentColor ||
    product.categories?.accent_color ||
    accentForCategoryId(product.category_id);

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const existing = cartItems.find((item) => item.product.id === product.id);
    const currentInCart = existing?.quantity || 0;
    const canAdd = product.stock - currentInCart;

    if (canAdd <= 0) {
      setStockMessage('Maximum available quantity already in cart');
      setTimeout(() => setStockMessage(''), 3000);
      return;
    }

    addToCart(product, 1);

    if (canAdd === 1) {
      setStockMessage('Last unit added — maximum stock reached');
      setTimeout(() => setStockMessage(''), 3000);
    }
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 1200);
  };

  const handleWishlistToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsWishlisted(!isWishlisted);
  };

  // Ratings come with the product from products_with_ratings — no extra fetch.
  const avgRating = Number(product?.avg_rating ?? avg_rating) || 0;
  const reviewCount = Number(product?.review_count ?? review_count) || 0;

  return (
    <div className="group relative bg-white rounded-[12px] p-3 sm:p-4 shadow-soft hover:shadow-soft-hover transition-all duration-300 hover:scale-[1.02] flex flex-col justify-between border border-neutral-100/80">
      
      {/* Top Image Container */}
      <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-neutral-50 mb-3">
        <Link to={`/product/${product.id}`} className="block w-full h-full">
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
          />
        </Link>

        {/* Badges: "New" in accent color, "Sale" in red */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-10 pointer-events-none">
          {product.badge === 'New' && (
            <span
              className="text-[10px] font-semibold uppercase tracking-wider text-white px-2 py-0.5 rounded-full shadow-sm"
              style={{ backgroundColor: categoryAccent }}
            >
              New
            </span>
          )}
          {product.badge === 'Sale' && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white bg-[#E53E3E] px-2 py-0.5 rounded-full shadow-sm">
              Sale
            </span>
          )}
          {!product.badge && product.is_featured && (
            <span
              className="text-[10px] font-semibold uppercase tracking-wider text-white px-2 py-0.5 rounded-full shadow-sm"
              style={{ backgroundColor: categoryAccent }}
            >
              Featured
            </span>
          )}
        </div>

        {/* Wishlist Heart Icon (UI only toggle) */}
        <button
          onClick={handleWishlistToggle}
          type="button"
          aria-label="Save to wishlist"
          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-neutral-600 hover:text-red-500 shadow-sm transition-transform active:scale-90 focus:outline-none z-10"
        >
          <Heart
            className={`w-4 h-4 transition-colors ${
              isWishlisted ? 'fill-red-500 text-red-500' : 'text-neutral-600'
            }`}
          />
        </button>
      </div>

      {/* Product Information */}
      <div className="flex flex-col flex-grow justify-between">
        <div>
          {/* Category Tag */}
          <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-medium block mb-1">
            {product.categories?.name || 'Exclusive Selection'}
          </span>

          {/* Title */}
          <Link to={`/product/${product.id}`} className="group-hover:text-neutral-600 transition-colors">
            <h3 className="font-serif text-base sm:text-lg font-semibold text-[#1A1A1A] line-clamp-1 mb-1.5">
              {product.name}
            </h3>
          </Link>

          {/* Star Rating Display (real avg_rating) */}
          <div className="flex items-center space-x-1 mb-2">
            {reviewCount > 0 ? (
              <>
                {[...Array(5)].map((_, i) => {
                  const starNum = i + 1;
                  if (avgRating >= starNum) {
                    return (
                      <Star
                        key={i}
                        className="w-3.5 h-3.5 fill-amber-400 text-amber-400"
                      />
                    );
                  }
                  if (avgRating >= starNum - 0.5) {
                    return (
                      <StarHalf
                        key={i}
                        className="w-3.5 h-3.5 fill-amber-400 text-amber-400"
                      />
                    );
                  }
                  return <Star key={i} className="w-3.5 h-3.5 text-neutral-300" />;
                })}
                <span className="text-xs text-neutral-400 font-medium ml-1">
                  ({avgRating.toFixed(1)}) ({reviewCount})
                </span>
              </>
            ) : (
              <span className="text-xs text-neutral-400 font-medium">
                No reviews yet
              </span>
            )}
          </div>
        </div>

        {/* Price & Add to Cart */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-100">
          <div className="flex flex-col">
            <span className="text-[10px] text-neutral-400 uppercase font-medium">Price</span>
            <span className="font-serif text-lg font-bold text-[#1A1A1A]">
              {formatEGP(product.price)}
            </span>
          </div>

          {product.stock === 0 ? (
            <div className="w-full py-2 bg-gray-200 text-gray-500 text-center rounded-lg text-sm cursor-not-allowed">
              Out of Stock
            </div>
          ) : (
            <button
              onClick={handleAddToCart}
              type="button"
              style={{ backgroundColor: categoryAccent }}
              className="rounded-[8px] px-3.5 py-2 text-white text-xs font-medium tracking-wide uppercase flex items-center space-x-1 hover:opacity-90 active:scale-95 transition-all shadow-sm focus:outline-none"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAdded ? 'Added!' : 'Add'}</span>
            </button>
          )}
        </div>
        {stockMessage && (
          <p className="text-amber-600 text-xs text-center mt-1">{stockMessage}</p>
        )}
      </div>

    </div>
  );
}
