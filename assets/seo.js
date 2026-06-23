/* =========================================================
   SEO + ANALYTICS helper
   ---------------------------------------------------------
   • Set meta tags động per-page (title, description, OG, Twitter)
   • Render JSON-LD structured data (Schema.org Product / Organization)
   • Inject GA4 + FB Pixel + TikTok Pixel snippet nếu CONFIG có ID
   • Track page view + product view + add-to-cart + purchase events

   Cách dùng từ app.js:
     SEO.set({ title:"Áo Thun Black", description:"...", image:"..." });
     SEO.product(p);                      // schema.org Product + meta + view event
     SEO.trackAddToCart(p, qty);
     SEO.trackPurchase(order);
   ========================================================= */
(function(){
  const CFG = window.CONFIG || {};
  const BRAND_NAME = CFG.STORE_NAME || (window.STORE && window.STORE.BRAND && window.STORE.BRAND.name) || "Shop";
  const SITE_URL = CFG.SITE_URL || location.origin;

  /* ---------- Prerender helper ---------- */
  // Chrome prerender các trang được Speculation Rules đánh dấu. Trong khi
  // prerender, KHÔNG fire analytics (sẽ thành fake pageview/event). Chờ đến
  // khi document được "active" rồi mới chạy.
  function whenActive(fn){
    if(document.prerendering){
      document.addEventListener("prerenderingchange", fn, {once: true});
    } else {
      fn();
    }
  }

  /* ---------- META TAGS ---------- */
  function setMeta(opts={}){
    const title = opts.title ? `${opts.title} — ${BRAND_NAME}` : BRAND_NAME;
    const description = opts.description || `${BRAND_NAME} — local brand streetwear.`;
    const image = opts.image || (CFG.OG_DEFAULT_IMAGE || "");
    const url = opts.url || location.href;
    const type = opts.type || "website";

    document.title = title;
    upsertMeta("description", description, "name");
    upsertMeta("og:title", title);
    upsertMeta("og:description", description);
    upsertMeta("og:type", type);
    upsertMeta("og:url", url);
    if(image) upsertMeta("og:image", image);
    upsertMeta("og:site_name", BRAND_NAME);
    upsertMeta("twitter:card", image ? "summary_large_image" : "summary");
    upsertMeta("twitter:title", title);
    upsertMeta("twitter:description", description);
    if(image) upsertMeta("twitter:image", image);
    upsertLinkCanonical(url);
  }

  function upsertMeta(key, value, attr="property"){
    const sel = `meta[${attr}="${key}"]`;
    let el = document.head.querySelector(sel);
    if(!el){ el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
    el.setAttribute("content", value);
  }
  function upsertLinkCanonical(url){
    let el = document.head.querySelector('link[rel="canonical"]');
    if(!el){ el = document.createElement("link"); el.setAttribute("rel", "canonical"); document.head.appendChild(el); }
    el.setAttribute("href", url);
  }

  /* ---------- STRUCTURED DATA (JSON-LD) ---------- */
  function injectJsonLd(data){
    // Bỏ block cũ (nếu render lại) tránh nhiều JSON-LD trùng
    document.querySelectorAll('script[type="application/ld+json"][data-seo]').forEach(el=>el.remove());
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.setAttribute("data-seo", "1");
    s.textContent = JSON.stringify(data, null, 2);
    document.head.appendChild(s);
  }

  function productJsonLd(p){
    const url = `${SITE_URL}/product.html?id=${encodeURIComponent(p.id)}`;
    const images = (p.images && p.images.length) ? p.images
      : (p.image_url ? [p.image_url] : []);
    return {
      "@context":"https://schema.org/",
      "@type":"Product",
      name: p.name,
      description: p.print || p.collection || `${p.name} — ${BRAND_NAME}`,
      image: images,
      sku: p.id,
      brand: { "@type":"Brand", name: BRAND_NAME },
      offers: {
        "@type":"Offer",
        url, priceCurrency:"VND",
        price: p.price,
        availability: (p.stock>0) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        itemCondition:"https://schema.org/NewCondition",
      },
    };
  }

  function organizationJsonLd(){
    const b = (window.STORE && window.STORE.BRAND) || {};
    return {
      "@context":"https://schema.org",
      "@type":"Store",
      name: BRAND_NAME,
      url: SITE_URL,
      ...(b.hotline ? { telephone: b.hotline } : {}),
      ...(b.email   ? { email:    b.email   } : {}),
    };
  }

  /* ---------- ANALYTICS: GA4 ---------- */
  function injectGA4(){
    const id = CFG.GA4_ID;
    if(!id || window.__ga4Loaded) return;
    window.__ga4Loaded = true;
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){ window.dataLayer.push(arguments); };
    gtag("js", new Date());
    gtag("config", id, { send_page_view: true });
  }

  /* ---------- ANALYTICS: Facebook Pixel ---------- */
  function injectFBPixel(){
    const id = CFG.FB_PIXEL_ID;
    if(!id || window.__fbPixelLoaded) return;
    window.__fbPixelLoaded = true;
    /* eslint-disable */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
      document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq("init", id);
    fbq("track", "PageView");
    /* eslint-enable */
  }

  /* ---------- ANALYTICS: TikTok Pixel ---------- */
  function injectTikTokPixel(){
    const id = CFG.TIKTOK_PIXEL_ID;
    if(!id || window.__ttLoaded) return;
    window.__ttLoaded = true;
    /* eslint-disable */
    !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
      ttq.load(id);
      ttq.page();
    }(window, document, 'ttq');
    /* eslint-enable */
  }

  /* ---------- EVENT TRACKING wrappers ---------- */
  function trackEvent(name, params){
    // Defer khi đang prerender — tránh fake event hit khi user không thật sự
    // mở trang (vd Chromium prerender thông qua Speculation Rules).
    whenActive(()=>{
      if(window.gtag) gtag("event", name, params || {});
      if(window.fbq){
        const fbMap = { view_item:"ViewContent", add_to_cart:"AddToCart", begin_checkout:"InitiateCheckout", purchase:"Purchase" };
        const fbName = fbMap[name];
        if(fbName) fbq("track", fbName, params || {});
      }
      if(window.ttq){
        const ttMap = { view_item:"ViewContent", add_to_cart:"AddToCart", begin_checkout:"InitiateCheckout", purchase:"CompletePayment" };
        const ttName = ttMap[name];
        if(ttName) ttq.track(ttName, params || {});
      }
    });
  }

  /* ---------- API ---------- */
  window.SEO = {
    set: setMeta,
    setOrganization(){ injectJsonLd(organizationJsonLd()); },
    product(p){
      if(!p) return;
      const img = (p.images && p.images[0]) || p.image_url || "";
      setMeta({
        title: p.name,
        description: `${p.print || p.name}. Giá ${formatVND(p.price)}${p.compare>p.price?` (giảm từ ${formatVND(p.compare)})`:""}. Mua tại ${BRAND_NAME}.`,
        image: img,
        type: "product",
      });
      injectJsonLd(productJsonLd(p));
      trackEvent("view_item", {
        currency:"VND", value:p.price,
        items:[{ item_id:p.id, item_name:p.name, price:p.price, item_brand:BRAND_NAME }],
      });
    },
    trackAddToCart(p, qty=1){
      trackEvent("add_to_cart", {
        currency:"VND", value:(p.price||0)*qty,
        items:[{ item_id:p.id, item_name:p.name, price:p.price, quantity:qty }],
      });
    },
    trackCheckout(items, total){
      trackEvent("begin_checkout", {
        currency:"VND", value:total,
        items: items.map(it=>({ item_id:it.id, item_name:it.name, price:it.price, quantity:it.qty })),
      });
    },
    trackPurchase(order){
      trackEvent("purchase", {
        currency:"VND", transaction_id: order.code, value: order.total||0,
        shipping: order.shipping||0,
        items: (order.items||[]).map(it=>({ item_id:it.id, item_name:it.name, price:it.price, quantity:it.qty })),
      });
    },
  };

  function formatVND(n){ return new Intl.NumberFormat("vi-VN").format(n||0) + "đ"; }

  /* ---------- AUTO-INIT ---------- */
  // Inject analytics script CHỈ khi document đang active (không phải prerender).
  // Pixel script tự fire PageView khi load → gọi trong prerender sẽ false-positive.
  whenActive(()=>{
    injectGA4();
    injectFBPixel();
    injectTikTokPixel();
  });
  // Org JSON-LD inject 1 lần (cho mọi trang) — không phải analytics, OK chạy trong prerender
  setTimeout(()=>{
    if(window.STORE && window.STORE.BRAND) SEO.setOrganization();
  }, 0);
})();
