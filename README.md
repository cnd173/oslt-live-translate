# OSLT — Overlay Screen Live Translate

OSLT is a lightweight Electron overlay that captures a selected screen region, recognizes its text with Tesseract.js, translates each detected paragraph, and draws the translation back over the original layout.

> Dự án đang ở giai đoạn prototype. macOS là nền tảng được kiểm thử chính; Windows và Linux chưa được xác minh đầy đủ.

## Tính năng

- Một cửa sổ trong suốt, luôn nổi trên các ứng dụng khác.
- Cửa sổ ở mức `floating`, nằm dưới các giao diện hệ thống như macOS Spotlight.
- Capture trực tiếp đúng vùng chọn để giảm thời gian xử lý; tự fallback khi hệ thống không hỗ trợ.
- Chế độ `◎` live tùy chọn trên macOS: native ScreenCaptureKit loại trừ chính overlay, nên không OCR vòng lặp và không chớp tắt.
- Kéo và thay đổi kích thước để chọn vùng cần dịch.
- OCR giữ lại bounding box và cấu trúc đoạn văn.
- Tách lại paragraph khi Tesseract nhập nhầm các đoạn cách xa nhau.
- Dịch tối đa hai đoạn song song và backoff khi endpoint trả 429 để tránh tự làm nghẽn dịch vụ miễn phí.
- Chuẩn hóa mật độ ảnh OCR trên Retina để giảm số pixel xử lý mà vẫn giữ tọa độ layout.
- Vùng ảnh cao được chia làm hai tile overlap và OCR song song bằng hai worker.
- Live bỏ qua OCR khi hash ảnh nguồn không đổi; chỉ chạy lại khi vùng chọn thực sự thay đổi.
- Dòng có confidence thấp được OCR lại theo chế độ single-line, giới hạn số dòng để không làm chậm toàn bộ pipeline.
- Giữ xuống dòng của paragraph và suy luận căn trái, căn giữa hoặc căn phải từ bbox nguồn.
- Vẽ bản dịch đúng vị trí và tự thu nhỏ để vừa vùng chữ gốc.
- Đồng bộ font-size giữa các patch có cỡ chữ nguồn tương đương; label nhỏ vẫn giữ nhóm riêng.
- Mở rộng patch quanh bbox, dùng nền kín và typography nhẹ để tăng safe space, tương phản và khả năng đọc đoạn dài.
- Nhận diện word-level cho code/URL, nền xám và chữ xanh; giữ nguyên token kỹ thuật qua placeholder khi dịch.
- Cache kết quả dịch và cache cả request đang chạy để các vòng live không gửi lại cùng một đoạn lên mạng.
- Có nút bật/tắt Preserve styles và fallback về plain text nếu placeholder bị mất.
- Hỗ trợ chuyển nhanh giữa bản dịch và văn bản OCR bằng nút `Aa`.
- Có thể chụp screenshot chứa cả overlay và bản dịch.
- Không cần API key cho cấu hình mặc định.
- Có adapter dịch: Google-compatible mặc định, Google Cloud Translation và DeepL; provider được chọn bằng biến môi trường.

## Ảnh hưởng của cơ chế khóa

Sau một lần dịch thành công, OSLT **khóa kết quả** thay vì tiếp tục chụp liên tục. Cách này ngăn OCR đọc lại chính lớp dịch và làm nội dung nhảy qua lại.

Ứng dụng quét lại khi:

- bấm nút `↻`;
- thay đổi ngôn ngữ nguồn hoặc đích;
- kéo hoặc resize cửa sổ rồi dừng thao tác.

Vì vậy, “live” trong phiên bản hiện tại nghĩa là quét nhanh theo vùng và cập nhật có kiểm soát, chưa phải OCR liên tục từng khung hình.

Trên macOS, sau khi build native helper, nút `◎` bật live an toàn. Chế độ này vẫn quét theo chu kỳ 1,5 giây nhưng giữ patch cũ nếu OCR tạm thời rỗng và không render lại khi nội dung nguồn không đổi. Nếu chưa build helper, nút này bị vô hiệu hóa và app dùng chế độ khóa ổn định.

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
npm run build:native   # macOS, bật capture loại trừ overlay (không bắt buộc)
npm start
```

Lần đầu sử dụng một ngôn ngữ OCR, Tesseract có thể cần tải trained data và sẽ mất nhiều thời gian hơn các lần sau. Vùng chọn càng sát nội dung thì OCR càng nhanh.

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
| `◎` | Bật/tắt live an toàn trên macOS sau khi build native helper |
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
npm run build:native # build helper ScreenCaptureKit trên macOS
npm run benchmark -- path/to/image.png eng # benchmark OCR trên ảnh fixture của bạn
npm run check   # kiểm tra cú pháp JavaScript
npm test        # chạy kiểm tra hiện có
```

### Provider dịch

Mặc định app dùng endpoint Google Translate-compatible không cần API key. Có thể trỏ endpoint này tới proxy riêng:

```bash
OSLT_TRANSLATE_ENDPOINT=https://your-proxy.example/translate npm start
```

Với môi trường dùng lâu dài, nên chọn API chính thức. Không commit các key này vào repository:

Có thể sao chép [`.env.example`](.env.example) để làm danh sách cấu hình; OSLT đọc biến môi trường của tiến trình và không tự đọc/ghi file `.env`.

```bash
# Google Cloud Translation v2
OSLT_TRANSLATOR=google-cloud \
OSLT_GOOGLE_CLOUD_API_KEY=your-key \
npm start

# DeepL API (dùng api-free.deepl.com nếu tài khoản ở free endpoint)
OSLT_TRANSLATOR=deepl \
OSLT_DEEPL_API_KEY=your-key \
OSLT_DEEPL_ENDPOINT=https://api-free.deepl.com/v2/translate \
npm start
```

Các provider đều nhận paragraph hoàn chỉnh, nên vẫn giữ được ngữ cảnh tốt hơn dịch từng dòng. Khi endpoint trả `429`, app tạm dừng request trong thời gian backoff và giữ lại text nguồn thay vì làm overlay nhảy liên tục.

## Kiến trúc

```text
Screen region
    ↓ ScreenCaptureKit native (hoặc screencapture / full-screen fallback)
Jimp crop / optional upscale
    ↓
Tesseract.js OCR + bounding boxes
    ↓
Paragraph grouping and gap splitting
    ↓ translation cache + selected translator adapter
Google-compatible / Google Cloud / DeepL
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
- OCR song song dùng nhiều RAM hơn worker đơn; vùng thấp hơn 900px tự động quay về một worker.
- Image hash và căn lề là heuristic; thay đổi rất nhỏ hoặc font đặc biệt có thể không được phát hiện chính xác.
- OCR lại dòng confidence thấp làm một số scan đầu lâu hơn, nhưng chỉ áp dụng tối đa tám dòng yếu.
- Live an toàn cần macOS 14 trở lên và binary `native/bin/oslt-region-capture`; nếu ScreenCaptureKit lỗi runtime, app tự tắt live để tránh đọc nhầm patch.
- Provider mặc định là endpoint không chính thức; provider chính thức cần API key và có thể phát sinh chi phí theo chính sách dịch vụ.

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
