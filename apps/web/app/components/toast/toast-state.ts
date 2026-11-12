export type ToastType = 'success' | 'error' | 'info' | 'warning';
export interface ToastOptions {
  /** Reuse an ID to suppress duplicate delivery of the same event. */
  id?: string;
  duration?: number;
}
export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  closing: boolean;
}
export interface ToastState {
  items: ToastItem[];
  queue: ToastItem[];
  recent: string[];
}
export const toastLimit = 3;
export const toastExitDuration = 220;
export const initialToastState: ToastState = {
  items: [],
  queue: [],
  recent: [],
};
export type ToastAction =
  | { type: 'add'; item: ToastItem }
  | { type: 'dismiss'; id: string }
  | { type: 'remove'; id: string };

export function toastReducer(
  state: ToastState,
  action: ToastAction,
): ToastState {
  if (action.type === 'add') {
    if (state.recent.includes(action.item.id)) return state;
    const recent = [...state.recent, action.item.id].slice(-100);
    if (state.items.length < toastLimit)
      return { ...state, recent, items: [...state.items, action.item] };
    // Reserve the departing slot. Even a burst never mounts more than 3 cards.
    const oldest = state.items.find((item) => !item.closing);
    return {
      recent,
      items: state.items.map((item) =>
        item.id === oldest?.id ? { ...item, closing: true } : item,
      ),
      queue: [...state.queue, action.item].slice(-toastLimit),
    };
  }
  if (action.type === 'dismiss')
    return {
      ...state,
      items: state.items.map((item) =>
        item.id === action.id ? { ...item, closing: true } : item,
      ),
      queue: state.queue.filter((item) => item.id !== action.id),
    };
  const items = state.items.filter((item) => item.id !== action.id);
  const queue = [...state.queue];
  while (items.length < toastLimit && queue.length) items.push(queue.shift()!);
  return { ...state, items, queue };
}
