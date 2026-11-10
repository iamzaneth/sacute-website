import { useActionData, useLoaderData, useSearchParams } from 'react-router';
import { PostEditor } from '../features/admin/post-editor';
import {
  AdminContentRepository,
  savePostAction,
} from '../services/admin-content.server';
import {
  requireAdmin,
  adminRead,
  adminHeaders,
} from '../services/admin-auth.server';
import type { Route } from './+types/admin-post-edit';
export const headers = adminHeaders;
export async function loader({
  request,
  params,
  context: requestContext,
}: Route.LoaderArgs) {
  const context = await requireAdmin(request, requestContext);
  return adminRead(context, async () => {
    const repository = new AdminContentRepository(context.db);
    const [post, choices, now] = await Promise.all([
      repository.get(params.id),
      repository.mediaChoices(),
      repository.now(),
    ]);
    return {
      post,
      choices,
      now: now.toISOString(),
      mediaBaseUrl: context.db.storage
        .from('post-media')
        .getPublicUrl('')
        .data.publicUrl.replace(/\/$/, ''),
      writesEnabled: context.writesEnabled,
    };
  });
}
export const action = ({
  request,
  params,
  context: requestContext,
}: Route.ActionArgs) => savePostAction(request, params.id, requestContext);
export default function AdminPostEdit() {
  const state = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const [params] = useSearchParams();
  return (
    <PostEditor
      key={params.get('saved') ?? 'initial'}
      {...state}
      errors={result?.errors}
    />
  );
}
