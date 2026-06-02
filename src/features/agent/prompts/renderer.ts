import type {
  PromptTemplate,
  PromptTemplateMessage,
} from "../runtime/types";

export function renderPromptTemplate(
  template: PromptTemplate,
  input: Record<string, unknown>,
): PromptTemplateMessage[] {
  return [
    {
      role: "system",
      content: renderTemplateString(template.system, input),
    },
    {
      role: "user",
      content: renderTemplateString(template.user, input),
    },
  ];
}

export function renderTemplateString(
  template: string,
  input: Record<string, unknown>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = input[key];
    return value == null ? "" : String(value);
  });
}
