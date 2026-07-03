module.exports = [
"[project]/projects/ads-painel/web/node_modules/@openuidev/lang-core/dist/index.mjs [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ACTION_NAMES",
    ()=>ACTION_NAMES,
    "ACTION_STEPS",
    ()=>ACTION_STEPS,
    "BUILTINS",
    ()=>BUILTINS,
    "BUILTIN_NAMES",
    ()=>BUILTIN_NAMES,
    "BuiltinActionType",
    ()=>BuiltinActionType,
    "LAZY_BUILTINS",
    ()=>LAZY_BUILTINS,
    "McpToolError",
    ()=>McpToolError,
    "ToolNotFoundError",
    ()=>ToolNotFoundError,
    "builtInValidators",
    ()=>builtInValidators,
    "createLibrary",
    ()=>createLibrary,
    "createParser",
    ()=>createParser,
    "createQueryManager",
    ()=>createQueryManager,
    "createStore",
    ()=>createStore,
    "createStreamingParser",
    ()=>createStreamingParser,
    "defineComponent",
    ()=>defineComponent,
    "enrichErrors",
    ()=>enrichErrors,
    "evaluate",
    ()=>evaluate,
    "evaluateElementProps",
    ()=>evaluateElementProps,
    "extractToolResult",
    ()=>extractToolResult,
    "generatePrompt",
    ()=>generatePrompt,
    "isASTNode",
    ()=>isASTNode,
    "isBuiltin",
    ()=>isBuiltin,
    "isReactiveAssign",
    ()=>isReactiveAssign,
    "isReactiveSchema",
    ()=>isReactiveSchema,
    "isRuntimeExpr",
    ()=>isRuntimeExpr,
    "jsonToOpenUI",
    ()=>jsonToOpenUI,
    "markReactive",
    ()=>markReactive,
    "mergeStatements",
    ()=>mergeStatements,
    "parse",
    ()=>parse,
    "parseRules",
    ()=>parseRules,
    "parseStructuredRules",
    ()=>parseStructuredRules,
    "resolveStateField",
    ()=>resolveStateField,
    "stripReactiveAssign",
    ()=>stripReactiveAssign,
    "tagSchemaId",
    ()=>tagSchemaId,
    "toNumber",
    ()=>toNumber,
    "validate",
    ()=>validate
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$ads$2d$painel$2f$web$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$schemas$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/ads-painel/web/node_modules/zod/v4/classic/schemas.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$ads$2d$painel$2f$web$2f$node_modules$2f$zod$2f$v4$2f$core$2f$registries$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/ads-painel/web/node_modules/zod/v4/core/registries.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$ads$2d$painel$2f$web$2f$node_modules$2f$zod$2f$v4$2f$core$2f$json$2d$schema$2d$processors$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/ads-painel/web/node_modules/zod/v4/core/json-schema-processors.js [app-ssr] (ecmascript)");
;
;
//#region src/parser/builtins.ts
/** Resolve a field path on an object. Supports dot-paths: "state.name" → obj.state.name */ function resolveField(obj, path) {
    if (!path || obj == null) return void 0;
    if (!path.includes(".")) return obj[path];
    let cur = obj;
    for (const p of path.split(".")){
        if (cur == null) return void 0;
        cur = cur[p];
    }
    return cur;
}
function toNumber(val) {
    if (typeof val === "number") return val;
    if (typeof val === "string") {
        const n = Number(val);
        return isNaN(n) ? 0 : n;
    }
    if (typeof val === "boolean") return val ? 1 : 0;
    return 0;
}
const BUILTINS = {
    Count: {
        name: "Count",
        signature: "Count(array) → number",
        description: "Returns array length",
        fn: (arr)=>Array.isArray(arr) ? arr.length : 0
    },
    First: {
        name: "First",
        signature: "First(array) → element",
        description: "Returns first element of array",
        fn: (arr)=>Array.isArray(arr) ? arr[0] ?? null : null
    },
    Last: {
        name: "Last",
        signature: "Last(array) → element",
        description: "Returns last element of array",
        fn: (arr)=>Array.isArray(arr) ? arr[arr.length - 1] ?? null : null
    },
    Sum: {
        name: "Sum",
        signature: "Sum(numbers[]) → number",
        description: "Sum of numeric array",
        fn: (arr)=>Array.isArray(arr) ? arr.reduce((a, b)=>a + toNumber(b), 0) : 0
    },
    Avg: {
        name: "Avg",
        signature: "Avg(numbers[]) → number",
        description: "Average of numeric array",
        fn: (arr)=>Array.isArray(arr) && arr.length ? arr.reduce((a, b)=>a + toNumber(b), 0) / arr.length : 0
    },
    Min: {
        name: "Min",
        signature: "Min(numbers[]) → number",
        description: "Minimum value in array",
        fn: (arr)=>Array.isArray(arr) && arr.length ? arr.reduce((acc, b)=>Math.min(acc, toNumber(b)), toNumber(arr[0])) : 0
    },
    Max: {
        name: "Max",
        signature: "Max(numbers[]) → number",
        description: "Maximum value in array",
        fn: (arr)=>Array.isArray(arr) && arr.length ? arr.reduce((acc, b)=>Math.max(acc, toNumber(b)), toNumber(arr[0])) : 0
    },
    Sort: {
        name: "Sort",
        signature: "Sort(array, field, direction?) → sorted array",
        description: "Sort array by field. Direction: \"asc\" (default) or \"desc\"",
        fn: (arr, field, dir)=>{
            if (!Array.isArray(arr)) return arr;
            const f = String(field ?? "");
            const desc = String(dir ?? "asc") === "desc";
            return [
                ...arr
            ].sort((a, b)=>{
                const av = f ? resolveField(a, f) : a;
                const bv = f ? resolveField(b, f) : b;
                const aIsNumeric = typeof av === "number" || typeof av === "string" && !isNaN(Number(av)) && av !== "";
                const bIsNumeric = typeof bv === "number" || typeof bv === "string" && !isNaN(Number(bv)) && bv !== "";
                if (aIsNumeric && bIsNumeric) {
                    const diff = toNumber(av) - toNumber(bv);
                    return desc ? -diff : diff;
                }
                const cmp = String(av ?? "").localeCompare(String(bv ?? ""));
                return desc ? -cmp : cmp;
            });
        }
    },
    Filter: {
        name: "Filter",
        signature: "Filter(array, field, operator: \"==\" | \"!=\" | \">\" | \"<\" | \">=\" | \"<=\" | \"contains\", value) → filtered array",
        description: "Filter array by field value",
        fn: (arr, field, op, value)=>{
            if (!Array.isArray(arr)) return [];
            const f = String(field ?? "");
            const o = String(op ?? "==");
            return arr.filter((item)=>{
                const v = f ? resolveField(item, f) : item;
                switch(o){
                    case "==":
                        return v == value;
                    case "!=":
                        return v != value;
                    case ">":
                        return toNumber(v) > toNumber(value);
                    case "<":
                        return toNumber(v) < toNumber(value);
                    case ">=":
                        return toNumber(v) >= toNumber(value);
                    case "<=":
                        return toNumber(v) <= toNumber(value);
                    case "contains":
                        return String(v ?? "").includes(String(value ?? ""));
                    default:
                        return false;
                }
            });
        }
    },
    Round: {
        name: "Round",
        signature: "Round(number, decimals?) → number",
        description: "Round to N decimal places (default 0)",
        fn: (n, decimals)=>{
            const num = toNumber(n);
            const d = decimals != null ? toNumber(decimals) : 0;
            const factor = Math.pow(10, d);
            return Math.round(num * factor) / factor;
        }
    },
    Abs: {
        name: "Abs",
        signature: "Abs(number) → number",
        description: "Absolute value",
        fn: (n)=>Math.abs(toNumber(n))
    },
    Floor: {
        name: "Floor",
        signature: "Floor(number) → number",
        description: "Round down to nearest integer",
        fn: (n)=>Math.floor(toNumber(n))
    },
    Ceil: {
        name: "Ceil",
        signature: "Ceil(number) → number",
        description: "Round up to nearest integer",
        fn: (n)=>Math.ceil(toNumber(n))
    }
};
/**
* Lazy builtins — these receive AST nodes (not evaluated values) and
* control their own evaluation. Handled specially in evaluator.ts.
*/ const LAZY_BUILTINS = new Set([
    "Each"
]);
const LAZY_BUILTIN_DEFS = {
    Each: {
        signature: "Each(array, varName, template)",
        description: "Evaluate template for each element. varName is the loop variable — use it ONLY inside the template expression (inline). Do NOT create a separate statement for the template."
    }
};
/** Maps parser-level action step names → runtime step type values. Single source of truth. */ const ACTION_STEPS = {
    Run: "run",
    ToAssistant: "continue_conversation",
    OpenUrl: "open_url",
    Set: "set",
    Reset: "reset"
};
/** All action expression names (steps + the Action container) */ const ACTION_NAMES = new Set([
    "Action",
    ...Object.keys(ACTION_STEPS)
]);
/** Set of builtin names for fast lookup (includes action expressions) */ const BUILTIN_NAMES = new Set([
    ...Object.keys(BUILTINS),
    ...LAZY_BUILTINS,
    ...ACTION_NAMES
]);
/** Check if a name is a builtin function (not a component) */ function isBuiltin(name) {
    return BUILTIN_NAMES.has(name);
}
/** Reserved statement-level call names — not builtins, not components */ const RESERVED_CALLS = {
    Query: "Query",
    Mutation: "Mutation"
};
/** Check if a name is a reserved statement call (Query, Mutation) */ function isReservedCall(name) {
    return name in RESERVED_CALLS;
}
//#endregion
//#region src/parser/prompt.ts
function jsonSchemaTypeStr(schema) {
    const type = schema.type;
    if (type === "string") {
        const enumVals = schema.enum;
        if (enumVals) return enumVals.map((v)=>`"${v}"`).join(" | ");
        return "string";
    }
    if (type === "number" || type === "integer") return "number";
    if (type === "boolean") return "boolean";
    if (type === "array") {
        const items = schema.items;
        if (items) return `${jsonSchemaTypeStr(items)}[]`;
        return "any[]";
    }
    if (type === "object") {
        const props = schema.properties;
        if (props && Object.keys(props).length > 0) {
            const required = schema.required ?? [];
            return `{${Object.entries(props).map(([k, v])=>{
                return `${k}${required.includes(k) ? "" : "?"}: ${jsonSchemaTypeStr(v)}`;
            }).join(", ")}}`;
        }
        return "object";
    }
    return "any";
}
/** Generate a default-values hint object for an output schema. */ function defaultForSchema(schema) {
    const type = schema.type;
    if (type === "string") return "";
    if (type === "number" || type === "integer") return 0;
    if (type === "boolean") return false;
    if (type === "array") return [];
    if (type === "object") {
        const props = schema.properties;
        if (props && Object.keys(props).length > 0) {
            const result = {};
            for (const [k, v] of Object.entries(props))result[k] = defaultForSchema(v);
            return result;
        }
        return {};
    }
    return null;
}
const PREAMBLE = `You are an AI assistant that responds using openui-lang, a declarative UI language. Your ENTIRE response must be valid openui-lang code — no markdown, no explanations, just openui-lang.`;
function syntaxRules(rootName, flags) {
    const lines = [
        "## Syntax Rules",
        "",
        "1. Each statement is on its own line: `identifier = Expression`",
        `2. \`root\` is the entry point — every program must define \`root = ${rootName}(...)\``,
        "3. Expressions are: strings (\"...\"), numbers, booleans (true/false), null, arrays ([...]), objects ({...}), or component calls TypeName(arg1, arg2, ...)",
        "4. Use references for readability: define `name = ...` on one line, then use `name` later",
        "5. EVERY variable (except root) MUST be referenced by at least one other variable. Unreferenced variables are silently dropped and will NOT render. Always include defined variables in their parent's children/items array.",
        "6. Arguments are POSITIONAL (order matters, not names). Write `Stack([children], \"row\", \"l\")` NOT `Stack([children], direction: \"row\", gap: \"l\")` — colon syntax is NOT supported and silently breaks",
        "7. Optional arguments can be omitted from the end"
    ];
    let ruleNum = 8;
    if (flags.bindings) lines.push(`${ruleNum++}. Declare mutable state with \`$varName = defaultValue\`. Components marked with \`$binding\` can read/write these. Undeclared $variables are auto-created with null default.`);
    if (flags.supportsExpressions) lines.push(`${ruleNum++}. String concatenation: \`"text" + $var + "more"\``, `${ruleNum++}. Dot member access: \`query.field\` reads a field; on arrays it extracts that field from every element`, `${ruleNum++}. Index access: \`arr[0]\`, \`data[index]\``, `${ruleNum++}. Arithmetic operators: +, -, *, /, % (work on numbers; + is string concat when either side is a string)`, `${ruleNum++}. Comparison: ==, !=, >, <, >=, <=`, `${ruleNum++}. Logical: &&, ||, ! (prefix)`, `${ruleNum++}. Ternary: \`condition ? valueIfTrue : valueIfFalse\``, `${ruleNum++}. Parentheses for grouping: \`(a + b) * c\``);
    lines.push("- Strings use double quotes with backslash escaping");
    return lines.join("\n");
}
function builtinFunctionsSection() {
    const builtinLines = Object.values(BUILTINS).map((b)=>`@${b.signature} — ${b.description}`);
    const lazyLines = Object.values(LAZY_BUILTIN_DEFS).map((b)=>`@${b.signature} — ${b.description}`);
    return `## Built-in Functions

Data functions prefixed with \`@\` to distinguish from components. These are the ONLY functions available — do NOT invent new ones.
Use @-prefixed built-in functions (@Count, @Sum, @Avg, @Min, @Max, @Round) on Query results — do NOT hardcode computed values.

${[
        ...builtinLines,
        ...lazyLines
    ].join("\n")}

Builtins compose — output of one is input to the next:
\`@Count(@Filter(data.rows, "field", "==", "val"))\` for KPIs/chart values, \`@Round(@Avg(data.rows.score), 1)\`, \`@Each(data.rows, "item", Comp(item.field))\` for per-item rendering.
Array pluck: \`data.rows.field\` extracts a field from every row → use with @Sum, @Avg, charts, tables.

IMPORTANT @Each rule: The loop variable (e.g. "item") is ONLY available inside the @Each template expression. Always inline the template — do NOT extract it to a separate statement.
CORRECT: \`Col("Actions", @Each(rows, "t", Button("Edit", Action([@Set($id, t.id)]))))\`
WRONG: \`myBtn = Button("Edit", Action([@Set($id, t.id)]))\` then \`Col("Actions", @Each(rows, "t", myBtn))\` — t is undefined in myBtn.`;
}
function querySection() {
    return `## Query — Live Data Fetching

Fetch data from available tools. Returns defaults instantly, swaps in real data when it arrives.

\`\`\`
metrics = Query("tool_name", {arg1: value, arg2: $binding}, {defaultField: 0, defaultData: []}, refreshInterval?)
\`\`\`

- First arg: tool name (string)
- Second arg: arguments object (may reference $bindings — re-fetches automatically on change)
- Third arg: default data (rendered immediately before fetch resolves)
- Fourth arg (optional): refresh interval in seconds (e.g. 30 for auto-refresh every 30s)
- Use dot access on results: metrics.totalEvents, metrics.data.day (array pluck)
- Query results must use regular identifiers: \`metrics = Query(...)\`, NOT \`$metrics = Query(...)\`
- Manual refresh: \`Button("Refresh", Action([@Run(query1), @Run(query2)]), "secondary")\` — re-fetches the listed queries
- Refresh all queries: create Action with @Run for each query`;
}
function mutationSection() {
    return `## Mutation — Write Operations

Execute state-changing tool calls (create, update, delete). Unlike Query (auto-fetches on render), Mutation fires only on button click via Action.

\`\`\`
result = Mutation("tool_name", {arg1: $binding, arg2: "value"})
\`\`\`

- First arg: tool name (string)
- Second arg: arguments object (evaluated with current $binding values at click time)
- result.status: "idle" | "loading" | "success" | "error"
- result.data: tool response on success
- result.error: error message on failure
- Mutation results use regular identifiers: \`result = Mutation(...)\`, NOT \`$result\`
- Show loading state: \`result.status == "loading" ? TextContent("Saving...") : null\``;
}
function actionSection(flags) {
    const steps = [
        "- @ToAssistant(\"message\") — Send a message to the assistant (for conversational buttons like \"Tell me more\", \"Explain this\")",
        "- @OpenUrl(\"https://...\") — Navigate to a URL"
    ];
    if (flags.bindings) steps.push("- @Set($variable, value) — Set a $variable to a specific value", "- @Reset($var1, $var2, ...) — Reset $variables to their declared defaults (e.g. @Reset($title, $priority) restores $title=\"\" and $priority=\"medium\")");
    if (flags.toolCalls) steps.unshift("- @Run(queryOrMutationRef) — Execute a Mutation or re-fetch a Query (ref must be a declared Query/Mutation)");
    const examples = [];
    if (flags.toolCalls) examples.push(`Example — mutation + refresh + reset (PREFERRED pattern):
\`\`\`
$binding = "default"
result = Mutation("tool_name", {field: $binding})
data = Query("tool_name", {}, {rows: []})
onSubmit = Action([@Run(result), @Run(data), @Reset($binding)])
\`\`\``);
    examples.push(`Example — simple nav:
\`\`\`
viewBtn = Button("View", Action([@OpenUrl("https://example.com")]))
\`\`\``);
    const rules = [
        "- Action can be assigned to a variable or inlined: Button(\"Go\", onSubmit) and Button(\"Go\", Action([...])) both work"
    ];
    if (flags.toolCalls) rules.push("- If a @Run(mutation) step fails, remaining steps are skipped (halt on failure)", "- @Run(queryRef) re-fetches the query (fire-and-forget, cannot fail)");
    return `## Action — Button Behavior

Action([@steps...]) wires button clicks to operations. Steps are @-prefixed built-in actions. Steps execute in order.
Buttons without an explicit Action prop automatically send their label to the assistant (equivalent to Action([@ToAssistant(label)])).

Available steps:
${steps.join("\n")}

${examples.join("\n\n")}

${rules.join("\n")}`;
}
function interactiveFiltersSection() {
    return `## Interactive Filters

To let the user filter data with a dropdown:
1. Declare a $variable with a default: \`$dateRange = "14"\`
2. Create a Select with name, items, and binding: \`Select("dateRange", [SelectItem("7", "Last 7 days"), ...], null, null, $dateRange)\`
3. Wrap in FormControl for a label: \`FormControl("Date Range", Select(...))\`
4. Pass $dateRange in Query args: \`Query("tool", {dateRange: $dateRange}, {defaults})\`
5. When the user changes the Select, $dateRange updates and the Query automatically re-fetches

FILTER WIRING RULE: If a $binding filter is visible in the UI, EVERY relevant Query MUST reference that $binding in its args. Never show a filter dropdown while hardcoding the query args.

Rules for $variables:
- $variables hold simple values (strings or numbers), NOT arrays or objects
- $variables must be bound to a Select/Input component via the value argument (last positional arg) to be interactive
- Queries must use regular identifiers (NOT $variables): \`metrics = Query(...)\` not \`$metrics = Query(...)\`
- **Auto-declare**: You do NOT need to explicitly declare $variables. If you use \`$foo\` without declaring it, the parser auto-creates \`$foo = null\`. You can still declare explicitly to set a default: \`$days = "14"\`

## Forms

Simple form — no $bindings needed. Field values are managed internally by the Form via the name prop:
\`\`\`
contactForm = Form("contact", submitBtn, [nameField, emailField])
nameField = FormControl("Name", Input("name", "Your name", "text", {required: true}))
emailField = FormControl("Email", Input("email", "your@email.com", "email", {required: true, email: true}))
submitBtn = Button("Submit")
\`\`\`

Use $bindings when you need to read field values elsewhere (in Action context, Query args, or conditionals). They are auto-declared:
\`\`\`
$role = "engineer"
contactForm = Form("contact", submitBtn, [nameField, emailField, roleField])
nameField = FormControl("Name", Input("name", "Enter your name", "text", {required: true}, $name))
emailField = FormControl("Email", Input("email", "Enter your email", "email", {required: true, email: true}, $email))
roleField = FormControl("Role", Select("role", [SelectItem("engineer", "Engineer"), SelectItem("designer", "Designer"), SelectItem("pm", "PM")], null, {required: true}, $role))
submitBtn = Button("Submit")
\`\`\`

For form + mutation patterns (create, refresh, reset), see the Action section example above.

IMPORTANT: Always add validation rules to form fields used with Mutations. Use OBJECT syntax: {required: true, email: true, minLength: 8}. The renderer shows error messages automatically and blocks submit when validation fails.`;
}
function editModeSection() {
    return `## Edit Mode

The runtime merges by statement name: same name = replace, new name = append.
Output ONLY statements that changed or are new. Everything else is kept automatically.

### Delete
To remove a component, update the parent to exclude it from its children array. Orphaned statements are automatically garbage-collected.
Example — remove chart: \`root = Stack([header, kpiRow, table])\` — chart is no longer in the children list, so it and any statements only it referenced are auto-deleted.

### Patch size guide
- Changing a title or label: 1 statement
- Adding a component: 2-3 statements (the new component + parent update)
- Removing a component: 1 statement (re-declare parent without the removed child)
- Adding a filter + wiring to query: 3-5 statements
- Restructuring into tabs: 5-10 statements

### Rules
- Reuse existing statement names exactly — do not rename
- Do NOT re-emit unchanged statements — the runtime keeps them
- A typical edit patch is 1-10 statements, not 20+
- If the existing code already satisfies the request, output only the root statement
- NEVER output the entire program as a patch. Only output what actually changes
- If you are about to output more than 10 statements, reconsider — most edits need fewer`;
}
function streamingRules(rootName, flags) {
    const steps = [
        `1. \`root = ${rootName}(...)\` — UI shell appears immediately`
    ];
    if (flags.supportsExpressions) {
        steps.push("2. $variable declarations — state ready for bindings");
        steps.push("3. Query statements — defaults resolve immediately so components render with data");
        steps.push("4. Component definitions — fill in with data already available");
        steps.push("5. Data values — leaf content last");
    } else {
        steps.push("2. Component definitions — fill in as they stream");
        steps.push("3. Data values — leaf content last");
    }
    return `## Hoisting & Streaming (CRITICAL)

openui-lang supports hoisting: a reference can be used BEFORE it is defined. The parser resolves all references after the full input is parsed.

During streaming, the output is re-parsed on every chunk. Undefined references are temporarily unresolved and appear once their definitions stream in. This creates a progressive top-down reveal — structure first, then data fills in.

**Recommended statement order for optimal streaming:**
${steps.join("\n")}

Always write the root = ${rootName}(...) statement first so the UI shell appears immediately, even before child data has streamed in.`;
}
function inlineModeSection() {
    return `## Inline Mode

You are in inline mode. You can respond in two ways:

### 1. Code response (when the user wants to CREATE or CHANGE the UI)
Wrap openui-lang code in triple-backtick fences. You can include explanatory text before/after:

Here's your dashboard:

\`\`\`openui-lang
root = RootComp([header, content])
header = SomeHeader("Title")
content = SomeContent("Hello world")
\`\`\`

I created a simple layout with a header.

### 2. Text-only response (when the user asks a QUESTION)
If the user asks "what is this?", "explain the chart", "how does this work", etc. — respond with plain text. Do NOT output any openui-lang code. The existing dashboard stays unchanged.

### Rules
- When the user asks for changes, output ONLY the changed/new statements in a fenced block
- When the user asks a question, respond with text only — NO code. The dashboard stays unchanged.
- The parser extracts code from fences automatically. Text outside fences is shown as chat.`;
}
function toolWorkflowSection() {
    return `## Data Workflow

When tools are available, follow this workflow:
1. FIRST: Call the most relevant tool to inspect the real data shape before generating code
2. Use Query() for READ operations (data that should stay live) — NEVER hardcode tool results as literal arrays or objects
3. Use Mutation() for WRITE operations (create, update, delete) — triggered by button clicks via Action([@Run(mutationRef)])
4. Use the real data from step 1 as condensed Query defaults (3-5 rows) so the UI renders immediately
5. Use @-prefixed builtins (@Count, @Filter, @Sort, @Sum) on Query results for KPIs and aggregations — the runtime evaluates these live on every refresh
6. Hardcoded arrays are ONLY for static display data (labels, options) where no tool exists

WRONG — you called a tool and got data back, but you inlined the results:
\`\`\`
openCount = 2
item1 = SomeComp("first item title")
item2 = SomeComp("second item title")
list = Stack([item1, item2])
chart = SomeChart(["A", "B"], [12, 8])
\`\`\`
This is static — it shows stale data and won't update. Creating item1, item2, item3... manually is ALWAYS wrong when a tool exists.

RIGHT — use Query() for live data, Mutation() for writes, @builtins to derive values:
\`\`\`
data = Query("tool_name", {}, {rows: []})
openCount = @Count(@Filter(data.rows, "field", "==", "value"))
list = @Each(data.rows, "item", SomeComp(item.title, item.field))
createResult = Mutation("create_tool", {title: $title})
submitBtn = Button("Create", Action([@Run(createResult), @Run(data), @Reset($title)]))
\`\`\`
Everything derives from the Query — when data refreshes, the entire dashboard updates automatically.`;
}
function importantRules(rootName, flags) {
    const verifyLines = [
        `1. root = ${rootName}(...) is the FIRST line (for optimal streaming).`,
        "2. Every referenced name is defined. Every defined name (other than root) is reachable from root."
    ];
    if (flags.toolCalls) verifyLines.push("3. Every Query result is referenced by at least one component.");
    if (flags.bindings) verifyLines.push(`${flags.toolCalls ? "4" : "3"}. Every $binding appears in at least one component or expression.`);
    return `## Important Rules
- When asked about data, generate realistic/plausible data
- Choose components that best represent the content (tables for comparisons, charts for trends, forms for input, etc.)

## Final Verification
Before finishing, walk your output and verify:
${verifyLines.join("\n")}`;
}
function renderToolSignature(tool) {
    let args = "";
    if (tool.inputSchema) {
        const props = tool.inputSchema.properties;
        const required = tool.inputSchema.required ?? [];
        if (props && Object.keys(props).length > 0) args = Object.entries(props).map(([k, v])=>{
            return `${k}${required.includes(k) ? "" : "?"}: ${jsonSchemaTypeStr(v)}`;
        }).join(", ");
    }
    let returnType = "";
    if (tool.outputSchema) returnType = ` → ${jsonSchemaTypeStr(tool.outputSchema)}`;
    let line = `- ${tool.name}(${args})${returnType}`;
    if (tool.description) line += `\n  ${tool.description}`;
    return line;
}
function renderToolsSection(tools) {
    const lines = [];
    const stringTools = [];
    const specTools = [];
    for (const tool of tools)if (typeof tool === "string") stringTools.push(tool);
    else specTools.push(tool);
    lines.push("## Available Tools");
    lines.push("");
    lines.push("Use these with Query() for read operations or Mutation() for write operations. The LLM decides which is appropriate based on the tool's purpose.");
    lines.push("");
    for (const t of stringTools)lines.push(`- ${t}`);
    for (const t of specTools)lines.push(renderToolSignature(t));
    const toolsWithOutput = specTools.filter((t)=>t.outputSchema);
    if (toolsWithOutput.length > 0) {
        lines.push("");
        lines.push("### Default values for Query results");
        lines.push("");
        lines.push("Use these shapes as minimal Query defaults:");
        for (const t of toolsWithOutput){
            const defaults = defaultForSchema(t.outputSchema);
            lines.push(`- ${t.name}: \`${JSON.stringify(defaults)}\``);
        }
    }
    lines.push("");
    lines.push("CRITICAL: Use ONLY the tools listed above in Query() and Mutation() calls. Do NOT invent or guess tool names. If the user asks for functionality that doesn't match any available tool, use realistic mock data instead of fabricating a tool call.");
    return lines.join("\n");
}
function generateComponentSignatures(spec, flags) {
    const lines = [
        "## Component Signatures",
        "",
        "Arguments marked with ? are optional. Sub-components can be inline or referenced; prefer references for better streaming."
    ];
    if (flags.usesActionExpression) {
        const allSteps = [
            flags.toolCalls ? "@Run" : "",
            "@ToAssistant",
            "@OpenUrl",
            flags.bindings ? "@Set" : "",
            flags.bindings ? "@Reset" : ""
        ].filter(Boolean);
        lines.push(`Props typed \`ActionExpression\` accept an Action([@steps...]) expression. See the Action section for available steps (${allSteps.join(", ")}).`);
    }
    if (flags.bindings || Object.values(spec.components).some((c)=>c.signature?.includes("$binding"))) lines.push("Props marked `$binding<type>` accept a `$variable` reference for two-way binding.");
    const formatSig = (comp)=>comp.description ? `${comp.signature} — ${comp.description}` : comp.signature;
    if (spec.componentGroups?.length) {
        const grouped = /* @__PURE__ */ new Set();
        for (const group of spec.componentGroups){
            lines.push("", `### ${group.name}`);
            for (const name of group.components){
                if (grouped.has(name)) continue;
                const comp = spec.components[name];
                if (!comp) continue;
                grouped.add(name);
                lines.push(formatSig(comp));
            }
            if (group.notes?.length) for (const note of group.notes)lines.push(note);
        }
        const ungrouped = Object.keys(spec.components).filter((n)=>!grouped.has(n));
        if (ungrouped.length) {
            lines.push("", "### Other");
            for (const name of ungrouped){
                const comp = spec.components[name];
                lines.push(formatSig(comp));
            }
        }
    } else {
        lines.push("");
        for (const [, comp] of Object.entries(spec.components))lines.push(formatSig(comp));
    }
    return lines.join("\n");
}
function generatePrompt(spec) {
    const rootName = spec.root ?? "Root";
    const hasTools = !!spec.tools?.length;
    const toolCalls = spec.toolCalls ?? hasTools;
    const bindings = spec.bindings ?? toolCalls;
    const supportsExpressions = toolCalls || bindings;
    const usesActionExpression = Object.values(spec.components).some((c)=>c.signature?.includes("ActionExpression"));
    const parts = [];
    parts.push(spec.preamble ?? PREAMBLE);
    parts.push("");
    parts.push(syntaxRules(rootName, {
        supportsExpressions,
        bindings
    }));
    parts.push("");
    parts.push(generateComponentSignatures(spec, {
        toolCalls,
        bindings,
        usesActionExpression
    }));
    if (supportsExpressions) {
        parts.push("");
        parts.push(builtinFunctionsSection());
    }
    if (toolCalls) {
        parts.push("");
        parts.push(querySection());
        parts.push("");
        parts.push(mutationSection());
    }
    if (usesActionExpression) {
        parts.push("");
        parts.push(actionSection({
            toolCalls,
            bindings
        }));
    }
    if (toolCalls && bindings) {
        parts.push("");
        parts.push(interactiveFiltersSection());
    }
    if (toolCalls) {
        parts.push("");
        parts.push(toolWorkflowSection());
    }
    if (spec.tools?.length) {
        parts.push("");
        parts.push(renderToolsSection(spec.tools));
    }
    parts.push("");
    parts.push(streamingRules(rootName, {
        supportsExpressions
    }));
    const allExamples = [
        ...spec.examples ?? [],
        ...spec.toolExamples ?? []
    ];
    if (allExamples.length) {
        parts.push("");
        parts.push("## Examples");
        parts.push("");
        for (const ex of allExamples){
            parts.push(ex);
            parts.push("");
        }
    }
    if (spec.editMode) {
        parts.push("");
        parts.push(editModeSection());
    }
    if (spec.inlineMode) {
        parts.push("");
        parts.push(inlineModeSection());
    }
    parts.push(importantRules(rootName, {
        toolCalls,
        bindings
    }));
    if (spec.additionalRules?.length) {
        parts.push("");
        for (const rule of spec.additionalRules)parts.push(`- ${rule}`);
    }
    return parts.join("\n");
}
//#endregion
//#region src/reactive.ts
/** WeakSet tracks reactive schemas without mutating the schema objects. */ const reactiveSchemas = /* @__PURE__ */ new WeakSet();
/** Mark a schema as reactive. Called by framework adapters' reactive() function. */ function markReactive(schema) {
    reactiveSchemas.add(schema);
}
/** Check if a schema was marked reactive. Used by Zod introspection for $binding<> prefix. */ function isReactiveSchema(schema) {
    return typeof schema === "object" && schema !== null && reactiveSchemas.has(schema);
}
//#endregion
//#region src/library.ts
const schemaIdTags = /* @__PURE__ */ new WeakMap();
/**
* Tag a schema with an ID for prompt signatures.
* Use for non-component schemas that need friendly type names (e.g. ActionExpression).
* This affects prompt output only, not JSON Schema $defs.
*/ function tagSchemaId(schema, id) {
    schemaIdTags.set(schema, id);
}
function assertV4Schema(schema, componentName) {
    if (schema != null && typeof schema === "object" && "_def" in schema && !("_zod" in schema)) throw new Error(`[OpenUI] Component "${componentName}" was defined with a Zod 3 schema. OpenUI requires Zod 4 schemas. If you're on zod@3.25+, import from "zod/v4" instead of "zod". See: https://zod.dev/v4/versioning`);
}
/**
* Define a component with name, schema, description, and renderer.
* Tags the schema with the component name so it resolves in prompt
* signatures even if the component isn't in every library.
*/ function defineComponent(config) {
    assertV4Schema(config.props, config.name);
    schemaIdTags.set(config.props, config.name);
    return {
        ...config,
        ref: config.props
    };
}
function getZodDef(schema) {
    return schema?._zod?.def;
}
function getZodType(schema) {
    return getZodDef(schema)?.type;
}
function isOptionalType(schema) {
    const type = getZodType(schema);
    return type === "optional" || type === "default" || type === "nullable";
}
function unwrap(schema) {
    let s = schema;
    let def = getZodDef(s);
    while(def?.type === "optional" || def?.type === "default" || def?.type === "nullable"){
        s = def.innerType;
        def = getZodDef(s);
    }
    return s;
}
function isArrayType(schema) {
    return getZodType(unwrap(schema)) === "array";
}
function getArrayInnerType(schema) {
    const def = getZodDef(unwrap(schema));
    if (def?.type === "array") return def.element ?? def.innerType;
}
function getEnumValues(schema) {
    const def = getZodDef(unwrap(schema));
    if (def?.type !== "enum") return void 0;
    if (Array.isArray(def.values)) return def.values;
    if (def.entries && typeof def.entries === "object") return Object.keys(def.entries);
}
function getSchemaId(schema, reg) {
    try {
        const meta = reg.get(schema);
        if (meta?.id) return meta.id;
    } catch  {}
    if (typeof schema === "object" && schema !== null) return schemaIdTags.get(schema);
}
function getUnionOptions(schema) {
    const def = getZodDef(schema);
    if (def?.type === "union" && Array.isArray(def.options)) return def.options;
}
function getObjectShape(schema) {
    const def = getZodDef(schema);
    if (def?.type === "object" && def.shape && typeof def.shape === "object") return def.shape;
}
/**
* Resolve the type annotation for a schema field.
* Returns a human-readable type string for the schema.
* If the schema is marked reactive(), prefixes with "$binding<...>".
*/ function resolveTypeAnnotation(schema, reg) {
    const isReactive = isReactiveSchema(schema);
    const baseType = resolveBaseType(unwrap(schema), reg);
    if (!baseType) return void 0;
    return isReactive ? `$binding<${baseType}>` : baseType;
}
function resolveBaseType(inner, reg) {
    const directId = getSchemaId(inner, reg);
    if (directId) return directId;
    const unionOpts = getUnionOptions(inner);
    if (unionOpts) {
        const names = unionOpts.map((o)=>resolveTypeAnnotation(o, reg)).filter(Boolean);
        if (names.length > 0) return names.join(" | ");
    }
    if (isArrayType(inner)) {
        const arrayInner = getArrayInnerType(inner);
        if (!arrayInner) return void 0;
        const innerType = resolveTypeAnnotation(arrayInner, reg);
        if (innerType) return getUnionOptions(unwrap(arrayInner)) !== void 0 ? `(${innerType})[]` : `${innerType}[]`;
        return;
    }
    const zodType = getZodType(inner);
    if (zodType === "string") return "string";
    if (zodType === "number") return "number";
    if (zodType === "boolean") return "boolean";
    if (zodType === "any") return "any";
    if (zodType === "record") {
        const def = getZodDef(inner);
        return `Record<${resolveTypeAnnotation(def?.keyType, reg) ?? "string"}, ${resolveTypeAnnotation(def?.valueType, reg) ?? "any"}>`;
    }
    const enumVals = getEnumValues(inner);
    if (enumVals) return enumVals.map((v)=>`"${v}"`).join(" | ");
    if (zodType === "literal") {
        const vals = getZodDef(inner)?.values;
        if (Array.isArray(vals) && vals.length === 1) {
            const v = vals[0];
            return typeof v === "string" ? `"${v}"` : String(v);
        }
    }
    const shape = getObjectShape(inner);
    if (shape) return `{${Object.entries(shape).map(([name, fieldSchema])=>{
        const opt = isOptionalType(fieldSchema) ? "?" : "";
        const fieldType = resolveTypeAnnotation(fieldSchema, reg);
        return fieldType ? `${name}${opt}: ${fieldType}` : `${name}${opt}`;
    }).join(", ")}}`;
    return "any";
}
function analyzeFields(shape, reg) {
    return Object.entries(shape).map(([name, schema])=>({
            name,
            isOptional: isOptionalType(schema),
            isArray: isArrayType(schema),
            typeAnnotation: resolveTypeAnnotation(schema, reg)
        }));
}
function buildSignature(componentName, fields) {
    return `${componentName}(${fields.map((f)=>{
        if (f.typeAnnotation) return f.isOptional ? `${f.name}?: ${f.typeAnnotation}` : `${f.name}: ${f.typeAnnotation}`;
        if (f.isArray) return f.isOptional ? `[${f.name}]?` : `[${f.name}]`;
        return f.isOptional ? `${f.name}?` : f.name;
    }).join(", ")})`;
}
function buildComponentSpecs(components, reg) {
    const specs = {};
    for (const [name, def] of Object.entries(components))specs[name] = {
        signature: buildSignature(name, analyzeFields(def.props.shape, reg)),
        description: def.description
    };
    return specs;
}
/**
* Create a component library from an array of defined components.
*/ function createLibrary(input) {
    const componentsRecord = {};
    const reg = __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$ads$2d$painel$2f$web$2f$node_modules$2f$zod$2f$v4$2f$core$2f$registries$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["registry"]();
    for (const comp of input.components){
        reg.add(comp.props, {
            id: comp.name
        });
        componentsRecord[comp.name] = comp;
    }
    if (input.root && !componentsRecord[input.root]) {
        const available = Object.keys(componentsRecord).join(", ");
        throw new Error(`[createLibrary] Root component "${input.root}" was not found in components. Available components: ${available}`);
    }
    return {
        components: componentsRecord,
        componentGroups: input.componentGroups,
        root: input.root,
        prompt (options) {
            return generatePrompt({
                root: input.root,
                components: buildComponentSpecs(componentsRecord, reg),
                componentGroups: input.componentGroups,
                ...options
            });
        },
        toSpec () {
            return {
                root: input.root,
                components: buildComponentSpecs(componentsRecord, reg),
                componentGroups: input.componentGroups
            };
        },
        toJSONSchema () {
            const combinedSchema = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$ads$2d$painel$2f$web$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$schemas$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["object"])(Object.fromEntries(Object.entries(componentsRecord).map(([k, v])=>[
                    k,
                    v.props
                ])));
            return __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$ads$2d$painel$2f$web$2f$node_modules$2f$zod$2f$v4$2f$core$2f$json$2d$schema$2d$processors$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toJSONSchema"](combinedSchema, {
                metadata: reg
            });
        }
    };
}
//#endregion
//#region src/parser/types.ts
function isElementNode(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const node = value;
    return node.type === "element" && typeof node.typeName === "string" && typeof node.props === "object" && node.props !== null && typeof node.partial === "boolean";
}
/**
* Built-in action types for host app events.
*/ let BuiltinActionType = /* @__PURE__ */ function(BuiltinActionType) {
    BuiltinActionType["ContinueConversation"] = "continue_conversation";
    BuiltinActionType["OpenUrl"] = "open_url";
    return BuiltinActionType;
}({});
//#endregion
//#region src/parser/ast.ts
/** Type guard for runtime expression nodes that survive parser lowering. */ function isRuntimeExpr(node) {
    switch(node.k){
        case "StateRef":
        case "RuntimeRef":
        case "BinOp":
        case "UnaryOp":
        case "Ternary":
        case "Member":
        case "Index":
        case "Assign":
            return true;
        default:
            return false;
    }
}
/** Valid AST discriminant values. */ const AST_KINDS = new Set([
    "Comp",
    "Ref",
    "StateRef",
    "RuntimeRef",
    "BinOp",
    "UnaryOp",
    "Ternary",
    "Member",
    "Index",
    "Assign",
    "Str",
    "Num",
    "Bool",
    "Null",
    "Arr",
    "Obj",
    "Ph"
]);
/** Check if a value is an AST node (has a valid `k` discriminant field). */ function isASTNode(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    return AST_KINDS.has(value.k);
}
function walkAST(node, visit) {
    const walk = (current)=>{
        visit(current);
        switch(current.k){
            case "Comp":
                current.args.forEach(walk);
                Object.values(current.mappedProps ?? {}).forEach(walk);
                break;
            case "Arr":
                current.els.forEach(walk);
                break;
            case "Obj":
                current.entries.forEach(([, value])=>walk(value));
                break;
            case "BinOp":
                walk(current.left);
                walk(current.right);
                break;
            case "UnaryOp":
                walk(current.operand);
                break;
            case "Ternary":
                walk(current.cond);
                walk(current.then);
                walk(current.else);
                break;
            case "Member":
                walk(current.obj);
                break;
            case "Index":
                walk(current.obj);
                walk(current.index);
                break;
            case "Assign":
                walk(current.value);
                break;
        }
    };
    walk(node);
}
//#endregion
//#region src/parser/expressions.ts
const PREC_TERNARY = 1;
const PREC_OR = 2;
const PREC_AND = 3;
const PREC_EQ = 4;
const PREC_CMP = 5;
const PREC_ADD = 6;
const PREC_MUL = 7;
const PREC_UNARY = 8;
const PREC_MEMBER = 9;
/**
* Parse a token array into an AST node using a Pratt (top-down operator
* precedence) parser.
*/ function parseExpression(tokens) {
    let pos = 0;
    const cur = ()=>tokens[pos] ?? {
            t: 13
        };
    const adv = ()=>{
        const tok = cur();
        pos++;
        return tok;
    };
    const eat = (kind)=>{
        if (cur().t === kind) pos++;
    };
    function getInfixPrec(tok) {
        switch(tok.t){
            case 34:
                return PREC_TERNARY;
            case 32:
                return PREC_OR;
            case 31:
                return PREC_AND;
            case 25:
            case 26:
                return PREC_EQ;
            case 27:
            case 28:
            case 29:
            case 30:
                return PREC_CMP;
            case 20:
            case 21:
                return PREC_ADD;
            case 22:
            case 23:
            case 24:
                return PREC_MUL;
            case 19:
            case 3:
                return PREC_MEMBER;
            default:
                return 0;
        }
    }
    function parseExpr(minPrec = 0) {
        let left = parsePrefix();
        while(getInfixPrec(cur()) > minPrec)left = parseInfix(left);
        return left;
    }
    function parsePrefix() {
        const tok = cur();
        if (tok.t === 14) {
            adv();
            return {
                k: "Str",
                v: tok.v
            };
        }
        if (tok.t === 15) {
            adv();
            return {
                k: "Num",
                v: tok.v
            };
        }
        if (tok.t === 10) {
            adv();
            return {
                k: "Bool",
                v: true
            };
        }
        if (tok.t === 11) {
            adv();
            return {
                k: "Bool",
                v: false
            };
        }
        if (tok.t === 12) {
            adv();
            return {
                k: "Null"
            };
        }
        if (tok.t === 3) return parseArr();
        if (tok.t === 5) return parseObj();
        if (tok.t === 18) {
            const name = tok.v;
            adv();
            if (cur().t === 9) {
                adv();
                return {
                    k: "Assign",
                    target: name,
                    value: parseExpr(0)
                };
            }
            return {
                k: "StateRef",
                n: name
            };
        }
        if (tok.t === 17) {
            const name = tok.v;
            if (tokens[pos + 1]?.t === 1 && (!isBuiltin(name) || name === "Action")) return parseComp();
            adv();
            return {
                k: "Ref",
                n: name
            };
        }
        if (tok.t === 35) {
            if (tokens[pos + 1]?.t === 1) return parseComp();
            adv();
            return {
                k: "Ref",
                n: tok.v
            };
        }
        if (tok.t === 16) {
            adv();
            return {
                k: "Ref",
                n: tok.v
            };
        }
        if (tok.t === 33) {
            adv();
            return {
                k: "UnaryOp",
                op: "!",
                operand: parseExpr(PREC_UNARY)
            };
        }
        if (tok.t === 21) {
            adv();
            return {
                k: "UnaryOp",
                op: "-",
                operand: parseExpr(PREC_UNARY)
            };
        }
        if (tok.t === 1) {
            adv();
            const inner = parseExpr(0);
            eat(2);
            return inner;
        }
        adv();
        return {
            k: "Null"
        };
    }
    function parseInfix(left) {
        const tok = cur();
        if (tok.t === 20) {
            adv();
            return {
                k: "BinOp",
                op: "+",
                left,
                right: parseExpr(PREC_ADD)
            };
        }
        if (tok.t === 21) {
            adv();
            return {
                k: "BinOp",
                op: "-",
                left,
                right: parseExpr(PREC_ADD)
            };
        }
        if (tok.t === 22) {
            adv();
            return {
                k: "BinOp",
                op: "*",
                left,
                right: parseExpr(PREC_MUL)
            };
        }
        if (tok.t === 23) {
            adv();
            return {
                k: "BinOp",
                op: "/",
                left,
                right: parseExpr(PREC_MUL)
            };
        }
        if (tok.t === 24) {
            adv();
            return {
                k: "BinOp",
                op: "%",
                left,
                right: parseExpr(PREC_MUL)
            };
        }
        if (tok.t === 25) {
            adv();
            return {
                k: "BinOp",
                op: "==",
                left,
                right: parseExpr(PREC_EQ)
            };
        }
        if (tok.t === 26) {
            adv();
            return {
                k: "BinOp",
                op: "!=",
                left,
                right: parseExpr(PREC_EQ)
            };
        }
        if (tok.t === 27) {
            adv();
            return {
                k: "BinOp",
                op: ">",
                left,
                right: parseExpr(PREC_CMP)
            };
        }
        if (tok.t === 28) {
            adv();
            return {
                k: "BinOp",
                op: "<",
                left,
                right: parseExpr(PREC_CMP)
            };
        }
        if (tok.t === 29) {
            adv();
            return {
                k: "BinOp",
                op: ">=",
                left,
                right: parseExpr(PREC_CMP)
            };
        }
        if (tok.t === 30) {
            adv();
            return {
                k: "BinOp",
                op: "<=",
                left,
                right: parseExpr(PREC_CMP)
            };
        }
        if (tok.t === 31) {
            adv();
            return {
                k: "BinOp",
                op: "&&",
                left,
                right: parseExpr(PREC_AND)
            };
        }
        if (tok.t === 32) {
            adv();
            return {
                k: "BinOp",
                op: "||",
                left,
                right: parseExpr(PREC_OR)
            };
        }
        if (tok.t === 34) {
            adv();
            const then = parseExpr(0);
            eat(8);
            return {
                k: "Ternary",
                cond: left,
                then,
                else: parseExpr(0)
            };
        }
        if (tok.t === 19) {
            adv();
            const fieldTok = cur();
            return {
                k: "Member",
                obj: left,
                field: fieldTok.t === 16 || fieldTok.t === 17 || fieldTok.t === 14 || fieldTok.t === 15 ? (adv(), String(fieldTok.v)) : fieldTok.t === 18 ? (adv(), fieldTok.v.replace(/^\$/, "")) : (adv(), "?")
            };
        }
        if (tok.t === 3) {
            adv();
            const index = parseExpr(0);
            eat(4);
            return {
                k: "Index",
                obj: left,
                index
            };
        }
        return left;
    }
    /** Parse `TypeName(arg1, arg2, ...)` */ function parseComp() {
        const name = cur().v;
        adv();
        eat(1);
        const args = [];
        while(cur().t !== 2 && cur().t !== 13){
            args.push(parseExpr(0));
            if (cur().t === 7) adv();
        }
        eat(2);
        return {
            k: "Comp",
            name,
            args
        };
    }
    /** Parse `[elem1, elem2, ...]` */ function parseArr() {
        adv();
        const els = [];
        while(cur().t !== 4 && cur().t !== 13){
            els.push(parseExpr(0));
            if (cur().t === 7) adv();
        }
        eat(4);
        return {
            k: "Arr",
            els
        };
    }
    /** Parse `{ key: value, ... }` */ function parseObj() {
        adv();
        const entries = [];
        while(cur().t !== 6 && cur().t !== 13){
            const kt = cur();
            const key = kt.t === 16 || kt.t === 14 || kt.t === 17 || kt.t === 15 ? (adv(), String(kt.v)) : kt.t === 18 ? (adv(), kt.v.replace(/^\$/, "")) : (adv(), "?");
            eat(8);
            entries.push([
                key,
                parseExpr(0)
            ]);
            if (cur().t === 7) adv();
        }
        eat(6);
        return {
            k: "Obj",
            entries
        };
    }
    return parseExpr(0);
}
//#endregion
//#region src/parser/lexer.ts
/**
* Tokenize an openui-lang source string into a flat token array.
*
* Handles all token types: identifiers, literals, operators,
* state variables ($name), dot access, ternary.
*/ function tokenize(src) {
    const tokens = [];
    let i = 0;
    const n = src.length;
    while(i < n){
        while(i < n && (src[i] === " " || src[i] === "	" || src[i] === "\r"))i++;
        if (i >= n) break;
        const c = src[i];
        if (c === "\n") {
            tokens.push({
                t: 0
            });
            i++;
            continue;
        }
        if (c === "(") {
            tokens.push({
                t: 1
            });
            i++;
            continue;
        }
        if (c === ")") {
            tokens.push({
                t: 2
            });
            i++;
            continue;
        }
        if (c === "[") {
            tokens.push({
                t: 3
            });
            i++;
            continue;
        }
        if (c === "]") {
            tokens.push({
                t: 4
            });
            i++;
            continue;
        }
        if (c === "{") {
            tokens.push({
                t: 5
            });
            i++;
            continue;
        }
        if (c === "}") {
            tokens.push({
                t: 6
            });
            i++;
            continue;
        }
        if (c === ",") {
            tokens.push({
                t: 7
            });
            i++;
            continue;
        }
        if (c === ":") {
            tokens.push({
                t: 8
            });
            i++;
            continue;
        }
        if (c === "=") {
            if (i + 1 < n && src[i + 1] === "=") {
                tokens.push({
                    t: 25
                });
                i += 2;
            } else {
                tokens.push({
                    t: 9
                });
                i++;
            }
            continue;
        }
        if (c === "!") {
            if (i + 1 < n && src[i + 1] === "=") {
                tokens.push({
                    t: 26
                });
                i += 2;
            } else {
                tokens.push({
                    t: 33
                });
                i++;
            }
            continue;
        }
        if (c === ">") {
            if (i + 1 < n && src[i + 1] === "=") {
                tokens.push({
                    t: 29
                });
                i += 2;
            } else {
                tokens.push({
                    t: 27
                });
                i++;
            }
            continue;
        }
        if (c === "<") {
            if (i + 1 < n && src[i + 1] === "=") {
                tokens.push({
                    t: 30
                });
                i += 2;
            } else {
                tokens.push({
                    t: 28
                });
                i++;
            }
            continue;
        }
        if (c === "&") {
            if (i + 1 < n && src[i + 1] === "&") {
                tokens.push({
                    t: 31
                });
                i += 2;
            } else {
                tokens.push({
                    t: 31
                });
                i++;
            }
            continue;
        }
        if (c === "|") {
            if (i + 1 < n && src[i + 1] === "|") {
                tokens.push({
                    t: 32
                });
                i += 2;
            } else {
                tokens.push({
                    t: 32
                });
                i++;
            }
            continue;
        }
        if (c === ".") {
            tokens.push({
                t: 19
            });
            i++;
            continue;
        }
        if (c === "?") {
            tokens.push({
                t: 34
            });
            i++;
            continue;
        }
        if (c === "+") {
            tokens.push({
                t: 20
            });
            i++;
            continue;
        }
        if (c === "*") {
            tokens.push({
                t: 22
            });
            i++;
            continue;
        }
        if (c === "/") {
            tokens.push({
                t: 23
            });
            i++;
            continue;
        }
        if (c === "%") {
            tokens.push({
                t: 24
            });
            i++;
            continue;
        }
        if (c === "\"") {
            const start = i;
            i++;
            let isClosed = false;
            while(i < n)if (src[i] === "\\") i += 2;
            else if (src[i] === "\"") {
                i++;
                isClosed = true;
                break;
            } else i++;
            const rawString = src.slice(start, i);
            try {
                const validJsonString = isClosed ? rawString : rawString + "\"";
                tokens.push({
                    t: 14,
                    v: JSON.parse(validJsonString)
                });
            } catch  {
                const stripped = rawString.replace(/^"|"$/g, "");
                tokens.push({
                    t: 14,
                    v: stripped
                });
            }
            continue;
        }
        if (c === "'") {
            i++;
            let result = "";
            while(i < n)if (src[i] === "\\") {
                i++;
                if (i < n) {
                    const esc = src[i];
                    if (esc === "'") result += "'";
                    else if (esc === "\\") result += "\\";
                    else if (esc === "n") result += "\n";
                    else if (esc === "t") result += "	";
                    else result += esc;
                    i++;
                }
            } else if (src[i] === "'") {
                i++;
                break;
            } else {
                result += src[i];
                i++;
            }
            tokens.push({
                t: 14,
                v: result
            });
            continue;
        }
        if (c === "-") {
            const prev = tokens.length > 0 ? tokens[tokens.length - 1] : null;
            if (!(prev != null && (prev.t === 15 || prev.t === 14 || prev.t === 16 || prev.t === 17 || prev.t === 2 || prev.t === 4 || prev.t === 10 || prev.t === 11 || prev.t === 12 || prev.t === 18 || prev.t === 35)) && i + 1 < n && src[i + 1] >= "0" && src[i + 1] <= "9") {} else {
                tokens.push({
                    t: 21
                });
                i++;
                continue;
            }
        }
        const isDigit = c >= "0" && c <= "9";
        const isNegDigit = c === "-" && i + 1 < n && src[i + 1] >= "0" && src[i + 1] <= "9";
        if (isDigit || isNegDigit) {
            const start = i;
            if (src[i] === "-") i++;
            while(i < n && src[i] >= "0" && src[i] <= "9")i++;
            if (i < n && src[i] === "." && i + 1 < n && src[i + 1] >= "0" && src[i + 1] <= "9") {
                i++;
                while(i < n && src[i] >= "0" && src[i] <= "9")i++;
            }
            if (i < n && (src[i] === "e" || src[i] === "E")) {
                i++;
                if (i < n && (src[i] === "+" || src[i] === "-")) i++;
                while(i < n && src[i] >= "0" && src[i] <= "9")i++;
            }
            tokens.push({
                t: 15,
                v: +src.slice(start, i)
            });
            continue;
        }
        if (c === "$" && i + 1 < n && (src[i + 1] >= "a" && src[i + 1] <= "z" || src[i + 1] >= "A" && src[i + 1] <= "Z" || src[i + 1] === "_")) {
            const start = i;
            i++;
            while(i < n && (src[i] >= "a" && src[i] <= "z" || src[i] >= "A" && src[i] <= "Z" || src[i] >= "0" && src[i] <= "9" || src[i] === "_"))i++;
            tokens.push({
                t: 18,
                v: src.slice(start, i)
            });
            continue;
        }
        if (c >= "a" && c <= "z" || c >= "A" && c <= "Z" || c === "_") {
            const start = i;
            while(i < n && (src[i] >= "a" && src[i] <= "z" || src[i] >= "A" && src[i] <= "Z" || src[i] >= "0" && src[i] <= "9" || src[i] === "_"))i++;
            const word = src.slice(start, i);
            if (word === "true") {
                tokens.push({
                    t: 10
                });
                continue;
            }
            if (word === "false") {
                tokens.push({
                    t: 11
                });
                continue;
            }
            if (word === "null") {
                tokens.push({
                    t: 12
                });
                continue;
            }
            const kind = c >= "A" && c <= "Z" ? 17 : 16;
            tokens.push({
                t: kind,
                v: word
            });
            continue;
        }
        if (c === "@" && i + 1 < n && (src[i + 1] >= "a" && src[i + 1] <= "z" || src[i + 1] >= "A" && src[i + 1] <= "Z" || src[i + 1] === "_")) {
            i++;
            const start = i;
            while(i < n && (src[i] >= "a" && src[i] <= "z" || src[i] >= "A" && src[i] <= "Z" || src[i] >= "0" && src[i] <= "9" || src[i] === "_"))i++;
            tokens.push({
                t: 35,
                v: src.slice(start, i)
            });
            continue;
        }
        i++;
    }
    tokens.push({
        t: 13
    });
    return tokens;
}
//#endregion
//#region src/parser/materialize.ts
/**
* Recursively check if a prop value contains any AST nodes that need runtime
* evaluation. Walks into arrays, ElementNode children, and plain objects.
*/ function containsDynamicValue(v) {
    if (v == null || typeof v !== "object") return false;
    if (isASTNode(v)) return true;
    if (Array.isArray(v)) return v.some(containsDynamicValue);
    if (isElementNode(v)) return Object.values(v.props).some(containsDynamicValue);
    return Object.values(v).some(containsDynamicValue);
}
/**
* Resolve a Ref node: inline from symbol table, detect cycles, emit RuntimeRef
* for Query/Mutation declarations. Shared by materializeValue and materializeExpr.
*/ function resolveRef(name, ctx, mode) {
    if (ctx.visited.has(name)) {
        ctx.unres.push(name);
        return mode === "expr" ? {
            k: "Ph",
            n: name
        } : null;
    }
    if (!ctx.syms.has(name)) {
        ctx.unres.push(name);
        return mode === "expr" ? {
            k: "Ph",
            n: name
        } : null;
    }
    const target = ctx.syms.get(name);
    ctx.unreached?.delete(name);
    if (target.k === "Comp" && isReservedCall(target.name)) return {
        k: "RuntimeRef",
        n: name,
        refType: target.name === RESERVED_CALLS.Mutation ? "mutation" : "query"
    };
    ctx.visited.add(name);
    const prevStatementId = ctx.currentStatementId;
    ctx.currentStatementId = name;
    try {
        const result = mode === "value" ? materializeValue(target, ctx) : materializeExpr(target, ctx);
        if (mode === "value" && isElementNode(result)) result.statementId = name;
        return result;
    } finally{
        ctx.currentStatementId = prevStatementId;
        ctx.visited.delete(name);
    }
}
/**
* If node is a lazy builtin like Each(arr, varName, template), temporarily
* scope the iterator variable during materialization so template refs resolve.
* Returns the materialized Comp node, or null if not a lazy builtin.
*/ function materializeLazyBuiltin(node, ctx, scopedRefs) {
    if (!LAZY_BUILTINS.has(node.name) || node.args.length < 3) return null;
    const varArg = node.args[1];
    const varName = varArg.k === "Ref" ? varArg.n : varArg.k === "Str" ? varArg.v : null;
    if (!varName) return null;
    const nextScopedRefs = new Set(scopedRefs);
    nextScopedRefs.add(varName);
    const recursedArgs = node.args.map((a, i)=>i === 1 ? a : materializeExprInternal(a, ctx, nextScopedRefs));
    return {
        ...node,
        args: recursedArgs
    };
}
function materializeExprInternal(node, ctx, scopedRefs) {
    switch(node.k){
        case "Ref":
            return scopedRefs.has(node.n) ? node : resolveRef(node.n, ctx, "expr");
        case "Ph":
            return node;
        case "Comp":
            {
                const lazy = materializeLazyBuiltin(node, ctx, scopedRefs);
                if (lazy) return lazy;
                const recursedArgs = node.args.map((a)=>materializeExprInternal(a, ctx, scopedRefs));
                if (isBuiltin(node.name) || isReservedCall(node.name)) return {
                    ...node,
                    args: recursedArgs
                };
                const def = ctx.cat?.get(node.name);
                if (def) {
                    const mappedProps = {};
                    for(let i = 0; i < def.params.length && i < recursedArgs.length; i++)mappedProps[def.params[i].name] = recursedArgs[i];
                    return {
                        ...node,
                        args: recursedArgs,
                        mappedProps
                    };
                }
                ctx.errors.push({
                    code: "unknown-component",
                    component: node.name,
                    path: "",
                    message: `Unknown component "${node.name}" — not found in catalog or builtins`,
                    statementId: ctx.currentStatementId
                });
                return {
                    ...node,
                    args: recursedArgs
                };
            }
        case "Arr":
            return {
                ...node,
                els: node.els.map((e)=>materializeExprInternal(e, ctx, scopedRefs))
            };
        case "Obj":
            return {
                ...node,
                entries: node.entries.map(([k, v])=>[
                        k,
                        materializeExprInternal(v, ctx, scopedRefs)
                    ])
            };
        case "BinOp":
            return {
                ...node,
                left: materializeExprInternal(node.left, ctx, scopedRefs),
                right: materializeExprInternal(node.right, ctx, scopedRefs)
            };
        case "UnaryOp":
            return {
                ...node,
                operand: materializeExprInternal(node.operand, ctx, scopedRefs)
            };
        case "Ternary":
            return {
                ...node,
                cond: materializeExprInternal(node.cond, ctx, scopedRefs),
                then: materializeExprInternal(node.then, ctx, scopedRefs),
                else: materializeExprInternal(node.else, ctx, scopedRefs)
            };
        case "Member":
            return {
                ...node,
                obj: materializeExprInternal(node.obj, ctx, scopedRefs)
            };
        case "Index":
            return {
                ...node,
                obj: materializeExprInternal(node.obj, ctx, scopedRefs),
                index: materializeExprInternal(node.index, ctx, scopedRefs)
            };
        case "Assign":
            return {
                ...node,
                value: materializeExprInternal(node.value, ctx, scopedRefs)
            };
        default:
            return node;
    }
}
/**
* Normalize an AST node for use inside runtime expressions.
* Resolves Refs, adds mappedProps to catalog Comp nodes.
* Returns ASTNode — structure preserved for runtime evaluation by the evaluator.
*/ function materializeExpr(node, ctx) {
    return materializeExprInternal(node, ctx, /* @__PURE__ */ new Set());
}
/**
* Schema-aware materialization: resolves refs, normalizes catalog component args
* to named props, validates required props, applies defaults, converts literals
* to plain values, and preserves runtime expressions as AST nodes — all in a
* single recursive traversal.
*
* Returns:
*   - ElementNode for catalog/unknown components
*   - ASTNode for builtins and runtime expression nodes
*   - Plain values for literals, arrays, objects
*   - null for placeholders
*/ function materializeValue(node, ctx) {
    switch(node.k){
        case "Ref":
            return resolveRef(node.n, ctx, "value");
        case "Str":
            return node.v;
        case "Num":
            return node.v;
        case "Bool":
            return node.v;
        case "Null":
            return null;
        case "Ph":
            return null;
        case "Arr":
            {
                const items = [];
                for (const e of node.els){
                    if (e.k === "Ph") continue;
                    const value = materializeValue(e, ctx);
                    if (value === null && (e.k === "Comp" || e.k === "Ref")) continue;
                    items.push(value);
                }
                return items;
            }
        case "Obj":
            {
                const o = {};
                for (const [k, v] of node.entries)o[k] = materializeValue(v, ctx);
                return o;
            }
        case "Comp":
            {
                const { name, args } = node;
                if (isBuiltin(name)) {
                    const lazy = materializeLazyBuiltin(node, ctx, /* @__PURE__ */ new Set());
                    if (lazy) return lazy;
                    return {
                        ...node,
                        args: args.map((a)=>materializeExpr(a, ctx))
                    };
                }
                if (isReservedCall(name)) {
                    ctx.errors.push({
                        code: "inline-reserved",
                        component: name,
                        path: "",
                        message: `${name}() must be declared as a top-level statement, not used inline as a value`,
                        statementId: ctx.currentStatementId
                    });
                    return null;
                }
                const def = ctx.cat?.get(name);
                const props = {};
                if (def) {
                    for(let i = 0; i < def.params.length && i < args.length; i++)props[def.params[i].name] = materializeValue(args[i], ctx);
                    if (args.length > def.params.length) {
                        const excessCount = args.length - def.params.length;
                        ctx.errors.push({
                            code: "excess-args",
                            component: name,
                            path: "",
                            message: `${name} takes ${def.params.length} arg(s), got ${args.length} (${excessCount} excess dropped)`,
                            statementId: ctx.currentStatementId
                        });
                    }
                    const missingRequired = def.params.filter((p)=>p.required && (!(p.name in props) || props[p.name] === null));
                    if (missingRequired.length) {
                        const stillInvalid = missingRequired.filter((p)=>{
                            if (p.defaultValue !== void 0) {
                                props[p.name] = p.defaultValue;
                                return false;
                            }
                            return true;
                        });
                        if (stillInvalid.length) {
                            for (const p of stillInvalid){
                                const isNull = p.name in props;
                                ctx.errors.push({
                                    code: isNull ? "null-required" : "missing-required",
                                    component: name,
                                    path: `/${p.name}`,
                                    message: isNull ? `required field "${p.name}" cannot be null` : `missing required field "${p.name}"`,
                                    statementId: ctx.currentStatementId
                                });
                            }
                            return null;
                        }
                    }
                } else if (!isBuiltin(name) && !isReservedCall(name)) {
                    ctx.errors.push({
                        code: "unknown-component",
                        component: name,
                        path: "",
                        message: `Unknown component "${name}" — not found in catalog or builtins`,
                        statementId: ctx.currentStatementId
                    });
                    return null;
                }
                const hasDynamicProps = Object.values(props).some((v)=>containsDynamicValue(v));
                return {
                    type: "element",
                    typeName: name,
                    props,
                    partial: ctx.partial,
                    hasDynamicProps
                };
            }
        default:
            if (isRuntimeExpr(node)) return materializeExpr(node, ctx);
            return node;
    }
}
//#endregion
//#region src/parser/statements.ts
/**
* Auto-close unclosed strings and brackets so that partial/streaming input
* can be parsed without syntax errors.
*/ function autoClose(input) {
    const stack = [];
    let inStr = false;
    let esc = false;
    for(let i = 0; i < input.length; i++){
        const c = input[i];
        if (esc) {
            esc = false;
            continue;
        }
        if (c === "\\" && inStr) {
            esc = true;
            continue;
        }
        if (inStr) {
            if (c === inStr) inStr = false;
            continue;
        }
        if (c === "\"" || c === "'") {
            inStr = c;
            continue;
        }
        if (c === "(" || c === "[" || c === "{") stack.push(c);
        else if (c === ")" && stack[stack.length - 1] === "(") stack.pop();
        else if (c === "]" && stack[stack.length - 1] === "[") stack.pop();
        else if (c === "}" && stack[stack.length - 1] === "{") stack.pop();
    }
    if (!(!!inStr || stack.length > 0)) return {
        text: input,
        wasIncomplete: false
    };
    let out = input;
    if (inStr) {
        if (esc) out += "\\";
        out += inStr;
    }
    for(let j = stack.length - 1; j >= 0; j--)out += stack[j] === "(" ? ")" : stack[j] === "[" ? "]" : "}";
    return {
        text: out,
        wasIncomplete: true
    };
}
/**
* Splits the flat token stream into individual statements.
*
* Each statement has the form `identifier = expression`. Statements are
* separated by newlines at depth 0 (newlines inside brackets are ignored).
*
* Accepts `Ident`, `Type`, and `StateVar` as statement identifiers.
* For StateVar, the id is the full token value including $ (e.g., "$count").
*
* Invalid lines (no `=`, or no identifier) are silently skipped.
*/ function split(tokens) {
    const stmts = [];
    let pos = 0;
    while(pos < tokens.length){
        while(pos < tokens.length && tokens[pos].t === 0)pos++;
        if (pos >= tokens.length || tokens[pos].t === 13) break;
        const tok = tokens[pos];
        if (tok.t !== 16 && tok.t !== 17 && tok.t !== 18) {
            while(pos < tokens.length && tokens[pos].t !== 0 && tokens[pos].t !== 13)pos++;
            continue;
        }
        const id = tok.v;
        const idTokenType = tok.t;
        pos++;
        if (pos >= tokens.length || tokens[pos].t !== 9) {
            while(pos < tokens.length && tokens[pos].t !== 0 && tokens[pos].t !== 13)pos++;
            continue;
        }
        pos++;
        const expr = [];
        let depth = 0;
        let ternaryDepth = 0;
        while(pos < tokens.length && tokens[pos].t !== 13){
            const tt = tokens[pos].t;
            if (tt === 0 && depth <= 0 && ternaryDepth <= 0) {
                let peek = pos + 1;
                while(peek < tokens.length && tokens[peek].t === 0)peek++;
                const nextT = peek < tokens.length ? tokens[peek].t : 13;
                if (nextT === 34 || nextT === 8 && ternaryDepth > 0) {
                    pos++;
                    continue;
                }
                break;
            }
            if (tt === 0) {
                pos++;
                continue;
            }
            if (tt === 1 || tt === 3 || tt === 5) depth++;
            else if ((tt === 2 || tt === 4 || tt === 6) && depth > 0) depth--;
            else if (tt === 34 && depth === 0) ternaryDepth++;
            else if (tt === 8 && depth === 0 && ternaryDepth > 0) ternaryDepth--;
            expr.push(tokens[pos++]);
        }
        if (expr.length) stmts.push({
            id,
            idTokenType,
            tokens: expr
        });
    }
    return stmts;
}
//#endregion
//#region src/parser/parser.ts
function emptyResult(incomplete = true) {
    return {
        root: null,
        meta: {
            incomplete,
            unresolved: [],
            orphaned: [],
            statementCount: 0,
            errors: []
        },
        stateDeclarations: {},
        queryStatements: [],
        mutationStatements: []
    };
}
/**
* Walk an AST node to collect all StateRef ($variable) names referenced
* within. Used at parse time to pre-compute per-query state dependencies.
*/ function collectQueryDeps(node) {
    if (!isASTNode(node)) return [];
    const refs = /* @__PURE__ */ new Set();
    walkAST(node, (current)=>{
        if (current.k === "StateRef") refs.add(current.n);
    });
    return [
        ...refs
    ];
}
/**
* Classify a raw statement + parsed expression into a typed Statement.
* Determined at parse time from token type + expression shape.
*/ function classifyStatement(raw, expr) {
    if (expr.k === "Comp" && expr.name === RESERVED_CALLS.Query) {
        const deps = collectQueryDeps(expr.args[1]);
        return {
            kind: "query",
            id: raw.id,
            call: {
                callee: RESERVED_CALLS.Query,
                args: expr.args
            },
            expr,
            deps: deps.length > 0 ? deps : void 0
        };
    }
    if (expr.k === "Comp" && expr.name === RESERVED_CALLS.Mutation) return {
        kind: "mutation",
        id: raw.id,
        call: {
            callee: RESERVED_CALLS.Mutation,
            args: expr.args
        },
        expr
    };
    if (raw.idTokenType === 18) return {
        kind: "state",
        id: raw.id,
        init: expr
    };
    return {
        kind: "value",
        id: raw.id,
        expr
    };
}
/**
* Extract typed statements from the symbol table.
* State defaults are materialized to plain values (no raw AST in output).
*/ function extractStatements(stmts, ctx) {
    const stateDeclarations = {};
    const queryStatements = [];
    const mutationStatements = [];
    for (const stmt of stmts)switch(stmt.kind){
        case "state":
            stateDeclarations[stmt.id] = materializeValue(stmt.init, ctx);
            break;
        case "query":
            queryStatements.push({
                statementId: stmt.id,
                toolAST: stmt.call.args[0] ?? null,
                argsAST: stmt.call.args[1] ?? null,
                defaultsAST: stmt.call.args[2] ?? null,
                refreshAST: stmt.call.args[3] ?? null,
                deps: stmt.deps,
                complete: true
            });
            break;
        case "mutation":
            mutationStatements.push({
                statementId: stmt.id,
                toolAST: stmt.call.args[0] ?? null,
                argsAST: stmt.call.args[1] ?? null
            });
            break;
    }
    for (const stmt of stmts){
        const nodes = stmt.kind === "state" ? [
            stmt.init
        ] : stmt.kind === "value" ? [
            stmt.expr
        ] : stmt.kind === "query" || stmt.kind === "mutation" ? stmt.call.args : [];
        for (const node of nodes)for (const dep of collectQueryDeps(node))if (!(dep in stateDeclarations)) stateDeclarations[dep] = null;
    }
    return {
        stateDeclarations,
        queryStatements,
        mutationStatements
    };
}
const DEFAULT_ROOT_STATEMENT_ID = "root";
function isComponentStatement(stmt) {
    return stmt.kind === "value" && stmt.expr.k === "Comp" && !isBuiltin(stmt.expr.name) && stmt.expr.name !== RESERVED_CALLS.Query && stmt.expr.name !== RESERVED_CALLS.Mutation;
}
function pickEntryId(stmtMap, typedStmts, firstId, rootName) {
    if (stmtMap.has(DEFAULT_ROOT_STATEMENT_ID)) return DEFAULT_ROOT_STATEMENT_ID;
    if (rootName && stmtMap.has(rootName)) return rootName;
    const preferredComponent = rootName ? typedStmts.find((stmt)=>isComponentStatement(stmt) && stmt.expr.name === rootName) : void 0;
    if (preferredComponent) return preferredComponent.id;
    return typedStmts.find(isComponentStatement)?.id ?? firstId;
}
function buildResult(stmtMap, typedStmts, firstId, wasIncomplete, stmtCount, cat, rootName) {
    const entryId = pickEntryId(stmtMap, typedStmts, firstId, rootName);
    if (!stmtMap.has(entryId)) return emptyResult(wasIncomplete);
    const syms = /* @__PURE__ */ new Map();
    for (const [id, stmt] of stmtMap)syms.set(id, stmt.kind === "state" ? stmt.init : stmt.expr);
    const unres = [];
    const errors = [];
    const unreached = /* @__PURE__ */ new Set();
    for (const [id, stmt] of stmtMap){
        if (id === entryId) continue;
        if (stmt.kind === "state" || stmt.kind === "query" || stmt.kind === "mutation") continue;
        unreached.add(id);
    }
    const ctx = {
        syms,
        cat,
        errors,
        unres,
        visited: /* @__PURE__ */ new Set(),
        partial: wasIncomplete,
        currentStatementId: entryId,
        unreached
    };
    const materialized = materializeValue(syms.get(entryId), ctx);
    const root = isElementNode(materialized) ? materialized : null;
    if (root) root.statementId = entryId;
    const { stateDeclarations, queryStatements, mutationStatements } = extractStatements(typedStmts, ctx);
    return {
        root,
        meta: {
            incomplete: wasIncomplete,
            unresolved: unres,
            orphaned: [
                ...unreached
            ],
            statementCount: stmtCount,
            errors
        },
        stateDeclarations,
        queryStatements,
        mutationStatements
    };
}
function skipString(input, start) {
    if (input[start] !== "\"") return start;
    let i = start + 1;
    while(i < input.length){
        const c = input[i];
        if (c === "\\") i += 2;
        else if (c === "\"") return i + 1;
        else i++;
    }
    return i;
}
/** Extract code from markdown fences, or return as-is if no fences found.
*  String-context-aware: skips ``` inside double-quoted strings. */ function stripFences(input) {
    const blocks = [];
    let i = 0;
    while(i < input.length){
        let fenceStart = -1;
        while(i < input.length){
            const nextI = skipString(input, i);
            if (nextI > i) {
                i = nextI;
                continue;
            }
            if (input[i] === "`" && i + 1 < input.length && input[i + 1] === "`" && i + 2 < input.length && input[i + 2] === "`") {
                fenceStart = i;
                break;
            }
            i++;
        }
        if (fenceStart === -1) break;
        let j = fenceStart + 3;
        while(j < input.length && input[j] !== "\n")j++;
        if (j >= input.length) {
            blocks.push(input.slice(fenceStart + 3).replace(/^[^\n]*\n?/, ""));
            i = input.length;
            break;
        }
        j++;
        let closePos = -1;
        let k = j;
        while(k < input.length){
            const nextK = skipString(input, k);
            if (nextK > k) {
                k = nextK;
                continue;
            }
            if (input[k] === "`" && k + 1 < input.length && input[k + 1] === "`" && k + 2 < input.length && input[k + 2] === "`") {
                closePos = k;
                break;
            }
            k++;
        }
        if (closePos !== -1) {
            blocks.push(input.slice(j, closePos));
            i = closePos + 3;
        } else {
            blocks.push(input.slice(j));
            i = input.length;
        }
    }
    if (blocks.length > 0) return blocks.join("\n");
    if (input.startsWith("```")) {
        let j = 3;
        while(j < input.length && input[j] !== "\n")j++;
        const start = j < input.length ? j + 1 : 3;
        const body = input.slice(start);
        const trailingFence = body.lastIndexOf("```");
        if (trailingFence !== -1) return body.slice(0, trailingFence);
        return body;
    }
    return input;
}
/** Strip // and # line comments outside of strings (handles both " and ' delimiters). */ function stripComments(input) {
    let inStr = false;
    return input.split("\n").map((line)=>{
        for(let i = 0; i < line.length; i++){
            const c = line[i];
            if (inStr) {
                if (c === "\\" && i + 1 < line.length) {
                    i++;
                    continue;
                }
                if (c === inStr) inStr = false;
                continue;
            }
            if (c === "\"" || c === "'") {
                inStr = c;
                continue;
            }
            if (c === "/" && line[i + 1] === "/") return line.substring(0, i).trimEnd();
            if (c === "#") return line.substring(0, i).trimEnd();
        }
        return line;
    }).join("\n");
}
/** Clean LLM response: strip fences, comments, whitespace. */ function preprocess(input) {
    return stripComments(stripFences(input.trim())).trim();
}
/**
* Parse a complete openui-lang string in one pass.
*
* @param input  - Full openui-lang source text (may be partial/streaming)
* @param cat    - Param map for positional-arg → named-prop mapping
* @returns      ParseResult with root ElementNode (or null) and metadata
*/ function parse(input, cat, rootName) {
    const trimmed = preprocess(input);
    if (!trimmed) return emptyResult();
    const { text, wasIncomplete } = autoClose(trimmed);
    const stmts = split(tokenize(text));
    if (!stmts.length) return emptyResult(wasIncomplete);
    const stmtMap = /* @__PURE__ */ new Map();
    let firstId = "";
    for (const s of stmts){
        const stmt = classifyStatement(s, parseExpression(s.tokens));
        stmtMap.set(s.id, stmt);
        if (!firstId) firstId = s.id;
    }
    return buildResult(stmtMap, [
        ...stmtMap.values()
    ], firstId, wasIncomplete, stmtMap.size, cat, rootName);
}
function createStreamParser(cat, rootName) {
    let buf = "";
    let cleaned = "";
    let completedEnd = 0;
    const completedStmtMap = /* @__PURE__ */ new Map();
    let completedCount = 0;
    let firstId = "";
    function addStmt(text) {
        const t = text.trim();
        if (!t) return;
        for (const s of split(tokenize(t))){
            const stmt = classifyStatement(s, parseExpression(s.tokens));
            completedStmtMap.set(s.id, stmt);
            completedCount++;
            if (!firstId) firstId = s.id;
        }
    }
    function refreshCleaned() {
        const next = preprocess(buf);
        if (!next.startsWith(cleaned.slice(0, completedEnd))) {
            completedEnd = 0;
            completedStmtMap.clear();
            completedCount = 0;
            firstId = "";
        }
        cleaned = next;
    }
    function scanNewCompleted() {
        let depth = 0, ternaryDepth = 0, inStr = false, esc = false;
        let stmtStart = completedEnd;
        for(let i = completedEnd; i < cleaned.length; i++){
            const c = cleaned[i];
            if (esc) {
                esc = false;
                continue;
            }
            if (c === "\\" && inStr) {
                esc = true;
                continue;
            }
            if (inStr) {
                if (c === inStr) inStr = false;
                continue;
            }
            if (c === "\"" || c === "'") {
                inStr = c;
                continue;
            }
            if (c === "(" || c === "[" || c === "{") depth++;
            else if (c === ")" || c === "]" || c === "}") depth = Math.max(0, depth - 1);
            else if (c === "?" && depth === 0) ternaryDepth++;
            else if (c === ":" && depth === 0 && ternaryDepth > 0) ternaryDepth--;
            else if (c === "\n" && depth <= 0 && ternaryDepth <= 0) {
                let peek = i + 1;
                while(peek < cleaned.length && (cleaned[peek] === " " || cleaned[peek] === "	" || cleaned[peek] === "\r" || cleaned[peek] === "\n"))peek++;
                if (peek < cleaned.length && (cleaned[peek] === "?" || cleaned[peek] === ":" && ternaryDepth > 0)) continue;
                const t = cleaned.slice(stmtStart, i).trim();
                if (t) addStmt(t);
                stmtStart = i + 1;
                completedEnd = i + 1;
            }
        }
        return stmtStart;
    }
    function currentResult() {
        refreshCleaned();
        const pendingStart = scanNewCompleted();
        const pendingText = cleaned.slice(pendingStart).trim();
        if (!pendingText) {
            if (completedCount === 0) return emptyResult();
            return buildResult(completedStmtMap, [
                ...completedStmtMap.values()
            ], firstId, false, completedCount, cat, rootName);
        }
        const { text: closed, wasIncomplete } = autoClose(pendingText);
        const stmts = split(tokenize(closed));
        if (!stmts.length) {
            if (completedCount === 0) return emptyResult(wasIncomplete);
            return buildResult(completedStmtMap, [
                ...completedStmtMap.values()
            ], firstId, wasIncomplete, completedCount, cat, rootName);
        }
        const allStmtMap = new Map(completedStmtMap);
        for (const s of stmts){
            if (completedStmtMap.has(s.id)) continue;
            const stmt = classifyStatement(s, parseExpression(s.tokens));
            allStmtMap.set(s.id, stmt);
        }
        return buildResult(allStmtMap, [
            ...allStmtMap.values()
        ], firstId || stmts[0].id, wasIncomplete, completedCount + stmts.length, cat, rootName);
    }
    function reset() {
        buf = "";
        cleaned = "";
        completedEnd = 0;
        completedStmtMap.clear();
        completedCount = 0;
        firstId = "";
    }
    return {
        push (chunk) {
            buf += chunk;
            return currentResult();
        },
        set (fullText) {
            if (fullText.length < buf.length || !fullText.startsWith(buf)) reset();
            const delta = fullText.slice(buf.length);
            if (delta) buf += delta;
            return currentResult();
        },
        getResult: currentResult
    };
}
function getSchemaDefaultValue(property) {
    if (!property || typeof property !== "object" || Array.isArray(property)) return;
    return property.default;
}
function compileSchema(schema) {
    const map = /* @__PURE__ */ new Map();
    const defs = schema.$defs ?? {};
    for (const [name, def] of Object.entries(defs)){
        const properties = def.properties ?? {};
        const required = def.required ?? [];
        const params = Object.keys(properties).map((key)=>({
                name: key,
                required: required.includes(key),
                defaultValue: getSchemaDefaultValue(properties[key])
            }));
        map.set(name, {
            params
        });
    }
    return map;
}
/**
* Create a parser from a library JSON Schema document.
* Pass `library.toJSONSchema()` to get the schema.
*
* @example
* ```ts
* const parser = createParser(library.toJSONSchema());
* const result = parser.parse(openuiLangString);
* ```
*/ function createParser(schema, rootName) {
    const paramMap = compileSchema(schema);
    return {
        parse (input) {
            return parse(input, paramMap, rootName);
        }
    };
}
/**
* Create a streaming parser from a library JSON Schema document.
* Pass `library.toJSONSchema()` to get the schema.
*/ function createStreamingParser(schema, rootName) {
    return createStreamParser(compileSchema(schema), rootName);
}
//#endregion
//#region src/parser/enrich-errors.ts
/** Build a signature hint like "Header(title*, subtitle, icon)" from JSON schema. */ function buildSignatureHint(componentName, schema) {
    if (!schema?.properties) return void 0;
    const required = new Set(schema.required ?? []);
    return `Signature: ${componentName}(${Object.keys(schema.properties).map((k)=>required.has(k) ? `${k}*` : k).join(", ")}) — * marks required`;
}
/**
* Convert parser ValidationErrors into enriched OpenUIErrors with hints.
*
* Framework-agnostic — usable by React, Svelte, Vue, or standalone.
*/ function enrichErrors(validationErrors, schema, componentNames) {
    return validationErrors.map((ve)=>{
        const error = {
            source: "parser",
            code: ve.code,
            message: ve.message,
            component: ve.component,
            path: ve.path || void 0,
            statementId: ve.statementId
        };
        if (ve.code === "unknown-component" && componentNames.length) error.hint = `Available components: ${componentNames.join(", ")}`;
        else if (ve.code === "missing-required" || ve.code === "null-required") error.hint = buildSignatureHint(ve.component, schema.$defs?.[ve.component]);
        else if (ve.code === "inline-reserved") error.hint = `Declare as a top-level statement: myVar = ${ve.component}(...)`;
        return error;
    });
}
//#endregion
//#region src/parser/merge.ts
function splitStatementSource(input) {
    const stmts = [];
    let depth = 0;
    let inStr = false;
    let esc = false;
    let start = 0;
    for(let i = 0; i < input.length; i++){
        const c = input[i];
        if (esc) {
            esc = false;
            continue;
        }
        if (c === "\\" && inStr) {
            esc = true;
            continue;
        }
        if (inStr) {
            if (c === inStr) inStr = false;
            continue;
        }
        if (c === "\"" || c === "'") {
            inStr = c;
            continue;
        }
        if (c === "(" || c === "[" || c === "{") depth++;
        else if (c === ")" || c === "]" || c === "}") depth = Math.max(0, depth - 1);
        else if (c === "\n" && depth <= 0) {
            const stmt = input.slice(start, i).trim();
            if (stmt) stmts.push(stmt);
            start = i + 1;
        }
    }
    const tail = input.slice(start).trim();
    if (tail) stmts.push(tail);
    return stmts;
}
function parseStatements(input) {
    const trimmed = input.trim();
    if (!trimmed) return [];
    const result = [];
    for (const raw of splitStatementSource(trimmed)){
        const stmt = split(tokenize(raw))[0];
        if (!stmt) continue;
        result.push({
            id: stmt.id,
            ast: parseExpression(stmt.tokens),
            raw
        });
    }
    return result;
}
/**
* Recursively collect all Ref names from an AST node.
*/ function collectRefs(node, out) {
    walkAST(node, (current)=>{
        if (current.k === "Ref") out.add(current.n);
        if (current.k === "RuntimeRef") out.add(current.n);
    });
}
/**
* Remove statements unreachable from `root` (garbage collection).
* Walks the AST graph from root, collecting all referenced statement IDs.
* $state variables are always kept (they're referenced at runtime, not by Ref nodes).
*/ function gcUnreachable(order, merged, asts, rootId = "root") {
    if (!asts.get(rootId)) return;
    const reachable = new Set([
        rootId
    ]);
    const queue = [
        rootId
    ];
    while(queue.length > 0){
        const id = queue.pop();
        const ast = asts.get(id);
        if (!ast) continue;
        const refs = /* @__PURE__ */ new Set();
        collectRefs(ast, refs);
        for (const ref of refs)if (!reachable.has(ref) && asts.has(ref)) {
            reachable.add(ref);
            queue.push(ref);
        }
    }
    for (const id of order)if (id.startsWith("$")) reachable.add(id);
    for(let i = order.length - 1; i >= 0; i--)if (!reachable.has(order[i])) {
        merged.delete(order[i]);
        order.splice(i, 1);
    }
}
/**
* Merge an existing program with a patch (partial update).
* Patch statements override existing ones by name.
* Unreachable statements are automatically garbage-collected.
* Returns the merged program as a string.
*/ function mergeStatements(existing, patch, rootId = "root") {
    const existingStmts = parseStatements(existing);
    const patchStmts = parseStatements(stripFences(patch));
    if (!existingStmts.length) return patchStmts.map((stmt)=>stmt.raw).join("\n");
    if (!patchStmts.length) return existing;
    const merged = /* @__PURE__ */ new Map();
    const asts = /* @__PURE__ */ new Map();
    const order = [];
    for (const stmt of existingStmts){
        merged.set(stmt.id, stmt.raw);
        asts.set(stmt.id, stmt.ast);
        order.push(stmt.id);
    }
    for (const stmt of patchStmts){
        if (stmt.ast.k === "Null") {
            merged.delete(stmt.id);
            asts.delete(stmt.id);
            const idx = order.indexOf(stmt.id);
            if (idx !== -1) order.splice(idx, 1);
            continue;
        }
        if (!merged.has(stmt.id)) order.push(stmt.id);
        merged.set(stmt.id, stmt.raw);
        asts.set(stmt.id, stmt.ast);
    }
    gcUnreachable(order, merged, asts, rootId);
    return order.filter((id)=>merged.has(id)).map((id)=>merged.get(id)).join("\n");
}
//#endregion
//#region src/parser/serialize.ts
const PRECEDENCE = {
    "||": 2,
    "&&": 3,
    "==": 4,
    "!=": 4,
    ">": 5,
    "<": 5,
    ">=": 5,
    "<=": 5,
    "+": 6,
    "-": 6,
    "*": 7,
    "/": 7,
    "%": 7
};
var StatementCollector = class {
    statements = [];
    registered = /* @__PURE__ */ new Set();
    /** Register an ElementNode as a named statement. Returns the statementId for use as a reference. */ register(id, text) {
        if (this.registered.has(id)) return;
        this.registered.add(id);
        this.statements.push({
            id,
            text
        });
    }
    has(id) {
        return this.registered.has(id);
    }
    getStatements() {
        return this.statements;
    }
};
function serializeASTNode(node) {
    switch(node.k){
        case "Str":
            return JSON.stringify(node.v);
        case "Num":
            return String(node.v);
        case "Bool":
            return node.v ? "true" : "false";
        case "Null":
            return "null";
        case "Ph":
            return node.n;
        case "StateRef":
            return node.n;
        case "RuntimeRef":
            return node.n;
        case "Arr":
            return "[" + node.els.map(serializeASTNode).join(", ") + "]";
        case "Obj":
            return "{" + node.entries.map(([k, v])=>`${k}: ${serializeASTNode(v)}`).join(", ") + "}";
        case "BinOp":
            {
                const left = serializeBinOpChild(node.left, node.op, "left");
                const right = serializeBinOpChild(node.right, node.op, "right");
                return `${left} ${node.op} ${right}`;
            }
        case "UnaryOp":
            return `${node.op}${serializeASTNode(node.operand)}`;
        case "Ternary":
            return `${serializeASTNode(node.cond)} ? ${serializeASTNode(node.then)} : ${serializeASTNode(node.else)}`;
        case "Member":
            return `${serializeASTNode(node.obj)}.${node.field}`;
        case "Index":
            return `${serializeASTNode(node.obj)}[${serializeASTNode(node.index)}]`;
        case "Assign":
            return `${node.target} = ${serializeASTNode(node.value)}`;
        case "Comp":
            {
                const args = node.args.map(serializeASTNode).join(", ");
                if (isBuiltin(node.name) && node.name !== "Action") return `@${node.name}(${args})`;
                return `${node.name}(${args})`;
            }
        case "Ref":
            return node.n;
        default:
            return "null";
    }
}
/** Wrap a BinOp child in parens if its precedence is lower than the parent's. */ function serializeBinOpChild(child, parentOp, _side) {
    const inner = serializeASTNode(child);
    if (child.k !== "BinOp") return inner;
    const parentPrec = PRECEDENCE[parentOp] ?? 0;
    if ((PRECEDENCE[child.op] ?? 0) < parentPrec) return `(${inner})`;
    return inner;
}
function serializeValue(value, paramMap, collector) {
    if (value === null || value === void 0) return "null";
    if (typeof value === "string") return JSON.stringify(value);
    if (typeof value === "number") return String(value);
    if (typeof value === "boolean") return value ? "true" : "false";
    if (isElementNode(value)) return serializeElementValue(value, paramMap, collector);
    if (isASTNode(value)) return serializeASTNode(value);
    if (Array.isArray(value)) return "[" + value.map((el)=>serializeValue(el, paramMap, collector)).join(", ") + "]";
    if (typeof value === "object") return "{" + Object.entries(value).map(([k, v])=>`${k}: ${serializeValue(v, paramMap, collector)}`).join(", ") + "}";
    return "null";
}
/** Serialize an ElementNode — either as a reference (if it has statementId) or inline. */ function serializeElementValue(node, paramMap, collector) {
    if (node.statementId) {
        if (!collector.has(node.statementId)) {
            const expr = serializeElementExpr(node, paramMap, collector);
            collector.register(node.statementId, `${node.statementId} = ${expr}`);
        }
        return node.statementId;
    }
    return serializeElementExpr(node, paramMap, collector);
}
function serializeElementExpr(node, paramMap, collector) {
    const def = paramMap.get(node.typeName);
    if (def) {
        const args = [];
        for (const param of def.params){
            const val = node.props[param.name];
            args.push(serializeValue(val, paramMap, collector));
        }
        while(args.length > 0){
            if (args[args.length - 1] !== "null") break;
            const paramIdx = args.length - 1;
            const param = def.params[paramIdx];
            if (!param) break;
            if (param.required) break;
            args.pop();
        }
        return `${node.typeName}(${args.join(", ")})`;
    }
    const fallbackArgs = Object.values(node.props).map((v)=>serializeValue(v, paramMap, collector));
    return `${node.typeName}(${fallbackArgs.join(", ")})`;
}
function serializeStateDeclarations(stateDeclarations, paramMap, collector) {
    const lines = [];
    for (const [name, value] of Object.entries(stateDeclarations)){
        if (value === null) continue;
        lines.push(`${name} = ${serializeValue(value, paramMap, collector)}`);
    }
    return lines;
}
/**
* Convert an ElementNode tree back to openui-lang source text.
* Output is compatible with `mergeStatements()` for patching existing programs.
*
* @param json - The root ElementNode tree
* @param library - The component Library (for positional arg ordering)
* @param options - Optional state declarations
* @returns openui-lang source text (multiple statements joined by newlines)
*/ function jsonToOpenUI(json, library, options) {
    const paramMap = compileSchema(library.toJSONSchema());
    const collector = new StatementCollector();
    const rootExpr = serializeElementExpr(json, paramMap, collector);
    const rootId = json.statementId || "root";
    const lines = [];
    lines.push(`${rootId} = ${rootExpr}`);
    for (const stmt of collector.getStatements()){
        if (stmt.id === rootId) continue;
        lines.push(stmt.text);
    }
    if (options?.stateDeclarations) {
        const stateLines = serializeStateDeclarations(options.stateDeclarations, paramMap, collector);
        lines.push(...stateLines);
    }
    return lines.join("\n");
}
//#endregion
//#region src/runtime/evaluator.ts
function isReactiveAssign(value) {
    return typeof value === "object" && value !== null && value.__reactive === "assign";
}
/**
* Evaluate an AST node to a runtime value.
*/ function evaluate(node, context, schemaCtx) {
    switch(node.k){
        case "Str":
            return node.v;
        case "Num":
            return node.v;
        case "Bool":
            return node.v;
        case "Null":
            return null;
        case "Ph":
            return null;
        case "StateRef":
            return context.extraScope?.[node.n] ?? context.getState(node.n);
        case "Ref":
        case "RuntimeRef":
            return context.resolveRef(node.n);
        case "Arr":
            return node.els.map((el)=>evaluate(el, context));
        case "Obj":
            return Object.fromEntries(node.entries.map(([k, v])=>[
                    k,
                    evaluate(v, context)
                ]));
        case "Comp":
            {
                if (LAZY_BUILTINS.has(node.name)) return evaluateLazyBuiltin(node.name, node.args, context, schemaCtx);
                const builtin = BUILTINS[node.name];
                if (builtin) {
                    const args = node.args.map((a)=>evaluate(a, context));
                    return builtin.fn(...args);
                }
                if (ACTION_NAMES.has(node.name)) return evaluateActionCall(node.name, node.args, context);
                if (node.mappedProps) {
                    const def = schemaCtx?.library.components[node.name];
                    const props = {};
                    for (const [key, val] of Object.entries(node.mappedProps)){
                        const propSchema = def?.props?.shape?.[key];
                        if (val.k === "StateRef" && propSchema && isReactiveSchema(propSchema)) props[key] = {
                            __reactive: "assign",
                            target: val.n,
                            expr: {
                                k: "StateRef",
                                n: "$value"
                            }
                        };
                        else if (val.k === "StateRef") props[key] = schemaCtx ? context.getState(val.n) : val;
                        else props[key] = evaluate(val, context, schemaCtx);
                    }
                    const result = {
                        type: "element",
                        typeName: node.name,
                        props,
                        partial: false,
                        hasDynamicProps: true
                    };
                    if (schemaCtx) {
                        for (const [key, val] of Object.entries(props))if (isElementNode(val)) props[key] = evaluateElementInline(val, context, schemaCtx);
                        else if (Array.isArray(val)) props[key] = val.map((item)=>isElementNode(item) ? evaluateElementInline(item, context, schemaCtx) : item);
                    }
                    return result;
                }
                console.warn(`[openui] Unexpected unmapped Comp node: ${node.name}`);
                return null;
            }
        case "BinOp":
            {
                if (node.op === "&&") {
                    const left = evaluate(node.left, context);
                    return left ? evaluate(node.right, context) : left;
                }
                if (node.op === "||") {
                    const left = evaluate(node.left, context);
                    return left ? left : evaluate(node.right, context);
                }
                const left = evaluate(node.left, context);
                const right = evaluate(node.right, context);
                switch(node.op){
                    case "+":
                        if (typeof left === "string" || typeof right === "string") return String(left ?? "") + String(right ?? "");
                        return toNumber(left) + toNumber(right);
                    case "-":
                        return toNumber(left) - toNumber(right);
                    case "*":
                        return toNumber(left) * toNumber(right);
                    case "/":
                        return toNumber(right) === 0 ? 0 : toNumber(left) / toNumber(right);
                    case "%":
                        return toNumber(right) === 0 ? 0 : toNumber(left) % toNumber(right);
                    case "==":
                        return left == right;
                    case "!=":
                        return left != right;
                    case ">":
                        return toNumber(left) > toNumber(right);
                    case "<":
                        return toNumber(left) < toNumber(right);
                    case ">=":
                        return toNumber(left) >= toNumber(right);
                    case "<=":
                        return toNumber(left) <= toNumber(right);
                    default:
                        return null;
                }
            }
        case "UnaryOp":
            if (node.op === "!") return !evaluate(node.operand, context);
            if (node.op === "-") return -toNumber(evaluate(node.operand, context));
            return null;
        case "Ternary":
            return evaluate(node.cond, context) ? evaluate(node.then, context) : evaluate(node.else, context);
        case "Member":
            {
                const obj = evaluate(node.obj, context);
                if (obj == null) return null;
                if (Array.isArray(obj)) {
                    if (node.field === "length") return obj.length;
                    return obj.map((item)=>item?.[node.field] ?? null);
                }
                return obj[node.field];
            }
        case "Index":
            {
                const obj = evaluate(node.obj, context);
                const idx = evaluate(node.index, context);
                if (obj == null || idx == null) return null;
                if (Array.isArray(obj)) return obj[toNumber(idx)];
                return obj[String(idx)];
            }
        case "Assign":
            return {
                __reactive: "assign",
                target: node.target,
                expr: node.value
            };
    }
}
/**
* Strip a ReactiveAssign to its current value in a non-reactive context.
* When transport args or non-reactive props contain a ReactiveAssign, this
* resolves it to the current state value (or null if getState is unavailable).
*/ function stripReactiveAssign(value, context) {
    if (!isReactiveAssign(value)) return value;
    return context.getState(value.target) ?? null;
}
/**
* Evaluate an ElementNode's props with schema awareness. Used by evaluate()
* when schema context is available and a Comp produces an ElementNode that
* needs its own props evaluated with reactive schema detection.
*/ function evaluateElementInline(el, context, schemaCtx) {
    if (el.hasDynamicProps === false) return el;
    const def = schemaCtx.library.components[el.typeName];
    const evaluated = {};
    for (const [key, value] of Object.entries(el.props)){
        const propSchema = def?.props?.shape?.[key];
        evaluated[key] = evaluatePropInline(value, context, schemaCtx, propSchema);
    }
    return {
        ...el,
        props: evaluated
    };
}
/**
* Evaluate a single prop value with schema awareness.
* Delegates to shared evaluatePropCore with inline-specific recursion callbacks.
*/ function evaluatePropInline(value, context, schemaCtx, reactiveSchema) {
    return evaluatePropCore(value, context, schemaCtx, reactiveSchema, {
        recurseElement: (el)=>evaluateElementInline(el, context, schemaCtx),
        recurse: (v, rs)=>evaluatePropInline(v, context, schemaCtx, rs)
    });
}
/** Convert a resolved runtime value back to a literal AST node for deferred evaluation. */ function toLiteralAST(value) {
    if (value === null || value === void 0) return {
        k: "Null"
    };
    if (typeof value === "string") return {
        k: "Str",
        v: value
    };
    if (typeof value === "number") return {
        k: "Num",
        v: value
    };
    if (typeof value === "boolean") return {
        k: "Bool",
        v: value
    };
    if (Array.isArray(value)) return {
        k: "Arr",
        els: value.map(toLiteralAST)
    };
    if (typeof value === "object") return {
        k: "Obj",
        entries: Object.entries(value).map(([k, v])=>[
                k,
                toLiteralAST(v)
            ])
    };
    return {
        k: "Null"
    };
}
/**
* Evaluate Action/Run/ToAssistant/OpenUrl Comp nodes into ActionPlan/ActionStep values.
*/ function evaluateActionCall(name, args, context) {
    switch(name){
        case "Action":
            {
                const stepsArg = args.length > 0 ? evaluate(args[0], context) : [];
                return {
                    steps: (Array.isArray(stepsArg) ? stepsArg : []).filter((s)=>s != null && typeof s === "object" && "type" in s)
                };
            }
        case "Run":
            {
                if (args.length === 0) return null;
                const refNode = args[0];
                if (refNode.k === "RuntimeRef") return {
                    type: ACTION_STEPS.Run,
                    statementId: refNode.n,
                    refType: refNode.refType
                };
                return null;
            }
        case "ToAssistant":
            {
                const message = args.length > 0 ? String(evaluate(args[0], context) ?? "") : "";
                const ctx = args.length > 1 ? String(evaluate(args[1], context) ?? "") : void 0;
                return {
                    type: ACTION_STEPS.ToAssistant,
                    message,
                    context: ctx
                };
            }
        case "OpenUrl":
            {
                const url = args.length > 0 ? String(evaluate(args[0], context) ?? "") : "";
                return {
                    type: ACTION_STEPS.OpenUrl,
                    url
                };
            }
        case "Set":
            {
                if (args.length < 2) return null;
                const targetNode = args[0];
                if (targetNode.k !== "StateRef") return null;
                return {
                    type: ACTION_STEPS.Set,
                    target: targetNode.n,
                    valueAST: args[1]
                };
            }
        case "Reset":
            {
                const targets = args.filter((a)=>a.k === "StateRef").map((a)=>a.n);
                if (targets.length === 0) return null;
                return {
                    type: ACTION_STEPS.Reset,
                    targets
                };
            }
        default:
            return null;
    }
}
/**
* Substitute all Ref(varName) nodes in an AST tree with a literal value.
* This pre-resolves loop variables so deferred expressions (like Action steps)
* don't lose scope when evaluated later at click time.
*/ function substituteRef(node, varName, value) {
    switch(node.k){
        case "Ref":
            return node.n === varName ? toLiteralAST(value) : node;
        case "Member":
            if (isASTNode(node.obj)) {
                const subObj = substituteRef(node.obj, varName, value);
                if (subObj.k === "Obj") {
                    const entry = subObj.entries.find(([k])=>k === node.field);
                    if (entry) return entry[1];
                }
                return {
                    ...node,
                    obj: subObj
                };
            }
            return node;
        case "Index":
            return {
                ...node,
                obj: isASTNode(node.obj) ? substituteRef(node.obj, varName, value) : node.obj,
                index: isASTNode(node.index) ? substituteRef(node.index, varName, value) : node.index
            };
        case "BinOp":
            return {
                ...node,
                left: substituteRef(node.left, varName, value),
                right: substituteRef(node.right, varName, value)
            };
        case "UnaryOp":
            return {
                ...node,
                operand: substituteRef(node.operand, varName, value)
            };
        case "Ternary":
            return {
                ...node,
                cond: substituteRef(node.cond, varName, value),
                then: substituteRef(node.then, varName, value),
                else: substituteRef(node.else, varName, value)
            };
        case "Arr":
            return {
                ...node,
                els: node.els.map((e)=>substituteRef(e, varName, value))
            };
        case "Obj":
            return {
                ...node,
                entries: node.entries.map(([k, v])=>[
                        k,
                        substituteRef(v, varName, value)
                    ])
            };
        case "Comp":
            {
                const result = {
                    ...node,
                    args: node.args.map((a)=>substituteRef(a, varName, value))
                };
                if (node.mappedProps) {
                    const subProps = {};
                    for (const [k, v] of Object.entries(node.mappedProps))subProps[k] = substituteRef(v, varName, value);
                    result.mappedProps = subProps;
                }
                return result;
            }
        case "Assign":
            return {
                ...node,
                value: substituteRef(node.value, varName, value)
            };
        default:
            return node;
    }
}
/**
* Each(array, varName, template) — evaluate template once per array item.
* varName is user-defined (e.g. `issue`, `ticket`) — no $ prefix collision.
*
* Before evaluation, substitutes all Ref(varName) in the template with the
* current item's literal value. This ensures deferred expressions (like
* Action/Set steps) capture concrete values instead of dangling loop refs.
*/ function evaluateLazyBuiltin(name, args, context, schemaCtx) {
    if (name === "Each") {
        if (args.length < 3) return [];
        const arr = evaluate(args[0], context);
        if (!Array.isArray(arr)) return [];
        const varName = args[1].k === "Ref" ? args[1].n : args[1].k === "Str" ? args[1].v : null;
        if (!varName) return [];
        const template = args[2];
        return arr.map((item, _idx)=>{
            const substituted = substituteRef(template, varName, item);
            const childCtx = {
                ...context,
                resolveRef: (refName)=>{
                    if (refName === varName) return item;
                    return context.resolveRef(refName);
                }
            };
            const result = evaluate(substituted, childCtx, schemaCtx);
            if (schemaCtx && isElementNode(result)) return evaluateElementInline(result, childCtx, schemaCtx);
            return result;
        });
    }
    return null;
}
//#endregion
//#region src/runtime/evaluate-prop.ts
/**
* Shared prop value evaluation logic.
*
* Both evaluator.ts (inline path) and evaluate-tree.ts (React path) need
* identical prop evaluation — AST resolution, ReactiveAssign handling,
* ElementNode recursion, ActionPlan preservation. The only difference is
* how they recurse into ElementNodes. This module extracts the shared core
* and takes recursion callbacks so each caller can supply its own strategy.
*
* Also fixes the nested reactive drop bug: reactiveSchema is now correctly
* passed through plain object recursion.
*/ /**
* Evaluate a single prop value with schema awareness. Handles AST nodes,
* ReactiveAssign markers, nested ElementNodes, arrays, and ActionPlans.
*/ function evaluatePropCore(value, context, schemaCtx, reactiveSchema, callbacks) {
    if (value == null) return value;
    if (typeof value !== "object") return value;
    if (isASTNode(value)) {
        if (value.k === "StateRef" && reactiveSchema && isReactiveSchema(reactiveSchema)) return {
            __reactive: "assign",
            target: value.n,
            expr: {
                k: "StateRef",
                n: "$value"
            }
        };
        const result = evaluate(value, context, schemaCtx);
        if (isElementNode(result)) return callbacks.recurseElement(result);
        if (Array.isArray(result)) return result.map((item)=>isElementNode(item) ? callbacks.recurseElement(item) : item);
        if (isReactiveAssign(result) && !(reactiveSchema && isReactiveSchema(reactiveSchema))) return context.getState(result.target) ?? null;
        return result;
    }
    if (typeof value === "string" && reactiveSchema && isReactiveSchema(reactiveSchema)) return value;
    if (Array.isArray(value)) return value.map((v)=>callbacks.recurse(v, reactiveSchema));
    if (isElementNode(value)) return callbacks.recurseElement(value);
    const obj = value;
    if ("steps" in obj && Array.isArray(obj.steps)) return value;
    if ("type" in obj && "valueAST" in obj) return value;
    let needsEval = false;
    for (const val of Object.values(obj))if (typeof val === "object" && val !== null) {
        needsEval = true;
        break;
    }
    if (needsEval) {
        const result = {};
        for (const [k, v] of Object.entries(obj))result[k] = callbacks.recurse(v, reactiveSchema);
        return result;
    }
    return value;
}
//#endregion
//#region src/runtime/evaluate-tree.ts
/**
* Evaluate all AST nodes in an ElementNode tree's props.
* Returns a new ElementNode with all props resolved to concrete values.
*
* Uses the unified evaluator with schema context for reactive-aware evaluation.
*/ function evaluateElementProps(el, evalCtx) {
    if (el.hasDynamicProps === false) return el;
    const schemaCtx = {
        library: evalCtx.library
    };
    const def = evalCtx.library.components[el.typeName];
    const evaluated = {};
    for (const [key, value] of Object.entries(el.props)){
        const propSchema = def?.props?.shape?.[key];
        try {
            evaluated[key] = evaluatePropValue(value, evalCtx, schemaCtx, propSchema);
        } catch (e) {
            evaluated[key] = value;
            const msg = e instanceof Error ? e.message : String(e);
            evalCtx.errors?.push({
                source: "runtime",
                code: "runtime-error",
                component: el.typeName,
                statementId: el.statementId,
                message: `Evaluating prop "${key}" on ${el.typeName} failed: ${msg}`,
                hint: `Check the expression used for prop "${key}"`
            });
        }
    }
    return {
        ...el,
        props: evaluated
    };
}
/**
* Evaluate a single prop value with schema awareness.
* Delegates to shared evaluatePropCore with evaluate-tree-specific recursion callbacks.
*/ function evaluatePropValue(value, evalCtx, schemaCtx, reactiveSchema) {
    return evaluatePropCore(value, evalCtx.ctx, schemaCtx, reactiveSchema, {
        recurseElement: (el)=>evaluateElementProps(el, evalCtx),
        recurse: (v, rs)=>evaluatePropValue(v, evalCtx, schemaCtx, rs)
    });
}
//#endregion
//#region src/runtime/mcp.ts
/**
* MCP utilities — type definitions and result extraction for MCP client integration.
*
* The Renderer accepts an MCP client directly as `toolProvider`.
* It detects the MCP client shape (has `callTool({ name, arguments })`) and
* wraps responses with `extractToolResult` automatically.
*
* @example
* ```tsx
* import { Client } from "@modelcontextprotocol/sdk/client/index.js";
* import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
*
* const client = new Client({ name: "my-app", version: "1.0.0" });
* await client.connect(new StreamableHTTPClientTransport(new URL("/api/mcp")));
*
* // Pass directly — Renderer handles MCP response extraction
* <Renderer toolProvider={client} library={library} response={content} />
* ```
*/ /**
* Error thrown when an MCP tool call returns `isError: true`.
* Preserves the raw error content from the MCP response for structured handling.
*/ var McpToolError = class extends Error {
    toolErrorText;
    constructor(errorText){
        super(`MCP tool error: ${errorText || "Unknown error"}`);
        this.name = "McpToolError";
        this.toolErrorText = errorText;
    }
};
/**
* Extract the actual data from an MCP callTool result.
* Prefers structuredContent (machine-readable JSON), falls back to parsing text content.
*/ function extractToolResult(result) {
    if (result.isError) {
        const errorText = result.content?.filter((c)=>c.type === "text").map((c)=>c.text).join("\n");
        throw new McpToolError(errorText || "Unknown error");
    }
    if (result.structuredContent != null) return result.structuredContent;
    const textParts = result.content?.filter((c)=>c.type === "text").map((c)=>c.text ?? "");
    if (textParts?.length) {
        const text = textParts.join("");
        try {
            return JSON.parse(text);
        } catch  {
            return text;
        }
    }
    return null;
}
//#endregion
//#region src/runtime/toolProvider.ts
/**
* Standard error thrown when a tool name is not found in a function-map ToolProvider.
* Used by Renderer's inline normalization to give clear error messages.
*/ var ToolNotFoundError = class extends Error {
    toolName;
    availableTools;
    constructor(toolName, availableTools = []){
        super(`[openui] No handler for tool "${toolName}". Available: ${availableTools.join(", ") || "(none)"}`);
        this.name = "ToolNotFoundError";
        this.toolName = toolName;
        this.availableTools = availableTools;
    }
};
//#endregion
//#region src/runtime/queryManager.ts
/** JSON.stringify with stable key ordering at all nesting levels. */ function stableStringify(value) {
    return JSON.stringify(value, (_key, val)=>{
        if (val && typeof val === "object" && !Array.isArray(val)) {
            const sorted = {};
            for (const k of Object.keys(val).sort())sorted[k] = val[k];
            return sorted;
        }
        if (val === void 0) return "__undefined__";
        if (typeof val === "number") {
            if (Number.isNaN(val)) return "__NaN__";
            if (val === Infinity) return "__Inf__";
            if (val === -Infinity) return "__-Inf__";
        }
        return val;
    });
}
function buildCacheKey(toolName, args, deps) {
    const depsKey = deps != null ? "::" + stableStringify(deps) : "";
    return toolName + "::" + stableStringify(args) + depsKey;
}
function createQueryManager(toolProvider) {
    const queries = /* @__PURE__ */ new Map();
    const mutations = /* @__PURE__ */ new Map();
    const cache = /* @__PURE__ */ new Map();
    const listeners = /* @__PURE__ */ new Set();
    let snapshot = {
        __openui_loading: [],
        __openui_refetching: [],
        __openui_errors: []
    };
    let snapshotJson = JSON.stringify(snapshot);
    let disposed = false;
    let generation = 0;
    function rebuildSnapshot() {
        const out = {
            __openui_loading: [],
            __openui_refetching: [],
            __openui_errors: []
        };
        for (const [sid, q] of queries){
            const entry = cache.get(q.cacheKey);
            if (entry && entry.data !== void 0) out[sid] = entry.data;
            else if (q.prevCacheKey) {
                const prev = cache.get(q.prevCacheKey);
                if (prev && prev.data !== void 0) out[sid] = prev.data;
                else out[sid] = q.defaults;
            } else out[sid] = q.defaults;
            if (q.loading) {
                out.__openui_loading.push(sid);
                if (q.everFetched) out.__openui_refetching.push(sid);
            }
            if (q.error) out.__openui_errors.push(q.error);
        }
        for (const [sid, m] of mutations){
            out[sid] = m.result;
            if (m.error) out.__openui_errors.push(m.error);
        }
        try {
            const outJson = JSON.stringify(out);
            if (outJson === snapshotJson) return false;
            snapshot = out;
            snapshotJson = outJson;
        } catch  {
            snapshot = out;
            snapshotJson = "";
        }
        return true;
    }
    function notify() {
        for (const listener of [
            ...listeners
        ])listener();
    }
    async function executeFetch(cacheKey, statementId) {
        if (!toolProvider) return;
        const q = queries.get(statementId);
        if (!q) return;
        const fetchKey = cacheKey;
        const toolName = q.toolName;
        const args = q.args;
        let entry = cache.get(fetchKey);
        if (!entry) {
            entry = {
                data: void 0,
                inFlight: true
            };
            cache.set(fetchKey, entry);
        } else entry.inFlight = true;
        q.loading = true;
        rebuildSnapshot();
        notify();
        try {
            const data = await toolProvider.callTool(toolName, args ?? {});
            if (disposed) return;
            const current = queries.get(statementId);
            if (!current || current.cacheKey !== fetchKey) {
                entry.inFlight = false;
                return;
            }
            entry.data = data ?? null;
            current.everFetched = true;
            current.error = void 0;
            if (current.prevCacheKey && current.prevCacheKey !== fetchKey) {
                const prevKey = current.prevCacheKey;
                current.prevCacheKey = void 0;
                cleanupCacheEntry(prevKey);
            }
        } catch (err) {
            const current = queries.get(statementId);
            if (current && current.cacheKey === fetchKey) if (err instanceof ToolNotFoundError) current.error = {
                source: "query",
                code: "tool-not-found",
                message: `Query tool "${toolName}" not found`,
                statementId,
                component: "Query",
                toolName,
                hint: err.availableTools.length ? `Available tools: ${err.availableTools.join(", ")}` : void 0
            };
            else if (err instanceof McpToolError) current.error = {
                source: "query",
                code: "mcp-error",
                message: `Query "${toolName}" returned an error: ${err.toolErrorText}`,
                statementId,
                component: "Query",
                toolName
            };
            else current.error = {
                source: "query",
                code: "tool-error",
                message: `Query "${toolName}" failed: ${err instanceof Error ? err.message : String(err)}`,
                statementId,
                component: "Query",
                toolName
            };
            console.error(`Query "${toolName}" failed:`, err);
        } finally{
            entry.inFlight = false;
            const current = queries.get(statementId);
            if (current && current.cacheKey === fetchKey) {
                current.loading = false;
                if (rebuildSnapshot()) notify();
                if (current.needsRefetch) {
                    current.needsRefetch = false;
                    executeFetch(current.cacheKey, statementId);
                }
            } else if (rebuildSnapshot()) notify();
        }
    }
    /** Remove a cache entry if no query references it. */ function cleanupCacheEntry(cacheKey) {
        for (const q of queries.values())if (q.cacheKey === cacheKey || q.prevCacheKey === cacheKey) return;
        cache.delete(cacheKey);
    }
    function evaluateQueries(queryNodes) {
        if (disposed) return;
        const activeIds = new Set(queryNodes.map((n)=>n.statementId));
        for (const [sid, q] of queries)if (!activeIds.has(sid)) {
            if (q.timer) clearInterval(q.timer);
            queries.delete(sid);
            cleanupCacheEntry(q.cacheKey);
            if (q.prevCacheKey) cleanupCacheEntry(q.prevCacheKey);
        }
        for (const node of queryNodes){
            if (!node.complete) continue;
            const cacheKey = buildCacheKey(node.toolName, node.args, node.deps);
            const existing = queries.get(node.statementId);
            if (existing) {
                if (existing.cacheKey !== cacheKey) existing.prevCacheKey = existing.cacheKey;
                existing.toolName = node.toolName;
                existing.args = node.args;
                existing.defaults = node.defaults;
                existing.cacheKey = cacheKey;
            } else queries.set(node.statementId, {
                toolName: node.toolName,
                args: node.args,
                defaults: node.defaults,
                cacheKey,
                loading: false,
                everFetched: false,
                refreshInterval: 0,
                needsRefetch: false
            });
            const q = queries.get(node.statementId);
            const entry = cache.get(cacheKey);
            const hasSettledData = entry && entry.data !== void 0 && !entry.inFlight;
            if (toolProvider && !hasSettledData && !entry?.inFlight) executeFetch(cacheKey, node.statementId);
            const newInterval = node.refreshInterval ?? 0;
            if (newInterval !== q.refreshInterval) {
                if (q.timer) {
                    clearInterval(q.timer);
                    q.timer = void 0;
                }
                if (newInterval > 0) q.timer = setInterval(()=>{
                    if (disposed || !toolProvider) return;
                    if (!cache.get(q.cacheKey)?.inFlight) executeFetch(q.cacheKey, node.statementId);
                }, newInterval * 1e3);
                q.refreshInterval = newInterval;
            }
        }
        if (rebuildSnapshot()) notify();
    }
    function getResult(statementId) {
        const q = queries.get(statementId);
        if (!q) return null;
        const entry = cache.get(q.cacheKey);
        if (entry && entry.data !== void 0) return entry.data;
        if (q.prevCacheKey) {
            const prev = cache.get(q.prevCacheKey);
            if (prev && prev.data !== void 0) return prev.data;
        }
        return q.defaults;
    }
    function isLoading(statementId) {
        return queries.get(statementId)?.loading ?? false;
    }
    function isAnyLoading() {
        for (const q of queries.values())if (q.loading) return true;
        return false;
    }
    function invalidate(statementIds) {
        if (disposed || !toolProvider) return;
        const targets = statementIds?.length ? statementIds.filter((sid)=>queries.has(sid)) : [
            ...queries.keys()
        ];
        for (const sid of targets){
            const q = queries.get(sid);
            if (!q) continue;
            if (cache.get(q.cacheKey)?.inFlight) q.needsRefetch = true;
            else executeFetch(q.cacheKey, sid);
        }
    }
    function registerMutations(nodes) {
        const activeIds = new Set(nodes.map((n)=>n.statementId));
        for (const sid of mutations.keys())if (!activeIds.has(sid)) mutations.delete(sid);
        for (const node of nodes){
            const existing = mutations.get(node.statementId);
            if (existing) {
                if (existing.toolName !== node.toolName) {
                    existing.toolName = node.toolName;
                    existing.result = {
                        status: "idle",
                        data: null,
                        error: null
                    };
                    existing.error = void 0;
                }
            } else mutations.set(node.statementId, {
                toolName: node.toolName,
                result: {
                    status: "idle"
                }
            });
        }
        if (rebuildSnapshot()) notify();
    }
    async function fireMutation(statementId, evaluatedArgs, refreshQueryIds) {
        if (disposed || !toolProvider) return false;
        const m = mutations.get(statementId);
        if (!m) return false;
        if (m.result.status === "loading") return false;
        const gen = generation;
        m.result = {
            status: "loading"
        };
        rebuildSnapshot();
        notify();
        let success = false;
        try {
            const data = await toolProvider.callTool(m.toolName, evaluatedArgs);
            if (disposed || gen !== generation) return false;
            m.result = {
                status: "success",
                data
            };
            m.error = void 0;
            success = true;
        } catch (err) {
            if (disposed || gen !== generation) return false;
            const msg = err instanceof Error ? err.message : String(err);
            m.result = {
                status: "error",
                error: msg
            };
            if (err instanceof ToolNotFoundError) m.error = {
                source: "mutation",
                code: "tool-not-found",
                message: `Mutation tool "${m.toolName}" not found`,
                statementId,
                component: "Mutation",
                toolName: m.toolName,
                hint: err.availableTools.length ? `Available tools: ${err.availableTools.join(", ")}` : void 0
            };
            else if (err instanceof McpToolError) m.error = {
                source: "mutation",
                code: "mcp-error",
                message: `Mutation "${m.toolName}" returned an error: ${err.toolErrorText}`,
                statementId,
                component: "Mutation",
                toolName: m.toolName
            };
            else m.error = {
                source: "mutation",
                code: "tool-error",
                message: `Mutation "${m.toolName}" failed: ${msg}`,
                statementId,
                component: "Mutation",
                toolName: m.toolName
            };
        }
        rebuildSnapshot();
        notify();
        if (success && refreshQueryIds?.length) invalidate(refreshQueryIds);
        return success;
    }
    function getMutationResult(statementId) {
        return mutations.get(statementId)?.result ?? null;
    }
    function subscribe(listener) {
        listeners.add(listener);
        return ()=>listeners.delete(listener);
    }
    function getSnapshot() {
        return snapshot;
    }
    function activate() {
        disposed = false;
    }
    function dispose() {
        disposed = true;
        generation++;
        listeners.clear();
        for (const q of queries.values()){
            if (q.timer) {
                clearInterval(q.timer);
                q.timer = void 0;
            }
            q.refreshInterval = 0;
            q.loading = false;
            q.needsRefetch = false;
        }
        mutations.clear();
    }
    return {
        evaluateQueries,
        getResult,
        isLoading,
        isAnyLoading,
        invalidate,
        registerMutations,
        fireMutation,
        getMutationResult,
        subscribe,
        getSnapshot,
        activate,
        dispose
    };
}
//#endregion
//#region src/runtime/state-field.ts
function resolveStateField(name, bindingValue, store, evaluationContext, fieldGetter, fieldSetter) {
    if (isReactiveAssign(bindingValue) && store && evaluationContext) {
        const { target, expr } = bindingValue;
        return {
            name,
            value: store.get(target),
            setValue: (value)=>{
                const extraScope = {
                    $value: value
                };
                const nextValue = evaluate(expr, {
                    ...evaluationContext,
                    extraScope
                });
                store.set(target, nextValue);
            },
            isReactive: true
        };
    }
    return {
        name,
        value: fieldGetter(name) ?? bindingValue,
        setValue: (value)=>fieldSetter(name, value),
        isReactive: false
    };
}
//#endregion
//#region src/runtime/store.ts
function createStore() {
    const state = /* @__PURE__ */ new Map();
    const listeners = /* @__PURE__ */ new Set();
    let snapshot = {};
    function notify() {
        const currentListeners = [
            ...listeners
        ];
        for (const listener of currentListeners)listener();
    }
    function rebuildSnapshot() {
        snapshot = Object.fromEntries(state);
    }
    function get(name) {
        return state.get(name);
    }
    function set(name, value) {
        const existing = state.get(name);
        if (Object.is(existing, value)) return;
        if (value && existing && typeof value === "object" && typeof existing === "object" && !Array.isArray(value) && !Array.isArray(existing)) {
            const nk = Object.keys(value);
            const ok = Object.keys(existing);
            if (nk.length === ok.length && nk.every((k)=>Object.is(value[k], existing[k]))) return;
        }
        state.set(name, value);
        rebuildSnapshot();
        notify();
    }
    function subscribe(listener) {
        listeners.add(listener);
        return ()=>{
            listeners.delete(listener);
        };
    }
    function getSnapshot() {
        return snapshot;
    }
    function initialize(defaults, persisted) {
        for (const key of Object.keys(persisted))state.set(key, persisted[key]);
        for (const key of Object.keys(defaults))if (!state.has(key)) state.set(key, defaults[key]);
        rebuildSnapshot();
        notify();
    }
    function dispose() {
        state.clear();
        listeners.clear();
        snapshot = {};
    }
    return {
        get,
        set,
        subscribe,
        getSnapshot,
        initialize,
        dispose
    };
}
//#endregion
//#region src/utils/validation.ts
/**
* Parse a rule string into a structured rule.
*   "required"       → { type: "required" }
*   "min:8"          → { type: "min", arg: 8 }
*   "minLength:3"    → { type: "minLength", arg: 3 }
*   "pattern:^[a-z]" → { type: "pattern", arg: "^[a-z]" }
*/ const NUMERIC_RULES = new Set([
    "min",
    "max",
    "minLength",
    "maxLength"
]);
function parseRule(rule) {
    const colonIdx = rule.indexOf(":");
    if (colonIdx === -1) return {
        type: rule
    };
    const type = rule.slice(0, colonIdx);
    const rawArg = rule.slice(colonIdx + 1);
    return {
        type,
        arg: NUMERIC_RULES.has(type) && !Number.isNaN(Number(rawArg)) ? Number(rawArg) : rawArg
    };
}
function parseRules(rules) {
    if (!Array.isArray(rules)) return [];
    return rules.filter((r)=>typeof r === "string").map(parseRule);
}
function isEmpty(value) {
    if (value === null || value === void 0 || value === "") return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (value && typeof value === "object" && !Array.isArray(value) && "value" in value) return isEmpty(value.value);
    if (typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === 0) return true;
    return false;
}
const builtInValidators = {
    required: (value)=>{
        if (isEmpty(value)) return "This field is required";
        if (typeof value === "object" && !Array.isArray(value) && value !== null) {
            const vals = Object.values(value);
            if (vals.length > 0 && vals.every((v)=>typeof v === "boolean") && !vals.some(Boolean)) return "At least one option is required";
        }
    },
    email: (value)=>{
        if (isEmpty(value)) return void 0;
        if (typeof value !== "string") return "Please enter a valid email";
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? void 0 : "Please enter a valid email";
    },
    url: (value)=>{
        if (isEmpty(value)) return void 0;
        if (typeof value !== "string") return "Please enter a valid URL";
        try {
            new URL(value);
            return;
        } catch  {
            return "Please enter a valid URL";
        }
    },
    numeric: (value)=>{
        if (isEmpty(value)) return void 0;
        if (typeof value === "number" && !isNaN(value)) return void 0;
        if (typeof value === "string" && !isNaN(parseFloat(value)) && value.trim() !== "") return void 0;
        return "Must be a number";
    },
    min: (value, arg)=>{
        if (isEmpty(value)) return void 0;
        const n = typeof value === "number" ? value : parseFloat(String(value));
        if (isNaN(n)) return void 0;
        const min = Number(arg);
        return n >= min ? void 0 : `Must be at least ${min}`;
    },
    max: (value, arg)=>{
        if (isEmpty(value)) return void 0;
        const n = typeof value === "number" ? value : parseFloat(String(value));
        if (isNaN(n)) return void 0;
        const max = Number(arg);
        return n <= max ? void 0 : `Must be no more than ${max}`;
    },
    minLength: (value, arg)=>{
        if (isEmpty(value)) return void 0;
        if (typeof value !== "string") return void 0;
        const min = Number(arg);
        return value.length >= min ? void 0 : `Must be at least ${min} characters`;
    },
    maxLength: (value, arg)=>{
        if (isEmpty(value)) return void 0;
        if (typeof value !== "string") return void 0;
        const max = Number(arg);
        return value.length <= max ? void 0 : `Must be no more than ${max} characters`;
    },
    pattern: (value, arg)=>{
        if (isEmpty(value)) return void 0;
        if (typeof value !== "string" || typeof arg !== "string") return void 0;
        try {
            return new RegExp(arg).test(value) ? void 0 : "Invalid format";
        } catch  {
            return;
        }
    }
};
/**
* Run all rules against a value. Stop on first error.
* Custom validators are checked first, then built-in ones.
*/ function validate(value, rules, customValidators) {
    for (const rule of rules){
        const validator = customValidators?.[rule.type] ?? builtInValidators[rule.type];
        if (!validator) {
            console.warn(`[openui] Unknown validation rule type: "${rule.type}"`);
            continue;
        }
        const error = validator(value, rule.arg);
        if (error) return error;
    }
}
/**
* Parse a structured rules object into ParsedRule[].
* Accepts: { required: true, minLength: 5, email: true, max: 100 }
* Skips keys with false/undefined values.
*/ function parseStructuredRules(rules) {
    if (!rules || typeof rules !== "object" || Array.isArray(rules)) return [];
    const obj = rules;
    const result = [];
    for (const [key, val] of Object.entries(obj)){
        if (val === false || val === void 0 || val === null) continue;
        if (val === true) result.push({
            type: key
        });
        else result.push({
            type: key,
            arg: val
        });
    }
    return result;
}
;
}),
];

//# sourceMappingURL=1flv_%40openuidev_lang-core_dist_index_mjs_0hrz5ou._.js.map