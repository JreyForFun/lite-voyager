# Lite Voyager: Clean context for AI

Status: Draft v0.1 | How to give an AI exactly what it needs and nothing more.

**Why this matters:** free models have small context windows and no memory between chats. In a long chat they forget rules, mix up tasks, and invent details. The fix is not a smarter prompt. It is starting clean, with the same small set of files, every time.

---

## 1. Rules

1. **One task per chat.** When the task is done, end the chat.
2. **New chat for each of these:** a new task, a new milestone, a review, and recovery after the AI goes off track.
3. **Never carry a long conversation across a phase.** Hand off through files (`PROGRESS.md`, specs, git), not through chat history.
4. **Paste exact text, not your paraphrase.** Requirement wording matters.
5. **Small is better.** If the context pack for a task does not fit comfortably (a rough guide: under about 2,000 words of pasted material), the task is too big. Split it in `TASKS.md`.
6. **Files are the memory.** Anything the AI must remember goes into a file: a decision into `PLAN.md`, a result into `PLAN.md`, a status into `PROGRESS.md`, a bug into a test.
7. **Stop early.** If the AI starts repeating itself, forgetting rules, or contradicting earlier answers, the chat is full. Run the session-end prompt and start a new one.

---

## 2. The three layers of context

| Layer | Contents | Size | Loaded |
|---|---|---|---|
| **Always** | `AGENTS.md`, `specs/CONSTITUTION.md`, `PROGRESS.md` | Small (keep each short) | Every session |
| **Phase pack** | The spec and plan sections for the current milestone (table below) | Medium | When a milestone starts, and kept as the reference for its tasks |
| **Task pack** | The one task line from `TASKS.md`, the full text of the requirements it links to, and anything the AI must integrate with (for example the Engine interface file) | Small | Every task |

Leave out everything else: other milestones, the competitor table, and old chat history.

---

## 3. Phase packs (what to load, what to skip)

| Phase | Load from `SPEC.md` | Load from `PLAN.md` | Also load | Skip |
|---|---|---|---|---|
| **0B** Foundation and spikes | NFR-002, NFR-003, NFR-004 | Section 1 (stack), D-3, section 3 (architecture), section 4 (protocol), section 8 (layout) | `VALIDATION.md` section 1 | All FR text, competitor table |
| **1** Read-only SQLite | FR-001 to FR-003, FR-010, FR-011, FR-014 to FR-018, section 4.1, section 5.5 | D-3, D-7, section 3, section 4 | `VALIDATION.md` section 4 (M1) and section 5 | FR-004 to FR-007, FR-02x, FR-03x |
| **2** Other formats | FR-004 to FR-007, FR-012, section 4.1 | D-6, section 5 (import pipeline), section 6 (loader interface), section 7 (open behavior) | `VALIDATION.md` M2 checklist | Editing requirements |
| **3** Editing | FR-016, FR-020, FR-021, FR-013, FR-040 | D-7, D-8, section 4 (edit messages) | `VALIDATION.md` M3 checklist | Import details |
| **4** Differentiators | FR-022, FR-030, section 2 (benchmark goals) | D-6, risks R-1 and R-5 | `VALIDATION.md` M4 checklist | Everything else |

Handy tool (task T-051): `npm run ctx -- T-012` prints the task line, the full text of the requirements it links to, and the Constitution, ready to paste. Until it exists, copy the text by hand.

---

## 4. Prompt templates

### Task kickoff (new chat)

```
Read these, in order: AGENTS.md, specs/CONSTITUTION.md, PROGRESS.md.

Today's task is <TASK ID> from specs/TASKS.md:
<paste the task line>

Requirements it must satisfy (exact text):
<paste the FR / NFR text>

Relevant plan sections:
<paste only what the phase pack lists>

Existing code you must fit with (if any):
<paste the interface file or relevant function signatures>

First, restate the task and its acceptance criteria in your own words,
list the files you will create or change, and list any assumptions or
anything you are unsure about. Wait for my OK before writing code.
```

### Session end (same chat, when the task is done or the chat is getting long)

```
We are stopping. Please:
1. List what is finished and what is not.
2. Show the evidence: which tests cover which acceptance criteria.
   I will run `npm run verify` and paste the result.
3. Give me the full updated text for PROGRESS.md (under 40 lines).
4. Say which TASKS.md checkbox may be ticked, and only tick it if the
   acceptance criteria pass.
5. List any spec or plan change you think is needed. Do not apply it.
```

### Phase kickoff (new chat, start of a milestone)

```
Read: AGENTS.md, specs/CONSTITUTION.md, PROGRESS.md.
We are starting Milestone <N>: <name>.
Here is the phase pack: <paste the sections from the table in section 3>
Here is the milestone's task list: <paste the tasks>.

Do not write code yet. Tell me:
1. The order you would do the tasks in, and why.
2. Risks or unclear points in the requirements.
3. Any task that looks too big and should be split.
```

### Recovery (new chat, when things went wrong)

```
Read: AGENTS.md, specs/CONSTITUTION.md, PROGRESS.md.
Something went wrong on <TASK ID>. Here is what I see:
<error output, or what behaves wrongly>
Here is the relevant file / diff: <paste>
Here is the requirement it should satisfy: <paste>

Do not change anything yet. First explain the most likely cause and how
we can confirm it with a test or a command. Then wait for my OK.
```

For review prompts see `VALIDATION.md` section 6.

---

## 5. Phase transition ritual ("clean slate")

At the end of every milestone, in this order:

1. Run `npm run verify:full` and the manual QA checklist (`VALIDATION.md`).
2. Do the independent review (fresh chat) and fix real findings.
3. Write measured results and lasting decisions into `PLAN.md`.
4. Update the changelogs of any spec file you touched.
5. Overwrite `PROGRESS.md`.
6. Commit, then tag (for example `v0.1.0`).
7. **Close the chat.** Start the next milestone with the phase kickoff prompt in a new chat.

---

## 6. Keep the specs easy to excerpt

- Keep stable IDs (FR-xxx, NFR-xxx, D-x, R-x, T-xxx). They are how you point at an exact piece of text.
- One requirement per block. If a block grows past a short paragraph with a few criteria, split it.
- If a spec file grows beyond a comfortable size, split it by topic rather than letting it balloon.
- Never rely on "as discussed earlier". If it matters, it is in a file.

## Changelog
- v0.1: Initial version.
