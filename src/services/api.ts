import { supabase } from '../lib/supabase';
import type { User as UserType } from '../types';
import { ASSET_LIABILITY_CATEGORIES } from '../constants/categories';

function mapRecord(r: any) {
  return {
    ...r,
    docType: r.doc_type,
    docNumber: r.doc_number,
    payment_method: r.payment_method || 'bank',
    reconciled: r.reconciled || false,
  };
}

function mapSale(s: any) {
  return {
    ...s,
    docNumber: s.doc_number,
    payment_method: s.payment_method || 'bank',
    reconciled: s.reconciled || false,
  };
}

export async function apiLogin(email: string, password: string): Promise<UserType> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Login gagal');

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (!profile) throw new Error('Profil pengguna tidak dijumpai');

  return profile as unknown as UserType;
}

export async function apiRegister(name: string, email: string, phone: string, password: string, company_name: string): Promise<{ user: UserType; accessToken: string | null }> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Pendaftaran gagal');

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .insert([{ id: data.user.id, name, email, phone, company_name }])
    .select('*')
    .single();

  if (profileError) throw new Error(profileError.message);
  return { user: profile as unknown as UserType, accessToken: data.session?.access_token ?? null };
}

export async function apiLogout() {
  await supabase.auth.signOut();
}

export async function apiAdminLogin(email: string, password: string): Promise<UserType> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Login gagal');

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (!profile) throw new Error('Profil pentadbir tidak dijumpai');
  if (profile.role !== 'admin') throw new Error('Akaun ini tidak mempunyai akses pentadbir');

  return profile as unknown as UserType;
}

