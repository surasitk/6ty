/* 6ty° demo data store — products persisted in the browser (localStorage).
 * Shared by the storefront (index.html) and the admin page (admin.html).
 * No backend: this is a front-end-only demo. */
(function () {
  var KEY = "6ty_products_v1";
  var TKEY = "6ty_types_v1";
  var CFGKEY = "6ty_imgcfg_v1";
  var DEFAULT_TYPES = ["520", "1250"];

  var SEED = [
    { id: "6TY-6",  name: "6ty° แพ็ก 6 ขวด",  description: "น้ำแร่ธรรมชาติจากน้ำพุร้อน 350 มล. × 6 ขวด",  price: 90,  label: "6 PACK",   product_type: "520",  display_order: 1, image: "", enabled: true },
    { id: "6TY-12", name: "6ty° แพ็ก 12 ขวด", description: "น้ำแร่ธรรมชาติจากน้ำพุร้อน 350 มล. × 12 ขวด", price: 170, label: "ยอดนิยม", product_type: "520",  display_order: 2, image: "", enabled: true },
    { id: "6TY-72", name: "6ty° ยกลัง 72 ขวด", description: "น้ำแร่ธรรมชาติจากน้ำพุร้อน 350 มล. × 72 ขวด", price: 960, label: "คุ้มสุด",  product_type: "1250", display_order: 3, image: "", enabled: true }
  ];

  var LABELS = ["", "6 PACK", "ยอดนิยม", "คุ้มสุด", "ใหม่", "ลดราคา"];

  // Backfill fields for products saved by older versions (e.g. no display_order).
  function normalize(arr) {
    var needsOrder = arr.some(function (p) { return typeof p.display_order !== "number"; });
    if (needsOrder) arr.forEach(function (p, i) { p.display_order = i + 1; });
    arr.forEach(function (p) {
      if (p.product_type === undefined) p.product_type = "";
      if (p.label === undefined) p.label = "";
      if (p.enabled === undefined) p.enabled = true;
    });
    if (needsOrder) { try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch (e) {} }
    return arr;
  }

  function readRaw() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { var arr = JSON.parse(raw); if (Array.isArray(arr)) return normalize(arr); }
    } catch (e) { /* ignore */ }
    write(SEED);
    return SEED.map(function (p) { return Object.assign({}, p); });
  }

  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); }
    catch (e) { alert("บันทึกไม่สำเร็จ: พื้นที่เก็บข้อมูลในเบราว์เซอร์เต็ม (รูปอาจใหญ่เกินไป)"); throw e; }
  }

  function sorted() {
    return readRaw().slice().sort(function (a, b) {
      return (a.display_order || 0) - (b.display_order || 0);
    });
  }

  function maxOrder() {
    return readRaw().reduce(function (m, p) { return Math.max(m, p.display_order || 0); }, 0);
  }

  function readCustomTypes() {
    try { var t = JSON.parse(localStorage.getItem(TKEY)); if (Array.isArray(t)) return t; } catch (e) {}
    return [];
  }

  function genId() { return "P" + Date.now().toString(36).toUpperCase(); }

  window.Store = {
    LABELS: LABELS,

    // Distinct product types: defaults ∪ saved custom ∪ those used by products.
    types: function () {
      var set = {};
      var out = [];
      DEFAULT_TYPES.concat(readCustomTypes()).forEach(function (t) {
        if (t && !set[t]) { set[t] = 1; out.push(t); }
      });
      readRaw().forEach(function (p) {
        var t = p.product_type;
        if (t && !set[t]) { set[t] = 1; out.push(t); }
      });
      return out;
    },
    addType: function (t) {
      t = (t || "").trim();
      if (!t) return;
      var cur = readCustomTypes();
      if (cur.indexOf(t) < 0 && DEFAULT_TYPES.indexOf(t) < 0) {
        cur.push(t);
        localStorage.setItem(TKEY, JSON.stringify(cur));
      }
    },

    all: function () { return sorted(); },
    enabled: function () { return sorted().filter(function (p) { return p.enabled; }); },
    get: function (id) { return readRaw().filter(function (p) { return p.id === id; })[0] || null; },

    upsert: function (product) {
      var list = readRaw();
      if (!product.id) {
        product.id = genId();
        product.display_order = maxOrder() + 1; // always unique, appended last
      }
      if (product.product_type) this.addType(product.product_type);
      var idx = -1;
      for (var i = 0; i < list.length; i++) if (list[i].id === product.id) idx = i;
      if (idx >= 0) list[idx] = product; else list.push(product);
      write(list);
      return product;
    },

    // Move a product up (-1) or down (+1) in display order by swapping with its neighbour.
    move: function (id, dir) {
      var list = sorted();
      var i = -1;
      for (var k = 0; k < list.length; k++) if (list[k].id === id) i = k;
      var j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return;
      var a = list[i], b = list[j];
      var tmp = a.display_order; a.display_order = b.display_order; b.display_order = tmp;
      write(list); // list holds references into the raw objects' clones; persist them
    },

    // Image storage config (Cloudinary). { cloud, preset }
    imageConfig: function () { try { return JSON.parse(localStorage.getItem(CFGKEY)) || {}; } catch (e) { return {}; } },
    setImageConfig: function (cfg) { localStorage.setItem(CFGKEY, JSON.stringify(cfg || {})); },

    toggle: function (id) {
      var list = readRaw();
      list.forEach(function (p) { if (p.id === id) p.enabled = !p.enabled; });
      write(list);
    },
    remove: function (id) { write(readRaw().filter(function (p) { return p.id !== id; })); },
    reset: function () { write(SEED); localStorage.removeItem(TKEY); }
  };
})();
