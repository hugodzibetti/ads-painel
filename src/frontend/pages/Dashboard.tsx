import { Renderer } from '@openuidev/react-lang';
import { openuiLibrary } from '../library';
import { toolProvider } from '../toolProvider';

const dashboardProgram = `
$showReview = false
$reviewId = ""
$reviewDraft = ""
$reviewMethod = ""
$reviewCtx = ""
$guidanceText = ""
$showGuidance = false

briefingQ = Query("get_briefing", {}, {content: "Carregando...", minutes_ago: null})
stats = Query("get_stats", {}, {last_extraction_minutes_ago: null, deadline_density: {seg:0,ter:0,qua:0,qui:0,sex:0,sab:0,dom:0}}, 60)
weekQ = Query("get_activities", {urgency: "urgent", status: "pendente"}, {data: []})
futureQ = Query("get_activities", {urgency: "future", status: "pendente"}, {data: []})
reviewQ = Query("get_activities", {status: "pendente"}, {data: []})

weekSorted = @Sort(weekQ.data, "due_date", "asc")
futureSorted = @Sort(futureQ.data, "due_date", "asc")
pendingReview = @Filter(reviewQ.data, "delivery_stage", "==", "pending_review")
needsMethod = @Filter(reviewQ.data, "delivery_stage", "==", "needs_method")

updateDelivery = Mutation("update_activity_delivery", {id: $reviewId, delivery_draft: $reviewDraft, action: "approve"})
regenDelivery = Mutation("update_activity_delivery", {id: $reviewId, delivery_instructions: $guidanceText, action: "regenerate"})
markDone = Mutation("update_activity_status", {id: $reviewId, status: "concluido"})
markIgnored = Mutation("update_activity_delivery", {id: $reviewId, action: "ignore"})

lastRunLabel = stats.last_extraction_minutes_ago == null ? "nunca" : "" + stats.last_extraction_minutes_ago + "min atras"
header = Stack([TextContent("ADS Panel", "large-heavy"), TextContent("auto - ultima: " + lastRunLabel, "small")], "row", "none", "center", "between")

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
densityCard = Card([CardHeader("Prazo esta semana"), densityRow], "card", "column", "m")

reviewCallout = @Count(pendingReview) > 0 ? Callout("warning", "Revisao pendente", "" + @Count(pendingReview) + " atividade(s) prontas para entrega — abra a atividade para revisar") : null
needsMethodCallout = @Count(needsMethod) > 0 ? Callout("warning", "Como entregar?", "" + @Count(needsMethod) + " atividade(s) precisam de instrucoes de entrega") : null

colPrazo = Col("Prazo", @Each(weekSorted, "a", Tag(a.urgency_label, null, "sm", a.urgency_color)))
colAtiv = Col("Atividade", weekSorted.title)
colEntrega = Col("Entrega", @Each(weekSorted, "a", Tag(a.delivery_stage, null, "sm", a.delivery_stage == "pending_review" ? "danger" : a.delivery_stage == "needs_method" ? "warning" : a.delivery_stage == "gathering" ? "info" : a.delivery_stage == "done" ? "success" : a.delivery_stage == "delivering" ? "info" : a.delivery_stage == "failed" ? "danger" : "neutral")))
colAcoes = Col("Acoes", @Each(weekSorted, "a", Stack([Button("Feito", Action([@Set($reviewId, a.id), @Run(markDone), @Run(weekQ)]), "secondary", "normal", "extra-small"), Button("Revisar", Action([@Set($reviewId, a.id), @Set($reviewDraft, a.delivery_draft), @Set($reviewMethod, a.delivery_method), @Set($reviewCtx, a.delivery_context), @Set($showReview, true)]), "primary", "normal", "extra-small")], "row", "s")))
weekTable = Table([colPrazo, colAtiv, colEntrega, colAcoes])
weekEmpty = TextContent("Nenhuma atividade urgente esta semana.")
weekSection = Card([CardHeader("Esta Semana"), @Count(weekSorted) > 0 ? weekTable : weekEmpty], "card", "column", "m")

futureItems = @Each(futureSorted, "a", Card([Stack([TextContent(a.urgency_label + " — " + a.title, "small-heavy"), Tag(a.delivery_stage, null, "sm", a.delivery_stage == "pending_review" ? "danger" : a.delivery_stage == "needs_method" ? "warning" : "neutral")], "row", "s", "center", "between"), TextContent(a.description == null ? "" : a.description, "small")], "clear", "column", "s"))
futureSection = @Count(futureSorted) > 0 ? Card([CardHeader("Mais Adiante"), Stack(futureItems, "column", "s")], "sunk", "column", "m") : null

draftArea = FormControl("Rascunho", Input("reviewDraft", "Conteudo da submissao...", "text", null, $reviewDraft))
methodInfo = TextContent("Metodo: " + $reviewMethod, "small")
guidanceArea = $showGuidance ? FormControl("Orientacao", Input("guidanceText", "Explique como entregar...", "text", null, $guidanceText)) : null
approveBtn = Button("Aprovar e Entregar", Action([@Run(updateDelivery), @Set($showReview, false), @Run(weekQ), @Run(reviewQ)]), "primary")
regenBtn = Button("Regenerar", Action([@Run(regenDelivery), @Run(weekQ)]), "secondary")
guidanceBtn = Button("Dar contexto", Action([@Set($showGuidance, true)]), "secondary")
cancelBtn = Button("Cancelar", Action([@Set($showReview, false)]), "secondary")
reviewForm = Form("reviewForm", Buttons([approveBtn, regenBtn, guidanceBtn, cancelBtn]), [draftArea, $showGuidance ? guidanceArea : null])
reviewModal = Modal("Revisar entrega", $showReview, [methodInfo, reviewForm])

root = Stack([header, briefingCard, densityCard, reviewCallout, needsMethodCallout, weekSection, futureSection, reviewModal])
`;

export function Dashboard() {
  return <Renderer library={openuiLibrary} response={dashboardProgram} toolProvider={toolProvider} />;
}
