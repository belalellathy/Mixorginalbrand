import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Upload payment screenshot to Supabase storage
 */
export async function uploadPaymentScreenshot(file) {
  if (!file) throw new Error('No file provided');

  // Extension allowlist
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
  const nameParts = file.name.split('.');
  const ext = nameParts.pop().toLowerCase();

  if (nameParts.length < 1 || !allowedExtensions.includes(ext)) {
    throw new Error('Invalid file type. Please upload a JPG, PNG, or WebP image.');
  }

  // Size check (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File too large. Maximum size is 5MB.');
  }

  const fileName = `${Date.now()}_${crypto.randomUUID()}.${ext}`;
  const filePath = `receipts/${fileName}`;

  const { data, error } = await supabase.storage
    .from('payment-screenshots')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('payment-screenshots')
    .createSignedUrl(data.path, 3600);

  if (signedUrlError) throw signedUrlError;
  return { path: data.path, signedUrl: signedUrlData.signedUrl };
}

/**
 * Fetch store payment settings (bank/IBAN/Instapay) as a key->value map
 */
export async function fetchPaymentSettings() {
  const { data, error } = await supabase
    .from('store_settings')
    .select('key, value');

  if (error) throw error;

  return Object.fromEntries((data || []).map((row) => [row.key, row.value]));
}

/**
 * Fetch all categories
 */
export async function fetchCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name');

  if (error) throw error;
  return data || [];
}

/**
 * Fetch single category by slug
 */
export async function fetchCategoryBySlug(slug) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetch featured products (is_featured = true)
 */
export async function fetchFeaturedProducts() {
  const { data, error } = await supabase
    .from('products_with_ratings')
    .select('*, categories(name, slug, accent_color)')
    .eq('is_featured', true);

  if (error) throw error;
  return data || [];
}

/**
 * Fetch products by category slug with sorting
 */
export async function fetchProductsByCategorySlug(slug, sortBy = 'default') {
  const { data: category, error: catError } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .single();

  if (catError) throw catError;

  let query = supabase
    .from('products_with_ratings')
    .select('*, categories(name, slug, accent_color)')
    .eq('category_id', category.id);

  if (sortBy === 'price-low') {
    query = query.order('price', { ascending: true });
  } else if (sortBy === 'price-high') {
    query = query.order('price', { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;

  return { data: data || [], category };
}

/**
 * Fetch single product by id
 */
export async function fetchProductById(id) {
  const { data, error } = await supabase
    .from('products_with_ratings')
    .select('*, categories(id, name, slug, accent_color)')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetch all product_images for a product
 */
export async function fetchProductImages(productId) {
  const { data, error } = await supabase
    .from('product_images')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Fetch related products (same category)
 */
export async function fetchRelatedProducts(categoryId, currentProductId, limit = 4) {
  const { data, error } = await supabase
    .from('products_with_ratings')
    .select('*, categories(name, slug, accent_color)')
    .eq('category_id', categoryId)
    .neq('id', currentProductId)
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Create an order via the `create-order` Edge Function.
 * Pricing is computed fully server-side — the client never sends
 * unit_price or total_price.
 */
export async function createOrder({ items, contactInfo, receipt_path }) {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/createorder`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ items, contactInfo, receipt_path }),
    }
  );

  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Order failed');
  return result; // { id, total_price }
}

/**
 * Search products by name or description
 */
export async function searchProducts(query) {
  // Sanitize: strip PostgREST reserved chars, limit length
  const sanitized = query
    .replace(/[%_,()'"\\]/g, '')
    .trim()
    .slice(0, 100);

  if (!sanitized) return [];

  const { data, error } = await supabase
    .from('products_with_ratings')
    .select('*, categories(name, slug, accent_color)')
    .or(`name.ilike.%${sanitized}%,description.ilike.%${sanitized}%`)
    .order('name');

  if (error) throw error;
  return data || [];
}

/**
 * Fetch reviews for a product
 */
export async function fetchProductReviews(productId) {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Submit a review via the `submit-review` Edge Function.
 * Verifies Turnstile CAPTCHA server-side and inserts with the service role key.
 */
export async function submitReview({
  product_id,
  productId,
  name,
  full_name,
  fullName,
  rating,
  comment,
}) {
  const payload = {
    product_id: product_id ?? productId,
    name: name ?? full_name ?? fullName,
    rating,
    comment,
  };

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-review`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    }
  );

  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Failed to submit review');
  return result;
}

/**
 * Fetch product average rating
 */
export async function fetchProductRating(productId) {
  const { data, error } = await supabase
    .from('reviews')
    .select('rating')
    .eq('product_id', productId);

  if (error) throw error;

  if (!data || data.length === 0) return { avg_rating: 0, review_count: 0 };

  const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
  return {
    avg_rating: Math.round(avg * 10) / 10,
    review_count: data.length,
  };
}

/**
 * Fetch bestsellers sorted by rating (replaces fetchBestsellers)
 */
export async function fetchBestsellersByRating(limit = 8) {
  const { data, error } = await supabase
    .from('products_with_ratings')
    .select('*, categories(name, slug, accent_color)')
    .order('avg_rating', { ascending: false })
    .order('review_count', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}