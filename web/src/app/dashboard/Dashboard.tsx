"use client";

import { useCallback, useRef, useState } from "react";
import { Renderer } from "@openuidev/react-lang";
import { library } from "@/lib/library";

type Page = "home" | "painel" | "mensagens" | "status";

const SIDEBAR = `
sidebar = Card([sidebarHeader, sep0, navHome, navPainel, navMensagens, navStatus], "sunk", "column", "s", "stretch", "start")
sidebarHeader = TextContent("📚 Ads Painel", "small-heavy")
sep0 = Separator("horizontal", true)
navHome = Button("🏠 Home", Action([@ToAssistant("show home page")]), "tertiary", "normal", "small")
navPainel = Button("📋 Painel", Action([@ToAssistant("show painel page")]), "tertiary", "normal", "small")
navMensagens = Button("💬 Mensagens", Action([@ToAssistant("show mensagens page")]), "tertiary", "normal", "small")
navStatus = Button("⚙️ Status", Action([@ToAssistant("show status page")]), "tertiary", "normal", "small")
`;

const HOME_PAGE = `
homePage = Stack([homeHeader, kpiRow, recentSection], "column", "m")
homeHeader = CardHeader("Bem-vindo ao Ads Painel", "Extração automática de atividades acadêmicas via WhatsApp")
kpiRow = Stack([kpi1, kpi2, kpi3], "row", "m", "stretch")
kpi1 = Card([TextContent("Total de Atividades", "small"), TextContent("42", "large-heavy"), Tag("ativo", null, "sm", "success")], "card", "column", "s", "center")
kpi2 = Card([TextContent("Mensagens Processadas", "small"), TextContent("318", "large-heavy"), Tag("processado", null, "sm", "info")], "card", "column", "s", "center")
kpi3 = Card([TextContent("Extrações Realizadas", "small"), TextContent("6", "large-heavy"), Tag("completo", null, "sm", "neutral")], "card", "column", "s", "center")
recentSection = Card([CardHeader("Atividades Recentes", "Últimas atividades extraídas das mensagens"), Table([Col("Atividade", ["Prova de Cálculo II", "Entrega Relatório Lab", "Seminário Eletivo", "Lista de Exercícios 4", "Defesa de TCC"]), Col("Prazo", ["15/06/2025", "18/06/2025", "20/06/2025", "22/06/2025", "30/06/2025"]), Col("Confiança", [Tag("alta", null, "sm", "success"), Tag("alta", null, "sm", "success"), Tag("média", null, "sm", "warning"), Tag("baixa", null, "sm", "danger"), Tag("alta", null, "sm", "success")]), Col("Status", [Tag("pendente", null, "sm", "warning"), Tag("concluído", null, "sm", "success"), Tag("pendente", null, "sm", "warning"), Tag("pendente", null, "sm", "warning"), Tag("pendente", null, "sm", "info")])])], "card", "column", "m")
`;

