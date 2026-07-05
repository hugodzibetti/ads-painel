import { Renderer } from '@openuidev/react-lang';
import { openuiLibrary } from '../library';
import { toolProvider } from '../toolProvider';

// System health + audit. Three native Tabs (no $var hack):
//   Visao Geral — live counters (messages, activities by status & type, API cost). Polls every 30s.
//   Extracoes   — history of extraction runs (batch size, tokens).
//   Atividades  — raw activity table for debugging what the LLM produced.
const statusProgram = `
stats = Query("get_stats", {}, {total_messages: 0, total_activities: 0, messages_processed: 0, messages_remaining: 0, activities_by_status: {pendente: 0, concluido: 0, descartado: 0}, activities_by_type: {prova: 0, trabalho: 0, evento: 0, atividade: 0}, token_usage: {prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, run_count: 0, last_run_at: null}, first_message_timestamp: null}, 30)
extractionsQ = Query("get_extractions", {}, {data: []})
allActivitiesQ = Query("get_activities", {}, {data: []})

header = Card([CardHeader("Status do Sistema", "Mensagens, atividades e uso da API — atualiza a cada 30s")], "clear")

mRow1 = Stack([TextContent("Total de mensagens"), TextContent("" + stats.total_messages, "small-heavy")], "row", "none", "center", "between")
mRow2 = Stack([TextContent("Processadas"), TextContent("" + stats.messages_processed, "small-heavy")], "row", "none", "center", "between")
mRow3 = Stack([TextContent("Na fila"), TextContent("" + stats.messages_remaining, "small-heavy")], "row", "none", "center", "between")
mRow4 = Stack([TextContent("Primeira mensagem"), TextContent(stats.first_message_timestamp == null ? "—" : stats.first_message_timestamp, "small")], "row", "none", "center", "between")
mensagensCard = Card([CardHeader("Mensagens"), mRow1, mRow2, mRow3, mRow4], "sunk", "column", "s")

sRow1 = Stack([TextContent("Total"), TextContent("" + stats.total_activities, "small-heavy")], "row", "none", "center", "between")
sRow2 = Stack([Tag("pendente", null, "sm", "warning"), TextContent("" + stats.activities_by_status.pendente, "small-heavy")], "row", "none", "center", "between")
sRow3 = Stack([Tag("concluido", null, "sm", "success"), TextContent("" + stats.activities_by_status.concluido, "small-heavy")], "row", "none", "center", "between")
sRow4 = Stack([Tag("descartado", null, "sm", "neutral"), TextContent("" + stats.activities_by_status.descartado, "small-heavy")], "row", "none", "center", "between")
statusCard = Card([CardHeader("Atividades por status"), sRow1, sRow2, sRow3, sRow4], "sunk", "column", "s")

tRow1 = Stack([Tag("prova", null, "sm", "danger"), TextContent("" + stats.activities_by_type.prova, "small-heavy")], "row", "none", "center", "between")
tRow2 = Stack([Tag("trabalho", null, "sm", "warning"), TextContent("" + stats.activities_by_type.trabalho, "small-heavy")], "row", "none", "center", "between")
tRow3 = Stack([Tag("evento", null, "sm", "info"), TextContent("" + stats.activities_by_type.evento, "small-heavy")], "row", "none", "center", "between")
tRow4 = Stack([Tag("atividade", null, "sm", "neutral"), TextContent("" + stats.activities_by_type.atividade, "small-heavy")], "row", "none", "center", "between")
tipoCard = Card([CardHeader("Atividades por tipo"), tRow1, tRow2, tRow3, tRow4], "sunk", "column", "s")

aRow1 = Stack([TextContent("Tokens totais"), TextContent("" + stats.token_usage.total_tokens, "small-heavy")], "row", "none", "center", "between")
aRow2 = Stack([TextContent("Execucoes"), TextContent("" + stats.token_usage.run_count, "small-heavy")], "row", "none", "center", "between")
aRow3 = Stack([TextContent("Ultima extracao"), TextContent(stats.token_usage.last_run_at == null ? "nunca" : stats.token_usage.last_run_at, "small")], "row", "none", "center", "between")
aRow4 = Stack([TextContent("Custo estimado"), TextContent("USD $" + @Round(stats.token_usage.prompt_tokens / 1000000 * 0.14 + stats.token_usage.completion_tokens / 1000000 * 0.28, 4), "small-heavy")], "row", "none", "center", "between")
apiCard = Card([CardHeader("API (OpenCode)"), aRow1, aRow2, aRow3, aRow4], "sunk", "column", "s")

statsGrid = Stack([mensagensCard, statusCard, tipoCard, apiCard], "row", "m", "stretch", "start", true)

extrSorted = @Sort(extractionsQ.data, "started_at", "desc")
extrItems = @Each(extrSorted, "e", Card([Stack([TextContent(e.started_at, "small-heavy"), TextContent("" + e.messages_in_batch + " msgs · " + (e.prompt_tokens + e.completion_tokens) + " tokens", "small")], "row", "s", "center", "between")], "sunk", "column", "s"))
extracoesContent = @Count(extrSorted) > 0 ? Stack(extrItems, "column", "s") : TextContent("Nenhuma extracao registrada ainda.")

allSorted = @Sort(allActivitiesQ.data, "due_date", "asc")
dbgTable = Table([
  Col("Titulo", allSorted.title),
  Col("Tipo", @Each(allSorted, "a", Tag(a.type, null, "sm", a.type == "prova" ? "danger" : a.type == "trabalho" ? "warning" : a.type == "evento" ? "info" : "neutral"))),
  Col("Status", @Each(allSorted, "a", Tag(a.status, null, "sm", a.status == "pendente" ? "warning" : a.status == "concluido" ? "success" : "neutral"))),
  Col("Nota?", @Each(allSorted, "a", Tag(a.is_graded == 1 ? "sim" : "nao", null, "sm", a.is_graded == 1 ? "info" : "neutral"))),
  Col("Etapa", @Each(allSorted, "a", Tag(a.delivery_stage == null ? "—" : a.delivery_stage, null, "sm", a.delivery_stage == "pending_review" ? "danger" : a.delivery_stage == "failed" ? "danger" : a.delivery_stage == "done" ? "success" : "neutral"))),
  Col("Prazo", allSorted.due_date)
])
debugContent = @Count(allSorted) > 0 ? dbgTable : TextContent("Nenhuma atividade extraida ainda.")

tabs = Tabs([
  TabItem("visao", "Visao Geral", [statsGrid]),
  TabItem("extracoes", "Extracoes", [CardHeader("Historico de extracoes"), extracoesContent]),
  TabItem("debug", "Atividades", [CardHeader("Todas as atividades", "Saida bruta da extracao — debug"), debugContent])
])

root = Stack([header, tabs], "column", "m")
`;

export function Status() {
  return <Renderer library={openuiLibrary} response={statusProgram} toolProvider={toolProvider} />;
}
