# LuckyMoney 2027

Hệ thống quay lì xì đầu năm Đinh Mùi 2027 với React/Vite ở frontend, Express/Mongoose ở backend và MongoDB cho dữ liệu mã quay, người chơi và phần thưởng.

## Chạy local

```bash
npm install
npm run dev
```

- Nhập mã: `http://localhost:5173/`
- Nhập tên: `http://localhost:5173/info`
- Cây đào và quà đã nhận: `http://localhost:5173/lucky`
- Quản trị: `http://localhost:5173/admin`
- API: `http://localhost:4000/api/health`

Để mở trên điện thoại cùng Wi‑Fi, chạy frontend bằng `npm run client`, lấy IPv4 của máy tính bằng `ipconfig`, rồi truy cập `http://<IPv4-của-máy>:5173` trên điện thoại. Ví dụ: `http://192.168.1.25:5173`.

Sao chép `.env.example` thành `.env` nếu muốn đổi MongoDB URI. Khi MongoDB chưa chạy, API vẫn chạy demo mode để xem giao diện và thao tác mẫu.

## Luồng chính

1. `HomePage` tại `/`: nhập mã dạng `2027-XXXX`.
2. `InfoPage` tại `/info`: điền tên người nhận lộc.
3. `LuckyPage` tại `/lucky`: chạm một bao lì xì để mở ngay. Phần thưởng xuất hiện trên cây và tự đóng sau 5 giây; cũng có thể bấm **Về cây đào**. Quà đã mở nằm ở dải phía dưới, bấm vào để xem lại mà không nhận trùng.
4. Admin quản lý mã quay, trạng thái sử dụng, tên người quay và phần thưởng.

## Cây đào hái lộc

Cây đào tại `/lucky` được dựng trực tiếp bằng Three.js: thân, rễ, các cành nhỏ, hoa nhiều lớp, lá và 16 bao lì xì với sáu mẫu họa tiết. Cành, lá, hoa và tua bao chuyển động nhẹ theo gió; cánh hoa rơi trong vườn. Trang này chỉ hiển thị cây và các phần thưởng, hỗ trợ chọn bao bằng bàn phím và thiết lập giảm chuyển động của hệ thống.

Cây có gốc cổ thụ lớn, rễ bè mọc trên mặt đất rộng, cỏ, đá nhỏ và bóng đổ. Cánh hoa tách từ tán, lượn và xoay theo gió rồi đọng lại trên đất; dưới gốc có lớp hoa rụng. Góc camera hơi nhìn xuống để thấy rõ cây được trồng trên đất.

Mỗi phong bao được gán một quà từ danh sách demo hiện tại; bao đã mở được gỡ khỏi cây và không thể nhận lặp lại. Mã, tên, quà và tiến trình được lưu trong `sessionStorage`, nên tải lại trang vẫn giữ kết quả trong cùng phiên trình duyệt. Vào `/info` hoặc `/lucky` khi chưa nhập thông tin sẽ được chuyển về bước cần hoàn thành. Ba đường dẫn dùng chung cổng frontend, mặc định `5173`.

Thiết bị không hỗ trợ WebGL có bản cây minh họa với cùng thao tác nhận quà. Phần người chơi hiện vẫn là luồng demo ở frontend.

Kiểm tra hình học, vùng chạm trên điện thoại, mở nhiều bao, khôi phục phiên và giải phóng tài nguyên bằng `npm run test:tree`.

