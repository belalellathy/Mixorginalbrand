import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Check, Upload, ArrowRight, ArrowLeft, ShieldCheck, Loader2, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { uploadPaymentScreenshot, createOrder, fetchPaymentSettings } from '../lib/supabase';
import { getErrorMessage } from '../lib/utils';
import { formatEGP } from '../lib/format';

// Zod validation schema for Checkout
const checkoutSchema = z.object({
  full_name: z.string().min(3, 'Full name must be at least 3 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(8, 'Please enter a valid phone number (at least 8 digits)'),
  address: z.string().min(10, 'Please provide a complete delivery address (minimum 10 characters)'),
});

export default function Checkout() {
  const [currentStep, setCurrentStep] = useState(1);
  const [paymentFile, setPaymentFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState(null);

  useEffect(() => {
    fetchPaymentSettings()
      .then(setPaymentSettings)
      .catch(() => setPaymentSettings(null));
  }, []);

  const { cartItems, totalPrice, clearCart } = useCartStore();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(checkoutSchema),
    mode: 'onBlur',
    defaultValues: {
      full_name: '',
      email: '',
      phone: '',
      address: '',
    },
  });

  // Step 1 -> Step 2 validation
  const handleProceedToStep2 = async () => {
    const isValid = await trigger(['full_name', 'email', 'phone']);
    if (isValid) {
      setCurrentStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Step 2 -> Step 3 validation
  const handleProceedToStep3 = async () => {
    const isValid = await trigger('address');
    if (isValid) {
      setCurrentStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // File upload handler
  const handleFileChange = (e) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Extension allowlist (mirrors uploadPaymentScreenshot server-side check)
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    const nameParts = file.name.split('.');
    const ext = nameParts.pop().toLowerCase();
    if (nameParts.length < 1 || !allowedExtensions.includes(ext)) {
      setUploadError('Invalid file type. Please upload a JPG, PNG, or WebP image.');
      return;
    }

    // Limit file size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File too large. Maximum size is 5MB.');
      return;
    }

    setPaymentFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setFilePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Final Order Submission
  const onFinalSubmit = async () => {
    if (!paymentFile) {
      setUploadError('Please upload your payment screenshot to proceed.');
      return;
    }

    setIsSubmitting(true);
    setUploadError(null);

    try {
      // 1. Upload payment screenshot
      let path;
      let signedUrl;
      try {
        ({ path, signedUrl } = await uploadPaymentScreenshot(paymentFile));
      } catch (uploadErr) {
        console.error('Upload failed:', uploadErr);
        setUploadError(getErrorMessage(uploadErr, 'Failed to upload file. Please try again.'));
        return;
      }

      // 2. Create order via Edge Function (pricing computed server-side)
      const formData = getValues();
      const contactInfo = {
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
      };
      const { id, total_price } = await createOrder({
        items: cartItems.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
        contactInfo: {
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
        },
        receipt_path: path,
      });

      // 3. Clear cart and redirect — build confirmation from local state, no DB re-fetch
      clearCart();
      navigate('/order-confirmation', {
        state: {
          order: { id, total_price, items: cartItems },
          contactInfo,
          receiptUrl: signedUrl,
        },
      });
    } catch (err) {
      console.error('Order submission failed:', err);
      setUploadError(getErrorMessage(err, 'Failed to place order. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };
  if (cartItems.length === 0) {
    return (
      <div className="max-w-container mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <h2 className="font-serif text-3xl font-bold text-[#1A1A1A] mb-3">
          Your Cart is Empty
        </h2>
        <p className="text-sm text-neutral-500 mb-6">
          Add some products to your cart before proceeding to checkout.
        </p>
        <Link
          to="/"
          className="inline-block bg-[#1A1A1A] text-white text-xs font-semibold uppercase tracking-widest px-8 py-3.5 rounded-[8px] hover:bg-neutral-800"
        >
          Return to Shop
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pb-24">

      {/* Checkout Title */}
      <div className="text-center mb-10">
        <span className="text-xs uppercase tracking-[0.25em] text-neutral-400 font-semibold block mb-1">
          Finalize Purchase
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#1A1A1A]">
          Maison Checkout
        </h1>
      </div>

      {/* 3-Step Progress Stepper */}
      <div className="flex items-center justify-between mb-12 relative">
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-neutral-200 -translate-y-1/2 z-0" />

        {/* Step 1 indicator */}
        <div className="relative z-10 flex flex-col items-center">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${currentStep > 1
                ? 'bg-neutral-900 text-white'
                : currentStep === 1
                  ? 'bg-neutral-900 text-white ring-4 ring-neutral-100'
                  : 'bg-white border-2 border-neutral-300 text-neutral-400'
              }`}
          >
            {currentStep > 1 ? <Check className="w-4 h-4" /> : '1'}
          </div>
          <span className="text-[11px] font-medium tracking-wider uppercase mt-2 text-neutral-700">
            Contact
          </span>
        </div>

        {/* Step 2 indicator */}
        <div className="relative z-10 flex flex-col items-center">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${currentStep > 2
                ? 'bg-neutral-900 text-white'
                : currentStep === 2
                  ? 'bg-neutral-900 text-white ring-4 ring-neutral-100'
                  : 'bg-white border-2 border-neutral-300 text-neutral-400'
              }`}
          >
            {currentStep > 2 ? <Check className="w-4 h-4" /> : '2'}
          </div>
          <span className="text-[11px] font-medium tracking-wider uppercase mt-2 text-neutral-700">
            Address & Review
          </span>
        </div>

        {/* Step 3 indicator */}
        <div className="relative z-10 flex flex-col items-center">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${currentStep === 3
                ? 'bg-neutral-900 text-white ring-4 ring-neutral-100'
                : 'bg-white border-2 border-neutral-300 text-neutral-400'
              }`}
          >
            3
          </div>
          <span className="text-[11px] font-medium tracking-wider uppercase mt-2 text-neutral-700">
            Payment Proof
          </span>
        </div>
      </div>

      {/* Main Multi-Step Form Card */}
      <div className="bg-white rounded-[12px] p-6 sm:p-10 shadow-soft border border-neutral-100">

        {/* STEP 1: Contact Information */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="border-b border-neutral-100 pb-4">
              <h2 className="font-serif text-2xl font-bold text-[#1A1A1A]">
                Step 1: Contact Information
              </h2>
              <p className="text-xs text-neutral-500 mt-1">
                No account or registration required. We use this to verify and update you on your order.
              </p>
            </div>

            <div className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Eleanor Vance"
                  {...register('full_name')}
                  className={`w-full px-4 py-3 text-sm bg-neutral-50 border rounded-[8px] focus:outline-none transition-colors ${errors.full_name ? 'border-red-400 bg-red-50/20' : 'border-neutral-200 focus:border-neutral-800'
                    }`}
                />
                {errors.full_name && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{errors.full_name.message}</span>
                  </p>
                )}
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5">
                  Email Address *
                </label>
                <input
                  type="email"
                  placeholder="eleanor.vance@example.com"
                  {...register('email')}
                  className={`w-full px-4 py-3 text-sm bg-neutral-50 border rounded-[8px] focus:outline-none transition-colors ${errors.email ? 'border-red-400 bg-red-50/20' : 'border-neutral-200 focus:border-neutral-800'
                    }`}
                />
                {errors.email && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{errors.email.message}</span>
                  </p>
                )}
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  placeholder="+1 (555) 019-2834"
                  {...register('phone')}
                  className={`w-full px-4 py-3 text-sm bg-neutral-50 border rounded-[8px] focus:outline-none transition-colors ${errors.phone ? 'border-red-400 bg-red-50/20' : 'border-neutral-200 focus:border-neutral-800'
                    }`}
                />
                {errors.phone && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{errors.phone.message}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={handleProceedToStep2}
                className="bg-[#1A1A1A] hover:bg-neutral-800 text-white px-8 py-3.5 rounded-[8px] text-xs font-semibold uppercase tracking-widest flex items-center space-x-2 transition-all shadow-sm"
              >
                <span>Continue to Address</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Order Summary & Address */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="border-b border-neutral-100 pb-4">
              <h2 className="font-serif text-2xl font-bold text-[#1A1A1A]">
                Step 2: Order Summary & Address
              </h2>
              <p className="text-xs text-neutral-500 mt-1">
                Verify items in your order and provide your shipping address.
              </p>
            </div>

            {/* Cart Items Summary */}
            <div className="space-y-3 bg-neutral-50 p-4 rounded-[8px] border border-neutral-100">
              <h3 className="text-xs uppercase tracking-wider font-semibold text-neutral-500 mb-2">
                Items ({cartItems.length})
              </h3>
              <div className="divide-y divide-neutral-200/60 max-h-56 overflow-y-auto pr-1">
                {cartItems.map(({ product, quantity }) => (
                  <div key={product.id} className="py-2.5 first:pt-0 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-3">
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-10 h-10 object-cover rounded-[6px]"
                      />
                      <div>
                        <span className="font-semibold text-neutral-800 block truncate max-w-[220px]">
                          {product.name}
                        </span>
                        <span className="text-neutral-500">Qty: {quantity}</span>
                      </div>
                    </div>
                    <span className="font-semibold text-neutral-900">
                      {formatEGP(Number(product.price) * quantity)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Total display */}
              <div className="pt-3 border-t border-neutral-200 flex justify-between items-baseline">
                <span className="text-xs uppercase font-bold text-neutral-700">Total Price:</span>
                <span className="font-serif text-xl font-bold text-[#1A1A1A]">
                  {formatEGP(totalPrice)}
                </span>
              </div>
            </div>

            {/* Address Input Field */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5">
                Delivery Address *
              </label>
              <textarea
                rows={3}
                placeholder="Apartment/Suite, Street Address, City, State/Province, Postal Code"
                {...register('address')}
                className={`w-full px-4 py-3 text-sm bg-neutral-50 border rounded-[8px] focus:outline-none transition-colors ${errors.address ? 'border-red-400 bg-red-50/20' : 'border-neutral-200 focus:border-neutral-800'
                  }`}
              />
              {errors.address && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{errors.address.message}</span>
                </p>
              )}
            </div>

            {/* Navigation buttons */}
            <div className="pt-4 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="text-xs uppercase tracking-wider font-semibold text-neutral-500 hover:text-neutral-900 flex items-center space-x-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={handleProceedToStep3}
                className="bg-[#1A1A1A] hover:bg-neutral-800 text-white px-8 py-3.5 rounded-[8px] text-xs font-semibold uppercase tracking-widest flex items-center space-x-2 transition-all shadow-sm"
              >
                <span>Continue to Payment Proof</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Payment Proof & Place Order */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="border-b border-neutral-100 pb-4">
              <h2 className="font-serif text-2xl font-bold text-[#1A1A1A]">
                Step 3: Payment Proof
              </h2>
              <p className="text-xs text-neutral-500 mt-1">
                Please transfer the total amount ({formatEGP(totalPrice)}) and upload the payment receipt or transaction screenshot.
              </p>
            </div>

            {/* Bank Transfer Details Box */}
            <div className="bg-neutral-50 p-5 rounded-[8px] border border-neutral-200/80 space-y-2 text-xs text-neutral-700">
              <h3 className="uppercase tracking-wider font-bold text-neutral-900 text-[11px] mb-2">
                Maison Banking Instructions:
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="text-neutral-400 block text-[10px] uppercase">Bank / Service</span>
                  <p className="font-semibold text-neutral-800">{paymentSettings?.payment_bank_name || 'Loading...'}</p>
                  <p className="font-semibold text-neutral-800">{paymentSettings?.payment_instapay || 'Loading...'}</p>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[10px] uppercase">Account Title</span>
                  <p className="font-semibold text-neutral-800">{paymentSettings?.payment_account_name || 'Loading...'}</p>
                </div>
                {(paymentSettings === null || paymentSettings?.payment_iban) && (
                  <div>
                    <span className="text-neutral-400 block text-[10px] uppercase">Account / IBAN Number</span>
                    <p className="font-mono font-semibold text-neutral-800">{paymentSettings?.payment_iban || 'Loading...'}</p>
                  </div>
                )}
                <div>
                  <span className="text-neutral-400 block text-[10px] uppercase">Exact Total</span>
                  <span className="font-bold text-neutral-900">{formatEGP(totalPrice)}</span>
                </div>
              </div>
            </div>

            {/* File upload input (image only) */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700">
                Upload Payment Screenshot (Image Only) *
              </label>

              <div className="border-2 border-dashed border-neutral-300 hover:border-neutral-400 rounded-[12px] p-6 text-center transition-colors bg-white">
                <input
                  type="file"
                  id="screenshot-upload"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {filePreview ? (
                  <div className="flex flex-col items-center space-y-3">
                    <div className="relative w-32 h-32 rounded-[8px] overflow-hidden border border-neutral-200 shadow-sm">
                      <img
                        src={filePreview}
                        alt="Payment Proof Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-xs text-neutral-600 font-medium">
                      {paymentFile?.name} ({(paymentFile.size / 1024).toFixed(1)} KB)
                    </span>
                    <label
                      htmlFor="screenshot-upload"
                      className="cursor-pointer text-xs font-semibold text-neutral-800 underline hover:text-black"
                    >
                      Change image
                    </label>
                  </div>
                ) : (
                  <label
                    htmlFor="screenshot-upload"
                    className="cursor-pointer flex flex-col items-center space-y-2"
                  >
                    <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-500">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-neutral-800 underline">
                        Click to upload screenshot
                      </span>
                      <p className="text-[11px] text-neutral-400 mt-1">
                        Supported: JPG, PNG, WEBP (Max 5MB)
                      </p>
                    </div>
                  </label>
                )}
              </div>

              {uploadError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-[8px] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>

            {/* Navigation buttons */}
            <div className="pt-4 flex justify-between items-center border-t border-neutral-100">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setCurrentStep(2)}
                className="text-xs uppercase tracking-wider font-semibold text-neutral-500 hover:text-neutral-900 flex items-center space-x-1 disabled:opacity-50"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={onFinalSubmit}
                className="bg-[#1A1A1A] hover:bg-neutral-800 text-white px-8 py-4 rounded-[8px] text-xs font-semibold uppercase tracking-widest flex items-center space-x-2 transition-all shadow-md active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Placing Order...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Place Order • {formatEGP(totalPrice)}</span>
                  </>
                )}
              </button>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