export async function apiFetchDashboard(userId: string, role: string) {
  const [recordsRes, salesRes] = await Promise.all([
    supabase.from('records').select('*').eq('user_id', userId).order('date', { ascending: false }),
    role === 'upload_only'
      ? Promise.resolve({ data: [], error: null })
      : supabase.from('sales').select('*').eq('user_id', userId).order('date', { ascending: false }),
  ]);

  if (recordsRes.error) throw new Error(recordsRes.error.message);
  if (salesRes.error) throw new Error(salesRes.error.message);

  const records = (recordsRes.data || []).map(mapRecord);
  const sales = (salesRes.data || []).map(mapSale);

  const apiAssetLiabSet = new Set(ASSET_LIABILITY_CATEGORIES.map(c => c.toUpperCase()));
  const total_income = records.filter(r => r.type === 'income' && !apiAssetLiabSet.has((r.category || '').trim().toUpperCase())).reduce((s, r) => s + Number(r.amount), 0);
  const total_expense = records.filter(r => r.type === 'expense' && !apiAssetLiabSet.has((r.category || '').trim().toUpperCase())).reduce((s, r) => s + Number(r.amount), 0);

  const categoryMap: Record<string, Record<string, number>> = {};
  for (const r of records) {
    const key = `${r.category}__${r.type}`;
    categoryMap[key] = (categoryMap[key] || {});
    categoryMap[key].total = (categoryMap[key].total || 0) + Number(r.amount);
    categoryMap[key].category = r.category;
    categoryMap[key].type = r.type;
  }
  const byCategory = Object.values(categoryMap);

  const total_sales = sales.reduce((s, sale) => s + Number(sale.total), 0);
  const total_orders = sales.length;
  const total_items = sales.reduce((s, sale) => s + Number(sale.quantity), 0);

  const productMap: Record<string, { product_name: string; total: number; quantity: number }> = {};
  for (const s of sales) {
    if (!productMap[s.product_name]) {
      productMap[s.product_name] = { product_name: s.product_name, total: 0, quantity: 0 };
    }
    productMap[s.product_name].total += Number(s.total);
    productMap[s.product_name].quantity += Number(s.quantity);
  }
  const byProduct = Object.values(productMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return {
    records,
    sales,
    stats: { total_income, total_expense, byCategory },
    salesStats: { total_sales, total_orders, total_items, byProduct },
  };
}

export async function apiSaveRecord(userId: string, data: any): Promise<{ id: number }> {
  const categoryUpper = (data.category || '').trim().toUpperCase();
  const isAssetLiability = ASSET_LIABILITY_CATEGORIES.map((c: string) => c.toUpperCase()).includes(categoryUpper);

  if (data.type === 'income' && data.origin !== 'sale' && !isAssetLiability) {
    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert([{
        user_id: userId,
        doc_number: data.docNumber || '',
        product_name: data.description || 'Jualan Am',
        category: data.category || 'SALES',
        quantity: 1,
        price: data.amount,
        total: data.amount,
        date: data.date,
        payment_method: data.payment_method || 'bank',
      }])
      .select('id')
      .single();

    if (saleError) throw new Error(saleError.message);

    const { data: recData, error: recError } = await supabase
      .from('records')
      .insert([{
        user_id: userId,
        type: data.type,
        doc_type: data.docType || '',
        doc_number: data.docNumber || '',
        category: data.category || '',
        amount: data.amount,
        date: data.date,
        description: data.description || '',
        image_url: data.image_url || '',
        raw_data: data.raw_data || '',
        origin: data.origin || 'manual',
        sale_id: saleData.id,
        payment_method: data.payment_method || 'bank',
      }])
      .select('id')
      .single();

    if (recError) throw new Error(recError.message);
    return { id: recData.id };
  }

  const { data: recData, error } = await supabase
    .from('records')
    .insert([{
      user_id: userId,
      type: data.type,
      doc_type: data.docType || '',
      doc_number: data.docNumber || '',
      category: data.category || '',
      amount: data.amount,
      date: data.date,
      description: data.description || '',
      image_url: data.image_url || '',
      raw_data: data.raw_data || '',
      origin: data.origin || 'manual',
      payment_method: data.payment_method || 'bank',
    }])
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return { id: recData.id };
}

export async function apiDeleteRecord(id: number, userId: string): Promise<void> {
  const { data: rec, error: fetchErr } = await supabase
    .from('records')
    .select('sale_id, user_id')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) throw new Error(fetchErr.message);
  if (!rec || rec.user_id !== userId) throw new Error('Unauthorized');

  if (rec.sale_id) {
    await supabase.from('sales').delete().eq('id', rec.sale_id);
  }

  const { error } = await supabase.from('records').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function apiUpdateRecord(id: number, userId: string, data: any): Promise<void> {
  const { data: existing, error: fetchErr } = await supabase
    .from('records')
    .select('user_id, sale_id')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) throw new Error(fetchErr.message);
  if (!existing || existing.user_id !== userId) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('records')
    .update({
      type: data.type,
      doc_type: data.docType || '',
      doc_number: data.docNumber || '',
      category: data.category,
      amount: data.amount,
      date: data.date,
      description: data.description || '',
      image_url: data.image_url || '',
      reconciled: data.reconciled || false,
      payment_method: data.payment_method || 'bank',
    })
    .eq('id', id);

  if (error) throw new Error(error.message);

  const updatedCategoryUpper = (data.category || '').trim().toUpperCase();
  const updatedIsAssetLiability = ASSET_LIABILITY_CATEGORIES.map((c: string) => c.toUpperCase()).includes(updatedCategoryUpper);

  if (existing.sale_id) {
    if (data.type === 'income' && !updatedIsAssetLiability) {
      await supabase
        .from('sales')
        .update({
          doc_number: data.docNumber || '',
          product_name: data.description || 'Jualan Am',
          category: data.category || 'SALES',
          total: data.amount,
          price: data.amount,
          date: data.date,
          reconciled: data.reconciled || false,
          payment_method: data.payment_method || 'bank',
        })
        .eq('id', existing.sale_id);
    } else {
      await supabase.from('sales').delete().eq('id', existing.sale_id);
      await supabase.from('records').update({ sale_id: null }).eq('id', id);
    }
  } else if (data.type === 'income' && !updatedIsAssetLiability) {
    const { data: saleData } = await supabase
      .from('sales')
      .insert([{
        user_id: userId,
        doc_number: data.docNumber || '',
        product_name: data.description || 'Jualan Am',
        category: data.category || 'SALES',
        quantity: 1,
        price: data.amount,
        total: data.amount,
        date: data.date,
        reconciled: data.reconciled || false,
        payment_method: data.payment_method || 'bank',
      }])
      .select('id')
      .single();

    if (saleData) {
      await supabase.from('records').update({ sale_id: saleData.id }).eq('id', id);
    }
  }
}

