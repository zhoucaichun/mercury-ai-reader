import type { PromptTemplate } from "../runtime/types";

const DEFAULT_PROMPT_TEMPLATES: Record<string, PromptTemplate> = {
  "summary.default": {
    id: "summary.default",
    agentType: "summary",
    system: "You are a helpful article summarizer. Output Markdown only.",
    user: "Summarize the following article:\n\n{{canonicalMarkdown}}",
  },
  "translation.default": {
    id: "translation.default",
    agentType: "translation",
    system: "You are a professional translator. Preserve Markdown structure.",
    user: "Translate the following article:\n\n{{canonicalMarkdown}}",
  },
};

export async function getPromptTemplate(templateId: string): Promise<PromptTemplate> {
  const template = DEFAULT_PROMPT_TEMPLATES[templateId];
  if (!template) {
    throw new Error(`Prompt template not found: ${templateId}`);
  }

  return template;
}
