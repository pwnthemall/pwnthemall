import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import { debugLog } from '@/lib/debug';


interface PageProps {
  page: {
    id: number;
    slug: string;
    title: string;
    html: string;
  } | null;
  error?: string;
}

export default function CustomPage({ page, error }: PageProps) {
  const router = useRouter();

  if (error || !page) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold">404</h1>
          <p className="mt-2 text-gray-600">
            {error === 'Page not found' && page === null 
              ? `Page not found` 
              : error || 'An error occurred while loading the page'}
          </p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{page.title}</title>
        <meta httpEquiv="Content-Security-Policy" content="script-src 'none'; style-src 'unsafe-inline';" />
      </Head>
      <div className="min-h-screen">
        <main className="container mx-auto px-4 py-8">
          <div 
            className="custom-page-content prose prose-lg dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: page.html }}
          />
        </main>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { slug } = context.params as { slug: string };
  
  const internalApiUrl = process.env.INTERNAL_API_URL || 'http://backend:8080';
  
  if (!internalApiUrl) {
    return {
      props: {
        page: null,
        error: 'Configuration error',
      },
    };
  }
  
  const apiClient = axios.create({
    baseURL: internalApiUrl,
    timeout: 5000,
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  try {
    debugLog('[SSR] Fetching page:', slug, 'from', internalApiUrl);
    const response = await apiClient.get(`/pages/${slug}`);
    debugLog('[SSR] Fetched page data:', response.data);
    
    if (response.data && response.data.page) {
      return {
        props: {
          page: {
            id: response.data.page.id,
            slug: response.data.page.slug,
            title: response.data.page.title,
            html: response.data.page.html,
          },
        },
      };
    }

    return {
      props: {
        page: null,
        error: 'Invalid response format',
      },
    };
  } catch (error: any) {
    console.error('[SSR Error] Failed to fetch page:', error.message);
    
    // Check if it's a 404 error
    if (error.response?.status === 404) {
      return {
        props: {
          page: null,
          error: 'Page not found',
        },
      };
    }
    
    return {
      props: {
        page: null,
        error: 'Failed to load page',
      },
    };
  }
};
