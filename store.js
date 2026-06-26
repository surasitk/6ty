/* 6ty° data store — products live in a shared Supabase table so every device
 * (admin + storefront, desktop + mobile + customers) sees the same catalog.
 *
 * Requires @supabase/supabase-js to be loaded before this file.
 * The publishable key below is safe to ship in client code (it is NOT a secret).
 * Reads come from an in-memory cache filled by Store.init(); call init() once on
 * page load before reading. Mutations write to Supabase and update the cache. */
(function () {
  var SUPABASE_URL = "https://pqyqbugbgnkiizjsjyqs.supabase.co";
  var SUPABASE_KEY = "sb_publishable_xEayc1gOAcg9aFEByv2cqg_hPz6-bre";
  var TABLE = "products";

  var TKEY = "6ty_types_v1";       // custom product types (local convenience)
  var CFGKEY = "6ty_imgcfg_v1";    // Cloudinary config (per-admin, local)
  var LEGACYKEY = "6ty_products_v1"; // old localStorage products (for one-time migration)
  var DEFAULT_TYPES = ["520", "1250"];

  var SEED = [
    { id: "6TY-6",  name: "6ty° แพ็ก 6 ขวด",  description: "น้ำแร่ธรรมชาติจากน้ำพุร้อน 350 มล. × 6 ขวด",  price: 90,  label: "6 PACK",   product_type: "520",  display_order: 1, image: "", enabled: true },
    { id: "6TY-12", name: "6ty° แพ็ก 12 ขวด", description: "น้ำแร่ธรรมชาติจากน้ำพุร้อน 350 มล. × 12 ขวด", price: 170, label: "ยอดนิยม", product_type: "520",  display_order: 2, image: "", enabled: true },
    { id: "6TY-72", name: "6ty° ยกลัง 72 ขวด", description: "น้ำแร่ธรรมชาติจากน้ำพุร้อน 350 มล. × 72 ขวด", price: 960, label: "คุ้มสุด",  product_type: "1250", display_order: 3, image: "", enabled: true }
  ];

  var sb = null;
  var _cache = [];
  var _ready = false;

  function client() {
    if (!sb) {
      if (!window.supabase) throw new Error("ยังไม่ได้โหลด Supabase library");
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return sb;
  }

  function sortCache() { _cache.sort(function (a, b) { return (a.display_order || 0) - (b.display_order || 0); }); }
  function maxOrder() { return _cache.reduce(function (m, p) { return Math.max(m, p.display_order || 0); }, 0); }
  function genId() { return "P" + Date.now().toString(36).toUpperCase(); }

  function readLegacy() {
    try { var a = JSON.parse(localStorage.getItem(LEGACYKEY)); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function readCustomTypes() {
    try { var t = JSON.parse(localStorage.getItem(TKEY)); return Array.isArray(t) ? t : []; } catch (e) { return []; }
  }

  // Normalise a product object to the table columns.
  function clean(p) {
    return {
      id: p.id, name: p.name || "", description: p.description || "",
      price: Number(p.price) || 0, label: p.label || "", product_type: p.product_type || "",
      packs: Number(p.packs) || 1,
      image: p.image || "", enabled: p.enabled !== false,
      display_order: Number(p.display_order) || 0
    };
  }

  window.Store = {
    LABELS: ["", "6 PACK", "ยอดนิยม", "คุ้มสุด", "ใหม่", "ลดราคา"],
    ready: function () { return _ready; },

    // Load all products into the cache. Falls back gracefully on error.
    init: async function () {
      try {
        var res = await client().from(TABLE).select("*").order("display_order", { ascending: true });
        if (res.error) throw res.error;
        _cache = res.data || [];
        // One-time migration: if the table is empty but this browser has old
        // localStorage products, push them up so nothing is lost.
        if (_cache.length === 0) {
          var legacy = readLegacy();
          if (legacy.length) {
            var rows = legacy.map(function (p, i) {
              var c = clean(p); if (!c.display_order) c.display_order = i + 1; return c;
            });
            var up = await client().from(TABLE).upsert(rows).select();
            if (!up.error) _cache = up.data || rows;
          }
        }
        // If still empty, seed defaults so the store isn't blank.
        if (_cache.length === 0) {
          var seedRows = SEED.map(clean);
          var sres = await client().from(TABLE).upsert(seedRows).select();
          _cache = (sres && !sres.error && sres.data) ? sres.data : seedRows;
        }
        _ready = true;
        sortCache();
        return { ok: true };
      } catch (e) {
        // Offline / not configured → fall back to localStorage so the demo still runs.
        _cache = readLegacy();
        if (_cache.length === 0) _cache = SEED.map(function (p) { return Object.assign({}, p); });
        _ready = true;
        sortCache();
        return { ok: false, error: String(e && e.message ? e.message : e) };
      }
    },

    all: function () { sortCache(); return _cache.map(function (p) { return Object.assign({}, p); }); },
    enabled: function () { return this.all().filter(function (p) { return p.enabled; }); },
    get: function (id) { var f = _cache.filter(function (p) { return p.id === id; })[0]; return f ? Object.assign({}, f) : null; },

    types: function () {
      var set = {}, out = [];
      DEFAULT_TYPES.concat(readCustomTypes()).forEach(function (t) { if (t && !set[t]) { set[t] = 1; out.push(t); } });
      _cache.forEach(function (p) { var t = p.product_type; if (t && !set[t]) { set[t] = 1; out.push(t); } });
      return out;
    },
    addType: function (t) {
      t = (t || "").trim(); if (!t) return;
      var cur = readCustomTypes();
      if (cur.indexOf(t) < 0 && DEFAULT_TYPES.indexOf(t) < 0) { cur.push(t); localStorage.setItem(TKEY, JSON.stringify(cur)); }
    },

    imageConfig: function () { try { return JSON.parse(localStorage.getItem(CFGKEY)) || {}; } catch (e) { return {}; } },
    setImageConfig: function (cfg) { localStorage.setItem(CFGKEY, JSON.stringify(cfg || {})); },

    upsert: async function (product) {
      if (!product.id) { product.id = genId(); product.display_order = maxOrder() + 1; }
      if (product.product_type) this.addType(product.product_type);
      var row = clean(product);
      var res = await client().from(TABLE).upsert(row).select();
      if (res.error) throw new Error(res.error.message);
      var saved = (res.data && res.data[0]) || row;
      var i = _cache.findIndex(function (p) { return p.id === saved.id; });
      if (i >= 0) _cache[i] = saved; else _cache.push(saved);
      sortCache();
      return saved;
    },

    toggle: async function (id) {
      var p = _cache.filter(function (x) { return x.id === id; })[0];
      if (!p) return;
      var val = !p.enabled;
      var res = await client().from(TABLE).update({ enabled: val }).eq("id", id);
      if (res.error) throw new Error(res.error.message);
      p.enabled = val;
    },

    remove: async function (id) {
      var res = await client().from(TABLE).delete().eq("id", id);
      if (res.error) throw new Error(res.error.message);
      _cache = _cache.filter(function (p) { return p.id !== id; });
    },

    // Swap display_order with the neighbour in the given direction (-1 up / +1 down).
    move: async function (id, dir) {
      sortCache();
      var i = _cache.findIndex(function (p) { return p.id === id; });
      var j = i + dir;
      if (i < 0 || j < 0 || j >= _cache.length) return;
      var a = _cache[i], b = _cache[j];
      var tmp = a.display_order; a.display_order = b.display_order; b.display_order = tmp;
      var res = await client().from(TABLE).upsert([clean(a), clean(b)]);
      if (res.error) throw new Error(res.error.message);
      sortCache();
    },

    // ── read other tables (for admin dashboard) ──
    ordersList: async function () { var r = await client().from("orders").select("*").order("created_at", { ascending: false }).limit(300); if (r.error) throw new Error(r.error.message); return r.data || []; },
    customersList: async function () { var r = await client().from("customers").select("*").order("updated_at", { ascending: false }).limit(500); if (r.error) throw new Error(r.error.message); return r.data || []; },

    // ── DC (distribution centers) CRUD ──
    dcList: async function () { var r = await client().from("dc").select("*").order("dc_id", { ascending: true }); if (r.error) throw new Error(r.error.message); return r.data || []; },
    dcUpsert: async function (d) { var r = await client().from("dc").upsert({ dc_id: d.dc_id, dc_name: d.dc_name || "", province: d.province || "", status: d.status || "active" }).select(); if (r.error) throw new Error(r.error.message); return (r.data && r.data[0]) || d; },
    dcToggle: async function (id, cur) { var r = await client().from("dc").update({ status: cur === "active" ? "inactive" : "active" }).eq("dc_id", id); if (r.error) throw new Error(r.error.message); },
    dcRemove: async function (id) { var r = await client().from("dc").delete().eq("dc_id", id); if (r.error) throw new Error(r.error.message); },

    // ── Branches (สาขา) CRUD ──
    branchesList: async function () { var r = await client().from("branches").select("*").order("branch_code", { ascending: true }); if (r.error) throw new Error(r.error.message); return r.data || []; },
    branchUpsert: async function (b) { var r = await client().from("branches").upsert({ branch_id: b.branch_id, branch_code: b.branch_code || "", branch_name: b.branch_name || "", province: b.province || "", active: b.active !== false, affiliation: b.affiliation || "", hub: b.hub || "" }).select(); if (r.error) throw new Error(r.error.message); return (r.data && r.data[0]) || b; },
    branchToggle: async function (id, cur) { var r = await client().from("branches").update({ active: !cur }).eq("branch_id", id); if (r.error) throw new Error(r.error.message); },
    branchRemove: async function (id) { var r = await client().from("branches").delete().eq("branch_id", id); if (r.error) throw new Error(r.error.message); },

    // ── Orders: update fields (e.g. payment_status, rider_status) ──
    orderUpdate: async function (orderId, fields) { var r = await client().from("orders").update(fields).eq("order_id", orderId); if (r.error) throw new Error(r.error.message); },

    // ── Rider Status ──
    riderList: async function () { var r = await client().from("rider_status").select("*").order("updated_at", { ascending: false }).limit(1000); if (r.error) throw new Error(r.error.message); return r.data || []; },
    // Bulk upsert rider rows; also map order_id (add ORD- prefix) and update the matching order's rider_status.
    riderImport: async function (rows) {
      var prepared = rows.map(function (r) {
        var raw = String(r.order_id || "").trim();
        var matched = raw ? (/^ORD-/i.test(raw) ? raw : "ORD-" + raw) : "";
        return { order_id: raw, rider_status: r.rider_status || "", date_send: r.date_send || "", job_id: r.job_id || "", matched_order_id: matched, updated_at: new Date().toISOString() };
      }).filter(function (r) { return r.order_id; });
      if (prepared.length) {
        var up = await client().from("rider_status").upsert(prepared).select();
        if (up.error) throw new Error(up.error.message);
      }
      // update orders.rider_status for matched sales orders (no-op if not found)
      var updated = 0;
      for (var i = 0; i < prepared.length; i++) {
        var p = prepared[i]; if (!p.matched_order_id || !p.rider_status) continue;
        try { await client().from("orders").update({ rider_status: p.rider_status }).eq("order_id", p.matched_order_id); updated++; } catch (e) { /* ignore */ }
      }
      return { imported: prepared.length, mappedUpdates: updated };
    },

    // ── Cronjob config (single row, id=1) ──
    cronGet: async function () { var r = await client().from("cron_config").select("*").eq("id", 1); if (r.error) throw new Error(r.error.message); return (r.data && r.data[0]) || { id: 1, file_type: "csv", status_filter: "Paid", sweep_time: "09:00", send_time: "09:00", channel_email: true, channel_line: false, email_to: "surasit@transformational.com", enabled: true }; },
    cronSave: async function (cfg) { var r = await client().from("cron_config").upsert(Object.assign({ id: 1 }, cfg, { updated_at: new Date().toISOString() })); if (r.error) throw new Error(r.error.message); },

    // ── Store settings (payment QR / bank) ──
    settingsGet: async function () { var r = await client().from("settings").select("*").eq("id", 1); if (r.error) throw new Error(r.error.message); return (r.data && r.data[0]) || { id: 1 }; },
    settingsSave: async function (s) { var r = await client().from("settings").upsert(Object.assign({ id: 1 }, s, { updated_at: new Date().toISOString() })); if (r.error) throw new Error(r.error.message); },

    // ── Customer-facing: create order + upload slip ──
    createOrder: async function (payload) {
      var now = new Date();
      var pad = function (n) { return String(n).padStart(2, "0"); };
      var oid = "ORD-" + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + "-" + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds()) + "-" + Math.floor(Math.random() * 9 + 1);
      var row = Object.assign({ order_id: oid, payment_status: "Pending", status: "NEW", shipping_status: "NEW" }, payload);
      var r = await client().from("orders").insert(row).select();
      if (r.error) throw new Error(r.error.message);
      return (r.data && r.data[0]) || row;
    },
    uploadSlip: async function (orderId, file) {
      var ext = (file.name || "slip.jpg").split(".").pop();
      var path = "slips/" + orderId + "-" + Date.now() + "." + ext;
      var up = await client().storage.from("slips").upload(orderId + "-" + Date.now() + "." + ext, file, { upsert: true, contentType: file.type });
      if (up.error) throw new Error(up.error.message);
      var pub = client().storage.from("slips").getPublicUrl(up.data.path);
      var url = pub.data.publicUrl;
      var r = await client().from("orders").update({ slip_url: url, payment_status: "Pending" }).eq("order_id", orderId);
      if (r.error) throw new Error(r.error.message);
      return url;
    }
  };
})();
