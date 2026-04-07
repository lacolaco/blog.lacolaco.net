import type { FirestoreClient } from './firestore';
import type { FirestoreValue, LikeStatus } from './types';

/** slugのバリデーション正規表現 */
export const SLUG_PATTERN = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/;
/** slugの最大長 */
export const SLUG_MAX_LENGTH = 200;
/** clientIdの許可文字パターン（hex + ハイフン、最大128文字） */
export const CLIENT_ID_PATTERN = /^[0-9a-f-]{1,128}$/i;

/** reactionsマップからclientIdのキーを抽出する */
function extractReactions(fields: Record<string, FirestoreValue> | undefined): Record<string, boolean> {
  if (!fields) return {};
  const reactions = fields['reactions'];
  if (!reactions || !('mapValue' in reactions)) return {};
  const mapFields = reactions.mapValue.fields;
  if (!mapFields) return {};
  const result: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(mapFields)) {
    if ('booleanValue' in value && value.booleanValue) {
      result[key] = true;
    }
  }
  return result;
}

function validateSlug(slug: string): void {
  if (!SLUG_PATTERN.test(slug) || slug.length > SLUG_MAX_LENGTH) {
    throw new Error(`不正なslug: ${slug}`);
  }
}

function validateClientId(clientId: string): void {
  if (!clientId) {
    throw new Error('clientIdは必須です');
  }
  if (!CLIENT_ID_PATTERN.test(clientId)) {
    throw new Error(`不正なclientId形式: ${clientId}`);
  }
}

export class LikesRepository {
  #client: FirestoreClient;

  constructor(client: FirestoreClient) {
    this.#client = client;
  }

  /** スキ状態を取得する */
  async getLikeStatus(slug: string, clientId: string): Promise<LikeStatus> {
    validateSlug(slug);
    const doc = await this.#client.getDocument(`post_likes/${slug}`);
    if (!doc) {
      return { count: 0, liked: false };
    }
    const reactions = extractReactions(doc.fields);
    const count = Object.keys(reactions).length;
    const liked = clientId !== '' && clientId in reactions;
    return { count, liked };
  }

  /** スキをトグルする */
  async toggleLike(slug: string, clientId: string): Promise<LikeStatus> {
    validateSlug(slug);
    validateClientId(clientId);

    // 楽観的カウント: commit前のスナップショットから±1で計算。
    // クライアント側の楽観的UIが即座にカウントを表示し、正確な値は次回GETで取得される。
    const doc = await this.#client.getDocument(`post_likes/${slug}`);
    const reactions = doc ? extractReactions(doc.fields) : {};
    const isCurrentlyLiked = clientId in reactions;
    const docName = await this.#client.buildDocumentName(`post_likes/${slug}`);

    if (isCurrentlyLiked) {
      // Unlike: maskにフィールドを含めbodyから除外することでFirestoreがフィールドを削除
      await this.#client.commit([
        {
          update: { name: docName, fields: {} },
          updateMask: { fieldPaths: [`reactions.\`${clientId}\``] },
        },
      ]);
      const newCount = Object.keys(reactions).length - 1;
      return { count: newCount, liked: false };
    } else {
      // Like: 特定のmapキーのみ更新
      await this.#client.commit([
        {
          update: {
            name: docName,
            fields: {
              reactions: {
                mapValue: { fields: { [clientId]: { booleanValue: true } } },
              },
            },
          },
          updateMask: { fieldPaths: [`reactions.\`${clientId}\``] },
        },
      ]);
      return { count: Object.keys(reactions).length + 1, liked: true };
    }
  }
}