export async function apiSaveSale(userId: string, data: any): Promise<{ id: number }> {
  const { data: saleData, error: saleError } = await supabase
    .from('sales')
    .insert([{
      user_id: userId,
      doc_number: data.docNumber || '',
      product_name: data.product_name,
      category: data.category || 'SALES',
      quantity: data.quantity,
      price: data.price,
      total: data.total,
      date: data.date,
      customer_name: data.customer_name || '',
      payment_method: data.payment_method || 'bank',
    }])
    .select('id')
    .single();

  if (saleError) throw new Error(saleError.message);

  await supabase.from('records').insert([{
    user_id: userId,
    type: 'income',
    doc_type: 'Invois Jualan',
    doc_number: data.docNumber || '',
    category: data.category || 'SALES',
    amount: data.total,
    date: data.date,
    description: `Jualan: ${data.product_name} (${data.quantity} unit)`,
    origin: 'sale',
    sale_id: saleData.id,
    payment_method: data.payment_method || 'bank',
  }]);

  return { id: saleData.id };
}

export async function apiDeleteSale(id: number, userId: string): Promise<void> {
  const { data: sale, error: fetchErr } = await supabase
    .from('sales')
    .select('user_id')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) throw new Error(fetchErr.message);
  if (!sale || sale.user_id !== userId) throw new Error('Unauthorized');

  await supabase.from('records').delete().eq('sale_id', id);
  const { error } = await supabase.from('sales').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function apiUpdateSale(id: number, userId: string, data: any): Promise<void> {
  const { data: sale, error: fetchErr } = await supabase
    .from('sales')
    .select('user_id')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) throw new Error(fetchErr.message);
  if (!sale || sale.user_id !== userId) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('sales')
    .update({
      doc_number: data.docNumber || '',
      product_name: data.product_name,
      category: data.category,
      quantity: data.quantity,
      price: data.price,
      total: data.total,
      date: data.date,
      customer_name: data.customer_name || '',
      reconciled: data.reconciled || false,
      payment_method: data.payment_method || 'bank',
    })
    .eq('id', id);

  if (error) throw new Error(error.message);

  await supabase
    .from('records')
    .update({
      doc_number: data.docNumber || '',
      category: data.category,
      amount: data.total,
      date: data.date,
      description: `Jualan: ${data.product_name} (${data.quantity} unit)`,
      reconciled: data.reconciled || false,
      payment_method: data.payment_method || 'bank',
    })
    .eq('sale_id', id);
}

export async function apiUpdateProfile(userId: string, name: string, phone: string, company_name: string): Promise<UserType> {
  const { data, error } = await supabase
    .from('users')
    .update({ name, phone, company_name })
    .eq('id', userId)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as UserType;
}

export async function apiUpdateBusinessSettings(userId: string, settings: {
  company_name: string;
  ssm_number: string;
  business_address: string;
  tax_id: string;
  financial_year_end: string;
}): Promise<UserType> {
  const { data, error } = await supabase
    .from('users')
    .update(settings)
    .eq('id', userId)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as UserType;
}

export async function apiGetUsers(): Promise<UserType[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, phone, role, company_name, plan, status, plan_start, plan_end, referred_by, special_id, created_at')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as unknown as UserType[];
}

export async function apiUpdateUserPlan(userId: string, plan: string, planEnd?: string): Promise<void> {
  const updates: any = { plan, plan_start: new Date().toISOString() };
  if (planEnd) updates.plan_end = planEnd;
  if (plan === 'free') {
    updates.plan_end = null;
    updates.status = 'active';
  }
  const { error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId);
  if (error) throw new Error(error.message);
}

export async function apiUpdateUserStatus(userId: string, status: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ status })
    .eq('id', userId);
  if (error) throw new Error(error.message);
}

