import React from 'react';
import { useLocation, Link, Navigate } from 'react-router-dom';
import { CheckCircle, Home, ShoppingBag, Clock } from 'lucide-react';
import { formatEGP } from '../lib/format';
import { getCategoryBySlug } from '../config/categories';

const discoverCategory = getCategoryBySlug('skincare');

export default function OrderConfirmation() {
  const location = useLocation();
  const { order, contactInfo: contactInfoFromState, receiptUrl } = location.state || {};

  if (!order?.id) {
    return <Navigate to="/" replace />;
  }

  const contactInfo = contactInfoFromState || {};
  const items = order.items || [];

  const fullName = contactInfo.full_name || order.full_name || 'Valued Client';
  const phone = contactInfo.phone || order.phone || 'your phone';
  const email = contactInfo.email || order.email || 'your email';
  const orderId = order.id;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 pb-28 text-center">

      {/* Icon */}
      <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-emerald-100">
        <CheckCircle className="w-10 h-10 animate-in zoom-in duration-300" />
      </div>

      {/* Main Thank You Message */}
      <span className="text-xs uppercase tracking-[0.25em] text-neutral-400 font-semibold block mb-2">
        Order Received
      </span>

      <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#1A1A1A] mb-4">
        Thank you {fullName}! Your order is being reviewed.
      </h1>

      <p className="text-base text-neutral-600 max-w-md mx-auto leading-relaxed mb-6">
        We will contact you on <span className="font-semibold text-neutral-900">{phone}</span> or <span className="font-semibold text-neutral-900">{email}</span> within 24 hours.
      </p>

      {/* Order Summary Box */}
      <div className="bg-neutral-50 rounded-[12px] p-6 border border-neutral-100 max-w-md mx-auto mb-8 text-left space-y-4">

        {/* Header / ID */}
        <div className="flex justify-between items-center pb-3 border-b border-neutral-200/60">
          <span className="text-xs uppercase tracking-wider text-neutral-400 font-medium">
            Order Reference
          </span>
          <span className="font-mono text-xs font-bold text-neutral-800 bg-white px-2.5 py-1 rounded border border-neutral-200">
            #{orderId}
          </span>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center space-x-2 text-xs text-neutral-600">
          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Payment verification in progress by our concierge team.</span>
        </div>

        {/* Purchased Items List */}
        {items.length > 0 && (
          <div className="pt-2 border-t border-neutral-200/60">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-2">
              Items Purchased
            </span>
            <div className="divide-y divide-neutral-200/40 max-h-48 overflow-y-auto pr-1">
              {items.map(({ product, quantity }) => (
                <div key={product.id} className="py-2 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-9 h-9 object-cover rounded-[6px] border border-neutral-200"
                    />
                    <div>
                      <span className="font-medium text-neutral-800 block truncate max-w-[180px]">
                        {product.name}
                      </span>
                      <span className="text-neutral-400">Qty: {quantity}</span>
                    </div>
                  </div>
                  <span className="font-semibold text-neutral-900">
                    {formatEGP(Number(product.price) * quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Delivery Address */}
        {order.address && (
          <div className="pt-2 border-t border-neutral-200/60 text-xs text-neutral-600">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
              Shipping Address
            </span>
            <p className="font-medium text-neutral-800 leading-snug">{order.address}</p>
          </div>
        )}

        {/* Total Price */}
        {order.total_price && (
          <div className="flex justify-between items-center pt-3 border-t border-neutral-200 text-xs text-neutral-700 font-medium">
            <span className="text-xs uppercase font-bold text-neutral-700">Total Paid:</span>
            <span className="font-serif text-lg font-bold text-neutral-900">
              {formatEGP(order.total_price)}
            </span>
          </div>
        )}

        {/* Payment Receipt */}
        {receiptUrl && (
          <div className="pt-3 border-t border-neutral-200/60">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-2">
              Payment Receipt
            </span>
            <img
              src={receiptUrl}
              alt="Payment receipt"
              className="w-full max-h-64 object-contain rounded-[8px] border border-neutral-200 bg-white"
            />
          </div>
        )}

      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <Link
          to="/"
          className="w-full sm:w-auto bg-[#1A1A1A] hover:bg-neutral-800 text-white px-8 py-3.5 rounded-[8px] text-xs font-semibold uppercase tracking-widest flex items-center justify-center space-x-2 transition-all shadow-md active:scale-95"
        >
          <Home className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>
        <Link
          to={`/category/${discoverCategory.slug}`}
          className="w-full sm:w-auto bg-neutral-100 hover:bg-neutral-200 text-neutral-800 px-8 py-3.5 rounded-[8px] text-xs font-semibold uppercase tracking-widest flex items-center justify-center space-x-2 transition-all active:scale-95"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Discover More</span>
        </Link>
      </div>

    </div>
  );
}