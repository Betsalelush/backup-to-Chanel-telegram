import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HomeIcon,
  UserGroupIcon,
  BriefcaseIcon,
  PlusIcon,
  CogIcon,
  ChartBarIcon,
  DocumentTextIcon,
  BellIcon,
  XMarkIcon,
  Bars3Icon
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeIconSolid,
  UserGroupIcon as UserGroupIconSolid,
  BriefcaseIcon as BriefcaseIconSolid,
  CogIcon as CogIconSolid,
  ChartBarIcon as ChartBarIconSolid
} from '@heroicons/react/24/solid'

const navigation = [
  {
    name: 'דשבורד',
    href: '/',
    icon: HomeIcon,
    iconSolid: HomeIconSolid,
    description: 'מבט כללי על המערכת'
  },
  {
    name: 'חשבונות טלגרם',
    href: '/sessions',
    icon: UserGroupIcon,
    iconSolid: UserGroupIconSolid,
    description: 'ניהול חשבונות והתחברות'
  },
  {
    name: 'משימות העברה',
    href: '/jobs',
    icon: BriefcaseIcon,
    iconSolid: BriefcaseIconSolid,
    description: 'מעקב אחר משימות פעילות'
  },
  {
    name: 'יצירת משימה',
    href: '/jobs/create',
    icon: PlusIcon,
    iconSolid: PlusIcon,
    description: 'יצירת משימת העברה חדשה',
    highlight: true
  },
  {
    name: 'סטטיסטיקות',
    href: '/stats',
    icon: ChartBarIcon,
    iconSolid: ChartBarIconSolid,
    description: 'דוחות וסטטיסטיקות'
  },
  {
    name: 'הגדרות',
    href: '/settings',
    icon: CogIcon,
    iconSolid: CogIconSolid,
    description: 'הגדרות מערכת'
  }
]

const Sidebar = () => {
  const location = useLocation()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const isActive = (href) => {
    if (href === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(href)
  }

  const sidebarVariants = {
    expanded: { width: '16rem' },
    collapsed: { width: '5rem' }
  }

  const itemVariants = {
    expanded: { opacity: 1, x: 0 },
    collapsed: { opacity: 0, x: -10 }
  }

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 right-4 z-50">
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
        >
          {isMobileOpen ? (
            <XMarkIcon className="h-6 w-6" />
          ) : (
            <Bars3Icon className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.div
        variants={sidebarVariants}
        animate={isCollapsed ? 'collapsed' : 'expanded'}
        transition={{ duration: 0.3 }}
        className={`
          fixed lg:static inset-y-0 right-0 z-40
          bg-slate-800 border-l border-slate-700 shadow-lg
          transform transition-transform duration-300 lg:transform-none
          ${isMobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
          ${isCollapsed ? 'w-20' : 'w-64'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <AnimatePresence>
              {!isCollapsed && (
                <motion.div
                  variants={itemVariants}
                  initial="collapsed"
                  animate="expanded"
                  exit="collapsed"
                  className="flex items-center space-x-3"
                >
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <DocumentTextIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-white">מנהל טלגרם</h1>
                    <p className="text-xs text-slate-400">מערכת העברת הודעות</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Collapse button (desktop only) */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden lg:block p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              const active = isActive(item.href)
              const Icon = active ? item.iconSolid : item.icon

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`
                    group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
                    ${active
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }
                    ${item.highlight ? 'ring-2 ring-green-500 ring-opacity-50' : ''}
                  `}
                  onClick={() => setIsMobileOpen(false)}
                  title={isCollapsed ? item.name : item.description}
                >
                  <Icon className={`
                    h-5 w-5 flex-shrink-0 transition-colors
                    ${active ? 'text-white' : 'text-slate-400 group-hover:text-white'}
                  `} />
                  
                  <AnimatePresence>
                    {!isCollapsed && (
                      <motion.div
                        variants={itemVariants}
                        initial="collapsed"
                        animate="expanded"
                        exit="collapsed"
                        className="mr-3 flex-1"
                      >
                        <div className="flex items-center justify-between">
                          <span>{item.name}</span>
                          {item.highlight && (
                            <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                              חדש
                            </span>
                          )}
                        </div>
                        {!active && (
                          <p className="text-xs text-slate-500 group-hover:text-slate-400 mt-0.5">
                            {item.description}
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-slate-700">
            <AnimatePresence>
              {!isCollapsed && (
                <motion.div
                  variants={itemVariants}
                  initial="collapsed"
                  animate="expanded"
                  exit="collapsed"
                  className="flex items-center space-x-3 text-sm text-slate-400"
                >
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>מערכת פעילה</span>
                </motion.div>
              )}
            </AnimatePresence>
            
            {isCollapsed && (
              <div className="flex justify-center">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  )
}

export default Sidebar