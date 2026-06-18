/* =========================================================
   ORIGINALS — Dữ liệu cửa hàng (demo)
   ➜ Đổi brand / sản phẩm / giá ngay trong file này.
   ========================================================= */

const BRAND = {
  name: "VOISTUDIO",          // tên thương hiệu (đổi tại đây)
  tagline: "Be Bold · Be New · Be Original",
  hotline: "0900 000 000",
  email: "hello@voistudio.vn",
  hours: "Thứ 2 – Thứ 7 · 08:00 – 17:30",
};

/* Danh mục theo loại sản phẩm */
const CATEGORIES = [
  { key: "ao-thun",  name: "Áo Thun Relaxed Fit", type: "tee" },
  { key: "ba-lo",    name: "Áo Ba Lỗ",            type: "tank" },
  { key: "ringer",   name: "Áo Thun Ringer",      type: "ringer" },
  { key: "polo",     name: "Áo Polo Relaxed Fit", type: "polo" },
  { key: "dai-tay",  name: "Áo Thun Dài Tay",     type: "long" },
  { key: "hoodie",   name: "Áo Hoodie",           type: "hoodie" },
  { key: "sweater",  name: "Áo Sweater",          type: "sweater" },
  { key: "jogger",   name: "Quần Jogger",         type: "pants" },
  { key: "tote",     name: "Túi Tote",            type: "tote" },
];

/* Bộ sưu tập theo chủ đề */
const COLLECTIONS = [
  "Summer Vibes","Vintage Vibes","Old Money","Galactic Odyssey",
  "Coffee Club","Racer Core","Ocean Calling","Animal Mood",
  "Built Different","Teddy Land",
];

/* Bảng màu vải */
const C = {
  white:"#f0ede6", black:"#1c1c1c", cream:"#e7ddca", sage:"#9fb088",
  sky:"#a7c4db", mustard:"#d8a441", brick:"#b5523a", navy:"#2c3a4f",
  sand:"#cbb89d", olive:"#6f7445", pink:"#e0b1b6", grey:"#b6b6b0",
  forest:"#3f5c46", maroon:"#6e2f33",
};

/* ---------- DANH SÁCH SẢN PHẨM ---------- */
const PRODUCTS = [
  // ÁO THUN
  p("ao-thun","Coffee Club","Người Thích Uống Pour Over","POUR OVER", 165000,318000,[C.cream,C.black,C.sage],true),
  p("ao-thun","Coffee Club","Monday Loading","MONDAY LOADING", 165000,318000,[C.white,C.navy,C.mustard],true),
  p("ao-thun","Coffee Club","Nghiện Cà Phê Phin","CÀ PHÊ PHIN", 165000,318000,[C.black,C.cream],true),
  p("ao-thun","Vintage Vibes","Retro Sunset 95","SUNSET '95", 165000,318000,[C.sand,C.brick,C.navy],true),
  p("ao-thun","Old Money","Timeless Legacy","LEGACY", 165000,318000,[C.cream,C.forest],false),
  p("ao-thun","Built Different","Off The Limits","OFF LIMITS", 165000,318000,[C.black,C.olive,C.white],true),
  p("ao-thun","Galactic Odyssey","Lost In Space","GALACTIC", 165000,318000,[C.navy,C.black],true),
  p("ao-thun","Animal Mood","Lazy Dachshund","LAZY DOG", 165000,318000,[C.mustard,C.cream],false),

  // ÁO BA LỖ
  p("ba-lo","Racer Core","Run Fast","RUN FAST", 165000,318000,[C.white,C.black,C.brick],true),
  p("ba-lo","Racer Core","We Run The Distance","DISTANCE", 165000,318000,[C.black,C.sage],true),
  p("ba-lo","Summer Vibes","Beach More Worry Less","BEACH MODE", 165000,318000,[C.sky,C.cream,C.mustard],true),
  p("ba-lo","Summer Vibes","Let's Go Beach","LET'S GO", 165000,318000,[C.sand,C.sky],false),

  // RINGER
  p("ringer","Ocean Calling","Ocean Lovers","OCEAN LOVERS", 169000,338000,[C.white,C.navy],true),
  p("ringer","Ocean Calling","Crabby Days","CRABBY DAYS", 169000,338000,[C.cream,C.brick],true),
  p("ringer","Summer Vibes","Mentally On The Beach","ON THE BEACH", 169000,338000,[C.white,C.sky],true),

  // POLO
  p("polo","Old Money","Timeless Legacy","O.M.", 179000,350000,[C.cream,C.navy,C.forest],true),
  p("polo","Vintage Vibes","Red Heart","♥ VINTAGE", 179000,350000,[C.white,C.maroon],false),
  p("polo","Animal Mood","POR Dachshund","DACHSHUND", 179000,350000,[C.sage,C.cream],true),

  // DÀI TAY
  p("dai-tay","Vintage Vibes","Faded Memories","FADED", 199000,390000,[C.sand,C.navy,C.black],true),
  p("dai-tay","Galactic Odyssey","Moon Walker","MOON WALKER", 199000,390000,[C.black,C.navy],true),

  // HOODIE
  p("hoodie","Built Different","Stay Original","STAY ORIGINAL", 359000,590000,[C.black,C.cream,C.olive],true),
  p("hoodie","Old Money","Heritage Club","HERITAGE", 359000,590000,[C.navy,C.grey],true),
  p("hoodie","Teddy Land","Teddy Bear Hug","TEDDY", 359000,590000,[C.cream,C.brick],false),

  // SWEATER
  p("sweater","Old Money","Country Club","COUNTRY CLUB", 329000,550000,[C.cream,C.forest,C.navy],true),
  p("sweater","Teddy Land","Cozy Teddy","COZY", 329000,550000,[C.sand,C.pink],true),

  // JOGGER
  p("jogger","Built Different","Daily Jogger","VOISTUDIO", 289000,450000,[C.black,C.grey,C.olive],true),
  p("jogger","Racer Core","Track Pants","TRACK", 289000,450000,[C.navy,C.black],false),

  // TÚI TOTE
  p("tote","Animal Mood","Banana Puppy","BANANA PUPPY", 135000,225000,[C.cream],true),
  p("tote","Vintage Vibes","Retro Leopard","RETRO", 135000,225000,[C.sand],true),
  p("tote","Built Different","Not Lazy","NOT LAZY", 135000,225000,[C.white],true),
];

