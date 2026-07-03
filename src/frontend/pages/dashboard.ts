export interface Activity {
  id: number;
  type: string;
  title: string;
  description?: string;
  due_date: string;
  source_message_id: number;
  status: string;
  confidence: string;
  group_label?: string;
  author?: string;
}

interface Stats {
  total_messages: number;
  total_activities: number;
  messages_processed: number;
  messages_remaining: number;
  activities_by_status: Record<string, number>;
  token_usage: {
    total_tokens: number;
    run_count: number;
    last_run_at: string | null;
  };
}

let currentPage = 0;
const pageSize = 20;
let allActivities: Activity[] = [];
let currentStats: Stats | null = null;

export async function renderDashboard(container: HTMLElement): Promise<void> {
  container.innerHTML = '';

  const dashboard = document.createElement('div');
  dashboard.className = 'dashboard-container';
  dashboard.innerHTML = `
    <div class="dashboard-header">
      <h1>ADS Panel - Dashboard</h1>
      <button id="refresh-btn" class="btn btn-primary">Atualizar</button>
    </div>

    <div class="dashboard-stats">
      <div class="stat-card">
        <div class="stat-label">Total de Mensagens</div>
        <div class="stat-value" id="stat-total-messages">-</div>
        <div class="stat-detail" id="stat-messages-remaining">- não processadas</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total de Atividades</div>
        <div class="stat-value" id="stat-total-activities">-</div>
        <div class="stat-detail" id="stat-activities-pending">- pendentes</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Tokens Utilizados</div>
        <div class="stat-value" id="stat-tokens">-</div>
        <div class="stat-detail" id="stat-extraction-runs">0 execuções</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Última Extração</div>
        <div class="stat-value" id="stat-last-run">-</div>
        <div class="stat-detail" id="stat-estimated-cost">~R$ 0.00</div>
      </div>
    </div>

    <div class="dashboard-filters">
      <select id="status-filter" class="filter-select">
        <option value="">Todos os status</option>
        <option value="pendente">Pendente</option>
        <option value="concluido">Concluído</option>
        <option value="descartado">Descartado</option>
      </select>
      <select id="type-filter" class="filter-select">
        <option value="">Todos os tipos</option>
        <option value="prova">Prova</option>
        <option value="trabalho">Trabalho</option>
        <option value="evento">Evento</option>
        <option value="atividade">Atividade</option>
      </select>
    </div>

    <div class="activities-list">
      <table class="activities-table">
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Título</th>
            <th>Data de Prazo</th>
            <th>Status</th>
            <th>Confiança</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody id="activities-tbody">
          <tr><td colspan="6" class="loading">Carregando...</td></tr>
        </tbody>
      </table>
    </div>

    <div class="pagination">
      <button id="prev-btn" class="btn btn-secondary" disabled>Anterior</button>
      <span id="page-info">Página 1</span>
      <button id="next-btn" class="btn btn-secondary">Próxima</button>
    </div>

    <div id="extraction-status" class="extraction-status"></div>
  `;

  container.appendChild(dashboard);

  // Event listeners
  document.getElementById('refresh-btn')?.addEventListener('click', handleRefresh);
  document.getElementById('status-filter')?.addEventListener('change', () => {
    currentPage = 0;
    loadActivities();
  });
  document.getElementById('type-filter')?.addEventListener('change', () => {
    currentPage = 0;
    loadActivities();
  });
  document.getElementById('prev-btn')?.addEventListener('click', () => {
    if (currentPage > 0) {
      currentPage--;
      loadActivities();
    }
  });
  document.getElementById('next-btn')?.addEventListener('click', () => {
    if ((currentPage + 1) * pageSize < allActivities.length) {
      currentPage++;
      loadActivities();
    }
  });

  // Load initial data
  await loadStats();
  await loadActivities();
}

async function loadActivities(): Promise<void> {
  const statusFilter = (document.getElementById('status-filter') as HTMLSelectElement)?.value;
  const typeFilter = (document.getElementById('type-filter') as HTMLSelectElement)?.value;

  try {
    const url = new URL('/api/activities', window.location.origin);
    if (statusFilter) url.searchParams.append('status', statusFilter);
    url.searchParams.append('limit', '1000');

    const response = await fetch(url.toString());
    const result = await response.json();

    allActivities = result.data || [];

    // Filter by type if selected
    if (typeFilter) {
      allActivities = allActivities.filter((a) => a.type === typeFilter);
    }

    // Sort by due_date
    allActivities.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    displayActivitiesPage();
  } catch (error) {
    console.error('Error loading activities:', error);
    const tbody = document.getElementById('activities-tbody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" class="error">Erro ao carregar atividades</td></tr>';
    }
  }
}

