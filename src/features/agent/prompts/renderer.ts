// renderer.ts
import type { PromptTemplate, PromptTemplateMessage } from "../runtime/types";

export function renderPromptTemplate(
  template: PromptTemplate,
  input: Record<string, unknown>,
): PromptTemplateMessage[] {
  const render = (text: string) =>
    text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
      const value = input[key];
      return value == null ? "" : String(value);
    });

  return [
    { role: "system", content: render(template.system) },
    { role: "user", content: render(template.user) },
  ];
}
