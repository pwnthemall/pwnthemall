import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';


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
          <p className="mt-2 text-gray-600"></p>
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
      <div 
        className="custom-page-content"
        dangerouslySetInnerHTML={{ __html: page.html }}
      />
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { slug } = context.params as { slug: string };
  
  try {
    // Use internal backend URL for SSR (within Docker network)
    // In production: http://backend:8080
    // In development: http://localhost:8080
    const isProduction = process.env.NODE_ENV === 'production';
    const baseURL = isProduction ? 'http://backend:8080' : 'http://localhost:8080';
    
    const response = await fetch(`${baseURL}/pages/${slug}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return {
        props: {
          page: null,
          error: 'Page not found',
        },
      };
    }

    const contentType = response.headers.get('content-type');
    
    // Check if response is HTML (from ServePublicPage) or JSON
    if (contentType?.includes('text/html')) {
      const html = await response.text();
      
      return {
        props: {
          page: {
            id: 0,
            slug,
            title: slug.charAt(0).toUpperCase() + slug.slice(1),
            html,
          },
        },
      };
    } else if (contentType?.includes('application/json')) {
      const data = await response.json();
      
      return {
        props: {
          page: data.page || data,
        },
      };
    }

    return {
      props: {
        page: null,
        error: 'Invalid response format',
      },
    };
  } catch (error) {
    console.error('Error fetching page:', error);
    return {
      props: {
        page: null,
        error: 'Failed to load page',
      },
    };
  }
};
