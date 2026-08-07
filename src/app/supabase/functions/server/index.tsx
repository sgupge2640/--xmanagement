import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import { kvGet, kvSet, kvDelete, kvGetByPrefix, kvDeleteByPrefix, kvGenerateId } from './kv_helper.tsx';

const app = new Hono();

// Supabaseクライアント（認証用）
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

console.log('✅ Using Supabase KV Store for data persistence');

// Logger
app.use('*', logger(console.log));

// CORS
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

// 認証ヘルパー
async function getUser(authHeader: string | null) {
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error) {
    console.log('Auth error:', error.message);
    return null;
  }
  return user;
}

// ランダムなグループコード生成
function generateGroupCode(): string {
  return Math.random().toString(36).substr(2, 8).toUpperCase();
}

// ========== Health Check ==========
app.get("/make-server-aba46d8b/health", async (c) => {
  return c.json({ status: "ok", storage: "kv_store" });
});

// ========== Auth Endpoints ==========

// サインアップ
app.post("/make-server-aba46d8b/auth/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();
    
    // Supabase Authでユーザー作成
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      email_confirm: true, // メール確認をスキップ
    });
    
    if (error) {
      // ユーザーが既に存在する場合
      if (error.message.includes('already') || error.message.includes('exists')) {
        return c.json({ 
          error: 'このメールアドレスは既に登録されています。ログインしてください。',
          code: 'USER_EXISTS'
        }, 409);
      }
      throw error;
    }
    
    // KVストアにユーザー情報を保存
    await kvSet(`user:${email}`, {
      email,
      name,
      created_at: new Date().toISOString(),
    });
    
    // トークンを生成してログインさせる
    const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (signInError) {
      console.error('Auto sign-in error after signup:', signInError);
      return c.json({ message: 'アカウントを作成しました。ログインしてください。', user: data.user }, 201);
    }
    
    return c.json({ 
      message: 'アカウントを作成しました', 
      token: sessionData.session?.access_token,
      user: { email, name }
    });
  } catch (error: any) {
    console.error('Signup error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// ログイン
app.post("/make-server-aba46d8b/auth/login", async (c) => {
  try {
    const { email, password } = await c.req.json();
    
    // Supabase Authでログイン
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error('Login error:', error.message);
      return c.json({ 
        error: 'メールアドレスまたはパスワードが間違っています'
      }, 401);
    }
    
    // KVストアからユーザー情報を取得
    const userInfo = await kvGet(`user:${email}`);
    
    return c.json({ 
      message: 'ログインしました', 
      token: data.session?.access_token,
      user: { 
        email, 
        name: userInfo?.name || data.user.user_metadata?.name || 'User'
      }
    });
  } catch (error: any) {
    console.error('Login error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// ========== Group Endpoints ==========

// グループを作成
app.post("/make-server-aba46d8b/groups", async (c) => {
  try {
    const user = await getUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const { name, description } = await c.req.json();
    
    if (!name || name.trim() === '') {
      return c.json({ error: 'グループ名は必須です' }, 400);
    }
    
    // グループIDを生成
    const groupId = await kvGenerateId('counter:group');
    
    // グループコードを生成（6桁の英数字）
    const code = generateGroupCode();
    
    // グループを作成
    await kvSet(`group:${groupId}`, {
      id: groupId,
      name: name.trim(),
      description: description?.trim() || '',
      created_by: user.email,
      created_at: new Date().toISOString(),
      hourly_rate: 1000, // デフォルト時給
      code: code, // グループコードを追加
    });
    
    // コードからグループIDを検索できるようにする
    await kvSet(`group:code:${code}`, groupId);
    
    // 作成者を管理者として追加
    const memberId = await kvGenerateId('counter:group_member');
    const userInfo = await kvGet(`user:${user.email}`) || {};
    await kvSet(`group_member:${memberId}`, {
      id: memberId,
      group_id: groupId,
      user_email: user.email,
      user_name: userInfo?.name || user.email?.split('@')[0] || 'ユーザー',
      role: 'admin',
      joined_at: new Date().toISOString(),
    });
    await kvSet(`group_member:group:${groupId}:user:${user.email}`, memberId);
    
    return c.json({ message: 'Group created successfully', group: {
      id: groupId,
      name: name.trim(),
      description: description?.trim() || '',
      created_by: user.email,
      created_at: new Date().toISOString(),
      hourly_rate: 1000, // デフォルト時給
      code: code, // グループコードをレスポンスに含める
    } });
  } catch (error: any) {
    console.error('Create group error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// グループに参加
app.post("/make-server-aba46d8b/groups/join", async (c) => {
  try {
    const user = await getUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const { code } = await c.req.json();
    
    // グループを検索
    const groupId = await kvGet(`group:code:${code}`);
    if (!groupId) {
      return c.json({ error: 'グループが見つかりません' }, 404);
    }
    
    const group = await kvGet(`group:${groupId}`);
    
    // 既にメンバーかチェック
    const existingMemberId = await kvGet(`group_member:group:${groupId}:user:${user.email}`);
    if (existingMemberId) {
      return c.json({ error: '既にこのグループのメンバーです' }, 400);
    }
    
    // 既に参加リクエストがあるかチェック
    const existingRequestKey = await kvGet(`group_join_request:group:${groupId}:user:${user.email}:pending`);
    if (existingRequestKey) {
      return c.json({ error: '既に参加リクエストを送信済みです。管理者の承認をお待ちください。' }, 400);
    }
    
    // ユーザー情報を取得
    const userInfo = await kvGet(`user:${user.email}`);
    
    // 参加リクエストを作成
    const requestId = await kvGenerateId('counter:group_join_request');
    const request = {
      id: requestId,
      group_id: groupId,
      user_email: user.email,
      user_name: userInfo?.name || user.email,
      status: 'pending',
      requested_at: new Date().toISOString(),
    };
    
    await kvSet(`group_join_request:${requestId}`, request);
    await kvSet(`group_join_request:group:${groupId}:user:${user.email}:pending`, requestId);
    
    return c.json({ message: '参加リクエストを送信しました。管理者の承認をお待ちください。', group });
  } catch (error: any) {
    console.error('Join group error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// グループの参加リクエスト一覧取得（管理者のみ）
app.get("/make-server-aba46d8b/groups/:groupId/join-requests", async (c) => {
  try {
    const user = await getUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const groupId = parseInt(c.req.param('groupId'));
    
    // 管理者かチェック
    const memberId = await kvGet(`group_member:group:${groupId}:user:${user.email}`);
    if (!memberId) {
      return c.json({ error: 'このグループのメンバーではありません' }, 403);
    }
    
    const member = await kvGet(`group_member:${memberId}`);
    if (member.role !== 'admin') {
      return c.json({ error: '管理者権限が必要です' }, 403);
    }
    
    // 未承認の参加リクエスト一覧を取得
    const allRequests = await kvGetByPrefix('group_join_request:');
    const requests = allRequests
      .map(item => item.value)
      .filter(req => req.group_id === groupId && req.status === 'pending')
      .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());
    
    return c.json(requests);
  } catch (error: any) {
    console.error('Get join requests error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// 参加リクエストを承認（管理者のみ）
app.post("/make-server-aba46d8b/groups/join-requests/:requestId/approve", async (c) => {
  try {
    const user = await getUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const requestId = parseInt(c.req.param('requestId'));
    
    // リクエスト情報を取得
    const request = await kvGet(`group_join_request:${requestId}`);
    if (!request) {
      return c.json({ error: 'リクエストが見つかりません' }, 404);
    }
    
    // 管理者かチェック
    const memberId = await kvGet(`group_member:group:${request.group_id}:user:${user.email}`);
    if (!memberId) {
      return c.json({ error: 'このグループのメンバーではありません' }, 403);
    }
    
    const member = await kvGet(`group_member:${memberId}`);
    if (member.role !== 'admin') {
      return c.json({ error: '管理者権限が必要です' }, 403);
    }
    
    // グループメンバーとして追加
    const newMemberId = await kvGenerateId('counter:group_member');
    await kvSet(`group_member:${newMemberId}`, {
      id: newMemberId,
      group_id: request.group_id,
      user_email: request.user_email,
      user_name: request.user_name || request.user_email,
      role: 'member',
      joined_at: new Date().toISOString(),
    });
    await kvSet(`group_member:group:${request.group_id}:user:${request.user_email}`, newMemberId);
    
    // リクエストのステータスを更新
    request.status = 'approved';
    request.processed_at = new Date().toISOString();
    await kvSet(`group_join_request:${requestId}`, request);
    
    // pending状態のインデックスを削除
    await kvDelete(`group_join_request:group:${request.group_id}:user:${request.user_email}:pending`);
    
    return c.json({ message: '参加リクエストを承認しました' });
  } catch (error: any) {
    console.error('Approve request error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// 参加リクエストを拒否（管理者のみ）
app.post("/make-server-aba46d8b/groups/join-requests/:requestId/reject", async (c) => {
  try {
    const user = await getUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const requestId = parseInt(c.req.param('requestId'));
    
    // リクエスト情報を取得
    const request = await kvGet(`group_join_request:${requestId}`);
    if (!request) {
      return c.json({ error: 'リクエストが見つかりません' }, 404);
    }
    
    // 管理者かチェック
    const memberId = await kvGet(`group_member:group:${request.group_id}:user:${user.email}`);
    if (!memberId) {
      return c.json({ error: 'このグループのメンバーではありません' }, 403);
    }
    
    const member = await kvGet(`group_member:${memberId}`);
    if (member.role !== 'admin') {
      return c.json({ error: '管理者権限が必要です' }, 403);
    }
    
    // リクエストのステータスを更新
    request.status = 'rejected';
    request.processed_at = new Date().toISOString();
    await kvSet(`group_join_request:${requestId}`, request);
    
    // pending状態のインデックスを削除
    await kvDelete(`group_join_request:group:${request.group_id}:user:${request.user_email}:pending`);
    
    return c.json({ message: '参加リクエストを拒否しました' });
  } catch (error: any) {
    console.error('Reject request error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// 自分のグループ一覧
app.get("/make-server-aba46d8b/groups/my", async (c) => {
  try {
    const user = await getUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    // ユーザーが所属するグループメンバーシップを取得
    const allMembers = await kvGetByPrefix('group_member:');
    const userMemberships = allMembers
      .map(item => item.value)
      .filter(m => m.user_email === user.email);
    
    // グループ情報を取得
    const groups = await Promise.all(
      userMemberships.map(async (membership) => {
        const group = await kvGet(`group:${membership.group_id}`);
        return {
          ...group,
          role: membership.role,
          is_admin: membership.role === 'admin',
        };
      })
    );
    
    // 作成日時でソート（新しい順）
    groups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return c.json(groups);
  } catch (error: any) {
    console.error('Get my groups error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// グループメンバー一覧を取得（管理者のみ）
app.get("/make-server-aba46d8b/groups/:groupId/members", async (c) => {
  try {
    const user = await getUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const groupId = parseInt(c.req.param('groupId'));
    
    // 管理者かチェック
    const memberId = await kvGet(`group_member:group:${groupId}:user:${user.email}`);
    if (!memberId) {
      return c.json({ error: 'このグループのメンバーではありません' }, 403);
    }
    
    const member = await kvGet(`group_member:${memberId}`);
    if (member.role !== 'admin') {
      return c.json({ error: '管理者権限が必要です' }, 403);
    }
    
    // グループの全メンバーを取得
    const allMembers = await kvGetByPrefix('group_member:');
    const groupMembers = allMembers
      .map(item => item.value)
      .filter(m => m && m.group_id === groupId && typeof m.id === 'number')
      .map(m => ({
        id: m.id,
        user_email: m.user_email,
        user_name: m.user_name || m.user_email,
        role: m.role,
        joined_at: m.joined_at,
      }));
    
    return c.json(groupMembers);
  } catch (error: any) {
    console.error('Get group members error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// グループを削除（管理者のみ）
app.delete("/make-server-aba46d8b/groups/:groupId", async (c) => {
  try {
    const user = await getUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const groupId = parseInt(c.req.param('groupId'));
    
    // グループが存在するか確認
    const group = await kvGet(`group:${groupId}`);
    if (!group) {
      return c.json({ error: 'グループが見つかりません' }, 404);
    }
    
    // 管理者かチェック
    const memberId = await kvGet(`group_member:group:${groupId}:user:${user.email}`);
    if (!memberId) {
      return c.json({ error: 'このグループのメンバーではありません' }, 403);
    }
    
    const member = await kvGet(`group_member:${memberId}`);
    if (member.role !== 'admin') {
      return c.json({ error: '管理者権限が必要です' }, 403);
    }
    
    // グループに関連するすべてのデータを削除
    // 1. グループメンバーを削除
    const allMembers = await kvGetByPrefix('group_member:');
    for (const item of allMembers) {
      if (item.value?.group_id === groupId) {
        await kvDelete(item.key);
        // インデックスも削除
        if (item.value?.user_email) {
          await kvDelete(`group_member:group:${groupId}:user:${item.value.user_email}`);
        }
      }
    }
    
    // 2. シフトを削除
    const allShifts = await kvGetByPrefix('shift:');
    for (const item of allShifts) {
      if (item.value?.group_id === groupId) {
        await kvDelete(item.key);
      }
    }
    
    // 3. シフト応募を削除
    const allApplications = await kvGetByPrefix('shift_application:');
    for (const item of allApplications) {
      if (item.value?.group_id === groupId) {
        await kvDelete(item.key);
      }
    }
    
    // 4. 交代申請を削除
    const allSwapRequests = await kvGetByPrefix('shift_swap_request:');
    for (const item of allSwapRequests) {
      if (item.value?.group_id === groupId) {
        await kvDelete(item.key);
      }
    }
    
    // 5. 参加リクエストを削除
    const allJoinRequests = await kvGetByPrefix('group_join_request:');
    for (const item of allJoinRequests) {
      if (item.value?.group_id === groupId) {
        await kvDelete(item.key);
      }
    }
    
    // 6. グループコードのインデックスを削除
    if (group.code) {
      await kvDelete(`group:code:${group.code}`);
    }
    
    // 7. グループ本体を削除
    await kvDelete(`group:${groupId}`);
    
    return c.json({ message: 'グループを削除しました' });
  } catch (error: any) {
    console.error('Delete group error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// メンバーを削除（管理者のみ）
app.delete("/make-server-aba46d8b/groups/:groupId/members/:memberId", async (c) => {
  try {
    const user = await getUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const groupId = parseInt(c.req.param('groupId'));
    const targetMemberId = parseInt(c.req.param('memberId'));
    
    // 管理者かチェック
    const adminMemberId = await kvGet(`group_member:group:${groupId}:user:${user.email}`);
    if (!adminMemberId) {
      return c.json({ error: 'このグループのメンバーではありません' }, 403);
    }
    
    const adminMember = await kvGet(`group_member:${adminMemberId}`);
    if (adminMember.role !== 'admin') {
      return c.json({ error: '管理者権限が必要です' }, 403);
    }
    
    // 削除対象のメンバー情報を取得
    const targetMember = await kvGet(`group_member:${targetMemberId}`);
    if (!targetMember) {
      return c.json({ error: 'メンバーが見つかりません' }, 404);
    }
    
    if (targetMember.group_id !== groupId) {
      return c.json({ error: 'このグループのメンバーではありません' }, 403);
    }
    
    // 自分自身は削除できない
    if (targetMember.user_email === user.email) {
      return c.json({ error: '自分自身を削除することはできません' }, 400);
    }
    
    // メンバーを削除
    await kvDelete(`group_member:${targetMemberId}`);
    await kvDelete(`group_member:group:${groupId}:user:${targetMember.user_email}`);
    
    return c.json({ message: 'メンバーを削除しました' });
  } catch (error: any) {
    console.error('Delete member error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// ========== Shift Endpoints ==========

// シフト作成（管理者のみ）
app.post("/make-server-aba46d8b/groups/:groupId/shifts", async (c) => {
  try {
    const user = await getUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const groupId = parseInt(c.req.param('groupId'));
    
    // 管理者かチェック
    const memberId = await kvGet(`group_member:group:${groupId}:user:${user.email}`);
    if (!memberId) {
      return c.json({ error: 'このグループのメンバーではありません' }, 403);
    }
    
    const member = await kvGet(`group_member:${memberId}`);
    if (member.role !== 'admin') {
      return c.json({ error: '管理者権限が必要です' }, 403);
    }
    
    const { title, description, start_date, end_date, start_time, end_time, location, application_deadline } = await c.req.json();
    
    // シフトを作成
    const shiftId = await kvGenerateId('counter:shift');
    const shift = {
      id: shiftId,
      group_id: groupId,
      title,
      description: description || '',
      start_date,
      end_date,
      start_time,
      end_time,
      location: location || '',
      application_deadline,
      created_by: user.email,
      created_at: new Date().toISOString(),
    };
    
    await kvSet(`shift:${shiftId}`, shift);
    await kvSet(`shift:group:${groupId}:${shiftId}`, true);
    
    return c.json({ message: 'シフトを作成しました', shift });
  } catch (error: any) {
    console.error('Create shift error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// グループのシフト一覧取得
app.get("/make-server-aba46d8b/groups/:groupId/shifts", async (c) => {
  try {
    const user = await getUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const groupId = parseInt(c.req.param('groupId'));
    
    // グループメンバーかチェック
    const memberId = await kvGet(`group_member:group:${groupId}:user:${user.email}`);
    if (!memberId) {
      return c.json({ error: 'このグループのメンバーではありません' }, 403);
    }
    
    // グループのシフト一覧を取得
    const allShifts = await kvGetByPrefix('shift:');
    const groupShifts = allShifts
      .map(item => item.value)
      .filter(s => s && s.group_id === groupId);
    
    // 各シフトの応募状況を取得
    const allApplications = await kvGetByPrefix('shift_application:');
    
    const shiftsWithApplications = groupShifts.map(shift => {
      const applications = allApplications
        .map(item => item.value)
        .filter(app => app && app.shift_id === shift.id);
      
      const approved_count = applications.filter(app => app.status === 'approved').length;
      const pending_count = applications.filter(app => app.status === 'pending').length;
      const userApplication = applications.find(app => app.user_email === user.email);
      
      return {
        ...shift,
        approved_count,
        pending_count,
        user_application_status: userApplication?.status || null,
      };
    });
    
    // 日付と時刻でソート
    shiftsWithApplications.sort((a, b) => {
      const dateCompare = a.start_date.localeCompare(b.start_date);
      if (dateCompare !== 0) return dateCompare;
      return a.start_time.localeCompare(b.start_time);
    });
    
    return c.json(shiftsWithApplications);
  } catch (error: any) {
    console.error('Get shifts error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// シフト詳細取得
app.get("/make-server-aba46d8b/shifts/:shiftId", async (c) => {
  try {
    const user = await getUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const shiftId = parseInt(c.req.param('shiftId'));
    
    // シフト情報を取得
    const shift = await kvGet(`shift:${shiftId}`);
    if (!shift) {
      return c.json({ error: 'シフトが見つかりません' }, 404);
    }
    
    // グループ情報を取得
    const group = await kvGet(`group:${shift.group_id}`);
    shift.group_name = group?.name || '';
    
    // グループメンバーかチェック
    const memberId = await kvGet(`group_member:group:${shift.group_id}:user:${user.email}`);
    if (!memberId) {
      return c.json({ error: 'このグループのメンバーではありません' }, 403);
    }
    
    const member = await kvGet(`group_member:${memberId}`);
    const is_admin = member.role === 'admin';
    
    // 応募者一覧を取得（管理者の場合）
    let applications = [];
    let unapplied_members = [];
    
    if (is_admin) {
      const allApplications = await kvGetByPrefix('shift_application:');
      applications = allApplications
        .map(item => item.value)
        .filter(app => app && app.shift_id === shiftId)
        .sort((a, b) => new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime());
      
      // 未応募メンバーを取得（管理者を除外）
      const allMembers = await kvGetByPrefix('group_member:');
      const groupMembers = allMembers
        .map(item => item.value)
        .filter(m => m && m.group_id === shift.group_id && typeof m.id === 'number' && m.role !== 'admin');
      
      const appliedEmails = new Set(applications.map(app => app.user_email));
      unapplied_members = groupMembers
        .filter(m => !appliedEmails.has(m.user_email))
        .map(m => ({
          user_email: m.user_email,
          user_name: m.user_name || m.user_email,
        }));
    }
    
    return c.json({ shift, applications, is_admin, unapplied_members });
  } catch (error: any) {
    console.error('Get shift detail error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// シフトに応募
app.post("/make-server-aba46d8b/shifts/:shiftId/apply", async (c) => {
  try {
    const user = await getUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const shiftId = parseInt(c.req.param('shiftId'));
    const { daily_schedule } = await c.req.json();
    
    // シフト情報を取得
    const shift = await kvGet(`shift:${shiftId}`);
    if (!shift) {
      return c.json({ error: 'シフトが見つかりません' }, 404);
    }
    
    // グループメンバーかチェック
    const memberId = await kvGet(`group_member:group:${shift.group_id}:user:${user.email}`);
    if (!memberId) {
      return c.json({ error: 'このグループのメンバーではありません' }, 403);
    }
    
    // 既に応募済みかチェック
    const existingAppId = await kvGet(`shift_application:shift:${shiftId}:user:${user.email}`);
    if (existingAppId) {
      return c.json({ error: '既にこのシフトに応募しています' }, 400);
    }
    
    // ユーザー情報を取得
    const userInfo = await kvGet(`user:${user.email}`);
    
    // 応募を作成
    const appId = await kvGenerateId('counter:shift_application');
    const application = {
      id: appId,
      shift_id: shiftId,
      user_email: user.email,
      user_name: userInfo?.name || user.email,
      status: 'pending',
      daily_schedule: daily_schedule || [],
      applied_at: new Date().toISOString(),
    };
    
    await kvSet(`shift_application:${appId}`, application);
    await kvSet(`shift_application:shift:${shiftId}:user:${user.email}`, appId);
    
    return c.json({ message: 'シフトに応募しました。管理者の承認をお待ちください。' });
  } catch (error: any) {
    console.error('Apply shift error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// シフト応募を承認（管理者のみ）
app.post("/make-server-aba46d8b/shift-applications/:applicationId/approve", async (c) => {
  try {
    const user = await getUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const applicationId = parseInt(c.req.param('applicationId'));
    
    // 管理者が設定した承認スケジュール（日付ごとに承認）
    const body = await c.req.json().catch(() => ({}));
    const { approved_dates } = body; // [{ date, start_time, end_time }]
    
    const application = await kvGet(`shift_application:${applicationId}`);
    if (!application) {
      return c.json({ error: '応募が見つかりません' }, 404);
    }
    
    const shift = await kvGet(`shift:${application.shift_id}`);
    if (!shift) {
      return c.json({ error: 'シフトが見つかりません' }, 404);
    }
    
    // 管理者かチェック
    const memberId = await kvGet(`group_member:group:${shift.group_id}:user:${user.email}`);
    if (!memberId) {
      return c.json({ error: 'このグループのメンバーではありません' }, 403);
    }
    
    const member = await kvGet(`group_member:${memberId}`);
    if (member.role !== 'admin') {
      return c.json({ error: '管理者権限が必要です' }, 403);
    }
    
    // 日付ごとのステータスを初期化（まだない場合）
    if (!application.daily_schedule || application.daily_schedule.length === 0) {
      // 全期間のスケジュールを作成
      const dates = [];
      const start = new Date(shift.start_date);
      const end = new Date(shift.end_date);
      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        dates.push({
          date: date.toISOString().split('T')[0],
          start_time: shift.start_time,
          end_time: shift.end_time,
          status: 'pending',
        });
      }
      application.daily_schedule = dates;
    }
    
    // daily_scheduleに各日付のstatusを設定（まだない場合）
    application.daily_schedule = application.daily_schedule.map((day: any) => ({
      ...day,
      status: day.status || 'pending',
    }));
    
    // 承認された日付のステータスを更新
    if (approved_dates && Array.isArray(approved_dates) && approved_dates.length > 0) {
      approved_dates.forEach((approvedDay: any) => {
        const dayIndex = application.daily_schedule.findIndex((d: any) => d.date === approvedDay.date);
        if (dayIndex !== -1) {
          application.daily_schedule[dayIndex] = {
            date: approvedDay.date,
            start_time: approvedDay.start_time,
            end_time: approvedDay.end_time,
            status: 'approved',
          };
        }
      });
    }
    
    // 全体のステータスを更新
    const approvedDays = application.daily_schedule.filter((d: any) => d.status === 'approved');
    const pendingDays = application.daily_schedule.filter((d: any) => d.status === 'pending');
    
    if (approvedDays.length > 0 && pendingDays.length === 0) {
      // 全日承認済み
      application.status = 'approved';
    } else if (approvedDays.length > 0) {
      // 一部承認済み
      application.status = 'partially_approved';
    } else {
      // ま承認待ち
      application.status = 'pending';
    }
    
    application.processed_at = new Date().toISOString();
    
    await kvSet(`shift_application:${applicationId}`, application);
    
    return c.json({ message: '応募を承認しました' });
  } catch (error: any) {
    console.error('Approve application error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// シフト応募を拒否（管理者のみ）
app.post("/make-server-aba46d8b/shifts/applications/:applicationId/reject", async (c) => {
  try {
    const user = await getUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const applicationId = parseInt(c.req.param('applicationId'));
    
    // 応募情報を取得
    const application = await kvGet(`shift_application:${applicationId}`);
    if (!application) {
      return c.json({ error: '応募が見つかりません' }, 404);
    }
    
    // シフト情報を取得
    const shift = await kvGet(`shift:${application.shift_id}`);
    
    // 管理者かチェック
    const memberId = await kvGet(`group_member:group:${shift.group_id}:user:${user.email}`);
    if (!memberId) {
      return c.json({ error: 'このグループのメンバーではありません' }, 403);
    }
    
    const member = await kvGet(`group_member:${memberId}`);
    if (member.role !== 'admin') {
      return c.json({ error: '管理者権限が必要です' }, 403);
    }
    
    // 応募のステータスを更新
    application.status = 'rejected';
    application.processed_at = new Date().toISOString();
    await kvSet(`shift_application:${applicationId}`, application);
    
    return c.json({ message: 'シフト応募を拒否しました' });
  } catch (error: any) {
    console.error('Reject shift application error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// シフの採用結果を発表（管理者のみ）
app.post("/make-server-aba46d8b/shifts/:shiftId/publish-results", async (c) => {
  try {
    const user = await getUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const shiftId = parseInt(c.req.param('shiftId'));
    const { message } = await c.req.json();
    
    // シフト情報を取得
    const shift = await kvGet(`shift:${shiftId}`);
    if (!shift) {
      return c.json({ error: 'シフトが見つかりません' }, 404);
    }
    
    // 管理者かチェック
    const memberId = await kvGet(`group_member:group:${shift.group_id}:user:${user.email}`);
    if (!memberId) {
      return c.json({ error: 'このグループのメンバーではありません' }, 403);
    }
    
    const member = await kvGet(`group_member:${memberId}`);
    if (member.role !== 'admin') {
      return c.json({ error: '管理者権が必要です' }, 403);
    }
    
    // シフトの結果発表フラグを立てる
    shift.results_published = true;
    shift.results_message = message || '';
    shift.results_published_at = new Date().toISOString();
    shift.results_published_by = user.email;
    await kvSet(`shift:${shiftId}`, shift);
    
    // pending状態の応募を自動的にrejectedにする
    const allApplications = await kvGetByPrefix('shift_application:');
    const shiftApplications = allApplications
      .map(item => item.value)
      .filter(app => app && app.shift_id === shiftId && app.status === 'pending');
    
    for (const app of shiftApplications) {
      app.status = 'rejected';
      app.processed_at = new Date().toISOString();
      await kvSet(`shift_application:${app.id}`, app);
    }
    
    return c.json({ message: '採用結果を発表しました' });
  } catch (error: any) {
    console.error('Publish shift results error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// ユーザーの全シフトを取得（カレンダー用）
app.get("/make-server-aba46d8b/my-shifts", async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    console.log('My-shifts auth header:', authHeader);
    
    const user = await getUser(authHeader);
    if (!user) {
      console.error('My-shifts: User not authenticated');
      return c.json({ error: 'Unauthorized - ログインが必要です' }, 401);
    }
    
    console.log('My-shifts: User authenticated:', user.email);
    
    // ユーザーのすべての応募を取得
    const allApplications = await kvGetByPrefix('shift_application:');
    const userApplications = allApplications
      .map(item => item.value)
      .filter(app => app && typeof app.id === 'number' && app.user_email === user.email);
    
    console.log('My-shifts: Found applications:', userApplications.length);
    
    // シフト情報を取得
    const shiftsWithStatus = await Promise.all(
      userApplications.map(async (app) => {
        const shift = await kvGet(`shift:${app.shift_id}`);
        if (!shift) return null;
        
        const group = await kvGet(`group:${shift.group_id}`);
        
        return {
          shift_id: shift.id,
          group_id: shift.group_id,
          group_name: group?.name || 'Unknown',
          title: shift.title,
          description: shift.description,
          start_date: shift.start_date,
          end_date: shift.end_date,
          start_time: shift.start_time,
          end_time: shift.end_time,
          location: shift.location,
          status: app.status,
          daily_schedule: app.daily_schedule || [],
        };
      })
    );
    
    const validShifts = shiftsWithStatus.filter(s => s !== null);
    console.log('My-shifts: Returning shifts:', validShifts.length);
    
    return c.json(validShifts);
  } catch (error: any) {
    console.error('Get my shifts error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// 交代申請を作成
app.post("/make-server-aba46d8b/shift-swap-requests", async (c) => {
  try {
    const user = await getUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const { shift_id, group_id, date, start_time, end_time, reason } = await c.req.json();
    
    // グループメンバーかチェック
    const memberId = await kvGet(`group_member:group:${group_id}:user:${user.email}`);
    if (!memberId) {
      return c.json({ error: 'このグループのメンバーではありません' }, 403);
    }
    
    const member = await kvGet(`group_member:${memberId}`);
    
    // 申請者が実際にその日にシフトに入っているかチェック
    const allApplications = await kvGetByPrefix('shift_application:');
    const userApp = allApplications
      .map(item => item.value)
      .find(app => 
        app && 
        app.shift_id === shift_id && 
        app.user_email === user.email && 
        (app.status === 'approved' || app.status === 'partially_approved')
      );
    
    if (!userApp) {
      return c.json({ error: 'このシフトは承認されていません' }, 403);
    }
    
    // daily_scheduleで該当日が承認されているかチェック
    const daySchedule = userApp.daily_schedule?.find((d: any) => d.date === date && d.status === 'approved');
    if (!daySchedule) {
      return c.json({ error: 'この日のシフトは承認されてません' }, 403);
    }
    
    // 新しい交代申請を作成
    const requestId = Date.now();
    const swapRequest = {
      id: requestId,
      shift_id,
      group_id,
      date,
      start_time,
      end_time,
      requester_email: user.email,
      requester_name: member.user_name || 'ユーザー',
      reason,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    
    await kvSet(`shift_swap_request:${requestId}`, swapRequest);
    await kvSet(`shift_swap_request:shift:${shift_id}:date:${date}:pending`, requestId);
    
    return c.json(swapRequest);
  } catch (error: any) {
    console.error('Create swap request error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// 交代申請一覧を取得（グループ内）
app.get("/make-server-aba46d8b/groups/:groupId/shift-swap-requests", async (c) => {
  try {
    const user = await getUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const groupId = parseInt(c.req.param('groupId'));
    
    // グループメンバーかチェック
    const memberId = await kvGet(`group_member:group:${groupId}:user:${user.email}`);
    if (!memberId) {
      return c.json({ error: 'このグループのメンバーではありません' }, 403);
    }
    
    const member = await kvGet(`group_member:${memberId}`);
    const is_admin = member.role === 'admin';
    
    // 交代申請を取得
    const allRequests = await kvGetByPrefix('shift_swap_request:');
    let requests = allRequests
      .map(item => item.value)
      .filter(req => req && typeof req.id === 'number' && req.group_id === groupId);
    
    // 管理者以外は自分の申請と応募可能な申請のみ
    if (!is_admin) {
      requests = requests.filter(req => 
        req.requester_email === user.email || 
        req.accepter_email === user.email ||
        req.status === 'pending'
      );
    }
    
    // シフト情報を追加
    const requestsWithShift = await Promise.all(
      requests.map(async (req) => {
        const shift = await kvGet(`shift:${req.shift_id}`);
        return {
          ...req,
          shift_title: shift?.title || '',
        };
      })
    );
    
    // 新しい順にソート
    requestsWithShift.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return c.json(requestsWithShift);
  } catch (error: any) {
    console.error('Get swap requests error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// 交代申請に応募
app.post("/make-server-aba46d8b/shift-swap-requests/:requestId/accept", async (c) => {
  try {
    const user = await getUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const requestId = parseInt(c.req.param('requestId'));
    
    // 交代申請を取得
    const swapRequest = await kvGet(`shift_swap_request:${requestId}`);
    if (!swapRequest) {
      return c.json({ error: '交代申請が見つかりません' }, 404);
    }
    
    if (swapRequest.status !== 'pending') {
      return c.json({ error: 'この申請はすでに処理されています' }, 400);
    }
    
    if (swapRequest.requester_email === user.email) {
      return c.json({ error: '自分の申請には応募できません' }, 400);
    }
    
    // グループメンバーかチェック
    const memberId = await kvGet(`group_member:group:${swapRequest.group_id}:user:${user.email}`);
    if (!memberId) {
      return c.json({ error: 'このグループのメンバーではありません' }, 403);
    }
    
    const member = await kvGet(`group_member:${memberId}`);
    
    // 応募者がその時間帯に他のシフトを持っていないかチェック
    const allApplications = await kvGetByPrefix('shift_application:');
    const userApps = allApplications
      .map(item => item.value)
      .filter(app => app && app.user_email === user.email && (app.status === 'approved' || app.status === 'partially_approved'));
    
    for (const app of userApps) {
      if (app.daily_schedule) {
        for (const day of app.daily_schedule) {
          if (day.date === swapRequest.date && day.status === 'approved') {
            // 時間帯が重複しているかチェック
            const existingStart = day.start_time;
            const existingEnd = day.end_time;
            const requestStart = swapRequest.start_time;
            const requestEnd = swapRequest.end_time;
            
            if (!(requestEnd <= existingStart || requestStart >= existingEnd)) {
              return c.json({ error: 'その時間帯に他のシフトがあります' }, 400);
            }
          }
        }
      }
    }
    
    // 交代申請を更新
    swapRequest.status = 'accepted';
    swapRequest.accepter_email = user.email;
    swapRequest.accepter_name = member.user_name || 'ユーザー';
    swapRequest.accepted_at = new Date().toISOString();
    
    await kvSet(`shift_swap_request:${requestId}`, swapRequest);
    await kvDelete(`shift_swap_request:shift:${swapRequest.shift_id}:date:${swapRequest.date}:pending`);
    
    return c.json(swapRequest);
  } catch (error: any) {
    console.error('Accept swap request error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// 交代申請を承認（管理者のみ）
app.post("/make-server-aba46d8b/shift-swap-requests/:requestId/approve", async (c) => {
  try {
    const user = await getUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const requestId = parseInt(c.req.param('requestId'));
    const { admin_comment } = await c.req.json().catch(() => ({}));
    
    // 交代申請を取得
    const swapRequest = await kvGet(`shift_swap_request:${requestId}`);
    if (!swapRequest) {
      return c.json({ error: '交代申請が見つかりません' }, 404);
    }
    
    if (swapRequest.status === 'approved' || swapRequest.status === 'rejected') {
      return c.json({ error: 'この申請はすでに処理されています' }, 400);
    }
    
    // 管理者かチェック
    const memberId = await kvGet(`group_member:group:${swapRequest.group_id}:user:${user.email}`);
    if (!memberId) {
      return c.json({ error: 'このグループのメンバーではありまん' }, 403);
    }
    
    const member = await kvGet(`group_member:${memberId}`);
    if (member.role !== 'admin') {
      return c.json({ error: '管理者権限が必要です' }, 403);
    }
    
    // 申請者のシフトを更新（その日を削除）
    const allApplications = await kvGetByPrefix('shift_application:');
    const requesterApp = allApplications
      .map(item => item.value)
      .find(app => app && app.shift_id === swapRequest.shift_id && app.user_email === swapRequest.requester_email);
    
    if (requesterApp && requesterApp.daily_schedule) {
      requesterApp.daily_schedule = requesterApp.daily_schedule.filter((d: any) => d.date !== swapRequest.date);
      
      // 全ての日が除された場合はステータスを変更
      const hasApprovedDays = requesterApp.daily_schedule.some((d: any) => d.status === 'approved');
      if (!hasApprovedDays) {
        requesterApp.status = 'rejected';
      } else {
        requesterApp.status = 'partially_approved';
      }
      
      await kvSet(`shift_application:${requesterApp.id}`, requesterApp);
    }
    
    // 交代者がいる場合のみ交代者のシフトを更新
    if (swapRequest.status === 'accepted' && swapRequest.accepter_email) {
      let accepterApp = allApplications
        .map(item => item.value)
        .find(app => app && app.shift_id === swapRequest.shift_id && app.user_email === swapRequest.accepter_email);
      
      if (accepterApp) {
        // 既存の応募がある場合は追加
        if (!accepterApp.daily_schedule) {
          accepterApp.daily_schedule = [];
        }
        accepterApp.daily_schedule.push({
          date: swapRequest.date,
          start_time: swapRequest.start_time,
          end_time: swapRequest.end_time,
          status: 'approved',
        });
        
        if (accepterApp.status !== 'approved') {
          accepterApp.status = 'partially_approved';
        }
        
        await kvSet(`shift_application:${accepterApp.id}`, accepterApp);
      } else {
        // 新規応募を作成
        const accepterMemberId = await kvGet(`group_member:group:${swapRequest.group_id}:user:${swapRequest.accepter_email}`);
        const accepterMember = await kvGet(`group_member:${accepterMemberId}`);
        
        const newAppId = Date.now() + Math.floor(Math.random() * 1000);
        const newApp = {
          id: newAppId,
          shift_id: swapRequest.shift_id,
          user_email: swapRequest.accepter_email,
          user_name: accepterMember.user_name || swapRequest.accepter_email,
          status: 'partially_approved',
          applied_at: new Date().toISOString(),
          daily_schedule: [{
            date: swapRequest.date,
            start_time: swapRequest.start_time,
            end_time: swapRequest.end_time,
            status: 'approved',
          }],
        };
        
        await kvSet(`shift_application:${newAppId}`, newApp);
      }
    }
    
    // 交代申請を承認済みに更新
    swapRequest.status = 'approved';
    swapRequest.admin_email = user.email;
    swapRequest.admin_comment = admin_comment || '';
    swapRequest.approved_at = new Date().toISOString();
    
    await kvSet(`shift_swap_request:${requestId}`, swapRequest);
    
    return c.json({ message: '交代を承認しました' });
  } catch (error: any) {
    console.error('Approve swap request error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// 交代申請を拒否（管理者のみ）
app.post("/make-server-aba46d8b/shift-swap-requests/:requestId/reject", async (c) => {
  try {
    const user = await getUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const requestId = parseInt(c.req.param('requestId'));
    const { admin_comment } = await c.req.json().catch(() => ({}));
    
    // 交代申請を取得
    const swapRequest = await kvGet(`shift_swap_request:${requestId}`);
    if (!swapRequest) {
      return c.json({ error: '交代申請が見かりません' }, 404);
    }
    
    if (swapRequest.status === 'approved' || swapRequest.status === 'rejected') {
      return c.json({ error: 'この申請はすでに処理されています' }, 400);
    }
    
    // 管理者かチェック
    const memberId = await kvGet(`group_member:group:${swapRequest.group_id}:user:${user.email}`);
    if (!memberId) {
      return c.json({ error: 'このグループのメンバーではありません' }, 403);
    }
    
    const member = await kvGet(`group_member:${memberId}`);
    if (member.role !== 'admin') {
      return c.json({ error: '管理者権限が必要です' }, 403);
    }
    
    // 交代申請を拒否
    swapRequest.status = 'rejected';
    swapRequest.admin_email = user.email;
    swapRequest.admin_comment = admin_comment || '';
    swapRequest.rejected_at = new Date().toISOString();
    
    await kvSet(`shift_swap_request:${requestId}`, swapRequest);
    if (swapRequest.status === 'pending') {
      await kvDelete(`shift_swap_request:shift:${swapRequest.shift_id}:date:${swapRequest.date}:pending`);
    }
    
    return c.json({ message: '交代申請を拒否しました' });
  } catch (error: any) {
    console.error('Reject swap request error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// 管理者用：グループの全承認済みシフトを取得（カレンダー用）
app.get("/make-server-aba46d8b/groups/:groupId/calendar", async (c) => {
  try {
    const user = await getUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const groupId = parseInt(c.req.param('groupId'));
    
    // グループメンバーかチェック
    const memberId = await kvGet(`group_member:group:${groupId}:user:${user.email}`);
    if (!memberId) {
      return c.json({ error: 'このグループのメンバーではありません' }, 403);
    }
    
    const member = await kvGet(`group_member:${memberId}`);
    if (member.role !== 'admin') {
      return c.json({ error: '管理者権限が必要です' }, 403);
    }
    
    // グループのすべてのシフトを取得
    const allShifts = await kvGetByPrefix('shift:');
    const groupShifts = allShifts
      .map(item => item.value)
      .filter(shift => shift && shift.group_id === groupId);
    
    // 各シフトの承認済み応募を取得
    const calendarEvents = [];
    
    for (const shift of groupShifts) {
      const allApplications = await kvGetByPrefix('shift_application:');
      const shiftApplications = allApplications
        .map(item => item.value)
        .filter(app => 
          app && 
          app.shift_id === shift.id && 
          (app.status === 'approved' || app.status === 'partially_approved')
        );
      
      // 各応募の日付別スケジュールを展開
      for (const app of shiftApplications) {
        if (app.daily_schedule && app.daily_schedule.length > 0) {
          // 承認済みの日付のみ
          const approvedDays = app.daily_schedule.filter((d: any) => d.status === 'approved');
          
          for (const day of approvedDays) {
            calendarEvents.push({
              shift_id: shift.id,
              shift_title: shift.title,
              user_email: app.user_email,
              user_name: app.user_name,
              date: day.date,
              start_time: day.start_time,
              end_time: day.end_time,
              location: shift.location,
            });
          }
        } else {
          // 日付別スケジュールがない場合（旧形式）
          // start_dateからend_dateまでの全日程を追加
          const startDate = new Date(shift.start_date);
          const endDate = new Date(shift.end_date);
          
          for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            calendarEvents.push({
              shift_id: shift.id,
              shift_title: shift.title,
              user_email: app.user_email,
              user_name: app.user_name,
              date: dateStr,
              start_time: shift.start_time,
              end_time: shift.end_time,
              location: shift.location,
            });
          }
        }
      }
    }
    
    return c.json(calendarEvents);
  } catch (error: any) {
    console.error('Get group calendar error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// グループの時給を更新（管理者のみ）
app.post("/make-server-aba46d8b/groups/:groupId/hourly-rate", async (c) => {
  try {
    const user = await getUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const groupId = parseInt(c.req.param('groupId'));
    const { hourly_rate } = await c.req.json();
    
    if (!hourly_rate || hourly_rate < 0) {
      return c.json({ error: '有効な時給を入力してください' }, 400);
    }
    
    // 管理者かチェック
    const memberId = await kvGet(`group_member:group:${groupId}:user:${user.email}`);
    if (!memberId) {
      return c.json({ error: 'このグループのメンバーではありません' }, 403);
    }
    
    const member = await kvGet(`group_member:${memberId}`);
    if (member.role !== 'admin') {
      return c.json({ error: '管理権限が必要です' }, 403);
    }
    
    // グループを更新
    const group = await kvGet(`group:${groupId}`);
    if (!group) {
      return c.json({ error: 'グループが見つかりません' }, 404);
    }
    
    group.hourly_rate = hourly_rate;
    await kvSet(`group:${groupId}`, group);
    
    return c.json({ message: '時給を更新しました', hourly_rate });
  } catch (error: any) {
    console.error('Update hourly rate error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// 給料計算（メンバー用）
app.get("/make-server-aba46d8b/groups/:groupId/salary", async (c) => {
  try {
    const user = await getUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const groupId = parseInt(c.req.param('groupId'));
    const month = c.req.query('month'); // YYYY-MM形式
    
    // グループメンバーかチェック
    const memberId = await kvGet(`group_member:group:${groupId}:user:${user.email}`);
    if (!memberId) {
      return c.json({ error: 'このグループのメンバーではありません' }, 403);
    }
    
    // グループの時給を取得
    const group = await kvGet(`group:${groupId}`);
    if (!group) {
      return c.json({ error: 'グループが見つかりません' }, 404);
    }
    
    const hourly_rate = group.hourly_rate || 1000;
    
    // ユーザーの承認済みシフトを取得
    const allApplications = await kvGetByPrefix('shift_application:');
    const userApplications = allApplications
      .map(item => item.value)
      .filter(app => 
        app && 
        app.user_email === user.email && 
        (app.status === 'approved' || app.status === 'partially_approved')
      );
    
    // シフト情報を取得して、グループに属するもののみフィルタ
    const shiftsData = [];
    for (const app of userApplications) {
      const shift = await kvGet(`shift:${app.shift_id}`);
      if (shift && shift.group_id === groupId) {
        shiftsData.push({ app, shift });
      }
    }
    
    // 月次勤務時間を計算
    let totalHours = 0;
    const dailyDetails = [];
    
    for (const { app, shift } of shiftsData) {
      if (app.daily_schedule && app.daily_schedule.length > 0) {
        const approvedDays = app.daily_schedule.filter((d: any) => d.status === 'approved');
        
        for (const day of approvedDays) {
          // 月のフィルタ（指定がある場合）
          if (month && !day.date.startsWith(month)) {
            continue;
          }
          
          // 勤務時間を計算
          const start = new Date(`2000-01-01T${day.start_time}`);
          const end = new Date(`2000-01-01T${day.end_time}`);
          const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          
          totalHours += hours;
          dailyDetails.push({
            date: day.date,
            shift_title: shift.title,
            start_time: day.start_time,
            end_time: day.end_time,
            hours,
            salary: hours * hourly_rate,
          });
        }
      }
    }
    
    const totalSalary = totalHours * hourly_rate;
    
    // 日付順にソート
    dailyDetails.sort((a, b) => a.date.localeCompare(b.date));
    
    return c.json({
      month: month || '全期間',
      hourly_rate,
      total_hours: Math.round(totalHours * 100) / 100,
      total_salary: Math.round(totalSalary),
      daily_details: dailyDetails,
    });
  } catch (error: any) {
    console.error('Calculate salary error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// ========== Filter Tags API ==========

// グループのフィルタータグ一覧取得
app.get("/make-server-aba46d8b/filter-tags/:groupId", async (c) => {
  const groupId = c.req.param('groupId');
  try {
    const value = await kvGet(`filter_tags:group:${groupId}`);
    return c.json({ tags: value ?? [] });
  } catch (error: any) {
    console.log('get filter tags error:', error.message);
    return c.json({ tags: [] });
  }
});

// グループのフィルタータグ保存
app.post("/make-server-aba46d8b/filter-tags/:groupId", async (c) => {
  const groupId = c.req.param('groupId');
  try {
    const { tags } = await c.req.json();
    await kvSet(`filter_tags:group:${groupId}`, tags);
    return c.json({ success: true });
  } catch (error: any) {
    console.log('save filter tags error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// メンバーのタグ割り当て取得
app.get("/make-server-aba46d8b/member-tags/:groupId/:email", async (c) => {
  const groupId = c.req.param('groupId');
  const email = decodeURIComponent(c.req.param('email'));
  try {
    const value = await kvGet(`member_tags:group:${groupId}:user:${email}`);
    return c.json({ tagIds: value ?? [] });
  } catch (error: any) {
    console.log('get member tags error:', error.message);
    return c.json({ tagIds: [] });
  }
});

// グループ全メンバーのタグ割り当て一括取得
app.get("/make-server-aba46d8b/member-tags/:groupId", async (c) => {
  const groupId = c.req.param('groupId');
  try {
    const prefix = `member_tags:group:${groupId}:user:`;
    const rows = await kvGetByPrefix(prefix);
    // { email: tagIds[] } の形に変換
    const memberTags: { [email: string]: string[] } = {};
    for (const row of rows) {
      const email = row.key.replace(prefix, '');
      memberTags[email] = row.value ?? [];
    }
    return c.json({ memberTags });
  } catch (error: any) {
    console.log('get all member tags error:', error.message);
    return c.json({ memberTags: {} });
  }
});

// メンバーのタグ割り当て保存
app.post("/make-server-aba46d8b/member-tags/:groupId/:email", async (c) => {
  const groupId = c.req.param('groupId');
  const email = decodeURIComponent(c.req.param('email'));
  try {
    const { tagIds } = await c.req.json();
    await kvSet(`member_tags:group:${groupId}:user:${email}`, tagIds);
    return c.json({ success: true });
  } catch (error: any) {
    console.log('save member tags error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

Deno.serve(app.fetch);