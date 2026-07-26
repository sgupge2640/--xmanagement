import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ArrowLeft } from 'lucide-react';
import { joinGroup } from '../lib/api';
import { toast } from 'sonner';
import { useLanguage } from '../lib/LanguageContext';

interface JoinGroupPageProps {
  onBack: () => void;
  onSuccess: () => void;
}

export function JoinGroupPage({ onBack, onSuccess }: JoinGroupPageProps) {
  const { t } = useLanguage();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await joinGroup(code.trim().toUpperCase());
      toast.success('参加リクエストを送信しました。管理者の承認をお待ちください。');
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'グループへの参加に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto py-8">
        <Button variant="ghost" onClick={onBack} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t.joinGroup.cancel}
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t.joinGroup.title}</CardTitle>
            <CardDescription>
              {t.joinGroup.subtitle}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">{t.joinGroup.code}</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder={t.joinGroup.codePlaceholder}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  className="text-center text-2xl tracking-wider uppercase"
                />
              </div>
              <div className="pt-4">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t.joinGroup.joining : t.joinGroup.join}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}