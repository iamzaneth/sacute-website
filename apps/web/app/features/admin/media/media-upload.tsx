import { useEffect, useId, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import type { action } from '~/routes/admin/media/index';

export function MediaUpload({
  disabled = false,
  onUploaded,
  onBusyChange,
}: {
  disabled?: boolean;
  onUploaded?: (path: string) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const fetcher = useFetcher<typeof action>();
  const input = useRef<HTMLInputElement>(null);
  const handled = useRef(fetcher.data);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const id = useId();
  const busy = fetcher.state !== 'idle';
  const locked = disabled || busy;
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  useEffect(() => {
    if (
      fetcher.state !== 'idle' ||
      !fetcher.data ||
      handled.current === fetcher.data
    )
      return;
    handled.current = fetcher.data;
    if (fetcher.data.path) onUploaded?.(fetcher.data.path);
  }, [fetcher.state, fetcher.data, onUploaded]);
  function upload(files: FileList | null) {
    if (locked || !files?.length) return;
    if (files.length !== 1) {
      setError('Vui lòng chọn từng ảnh một.');
      return;
    }
    const file = files[0];
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 3 * 1024 * 1024
    ) {
      setError('Chọn ảnh PNG, JPEG hoặc WebP tối đa 3 MiB.');
      return;
    }
    setError('');
    const form = new FormData();
    form.set('intent', 'upload');
    form.set('file', file);
    void fetcher.submit(form, {
      method: 'post',
      action: '/admin/media',
      encType: 'multipart/form-data',
    });
  }
  return (
    <div
      className={`admin-media-dropzone${dragging ? ' is-dragging' : ''}`}
      aria-busy={busy}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = locked ? 'none' : 'copy';
        if (!locked) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        upload(event.dataTransfer.files);
      }}
    >
      <p>Kéo thả ảnh vào đây hoặc chọn ảnh từ máy</p>
      <input
        ref={input}
        id={id}
        className="admin-file-input"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={locked}
        aria-label="Chọn ảnh từ máy"
        onChange={(event) => {
          upload(event.target.files);
          event.target.value = '';
        }}
      />
      <button
        type="button"
        disabled={locked}
        onClick={() => input.current?.click()}
      >
        Chọn ảnh từ máy
      </button>
      <small>PNG, JPEG, WebP · Tối đa 3 MiB mỗi ảnh</small>
      {busy && <p role="status">Đang tải và lưu ảnh…</p>}
      {(error || fetcher.data?.error) && (
        <p role="alert">{error || fetcher.data?.error}</p>
      )}
      {!busy && !error && fetcher.data?.path && (
        <p role="status">Đã tải ảnh lên thành công.</p>
      )}
    </div>
  );
}
