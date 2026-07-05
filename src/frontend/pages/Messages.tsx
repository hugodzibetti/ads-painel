import { Renderer } from '@openuidev/react-lang';
import { openuiLibrary } from '../library';
import { toolProvider } from '../toolProvider';

// Raw feed of what the bot captured from both WhatsApp groups — the audit trail
// behind every extracted activity. Search hits the server (author/body); group and
// processed filters are client-side @Filter over the search-narrowed set. Sorted
// newest-first, rendered as a scrollable card feed (no table: bodies vary wildly in length).
const messagesProgram = `
$search = ""
$group = "all"
$proc = "all"

messagesQ = Query("get_messages", {search: $search}, {data: []})
byGroup = $group == "all" ? messagesQ.data : @Filter(messagesQ.data, "group_label", "==", $group)
byProc = $proc == "all" ? byGroup : @Filter(byGroup, "processed", "==", $proc == "sim" ? 1 : 0)
sorted = @Sort(byProc, "timestamp", "desc")

searchField = FormControl("Buscar", Input("search", "Autor ou conteudo...", "text", null, $search))
groupField = FormControl("Grupo", Select("group", [SelectItem("all", "Todos os grupos"), SelectItem("alunos", "Alunos"), SelectItem("profs", "Professores")], null, null, $group))
procField = FormControl("Processamento", Select("proc", [SelectItem("all", "Todas"), SelectItem("sim", "Processadas"), SelectItem("nao", "Na fila")], null, null, $proc))
filters = Stack([searchField, groupField, procField], "row", "m", "end", "start", true)

countLabel = TextContent("" + @Count(sorted) + " mensagem(ns)", "small")

feedItems = @Each(sorted, "m", Card([
  Stack([
    Stack([TextContent(m.author, "small-heavy"), TextContent(m.timestamp, "small")], "column", "none"),
    Stack([
      Tag(m.group_label == "profs" ? "professores" : "alunos", null, "sm", m.group_label == "profs" ? "warning" : "info"),
      m.activity_count > 0 ? Tag("" + m.activity_count + " atividade(s)", null, "sm", "success") : TextContent(""),
      Tag(m.processed == 1 ? "processada" : "na fila", null, "sm", m.processed == 1 ? "neutral" : "warning")
    ], "row", "s", "center")
  ], "row", "m", "start", "between"),
  TextContent(m.body == null ? "[sem texto — anexo ou midia]" : m.body)
], "sunk", "column", "s"))

feed = @Count(sorted) > 0 ? Stack(feedItems, "column", "m") : TextContent("Nenhuma mensagem encontrada. Ajuste os filtros ou rode uma extracao.")

root = Card([CardHeader("Mensagens", "Feed bruto dos grupos do WhatsApp"), filters, countLabel, feed], "card", "column", "m")
`;

export function Messages() {
  return <Renderer library={openuiLibrary} response={messagesProgram} toolProvider={toolProvider} />;
}
