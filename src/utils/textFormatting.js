export function normalizeMultilineText(value) {
  if (Array.isArray(value)) {
    return value.join('\n\n');
  }

  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n');
}

export function toParagraphs(value) {
  return normalizeMultilineText(value)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
