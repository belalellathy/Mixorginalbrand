import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Upload payment screenshot via the `upload-receipt` Edge Function.
 * Client type/size checks below are UX-only; the server sniffs magic bytes,
 * enforces 5 MB, and generates the receipt path.
 */
export const ALLOWED_RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const MAX_RECEIPT_SIZE_BYTES = 5 * 1024 * 1024;

export async function uploadPaymentScreenshot(file) {
  if (!file) throw new Error('No file provided');

  if (!ALLOWED_RECEIPT_TYPES.includes(file.type)) {
    throw new Error('Unsupported image type. Use JPG, PNG or WEBP.');
  }

  if (file.size > MAX_RECEIPT_SIZE_BYTES) {
    throw new Error('File too large. Maximum size is 5MB.');
  }

  const formData = new FormData();
  formData.append('file', file);

  let response;
  try {
    response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-receipt`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: formData,
      }
    );
  } catch {
    throw new Error('Network error. Please try again.');
  }

  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  if (!response.ok) {
    throw new Error(body.error || 'Upload failed');
  }

  if (!body.path || typeof body.path !== 'string') {
    throw new Error('Upload failed');
  }

  return { path: body.path };
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
    .from('products')
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
    .from('products')
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
    .from('products')
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
    .from('products')
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
  try {
    const { data, error } = await supabase.functions.invoke('createorder', {
      body: { items, contactInfo, receipt_path },
    });

    if (error) {
      if (error.context instanceof Response) {
        let message = 'Failed to place order';
        try {
          const body = await error.context.json();
          if (body?.error) message = body.error;
        } catch {
          // Keep default message when the error body is not JSON.
        }
        throw new Error(message);
      }
      throw new Error('Network error. Please try again.');
    }

    if (!data?.id) throw new Error('Failed to place order');
    // receipt_signed_url is absent on the old function; default to null.
    return { id: data.id, total_price: data.total_price, receipt_signed_url: data.receipt_signed_url ?? null };
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Network error. Please try again.');
  }
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
    .from('products')
    .select('*, categories(name, slug, accent_color)')
    .or(`name.ilike.%${sanitized}%,description.ilike.%${sanitized}%`)
    .order('name');

  if (error) throw error;
  return data || [];
}

/**
 * Fetch bestsellers
 */
export async function fetchBestsellers(limit = 8) {
  const { data, error } = await supabase
    .from('products')
    .select('*, categories(name, slug, accent_color)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}