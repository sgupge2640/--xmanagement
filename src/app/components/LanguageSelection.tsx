import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Globe, Check } from 'lucide-react';
import { Language, getTranslation } from '../lib/i18n';
import { useLanguage } from '../lib/LanguageContext';

interface LanguageSelectionProps {
  onLanguageSelect: (language: Language) => void;
}

export function LanguageSelection({ onLanguageSelect }: LanguageSelectionProps) {
  const { language, setLanguage } = useLanguage();
  const [selectedLang, setSelectedLang] = useState<Language>(language);
  const t = getTranslation(selectedLang);

  const languages: { code: Language; name: string; flag: string }[] = [
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'zh', name: '中文（简体）', flag: '🇨🇳' },
  ];

  const handleContinue = () => {
    setLanguage(selectedLang); // コンテキストを更新
    onLanguageSelect(selectedLang);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 flex items-center justify-center p-3 sm:p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="p-4 sm:p-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-br from-purple-500 to-blue-600 p-4 rounded-full">
              <Globe className="h-12 w-12 sm:h-16 sm:w-16 text-white" />
            </div>
          </div>
          <CardTitle className="text-xl sm:text-2xl">{t.languageSelection.title}</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            {t.languageSelection.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="space-y-3">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setSelectedLang(lang.code)}
                className={`w-full p-4 sm:p-5 rounded-lg border-2 transition-all flex items-center justify-between group hover:scale-[1.02] ${
                  selectedLang === lang.code
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <span className="text-2xl sm:text-3xl">{lang.flag}</span>
                  <span
                    className={`text-base sm:text-lg font-medium ${
                      selectedLang === lang.code ? 'text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    {lang.name}
                  </span>
                </div>
                {selectedLang === lang.code && (
                  <div className="bg-blue-500 rounded-full p-1">
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
          <Button onClick={handleContinue} className="w-full mt-6 text-sm sm:text-base" size="lg">
            {t.languageSelection.continue}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}