import { Renderer } from '@openuidev/react-lang';
import { openuiLibrary } from '../library';
import { toolProvider } from '../toolProvider';

// Dashboard = the daily control surface. Answers, top to bottom:
//   "what changed?"  → briefing + Atualizar button
//   "how heavy is the week?" → per-day deadline heatmap
//   "what needs me now?" → review callouts + actionable table
//   "what's coming?" → Mais Adiante
// The review Modal is the one place delivery drafts get approved / regenerated / ignored.
const dashboardProgram = `
$showReview = false
$showToast = false
$reviewId = ""
$reviewDraft = ""
$reviewMethod = ""
$showGuidance = false
$guidanceText = ""

briefingQ = Query("get_briefing", {}, {content: "Carregando...", minutes_ago: null})
stats = Query("get_stats", {}, {last_extraction_minutes_ago: null, deadline_density: {seg:0,ter:0,qua:0,qui:0,sex:0,sab:0,dom:0}}, 60)
weekQ = Query("get_activities", {urgency: "urgent", status: "pendente"}, {data: []})
futureQ = Query("get_activities", {urgency: "future", status: "pendente"}, {data: []})
reviewQ = Query("get_activities", {status: "pendente"}, {data: []})

weekSorted = @Sort(weekQ.data, "due_date", "asc")
futureSorted = @Sort(futureQ.data, "due_date", "asc")
pendingReview = @Filter(reviewQ.data, "delivery_stage", "==", "pending_review")
needsMethod = @Filter(reviewQ.data, "delivery_stage", "==", "needs_method")

runExtract = Mutation("run_extraction", {})
markDone = Mutation("update_activity_status", {id: $reviewId, status: "concluido"})
approveDelivery = Mutation("update_activity_delivery", {id: $reviewId, delivery_draft: $reviewDraft, action: "approve"})
regenDelivery = Mutation("update_activity_delivery", {id: $reviewId, delivery_instructions: $guidanceText, action: "regenerate"})
ignoreDelivery = Mutation("update_activity_delivery", {id: $reviewId, action: "ignore"})

refreshAll = Action([@Run(runExtract), @Set($showToast, true), @Run(briefingQ), @Run(stats), @Run(weekQ), @Run(futureQ), @Run(reviewQ)])
refreshBtn = Button("Atualizar", refreshAll, "primary", "normal", "small")
lastRunLabel = stats.last_extraction_minutes_ago == null ? "nunca" : "ha " + stats.last_extraction_minutes_ago + " min"
titleBlock = Stack([TextContent("ADS Panel", "large-heavy"), TextContent("Ultima extracao: " + lastRunLabel, "small")], "column", "none")
header = Stack([titleBlock, refreshBtn], "row", "m", "center", "between")

toast = Callout("success", "Painel atualizado", "Novas mensagens processadas e prazos recalculados.", $showToast)
briefingCard = Callout("info", "Resumo do dia", briefingQ.content)

densityRow = Stack([
  Stack([TextContent("Seg", "small"), Tag("" + stats.deadline_density.seg, null, "sm", stats.deadline_density.seg > 2 ? "danger" : stats.deadline_density.seg > 0 ? "warning" : "neutral")], "column", "s", "center"),
  Stack([TextContent("Ter", "small"), Tag("" + stats.deadline_density.ter, null, "sm", stats.deadline_density.ter > 2 ? "danger" : stats.deadline_density.ter > 0 ? "warning" : "neutral")], "column", "s", "center"),
  Stack([TextContent("Qua", "small"), Tag("" + stats.deadline_density.qua, null, "sm", stats.deadline_density.qua > 2 ? "danger" : stats.deadline_density.qua > 0 ? "warning" : "neutral")], "column", "s", "center"),
  Stack([TextContent("Qui", "small"), Tag("" + stats.deadline_density.qui, null, "sm", stats.deadline_density.qui > 2 ? "danger" : stats.deadline_density.qui > 0 ? "warning" : "neutral")], "column", "s", "center"),
  Stack([TextContent("Sex", "small"), Tag("" + stats.deadline_density.sex, null, "sm", stats.deadline_density.sex > 2 ? "danger" : stats.deadline_density.sex > 0 ? "warning" : "neutral")], "column", "s", "center"),
  Stack([TextContent("Sab", "small"), Tag("" + stats.deadline_density.sab, null, "sm", stats.deadline_density.sab > 2 ? "danger" : stats.deadline_density.sab > 0 ? "warning" : "neutral")], "column", "s", "center"),
  Stack([TextContent("Dom", "small"), Tag("" + stats.deadline_density.dom, null, "sm", stats.deadline_density.dom > 2 ? "danger" : stats.deadline_density.dom > 0 ? "warning" : "neutral")], "column", "s", "center")
], "row", "m", "end", "between")
densityCard = Card([CardHeader("Carga da semana", "Prazos por dia nos proximos 7 dias"), densityRow], "card", "column", "m")

reviewCallout = @Count(pendingReview) > 0 ? Callout("warning", "Prontas para entregar", "" + @Count(pendingReview) + " atividade(s) com rascunho aguardando sua aprovacao.") : null
needsMethodCallout = @Count(needsMethod) > 0 ? Callout("neutral", "Falta o metodo de entrega", "" + @Count(needsMethod) + " atividade(s) sem instrucoes — abra e diga como entregar.") : null

colPrazo = Col("Prazo", @Each(weekSorted, "a", Tag(a.urgency_label, null, "sm", a.urgency_color)))
colAtiv = Col("Atividade", weekSorted.title)
colEntrega = Col("Entrega", @Each(weekSorted, "a", Tag(a.delivery_stage, null, "sm", a.delivery_stage == "pending_review" ? "danger" : a.delivery_stage == "needs_method" ? "warning" : a.delivery_stage == "done" ? "success" : a.delivery_stage == "failed" ? "danger" : a.delivery_stage == "delivering" ? "info" : a.delivery_stage == "gathering" ? "info" : "neutral")))
colAcoes = Col("Acoes", @Each(weekSorted, "a", Stack([Button("Feito", Action([@Set($reviewId, a.id), @Run(markDone), @Run(weekQ), @Run(reviewQ)]), "secondary", "normal", "extra-small"), Button("Revisar", Action([@Set($reviewId, a.id), @Set($reviewDraft, a.delivery_draft), @Set($reviewMethod, a.delivery_method), @Set($showGuidance, false), @Set($showReview, true)]), "primary", "normal", "extra-small")], "row", "s")))
weekTable = Table([colPrazo, colAtiv, colEntrega, colAcoes])
weekSection = Card([CardHeader("Para revisar e entregar", "Atividades com prazo nos proximos 7 dias"), @Count(weekSorted) > 0 ? weekTable : TextContent("Nada urgente. Tudo em dia por aqui.")], "card", "column", "m")

futureItems = @Each(futureSorted, "a", Card([Stack([TextContent(a.title, "small-heavy"), Tag(a.urgency_label, null, "sm", a.urgency_color)], "row", "s", "center", "between"), TextContent(a.description == null ? "" : a.description, "small")], "clear", "column", "s"))
futureSection = @Count(futureSorted) > 0 ? Card([CardHeader("Mais adiante", "Prazos alem dos proximos 7 dias"), Stack(futureItems, "column", "s")], "sunk", "column", "m") : null

draftArea = FormControl("Rascunho da entrega", TextArea("reviewDraft", "Conteudo que sera enviado...", 6, null, $reviewDraft))
guidanceArea = FormControl("Como entregar / o que ajustar", TextArea("guidanceText", "Ex: enviar como PDF pelo Forms, incluir a introducao...", 3, null, $guidanceText))
methodInfo = TextContent("Metodo detectado: " + $reviewMethod, "small")
approveBtn = Button("Aprovar e entregar", Action([@Run(approveDelivery), @Set($showReview, false), @Run(weekQ), @Run(reviewQ)]), "primary")
regenBtn = Button("Regenerar rascunho", Action([@Run(regenDelivery), @Run(weekQ), @Run(reviewQ)]), "secondary")
guidanceBtn = Button("Dar contexto", Action([@Set($showGuidance, true)]), "tertiary")
ignoreBtn = Button("Ignorar entrega", Action([@Run(ignoreDelivery), @Set($showReview, false), @Run(weekQ), @Run(reviewQ)]), "tertiary", "destructive")
reviewForm = Form("reviewForm", Buttons([approveBtn, regenBtn, guidanceBtn, ignoreBtn]), [draftArea, $showGuidance ? guidanceArea : null])
reviewModal = Modal("Revisar entrega", $showReview, [methodInfo, reviewForm])

root = Stack([header, toast, briefingCard, densityCard, reviewCallout, needsMethodCallout, weekSection, futureSection, reviewModal], "column", "m")
`;

export function Dashboard() {
  return <Renderer library={openuiLibrary} response={dashboardProgram} toolProvider={toolProvider} />;
}
