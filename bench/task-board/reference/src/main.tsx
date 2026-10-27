import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { TaskProvider } from './state/TaskContext'
import './styles/variables.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/components.css'

const container = document.getElementById('root')
if (container === null) {
  throw new Error('Root element #root was not found')
}

createRoot(container).render(
  <StrictMode>
    <TaskProvider>
      <App />
    </TaskProvider>
  </StrictMode>,
)
