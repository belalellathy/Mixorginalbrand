import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function CategoryCard({ category }) {
  // Helper to determine text contrast based on hex brightness
  const getContrastColor = (hex) => {
    if (!hex) return '#FFFFFF';
    const c = hex.replace('#', '');
    const r = parseInt(c.substr(0, 2), 16);
    const g = parseInt(c.substr(2, 2), 16);
    const b = parseInt(c.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 155 ? '#1A1A1A' : '#FFFFFF';
  };

  const textColor = getContrastColor(category.accent_color);
  const isLightBg = textColor === '#1A1A1A';

  return (
    <Link
      to={`/category/${category.slug}`}
      style={{ backgroundColor: category.accent_color }}
      className="group relative rounded-[12px] overflow-hidden p-6 sm:p-8 flex flex-col justify-between min-h-[260px] sm:min-h-[300px] shadow-soft hover:shadow-soft-hover hover:scale-[1.02] transition-all duration-300"
    >
      {/* Background image overlay with low opacity for luxury texture */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {category.image_url && (
          <img
            src={category.image_url}
            alt={category.name}
            className="w-full h-full object-cover object-center opacity-20 group-hover:scale-105 group-hover:opacity-25 transition-all duration-700 mix-blend-overlay"
          />
        )}
      </div>

      {/* Top Details */}
      <div className="relative z-10">
        <span
          className={`text-[11px] uppercase tracking-[0.2em] font-semibold px-3 py-1 rounded-full inline-block mb-3 ${
            isLightBg
              ? 'bg-black/10 text-neutral-900'
              : 'bg-white/15 text-white'
          }`}
        >
          Collection
        </span>
        <h3
          style={{ color: textColor }}
          className="font-serif text-2xl sm:text-3xl font-bold tracking-tight mb-2"
        >
          {category.name}
        </h3>
        {category.description && (
          <p
            style={{ color: textColor }}
            className={`text-xs sm:text-sm line-clamp-2 max-w-[240px] ${
              isLightBg ? 'text-neutral-800/80' : 'text-white/80'
            }`}
          >
            {category.description}
          </p>
        )}
      </div>

      {/* Bottom CTA Action */}
      <div className="relative z-10 flex items-center justify-between pt-6 mt-auto">
        <span
          style={{ color: textColor }}
          className="text-xs font-semibold tracking-wider uppercase flex items-center group-hover:underline"
        >
          Explore Collection
        </span>
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:translate-x-1 ${
            isLightBg ? 'bg-black/15 text-black' : 'bg-white/20 text-white'
          }`}
        >
          <ArrowRight className="w-4 h-4" />
        </div>
      </div>
    </Link>
  );
}
