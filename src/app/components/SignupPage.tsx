import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { signup, setToken, setEmail as saveEmail, setName as saveName } from '../lib/auth';
import { toast } from 'sonner';
import { useLanguage } from '../lib/LanguageContext';

interface SignupPageProps {
  onSignupSuccess: () => void;
  onSwitchToLogin: () => void;
}

export function SignupPage({ onSignupSuccess, onSwitchToLogin }: SignupPageProps) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signup(email, password, name);
      if (result.access_token) {
        setToken(result.access_token);
        saveEmail(result.user.email);
        saveName(name);
        toast.success('アカウントを作成しました');
        onSignupSuccess();
      } else if (result.email_confirmation_required) {
        toast.info(result.message || 'メールを確認してアカウントを有効化してください');
        setTimeout(() => onSwitchToLogin(), 3000);
      } else {
        toast.success('アカウントを作成しました。ログインしてください。');
        onSwitchToLogin();
      }
    } catch (error: any) {
      if (error.code === 'USER_EXISTS') {
        toast.error(error.message);
        // ログイン画面へ誘導
        setTimeout(() => onSwitchToLogin(), 2000);
      } else if (error.code === 'EMAIL_CONFIRMATION_REQUIRED') {
        // メール確認が必要な場合は詳細なメッセージを表示
        toast.error(error.message, { duration: 10000 });
        console.error('Supabase 設定の変更が必要です');
        console.error('1. https://supabase.com/dashboard/project/pfqkjfzakzvlgxbfnqve/auth/providers を開く');
        console.error('2. Email プロバイダーの「Confirm email」をOFFにする');
        console.error('3. 詳細は /database/DISABLE_EMAIL_CONFIRMATION.md を参照');
      } else {
        toast.error(error.message || 'アカウント登録に失敗しました');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center p-3 sm:p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-xl sm:text-2xl text-center">{t.signup.title}</CardTitle>
          <CardDescription className="text-center text-sm sm:text-base">
            {t.signup.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm sm:text-base">{t.signup.name}</Label>
              <Input
                id="name"
                type="text"
                placeholder={t.signup.namePlaceholder}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="text-sm sm:text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm sm:text-base">{t.signup.email}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t.signup.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="text-sm sm:text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm sm:text-base">{t.signup.password}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t.signup.passwordPlaceholder}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="text-sm sm:text-base"
              />
              <p className="text-xs text-gray-500">{t.signup.passwordHint}</p>
            </div>
            <Button type="submit" className="w-full text-sm sm:text-base" disabled={isLoading}>
              {isLoading ? t.signup.signingUp : t.signup.signupButton}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <p className="text-xs sm:text-sm text-gray-600">
              {t.signup.hasAccount}{' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="text-blue-600 hover:underline"
              >
                {t.signup.login}
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}