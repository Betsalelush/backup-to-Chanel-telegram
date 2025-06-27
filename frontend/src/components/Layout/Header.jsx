import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../contexts/AuthContext'
import {
  Bars3Icon,
  BellIcon,
  UserCircleIcon,
  ArrowLeftOnRectangleIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline'

const Header = ({ connectionStatus }) => {
  const { user, logout } = useAuth()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const getConnectionStatusColor = (status) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500'
      case 'connecting':
        return 'bg-yellow-500'
      case 'disconnected':
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getConnectionStatusText = (status) => {
    switch (status) {
      case 'connected':
        return 'מחובר'
      case 'connecting':
        return 'מתחבר...'
      case 'disconnected':
        return 'מנותק'
      case 'error':
        return 'שגיאה'
      default:
        return 'לא ידוע'
    }
  }

  return (
    <header className="bg-slate-800 border-b border-slate-700 shadow-sm">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Mobile menu button */}
          <div className="flex items-center lg:hidden">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            >
              <Bars3Icon className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>

          {/* Connection Status */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${getConnectionStatusColor(connectionStatus)}`}>
                {connectionStatus === 'connecting' && (
                  <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                )}
              </div>
              <span className="text-sm text-slate-300">
                {getConnectionStatusText(connectionStatus)}
              </span>
            </div>
          </div>

          {/* Right section */}
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <button
              type="button"
              className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <BellIcon className="h-6 w-6" aria-hidden="true" />
            </button>

            {/* User menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-2 p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <UserCircleIcon className="h-8 w-8" aria-hidden="true" />
                <span className="text-sm font-medium text-slate-300">
                  {user?.username || 'משתמש'}
                </span>
              </button>

              {/* Dropdown menu */}
              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.1 }}
                    className="absolute left-0 mt-2 w-48 rounded-md shadow-lg bg-slate-700 ring-1 ring-black ring-opacity-5 z-50"
                  >
                    <div
                      className="py-1"
                      role="menu"
                      aria-orientation="vertical"
                      aria-labelledby="user-menu"
                    >
                      <a
                        href="/settings"
                        className="flex items-center px-4 py-2 text-sm text-slate-300 hover:bg-slate-600 hover:text-white"
                        role="menuitem"
                      >
                        <Cog6ToothIcon className="ml-3 h-4 w-4" aria-hidden="true" />
                        הגדרות
                      </a>
                      <button
                        onClick={() => {
                          logout()
                          setIsDropdownOpen(false)
                        }}
                        className="flex items-center w-full text-right px-4 py-2 text-sm text-slate-300 hover:bg-slate-600 hover:text-white"
                        role="menuitem"
                      >
                        <ArrowLeftOnRectangleIcon className="ml-3 h-4 w-4" aria-hidden="true" />
                        יציאה
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header