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

---

## I. Tích hợp Giao Hàng Nhanh (GHN)

> Tích hợp này gồm 3 lớp: **(1) chạy migration SQL** để DB có cột GHN
> · **(2) deploy Edge Function** `ghn-proxy` (proxy bảo mật — token GHN
> KHÔNG nằm ở frontend) · **(3) cấu hình shop origin** trong DB.
> Sau khi xong, checkout sẽ tự tính phí ship thật theo địa chỉ, admin có
> nút "Tạo đơn GHN" trong từng đơn.

### Bước 1 — Đăng ký tài khoản GHN
1. Vào https://5sao.ghn.dev → **Đăng ký doanh nghiệp** (cần MST hoặc CCCD).
2. Sau khi kích hoạt → vào https://khachhang.ghn.vn → **Cài đặt → Cấu hình API**.
3. Copy 2 giá trị:
   - **Token** (1 chuỗi UUID dài, ví dụ `4a1f...`)
   - **ShopID** (số nguyên, ví dụ `12345` — tương ứng kho lấy hàng).

> **Test trước khi production:** GHN có môi trường dev tại
> `dev-online-gateway.ghn.vn`. Token & ShopID dev khác prod. Set
> `GHN_ENV=dev` để dùng sandbox (xem Bước 3).

### Bước 2 — Chạy migration SQL
Mở Supabase Dashboard → **SQL Editor** → **New query** → dán toàn bộ nội
dung `supabase/migration-ghn.sql` → Run.

Migration sẽ tạo:
- Cột `ghn_order_code`, `ghn_status`, `ghn_fee`… trên bảng `orders`.
- Bảng `ghn_address_map` (cache mapping địa chỉ VN ↔ GHN ID).
- Bảng `ghn_tracking_events` (timeline tracking).
- RPC `get_tracking_by_code(p_code)` để khách tra cứu (chưa dùng v1).
- 1 dòng `ghn_config` mặc định trong `site_settings`.

### Bước 3 — Deploy Edge Function `ghn-proxy`
Cần Supabase CLI (https://supabase.com/docs/guides/cli):
```bash
# Lần đầu: link project local với project Supabase
supabase link --project-ref kpwofxgnurgfjnigsdea   # <project-ref> trong URL

# Deploy function (--no-verify-jwt vì frontend gọi với cả anon key)
supabase functions deploy ghn-proxy --no-verify-jwt

# Set secrets (token sẽ chỉ ở Supabase, không bao giờ lộ ra frontend)
supabase secrets set \
  GHN_TOKEN=<token-từ-GHN> \
  GHN_SHOP_ID=<shop-id> \
  GHN_ENV=prod
```

> `GHN_ENV=dev` ➜ trỏ sang sandbox. Khi sẵn sàng go-live: đổi sang `prod`
> và set lại token/shop-id của tài khoản chính thức.

### Bước 4 — Cấu hình shop origin (kho gửi hàng)
Vào Supabase Dashboard → **Table Editor → site_settings** → tìm dòng
`key = "ghn_config"` → cột `value` (JSONB) → bấm Edit và sửa:

```json
{
  "enabled": true,
  "shop_id": 12345,
  "from_name": "VOISTUDIO",
  "from_phone": "0987xxxxxx",
  "from_address": "Số 1, Đường ABC, Phường XYZ",
  "from_district_id": 1542,
  "from_ward_code": "21211",
  "from_province_name": "Hà Nội",
  "from_district_name": "Quận Cầu Giấy",
  "from_ward_name": "Phường Dịch Vọng",
  "default_weight": 300,
  "default_length": 25,
  "default_width": 20,
  "default_height": 5,
  "service_type_id": 2,
  "payment_type_id": 2,
  "required_note": "KHONGCHOXEMHANG"
}
```

**Cách tìm `from_district_id` và `from_ward_code`** (GHN dùng ID nội bộ
của họ, KHÔNG phải mã của Bộ Nội vụ):
- Mở terminal, gọi edge function với action `master`:
  ```bash
  curl -X POST https://kpwofxgnurgfjnigsdea.supabase.co/functions/v1/ghn-proxy \
    -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
    -H "Content-Type: application/json" \
    -d '{"action":"master","type":"province"}'
  ```
- Tìm `ProvinceID` của tỉnh shop → lặp lại với `type=district` (kèm
  `province_id`) → rồi `type=ward` (kèm `district_id`).
- Điền `ProvinceID`/`DistrictID`/`WardCode` vào JSON tương ứng.

> **Mẹo:** tạm thời để `from_district_id = 1542`, `from_ward_code = "21211"`
> (Cầu Giấy, HN — kho mẫu của GHN trong docs) để test thử trước, rồi mới
> điền địa chỉ thật.

### Các giá trị quan trọng cần biết
| Field | Giá trị | Ý nghĩa |
|---|---|---|
| `service_type_id` | `2` | Chuẩn (Standard). `1` = Express |
| `payment_type_id` | `2` | Người nhận trả phí. `1` = Shop trả |
| `required_note` | `KHONGCHOXEMHANG` | Khách KHÔNG được xem hàng. Khác: `CHOXEMHANGKHONGTHU`, `CHOTHUHANG` |
| `default_weight` | `300` (g) | Cân nặng mặc định 1 đơn |

### Bước 5 — Test
1. Refresh trang giỏ hàng → chọn đủ địa chỉ 3 cấp (mode "old") → dòng
   "Phí giao hàng" sẽ đổi từ `30.000đ` (flat) → giá thật từ GHN, kèm
   nhãn `(GHN)`. Nếu vẫn flat: mở DevTools → Console xem log lỗi.
2. Đặt 1 đơn test → vào `/admin` → mở đơn → bấm **"Tạo đơn GHN"** →
   GHN sẽ trả về mã vận đơn → click **↗ Tracking** xem trạng thái thật.
3. Bấm **"↻ Cập nhật trạng thái"** để pull status mới nhất.

### Lưu ý vận hành
- **Phí ship hiển thị cho khách** = phí GHN tính được, KHÔNG có ngưỡng
  freeship 500k nữa (vì giá đã thật). Muốn giữ freeship: set
  `GHN.enabled = false` tạm thời trong `ghn-client.js`, hoặc sửa logic
  `recomputeShipping` trong `assets/app.js`.
- **Đơn mode "new" (2-cấp)**: vì GHN vẫn dùng 3-cấp, các đơn này sẽ
  giữ flat fee. Admin push thủ công, edge function tự resolve dựa trên
  tên xã.
- **Webhook** (cập nhật status tự động khi GHN giao hàng) chưa làm ở v1.
  Tạm thời admin bấm "↻ Cập nhật trạng thái" để pull. Webhook GHN sẽ
  POST sang `https://<project>.supabase.co/functions/v1/ghn-webhook` —
  cần thêm 1 edge function nữa nếu muốn realtime.
- **Cache mapping địa chỉ**: lần đầu tính phí cho 1 xã sẽ chậm (~500ms)
  vì call 3 API GHN. Sau đó cache trong `ghn_address_map` → các lần
  sau gần như tức thời.
- **Bảo mật token**: `GHN_TOKEN` nằm trong Supabase secrets, frontend
  CHỈ thấy URL function. Ai cũng có thể gọi action `fee` (an toàn —
  GHN không tính tiền cho query), nhưng `create`/`cancel` yêu cầu JWT
  admin (verify trong edge function).