export async function apiAddUser(userData: { name: string; email: string; password: string; role: string; company_name: string }): Promise<UserType> {
  const { data, error } = await supabase.auth.admin.createUser({
    email: userData.email,
    password: userData.password,
    email_confirm: true,
  });

  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Gagal mencipta pengguna');

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .insert([{
      id: data.user.id,
      name: userData.name,
      email: userData.email,
      company_name: userData.company_name || '',
      role: userData.role || 'user',
    }])
    .select('*')
    .single();

  if (profileError) throw new Error(profileError.message);
  return profile as unknown as UserType;
}

export async function apiUpdateUserRole(userId: string, role: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ role })
    .eq('id', userId);

  if (error) throw new Error(error.message);
}

export async function apiGetAdminDashboardStats() {
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, plan, status, referred_by');
  if (usersError) throw new Error(usersError.message);

  const allUsers = users || [];
  const totalUsers = allUsers.length;
  const activeSubscribers = allUsers.filter(u => (u.status || 'active') === 'active').length;
  const cancelledUsers = allUsers.filter(u => u.status === 'cancelled').length;
  const totalAffiliated = allUsers.filter(u => u.referred_by && u.referred_by !== '').length;

  const planPrices: Record<string, number> = { free: 0, Starter: 50, Growth: 100, Ultimate: 150 };
  const monthlyRevenue = allUsers
    .filter(u => (u.status || 'active') === 'active')
    .reduce((sum, u) => sum + (planPrices[u.plan || 'free'] || 0), 0);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const { data: usageRows, error: usageError } = await supabase
    .from('ai_usage')
    .select('tokens_used, created_at')
    .gte('created_at', sevenDaysAgo.toISOString());
  if (usageError) throw new Error(usageError.message);

  const totalTokensUsed = (usageRows || []).reduce((sum, r) => sum + (r.tokens_used || 0), 0);

  const days = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
  const tokenByDay: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    tokenByDay[days[d.getDay()]] = 0;
  }
  (usageRows || []).forEach(r => {
    const dayName = days[new Date(r.created_at).getDay()];
    if (dayName in tokenByDay) tokenByDay[dayName] += r.tokens_used || 0;
  });
  const tokenUsageData = Object.entries(tokenByDay).map(([day, tokens]) => ({ day, tokens }));

  const planCounts: Record<string, number> = { free: 0, Starter: 0, Growth: 0, Ultimate: 0 };
  allUsers.forEach(u => {
    const plan = u.plan || 'free';
    if (plan in planCounts) planCounts[plan]++;
    else planCounts['free']++;
  });
  const packageDistribution = [
    { name: 'Percuma', value: planCounts['free'], fill: '#94a3b8' },
    { name: 'Starter', value: planCounts['Starter'], fill: '#10b981' },
    { name: 'Growth', value: planCounts['Growth'], fill: '#059669' },
    { name: 'Ultimate', value: planCounts['Ultimate'], fill: '#064e3b' },
  ];

  return { totalUsers, activeSubscribers, cancelledUsers, totalTokensUsed, monthlyRevenue, totalAffiliated, tokenUsageData, packageDistribution };
}

export async function apiGetTokenUsageByUser() {
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, name, email, plan, status')
    .order('name');
  if (usersError) throw new Error(usersError.length > 0 ? usersError.message : 'Error');

  const { data: usageRows, error: usageError } = await supabase
    .from('ai_usage')
    .select('user_id, tokens_used, created_at')
    .order('created_at', { ascending: false });
  if (usageError) throw new Error(usageError.message);

  const planLimits: Record<string, number> = { free: 500, Starter: 10000, Growth: 25000, Ultimate: 100000 };

  const result = (users || []).map(u => {
    const userUsage = (usageRows || []).filter(r => r.user_id === u.id);
    const tokensUsed = userUsage.reduce((sum, r) => sum + (r.tokens_used || 0), 0);
    const lastUsed = userUsage.length > 0 ? userUsage[0].created_at : null;
    const limit = planLimits[u.plan || 'free'] || 500;
    return { ...u, tokensUsed, limit, lastUsed };
  });

  return result;
}

