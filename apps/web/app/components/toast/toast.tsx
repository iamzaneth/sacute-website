import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CircleCheck, CircleAlert, Info, TriangleAlert, X } from 'lucide-react';
import {
  initialToastState,
  toastExitDuration,
  toastReducer,
  type ToastItem,
  type ToastOptions,
  type ToastType,
} from './toast-state';
import '~/styles/toast.css';

type Notify = (message: string, options?: ToastOptions) => string;
interface ToastAPI {
  success: Notify;
  error: Notify;
  info: Notify;
  warning: Notify;
  dismiss: (id: string) => void;
}
const ToastContext = createContext<ToastAPI | null>(null);
const icons = {
  success: CircleCheck,
  error: CircleAlert,
  info: Info,
  warning: TriangleAlert,
};
const labels = {
  success: 'Thành công',
  error: 'Lỗi',
  info: 'Thông tin',
  warning: 'Lưu ý',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(toastReducer, initialToastState);
  const viewport = useRef<HTMLElement>(null);
  const positions = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const next = new Map<string, number>();
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    for (const slot of viewport.current?.querySelectorAll<HTMLElement>(
      '.toast-slot',
    ) ?? []) {
      const id = slot.dataset.slotId!;
      const top = slot.offsetTop;
      const previous = positions.current.get(id);
      next.set(id, top);
      if (!reducedMotion && previous !== undefined && previous !== top) {
        slot.animate(
          [
            { transform: `translateY(${previous - top}px)` },
            { transform: 'translateY(0)' },
          ],
          { duration: toastExitDuration, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
        );
      }
    }
    positions.current = next;
  }, [state.items]);
  const dismiss = useCallback(
    (id: string) => dispatch({ type: 'dismiss', id }),
    [],
  );
  const remove = useCallback(
    (id: string) => dispatch({ type: 'remove', id }),
    [],
  );
  const api = useMemo<ToastAPI>(() => {
    const notify =
      (type: ToastType): Notify =>
      (message, options = {}) => {
        const id = options.id ?? crypto.randomUUID();
        dispatch({
          type: 'add',
          item: {
            id,
            message,
            type,
            closing: false,
            duration: Math.max(1000, options.duration ?? 3000),
          },
        });
        return id;
      };
    return {
      success: notify('success'),
      error: notify('error'),
      info: notify('info'),
      warning: notify('warning'),
      dismiss,
    };
  }, [dismiss]);
  return (
    <ToastContext value={api}>
      {children}
      <section
        ref={viewport}
        className="toast-viewport"
        aria-label="Thông báo"
        tabIndex={-1}
      >
        {state.items.map((item) => (
          <div className="toast-slot" data-slot-id={item.id} key={item.id}>
            <ToastCard item={item} dismiss={dismiss} remove={remove} />
          </div>
        ))}
      </section>
    </ToastContext>
  );
}

function ToastCard({
  item,
  dismiss,
  remove,
}: {
  item: ToastItem;
  dismiss: (id: string) => void;
  remove: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const remaining = useRef(item.duration);
  const Icon = icons[item.type];
  useEffect(() => {
    if (item.closing) {
      // Cleanup fallback also works when reduced motion disables animations.
      const timer = setTimeout(() => remove(item.id), toastExitDuration);
      return () => clearTimeout(timer);
    }
    if (hovered || focused) return;
    const started = Date.now();
    const timer = setTimeout(() => dismiss(item.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(
        0,
        remaining.current - (Date.now() - started),
      );
    };
  }, [item.id, item.closing, hovered, focused, dismiss, remove]);
  return (
    <div
      className={`toast toast-${item.type}${item.closing ? ' toast-closing' : ''}`}
      data-toast-id={item.id}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <Icon className="toast-icon" size={21} aria-hidden="true" />
      <div
        className="toast-content"
        role={item.type === 'error' ? 'alert' : 'status'}
        aria-atomic="true"
      >
        <strong>{labels[item.type]}</strong>
        <p>{item.message}</p>
      </div>
      <button
        className="toast-close"
        type="button"
        aria-label="Đóng thông báo"
        onClick={() => dismiss(item.id)}
      >
        <X size={17} aria-hidden="true" />
      </button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw Error('useToast requires ToastProvider');
  return context;
}

/** Bind server action results to toast delivery; rerenders do not re-emit. */
export function useToastFeedback(
  event: unknown,
  message: string | undefined,
  type: ToastType = 'success',
  id?: string,
) {
  const toast = useToast();
  const delivered = useRef<{
    event: unknown;
    message: string;
    type: ToastType;
    id?: string;
  } | null>(null);
  useEffect(() => {
    if (!message) {
      delivered.current = null;
      return;
    }
    const previous = delivered.current;
    if (
      previous &&
      Object.is(previous.event, event) &&
      previous.message === message &&
      previous.type === type &&
      previous.id === id
    )
      return;
    delivered.current = { event, message, type, id };
    toast[type](message, { id });
  }, [event, message, type, id, toast]);
}
