# LuckyMoney 2027 — Frontend

Giao diện quay lì xì đầu năm Đinh Mùi 2027, xây bằng React/Vite và Three.js. Repo này chạy và build độc lập; API Express/Mongoose nằm tại [happynewyear-backend](https://github.com/hieudevhouse/happynewyear-backend).

## Chạy local

Cần Node.js từ `22.11.0` trở lên. Mọi lệnh dưới đây chạy tại thư mục gốc repo frontend sau khi clone:

```bash
git clone https://github.com/hieudevhouse/happynewyear.git
cd happynewyear
npm ci
npm run setup
npm run dev
```

`npm run setup` tạo `.env` từ `.env.example` nếu chưa có, giữ nguyên cấu hình đã tồn tại. Mặc định:

```dotenv
VITE_API_BASE_URL=/api
API_PROXY_TARGET=https://happynewyear-backend.vercel.app
```

Frontend mặc định kết nối backend đã deploy tại `https://happynewyear-backend.vercel.app`. Khi chạy dev hoặc preview, Vite nhận request `/api` và chuyển tới `API_PROXY_TARGET`. Để dùng backend local theo [hướng dẫn trong repo backend](https://github.com/hieudevhouse/happynewyear-backend), đổi `API_PROXY_TARGET=http://127.0.0.1:4000`. Cấu hình proxy Vite không được đóng gói vào `dist/`; Vercel dùng `vercel.json` cho cùng đường dẫn `/api`.

- Nhập mã: `http://localhost:5173/`
- Nhập tên: `http://localhost:5173/info`
- Cây đào và quà đã nhận: `http://localhost:5173/lucky`
- Đăng nhập quản trị: `http://localhost:5173/loginl`
- Quản trị: `http://localhost:5173/adminl`

Backend phải cho phép origin chính xác `http://localhost:5173` trong `CLIENT_ORIGIN`. Để mở trên điện thoại cùng Wi-Fi, truy cập `http://<IPv4-của-máy>:5173` và thêm đúng origin đó vào backend; nhiều origin ngăn cách bằng dấu phẩy. Nếu chạy cả backend bằng HTTP local, backend dùng `COOKIE_SECURE=false`, `COOKIE_SAME_SITE=lax`. Backend Vercel dùng cấu hình cookie production với HTTPS.

## Lệnh

| Lệnh | Công dụng |
| --- | --- |
| `npm ci` | Cài dependency theo lockfile của repo frontend |
| `npm run setup` | Tạo `.env` nếu chưa có |
| `npm run dev` | Chạy Vite dev server tại cổng 5173 |
| `npm run build` | Build production vào `dist/` ở thư mục gốc repo |
| `npm run preview` | Xem trước bản build tại cổng 4173 |
| `npm test` | Kiểm tra giao diện, xử lý phiên, QR, nhạc và hình học cây |
| `npm run test:tree` | Chạy các bài kiểm tra cây và phiên người chơi |

Nếu xem trước bằng `npm run preview`, backend cần cho phép origin đang truy cập, ví dụ `http://localhost:4173`. Các bài kiểm tra API và MongoDB nằm trong repo backend.

## Deploy frontend trên Vercel

Import repo `hieudevhouse/happynewyear`, Root Directory `./`, Framework Preset **Vite**, Build Command `npm run build`, Output Directory `dist`. Đặt `VITE_API_BASE_URL=/api` nếu đã tạo biến này trên dashboard; mặc định của ứng dụng cũng là `/api`.

File `vercel.json` chuyển `/api/:path*` tới `https://happynewyear-backend.vercel.app/api/:path*` và phục vụ các route React bằng `index.html`. Cookie phiên được gửi qua domain frontend. Backend cho phép domain production `https://happynewyear-six-bay.vercel.app`; thêm origin khác vào `CLIENT_ORIGIN` khi đổi domain. Proxy vẫn giữ header `Origin` của trình duyệt.

Sau khi deploy, kiểm tra `https://happynewyear-six-bay.vercel.app/api/health`: phải nhận JSON `{"ok":true,"database":"connected"}`. Tải lại trực tiếp `/loginl` hoặc `/adminl` để kiểm tra route React. Xem thêm [hướng dẫn deploy](deploy/README.md).

## Deploy riêng frontend trên hosting khác

Trong `.env.production`, đặt URL API công khai, gồm hậu tố `/api`:

```dotenv
VITE_API_BASE_URL=https://api.example.com/api
```

```bash
npm ci
npm run build
```

Upload nội dung **`dist/`** lên Nginx hoặc dịch vụ static hosting. Server frontend chỉ cần bản build; xem [hướng dẫn deploy và mẫu Nginx](deploy/README.md).

`VITE_API_BASE_URL` được đưa vào JavaScript **lúc build**. Đổi API URL phải build và upload lại; sửa `.env` trên server static không đổi bundle đã build. Mọi biến `VITE_*` là dữ liệu công khai, không chứa mật khẩu, MongoDB URI hoặc Cloudinary API secret. Xem [Vite env và mode](https://vite.dev/guide/env-and-mode).

Production ưu tiên `https://app.example.com` cho frontend và `https://api.example.com` cho API. Backend đặt `CLIENT_ORIGIN=https://app.example.com`, `NODE_ENV=production`, `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=lax`; nếu qua đúng một Nginx trước Express thì `TRUST_PROXY=1`. Nếu hai site khác nhau, xem lựa chọn cookie `none` và proxy `/api` trong [hướng dẫn deploy](deploy/README.md).

## Luồng và giao diện

1. `/`: nhập mã do quản trị viên cấp.
2. `/info`: điền tên người nhận lộc.
3. `/lucky`: chọn một trong 16 bao trên cây. **Mỗi mã chỉ nhận một phần quà**; sau khi nhận, các bao còn lại được khóa và một thẻ quà cho phép xem lại kết quả.
4. Admin quản lý mã, người quay, phần quà và yêu cầu chuyển tiền.

Cây đào dùng Three.js với thân cổ thụ, rễ bè, cành, lá, hoa nhiều lớp và 16 bao có sáu họa tiết. Cánh hoa rơi theo gió rồi đọng trên đất; cây có chuyển động nhẹ, hỗ trợ bàn phím và thiết lập giảm chuyển động. Thiết bị không có WebGL dùng cây minh họa với cùng thao tác nhận quà.

API quyết định và lưu phần quà, bảo đảm một quà cho mỗi mã kể cả hai yêu cầu đồng thời. Phiên dùng cookie HttpOnly; tải lại trong cùng phiên khôi phục kết quả từ API. Khóa rồi mở khóa mã không cấp thêm lượt.

Nhạc nền nằm trong `src/assets/Tết Đong Đầy.mp3`, được Vite đóng gói cùng `dist/`; repo frontend không cần lấy file từ backend. Nhạc bắt đầu ở giây thứ 10, lặp từ mốc đó và tiếp tục qua các bước nhận lộc. Khi trình duyệt chặn tự phát có tiếng, nút hiển thị “Chạm để nghe nhạc”; tương tác với trang sẽ thử phát lại. Nhạc tạm dừng khi đổi tab và phát tiếp khi quay lại. Hiệu ứng ngắn dùng Web Audio; hiệu ứng mở bao kéo dài thêm 0,5 giây.

## QR nhận tiền

Admin đặt số tiền và QR MoMo/ZaloPay cho từng quà. Sau khi mở bao, người chơi chọn một cách nhận; API chỉ cung cấp QR của ví đã chọn. QR MoMo/ZaloPay có hạn hiển thị 72 giờ, tính từ lần đầu xác nhận mở QR và lưu trên server; tải lại trang hoặc thay QR trong admin không đặt lại thời hạn. Đây là hạn hiển thị trên website; ảnh đã lưu và thời hạn nhận tiền thực tế do ứng dụng ví kiểm soát.

Người không dùng hai ví có thể chọn **QR ngân hàng**, tải QR cá nhân và gửi yêu cầu. Có thể sửa ảnh khi còn chờ; admin xem QR, chuyển tiền bên ngoài ứng dụng rồi xác nhận **Đã chuyển tiền**. Sau khi xác nhận, ảnh QR bị khóa. QR ngân hàng không có hạn 3 ngày; trang tự kiểm tra trạng thái khoảng 15 giây một lần và khi quay lại tab.

Ảnh QR hỗ trợ JPG, PNG, WebP, tối đa 50 MB mỗi ảnh gốc. Ảnh trên 9 MB được frontend xuất lại dưới dạng PNG và giảm kích thước khi cần trước khi upload. Cloudinary được cấu hình riêng trên backend; không đặt API secret vào repo frontend. Ứng dụng không tự xác minh giao dịch từ ảnh QR MoMo/ZaloPay; các thiết lập và bài kiểm tra nghiệp vụ nằm trong [repo backend](https://github.com/hieudevhouse/happynewyear-backend).
