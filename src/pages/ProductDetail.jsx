import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronRight, Plus, Minus, Check, ShoppingBag, ShieldCheck, Truck, RefreshCw } from 'lucide-react';
import { fetchProductById, fetchProductImages, fetchRelatedProducts } from '../lib/supabase';
import { getErrorMessage } from '../lib/utils';
import { useCartStore } from '../store/cartStore';
import { formatEGP } from '../lib/format';
import ProductCard from '../components/ProductCard';
import { Bone } from '../components/ui/Skeleton';

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [images, setImages] = useState([]);
  const [activeImage, setActiveImage] = useState('');
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAdded, setIsAdded] = useState(false);

  const [stockMessage, setStockMessage] = useState('');

  const addToCart = useCartStore((state) => state.addToCart);
  const cartItems = useCartStore((state) => state.cartItems);

  useEffect(() => {
    let isMounted = true;

    async function loadProductData() {
      try {
        setLoading(true);
        setError(null);
        setQuantity(1);

        const currentProduct = await fetchProductById(id);
        if (!currentProduct) throw new Error('Product not found');

        const [imgs, related] = await Promise.all([
          fetchProductImages(currentProduct.id),
          fetchRelatedProducts(
            currentProduct.categories?.id || currentProduct.category_id,
            currentProduct.id,
            4
          )
        ]);

        if (isMounted) {
          setProduct(currentProduct);

          const imageList = imgs && imgs.length > 0
            ? imgs.map((img) => img.image_url)
            : [currentProduct.image_url];

          if (currentProduct.image_url && !imageList.includes(currentProduct.image_url)) {
            imageList.unshift(currentProduct.image_url);
          }

          setImages(imageList);
          setActiveImage(imageList[0] || currentProduct.image_url);
          setRelatedProducts(related || []);
        }
      } catch (err) {
        console.error('Error loading product detail:', err);
        if (isMounted) {
          setError(getErrorMessage(err, 'Failed to load products. Please try again.'));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadProductData();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleAddToCart = () => {
    if (!product) return;
    const existing = cartItems.find((item) => item.product.id === product.id);
    const currentInCart = existing?.quantity || 0;
    const canAdd = product.stock - currentInCart;

    if (canAdd <= 0) {
      setStockMessage('Maximum available quantity already in cart');
      setTimeout(() => setStockMessage(''), 3000);
      return;
    }

    const quantityToAdd = typeof product.stock === 'number'
      ? Math.min(quantity, product.stock - currentInCart)
      : quantity
    addToCart(product, quantityToAdd);

    if (quantity > canAdd) {
      setStockMessage(`Only ${canAdd} unit(s) added — maximum stock reached`);
      setTimeout(() => setStockMessage(''), 3000);
    } else {
      setStockMessage('');
    }
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 1500);
  };

  const handleIncrement = () => {
    if (!product || (typeof product.stock === 'number' && quantity >= product.stock)) return;
    setQuantity((q) => q + 1);
  };
  const handleDecrement = () => setQuantity((prev) => (prev > 1 ? prev - 1 : 1));

  const categoryAccent = product?.categories?.accent_color || '#1A1A1A';

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-2 gap-12">
        <Bone height={500} borderRadius={16} />
        <div className="flex flex-col gap-4">
          <Bone height={36} width="70%" borderRadius={8} />
          <Bone height={24} width="30%" borderRadius={6} />
          <Bone height={80} borderRadius={8} />
          <Bone height={48} borderRadius={10} />
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-container mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h2 className="font-serif text-2xl font-bold text-neutral-800 mb-2">
          Product Not Found
        </h2>
        <p className="text-sm text-neutral-500 mb-6">{error || 'This product is currently unavailable.'}</p>
        <Link
          to="/"
          className="inline-block bg-[#1A1A1A] text-white text-xs uppercase tracking-widest font-semibold px-6 py-3 rounded-[8px] hover:bg-neutral-800"
        >
          Return to Collections
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Breadcrumbs */}
      <nav className="max-w-container mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center space-x-2 text-xs text-neutral-400 font-medium">
          <Link to="/" className="hover:text-neutral-700">Home</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          {product.categories && (
            <>
              <Link to={`/category/${product.categories.slug}`} className="hover:text-neutral-700">
                {product.categories.name}
              </Link>
              <ChevronRight className="w-3.5 h-3.5" />
            </>
          )}
          <span className="text-neutral-800 font-semibold truncate max-w-[200px] sm:max-w-none">
            {product.name}
          </span>
        </div>
      </nav>

      {/* Product Details */}
      <section className="max-w-container mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">

          {/* Image Gallery */}
          <div className="lg:col-span-7 space-y-4">
            <div className="relative aspect-square w-full rounded-[12px] overflow-hidden bg-neutral-50 border border-neutral-100 shadow-soft">
              <img
                src={activeImage || product.image_url}
                alt={product.name}
                className="w-full h-full object-cover object-center transition-all duration-300"
              />
              {product.badge && (
                <span
                  className="absolute top-4 left-4 text-xs font-semibold uppercase tracking-wider text-white px-3 py-1 rounded-full shadow-sm"
                  style={{ backgroundColor: product.badge === 'Sale' ? '#E53E3E' : categoryAccent }}
                >
                  {product.badge}
                </span>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex space-x-3 overflow-x-auto no-scrollbar py-2">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImage(img)}
                    className={`relative w-20 h-20 rounded-[8px] overflow-hidden border-2 flex-shrink-0 transition-all ${activeImage === img
                        ? 'border-[#1A1A1A] scale-95 shadow-sm'
                        : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                  >
                    <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="lg:col-span-5 flex flex-col justify-start">
            {product.categories && (
              <Link
                to={`/category/${product.categories.slug}`}
                className="text-xs uppercase tracking-[0.2em] font-semibold text-neutral-400 hover:text-neutral-600 transition-colors mb-2 inline-block"
              >
                {product.categories.name}
              </Link>
            )}

            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#1A1A1A] leading-tight mb-3">
              {product.name}
            </h1>

            <div className="pb-6 mb-6 border-b border-neutral-100 flex items-baseline space-x-3">
              <span className="font-serif text-3xl sm:text-4xl font-bold text-[#1A1A1A]">
                {formatEGP(product.price)}
              </span>
              <span className="text-xs text-neutral-400">Taxes included</span>
            </div>

            <div className="space-y-4 mb-8">
              <h4 className="text-xs uppercase tracking-wider font-semibold text-neutral-400">
                Description
              </h4>
              <p className="text-sm text-neutral-600 leading-relaxed">{product.description}</p>
            </div>

            <div className="space-y-4 mb-8">
              {product.stock !== 0 && (
                <div className="flex items-center space-x-4">
                  <span className="text-xs uppercase tracking-wider font-semibold text-neutral-500">Quantity:</span>
                  <div className="flex items-center border border-neutral-200 rounded-[8px] bg-neutral-50">
                    <button
                      onClick={handleDecrement}
                      type="button"
                      className="p-2.5 text-neutral-600 hover:text-neutral-900 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-4 text-sm font-semibold text-neutral-900 min-w-[2rem] text-center">
                      {quantity}
                    </span>
                    <button
                      onClick={handleIncrement}
                      type="button"
                      disabled={typeof product.stock === 'number' && quantity >= product.stock}
                      className="p-2.5 text-neutral-600 hover:text-neutral-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-xs text-emerald-600 font-medium">
                    {product.stock == null ? 'In Stock' : `In Stock (${product.stock} available)`}
                  </span>
                </div>
              )}

              {product.stock === 0 ? (
                <div className="w-full py-3 px-6 bg-gray-200 text-gray-500 text-center rounded-lg cursor-not-allowed text-sm font-semibold tracking-wider uppercase">
                  Out of Stock
                </div>
              ) : (
                <button
                  onClick={handleAddToCart}
                  type="button"
                  style={{ backgroundColor: categoryAccent }}
                  className="w-full rounded-[8px] py-4 px-6 text-white text-sm font-semibold tracking-wider uppercase flex items-center justify-center space-x-2 shadow-sm hover:opacity-90 active:scale-[0.99] transition-all"
                >
                  {isAdded ? (
                    <>
                      <Check className="w-5 h-5" />
                      <span>Added to Cart</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-5 h-5" />
                      <span>Add to Cart • {formatEGP(Number(product.price) * quantity)}</span>
                    </>
                  )}
                </button>
              )}
              {stockMessage && (
                <p className="text-amber-600 text-sm">{stockMessage}</p>
              )}
            </div>

            <div className="border-t border-neutral-100 pt-6 space-y-3 text-xs text-neutral-500">
              <div className="flex items-center space-x-2.5">
                <Truck className="w-4 h-4 text-neutral-700" />
                <span>Nationwide delivery on all luxury items.</span>
              </div>
              <div className="flex items-center space-x-2.5">
                <ShieldCheck className="w-4 h-4 text-neutral-700" />
                <span>100% authentic formulated guaranteed batch certification.</span>
              </div>
              <div className="flex items-center space-x-2.5">
                <RefreshCw className="w-4 h-4 text-neutral-700" />
                <span>Complimentary return within 30 days of unsealed delivery.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="max-w-container mx-auto px-4 sm:px-6 lg:px-8 pt-12 border-t border-neutral-100">
          <div className="mb-8">
            <span className="text-xs uppercase tracking-[0.2em] text-neutral-400 font-semibold block mb-1">
              You May Also Like
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1A1A]">
              Related Products
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {relatedProducts.map((rel) => (
              <ProductCard key={rel.id} product={rel} accentColor={categoryAccent} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}