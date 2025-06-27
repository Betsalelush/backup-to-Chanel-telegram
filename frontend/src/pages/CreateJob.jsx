import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation } from 'react-query'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  ArrowRightIcon,
  MagnifyingGlassIcon,
  CheckIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../components/UI/LoadingSpinner'

const CreateJob = () => {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [jobData, setJobData] = useState({
    name: '',
    description: '',
    session_id: '',
    source_channel: '',
    target_channel: '',
    file_types: ['text_only'],
    custom_extensions: [],
    start_from_message_id: 0,
    delay_between_messages: 2.0,
    max_messages_per_minute: 20,
    schedule_enabled: false,
    schedule_cron: '',
    auto_restart: false,
    reset_progress: false,
    use_tor: false
  })

  const [channelSearch, setChannelSearch] = useState({
    source: '',
    target: ''
  })

  const [resolvedChannels, setResolvedChannels] = useState({
    source: null,
    target: null
  })

  // Fetch sessions
  const { data: sessionsData } = useQuery(
    'sessions',
    () => axios.get('/sessions').then(res => res.data)
  )

  const sessions = sessionsData?.sessions?.filter(s => s.status === 'authenticated') || []

  // Fetch channels for selected session
  const { data: channelsData, isLoading: channelsLoading } = useQuery(
    ['channels', jobData.session_id],
    () => axios.get(`/channels/${jobData.session_id}`).then(res => res.data),
    { enabled: !!jobData.session_id }
  )

  const channels = channelsData?.channels || []

  // Resolve channel mutation
  const resolveChannelMutation = useMutation(
    ({ sessionId, channelIdentifier, type }) =>
      axios.post('/channels/resolve', {
        session_id: sessionId,
        channel_identifier: channelIdentifier
      }),
    {
      onSuccess: (response, variables) => {
        setResolvedChannels(prev => ({
          ...prev,
          [variables.type]: response.data
        }))
        toast.success('הערוץ נמצא בהצלחה!')
      },
      onError: (error, variables) => {
        toast.error(`שגיאה בחיפוש ערוץ ${variables.type === 'source' ? 'מקור' : 'יעד'}`)
      }
    }
  )

  // Create job mutation
  const createJobMutation = useMutation(
    (data) => axios.post('/jobs/create', data),
    {
      onSuccess: () => {
        toast.success('המשימה נוצרה בהצלחה!')
        navigate('/jobs')
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'שגיאה ביצירת המשימה')
      }
    }
  )

  const handleChannelResolve = (type) => {
    const identifier = channelSearch[type]
    if (!identifier || !jobData.session_id) return

    resolveChannelMutation.mutate({
      sessionId: jobData.session_id,
      channelIdentifier: identifier,
      type
    })
  }

  const handleChannelSelect = (channel, type) => {
    setResolvedChannels(prev => ({
      ...prev,
      [type]: channel
    }))
    setJobData(prev => ({
      ...prev,
      [`${type}_channel`]: channel.username || channel.id.toString()
    }))
  }

  const handleSubmit = () => {
    if (!jobData.name || !jobData.session_id || !resolvedChannels.source || !resolvedChannels.target) {
      toast.error('נא למלא את כל השדות הנדרשים')
      return
    }

    createJobMutation.mutate({
      ...jobData,
      source_channel: resolvedChannels.source.username || resolvedChannels.source.id.toString(),
      target_channel: resolvedChannels.target.username || resolvedChannels.target.id.toString()
    })
  }

  const steps = [
    { id: 1, name: 'פרטים בסיסיים', description: 'שם ותיאור המשימה' },
    { id: 2, name: 'בחירת סשן', description: 'בחירת חיבור טלגרם' },
    { id: 3, name: 'ערוצי מקור ויעד', description: 'בחירת ערוצים להעברה' },
    { id: 4, name: 'הגדרות מתקדמות', description: 'הגדרות נוספות' },
    { id: 5, name: 'סיכום', description: 'סקירה ויצירה' }
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center"
      >
        <button
          onClick={() => navigate('/jobs')}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors ml-4"
        >
          <ArrowRightIcon className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">צור משימת העברה חדשה</h1>
          <p className="text-slate-400">הגדר משימה חדשה להעברת הודעות בין ערוצי טלגרם</p>
        </div>
      </motion.div>

      {/* Steps */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-8">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                step.id === currentStep
                  ? 'bg-blue-600 text-white'
                  : step.id < currentStep
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-600 text-slate-400'
              }`}>
                {step.id < currentStep ? (
                  <CheckIcon className="h-4 w-4" />
                ) : (
                  step.id
                )}
              </div>
              {index < steps.length - 1 && (
                <div className={`w-12 h-0.5 mx-4 ${
                  step.id < currentStep ? 'bg-green-600' : 'bg-slate-600'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white mb-4">פרטים בסיסיים</h3>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  שם המשימה *
                </label>
                <input
                  type="text"
                  value={jobData.name}
                  onChange={(e) => setJobData({...jobData, name: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="הכנס שם המשימה"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  תיאור (אופציונלי)
                </label>
                <textarea
                  value={jobData.description}
                  onChange={(e) => setJobData({...jobData, description: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="הכנס תיאור המשימה"
                />
              </div>
            </div>
          )}

          {/* Step 2: Session Selection */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white mb-4">בחירת סשן טלגרם</h3>
              
              {sessions.length === 0 ? (
                <div className="text-center py-8">
                  <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
                  <h4 className="text-lg font-medium text-white mb-2">אין סשנים זמינים</h4>
                  <p className="text-slate-400 mb-4">צור סשן מחובר כדי להמשיך</p>
                  <button
                    onClick={() => navigate('/sessions')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    עבור לסשנים
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => setJobData({...jobData, session_id: session.id})}
                      className={`p-4 rounded-lg border-2 transition-colors text-right ${
                        jobData.session_id === session.id
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-white">
                            {session.phone || `סשן ${session.id.slice(0, 8)}`}
                          </p>
                          <p className="text-sm text-slate-400">
                            {new Date(session.created_at).toLocaleDateString('he-IL')}
                          </p>
                        </div>
                        {jobData.session_id === session.id && (
                          <CheckIcon className="h-5 w-5 text-blue-500" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Channel Selection */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-white mb-4">בחירת ערוצים</h3>
              
              {/* Source Channel */}
              <div>
                <h4 className="text-md font-medium text-white mb-3">ערוץ מקור</h4>
                <div className="flex space-x-2 mb-3">
                  <input
                    type="text"
                    value={channelSearch.source}
                    onChange={(e) => setChannelSearch({...channelSearch, source: e.target.value})}
                    className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="שם משתמש או ID של הערוץ"
                  />
                  <button
                    onClick={() => handleChannelResolve('source')}
                    disabled={!channelSearch.source || !jobData.session_id}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <MagnifyingGlassIcon className="h-4 w-4" />
                  </button>
                </div>
                
                {resolvedChannels.source && (
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <div className="flex items-center">
                      <CheckIcon className="h-5 w-5 text-green-500 ml-2" />
                      <div>
                        <p className="text-white font-medium">{resolvedChannels.source.title}</p>
                        <p className="text-sm text-slate-400">
                          {resolvedChannels.source.username && `@${resolvedChannels.source.username}`}
                          {resolvedChannels.source.member_count && ` • ${resolvedChannels.source.member_count} חברים`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {channels.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-slate-400 mb-2">או בחר מהרשימה:</p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {channels.filter(c => c.type === 'channel').map((channel) => (
                        <button
                          key={channel.id}
                          onClick={() => handleChannelSelect(channel, 'source')}
                          className="w-full text-right p-2 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <p className="text-white text-sm">{channel.title}</p>
                          <p className="text-slate-400 text-xs">{channel.username && `@${channel.username}`}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Target Channel */}
              <div>
                <h4 className="text-md font-medium text-white mb-3">ערוץ יעד</h4>
                <div className="flex space-x-2 mb-3">
                  <input
                    type="text"
                    value={channelSearch.target}
                    onChange={(e) => setChannelSearch({...channelSearch, target: e.target.value})}
                    className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="שם משתמש או ID של הערוץ"
                  />
                  <button
                    onClick={() => handleChannelResolve('target')}
                    disabled={!channelSearch.target || !jobData.session_id}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <MagnifyingGlassIcon className="h-4 w-4" />
                  </button>
                </div>
                
                {resolvedChannels.target && (
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <div className="flex items-center">
                      <CheckIcon className="h-5 w-5 text-green-500 ml-2" />
                      <div>
                        <p className="text-white font-medium">{resolvedChannels.target.title}</p>
                        <p className="text-sm text-slate-400">
                          {resolvedChannels.target.username && `@${resolvedChannels.target.username}`}
                          {resolvedChannels.target.member_count && ` • ${resolvedChannels.target.member_count} חברים`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {channels.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-slate-400 mb-2">או בחר מהרשימה:</p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {channels.filter(c => c.type === 'channel').map((channel) => (
                        <button
                          key={channel.id}
                          onClick={() => handleChannelSelect(channel, 'target')}
                          className="w-full text-right p-2 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <p className="text-white text-sm">{channel.title}</p>
                          <p className="text-slate-400 text-xs">{channel.username && `@${channel.username}`}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Advanced Settings */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-white mb-4">הגדרות מתקדמות</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    השהיה בין הודעות (שניות)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={jobData.delay_between_messages}
                    onChange={(e) => setJobData({...jobData, delay_between_messages: parseFloat(e.target.value)})}
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
                    value={jobData.max_messages_per_minute}
                    onChange={(e) => setJobData({...jobData, max_messages_per_minute: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  סוגי קבצים להעברה
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'text_only', label: 'טקסט בלבד' },
                    { value: 'all_media', label: 'כל סוגי המדיה' },
                    { value: 'images', label: 'תמונות בלבד' },
                    { value: 'videos', label: 'סרטונים בלבד' },
                    { value: 'documents', label: 'מסמכים בלבד' }
                  ].map((type) => (
                    <label key={type.value} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={jobData.file_types.includes(type.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setJobData({
                              ...jobData,
                              file_types: [...jobData.file_types, type.value]
                            })
                          } else {
                            setJobData({
                              ...jobData,
                              file_types: jobData.file_types.filter(t => t !== type.value)
                            })
                          }
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 bg-slate-700 border-slate-600 rounded"
                      />
                      <span className="mr-2 text-sm text-slate-300">{type.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Summary */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-white mb-4">סיכום המשימה</h3>
              
              <div className="bg-slate-700/50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">שם המשימה:</span>
                  <span className="text-white font-medium">{jobData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">ערוץ מקור:</span>
                  <span className="text-white">{resolvedChannels.source?.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">ערוץ יעד:</span>
                  <span className="text-white">{resolvedChannels.target?.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">סוגי קבצים:</span>
                  <span className="text-white">{jobData.file_types.join(', ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">השהיה בין הודעות:</span>
                  <span className="text-white">{jobData.delay_between_messages} שניות</span>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <button
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            הקודם
          </button>
          
          {currentStep < 5 ? (
            <button
              onClick={() => {
                if (currentStep === 1 && !jobData.name) {
                  toast.error('נא להכניס שם למשימה')
                  return
                }
                if (currentStep === 2 && !jobData.session_id) {
                  toast.error('נא לבחור סשן')
                  return
                }
                if (currentStep === 3 && (!resolvedChannels.source || !resolvedChannels.target)) {
                  toast.error('נא לבחור ערוצי מקור ויעד')
                  return
                }
                setCurrentStep(currentStep + 1)
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              הבא
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={createJobMutation.isLoading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
            >
              {createJobMutation.isLoading ? (
                <LoadingSpinner size="small" color="white" className="ml-2" />
              ) : null}
              צור משימה
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default CreateJob