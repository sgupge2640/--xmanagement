// RLS設定ガイド
import React from 'react';
import { AlertTriangle, Database, CheckCircle } from 'lucide-react';

export function RLSSetupGuide() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <AlertTriangle className="w-8 h-8 text-red-500" />
          <h1 className="text-2xl">Supabaseの設定が必要です</h1>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">
            <strong>エラー:</strong> infinite recursion detected in policy for relation "group_members"
          </p>
          <p className="text-red-700 mt-2">
            RLS（Row Level Security）ポリシーが循環参照を起こしています。
          </p>
        </div>

        <h2 className="text-xl mb-4 flex items-center gap-2">
          <Database className="w-6 h-6 text-blue-500" />
          修正手順
        </h2>

        <ol className="space-y-4">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center">
              1
            </span>
            <div>
              <p className="mb-2">
                Supabaseダッシュボードにアクセス
              </p>
              <a
                href="https://supabase.com/dashboard/project/pfqkjfzakzvlgxbfnqve/sql/new"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                SQL Editorを開く →
              </a>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center">
              2
            </span>
            <div className="flex-1">
              <p className="mb-2">以下のSQLをコピーして実行</p>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                <pre>{`-- すべてのテーブルのRLSを無効化
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS group_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS shift_applications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS daily_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS join_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS swap_requests DISABLE ROW LEVEL SECURITY;

-- 確認
SELECT tablename, 
  CASE WHEN rowsecurity THEN 'RLS有効 ❌' ELSE 'RLS無効 ✅' END as status
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;`}</pre>
              </div>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center">
              3
            </span>
            <div>
              <p className="mb-2">
                "Run"ボタンをクリックして実行
              </p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center">
              <CheckCircle className="w-5 h-5" />
            </span>
            <div>
              <p className="mb-2">
                このページをリロード（F5キー）
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                ページをリロード
              </button>
            </div>
          </li>
        </ol>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="mb-2">💡 RLSを無効化しても安全な理由</h3>
          <ul className="text-sm text-blue-900 space-y-1">
            <li>✅ JWT認証は引き続き有効（ログイン必須）</li>
            <li>✅ アプリケーション側でロール制御を実装済み</li>
            <li>✅ Anon Keyは読み取り/書き込みのみ可能</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
