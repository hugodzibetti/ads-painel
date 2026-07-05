import { Component, StrictMode, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, createTheme, Card, CardHeader, Buttons, Button } from '@openuidev/react-ui';
import '@openuidev/react-ui/components.css';
import '@openuidev/react-ui/index.css';
import { Dashboard } from './pages/Dashboard';
import { Messages } from './pages/Messages';
import { Status } from './pages/Status';

type Page = 'dashboard' | 'messages' | 'status';

const PATH_TO_PAGE: Record<string, Page> = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/messages': 'messages',
  '/status': 'status',
};

const theme = createTheme({ interactiveAccentDefault: '#0066cc' });

// Catches any render/query error so a failed API call shows a recoverable card
// instead of a blank white screen. Keyed by page so navigating away clears it.
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <Card variant="sunk" style={{ margin: 16, padding: 16 }}>
          <CardHeader title="Algo deu errado" subtitle="A página não pôde ser carregada — verifique se o servidor está no ar." />
          <Button variant="primary" onClick={() => window.location.reload()}>
            Recarregar
          </Button>
        </Card>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [page, setPage] = useState<Page>(PATH_TO_PAGE[window.location.pathname] ?? 'dashboard');

  function navigate(next: Page, path: string) {
    window.history.pushState({}, '', path);
    setPage(next);
  }

  return (
    <Card variant="card" width="full" style={{ minHeight: '100vh', borderRadius: 0 }}>
      <CardHeader
        title="ADS Panel"
        actions={
          <Buttons variant="horizontal">
            <Button
              variant={page === 'dashboard' ? 'primary' : 'tertiary'}
              onClick={() => navigate('dashboard', '/dashboard')}
            >
              Dashboard
            </Button>
            <Button
              variant={page === 'messages' ? 'primary' : 'tertiary'}
              onClick={() => navigate('messages', '/messages')}
            >
              Mensagens
            </Button>
            <Button
              variant={page === 'status' ? 'primary' : 'tertiary'}
              onClick={() => navigate('status', '/status')}
            >
              Status
            </Button>
          </Buttons>
        }
      />
      <ErrorBoundary key={page}>
        {page === 'dashboard' && <Dashboard />}
        {page === 'messages' && <Messages />}
        {page === 'status' && <Status />}
      </ErrorBoundary>
    </Card>
  );
}

const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;

document.body.style.margin = '0';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider mode={prefersDark ? 'dark' : 'light'} lightTheme={theme}>
      <App />
    </ThemeProvider>
  </StrictMode>
);
