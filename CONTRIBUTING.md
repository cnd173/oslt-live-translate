# Contributing

Cảm ơn bạn muốn đóng góp cho OSLT.

## Thiết lập

```bash
git clone https://github.com/cnd173/oslt-live-translate.git
cd oslt-live-translate
npm install
npm run build:native # macOS, cần cho live mode
npm test
npm start
```

Trên macOS, cấp Screen Recording permission trước khi kiểm thử OCR.

## Quy trình

1. Tạo issue mô tả bug hoặc thay đổi lớn.
2. Fork repository và tạo branch ngắn gọn.
3. Giữ thay đổi tập trung, tránh refactor không liên quan.
4. Chạy `npm test`.
5. Kiểm thử thủ công với ít nhất một đoạn ngắn và một trang nhiều paragraph.
6. Với thay đổi OCR/layout, kiểm tra cả live mode, ảnh Retina và ít nhất một trường hợp căn giữa/căn phải.
7. Gửi pull request kèm ảnh trước/sau và timing `capture/ocr/refine/translate/total` nếu thay đổi hiệu năng.

## Benchmark OCR

Dùng ảnh fixture cục bộ để không đưa ảnh người dùng vào repository:

```bash
npm run benchmark -- /path/to/sample.png eng
```

Script in ra kích thước ảnh, số dòng, số ký tự và thời gian OCR. Không commit ảnh có dữ liệu riêng tư.

## Quy ước code

- Dùng CommonJS như code hiện tại.
- Giữ main-process functions nhỏ và dễ đọc.
- Không đưa Node API trực tiếp vào renderer; mở rộng preload bridge khi cần.
- Không hard-code token hoặc API key.
- Giữ coordinate conversion ở main process.
- Khi thay đổi OCR/layout, kiểm tra cả Retina scale factor và vùng có nhiều paragraph.

## Checklist pull request

- [ ] `npm test` thành công.
- [ ] Không commit `node_modules`, trained data hoặc file cục bộ.
- [ ] README/docs được cập nhật nếu hành vi thay đổi.
- [ ] Nếu thay đổi layout/OCR, fixture hoặc test tương ứng đã được thêm.
- [ ] Không làm mất khả năng chụp screenshot có overlay.
- [ ] Kết quả không tự OCR và nhảy sau khi đã khóa.

## Báo lỗi

Vui lòng cung cấp:

- hệ điều hành và phiên bản;
- Node.js/npm version;
- ngôn ngữ OCR và ngôn ngữ đích;
- kích thước/mô tả vùng quét;
- log terminal đã loại bỏ dữ liệu nhạy cảm;
- ảnh minh họa nếu có thể.
