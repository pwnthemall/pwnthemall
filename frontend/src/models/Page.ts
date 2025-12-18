export interface Page {
  id: number;
  slug: string;
  title: string;
  minio_key: string;
  created_at: string;
  updated_at: string;
}

export interface PageFormData {
  slug: string;
  title: string;
  html: string;
}

export interface PageWithContent extends Page {
  html: string;
}
