// Arena Verde — service worker: funciona offline e pega versões novas automaticamente.
const V = "arenaverde-v30";
const SHELL = [
  "/",
  "/style.css",
  "/game.js",
  "/manifest.webmanifest",
  "/assets/maps/arena.jpg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
  ...["rifle", "grenade", "tank", "missile", "mine", "wire"].flatMap((k) => [
    `/assets/cards/art-${k}.jpg`,
    `/assets/cards/card-${k}.jpg`,
    `/assets/sprites/${k}.png`,
  ]),
  ...["normal", "runner", "armored", "spitter", "boss"].map((k) => `/assets/sprites/z_${k}.png`),
  ...Array.from({ length: 11 }, (_, i) => `/audio/radio/radio_${String(i + 1).padStart(2, "0")}.mp3`),
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(V)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname.startsWith("/api/")) return; // ranking sempre online

  // Página: rede primeiro (pega atualizações), cache se estiver offline
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const cp = res.clone();
          caches.open(V).then((c) => c.put("/", cp));
          return res;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  // Código do jogo (js, css, manifest): rede primeiro, para as atualizações aparecerem na hora.
  // Sem internet, usa a cópia guardada.
  const isCode = url.origin === location.origin && /\.(js|css|webmanifest)$/.test(url.pathname);
  if (isCode) {
    e.respondWith(
      fetch(req, { cache: "no-cache" })
        .then((res) => {
          const cp = res.clone();
          caches.open(V).then((c) => c.put(req, cp));
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true })),
    );
    return;
  }

  // Imagens e fonte: cache primeiro (não mudam), atualizando em segundo plano
  if (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req)
          .then((res) => {
            if (res.ok || res.type === "opaque") {
              const cp = res.clone();
              caches.open(V).then((c) => c.put(req, cp));
            }
            return res;
          })
          .catch(() => hit);
        return hit || net;
      }),
    );
  }
});
