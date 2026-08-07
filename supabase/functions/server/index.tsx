import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";
const app = new Hono();

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const adminClient = createClient(supabaseUrl, serviceRoleKey);

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

// ========== Auth Support ==========

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  let page = 1;
  const perPage = 200;

  while (page <= 20) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users ?? [];
    const found = users.find((user) => (user.email || "").toLowerCase() === email.toLowerCase());
    if (found?.id) return found.id;

    if (users.length < perPage) break;
    page += 1;
  }

  return null;
}

app.post("/make-server-9d73baa6/auth/reset-password", async (c) => {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return c.json({ error: "サーバー設定が不正です" }, 500);
    }

    const { email, name, newPassword } = await c.req.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedName = String(name || "").trim();
    const normalizedPassword = String(newPassword || "");

    if (!normalizedEmail || !normalizedName || !normalizedPassword) {
      return c.json({ error: "メールアドレス・名前・新しいパスワードは必須です" }, 400);
    }

    if (normalizedPassword.length < 6) {
      return c.json({ error: "パスワードは6文字以上で入力してください" }, 400);
    }

    const { data: profile, error: profileError } = await adminClient
      .from("users")
      .select("email, name")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (profileError) {
      console.log("reset-password profile lookup error:", profileError.message);
      return c.json({ error: "再設定に失敗しました" }, 500);
    }

    if (!profile) {
      return c.json({ error: "メールアドレスまたは名前が一致しません" }, 400);
    }

    const dbName = String(profile.name || "").trim();
    if (dbName !== normalizedName) {
      return c.json({ error: "メールアドレスまたは名前が一致しません" }, 400);
    }

    const authUserId = await findAuthUserIdByEmail(normalizedEmail);
    if (!authUserId) {
      return c.json({ error: "メールアドレスまたは名前が一致しません" }, 400);
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(authUserId, {
      password: normalizedPassword,
    });

    if (updateError) {
      console.log("reset-password update error:", updateError.message);
      return c.json({ error: "パスワードの更新に失敗しました" }, 500);
    }

    return c.json({ ok: true, message: "パスワードを再設定しました" });
  } catch (error: any) {
    console.log("reset-password unexpected error:", error?.message || error);
    return c.json({ error: "再設定に失敗しました" }, 500);
  }
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