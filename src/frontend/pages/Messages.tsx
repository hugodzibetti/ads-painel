import { Renderer } from '@openuidev/react-lang';
import { openuiLibrary } from '../library';
import { toolProvider } from '../toolProvider';

// Search re-queries the server (search is supported server-side); sorting is
// done client-side via @Sort. No pagination builtin exists for arbitrary
// arrays, so the full (search-narrowed) result set renders as a scrollable
// card feed, same as @Each is used for table cells elsewhere.
const messagesProgram = `
$search = ""

messagesQ = Query("get_messages", {search: $search}, {data: []})
sorted = @Sort(messagesQ.data, "timestamp", "desc")

searchBox = FormControl("Buscar", Input("search", "Buscar mensagens por autor ou conteúdo...", "text", null, $search))
countLabel = TextContent("" + @Count(sorted) + " mensagem(ns)", "small")

feedList = Stack(@Each(sorted, "m", Card([Stack([TextContent(m.author, "small-heavy"), TextContent(m.timestamp, "small"), Tag(m.group_label, null, "sm", m.group_label == "profs" ? "warning" : "info")], "row", "s", "center"), TextContent(m.body == null ? "[Mensagem vazia]" : m.body), Stack([Tag(m.processed == 1 ? "Processada" : "Não processada", null, "sm", m.processed == 1 ? "success" : "warning"), TextContent("ID: " + m.id + " (WA: " + m.wa_message_id + ")", "small")], "row", "s", "center")], "clear", "column", "s")), "column", "m")

emptyState = @Count(sorted) > 0 ? feedList : TextContent("Nenhuma mensagem encontrada.")

root = Stack([CardHeader("Mensagens", "Feed de mensagens dos grupos do WhatsApp"), searchBox, countLabel, emptyState])
`;

export function Messages() {
  return <Renderer library={openuiLibrary} response={messagesProgram} toolProvider={toolProvider} />;
}
