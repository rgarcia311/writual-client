import type { Buffer } from 'node:buffer';

// pdf-parse is CommonJS
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (data: Buffer) => Promise<{
  text: string;
  numpages: number;
}>;

export async function extractPdfText(buffer: Buffer): Promise<{
  text: string;
  pageCount: number;
}> {
  const result = await pdfParse(buffer);
  const text = (result.text ?? '').replace(/\r\n/g, '\n').trim();
  return { text, pageCount: result.numpages ?? 0 };
}
