import { TZDate } from '@date-fns/tz';
import { queryAvailablePosts } from '@lib/query';
import { format } from 'date-fns';
import { getChannels } from '../libs/compat';
import { toPlain } from '../../tools/search-worker/plain.ts';

// サイト内検索 API (tools/search-worker) の索引に入れる記事データ。
// デプロイの CI がこの JSON を検索 Worker へ送り、Worker が索引を全件入れ替える。
// 公開済みの記事 (queryAvailablePosts) だけを入れる。ja と en は別の記事として並べる。
// このファイルは検索 Worker への入力であり、サイトの配信物ではない (.dockerignore で Docker イメージから除く)。
export async function GET() {
  const posts = await queryAvailablePosts();
  const docs = posts.map((post) => ({
    slug: post.data.slug,
    locale: post.data.locale,
    title: post.data.title,
    // 一覧 (FormattedDate) と同じタイムゾーンと書式
    date: format(new TZDate(post.data.created_time, 'Asia/Tokyo'), 'yyyy-MM-dd'),
    // 一覧 (List.astro) と同じ取得元と並び順
    channels: getChannels(post),
    body: toPlain(post.body ?? ''),
  }));
  return Response.json(docs);
}
