let loading: Promise<void> | undefined;
export function loadGoogleMaps(): Promise<void> {
  if (typeof google !== 'undefined' && google.maps?.Map) return Promise.resolve();
  const key = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_API_KEY;
  if (!key) return Promise.reject(new Error('Real map setup is pending. Maple Ward remains available.'));
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const url = new URL('https://maps.googleapis.com/maps/api/js');
    url.searchParams.set('key', key); url.searchParams.set('v', 'weekly'); url.searchParams.set('loading', 'async');
    script.src = url.toString(); script.async = true; script.id = 'routeshield-google-maps';
    let complete = false;
    const timeout = window.setTimeout(() => fail(), 20000);
    function fail() { if (complete) return; complete = true; clearTimeout(timeout); script.remove(); loading = undefined; reject(new Error('Google Maps could not load. Check the browser key, site restriction and billing. Maple Ward remains available.')); }
    const authWindow = window as Window & { gm_authFailure?: () => void };
    authWindow.gm_authFailure = () => { window.dispatchEvent(new Event('routeshield:google-auth-failure')); fail(); };
    script.onerror = fail;
    script.onload = () => {
      if (complete) return;
      if (typeof google === 'undefined' || !google.maps) { fail(); return; }
      google.maps.importLibrary('maps').then(() => { if (!complete) { complete = true; clearTimeout(timeout); resolve(); } }).catch(fail);
    };
    document.head.appendChild(script);
  });
  return loading;
}
