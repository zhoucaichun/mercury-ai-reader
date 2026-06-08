import type {
  Week3PromptMessage,
  Week3PromptTemplate,
} from "../runtime/types";

export function renderPromptTemplate(
  template: Week3PromptTemplate,
  input: Record<string, unknown>,
): Week3PromptMessage[] {
  validatePromptInput(template, input);

  return [
    {
      role: "system",
      content: renderPromptText(template.system, input),
    },
    {
      role: "user",
      content: renderPromptText(template.user, input),
    },
  ];
}

export function renderPromptText(
  templateText: string,
  input: Record<string, unknown>,
): string {
  return templateText.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = input[key];
    return value == null ? "" : String(value);
  });
}

export function validatePromptInput(
  template: Week3PromptTemplate,
  input: Record<string, unknown>,
): void {
  const missing = template.input.filter((key) => {
    const value = input[key];
    return value == null || value === "";
  });

  if (missing.length > 0) {
    throw new Error(`Missing prompt input fields: ${missing.join(", ")}`);
  }
}
