# Kiến trúc OSLT

## Tổng quan

OSLT là một ứng dụng Electron một cửa sổ. Main process chịu trách nhiệm chụp màn hình, OCR, gọi dịch vụ dịch và quản lý trạng thái. Renderer chỉ hiển thị toolbar cùng các patch bản dịch. Preload tạo một cầu IPC nhỏ, không phơi trực tiếp Node.js ra renderer.

## Thành phần

### `main.js`

- Tạo `BrowserWindow` trong suốt, không viền và luôn nổi.
- Lấy bounds cửa sổ để xác định vùng crop.
- Chụp đúng vùng cửa sổ bằng `lib/screen-capture.js`. Trên macOS nếu có `native/bin/oslt-region-capture`, helper dùng ScreenCaptureKit và loại trừ các cửa sổ cùng PID với overlay; nếu không có, app dùng `/usr/sbin/screencapture -R`, rồi fallback về `screenshot-desktop`.
- Crop ảnh và chuẩn hóa mật độ pixel bằng Jimp; Retina được downscale về mục tiêu 1.5 physical pixels/CSS pixel.
- OCR với Tesseract.js và yêu cầu output `blocks`.
- Khởi động một Tesseract worker để toolbar hiện nhanh; chỉ tạo worker thứ hai khi ảnh đủ cao để OCR song song có lợi.
- Ảnh cao được chia thành hai tile có overlap và OCR song song.
- Duyệt block → paragraph → line và loại dòng có confidence thấp.
- Tách paragraph khi khoảng cách dọc giữa hai dòng vượt ngưỡng dựa trên chiều cao chữ trung vị.
- Dịch paragraph với tối đa năm request đồng thời; cache LRU 256 mục lưu cả Promise đang chạy để tránh request trùng trong live loop.
- Gửi text, bbox và chiều cao font ước lượng sang renderer.

### `preload.js`

Expose API giới hạn qua `contextBridge`:

- đổi ngôn ngữ OCR;
- đổi ngôn ngữ đích;
- refresh;
- pause/resume;
- quit;
- đọc state và nhận sự kiện status/translation.
- bật/tắt live an toàn.

### `renderer/overlay.html`

- Vẽ toolbar trong vùng cao 30px.
- Vẽ mỗi paragraph dưới dạng patch tuyệt đối theo bbox OCR.
- Dùng binary search để tìm cỡ chữ lớn nhất vừa patch.
- Không cho auto-fit phóng chữ quá cỡ ước lượng của văn bản gốc.
- Nhóm các patch có `fontHeight` gần nhau và dùng cỡ fit trung vị làm mục tiêu chung; patch dài bất thường vẫn được thu nhỏ riêng để không tràn.
- Mở rộng vùng render quanh bbox OCR trước khi thêm padding; dùng nền kín, font weight thường và line-height thoáng để giảm nhiễu từ chữ gốc.
- Render styled runs bằng DOM API và `textContent`; không đưa nội dung OCR/dịch vào `innerHTML`.

## Bảo toàn style word-level

Với từng bbox word, main process lấy màu nền trội và phân tích foreground. Nền xám lệch khỏi nền trung vị của paragraph được xem là code badge; foreground xanh được xem là link. URL, path, method call và dotted identifier cũng được nhận diện bằng lexical rule.

Các token đặc biệt được thay bằng placeholder `__OSLTn__` trước khi dịch. Sau dịch, placeholder được khôi phục thành semantic runs (`code`/`link`). Nếu thiếu, trùng hoặc hỏng placeholder, app gọi dịch lại bằng plain text và không áp style. Renderer chỉ ánh xạ semantic flags sang class CSS cố định.
- Cho phép hiển thị text OCR để đối chiếu.

## Luồng quét

1. `requestScan()` tăng generation, reset chữ ký nguồn và mở khóa; refresh thủ công xóa patch cũ.
2. `captureAndOcr()` chụp đúng vùng cửa sổ, trừ toolbar.
3. Tesseract trả text cùng layout.
4. App tạo các paragraph logic và bbox bao quanh từng paragraph.
5. Các paragraph được dịch với concurrency tối đa bằng 5.
6. Nếu generation chưa thay đổi, renderer nhận kết quả và vẽ patch.
7. Ở chế độ thường, `overlayLocked` được bật để ngăn OCR đọc lại chính bản dịch.
8. Ở chế độ live, ScreenCaptureKit loại trừ overlay theo PID; nếu chữ ký nguồn không đổi thì bỏ qua dịch/render. Một lần OCR rỗng chưa xóa patch; chỉ xóa sau hai lần liên tiếp.

Kéo/resize được debounce 400ms trước khi yêu cầu quét mới. Nút refresh và thay đổi ngôn ngữ cũng tạo một generation mới, nhờ đó kết quả từ tác vụ cũ không thể ghi đè lên tác vụ mới.

Với ảnh xử lý cao từ 900px, pipeline chia ngang thành hai tile có overlap 48–90px. Dòng trong overlap được phân cho tile theo tâm bbox để tránh trùng. Hai nhóm paragraph giáp ranh được nối lại khi khoảng cách dòng và căn trái cho thấy chúng thuộc cùng đoạn. Terminal in timing `capture`, `ocr`, `translate` và `total` sau mỗi scan.

## Hệ tọa độ

Electron cung cấp bounds theo CSS/DIP. Screenshot và bbox OCR dùng pixel vật lý. Main process chuyển đổi qua `display.scaleFactor`, đồng thời hoàn tác hệ số upscale Jimp trước khi gửi tọa độ về renderer.

Vì toolbar không nằm trong vùng OCR, tọa độ `y` của patch được cộng lại `TOOLBAR_HEIGHT` trước khi render.

## Quyết định thiết kế quan trọng

### Khóa sau khi dịch và live an toàn

Chế độ mặc định quét một lần, khóa kết quả và yêu cầu refresh có kiểm soát. Trên macOS, ScreenCaptureKit chọn display và loại trừ các cửa sổ của chính app, nên chế độ live có thể quét lặp mà không đưa patch bản dịch trở lại OCR. Nếu helper không build hoặc lỗi runtime, app quay về chế độ khóa.

Nếu overlay vẫn xuất hiện trong screenshot, OCR liên tục sẽ đọc lại bản dịch và tạo vòng lặp. Nếu bật `setContentProtection(true)`, screenshot của người dùng lại mất filter. Phiên bản hiện tại giải quyết bằng cách quét một lần, khóa kết quả và yêu cầu refresh có kiểm soát.

### Dịch theo paragraph

Dịch từng dòng giúp map layout dễ hơn nhưng làm mất ngữ cảnh. OSLT gộp các dòng cùng paragraph để dịch, sau đó dùng bbox bao toàn đoạn. Điều này giữ ngữ cảnh tốt hơn nhưng có thể để lại khoảng trống nếu bản dịch ngắn hơn đáng kể.

### Endpoint không chính thức

Prototype dùng `translate.googleapis.com/translate_a/single` để không yêu cầu API key. Một bản production nên trừu tượng hóa translator và hỗ trợ API chính thức như Google Cloud Translation hoặc DeepL.

## Hướng phát triển

- Adapter cho nhiều dịch vụ dịch.
- Worker thread cho OCR.
- Cache theo hash ảnh để bỏ qua OCR khi vùng nguồn không đổi (hiện đã có cache dịch theo paragraph).
- Hỗ trợ multi-monitor chính xác hơn.
- Phát hiện font family, weight, màu và alignment.
- Bộ cài ký số cho macOS, Windows và Linux.
- Unit test cho paragraph splitting, coordinate conversion và state machine.
