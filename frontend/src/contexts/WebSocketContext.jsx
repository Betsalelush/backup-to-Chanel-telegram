import React, { createContext, useContext, useEffect, useReducer, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from './AuthContext'

const WS_URL = import.meta.env.REACT_APP_BACKEND_URL?.replace('https://', 'wss://').replace('http://', 'ws://') + '/api/ws' || import.meta.env.VITE_WS_URL || 'ws://localhost:8001/api/ws'

// Initial state
const initialState = {
  connectionStatus: 'disconnected', // disconnected, connecting, connected, error
  lastMessage: null,
  messageHistory: [],
  error: null,
  reconnectAttempt: 0,
  maxReconnectAttempts: 5
}

// Action types
const ActionTypes = {
  CONNECTION_CONNECTING: 'CONNECTION_CONNECTING',
  CONNECTION_CONNECTED: 'CONNECTION_CONNECTED',
  CONNECTION_DISCONNECTED: 'CONNECTION_DISCONNECTED',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  MESSAGE_RECEIVED: 'MESSAGE_RECEIVED',
  CLEAR_MESSAGES: 'CLEAR_MESSAGES',
  SET_RECONNECT_ATTEMPT: 'SET_RECONNECT_ATTEMPT'
}

// Reducer
function webSocketReducer(state, action) {
  switch (action.type) {
    case ActionTypes.CONNECTION_CONNECTING:
      return {
        ...state,
        connectionStatus: 'connecting',
        error: null
      }
    
    case ActionTypes.CONNECTION_CONNECTED:
      return {
        ...state,
        connectionStatus: 'connected',
        error: null,
        reconnectAttempt: 0
      }
    
    case ActionTypes.CONNECTION_DISCONNECTED:
      return {
        ...state,
        connectionStatus: 'disconnected',
        error: action.payload || null
      }
    
    case ActionTypes.CONNECTION_ERROR:
      return {
        ...state,
        connectionStatus: 'error',
        error: action.payload
      }
    
    case ActionTypes.MESSAGE_RECEIVED:
      return {
        ...state,
        lastMessage: action.payload,
        messageHistory: [action.payload, ...state.messageHistory].slice(0, 100) // Keep last 100 messages
      }
    
    case ActionTypes.CLEAR_MESSAGES:
      return {
        ...state,
        messageHistory: [],
        lastMessage: null
      }
    
    case ActionTypes.SET_RECONNECT_ATTEMPT:
      return {
        ...state,
        reconnectAttempt: action.payload
      }
    
    default:
      return state
  }
}

// Create context
const WebSocketContext = createContext()

// WebSocket provider component
export function WebSocketProvider({ children }) {
  const [state, dispatch] = useReducer(webSocketReducer, initialState)
  const { isAuthenticated, token } = useAuth()
  const wsRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const heartbeatIntervalRef = useRef(null)

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!isAuthenticated || !token) {
      return
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    try {
      dispatch({ type: ActionTypes.CONNECTION_CONNECTING })

      // Create WebSocket connection
      wsRef.current = new WebSocket(WS_URL)

      wsRef.current.onopen = () => {
        console.log('WebSocket connected')
        dispatch({ type: ActionTypes.CONNECTION_CONNECTED })

        // Start heartbeat
        startHeartbeat()

        // Send authentication if needed
        if (token) {
          wsRef.current.send(JSON.stringify({
            type: 'auth',
            token: token
          }))
        }
      }

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          
          // Handle different message types
          handleMessage(message)
          
          dispatch({
            type: ActionTypes.MESSAGE_RECEIVED,
            payload: message
          })
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason)
        
        dispatch({
          type: ActionTypes.CONNECTION_DISCONNECTED,
          payload: event.reason
        })

        stopHeartbeat()

        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && state.reconnectAttempt < state.maxReconnectAttempts) {
          scheduleReconnect()
        }
      }

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error)
        
        dispatch({
          type: ActionTypes.CONNECTION_ERROR,
          payload: 'שגיאה בחיבור WebSocket'
        })
      }

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      dispatch({
        type: ActionTypes.CONNECTION_ERROR,
        payload: 'נכשל ביצירת חיבור WebSocket'
      })
    }
  }, [isAuthenticated, token, state.reconnectAttempt, state.maxReconnectAttempts])

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    stopHeartbeat()

    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect')
      wsRef.current = null
    }

    dispatch({ type: ActionTypes.CONNECTION_DISCONNECTED })
  }, [])

  // Schedule reconnection
  const scheduleReconnect = useCallback(() => {
    const attempt = state.reconnectAttempt + 1
    const delay = Math.min(1000 * Math.pow(2, attempt), 30000) // Exponential backoff, max 30s

    dispatch({ type: ActionTypes.SET_RECONNECT_ATTEMPT, payload: attempt })

    reconnectTimeoutRef.current = setTimeout(() => {
      console.log(`Attempting to reconnect... (${attempt}/${state.maxReconnectAttempts})`)
      connect()
    }, delay)
  }, [state.reconnectAttempt, state.maxReconnectAttempts, connect])

  // Start heartbeat to keep connection alive
  const startHeartbeat = useCallback(() => {
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000) // Ping every 30 seconds
  }, [])

  // Stop heartbeat
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }
  }, [])

  // Handle incoming messages
  const handleMessage = useCallback((message) => {
    const { type, data } = message

    switch (type) {
      case 'job_status_update':
        toast.success(`מצב משימה עודכן: ${data.status}`)
        break

      case 'job_progress_update':
        // Progress updates are handled by individual components
        break

      case 'session_status_update':
        if (data.status === 'authenticated') {
          toast.success(`חשבון ${data.phone} אומת בהצלחה`)
        } else if (data.status === 'failed') {
          toast.error(`אימות חשבון נכשל: ${data.error}`)
        }
        break

      case 'system_notification':
        const { level, message: notificationMessage } = data
        
        if (level === 'success') {
          toast.success(notificationMessage)
        } else if (level === 'error') {
          toast.error(notificationMessage)
        } else if (level === 'warning') {
          toast.error(notificationMessage, { icon: '⚠️' })
        } else {
          toast(notificationMessage)
        }
        break

      case 'error_notification':
        toast.error(data.message)
        break

      case 'connection_established':
        console.log('WebSocket connection established')
        break

      case 'ping':
        // Respond to ping with pong
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'pong' }))
        }
        break

      default:
        console.log('Unknown WebSocket message type:', type)
    }
  }, [])

  // Send message
  const sendMessage = useCallback((message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
      return true
    }
    return false
  }, [])

  // Clear message history
  const clearMessages = useCallback(() => {
    dispatch({ type: ActionTypes.CLEAR_MESSAGES })
  }, [])

  // Connect when authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      connect()
    } else {
      disconnect()
    }

    // Cleanup on unmount
    return () => {
      disconnect()
    }
  }, [isAuthenticated, token, connect, disconnect])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      stopHeartbeat()
    }
  }, [stopHeartbeat])

  // Value to be provided
  const value = {
    ...state,
    connect,
    disconnect,
    sendMessage,
    clearMessages
  }

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  )
}

// Hook to use WebSocket context
export function useWebSocket() {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}

// Export action types for testing
export { ActionTypes }