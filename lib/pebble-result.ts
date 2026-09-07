export function pebbleResult(text: string) {
  return {
    content: [{ type: "text" as const, text }],
    structuredContent: {
      output: text,
      semanticResult: { type: "Response" as const, text },
    },
    _meta: { coreSchema: 1 as const },
  };
}
