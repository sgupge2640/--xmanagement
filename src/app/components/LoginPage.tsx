import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { login, setToken, setEmail as saveEmail, setName } from '../lib/auth';
import { resetPasswordByEmailAndName } from '../lib/api';
import { toast } from 'sonner';
import { useLanguage } from '../lib/LanguageContext';

interface LoginPageProps {
  onLoginSuccess: () => void;
  onSwitchToSignup: () => void;
}

export function LoginPage({ onLoginSuccess, onSwitchToSignup }: LoginPageProps) {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetName, setResetName] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await login(email, password);
      setToken(result.access_token);
      saveEmail(result.user.email);
      setName(result.user.user_metadata?.name || email);
      toast.success('ログインしました');
      onLoginSuccess();
    } catch (error: any) {
      toast.error(error.message || 'ログインに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resetEmail.trim() || !resetName.trim() || !resetPassword) {
      toast.error('メールアドレス・名前・新しいパスワードを入力してください');
      return;
    }

    if (resetPassword.length < 6) {
      toast.error('パスワードは6文字以上で入力してください');
      return;
    }

    if (resetPassword !== resetPasswordConfirm) {
      toast.error('新しいパスワード（確認）が一致しません');
      return;
    }

    setIsResettingPassword(true);
    try {
      await resetPasswordByEmailAndName(resetEmail.trim(), resetName.trim(), resetPassword);
      toast.success('パスワードを再設定しました。新しいパスワードでログインしてください');
      setPassword('');
      setShowResetPassword(false);
      setResetPassword('');
      setResetPasswordConfirm('');
    } catch (error: any) {
      toast.error(error.message || 'パスワード再設定に失敗しました');
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-3 sm:p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-xl sm:text-2xl text-center">{t.login.title}</CardTitle>
          <CardDescription className="text-center text-sm sm:text-base">
            {t.login.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm sm:text-base">{t.login.email}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t.login.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="text-sm sm:text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm sm:text-base">{t.login.password}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t.login.passwordPlaceholder}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="text-sm sm:text-base"
              />
            </div>
            <Button type="submit" className="w-full text-sm sm:text-base" disabled={isLoading}>
              {isLoading ? t.login.loggingIn : t.login.loginButton}
            </Button>
          </form>
          <div className="mt-3 text-center">
            <button
              type="button"
              className="text-xs sm:text-sm text-blue-600 hover:underline"
              onClick={() => {
                setShowResetPassword((prev) => !prev);
                if (!showResetPassword) {
                  setResetEmail(email.trim());
                }
              }}
            >
              {showResetPassword ? '再設定フォームを閉じる' : 'パスワードを忘れた方'}
            </button>
          </div>
          {showResetPassword && (
            <form onSubmit={handleResetPassword} className="mt-4 space-y-3 border rounded-md p-3 bg-blue-50/40">
              <p className="text-xs sm:text-sm text-gray-700">
                登録時のメールアドレスと名前を入力して、新しいパスワードを設定します。
              </p>
              <div className="space-y-1">
                <Label htmlFor="reset-email" className="text-xs sm:text-sm">メールアドレス</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="reset-name" className="text-xs sm:text-sm">名前</Label>
                <Input
                  id="reset-name"
                  type="text"
                  value={resetName}
                  onChange={(e) => setResetName(e.target.value)}
                  required
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="reset-password" className="text-xs sm:text-sm">新しいパスワード</Label>
                <Input
                  id="reset-password"
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  minLength={6}
                  required
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="reset-password-confirm" className="text-xs sm:text-sm">新しいパスワード（確認）</Label>
                <Input
                  id="reset-password-confirm"
                  type="password"
                  value={resetPasswordConfirm}
                  onChange={(e) => setResetPasswordConfirm(e.target.value)}
                  minLength={6}
                  required
                  className="text-sm"
                />
              </div>
              <Button type="submit" className="w-full text-sm" disabled={isResettingPassword}>
                {isResettingPassword ? '再設定中...' : 'パスワードを再設定'}
              </Button>
            </form>
          )}
          <div className="mt-4 text-center">
            <p className="text-xs sm:text-sm text-gray-600">
              {t.login.noAccount}{' '}
              <button
                type="button"
                onClick={onSwitchToSignup}
                className="text-blue-600 hover:underline"
              >
                {t.login.signup}
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}