const PAINEL_PAGE = `
painelPage = Stack([dashHeader, dashSep, dashControls, dashCards, dashPagination], "column", "m")
dashHeader = Card([Stack([TextContent("Painel de Atividades", "large-heavy"), TextContent("Gerencie e acompanhe suas atividades extraídas", "small")], "column", "none")], "clear", "row", "none", "center", "between")
dashSep = Separator("horizontal", true)
dashControls = Stack([TextContent("Filtrar:", "small-heavy"), Select("filtro", [SelectItem("todos", "Todos"), SelectItem("pendente", "Pendente"), SelectItem("concluido", "Concluído"), SelectItem("descartado", "Descartado")], "Todos", null, null, "medium"), Button("⟳ Atualizar Extração", Action([@ToAssistant("Atualizar extração")]), "primary")], "row", "none", "center", "start")
dashCards = Stack([actCard1, actCard2, actCard3, actCard4, actCard5], "column", "s")
actCard1 = Card([Stack([Stack([TextContent("Prova de Cálculo II", "small-heavy"), TextContent("📅 Vencimento: 15 Jun", "small"), Tag("Grupo Alunos", null, "sm", "info")], "column", "xs"), Stack([Stack([Tag("alta", null, "sm", "success"), Tag("pendente", null, "sm", "warning")], "row", "xs", "center"), Buttons([Button("Concluir", Action([@ToAssistant("Concluir Prova de Cálculo II")]), "secondary", "normal", "small"), Button("Descartar", Action([@ToAssistant("Descartar Prova de Cálculo II")]), "tertiary", "destructive", "small")], "row")], "row", "s", "center", "end")], "row", "none", "center", "between")], "card", "row", "none", "center", "between")
actCard2 = Card([Stack([Stack([TextContent("Entrega Relatório Lab", "small-heavy"), TextContent("📅 Vencimento: 18 Jun", "small"), Tag("Grupo Professores", null, "sm", "neutral")], "column", "xs"), Stack([Stack([Tag("alta", null, "sm", "success"), Tag("pendente", null, "sm", "warning")], "row", "xs", "center"), Buttons([Button("Concluir", Action([@ToAssistant("Concluir Entrega Relatório Lab")]), "secondary", "normal", "small"), Button("Descartar", Action([@ToAssistant("Descartar Entrega Relatório Lab")]), "tertiary", "destructive", "small")], "row")], "row", "s", "center", "end")], "row", "none", "center", "between")], "card", "row", "none", "center", "between")
actCard3 = Card([Stack([Stack([TextContent("Seminário Eletivo", "small-heavy"), TextContent("📅 Vencimento: 20 Jun", "small"), Tag("Grupo Alunos", null, "sm", "info")], "column", "xs"), Stack([Stack([Tag("média", null, "sm", "warning"), Tag("pendente", null, "sm", "warning")], "row", "xs", "center"), Buttons([Button("Concluir", Action([@ToAssistant("Concluir Seminário Eletivo")]), "secondary", "normal", "small"), Button("Descartar", Action([@ToAssistant("Descartar Seminário Eletivo")]), "tertiary", "destructive", "small")], "row")], "row", "s", "center", "end")], "row", "none", "center", "between")], "card", "row", "none", "center", "between")
actCard4 = Card([Stack([Stack([TextContent("Lista Exercícios Física", "small-heavy"), TextContent("📅 Vencimento: 22 Jun", "small"), Tag("Grupo Alunos", null, "sm", "info")], "column", "xs"), Stack([Stack([Tag("baixa", null, "sm", "danger"), Tag("pendente", null, "sm", "warning")], "row", "xs", "center"), Buttons([Button("Concluir", Action([@ToAssistant("Concluir Lista Exercícios Física")]), "secondary", "normal", "small"), Button("Descartar", Action([@ToAssistant("Descartar Lista Exercícios Física")]), "tertiary", "destructive", "small")], "row")], "row", "s", "center", "end")], "row", "none", "center", "between")], "card", "row", "none", "center", "between")
actCard5 = Card([Stack([Stack([TextContent("Defesa TCC", "small-heavy"), TextContent("📅 Vencimento: 30 Jun", "small"), Tag("Grupo Professores", null, "sm", "neutral")], "column", "xs"), Stack([Stack([Tag("média", null, "sm", "warning"), Tag("concluído", null, "sm", "success")], "row", "xs", "center"), Buttons([Button("Reabrir", Action([@ToAssistant("Reabrir Defesa TCC")]), "secondary", "normal", "small"), Button("Descartar", Action([@ToAssistant("Descartar Defesa TCC")]), "tertiary", "destructive", "small")], "row")], "row", "s", "center", "end")], "row", "none", "center", "between")], "card", "row", "none", "center", "between")
dashPagination = Card([Button("← Anterior", Action([@ToAssistant("Página anterior")]), "secondary", "normal", "small"), TextContent("Página 1 de 4", "small"), Button("Próxima →", Action([@ToAssistant("Próxima página")]), "secondary", "normal", "small")], "clear", "row", "none", "center", "center")
`;

const MENSAGENS_PAGE = `
mensagensPage = Stack([msgHeader, msgSep, msgFilters, msgTable, msgPagination], "column", "m")
msgHeader = Card([Stack([TextContent("Mensagens", "large-heavy"), TextContent("Visualize e monitore todas as mensagens recebidas dos grupos conectados.", "small")], "column", "xs")], "clear", "column", "xs")
msgSep = Separator("horizontal", true)
msgFilters = Stack([Select("grupo", [SelectItem("todos", "Todos os Grupos"), SelectItem("alunos", "Grupo Alunos"), SelectItem("professores", "Grupo Professores")], "Todos os Grupos"), TextContent("318 mensagens · 42 processadas hoje", "small")], "row", "m", "center")
msgTable = Card([Table([Col("Horário", ["08:02", "08:17", "08:34", "09:05", "09:41", "10:12", "10:58", "11:30"], "string"), Col("Grupo", [Tag("Alunos", null, "sm", "info"), Tag("Professores", null, "sm", "neutral"), Tag("Alunos", null, "sm", "info"), Tag("Alunos", null, "sm", "info"), Tag("Professores", null, "sm", "neutral"), Tag("Professores", null, "sm", "neutral"), Tag("Alunos", null, "sm", "info"), Tag("Professores", null, "sm", "neutral")]), Col("Remetente", ["Lucas Ferreira", "Prof. Ana Souza", "Maria Oliveira", "Pedro Henrique", "Prof. Carlos Lima", "Prof. Beatriz Costa", "Júlia Mendes", "Prof. Roberto Alves"], "string"), Col("Mensagem", ["Gente, alguém sabe se o prazo da entrega do TCC foi prorrogado?", "Lembrando a todos que a data limite para envio das notas é sexta-feira.", "Oi! Não consegui acessar o portal para entregar o trabalho de cálculo 😥", "A apresentação do seminário de hoje foi cancelada ou só adiada?", "Por favor, confirme presença na reunião pedagógica de amanhã às 14h.", "O sistema de lançamento de notas está fora do ar, já reportei ao TI.", "Alguém tem o material da aula de ontem? Perdi o link do Drive!", "Reforçando: prazo final para revisão de provas termina hoje às 23h59."], "string"), Col("Processado", [Tag("Sim", null, "sm", "success"), Tag("Sim", null, "sm", "success"), Tag("Não", null, "sm", "neutral"), Tag("Sim", null, "sm", "success"), Tag("Sim", null, "sm", "success"), Tag("Não", null, "sm", "neutral"), Tag("Não", null, "sm", "neutral"), Tag("Sim", null, "sm", "success")])])], "card", "column", "none")
msgPagination = Stack([Button("← Anterior", Action([@ToAssistant("Página anterior de mensagens")]), "secondary", "normal", "small"), TextContent("Página 1 de 40", "small"), Button("Próxima →", Action([@ToAssistant("Próxima página de mensagens")]), "secondary", "normal", "small")], "row", "s", "center", "center")
`;

