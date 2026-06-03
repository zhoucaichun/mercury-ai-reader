import type { LLMChatMessage } from "./types";

export function estimateTokensFromText(text: string): number {
  if (!text.trim()) {
    return 0;
  }

  let cjkChars = 0;
  let otherChars = 0;

  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (isCjkCodePoint(codePoint)) {
      cjkChars += 1;
    } else if (!/\s/.test(char)) {
      otherChars += 1;
    }
  }

  return Math.max(1, Math.ceil(cjkChars * 0.8 + otherChars / 4));
}

export function estimateTokensFromMessages(messages: LLMChatMessage[]): number {
  return messages.reduce((sum, message) => {
    return sum + estimateTokensFromText(`${message.role}\n${message.content}`);
  }, 0);
}

function isCjkCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) ||
    (codePoint >= 0x3400 && codePoint <= 0x4dbf) ||
    (codePoint >= 0x20000 && codePoint <= 0x2a6df)
  );
}
