import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Já verifica se window.DB existe (scripts já carregados pelo index.html)
if (window.DB) {
  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
} else {
  // Espera um pouco e tenta novamente
  setTimeout(() => {
    ReactDOM.createRoot(document.getElementById('root')).render(<App />);
  }, 1000);
}