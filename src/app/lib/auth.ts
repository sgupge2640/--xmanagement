import { getSupabaseClient } from './supabase';

export const getToken = (): string | null => {
  return localStorage.getItem('access_token');
};

export const setToken = (token: string): void => {
  localStorage.setItem('access_token', token);
};

export const getEmail = (): string | null => {
  return localStorage.getItem('user_email');
};

export const setEmail = (email: string): void => {
  localStorage.setItem('user_email', email);
};

export const getName = (): string | null => {
  return localStorage.getItem('user_name');
};

export const setName = (name: string): void => {
  localStorage.setItem('user_name', name);
};

export const logout = (): void => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user_email');
  localStorage.removeItem('user_name');
};

export const isAuthenticated = (): boolean => {
  return !!getToken();
};

// サインアップ
export async function signup(email: string, password: string, name: string) {
  const supabase = getSupabaseClient();
  
  // Supabase Authでユーザー作成
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: name,
      },
      emailRedirectTo: undefined, // メール確認リンクを無効化
      // メール確認をスキップ（開発環境用）
      // 注意: これはSupabaseの設定で「Confirm email」をOFFにする必要があります
    },
  });
  
  if (error) {
    // ユーザーが既に存在する場合
    if (error.message.includes('already') || error.message.includes('exists')) {
      const err: any = new Error('このメールアドレスは既に登録されています。ログインしてください。');
      err.code = 'USER_EXISTS';
      throw err;
    }
    throw error;
  }
  
  if (!data.user) {
    throw new Error('サインアップに失敗しました');
  }
  
  // usersテーブルに情報を保存（upsertで重複エラーを回避）
  const { error: insertError } = await supabase
    .from('users')
    .upsert({
      email: email,
      name: name,
      password_hash: 'managed_by_supabase_auth', // Supabase Authが管理
    }, {
      onConflict: 'email',
    });
  
  if (insertError) {
    console.error('Failed to insert user data:', insertError);
    // 認証は成功しているので続行
  }
  
  // サインアップ成功後、自動的にログイン
  if (data.session) {
    return {
      access_token: data.session.access_token,
      user: data.user,
      auto_login: true,
    };
  }
  
  // セッションがない場合（メール確認が必要な可能性）
  console.log('No session after signup. Email confirmation may be required.');
  
  // メール確認が不要な設定の場合、少し待ってからログインを試みる
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  try {
    const loginResult = await login(email, password);
    return {
      access_token: loginResult.access_token,
      user: loginResult.user,
      auto_login: true,
    };
  } catch (loginError: any) {
    console.error('Auto-login failed:', loginError);
    
    // メール確認が必要な場合
    if (loginError.message.includes('Email not confirmed') || 
        loginError.message.includes('email_confirmed_at')) {
      const err: any = new Error(
        'アカウントを作成しました。\n\n' +
        '⚠️ Supabaseの設定でメール確認が有効になっています。\n' +
        '開発環境では無効化することを推奨します。\n\n' +
        '設定方法: /database/DISABLE_EMAIL_CONFIRMATION.md を参照'
      );
      err.code = 'EMAIL_CONFIRMATION_REQUIRED';
      err.email = email;
      throw err;
    }
    
    // その他のエラー
    throw loginError;
  }
}

// ログイン
export async function login(email: string, password: string) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  if (!data.session) throw new Error('ログインに失敗しました');
  
  // usersテーブルにユーザー情報を保存（存在しない場合のみ）
  const userName = data.user.user_metadata?.name || email.split('@')[0];
  const { error: upsertError } = await supabase
    .from('users')
    .upsert({
      email: email,
      name: userName,
      password_hash: 'managed_by_supabase_auth',
    }, {
      onConflict: 'email',
    });
  
  if (upsertError) {
    console.error('Failed to upsert user data:', upsertError);
    // 認証は成功しているので続行
  }
  
  return {
    access_token: data.session.access_token,
    user: data.user,
  };
}