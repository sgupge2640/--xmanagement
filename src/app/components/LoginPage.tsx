import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { login, setToken, setEmail as saveEmail, setName } from '../lib/auth';
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