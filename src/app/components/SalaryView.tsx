import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ArrowLeft, DollarSign, Calendar, Clock, TrendingUp } from 'lucide-react';
import { getSalary, updateHourlyRate } from '../lib/api';
import { toast } from 'sonner';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { useLanguage } from '../lib/LanguageContext';

interface SalaryViewProps {
  groupId: number;
  groupName: string;
  isAdmin: boolean;
  onBack: () => void;
}

export function SalaryView({ groupId, groupName, isAdmin, onBack }: SalaryViewProps) {
  const { t } = useLanguage();
  const [salaryData, setSalaryData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newHourlyRate, setNewHourlyRate] = useState('');

  const loadSalary = async (month?: string) => {
    try {
      setLoading(true);
      const data = await getSalary(groupId, month);
      setSalaryData(data);
      setNewHourlyRate(data.hourly_rate.toString());
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSalary(selectedMonth && selectedMonth !== 'all' ? selectedMonth : undefined);
  }, [groupId, selectedMonth]);

  const handleUpdateHourlyRate = async () => {
    const rate = parseInt(newHourlyRate, 10);
    if (Number.isNaN(rate) || rate < 0) {
      toast.error(t.common.error);
      return;
    }

    try {
      await updateHourlyRate(groupId, rate);
      toast.success(t.common.success);
      setSettingsOpen(false);
      await loadSalary(selectedMonth || undefined);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const generateMonthOptions = () => {
    const options = [];
    const now = new Date();

    for (let offset = -2; offset < 12; offset++) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const year = date.getFullYear();
      const monthNum = (date.getMonth() + 1).toString().padStart(2, '0');
      options.push({
        value: `${year}-${monthNum}`,
        label: date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' }),
      });
    }

    return options;
  };

  const monthOptions = generateMonthOptions();

  const formatCurrency = (amount: number) => `¥${amount.toLocaleString()}`;
  const formatHours = (hours: number) => `${hours.toFixed(1)}時間`;
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-green-600 text-white">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-3 sm:mb-4">
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <Button variant="ghost" onClick={onBack} className="text-white hover:bg-green-700 px-2 sm:px-4">
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">戻る</span>
              </Button>
              <div className="h-6 w-px bg-green-400 hidden sm:block" />
              <div>
                <h1 className="text-lg sm:text-2xl">給料確認</h1>
                <p className="text-xs sm:text-sm text-green-200">{groupName}</p>
              </div>
            </div>
            {isAdmin && (
              <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="bg-white text-green-600 hover:bg-green-50 text-sm w-full sm:w-auto">
                    時給設定
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>時給設定</DialogTitle>
                    <DialogDescription>グループの基本時給を設定してください</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="hourly_rate">時給（円）</Label>
                      <Input
                        id="hourly_rate"
                        type="number"
                        value={newHourlyRate}
                        onChange={(e) => setNewHourlyRate(e.target.value)}
                        placeholder="1000"
                      />
                    </div>
                    <Button onClick={handleUpdateHourlyRate}>更新</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="mb-4 sm:mb-6">
          <Label htmlFor="month" className="text-sm sm:text-base">対象月</Label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="全期間" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全期間</SelectItem>
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm sm:text-base">読み込み中...</p>
          </div>
        ) : !salaryData ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500 text-sm sm:text-base">給料情報がありません</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:gap-6">
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2 sm:pb-3">
                  <CardTitle className="text-xs sm:text-sm text-gray-600">時給</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                    <span className="text-xl sm:text-2xl">{formatCurrency(salaryData.hourly_rate)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 sm:pb-3">
                  <CardTitle className="text-xs sm:text-sm text-gray-600">総勤務時間</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                    <span className="text-xl sm:text-2xl">{formatHours(salaryData.total_hours)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 sm:pb-3">
                  <CardTitle className="text-xs sm:text-sm text-gray-600">給料（目安）</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                    <span className="text-xl sm:text-2xl font-bold">{formatCurrency(salaryData.total_salary)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">勤務詳細</CardTitle>
                <CardDescription className="text-xs sm:text-sm">{salaryData.month} の勤務記録</CardDescription>
              </CardHeader>
              <CardContent>
                {!salaryData?.daily_details || salaryData.daily_details.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500 text-sm sm:text-base">この期間の勤務記録がありません</p>
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {salaryData.daily_details.map((detail: any, index: number) => (
                      <div
                        key={index}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors gap-2 sm:gap-0"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-sm sm:text-base">{detail.shift_title}</div>
                          <div className="text-xs sm:text-sm text-gray-600 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                              {formatDate(detail.date)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                              {detail.start_time.slice(0, 5)} - {detail.end_time.slice(0, 5)}
                            </span>
                          </div>
                        </div>
                        <div className="text-left sm:text-right flex sm:flex-col gap-3 sm:gap-0">
                          <div className="text-xs sm:text-sm text-gray-600">{formatHours(detail.hours)}</div>
                          <div className="font-medium text-sm sm:text-base text-green-600">{formatCurrency(detail.salary)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
