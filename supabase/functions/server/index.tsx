import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-9d73baa6/health", (c) => {
  return c.json({ status: "ok" });
});

// ========== Filter Tags ==========

app.get("/make-server-9d73baa6/filter-tags/:groupId", async (c) => {
  try {
    const groupId = c.req.param("groupId");
    const tags = await kv.get(`filter_tags:${groupId}`) ?? [];
    return c.json({ tags });
  } catch (e) {
    console.log("filter-tags GET error:", e);
    return c.json({ error: String(e) }, 500);
  }
});

app.post("/make-server-9d73baa6/filter-tags/:groupId", async (c) => {
  try {
    const groupId = c.req.param("groupId");
    const { tags } = await c.req.json();
    await kv.set(`filter_tags:${groupId}`, tags);
    return c.json({ ok: true });
  } catch (e) {
    console.log("filter-tags POST error:", e);
    return c.json({ error: String(e) }, 500);
  }
});

// ========== Member Tags ==========

app.get("/make-server-9d73baa6/member-tags/:groupId", async (c) => {
  try {
    const groupId = c.req.param("groupId");
    const memberTags = await kv.get(`all_member_tags:${groupId}`) ?? {};
    return c.json({ memberTags });
  } catch (e) {
    console.log("member-tags GET all error:", e);
    return c.json({ error: String(e) }, 500);
  }
});

app.get("/make-server-9d73baa6/member-tags/:groupId/:email", async (c) => {
  try {
    const groupId = c.req.param("groupId");
    const email = decodeURIComponent(c.req.param("email"));
    const memberTags = await kv.get(`all_member_tags:${groupId}`) ?? {};
    const tagIds = memberTags[email] ?? [];
    return c.json({ tagIds });
  } catch (e) {
    console.log("member-tags GET error:", e);
    return c.json({ error: String(e) }, 500);
  }
});

app.post("/make-server-9d73baa6/member-tags/:groupId/:email", async (c) => {
  try {
    const groupId = c.req.param("groupId");
    const email = decodeURIComponent(c.req.param("email"));
    const { tagIds } = await c.req.json();
    const memberTags = await kv.get(`all_member_tags:${groupId}`) ?? {};
    memberTags[email] = tagIds;
    await kv.set(`all_member_tags:${groupId}`, memberTags);
    return c.json({ ok: true });
  } catch (e) {
    console.log("member-tags POST error:", e);
    return c.json({ error: String(e) }, 500);
  }
});

// ========== Shift Breakpoints ==========

app.get("/make-server-9d73baa6/shift-breakpoints/:shiftId", async (c) => {
  try {
    const shiftId = c.req.param("shiftId");
    const breakpoints = await kv.get(`shift_breakpoints:${shiftId}`) ?? [];
    return c.json({ breakpoints });
  } catch (e) {
    console.log("shift-breakpoints GET error:", e);
    return c.json({ error: String(e) }, 500);
  }
});

app.post("/make-server-9d73baa6/shift-breakpoints/:shiftId", async (c) => {
  try {
    const shiftId = c.req.param("shiftId");
    const { breakpoints } = await c.req.json();
    await kv.set(`shift_breakpoints:${shiftId}`, breakpoints);
    return c.json({ ok: true });
  } catch (e) {
    console.log("shift-breakpoints POST error:", e);
    return c.json({ error: String(e) }, 500);
  }
});

// ========== Published Dates ==========

app.get("/make-server-9d73baa6/published-dates/:shiftId", async (c) => {
  try {
    const shiftId = c.req.param("shiftId");
    const dates = await kv.get(`published_dates:${shiftId}`) ?? [];
    return c.json({ dates });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

app.post("/make-server-9d73baa6/published-dates/:shiftId", async (c) => {
  try {
    const shiftId = c.req.param("shiftId");
    const { dates } = await c.req.json();
    await kv.set(`published_dates:${shiftId}`, dates);
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// ========== Hidden Day Apps ==========

app.get("/make-server-9d73baa6/hidden-day-apps/:shiftId", async (c) => {
  try {
    const shiftId = c.req.param("shiftId");
    const hidden = await kv.get(`hidden_day_apps:${shiftId}`) ?? [];
    return c.json({ hidden });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

app.post("/make-server-9d73baa6/hidden-day-apps/:shiftId", async (c) => {
  try {
    const shiftId = c.req.param("shiftId");
    const { hidden } = await c.req.json();
    await kv.set(`hidden_day_apps:${shiftId}`, hidden);
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

Deno.serve(app.fetch);