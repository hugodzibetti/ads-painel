# FASIPE / ADS Research — Official & Public Sources (2026-07-03)

Research conducted to complement the internal knowledge base (`data/knowledge-base.json`), which
currently contains only information inferred from WhatsApp chat messages. This document collects
facts found via web search and direct fetch of primary sources — mainly FASIPE's own official
site (`fasipe.com.br`) and MEC's official CNCST catalog. **This file is not merged into the
knowledge base — a human should review it first.**

Institution identity confirmed during this research: the school currently calls itself
**"UNIFASIPE Centro Universitário"** (upgraded in status from "Faculdade Fasipe"), part of
**"Grupo Fasipe Educacional"**, whose mantenedora (legal maintaining entity) is **"FASIPE Centro
Educacional Ltda."** — Source: https://www.fasipe.com.br/institucional/fasipe-institucional and
cover page of the official PPC PDF (see below). I searched specifically for a relationship to
Grupo UNINTA or Ser Educacional (both known for acquiring small regional colleges) and found no
evidence of either owning or operating FASIPE — search results only turned up unrelated Ser
Educacional acquisitions (Uninorte, UniRitter, Fadergs, etc. — none in Mato Grosso). Treat "FASIPE
is independently owned by Grupo Fasipe Educacional" as the working assumption, not a hard-proven
negative.

---

## 1. Official academic calendar

**No 2026 academic calendar was found publicly on fasipe.com.br as of this research (2026-07-03),
despite the 2026/1 semester already being underway.** I checked three likely locations:

- https://www.fasipe.com.br/institucional/regulamentos — newest calendar listed: "CALENDÁRIO
  ACADÊMICO DISCENTE - 2023/2" and "CALENDÁRIO ACADÊMICO" (03/01/2023).
- https://www.fasipe.com.br/aluno/manuais-e-normativas — newest calendar listed: "DISCENTES -
  CALENDÁRIO ACADÊMICO 2022.1" (09/03/2022); older ones back to 2017/2.
- https://www.fasipe.com.br/graduacao/editais-e-publicacoes — newest calendar listed:
  **"CALENDÁRIO ACADÊMICO 2024.2"** (published 31/07/2024) —
  https://www.fasipe.com.br/upload/mod_publicacoes/824/66aa51657035e.pdf — this is the most
  recent full calendar I could find and access.

None of these three pages had progressed to listing a 2025 or 2026 full calendar at the URL
patterns checked; it's possible a 2025/2026 calendar exists behind a different page or requires
student portal login (Mentorweb, `http://fasipe.mentorweb.ws/`) that I could not access.

### What the 2024/2 calendar (real, extracted from the PDF) shows about structure

Source: https://www.fasipe.com.br/upload/mod_publicacoes/824/66aa51657035e.pdf (OCR'd via
`pdftotext`, image-embedded but text layer present)

- Semester start: **05/08/2024** ("Início das aulas", all units), preceded by "Semana Pedagógica"
  30/07–03/08.
- **N1** ("Avaliação N1", all semesters): main window **16–21/09/2024**, 2ª chamada **28/09/2024**.
  (Also an earlier "Semana de Atividade (N1)" 26–31/08.)
- **N2 – Prova Integrada (PI)**: **21/10/2024**, 2ª chamada **26/10/2024**.
- **N3**: main window **28/11–04/12/2024**, 2ª chamada **05/12/2024**.
- **Prova Substitutiva**: request deadline until 10/12 (21:00h), exam **11–12/12/2024**.
- **Exame Final**: **16–17/12/2024**.
- Docent/coordinator recess: **19/12/2024 – 20-21/01/2025**.
- Holidays/recesses noted: 07/09 (Independência do Brasil), 14/09 (aniversário de Sinop), 12–15/10
  (Nossa Senhora Aparecida), 02/11 (Finados), 15–16/11 (Proclamação da República), 20/11
  (Consciência Negra), 08/12 (Cuiabá — N. Sra da Conceição).
- TCC I/II/III have their own sub-schedule (protocolo, bancas, seminários) embedded in the same
  calendar, running Nov–Dec.

### More recent (but partial) evidence: ADS-specific exam edital for 2025/2

Source: https://www.fasipe.com.br/upload/mod_cursos/4/692de5a2eda41.pdf — **"EDITAL Nº. 06 –
2025/2 — CURSO ANÁLISE E DESENVOLVIMENTO DE SISTEMAS — PROVA EXAME"**, published/signed
**Sinop-MT, 22 de novembro de 2025**, by **Cides Semprebom Bezerra, "Coordenação do Curso de ADS,
UNIFASIPEJET / Sinop"**.

