import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ArrowLeft, Calendar, Plus, Users, Clock, MapPin, CheckCircle2, XCircle, AlertCircle, RefreshCw, DollarSign } from 'lucide-react';
import { getShifts } from '../lib/api';
import { FilterTagsManager } from './FilterTagsManager';
import { toast } from 'sonner';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useLanguage } from '../lib/LanguageContext';
import { replacePlaceholders } from '../lib/i18n';
import { RLSErrorHelper } from './RLSErrorHelper';

interface Shift {
  id: number;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  location: string;
  application_deadline: string;
  approved_count: number;
  pending_count: number;
  user_application_status: string | null;
  results_published?: boolean;
  results_message?: string;
}

interface GroupDashboardProps {
  groupId: number;
  groupName: string;
  isAdmin: boolean;
  onBack: () => void;
  onCreateShift: () => void;
  onViewShift: (shiftId: number) => void;
  onManageRequests: () => void;
  onSwapRequests: () => void;
  onViewSalary: () => void;
  onManageMembers: () => void;
}

export function GroupDashboard({
  groupId,
  groupName,
  isAdmin,
  onBack,
  onCreateShift,
  onViewShift,
  onManageRequests,
  onSwapRequests,
  onViewSalary,
  onManageMembers,
}: GroupDashboardProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const { t } = useLanguage();

  const loadShifts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getShifts(groupId);
      const shiftsArray = data.shifts || [];
      const sortedData = shiftsArray.sort((a: Shift, b: Shift) => b.id - a.id);
      setShifts(sortedData);
    } catch (error: any) {
      console.error('シフト取得エラー:', error.message);
      setError(error);
      toast.error(error.message || 'シフトの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShifts();
  }, [groupId]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    });
  };

  const formatDateTime = (datetimeString: string) => {
    const date = new Date(datetimeString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isDeadlinePassed = (deadline: string) => {
    return new Date(deadline) < new Date();
  };

  const getStatusBadge = (shift: Shift) => {
    if (shift.user_application_status === 'approved') {
      return <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1 inline" />{t.shiftDetail.approved}</Badge>;
    }
    if (shift.user_application_status === 'pending') {
      return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1 inline" />{t.shiftDetail.pending}</Badge>;
    }
    if (shift.user_application_status === 'rejected') {
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1 inline" />{t.shiftDetail.rejected}</Badge>;
    }
    return null;
  };

  const filteredShifts = shifts.filter(shift => {
    if (activeTab === 'all') return true;
    if (activeTab === 'applied') return shift.user_application_status !== null;
    if (activeTab === 'available') return shift.user_application_status === null;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4">
              <Button variant="ghost" onClick={onBack} className="text-white hover:bg-blue-700 px-2 sm:px-4">
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{t.groupDashboard.back}</span>
              </Button>
              <div className="h-6 w-px bg-blue-400 hidden sm:block" />
              <div>
                <h1 className="text-lg sm:text-2xl">{groupName}</h1>
                <p className="text-xs sm:text-sm text-blue-200">{t.groupDashboard.title}</p>
              </div>
            </div>
            {isAdmin && (
              <div className="flex flex-col sm:flex-row gap-2 overflow-x-auto pb-2 sm:pb-0">
                <Button variant="secondary" onClick={onManageRequests} className="whitespace-nowrap text-sm">
                  <Users className="h-4 w-4 mr-2" />
                  {t.groupDashboard.manageRequests}
                </Button>
                <Button variant="secondary" onClick={onSwapRequests} className="whitespace-nowrap text-sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t.groupDashboard.swapRequests}
                </Button>
                <Button variant="secondary" onClick={onCreateShift} className="whitespace-nowrap text-sm">
                  <Plus className="h-4 w-4 mr-2" />
                  {t.groupDashboard.createShift}
                </Button>
                <Button variant="secondary" onClick={onViewSalary} className="whitespace-nowrap text-sm">
                  <DollarSign className="h-4 w-4 mr-2" />
                  {t.groupDashboard.viewSalary}
                </Button>
                <Button variant="secondary" onClick={onManageMembers} className="whitespace-nowrap text-sm">
                  <Users className="h-4 w-4 mr-2" />
                  {t.groupDashboard.manageMembers}
                </Button>
              </div>
            )}
            {!isAdmin && (
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="secondary" onClick={onSwapRequests} className="text-sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t.groupDashboard.shiftSwap}
                </Button>
                <Button variant="secondary" onClick={onViewSalary} className="text-sm">
                  <DollarSign className="h-4 w-4 mr-2" />
                  {t.groupDashboard.salaryCheck}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* メインコンチE��チE*/}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {error ? (
          <RLSErrorHelper error={error} />
        ) : (
          <>
            {isAdmin && (
              <FilterTagsManager groupId={groupId} />
            )}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4 sm:mb-6">
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="all" className="flex-1 sm:flex-none text-xs sm:text-sm">{t.groupDashboard.all}</TabsTrigger>
                <TabsTrigger value="available" className="flex-1 sm:flex-none text-xs sm:text-sm">{t.groupDashboard.available}</TabsTrigger>
                <TabsTrigger value="applied" className="flex-1 sm:flex-none text-xs sm:text-sm">{t.groupDashboard.applied}</TabsTrigger>
              </TabsList>
            </Tabs>

            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-sm sm:text-base">{t.groupDashboard.loading}</p>
              </div>
            ) : filteredShifts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500 mb-4 text-sm sm:text-base">
                    {activeTab === 'applied' 
                      ? t.groupDashboard.noShiftsApplied
                      : activeTab === 'available'
                      ? t.groupDashboard.noShiftsAvailable
                      : t.groupDashboard.noShifts}
                  </p>
                  {isAdmin && activeTab === 'all' && (
                    <Button onClick={onCreateShift} className="text-sm sm:text-base">
                      <Plus className="h-4 w-4 mr-2" />
                      {t.groupDashboard.createFirstShift}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:gap-4">
                {filteredShifts.map((shift) => (
                  <Card
                    key={shift.id}
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => onViewShift(shift.id)}
                  >
                    <CardHeader className="p-4 sm:p-6">
                      <div className="flex items-start justify-between gap-2 sm:gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start sm:items-center gap-2 mb-1 flex-wrap">
                            <CardTitle className="text-base sm:text-lg">{shift.title}</CardTitle>
                            {getStatusBadge(shift)}
                            {shift.results_published && (
                              <Badge variant="outline" className="text-blue-600 border-blue-600 text-xs">
                                結果発表済み
                              </Badge>
                            )}
                            {isDeadlinePassed(shift.application_deadline) && (
                              <Badge variant="outline" className="text-red-600 border-red-600 text-xs">
                                締切終了
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="line-clamp-2 text-xs sm:text-sm">
                            {shift.description || '説明なし'}
                          </CardDescription>
                          {shift.results_published && shift.results_message && (
                            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs sm:text-sm text-blue-800">
                              <div className="font-medium text-blue-900 mb-1">発表コメント:</div>
                              <div className="whitespace-pre-wrap">{shift.results_message}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {shift.start_date === shift.end_date 
                            ? formatDate(shift.start_date)
                            : `${formatDate(shift.start_date)} 、E${formatDate(shift.end_date)}`}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                        </div>
                        {shift.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {shift.location}
                          </div>
                        )}
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">応募締刁E</span>{' '}
                          <span className={isDeadlinePassed(shift.application_deadline) ? 'text-red-600' : ''}>
                            {formatDateTime(shift.application_deadline)}
                          </span>
                        </div>
                      </div>
                      {shift.pending_count > 0 && isAdmin && (
                        <div className="mt-2">
                          <Badge variant="secondary">
                            <AlertCircle className="h-3 w-3 mr-1 inline" />
                            {shift.pending_count}件の承認征E��応募
                          </Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}