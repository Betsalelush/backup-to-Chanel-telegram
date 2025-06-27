import React, { createContext, useContext, useReducer, useEffect } from 'react'

// Initial state
const initialState = {
  theme: 'dark', // Only dark theme for now, but prepared for future themes
  fontSize: 'medium', // small, medium, large
  language: 'he', // he, en
  rtl: true,
  animations: true,
  compactMode: false,
  preferences: {
    showNotifications: true,
    autoRefresh: true,
    soundEnabled: false,
    highContrast: false
  }
}

// Action types
const ActionTypes = {
  SET_THEME: 'SET_THEME',
  SET_FONT_SIZE: 'SET_FONT_SIZE',
  SET_LANGUAGE: 'SET_LANGUAGE',
  TOGGLE_ANIMATIONS: 'TOGGLE_ANIMATIONS',
  TOGGLE_COMPACT_MODE: 'TOGGLE_COMPACT_MODE',
  UPDATE_PREFERENCES: 'UPDATE_PREFERENCES',
  RESET_SETTINGS: 'RESET_SETTINGS'
}

// Reducer
function themeReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_THEME:
      return {
        ...state,
        theme: action.payload
      }
    
    case ActionTypes.SET_FONT_SIZE:
      return {
        ...state,
        fontSize: action.payload
      }
    
    case ActionTypes.SET_LANGUAGE:
      return {
        ...state,
        language: action.payload,
        rtl: action.payload === 'he'
      }
    
    case ActionTypes.TOGGLE_ANIMATIONS:
      return {
        ...state,
        animations: !state.animations
      }
    
    case ActionTypes.TOGGLE_COMPACT_MODE:
      return {
        ...state,
        compactMode: !state.compactMode
      }
    
    case ActionTypes.UPDATE_PREFERENCES:
      return {
        ...state,
        preferences: {
          ...state.preferences,
          ...action.payload
        }
      }
    
    case ActionTypes.RESET_SETTINGS:
      return initialState
    
    default:
      return state
  }
}

// Create context
const ThemeContext = createContext()

// Theme provider component
export function ThemeProvider({ children }) {
  const [state, dispatch] = useReducer(themeReducer, initialState)

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('theme_settings')
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings)
        
        // Apply each setting
        Object.entries(parsed).forEach(([key, value]) => {
          switch (key) {
            case 'theme':
              dispatch({ type: ActionTypes.SET_THEME, payload: value })
              break
            case 'fontSize':
              dispatch({ type: ActionTypes.SET_FONT_SIZE, payload: value })
              break
            case 'language':
              dispatch({ type: ActionTypes.SET_LANGUAGE, payload: value })
              break
            case 'animations':
              if (value !== state.animations) {
                dispatch({ type: ActionTypes.TOGGLE_ANIMATIONS })
              }
              break
            case 'compactMode':
              if (value !== state.compactMode) {
                dispatch({ type: ActionTypes.TOGGLE_COMPACT_MODE })
              }
              break
            case 'preferences':
              dispatch({ type: ActionTypes.UPDATE_PREFERENCES, payload: value })
              break
          }
        })
      }
    } catch (error) {
      console.error('Failed to load theme settings:', error)
    }
  }, [])

  // Save settings to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem('theme_settings', JSON.stringify(state))
    } catch (error) {
      console.error('Failed to save theme settings:', error)
    }
  }, [state])

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement
    
    // Set theme class
    root.className = `${state.theme} ${state.fontSize}-font`
    
    // Set direction
    document.dir = state.rtl ? 'rtl' : 'ltr'
    document.documentElement.lang = state.language
    
    // Set font size CSS variable
    const fontSizes = {
      small: '14px',
      medium: '16px',
      large: '18px'
    }
    root.style.setProperty('--base-font-size', fontSizes[state.fontSize])
    
    // Handle animations
    if (!state.animations) {
      root.style.setProperty('--animation-duration', '0ms')
    } else {
      root.style.removeProperty('--animation-duration')
    }
    
    // Handle compact mode
    if (state.compactMode) {
      root.classList.add('compact-mode')
    } else {
      root.classList.remove('compact-mode')
    }
    
    // Handle high contrast
    if (state.preferences.highContrast) {
      root.classList.add('high-contrast')
    } else {
      root.classList.remove('high-contrast')
    }
    
  }, [state])

  // Action creators
  const setTheme = (theme) => {
    dispatch({ type: ActionTypes.SET_THEME, payload: theme })
  }

  const setFontSize = (fontSize) => {
    dispatch({ type: ActionTypes.SET_FONT_SIZE, payload: fontSize })
  }

  const setLanguage = (language) => {
    dispatch({ type: ActionTypes.SET_LANGUAGE, payload: language })
  }

  const toggleAnimations = () => {
    dispatch({ type: ActionTypes.TOGGLE_ANIMATIONS })
  }

  const toggleCompactMode = () => {
    dispatch({ type: ActionTypes.TOGGLE_COMPACT_MODE })
  }

  const updatePreferences = (preferences) => {
    dispatch({ type: ActionTypes.UPDATE_PREFERENCES, payload: preferences })
  }

  const resetSettings = () => {
    dispatch({ type: ActionTypes.RESET_SETTINGS })
  }

  // Get CSS classes for current theme
  const getThemeClasses = () => {
    const classes = []
    
    if (state.theme === 'dark') {
      classes.push('dark')
    }
    
    if (state.compactMode) {
      classes.push('compact')
    }
    
    if (!state.animations) {
      classes.push('no-animations')
    }
    
    if (state.preferences.highContrast) {
      classes.push('high-contrast')
    }
    
    return classes.join(' ')
  }

  // Value to be provided
  const value = {
    ...state,
    setTheme,
    setFontSize,
    setLanguage,
    toggleAnimations,
    toggleCompactMode,
    updatePreferences,
    resetSettings,
    getThemeClasses
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

// Hook to use theme context
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

// Export action types for testing
export { ActionTypes }