const defaultProjectId = 'pfqkjfzakzvlgxbfnqve';
const defaultAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmcWtqZnpha3p2bGd4YmZucXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0OTgzMzcsImV4cCI6MjA4MjA3NDMzN30.TZHj2r7mzxfg7H2AxIETmmpnmf93_CVSvoawJVgM-Zs';

export const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || defaultProjectId;
export const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || defaultAnonKey;