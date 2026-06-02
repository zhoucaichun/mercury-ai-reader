// loader.ts
import type { PromptTemplate } from "../runtime/types";

export async function getPromptTemplate(templateId: string): Promise<PromptTemplate> {
  if (templateId === "translation.default") {
    return {
      id: "translation.default",
      agentType: "translation",
      system: "You are a professional translator.",
      user: "Translate:\n\n{{canonicalMarkdown}}",
    };
  }

  return {
    id: "summary.default",
    agentType: "summary",
    system: "You are a helpful article summarizer.",
    user: "Summarize:\n\n{{canonicalMarkdown}}",
  };
}
