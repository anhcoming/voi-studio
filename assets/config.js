/* =========================================================
   CẤU HÌNH — dán key Supabase của bạn vào đây
   ---------------------------------------------------------
   • Để TRỐNG 2 dòng URL/KEY  ➜ web chạy "chế độ demo" (lưu trên máy, 1 trình duyệt).
   • Dán đủ URL + ANON KEY     ➜ web chạy "thật": admin & khách dùng chung dữ liệu,
                                  đồng bộ nhiều thiết bị, admin đăng nhập bằng Google.
   Xem hướng dẫn từng bước trong file SETUP.md
   ========================================================= */
window.CONFIG = {
  SUPABASE_URL: "https://kpwofxgnurgfjnigsdea.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_qxPt87OkBlbKZppKFC4PgA_FX5GE2Vv",

  // Chỉ những email này mới vào được trang admin (đăng nhập Google)
  ADMIN_EMAILS: ["anhcoming@gmail.com"],

  STORE_NAME: "VOISTUDIO",
  IMAGE_BUCKET: "product-images",

  /* ---------- GỬI EMAIL XÁC NHẬN ĐƠN HÀNG (EmailJS) ----------
     Để TRỐNG cả 3 trường ➜ tính năng tự tắt (đơn vẫn lưu email khách).
     Cách bật (miễn phí, ~5 phút):
       1. https://www.emailjs.com → Sign up → Add Email Service (Gmail/Outlook) → copy SERVICE ID.
       2. Email Templates → Create New Template với các biến:
            {{to_email}} {{to_name}} {{order_code}} {{order_total}}
            {{order_items}} {{order_address}} {{tracking_url}} {{store_name}}
          → Save → copy TEMPLATE ID.
       3. Account → General → copy PUBLIC KEY.
       4. Dán 3 giá trị vào dưới đây. Xem mẫu template trong SETUP.md (mục H).
  --------------------------------------------------------- */
  EMAILJS_PUBLIC_KEY:  "D5Aq7Zj2uTal-Uw1K",
  EMAILJS_SERVICE_ID:  "service_up6f2px",
  EMAILJS_TEMPLATE_ID: "template_op0rvmq",
};
