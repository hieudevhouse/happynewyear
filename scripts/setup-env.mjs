import { copyFileSync, existsSync } from 'node:fs';
import { constants } from 'node:fs';

const target = new URL('../.env', import.meta.url);
if (!existsSync(target)) {
  copyFileSync(new URL('../.env.example', import.meta.url), target, constants.COPYFILE_EXCL);
  console.log('Đã tạo frontend/.env. Đặt VITE_API_BASE_URL trước khi build để deploy.');
} else {
  console.log('frontend/.env đã có sẵn; giữ nguyên cấu hình hiện tại.');
}
