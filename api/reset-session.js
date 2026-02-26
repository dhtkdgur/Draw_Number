const { createClient } = require('@supabase/supabase-js');

const supabase = () =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    // is_active → false 로 변경 (CASCADE로 available_numbers/draws는 유지)
    const { error } = await supabase()
      .from('sessions')
      .update({ is_active: false })
      .eq('is_active', true);
    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[reset-session]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