Quoted verbatim: *"A Coordenação do Curso de Análise e Desenvolvimento de Sistemas da
UNIFASIPEJET FAZ SABER que nos dias 15 e 16 de dezembro de 2025 ocorrerá a prova EXAME de todas as
das turmas de 1º a 5º semestre"*. Key rules stated in the edital:
- Exame Final held in-person, 19:00–22:10, at UNIFASIPEJET.
- No request needed in "Mentor" — students below 7.0 semester average are automatically in Exame
  Final; below 3.0 they are failed outright and don't take it.
- Exame Final worth 10.0 points; students arriving >1h late lose the right to take it (case-by-case
  exception via coordination).

This confirms the **N1 / N2 (Prova Integrada) / N3 / Prova Substitutiva / Exame Final** structure
described in the FASIPE student manual (see below) was still in effect for the 2025/2 semester, and
gives a real, dated, ADS-specific exam schedule — just not for 2026.

A companion edital exists but its content was not extracted in full: "EDITAL ANÁLISE E
DESENVOLVIMENTO DE SISTEMAS Nº05 - PROVA SUBSTITUTIVA 2025-2" —
https://www.fasipe.com.br/upload/mod_cursos/4/692de5893162d.pdf. Similarly for the prior semester:
"EDITAL ADS - Prova Exame 2025.01" (https://www.fasipe.com.br/upload/mod_cursos/4/685acc5f0d720.pdf)
and "EDITAL ADS - Prova Substitutiva 2025.01"
(https://www.fasipe.com.br/upload/mod_cursos/4/685acc1013122.pdf).

### N1/N2/N3 general policy (institution-wide, undated specifics)

Source: FASIPE "Manual do Aluno e Comunidade Acadêmica", updated 2025 —
https://www.fasipe.com.br/upload/mod_publicacoes/853/68ee873154a09.pdf (signed by "Prof.° Deivison
Benedito Campos Pinto, Diretor Presidente Grupo Fasipe"). Confirms the assessment model
system-wide: *"N1: Trabalho + Prova, N2: Prova Integrada – PI + N3: Trabalho + Prova"* and that
exact dates for N1/N2/N3, segunda chamada, prova substitutiva, and exame final are set each
semester by the "Calendário Acadêmico em vigência" (i.e., there is no fixed yearly date — it's
republished every semester, which matches why I could not find a static 2026 version yet).

---

## 2. ADS course curriculum ("matriz curricular")

### FASIPE-specific: official PPC (Projeto Pedagógico de Curso), dated 2017

Source: https://www.fasipe.com.br/upload/mod_cursos/4/598dbf4cc9d7e.pdf (119 pages, cover page
reads "SINOP / MATO GROSSO — 2017", mantenedora "FASIPE CENTRO EDUCACIONAL LTDA.", mantida
"FACULDADE FASIPE – FASIPE"). Extracted via `pdftotext -layout` (has an embedded text layer).

- Official course name: **"Curso Superior de Tecnologia em Análise e Desenvolvimento de
  Sistemas"**, Eixo Tecnológico "Informação e Comunicação".
- Duration: **"terá a duração de 2.120 horas/relógio, a serem integralizadas no prazo mínimo de 05
  (cinco) e no máximo de 08 (oito) semestres"** (line ~432 of extracted text).
- Modality: presencial, Sinop/MT.
- Full 5-semester curriculum table with subject → semester → assigned professor (as documented at
  the time this PPC was written/last updated):
  - **1º semestre – Formação Básica**: Fundamentos de Hardware e Software; Inglês Instrumental;
    Introdução a Algoritmo e Programação; Matemática Aplicada; Metodologia Científica e
    Tecnológica; Programação e Design para Web; Sistemas de Informações Gerenciais.
  - **2º semestre – Suporte de Sistemas Informatizados**: Arquitetura de Computadores; Banco de
    Dados; Computação Gráfica; Estrutura de Dados e Organização de Arquivos; Linguagem de
    Programação; Paradigma de Programação; Projeto Interdisciplinar I.
  - **3º semestre – Estrutura de Sistemas de Informação**: Engenharia de Software; Metodologia de
    Desenvolvimento de Sistemas; Programação Orientada a Objeto I; Projeto Interdisciplinar II;
    Redes de Computadores I; Sistemas Operacionais.
  - **4º semestre – Análise e Projetos de Sistemas de Informação**: Programação Orientada a
    Objetos II; Programação para dispositivos móveis; Projeto Interdisciplinar III; Redes de
    Computadores II; Segurança e Auditoria da Informação; Tópicos Avançados em Des. de Sistemas;
    Trabalho de Conclusão de Curso I.
  - **5º semestre – Gerenciamento de Sistemas de Informação**: Cultura Afro-Brasileira e Relações
    Étnico-Raciais; Educação Ambiental e Sustentabilidade; Empreendedorismo e Inovação; Ética,
    Direitos Humanos e Legislação; Gestão de Projetos de TI; Inteligência Artificial; Optativa;
    Projeto Interdisciplinar IV; Trabalho de Conclusão de Curso II.
- Professor names attached to each 2017-era discipline (note: several rows say **"NÃO OCORRE"**,
  meaning that offering wasn't running for that snapshot): Rogério Lúcio Lima, Gleyçon Benedito de
  Figueiredo, Renato Cristiano Torres, Edson Adriano Vendrusculo, Edna Costa Cavenaghi, Adriano
  Cardoso Barreto, Kleison Roberto de Souza Silva, José Maria Tanganelli Júnior, Andrei Júnior
  Pazinato, Rui Ogawa, Tiago Alinor Hoissa Benfica, Adriano Marcos Rodrigues, Rodolfo Fares Paulo.
  **None of the four professor names already known from chat data (Thiago Sauer Land, Maysa,
  Mônica da Silva, David Alves) appear anywhere in this document.**

### Important discrepancy: the curriculum has visibly changed since 2017

The 2025/2 ADS exam edital (§1 above, https://www.fasipe.com.br/upload/mod_cursos/4/692de5a2eda41.pdf)
lists **different subjects actively being examined per semester** than the 2017 PPC table above,
e.g.:
- 1st/2nd semester (2025/2): "Arquitetura de Computadores", "Estrutura de Dados e Organização de
  Arquivos", "Engenharia de Software", "Linguagem de Programação", "Análise de Requisitos e
  Prototipação de Hardware e Software".
- 3rd/4th semester (2025/2): **"DevOps & Cloud Computing"**, "Gerenciamento de Redes Avançadas",
  "Programação Orientada a Objetos", **"Mobile Developement"**, "Tecnologia e TI - Disciplina
  Rotativa".
- 5th semester (2025/2): "Metodologia de Desenvolvimento de Sistemas", "Gerenciamento de Redes
  Avançadas", "Programação Orientada a Objetos", "Metodologia Científica e Tecnológica -
  Agronomia".

This strongly suggests the matriz curricular has been revised at least once since 2017 (note also
a separate document title found on the course page: **"Regulamento Disciplinas Optativas - MATRIZ
2016 - ADS"**, implying a matriz dated 2016 was itself already a specific, named revision). **I
could not confirm the current, complete, semester-by-semester matriz** because the standalone PDF
titled "Matriz curricular - ANÁLISE E DESENVOLVIMENTO DE SISTEMAS"
(https://www.fasipe.com.br/upload/mod_cursos/4/5a32cb7535c2d.pdf) is a **scanned image with no
text layer** — `pdftotext` returned zero extractable lines, and no OCR tool (`tesseract`) was
available in this environment to read it.

### National baseline: MEC's CNCST (Catálogo Nacional de Cursos Superiores de Tecnologia)

Source: official MEC PDF, 2016 edition — https://www.gov.br/mec/pt-br/media/seb-1/pdf/catalogo_cnct/CNCST__2016_a.pdf
(downloaded and text-extracted directly; page 52 of the document).

Full entry for **"Curso Superior de Tecnologia em Análise e Desenvolvimento de Sistemas"**, Eixo
Tecnológico **Informação e Comunicação**, **2000 horas** (minimum course load):

> **Perfil profissional de conclusão:** "Analisa, projeta, desenvolve, testa, implanta e mantém
> sistemas computacionais de informação. Avalia, seleciona, especifica e utiliza metodologias,
> tecnologias e ferramentas da Engenharia de Software, linguagens de programação e bancos de
> dados. Coordena equipes de produção de softwares. Vistoria, realiza perícia, avalia, emite laudo
> e parecer técnico em sua área de formação."

> **Infraestrutura mínima requerida:** Biblioteca incluindo acervo específico e atualizado;
> Laboratório de informática com programas e equipamentos compatíveis com as atividades
> educacionais do curso; Laboratório de redes de computadores.

> **Campo de atuação:** Empresas de planejamento, desenvolvimento de projetos, assistência técnica
> e consultoria; Empresas de tecnologia; Empresas em geral (indústria, comércio e serviços);
> Organizações não-governamentais; Órgãos públicos; Institutos e Centros de Pesquisa; Instituições
> de Ensino, mediante formação requerida pela legislação vigente.

> **Ocupações CBO associadas:** 2124-05 - Tecnólogo em análise e desenvolvimento de sistemas;
> 2124-05 - Tecnólogo em processamento de dados.

> **Possibilidades de prosseguimento de estudos na Pós-Graduação:** Pós-graduação na área de
> Ciência da Computação, entre outras.

**Note on catalog version:** MEC published a 4th edition of the CNCST in June 2024 (formalized via
Portaria nº 514, 04/06/2024 — announced at
https://www.gov.br/mec/pt-br/assuntos/noticias/2024/junho/mec-publica-novo-catalogo-de-cursos-superiores-de-tecnologia,
"25 novos cursos, abrangendo 153 graduações de tecnólogo", now organized into 37 technological
areas). This 4th edition is **fully digital**, hosted only at https://cncst.mec.gov.br/ (no
downloadable PDF from a gov.br domain that I could find) and **that live site returned HTTP 403
(bot-protection) on every fetch attempt**, including via `r.jina.ai` proxy. I therefore could not
confirm whether the ADS entry's wording changed between the 2016 and 2024 editions — the quotes
above are from the verified 2016 edition, cited as the national baseline per the task's
instructions.

---

## 3. FASIPE faculty/professor directory

**No official, current "corpo docente" (faculty directory) page was found for the ADS course.** I
searched for a dedicated listing page on fasipe.com.br and found none (search results only
surfaced faculty pages for *other* institutions' ADS programs — FIAP, IFPE, FSA, UPF, FASEH —
not FASIPE's).

The only two official, named-professor sources found for FASIPE's ADS program:

1. The 2017 PPC's per-discipline professor table (§2 above) — 13 named professors, **none matching
   the four names already known from chat data** (Thiago Sauer Land, Maysa, Mônica da Silva, David
   Alves). This table is ~8 years old, so it likely does not reflect the current 2026 teaching
   staff either way.
2. Course coordinator, from two conflicting official sources:
   - Course page (fetched 2026-07-03): **"Professor Mestre Willian Hübner"** —
     https://www.fasipe.com.br/graduacao/cursos/analise-e-desenvolvimento-de-sistemas-4
   - Nov-2025-dated exam edital, signed: **"Cides Semprebom Bezerra — Coordenação do Curso de
     ADS — UNIFASIPEJET / Sinop"** —
     https://www.fasipe.com.br/upload/mod_cursos/4/692de5a2eda41.pdf

   These two names do not match each other, and neither matches "Thiago Sauer Land" (the
   coordinator named in the chat-derived knowledge base). This could mean: the coordinator role
   changed between Nov 2025 and now; the course page text is stale; or FASIPE has co-coordinators
   for different modalities/campuses. **I could not resolve this discrepancy from public sources.**

---

## 4. MEC/national guidelines for ADS tecnólogo courses

Covered in full under §2 ("National baseline") above — the CNCST 2016 PDF is the authoritative,
directly-quotable primary source for competencies, minimum course load (2000h), CBO occupation
codes, and career-field description. I did not find a separate, distinct "labor market expectations"
document from MEC beyond what's in the CNCST entry itself (campo de atuação + CBO codes are MEC's
own framing of market/skill expectations). Third-party sites (Quero Bolsa, Guia da Carreira) have
their own market-expectation write-ups but these are not primary/official sources, so they are
intentionally excluded here per the task's sourcing priority.

---

## Could not verify

- **2026 FASIPE academic calendar** (any semester) — not found on fasipe.com.br as of 2026-07-03;
  most recent full calendar located is 2024/2. It is possible a 2025 or 2026 version exists behind
  the student portal (Mentorweb) or a page/URL pattern not discovered in this search.
- **Exact current (2026) ADS matriz curricular**, subject-by-subject — the official standalone PDF
  is a non-OCR'd scanned image; only a partial subject list could be reconstructed indirectly from
  a 2025/2 exam edital, and it clearly differs from the 2017 PPC table.
- **Current ADS course coordinator's real identity** — two official documents give two different
  names (Willian Hübner vs. Cides Semprebom Bezerra), and neither matches the chat-derived
  "Thiago Sauer Land."
- **Whether Thiago Sauer Land, Maysa, Mônica da Silva, or David Alves appear in any official FASIPE
  publication** — none of the four were found in any document I could access.
- **A dedicated FASIPE "corpo docente" / faculty directory page** — none found; FASIPE's site does
  not appear to publish one in a form discoverable via search or the course page.
- **Whether the CNCST's 4th edition (2024, digital-only) changed the ADS entry's wording** —
  cncst.mec.gov.br returned HTTP 403 (bot protection) on every direct-fetch attempt, including via
  a proxy reader; only the 2024 edition's existence and general scope (from MEC's own announcement
  page) could be confirmed, not its ADS-specific text.
- **Definitive proof that FASIPE is NOT owned by Grupo UNINTA or Ser Educacional** — no evidence of
  such ownership was found (mantenedora is stated as "FASIPE Centro Educacional Ltda" across
  multiple official documents), but this is an absence-of-evidence finding, not a confirmed
  negative from an authoritative registry (e.g., e-MEC's own IES search was not queried directly
  in this pass).
