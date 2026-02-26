const { createClient } = require('@supabase/supabase-js');

const supabase = () =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' });

  const { participant_token } = req.body ?? {};
  if (!participant_token || typeof participant_token !== 'string')
    return res.status(400).json({ error: 'participant_token 이 필요합니다.' });

  const sb = supabase();
  try {
    // 활성 세션 확인
    const { data: session, error: sErr } = await sb
      .from('sessions')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!session) return res.status(400).json({ error: '활성 세션이 없습니다.' });

    // 원자적 번호 뽑기 (PostgreSQL 함수로 경쟁 상태 방지)
    const { data: number, error: rpcErr } = await sb.rpc('draw_number', {
      p_session_id:        session.id,
      p_participant_token: participant_token,
    });
    if (rpcErr) throw rpcErr;

    if (number === null) {
      return res.status(200).json({ success: true, number: null, closed: true });
    }

    return res.status(200).json({ success: true, number, session_id: session.id });
  } catch (err) {
    console.error('[draw-number]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
