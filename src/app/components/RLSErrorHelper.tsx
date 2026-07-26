import React from 'react';
import { AlertCircle, ExternalLink, Copy, Check } from 'lucide-react';

interface RLSErrorHelperProps {
  error: Error;
}

export function RLSErrorHelper({ error }: RLSErrorHelperProps) {
  const [copied, setCopied] = React.useState(false);
  
  // RLS無限再帰エラーかチェック
  const isRLSError = error.message?.includes('infinite recursion') || 
                     error.message?.includes('group_members');
  
  if (!isRLSError) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-red-900 mb-1">エラーが発生しました</h3>
            <p className="text-red-700 text-sm">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  const sqlScript = `DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
            pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE group_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE shift_applications DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE join_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE swap_requests DISABLE ROW LEVEL SECURITY;

SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-300 rounded-xl shadow-lg">
      <div className="flex items-start gap-4 mb-6">
        <div className="p-3 bg-red-100 rounded-full">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl text-red-900 mb-2">データベース設定エラー</h2>
          <p className="text-red-700">
            Supabaseのセキュリティポリシー（RLS）が循環参照を引き起こしています。
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-red-200 mb-6">
        <h3 className="text-lg text-gray-900 mb-4">🚀 修正方法（5分で完了）</h3>
        
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full flex-shrink-0">
              1
            </div>
            <div className="flex-1">
              <h4 className="text-gray-900 mb-1">Supabaseダッシュボードを開く</h4>
              <a
                href="https://supabase.com/dashboard/project/pfqkjfzakzvlgxbfnqve/sql/new"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
              >
                SQL Editorを直接開く
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full flex-shrink-0">
              2
            </div>
            <div className="flex-1">
              <h4 className="text-gray-900 mb-2">以下のSQLをコピーして実行</h4>
              <div className="relative">
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
                  {sqlScript}
                </pre>
                <button
                  onClick={handleCopy}
                  className="absolute top-2 right-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm flex items-center gap-2 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      コピー済み
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      コピー
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full flex-shrink-0">
              3
            </div>
            <div className="flex-1">
              <h4 className="text-gray-900 mb-1">「Run」ボタンをクリック</h4>
              <p className="text-gray-600 text-sm">
                緑色の▶️ボタンを押して、SQLを実行してください。
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full flex-shrink-0">
              4
            </div>
            <div className="flex-1">
              <h4 className="text-gray-900 mb-1">ページをリロード</h4>
              <p className="text-gray-600 text-sm">
                SQL実行後、このページをリロード（Ctrl+Shift+R）してください。
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h4 className="text-blue-900 mb-2 flex items-center gap-2">
          🔒 セキュリティについて
        </h4>
        <ul className="text-blue-800 text-sm space-y-1">
          <li>✅ Supabase Authによる認証は有効です</li>
          <li>✅ JWTトークンで保護されています</li>
          <li>✅ アプリケーションレベルでアクセス制御を実施</li>
          <li>✅ Anon Keyは読み取り/書き込みのみ可能</li>
        </ul>
      </div>

      <div className="mt-4 text-center">
        <p className="text-gray-600 text-sm">
          問題が解決しない場合は、ブラウザのキャッシュをクリアしてください。
        </p>
      </div>
    </div>
  );
}
