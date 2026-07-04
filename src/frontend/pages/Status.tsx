import { Renderer } from '@openuidev/react-lang';
import { openuiLibrary } from '../library';
import { toolProvider } from '../toolProvider';

const statusProgram = `
$tab = "visao_geral"

stats = Query("get_stats", {}, {total_messages: 0, total_activities: 0, messages_processed: 0, messages_remaining: 0, activities_by_status: {pendente: 0, concluido: 0, descartado: 0}, activities_by_type: {prova: 0, trabalho: 0, evento: 0, atividade: 0}, token_usage: {prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, run_count: 0, last_run_at: null}, first_message_timestamp: null}, 30)
extractionsQ = Query("get_extractions", {}, {data: []})
allActivitiesQ = Query("get_activities", {}, {data: []})

tabSelect = FormControl("", Select("tab", [SelectItem("visao_geral", "Visao Geral"), SelectItem("extracoes", "Extracoes"), SelectItem("atividades", "Atividades (Debug)")], null, null, $tab))
header = Card([CardHeader("Status do Sistema", "Monitoramento"), tabSelect], "clear", "row", "m", "center", "between")

row1 = Stack([TextContent("Total de Mensagens"), TextContent("" + stats.total_messages)], "row", "none", "center", "between")
row2 = Stack([TextContent("Processadas"), TextContent("" + stats.messages_processed)], "row", "none", "center", "between")
row3 = Stack([TextContent("Nao Processadas (fila)"), TextContent("" + stats.messages_remaining)], "row", "none", "center", "between")
row4 = Stack([TextContent("Primeira Mensagem"), TextContent(stats.first_message_timestamp == null ? "Sem mensagens" : stats.first_message_timestamp)], "row", "none", "center", "between")
mensagensSection = Card([CardHeader("Mensagens"), row1, row2, row3, row4], "sunk", "column", "s")

aRow1 = Stack([TextContent("Total"), TextContent("" + stats.total_activities)], "row", "none", "center", "between")
aRow2 = Stack([TextContent("Pendentes"), TextContent("" + stats.activities_by_status.pendente)], "row", "none", "center", "between")
aRow3 = Stack([TextContent("Concluidas"), TextContent("" + stats.activities_by_status.concluido)], "row", "none", "center", "between")
aRow4 = Stack([TextContent("Descartadas"), TextContent("" + stats.activities_by_status.descartado)], "row", "none", "center", "between")
atividadesSection = Card([CardHeader("Atividades"), aRow1, aRow2, aRow3, aRow4], "sunk", "column", "s")

apiRow1 = Stack([TextContent("Total Tokens"), TextContent("" + stats.token_usage.total_tokens)], "row", "none", "center", "between")
apiRow2 = Stack([TextContent("Execucoes"), TextContent("" + stats.token_usage.run_count)], "row", "none", "center", "between")
apiRow3 = Stack([TextContent("Ultima Extracao"), TextContent(stats.token_usage.last_run_at == null ? "Nunca" : stats.token_usage.last_run_at)], "row", "none", "center", "between")
apiRow4 = Stack([TextContent("Custo Est."), TextContent("USD $" + @Round(stats.token_usage.prompt_tokens / 1000000 * 0.14 + stats.token_usage.completion_tokens / 1000000 * 0.28, 4))], "row", "none", "center", "between")
apiSection = Card([CardHeader("API (OpenCode)"), apiRow1, apiRow2, apiRow3, apiRow4], "sunk", "column", "s")
footer = Stack([TextContent("Atualiza a cada 30s", "small"), Tag("live", null, "sm", "info")], "row", "s", "center", "between")
visaoGeralTab = Stack([mensagensSection, atividadesSection, apiSection, footer], "column", "m")

extrSorted = @Sort(extractionsQ.data, "started_at", "desc")
extrItems = @Each(extrSorted, "e", Card([Stack([TextContent(e.started_at, "small-heavy"), TextContent("" + e.messages_in_batch + " msgs / " + (e.prompt_tokens + e.completion_tokens) + " tokens", "small")], "row", "s", "center", "between")], "sunk", "column", "s"))
extractoesTab = Stack([CardHeader("Historico de Extracoes"), @Count(extrSorted) > 0 ? Stack(extrItems, "column", "s") : TextContent("Nenhuma extracao registrada.")], "column", "m")

allSorted = @Sort(allActivitiesQ.data, "due_date", "asc")
dbgColTitle = Col("Titulo", allSorted.title)
dbgColType = Col("Tipo", @Each(allSorted, "a", Tag(a.type, null, "sm", a.type == "prova" ? "danger" : a.type == "trabalho" ? "warning" : "neutral")))
dbgColStatus = Col("Status", @Each(allSorted, "a", Tag(a.status, null, "sm", a.status == "pendente" ? "warning" : a.status == "concluido" ? "success" : "neutral")))
dbgColGraded = Col("Nota?", @Each(allSorted, "a", Tag(a.is_graded == 1 ? "sim" : "nao", null, "sm", a.is_graded == 1 ? "info" : "neutral")))
dbgColStage = Col("Etapa", @Each(allSorted, "a", Tag(a.delivery_stage == null ? "—" : a.delivery_stage, null, "sm", a.delivery_stage == "pending_review" ? "danger" : a.delivery_stage == "failed" ? "danger" : a.delivery_stage == "done" ? "success" : "neutral")))
dbgColDate = Col("Prazo", allSorted.due_date)
dbgTable = Table([dbgColTitle, dbgColType, dbgColStatus, dbgColGraded, dbgColStage, dbgColDate])
atividadesTab = Stack([CardHeader("Todas as Atividades (Debug)"), @Count(allSorted) > 0 ? dbgTable : TextContent("Nenhuma atividade.")], "column", "m")

currentTab = $tab == "extracoes" ? extractoesTab : $tab == "atividades" ? atividadesTab : visaoGeralTab

root = Stack([header, currentTab])
`;

export function Status() {
  return <Renderer library={openuiLibrary} response={statusProgram} toolProvider={toolProvider} />;
}
