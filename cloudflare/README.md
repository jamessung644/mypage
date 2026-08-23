# Cloudflare R2 자동 갤러리

Cloudflare Images 유료 저장소는 사용하지 않습니다. R2 버킷의 `gallery/` 아래에 사진을 올리면 Worker가 `/gallery.json` 목록을 만들고, 포트폴리오 이미지 휠이 이 목록을 읽습니다.

## 동작 방식

- 허용 확장자: `jpg`, `jpeg`, `png`, `webp`, `avif`, `gif`
- `gallery/` 밖의 파일과 이미지가 아닌 파일은 공개 목록에서 제외합니다.
- 최신 업로드부터 정렬합니다.
- 같은 파일명으로 다시 올려도 R2 ETag가 URL에 포함되어 브라우저 캐시가 갱신됩니다.
- Worker가 실패하거나 목록이 비어 있으면 사이트는 저장소의 `gallery.json`을 사용합니다.
- 원본을 이미지 휠과 확대 보기에 함께 사용하므로 장당 2MB 이하의 WebP/JPEG를 권장합니다.

## 1. 최초 한 번: R2 버킷과 Worker 만들기

R2를 활성화한 다음 아래 명령을 실행합니다.

```sh
cd /Users/sungsuhan/Desktop/VibeCoding/mypage/.worktrees/bloub-redesign/cloudflare
npx wrangler login
npx wrangler r2 bucket create suhan-portfolio-gallery
npx wrangler deploy
```

배포된 Worker 주소는 다음과 같습니다.

```text
https://suhan-portfolio-gallery.suhan-sung.workers.dev
```

별도의 API 토큰, Account ID, Cloudflare Images 변형 설정은 필요하지 않습니다. 버킷은 공개 버킷으로 전환하지 않아도 됩니다. Worker의 R2 바인딩만 버킷을 읽습니다.

## 2. 사이트 연결

`index.html`의 `data-remote-url`에 배포 주소와 `/gallery.json`을 넣습니다.

```html
<div
  class="image-wheel"
  id="imageWheel"
  data-fallback-url="gallery.json"
  data-remote-url="https://suhan-portfolio-gallery.suhan-sung.workers.dev/gallery.json"
>
```

Worker 주소를 모르는 상태에서 임의 주소를 넣으면 사이트가 매번 원격 요청에 실패하므로, 실제 배포 주소를 받은 다음 연결해야 합니다.

## 3. Cloudflare 화면에서 사진 추가

1. `Storage & databases` → `R2` → `suhan-portfolio-gallery`로 이동합니다.
2. `Create folder`를 눌러 `gallery` 폴더를 만듭니다.
3. `gallery` 폴더 안으로 들어가 `Upload`로 사진을 올립니다.
4. 최대 5분 뒤 사이트를 새로고침합니다.

파일명은 캡션으로도 사용됩니다. 예를 들어 `physical-ai-prototype.webp`는 `physical ai prototype`으로 표시됩니다.

## CLI로 사진 한 장 올리기

```sh
cd /Users/sungsuhan/Desktop/VibeCoding/mypage/.worktrees/bloub-redesign/cloudflare
npx wrangler r2 object put \
  suhan-portfolio-gallery/gallery/my-photo.webp \
  --file="/ABSOLUTE/PATH/my-photo.webp" \
  --content-type="image/webp" \
  --remote
```

## 확인

```sh
curl -i "https://suhan-portfolio-gallery.suhan-sung.workers.dev/gallery.json"
```

정상이면 `200` 응답과 함께 `{ "images": [...] }`가 반환됩니다.
