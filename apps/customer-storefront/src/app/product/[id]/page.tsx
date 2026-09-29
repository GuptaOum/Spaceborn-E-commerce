import { Metadata } from 'next';
import { PRODUCTS } from '../../../data/products';
import ProductClientPage from './ProductClientPage';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = PRODUCTS.find((p) => p.id === id);

  if (!product) {
    return {
      title: 'Component Details | Spaceborn Express',
    };
  }

  return {
    title: `${product.name} - ₹${product.price} | Spaceborn 10-Min Dispatch`,
    description: `${product.description} | Guaranteed 10-15 minute local delivery in Kanpur, Bengaluru, Noida, Delhi & Chennai.`,
    openGraph: {
      title: `${product.name} | Spaceborn Hardware Express`,
      description: `₹${product.price} (Incl. 18% GST). In-stock genuine hardware ready for immediate courier dispatch.`,
      images: [
        {
          url: product.image,
          alt: product.name,
        },
      ],
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductClientPage productId={id} />;
}
