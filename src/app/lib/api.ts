// API通信ユーティリティ（Supabase直接アクセス版）
import { getSupabaseClient } from './supabase';
import * as auth from './auth';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-9d73baa6`;

// ランダムなグループコード生成
function generateGroupCode(): string {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// ========== User Profile API ==========

// プロフィール更新（名前とメールアドレス）
export async function updateProfile(name: string, email: string) {
  const supabase = getSupabaseClient();
  const currentEmail = auth.getEmail();
  
  if (!currentEmail) throw new Error('ログインが必要です');
  
  // Supabase Authの更新（エラーが出ても無視）
  try {
    if (currentEmail !== email) {
      // メールアドレスが変更された場合
      await supabase.auth.updateUser({
        email: email,
        data: {
          name: name,
        }
      });
    } else {
      // メールアドレスが同じ場合は名前だけ更新
      await supabase.auth.updateUser({
        data: {
          name: name,
        }
      });
    }
  } catch (authError: any) {
    // Supabase Authのエラーは無視して続行
    console.log('Auth update skipped (continuing with DB update):', authError?.message);
  }
  
  // usersテーブルを更新（こちらが本命）
  const { error: dbError } = await supabase
    .from('users')
    .update({
      name: name,
      email: email,
    })
    .eq('email', currentEmail);
  
  if (dbError) {
    console.error('Failed to update users table:', dbError);
    throw new Error('ユーザー情報の更新に失敗しました');
  }
  
  // group_membersテーブルのuser_emailとuser_nameも更新
  if (currentEmail !== email) {
    // メールアドレスが変更された場合、全ての関連テーブルを更新
    const { error: memberError } = await supabase
      .from('group_members')
      .update({
        user_email: email,
        user_name: name,
      })
      .eq('user_email', currentEmail);
    
    if (memberError) {
      console.error('Failed to update group_members:', memberError);
    }
    
    // shift_applicationsテーブルのuser_emailも更新
    const { error: applicationError } = await supabase
      .from('shift_applications')
      .update({
        user_email: email,
      })
      .eq('user_email', currentEmail);
    
    if (applicationError) {
      console.error('Failed to update shift_applications:', applicationError);
    }
    
    // shift_assignmentsテーブルのuser_emailも更新
    const { error: assignmentError } = await supabase
      .from('shift_assignments')
      .update({
        user_email: email,
      })
      .eq('user_email', currentEmail);
    
    if (assignmentError) {
      console.error('Failed to update shift_assignments:', assignmentError);
    }
    
    // swap_requestsテーブルのrequester_emailとtarget_emailも更新
    const { error: swapRequesterError } = await supabase
      .from('swap_requests')
      .update({
        requester_email: email,
      })
      .eq('requester_email', currentEmail);
    
    if (swapRequesterError) {
      console.error('Failed to update swap_requests (requester):', swapRequesterError);
    }
    
    const { error: swapTargetError } = await supabase
      .from('swap_requests')
      .update({
        target_email: email,
      })
      .eq('target_email', currentEmail);
    
    if (swapTargetError) {
      console.error('Failed to update swap_requests (target):', swapTargetError);
    }
  } else {
    // メールアドレスが変わらない場合は名前だけ更新
    const { error: memberError } = await supabase
      .from('group_members')
      .update({
        user_name: name,
      })
      .eq('user_email', currentEmail);
    
    if (memberError) {
      console.error('Failed to update group_members name:', memberError);
    }
  }
  
  return { success: true };
}

// パスワード変更
export async function updatePassword(currentPassword: string, newPassword: string) {
  const supabase = getSupabaseClient();
  const email = auth.getEmail();
  
  if (!email) throw new Error('ログインが必要です');
  
  // 現在のパスワードで再認証
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: email,
    password: currentPassword,
  });
  
  if (signInError) {
    throw new Error('現在のパスワードが正しくありません');
  }
  
  // パスワードを更新
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });
  
  if (updateError) throw updateError;
  
  return { success: true };
}

// パスワード再設定（ログイン不可時: メールアドレス + 名前で本人確認）
export async function resetPasswordByEmailAndName(email: string, name: string, newPassword: string) {
  const response = await fetch(`${SERVER_URL}/auth/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${publicAnonKey}`,
    },
    body: JSON.stringify({ email, name, newPassword }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'パスワード再設定に失敗しました');
  }

  return { success: true, message: data.message || 'パスワードを再設定しました' };
}

// ========== Group API ==========

// グループ作成
export async function createGroup(name: string, description: string) {
  const supabase = getSupabaseClient();
  const userEmail = auth.getEmail();
  const userName = auth.getName();
  
  if (!userEmail) throw new Error('ログインが必要です');
  
  // グループコード生成
  const code = generateGroupCode();
  
  // グループを作成
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({
      name,
      description,
      code,
      created_by: userEmail,
    })
    .select()
    .single();
  
  if (groupError) throw groupError;
  
  // 作成者を管理者として追加
  const { error: memberError } = await supabase
    .from('group_members')
    .insert({
      group_id: group.id,
      user_email: userEmail,
      user_name: userName || 'Unknown',
      role: 'admin',
    });
  
  if (memberError) throw memberError;
  
  return { group, code };
}

// グループに参加（加リクエストを作成）
export async function joinGroup(code: string) {
  const supabase = getSupabaseClient();
  const userEmail = auth.getEmail();
  const userName = auth.getName();
  
  if (!userEmail) throw new Error('ログインが必要です');
  
  // コードでグループを検索
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('*')
    .eq('code', code)
    .single();
  
  if (groupError || !group) {
    throw new Error('グループが見つかりません');
  }
  
  // 既にメンバーかチェック
  const { data: existingMember } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', group.id)
    .eq('user_email', userEmail)
    .single();
  
  if (existingMember) {
    throw new Error('既にこのグループのメンバーです');
  }
  
  // 既存レコードを確認（pending なら再送不可、それ以外なら上書き）
  const { data: existingRequest } = await supabase
    .from('join_requests')
    .select('id, status')
    .eq('group_id', group.id)
    .eq('user_email', userEmail)
    .maybeSingle();

  if (existingRequest?.status === 'pending') {
    throw new Error('既に参加リクエストを送信しています');
  }

  // 既存レコードがあれば削除してから新規作成
  if (existingRequest) {
    await supabase.from('join_requests').delete().eq('id', existingRequest.id);
  }

  // 参加リクエストを作成
  const { data: request, error: requestError } = await supabase
    .from('join_requests')
    .insert({
      group_id: group.id,
      user_email: userEmail,
      user_name: userName || 'Unknown',
      status: 'pending',
    })
    .select()
    .single();

  if (requestError) throw requestError;
  
  return { group, request };
}

// 自分のグループ一覧
export async function getMyGroups() {
  const supabase = getSupabaseClient();
  const userEmail = auth.getEmail();
  
  if (!userEmail) throw new Error('ログインが必要です');
  
  // まずメンバーシップを取得
  const { data: memberships, error: memberError } = await supabase
    .from('group_members')
    .select('group_id, role')
    .eq('user_email', userEmail);
  
  if (memberError) throw memberError;
  
  if (!memberships || memberships.length === 0) {
    return { groups: [] };
  }
  
  // 次にグループ情報を取得（RLS循環参照を回避）
  const groupIds = memberships.map(m => m.group_id);
  const { data: groupsData, error: groupsError } = await supabase
    .from('groups')
    .select('*')
    .in('id', groupIds);
  
  if (groupsError) throw groupsError;
  
  // メンバーシップとグループ情報を結合
  const groups = groupsData.map((group: any) => {
    const membership = memberships.find(m => m.group_id === group.id);
    return {
      ...group,
      role: membership?.role || 'member',
    };
  });
  
  return { groups };
}

// グループの参加リクエスト一覧を取得（管理者のみ）
export async function getJoinRequests(groupId: number) {
  const supabase = getSupabaseClient();
  
  const { data: requests, error } = await supabase
    .from('join_requests')
    .select('*')
    .eq('group_id', groupId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  
  return { requests };
}

// 参加リクエストを承認（管理者のみ）
export async function approveJoinRequest(requestId: number) {
  const supabase = getSupabaseClient();
  
  // リクエスト情報を取得
  const { data: request, error: fetchError } = await supabase
    .from('join_requests')
    .select('*')
    .eq('id', requestId)
    .single();
  
  if (fetchError || !request) throw new Error('リクエストが見つかりません');
  
  // グループメンバーに追加
  const { error: memberError } = await supabase
    .from('group_members')
    .insert({
      group_id: request.group_id,
      user_email: request.user_email,
      user_name: request.user_name,
      role: 'member',
    });
  
  if (memberError) throw memberError;
  
  // リクエストのステータスを更新
  const { error: updateError } = await supabase
    .from('join_requests')
    .update({ status: 'approved' })
    .eq('id', requestId);
  
  if (updateError) throw updateError;
  
  return { message: '参加リクエストを承認しました' };
}

// 参加リクエストを拒否（管理者のみ）- レコードを削除して再送可能にする
export async function rejectJoinRequest(requestId: number) {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('join_requests')
    .delete()
    .eq('id', requestId);

  if (error) throw error;

  return { message: '参加リクエストを破棄しました' };
}

// グループメンバー一覧を取得
export async function getGroupMembers(groupId: number) {
  const supabase = getSupabaseClient();
  
  const { data: members, error } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: false });
  
  if (error) throw error;
  
  return { members };
}

// メンバーを削除（管理者のみ）
export async function deleteMember(groupId: number, userEmail: string) {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_email', userEmail);
  
  if (error) throw error;
  
  return { message: 'メンバーを削除しました' };
}

// グループの時給を更新（管理者のみ）
export async function updateHourlyRate(groupId: number, hourly_rate: number) {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('groups')
    .update({ hourly_rate })
    .eq('id', groupId);
  
  if (error) throw error;
  
  return { message: '時給を更新しました', hourly_rate };
}

// グループを削除（管理者のみ）
export async function deleteGroup(groupId: number) {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('groups')
    .delete()
    .eq('id', groupId);
  
  if (error) throw error;
  
  return { message: 'グループを削除しました' };
}

// ========== Shift API ==========

// シフト作成（管理者のみ）
export async function createShift(groupId: number, shiftData: {
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  application_deadline: string;
  location?: string;
}) {
  const supabase = getSupabaseClient();
  const userEmail = auth.getEmail();
  
  if (!userEmail) throw new Error('ログインが必要です');
  
  const { data: shift, error } = await supabase
    .from('shifts')
    .insert({
      group_id: groupId,
      title: shiftData.title,
      description: shiftData.description,
      start_date: shiftData.start_date,
      end_date: shiftData.end_date,
      start_time: shiftData.start_time,
      end_time: shiftData.end_time,
      location: shiftData.location,
      required_people: 0, // デフォト値（後で管理画面で設定可能）
      application_deadline: shiftData.application_deadline,
      created_by: userEmail,
    })
    .select()
    .single();
  
  if (error) throw error;
  
  return { shift };
}

// シフト編集（管理者のみ）
export async function updateShift(shiftId: number, shiftData: {
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  application_deadline: string;
  location?: string;
}) {
  const supabase = getSupabaseClient();
  const userEmail = auth.getEmail();
  
  if (!userEmail) throw new Error('ログインが必要です');
  
  const { data: shift, error } = await supabase
    .from('shifts')
    .update({
      title: shiftData.title,
      description: shiftData.description,
      start_date: shiftData.start_date,
      end_date: shiftData.end_date,
      start_time: shiftData.start_time,
      end_time: shiftData.end_time,
      location: shiftData.location,
      application_deadline: shiftData.application_deadline,
    })
    .eq('id', shiftId)
    .select()
    .single();
  
  if (error) throw error;
  
  return { shift };
}

// グループのシフト一覧取得
export async function getShifts(groupId: number) {
  const supabase = getSupabaseClient();
  const userEmail = auth.getEmail();
  
  try {
    // まずシフトのみを取得
    const { data: shifts, error: shiftsError } = await supabase
      .from('shifts')
      .select('*')
      .eq('group_id', groupId)
      .order('start_date', { ascending: false });
    
    if (shiftsError) {
      console.error('シフト取得エラー:', shiftsError);
      throw new Error('シフトの取得に失敗しました。RLSを無効化してください。');
    }
    
    if (!shifts || shifts.length === 0) {
      return { shifts: [] };
    }
    
    // 次に、各シフトの応募を取得（RLS循環参照を回避）
    const shiftsWithApplications = await Promise.all(
      shifts.map(async (shift: any) => {
        const { data: applications } = await supabase
          .from('shift_applications')
          .select('id, user_email, user_name, status')
          .eq('shift_id', shift.id);
        
        // 承認数と承認待ち数を計算
        const approved_count = (applications || []).filter(
          (app: any) => app.status === 'approved' || app.status === 'partially_approved'
        ).length;
        const pending_count = (applications || []).filter(
          (app: any) => app.status === 'pending'
        ).length;
        
        // 現在のユーザーの応募状況を取得
        const userApplication = (applications || []).find(
          (app: any) => app.user_email === userEmail
        );
        
        return {
          ...shift,
          shift_applications: applications || [],
          approved_count,
          pending_count,
          user_application_status: userApplication?.status || null,
        };
      })
    );
    
    return { shifts: shiftsWithApplications };
  } catch (error: any) {
    console.error('シフト取得エラー:', error);
    if (error.message?.includes('infinite recursion')) {
      throw new Error('RLSエラー: Supabaseダッシュボードで /database/SIMPLE_FIX_RLS.sql を実行してください');
    }
    throw error;
  }
}

// シフト詳細取得
export async function getShiftDetail(shiftId: number) {
  const supabase = getSupabaseClient();
  
  // シフト情報を取得
  const { data: shift, error: shiftError } = await supabase
    .from('shifts')
    .select('*, groups!inner(name)')
    .eq('id', shiftId)
    .single();
  
  if (shiftError) throw shiftError;
  
  // シフト応募を取得
  const { data: applications, error: appError } = await supabase
    .from('shift_applications')
    .select('id, user_email, user_name, status, applied_at, desired_shifts_per_week')
    .eq('shift_id', shiftId);
  
  if (appError) throw appError;
  
  // 各応募の日別スケジュールを取得
  const applicationsWithSchedules = await Promise.all(
    (applications || []).map(async (app: any) => {
      const { data: schedules } = await supabase
        .from('daily_schedules')
        .select('id, date, start_time, end_time, status')
        .eq('application_id', app.id);
      
      return {
        ...app,
        daily_schedule: schedules || [], // daily_schedule として返す
      };
    })
  );
  
  // 管理者かどうかチェック
  const userEmail = auth.getEmail();
  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', shift.group_id)
    .eq('user_email', userEmail)
    .single();
  
  const isAdmin = membership?.role === 'admin';
  
  // 未応募メンバーのリストを取得（管理者のみ）
  let unappliedMembers: any[] = [];
  if (isAdmin) {
    const { data: allMembers } = await supabase
      .from('group_members')
      .select('user_email, user_name, role')
      .eq('group_id', shift.group_id);
    
    if (allMembers) {
      const appliedEmails = new Set(applications?.map(app => app.user_email) || []);
      // 管理者を除外して未応募メンバーをフィルタ
      unappliedMembers = allMembers.filter(member => 
        !appliedEmails.has(member.user_email) && member.role !== 'admin'
      );
    }
  }
  
  return {
    shift: {
      ...shift,
      group_name: shift.groups?.name || 'グループ',
    },
    applications: applicationsWithSchedules,
    is_admin: isAdmin,
    unapplied_members: unappliedMembers,
  };
}

// シフトに応募
export async function applyToShift(
  shiftId: number,
  dailySchedule: Array<{
    date: string;
    start_time: string;
    end_time: string;
  }>,
  desiredShiftsPerWeek?: number
) {
  const supabase = getSupabaseClient();
  const userEmail = auth.getEmail();
  const userName = auth.getName();

  if (!userEmail) throw new Error('ログインが必要です');

  // 既存の pending 応募があれば削除して上書き
  const { data: existing } = await supabase
    .from('shift_applications')
    .select('id')
    .eq('shift_id', shiftId)
    .eq('user_email', userEmail)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) {
    await supabase.from('daily_schedules').delete().eq('application_id', existing.id);
    await supabase.from('shift_applications').delete().eq('id', existing.id);
  }

  // 応募レコードを作成
  const { data: application, error: appError } = await supabase
    .from('shift_applications')
    .insert({
      shift_id: shiftId,
      user_email: userEmail,
      user_name: userName || 'Unknown',
      status: 'pending',
      desired_shifts_per_week: desiredShiftsPerWeek || null,
    })
    .select()
    .single();

  if (appError) throw appError;
  
  // 日別スケジュールを登録
  const schedules = dailySchedule.map(schedule => ({
    application_id: application.id,
    date: schedule.date,
    start_time: schedule.start_time,
    end_time: schedule.end_time,
    status: 'pending',
  }));
  
  const { error: scheduleError } = await supabase
    .from('daily_schedules')
    .insert(schedules);
  
  if (scheduleError) throw scheduleError;
  
  return { application };
}

// シフト応募を承認（管理者のみ）
export async function approveShiftApplication(
  applicationId: number,
  approvedDates?: Array<{ date: string; start_time?: string; end_time?: string }>
) {
  const supabase = getSupabaseClient();

  if (approvedDates) {
    // 指定された日付のみ承認
    for (const dateInfo of approvedDates) {
      const updateData: Record<string, string> = { status: 'approved' };
      // start_time/end_timeが指定された場合のみ上書き（グリッド採用では上書きしない）
      if (dateInfo.start_time !== undefined) updateData.start_time = dateInfo.start_time;
      if (dateInfo.end_time !== undefined) updateData.end_time = dateInfo.end_time;
      const { error } = await supabase
        .from('daily_schedules')
        .update(updateData)
        .eq('application_id', applicationId)
        .eq('date', dateInfo.date);

      if (error) throw error;
    }
    
    // 応募全体のステータスを再計算
    const { data: allSchedules } = await supabase
      .from('daily_schedules')
      .select('status')
      .eq('application_id', applicationId);
    
    if (allSchedules) {
      const hasApproved = allSchedules.some(s => s.status === 'approved');
      const hasPending = allSchedules.some(s => s.status === 'pending');
      const allRejected = allSchedules.every(s => s.status === 'rejected');
      
      let newStatus = 'pending';
      if (allRejected) {
        newStatus = 'rejected';
      } else if (hasApproved && hasPending) {
        newStatus = 'partially_approved';
      } else if (hasApproved) {
        newStatus = 'approved';
      }
      
      const { error: appError } = await supabase
        .from('shift_applications')
        .update({ status: newStatus })
        .eq('id', applicationId);
      
      if (appError) throw appError;
    }
  } else {
    // 全承認：すべての日付を承認
    const { error } = await supabase
      .from('daily_schedules')
      .update({ status: 'approved' })
      .eq('application_id', applicationId);
    
    if (error) throw error;
    
    // 応募ステータスを更新
    const { error: appError } = await supabase
      .from('shift_applications')
      .update({ status: 'approved' })
      .eq('id', applicationId);
    
    if (appError) throw appError;
  }
  
  return { message: 'シフト応募を承認しました' };
}

// シフト応募を拒否（管理者のみ）
export async function rejectShiftApplication(applicationId: number) {
  const supabase = getSupabaseClient();
  
  // 応募ステータスを更新
  const { error: appError } = await supabase
    .from('shift_applications')
    .update({ status: 'rejected' })
    .eq('id', applicationId);
  
  if (appError) throw appError;
  
  // すべての日別スケジュールも拒否
  const { error: scheduleError } = await supabase
    .from('daily_schedules')
    .update({ status: 'rejected' })
    .eq('application_id', applicationId);
  
  if (scheduleError) throw scheduleError;
  
  return { message: 'シフト応募を拒否しました' };
}

// 応募なしで直接採用（管理者のみ）
export async function directHireMember(
  shiftId: number,
  date: string,
  userEmail: string,
  userName: string,
  startTime: string,
  endTime: string
) {
  const supabase = getSupabaseClient();

  // 既存の応募を確認
  const { data: existing } = await supabase
    .from('shift_applications')
    .select('id, status')
    .eq('shift_id', shiftId)
    .eq('user_email', userEmail)
    .maybeSingle();

  let applicationId: number;

  if (existing) {
    // 既存応募があればそれを使う
    applicationId = existing.id;
    // daily_schedules にその日がなければ追加
    const { data: existingSchedule } = await supabase
      .from('daily_schedules')
      .select('id')
      .eq('application_id', applicationId)
      .eq('date', date)
      .maybeSingle();

    if (existingSchedule) {
      const { error } = await supabase
        .from('daily_schedules')
        .update({ status: 'direct_approved', start_time: startTime, end_time: endTime })
        .eq('id', existingSchedule.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('daily_schedules')
        .insert({ application_id: applicationId, date, start_time: startTime, end_time: endTime, status: 'direct_approved' });
      if (error) throw error;
    }
  } else {
    // 新規応募レコードを作成（直接採用）
    const { data: app, error: appError } = await supabase
      .from('shift_applications')
      .insert({ shift_id: shiftId, user_email: userEmail, user_name: userName, status: 'approved' })
      .select()
      .single();
    if (appError) throw appError;
    applicationId = app.id;

    const { error: schedError } = await supabase
      .from('daily_schedules')
      .insert({ application_id: applicationId, date, start_time: startTime, end_time: endTime, status: 'direct_approved' });
    if (schedError) throw schedError;
  }

  // application の status を再計算
  const { data: allSchedules } = await supabase
    .from('daily_schedules')
    .select('status')
    .eq('application_id', applicationId);

  if (allSchedules) {
    const hasApproved = allSchedules.some(s => s.status === 'approved' || s.status === 'direct_approved');
    const hasPending = allSchedules.some(s => s.status === 'pending');
    await supabase
      .from('shift_applications')
      .update({ status: hasApproved && hasPending ? 'partially_approved' : hasApproved ? 'approved' : 'pending' })
      .eq('id', applicationId);
  }

  return { message: '直接採用しました' };
}

// 直接採用を取り消し（管理者のみ）
export async function cancelDirectHire(applicationId: number, date: string) {
  const supabase = getSupabaseClient();

  // その日の direct_approved スケジュールを削除
  await supabase
    .from('daily_schedules')
    .delete()
    .eq('application_id', applicationId)
    .eq('date', date)
    .eq('status', 'direct_approved');

  // 残りのスケジュールを確認
  const { data: remaining } = await supabase
    .from('daily_schedules')
    .select('id')
    .eq('application_id', applicationId);

  if (!remaining || remaining.length === 0) {
    // スケジュールが全て消えたら応募レコードごと削除
    await supabase.from('shift_applications').delete().eq('id', applicationId);
  }

  return { message: '直接採用を取り消しました' };
}

// シフト応募を取り消し（メンバー用）
export async function cancelShiftApplication(applicationId: number) {
  const supabase = getSupabaseClient();
  const userEmail = auth.getEmail();
  
  if (!userEmail) throw new Error('ログインが必要です');
  
  // 自分の応募かチェック
  const { data: application, error: checkError } = await supabase
    .from('shift_applications')
    .select('user_email')
    .eq('id', applicationId)
    .single();
  
  if (checkError || !application) {
    throw new Error('応募が見つかりません');
  }
  
  if (application.user_email !== userEmail) {
    throw new Error('他人の応募は取り消せません');
  }
  
  // 日別スケジュールを削除
  const { error: scheduleError } = await supabase
    .from('daily_schedules')
    .delete()
    .eq('application_id', applicationId);
  
  if (scheduleError) throw scheduleError;
  
  // 応募を削除
  const { error: appError } = await supabase
    .from('shift_applications')
    .delete()
    .eq('id', applicationId);
  
  if (appError) throw appError;
  
  return { message: 'シフト応募を取り消しました' };
}

// 応募時間の手動修正（過去バグで上書きされた希望時間を復元するため）
export async function fixDailyScheduleTime(
  applicationId: number,
  date: string,
  startTime: string,
  endTime: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('daily_schedules')
    .update({ start_time: startTime, end_time: endTime })
    .eq('application_id', applicationId)
    .eq('date', date);
  if (error) throw error;
}

// シフト応募の承認を取り消し（管理者のみ）
export async function unapproveShiftApplication(
  applicationId: number,
  dates: string[]
) {
  const supabase = getSupabaseClient();
  
  // 指定された日付の承認を取り消し
  for (const date of dates) {
    const { error } = await supabase
      .from('daily_schedules')
      .update({ status: 'pending' })
      .eq('application_id', applicationId)
      .eq('date', date);
    
    if (error) throw error;
  }
  
  // 応募全体のステータスを再計算
  const { data: allSchedules } = await supabase
    .from('daily_schedules')
    .select('status')
    .eq('application_id', applicationId);
  
  if (allSchedules) {
    const hasApproved = allSchedules.some(s => s.status === 'approved');
    const hasPending = allSchedules.some(s => s.status === 'pending');
    const allRejected = allSchedules.every(s => s.status === 'rejected');
    
    let newStatus = 'pending';
    if (allRejected) {
      newStatus = 'rejected';
    } else if (hasApproved && hasPending) {
      newStatus = 'partially_approved';
    } else if (hasApproved) {
      newStatus = 'approved';
    }
    
    const { error: appError } = await supabase
      .from('shift_applications')
      .update({ status: newStatus })
      .eq('id', applicationId);
    
    if (appError) throw appError;
  }
  
  return { message: 'シフト承認を取り消しました' };
}

// シフトの採用結果を発表（管理者のみ）
export async function publishShiftResults(shiftId: number, message?: string) {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('shifts')
    .update({
      results_published: true,
      results_message: message || '結果を発表しました',
      results_published_at: new Date().toISOString(),
    })
    .eq('id', shiftId);
  
  if (error) throw error;
  
  return { message: '結果を発表しました' };
}

// シフトの採用結果発表を取り消し（管理者のみ）
export async function unpublishShiftResults(shiftId: number) {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('shifts')
    .update({
      results_published: false,
      results_message: null,
      results_published_at: null,
    })
    .eq('id', shiftId);
  
  if (error) throw error;
  
  return { message: '結果発表を取り消しました' };
}

// ユーザーの全シフトを取得（カレンダー用）
export async function getMyShifts() {
  const supabase = getSupabaseClient();
  const userEmail = auth.getEmail();
  
  if (!userEmail) throw new Error('ログインが必要です');
  
  const { data: applications, error } = await supabase
    .from('shift_applications')
    .select(`
      id,
      status,
      shifts (
        id,
        title,
        group_id,
        start_date,
        end_date,
        start_time,
        end_time,
        location,
        results_published,
        results_message
      ),
      daily_schedules (
        date,
        start_time,
        end_time,
        status
      )
    `)
    .eq('user_email', userEmail)
    .in('status', ['approved', 'partially_approved']);
  
  if (error) throw error;
  
  return { applications };
}

// 管理者用：グループの全承認済みシフトを取得（カレンダー用）
export async function getGroupCalendar(groupId: number) {
  const supabase = getSupabaseClient();
  
  const { data: shifts, error } = await supabase
    .from('shifts')
    .select(`
      id,
      title,
      start_date,
      end_date,
      start_time,
      end_time,
      location,
      results_published,
      results_message,
      shift_applications!inner (
        user_name,
        status,
        daily_schedules (
          date,
          start_time,
          end_time,
          status
        )
      )
    `)
    .eq('group_id', groupId)
    .in('shift_applications.status', ['approved', 'partially_approved']);
  
  if (error) throw error;
  
  return { shifts };
}

// 給料計算（メンバー用）
export async function getSalary(groupId: number, month?: string) {
  const supabase = getSupabaseClient();
  const userEmail = auth.getEmail();
  
  if (!userEmail) throw new Error('ログインが必要です');
  
  // グループ情報（時給）を取得
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('hourly_rate')
    .eq('id', groupId)
    .single();
  
  if (groupError) throw groupError;
  
  // 承認されたシフトを取得
  const { data: applications, error } = await supabase
    .from('shift_applications')
    .select(`
      id,
      shifts!inner (
        id,
        title,
        group_id
      ),
      daily_schedules!inner (
        date,
        start_time,
        end_time,
        status
      )
    `)
    .eq('user_email', userEmail)
    .eq('shifts.group_id', groupId)
    .eq('daily_schedules.status', 'approved');
  
  if (error) throw error;
  
  // 労働時間を計算
  let totalHours = 0;
  const schedules: any[] = [];
  
  applications.forEach((app: any) => {
    const shiftTitle = app.shifts?.title || 'シフト';
    app.daily_schedules.forEach((schedule: any) => {
      // 月でフィルタ（JavaScript側で実施）
      if (month) {
        const scheduleMonth = schedule.date.slice(0, 7); // YYYY-MM形式
        if (scheduleMonth !== month) {
          return; // この日付はスキップ
        }
      }
      
      const start = new Date(`2000-01-01 ${schedule.start_time}`);
      const end = new Date(`2000-01-01 ${schedule.end_time}`);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      const dailySalary = hours * (group.hourly_rate || 1000);
      totalHours += hours;
      schedules.push({
        shift_title: shiftTitle,
        date: schedule.date,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        hours,
        salary: dailySalary,
      });
    });
  });
  
  const salary = totalHours * (group.hourly_rate || 1000);
  
  return {
    total_hours: totalHours,
    hourly_rate: group.hourly_rate || 1000,
    total_salary: salary,
    daily_details: schedules, // schedules を daily_details として返す
    month: month || '全期間', // 月情報を追加
  };
}

// ========== Swap Request API ==========

// シフト交代申請を作成
export async function createSwapRequest(data: {
  shift_id: number;
  group_id: number;
  date: string;
  start_time: string;
  end_time: string;
  reason: string;
}) {
  const supabase = getSupabaseClient();
  const userEmail = auth.getEmail();
  const userName = auth.getName();
  
  if (!userEmail) throw new Error('ログインが必要です');
  
  // 自分の応募を取得
  const { data: application, error: appError } = await supabase
    .from('shift_applications')
    .select('id')
    .eq('shift_id', data.shift_id)
    .eq('user_email', userEmail)
    .single();
  
  if (appError || !application) {
    throw new Error('このシフトに応募していません');
  }
  
  // 交代申請を作成
  const { data: request, error } = await supabase
    .from('swap_requests')
    .insert({
      shift_id: data.shift_id,
      application_id: application.id,
      requester_email: userEmail,
      requester_name: userName || 'Unknown',
      date: data.date,
      start_time: data.start_time,
      end_time: data.end_time,
      reason: data.reason,
      status: 'pending',
    })
    .select()
    .single();
  
  if (error) throw error;
  
  return { request };
}

// 交代申請一覧を取得
export async function getSwapRequests(groupId: number) {
  const supabase = getSupabaseClient();

  const { data: requests, error } = await supabase
    .from('swap_requests')
    .select(`
      *,
      shifts!inner (
        id,
        title,
        group_id
      )
    `)
    .eq('shifts.group_id', groupId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // 各リクエストの応募者リストを取得
  const requestsWithApplicants = await Promise.all(
    (requests || []).map(async (request) => {
      const { data: applicants, error: applicantsError } = await supabase
        .from('swap_applicants')
        .select('*')
        .eq('swap_request_id', request.id)
        .order('applied_at', { ascending: true });

      if (applicantsError) {
        console.error('応募者の取得エラー:', applicantsError);
      }

      return {
        ...request,
        applicants: applicants || [],
      };
    })
  );

  return { requests: requestsWithApplicants };
}

// 交代申請に応募（代わりに入る）
export async function acceptSwapRequest(requestId: number) {
  const supabase = getSupabaseClient();
  const userEmail = auth.getEmail();
  const userName = auth.getName();

  if (!userEmail) throw new Error('ログインが必要です');

  // swap_applicantsテーブルに応募者を追加
  const { error: applicantError } = await supabase
    .from('swap_applicants')
    .insert({
      swap_request_id: requestId,
      applicant_email: userEmail,
      applicant_name: userName || 'Unknown',
    });

  if (applicantError) {
    if (applicantError.message.includes('duplicate')) {
      throw new Error('既にこの交代申請に応募しています');
    }
    throw applicantError;
  }

  return { message: '交代を申し出ました' };
}

// 交代申請を承認（管理者のみ）
export async function approveSwapRequest(
  requestId: number,
  admin_comment?: string,
  selectedApplicantEmail?: string
) {
  const supabase = getSupabaseClient();

  // 交代申請の詳細を取得
  const { data: swapRequest, error: fetchError } = await supabase
    .from('swap_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (fetchError || !swapRequest) throw new Error('交代申請が見つかりません');

  const updateData: any = {
    status: 'approved',
    admin_comment: admin_comment || '',
  };

  if (selectedApplicantEmail) {
    const { data: applicant } = await supabase
      .from('swap_applicants')
      .select('*')
      .eq('swap_request_id', requestId)
      .eq('applicant_email', selectedApplicantEmail)
      .single();

    if (applicant) {
      updateData.replacement_email = applicant.applicant_email;
      updateData.replacement_name = applicant.applicant_name;

      // 1. 申請者のdaily_schedulesから該当日を削除
      const { data: requesterApp } = await supabase
        .from('shift_applications')
        .select('id')
        .eq('shift_id', swapRequest.shift_id)
        .eq('user_email', swapRequest.requester_email)
        .single();

      if (requesterApp) {
        await supabase
          .from('daily_schedules')
          .delete()
          .eq('application_id', requesterApp.id)
          .eq('date', swapRequest.date);
      }

      // 2. 交代者のshift_applicationを取得または作成
      const { data: existingApp } = await supabase
        .from('shift_applications')
        .select('id')
        .eq('shift_id', swapRequest.shift_id)
        .eq('user_email', applicant.applicant_email)
        .single();

      let replacementAppId: number;

      if (existingApp) {
        replacementAppId = existingApp.id;
      } else {
        const { data: newApp, error: newAppError } = await supabase
          .from('shift_applications')
          .insert({
            shift_id: swapRequest.shift_id,
            user_email: applicant.applicant_email,
            user_name: applicant.applicant_name,
            status: 'approved',
          })
          .select('id')
          .single();

        if (newAppError || !newApp) throw new Error('交代者の応募レコード作成に失敗しました');
        replacementAppId = newApp.id;
      }

      // 3. 交代者のdaily_schedulesに該当日を追加（重複防止）
      await supabase
        .from('daily_schedules')
        .delete()
        .eq('application_id', replacementAppId)
        .eq('date', swapRequest.date);

      await supabase
        .from('daily_schedules')
        .insert({
          application_id: replacementAppId,
          date: swapRequest.date,
          start_time: swapRequest.start_time,
          end_time: swapRequest.end_time,
          status: 'approved',
        });

      // 4. 交代者の既存applicationがpendingなら承認状態へ更新
      await supabase
        .from('shift_applications')
        .update({ status: 'approved' })
        .eq('id', replacementAppId)
        .eq('status', 'pending');
    }
  }

  const { error } = await supabase
    .from('swap_requests')
    .update(updateData)
    .eq('id', requestId);

  if (error) throw error;

  return { message: '交代申請を承認しました' };
}

// 交代申請を拒否（管理者のみ）
export async function rejectSwapRequest(requestId: number, admin_comment?: string) {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('swap_requests')
    .update({
      status: 'rejected',
      admin_comment: admin_comment || '',
    })
    .eq('id', requestId);
  
  if (error) throw error;
  
  return { message: '交代申請を拒否しました' };
}

// ========== KV直接アクセスヘルパー (Supabaseクライアント経由) ==========

async function kvGet(key: string): Promise<any> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('kv_store_9d73baa6')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) return null;
  return data?.value ?? null;
}

async function kvSet(key: string, value: any): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('kv_store_9d73baa6')
    .upsert({ key, value }, { onConflict: 'key' });
  if (error) {
    console.error('kvSet error:', error);
    throw new Error(error.message || 'KV保存に失敗しました');
  }
}

// ========== Filter Tags API ==========

export async function getFilterTags(groupId: number): Promise<{ id: string; name: string; color: string }[]> {
  const val = await kvGet(`filter_tags:${groupId}`);
  return val ?? [];
}

export async function saveFilterTags(groupId: number, tags: { id: string; name: string; color: string }[]): Promise<void> {
  await kvSet(`filter_tags:${groupId}`, tags);
}

export async function getMemberTags(groupId: number, userEmail: string): Promise<string[]> {
  const all = await kvGet(`all_member_tags:${groupId}`);
  return (all ?? {})[userEmail] ?? [];
}

export async function getAllMemberTags(groupId: number): Promise<{ [email: string]: string[] }> {
  const val = await kvGet(`all_member_tags:${groupId}`);
  return val ?? {};
}

export async function saveMemberTags(groupId: number, userEmail: string, tagIds: string[]): Promise<void> {
  const all = await kvGet(`all_member_tags:${groupId}`) ?? {};
  all[userEmail] = tagIds;
  await kvSet(`all_member_tags:${groupId}`, all);
}

// ========== Shift Breakpoints ==========

export async function getShiftBreakpoints(shiftId: number): Promise<any[]> {
  const val = await kvGet(`shift_breakpoints:${shiftId}`);
  return val ?? [];
}

export async function saveShiftBreakpoints(shiftId: number, breakpoints: any[]): Promise<void> {
  await kvSet(`shift_breakpoints:${shiftId}`, breakpoints);
}

// ========== Published Dates (日付別発表) ==========

export async function getPublishedDates(shiftId: number): Promise<string[]> {
  const val = await kvGet(`published_dates:${shiftId}`);
  return val ?? [];
}

export async function savePublishedDates(shiftId: number, dates: string[]): Promise<void> {
  await kvSet(`published_dates:${shiftId}`, dates);
}

// ========== Hidden Day Apps ==========

export async function getHiddenDayApps(shiftId: number): Promise<{ appId: number; date: string }[]> {
  const val = await kvGet(`hidden_day_apps:${shiftId}`);
  return val ?? [];
}

export async function saveHiddenDayApps(shiftId: number, hidden: { appId: number; date: string }[]): Promise<void> {
  await kvSet(`hidden_day_apps:${shiftId}`, hidden);
}

// ========== Approved Slots Map (グリッドからの採用スロット管理) ==========
// 構造: { [email]: { [date]: {start: string, end: string, roleId?: string}[] } }

export type ApprovedSlot = { start: string; end: string; roleId?: string };
export type ApprovedSlotsMap = { [email: string]: { [date: string]: ApprovedSlot[] } };

export async function getApprovedSlotsMap(shiftId: number): Promise<ApprovedSlotsMap> {
  const val = await kvGet(`approved_slots:${shiftId}`);
  return val ?? {};
}

export async function saveApprovedSlotsMap(shiftId: number, map: ApprovedSlotsMap): Promise<void> {
  await kvSet(`approved_slots:${shiftId}`, map);
}

// ========== Wish Times (希望時間の保存 - 採用前のオリジナル希望時間) ==========
// 採用操作で daily_schedules.start_time/end_time が上書きされる前に希望時間を保存する
export type WishTimesMap = { [email: string]: { [date: string]: { start: string; end: string } } };

export async function getWishTimesMap(shiftId: number): Promise<WishTimesMap> {
  const val = await kvGet(`wish_times:${shiftId}`);
  return val ?? {};
}

export async function saveWishTimesMap(shiftId: number, map: WishTimesMap): Promise<void> {
  await kvSet(`wish_times:${shiftId}`, map);
}

// ========== Shift Roles (採用内容) ==========

export interface ShiftRole {
  id: string;
  name: string;
  color: string; // hex color like "#ef4444"
}

export async function getShiftRoles(shiftId: number): Promise<ShiftRole[]> {
  const val = await kvGet(`shift_roles:${shiftId}`);
  return val ?? [];
}

export async function saveShiftRoles(shiftId: number, roles: ShiftRole[]): Promise<void> {
  await kvSet(`shift_roles:${shiftId}`, roles);
}