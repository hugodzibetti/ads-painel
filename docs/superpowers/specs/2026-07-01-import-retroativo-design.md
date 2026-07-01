# Import retroativo dos exports do WhatsApp — Design

## Contexto

O CLAUDE.md já lista "importação retroativa do histórico completo (com mídia)" como Fase Futura, fora do escopo do MVP inicial. O usuário agora tem em mãos os dois exports completos com mídia (`Conversa do WhatsApp com ADS.zip` e `Conversa do WhatsApp com 1° ADS Fasipe Sorriso.zip`, em `~/Downloads`) e quer popular o banco com o histórico completo das duas turmas — não só mensagens novas capturadas pelo bot dali pra frente — para ter dados de referência e visualização retroativos.

Objetivo: importar os dois exports (texto + mídia relevante) pro mesmo schema já existente (`messages` + `activities`), reaproveitando ao máximo o pipeline de extração já auditado (`run_extraction()`), e processar mídia (PDF, imagem, áudio, vídeo) da forma mais barata possível — o usuário foi explícito sobre isso.

## Descobertas que moldam o design

- **Formato do export**: linhas `DD/MM/AAAA HH:MM - <autor>: <corpo>`; mensagens multi-linha continuam sem esse prefixo; mensagens de sistema (`criou o grupo`, `entrou usando o link`, aviso de criptografia) não têm `: ` após o autor.
- **Mídia**: dois placeholders distintos no `.txt` — `<Mídia oculta>` (mídia não incluída no export) e `NOME_ARQUIVO.ext (arquivo anexado)` (arquivo real presente no zip).
- **Volume**: ADS = 385 arquivos de mídia (275 webp, 48 jpg, 25 pdf, 21 opus, resto diverso); PROFS = 411 arquivos (183 jpg, 165 webp, 37 pdf, 16 mp4, 4 opus). PDFs incluem editais/gabaritos oficiais (ex: `EDITAL PROVA N3 ADS 2026 PROVAS-1.pdf`) — provavelmente a fonte mais rica de prazo retroativo.
- **Modelos disponíveis (pesquisado, não assumido)**:
  - `OPENCODE_BASE_URL` atual (`.../zen/go/v1`, plano Go, $10/mês fixo) só tem 13 modelos de texto (GLM, Kimi, DeepSeek, MiMo, MiniMax, Qwen) — nenhum com suporte a visão documentado, nenhum é Haiku.
  - Claude Haiku 4.5 só existe no OpenCode Zen "normal" (`.../zen/v1`, cobrado por token: $1 input / $5 output por milhão), fora do plano Go.
  - Nenhum dos dois endpoints do OpenCode oferece transcrição de áudio.
  - `faster-whisper` com modelo `large-v3` cabe em ~3GB de VRAM em fp16 — roda de graça localmente na máquina do usuário (24GB RAM, 4-6GB VRAM confirmados).

## Privacidade (restrição dura)

Os `.zip` ficam em `~/Downloads`, fora do repositório git. O script de import lê diretamente de lá (ou de um diretório já descompactado) via argumento de CLI — **nunca copia mídia (fotos, áudios, nomes reais de colegas) para dentro de qualquer pasta versionada** (`data/`, `bot/`, etc). Apenas o texto derivado (corpo original, texto extraído de PDF, transcrição de áudio, legenda de imagem) é persistido em `messages.body` no `data/app.db` local, que já está no `.gitignore`. Os exports e mídia originais nunca são commitados.

## Arquitetura

Script novo e isolado: `app/scripts/import_export.py`. Não modifica `bot/` nem o pipeline ao vivo. Roda manualmente via CLI, recebendo os caminhos dos dois exports como argumento.

```
import_export.py <zip_ou_dir_alunos> <zip_ou_dir_profs>
  │
  ├─ 1. parse_export()      → parseia o .txt de cada grupo em mensagens estruturadas
  ├─ 2. resolve_media()     → resolve cada referência de mídia em texto (ver tabela abaixo)
  ├─ 3. insert_message()    → insere em `messages` com id sintético + dedup (novo em app/lib/db.py)
  └─ 4. loop run_extraction() → reaproveita a função já existente sem alterações, até a fila zerar
```

### Parsing (`parse_export`)