export async function apiLogAiUsage(userId: string, tokensUsed: number, operation: string): Promise<void> {
  const { error } = await supabase
    .from('ai_usage')
    .insert([{ user_id: userId, tokens_used: tokensUsed, operation }]);
  if (error) console.error('Failed to log AI usage:', error.message);
}

export const PLAN_SCAN_LIMITS: Record<string, number> = {
  free: 5,
  Percuma: 5,
  Starter: 100,
  Growth: 250,
  Ultimate: Infinity,
};

export const PLAN_PDF_LIMITS: Record<string, number> = {
  free: 1,
  Percuma: 1,
  Starter: 3,
  Growth: 9,
  Ultimate: Infinity,
};

function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export async function apiGetScanUsageThisMonth(userId: string): Promise<{ receipt: number; pdf: number }> {
  const yearMonth = getCurrentYearMonth();
  const { data, error } = await supabase
    .from('scan_usage')
    .select('scan_type')
    .eq('user_id', userId)
    .eq('year_month', yearMonth);
  if (error) {
    console.error('Failed to get scan usage:', error.message);
    return { receipt: 0, pdf: 0 };
  }
  const receipt = (data || []).filter(r => r.scan_type === 'receipt').length;
  const pdf = (data || []).filter(r => r.scan_type === 'pdf').length;
  return { receipt, pdf };
}

export async function apiLogScanUsage(userId: string, scanType: 'receipt' | 'pdf'): Promise<void> {
  const yearMonth = getCurrentYearMonth();
  const { error } = await supabase
    .from('scan_usage')
    .insert([{ user_id: userId, scan_type: scanType, year_month: yearMonth }]);
  if (error) console.error('Failed to log scan usage:', error.message);
}

export interface Affiliate {
  id: string;
  name: string;
  email: string;
  phone: string;
  bank: string;
  account_no: string;
  referrals: number;
  commission: number;
  status: string;
  is_paid: boolean;
  joined_date: string;
  created_at: string;
}

export async function apiGetAffiliates(): Promise<Affiliate[]> {
  const { data, error } = await supabase
    .from('affiliates')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as Affiliate[];
}

export async function apiAddAffiliate(affiliate: Omit<Affiliate, 'id' | 'created_at'>): Promise<Affiliate> {
  const { data, error } = await supabase
    .from('affiliates')
    .insert([affiliate])
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as Affiliate;
}

export async function apiUpdateAffiliate(id: string, updates: Partial<Affiliate>): Promise<void> {
  const { error } = await supabase
    .from('affiliates')
    .update(updates)
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function apiDeleteAffiliate(id: string): Promise<void> {
  const { error } = await supabase
    .from('affiliates')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function apiUploadReceiptFile(userId: string, dataUrl: string, fileType: 'receipt' | 'pdf'): Promise<string> {
  const isDataUrl = dataUrl.startsWith('data:');
  let blob: Blob;
  let ext: string;

  if (isDataUrl) {
    const [meta, base64] = dataUrl.split(',');
    const mimeMatch = meta.match(/data:([^;]+)/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    ext = mime === 'application/pdf' ? 'pdf' : mime.split('/')[1] || 'jpg';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    blob = new Blob([bytes], { type: mime });
  } else {
    ext = fileType === 'pdf' ? 'pdf' : 'jpg';
    const res = await fetch(dataUrl);
    blob = await res.blob();
  }

  const timestamp = Date.now();
  const path = `${userId}/${fileType}_${timestamp}.${ext}`;

  const { error } = await supabase.storage.from('receipts').upload(path, blob, { upsert: false });
  if (error) throw new Error(`Gagal muat naik fail: ${error.message}`);

  const { data } = supabase.storage.from('receipts').getPublicUrl(path);
  if (data?.publicUrl) return data.publicUrl;

  const { data: signedData, error: signedError } = await supabase.storage
    .from('receipts')
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signedError) throw new Error(`Gagal jana URL fail: ${signedError.message}`);
  return signedData.signedUrl;
}
