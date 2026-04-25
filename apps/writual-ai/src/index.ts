import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { extractPdfText } from './extractPdfText';
import { groqParseScreenplay } from './groqScreenplay';

const PORT = Number(process.env.PORT) || 8790;
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET ?? '';
const GROQ_API_KEY = process.env.GROQ_API_KEY ?? '';
const GROQ_MODEL =
  process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

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
  '/v1/parse-screenplay-pdf',
  upload.single('file'),
  async (req, res) => {
    if (!requireSecret(req, res)) return;

    if (!GROQ_API_KEY) {
      res.status(503).json({ error: 'GROQ_API_KEY not configured' });
      return;
    }

    const file = req.file;
    if (!file?.buffer) {
      res.status(400).json({ error: 'Missing file field' });
      return;
    }

    const lower = file.originalname?.toLowerCase() ?? '';
    if (!lower.endsWith('.pdf') && file.mimetype !== 'application/pdf') {
      res.status(400).json({ error: 'Expected application/pdf' });
      return;
    }

    try {
      const { text, pageCount } = await extractPdfText(file.buffer);
      if (!text.trim()) {
        res.status(400).json({
          error:
            'No extractable text (scanned PDF?). Use a text-based PDF.',
        });
        return;
      }

      const result = await groqParseScreenplay({
        plainText: text,
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