const STATUS_PAGE = `
statusPage = Stack([CardHeader("Status do Sistema", "Monitoramento em tempo real do Ads Painel"), Separator("horizontal", true), Stack([kpiStat1, kpiStat2, kpiStat3, kpiStat4], "row", "m", "stretch", "start", true), Separator("horizontal", true), Card([CardHeader("Estatísticas do Sistema", "Visão geral dos recursos e desempenho"), Table([Col("Métrica", ["Tamanho do BD", "Versão do Schema", "Atividades Extraídas", "Taxa de Confiança Alta", "Uptime do Serviço"], "string"), Col("Valor", ["2.4 MB", "v1.0", "42", "61%", "99.7%"], "string"), Col("Observação", [Tag("normal", null, "sm", "neutral"), Tag("atualizado", null, "sm", "success"), Tag("últimas 48h", null, "sm", "info"), Tag("acima da meta", null, "sm", "success"), Tag("estável", null, "sm", "success")])])], "sunk")])
kpiStat1 = Card([TextContent("Tokens na Sessão", "small"), TextContent("12.480", "large-heavy"), TextContent("limite: 100.000 / sessão", "small"), Stack([TextContent("75% disponível", "small"), Tag("saudável", null, "sm", "success")], "row", "s", "center", "between")], "sunk", "column", "s")
kpiStat2 = Card([TextContent("Custo Estimado", "small"), TextContent("$0.024", "large-heavy"), TextContent("modelo: deepseek-v4-flash", "small"), Stack([TextContent("precificação por token", "small"), Tag("baixo", null, "sm", "success")], "row", "s", "center", "between")], "sunk", "column", "s")
kpiStat3 = Card([TextContent("Mensagens Restantes", "small"), TextContent("276", "large-heavy"), TextContent("de 318 total capturadas", "small"), Stack([TextContent("próx. lote: 30 msgs", "small"), Tag("pronto", null, "sm", "info")], "row", "s", "center", "between")], "sunk", "column", "s")
kpiStat4 = Card([TextContent("Última Extração", "small"), TextContent("12min atrás", "large-heavy"), TextContent("14/06/2025 às 15:23", "small"), Stack([TextContent("status: ok", "small"), Tag("online", null, "sm", "success")], "row", "s", "center", "between")], "sunk", "column", "s")
`;

const PAGE_CODE: Record<Page, string> = {
  home: `root = Stack([sidebar, pageContent], "row", "none", "start")\npageContent = Stack([${HOME_PAGE.trim()}], "column", "m")\n${SIDEBAR.trim()}`,
  painel: `root = Stack([sidebar, pageContent], "row", "none", "start")\npageContent = Stack([${PAINEL_PAGE.trim()}], "column", "m")\n${SIDEBAR.trim()}`,
  mensagens: `root = Stack([sidebar, pageContent], "row", "none", "start")\npageContent = Stack([${MENSAGENS_PAGE.trim()}], "column", "m")\n${SIDEBAR.trim()}`,
  status: `root = Stack([sidebar, pageContent], "row", "none", "start")\npageContent = Stack([${STATUS_PAGE.trim()}], "column", "m")\n${SIDEBAR.trim()}`,
};

export default function Dashboard() {
  const [page, setPage] = useState<Page>("home");

  // Use a ref so the onAction callback doesn't cause re-render during action processing
  const setPageRef = useRef(setPage);
  setPageRef.current = setPage;

  const handleAction = useCallback(
    (event: { type: string; params?: Record<string, unknown>; humanFriendlyMessage?: string }) => {
      const msg = event.humanFriendlyMessage ?? "";
      // Delay page switch to next tick so the current Renderer finishes its action
      setTimeout(() => {
        if (msg.includes("home page")) setPageRef.current("home");
        else if (msg.includes("painel page")) setPageRef.current("painel");
        else if (msg.includes("mensagens page")) setPageRef.current("mensagens");
        else if (msg.includes("status page")) setPageRef.current("status");
      }, 0);
    },
    [],
  );

  return (
    <div>
      <style>{`
        .openui-card-sunk:first-child { max-width: 200px; min-width: 160px; flex: 0 0 auto !important; }
      `}</style>
      <Renderer
        key={page}
        library={library}
        response={PAGE_CODE[page]}
        isStreaming={false}
        onAction={handleAction}
      />
    </div>
  );
}