function displayActivitiesPage(): void {
  const tbody = document.getElementById('activities-tbody');
  if (!tbody) return;

  const start = currentPage * pageSize;
  const end = start + pageSize;
  const pageActivities = allActivities.slice(start, end);

  if (pageActivities.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">Nenhuma atividade encontrada</td></tr>';
  } else {
    tbody.innerHTML = pageActivities
      .map(
        (activity) => `
      <tr class="activity-row" data-id="${activity.id}">
        <td><span class="badge badge-${activity.type}">${activity.type}</span></td>
        <td>
          <div class="activity-title">${escapeHtml(activity.title)}</div>
          ${activity.description ? `<div class="activity-description">${escapeHtml(activity.description)}</div>` : ''}
        </td>
        <td>${formatDate(activity.due_date)}</td>
        <td><span class="status-badge status-${activity.status}">${activity.status}</span></td>
        <td><span class="confidence-badge confidence-${activity.confidence}">${activity.confidence}</span></td>
        <td>
          <button class="btn btn-sm btn-status" onclick="window.updateActivityStatus(${activity.id}, '${activity.status}')">
            Alterar
          </button>
        </td>
      </tr>
    `
      )
      .join('');
  }

  // Update pagination
  const totalPages = Math.ceil(allActivities.length / pageSize);
  const pageInfo = document.getElementById('page-info');
  if (pageInfo) {
    pageInfo.textContent = `Página ${currentPage + 1} de ${Math.max(1, totalPages)}`;
  }

  const prevBtn = document.getElementById('prev-btn') as HTMLButtonElement;
  const nextBtn = document.getElementById('next-btn') as HTMLButtonElement;
  if (prevBtn) prevBtn.disabled = currentPage === 0;
  if (nextBtn) nextBtn.disabled = (currentPage + 1) * pageSize >= allActivities.length;
}

async function loadStats(): Promise<void> {
  try {
    const response = await fetch('/api/stats');
    const stats = await response.json();
    currentStats = stats;

    document.getElementById('stat-total-messages')!.textContent = stats.total_messages.toString();
    document.getElementById('stat-messages-remaining')!.textContent = `${stats.messages_remaining} não processadas`;
    document.getElementById('stat-total-activities')!.textContent = stats.total_activities.toString();
    document.getElementById('stat-activities-pending')!.textContent = `${stats.activities_by_status?.pendente || 0} pendentes`;
    document.getElementById('stat-tokens')!.textContent = stats.token_usage?.total_tokens?.toString() || '0';
    document.getElementById('stat-extraction-runs')!.textContent = `${stats.token_usage?.run_count || 0} execuções`;

    if (stats.token_usage?.last_run_at) {
      document.getElementById('stat-last-run')!.textContent = formatDateTime(stats.token_usage.last_run_at);
    } else {
      document.getElementById('stat-last-run')!.textContent = 'Nunca';
    }

    // Calculate estimated cost
    const tokensPerDollar = 5000000; // Deepseek-v4 pricing estimate
    const costUsd = stats.token_usage?.total_tokens ? (stats.token_usage.total_tokens / tokensPerDollar) * 0.1 : 0;
    const costBrl = costUsd * 5; // Approximate USD to BRL conversion
    document.getElementById('stat-estimated-cost')!.textContent = `~R$ ${costBrl.toFixed(2)}`;
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

async function handleRefresh(): Promise<void> {
  const statusDiv = document.getElementById('extraction-status');
  if (!statusDiv) return;

  const refreshBtn = document.getElementById('refresh-btn') as HTMLButtonElement;
  if (refreshBtn) refreshBtn.disabled = true;

  statusDiv.innerHTML = '<div class="status-message">Executando extração...</div>';

  try {
    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchSize: 30, maxBatches: 10 }),
    });

    const result = await response.json();

    if (result.errors && result.errors.length > 0) {
      statusDiv.innerHTML = `
        <div class="status-message error">
          <strong>Erros durante extração:</strong>
          <ul>${result.errors.map((e: string) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>
        </div>
      `;
    } else {
      statusDiv.innerHTML = `
        <div class="status-message success">
          ✓ Extração concluída!
          <br>Atividades extraídas: ${result.activities_extracted}
          <br>Mensagens processadas: ${result.messages_processed}
          <br>Tokens utilizados: ${result.total_tokens_used}
          <br>Mensagens restantes: ${result.messages_remaining}
        </div>
      `;
    }

    // Reload stats and activities
    await loadStats();
    currentPage = 0;
    await loadActivities();
  } catch (error) {
    statusDiv.innerHTML = `<div class="status-message error">Erro ao executar extração: ${escapeHtml(String(error))}</div>`;
  } finally {
    if (refreshBtn) refreshBtn.disabled = false;
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR');
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('pt-BR');
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

// Global function for status updates
(window as any).updateActivityStatus = async function (activityId: number, currentStatus: string) {
  const newStatus = prompt(`Novo status (atual: ${currentStatus}):`, currentStatus);
  if (!newStatus || newStatus === currentStatus) return;

  if (!['pendente', 'concluido', 'descartado'].includes(newStatus)) {
    alert('Status inválido');
    return;
  }

  try {
    const response = await fetch(`/api/activities/${activityId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });

    if (response.ok) {
      await loadActivities();
    } else {
      alert('Erro ao atualizar status');
    }
  } catch (error) {
    console.error('Error updating status:', error);
    alert('Erro ao atualizar status');
  }
};
