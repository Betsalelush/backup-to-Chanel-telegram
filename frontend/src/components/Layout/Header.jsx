import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BellIcon,
  UserCircleIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  SunIcon,
  MoonIcon,
  LanguageIcon
} from '@heroicons/react/24/outline'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { useWebSocket } from '../../contexts/WebSocketContext'

const Header = ({ connectionStatus }) => {
  const { user, logout } = useAuth()
  const { theme, setTheme, language, setLanguage } = useTheme()
  const { messageHistory } = useWebSocket()
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  // Get recent notifications
  const recentNotifications = messageHistory
    .filter(msg => msg.type === 'system_notification' || msg.type === 'error_notification')
    .slice(0, 5)

  const unreadCount = recentNotifications.length

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-green-500'
      case 'connecting':
        return 'text-yellow-500'
      case 'disconnected':
      case 'error':
        return 'text-red-500'
      default:
        return 'text-slate-500'
    }
  }

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'מחובר'
      case 'connecting':
        return 'מתחבר...'
      case 'disconnected':
        return 'מנותק'
      case 'error':
        return 'שגיאה בחיבור'
      default:
        return 'לא ידוע'
    }
  }

  return (
    <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left side - Connection status */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' :
              connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
              'bg-red-500'
            }`}></div>
            <span className={`text-sm font-medium ${getConnectionStatusColor()}`}>
              {getConnectionStatusText()}
            </span>
          </div>
        </div>

        {/* Center - Page title */}
        <div className="flex-1 text-center">
          <h2 className="text-lg font-semibold text-white">
            מערכת ניהול הודעות טלגרם
          </h2>
        </div>

        {/* Right side - User menu */}
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-700"
            >
              <BellIcon className="h-6 w-6" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute left-0 mt-2 w-80 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-50"
                >
                  <div className="p-4 border-b border-slate-600">
                    <h3 className="text-sm font-medium text-white">התראות אחרונות</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {recentNotifications.length > 0 ? (
                      recentNotifications.map((notification, index) => (
                        <div key={index} className="p-3 border-b border-slate-600 last:border-b-0 hover:bg-slate-700">
                          <div className="flex items-start space-x-3">
                            <div className={`w-2 h-2 rounded-full mt-2 ${
                              notification.type === 'error_notification' ? 'bg-red-500' : 'bg-blue-500'
                            }`}></div>
                            <div className="flex-1">
                              <p className="text-sm text-slate-300">
                                {notification.data?.message || notification.data?.text || 'התראה'}
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
                                {new Date(notification.timestamp).toLocaleString('he-IL')}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-slate-400">
                        <BellIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">אין התראות חדשות</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Language toggle */}
          <button
            onClick={() => setLanguage(language === 'he' ? 'en' : 'he')}
            className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-700"
            title={language === 'he' ? 'Switch to English' : 'עבור לעברית'}
          >
            <LanguageIcon className="h-6 w-6" />
          </button>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-700"
            title={theme === 'dark' ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'}
          >
            {theme === 'dark' ? (
              <SunIcon className="h-6 w-6" />
            ) : (
              <MoonIcon className="h-6 w-6" />
            )}
          </button>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="flex items-center space-x-3 p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-700"
            >
              <UserCircleIcon className="h-8 w-8" />
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-white">{user?.username || 'משתמש'}</p>
                <p className="text-xs text-slate-400">מנהל מערכת</p>
              </div>
            </button>

            <AnimatePresence>
              {showProfile && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute left-0 mt-2 w-48 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-50"
                >
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setShowProfile(false)
                        // Navigate to settings
                      }}
                      className="flex items-center w-full px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <Cog6ToothIcon className="h-4 w-4 mr-3" />
                      הגדרות
                    </button>
                    <button
                      onClick={() => {
                        setShowProfile(false)
                        logout()
                      }}
                      className="flex items-center w-full px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <ArrowRightOnRectangleIcon className="h-4 w-4 mr-3" />
                      התנתקות
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Click outside to close dropdowns */}
      {(showNotifications || showProfile) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowNotifications(false)
            setShowProfile(false)
          }}
        />
      )}
    </header>
  )
}

export default Header