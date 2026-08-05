import { supabase } from '../lib/supabase';
import type { User as UserType, OpeningBalance, StockTake } from '../types';
import { ASSET_LIABILITY_CATEGORIES } from '../constants/categories';
import {
  type PaymentMethod,
  methodCodeFromLabel,
  methodCategoryFromLabel,
} from '../constants/paymentMethods';

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

export async function apiRegister(name: string, email: string, phone: string, password: string, company_name: string, referred_by?: string): Promise<{ user: UserType; accessToken: string | null }> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Pendaftaran gagal');

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .insert([{ id: data.user.id, name, email, phone, company_name, referred_by: referred_by?.trim() || 'Tiada Rujukan' }])
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
  // Supabase returns max 1000 rows per query by default.
  // Use pagination to fetch all records for users with large datasets.
  async function fetchAllRows(table: string, columns: string, userId: string) {
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from(table)
        .select(columns)
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw new Error(error.message);
      const rows = data || [];
      allData = allData.concat(rows);
      hasMore = rows.length === PAGE_SIZE;
      from += PAGE_SIZE;
    }

    return allData;
  }

  const recordColumns = 'id, user_id, date, type, category, amount, description, remark, doc_type, doc_number, payment_method, reconciled, created_at, origin, sale_id, has_image';
  const salesColumns = 'id, user_id, date, product_name, category, quantity, price, total, payment_method, doc_number, customer_name, reconciled, created_at';

  const [recordsData, salesData] = await Promise.all([
    fetchAllRows('records', recordColumns, userId),
    role === 'upload_only'
      ? Promise.resolve([])
      : fetchAllRows('sales', salesColumns, userId),
  ]);

  const records = recordsData.map(r => ({ ...mapRecord(r), image_url: r.has_image ? '__has_image__' : '' }));
  const sales = salesData.map(mapSale);

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

export async function apiGetRecordImageUrl(recordId: number): Promise<{ url: string; isPdf: boolean } | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-record-image?id=${recordId}`;
  const res = await fetch(apiUrl, {
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch image' }));
    throw new Error(err.error || 'Failed to fetch image');
  }

  const contentType = res.headers.get('Content-Type') || '';
  if (contentType.startsWith('image/') || contentType === 'application/pdf') {
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    return { url: blobUrl, isPdf: contentType === 'application/pdf' };
  }

  const json = await res.json();
  if (json.url) {
    const isPdf = json.url.includes('.pdf');
    return { url: json.url, isPdf };
  }
  return null;
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
        has_image: !!(data.image_url),
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
      has_image: !!(data.image_url),
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
      has_image: !!(data.image_url),
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
    .select('id, name, email, phone, role, company_name, plan, status, plan_start, plan_end, referred_by, special_id, special_tier, created_at')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as unknown as UserType[];
}

// Tukar nama rujukan (affiliate) seorang pengguna — supaya admin boleh betulkan padanan ejen
export async function apiUpdateUserReferral(userId: string, referredBy: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ referred_by: referredBy.trim() || 'Tiada Rujukan' })
    .eq('id', userId);
  if (error) throw new Error(error.message);
}

export async function apiUpdateUserPlan(userId: string, plan: string, planEnd?: string, specialTier?: string): Promise<void> {
  const updates: any = { plan, plan_start: new Date().toISOString() };
  if (planEnd) updates.plan_end = planEnd;
  if (plan === 'free') {
    updates.plan_end = null;
    updates.status = 'active';
    updates.special_tier = '';
  }
  if (plan === 'Special') {
    updates.special_tier = specialTier || 'Starter';
    updates.status = 'active';
  } else if (plan !== 'free') {
    updates.special_tier = '';
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

export async function apiDeleteUser(userId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Tidak log masuk');

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ userId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Gagal memadam pengguna');
}

export async function apiResetUserPassword(userId: string, newPassword: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Tidak log masuk');

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-user-password`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ userId, newPassword }),
  });
  const text = await res.text();
  let json: any = {};
  try { json = JSON.parse(text); } catch {}
  if (!res.ok) throw new Error(json.error || text || 'Gagal reset kata laluan');
}

