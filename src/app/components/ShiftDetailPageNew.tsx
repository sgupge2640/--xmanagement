import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ArrowLeft, Calendar, Clock, MapPin, Users, CheckCircle2, XCircle, AlertCircle, Megaphone, ChevronDown, ChevronUp } from 'lucide-react';
import { getShiftDetail, applyToShift, approveShiftApplication, publishShiftResults } from '../lib/api';
import { toast } from 'sonner';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { AppliedShiftCalendar } from './AppliedShiftCalendar';

interface ShiftDetail {
  shift: {
    id: number;
    title: string;
    description: string;
    start_date: string;
    end_date: string;
    start_time: string;
    end_time: string;
    location: string;
    application_deadline: string;
    group_name: string;
    results_published?: boolean;
    results_message?: string;
    results_published_at?: string;
  };
  applications: Array<{
    id: number;
    user_email: string;
    user_name: string;
    status: string;
    applied_at: string;
    daily_schedule?: Array<{
      date: string;
      start_time: string;
      end_time: string;
    }>;
  }>;
  is_admin: boolean;
}

interface DailyScheduleItem {
  date: string;
  checked: boolean;
  start_time: string;
  end_time: string;
}

interface ApplicationWithTime {
  id: number;
  user_name: string;
  user_email: string;
  status: string;
  start_time: string;
  end_time: string;
  selected: boolean;
}

interface TimeAdjustSectionProps {
  apps: ApplicationWithTime[];
  date: string;
  open: boolean;
  onToggle: () => void;
  onTimeChange: (date: string, appId: number, field: 'start_time' | 'end_time', value: string) => void;
}

