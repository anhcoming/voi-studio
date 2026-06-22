# VOISTUDIO — Hướng dẫn cài đặt

Website gồm **2 phần dùng chung 1 dữ liệu**:

- **Cửa hàng (khách):** `index.html`, `collection.html`, `product.html`, `cart.html`, `order.html`
- **Trang quản trị (admin):** `admin/index.html`

Web chạy ở **2 chế độ**, tự nhận biết qua file `assets/config.js`:

| | Chế độ DEMO (mặc định) | Chế độ THẬT (Supabase) |
|---|---|---|
| Cấu hình | Không cần gì | Dán URL + key Supabase |
| Lưu dữ liệu | localStorage (1 trình duyệt) | Cloud, đồng bộ mọi thiết bị |
| Admin & khách khác máy thấy chung? | ❌ Không | ✅ Có |
| Đăng nhập admin | Nút "đăng nhập demo" | Google thật (chỉ email admin) |
| Upload ảnh | Lưu tạm trong trình duyệt | Lưu trên Supabase Storage |

---

## A. Xem thử ngay (chế độ demo)

1. Mở `index.html` bằng trình duyệt → mua hàng, đặt đơn, nhận **mã đơn**.
2. Mở `order.html` → nhập mã để xem trạng thái.
3. Mở `admin/index.html` → bấm đăng nhập (demo) → vào quản trị, bấm **"Nhập dữ liệu mẫu"** để có 30 sản phẩm, thử đổi trạng thái đơn, thêm/sửa sản phẩm.

> Demo chỉ lưu trên đúng trình duyệt đó. Để admin và khách (máy khác) dùng chung, làm tiếp phần B.

---

## B. Bật chế độ THẬT với Supabase (miễn phí)

### Bước 1 — Tạo project
1. Vào https://supabase.com → đăng ký → **New project** (chọn region Singapore cho nhanh).
2. Đặt mật khẩu database (lưu lại), bấm tạo, đợi ~2 phút.

### Bước 2 — Tạo bảng dữ liệu
1. Mở **SQL Editor** → **New query**.
2. Mở file `supabase/schema.sql`, copy toàn bộ, dán vào, bấm **Run**.
   - Nếu email admin của bạn KHÁC `anhcoming@gmail.com`, sửa email đó trong phần `is_admin()` của file trước khi chạy.
3. Mở file `supabase/migration-user-orders.sql`, copy toàn bộ, **New query** → dán → **Run**.
   - File này thêm cột `user_id` vào bảng `orders` để gắn đơn với tài khoản Google của khách (xem mục G).
4. Mở file `supabase/migration-order-email.sql`, copy toàn bộ, **New query** → dán → **Run**.
   - File này thêm cột `email` vào bảng `orders` để lưu email khách & gửi xác nhận (xem mục H).

### Bước 3 — Lấy khoá API và dán vào web
1. Trong Supabase: **Project Settings → API**.
2. Copy **Project URL** và **anon public key**.
3. Mở `assets/config.js`, điền:
   ```js
   SUPABASE_URL: "https://xxxx.supabase.co",
   SUPABASE_ANON_KEY: "eyJhbGciOi....",
   ADMIN_EMAILS: ["anhcoming@gmail.com"],
   ```
   > anon key để công khai là **bình thường** — dữ liệu được bảo vệ bằng RLS trong SQL.

