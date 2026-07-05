import {
  fetchActivities,
  updateActivityStatus,
  updateActivityDelivery,
  fetchUnprocessedCount,
  fetchExtractionRuns,
  openDb,
} from '../server/db.js';
import type { ActivityWithDelivery } from '../server/db.js';
import { runExtraction } from '../server/extraction.js';
import { regenerateDraft } from '../server/drafter.js';
import { dispatchDelivery } from '../server/delivery.js';

interface PendingApproval {
  activityId: number;
  step: 'awaiting_approval' | 'awaiting_edit';
}

const pendingApprovals = new Map<string, PendingApproval>();

export function getPendingApproval(chatId: string): PendingApproval | undefined {
  return pendingApprovals.get(chatId);
}

export function clearPendingApproval(chatId: string): void {
  pendingApprovals.delete(chatId);
}

export function setPendingApproval(chatId: string, approval: PendingApproval): void {
  pendingApprovals.set(chatId, approval);
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function formatActivityLine(a: ActivityWithDelivery): string {
  return `*#${a.id}* [${a.type}] ${a.title} — ${formatDate(a.due_date)} — ${a.status}`;
}

export async function handleExtrair(): Promise<string> {
  const result = await runExtraction();

  if (result.errors.length > 0 && result.activities_extracted === 0) {
    return `Erro na extração: ${result.errors.join('; ')}`;
  }

  if (result.activities_extracted === 0) {
    const remaining = fetchUnprocessedCount();
    const runs = fetchExtractionRuns(1);
    let hoursAgo = 'desconhecido';
    if (runs.length > 0 && runs[0].started_at) {
      const mins = Math.round((Date.now() - new Date(runs[0].started_at).getTime()) / 60000);
      hoursAgo = mins < 60 ? `${mins} min` : `${Math.round(mins / 60)}h`;
    }
    return `Nenhuma atividade encontrada em ${result.messages_processed} mensagens. Última extração foi há ${hoursAgo}. Restam ${remaining} mensagens não processadas. Executar novamente?`;
  }

  return `Encontrei ${result.activities_extracted} atividades, ${result.messages_processed} mensagens processadas.`;
}

export function handleAtividades(statusFilter?: string): string {
  const validStatuses = ['pendente', 'concluido', 'descartado'];
  if (statusFilter && !validStatuses.includes(statusFilter)) {
    return `Status inválido. Use: pendente, concluido ou descartado`;
  }

  const activities = fetchActivities(statusFilter || undefined);

  if (activities.length === 0) {
    return statusFilter
      ? `Nenhuma atividade com status "${statusFilter}".`
      : 'Nenhuma atividade encontrada.';
  }

  const lines = activities.map(formatActivityLine);
  const header = statusFilter ? `Atividades (${statusFilter}):` : 'Atividades:';
  return `${header}\n${lines.join('\n')}`;
}

export function handleConcluir(id: number): string {
  const activities = fetchActivities();
  const activity = activities.find((a) => a.id === id);
  if (!activity) return `Atividade #${id} não encontrada.`;

  updateActivityStatus(id, 'concluido');
  return `Atividade #${id} marcada como concluída.`;
}

export function handleDescartar(id: number): string {
  const activities = fetchActivities();
  const activity = activities.find((a) => a.id === id);
  if (!activity) return `Atividade #${id} não encontrada.`;

  updateActivityStatus(id, 'descartado');
  return `Atividade #${id} marcada como descartada.`;
}

export function handleEditar(id: number, field: string, value: string): string {
  const allowedFields = ['title', 'due_date', 'type', 'confidence'];
  if (!allowedFields.includes(field)) {
    return `Campo inválido. Permitidos: ${allowedFields.join(', ')}`;
  }

  if (field === 'type' && !['prova', 'trabalho', 'evento', 'atividade'].includes(value)) {
    return `Tipo inválido. Use: prova, trabalho, evento ou atividade`;
  }
  if (field === 'confidence' && !['alta', 'media', 'baixa'].includes(value)) {
    return `Confiança inválida. Use: alta, media ou baixa`;
  }
  if (field === 'due_date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `Data inválida. Use o formato AAAA-MM-DD`;
  }

  const db = openDb();
  db.prepare(`UPDATE activities SET ${field} = ? WHERE id = ?`).run(value, id);

  const updated = fetchActivities();
  const activity = updated.find((a) => a.id === id);
  if (!activity) return `Atividade #${id} não encontrada.`;

  return `Atividade #${id} atualizada:\n${formatActivityLine(activity)}`;
}

export function handleResumo(): string {
  const activities = fetchActivities('pendente', 'urgent');

  if (activities.length === 0) {
    return 'Nenhuma atividade pendente nos próximos 7 dias.';
  }

  const lines = activities.map((a) => {
    const urgency = a.days_until_due < 0 ? '⚠️ VENCIDO' : a.days_until_due === 0 ? '🔴 HOJE' : `${a.days_until_due}d`;
    return `[${a.type}] ${a.title} — ${formatDate(a.due_date)} (${urgency})`;
  });

  return `Atividades dos próximos 7 dias:\n${lines.join('\n')}`;
}

export async function handleEntregar(chatId: string, id: number): Promise<string> {
  const activities = fetchActivities();
  const activity = activities.find((a) => a.id === id);
  if (!activity) return `Atividade #${id} não encontrada.`;

  if (!activity.delivery_draft) {
    try {
      const draft = await regenerateDraft(id, '');
      if (!draft) return `Não foi possível gerar o rascunho para atividade #${id}.`;
      setPendingApproval(chatId, { activityId: id, step: 'awaiting_approval' });
      return `Rascunho gerado para #${id}:\n\n${draft}\n\nAprovar? (sim/não/editar)`;
    } catch (err: any) {
      return `Erro ao gerar rascunho: ${err.message}`;
    }
  }

  setPendingApproval(chatId, { activityId: id, step: 'awaiting_approval' });
  return `Rascunho para #${id}:\n\n${activity.delivery_draft}\n\nAprovar? (sim/não/editar)`;
}

export async function handleApprovalResponse(chatId: string, text: string): Promise<string | null> {
  const pending = pendingApprovals.get(chatId);
  if (!pending) return null;

  const lower = text.trim().toLowerCase();

  if (lower.startsWith('/')) {
    pendingApprovals.delete(chatId);
    return null;
  }

  if (pending.step === 'awaiting_edit') {
    try {
      const draft = await regenerateDraft(pending.activityId, text);
      pendingApprovals.set(chatId, { activityId: pending.activityId, step: 'awaiting_approval' });
      return `Rascunho atualizado para #${pending.activityId}:\n\n${draft}\n\nAprovar? (sim/não/editar)`;
    } catch (err: any) {
      return `Erro ao editar rascunho: ${err.message}`;
    }
  }

  if (lower === 'sim' || lower === 's') {
    pendingApprovals.delete(chatId);
    const activities = fetchActivities();
    const activity = activities.find((a) => a.id === pending.activityId);
    if (!activity) return `Atividade #${pending.activityId} não encontrada.`;

    await dispatchDelivery(activity);
    updateActivityStatus(pending.activityId, 'concluido');
    return `Entrega da atividade #${pending.activityId} aprovada e enviada!`;
  }

  if (lower === 'não' || lower === 'nao' || lower === 'n') {
    pendingApprovals.delete(chatId);
    return `Rascunho da atividade #${pending.activityId} descartado.`;
  }

  if (lower.startsWith('editar')) {
    const editContent = text.trim().slice(6).trim();
    if (!editContent) {
      pendingApprovals.set(chatId, { activityId: pending.activityId, step: 'awaiting_edit' });
      return `Envie o texto editado para a atividade #${pending.activityId}:`;
    }
    try {
      const draft = await regenerateDraft(pending.activityId, editContent);
      pendingApprovals.set(chatId, { activityId: pending.activityId, step: 'awaiting_approval' });
      return `Rascunho atualizado para #${pending.activityId}:\n\n${draft}\n\nAprovar? (sim/não/editar)`;
    } catch (err: any) {
      return `Erro ao editar rascunho: ${err.message}`;
    }
  }

  return `Resposta não reconhecida. Use: sim, não ou editar <texto>`;
}

export function parseCommand(body: string): { command: string; args: string[] } | null {
  const trimmed = body.trim();
  if (!trimmed.startsWith('/')) return null;

  const parts = trimmed.split(/\s+/);
  const command = parts[0].toLowerCase().replace('/', '');
  const args = parts.slice(1);

  return { command, args };
}

export async function routeCommand(chatId: string, command: string, args: string[]): Promise<string> {
  switch (command) {
    case 'extrair':
      return handleExtrair();

    case 'atividades':
      return handleAtividades(args[0]);

    case 'concluir': {
      const id = parseInt(args[0]);
      if (!id) return 'Uso: /concluir <id>';
      return handleConcluir(id);
    }

    case 'descartar': {
      const id = parseInt(args[0]);
      if (!id) return 'Uso: /descartar <id>';
      return handleDescartar(id);
    }

    case 'editar': {
      const id = parseInt(args[0]);
      if (!id || args.length < 3) return 'Uso: /editar <id> <field> <value>';
      return handleEditar(id, args[1], args.slice(2).join(' '));
    }

    case 'resumo':
      return handleResumo();

    case 'entregar': {
      const id = parseInt(args[0]);
      if (!id) return 'Uso: /entregar <id>';
      return handleEntregar(chatId, id);
    }

    case 'ajuda':
    case 'help':
      return [
        'Comandos disponíveis:',
        '/extrair — Extrair atividades das mensagens',
        '/atividades [status] — Listar atividades',
        '/concluir <id> — Marcar como concluída',
        '/descartar <id> — Marcar como descartada',
        '/editar <id> <campo> <valor> — Editar atividade',
        '/resumo — Atividades dos próximos 7 dias',
        '/entregar <id> — Gerar e aprovar entrega',
      ].join('\n');

    default:
      return `Comando desconhecido: /${command}. Use /ajuda para ver os comandos.`;
  }
}
