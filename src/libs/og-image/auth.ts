import * as jose from 'jose';

// Google署名IDトークンをキャッシュするための静的なキー
const CACHE_KEY = 'https://oauth2.googleapis.com/token';

/**
 * Google署名IDトークンを取得する
 */
export async function getIdToken(env: Env, audience: string, ctx: ExecutionContext): Promise<string | null> {
  const cache = caches.default;
  let response = await cache.match(CACHE_KEY);

  if (response) {
    console.log('Cache hit for ID token.');
    return response.text();
  }
  console.log('Cache miss. Generating new ID token.');

  // サービスアカウントの認証情報をパース
  const serviceAccount = JSON.parse(env.GCP_SERVICE_ACCOUNT_KEY);
  const privateKeyPem = serviceAccount.private_key;
  const clientEmail = serviceAccount.client_email;

  // Web Crypto APIが利用できる形式に秘密鍵をインポート
  const privateKey = await jose.importPKCS8(privateKeyPem, 'RS256');

  // 自己署名JWT (Proof of Possession JWT) を作成
  const selfSignedJwt = await new jose.SignJWT({
    target_audience: audience, // 最終的なIDトークンのオーディエンスを指定
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(clientEmail)
    .setSubject(clientEmail)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);

  // 自己署名JWTをGoogle署名IDトークンと交換
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: selfSignedJwt,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('Failed to exchange JWT for ID token:', errorText);
    return null;
  }

  const tokenData: { id_token: string } = await tokenResponse.json();
  const idToken = tokenData.id_token;

  // ステップ3: 取得したIDトークンをキャッシュに保存
  // トークンの有効期限は1時間だが、安全マージンをとって55分間キャッシュする
  const cacheResponse = new Response(idToken, { headers: { 'Cache-Control': 'max-age=3300' } });
  ctx.waitUntil(cache.put(CACHE_KEY, cacheResponse));

  return idToken;
}
