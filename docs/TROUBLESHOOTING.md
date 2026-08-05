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

## Nội dung bên dưới thay đổi nhưng bản dịch không đổi

Đây là hành vi chủ ý. OSLT khóa kết quả sau một lần dịch để tránh OCR đọc lại overlay. Bấm `↻`, đổi ngôn ngữ hoặc di chuyển/resize cửa sổ để quét lại.

## Layout không khớp hoàn toàn

OSLT dùng bbox của Tesseract và font hệ thống thay vì font gốc. Kết quả có thể khác khi:

- bản dịch dài hơn nhiều;
- văn bản có nhiều cột;
- font trang trí hoặc code font;
- nền có gradient, animation hoặc độ tương phản thấp;
- Tesseract nhập hoặc tách paragraph sai.

Thu hẹp vùng chọn thường giúp OCR và layout tốt hơn.

## Bản dịch không tự nhiên hoặc còn chữ gốc

Nhấn `Aa` để kiểm tra text OCR. Nếu OCR đã sai, hãy chọn đúng ngôn ngữ và quét lại. Nếu OCR đúng nhưng dịch sai, nguyên nhân có thể là endpoint dịch máy không chính thức.

## Screenshot không chứa filter

Phiên bản hiện tại không bật Electron content protection, vì vậy screenshot hệ thống phải chứa overlay. Hãy chắc chắn đang chạy code mới nhất và không còn một instance cũ. Thoát tất cả instance rồi chạy lại `npm start`.

## CPU cao

- Giảm kích thước vùng quét.
- Đợi scan hoàn tất; sau khi khóa, OCR không tiếp tục chạy.
- Không bấm refresh liên tục.
- Thoát các instance Electron cũ còn chạy nền.