function TimeAdjustSection({ apps, date, open, onToggle, onTimeChange }: TimeAdjustSectionProps) {
  return (
    <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <span>驕ｸ謚樔ｸｭ {apps.length} 莠ｺ縺ｮ譎る俣繧定ｪｿ謨ｴ縺吶ｋ</span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="p-3 space-y-3 bg-gray-50 border-t border-gray-200">
          {apps.map(app => (
            <div key={app.id}>
              <div className="text-xs font-medium text-gray-700 mb-1">{app.user_name}</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-gray-500">髢句ｧ・/Label>
                  <Input type="time" step="600" value={app.start_time}
                    onChange={e => onTimeChange(date, app.id, 'start_time', e.target.value)}
                    className="mt-0.5 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">邨ゆｺ・/Label>
                  <Input type="time" step="600" value={app.end_time}
                    onChange={e => onTimeChange(date, app.id, 'end_time', e.target.value)}
                    className="mt-0.5 h-8 text-sm" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ShiftDetailPageProps {
  shiftId: number;
  onBack: () => void;
}

export function ShiftDetailPage({ shiftId, onBack }: ShiftDetailPageProps) {
  const [detail, setDetail] = useState<ShiftDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [processingDate, setProcessingDate] = useState<string | null>(null);
  const [dailySchedules, setDailySchedules] = useState<DailyScheduleItem[]>([]);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [publishingResults, setPublishingResults] = useState(false);
  const [resultsMessage, setResultsMessage] = useState('');
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  
  // 譌･莉倥＃縺ｨ縺ｮ蠢懷供閠・→邱ｨ髮・庄閭ｽ縺ｪ譎る俣
  const [dateApplications, setDateApplications] = useState<{ [date: string]: ApplicationWithTime[] }>({});
  // 譌･莉倥＃縺ｨ縺ｮ譎る俣隱ｿ謨ｴ繧ｻ繧ｯ繧ｷ繝ｧ繝ｳ縺ｮ髢矩哩
  const [timeAdjustOpen, setTimeAdjustOpen] = useState<{ [date: string]: boolean }>({});

  // 譌･莉倥Μ繧ｹ繝医ｒ逕滓・
  const generateDateList = (startDate: string, endDate: string, defaultStartTime: string, defaultEndTime: string): DailyScheduleItem[] => {
    const dates: DailyScheduleItem[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      dates.push({
        date: date.toISOString().split('T')[0],
        checked: true,
        start_time: defaultStartTime,
        end_time: defaultEndTime,
      });
    }
    
    return dates;
  };

  const loadDetail = async () => {
    try {
      setLoading(true);
      const data = await getShiftDetail(shiftId);
      setDetail(data);
      
      // 譌･縺斐→縺ｮ繧ｹ繧ｱ繧ｸ繝･繝ｼ繝ｫ繧貞・譛溷喧
      const dates = generateDateList(
        data.shift.start_date,
        data.shift.end_date,
        data.shift.start_time,
        data.shift.end_time
      );
      setDailySchedules(dates);
      
      // 譛蛻昴・譌･莉倥ｒ驕ｸ謚・      if (dates.length > 0) {
        setSelectedDate(dates[0].date);
      }
      
      // 譌･莉倥＃縺ｨ縺ｮ蠢懷供閠・ｒ謨ｴ逅・ｼ育ｮ｡逅・・畑・・      if (data.is_admin) {
        const dateApps: { [date: string]: ApplicationWithTime[] } = {};
        
        dates.forEach(({ date }) => {
          dateApps[date] = [];
        });
        
        data.applications.forEach(app => {
          if (app.daily_schedule && app.daily_schedule.length > 0) {
            // 譌･縺斐→縺ｮ繧ｹ繧ｱ繧ｸ繝･繝ｼ繝ｫ縺後≠繧句ｴ蜷・            app.daily_schedule.forEach(day => {
              if (!dateApps[day.date]) {
                dateApps[day.date] = [];
              }
              dateApps[day.date].push({
                id: app.id,
                user_name: app.user_name,
                user_email: app.user_email,
                status: app.status,
                start_time: day.start_time,
                end_time: day.end_time,
                selected: false,
              });
            });
          } else {
            // 蜈ｨ譛滄俣縺ｫ蠢懷供縺励※縺・ｋ蝣ｴ蜷・            dates.forEach(({ date }) => {
              dateApps[date].push({
                id: app.id,
                user_name: app.user_name,
                user_email: app.user_email,
                status: app.status,
                start_time: data.shift.start_time,
                end_time: data.shift.end_time,
                selected: false,
              });
            });
          }
        });
        
        setDateApplications(dateApps);
      }
    } catch (error: any) {
      toast.error(error.message || '繧ｷ繝輔ヨ諠・ｱ縺ｮ蜿門ｾ励↓螟ｱ謨励＠縺ｾ縺励◆');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [shiftId]);

  const handleShowApplicationForm = () => {
    setShowApplicationForm(true);
  };

  const handleApply = async () => {
    // 繝√ぉ繝・け縺輔ｌ縺滓律莉倥・縺ｿ繧帝∽ｿ｡
    const selectedSchedules = dailySchedules
      .filter(item => item.checked)
      .map(item => ({
        date: item.date,
        start_time: item.start_time,
        end_time: item.end_time,
      }));

    if (selectedSchedules.length === 0) {
      toast.error('蟆代↑縺上→繧・譌･莉･荳企∈謚槭＠縺ｦ縺上□縺輔＞');
      return;
    }

    setApplying(true);
    try {
      await applyToShift(shiftId, selectedSchedules);
      toast.success('繧ｷ繝輔ヨ縺ｫ蠢懷供縺励∪縺励◆・・);
      setShowApplicationForm(false);
      await loadDetail();
    } catch (error: any) {
      toast.error(error.message || '蠢懷供縺ｫ螟ｱ謨励＠縺ｾ縺励◆');
    } finally {
      setApplying(false);
    }
  };

  const handleCheckChange = (index: number, checked: boolean) => {
    const newSchedules = [...dailySchedules];
    newSchedules[index].checked = checked;
    setDailySchedules(newSchedules);
  };

  const handleTimeChange = (index: number, field: 'start_time' | 'end_time', value: string) => {
    const newSchedules = [...dailySchedules];
    newSchedules[index][field] = value;
    setDailySchedules(newSchedules);
  };

  // 邂｡逅・・畑・壽律莉倥＃縺ｨ縺ｮ蠢懷供閠・・驕ｸ謚樒憾諷九ｒ螟画峩
  const handleApplicationSelect = (date: string, appId: number, checked: boolean) => {
    setDateApplications(prev => {
      const newState = { ...prev };
      const apps = newState[date].map(app => 
        app.id === appId ? { ...app, selected: checked } : app
      );
      newState[date] = apps;
      return newState;
    });
  };

  // 邂｡逅・・畑・壼ｿ懷供閠・・譎る俣繧貞､画峩
  const handleApplicationTimeChange = (date: string, appId: number, field: 'start_time' | 'end_time', value: string) => {
    setDateApplications(prev => {
      const newState = { ...prev };
      const apps = newState[date].map(app => 
        app.id === appId ? { ...app, [field]: value } : app
      );
      newState[date] = apps;
      return newState;
    });
  };

  // 邂｡逅・・畑・夐∈謚槭＠縺溷ｿ懷供繧呈価隱・  const handleApproveSelectedForDate = async (date: string) => {
    const apps = dateApplications[date] || [];
    const selected = apps.filter(app => app.selected && app.status === 'pending');
    
    if (selected.length === 0) {
      toast.error('謇ｿ隱阪☆繧句ｿ懷供繧帝∈謚槭＠縺ｦ縺上□縺輔＞');
      return;
    }

    setProcessingDate(date);
    try {
      // 蜷・ｿ懷供繧貞句挨縺ｫ謇ｿ隱搾ｼ育ｮ｡逅・・′險ｭ螳壹＠縺滓凾髢薙〒・・      for (const app of selected) {
        const approvedSchedule = [{
          date: date,
          start_time: app.start_time,
          end_time: app.end_time,
        }];
        await approveShiftApplication(app.id, approvedSchedule);
      }
      toast.success(`${selected.length}莉ｶ縺ｮ蠢懷供繧呈価隱阪＠縺ｾ縺励◆`);
      await loadDetail();
    } catch (error: any) {
      toast.error(error.message || '謇ｿ隱阪↓螟ｱ謨励＠縺ｾ縺励◆');
    } finally {
      setProcessingDate(null);
    }
  };

  const handlePublishResults = async () => {
    setPublishingResults(true);
    try {
      await publishShiftResults(shiftId, resultsMessage);
      toast.success('邨先棡繧貞・髢九＠縺ｾ縺励◆');
      await loadDetail();
    } catch (error: any) {
      toast.error(error.message || '邨先棡縺ｮ蜈ｬ髢九↓螟ｱ謨励＠縺ｾ縺励◆');
    } finally {
      setPublishingResults(false);
      setShowPublishDialog(false);
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
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto py-8">
          <div className="text-center py-12">
            <p className="text-gray-500">隱ｭ縺ｿ霎ｼ縺ｿ荳ｭ...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto py-8">
          <Button variant="ghost" onClick={onBack} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            謌ｻ繧・          </Button>
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">繧ｷ繝輔ヨ諠・ｱ縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { shift, applications, is_admin } = detail;
  const approvedCount = applications.filter(app => app.status === 'approved').length;
  const pendingCount = applications.filter(app => app.status === 'pending').length;
  const userApplication = applications.find(app => app.user_email === localStorage.getItem('user_email'));
  const isDeadlinePassed = new Date(shift.application_deadline) < new Date();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto py-8">
        <Button variant="ghost" onClick={onBack} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          謌ｻ繧・        </Button>

        {/* 繧ｷ繝輔ヨ隧ｳ邏ｰ */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <CardTitle className="text-2xl">{shift.title}</CardTitle>
                  {isDeadlinePassed && (
                    <Badge variant="outline" className="text-red-600 border-red-600">
                      邱蛻・ｵゆｺ・                    </Badge>
                  )}
                </div>
                <CardDescription>{shift.group_name}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {shift.description && (
              <p className="text-gray-700">{shift.description}</p>
            )}
            
            <div className="grid gap-3 text-gray-700">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-gray-500" />
                <span>
                  {shift.start_date === shift.end_date 
                    ? formatDate(shift.start_date)
                    : `${formatDate(shift.start_date)} 縲・${formatDate(shift.end_date)}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-500" />
                <span>{shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}</span>
              </div>
              {shift.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-gray-500" />
                  <span>{shift.location}</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-gray-200">
              <div className="text-sm">
                <span className="font-medium text-gray-700">蠢懷供邱蛻・</span>{' '}
                <span className={isDeadlinePassed ? 'text-red-600 font-medium' : 'text-gray-700'}>
                  {formatDateTime(shift.application_deadline)}
                </span>
              </div>
            </div>

            {!is_admin && !userApplication && !showApplicationForm && (
              <div className="pt-4">
                <Button 
                  onClick={handleShowApplicationForm} 
                  disabled={isDeadlinePassed} 
                  className="w-full"
                >
                  {isDeadlinePassed ? '蠢懷供邱蛻・ｸ医∩' : '縺薙・繧ｷ繝輔ヨ縺ｫ蠢懷供縺吶ｋ'}
                </Button>
              </div>
            )}

            {!is_admin && !userApplication && showApplicationForm && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="font-medium mb-4">譌･縺斐→縺ｮ蟆ｱ讌ｭ譎る俣繧定ｨｭ螳壹＠縺ｦ縺上□縺輔＞</h3>
                <div className="space-y-3 mb-4">
                  {dailySchedules.map((schedule, index) => (
                    <div key={schedule.date} className="border rounded-lg p-4 bg-white">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={`day-${index}`}
                          checked={schedule.checked}
                          onCheckedChange={(checked) => handleCheckChange(index, checked as boolean)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <Label htmlFor={`day-${index}`} className="text-base cursor-pointer">
                            {formatDate(schedule.date)}
                          </Label>
                          {schedule.checked && (
                            <div className="grid grid-cols-2 gap-3 mt-3">
                              <div>
                                <Label htmlFor={`start-${index}`} className="text-sm text-gray-600">
                                  髢句ｧ区凾蛻ｻ
                                </Label>
                                <Input
                                  id={`start-${index}`}
                                  type="time" step="600"
                                  value={schedule.start_time}
                                  onChange={(e) => handleTimeChange(index, 'start_time', e.target.value)}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label htmlFor={`end-${index}`} className="text-sm text-gray-600">
                                  邨ゆｺ・凾蛻ｻ
                                </Label>
                                <Input
                                  id={`end-${index}`}
                                  type="time" step="600"
                                  value={schedule.end_time}
                                  onChange={(e) => handleTimeChange(index, 'end_time', e.target.value)}
                                  className="mt-1"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleApply} 
                    disabled={applying} 
                    className="flex-1"
                  >
                    {applying ? '蠢懷供荳ｭ...' : '蠢懷供縺吶ｋ'}
                  </Button>
                  <Button 
                    onClick={() => setShowApplicationForm(false)} 
                    variant="outline"
                    disabled={applying}
                  >
                    繧ｭ繝｣繝ｳ繧ｻ繝ｫ
                  </Button>
                </div>
              </div>
            )}

            {!is_admin && userApplication && (
              <div className="pt-4 space-y-3">
                {userApplication.status === 'pending' && (
                  <Badge variant="secondary" className="w-full justify-center py-2">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    謇ｿ隱榊ｾ・■
                  </Badge>
                )}
                {userApplication.status === 'approved' && (
                  <Badge variant="default" className="w-full justify-center py-2">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    謇ｿ隱肴ｸ医∩
                  </Badge>
                )}
                {userApplication.status === 'rejected' && (
                  <Badge variant="destructive" className="w-full justify-center py-2">
                    <XCircle className="h-4 w-4 mr-2" />
                    諡貞凄縺輔ｌ縺ｾ縺励◆
                  </Badge>
                )}
                
                {userApplication.daily_schedule && userApplication.daily_schedule.length > 0 && (
                  <div className="border-t pt-3">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">縺ゅ↑縺溘・蠢懷供蜀・ｮｹ</h4>
                    <AppliedShiftCalendar
                      appliedDays={userApplication.daily_schedule}
                      startDate={shift.start_date}
                      endDate={shift.end_date}
                    />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 譌･莉伜挨蠢懷供閠・ｸ隕ｧ・育ｮ｡逅・・・縺ｿ・・*/}
        {is_admin && (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle>譌･莉伜挨蠢懷供閠・ｮ｡逅・/CardTitle>
                  <CardDescription>
                    {applications.length}莉ｶ縺ｮ蠢懷供・域価隱肴ｸ医∩: {approvedCount}莉ｶ縲∵価隱榊ｾ・■: {pendingCount}莉ｶ・・                  </CardDescription>
                </div>
                {!shift.results_published && applications.length > 0 && (
                  <Button
                    onClick={() => setShowPublishDialog(true)}
                    disabled={publishingResults}
                    variant="outline"
                  >
                    <Megaphone className="h-4 w-4 mr-2" />
                    邨先棡繧堤匱陦ｨ
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {shift.results_published && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Megaphone className="h-5 w-5 text-blue-600" />
                    <h3 className="font-medium text-blue-900">謗｡逕ｨ邨先棡繧堤匱陦ｨ縺励∪縺励◆</h3>
                  </div>
                  <p className="text-sm text-blue-700 mb-1">
                    逋ｺ陦ｨ譌･譎・ {formatDateTime(shift.results_published_at || '')}
                  </p>
                  {shift.results_message && (
                    <p className="text-sm text-blue-800 mt-2 whitespace-pre-wrap">
                      {shift.results_message}
                    </p>
                  )}
                </div>
              )}
              
              {applications.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>縺ｾ縺蠢懷供閠・′縺・∪縺帙ｓ</p>
                </div>
              ) : (
                <Tabs value={selectedDate} onValueChange={setSelectedDate}>
                  <TabsList className="w-full flex-wrap h-auto">
                    {dailySchedules.map((schedule) => {
                      const appsForDate = dateApplications[schedule.date] || [];
                      const pendingForDate = appsForDate.filter(app => app.status === 'pending').length;
                      
                      return (
                        <TabsTrigger key={schedule.date} value={schedule.date} className="flex-1 min-w-[120px]">
                          <div className="text-center">
                            <div>{formatDate(schedule.date).split(' ')[0]}</div>
                            {pendingForDate > 0 && (
                              <Badge variant="secondary" className="mt-1 text-xs">
                                {pendingForDate}莉ｶ
                              </Badge>
                            )}
                          </div>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                  
                  {dailySchedules.map((schedule) => {
                    const appsForDate = dateApplications[schedule.date] || [];
                    const pendingApps = appsForDate.filter(app => app.status === 'pending');
                    const approvedApps = appsForDate.filter(app => app.status === 'approved');
                    
                    return (
                      <TabsContent key={schedule.date} value={schedule.date} className="mt-4">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium">
                              {formatDate(schedule.date)} 縺ｮ蠢懷供閠・                            </h3>
                            {pendingApps.length > 0 && !shift.results_published && (
                              <Button
                                onClick={() => handleApproveSelectedForDate(schedule.date)}
                                disabled={processingDate === schedule.date || pendingApps.filter(a => a.selected).length === 0}
                                size="sm"
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                驕ｸ謚槭ｒ謇ｿ隱・({pendingApps.filter(a => a.selected).length})
                              </Button>
                            )}
                          </div>

                          {appsForDate.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              <p>縺薙・譌･縺ｮ蠢懷供閠・・縺・∪縺帙ｓ</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {/* 謇ｿ隱榊ｾ・■ */}
                              {pendingApps.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4" />
                                    謇ｿ隱榊ｾ・■ ({pendingApps.length})
                                  </h4>
                                  <div className="space-y-2">
                                    {pendingApps.map((app) => (
                                      <div
                                        key={`${app.id}-${schedule.date}`}
                                        className={`border rounded-lg p-3 bg-white flex items-center gap-3 ${app.selected ? 'border-blue-300 bg-blue-50' : ''}`}
                                      >
                                        {!shift.results_published && (
                                          <Checkbox
                                            checked={app.selected}
                                            onCheckedChange={(checked) =>
                                              handleApplicationSelect(schedule.date, app.id, checked as boolean)
                                            }
                                          />
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium">{app.user_name}</div>
                                          <div className="text-xs text-gray-500 truncate">{app.user_email}</div>
                                        </div>
                                        <div className="text-xs text-gray-400 whitespace-nowrap">
                                          {app.start_time.slice(0, 5)} - {app.end_time.slice(0, 5)}
                                        </div>
                                      </div>
                                    ))}
                                    {/* 驕ｸ謚樊ｸ医∩縺ｮ譎る俣隱ｿ謨ｴ・域釜繧翫◆縺溘∩・・*/}
                                    {(() => {
                                      const selectedPending = pendingApps.filter(a => a.selected);
                                      if (selectedPending.length === 0 || shift.results_published) return null;
                                      return <TimeAdjustSection apps={selectedPending} date={schedule.date} open={!!timeAdjustOpen[schedule.date]} onToggle={() => setTimeAdjustOpen(prev => ({ ...prev, [schedule.date]: !prev[schedule.date] }))} onTimeChange={handleApplicationTimeChange} />;
                                    })()}
                                  </div>
                                </div>
                              )}

                              {/* 謇ｿ隱肴ｸ医∩ */}
                              {approvedApps.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    謇ｿ隱肴ｸ医∩ ({approvedApps.length})
                                  </h4>
                                  <div className="space-y-2">
                                    {approvedApps.map((app) => (
                                      <div key={`${app.id}-${schedule.date}`} className="border rounded-lg p-4 bg-green-50 border-green-200">
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <div className="font-medium">{app.user_name}</div>
                                            <div className="text-sm text-gray-600">{app.user_email}</div>
                                          </div>
                                          <div className="text-right">
                                            <div className="flex items-center gap-2 text-sm text-gray-700">
                                              <Clock className="h-4 w-4" />
                                              <span>{app.start_time.slice(0, 5)} - {app.end_time.slice(0, 5)}</span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    );
                  })}
                </Tabs>
              )}
            </CardContent>
          </Card>
        )}

        {/* 邨先棡逋ｺ陦ｨ繝繧､繧｢繝ｭ繧ｰ */}
        <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>謗｡逕ｨ邨先棡繧堤匱陦ｨ縺励∪縺吶°・・/DialogTitle>
              <DialogDescription>
                邨先棡繧堤匱陦ｨ縺吶ｋ縺ｨ縲∵価隱榊ｾ・■縺ｮ蠢懷供縺ｯ閾ｪ蜍慕噪縺ｫ荳肴治逕ｨ縺ｨ縺ｪ繧翫∪縺吶ゅ％縺ｮ謫堺ｽ懊・蜿悶ｊ豸医○縺ｾ縺帙ｓ縲・              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="results-message" className="text-sm font-medium">
                繝｡繝・そ繝ｼ繧ｸ・井ｻｻ諢擾ｼ・              </Label>
              <Textarea
                id="results-message"
                value={resultsMessage}
                onChange={(e) => setResultsMessage(e.target.value)}
                placeholder="謗｡逕ｨ閠・∈縺ｮ繝｡繝・そ繝ｼ繧ｸ繧貞・蜉帙＠縺ｦ縺上□縺輔＞・井ｾ具ｼ壹♀逍ｲ繧梧ｧ倥〒縺励◆・∵治逕ｨ縺輔ｌ縺滓婿縺ｯ縺皮｢ｺ隱阪￥縺縺輔＞縲ゑｼ・
                className="mt-2"
                rows={4}
              />
            </div>
            <DialogFooter className="flex gap-2">
              <Button
                onClick={() => setShowPublishDialog(false)}
                variant="outline"
                disabled={publishingResults}
                className="flex-1"
              >
                繧ｭ繝｣繝ｳ繧ｻ繝ｫ
              </Button>
              <Button
                onClick={handlePublishResults}
                disabled={publishingResults}
                className="flex-1"
              >
                {publishingResults ? '逋ｺ陦ｨ荳ｭ...' : '邨先棡繧堤匱陦ｨ'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