// Harga bulanan setiap pakej (RM). Digunakan untuk hasil bulanan & kiraan komisen affiliate.
export const PLAN_PRICES: Record<string, number> = {
  free: 0, Free: 0, Percuma: 0,
  Starter: 50,
  Growth: 100,
  Ultimate: 150,
};

// Kadar komisen affiliate: 10% daripada langganan berbayar
export const AFFILIATE_COMMISSION_RATE = 0.10;

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

  const monthlyRevenue = allUsers
    .filter(u => (u.status || 'active') === 'active')
    .reduce((sum, u) => sum + (PLAN_PRICES[u.plan || 'free'] || 0), 0);

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

export const PLAN_TOKEN_LIMITS: Record<string, number> = {
  free: 20000, Percuma: 20000,
  Starter: 500000,
  Growth: 1000000,
  Ultimate: 10000000,
  Special: 10000000,
};

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

  const planLimits = PLAN_TOKEN_LIMITS;

  const result = (users || []).map(u => {
    const userUsage = (usageRows || []).filter(r => r.user_id === u.id);
    const tokensUsed = userUsage.reduce((sum, r) => sum + (r.tokens_used || 0), 0);
    const lastUsed = userUsage.length > 0 ? userUsage[0].created_at : null;
    const limit = planLimits[u.plan || 'free'] || 10000;
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

export async function apiGetUserTokenUsage(userId: string, plan: string): Promise<{ tokensUsed: number; limit: number; remaining: number }> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('ai_usage')
    .select('tokens_used')
    .eq('user_id', userId)
    .gte('created_at', startOfMonth.toISOString());

  if (error) throw new Error(error.message);

  const tokensUsed = (data || []).reduce((sum, r) => sum + (r.tokens_used || 0), 0);
  const limit = PLAN_TOKEN_LIMITS[plan || 'free'] || 10000;
  return { tokensUsed, limit, remaining: Math.max(0, limit - tokensUsed) };
}

export async function apiTopUpUserTokens(userId: string, tokens: number): Promise<void> {
  const { error } = await supabase
    .from('ai_usage')
    .insert([{ user_id: userId, tokens_used: -tokens, operation: 'topup' }]);
  if (error) throw new Error(error.message);
}

export const PLAN_SCAN_LIMITS: Record<string, number> = {
  free: 5,
  Percuma: 5,
  Starter: 100,
  Growth: 250,
  Ultimate: Infinity,
  Special: Infinity,
};

// Had muat naik PDF RESIT sebulan, sebagai baldi BERASINGAN daripada imbasan resit.
// (Ini BUKAN penyata bank — lihat canScanBankStatement di bawah untuk itu.)
//
// Starter & Growth sengaja TIADA dalam senarai ini: mereka tidak mempunyai baldi
// PDF sendiri. Imbasan resit dan muat naik PDF resit mereka ditolak daripada
// SATU kuota yang sama (PLAN_SCAN_LIMITS) — 100 dan 250 sebulan.
export const PLAN_PDF_LIMITS: Record<string, number> = {
  free: 1,
  Percuma: 1,
  Ultimate: Infinity,
  Special: Infinity,
};

// True jika pakej berkongsi satu kuota untuk imbasan resit + muat naik PDF resit.
export function usesSharedScanPool(planKey: string): boolean {
  return PLAN_PDF_LIMITS[planKey] === undefined;
}

// Imbasan PENYATA BANK dengan AI — eksklusif Ultimate sahaja.
// Pakej lain masih boleh import penyata bank secara manual melalui fail CSV.
const BANK_STATEMENT_PLANS = new Set(['Ultimate']);

export function canScanBankStatement(planKey: string): boolean {
  return BANK_STATEMENT_PLANS.has(planKey);
}

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
  ref_code?: string;   // kod rujukan unik untuk link affiliate (dijana automatik oleh pangkalan data)
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

// ── Baki Awal (Opening Balances) ────────────────────────────────────────────

export async function apiGetOpeningBalances(userId: string): Promise<OpeningBalance[]> {
  const { data, error } = await supabase
    .from('opening_balances')
    .select('id, category, amount, as_at_date')
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({
    id: r.id,
    category: r.category,
    amount: Number(r.amount) || 0,
    as_at_date: r.as_at_date,
  }));
}

