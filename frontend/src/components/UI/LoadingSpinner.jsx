import React from 'react'
import { motion } from 'framer-motion'

const LoadingSpinner = ({ 
  size = 'medium', 
  color = 'blue', 
  className = '',
  text = null 
}) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12',
    xl: 'w-16 h-16'
  }

  const colorClasses = {
    blue: 'border-blue-500',
    green: 'border-green-500',
    red: 'border-red-500',
    yellow: 'border-yellow-500',
    purple: 'border-purple-500',
    white: 'border-white',
    slate: 'border-slate-500'
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <motion.div
        className={`
          ${sizeClasses[size]}
          border-2 border-slate-700 rounded-full
          ${colorClasses[color]}
          border-t-transparent
        `}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: 'linear'
        }}
      />
      {text && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-3 text-sm text-slate-400 text-center"
        >
          {text}
        </motion.p>
      )}
    </div>
  )
}

export default LoadingSpinner