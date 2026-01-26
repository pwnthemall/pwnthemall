export interface Page {
  id: number;
  slug: string;
  title: string;
  minio_key: string;
  is_in_sidebar: boolean;
  order: number;
  source: 'ui' | 'minio';
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SidebarPage {
  id: number;
  slug: string;
  title: string;
  order: number;
  is_in_sidebar: boolean;
  source?: 'ui' | 'minio';
  created_at: string;
  updated_at: string;
}

export interface PageFormData {
  slug: string;
  title: string;
  html: string;
  is_in_sidebar?: boolean;
}

export interface PageWithContent extends Page {
  html: string;
}
