# Security Policy

## Phiên bản hỗ trợ

Các bản sửa bảo mật được áp dụng cho nhánh mặc định và các release mới nhất.

## Báo cáo lỗ hổng

Không đăng công khai token, dữ liệu màn hình nhạy cảm hoặc chi tiết khai thác chưa được khắc phục. Hãy dùng GitHub Security Advisories nếu tính năng này khả dụng, hoặc liên hệ maintainer qua GitHub profile.

## Mô hình dữ liệu

- Screenshot được tạo tạm thời bởi thư viện capture và đưa vào bộ nhớ để crop/OCR.
- OCR chạy cục bộ bằng Tesseract.js.
- Text OCR được gửi tới provider dịch đã chọn; mặc định là endpoint Google Translate-compatible.
- API key chỉ được đọc từ biến môi trường và không được đưa vào URL log; Google Cloud dùng header `x-goog-api-key`.
- App không có telemetry và không chủ động lưu lịch sử dịch.

## Lưu ý

- Không đặt overlay lên mật khẩu, khóa khôi phục, tài liệu mật hoặc dữ liệu cá nhân nếu không chấp nhận việc text OCR được gửi tới dịch vụ bên thứ ba.
- Endpoint dịch mặc định là không chính thức và không phù hợp cho dữ liệu nhạy cảm hoặc môi trường production.
- Endpoint tùy chỉnh phải dùng HTTPS; chỉ proxy HTTP trên localhost được cho phép để phát triển.
- Release macOS nên được ký bằng Developer ID và notarize trước khi phân phối rộng rãi.
- Screen Recording permission cho phép tiến trình chụp nội dung màn hình; chỉ chạy code từ nguồn tin cậy.
