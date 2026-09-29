import ProductClientPage from './ProductClientPage';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductClientPage productId={id} />;
}
