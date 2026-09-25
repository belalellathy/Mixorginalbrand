import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Plus, Minus, ArrowRight, ShoppingBag, ShieldCheck } from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { formatEGP } from '../lib/format';

export default function Cart() {
  const { cartItems, totalPrice, totalItems, updateQuantity, removeFromCart, clearCart } = useCartStore();
  const navigate = useNavigate();

  if (cartItems.length === 0) {
    return (
      <div className="max-w-container mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-6 text-neutral-400">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h1 className="font-serif text-3xl font-bold text-[#1A1A1A] mb-3">
          Your Shopping Cart is Empty
        </h1>
        <p className="text-sm text-neutral-500 max-w-md mx-auto mb-8 leading-relaxed">
          Discover our curated collection of haute perfumery, revitalizing botanical skincare, and luxury cosmetics.
        </p>
        <Link
          to="/"
          className="inline-block bg-[#1A1A1A] text-white text-xs font-semibold uppercase tracking-widest px-8 py-4 rounded-[8px] hover:bg-neutral-800 transition-all shadow-sm"
        >
          Explore Collections
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-container mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 pb-24">
      
      {/* Title */}
      <div className="flex items-baseline justify-between pb-6 mb-8 border-b border-neutral-100">
        <div>
          <span className="text-xs uppercase tracking-[0.2em] text-neutral-400 font-semibold block mb-1">
            Order Review
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#1A1A1A]">
            Shopping Bag
          </h1>
        </div>
        <span className="text-sm text-neutral-500 font-medium">
          {totalItems} {totalItems === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Left: Cart Items List (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="divide-y divide-neutral-100">
            {cartItems.map(({ product, quantity }) => (
              <div
                key={product.id}
                className="py-6 first:pt-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                {/* Product Media & Info */}
                <div className="flex items-center space-x-4">
                  <Link
                    to={`/product/${product.id}`}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-[8px] overflow-hidden bg-neutral-50 flex-shrink-0 border border-neutral-100"
                  >
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </Link>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium">
                      {product.categories?.name || 'Exclusive'}
                    </span>
                    <Link
                      to={`/product/${product.id}`}
                      className="font-serif text-base sm:text-lg font-semibold text-[#1A1A1A] hover:text-neutral-600 transition-colors block"
                    >
                      {product.name}
                    </Link>
                    <p className="text-xs text-neutral-500">
                      Unit: {formatEGP(product.price)}
                    </p>
                  </div>
                </div>

                {/* Controls & Subtotal */}
                <div className="flex items-center justify-between sm:justify-end space-x-6 w-full sm:w-auto mt-2 sm:mt-0">
                  {/* Quantity Stepper */}
                  <div className="flex items-center border border-neutral-200 rounded-[8px] bg-neutral-50">
                    <button
                      onClick={() => updateQuantity(product.id, quantity - 1)}
                      type="button"
                      className="p-2 text-neutral-600 hover:text-neutral-900 transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-3 text-xs font-semibold text-neutral-900 min-w-[2rem] text-center">
                      {quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(product.id, quantity + 1, product.stock)}
                      type="button"
                      disabled={quantity >= product.stock}
                      className="p-2 text-neutral-600 hover:text-neutral-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Line Total */}
                  <div className="text-right min-w-[80px]">
                    <span className="font-serif text-base sm:text-lg font-bold text-[#1A1A1A] block">
                      {formatEGP(Number(product.price) * quantity)}
                    </span>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => removeFromCart(product.id)}
                    type="button"
                    className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
                    aria-label={`Remove ${product.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-neutral-100">
            <button
              onClick={clearCart}
              type="button"
              className="text-xs uppercase tracking-wider text-neutral-400 hover:text-neutral-700 font-semibold"
            >
              Clear Entire Bag
            </button>
            <Link
              to="/"
              className="text-xs uppercase tracking-wider text-neutral-600 hover:text-neutral-900 font-semibold"
            >
              ← Continue Shopping
            </Link>
          </div>
        </div>

        {/* Right: Order Total Summary (4 cols) */}
        <div className="lg:col-span-4">
          <div className="bg-neutral-50 rounded-[12px] p-6 sm:p-8 border border-neutral-100 space-y-6 sticky top-28">
            <h3 className="font-serif text-xl font-bold text-[#1A1A1A] pb-3 border-b border-neutral-200">
              Order Summary
            </h3>

            <div className="space-y-3 text-sm text-neutral-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-medium text-neutral-900">{formatEGP(totalPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span>Estimated Shipping</span>
                <span className="text-emerald-700 font-medium">Complimentary</span>
              </div>
              <div className="flex justify-between">
                <span>Maison Discovery Samples</span>
                <span className="text-neutral-500">2 Included</span>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-200 flex justify-between items-baseline">
              <span className="font-serif text-lg font-bold text-[#1A1A1A]">Order Total</span>
              <span className="font-serif text-2xl font-bold text-[#1A1A1A]">
                {formatEGP(totalPrice)}
              </span>
            </div>

            <button
              onClick={() => navigate('/checkout')}
              type="button"
              className="w-full bg-[#1A1A1A] hover:bg-neutral-800 text-white py-4 px-6 rounded-[8px] text-xs font-semibold tracking-widest uppercase flex items-center justify-center space-x-2 transition-all shadow-md active:scale-[0.99]"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="flex items-center justify-center space-x-2 text-[11px] text-neutral-400 pt-2">
              <ShieldCheck className="w-4 h-4 text-neutral-500" />
              <span>Secure checkout with order verification</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
