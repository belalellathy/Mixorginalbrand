import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ShoppingBag, Menu, X, ChevronDown, Search } from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { searchProducts } from '../lib/supabase';
import { formatEGP } from '../lib/format';
import { CATEGORIES } from '../config/categories';

const CATEGORY_COLORS = {
  'mens-perfumes': '#1A2E4A',
  'womens-perfumes': '#C9A0A0',
  'skincare': '#8FAF8F',
  'makeup': '#7D2335',
};

const CATEGORY_LINKS = CATEGORIES.map((cat) => ({
  ...cat,
  color: CATEGORY_COLORS[cat.slug],
}));

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [categoriesDropdownOpen, setCategoriesDropdownOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const searchInputRef = useRef(null);
  const mobileSearchInputRef = useRef(null);
  const debounceRef = useRef(null);
  const requestRef = useRef(0);

  const displayQuery = searchQuery.length > 60 ? searchQuery.slice(0, 60) + '...' : searchQuery;

  const totalItems = useCartStore((state) => state.totalItems);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Sync search input with URL search query on the search page
  useEffect(() => {
    if (location.pathname === '/search') {
      const q = searchParams.get('q') || '';
      setSearchQuery(q);
      setIsSearchOpen(true);
    }
  }, [location.pathname, searchParams]);

  const clearSuggestions = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    requestRef.current++;
    setSuggestions([]);
    setShowSuggestions(false);
    setSuggestLoading(false);
  };

  // Debounced live search: wait 300ms after the user stops typing before
  // calling searchProducts; a new keystroke cancels the pending request.
  const handleSearchChange = (value) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    requestRef.current++;
    if (!value.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSuggestLoading(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const requestId = ++requestRef.current;
      setSuggestLoading(true);
      setShowSuggestions(true);
      try {
        const data = await searchProducts(value.trim().slice(0, 100));
        if (requestRef.current === requestId) {
          setSuggestions((data || []).slice(0, 6));
        }
      } catch (err) {
        console.error('Error fetching search suggestions:', err);
      } finally {
        if (requestRef.current === requestId) setSuggestLoading(false);
      }
    }, 300);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      clearSuggestions();
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setMobileMenuOpen(false);
    }
  };

  const handleSelectSuggestion = (productId) => {
    clearSuggestions();
    handleCloseSearch();
    setMobileMenuOpen(false);
    navigate(`/product/${productId}`);
  };

  // Cancel any pending debounced search on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      requestRef.current++;
    };
  }, []);

  const handleOpenSearch = () => {
    setIsSearchOpen(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
      mobileSearchInputRef.current?.focus();
    }, 100);
  };

  const handleCloseSearch = () => {
    clearSuggestions();
    setIsSearchOpen(false);
    if (location.pathname !== '/search') {
      setSearchQuery('');
    }
  };

  const renderSuggestions = (positionClasses) => {
    if (!showSuggestions || !searchQuery.trim()) return null;
    return (
      <div className={`absolute z-50 bg-white rounded-xl shadow-card border border-neutral-100 py-2 ${positionClasses}`}>
        {suggestLoading ? (
          <p className="px-4 py-3 text-xs text-neutral-400">Searching…</p>
        ) : suggestions.length > 0 ? (
          <>
            <p className="px-4 pt-1 pb-2 text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">
              Results for &ldquo;{displayQuery}&rdquo;
            </p>
            {suggestions.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => handleSelectSuggestion(product.id)}
                className="w-full flex items-center space-x-3 px-4 py-2 hover:bg-neutral-50 transition-colors text-left"
              >
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-9 h-9 rounded-[6px] object-cover flex-shrink-0 bg-neutral-100"
                />
                <span className="flex-grow min-w-0">
                  <span className="block text-xs font-medium text-neutral-900 truncate">
                    {product.name}
                  </span>
                  <span className="block text-[11px] text-neutral-500">
                    {formatEGP(product.price)}
                  </span>
                </span>
              </button>
            ))}
          </>
        ) : (
          <p className="px-4 py-3 text-xs text-neutral-400">
            No matches for &ldquo;{displayQuery}&rdquo;
          </p>
        )}
      </div>
    );
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-neutral-100 transition-all">
      <div className="max-w-container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Left: Brand Logo */}
          <div className="flex-1 flex items-center">
            <Link 
              to="/" 
              className="group flex flex-col items-start focus:outline-none"
            >
              <span className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#1A1A1A] group-hover:text-neutral-700 transition-colors">
                Mix Originals
              </span>
              <span className="text-[10px] uppercase tracking-[0.25em] text-neutral-500 -mt-1 font-medium">
                Haute Beauté
              </span>
            </Link>
          </div>

          {/* Center: Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center space-x-8">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `text-sm tracking-wide uppercase font-medium transition-colors hover:text-[#1A1A1A] ${
                  isActive ? 'text-[#1A1A1A] font-semibold border-b-2 border-[#1A1A1A] pb-1' : 'text-neutral-500'
                }`
              }
            >
              Home
            </NavLink>

            {/* Categories Dropdown */}
            <div 
              className="relative"
              onMouseEnter={() => setCategoriesDropdownOpen(true)}
              onMouseLeave={() => setCategoriesDropdownOpen(false)}
            >
              <button 
                className="flex items-center space-x-1 text-sm tracking-wide uppercase font-medium text-neutral-500 hover:text-[#1A1A1A] transition-colors py-2 focus:outline-none"
              >
                <span>Categories</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${categoriesDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {categoriesDropdownOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-56 bg-white rounded-xl shadow-card border border-neutral-100 py-3 z-50 transition-all">
                  {CATEGORY_LINKS.map((cat) => (
                    <Link
                      key={cat.slug}
                      to={`/category/${cat.slug}`}
                      onClick={() => setCategoriesDropdownOpen(false)}
                      className="flex items-center px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors group"
                    >
                      <span 
                        className="w-2.5 h-2.5 rounded-full mr-3 shrink-0" 
                        style={{ backgroundColor: cat.color }} 
                      />
                      <span className="group-hover:translate-x-1 transition-transform font-medium">
                        {cat.name}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <a
              href="#about"
              onClick={(e) => {
                // If not on home, go home then scroll
                if (window.location.pathname !== '/') {
                  navigate('/');
                  setTimeout(() => {
                    document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                } else {
                  e.preventDefault();
                  document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="text-sm tracking-wide uppercase font-medium text-neutral-500 hover:text-[#1A1A1A] transition-colors"
            >
              About
            </a>
          </nav>

          {/* Right: Search, Cart & Mobile Hamburger */}
          <div className="flex-1 flex items-center justify-end space-x-2 sm:space-x-3">
            {/* Desktop Animated Search Bar */}
            <div className="hidden md:flex items-center relative">
              {isSearchOpen ? (
                <form
                  onSubmit={handleSearchSubmit}
                  className="flex items-center bg-neutral-50 border border-neutral-200 rounded-full pl-3 pr-1.5 py-1 transition-all duration-300 ease-out focus-within:border-neutral-400 focus-within:bg-white focus-within:shadow-sm w-60 lg:w-72"
                >
                  <button
                    type="submit"
                    className="text-neutral-400 hover:text-neutral-700 p-1 focus:outline-none transition-colors"
                    aria-label="Submit search"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Search products..."
                    className="bg-transparent border-none text-xs text-neutral-900 placeholder-neutral-400 px-2 py-1 flex-grow focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCloseSearch}
                    className="text-neutral-400 hover:text-neutral-700 p-1 rounded-full hover:bg-neutral-100 transition-colors focus:outline-none"
                    aria-label="Close search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                <button
                  onClick={handleOpenSearch}
                  className="p-2.5 text-neutral-700 hover:text-[#1A1A1A] hover:bg-neutral-50 rounded-full transition-colors focus:outline-none"
                  aria-label="Open search"
                >
                  <Search className="w-5 h-5" />
                </button>
              )}
              {renderSuggestions('top-full right-0 mt-2 w-72')}
            </div>

            {/* Mobile Search Button */}
            <button
              onClick={() => {
                if (isSearchOpen) {
                  handleCloseSearch();
                } else {
                  handleOpenSearch();
                }
              }}
              className="md:hidden p-2 text-neutral-700 hover:text-[#1A1A1A] focus:outline-none"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Cart Icon Button */}
            <Link
              to="/cart"
              className="relative p-2.5 text-[#1A1A1A] hover:bg-neutral-50 rounded-full transition-colors focus:outline-none"
              aria-label={`Shopping Cart with ${totalItems} items`}
            >
              <ShoppingBag className="w-5 h-5" />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[#1A1A1A] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                  {totalItems}
                </span>
              )}
            </Link>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-neutral-700 hover:text-[#1A1A1A] focus:outline-none"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Full-Width Search Bar */}
      {isSearchOpen && (
        <div className="relative md:hidden border-t border-neutral-100 bg-white px-4 py-3 animate-in slide-in-from-top duration-200 shadow-sm">
          <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2">
            <div className="relative flex-grow">
              <input
                ref={mobileSearchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search products..."
                className="w-full bg-neutral-100 border border-transparent focus:border-neutral-300 text-sm text-neutral-900 pl-9 pr-8 py-2 rounded-lg focus:outline-none focus:bg-white transition-all"
              />
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="bg-[#1A1A1A] text-white text-xs font-semibold px-4 py-2.5 rounded-lg shrink-0 uppercase tracking-wider hover:bg-neutral-800 transition-colors"
            >
              Search
            </button>
            <button
              type="button"
              onClick={handleCloseSearch}
              className="p-2 text-neutral-500 hover:text-neutral-700 focus:outline-none"
              aria-label="Close search"
            >
              <X className="w-5 h-5" />
            </button>
          </form>
          {renderSuggestions('top-full left-4 right-4 mt-1')}
        </div>
      )}

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-neutral-100 bg-white px-4 pt-4 pb-6 space-y-4 animate-in slide-in-from-top duration-200">
          <div className="flex flex-col space-y-3">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-medium text-neutral-900 py-2 px-3 rounded-lg hover:bg-neutral-50"
            >
              Home
            </Link>

            <div className="pt-2 border-t border-neutral-100">
              <span className="text-xs uppercase tracking-wider text-neutral-400 font-semibold px-3 block mb-2">
                Categories
              </span>
              <div className="grid grid-cols-1 gap-1">
                {CATEGORY_LINKS.map((cat) => (
                  <Link
                    key={cat.slug}
                    to={`/category/${cat.slug}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center text-sm font-medium text-neutral-700 py-2 px-3 rounded-lg hover:bg-neutral-50"
                  >
                    <span 
                      className="w-2.5 h-2.5 rounded-full mr-3 shrink-0" 
                      style={{ backgroundColor: cat.color }} 
                    />
                    {cat.name}
                  </Link>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-100">
              <a
                href="#about"
                onClick={() => {
                  setMobileMenuOpen(false);
                  document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="block text-base font-medium text-neutral-900 py-2 px-3 rounded-lg hover:bg-neutral-50"
              >
                About
              </a>
            </div>

            <Link
              to="/cart"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between text-base font-medium text-neutral-900 py-2.5 px-3 rounded-lg bg-neutral-50"
            >
              <span className="flex items-center">
                <ShoppingBag className="w-5 h-5 mr-2" />
                Shopping Cart
              </span>
              <span className="bg-[#1A1A1A] text-white text-xs px-2 py-0.5 rounded-full">
                {totalItems}
              </span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

