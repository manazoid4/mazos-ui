const localSnapshotUrl = process.env.MAZOS_LOCAL_SNAPSHOT_URL || 'http://127.0.0.1:3046/api/mazos/remote';
const pushUrl = process.env.MAZOS_REMOTE_PUSH_URL || 'http://127.0.0.1:3046/api/mazos/remote/push';
const token = process.env.MAZOS_REMOTE_SYNC_TOKEN || '';

async function main() {
  const snapshotResponse = await fetch(localSnapshotUrl);
  if (!snapshotResponse.ok) {
    throw new Error(`Failed to read local snapshot: ${snapshotResponse.status} ${snapshotResponse.statusText}`);
  }

  const snapshot = await snapshotResponse.json();
  const pushResponse = await fetch(pushUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(snapshot),
  });

  const result = await pushResponse.json().catch(() => ({}));
  if (!pushResponse.ok) {
    throw new Error(`Failed to publish snapshot: ${pushResponse.status} ${JSON.stringify(result)}`);
  }

  console.log(JSON.stringify({
    ok: true,
    from: localSnapshotUrl,
    to: pushUrl,
    generatedAt: snapshot.generatedAt,
    result,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
