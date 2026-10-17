/**
 * Extracts the text of each page of a PDF in the browser, one line per row of text. pdf.js is
 * loaded on demand so it only costs anything when someone imports a PDF.
 */
export async function pdfToPages(data: ArrayBuffer): Promise<string[]> {
  // The legacy build: the modern one relies on very recent JS (e.g. Map#getOrInsertComputed) that
  // many browsers still lack.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    // Group text items into lines by their baseline, then order each line left to right.
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const item of content.items) {
      if (!("str" in item) || item.str.trim() === "") continue;
      const y = Math.round(item.transform[5]);
      const key = [...rows.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
      rows.set(key, [...(rows.get(key) ?? []), { x: item.transform[4], s: item.str }]);
    }
    const lines = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, items]) => items.sort((a, b) => a.x - b.x).map((i) => i.s).join(" "));
    pages.push(lines.join("\n"));
  }
  await task.destroy();
  return pages;
}
