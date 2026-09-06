import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './vixora.css'

const rootElement = document.getElementById('root')

function showBootError(error) {
  const boot = document.getElementById('boot-screen')
  const message = document.getElementById('boot-error')
  if (!boot || !message) return

  const detail = error instanceof Error ? error.message : String(error)
  message.textContent = `VIXORA gagal dimuat: ${detail}`
  message.style.display = 'block'
  boot.setAttribute('data-error', 'true')
}

class VixoraErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error('VIXORA render error:', error)
    showBootError(error)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="runtime-error">
          <span>VIXORA / SYSTEM</span>
          <h1>Ekosistem sedang mengalami gangguan.</h1>
          <p>{this.state.error.message || 'Terjadi kesalahan saat menampilkan halaman.'}</p>
          <button onClick={() => window.location.reload()}>Muat ulang ↻</button>
        </div>
      )
    }

    return this.props.children
  }
}

if (!rootElement) {
  showBootError(new Error('Root element #root tidak ditemukan.'))
} else {
  try {
    createRoot(rootElement).render(
      <VixoraErrorBoundary>
        <App />
      </VixoraErrorBoundary>
    )
  } catch (error) {
    console.error('VIXORA bootstrap error:', error)
    showBootError(error)
  }
}
