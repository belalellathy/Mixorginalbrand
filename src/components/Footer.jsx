import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { CATEGORIES } from '../config/categories';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email) return;
    setIsSubscribed(true);
    setEmail('');
  };

  return (
    <footer className="bg-neutral-900 text-white pt-16 pb-12 border-t border-neutral-800">
      <div className="max-w-container mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Grid: Brand & Newsletter + Links */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 pb-14 border-b border-neutral-800">
          
          {/* Brand & Newsletter: 6 columns */}
          <div className="md:col-span-6 space-y-6">
            <div>
              <span className="font-serif text-3xl font-bold tracking-tight text-white block">
                Mix Originals
              </span>
              <span className="text-[11px] uppercase tracking-[0.25em] text-neutral-400 font-medium">
                Haute Beauté Paris
              </span>
            </div>
            <p className="text-sm text-neutral-400 max-w-md leading-relaxed">
              Curating the world's most exquisite fragrances, clean botanicals, and high-performance beauty essentials. Crafted without compromise.
            </p>

            {/* Newsletter email signup */}
            <div className="pt-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-neutral-300 block mb-2">
                Join the Private Circle
              </span>
              <p className="text-xs text-neutral-400 mb-3">
                Receive private access to new releases, limited batches, and editorial masterclasses.
              </p>

              {isSubscribed ? (
                <div className="flex items-center space-x-2 text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 p-3 rounded-[8px] max-w-md">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <span className="text-xs font-medium">
                    Thank you for subscribing to Mix Originals. Check your inbox shortly.
                  </span>
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="flex max-w-md">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="flex-grow bg-neutral-800 border border-neutral-700 text-sm text-white px-4 py-2.5 rounded-l-[8px] placeholder-neutral-500 focus:outline-none focus:border-neutral-400"
                  />
                  <button
                    type="submit"
                    className="bg-white text-neutral-900 px-5 py-2.5 rounded-r-[8px] text-xs uppercase font-semibold tracking-wider hover:bg-neutral-200 transition-colors flex items-center shrink-0"
                  >
                    <span>Join</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Links Column 1: Categories (3 columns) */}
          <div className="md:col-span-3 space-y-4">
            <h4 className="text-xs uppercase tracking-[0.2em] font-semibold text-neutral-300">
              Categories
            </h4>
            <ul className="space-y-2.5 text-sm text-neutral-400">
              {CATEGORIES.map((cat) => (
                <li key={cat.slug}>
                  <Link to={`/category/${cat.slug}`} className="hover:text-white transition-colors">
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Links Column 2: About & Contact (3 columns) */}
          <div className="md:col-span-3 space-y-4">
            <h4 className="text-xs uppercase tracking-[0.2em] font-semibold text-neutral-300">
              Maison
            </h4>
            <ul className="space-y-2.5 text-sm text-neutral-400">
              <li>
                <a href="#about" className="hover:text-white transition-colors">
                  About Mix Originals
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar: Copyright & Notes */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 gap-4">
          <p>
            © 2026 Mix Originals. All rights reserved.<br />
            Developed by{' '}
            <a
              href="https://www.linkedin.com/in/belalellathy"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit', textDecoration: 'none' }}
              onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
              onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
            >
              Eng.BelalEllathy
            </a>
          </p>
          <div className="flex space-x-6">
            <span className="hover:text-neutral-400 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-neutral-400 cursor-pointer">Terms of Service</span>
            <span className="hover:text-neutral-400 cursor-pointer">Shipping & Returns</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
