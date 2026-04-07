/** いいね状態のレスポンス */
export interface LikeStatus {
  count: number;
  liked: boolean;
}

/** バリデーション済みのclientId */
declare const ClientIdBrand: unique symbol;
export type ClientId = string & { readonly [ClientIdBrand]: never };

/** バリデーション済みのslug */
declare const SlugBrand: unique symbol;
export type Slug = string & { readonly [SlugBrand]: never };