/* ---------- HÀM TẠO SẢN PHẨM ---------- */
function p(catKey, collection, name, print, price, compare, colors, sale){
  const cat = CATEGORIES.find(c => c.key === catKey);
  const slug = slugify(cat.name + "-" + name);
  return {
    id: slug,
    catKey, type: cat.type, catName: cat.name,
    collection,
    name: cat.name + " " + name,
    shortName: name,
    print,
    price, compare,
    colors,
    sizes: cat.type === "tote" ? ["Freesize"] : ["S","M","L","XL","2XL"],
    stock: 50,
    image_url: null,
    active: true,
    sale: !!sale,
  };
}

function slugify(s){
  return s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g,"")
    .replace(/đ/g,"d")
    .replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
}

/* ---------- FORMAT GIÁ (VND) ---------- */
function formatVND(n){
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "₫";
}
function discountPct(price, compare){
  if(!compare || compare<=price) return 0;
  return Math.round((1 - price/compare) * 100);
}

/* ---------- HELPER MÀU ---------- */
function shade(hex, amt){ // amt<0 tối hơn, >0 sáng hơn
  let n = parseInt(hex.slice(1),16);
  let r=(n>>16)&255, g=(n>>8)&255, b=n&255;
  r=Math.max(0,Math.min(255,r+amt));
  g=Math.max(0,Math.min(255,g+amt));
  b=Math.max(0,Math.min(255,b+amt));
  return "#"+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}
function luminance(hex){
  let n=parseInt(hex.slice(1),16);
  return (((n>>16)&255)*0.299 + ((n>>8)&255)*0.587 + (n&255)*0.114)/255;
}

