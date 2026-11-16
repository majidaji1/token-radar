// Self-check: rebuild the dossier from out/ with the vendored library and compare bytes with the one
// main.ts wrote, then re-run every gate rule from RULES.txt on out/board.json, dashboard/ and
// screenshots/. One runnable check, no framework: `node selfcheck.ts` (exit 0 = all green).
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-board.ts';

const OUT = process.env.MAKEFUN_OUTPUT_DIR ?? 'out';
const TEXT_MAX_BYTES = 65_536;
const fail: string[] = [];
const ok = (cond: boolean, what: string) => { if (!cond) fail.push(what); };

// 1. dossier is exactly what buildDossier writes from this /output.
const rebuilt = Buffer.from(buildDossier(OUT, {
  text_max_bytes: TEXT_MAX_BYTES,
  screenshots: { max: 4, max_bytes: 524_288 },
  dashboard: { max_files: 400, max_bytes: 4_194_304 },
}));
const written = readFileSync(join(OUT, 'dossier.json'));
ok(rebuilt.equals(written), `dossier.json is not byte-identical to buildDossier's (${written.length} vs ${rebuilt.length})`);

// 2. board.json: object with a rows array, 100..4000 rows, every row's fields, ranks 1..N, value descending.
const board = JSON.parse(readFileSync(join(OUT, 'board.json'), 'utf8'));
const rows = board.rows;
ok(Array.isArray(rows) && rows.length >= 100 && rows.length <= 4000, `board has ${rows?.length} rows`);
const ranks = rows.map((r: any) => r.rank).sort((a: number, b: number) => a - b);
ok(ranks.every((v: number, i: number) => v === i + 1), 'ranks are not exactly 1..N');
ok(rows.every((r: any, i: number) => i === 0 || rows[i - 1].implied_value_usd >= r.implied_value_usd), 'implied value rises as rank ascends');
ok(new Set(rows.map((r: any) => r.implied_value_usd)).size > 1, 'all rows share one implied value');
for (const r of rows) {
  ok(typeof r.slug === 'string' && r.slug.length >= 1 && r.slug.length <= 128 && !/\s/.test(r.slug), `bad slug ${r.slug}`);
  ok(typeof r.name === 'string' && r.name.length > 0, `${r.slug} has no name`);
  ok(Number.isSafeInteger(r.implied_value_usd) && r.implied_value_usd > 0 && r.implied_value_usd <= 100_000_000_000_000, `${r.slug} implied ${r.implied_value_usd}`);
  ok(Array.isArray(r.farm_steps) && r.farm_steps.length >= 3 && r.farm_steps.length <= 12, `${r.slug} has ${r.farm_steps?.length} farm steps`);
  for (const s of r.farm_steps) ok(typeof s === 'string' && s.trim().length >= 20 && s.trim().length <= 600, `${r.slug} has a ${s?.trim().length}-char farm step`);
}

// 3. the whole watchlist is covered.
const snap = JSON.parse(readFileSync(process.env.SNAPSHOT ?? '/dev/null', 'utf8'));
for (const slug of snap.watchlist) ok(rows.some((r: any) => r.slug === slug), `watchlist slug ${slug} is missing`);

// 4. dashboard: index.html + >=1 css + >=1 js, no network address, within caps.
const dash = join(OUT, 'dashboard');
ok(existsSync(join(dash, 'index.html')), 'dashboard/index.html missing');
const files: string[] = [];
const walk = (dir: string) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) walk(p); else files.push(p); } };
walk(dash);
ok(files.some((f) => f.endsWith('.css')), 'no .css in dashboard/');
ok(files.some((f) => f.endsWith('.js')), 'no .js in dashboard/');
ok(files.length <= 400, `dashboard has ${files.length} files`);
ok(files.reduce((n, f) => n + statSync(f).size, 0) <= 4_194_304, 'dashboard over 4 MiB');
for (const f of files) ok(!/\bhttps?:\/\//.test(readFileSync(f, 'utf8')), `${f} names a network address`);

// 5. screenshots: 3..4, each <=512 KiB, whole PNG/JPEG, long<=1440, short>=800.
const shots = readdirSync(join(OUT, 'screenshots')).filter((n) => !n.startsWith('.'));
ok(shots.length >= 3 && shots.length <= 4, `${shots.length} screenshots`);
const PNG = [0x89, 0x50, 0x4e, 0x47];
const JPEG = [0xff, 0xd8, 0xff];
for (const name of shots) {
  const bytes = readFileSync(join(OUT, 'screenshots', name));
  const isPng = PNG.every((b, i) => bytes[i] === b);
  const isJpeg = JPEG.every((b, i) => bytes[i] === b);
  ok(isPng || isJpeg, `${name} is neither PNG nor JPEG`);
  ok(bytes.length <= 524_288, `${name} is ${bytes.length} bytes`);
  const dim = pngOrJpegDims(bytes, isPng);
  ok(dim !== null && dim[0] <= 1440 && dim[1] <= 1440, `${name} long side over 1440: ${dim}`);
  ok(dim !== null && dim[0] >= 800 && dim[1] >= 800, `${name} short side under 800: ${dim}`);
}

function pngOrJpegDims(b: Buffer, png: boolean): [number, number] | null {
  if (png) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  for (let i = 2; i < b.length - 9; i++) {
    if (b[i] !== 0xff || b[i + 1] !== 0xc0) continue;
    return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
  }
  return null;
}

if (fail.length > 0) {
  for (const f of fail) console.error(`FAIL: ${f}`);
  console.error(`selfcheck: ${fail.length} problem${fail.length === 1 ? '' : 's'}`);
  process.exit(1);
}
console.log(`selfcheck: all green — ${rows.length} rows, ${snap.watchlist.length} watchlist covered, ${shots.length} screenshots, dossier byte-identical.`);
