import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from 'react-query'
import axios from 'axios'
import {
  DevicePhoneMobileIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../components/UI/LoadingSpinner'

const Dashboard = () => {
  // Fetch system stats
  const { data: stats, isLoading, error, refetch } = useQuery(
    'systemStats',
    () => axios.get('/stats/overview').then(res => res.data),
    {
      refetchInterval: 30000, // Refetch every 30 seconds
      retry: 2
    }
  )

  const statCards = [
    {
      title: 'סשנים פעילים',
      value: stats?.active_sessions || 0,
      total: stats?.total_sessions || 0,
      icon: DevicePhoneMobileIcon,
      color: 'blue',
      description: 'חיבורי טלגרם פעילים'
    },
    {
      title: 'משימות פעילות',
      value: stats?.active_jobs || 0,
      total: stats?.total_jobs || 0,
      icon: BriefcaseIcon,
      color: 'yellow',
      description: 'משימות העברה בביצוע'
    },
    {
      title: 'משימות הושלמו',
      value: stats?.completed_jobs || 0,
      total: stats?.total_jobs || 0,
      icon: CheckCircleIcon,
      color: 'green',
      description: 'משימות שהסתיימו בהצלחה'
    },
    {
      title: 'הודעות הועברו',
      value: stats?.total_messages_forwarded || 0,
      icon: ChartBarIcon,
      color: 'purple',
      description: 'סה"כ הודעות שהועברו'
    }
  ]

  const getColorClasses = (color) => {
    const colors = {
      blue: {
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/20',
        icon: 'text-blue-500',
        text: 'text-blue-400'
      },
      yellow: {
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/20',
        icon: 'text-yellow-500',
        text: 'text-yellow-400'
      },
      green: {
        bg: 'bg-green-500/10',
        border: 'border-green-500/20',
        icon: 'text-green-500',
        text: 'text-green-400'
      },
      purple: {
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/20',
        icon: 'text-purple-500',
        text: 'text-purple-400'
      }
    }
    return colors[color] || colors.blue
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <XCircleIcon className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">שגיאה בטעינת הנתונים</h3>
        <p className="text-slate-400 mb-4">לא ניתן לטעון את נתוני הדשבורד</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          נסה שוב
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl font-bold text-white mb-2">דשבורד</h1>
        <p className="text-slate-400">מבט כללי על מערכת העברת ההודעות</p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => {
          const colors = getColorClasses(card.color)
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`${colors.bg} ${colors.border} border rounded-lg p-6 backdrop-blur-sm`}
            >
              <div className="flex items-center">
                <div className={`p-2 rounded-lg bg-slate-800/50`}>
                  <card.icon className={`h-6 w-6 ${colors.icon}`} />
                </div>
                <div className="mr-4 flex-1">
                  <p className="text-sm font-medium text-slate-300">{card.title}</p>
                  <div className="flex items-baseline">
                    <p className="text-2xl font-semibold text-white">
                      {card.value?.toLocaleString() || '0'}
                    </p>
                    {card.total && (
                      <p className="mr-2 text-sm text-slate-400">
                        / {card.total.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-400">{card.description}</p>
            </motion.div>
          )
        })}
      </div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="bg-slate-800/50 border border-slate-700 rounded-lg p-6"
      >
        <h2 className="text-lg font-semibold text-white mb-4">פעילות אחרונה</h2>
        
        <div className="space-y-3">
          {[
            { type: 'info', message: 'המערכת הופעלה בהצלחה', time: '5 דקות' },
            { type: 'success', message: 'נוצר סשן חדש בהצלחה', time: '10 דקות' },
            { type: 'warning', message: 'משימה מספר 1 הושהתה', time: '15 דקות' },
          ].map((activity, index) => (
            <div key={index} className="flex items-center p-3 bg-slate-700/30 rounded-lg">
              <div className={`p-1 rounded-full ${
                activity.type === 'success' ? 'bg-green-500/20' :
                activity.type === 'warning' ? 'bg-yellow-500/20' :
                'bg-blue-500/20'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  activity.type === 'success' ? 'bg-green-500' :
                  activity.type === 'warning' ? 'bg-yellow-500' :
                  'bg-blue-500'
                }`} />
              </div>
              <div className="mr-3 flex-1">
                <p className="text-sm text-white">{activity.message}</p>
                <p className="text-xs text-slate-400">לפני {activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* System Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="bg-slate-800/50 border border-slate-700 rounded-lg p-6"
      >
        <h2 className="text-lg font-semibold text-white mb-4">סטטוס מערכת</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <CheckCircleIcon className="h-5 w-5 text-green-500 ml-2" />
            <div>
              <p className="text-sm font-medium text-white">שרת</p>
              <p className="text-xs text-green-400">פעיל</p>
            </div>
          </div>
          
          <div className="flex items-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <CheckCircleIcon className="h-5 w-5 text-green-500 ml-2" />
            <div>
              <p className="text-sm font-medium text-white">מסד נתונים</p>
              <p className="text-xs text-green-400">מחובר</p>
            </div>
          </div>
          
          <div className="flex items-center p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <ClockIcon className="h-5 w-5 text-yellow-500 ml-2" />
            <div>
              <p className="text-sm font-medium text-white">API טלגרם</p>
              <p className="text-xs text-yellow-400">מוכן</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default Dashboard