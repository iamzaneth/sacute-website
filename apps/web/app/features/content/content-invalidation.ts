import { useEffect, useRef } from 'react';
import { useFetchers, useNavigation } from 'react-router';
import { clearPublicCache } from '../../services/public-content-cache';
export const contentChangedEvent = 'sacute:content-changed';
// No payload, credentials, draft content or persistent browser storage.
export function useContentInvalidation() {
  const navigation = useNavigation();
  const fetchers = useFetchers();
  const submitted = useRef(false);
  const active = useRef(new Set<string>());
  const channel = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    const receive = () => {
      clearPublicCache();
      window.dispatchEvent(new Event(contentChangedEvent));
    };
    const bus =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel('sacute-content')
        : null;
    channel.current = bus;
    if (bus) bus.onmessage = receive;
    return () => {
      bus?.close();
      channel.current = null;
    };
  }, []);
  useEffect(() => {
    let completed = false;
    if (navigation.formMethod && navigation.formMethod.toUpperCase() !== 'GET')
      submitted.current = true;
    if (submitted.current && navigation.state === 'idle') {
      submitted.current = false;
      completed = true;
    }
    for (const fetcher of fetchers) {
      if (fetcher.formMethod && fetcher.formMethod.toUpperCase() !== 'GET')
        active.current.add(fetcher.key);
      if (fetcher.state === 'idle' && active.current.delete(fetcher.key))
        completed = true;
    }
    if (completed) {
      clearPublicCache();
      channel.current?.postMessage('changed');
      window.dispatchEvent(new Event(contentChangedEvent));
    }
  }, [navigation.state, navigation.formMethod, fetchers]);
}
