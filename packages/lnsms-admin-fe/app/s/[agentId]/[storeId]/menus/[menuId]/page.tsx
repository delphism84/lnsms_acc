import MenuDetailClient from '@/app/stores/MenuDetailClient';

type Props = { params: Promise<{ agentId: string; storeId: string; menuId: string }> };

export default async function StoreSiteMenuPage({ params }: Props) {
  const { agentId, storeId, menuId } = await params;
  return <MenuDetailClient agentId={agentId} storeId={storeId} menuId={menuId} />;
}