Regex `^(\d{2}/\d{2}/\d{4}) (\d{2}:\d{2}) - ([^:]+): (.*)$` identifica mensagem real (autor nunca contém `:`). Linha que não bate nesse padrão é continuação da mensagem anterior (concatena) ou linha de sistema sem `: ` — sistema é descartado (mesmo espírito do filtro de `SYSTEM`/notificações que o bot ao vivo já aplica). Timestamp `DD/MM/AAAA HH:MM` (sem segundos, fuso `America/Sao_Paulo` implícito) é convertido pra ISO-UTC, igual ao formato que `messages.timestamp` já usa hoje.

### Resolução de mídia por tipo

| Tipo | Extensão | Processamento | Custo |
|---|---|---|---|
| Texto | — | corpo original, sem mudança | zero |
| PDF | `.pdf` | texto extraído localmente via `pypdf`; se vier vazio (PDF escaneado), fallback: 1ª página renderizada como imagem → Haiku | zero (quase sempre) |
| Imagem | `.jpg`/`.png` | legenda curta via Claude Haiku 4.5 (endpoint Zen normal, `OPENCODE_VISION_BASE_URL`/`OPENCODE_VISION_MODEL` novos, não tocam nas variáveis já usadas pelo pipeline ao vivo) | baixo (~231 imagens) |
| Áudio/PTT | `.opus` | transcrição local via `faster-whisper` (`large-v3`, GPU se `torch.cuda.is_available()`, senão CPU) | zero |
| Vídeo | `.mp4` | extrai trilha de áudio via `ffmpeg` (subprocess) e transcreve igual ao áudio; quadros visuais ignorados | zero |
| Figurinha | `.webp` | ignorada — placeholder `[figurinha]`, nenhuma chamada | zero |
| `<Mídia oculta>` | — | placeholder `[mídia não disponível]` | zero |
| Outros (`.docx/.pptx/.xlsx/.vcf`) | — | placeholder genérico `[arquivo: <nome>]`, fora de escopo | zero |

O texto resolvido (original, extraído, transcrito ou legenda) vira o `body` final da mensagem — mesma coluna que o pipeline ao vivo já usa pra placeholders como `[image]`, só que aqui com conteúdo real.

### Inserção + dedup (`app/lib/db.py`)

Nova função `insert_message(wa_message_id, group_label, author, body, timestamp)`, espelhando a semântica que `bot/db.js::insertMessage` já tem hoje (INSERT + swallow de violação de UNIQUE, log e segue).

Export não tem `wa_message_id` real do WhatsApp. ID sintético determinístico:
```
"import:" + sha256(f"{group_label}|{timestamp_iso}|{author}|{corpo_bruto}")
```
Reprocessar o mesmo export é idempotente — cai no mesmo caminho de "já existe" que o UNIQUE constraint já resolve.

Dedup contra mensagens que o bot ao vivo já capturou (sobreposição possível no fim de junho, já que o bot começou a rodar antes do import): antes de inserir, verifica se já existe uma linha com mesmo `group_label` + `author` + `timestamp` (mesmo minuto) + `body`; se sim, pula o insert do import (mensagem ao vivo já capturada tem prioridade).

### Extração de atividades

Depois de importado tudo em `messages` (`processed=0`), o script chama `run_extraction()` **sem nenhuma alteração** — a mesma função usada pelo botão "Atualizar" — em loop até `messages_remaining` zerar, imprimindo tokens/custo por rodada no terminal (mesma transparência de custo que a UI já dá, via CLI).

## Testes

Nenhum export real entra no repositório (dados pessoais de terceiros). Testes usam um `.txt` sintético pequeno fabricado no próprio teste (mensagem simples, multi-linha, linha de sistema, `<Mídia oculta>`, `arquivo anexado`) e arquivos de mídia triviais gerados on-the-fly (PDF de 1 página com texto conhecido, áudio curto sintético). Cobertura:
- Parsing: mensagem simples, multi-linha, linha de sistema filtrada, ambos os placeholders de mídia.
- Resolução de PDF com texto extraível.
- Dedup por ID sintético repetido (idempotência ao rodar o script duas vezes).
- Dedup contra mensagem já existente simulando captura ao vivo.
- Chamadas a Haiku (visão) e a `faster-whisper` são mockadas nos testes — nunca custo real de API nem dependência de GPU/modelo baixado durante o CI/teste local.

## Fora de escopo desta rodada

- Interface na UI Streamlit pra disparar o import (fica CLI-only por enquanto).
- Extração de conteúdo de `.docx/.pptx/.xlsx` (placeholder apenas).
- Vídeo além da trilha de áudio (sem análise de quadros visuais).
