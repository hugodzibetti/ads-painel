export interface StatsResponse {
  total_messages: number;
  total_activities: number;
  messages_processed: number;
  messages_remaining: number;
  activities_by_status: Record<string, number>;
  activities_by_type: Record<string, number>;
  token_usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    run_count: number;
    last_run_at: string | null;
  };
  first_message_timestamp: string | null;
}

export async function renderStatus(container: HTMLElement): Promise<void> {
  container.innerHTML = '';

  const statusPage = document.createElement('div');
  statusPage.className = 'status-container';
  statusPage.innerHTML = `
    <div class="status-header">
      <h1>Status do Sistema</h1>
      <button id="refresh-stats" class="btn btn-primary">Atualizar</button>
    </div>

    <div class="status-grid">
      <!-- Messages Section -->
      <div class="status-section">
        <h2>Mensagens</h2>
        <div class="stats-table">
          <div class="stat-row">
            <span class="stat-label">Total de Mensagens</span>
            <span class="stat-value" id="total-messages">-</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Processadas</span>
            <span class="stat-value" id="messages-processed">-</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Não Processadas (fila)</span>
            <span class="stat-value" id="messages-remaining">-</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Primeira Mensagem</span>
            <span class="stat-value" id="first-message">-</span>
          </div>
        </div>
      </div>

      <!-- Activities Section -->
      <div class="status-section">
        <h2>Atividades</h2>
        <div class="stats-table">
          <div class="stat-row">
            <span class="stat-label">Total de Atividades</span>
            <span class="stat-value" id="total-activities">-</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Pendentes</span>
            <span class="stat-value" id="activities-pending">-</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Concluídas</span>
            <span class="stat-value" id="activities-completed">-</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Descartadas</span>
            <span class="stat-value" id="activities-discarded">-</span>
          </div>
        </div>
      </div>

      <!-- Activity Types Section -->
      <div class="status-section">
        <h2>Tipos de Atividades</h2>
        <div class="stats-table">
          <div class="stat-row">
            <span class="stat-label">Provas</span>
            <span class="stat-value" id="type-prova">-</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Trabalhos</span>
            <span class="stat-value" id="type-trabalho">-</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Eventos</span>
            <span class="stat-value" id="type-evento">-</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Atividades</span>
            <span class="stat-value" id="type-atividade">-</span>
          </div>
        </div>
      </div>

      <!-- LLM Usage Section -->
      <div class="status-section">
        <h2>Uso de API (OpenCode)</h2>
        <div class="stats-table">
          <div class="stat-row">
            <span class="stat-label">Total de Tokens</span>
            <span class="stat-value" id="total-tokens">-</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Tokens de Prompt</span>
            <span class="stat-value" id="prompt-tokens">-</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Tokens de Completion</span>
            <span class="stat-value" id="completion-tokens">-</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Número de Execuções</span>
            <span class="stat-value" id="run-count">-</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Última Extração</span>
            <span class="stat-value" id="last-run">-</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Custo Estimado</span>
            <span class="stat-value" id="estimated-cost">-</span>
          </div>
        </div>
      </div>
    </div>

    <div class="status-footer">
      <small>Última atualização: <span id="update-time">-</span></small>
    </div>
  `;

  container.appendChild(statusPage);

  // Event listener for refresh button
  document.getElementById('refresh-stats')?.addEventListener('click', loadStats);

  // Load initial stats
  await loadStats();

  // Auto-refresh every 30 seconds
  setInterval(loadStats, 30000);
}

async function loadStats(): Promise<void> {
  try {
    const response = await fetch('/api/stats');
    if (!response.ok) throw new Error('Failed to fetch stats');

    const stats: StatsResponse = await response.json();

    // Messages
    document.getElementById('total-messages')!.textContent = stats.total_messages.toString();
    document.getElementById('messages-processed')!.textContent = stats.messages_processed.toString();
    document.getElementById('messages-remaining')!.textContent = stats.messages_remaining.toString();
    document.getElementById('first-message')!.textContent = stats.first_message_timestamp
      ? formatDateTime(stats.first_message_timestamp)
      : 'Sem mensagens';

    // Activities
    const totalActivities = Object.values(stats.activities_by_status).reduce((a, b) => a + b, 0);
    document.getElementById('total-activities')!.textContent = totalActivities.toString();
    document.getElementById('activities-pending')!.textContent = (stats.activities_by_status.pendente || 0).toString();
    document.getElementById('activities-completed')!.textContent = (stats.activities_by_status.concluido || 0).toString();
    document.getElementById('activities-discarded')!.textContent = (stats.activities_by_status.descartado || 0).toString();

    // Activity Types
    document.getElementById('type-prova')!.textContent = (stats.activities_by_type.prova || 0).toString();
    document.getElementById('type-trabalho')!.textContent = (stats.activities_by_type.trabalho || 0).toString();
    document.getElementById('type-evento')!.textContent = (stats.activities_by_type.evento || 0).toString();
    document.getElementById('type-atividade')!.textContent = (stats.activities_by_type.atividade || 0).toString();

    // LLM Usage
    document.getElementById('total-tokens')!.textContent = stats.token_usage.total_tokens.toString();
    document.getElementById('prompt-tokens')!.textContent = stats.token_usage.prompt_tokens.toString();
    document.getElementById('completion-tokens')!.textContent = stats.token_usage.completion_tokens.toString();
    document.getElementById('run-count')!.textContent = stats.token_usage.run_count.toString();
    document.getElementById('last-run')!.textContent = stats.token_usage.last_run_at
      ? formatDateTime(stats.token_usage.last_run_at)
      : 'Nunca';

    // Estimated cost calculation
    // Deepseek-v4: approximately 0.14 USD per 1M input tokens, 0.28 USD per 1M output tokens
    const promptCost = (stats.token_usage.prompt_tokens / 1000000) * 0.14;
    const completionCost = (stats.token_usage.completion_tokens / 1000000) * 0.28;
    const totalCostUsd = promptCost + completionCost;
    const totalCostBrl = totalCostUsd * 5; // Approximate conversion

    document.getElementById('estimated-cost')!.textContent = `USD $${totalCostUsd.toFixed(4)} (≈ R$ ${totalCostBrl.toFixed(2)})`;

    // Update timestamp
    document.getElementById('update-time')!.textContent = new Date().toLocaleString('pt-BR');
  } catch (error) {
    console.error('Error loading stats:', error);
    document.getElementById('update-time')!.textContent = 'Erro ao atualizar';
  }
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
