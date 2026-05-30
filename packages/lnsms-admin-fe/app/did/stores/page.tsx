import { redirect } from 'next/navigation';

/** 레거시 /did/stores → Platform 매장 목록 */
export default function DidStoresLegacyRedirect() {
  redirect('/platform');
}
