import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  HomeIcon,
  DevicePhoneMobileIcon,
  BriefcaseIcon,
  PlusCircleIcon,
  Cog6ToothIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'

const navigation = [
  { name: 'דשבורד', href: '/', icon: HomeIcon },
  { name: 'סשנים', href: '/sessions', icon: DevicePhoneMobileIcon },
  { name: 'משימות', href: '/jobs', icon: BriefcaseIcon },
  { name: 'משימה חדשה', href: '/jobs/create', icon: PlusCircleIcon },
  { name: 'הגדרות', href: '/settings', icon: Cog6ToothIcon },
]

const Sidebar = () => {
  const location = useLocation()

  return (
    <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
      <div className="flex flex-col flex-grow bg-slate-800 pt-5 pb-4 overflow-y-auto">
        {/* Logo */}
        <div className="flex items-center flex-shrink-0 px-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="flex items-center"
          >
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                </svg>
              </div>
            </div>
            <div className="mr-3">
              <p className="text-lg font-semibold text-white">מנהל טלגרם</p>
              <p className="text-xs text-slate-400">מערכת העברת הודעות</p>
            </div>
          </motion.div>
        </div>

        {/* Navigation */}
        <nav className="mt-8 flex-1 px-2 space-y-1">
          {navigation.map((item, index) => {
            const isActive = location.pathname === item.href
            return (
              <motion.div
                key={item.name}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <NavLink
                  to={item.href}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                    isActive
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <item.icon
                    className={`ml-3 flex-shrink-0 h-5 w-5 transition-colors duration-200 ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
                    }`}
                    aria-hidden="true"
                  />
                  {item.name}
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute left-0 w-1 h-8 bg-blue-500 rounded-r-full"
                      initial={false}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </NavLink>
              </motion.div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 py-4 border-t border-slate-700">
          <div className="text-xs text-slate-400 text-center">
            <p>גרסה 1.0.0</p>
            <p className="mt-1">© 2025 מנהל טלגרם</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Sidebar