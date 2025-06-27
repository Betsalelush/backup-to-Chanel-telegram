import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  Cog6ToothIcon,
  BellIcon,
  ShieldCheckIcon,
  ServerIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../components/UI/LoadingSpinner'

const Settings = () => {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('general')

  // Fetch system config
  const { data: config, isLoading } = useQuery(
    'systemConfig',
    () => axios.get('/config').then(res => res.data),
    { refetchOnWindowFocus: false }
  )

  // Update config mutation
  const updateConfigMutation = useMutation(
    (configData) => axios.post('/config', configData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('systemConfig')
        toast.success('ההגדרות נשמרו בהצלחה!')
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'שגיאה בשמירת ההגדרות')
      }
    }
  )

  const [localConfig, setLocalConfig] = useState({
    max_concurrent_jobs: 5,
    default_delay_between_messages: 2.0,
    default_max_messages_per_minute: 20,
    auto_cleanup_completed_jobs: true,
    cleanup_after_days: 30,
    notification_settings: {
      email_enabled: false,
      email_address: '',
      telegram_enabled: false,
      telegram_chat_id: '',
      webhook_enabled: false,
      webhook_url: ''
    },
    security_settings: {
      require_authentication: true,
      session_timeout: 1800,
      max_failed_attempts: 5,
      rate_limit_per_ip: 100,
      allow_anonymous_access: false
    }
  })

  // Update local config when server config loads
  React.useEffect(() => {
    if (config) {
      setLocalConfig(config)
    }
  }, [config])

  const handleSave = () => {
    updateConfigMutation.mutate(localConfig)
  }

  const tabs = [
    {
      id: 'general',
      name: 'כללי',
      icon: Cog6ToothIcon,
      description: 'הגדרות כלליות של המערכת'
    },
    {
      id: 'notifications',
      name: 'התראות',
      icon: BellIcon,
      description: 'הגדרות התראות ועדכונים'
    },
    {
      id: 'security',
      name: 'אבטחה',
      icon: ShieldCheckIcon,
      description: 'הגדרות אבטחה ורשאות'
    },
    {
      id: 'system',
      name: 'מערכת',
      icon: ServerIcon,
      description: 'הגדרות מערכת מתקדמות'
    }
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-white mb-2">הגדרות מערכת</h1>
        <p className="text-slate-400">ניהול והתאמה אישית של המערכת</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-1"
        >
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <nav className="space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-right p-3 rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <div className="flex items-center">
                    <tab.icon className="h-5 w-5 ml-3" />
                    <div>
                      <p className="font-medium">{tab.name}</p>
                      <p className="text-xs opacity-75">{tab.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </nav>
          </div>
        </motion.div>

        {/* Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="lg:col-span-3"
        >
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            {/* General Settings */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-white mb-4">הגדרות כלליות</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      מקסימום משימות בו זמנית
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={localConfig.max_concurrent_jobs}
                      onChange={(e) => setLocalConfig({
                        ...localConfig,
                        max_concurrent_jobs: parseInt(e.target.value)
                      })}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      השהיה ברירת מחדל (שניות)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={localConfig.default_delay_between_messages}
                      onChange={(e) => setLocalConfig({
                        ...localConfig,
                        default_delay_between_messages: parseFloat(e.target.value)
                      })}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      מקסימום הודעות לדקה
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={localConfig.default_max_messages_per_minute}
                      onChange={(e) => setLocalConfig({
                        ...localConfig,
                        default_max_messages_per_minute: parseInt(e.target.value)
                      })}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      ניקוי אוטומטי אחרי (ימים)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={localConfig.cleanup_after_days}
                      onChange={(e) => setLocalConfig({
                        ...localConfig,
                        cleanup_after_days: parseInt(e.target.value)
                      })}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={localConfig.auto_cleanup_completed_jobs}
                      onChange={(e) => setLocalConfig({
                        ...localConfig,
                        auto_cleanup_completed_jobs: e.target.checked
                      })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 bg-slate-700 border-slate-600 rounded"
                    />
                    <span className="mr-3 text-sm text-slate-300">
                      ניקוי אוטומטי של משימות שהושלמו
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Notification Settings */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-white mb-4">הגדרות התראות</h3>
                
                {/* Email Notifications */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-medium">התראות במייל</h4>
                      <p className="text-sm text-slate-400">קבל עדכונים על משימות במייל</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={localConfig.notification_settings?.email_enabled}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          notification_settings: {
                            ...localConfig.notification_settings,
                            email_enabled: e.target.checked
                          }
                        })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  
                  {localConfig.notification_settings?.email_enabled && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        כתובת מייל
                      </label>
                      <input
                        type="email"
                        value={localConfig.notification_settings?.email_address || ''}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          notification_settings: {
                            ...localConfig.notification_settings,
                            email_address: e.target.value
                          }
                        })}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="example@email.com"
                      />
                    </div>
                  )}
                </div>

                {/* Telegram Notifications */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-medium">התראות בטלגרם</h4>
                      <p className="text-sm text-slate-400">קבל עדכונים בטלגרם</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={localConfig.notification_settings?.telegram_enabled}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          notification_settings: {
                            ...localConfig.notification_settings,
                            telegram_enabled: e.target.checked
                          }
                        })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  
                  {localConfig.notification_settings?.telegram_enabled && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        מזהה צ'אט
                      </label>
                      <input
                        type="text"
                        value={localConfig.notification_settings?.telegram_chat_id || ''}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          notification_settings: {
                            ...localConfig.notification_settings,
                            telegram_chat_id: e.target.value
                          }
                        })}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="123456789"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Security Settings */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-white mb-4">הגדרות אבטחה</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      זמן תוקף סשן (שניות)
                    </label>
                    <input
                      type="number"
                      min="300"
                      value={localConfig.security_settings?.session_timeout}
                      onChange={(e) => setLocalConfig({
                        ...localConfig,
                        security_settings: {
                          ...localConfig.security_settings,
                          session_timeout: parseInt(e.target.value)
                        }
                      })}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      מקסימום ניסיונות כושלים
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={localConfig.security_settings?.max_failed_attempts}
                      onChange={(e) => setLocalConfig({
                        ...localConfig,
                        security_settings: {
                          ...localConfig.security_settings,
                          max_failed_attempts: parseInt(e.target.value)
                        }
                      })}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      הגבלת קצב לכל IP
                    </label>
                    <input
                      type="number"
                      min="10"
                      value={localConfig.security_settings?.rate_limit_per_ip}
                      onChange={(e) => setLocalConfig({
                        ...localConfig,
                        security_settings: {
                          ...localConfig.security_settings,
                          rate_limit_per_ip: parseInt(e.target.value)
                        }
                      })}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={localConfig.security_settings?.require_authentication}
                      onChange={(e) => setLocalConfig({
                        ...localConfig,
                        security_settings: {
                          ...localConfig.security_settings,
                          require_authentication: e.target.checked
                        }
                      })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 bg-slate-700 border-slate-600 rounded"
                    />
                    <span className="mr-3 text-sm text-slate-300">
                      דרוש אימות לגישה למערכת
                    </span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={localConfig.security_settings?.allow_anonymous_access}
                      onChange={(e) => setLocalConfig({
                        ...localConfig,
                        security_settings: {
                          ...localConfig.security_settings,
                          allow_anonymous_access: e.target.checked
                        }
                      })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 bg-slate-700 border-slate-600 rounded"
                    />
                    <span className="mr-3 text-sm text-slate-300">
                      אפשר גישה אנונימית (לא מומלץ)
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* System Settings */}
            {activeTab === 'system' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-white mb-4">הגדרות מערכת</h3>
                
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                  <div className="flex">
                    <XMarkIcon className="h-5 w-5 text-yellow-500 ml-2" />
                    <div>
                      <h4 className="text-yellow-300 font-medium">אזהרה</h4>
                      <p className="text-yellow-200 text-sm mt-1">
                        שינוי הגדרות מערכת עלול להשפיע על יציבות המערכת. המשך בזהירות.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="text-center py-8">
                  <ServerIcon className="mx-auto h-12 w-12 text-slate-400 mb-4" />
                  <h4 className="text-lg font-medium text-white mb-2">הגדרות מערכת מתקדמות</h4>
                  <p className="text-slate-400">
                    הגדרות נוספות יתווספו בגרסאות עתידיות
                  </p>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end pt-6 border-t border-slate-700">
              <button
                onClick={handleSave}
                disabled={updateConfigMutation.isLoading}
                className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {updateConfigMutation.isLoading ? (
                  <LoadingSpinner size="small" color="white" className="ml-2" />
                ) : (
                  <CheckIcon className="h-4 w-4 ml-2" />
                )}
                שמור הגדרות
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default Settings