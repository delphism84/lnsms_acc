let seq = 0;

function nextTrid() {
  const ms = Date.now();
  seq = (seq + 1) % 1_000_000;
  return `${ms}${String(seq).padStart(6, '0')}`;
}

function frame({ sender, dest, topic, tag, msg, trid }) {
  return {
    v: 1,
    trid: trid || nextTrid(),
    sender: sender || 'lnsms.server',
    dest: dest || '*',
    topic: topic || 'lnsms.session',
    tag,
    msg: msg || {},
  };
}

function topicMatches(pattern, topic) {
  if (!pattern || !topic) return false;
  if (pattern === topic) return true;
  if (pattern.endsWith('.>')) {
    const prefix = pattern.slice(0, -2);
    return topic === prefix || topic.startsWith(`${prefix}.`);
  }
  if (pattern.endsWith('*')) {
    return topic.startsWith(pattern.slice(0, -1));
  }
  return false;
}

module.exports = { nextTrid, frame, topicMatches };
