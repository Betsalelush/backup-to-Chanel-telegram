import React from 'react'
import { motion } from 'framer-motion'
import { 
  ExclamationTriangleIcon,
  ArrowPathIcon,
  HomeIcon
} from '@heroicons/react/24/outline'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    })
    
    // Log error to monitoring service
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-md w-full text-center"
          >
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 shadow-xl">
              {/* Error icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="w-16 h-16 bg-red-500 bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <ExclamationTriangleIcon className="w-8 h-8 text-red-500" />
              </motion.div>

              {/* Error message */}
              <h1 className="text-2xl font-bold text-white mb-4">
                אופס! משהו השתבש
              </h1>
              
              <p className="text-slate-400 mb-6">
                אירעה שגיאה לא צפויה במערכת. אנא נסה לרענן את הדף או לחזור לעמוד הבית.
              </p>

              {/* Error details (only in development) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ delay: 0.3 }}
                  className="mb-6 text-right"
                >
                  <details className="bg-slate-700 rounded-lg p-4">
                    <summary className="text-sm font-medium text-slate-300 cursor-pointer mb-2">
                      פרטי השגיאה (למפתחים)
                    </summary>
                    <div className="text-xs text-red-400 font-mono whitespace-pre-wrap">
                      {this.state.error.toString()}
                      {this.state.errorInfo.componentStack}
                    </div>
                  </details>
                </motion.div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={this.handleReload}
                  className="flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  <ArrowPathIcon className="w-4 h-4 mr-2" />
                  רענן דף
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={this.handleGoHome}
                  className="flex items-center justify-center px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
                >
                  <HomeIcon className="w-4 h-4 mr-2" />
                  חזור לבית
                </motion.button>
              </div>

              {/* Support information */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-6 pt-6 border-t border-slate-600"
              >
                <p className="text-xs text-slate-500">
                  אם הבעיה נמשכת, אנא צור קשר עם התמיכה הטכנית
                </p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary