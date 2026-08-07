import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ArrowLeft, Calendar, Clock, RefreshCw, CheckCircle2, XCircle, AlertCircle, Users, Plus } from 'lucide-react';
import { getSwapRequests, acceptSwapRequest, approveSwapRequest, rejectSwapRequest, createSwapRequest, getMyShifts } from '../lib/api';
import { toast } from 'sonner';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface Applicant {
  id: number;
  swap_request_id: number;
  applicant_email: string;
  applicant_name: string;
  applied_at: string;
}

interface SwapRequest {
  id: number;
  shift_id: number;
  shift_title: string;
  group_id: number;
  date: string;
  start_time: string;
  end_time: string;
  requester_email: string;
  requester_name: string;
  reason: string;
  status: 'pending' | 'accepted' | 'approved' | 'rejected';
  replacement_email?: string;
  replacement_name?: string;
  accepted_at?: string;
  approved_at?: string;
  rejected_at?: string;
  admin_comment?: string;
  created_at: string;
  applicants?: Applicant[];
}

interface ShiftSwapRequestsProps {
  groupId: number;
  groupName: string;
  isAdmin: boolean;
  onBack: () => void;
}

export function ShiftSwapRequests({ groupId, groupName, isAdmin, onBack }: ShiftSwapRequestsProps) {
  const [requests, setRequests] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState(isAdmin ? 'all' : 'available');
  const [myShifts, setMyShifts] = useState<any[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [reason, setReason] = useState('');
  
  // 管理者向けコメント用の状態
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [commentAction, setCommentAction] = useState<'approve' | 'reject'>('approve');
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [adminComment, setAdminComment] = useState('');
  const [selectedApplicantEmail, setSelectedApplicantEmail] = useState<string>('');

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await getSwapRequests(groupId);
      setRequests(data.requests || []);
    } catch (error: any) {
      toast.error(error.message || '交代申請の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [groupId]);

  const handleAccept = async (requestId: number) => {
    setProcessing(requestId);
    try {
      await acceptSwapRequest(requestId);
      toast.success('交代に応募しました。管理者の承認をお待ちください');
      await loadRequests();
    } catch (error: any) {
      toast.error(error.message || '交代への応募に失敗しました');
    } finally {
      setProcessing(null);
    }
  };

  const handleApprove = async (requestId: number) => {
    setProcessing(requestId);
    try {
      await approveSwapRequest(requestId);
      toast.success('交代を承認しました');
      await loadRequests();
    } catch (error: any) {
      toast.error(error.message || '承認に失敗しました');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (requestId: number) => {
    setProcessing(requestId);
    try {
      await rejectSwapRequest(requestId);
      toast.success('交代申請を拒否しました');
      await loadRequests();
    } catch (error: any) {
      toast.error(error.message || '拒否に失敗しました');
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const userEmail = localStorage.getItem('user_email');

  const filteredRequests = requests.filter(req => {
    if (activeTab === 'all') return true;
    if (activeTab === 'my_requests') return req.requester_email === userEmail;
    if (activeTab === 'available') return (req.status === 'pending' || req.status === 'accepted') && req.requester_email !== userEmail;
    if (activeTab === 'my_accepted') {
      // 自分が応募した申請を表示
      return req.applicants?.some(app => app.applicant_email === userEmail) || false;
    }
    if (activeTab === 'pending_approval') return req.status === 'accepted';
    return true;
  });

  const getStatusBadge = (request: SwapRequest) => {
    if (request.status === 'approved') {
      return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1 inline" />承認済み</Badge>;
    }
    if (request.status === 'accepted') {
      const applicantCount = request.applicants?.length || 0;
      return <Badge variant="secondary" className="bg-blue-600 text-white"><Users className="h-3 w-3 mr-1 inline" />応募者 {applicantCount} 名</Badge>;
    }
    if (request.status === 'pending') {
      return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1 inline" />募集中</Badge>;
    }
    if (request.status === 'rejected') {
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1 inline" />拒否</Badge>;
    }
    return null;
  };

  const loadMyShifts = async () => {
    try {
      const data = await getMyShifts();
      const applications = data.applications || [];
      
      // このグループのシフトのみを抽出
      const groupShifts = applications.filter((app: any) => 
        app.shifts?.group_id === groupId
      );
      
      // 承認済み・一部承認シフトから日付ごとに展開
      const expandedShifts: any[] = [];
      
      for (const app of groupShifts) {
        if (app.status === 'approved' || app.status === 'partially_approved') {
          const shift = app.shifts;
          const schedules = app.daily_schedules || [];
          
          // daily_schedules から承認済みの日付のみ展開
          schedules
            .filter((day: any) => day.status === 'approved')
            .forEach((day: any) => {
              expandedShifts.push({
                id: shift?.id,
                group_id: shift?.group_id,
                title: shift?.title || 'シフト',
                date: day.date,
                start_time: day.start_time,
                end_time: day.end_time,
              });
            });
        }
      }
      
      setMyShifts(expandedShifts);
    } catch (error: any) {
      console.error('自分のシフトの取得エラー:', error);
      toast.error(error.message || '自分のシフトの取得に失敗しました');
    }
  };

  useEffect(() => {
    loadMyShifts();
  }, [groupId]);

  const handleCreateRequest = async () => {
    if (!selectedShift || reason.trim() === '') {
      toast.error('シフトと理由を入力してください');
      return;
    }
    
    setProcessing(-1);
    try {
      await createSwapRequest({
        shift_id: selectedShift.id,
        group_id: groupId,
        date: selectedShift.date,
        start_time: selectedShift.start_time,
        end_time: selectedShift.end_time,
        reason: reason.trim(),
      });
      toast.success('交代申請を作成しました');
      await loadRequests();
      setCreateDialogOpen(false);
      setSelectedShift(null);
      setReason('');
    } catch (error: any) {
      toast.error(error.message || '交代申請の作成に失敗しました');
    } finally {
      setProcessing(null);
    }
  };

  const handleCommentAction = async () => {
    if (!selectedRequestId) return;

    setProcessing(selectedRequestId);
    try {
      if (commentAction === 'approve') {
        await approveSwapRequest(selectedRequestId, adminComment, selectedApplicantEmail || undefined);
        toast.success('交代を承認しました');
      } else if (commentAction === 'reject') {
        await rejectSwapRequest(selectedRequestId, adminComment);
        toast.success('交代申請を拒否しました');
      }
      await loadRequests();
    } catch (error: any) {
      toast.error(error.message || '操作に失敗しました');
    } finally {
      setProcessing(null);
      setCommentDialogOpen(false);
      setAdminComment('');
      setSelectedApplicantEmail('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={onBack} className="text-white hover:bg-purple-700">
                <ArrowLeft className="h-4 w-4 mr-2" />
                戻る
              </Button>
              <div className="h-6 w-px bg-purple-400" />
              <div>
                <h1 className="text-2xl">シフト交代申請</h1>
                <p className="text-sm text-purple-200">{groupName}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList>
            <TabsTrigger value="all">すべて</TabsTrigger>
            <TabsTrigger value="available">応募可能</TabsTrigger>
            <TabsTrigger value="my_requests">自分の申請</TabsTrigger>
            <TabsTrigger value="my_accepted">応募済み</TabsTrigger>
            {isAdmin && <TabsTrigger value="pending_approval">承認待ち</TabsTrigger>}
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">読み込み中...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <RefreshCw className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">
                {activeTab === 'my_requests' 
                  ? 'まだ交代申請を作成していません' 
                  : activeTab === 'available'
                  ? '応募可能な交代申請がありません'
                  : activeTab === 'my_accepted'
                  ? 'まだ交代に応募していません'
                  : activeTab === 'pending_approval'
                  ? '承認待ちの交代申請がありません'
                  : '交代申請がまだありません'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredRequests.map((request) => (
              <Card key={request.id} className={`hover:shadow-md transition-shadow ${
                isAdmin && request.status === 'accepted' ? 'border-2 border-blue-400 bg-blue-50' : ''
              }`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <CardTitle className="text-lg">{request.shift_title}</CardTitle>
                        {getStatusBadge(request)}
                        {isAdmin && request.status === 'accepted' && (
                          <Badge variant="default" className="bg-orange-600">
                            要対応
                          </Badge>
                        )}
                      </div>
                      <CardDescription>
                        {formatDate(request.date)} {request.start_time.slice(0, 5)} - {request.end_time.slice(0, 5)}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    <div className="flex items-start gap-2">
                      <Users className="h-5 w-5 text-gray-500 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-700">申請者</div>
                        <div className="text-sm text-gray-600">{request.requester_name}</div>
                      </div>
                    </div>

                    {/* 管理者のみ応募者リストを表示 */}
                    {isAdmin && request.applicants && request.applicants.length > 0 && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          応募者（{request.applicants.length}名）
                        </div>
                        <div className="space-y-2">
                          {request.applicants.map((applicant) => (
                            <div
                              key={applicant.id}
                              className={`p-2 rounded ${
                                request.replacement_email === applicant.applicant_email
                                  ? 'bg-green-100 border border-green-300'
                                  : 'bg-white border border-blue-200'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-sm font-semibold text-blue-800">
                                    {applicant.applicant_name}
                                    {request.replacement_email === applicant.applicant_email && (
                                      <Badge variant="default" className="ml-2 bg-green-600 text-xs">
                                        選択済み
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-xs text-blue-600">
                                    {applicant.applicant_email}
                                  </div>
                                  <div className="text-xs text-blue-500 mt-1">
                                    応募: {formatDateTime(applicant.applied_at)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* 一般ユーザーには応募人数のみ表示 */}
                    {!isAdmin && request.applicants && request.applicants.length > 0 && (
                      <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        現在 {request.applicants.length}人が応募中
                      </div>
                    )}

                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm font-medium text-gray-700 mb-1">理由</div>
                      <div className="text-sm text-gray-600 whitespace-pre-wrap">{request.reason}</div>
                    </div>

                    <div className="text-xs text-gray-500">
                      申請日時: {formatDateTime(request.created_at)}
                    </div>
                    
                    {/* 管理者コメント表示 */}
                    {request.admin_comment && (request.status === 'approved' || request.status === 'rejected') && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="text-sm font-medium text-blue-900 mb-1">管理者コメント</div>
                        <div className="text-sm text-blue-800 whitespace-pre-wrap">{request.admin_comment}</div>
                      </div>
                    )}
                  </div>

                  {/* アクション */}
                  {(request.status === 'pending' || request.status === 'accepted') && request.requester_email !== userEmail && (() => {
                    const alreadyApplied = request.applicants?.some(app => app.applicant_email === userEmail);
                    if (alreadyApplied) {
                      return (
                        <div className="pt-3 border-t">
                          <Badge variant="secondary" className="w-full justify-center py-2">
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            応募済み
                          </Badge>
                        </div>
                      );
                    }
                    return (
                      <div className="pt-3 border-t">
                        <Button
                          onClick={() => handleAccept(request.id)}
                          disabled={processing === request.id}
                          className="w-full"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          この交代に応募する
                        </Button>
                      </div>
                    );
                  })()}

                  {isAdmin && (request.status === 'pending' || request.status === 'accepted') && (
                    <div className="pt-3 border-t flex gap-2">
                      <Button
                        onClick={() => {
                          setCommentAction('approve');
                          setSelectedRequestId(request.id);
                          setSelectedApplicantEmail('');
                          setCommentDialogOpen(true);
                        }}
                        disabled={processing === request.id}
                        className="flex-1"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        {(request.applicants?.length ?? 0) > 0 ? `交代者を選んで承認（${request.applicants!.length}名応募中）` : '交代者なしで承認'}
                      </Button>
                      <Button
                        onClick={() => {
                          setCommentAction('reject');
                          setSelectedRequestId(request.id);
                          setCommentDialogOpen(true);
                        }}
                        disabled={processing === request.id}
                        variant="outline"
                        className="flex-1"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        拒否
                      </Button>
                    </div>
                  )}

                  {request.status === 'approved' && (
                    <div className="pt-3 border-t">
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 space-y-1">
                        <div className="flex items-center gap-2 font-medium">
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                          交代が承認されました
                          {request.approved_at && (
                            <span className="text-xs text-green-600">
                              ({formatDateTime(request.approved_at)})
                            </span>
                          )}
                        </div>
                        {request.replacement_name ? (
                          <div className="ml-6 text-green-700">
                            <span className="font-semibold">{request.requester_name}</span>
                            <span className="mx-1">→</span>
                            <span className="font-semibold">{request.replacement_name}</span>
                            <span className="ml-1 text-xs text-green-600">が交代します</span>
                          </div>
                        ) : (
                          <div className="ml-6 text-xs text-green-600">交代者なしで承認済み</div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 申請作成ダイアログ */}
        <Dialog open={createDialogOpen} onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            setSelectedShift(null);
            setReason('');
          }
        }}>
          <DialogTrigger asChild>
            <Button variant="outline" className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              交代申請を作成
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>交代申請を作成</DialogTitle>
              <DialogDescription>
                自分の承認済みシフトから交代を申請できます。
              </DialogDescription>
            </DialogHeader>
            {myShifts.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-500">交代可能なシフトがありません</p>
              </div>
            ) : (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="shift">シフトを選択</Label>
                  <Select
                    value={selectedShift?.id?.toString() || ''}
                    onValueChange={(value) => {
                      const shift = myShifts.find(s => `${s.id}-${s.date}` === value);
                      setSelectedShift(shift || null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="シフトを選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      {myShifts.map((shift, idx) => (
                        <SelectItem key={`${shift.id}-${shift.date}-${idx}`} value={`${shift.id}-${shift.date}`}>
                          {shift.title} - {formatDate(shift.date)} {shift.start_time.slice(0, 5)}-{shift.end_time.slice(0, 5)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedShift && (
                  <div className="p-3 bg-gray-50 rounded-lg text-sm">
                    <div className="grid gap-1">
                      <div className="flex justify-between">
                        <span className="text-gray-600">シフト:</span>
                        <span className="font-medium">{selectedShift.title}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">日付:</span>
                        <span className="font-medium">{formatDate(selectedShift.date)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">時間:</span>
                        <span className="font-medium">
                          {selectedShift.start_time.slice(0, 5)} - {selectedShift.end_time.slice(0, 5)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="grid gap-2">
                  <Label htmlFor="reason">理由</Label>
                  <Textarea
                    id="reason"
                    placeholder="交代が必要な理由を入力してください"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={4}
                  />
                </div>
                
                <Button
                  onClick={handleCreateRequest}
                  disabled={processing !== null || !selectedShift || reason.trim() === ''}
                  className="w-full"
                >
                  {processing === -1 ? '作成中...' : '申請を作成'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* 管理者向けコメントダイアログ */}
        <Dialog open={commentDialogOpen} onOpenChange={(open) => {
          setCommentDialogOpen(open);
          if (!open) {
            setSelectedRequestId(null);
            setAdminComment('');
            setSelectedApplicantEmail('');
          }
        }}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {commentAction === 'approve' ? '交代申請を承認' : '交代申請を拒否'}
              </DialogTitle>
              <DialogDescription>
                {commentAction === 'approve'
                  ? '交代者を選択して承認してください'
                  : '拒否の理由やコメントを入力してください（任意）'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {commentAction === 'approve' && selectedRequestId && (() => {
                const request = requests.find(r => r.id === selectedRequestId);
                const applicants = request?.applicants || [];

                if (applicants.length > 0) {
                  return (
                    <div className="grid gap-2">
                      <Label>交代者を選択</Label>
                      <Select
                        value={selectedApplicantEmail}
                        onValueChange={setSelectedApplicantEmail}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="応募者を選択してください" />
                        </SelectTrigger>
                        <SelectContent>
                          {applicants.map((applicant) => (
                            <SelectItem key={applicant.id} value={applicant.applicant_email}>
                              {applicant.applicant_name} ({applicant.applicant_email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!selectedApplicantEmail && (
                        <p className="text-xs text-amber-600">
                          ※ 選択しない場合は交代者なしで承認されます
                        </p>
                      )}
                    </div>
                  );
                } else {
                  return (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                      応募者がいません。交代者なしで承認されます。
                    </div>
                  );
                }
              })()}

              <div className="grid gap-2">
                <Label htmlFor="admin_comment">管理者コメント（任意）</Label>
                <Textarea
                  id="admin_comment"
                  placeholder="コメントを入力してください"
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleCommentAction}
                  disabled={processing !== null}
                  className="flex-1"
                  variant={commentAction === 'approve' ? 'default' : 'destructive'}
                >
                  {processing === selectedRequestId ? '処理中...' : (commentAction === 'approve' ? '承認' : '拒否')}
                </Button>
                <Button
                  onClick={() => setCommentDialogOpen(false)}
                  disabled={processing !== null}
                  variant="outline"
                  className="flex-1"
                >
                  キャンセル
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}