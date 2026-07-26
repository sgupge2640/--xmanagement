// Vercelデプロイ用のSupabase設定
// この環境変数はVercelで設定する必要があります

export const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "wvcwackibfvmljfejwtp";
export const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2Y3dhY2tpYmZ2bWxqZmVqd3RwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NTgwMjMsImV4cCI6MjA3ODMzNDAyM30.6mtYNnsGz7274jrVbDgSCgHdlzIr-2X5Ukr3P7AVRwU";
