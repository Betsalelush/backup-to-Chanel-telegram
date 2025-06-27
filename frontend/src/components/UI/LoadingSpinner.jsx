import React from 'react'
import { motion } from 'framer-motion'

const LoadingSpinner = ({ size = 'medium', color = 'blue', className = '' }) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  }

  const colorClasses = {
    blue: 'border-blue-500',
    white: 'border-white',
    gray: 'border-gray-400',
    green: 'border-green-500',
    red: 'border-red-500'
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`flex items-center justify-center ${className}`}
    >
      <div className={`${sizeClasses[size]} border-2 border-gray-300 border-t-transparent rounded-full animate-spin ${colorClasses[color]}`} />
    </motion.div>
  )
}

export default LoadingSpinner