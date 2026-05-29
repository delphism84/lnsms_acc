import { redirect } from 'next/navigation';
import { storeSiteBase } from '@/src/lib/storeScopePaths';

type Props = { params: Promise<{ agentid: string; userid: string; menuId: string }> };

export default async function LegacyMenuDetailPage({ params }: Props) {
  const { agentid, userid, menuId } = await params;
  redirect(`${storeSiteBase(agentid, userid)}/menus/${menuId}`);
}
