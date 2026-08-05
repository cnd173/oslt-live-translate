# OSLT — Overlay Screen Live Translate

OSLT is a lightweight Electron overlay that captures a selected screen region, recognizes its text with Tesseract.js, translates each detected paragraph, and draws the translation back over the original layout.

> Dự án đang ở giai đoạn prototype. macOS là nền tảng được kiểm thử chính; Windows và Linux chưa được xác minh đầy đủ.

## Tính năng

- Một cửa sổ trong suốt, luôn nổi trên các ứng dụng khác.
- Cửa sổ ở mức `floating`, nằm dưới các giao diện hệ thống như macOS Spotlight.
- Kéo và thay đổi kích thước để chọn vùng cần dịch.
- OCR giữ lại bounding box và cấu trúc đoạn văn.
- Tách lại paragraph khi Tesseract nhập nhầm các đoạn cách xa nhau.
- Dịch tối đa ba đoạn song song để giảm độ trễ.
- Vẽ bản dịch đúng vị trí, căn trái và tự thu nhỏ để vừa vùng chữ gốc.
- Đồng bộ font-size giữa các patch có cỡ chữ nguồn tương đương; label nhỏ vẫn giữ nhóm riêng.
- Mở rộng patch quanh bbox, dùng nền kín và typography nhẹ để tăng safe space, tương phản và khả năng đọc đoạn dài.
- Nhận diện word-level cho code/URL, nền xám và chữ xanh; giữ nguyên token kỹ thuật qua placeholder khi dịch.
- Có nút bật/tắt Preserve styles và fallback về plain text nếu placeholder bị mất.
- Hỗ trợ chuyển nhanh giữa bản dịch và văn bản OCR bằng nút `Aa`.
- Có thể chụp screenshot chứa cả overlay và bản dịch.
- Không cần API key cho cấu hình mặc định.

## Ảnh hưởng của cơ chế khóa

Sau một lần dịch thành công, OSLT **khóa kết quả** thay vì tiếp tục chụp liên tục. Cách này ngăn OCR đọc lại chính lớp dịch và làm nội dung nhảy qua lại.

Ứng dụng quét lại khi:

- bấm nút `↻`;
- thay đổi ngôn ngữ nguồn hoặc đích;
- kéo hoặc resize cửa sổ rồi dừng thao tác.

Vì vậy, “live” trong phiên bản hiện tại nghĩa là quét nhanh theo vùng và cập nhật có kiểm soát, chưa phải OCR liên tục từng khung hình.

## Yêu cầu

- Node.js 18 trở lên;
- npm;
- macOS 12 trở lên được khuyến nghị;
- kết nối Internet để tải dữ liệu OCR lần đầu và gọi dịch vụ dịch;
- quyền Screen Recording trên macOS.

## Cài đặt

```bash
git clone https://github.com/cnd173/oslt-live-translate.git
cd oslt-live-translate
npm install
npm start
```

Lần đầu sử dụng một ngôn ngữ OCR, Tesseract có thể cần tải trained data và sẽ mất nhiều thời gian hơn các lần sau.

## Cấp quyền Screen Recording trên macOS

1. Mở **System Settings → Privacy & Security → Screen Recording**.
2. Bật quyền cho Terminal, iTerm hoặc ứng dụng dùng để chạy `npm start`.
3. Thoát hoàn toàn terminal đó rồi mở lại.
4. Chạy lại `npm start`.

Nếu không có quyền, chấm trạng thái trên toolbar chuyển sang màu đỏ và terminal có thể báo `could not create image from display`.

## Cách sử dụng

1. Chạy `npm start`.
2. Kéo toolbar tím để đặt khung lên vùng chữ.
3. Kéo cạnh hoặc góc cửa sổ để bao vùng cần dịch.
4. Chọn ngôn ngữ OCR ở menu bên trái và ngôn ngữ đích ở menu `→`.
5. Chờ OCR và dịch hoàn tất.
6. Bấm `↻` khi nội dung bên dưới thay đổi.

