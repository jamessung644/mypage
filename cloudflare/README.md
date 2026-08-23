# Cloudflare Images 자동 갤러리

Cloudflare Images에 새 이미지를 올리면 Worker의 `/gallery.json` 응답에 자동으로 포함되고, 포트폴리오의 이미지 휠이 그 목록을 읽습니다. 브라우저에는 Cloudflare API 토큰이 노출되지 않습니다.

## 1. Cloudflare Images 준비

- `thumb` 변형: 예) 최대 800px, WebP/AVIF 자동 최적화
- `public` 변형: 확대 보기에 사용할 큰 이미지
- 갤러리 이미지는 파일명을 `gallery-`로 시작해 업로드합니다.
- 선택 사항: 업로드 metadata에 `gallery`, `alt`, `caption`, `width`, `height`를 넣을 수 있습니다.

## 2. Worker 배포

```sh
cd cloudflare
cp wrangler.example.jsonc wrangler.jsonc
npx wrangler secret put CLOUDFLARE_IMAGES_TOKEN
npx wrangler deploy
```

API 토큰에는 Cloudflare Images 읽기 권한만 부여합니다. `wrangler.jsonc`의 `CLOUDFLARE_ACCOUNT_ID`와 `ALLOWED_ORIGIN`을 실제 값으로 바꿉니다.

## 3. 사이트 연결

`index.html`의 이미지 휠에 배포된 Worker 주소를 넣습니다.

```html
<div
  class="image-wheel"
  id="imageWheel"
  data-remote-url="https://YOUR-WORKER.workers.dev/gallery.json"
  data-fallback-url="gallery.json"
>
```

Worker 또는 네트워크가 실패하면 현재 저장소의 `gallery.json`을 자동으로 사용합니다.

## 업로드 예시 metadata

```json
{
  "gallery": true,
  "alt": "로봇 프로토타입을 테스트하는 장면",
  "caption": "Physical AI · Prototype",
  "width": 1600,
  "height": 1200
}
```
