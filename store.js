/* 6ty° demo data store — products persisted in the browser (localStorage).
 * Shared by the storefront (index.html) and the admin page (admin.html).
 * No backend: this is a front-end-only demo. */
(function () {
  var KEY = "6ty_products_v1";

  var SEED = [
    { id: "6TY-6",  name: "6ty° แพ็ก 6 ขวด",  description: "น้ำแร่ธรรมชาติจากน้ำพุร้อน 350 มล. × 6 ขวด", price: 90,  label: "6 PACK",   image: "", enabled: true },
    { id: "6TY-12", name: "6ty° แพ็ก 12 ขวด", description: "น้ำแร่ธรรมชาติจากน้ำพุร้อน 350 มล. × 12 ขวด", price: 170, label: "ยอดนิยม", image: "", enabled: true },
    { id: "6TY-72", name: "6ty° ยกลัง 72 ขวด", description: "น้ำแร่ธรรมชาติจากน้ำพุร้อน 350 มล. × 72 ขวด", price: 960, label: "คุ้มสุด",  image: "", enabled: true }
  ];

  // Preset labels for the admin dropdown.
  var LABELS = ["", "6 PACK", "ยอดนิยม", "คุ้มสุด", "ใหม่", "ลดราคา"];

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr;
      }
    } catch (e) { /* ignore */ }
    write(SEED);
    return SEED.map(function (p) { return Object.assign({}, p); });
  }

  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {
      alert("บันทึกไม่สำเร็จ: พื้นที่เก็บข้อมูลในเบราว์เซอร์เต็ม (รูปอาจใหญ่เกินไป)");
      throw e;
    }
  }

  function genId() {
    return "P" + Date.now().toString(36).toUpperCase();
  }

  window.Store = {
    LABELS: LABELS,
    all: function () { return read(); },
    enabled: function () { return read().filter(function (p) { return p.enabled; }); },
    get: function (id) { return read().filter(function (p) { return p.id === id; })[0] || null; },
    upsert: function (product) {
      var list = read();
      if (!product.id) product.id = genId();
      var idx = -1;
      for (var i = 0; i < list.length; i++) if (list[i].id === product.id) idx = i;
      if (idx >= 0) list[idx] = product; else list.push(product);
      write(list);
      return product;
    },
    toggle: function (id) {
      var list = read();
      list.forEach(function (p) { if (p.id === id) p.enabled = !p.enabled; });
      write(list);
    },
    remove: function (id) {
      write(read().filter(function (p) { return p.id !== id; }));
    },
    reset: function () { write(SEED); }
  };
})();