### Toolbar

| Thành phần | Chức năng |
| --- | --- |
| Chấm xanh | Sẵn sàng hoặc quét thành công |
| Chấm vàng | Đang tải dữ liệu OCR |
| Chấm xám | Đang tạm dừng |
| Chấm đỏ | Chụp màn hình, OCR hoặc dịch gặp lỗi |
| `EN`, `VI`, ... | Ngôn ngữ chữ nguồn cho Tesseract |
| `→VI`, `→EN`, ... | Ngôn ngữ bản dịch |
| `↻` | Xóa kết quả hiện tại và quét lại |
| `◐` | Bật/tắt giữ nền code và màu link |
| `Aa` | Chuyển giữa bản dịch và văn bản OCR |
| `⏸` / `▶` | Tạm dừng hoặc tiếp tục |
| `✕` | Thoát ứng dụng |

## Ngôn ngữ

OCR hiện có lựa chọn: Anh, Việt, Nhật, Trung giản thể, Hàn, Pháp, Đức, Tây Ban Nha, Thái và Nga.

Ngôn ngữ đích hiện có: Việt, Anh, Nhật, Trung giản thể, Hàn, Pháp, Đức, Tây Ban Nha, Thái và Nga.

## Lệnh phát triển

```bash
npm start       # chạy ứng dụng Electron
npm run check   # kiểm tra cú pháp JavaScript
npm test        # chạy kiểm tra hiện có
```

## Kiến trúc

```text
Screen region
    ↓ screenshot-desktop
Jimp crop / optional upscale
    ↓
Tesseract.js OCR + bounding boxes
    ↓
Paragraph grouping and gap splitting
    ↓
Google Translate-compatible endpoint
    ↓
IPC → positioned HTML translation patches
```

Xem chi tiết tại [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Giới hạn đã biết

- Endpoint `translate.googleapis.com` đang được dùng theo cách không chính thức, không có SLA và có thể bị giới hạn tốc độ hoặc thay đổi hành vi.
- OCR phụ thuộc mạnh vào độ phân giải, độ tương phản, font, hiệu ứng nền và ngôn ngữ được chọn.
- Font family và style gốc chưa được tái tạo chính xác; ứng dụng ước lượng cỡ chữ từ chiều cao dòng rồi đồng bộ theo nhóm gần nhau.
- Nhận diện nền xám/màu xanh dùng heuristic pixel nên có thể sai trên gradient, ảnh nền hoặc syntax theme lạ; nút `◐` cho phép tắt style.
- Bold và italic chưa được bảo toàn trong pha hiện tại.
- Bản dịch dài hơn văn bản gốc phải thu nhỏ để vừa bounding box.
- Toolbar chiếm 30px phía trên cửa sổ và vùng này không được OCR.
- Chưa có bộ cài ký số hoặc bản phát hành đóng gói.
- Multi-monitor và Windows/Linux chưa được kiểm thử đầy đủ.
- Chưa có nhà cung cấp dịch chính thức hoặc cấu hình API key.

Xem cách xử lý lỗi thường gặp tại [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

## Bảo mật và quyền riêng tư

- Ảnh màn hình được xử lý cục bộ bằng Jimp và Tesseract.js.
- Văn bản OCR được gửi tới endpoint dịch của Google để nhận bản dịch.
- Dự án không có telemetry và không chủ động lưu ảnh chụp.
- Không đặt khóa API, token hoặc dữ liệu nhạy cảm trong repository.

Đọc thêm tại [SECURITY.md](SECURITY.md).

## Đóng góp

Issue và pull request đều được hoan nghênh. Trước khi gửi thay đổi, đọc [CONTRIBUTING.md](CONTRIBUTING.md) và chạy `npm test`.

## Giấy phép

[MIT](LICENSE)
