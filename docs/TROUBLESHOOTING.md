# Khắc phục sự cố

## Chấm trạng thái màu đỏ hoặc `could not create image from display`

Trên macOS, kiểm tra **System Settings → Privacy & Security → Screen Recording**. Bật quyền cho terminal dùng để chạy app, đóng hoàn toàn terminal rồi mở lại.

Nếu đã cấp quyền nhưng vẫn lỗi, xóa quyền cũ, cấp lại và khởi động lại máy.

## Không kéo được cửa sổ

Kéo trực tiếp toolbar tím ở phía trên. Các nút và menu dùng `no-drag`, nên không thể kéo từ chính control đó.

## Không thấy bản dịch

- Kiểm tra chấm trạng thái.
- Chọn đúng ngôn ngữ OCR nguồn.
- Đảm bảo chữ đủ lớn, rõ và có tương phản tốt.
- Resize khung sát vùng chữ rồi bấm `↻`.
- Kiểm tra kết nối Internet.
- Xem terminal để tìm lỗi OCR hoặc HTTP.

## Lần đầu dịch rất chậm

Tesseract có thể đang tải trained data cho ngôn ngữ OCR. Những lần sau thường nhanh hơn. Vùng quét càng lớn thì OCR càng tốn thời gian; nên chỉ bao vùng cần dịch.

Trên macOS, chạy thêm `npm run build:native` để capture đúng vùng thay vì chụp toàn màn hình. Worker OCR thứ hai chỉ được nạp khi vùng ảnh đủ cao; đây là chủ ý để giảm thời gian khởi động và RAM.

## Nội dung bên dưới thay đổi nhưng bản dịch không đổi

Đây là hành vi chủ ý. OSLT khóa kết quả sau một lần dịch để tránh OCR đọc lại overlay. Bấm `↻`, đổi ngôn ngữ hoặc di chuyển/resize cửa sổ để quét lại.

Nếu muốn theo dõi tự động, chạy `npm run build:native` rồi bật nút `◎`. Live chỉ cập nhật khi OCR thấy nội dung nguồn khác; cache dịch giúp đoạn cũ không tạo request mới.

Nếu terminal báo `Translate rate-limited`, endpoint đang giới hạn tốc độ. App tự backoff và giữ text nguồn; với OSS dùng lâu dài nên chọn provider chính thức thay vì tăng concurrency.

Nếu dùng proxy tương thích, đặt biến môi trường `OSLT_TRANSLATE_ENDPOINT` trước `npm start` và kiểm tra proxy trả JSON cùng cấu trúc `json[0][i][0]` như endpoint mặc định.

Để dùng provider chính thức:

```bash
OSLT_TRANSLATOR=google-cloud OSLT_GOOGLE_CLOUD_API_KEY=your-key npm start
OSLT_TRANSLATOR=deepl OSLT_DEEPL_API_KEY=your-key npm start
```

Google Cloud dùng endpoint v2 mặc định. DeepL dùng `https://api.deepl.com/v2/translate`; tài khoản free có thể đặt `OSLT_DEEPL_ENDPOINT=https://api-free.deepl.com/v2/translate`. Kiểm tra mã ngôn ngữ được provider đó hỗ trợ nếu bản dịch bị từ chối.

## Layout không khớp hoàn toàn

OSLT dùng bbox của Tesseract và font hệ thống thay vì font gốc. Kết quả có thể khác khi:

- bản dịch dài hơn nhiều;
- văn bản có nhiều cột;
- font trang trí hoặc code font;
- nền có gradient, animation hoặc độ tương phản thấp;
- Tesseract nhập hoặc tách paragraph sai.

Thu hẹp vùng chọn thường giúp OCR và layout tốt hơn.

## Code hoặc link được tô style sai

Nhận diện màu/nền đang dùng heuristic. Bấm `◐` để tắt Preserve styles nhưng vẫn giữ bản dịch plain text. Với kết quả mới, thu hẹp vùng chọn và bấm `↻` có thể giúp phân tích màu chính xác hơn.

## Bản dịch không tự nhiên hoặc còn chữ gốc

Nhấn `Aa` để kiểm tra text OCR. Nếu OCR đã sai, hãy chọn đúng ngôn ngữ và quét lại. Nếu OCR đúng nhưng dịch sai, nguyên nhân có thể là endpoint dịch máy không chính thức.

## Screenshot không chứa filter

Phiên bản hiện tại không bật Electron content protection, vì vậy screenshot hệ thống phải chứa overlay. Hãy chắc chắn đang chạy code mới nhất và không còn một instance cũ. Thoát tất cả instance rồi chạy lại `npm start`.

## CPU cao

Native live capture không dùng content protection, nên không làm mất overlay khỏi screenshot hệ thống. Nếu live bị tắt sau khi chạy, helper ScreenCaptureKit đã lỗi hoặc quyền Screen Recording bị thu hồi; app tự tắt live để tránh kết quả sai.

- Giảm kích thước vùng quét.
- Đợi scan hoàn tất; sau khi khóa, OCR không tiếp tục chạy.
- Không bấm refresh liên tục.
- Thoát các instance Electron cũ còn chạy nền.

Ảnh cao dùng hai OCR worker để giảm thời gian chờ và sẽ tốn thêm RAM. Ảnh thấp tự dùng một worker. Terminal hiển thị timing sau mỗi scan để xác định capture, OCR hay translate đang chậm.
