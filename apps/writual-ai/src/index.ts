import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {
  parseScreenplayWithGroq,
  MAX_PLAINTEXT_CHARS,
} from './screenplayImportService';

const PORT = Number(process.env.PORT) || 8790;
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET ?? '';
const GROQ_API_KEY = process.env.GROQ_API_KEY ?? '';
const GROQ_MODEL =
  process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';

const json50mb = express.json({ limit: '50mb' });

function requireSecret(req: express.Request, res: express.Response): boolean {
  const got = req.headers['x-writual-internal-secret'];
  const expected = INTERNAL_SECRET;
  if (!expected || got !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

const app = express();
app.use(cors({ origin: false }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'writual-ai' });
});

app.post(
  '/v1/parse-screenplay-text',
  json50mb,
  async (req, res) => {
    if (!requireSecret(req, res)) return;

    if (!GROQ_API_KEY) {
      res.status(503).json({ error: 'GROQ_API_KEY not configured' });
      return;
    }

    const plainText = req.body?.plainText;
    if (typeof plainText !== 'string') {
      res.status(400).json({ error: 'Missing or invalid plainText' });
      return;
    }
    if (plainText.length > MAX_PLAINTEXT_CHARS) {
      res
        .status(400)
        .json({ error: `plainText exceeds ${MAX_PLAINTEXT_CHARS} characters` });
      return;
    }
    if (!plainText.trim()) {
      res
        .status(400)
        .json({ error: 'No extractable text (scanned PDF?). Use a text-based PDF.' });
      return;
    }

    const pageCountRaw = req.body?.pageCount;
    const pageCount =
      typeof pageCountRaw === 'number' &&
      Number.isFinite(pageCountRaw) &&
      pageCountRaw >= 0
        ? Math.floor(pageCountRaw)
        : 0;

    try {
      const result = await parseScreenplayWithGroq({
        plainText,
        pageCount,
        apiKey: GROQ_API_KEY,
        model: GROQ_MODEL,
      });

      res.json({
        doc: result.doc,
        pageCount: result.pageCount,
        titleHint: result.titleHint,
        characters: result.characters,
        scenes: result.scenes,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Parse failed';
      console.error('[writual-ai] parse error', message);
      res.status(500).json({ error: message });
    }
  },
);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`writual-ai listening on :${PORT}`);
});
