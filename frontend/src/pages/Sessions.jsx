import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  DevicePhoneMobileIcon,
  TrashIcon,
  QrCodeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../components/UI/LoadingSpinner'

const Sessions = () => {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createSessionData, setCreateSessionData] = useState({
    api_id: '',
    api_hash: '',
    phone: '',
    use_qr: true
  })
  const queryClient = useQueryClient()

  // Fetch sessions
  const { data: sessionsData, isLoading, error, refetch } = useQuery(
    'sessions',
    () => axios.get('/sessions').then(res => res.data),
    { refetchInterval: 10000 }
  )

  const sessions = sessionsData?.sessions || []

  // Create session mutation
  const createSessionMutation = useMutation(
    (sessionData) => axios.post('/sessions/create', sessionData),
    {
      onSuccess: (response) => {
        queryClient.invalidateQueries('sessions')
        setShowCreateModal(false)
        setCreateSessionData({ api_id: '', api_hash: '', phone: '', use_qr: true })
        toast.success('סשן נוצר בהצלחה!')
        
        if (response.data.qr_code) {
          // Show QR code in a separate modal or component
          console.log('QR Code:', response.data.qr_code)
        }
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'שגיאה ביצירת הסשן')
      }
    }
  )

  // Delete session mutation
  const deleteSessionMutation = useMutation(
    (sessionId) => axios.delete(`/sessions/${sessionId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('sessions')
        toast.success('סשן נמחק בהצלחה!')
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'שגיאה במחיקת הסשן')
      }
    }
  )

  const getStatusIcon = (status) => {
    switch (status) {
      case 'authenticated':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'authenticating':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />
      default:
        return <DevicePhoneMobileIcon className="h-5 w-5 text-slate-400" />
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'authenticated':
        return 'מחובר'
      case 'authenticating':
        return 'מתחבר...'
      case 'failed':
        return 'נכשל'
      case 'disconnected':
        return 'מנותק'
      default:
        return 'לא ידוע'
    }
  }

  const handleCreateSession = (e) => {
    e.preventDefault()
    if (!createSessionData.api_id || !createSessionData.api_hash) {
      toast.error('נא למלא את פרטי ה-API')
      return
    }
    createSessionMutation.mutate(createSessionData)
  }

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
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">סשני טלגרם</h1>
          <p className="text-slate-400">ניהול חיבורי טלגרם</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4 ml-2" />
          סשן חדש
        </button>
      </motion.div>

      {/* Sessions Grid */}
      {error ? (
        <div className="text-center py-12">
          <XCircleIcon className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">שגיאה בטעינת הסשנים</h3>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            נסה שוב
          </button>
        </div>
      ) : sessions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12 bg-slate-800/50 border border-slate-700 rounded-lg"
        >
          <DevicePhoneMobileIcon className="mx-auto h-12 w-12 text-slate-400 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">אין סשנים</h3>
          <p className="text-slate-400 mb-4">צור סשן ראשון כדי להתחיל</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            צור סשן חדש
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((session, index) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-slate-800/50 border border-slate-700 rounded-lg p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  {getStatusIcon(session.status)}
                  <span className="mr-2 text-sm font-medium text-white">
                    {session.phone || 'אין מספר'}
                  </span>
                </div>
                <button
                  onClick={() => deleteSessionMutation.mutate(session.id)}
                  disabled={deleteSessionMutation.isLoading}
                  className="text-red-400 hover:text-red-300 transition-colors"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">סטטוס:</span>
                  <span className="text-white">{getStatusText(session.status)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">נוצר:</span>
                  <span className="text-white">
                    {new Date(session.created_at).toLocaleDateString('he-IL')}
                  </span>
                </div>
                {session.last_active && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">פעיל לאחרונה:</span>
                    <span className="text-white">
                      {new Date(session.last_active).toLocaleDateString('he-IL')}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Session Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-800 rounded-lg p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-white mb-4">צור סשן חדש</h3>
              
              <form onSubmit={handleCreateSession} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    API ID
                  </label>
                  <input
                    type="text"
                    value={createSessionData.api_id}
                    onChange={(e) => setCreateSessionData({...createSessionData, api_id: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="הכנס API ID"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    API Hash
                  </label>
                  <input
                    type="text"
                    value={createSessionData.api_hash}
                    onChange={(e) => setCreateSessionData({...createSessionData, api_hash: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="הכנס API Hash"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    מספר טלפון (אופציונלי)
                  </label>
                  <input
                    type="tel"
                    value={createSessionData.phone}
                    onChange={(e) => setCreateSessionData({...createSessionData, phone: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+972501234567"
                  />
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="use_qr"
                    checked={createSessionData.use_qr}
                    onChange={(e) => setCreateSessionData({...createSessionData, use_qr: e.target.checked})}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 bg-slate-700 border-slate-600 rounded"
                  />
                  <label htmlFor="use_qr" className="mr-2 text-sm text-slate-300">
                    השתמש בקוד QR
                  </label>
                </div>
                
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    ביטול
                  </button>
                  <button
                    type="submit"
                    disabled={createSessionMutation.isLoading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
                  >
                    {createSessionMutation.isLoading ? (
                      <LoadingSpinner size="small" color="white" />
                    ) : (
                      'צור סשן'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Sessions