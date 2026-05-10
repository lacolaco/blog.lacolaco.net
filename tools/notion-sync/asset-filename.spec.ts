import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { deriveAssetFilename } from './asset-filename.ts';

describe('deriveAssetFilename', () => {
  test('単純な英数字ファイル名はそのまま使われる', () => {
    const out = deriveAssetFilename('https://example.com/path/photo.png?token=x', 'block-1234567890', 'png');
    // safeName='photo', ext='png', hash=sha256('block-1234567890').slice(0,16)
    assert.match(out, /^photo\.[a-f0-9]{16}\.png$/);
  });

  test('URL末尾の query/fragment は除去される', () => {
    const out = deriveAssetFilename('https://example.com/photo.jpg?signature=abc#fragment', 'block-id', 'png');
    assert.match(out, /^photo\.[a-f0-9]{16}\.jpg$/);
  });

  test('日本語ファイル名は `_` に置換される (R2 キーと CDN URL のファイル名を一致させるため)', () => {
    const out = deriveAssetFilename('https://example.com/%E3%83%86%E3%82%B9%E3%83%88.png', 'b', 'png');
    // 'テスト' (3文字) → '___'
    assert.match(out, /^___\.[a-f0-9]{16}\.png$/);
  });

  test('スペースを含むファイル名は `_` に置換される', () => {
    const out = deriveAssetFilename('https://example.com/My%20Video.mp4', 'b', 'mp4');
    assert.match(out, /^My_Video\.[a-f0-9]{16}\.mp4$/);
  });

  test('URL 末尾セグメントが空のとき blockId 先頭 8 文字をフォールバックに使う', () => {
    // パスがない (ルートのみ) URL → rawSegment=''
    const out = deriveAssetFilename('https://example.com/', 'abcdef0123456789', 'png');
    // safeName='abcdef01' (blockId 先頭 8 文字), ext=defaultExt
    assert.match(out, /^abcdef01\.[a-f0-9]{16}\.png$/);
  });

  test('拡張子のない URL は defaultExt を使う', () => {
    const out = deriveAssetFilename('https://example.com/photo', 'b', 'mp4');
    assert.match(out, /^photo\.[a-f0-9]{16}\.mp4$/);
  });

  test('拡張子は lowercase 化される', () => {
    const out = deriveAssetFilename('https://example.com/photo.PNG', 'b', 'png');
    assert.match(out, /^photo\.[a-f0-9]{16}\.png$/);
  });

  test('非ASCII の拡張子 (例: 動画) は `_` に置換される', () => {
    const out = deriveAssetFilename('https://example.com/movie.動画', 'b', 'mp4');
    // ext='動画' → '__' (2文字置換)
    assert.match(out, /^movie\.[a-f0-9]{16}\.__$/);
  });

  test('不正なパーセントエンコード (`%GH`) で throw せず raw segment にフォールバックする', () => {
    // decodeURIComponent('%GH') は URIError をスロー → catch で raw に fallback
    // raw 'name%GH.png' は normalize 後そのまま、'name%GH' の '%' は safe 文字外で '_' 置換
    const out = deriveAssetFilename('https://example.com/name%GH.png', 'b', 'png');
    assert.match(out, /^name_GH\.[a-f0-9]{16}\.png$/);
  });

  test('decoded 後にスラッシュが現れても _ に置換され path traversal にならない', () => {
    // '%2F' → '/' に decode
    const out = deriveAssetFilename('https://example.com/foo%2Fbar.png', 'b', 'png');
    assert.match(out, /^foo_bar\.[a-f0-9]{16}\.png$/);
    assert.ok(!out.includes('/'));
  });

  test('同じ blockId は冪等 (同じ filename を返す)', () => {
    const a = deriveAssetFilename('https://example.com/a.png', 'block-xyz', 'png');
    const b = deriveAssetFilename('https://example.com/a.png', 'block-xyz', 'png');
    assert.equal(a, b);
  });

  test('別の blockId は別の hash を返す (衝突しない)', () => {
    const a = deriveAssetFilename('https://example.com/a.png', 'block-1', 'png');
    const b = deriveAssetFilename('https://example.com/a.png', 'block-2', 'png');
    assert.notEqual(a, b);
  });

  test('NFC 正規化される (合成済み濁点と分解形が同一に正規化される)', () => {
    // 'が' (U+304C, NFC) と 'か' + ' ゙' (U+304B U+3099, NFD) は NFC 正規化で同一
    const nfc = deriveAssetFilename('https://example.com/%E3%81%8C.png', 'b', 'png'); // が (NFC)
    const nfd = deriveAssetFilename('https://example.com/%E3%81%8B%E3%82%99.png', 'b', 'png'); // か + ◌゙ (NFD)
    assert.equal(nfc, nfd);
  });
});
