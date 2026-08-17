import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ArrowLeft, UserCheck, UserX, Clock } from 'lucide-react';
import { getJoinRequests, approveJoinRequest, rejectJoinRequest } from '../lib/api';
import { toast } from 'sonner';
import { Badge } from './ui/badge';
import { useLanguage } from '../lib/LanguageContext';

interface JoinRequest {
  id: number;
  group_id: number;
  user_email: string;
  user_name: string;
  status: string;
  requested_at?: string;
  created_at?: string;
}

interface ManageRequestsPageProps {
  groupId: number;
  groupName: string;
  onBack: () => void;
}

export function ManageRequestsPage({ groupId, groupName, onBack }: ManageRequestsPageProps) {
  const { t } = useLanguage();
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await getJoinRequests(groupId);
      setRequests(data.requests || []);
    } catch (error: any) {
      toast.error(error.message || t.manageRequests.loading);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [groupId]);

  const handleApprove = async (requestId: number) => {
    setProcessingId(requestId);
    try {
      await approveJoinRequest(requestId);
      toast.success(t.manageRequests.approved_status);
      await loadRequests();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: number) => {
    setProcessingId(requestId);
    try {
      await rejectJoinRequest(requestId);
      toast.success(t.manageRequests.rejected_status);
      await loadRequests();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto py-8">
        <Button variant="ghost" onClick={onBack} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t.manageRequests.back}
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t.manageRequests.title}</CardTitle>
            <CardDescription>
              {groupName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-gray-500">
                {t.manageRequests.loading}
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>{t.manageRequests.noRequests}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => (
                  <Card key={request.id} className="bg-white border border-gray-200 hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={request.status === 'pending' ? 'secondary' : 'default'}>
                              {request.status === 'pending' ? t.manageRequests.pending : request.status === 'approved' ? t.manageRequests.approved : t.manageRequests.rejected}
                            </Badge>
                          </div>
                          <p className="mb-1">
                            {request.user_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {t.manageRequests.requestedAt}: {formatDate(request.requested_at || request.created_at)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApprove(request.id)}
                            disabled={processingId === request.id}
                          >
                            <UserCheck className="h-4 w-4 mr-1" />
                            {t.manageRequests.approve}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReject(request.id)}
                            disabled={processingId === request.id}
                          >
                            <UserX className="h-4 w-4 mr-1" />
                            {t.manageRequests.reject}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}