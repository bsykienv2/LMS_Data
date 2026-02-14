
# Hướng dẫn triển khai hệ thống LMS

Dự án này bao gồm 2 phần:
1. **Frontend**: Ứng dụng Web viết bằng React (Vite).
2. **Backend**: API xử lý dữ liệu viết bằng Google Apps Script (GAS) kết nối với Google Sheets.

---

## Phần 1: Triển khai Backend (Google Apps Script)

Đây là nơi chứa dữ liệu và xử lý logic của hệ thống. Bạn không cần cài đặt server, chỉ cần tài khoản Google.

### Bước 1: Tạo dự án
1. Truy cập [script.google.com](https://script.google.com/).
2. Chọn **Dự án mới (New Project)**.
3. Đổi tên dự án thành **"LMS Backend"**.

### Bước 2: Cài đặt mã nguồn
Tạo các file script trong dự án và copy nội dung tương ứng từ mã nguồn cung cấp:

- **Code.gs**: File chính xử lý API.
- **Database.gs**: Xử lý đọc/ghi Google Sheets.
- **Auth.gs**: Xử lý đăng nhập, xác thực.
- **ExamService.gs**: Xử lý logic thi cử (đề thi, nộp bài).
- **StatsService.gs**: Xử lý thống kê báo cáo.

### Bước 3: Triển khai (Deploy)
1. Nhấn nút **Triển khai (Deploy)** > **Tùy chọn triển khai mới (New deployment)**.
2. Chọn loại: **Ứng dụng web (Web app)**.
3. Cấu hình như sau (BẮT BUỘC):
   - **Thực thi dưới dạng (Execute as)**: `Tôi (Me)`.
   - **Ai có quyền truy cập (Who has access)**: `Bất kỳ ai (Anyone)`.
4. Nhấn **Triển khai**.

### Bước 4: Cấp quyền
Lần đầu tiên, Google sẽ yêu cầu cấp quyền truy cập vào Drive/Sheets của bạn.
1. Chọn tài khoản Google.
2. Nhấn **Nâng cao (Advanced)** > **Đi tới LMS Backend (không an toàn)**.
3. Nhấn **Cho phép (Allow)**.

### Bước 5: Khởi tạo Database
1. Copy **URL ứng dụng web** (có dạng `.../exec`).
2. Mở trình duyệt, dán URL và thêm đuôi `?action=setup`.
   - Ví dụ: `https://script.google.com/macros/s/XXXX/exec?action=setup`
3. Nếu thấy thông báo `success: true`, Database (File Sheet) đã được tạo trong Google Drive của bạn.

---

## Phần 2: Kiểm tra API

Bạn có thể kiểm tra API hoạt động bằng trình duyệt hoặc Postman:

**1. Kiểm tra thống kê (Admin)**
- URL: `[SCRIPT_URL]?action=STATS_ADMIN&token=[TOKEN_ADMIN]`
- *(Token lấy trong sheet USERS sau khi đăng nhập, hoặc tạm thời bỏ qua checkAuth trong code để test)*

**2. Đăng nhập**
- Method: `POST`
- URL: `[SCRIPT_URL]`
- Body (JSON):
  ```json
  {
    "action": "login",
    "data": {
      "username": "admin",
      "password": "1"
    }
  }
  ```

Chúc bạn thành công!
