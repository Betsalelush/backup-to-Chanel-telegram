import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { Link } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  TrashIcon,
  EyeIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../components/UI/LoadingSpinner'

const Jobs = () => {
  const queryClient = useQueryClient()

  // Fetch jobs
  const { data: jobsData, isLoading, error, refetch } = useQuery(
    'jobs',
    () => axios.get('/jobs').then(res => res.data),
    { refetchInterval: 15000 }
  )

  const jobs = jobsData?.jobs || []

  // Start job mutation
  const startJobMutation = useMutation(
    (jobId) => axios.post(`/jobs/${jobId}/start`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('jobs')
        toast.success('המשימה הופעלה בהצלחה!')
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'שגיאה בהפעלת המשימה')
      }
    }
  )

  // Stop job mutation
  const stopJobMutation = useMutation(
    (jobId) => axios.post(`/jobs/${jobId}/stop`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('jobs')
        toast.success('המשימה הושהתה בהצלחה!')
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'שגיאה בהשהיית המשימה')
      }
    }
  )

  // Delete job mutation
  const deleteJobMutation = useMutation(
    (jobId) => axios.delete(`/jobs/${jobId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('jobs')
        toast.success('המשימה נמחקה בהצלחה!')
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'שגיאה במחיקת המשימה')
      }
    }
  )

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running':
        return <PlayIcon className="h-5 w-5 text-green-500" />
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-blue-500" />
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />
      case 'paused':
      case 'stopped':
        return <PauseIcon className="h-5 w-5 text-yellow-500" />
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-slate-400" />
      default:
        return <BriefcaseIcon className="h-5 w-5 text-slate-400" />
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">משימות העברה</h1>
          <p className="text-slate-400">ניהול משימות העברת הודעות</p>
        </div>
        <Link
          to="/jobs/create"
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4 ml-2" />
          משימה חדשה
        </Link>
      </motion.div>

      {/* Jobs Grid */}
      {error ? (
        <div className="text-center py-12">
          <XCircleIcon className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">שגיאה בטעינת המשימות</h3>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            נסה שוב
          </button>
        </div>
      ) : jobs.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12 bg-slate-800/50 border border-slate-700 rounded-lg"
        >
          <BriefcaseIcon className="mx-auto h-12 w-12 text-slate-400 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">אין משימות</h3>
          <p className="text-slate-400 mb-4">צור משימת העברה ראשונה כדי להתחיל</p>
          <Link
            to="/jobs/create"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4 ml-2" />
            צור משימה חדשה
          </Link>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job, index) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-slate-800/50 border border-slate-700 rounded-lg p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  {getStatusIcon(job.status)}
                  <div className="mr-3">
                    <h3 className="text-lg font-semibold text-white">{job.name}</h3>
                    {job.description && (
                      <p className="text-sm text-slate-400">{job.description}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(job.status)}`}>
                    {getStatusText(job.status)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs text-slate-400">ערוץ מקור</p>
                  <p className="text-sm text-white font-medium">
                    {job.source_channel?.title || 'לא ידוע'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">ערוץ יעד</p>
                  <p className="text-sm text-white font-medium">
                    {job.target_channel?.title || 'לא ידוע'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">התקדמות</p>
                  <div className="flex items-center">
                    <div className="flex-1 bg-slate-700 rounded-full h-2 ml-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${job.progress?.completion_percentage || 0}%` }}
                      />
                    </div>
                    <span className="text-sm text-white">
                      {Math.round(job.progress?.completion_percentage || 0)}%
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-400">הודעות הועברו</p>
                  <p className="text-sm text-white font-medium">
                    {job.progress?.successful_messages || 0} / {job.progress?.total_messages || 0}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400">
                  נוצר: {new Date(job.created_at).toLocaleDateString('he-IL')}
                  {job.updated_at && (
                    <span className="mr-4">
                      עודכן: {new Date(job.updated_at).toLocaleDateString('he-IL')}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  <Link
                    to={`/jobs/${job.id}`}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                    title="צפה בפרטים"
                  >
                    <EyeIcon className="h-4 w-4" />
                  </Link>
                  
                  {job.status === 'pending' || job.status === 'stopped' || job.status === 'paused' ? (
                    <button
                      onClick={() => startJobMutation.mutate(job.id)}
                      disabled={startJobMutation.isLoading}
                      className="p-2 text-green-400 hover:text-green-300 hover:bg-slate-700 rounded-lg transition-colors"
                      title="הפעל משימה"
                    >
                      <PlayIcon className="h-4 w-4" />
                    </button>
                  ) : job.status === 'running' ? (
                    <button
                      onClick={() => stopJobMutation.mutate(job.id)}
                      disabled={stopJobMutation.isLoading}
                      className="p-2 text-yellow-400 hover:text-yellow-300 hover:bg-slate-700 rounded-lg transition-colors"
                      title="עצור משימה"
                    >
                      <StopIcon className="h-4 w-4" />
                    </button>
                  ) : null}
                  
                  <button
                    onClick={() => deleteJobMutation.mutate(job.id)}
                    disabled={deleteJobMutation.isLoading}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-slate-700 rounded-lg transition-colors"
                    title="מחק משימה"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Jobs