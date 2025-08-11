// api-compound.js - API mínima para planes compuestos
const SB = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

async function loginMagic(email){
  const { data, error } = await SB.auth.signInWithOtp({ email });
  if(error) throw error;
  return data;
}
async function getCurrentUser(){
  const { data, error } = await SB.auth.getUser();
  if(error) throw error;
  return data.user || null;
}
async function createPlan({ title, city, when_ts, deadline_ts, collab=true, is_public=false }){
  const user = await getCurrentUser();
  if(!user) throw new Error('No autenticado');
  const { data, error } = await SB.from('plans')
    .insert([{ owner_id: user.id, title, city, when_ts, deadline_ts, collab, is_public }])
    .select().single();
  if(error) throw error;
  return data;
}
async function addInvite(plan_id, invited_id, role='participant'){
  const { data, error } = await SB.from('plan_invites')
    .insert([{ plan_id, invited_id, role }]).select().single();
  if(error) throw error;
  return data;
}
async function addBlock(plan_id, { title, starts_at=null, ends_at=null, sort_order=1 }){
  const { data, error } = await SB.from('plan_blocks')
    .insert([{ plan_id, title, starts_at, ends_at, sort_order }]).select().single();
  if(error) throw error;
  return data;
}
async function reorderBlocks(plan_id, newOrders){
  const updates = await Promise.all(newOrders.map(row =>
    SB.from('plan_blocks').update({ sort_order: row.sort_order }).eq('id', row.block_id).select().single()
  ));
  return updates.map(u => u.data);
}
async function addBlockOption(block_id, { text, cat=null, place=null, price_num=null }){
  const user = await getCurrentUser();
  const payload = { block_id, text, cat, place, price_num, created_by: user?.id || null };
  const { data, error } = await SB.from('block_options').insert([payload]).select().single();
  if(error) throw error;
  return data;
}
async function voteOption(block_id, option_id){
  const user = await getCurrentUser();
  if(!user) throw new Error('No autenticado');
  const { error } = await SB.from('block_votes').insert([{ block_id, option_id, voter_id: user.id }]);
  if(error) throw error;
  return true;
}
async function getPlanWithBlocks(plan_id){
  const { data: plan, error: e1 } = await SB.from('plans').select('*').eq('id', plan_id).single();
  if(e1) throw e1;
  const { data: blocks, error: e2 } = await SB.from('plan_blocks').select('*').eq('plan_id', plan_id).order('sort_order', { ascending: true });
  if(e2) throw e2;
  const blockIds = (blocks || []).map(b => b.id);
  let options = [];
  if(blockIds.length){
    const { data, error } = await SB.from('block_options').select('*').in('block_id', blockIds);
    if(error) throw error;
    options = data || [];
  }
  let votes = [];
  if(blockIds.length){
    const { data, error } = await SB.from('block_votes').select('block_id, option_id');
    if(error) throw error;
    votes = data || [];
  }
  const votesCountByOption = {};
  votes.forEach(v => {
    const key = v.option_id;
    votesCountByOption[key] = (votesCountByOption[key] || 0) + 1;
  });
  const byBlock = {};
  options.forEach(o => {
    byBlock[o.block_id] = byBlock[o.block_id] || [];
    byBlock[o.block_id].push({ ...o, votes: votesCountByOption[o.id] || 0 });
  });
  const resultBlocks = blocks.map(b => ({ ...b, options: (byBlock[b.id] || []).sort((a,b) => b.votes - a.votes) }));
  return { plan, blocks: resultBlocks };
}
function subscribeBlockVotes(plan_id, handler){
  return SB.channel('plan-'+plan_id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'block_votes' }, payload => {
      handler && handler(payload);
    })
    .subscribe();
}
