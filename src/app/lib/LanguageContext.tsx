import { createContext, useContext, ReactNode, useMemo } from 'react';
import { getTranslation } from './i18n';

interface LanguageContextType {
  t: ReturnType<typeof getTranslation>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // 常に日本語に固定
  const t = useMemo(() => getTranslation('ja'), []);

  const value = useMemo(() => ({
    t,
  }), [t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}