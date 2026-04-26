import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { classifyFile } from './discover.ts';

const JA_AUTO_ON = { locale: 'ja', auto_translate: true };
const JA_AUTO_OFF = { locale: 'ja', auto_translate: false };
const JA_NO_FLAG = { locale: 'ja' };
const EN_AUTO = { locale: 'en', auto_translated_from: 'a'.repeat(64) };
const EN_MANUAL = { locale: 'en', title: 'Manual translation' };

const PATHS = { ja: '/x/foo.md', en: '/x/foo.en.md' } as const;

describe('classifyFile', () => {
  test('ja + auto_translate=true + en 不在 → translate', () => {
    const action = classifyFile({ jaPath: PATHS.ja, enPath: PATHS.en, ja: JA_AUTO_ON, en: null });
    assert.equal(action.kind, 'translate');
  });

  test('ja + auto_translate=true + auto en あり → evaluate-cache', () => {
    const action = classifyFile({ jaPath: PATHS.ja, enPath: PATHS.en, ja: JA_AUTO_ON, en: EN_AUTO });
    assert.equal(action.kind, 'evaluate-cache');
  });

  test('ja + auto_translate=true + 手動 en あり → protect-manual', () => {
    const action = classifyFile({ jaPath: PATHS.ja, enPath: PATHS.en, ja: JA_AUTO_ON, en: EN_MANUAL });
    assert.equal(action.kind, 'protect-manual');
  });

  test('ja + auto_translate=false + en 不在 → skip', () => {
    const action = classifyFile({ jaPath: PATHS.ja, enPath: PATHS.en, ja: JA_AUTO_OFF, en: null });
    assert.equal(action.kind, 'skip');
  });

  test('ja + auto_translate=false + auto en あり → delete-orphan', () => {
    const action = classifyFile({ jaPath: PATHS.ja, enPath: PATHS.en, ja: JA_AUTO_OFF, en: EN_AUTO });
    assert.equal(action.kind, 'delete-orphan');
  });

  test('ja + auto_translate=false + 手動 en あり → skip（手動 en は touch しない）', () => {
    const action = classifyFile({ jaPath: PATHS.ja, enPath: PATHS.en, ja: JA_AUTO_OFF, en: EN_MANUAL });
    assert.equal(action.kind, 'skip');
  });

  test('ja + auto_translate フラグ不在 → auto_translate=false と同等', () => {
    const action = classifyFile({ jaPath: PATHS.ja, enPath: PATHS.en, ja: JA_NO_FLAG, en: null });
    assert.equal(action.kind, 'skip');
  });

  test('locale=en の入力 → skip（en は翻訳ソースになり得ない）', () => {
    const action = classifyFile({
      jaPath: PATHS.ja,
      enPath: PATHS.en,
      ja: { locale: 'en', auto_translate: true },
      en: null,
    });
    assert.equal(action.kind, 'skip');
  });

  test('translate アクションは jaPath と enPath を返す', () => {
    const action = classifyFile({ jaPath: PATHS.ja, enPath: PATHS.en, ja: JA_AUTO_ON, en: null });
    if (action.kind !== 'translate') throw new Error('expected translate');
    assert.equal(action.jaPath, PATHS.ja);
    assert.equal(action.enPath, PATHS.en);
  });

  test('delete-orphan アクションは enPath を返す', () => {
    const action = classifyFile({ jaPath: PATHS.ja, enPath: PATHS.en, ja: JA_AUTO_OFF, en: EN_AUTO });
    if (action.kind !== 'delete-orphan') throw new Error('expected delete-orphan');
    assert.equal(action.enPath, PATHS.en);
  });
});

describe('en path 算出', () => {
  test('jaToEnPath: foo.md → foo.en.md', async () => {
    const { jaToEnPath } = await import('./discover.ts');
    assert.equal(jaToEnPath('/some/dir/foo.md'), '/some/dir/foo.en.md');
  });

  test('jaToEnPath: ネスト構造でも .en.md 拡張が付く', async () => {
    const { jaToEnPath } = await import('./discover.ts');
    assert.equal(jaToEnPath('src/content/post/notion/abc-def.md'), 'src/content/post/notion/abc-def.en.md');
  });
});
