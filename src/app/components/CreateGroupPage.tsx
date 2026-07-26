import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ArrowLeft, Copy, CheckCircle2 } from 'lucide-react';
import { createGroup } from '../lib/api';
import { toast } from 'sonner';
import { useLanguage } from '../lib/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';

interface CreateGroupPageProps {
  onBack: () => void;
  onSuccess: () => void;
}

export function CreateGroupPage({ onBack, onSuccess }: CreateGroupPageProps) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [groupCode, setGroupCode] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await createGroup(name, description);
      setGroupCode(result.group.code);
      setShowSuccessDialog(true);
      toast.success(t.common.success);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    // フォールバック方法でコピ�E
    const textArea = document.createElement('textarea');
    textArea.value = groupCode;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        setCopied(true);
        toast.success(t.createGroup.copied);
        setTimeout(() => setCopied(false), 2000);
      } else {
        toast.error('コピ�Eに失敗しました');
      }
    } catch (err) {
      console.error('Copy failed:', err);
      toast.error('コピ�Eに失敗しました');
    } finally {
      document.body.removeChild(textArea);
    }
  };

  const handleClose = () => {
    setShowSuccessDialog(false);
    onSuccess();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto py-8">
        <Button variant="ghost" onClick={onBack} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t.createGroup.cancel}
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t.createGroup.title}</CardTitle>
            <CardDescription>
              {t.createGroup.subtitle}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t.createGroup.name}</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder={t.createGroup.namePlaceholder}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{t.createGroup.description}</Label>
                <Textarea
                  id="description"
                  placeholder={t.createGroup.descriptionPlaceholder}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="pt-4">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t.createGroup.creating : t.createGroup.create}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">
              🎉 {t.createGroup.successTitle}
            </DialogTitle>
            <DialogDescription className="text-center pt-2">
              {t.createGroup.codeLabel}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4 py-4">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 rounded-lg text-white text-center w-full">
              <p className="text-sm mb-2">{t.createGroup.codeLabel}</p>
              <p className="text-4xl font-bold tracking-wider">{groupCode}</p>
            </div>
            <Button
              onClick={handleCopyCode}
              variant="outline"
              className="w-full"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {t.createGroup.copied}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  {t.createGroup.copyCode}
                </>
              )}
            </Button>
            <p className="text-sm text-gray-500 text-center">
              {t.createGroup.shareMessage}
            </p>
          </div>
          <DialogFooter>
            <Button onClick={handleClose} className="w-full">
              {t.common.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}