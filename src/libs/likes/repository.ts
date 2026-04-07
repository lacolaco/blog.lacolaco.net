import type { FirestoreClient } from '../firestore/client';
import type { FirestoreValue } from '../firestore/types';
import type { ClientId, LikeStatus, Slug } from './types';

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

export class LikesRepository {
  #client: FirestoreClient;

  constructor(client: FirestoreClient) {
    this.#client = client;
  }

  /** いいね状態を取得する。clientIdが空文字の場合liked=false */
  async getLikeStatus(slug: Slug, clientId: ClientId | ''): Promise<LikeStatus> {
    const doc = await this.#client.getDocument(`post_likes/${slug}`);
    if (!doc) {
      return { count: 0, liked: false };
    }
    const reactions = extractReactions(doc.fields);
    const count = Object.keys(reactions).length;
    const liked = clientId !== '' && clientId in reactions;
    return { count, liked };
  }

  /** いいねをトグルする */
  async toggleLike(slug: Slug, clientId: ClientId): Promise<LikeStatus> {
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
