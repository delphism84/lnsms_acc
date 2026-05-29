import { redirect } from 'next/navigation';
import { storeSiteSetting } from '@/src/lib/storeScopePaths';

type Props = { params: Promise<{ agentid: string; userid: string }> };

/** 레거시 /stores/:agent/:user → /s/:agent/:store/setting */
export default async function LegacyStoreDetailPage({ params }: Props) {
  const { agentid, userid } = await params;
  redirect(storeSiteSetting(agentid, userid));
}
