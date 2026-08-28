import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

// Listens to online/offline events so users see when they're reading from the
// service-worker cache rather than live data. Cached reads still work; this
// banner just makes the state explicit.
export default function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [waitingSW, setWaitingSW] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onChange = () => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg && reg.waiting) setWaitingSW(reg.waiting);
      });
    };
    navigator.serviceWorker.ready.then(() => onChange());
    navigator.serviceWorker.addEventListener('controllerchange', onChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onChange);
  }, []);

  if (online && !waitingSW) return null;

  if (!online) {
    return (
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800 flex items-center gap-2">
        <WifiOff className="w-4 h-4" />
        <span>You are offline. Showing last cached data.</span>
      </div>
    );
  }

  return (
    <button
      onClick={() => waitingSW?.postMessage({ type: 'SKIP_WAITING' })}
      className="w-full bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm text-blue-800 flex items-center justify-center gap-2 hover:bg-blue-100"
    >
      <RefreshCw className="w-4 h-4" />
      New version available — click to update
    </button>
  );
}
