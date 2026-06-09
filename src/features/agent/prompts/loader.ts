import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type {
  Week3PromptLoadOptions,
  Week3PromptTemplate,
} from "../runtime/types";

const DEFAULT_TEMPLATE_PATHS: Record<string, string> = {
  "summary.default": path.join("resources", "prompts", "summary.default.yaml"),
  "translation.default": path.join("resources", "prompts", "translation.default.yaml"),
};

export async function loadPromptTemplate(
  templateId: string,
  options: Week3PromptLoadOptions = {},
): Promise<Week3PromptTemplate> {
  const filePath = resolvePromptTemplatePath(templateId, options);
  const fileContent = readFileSync(filePath, "utf8");
  return parsePromptTemplateYaml(fileContent);
}

export function resolvePromptTemplatePath(
  templateId: string,
  options: Week3PromptLoadOptions = {},
): string {
  const relativePath = DEFAULT_TEMPLATE_PATHS[templateId];
  if (!relativePath) {
    throw new Error(`Prompt template path not found: ${templateId}`);
  }

  const candidate = options.baseDir
    ? path.resolve(options.baseDir, relativePath)
    : path.resolve(process.cwd(), relativePath);

  if (!existsSync(candidate)) {
    throw new Error(`Prompt template file not found: ${candidate}`);
  }

  return candidate;
}

export function parsePromptTemplateYaml(fileContent: string): Week3PromptTemplate {
  const normalized = fileContent.replace(/\r\n/g, "\n");

  const id = matchScalar(normalized, "id");
  const agentType = matchScalar(normalized, "agentType");
  const versionValue = matchScalar(normalized, "version");
  const description = matchScalar(normalized, "description");
  const system = matchBlock(normalized, "system");
  const user = matchBlock(normalized, "user");
  const input = matchList(normalized, "input");

  if (agentType !== "summary" && agentType !== "translation") {
    throw new Error(`Invalid agentType in prompt template: ${agentType}`);
  }

  return {
    id,
    agentType,
    version: versionValue ? Number(versionValue) : undefined,
    description,
    input,
    system,
    user,
  };
}

function matchScalar(content: string, key: string): string {
  const match = content.match(new RegExp(`^${escapeRegex(key)}:\\s*(.+)$`, "m"));
  if (!match) {
    throw new Error(`Missing prompt template field: ${key}`);
  }

  return match[1].trim().replace(/^['"]|['"]$/g, "");
}

function matchBlock(content: string, key: string): string {
  const match = content.match(
    new RegExp(`^${escapeRegex(key)}:\\s*\\|\\n([\\s\\S]*?)(?=^\\w[\\w-]*:|\\Z)`, "m"),
  );
  if (!match) {
    throw new Error(`Missing prompt template block: ${key}`);
  }

  return dedentBlock(match[1]);
}

function matchList(content: string, key: string): string[] {
  const match = content.match(
    new RegExp(`^${escapeRegex(key)}:\\s*\\n([\\s\\S]*?)(?=^\\w[\\w-]*:|\\Z)`, "m"),
  );
  if (!match) {
    return [];
  }

  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

function dedentBlock(block: string): string {
  const lines = block.replace(/\n$/, "").split("\n");
  const contentLines = lines.filter((line) => line.trim().length > 0);
  const indent = contentLines.reduce((min, line) => {
    const current = line.match(/^(\s*)/)?.[1].length ?? 0;
    return Math.min(min, current);
  }, Number.POSITIVE_INFINITY);

  const normalizedIndent = Number.isFinite(indent) ? indent : 0;

  return lines
    .map((line) => line.slice(Math.min(normalizedIndent, line.length)))
    .join("\n")
    .trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
