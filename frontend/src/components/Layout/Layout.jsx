import React from 'react'
import { motion } from 'framer-motion'

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex h-screen overflow-hidden"
      >
        {children}
      </motion.div>
    </div>
  )
}

export default Layout