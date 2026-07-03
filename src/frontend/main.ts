import './styles/main.css'

// Load the appropriate page
const pathname = window.location.pathname
const app = document.getElementById('app')

if (!app) throw new Error('App element not found')

// Router setup
async function loadPage() {
  if (pathname === '/' || pathname === '/dashboard') {
    const { renderDashboard } = await import('./pages/dashboard')
    renderDashboard(app)
  } else if (pathname === '/messages') {
    const { renderMessages } = await import('./pages/messages')
    renderMessages(app)
  } else if (pathname === '/status') {
    const { renderStatus } = await import('./pages/status')
    renderStatus(app)
  } else {
    app.innerHTML = '<p>Page not found</p>'
  }
}

loadPage()
