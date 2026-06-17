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
};
