const { createClient } = require('@supabase/supabase-js');

const supabase = () =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' });

  const count = parseInt(req.body?.total_count, 10);
  if (!count || count < 1 || count > 1000)
    return res.status(400).json({ error: '인원 수는 1~1000 사이여야 합니다.' });

  const sb = supabase();
  try {
    // 기존 활성 세션 비활성화
    await sb.from('sessions').update({ is_active: false }).eq('is_active', true);

    // 새 세션 생성
    const { data: session, error: sErr } = await sb
      .from('sessions')
      .insert({ total_count: count })
      .select()
      .single();
    if (sErr) throw sErr;

    // 번호 풀 생성 (500개씩 청크 → Supabase 행 제한 대응)
    const numbers = Array.from({ length: count }, (_, i) => ({
      session_id: session.id,
      number: i + 1,
    }));
    for (let i = 0; i < numbers.length; i += 500) {
      const { error: nErr } = await sb
        .from('available_numbers')
        .insert(numbers.slice(i, i + 500));
      if (nErr) throw nErr;
    }

    return res.status(200).json({ success: true, session });
  } catch (err) {
    console.error('[start-session]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
