import React, { createContext, useContext, useReducer, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001/api'

// Initial state
const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null
}

// Action types
const ActionTypes = {
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  SET_LOADING: 'SET_LOADING',
  CLEAR_ERROR: 'CLEAR_ERROR'
}

// Reducer
function authReducer(state, action) {
  switch (action.type) {
    case ActionTypes.LOGIN_START:
      return {
        ...state,
        isLoading: true,
        error: null
      }
    
    case ActionTypes.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        error: null
      }
    
    case ActionTypes.LOGIN_FAILURE:
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload
      }
    
    case ActionTypes.LOGOUT:
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      }
    
    case ActionTypes.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload
      }
    
    case ActionTypes.CLEAR_ERROR:
      return {
        ...state,
        error: null
      }
    
    default:
      return state
  }
}

// Create context
const AuthContext = createContext()

// Auth provider component
export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Configure axios defaults
  useEffect(() => {
    // Set base URL
    axios.defaults.baseURL = API_BASE_URL

    // Add request interceptor to include auth token
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        if (state.token) {
          config.headers.Authorization = `Bearer ${state.token}`
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // Add response interceptor to handle auth errors
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          logout()
          toast.error('פג תוקף ההתחברות, נא להתחבר שנית')
        }
        return Promise.reject(error)
      }
    )

    // Cleanup interceptors
    return () => {
      axios.interceptors.request.eject(requestInterceptor)
      axios.interceptors.response.eject(responseInterceptor)
    }
  }, [state.token])

  // Check for existing token on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('auth_token')
        const user = localStorage.getItem('auth_user')

        if (token && user) {
          // Verify token is still valid
          try {
            const response = await axios.get('/health', {
              headers: { Authorization: `Bearer ${token}` }
            })
            
            if (response.status === 200) {
              dispatch({
                type: ActionTypes.LOGIN_SUCCESS,
                payload: {
                  token,
                  user: JSON.parse(user)
                }
              })
            } else {
              throw new Error('Invalid token')
            }
          } catch (error) {
            // Token is invalid, clear storage
            localStorage.removeItem('auth_token')
            localStorage.removeItem('auth_user')
            dispatch({ type: ActionTypes.SET_LOADING, payload: false })
          }
        } else {
          dispatch({ type: ActionTypes.SET_LOADING, payload: false })
        }
      } catch (error) {
        console.error('Auth check error:', error)
        dispatch({ type: ActionTypes.SET_LOADING, payload: false })
      }
    }

    checkAuth()
  }, [])

  // Login function
  const login = async (credentials) => {
    try {
      dispatch({ type: ActionTypes.LOGIN_START })

      const response = await axios.post('/auth/login', credentials)
      const { access_token, token_type } = response.data

      if (!access_token) {
        throw new Error('לא התקבל טוקן מהשרת')
      }

      // Create user object (simplified for demo)
      const user = {
        username: credentials.username,
        loginTime: new Date().toISOString()
      }

      // Store in localStorage
      localStorage.setItem('auth_token', access_token)
      localStorage.setItem('auth_user', JSON.stringify(user))

      dispatch({
        type: ActionTypes.LOGIN_SUCCESS,
        payload: {
          token: access_token,
          user
        }
      })

      toast.success('התחברת בהצלחה!')
      return { success: true }

    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'שגיאה בהתחברות'
      
      dispatch({
        type: ActionTypes.LOGIN_FAILURE,
        payload: errorMessage
      })

      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  // Logout function
  const logout = () => {
    // Clear localStorage
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')

    // Clear state
    dispatch({ type: ActionTypes.LOGOUT })

    toast.success('התנתקת בהצלחה')
  }

  // Clear error function
  const clearError = () => {
    dispatch({ type: ActionTypes.CLEAR_ERROR })
  }

  // Value to be provided
  const value = {
    ...state,
    login,
    logout,
    clearError
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Export action types for testing
export { ActionTypes }