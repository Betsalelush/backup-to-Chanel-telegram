import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  ArrowRightIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  TrashIcon,
  DocumentArrowDownIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../components/UI/LoadingSpinner'

const JobDetail = () => {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Fetch job details
  const { data: job, isLoading, error, refetch } = useQuery(
    ['job', jobId],
    () => axios.get(`/jobs/${jobId}`).then(res => res.data),
    { refetchInterval: 10000, enabled: !!jobId }
  )

  // Fetch job stats
  const { data: stats } = useQuery(
    ['jobStats', jobId],
    () => axios.get(`/stats/job/${jobId}`).then(res => res.data),
    { refetchInterval: 10000, enabled: !!jobId }
  )

  // Start job mutation
  const startJobMutation = useMutation(
    () => axios.post(`/jobs/${jobId}/start`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['job', jobId])
        toast.success('המשימה הופעלה בהצלחה!')
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'שגיאה בהפעלת המשימה')
      }
    }
  )

  // Stop job mutation
  const stopJobMutation = useMutation(
    () => axios.post(`/jobs/${jobId}/stop`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['job', jobId])
        toast.success('המשימה הושהתה בהצלחה!')
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'שגיאה בהשהיית המשימה')
      }
    }
  )

  // Delete job mutation
  const deleteJobMutation = useMutation(
    () => axios.delete(`/jobs/${jobId}`),
    {
      onSuccess: () => {
        toast.success('המשימה נמחקה בהצלחה!')
        navigate('/jobs')
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'שגיאה במחיקת המשימה')
      }
    }
  )

  // Export logs mutation
  const exportLogsMutation = useMutation(
    () => axios.get(`/export/logs/${jobId}`).then(res => res.data),
    {
      onSuccess: (data) => {
        // Create and download file
        const blob = new Blob([JSON.stringify(data.logs, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `job-${jobId}-logs.json`
        a.click()
        URL.revokeObjectURL(url)
        toast.success('הלוגים יוצאו בהצלחה!')
      },
      onError: (error) => {
        toast.error('שגיאה ביצוא הלוגים')
      }
    }
  )

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running':
        return <PlayIcon className="h-6 w-6 text-green-500" />
      case 'completed':
        return <CheckCircleIcon className="h-6 w-6 text-blue-500" />
      case 'failed':
        return <XCircleIcon className="h-6 w-6 text-red-500" />
      case 'paused':
      case 'stopped':
        return <PauseIcon className="h-6 w-6 text-yellow-500" />
      case 'pending':
        return <ClockIcon className="h-6 w-6 text-slate-400" />
      default:
        return <ExclamationTriangleIcon className="h-6 w-6 text-slate-400" />
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'running':
        return 'פועל'
      case 'completed':
        return 'הושלם'
      case 'failed':
        return 'נכשל'
      case 'paused':
        return 'מושהה'
      case 'stopped':
        return 'נעצר'
      case 'pending':
        return 'ממתין'
      default:
        return 'לא ידוע'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'running':
        return 'bg-green-500/10 border-green-500/20 text-green-400'
      case 'completed':
        return 'bg-blue-500/10 border-blue-500/20 text-blue-400'
      case 'failed':
        return 'bg-red-500/10 border-red-500/20 text-red-400'
      case 'paused':
      case 'stopped':
        return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
      case 'pending':
        return 'bg-slate-500/10 border-slate-500/20 text-slate-400'
      default:
        return 'bg-slate-500/10 border-slate-500/20 text-slate-400'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="text-center py-12">
        <XCircleIcon className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">שגיאה בטעינת המשימה</h3>
        <p className="text-slate-400 mb-4">לא ניתן לטעון את פרטי המשימה</p>
        <div className="space-x-2">
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            נסה שוב
          </button>
          <button
            onClick={() => navigate('/jobs')}
            className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            חזור למשימות
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center">
          <button
            onClick={() => navigate('/jobs')}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors ml-4"
          >
            <ArrowRightIcon className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center">
              {getStatusIcon(job.status)}
              <h1 className="text-2xl font-bold text-white mr-3">{job.name}</h1>
              <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(job.status)}`}>
                {getStatusText(job.status)}
              </span>
            </div>
            {job.description && (
              <p className="text-slate-400 mt-1">{job.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => exportLogsMutation.mutate()}
            disabled={exportLogsMutation.isLoading}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            title="יצא לוגים"
          >
            <DocumentArrowDownIcon className="h-5 w-5" />
          </button>

          {job.status === 'pending' || job.status === 'stopped' || job.status === 'paused' ? (
            <button
              onClick={() => startJobMutation.mutate()}
              disabled={startJobMutation.isLoading}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <PlayIcon className="h-4 w-4 ml-2" />
              הפעל
            </button>
          ) : job.status === 'running' ? (
            <button
              onClick={() => stopJobMutation.mutate()}
              disabled={stopJobMutation.isLoading}
              className="flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            >
              <StopIcon className="h-4 w-4 ml-2" />
              עצור
            </button>
          ) : null}

          <button
            onClick={() => deleteJobMutation.mutate()}
            disabled={deleteJobMutation.isLoading}
            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <TrashIcon className="h-4 w-4 ml-2" />
            מחק
          </button>
        </div>
      </motion.div>

      {/* Progress Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-slate-800/50 border border-slate-700 rounded-lg p-6"
      >
        <h2 className="text-lg font-semibold text-white mb-4">התקדמות</h2>
        
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-400">השלמה כללית</span>
              <span className="text-lg font-semibold text-white">
                {Math.round(job.progress?.completion_percentage || 0)}%
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3">
              <div
                className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${job.progress?.completion_percentage || 0}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">
                {job.progress?.total_messages || 0}
              </p>
              <p className="text-xs text-slate-400">סה"כ הודעות</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-500">
                {job.progress?.successful_messages || 0}
              </p>
              <p className="text-xs text-slate-400">הועברו בהצלחה</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-500">
                {job.progress?.failed_messages || 0}
              </p>
              <p className="text-xs text-slate-400">נכשלו</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-500">
                {job.progress?.skipped_messages || 0}
              </p>
              <p className="text-xs text-slate-400">דולגו</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Job Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-800/50 border border-slate-700 rounded-lg p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">הגדרות המשימה</h3>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-400">ערוץ מקור:</span>
              <span className="text-white font-medium">
                {job.source_channel?.title || 'לא ידוע'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">ערוץ יעד:</span>
              <span className="text-white font-medium">
                {job.target_channel?.title || 'לא ידוע'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">סוגי קבצים:</span>
              <span className="text-white">
                {job.config?.file_types?.join(', ') || 'טקסט בלבד'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">השהיה בין הודעות:</span>
              <span className="text-white">
                {job.config?.delay_between_messages || 2} שניות
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">מקסימום לדקה:</span>
              <span className="text-white">
                {job.config?.max_messages_per_minute || 20} הודעות
              </span>
            </div>
          </div>
        </motion.div>

        {/* Statistics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-800/50 border border-slate-700 rounded-lg p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">סטטיסטיקות</h3>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-400">נוצר:</span>
              <span className="text-white">
                {new Date(job.created_at).toLocaleString('he-IL')}
              </span>
            </div>
            {job.started_at && (
              <div className="flex justify-between">
                <span className="text-slate-400">התחיל:</span>
                <span className="text-white">
                  {new Date(job.started_at).toLocaleString('he-IL')}
                </span>
              </div>
            )}
            {job.completed_at && (
              <div className="flex justify-between">
                <span className="text-slate-400">הסתיים:</span>
                <span className="text-white">
                  {new Date(job.completed_at).toLocaleString('he-IL')}
                </span>
              </div>
            )}
            {stats?.stats && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-400">קצב העברה:</span>
                  <span className="text-white">
                    {Math.round(stats.stats.messages_per_minute || 0)} הודעות/דקה
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">זמן עיבוד ממוצע:</span>
                  <span className="text-white">
                    {Math.round(stats.stats.average_processing_time || 0)}ms
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">שיעור שגיאות:</span>
                  <span className="text-white">
                    {Math.round((stats.stats.error_rate || 0) * 100)}%
                  </span>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>

      {/* Error Message */}
      {job.error_message && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-red-500/10 border border-red-500/20 rounded-lg p-4"
        >
          <div className="flex items-center">
            <XCircleIcon className="h-5 w-5 text-red-500 ml-2" />
            <div>
              <h4 className="text-white font-medium">שגיאה במשימה</h4>
              <p className="text-red-400 text-sm mt-1">{job.error_message}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-slate-800/50 border border-slate-700 rounded-lg p-6"
      >
        <h3 className="text-lg font-semibold text-white mb-4">פעילות אחרונה</h3>
        
        <div className="space-y-3">
          {job.logs && job.logs.length > 0 ? (
            job.logs.slice(-5).reverse().map((log, index) => (
              <div key={index} className="flex items-start p-3 bg-slate-700/30 rounded-lg">
                <div className={`p-1 rounded-full mt-1 ${
                  log.level === 'ERROR' ? 'bg-red-500/20' :
                  log.level === 'WARNING' ? 'bg-yellow-500/20' :
                  'bg-blue-500/20'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    log.level === 'ERROR' ? 'bg-red-500' :
                    log.level === 'WARNING' ? 'bg-yellow-500' :
                    'bg-blue-500'
                  }`} />
                </div>
                <div className="mr-3 flex-1">
                  <p className="text-sm text-white">{log.message}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(log.timestamp).toLocaleTimeString('he-IL')}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <ClockIcon className="mx-auto h-8 w-8 text-slate-400 mb-2" />
              <p className="text-slate-400">אין פעילות מוקלטת</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default JobDetail