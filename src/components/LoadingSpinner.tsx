import { motion } from 'framer-motion'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  text?: string
  className?: string
}

export function LoadingSpinner({ size = 'md', text, className = '' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  }

  const spinnerVariants = {
    animate: {
      rotate: 360,
      transition: {
        duration: 1,
        repeat: Infinity,
        ease: 'linear'
      }
    }
  }

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <motion.div
        className={`${sizeClasses[size]} border-2 border-gray-300 border-t-blue-600 rounded-full`}
        variants={spinnerVariants}
        animate="animate"
      />
      {text && (
        <motion.p 
          className="mt-3 text-sm text-gray-600 dark:text-gray-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {text}
        </motion.p>
      )}
    </div>
  )
}

export function LoadingDots({ text, className = '' }: { text?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="flex space-x-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-blue-600 rounded-full"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              delay: i * 0.2
            }}
          />
        ))}
      </div>
      {text && (
        <motion.p 
          className="mt-3 text-sm text-gray-600 dark:text-gray-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {text}
        </motion.p>
      )}
    </div>
  )
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-gray-200 dark:bg-gray-700 rounded-lg p-4 animate-pulse ${className}`}>
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
        </div>
      </div>
    </div>
  )
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse ${
            i === lines - 1 ? 'w-3/4' : 'w-full'
          }`}
        />
      ))}
    </div>
  )
} 