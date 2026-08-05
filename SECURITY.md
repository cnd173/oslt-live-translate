# Security Policy

## Phiên bản hỗ trợ

OSLT hiện là prototype và chưa có release ổn định. Các bản sửa bảo mật chỉ áp dụng cho nhánh mặc định mới nhất.

## Báo cáo lỗ hổng

Không đăng công khai token, dữ liệu màn hình nhạy cảm hoặc chi tiết khai thác chưa được khắc phục. Hãy dùng GitHub private vulnerability reporting nếu repository đã bật tính năng này, hoặc liên hệ maintainer qua địa chỉ trong Git commit metadata.

## Mô hình dữ liệu

- Screenshot được tạo tạm thời bởi thư viện capture và đưa vào bộ nhớ để crop/OCR.
- OCR chạy cục bộ bằng Tesseract.js.
- Text OCR được gửi tới endpoint Google Translate-compatible.
- App không có telemetry và không chủ động lưu lịch sử dịch.

## Lưu ý

- Không đặt overlay lên mật khẩu, khóa khôi phục, tài liệu mật hoặc dữ liệu cá nhân nếu không chấp nhận việc text OCR được gửi tới dịch vụ bên thứ ba.
- Endpoint dịch mặc định là không chính thức và không phù hợp cho dữ liệu nhạy cảm hoặc môi trường production.
- Screen Recording permission cho phép tiến trình chụp nội dung màn hình; chỉ chạy code từ nguồn tin cậy.
