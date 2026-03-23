const agents = [];

export function getRegisteredAgents() {
  return [...agents];
}

export function registerAgent({ callbackUrl, setid, storeid }) {
  const url = callbackUrl?.trim();
  if (!url) return false;
  const existing = agents.find((a) => a.callbackUrl === url);
  if (existing) {
    existing.setid = setid ?? existing.setid;
    existing.storeid = storeid ?? existing.storeid;
    existing.updatedAt = new Date();
    return true;
  }
  agents.push({
    callbackUrl: url,
    setid: setid || null,
    storeid: storeid || null,
    updatedAt: new Date(),
  });
  return true;
}