// Simpan keseluruhan set baki awal sekali gus. Kategori bernilai 0 dibuang
// supaya jadual hanya menyimpan baris yang benar-benar bermakna.
export async function apiSaveOpeningBalances(
  userId: string,
  asAtDate: string,
  entries: { category: string; amount: number }[],
): Promise<void> {
  const keep = entries.filter(e => Number(e.amount) !== 0);
  const keepCats = new Set(keep.map(e => e.category.trim().toUpperCase()));

  // Buang baris yang telah dikosongkan pengguna. Padam ikut id (bukan nama
  // kategori) kerana nama mengandungi '&', '.' dan '-' yang perlu dilepaskan
  // dalam penapis PostgREST.
  const { data: existing, error: readError } = await supabase
    .from('opening_balances')
    .select('id, category')
    .eq('user_id', userId);
  if (readError) throw new Error(readError.message);

  const staleIds = (existing || [])
    .filter((r: any) => !keepCats.has(String(r.category || '').trim().toUpperCase()))
    .map((r: any) => r.id);

  if (staleIds.length > 0) {
    const { error: delError } = await supabase
      .from('opening_balances')
      .delete()
      .eq('user_id', userId)
      .in('id', staleIds);
    if (delError) throw new Error(delError.message);
  }

  if (keep.length === 0) return;

  const { error } = await supabase
    .from('opening_balances')
    .upsert(
      keep.map(e => ({
        user_id: userId,
        category: e.category,
        amount: Number(e.amount) || 0,
        as_at_date: asAtDate,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'user_id,category' },
    );

  if (error) throw new Error(error.message);
}

// ── Kaedah Bayaran Tersuai (Custom Payment Methods) ─────────────────────────

export async function apiGetPaymentMethods(userId: string): Promise<PaymentMethod[]> {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('id, code, label, bs_category')
    .eq('user_id', userId)
    .order('id', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({
    id: r.id,
    code: r.code,
    label: r.label,
    bs_category: r.bs_category,
  }));
}

export async function apiAddPaymentMethod(userId: string, label: string): Promise<PaymentMethod> {
  const trimmed = label.trim().replace(/\s+/g, ' ');
  const row = {
    user_id: userId,
    code: methodCodeFromLabel(trimmed),
    label: trimmed,
    bs_category: methodCategoryFromLabel(trimmed),
  };

  const { data, error } = await supabase
    .from('payment_methods')
    .insert([row])
    .select('id, code, label, bs_category')
    .single();

  if (error) {
    // 23505 = unique violation (kod yang sama sudah wujud untuk pengguna ini)
    if ((error as any).code === '23505') throw new Error('Kaedah bayaran ini sudah wujud');
    throw new Error(error.message);
  }
  return data as PaymentMethod;
}

// Memadam kaedah TIDAK menyentuh transaksi lama. Transaksi tersebut kekal
// menyimpan kodnya dan bakinya jatuh semula ke baris Bank dalam Kunci Kira-Kira.
export async function apiDeletePaymentMethod(userId: string, id: number): Promise<void> {
  const { error } = await supabase
    .from('payment_methods')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);

  if (error) throw new Error(error.message);
}

// ── Stock Take (Stok Akhir) ─────────────────────────────────────────────────

export async function apiGetStockTakes(userId: string): Promise<StockTake[]> {
  const { data, error } = await supabase
    .from('stock_takes')
    .select('id, as_at_date, amount, note')
    .eq('user_id', userId)
    .order('as_at_date', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({
    id: r.id,
    as_at_date: r.as_at_date,
    amount: Number(r.amount) || 0,
    note: r.note || '',
  }));
}

export async function apiSaveStockTake(
  userId: string,
  asAtDate: string,
  amount: number,
  note = '',
): Promise<void> {
  const { error } = await supabase
    .from('stock_takes')
    .upsert(
      [{ user_id: userId, as_at_date: asAtDate, amount: Number(amount) || 0, note, updated_at: new Date().toISOString() }],
      { onConflict: 'user_id,as_at_date' },
    );

  if (error) throw new Error(error.message);
}

export async function apiDeleteStockTake(userId: string, id: number): Promise<void> {
  const { error } = await supabase
    .from('stock_takes')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export interface ReferredUser {
  id: string;
  name: string;
  email: string;
  plan: string;
  status: string;
  referred_by: string;
  created_at: string;      // tarikh akaun dibuka
  plan_start?: string | null;  // tarikh mula langganan
  plan_end?: string | null;    // tarikh tamat langganan
}

// Ambil semua pengguna yang mempunyai nama rujukan (untuk kiraan komisen automatik)
export async function apiGetReferredUsers(): Promise<ReferredUser[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, plan, status, referred_by, created_at, plan_start, plan_end')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).filter((u: any) => !isDirectReferral(u.referred_by)) as ReferredUser[];
}

// Nama rujukan yang bermaksud "tiada ejen" — pengguna daftar terus
export function isDirectReferral(ref?: string | null): boolean {
  const v = (ref || '').trim().toLowerCase();
  return !v || v === 'tiada rujukan' || v === 'terus' || v === 'direct' || v === '-';
}

// Samakan format nama supaya padanan tidak terjejas oleh huruf besar/kecil atau ruang berlebihan
export function normalizeReferralName(value?: string | null): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface AffiliateEarning {
  referrals: ReferredUser[];       // semua pengguna yang merujuk ejen ini
  totalReferrals: number;          // jumlah rujukan
  newReferrals: number;            // rujukan yang mendaftar dalam bulan dipilih
  payingReferrals: number;         // rujukan berbayar yang layak komisen bulan itu
  payingUsers: ReferredUser[];     // senarai rujukan yang layak komisen bulan itu
  monthlyCommission: number;       // komisen bagi bulan itu (RM)
  monthlyRevenue: number;          // jumlah langganan bulanan yang dirujuk (RM)
}

// Adakah langganan pengguna ini aktif dalam bulan yang dipilih ('YYYY-MM')?
// Guna plan_start & plan_end kerana status semasa tidak merekod sejarah.
function isSubscribedDuringMonth(u: ReferredUser, monthKey: string): boolean {
  const [y, m] = monthKey.split('-').map(Number);
  const monthStart = new Date(y, m - 1, 1).getTime();
  const monthEnd = new Date(y, m, 0, 23, 59, 59, 999).getTime();
  if (!u.plan_start) return false;
  const start = new Date(u.plan_start).getTime();
  if (isNaN(start) || start > monthEnd) return false;
  if (u.plan_end) {
    const end = new Date(u.plan_end).getTime();
    if (!isNaN(end) && end < monthStart) return false;
  }
  return true;
}

// Kira rujukan & komisen bagi seorang ejen berdasarkan nama ejen.
// monthKey ('YYYY-MM') pilihan — jika diberi, kira untuk bulan itu sahaja.
export function calcAffiliateEarning(agentName: string, referredUsers: ReferredUser[], monthKey?: string): AffiliateEarning {
  const key = normalizeReferralName(agentName);
  const referrals = key ? referredUsers.filter(u => normalizeReferralName(u.referred_by) === key) : [];

  const isPaidPlan = (u: ReferredUser) => (PLAN_PRICES[u.plan || 'free'] || 0) > 0;

  const paying = monthKey
    ? referrals.filter(u => isPaidPlan(u) && isSubscribedDuringMonth(u, monthKey))
    : referrals.filter(u => isPaidPlan(u) && (u.status || 'active') === 'active');

  const newReferrals = monthKey
    ? referrals.filter(u => (u.created_at || '').slice(0, 7) === monthKey).length
    : referrals.length;

  const monthlyRevenue = paying.reduce((sum, u) => sum + (PLAN_PRICES[u.plan || 'free'] || 0), 0);
  return {
    referrals,
    payingUsers: paying,
    newReferrals,
    totalReferrals: referrals.length,
    payingReferrals: paying.length,
    monthlyRevenue,
    monthlyCommission: monthlyRevenue * AFFILIATE_COMMISSION_RATE,
  };
}

// Senarai nama ejen untuk borang pendaftaran awam.
// Hanya lajur id, name & ref_code dibenarkan untuk peranan `anon` (lihat migrasi
// 20260731000000_allow_public_read_affiliate_names.sql dan
// 20260803100000_add_affiliate_referral_links.sql). Jika RLS menyekat,
// kembalikan senarai kosong supaya borang jatuh balik kepada input manual.
export async function apiGetPublicAffiliateNames(): Promise<{ id: string; name: string; ref_code?: string }[]> {
  const { data, error } = await supabase
    .from('affiliates')
    .select('id, name, ref_code')
    .order('name', { ascending: true });
  if (error) {
    console.warn('Tidak dapat memuatkan senarai ejen untuk borang pendaftaran:', error.message);
    return [];
  }
  return (data || []).filter((a: any) => (a.name || '').trim() !== '');
}

// ── Link rujukan affiliate ──────────────────────────────────────────────────
// Setiap ejen ada kod unik (cth. "hasan"). Link yang dikongsi berbentuk:
//   https://monitacc.com/?ref=hasan
// Bila diklik, borang pendaftaran terus mengunci medan Rujukan kepada nama ejen.

export const REFERRAL_QUERY_KEY = 'ref';

// Bina link penuh yang boleh dikongsi oleh ejen.
// `origin` boleh diberi untuk menguji; jika tidak, guna domain semasa pelayar.
export function buildReferralLink(refCode?: string | null, origin?: string): string {
  const base = (origin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '');
  return `${base}/?${REFERRAL_QUERY_KEY}=${encodeURIComponent((refCode || '').trim())}`;
}

// Versi ringkas untuk paparan (buang "https://" supaya muat dalam jadual)
export function displayReferralLink(refCode?: string | null, origin?: string): string {
  return buildReferralLink(refCode, origin).replace(/^https?:\/\//, '');
}

// Cari ejen berdasarkan kod rujukan daripada URL. Kembali null jika kod tidak
// wujud atau ejen sudah tidak aktif (ditapis oleh polisi RLS).
export async function apiGetAffiliateByRefCode(refCode: string): Promise<{ id: string; name: string; ref_code: string } | null> {
  const code = (refCode || '').trim().toLowerCase();
  if (!code) return null;

  const { data, error } = await supabase
    .from('affiliates')
    .select('id, name, ref_code')
    .eq('ref_code', code)
    .maybeSingle();

  if (error) {
    console.warn('Tidak dapat mengesahkan kod rujukan:', error.message);
    return null;
  }
  return data ? (data as { id: string; name: string; ref_code: string }) : null;
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

  const { error } = await supabase.storage.from('receipts').upload(path, blob, { upsert: true });
  if (error) throw new Error(`Gagal muat naik fail: ${error.message}`);

  const { data } = supabase.storage.from('receipts').getPublicUrl(path);
  return data.publicUrl;
}
