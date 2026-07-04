import { StrictMode, useState } from 'react';
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
      {page === 'dashboard' && <Dashboard />}
      {page === 'messages' && <Messages />}
      {page === 'status' && <Status />}
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
