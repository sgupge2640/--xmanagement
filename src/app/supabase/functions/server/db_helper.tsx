// 新しいテーブル構造用のデータベースヘルパー関数
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// ========== Users ==========

export async function createUser(email: string, name: string) {
  const { data, error } = await supabase
    .from('users')
    .insert({ email, name })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getUserByEmail(email: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data;
}

export async function getOrCreateUser(email: string, name: string) {
  let user = await getUserByEmail(email);
  if (!user) {
    user = await createUser(email, name);
  }
  return user;
}

// ========== Groups ==========

export async function createGroup(params: {
  name: string;
  description?: string;
  code: string;
  created_by_email: string;
  hourly_rate?: number;
}) {
  // ユーザーを取得
  const user = await getUserByEmail(params.created_by_email);
  if (!user) throw new Error('User not found');

  const { data, error } = await supabase
    .from('groups')
    .insert({
      name: params.name,
      description: params.description || '',
      code: params.code,
      created_by: user.id,
      hourly_rate: params.hourly_rate || 1000,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getGroupById(id: number) {
  const { data, error } = await supabase
    .from('groups')
    .select(`
      *,
      creator:created_by(email, name)
    `)
    .eq('id', id)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getGroupByCode(code: string) {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('code', code)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function updateGroupHourlyRate(groupId: number, hourlyRate: number) {
  const { data, error } = await supabase
    .from('groups')
    .update({ hourly_rate: hourlyRate })
    .eq('id', groupId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteGroup(groupId: number) {
  const { error } = await supabase
    .from('groups')
    .delete()
    .eq('id', groupId);
  
  if (error) throw error;
}

// ========== Group Members ==========

export async function addGroupMember(params: {
  group_id: number;
  user_email: string;
  role: 'admin' | 'member';
  status?: 'pending' | 'active' | 'rejected';
}) {
  const user = await getUserByEmail(params.user_email);
  if (!user) throw new Error('User not found');

  const { data, error } = await supabase
    .from('group_members')
    .insert({
      group_id: params.group_id,
      user_id: user.id,
      role: params.role,
      status: params.status || 'active',
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getGroupMembers(groupId: number) {
  const { data, error } = await supabase
    .from('group_members')
    .select(`
      *,
      user:user_id(email, name)
    `)
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

export async function getUserGroups(userEmail: string) {
  const user = await getUserByEmail(userEmail);
  if (!user) return [];

  const { data, error } = await supabase
    .from('group_members')
    .select(`
      *,
      group:group_id(*)
    `)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('joined_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function updateMemberStatus(memberId: number, status: 'pending' | 'active' | 'rejected') {
  const { data, error } = await supabase
    .from('group_members')
    .update({ status })
    .eq('id', memberId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function removeMember(memberId: number) {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('id', memberId);
  
  if (error) throw error;
}

export async function isGroupAdmin(groupId: number, userEmail: string): Promise<boolean> {
  const user = await getUserByEmail(userEmail);
  if (!user) return false;

  const { data, error } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .single();
  
  return !!data;
}

// ========== Shifts ==========

export async function createShift(params: {
  group_id: number;
  title: string;
  description?: string;
  location?: string;
  start_date: string;
  end_date: string;
  created_by_email: string;
}) {
  const user = await getUserByEmail(params.created_by_email);
  if (!user) throw new Error('User not found');

  const { data, error } = await supabase
    .from('shifts')
    .insert({
      group_id: params.group_id,
      title: params.title,
      description: params.description || '',
      location: params.location || '',
      start_date: params.start_date,
      end_date: params.end_date,
      created_by: user.id,
      status: 'open',
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getShiftById(id: number) {
  const { data, error } = await supabase
    .from('shifts')
    .select(`
      *,
      creator:created_by(email, name),
      group:group_id(name, hourly_rate)
    `)
    .eq('id', id)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getGroupShifts(groupId: number) {
  const { data, error } = await supabase
    .from('shifts')
    .select(`
      *,
      creator:created_by(email, name)
    `)
    .eq('group_id', groupId)
    .order('start_date', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function updateShiftStatus(shiftId: number, status: 'open' | 'closed' | 'cancelled') {
  const { data, error } = await supabase
    .from('shifts')
    .update({ status })
    .eq('id', shiftId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// ========== Shift Applications ==========

export async function createShiftApplication(params: {
  shift_id: number;
  user_email: string;
  application_date: string;
  start_time: string;
  end_time: string;
}) {
  const user = await getUserByEmail(params.user_email);
  if (!user) throw new Error('User not found');

  const { data, error } = await supabase
    .from('shift_applications')
    .insert({
      shift_id: params.shift_id,
      user_id: user.id,
      application_date: params.application_date,
      start_time: params.start_time,
      end_time: params.end_time,
      status: 'pending',
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getShiftApplications(shiftId: number) {
  const { data, error } = await supabase
    .from('shift_applications')
    .select(`
      *,
      user:user_id(email, name)
    `)
    .eq('shift_id', shiftId)
    .order('applied_at', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

export async function getUserShiftApplications(userEmail: string, shiftId: number) {
  const user = await getUserByEmail(userEmail);
  if (!user) return [];

  const { data, error } = await supabase
    .from('shift_applications')
    .select('*')
    .eq('shift_id', shiftId)
    .eq('user_id', user.id);
  
  if (error) throw error;
  return data || [];
}

export async function updateApplicationStatus(
  applicationId: number,
  status: 'pending' | 'selected' | 'not_selected'
) {
  const { data, error } = await supabase
    .from('shift_applications')
    .update({ status })
    .eq('id', applicationId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// ========== Shift Results ==========

export async function createShiftResult(params: {
  shift_id: number;
  application_date: string;
  message?: string;
}) {
  const { data, error } = await supabase
    .from('shift_results')
    .insert({
      shift_id: params.shift_id,
      application_date: params.application_date,
      message: params.message || '',
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getShiftResults(shiftId: number) {
  const { data, error } = await supabase
    .from('shift_results')
    .select('*')
    .eq('shift_id', shiftId)
    .order('application_date', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

// ========== Shift Swaps ==========

export async function createShiftSwap(params: {
  shift_id: number;
  requester_email: string;
  swap_date: string;
  start_time: string;
  end_time: string;
  reason?: string;
}) {
  const user = await getUserByEmail(params.requester_email);
  if (!user) throw new Error('User not found');

  const { data, error } = await supabase
    .from('shift_swaps')
    .insert({
      shift_id: params.shift_id,
      requester_id: user.id,
      swap_date: params.swap_date,
      start_time: params.start_time,
      end_time: params.end_time,
      reason: params.reason || '',
      status: 'pending',
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getShiftSwaps(shiftId: number) {
  const { data, error } = await supabase
    .from('shift_swaps')
    .select(`
      *,
      requester:requester_id(email, name),
      responder:responder_id(email, name)
    `)
    .eq('shift_id', shiftId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function updateSwapResponder(swapId: number, responderEmail: string) {
  const user = await getUserByEmail(responderEmail);
  if (!user) throw new Error('User not found');

  const { data, error } = await supabase
    .from('shift_swaps')
    .update({ 
      responder_id: user.id,
      status: 'accepted'
    })
    .eq('id', swapId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateSwapStatus(
  swapId: number,
  status: 'pending' | 'accepted' | 'approved' | 'rejected',
  adminComment?: string
) {
  const updateData: any = { status };
  if (adminComment) updateData.admin_comment = adminComment;

  const { data, error } = await supabase
    .from('shift_swaps')
    .update(updateData)
    .eq('id', swapId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// ========== ユーティリティ ==========

export async function getFullGroupData(groupId: number) {
  const group = await getGroupById(groupId);
  if (!group) return null;

  const members = await getGroupMembers(groupId);
  const shifts = await getGroupShifts(groupId);

  return {
    ...group,
    members,
    shifts,
  };
}
