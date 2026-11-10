import { useActionData, useLoaderData } from 'react-router';
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
import type { Route } from './+types/admin-post-new';
export const headers = adminHeaders;
export async function loader({
  request,
  context: requestContext,
}: Route.LoaderArgs) {
  const context = await requireAdmin(request, requestContext);
  return adminRead(context, async () => ({
    choices: await new AdminContentRepository(context.db).mediaChoices(),
    now: (await new AdminContentRepository(context.db).now()).toISOString(),
    mediaBaseUrl: context.db.storage
      .from('post-media')
      .getPublicUrl('')
      .data.publicUrl.replace(/\/$/, ''),
    writesEnabled: context.writesEnabled,
  }));
}
export const action = ({
  request,
  context: requestContext,
}: Route.ActionArgs) => savePostAction(request, null, requestContext);
export default function AdminPostNew() {
  const state = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  return <PostEditor {...state} post={null} errors={result?.errors} />;
}
