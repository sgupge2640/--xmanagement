import { useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { createSwapRequest } from '../lib/api';
import { toast } from 'sonner';

interface CreateSwapRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shiftId: number;
  groupId: number;
  shiftTitle: string;
  date: string;
  startTime: string;
  endTime: string;
  onSuccess: () => void;
}

export function CreateSwapRequestDialog({
  open,
  onOpenChange,
  shiftId,
  groupId,
  shiftTitle,
  date,
  startTime,
  endTime,
  onSuccess,
}: CreateSwapRequestDialogProps) {
  const [reason, setReason] = useState('');
  const [creating, setCreating] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    });
  };

  const handleCreate = async () => {
    if (!reason.trim()) {
      toast.error('交代理由を入力してください');
      return;
    }

    setCreating(true);
    try {
      await createSwapRequest({
        shift_id: shiftId,
        group_id: groupId,
        date,
        start_time: startTime,
        end_time: endTime,
        reason: reason.trim(),
      });
      toast.success('交代申請を作成しました');
      setReason('');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || '交代申請の作成に失敗しました');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>シフト交代申請を作成</DialogTitle>
          <DialogDescription>
            このシフトの交代を希望する理由を入力してください
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">シフト情報</Label>
            <div className="p-3 bg-gray-50 rounded-lg space-y-1">
              <div className="text-sm font-medium">{shiftTitle}</div>
              <div className="text-sm text-gray-600">
                {formatDate(date)}
              </div>
              <div className="text-sm text-gray-600">
                {startTime.slice(0, 5)} - {endTime.slice(0, 5)}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">交代理由 *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="例：急な用事ができたため、交代していただける方を探しています。"
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={creating}
          >
            キャンセル
          </Button>
          <Button onClick={handleCreate} disabled={creating || !reason.trim()}>
            {creating ? '作成中...' : '交代申請を作成'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
