// Run after pnpm typecheck/build to refresh the shared package output.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SupabaseContentRepository } from '../../packages/shared/dist/content.js';
test('invalid slugs are rejected before DB work for both SSR and API repositories', async () => {
  let calls = 0;
  const repository = new SupabaseContentRepository({
    rpc() {
      calls++;
      throw Error('Unexpected DB read');
    },
    from() {
      calls++;
      throw Error('Unexpected DB query');
    },
  });
  for (const slug of ['', 'x'.repeat(181), '%ZZ', 'a/b', 'a\\b', 'a\u0000b'])
    assert.equal(await repository.getPostBySlug(slug), null);
  assert.equal(calls, 0);
});

test('public originals bypass the app proxy; private media retains gated thumbnails', async () => {
  const { mapPost } = await import('../../packages/shared/dist/content.js');
  const postId = '00000000-0000-4000-8000-000000000001';
  const mediaId = '00000000-0000-4000-8000-000000000002';
  const row = {
    id: postId,
    slug: 'test',
    title: 'Test',
    kind: 'information',
    summary: '',
    content: '',
    category: 'Thông báo',
    status: 'published',
    visible_from: null,
    deleted_at: null,
    post_media: [
      {
        id: mediaId,
        bucket: 'post-media',
        storage_path: 'sample.jpg',
        sort_order: 0,
        is_cover: true,
      },
    ],
  };
  const db = {
    storage: {
      from: () => ({
        getPublicUrl: (path) => ({
          data: { publicUrl: `https://storage.test/${path}` },
        }),
      }),
    },
  };
  const publicPost = mapPost(row, db);
  assert.equal(publicPost.coverImage.url, 'https://storage.test/sample.jpg');
  assert.equal(publicPost.coverImage.thumbnailUrl, undefined);
  const privatePost = mapPost(
    {
      ...row,
      post_media: row.post_media.map((media) => ({
        ...media,
        bucket: 'draft-media',
      })),
    },
    db,
  );
  assert.equal(privatePost.coverImage.url, `/media/posts/${postId}/${mediaId}`);
  assert.equal(
    privatePost.coverImage.thumbnailUrl,
    `/media/posts/${postId}/${mediaId}?width=640`,
  );
});
