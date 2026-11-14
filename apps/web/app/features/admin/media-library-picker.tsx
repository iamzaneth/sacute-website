import { useFetcher } from 'react-router';
import type { loader } from '../../routes/admin-media-choices';

export function MediaLibraryPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const fetcher = useFetcher<typeof loader>();
  const state = fetcher.data;
  const busy = fetcher.state !== 'idle';
  function load(prefix = 'admin', page = 1, bucket = 'draft-media') {
    void fetcher.load(
      `/admin/media/choices?${new URLSearchParams({ prefix, page: String(page), bucket })}`,
    );
  }
  return (
    <details
      onToggle={(event) => {
        if (event.currentTarget.open && !state && !busy) load();
      }}
    >
      <summary>Chọn ảnh có sẵn trong thư viện</summary>
      <div aria-busy={busy}>
        <button type="button" onClick={() => load('admin')}>
          Ảnh CMS
        </button>
        <button type="button" onClick={() => load('', 1, 'post-media')}>
          Ảnh đã công bố
        </button>
        {busy && <p role="status">Đang tải thư viện ảnh…</p>}
        {state?.error && (
          <p role="alert">
            {state.error}
            <button
              type="button"
              onClick={() => load(state.prefix, state.page, state.bucket)}
            >
              Thử lại
            </button>
          </p>
        )}
        {state && !state.error && (
          <>
            <p>{state.prefix || 'Thư mục gốc'}</p>
            {state.prefix && (
              <button
                type="button"
                onClick={() =>
                  load(
                    state.prefix.split('/').slice(0, -1).join('/'),
                    1,
                    state.bucket,
                  )
                }
              >
                Thư mục cha
              </button>
            )}
            <ul className="admin-media-options">
              {state.objects.map((object) => (
                <li key={object.path}>
                  <button
                    type="button"
                    onClick={() =>
                      object.folder
                        ? load(object.path, 1, state.bucket)
                        : onChange(`${state.bucket}/${object.path}`)
                    }
                  >
                    {object.folder ? '📁 ' : ''}
                    {object.name}
                  </button>
                </li>
              ))}
            </ul>
            {!state.objects.length && <p>Chưa có ảnh trong thư mục này.</p>}
            {state.page > 1 && (
              <button
                type="button"
                onClick={() => load(state.prefix, state.page - 1, state.bucket)}
              >
                Trang trước
              </button>
            )}
            {state.hasMore && (
              <button
                type="button"
                onClick={() => load(state.prefix, state.page + 1, state.bucket)}
              >
                Trang sau
              </button>
            )}
          </>
        )}
        <label>
          Đường dẫn ảnh
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            maxLength={512}
            placeholder="draft-media/admin/…"
          />
        </label>
      </div>
    </details>
  );
}
