# LuckyMoney 2027

Hệ thống quay lì xì đầu năm Đinh Mùi 2027 với React/Vite ở frontend, Express/Mongoose ở backend và MongoDB cho dữ liệu mã quay, người chơi và phần thưởng.

## Chạy local

```bash
npm install
npm run dev
```

- Người chơi: `http://localhost:5173`
- Quản trị: `http://localhost:5173/admin`
- API: `http://localhost:4000/api/health`

Để mở trên điện thoại cùng Wi‑Fi, chạy frontend bằng `npm run client`, lấy IPv4 của máy tính bằng `ipconfig`, rồi truy cập `http://<IPv4-của-máy>:5173` trên điện thoại. Ví dụ: `http://192.168.1.25:5173`.

Sao chép `.env.example` thành `.env` nếu muốn đổi MongoDB URI. Khi MongoDB chưa chạy, API vẫn chạy demo mode để xem giao diện và thao tác mẫu.

## Luồng chính

1. Nhập mã quay dạng `LM-2027-XXXX`.
2. Điền tên người nhận lộc.
3. Quay vòng quay và nhận phần thưởng.
4. Admin quản lý mã quay, trạng thái sử dụng, tên người quay và phần thưởng.

