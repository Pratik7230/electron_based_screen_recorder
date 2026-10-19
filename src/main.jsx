import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Widget from './Widget.jsx'

// The same bundle serves both windows: "#/widget" is the small floating control bar.
const isWidget = window.location.hash === '#/widget'

createRoot(document.getElementById('root')).render(
  <StrictMode>{isWidget ? <Widget /> : <App />}</StrictMode>,
)