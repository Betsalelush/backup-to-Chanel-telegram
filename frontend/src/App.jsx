import React, { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

import { useAuth } from './contexts/AuthContext'
import { useWebSocket } from './contexts/WebSocketContext'

// Layout components
import Layout from './components/Layout/Layout'
import Sidebar from './components/Layout/Sidebar'
import Header from './components/Layout/Header'

// Page components
import Dashboard from './pages/Dashboard'
import Sessions from './pages/Sessions'
import Jobs from './pages/Jobs'
import CreateJob from './pages/CreateJob'
import JobDetail from './pages/JobDetail'
import Settings from './pages/Settings'
import Login from './pages/Login'

// Loading components
import LoadingSpinner from './components/UI/LoadingSpinner'
import ErrorBoundary from './components/ErrorBoundary'

// Lazy load pages for better performance
const LazyDashboard = React.lazy(() => import('./pages/Dashboard'))
const LazySessions = React.lazy(() => import('./pages/Sessions'))
const LazyJobs = React.lazy(() => import('./pages/Jobs'))
const LazyCreateJob = React.lazy(() => import('./pages/CreateJob'))
const LazyJobDetail = React.lazy(() => import('./pages/JobDetail'))
const LazySettings = React.lazy(() => import('./pages/Settings'))

// Page transition variants
const pageVariants = {
  initial: { opacity: 0, x: 20 },
  in: { opacity: 1, x: 0 },
  out: { opacity: 0, x: -20 }
}

const pageTransition = {
  type: 'tween',
  ease: 'anticipate',
  duration: 0.3
}

function App() {
  const { isAuthenticated, isLoading } = useAuth()
  const { connectionStatus, lastMessage } = useWebSocket()

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-slate-400">טוען מערכת ניהול טלגרם...</p>
        </div>
      </div>
    )
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900">
        <Login />
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-900 text-slate-100" dir="rtl">
        <Layout>
          {/* Sidebar */}
          <Sidebar />
          
          {/* Main content area */}
          <div className="flex-1 flex flex-col lg:pr-64">
            {/* Header */}
            <Header connectionStatus={connectionStatus} />
            
            {/* Page content */}
            <main className="flex-1 overflow-auto">
              <div className="container mx-auto px-4 py-6 max-w-7xl">
                <AnimatePresence mode="wait">
                  <Suspense 
                    fallback={
                      <div className="flex items-center justify-center py-12">
                        <LoadingSpinner />
                      </div>
                    }
                  >
                    <Routes>
                      <Route 
                        path="/" 
                        element={
                          <motion.div
                            key="dashboard"
                            initial="initial"
                            animate="in"
                            exit="out"
                            variants={pageVariants}
                            transition={pageTransition}
                          >
                            <LazyDashboard />
                          </motion.div>
                        } 
                      />
                      
                      <Route 
                        path="/sessions" 
                        element={
                          <motion.div
                            key="sessions"
                            initial="initial"
                            animate="in"
                            exit="out"
                            variants={pageVariants}
                            transition={pageTransition}
                          >
                            <LazySessions />
                          </motion.div>
                        } 
                      />
                      
                      <Route 
                        path="/jobs" 
                        element={
                          <motion.div
                            key="jobs"
                            initial="initial"
                            animate="in"
                            exit="out"
                            variants={pageVariants}
                            transition={pageTransition}
                          >
                            <LazyJobs />
                          </motion.div>
                        } 
                      />
                      
                      <Route 
                        path="/jobs/create" 
                        element={
                          <motion.div
                            key="create-job"
                            initial="initial"
                            animate="in"
                            exit="out"
                            variants={pageVariants}
                            transition={pageTransition}
                          >
                            <LazyCreateJob />
                          </motion.div>
                        } 
                      />
                      
                      <Route 
                        path="/jobs/:jobId" 
                        element={
                          <motion.div
                            key="job-detail"
                            initial="initial"
                            animate="in"
                            exit="out"
                            variants={pageVariants}
                            transition={pageTransition}
                          >
                            <LazyJobDetail />
                          </motion.div>
                        } 
                      />
                      
                      <Route 
                        path="/settings" 
                        element={
                          <motion.div
                            key="settings"
                            initial="initial"
                            animate="in"
                            exit="out"
                            variants={pageVariants}
                            transition={pageTransition}
                          >
                            <LazySettings />
                          </motion.div>
                        } 
                      />
                      
                      {/* Redirect unknown routes to dashboard */}
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Suspense>
                </AnimatePresence>
              </div>
            </main>
          </div>
        </Layout>
        
        {/* Global notifications area */}
        <div id="notifications-portal" className="fixed top-4 left-4 z-50 space-y-2">
          {/* Notifications will be rendered here */}
        </div>
        
        {/* Connection status indicator */}
        {connectionStatus !== 'connected' && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-4 left-4 bg-yellow-600 text-white px-4 py-2 rounded-lg shadow-lg z-50"
          >
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-yellow-300 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">
                {connectionStatus === 'connecting' && 'מתחבר לשרת...'}
                {connectionStatus === 'disconnected' && 'אין חיבור לשרת'}
                {connectionStatus === 'error' && 'שגיאה בחיבור'}
              </span>
            </div>
          </motion.div>
        )}
        
        {/* Debug info in development */}
        {import.meta.env.DEV && (
          <div className="fixed bottom-4 right-4 bg-slate-800 text-slate-300 p-2 rounded text-xs font-mono z-40">
            <div>Status: {connectionStatus}</div>
            {lastMessage && (
              <div>Last: {new Date(lastMessage.timestamp).toLocaleTimeString()}</div>
            )}
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}

export default App