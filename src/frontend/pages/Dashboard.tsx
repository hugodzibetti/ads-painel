import { Renderer } from '@openuidev/react-lang';
import { openuiLibrary } from '../library';
import { toolProvider } from '../toolProvider';

// OpenUI Lang program. No LLM involved — Query/Mutation run toolProvider
// functions directly, and $variables + @builtins handle all filtering,
// sorting, and interactivity client-side (see @Run/@Set/@Filter/@Sort).
const dashboardProgram = `
$statusFilter = "all"
$typeFilter = "all"
$search = ""
$editId = ""
$editStatus = "pendente"
$showEdit = false

stats = Query("get_stats", {}, {total_messages: 0, total_activities: 0, messages_remaining: 0, activities_by_status: {pendente: 0}, token_usage: {total_tokens: 0, run_count: 0}})
activitiesQ = Query("get_activities", {status: $statusFilter}, {data: []})
extractResult = Mutation("run_extraction", {})
updateResult = Mutation("update_activity_status", {id: $editId, status: $editStatus})

byType = $typeFilter == "all" ? activitiesQ.data : @Filter(activitiesQ.data, "type", "==", $typeFilter)
filtered = $search == "" ? byType : @Filter(byType, "title", "contains", $search)
sorted = @Sort(filtered, "due_date", "asc")

refreshBtn = Button("Atualizar", Action([@Run(extractResult), @Run(activitiesQ), @Run(stats)]), "primary")
header = Card([CardHeader("ADS Panel", "Dashboard"), refreshBtn], "clear", "row", "m", "center", "between")

kpiMessages = Card([TextContent("Total Mensagens", "small"), TextContent("" + stats.total_messages, "large-heavy"), TextContent("" + stats.messages_remaining + " não processadas", "small")], "sunk", "column", "s")
kpiActivities = Card([TextContent("Total Atividades", "small"), TextContent("" + stats.total_activities, "large-heavy"), TextContent("" + stats.activities_by_status.pendente + " pendentes", "small")], "sunk", "column", "s")
kpiTokens = Card([TextContent("Tokens Utilizados", "small"), TextContent("" + stats.token_usage.total_tokens, "large-heavy"), TextContent("" + stats.token_usage.run_count + " execuções", "small")], "sunk", "column", "s")
kpiCost = Card([TextContent("Custo Estimado", "small"), TextContent("R$ " + @Round(stats.token_usage.total_tokens / 5000000 * 0.1 * 5, 2), "large-heavy")], "sunk", "column", "s")
kpiRow = Stack([kpiMessages, kpiActivities, kpiTokens, kpiCost], "row", "m", "stretch", "start", true)

filterStatus = FormControl("Status", Select("statusFilter", [SelectItem("all", "Todos os Status"), SelectItem("pendente", "Pendente"), SelectItem("concluido", "Concluído"), SelectItem("descartado", "Descartado")], null, null, $statusFilter))
filterType = FormControl("Tipo", Select("typeFilter", [SelectItem("all", "Todos os Tipos"), SelectItem("prova", "Prova"), SelectItem("trabalho", "Trabalho"), SelectItem("evento", "Evento"), SelectItem("atividade", "Atividade")], null, null, $typeFilter))
filterSearch = FormControl("Buscar", Input("search", "Buscar atividade...", "text", null, $search))
filterRow = Card([filterStatus, filterType, filterSearch], "clear", "row", "m", "end")

colTitle = Col("Atividade", sorted.title)
colType = Col("Tipo", @Each(sorted, "a", Tag(a.type, null, "sm", a.type == "prova" ? "danger" : a.type == "trabalho" ? "warning" : a.type == "evento" ? "info" : "neutral")))
colStatus = Col("Status", @Each(sorted, "a", Tag(a.status, null, "sm", a.status == "pendente" ? "warning" : a.status == "concluido" ? "success" : "neutral")))
colConfidence = Col("Confiança", @Each(sorted, "a", Tag(a.confidence, null, "sm", a.confidence == "alta" ? "success" : a.confidence == "media" ? "info" : "danger")))
colDate = Col("Prazo", sorted.due_date)
colActions = Col("Ações", @Each(sorted, "a", Button("Alterar", Action([@Set($editId, a.id), @Set($editStatus, a.status), @Set($showEdit, true)]), "secondary", "normal", "extra-small")))
tbl = Table([colTitle, colType, colStatus, colConfidence, colDate, colActions])
countLabel = TextContent("" + @Count(sorted) + " atividade(s)", "small")
emptyState = @Count(sorted) > 0 ? tbl : TextContent("Nenhuma atividade encontrada.")
tableSection = Card([CardHeader("Atividades Acadêmicas"), countLabel, emptyState], "card", "column", "m")

editStatusSelect = FormControl("Novo Status", Select("editStatus", [SelectItem("pendente", "Pendente"), SelectItem("concluido", "Concluído"), SelectItem("descartado", "Descartado")], null, null, $editStatus))
saveBtn = Button("Salvar", Action([@Run(updateResult), @Run(activitiesQ), @Set($showEdit, false)]), "primary")
cancelBtn = Button("Cancelar", Action([@Set($showEdit, false)]), "secondary")
editForm = Form("editStatusForm", Buttons([saveBtn, cancelBtn]), [editStatusSelect])
editModal = Modal("Alterar Status", $showEdit, [editForm])

extractStatus = extractResult.status == "error" ? Callout("error", "Erro na extração", extractResult.error) : extractResult.status == "success" ? Callout("success", "Extração concluída", "Atividades: " + extractResult.data.activities_extracted + ". Mensagens processadas: " + extractResult.data.messages_processed + ". Tokens: " + extractResult.data.total_tokens_used) : null

root = Stack([header, kpiRow, filterRow, tableSection, extractStatus, editModal])
`;

export function Dashboard() {
  return <Renderer library={openuiLibrary} response={dashboardProgram} toolProvider={toolProvider} />;
}
