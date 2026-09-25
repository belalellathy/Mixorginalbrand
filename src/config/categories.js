export const CATEGORIES = [
  { slug: 'mens-perfumes', name: "Men's Perfumes" },
  { slug: 'womens-perfumes', name: "Women's Perfumes" },
  { slug: 'skincare', name: 'Skincare' },
  { slug: 'makeup', name: 'Makeup' },
]

export const getCategoryBySlug = (slug) =>
  CATEGORIES.find(c => c.slug === slug) || null
