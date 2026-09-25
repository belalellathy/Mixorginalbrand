import React from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIES } from '../config/categories';

export default function Footer() {
  return (
    <footer className="bg-neutral-900 text-white pt-16 pb-12 border-t border-neutral-800">
      <div className="max-w-container mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Grid: Brand + Links */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 pb-14 border-b border-neutral-800">
          
          {/* Brand: 6 columns */}
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
