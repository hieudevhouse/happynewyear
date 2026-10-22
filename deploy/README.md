# Deploy frontend lên server riêng

Repo này là frontend độc lập. Mọi lệnh chạy tại thư mục gốc bản clone `happynewyear`; bản build nằm ở **`dist/`**, không có tiền tố `frontend/`. Backend được triển khai riêng từ [happynewyear-backend](https://github.com/hieudevhouse/happynewyear-backend).

## Vercel với backend đã deploy

Repo có sẵn `vercel.json` chuyển `/api/:path*` tới `https://happynewyear-backend.vercel.app/api/:path*`, rồi fallback các route React về `index.html`. Cookie phiên dùng domain frontend, và phản hồi API không được cache.

Import repo frontend với Root Directory `./`, preset **Vite**, Build Command `npm run build`, Output Directory `dist`. Dùng `VITE_API_BASE_URL=/api` hoặc bỏ biến này để dùng mặc định của ứng dụng. Backend cho phép frontend production `https://happynewyear-six-bay.vercel.app`. Khi dùng domain khác, thêm origin chính xác vào `CLIENT_ORIGIN`, không có path hoặc dấu `/` cuối; thêm `http://localhost:5173` và `http://localhost:4173` nếu cần chạy dev/preview.

Sau deploy, gọi `https://<domain-frontend>/api/health` và kiểm tra nhận JSON từ MongoDB backend. Đường dẫn `/loginl`, `/lucky`, `/adminl` phải tải lại trực tiếp được. Cấu hình theo [Vercel external rewrites](https://vercel.com/docs/rewrites) và [Vite SPA routing](https://vercel.com/docs/frameworks/frontend/vite#using-vite-to-make-spas).

## Gọi trực tiếp API ở hostname riêng

Ví dụ hai server có HTTPS hợp lệ:

```text
Trình duyệt → https://app.example.com → Nginx FE → dist/
          └→ https://api.example.com/api → Server BE
```

Tạo `.env.production` tại root repo frontend:

```dotenv
VITE_API_BASE_URL=https://api.example.com/api
```

Build bằng Node.js từ `22.11.0` trở lên trên máy phát triển hoặc CI:

```bash
git clone https://github.com/hieudevhouse/happynewyear.git
cd happynewyear
npm ci
npm run build
```

Đặt `.env.production` hoặc biến môi trường CI **trước** bước build. URL API được đóng gói vào JavaScript; đổi URL phải build và upload lại. `API_PROXY_TARGET` dùng cho proxy Vite khi phát triển và không được mang theo bản static. Xem [Vite env và mode](https://vite.dev/guide/env-and-mode).

Upload nội dung `dist/` tới `/srv/luckymoney/frontend/dist/` trên server FE, hoặc đổi đường dẫn `root` trong mẫu [nginx-frontend.conf](nginx-frontend.conf) cho khớp vị trí của bạn. Đường dẫn `/srv/luckymoney/frontend/` chỉ là ví dụ thư mục trên server, không yêu cầu repo cha.

Thay `app.example.com`, đường dẫn chứng chỉ TLS và `root` trước khi cài cấu hình. Mẫu phục vụ tài nguyên tĩnh, fallback các route React về `index.html`, đồng thời trả 404 cho `/api` để tránh trả HTML thay vì API JSON. Frontend dùng API ở hostname riêng nên không cần chạy Node trên server static.

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Trên backend, cấu hình theo [README backend](https://github.com/hieudevhouse/happynewyear-backend):

```dotenv
CLIENT_ORIGIN=https://app.example.com
NODE_ENV=production
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
```

`CLIENT_ORIGIN` cần đúng scheme, hostname và port nếu có, không có đường dẫn hoặc dấu `/` cuối. Danh sách nhiều origin ngăn cách bằng dấu phẩy; không dùng `*` với cookie phiên. `app.example.com` và `api.example.com` khác origin nhưng cùng site khi đều HTTPS và chung domain `example.com`, phù hợp với `SameSite=Lax`. Xem [MDN về cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies).

Nếu frontend/API thuộc hai site khác nhau, ví dụ `example.net` và `example.org`, backend cần `COOKIE_SAME_SITE=none` cùng `COOKIE_SECURE=true`. Trình duyệt vẫn có thể chặn third-party cookies khiến phiên/đăng nhập lỗi; xem [giới hạn third-party cookies](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies).

## Proxy API qua server frontend

Để dùng cookie first-party, cho Nginx FE chuyển `/api` sang Node BE qua IP private/VPN. Hai ứng dụng vẫn chạy trên hai server riêng:

```text
Trình duyệt → https://app.example.com/api → Nginx FE → http://10.0.0.20:4000/api
```

Build với `.env.production`:

```dotenv
VITE_API_BASE_URL=/api
```

Dùng [nginx-frontend-proxy.conf](nginx-frontend-proxy.conf) **thay cho** mẫu frontend static; thay hostname, chứng chỉ, `root` và IP `10.0.0.20`. Chỉ cho server FE kết nối cổng Node qua mạng private/VPN. Nếu upstream đi qua Internet công cộng, dùng kết nối HTTPS phù hợp thay cho HTTP private trong mẫu.

Backend đặt `CLIENT_ORIGIN=https://app.example.com`, `NODE_ENV=production`, `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=lax`, `TRUST_PROXY=1`. Mẫu đi thẳng từ một Nginx FE tới Node; nếu thêm proxy khác, tính lại số hop và giới hạn đường truy cập theo [Express behind proxies](https://expressjs.com/en/guide/behind-proxies/).

Mẫu giữ nguyên `/api` và `Origin`, truyền các header `X-Forwarded-*`, đồng thời cho phép body `70m` để phục vụ tải QR. Không đổi `Origin` hoặc bỏ tiền tố `/api` trong cấu hình proxy. Tham khảo [Nginx proxy module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html).

## Kiểm tra

1. Mở trang và tải lại trực tiếp `/info`, `/lucky` hoặc `/adminl`; giao diện phải được phục vụ đúng.
2. Với API trực tiếp, kiểm tra `https://api.example.com/api/health`; với proxy FE, kiểm tra `https://app.example.com/api/health`.
3. Đăng nhập, tải lại và kiểm tra phiên; dùng mã test mở một bao rồi tải lại để xác nhận quà đã lưu.
4. Thử tải QR nếu backend đã cấu hình Cloudinary. Nếu gặp `413`, kiểm tra giới hạn body ở tất cả proxy phía trước.
5. Nếu có lỗi CORS/cookie, kiểm tra API URL trong bản build, exact origin phía backend, HTTPS và `SameSite`; với hai site khác nhau, kiểm tra chính sách third-party cookies.
