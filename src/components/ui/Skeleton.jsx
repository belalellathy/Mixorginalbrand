import { motion } from 'motion/react'

const shimmerAnimate = { backgroundPosition: ['-200% 0', '200% 0'] }
const shimmerGradient = 'linear-gradient(90deg, rgba(0,0,0,0.06) 25%, rgba(0,0,0,0.12) 50%, rgba(0,0,0,0.06) 75%)'

export function Bone({ width = '100%', height, borderRadius = 8, className }) {
  return (
    <motion.div
      animate={shimmerAnimate}
      transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity }}
      style={{
        width,
        height,
        borderRadius,
        background: shimmerGradient,
        backgroundSize: '200% 100%',
        flexShrink: 0,
      }}
      className={className}
    />
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-100 bg-white">
      <Bone height={260} borderRadius={0} />
      <div className="p-4 flex flex-col gap-3">
        <Bone height={16} width="60%" borderRadius={6} />
        <Bone height={14} width="40%" borderRadius={6} />
        <Bone height={20} width="30%" borderRadius={6} />
        <Bone height={38} borderRadius={8} />
      </div>
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero skeleton */}
      <Bone height={500} borderRadius={0} />
      {/* Products grid skeleton */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <Bone height={32} width={200} borderRadius={8} className="mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
