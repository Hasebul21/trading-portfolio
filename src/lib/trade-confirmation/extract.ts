import { getDocumentProxy } from "unpdf";

type PositionedItem = { str: string; x: number; y: number };

/** Items on the same visual row share a baseline y within this tolerance (pt). */
const ROW_Y_TOLERANCE = 3;

/**
 * Extract a PDF's text as newline-separated **visual rows**, reconstructed from
 * each text fragment's position rather than the PDF's content-stream order.
 *
 * Why not a plain text dump: table PDFs (like the LankaBangla trade
 * confirmation note) emit their cells in an arbitrary stream order, so a naive
 * extractor interleaves columns and shreds rows. pdf.js (which unpdf wraps)
 * exposes each fragment's transform matrix — `transform[4]` is x, `transform[5]`
 * is the baseline y. We cluster fragments into rows by y (PDF origin is
 * bottom-left, so larger y is higher on the page) and order each row by x, which
 * restores the true `Symbol Qty Rate Amount Comm Balance` layout.
 */
export async function extractPdfText(
  data: ArrayBuffer | Uint8Array,
): Promise<string> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const pdf = await getDocumentProxy(bytes);
  const lines: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const items: PositionedItem[] = [];
    for (const raw of content.items) {
      // Skip marked-content markers (no `str`/`transform`) and whitespace.
      const it = raw as { str?: string; transform?: number[] };
      if (typeof it.str !== "string" || it.str.trim() === "" || !it.transform) {
        continue;
      }
      items.push({ str: it.str, x: it.transform[4], y: it.transform[5] });
    }

    // Top-to-bottom (y descending), then left-to-right within ties.
    items.sort((a, b) => b.y - a.y || a.x - b.x);

    // Cluster into rows: a new fragment joins the current row if its baseline is
    // within tolerance of that row's first fragment, else it starts a new row.
    const rows: PositionedItem[][] = [];
    for (const item of items) {
      const current = rows[rows.length - 1];
      if (current && Math.abs(current[0].y - item.y) <= ROW_Y_TOLERANCE) {
        current.push(item);
      } else {
        rows.push([item]);
      }
    }

    for (const row of rows) {
      row.sort((a, b) => a.x - b.x);
      const line = row
        .map((i) => i.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (line) lines.push(line);
    }
  }

  return lines.join("\n");
}
