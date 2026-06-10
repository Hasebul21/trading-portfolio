import { extractText, getDocumentProxy } from "unpdf";

/**
 * Extract the full text of a PDF as a single string using unpdf (a
 * serverless-friendly pdf.js wrapper — no native deps, runs in the Node
 * runtime where our Server Actions execute).
 */
export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}
