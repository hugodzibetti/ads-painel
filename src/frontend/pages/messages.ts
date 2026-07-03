export interface Message {
  id: number;
  wa_message_id: string;
  group_label: string;
  author: string;
  body: string | null;
  timestamp: string;
  processed: number;
  activity_count?: number;
}

let currentPage = 0;
const pageSize = 50;
let allMessages: Message[] = [];

export async function renderMessages(container: HTMLElement): Promise<void> {
  container.innerHTML = '';

  const messagesPage = document.createElement('div');
  messagesPage.className = 'messages-container';
  messagesPage.innerHTML = `
    <div class="messages-header">
      <h1>Mensagens</h1>
      <input
        type="text"
        id="search-input"
        class="search-input"
        placeholder="Buscar mensagens por autor ou conteúdo..."
      />
    </div>

    <div class="messages-feed" id="messages-feed">
      <div class="loading">Carregando mensagens...</div>
    </div>

    <div class="pagination">
      <button id="prev-btn" class="btn btn-secondary" disabled>Anterior</button>
      <span id="page-info">Página 1</span>
      <button id="next-btn" class="btn btn-secondary">Próxima</button>
    </div>
  `;

  container.appendChild(messagesPage);

  // Event listeners
  document.getElementById('prev-btn')?.addEventListener('click', () => {
    if (currentPage > 0) {
      currentPage--;
      loadMessages();
    }
  });

  document.getElementById('next-btn')?.addEventListener('click', () => {
    if ((currentPage + 1) * pageSize < allMessages.length) {
      currentPage++;
      loadMessages();
    }
  });

  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  if (searchInput) {
    let searchTimeout: NodeJS.Timeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentPage = 0;
        loadMessages(searchInput.value);
      }, 300);
    });
  }

  // Load initial data
  await loadMessages();
}

async function loadMessages(searchQuery?: string): Promise<void> {
  const feed = document.getElementById('messages-feed');
  if (!feed) return;

  try {
    const url = new URL('/api/messages', window.location.origin);
    url.searchParams.append('limit', '1000');
    if (searchQuery) {
      url.searchParams.append('search', searchQuery);
    }

    const response = await fetch(url.toString());
    const result = await response.json();

    allMessages = result.data || [];

    // Sort by timestamp descending (newest first)
    allMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    displayMessagesPage();
  } catch (error) {
    console.error('Error loading messages:', error);
    feed.innerHTML = '<div class="error">Erro ao carregar mensagens</div>';
  }
}

function displayMessagesPage(): void {
  const feed = document.getElementById('messages-feed');
  if (!feed) return;

  const start = currentPage * pageSize;
  const end = start + pageSize;
  const pageMessages = allMessages.slice(start, end);

  if (pageMessages.length === 0) {
    feed.innerHTML = '<div class="empty">Nenhuma mensagem encontrada</div>';
  } else {
    feed.innerHTML = pageMessages
      .map(
        (message) => `
      <div class="message-card">
        <div class="message-header">
          <div class="message-meta">
            <span class="message-author">${escapeHtml(message.author)}</span>
            <span class="message-timestamp">${formatDateTime(message.timestamp)}</span>
          </div>
          <div class="message-badges">
            <span class="badge badge-${message.group_label}">${message.group_label}</span>
            ${message.processed ? '<span class="badge badge-processed">Processada</span>' : '<span class="badge badge-unprocessed">Não processada</span>'}
            ${message.activity_count ? `<span class="badge badge-activities">${message.activity_count} atividade${message.activity_count > 1 ? 's' : ''}</span>` : ''}
          </div>
        </div>
        <div class="message-body">
          ${escapeHtml(message.body || '[Mensagem vazia]')}
        </div>
        <div class="message-footer">
          <small class="message-id">ID: ${message.id} (WA: ${escapeHtml(message.wa_message_id)})</small>
        </div>
      </div>
    `
      )
      .join('');
  }

  // Update pagination
  const totalPages = Math.ceil(allMessages.length / pageSize);
  const pageInfo = document.getElementById('page-info');
  if (pageInfo) {
    pageInfo.textContent = `Página ${currentPage + 1} de ${Math.max(1, totalPages)}`;
  }

  const prevBtn = document.getElementById('prev-btn') as HTMLButtonElement;
  const nextBtn = document.getElementById('next-btn') as HTMLButtonElement;
  if (prevBtn) prevBtn.disabled = currentPage === 0;
  if (nextBtn) nextBtn.disabled = (currentPage + 1) * pageSize >= allMessages.length;
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
