const { createClient } = require('@supabase/supabase-js');

const supabase = () =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')
    return res.status(405).json({ error: 'Method Not Allowed' });

  const sb = supabase();
  try {
    // 활성 세션 조회
    const { data: session, error: sErr } = await sb
      .from('sessions')
      .select('*')
      .eq('is_active', true)
      .maybeSingle(); // 없으면 null, 에러 안 던짐
    if (sErr) throw sErr;

    if (!session) return res.status(200).json({ session: null });

    // 배정된 인원 수 카운트
    const { count: drawnCount, error: cErr } = await sb
      .from('draws')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id);
    if (cErr) throw cErr;

    return res.status(200).json({
      session: { ...session, drawn_count: drawnCount ?? 0 },
    });
  } catch (err) {
    console.error('[session-status]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
