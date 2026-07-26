// 開発・デバッグ用ユーティリティ
import { projectId, publicAnonKey } from '../utils/supabase/info';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-aba46d8b`;

// ユーザー削除（開発用）
export async function deleteUser(email: string) {
  const response = await fetch(`${SERVER_URL}/auth/user/${encodeURIComponent(email)}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${publicAnonKey}`,
    },
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'ユーザー削除に失敗しました');
  }
  
  return data;
}

// すべてのデータをクリア（開発用）
export async function clearAllData() {
  if (!confirm('⚠️ 警告: すべてのユーザーとデータを削除します。本当に実行しますか？')) {
    return { cancelled: true };
  }
  
  console.log('🗑️ すべてのデータを削除中...');
  
  const response = await fetch(`${SERVER_URL}/admin/clear-all-data`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${publicAnonKey}`,
    },
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'データ削除に失敗しました');
  }
  
  console.log('✅ データ削除完了:', data.results);
  console.log('ℹ️ ページをリロードしてください');
  
  return data;
}

// ブラウザコンソールで使用可能にする
if (typeof window !== 'undefined') {
  (window as any).debugDeleteUser = deleteUser;
  (window as any).debugClearAllData = clearAllData;
  console.log('🔧 デバッグツール使用可能:');
  console.log('  - debugDeleteUser("email@example.com") : 特定のユーザーを削除');
  console.log('  - debugClearAllData() : すべてのデータを削除');
}
