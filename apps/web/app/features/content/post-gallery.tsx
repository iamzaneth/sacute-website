import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { publicImageSource } from '../../services/public-image-cache';
import type { PostImage } from '@sacute/shared';

export function PostGallery({
  images,
  title,
}: {
  images: readonly PostImage[];
  title: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);
  const visible = images.slice(0, 5);
  const activeIndex = Math.min(selected, Math.max(0, images.length - 1));
  const active = images[activeIndex];
  if (!active) {
    if (open) setOpen(false);
    return null;
  }
  function move(offset: number) {
    setSelected(
      (index) =>
        (Math.min(index, images.length - 1) + offset + images.length) %
        images.length,
    );
  }
  return (
    <>
      <div
        className={`post-gallery gallery-${visible.length}`}
        role="group"
        aria-label={`${images.length} ảnh đính kèm`}
      >
        {visible.map((image, index) => (
          <button
            type="button"
            className="post-photo"
            style={
              visible.length === 1
                ? {
                    aspectRatio:
                      image.width && image.height
                        ? `${image.width} / ${image.height}`
                        : '3 / 2',
                  }
                : undefined
            }
            key={image.url}
            aria-label={`Xem ảnh ${index + 1} trên ${images.length}: ${title}`}
            onClick={() => {
              setSelected(index);
              setOpen(true);
              dialog.current?.showModal();
            }}
          >
            <img
              src={publicImageSource(image)}
              decoding="async"
              onError={(event) => {
                if (event.currentTarget.getAttribute('src') !== image.url)
                  event.currentTarget.src = image.url;
              }}
              alt={image.alt}
              width={image.width}
              height={image.height}
              loading={index === 0 ? 'eager' : 'lazy'}
              fetchPriority={index === 0 ? 'high' : undefined}
            />
            {index === 4 && images.length > 5 && (
              <span className="more-photos" aria-hidden="true">
                +{images.length - 5}
              </span>
            )}
          </button>
        ))}
      </div>
      <dialog
        className="photo-viewer"
        style={{
          width:
            active.width && active.height
              ? `min(${active.width}px, calc(100vw - 32px), calc((100dvh - 32px) * ${active.width / active.height}))`
              : 'calc(100vw - 32px)',
        }}
        ref={dialog}
        aria-label={`Ảnh đính kèm: ${title}`}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Tab') {
            const buttons = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>('button'),
            );
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            move(event.key === 'ArrowLeft' ? -1 : 1);
          }
        }}
      >
        {open && (
          <div className="photo-viewer-content">
            <div className="photo-viewer-toolbar">
              <p aria-live="polite">
                Ảnh {activeIndex + 1} / {images.length}
              </p>
              <button
                type="button"
                aria-label="Đóng ảnh"
                autoFocus
                onClick={() => dialog.current?.close()}
              >
                <X size={24} aria-hidden="true" />
              </button>
            </div>
            <div className="photo-viewer-stage">
              <img
                src={active.url}
                alt={active.alt}
                width={active.width}
                height={active.height}
              />
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    className="photo-previous"
                    aria-label="Ảnh trước"
                    onClick={() => move(-1)}
                  >
                    <ChevronLeft size={28} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="photo-next"
                    aria-label="Ảnh tiếp theo"
                    onClick={() => move(1)}
                  >
                    <ChevronRight size={28} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
