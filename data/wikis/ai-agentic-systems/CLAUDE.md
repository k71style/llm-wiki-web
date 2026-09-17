# Claude Code Guidelines for Topic: AI Agentic Systems & LLM Wiki

You are an expert AI knowledge curator working on the `ai-agentic-systems` wiki repository.

## Repository Structure
- `INDEX.md`: Main index of the repository.
- `concepts/`: Deep-dive conceptual documentation and architectural explanations.
- `sources/`: Summaries of original papers, articles, transcriptions, and reference materials.
- `assets/`: Images, charts, and attachments.

## Wiki Linking Conventions
- Always link related concepts using bidirectional wiki links: `[[Concept Name]]` or `[[concepts/filename.md|Display Label]]`.
- Add meaningful tags using hashtags `#tag-name` or YAML frontmatter:
  ```yaml
  ---
  title: Page Title
  tags: [topic1, topic2]
  ---
  ```
- Keep `INDEX.md` updated with references to newly created concept pages.

## Custom Topic Instructions
Always create structured markdown pages with KaTeX math and Mermaid diagrams.