### Bước 4 — Bật đăng nhập Google (cho cả admin & khách)
1. Supabase: **Authentication → Providers → Google → Enable**.
2. Tạo OAuth ở Google Cloud (https://console.cloud.google.com):
   - APIs & Services → Credentials → **Create OAuth client ID** → Web application.
   - **Authorized redirect URI**: dán đúng dòng Supabase hiện ở mục Google provider, dạng
     `https://xxxx.supabase.co/auth/v1/callback`
   - Copy **Client ID** + **Client Secret** dán ngược lại vào Supabase, Save.
3. Supabase: **Authentication → URL Configuration** → đặt **Site URL** = địa chỉ web của bạn (xem Bước 5) và thêm vào **Redirect URLs**.

> Cùng 1 cấu hình Google này dùng cho cả admin (vào `/admin/`) và khách (icon user ở header). Email trong `ADMIN_EMAILS` được nhận quyền admin; email khác là khách thường.

### Bước 5 — Đưa web lên mạng (bắt buộc cho Google login)
Đăng nhập Google **không chạy được khi mở file trực tiếp** (`file://`) — cần địa chỉ http/https. Chọn 1 cách miễn phí:

- **Netlify Drop** (dễ nhất): vào https://app.netlify.com/drop → kéo-thả cả thư mục `originals-store` → có link ngay.
- **Vercel** hoặc **GitHub Pages** cũng được.
- Hoặc chạy thử tại máy: mở terminal trong thư mục, chạy `python -m http.server 8000` rồi vào `http://localhost:8000` (nhớ thêm địa chỉ này vào Redirect URLs ở Bước 4).

### Bước 6 — Khởi tạo dữ liệu
Vào `…/admin/` → đăng nhập Google (đúng email admin) → bấm **"Nhập dữ liệu mẫu"** (hoặc tự thêm sản phẩm). Xong! Khách vào cửa hàng sẽ thấy sản phẩm, đặt hàng; bạn quản lý đơn ở admin.

---

## C. Dùng trang admin

- **Đơn hàng:** xem danh sách, lọc theo trạng thái, đổi trạng thái (Chờ xác nhận → Đã xác nhận → Đang giao → Hoàn thành / Đã huỷ), bấm **Xem** để xem chi tiết. Khách dùng mã đơn để tự tra ở `order.html` — trạng thái cập nhật theo bạn.
- **Sản phẩm:** Thêm/Sửa/Xoá, đặt **tồn kho** (hết hàng tự khoá nút mua), **upload ảnh** (nếu không có ảnh, hệ thống tự vẽ ảnh áo theo màu), bật/tắt hiển thị.

## D. Đổi thương hiệu
- Tên, hotline, email, danh sách email admin: sửa trong `assets/config.js` và `assets/data.js` (khối `BRAND`).
- Màu sắc, font: sửa trong `assets/styles.css` (phần `:root`).

## E. Cấu trúc thư mục
```
originals-store/
├─ index.html, collection.html, product.html, cart.html, order.html
├─ admin/        → index.html, admin.js, admin.css   (trang quản trị)
├─ assets/       → config.js, data.js, store-api.js, app.js, styles.css
└─ supabase/     → schema.sql + migration-user-orders.sql + migration-order-email.sql   (chạy lần đầu trên Supabase)
```

## F. Bảo mật
- Chỉ email trong `ADMIN_EMAILS` **và** trong hàm `is_admin()` (SQL) mới sửa được sản phẩm/đơn.
- Khách chỉ tra được đơn nếu có **đúng mã đơn** (không xem được đơn người khác).
- Khách đã đăng nhập Google chỉ xem được đơn có `user_id = chính mình` (RLS `orders read self`).
- RLS insert chống spoof: khách ẩn danh chỉ đặt được đơn với `user_id = null`; khách đăng nhập chỉ gắn được `user_id` của chính họ.
- Muốn thêm admin: thêm email vào cả `config.js` và `is_admin()` rồi chạy lại đoạn `is_admin` trong SQL.

## I. Mirror ảnh lên Cloudinary (chống mất ảnh khi Supabase pause)

Supabase free pause project sau ~1 tuần không request → URL ảnh public trả 4xx và "mất ảnh" trên web. Để chống tình huống này, mỗi ảnh admin upload được **lưu song song** lên Cloudinary (mirror). Khi browser khách load ảnh chính (Supabase) lỗi, tự đổi sang URL Cloudinary trong tích tắc — khách không thấy ảnh vỡ.

- **Bật như thế nào:** điền 2 trường `CLOUDINARY_*` trong `assets/config.js`.
- **Để trống cả 2:** tính năng tự tắt — admin upload chỉ lên Supabase như cũ, không lỗi.
- **Miễn phí:** Cloudinary free 25 GB storage + 25 GB bandwidth/tháng, không pause project.

### Bước 1 — Tạo tài khoản Cloudinary
1. https://cloudinary.com → **Sign Up Free**.
2. Vào **Dashboard** → copy **Cloud name** (dạng `dxxxxxxx`).

### Bước 2 — Tạo Unsigned Upload Preset
1. **Settings (icon bánh răng) → Upload → Upload presets → Add upload preset**.
2. Đặt **Signing Mode = Unsigned** (để upload thẳng từ browser admin, không cần backend).
3. Đặt **Preset name** tuỳ chọn (ví dụ `voistudio`) — đây là chuỗi sẽ dán vào config.
4. (Khuyến nghị) Trong tab **Storage and access** bật **Use filename or externally defined Public ID** — đảm bảo mirror trùng tên với Supabase để URL mirror derive đúng.
5. **Save**.

### Bước 3 — Dán vào `assets/config.js`
```js
CLOUDINARY_CLOUD_NAME:    "dxxxxxxx",
CLOUDINARY_UPLOAD_PRESET: "voistudio",
```

Refresh trang admin → vào edit 1 sản phẩm → upload thử 1 ảnh. Mở Console (F12) nếu thấy log `[mirror] Cloudinary upload failed` thì preset/cloud name sai. Không log = mirror chạy ngon. Vào Cloudinary → Media Library kiểm tra file vừa upload có nằm trong account của bạn không.

### Test fallback
Tạm pause project Supabase (Settings → General → Pause) → reload trang khách → ảnh vẫn hiện (load mirror Cloudinary thông qua handler `error` trong `assets/store-api.js`). Bấm Restore khi xong.

### Lưu ý
- Mirror chỉ chạy cho ảnh upload **sau khi bật**. Ảnh đã có trước đó chỉ tồn tại trên Supabase; muốn migrate ngược về Cloudinary phải tự download + upload lại qua dashboard.
- Cloud name + upload preset để công khai là **bình thường** — preset unsigned chỉ cho phép upload (không xoá/list), và Cloudinary có thể giới hạn theo domain ở **Settings → Security → Allowed strict referral/Upload referral list**, nhớ whitelist domain web để tránh bị lạm dụng.

---

## H. Gửi email xác nhận đơn hàng (EmailJS)

Khi khách đặt hàng xong, web tự gửi email xác nhận (mã đơn, sản phẩm, tổng tiền, link tra cứu) về địa chỉ khách nhập trong form checkout.

- **Bật như thế nào:** thực hiện 4 bước dưới rồi dán 3 key vào `assets/config.js`.
- **Để trống 3 key:** tính năng tự tắt — đơn vẫn đặt được, email vẫn lưu vào DB, chỉ không gửi mail.
- **Miễn phí:** EmailJS free tier 200 email/tháng — đủ dùng cho shop nhỏ.

### Bước 1 — Tạo tài khoản EmailJS
1. Vào https://www.emailjs.com → **Sign up** (Google login cũng được).
2. **Email Services → Add New Service** → chọn Gmail/Outlook/SMTP của bạn (làm theo hướng dẫn xác thực).
3. Copy **Service ID** (dạng `service_xxxxxxx`).

### Bước 2 — Tạo template email
1. **Email Templates → Create New Template**.
2. **Subject:** `Xác nhận đơn hàng {{order_code}} — {{store_name}}`
3. **To Email:** `{{to_email}}` (rất quan trọng — nếu để trống email sẽ gửi về chính bạn).
4. **Content (HTML):** dán mẫu dưới, sửa lại theo gu thương hiệu:
   ```html
   <p>Chào {{to_name}},</p>
   <p>Cảm ơn bạn đã đặt hàng tại <b>{{store_name}}</b>! Đơn của bạn đã được ghi nhận:</p>
   <p>
     <b>Mã đơn:</b> {{order_code}}<br>
     <b>Tổng cộng:</b> {{order_total}} (tạm tính {{order_subtotal}} + giao hàng {{order_shipping}})
   </p>
   <p><b>Sản phẩm:</b></p>
   <pre style="font-family:inherit;white-space:pre-wrap">{{order_items}}</pre>
   <p>
     <b>Giao tới:</b> {{to_name}} · {{order_phone}}<br>
     {{order_address}}<br>
     <i>{{order_note}}</i>
   </p>
   <p>Tra cứu trạng thái đơn: <a href="{{tracking_url}}">{{tracking_url}}</a></p>
   <p>Thân, đội ngũ {{store_name}}.</p>
   ```
5. **Save** → copy **Template ID** (dạng `template_xxxxxxx`).

### Bước 3 — Lấy Public Key
1. **Account → General** → copy **Public Key**.

### Bước 4 — Dán vào `assets/config.js`
```js
EMAILJS_PUBLIC_KEY:  "xxxxxxxxxxxxxxxx",
EMAILJS_SERVICE_ID:  "service_xxxxxxx",
EMAILJS_TEMPLATE_ID: "template_xxxxxxx",
```

> Lưu xong refresh web → đặt thử 1 đơn → check hộp thư (cả Spam) để chắc chắn template hoạt động.

### Lưu ý
- Email khách được **lưu vào DB** (cột `orders.email`) → bạn vẫn có địa chỉ để gửi lại nếu EmailJS lỗi. Nhớ chạy `supabase/migration-order-email.sql` (bước B2).
- Free tier giới hạn 200 email/tháng & 50 KB/email. Vượt thì nâng cấp gói hoặc thay bằng dịch vụ khác (Resend/SendGrid qua Supabase Edge Function).
- Public Key để công khai là **bình thường** — EmailJS giới hạn theo domain ở dashboard (mục **Account → Security**), nhớ whitelist domain web của bạn để tránh bị lạm dụng.

---

## G. Tài khoản khách (Google login)
- **Bật như thế nào:** chạy bước 4 (Google provider) — config dùng chung cả admin & khách.
- **Khách dùng:** bấm icon user ở header → "Đăng nhập Google". Sau khi đăng nhập, mọi đơn đặt sẽ tự gắn với account.
- **Lịch sử đơn:** vào `order.html` (hoặc menu user → "Đơn của tôi") — danh sách đơn của user đó, đồng bộ trên mọi thiết bị.
- **Vẫn cho phép guest checkout:** khách không cần đăng nhập vẫn đặt được đơn (nhận mã `OR…` để tra cứu sau).
- **Prefill:** modal checkout tự điền tên (từ Google) và SĐT/địa chỉ từ lần đặt gần nhất trên máy.
- **Chỉ chạy được ở chế độ cloud** — chế độ demo (`localStorage`) chỉ giả lập một user "Khách Demo" để xem UI.
