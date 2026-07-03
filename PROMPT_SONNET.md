Generate a single OpenUI Lang string for a complete academic dashboard called "Ads Painel". The dashboard monitors academic deadlines extracted from WhatsApp messages for an ADS (Análise e Desenvolvimento de Sistemas) class.

Output ONLY the OpenUI Lang code, starting with `root = Stack(...)`. Use the `openuiLibrary` component set (root=Stack). Embed realistic sample data inline — no database, no tools, no MCP.

## Layout structure

- **Left sidebar** navigation with 4 buttons (Home, Painel, Mensagens, Status)
- **Main content area** showing the currently selected page
- Navigation uses `@ToAssistant(...)` actions to switch pages

## Theme / Visual

- Grayscale palette (like the current Streamlit app): neutral grays for the sidebar, white cards with gray borders, muted text for captions
- Portuguese labels throughout
- Academic-professional tone, clean and readable

## Pages

### Home (page 1, default)
- Welcome header: "Bem-vindo ao Ads Painel" with subtitle "Extração automática de atividades acadêmicas via WhatsApp"
- 3 KPI cards in a row: Total de Atividades (42), Mensagens Processadas (318), Extrações Realizadas (6). Each with a relevant Tag.
- Recent activities table: 5 rows with columns Atividade, Prazo, Confiança (as colored Tags), Status (as colored Tags). Example data: Prova de Cálculo II (15/06), Entrega Relatório Lab (18/06), Seminário Eletivo (20/06), Lista de Exercícios 4 (22/06), Defesa de TCC (30/06). Mix of Tags: alta/média/baixa confidence, pendente/concluído status.

### Painel (page 2)
- Header: "Painel de Atividades" with subtitle "Gerencie e acompanhe suas atividades acadêmicas"
- Controls row: filter dropdown (Todos/Pendente/Concluído/Descartado) + "⟳ Atualizar Extração" primary button
- Activity cards list (5 sample cards). Each card is a row with:
  - Left: activity title (bold) + due date + origin group ("Grupo Alunos" or "Grupo Professores")
  - Right: confidence Tag + status Tag + "Concluir" secondary button + "Descartar" tertiary destructive button
- Pagination row: ← Anterior | Página 1 de 4 | Próxima →

### Mensagens (page 3)
- Header: "Mensagens WhatsApp" with subtitle "Histórico bruto de mensagens capturadas"
- Filter row: group dropdown (Todos os Grupos/Grupo Alunos/Grupo Professores) + caption
- Table: 8 rows with columns Horário, Grupo (as Tag), Remetente, Mensagem, Processado (sim/não Tag)
- Pagination: ← Anterior | Página 1 de 40 | Próxima →

### Status (page 4)
- Header: "Status do Sistema"
- 4 metric cards in a row:
  - Tokens na Sessão (12.480, with "75% disponível" + saudável Tag)
  - Custo Estimado ($0.024, with "modelo: deepseek-v4-flash" + baixo Tag)
  - Mensagens Restantes (276, with "próx. lote: 30 msgs" + pronto Tag)
  - Última Extração (12min atrás, with "14/06/2025 às 15:23" + online Tag)
- System stats table: Métrica | Valor | Observação columns. Rows: Tamanho do BD (2.4 MB), Versão do Schema (v1.0), Atividades Extraídas (42), Taxa de Confiança Alta (61%), Uptime (99.7%).

## OpenUI Lang patterns to use

- `Stack([...], "row"|"column", gap)` for layout
- `Card([...], "card"|"sunk", ...)` for containers (sunk for inner/nested cards)
- `CardHeader("title", "subtitle")` for section headers
- `TextContent("text", "small"|"small-heavy"|"large-heavy")` for text
- `Tag("label", null, "sm", "success"|"info"|"warning"|"danger"|"neutral")` for badges
- `Table([Col(...), ...])` for data tables
- `Separator("horizontal", true)` for dividers
- `Button("label", Action([@ToAssistant("action")]), "primary"|"secondary"|"tertiary", "normal"|"destructive", "small")`
- `Select(...)` / `SelectItem(...)` for dropdowns
- `Card([...], "card", "column", "m")` for main page wrappers
- Use `@ToAssistant("show home page")` style nav switching

Generate the complete single string. Start with `root = Stack(...)`. No markdown fences around it — just the raw OpenUI Lang.
