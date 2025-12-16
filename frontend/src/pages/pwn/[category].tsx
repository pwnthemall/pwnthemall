import { useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";

export default function CategoryPage() {
  const router = useRouter();
  const { category } = router.query;
  const cat = Array.isArray(category) ? category[0] : category;

  useEffect(() => {
    if (!cat) return;
    router.replace({ pathname: "/pwn", query: { category: cat } });
  }, [cat, router]);

  return (
    <>
      <Head>
        <title>Challenges</title>
      </Head>
    </>
  );
}
