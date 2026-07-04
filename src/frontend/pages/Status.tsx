import { Renderer } from '@openuidev/react-lang';
import { openuiLibrary } from '../library';
import { toolProvider } from '../toolProvider';

// Query's 4th argument (30) is the auto-refresh interval in seconds —
// replaces the old setInterval(loadStats, 30000) polling loop.
const statusProgram = `
stats = Query("get_stats", {}, {total_messages: 0, total_activities: 0, messages_processed: 0, messages_remaining: 0, activities_by_status: {pendente: 0, concluido: 0, descartado: 0}, activities_by_type: {prova: 0, trabalho: 0, evento: 0, atividade: 0}, token_usage: {prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, run_count: 0, last_run_at: null}, first_message_timestamp: null}, 30)

refreshBtn = Button("Atualizar", Action([@Run(stats)]), "primary")
header = Card([CardHeader("Status do Sistema", "Monitoramento em tempo real"), refreshBtn], "clear", "row", "m", "center", "between")

row1 = Stack([TextContent("Total de Mensagens"), TextContent("" + stats.total_messages)], "row", "none", "center", "between")
row2 = Stack([TextContent("Processadas"), TextContent("" + stats.messages_processed)], "row", "none", "center", "between")
row3 = Stack([TextContent("Não Processadas (fila)"), TextContent("" + stats.messages_remaining)], "row", "none", "center", "between")
row4 = Stack([TextContent("Primeira Mensagem"), TextContent(stats.first_message_timestamp == null ? "Sem mensagens" : stats.first_message_timestamp)], "row", "none", "center", "between")
mensagensSection = Card([CardHeader("Mensagens"), row1, row2, row3, row4], "sunk", "column", "s")

aRow1 = Stack([TextContent("Total de Atividades"), TextContent("" + stats.total_activities)], "row", "none", "center", "between")
aRow2 = Stack([TextContent("Pendentes"), TextContent("" + stats.activities_by_status.pendente)], "row", "none", "center", "between")
aRow3 = Stack([TextContent("Concluídas"), TextContent("" + stats.activities_by_status.concluido)], "row", "none", "center", "between")
aRow4 = Stack([TextContent("Descartadas"), TextContent("" + stats.activities_by_status.descartado)], "row", "none", "center", "between")
atividadesSection = Card([CardHeader("Atividades"), aRow1, aRow2, aRow3, aRow4], "sunk", "column", "s")

tRow1 = Stack([TextContent("Provas"), TextContent("" + stats.activities_by_type.prova)], "row", "none", "center", "between")
tRow2 = Stack([TextContent("Trabalhos"), TextContent("" + stats.activities_by_type.trabalho)], "row", "none", "center", "between")
tRow3 = Stack([TextContent("Eventos"), TextContent("" + stats.activities_by_type.evento)], "row", "none", "center", "between")
tRow4 = Stack([TextContent("Atividades"), TextContent("" + stats.activities_by_type.atividade)], "row", "none", "center", "between")
tiposSection = Card([CardHeader("Tipos de Atividades"), tRow1, tRow2, tRow3, tRow4], "sunk", "column", "s")

apiRow1 = Stack([TextContent("Total de Tokens"), TextContent("" + stats.token_usage.total_tokens)], "row", "none", "center", "between")
apiRow2 = Stack([TextContent("Tokens de Prompt"), TextContent("" + stats.token_usage.prompt_tokens)], "row", "none", "center", "between")
apiRow3 = Stack([TextContent("Tokens de Completion"), TextContent("" + stats.token_usage.completion_tokens)], "row", "none", "center", "between")
apiRow4 = Stack([TextContent("Número de Execuções"), TextContent("" + stats.token_usage.run_count)], "row", "none", "center", "between")
apiRow5 = Stack([TextContent("Última Extração"), TextContent(stats.token_usage.last_run_at == null ? "Nunca" : stats.token_usage.last_run_at)], "row", "none", "center", "between")
apiRow6 = Stack([TextContent("Custo Estimado"), TextContent("USD $" + @Round(stats.token_usage.prompt_tokens / 1000000 * 0.14 + stats.token_usage.completion_tokens / 1000000 * 0.28, 4) + " (≈ R$ " + @Round((stats.token_usage.prompt_tokens / 1000000 * 0.14 + stats.token_usage.completion_tokens / 1000000 * 0.28) * 5, 2) + ")")], "row", "none", "center", "between")
apiSection = Card([CardHeader("Uso de API (OpenCode)"), apiRow1, apiRow2, apiRow3, apiRow4, apiRow5, apiRow6], "sunk", "column", "s")

footer = Stack([TextContent("Atualiza automaticamente a cada 30s", "small"), Tag("live", null, "sm", "info")], "row", "s", "center", "between")

root = Stack([header, mensagensSection, atividadesSection, tiposSection, apiSection, footer])
`;

export function Status() {
  return <Renderer library={openuiLibrary} response={statusProgram} toolProvider={toolProvider} />;
}
