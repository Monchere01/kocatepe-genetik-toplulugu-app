/* =====================================================================
   sw.js — çevrimdışı (offline) çalışma için service worker
   AKÜ MBG Topluluğu · DNA Takvimi
   ---------------------------------------------------------------------
   · Uygulama kabuğu (takvim.html / index.html) önbelleğe alınır
   · Excel dosyası ASLA önbelleğe alınmaz (plan güncel kalsın)
   · HTML için önce ağ; ağ yoksa **veya hata dönerse** önbellek
   · Simge/manifest için önce önbellek, arkada tazele
   ===================================================================== */
const VER = 'akumgb-v3.10.1';
const SHELL = [
  './',
  './index.html',
  './takvim.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];
const YEDEK = '<!doctype html><meta charset="utf-8"><title>Çevrimdışı</title>' +
  '<body style="background:#060910;color:#c9d6ea;font:16px/1.6 system-ui;padding:40px">' +
  '<h1>Çevrimdışı</h1><p>Uygulama önbelleğe alınmamış. Bir kez internete bağlanıp sayfayı aç.</p>';

/* önbellekten uygun yanıt bul (sorgu dizesi farkı önemsenir) */
function yedekle(req) {
  return caches.match(req, { ignoreSearch: true })
    .then((r) => r || caches.match('./takvim.html', { ignoreSearch: true }))
    .then((r) => r || caches.match('./index.html', { ignoreSearch: true }))
    .then((r) => r || caches.match('./'))
    .then((r) => r || new Response(YEDEK, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VER)
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VER).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Excel / harici kaynaklar: yalnızca ağdan (bayat plan göstermeyelim) */
const CANLI = /\.(xlsx|xls|csv)(\?|$)/i;

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;
  if (CANLI.test(url.pathname)) return;

  /* sayfa gezinmesi: ağ önce, olmazsa/hata verirse önbellek */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VER).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        }
        return yedekle(req);
      }).catch(() => yedekle(req))
    );
    return;
  }

  /* diğer şeyler: önbellek önce, arkada tazele */
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(VER).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});