# LuckyMoney 2027

Hệ thống quay lì xì đầu năm Đinh Mùi 2027 với React/Vite ở frontend, Express/Mongoose ở backend và MongoDB cho dữ liệu mã quay, người chơi và phần thưởng.

## Chạy local

```bash
npm install
npm run setup
npm run dev
```

- Nhập mã: `http://localhost:5173/`
- Nhập tên: `http://localhost:5173/info`
- Cây đào và quà đã nhận: `http://localhost:5173/lucky`
- Đăng nhập quản trị: `http://localhost:5173/loginl`
- Quản trị: `http://localhost:5173/adminl`
- API: `http://localhost:4000/api/health`

`npm run dev` chạy cả frontend và API. Để mở trên điện thoại cùng Wi‑Fi, lấy IPv4 của máy tính bằng `ipconfig`, rồi truy cập `http://<IPv4-của-máy>:5173` trên điện thoại.

`npm run setup` tạo `.env` nếu chưa có. Cấu hình `MONGO_URI`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` trong `.env` trước khi chạy; mật khẩu khởi tạo quản trị cần ít nhất 12 ký tự. API yêu cầu MongoDB hoạt động để lưu mã, phần thưởng và phiên đăng nhập.

## Luồng chính

1. `HomePage` tại `/`: nhập mã do quản trị viên cấp.
2. `InfoPage` tại `/info`: điền tên người nhận lộc.
3. `LuckyPage` tại `/lucky`: chọn một trong 16 bao trên cây. **Mỗi mã chỉ nhận một phần quà**. Sau khi nhận, các bao còn lại được khóa; một thẻ quà duy nhất bên dưới cho phép xem lại kết quả.
4. Admin quản lý mã quay, trạng thái sử dụng, tên người quay và phần thưởng.

## Cây đào hái lộc

Cây đào tại `/lucky` được dựng trực tiếp bằng Three.js: thân, rễ, các cành nhỏ, hoa nhiều lớp, lá và 16 bao lì xì với sáu mẫu họa tiết. Cành, lá, hoa và tua bao chuyển động nhẹ theo gió; cánh hoa rơi trong vườn. Trang này chỉ hiển thị cây và các phần thưởng, hỗ trợ chọn bao bằng bàn phím và thiết lập giảm chuyển động của hệ thống.

Cây có gốc cổ thụ lớn, rễ bè mọc trên mặt đất rộng, cỏ, đá nhỏ và bóng đổ. Cánh hoa tách từ tán, lượn và xoay theo gió rồi đọng lại trên đất; dưới gốc có lớp hoa rụng. Góc camera hơi nhìn xuống để thấy rõ cây được trồng trên đất.

Máy chủ chọn quà theo tỷ trọng của các phần thưởng đang bật và lưu kết quả trong MongoDB. Bao chưa mở không lộ phần thưởng cho trình duyệt. Lượt nhận được chốt bằng cập nhật nguyên tử: hai yêu cầu đồng thời cũng chỉ nhận một quà; gửi lại yêu cầu mở đúng bao đã chọn chỉ trả lại kết quả cũ. Khóa rồi mở khóa mã không cấp thêm lượt.

Phiên người chơi dùng cookie HttpOnly. Tải lại trang trong cùng phiên sẽ khôi phục phần quà từ máy chủ. Mã đã nhận quà trước khi áp dụng giới hạn mới cũng không được nhận thêm; lịch sử cũ vẫn được giữ cho quản trị viên, còn người chơi thấy phần quà đầu tiên.

Thiết bị không hỗ trợ WebGL có bản cây minh họa với cùng thao tác nhận quà. Giao diện hỗ trợ bàn phím và thiết lập giảm chuyển động.

Chạy `npm test` để kiểm tra giới hạn một quà, các yêu cầu mở đồng thời, khôi phục phiên và hình học cây. `npm run build` kiểm tra bản production.