/* ---------- TẠO ẢNH SVG SẢN PHẨM ---------- */
/* type: tee|tank|ringer|polo|long|hoodie|sweater|pants|tote */
function productSVG(prod, opts={}){
  const color = opts.color || prod.colors[0];
  const type  = prod.type;
  const back  = !!opts.back;
  const seed  = opts.seed || 0;
  const dark  = shade(color,-26);
  const light = shade(color, 18);
  const isLight = luminance(color) > 0.6;
  const ink   = isLight ? "#2a2a2a" : "#f4f1ea";
  const bgA = ["#f6f5f2","#efece6","#f1f0ec","#eceae4"][seed % 4];
  const bgB = ["#e9e7e1","#e6e2d9","#e7e5df","#e2dfd7"][seed % 4];
  const ringer = type==="ringer";
  const collar = ringer ? dark : color;

  const print = back ? "" : `
    <g text-anchor="middle" fill="${ink}" font-family="Archivo, sans-serif" font-weight="800">
      <text x="200" y="252" font-size="34" letter-spacing="1">${escapeXML(prod.print)}</text>
      <text x="200" y="282" font-size="12" letter-spacing="5" opacity=".7">${escapeXML(prod.collection.toUpperCase())}</text>
    </g>`;

  let body = "";
  if(type==="tank"){
    body = `<path d="M168 100 C150 140 150 150 150 205 L150 425 L250 425 L250 205 C250 150 250 140 232 100 C215 132 185 132 168 100 Z" fill="${color}" stroke="${dark}" stroke-width="2"/>`;
  } else if(type==="pants"){
    body = `
      <path d="M150 95 L250 95 L256 220 L236 430 L210 430 L200 250 L190 430 L164 430 L144 220 Z" fill="${color}" stroke="${dark}" stroke-width="2"/>
      <rect x="150" y="95" width="100" height="20" fill="${dark}" opacity=".55"/>
      <line x1="200" y1="118" x2="200" y2="250" stroke="${dark}" stroke-width="2" opacity=".4"/>`;
  } else if(type==="tote"){
    body = `
      <rect x="128" y="150" width="144" height="200" rx="6" fill="${color}" stroke="${dark}" stroke-width="2"/>
      <path d="M158 152 C158 110 192 110 192 152" fill="none" stroke="${dark}" stroke-width="7"/>
      <path d="M208 152 C208 110 242 110 242 152" fill="none" stroke="${dark}" stroke-width="7"/>`;
  } else {
    // các loại áo: tee / ringer / polo / long / hoodie / sweater
    const longSleeve = (type==="long"||type==="hoodie"||type==="sweater");
    const sleeveBottom = longSleeve ? 320 : 214;
    const sleeveOuter  = longSleeve ? 300 : 188;
    body = `<path d="M148 104 C168 124 232 124 252 104 L300 132 L322 ${sleeveOuter} L286 ${sleeveBottom} L262 ${longSleeve?300:196} L262 425 L138 425 L138 ${longSleeve?300:196} L114 ${sleeveBottom} L78 ${sleeveOuter} L100 132 Z" fill="${color}" stroke="${dark}" stroke-width="2"/>`;
    // chi tiết cổ
    if(type==="polo"){
      body += `
        <path d="M176 110 L200 150 L224 110 L214 104 C208 120 192 120 186 104 Z" fill="${light}" stroke="${dark}" stroke-width="2"/>
        <line x1="200" y1="150" x2="200" y2="200" stroke="${dark}" stroke-width="3"/>
        <circle cx="200" cy="168" r="2.6" fill="${dark}"/><circle cx="200" cy="186" r="2.6" fill="${dark}"/>`;
    } else if(ringer){
      body += `<path d="M170 108 C182 126 218 126 230 108" fill="none" stroke="${dark}" stroke-width="6"/>`;
      body += `<path d="M286 ${sleeveBottom} L262 ${196} " stroke="${dark}" stroke-width="6" fill="none"/>`;
    } else {
      body += `<path d="M172 108 C184 124 216 124 228 108" fill="none" stroke="${dark}" stroke-width="3" opacity=".5"/>`;
    }
    if(type==="hoodie"){
      body += `<path d="M150 106 C150 150 250 150 250 106 C246 150 240 168 200 170 C160 168 154 150 150 106 Z" fill="${dark}" opacity=".55"/>`;
      body += `<rect x="158" y="330" width="84" height="50" rx="8" fill="${dark}" opacity=".35"/>`;
      body += `<line x1="186" y1="150" x2="186" y2="186" stroke="${light}" stroke-width="3"/><line x1="214" y1="150" x2="214" y2="186" stroke="${light}" stroke-width="3"/>`;
    }
  }

  return `<svg viewBox="0 0 400 500" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXML(prod.name)}">
    <defs><linearGradient id="bg${seed}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${bgA}"/><stop offset="1" stop-color="${bgB}"/>
    </linearGradient></defs>
    <rect width="400" height="500" fill="url(#bg${seed})"/>
    <text x="32" y="56" font-family="Archivo, sans-serif" font-weight="900" font-size="15" fill="#c9c6bf" letter-spacing="2">${BRAND.name}</text>
    ${body}
    ${print}
    ${back? `<text x="200" y="250" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="900" font-size="13" fill="${ink}" opacity=".5" letter-spacing="3">${BRAND.name}</text>`:""}
  </svg>`;
}

function escapeXML(s){return (s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
/* safeColor: chỉ chấp nhận hex (#RGB / #RRGGBB / #RRGGBBAA) hoặc CSS named-color đơn giản.
   Mọi giá trị khác → trả về "#ccc" để chặn CSS injection qua style="background:${color}". */
function safeColor(c){
  c = (c==null?"":String(c)).trim();
  if(/^#[0-9a-f]{3,8}$/i.test(c)) return c;
  if(/^[a-z]{3,20}$/i.test(c)) return c;       // named-color đơn giản, không có dấu ; () "
  return "#ccc";
}

/* ---------- TRUY VẤN ---------- */
function getProduct(id){ return PRODUCTS.find(p=>p.id===id); }
function byCategory(key){ return PRODUCTS.filter(p=>p.catKey===key); }
function byCollection(name){ return PRODUCTS.filter(p=>p.collection===name); }

window.STORE = { BRAND, CATEGORIES, COLLECTIONS, C, PRODUCTS,
  formatVND, discountPct, productSVG, getProduct, byCategory, byCollection, slugify, safeColor };
