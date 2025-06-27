import React from 'react'
import { motion } from 'framer-motion'
import { useTheme } from '../../contexts/ThemeContext'

const Layout = ({ children }) => {
  const { getThemeClasses } = useTheme()

  return (
    <motion.div
      className={`min-h-screen bg-slate-900 ${getThemeClasses()}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex h-screen overflow-hidden">
        {children}
      </div>
    </motion.div>
  )
}

export default Layout