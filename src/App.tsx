import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { LayoutDashboard, Camera, FileText, ChartPie as PieChart, User, ListFilter as Filter, Plus, Trash2, ChevronRight, TrendingUp, TrendingDown, CreditCard, CircleCheck as CheckCircle2, Check, Clock, Menu, X, ArrowLeft, ArrowRight, Eye, Hash, TriangleAlert as AlertTriangle, CircleAlert as AlertCircle, ShoppingBag, ShoppingCart, ReceiptText, Utensils, Car, Zap, Banknote, Package, Box, Send, Tag, Briefcase, Heart, Hop as Home, Coffee, DollarSign, Sparkles, RefreshCw, FileDown, Download, SearchX, CircleUser as UserCircle, Search, Copy, ExternalLink, BookOpen, ChevronDown, Loader as Loader2, ShieldCheck, Settings, Info, MessageCircle, Users, Calendar, Receipt, Landmark, Printer, Megaphone, Monitor, Shield, Calculator, Plane, Phone, Wallet, Paperclip, Lock, Crown, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart as RePieChart,
  Pie
} from 'recharts';
import { format, isSameDay, isSameWeek, isSameMonth, isSameYear, parseISO } from 'date-fns';
import { analyzeDocument, extractBankTransactions, analyzeFinancials, getDashboardInsights, type DashboardInsight } from './services/geminiService';
import { Record as TransactionRecord, Sale, Stats, AppView, User as UserType } from './types';
import {
  apiLogin,
  apiRegister,
  apiLogout,
  apiFetchDashboard,
  apiSaveRecord,
  apiDeleteRecord,
  apiUpdateRecord,
  apiSaveSale,
  apiDeleteSale,
  apiUpdateSale,
  apiUpdateProfile,
  apiUpdateBusinessSettings,
  apiGetUsers,
  apiAddUser,
  apiUpdateUserRole,
  apiUpdateUserPlan,
  apiUpdateUserStatus,
  apiGetAdminDashboardStats,
  apiGetTokenUsageByUser,
  apiGetScanUsageThisMonth,
  apiLogScanUsage,
  apiUploadReceiptFile,
  PLAN_SCAN_LIMITS,
  PLAN_PDF_LIMITS,
} from './services/api';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, COGS_CATEGORIES, ASSET_LIABILITY_CATEGORIES, ALL_CATEGORIES, CHART_OF_ACCOUNTS, BANK_LIST } from './constants/categories';
import { createCheckoutSession, openCustomerPortal, type PaidPlan } from './services/stripeService';
import { supabase } from './lib/supabase';

// --- Helpers ---

const SearchableSelect = ({ 
  value, 
  onChange, 
  options, 
  placeholder = "Pilih Kategori",
  className = "",
  onAddNew
}: { 
  value: string, 
  onChange: (val: string) => void, 
  options: string[],
  placeholder?: string,
  className?: string,
  onAddNew?: (val: string) => void
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const uniqueOptions = useMemo(() => {
    const seen = new Set();
    const result: string[] = [];
    options.forEach(opt => {
      const upper = opt.trim().toUpperCase();
      if (upper && !seen.has(upper)) {
        seen.add(upper);
        result.push(upper);
      }
    });
    return result;
  }, [options]);

  const filteredOptions = uniqueOptions.filter(opt => 
    opt.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer flex justify-between items-center min-h-[42px]"
      >
        <span className={`truncate mr-2 ${value ? "text-slate-900" : "text-slate-400"}`}>
          {value || placeholder}
        </span>
        <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-[200] left-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden min-w-full md:min-w-[280px]"
          >
            <div className="p-3 border-b border-slate-100 bg-slate-50/50">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari kategori..."
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto p-1.5 custom-scrollbar">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      onChange(opt);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg text-[11px] font-bold transition-all mb-0.5 last:mb-0 flex items-center justify-between group ${
                      value === opt 
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100' 
                        : 'hover:bg-emerald-50 text-slate-700 hover:text-emerald-700'
                    }`}
                  >
                    <span className="truncate mr-2">{opt}</span>
                    {value === opt && <CheckCircle2 size={14} />}
                  </button>
                ))
              ) : search ? (
                <button
                  type="button"
                  onClick={() => {
                    const newVal = search.toUpperCase();
                    if (onAddNew) onAddNew(newVal);
                    onChange(newVal);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-emerald-600 hover:bg-emerald-50 transition-colors flex items-center gap-2"
                >
                  <Plus size={14} />
                  Tambah "{search.toUpperCase()}"
                </button>
              ) : (
                <div className="p-4 text-center text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                  Tiada kategori dijumpai
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const getCategoryIcon = (category: string) => {
  const cat = category.toLowerCase();
  if (cat.includes('makan') || cat.includes('food') || cat.includes('restoran') || cat.includes('refreshment') || cat.includes('kitchen')) return Utensils;
  if (cat.includes('shop') || cat.includes('beli') || cat.includes('barang') || cat.includes('purchase')) return ShoppingBag;
  if (cat.includes('minyak') || cat.includes('fuel') || cat.includes('transport') || cat.includes('kereta') || cat.includes('vehicle') || cat.includes('toll')) return Car;
  if (cat.includes('bil') || cat.includes('utility') || cat.includes('elektrik') || cat.includes('air') || cat.includes('water') || cat.includes('electricity')) return Zap;
  if (cat.includes('gaji') || cat.includes('salary') || cat.includes('income') || cat.includes('pendapatan') || cat.includes('wages') || cat.includes('remuneration')) return Banknote;
  if (cat.includes('packaging') || cat.includes('kotak') || cat.includes('box') || cat.includes('stock')) return Box;
  if (cat.includes('postage') || cat.includes('kurier') || cat.includes('delivery') || cat.includes('courier')) return Send;
  if (cat.includes('jualan') || cat.includes('sales') || cat.includes('untung')) return Tag;
  if (cat.includes('pejabat') || cat.includes('office') || cat.includes('bisnes') || cat.includes('administration')) return Briefcase;
  if (cat.includes('kesihatan') || cat.includes('health') || cat.includes('medical')) return Heart;
  if (cat.includes('rumah') || cat.includes('home') || cat.includes('sewa') || cat.includes('rental') || cat.includes('building')) return Home;
  if (cat.includes('kopi') || cat.includes('coffee') || cat.includes('cafe')) return Coffee;
  if (cat.includes('bank') || cat.includes('cash') || cat.includes('debt') || cat.includes('loan')) return DollarSign;
  return Package;
};

const fmt2 = (val: number) => val === 0 ? '-' : val.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const generatePDFReport = (
  user: UserType | null,
  reportType: 'monthly' | 'yearly' | 'custom',
  month: number,
  year: number,
  records: TransactionRecord[],
  sales: Sale[],
  incomeByCategory: any[],
  expenseByCategory: any[],
  totalIncome: number,
  totalExpense: number,
  totalSales: number,
  startDate?: string,
  endDate?: string,
  monthlyData?: any,
  categoryMappings?: Record<string, string>
) => {
  const doc = new jsPDF();
  const monthNames = [
    'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
    'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'
  ];
  const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const businessName = user?.company_name || 'MONITACC ENTERPRISE';
  const ssmNo = user?.ssm_number || '-';

  // ── Yearly: formal Penyata Untung Rugi ────────────────────────────────────
  if (reportType === 'yearly' && monthlyData && categoryMappings) {
    const calcTotal = (path: string) =>
      shortMonths.reduce((sum, m) => {
        const parts = path.split('.');
        let val: any = monthlyData[m];
        parts.forEach(p => { val = val?.[p]; });
        return sum + (Number(val) || 0);
      }, 0);

    const salesCats = Array.from(new Set([
      ...Object.keys(categoryMappings).filter(c => categoryMappings[c] === 'SALES'),
      'JUALAN (REKOD)'
    ])).filter(cat => calcTotal(`salesByCategory.${cat}`) !== 0);

    const cogsCats = Object.keys(categoryMappings)
      .filter(c => categoryMappings[c] === 'COGS' && calcTotal(`cogs.${c}`) !== 0);

    const otherIncomeCats = Object.keys(categoryMappings)
      .filter(c => categoryMappings[c] === 'OTHER_INCOME' && calcTotal(`otherIncome.${c}`) !== 0);

    const expenseCats = Object.keys(categoryMappings)
      .filter(c => categoryMappings[c] === 'EXPENSE' && calcTotal(`expenses.${c}`) !== 0);

    const totalSalesAmt = calcTotal('sales') + calcTotal('salesAdjustments');
    const totalCogsAmt = cogsCats.reduce((s, c) => s + calcTotal(`cogs.${c}`), 0);
    const grossProfit = totalSalesAmt - totalCogsAmt;
    const totalOtherIncome = otherIncomeCats.reduce((s, c) => s + calcTotal(`otherIncome.${c}`), 0);
    const totalExpensesAmt = expenseCats.reduce((s, c) => s + calcTotal(`expenses.${c}`), 0);
    const taxation = calcTotal('taxation');
    const netProfitAmt = grossProfit + totalOtherIncome - totalExpensesAmt - taxation;

    const pageW = 210;
    const mL = 25;
    const mR = 25;
    const amtX = pageW - mR;
    const amtW = 40;
    const rH = 7;
    let y = 0;

    const f2 = (v: number) => Math.abs(v).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const newPage = () => { doc.addPage(); y = 28; drawColHdr(); };
    const chk = (n = rH) => { if (y + n > 275) newPage(); };

    // ── Header ─────────────────────────────────────────────────────────────
    y = 28;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(20, 20, 20);
    doc.text(businessName.toUpperCase(), pageW / 2, y, { align: 'center' });
    y += 5.5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(120, 120, 120);
    doc.text(`No. SSM: ${ssmNo}`, pageW / 2, y, { align: 'center' });
    y += 5;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(20, 20, 20);
    doc.text(`PENYATA UNTUNG RUGI BAGI TAHUN BERAKHIR 31 DISEMBER ${year}`, pageW / 2, y, { align: 'center' });
    y += 5;
    doc.setDrawColor(20, 20, 20); doc.setLineWidth(0.5);
    doc.line(mL, y, pageW - mR, y);
    doc.setLineWidth(0.15);
    y += 7;

    // ── Column header ──────────────────────────────────────────────────────
    const drawColHdr = () => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(120, 120, 120);
      doc.text('KETERANGAN', mL, y);
      doc.text(`RM (${year})`, amtX, y, { align: 'right' });
      doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.1);
      doc.line(mL, y + 1.5, pageW - mR, y + 1.5);
      y += rH - 1;
    };

    drawColHdr();

    // ── Helpers ────────────────────────────────────────────────────────────
    const sectionHdr = (label: string) => {
      chk(rH + 2);
      y += 3;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(20, 20, 20);
      doc.text(label.toUpperCase(), mL, y);
      y += rH - 2;
      doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.1);
      doc.line(mL, y - 1, pageW - mR, y - 1);
      y += 2;
    };

    const row = (label: string, value: number | null, bold = false) => {
      if (value !== null && value === 0) return;
      chk();
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(8);
      doc.setTextColor(bold ? 20 : 55, bold ? 20 : 55, bold ? 20 : 55);
      doc.text(bold ? label : `    ${label}`, mL, y);
      if (value !== null) {
        doc.setTextColor(value < 0 ? 180 : (bold ? 20 : 55), value < 0 ? 30 : (bold ? 20 : 55), value < 0 ? 30 : (bold ? 20 : 55));
        doc.text(f2(value), amtX, y, { align: 'right' });
      }
      y += rH;
    };

    const subtotal = (label: string, val: number) => {
      chk(rH + 2);
      doc.setDrawColor(160, 160, 160); doc.setLineWidth(0.2);
      doc.line(amtX - amtW, y - rH + 1, amtX, y - rH + 1);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(20, 20, 20);
      doc.text(label, mL, y);
      doc.text(f2(val), amtX, y, { align: 'right' });
      y += rH;
    };

    const grandTotal = (label: string, val: number) => {
      chk(rH + 5);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(20, 20, 20);
      doc.text(label, mL, y);
      doc.setTextColor(val < 0 ? 180 : 20, val < 0 ? 30 : 20, val < 0 ? 30 : 20);
      doc.text(f2(val), amtX, y, { align: 'right' });
      doc.setDrawColor(20, 20, 20); doc.setLineWidth(0.3);
      doc.line(amtX - amtW, y + 1.5, amtX, y + 1.5);
      doc.line(amtX - amtW, y + 3, amtX, y + 3);
      doc.setLineWidth(0.15);
      y += rH + 4;
    };

    const spacer = (n = 4) => { y += n; };

    // ── JUALAN ─────────────────────────────────────────────────────────────
    sectionHdr('Jualan (Sales)');
    salesCats.forEach(cat => row(cat, calcTotal(`salesByCategory.${cat}`)));
    const adjTotal = calcTotal('salesAdjustments');
    if (adjTotal !== 0) row('Pelarasan Jualan', adjTotal);
    subtotal('Jumlah Jualan', totalSalesAmt);
    spacer();

    // ── KOS JUALAN ─────────────────────────────────────────────────────────
    sectionHdr('Kos Jualan (Cost of Sales)');
    if (cogsCats.length > 0) {
      cogsCats.forEach(cat => row(cat, calcTotal(`cogs.${cat}`)));
    }
    subtotal('Jumlah Kos Jualan', totalCogsAmt);
    spacer(2);
    grandTotal('UNTUNG KASAR (GROSS PROFIT)', grossProfit);

    // ── DUIT MASUK LAIN ────────────────────────────────────────────────────
    if (otherIncomeCats.length > 0) {
      spacer(2);
      sectionHdr('Pendapatan Lain (Other Income)');
      otherIncomeCats.forEach(cat => row(cat, calcTotal(`otherIncome.${cat}`)));
      subtotal('Jumlah Pendapatan Lain', totalOtherIncome);
      spacer();
    }

    // ── PERBELANJAAN ───────────────────────────────────────────────────────
    spacer(2);
    sectionHdr('Perbelanjaan (Expenses)');
    expenseCats.forEach(cat => row(cat, calcTotal(`expenses.${cat}`)));
    if (taxation !== 0) row('Peruntukan Cukai', taxation);
    subtotal('Jumlah Perbelanjaan', totalExpensesAmt + taxation);
    spacer(2);

    grandTotal(`UNTUNG/(RUGI) BERSIH ${year}`, netProfitAmt);

    // ── Footer ─────────────────────────────────────────────────────────────
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.1);
      doc.line(mL, 287, pageW - mR, 287);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(160, 160, 160);
      doc.text(`Dijana oleh Monitacc  •  ${format(new Date(), 'dd/MM/yyyy')}`, mL, 292);
      doc.text(`${i} / ${pageCount}`, pageW - mR, 292, { align: 'right' });
    }

    doc.save(`Penyata_Untung_Rugi_${businessName.replace(/\s+/g, '_')}_${year}.pdf`);
    return;
  }

  // ── Monthly / Custom: standard summary report ─────────────────────────────
  let reportTitle = '';
  if (reportType === 'monthly') {
    reportTitle = `Laporan Kewangan Bulanan - ${monthNames[month]} ${year}`;
  } else {
    reportTitle = `Laporan Kewangan Khas (${format(parseISO(startDate!), 'dd/MM/yyyy')} - ${format(parseISO(endDate!), 'dd/MM/yyyy')})`;
  }

  doc.setFontSize(22);
  doc.setTextColor(16, 185, 129);
  doc.text('Monitacc', 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('Sistem Perakaunan Pintar AI', 14, 25);
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(businessName, 14, 40);
  doc.setFontSize(12);
  doc.text(reportTitle, 14, 48);
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 55, 196, 55);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('Ringkasan Prestasi', 14, 65);

  doc.setFillColor(240, 253, 244);
  doc.rect(14, 70, 55, 25, 'F');
  doc.setTextColor(16, 185, 129);
  doc.setFontSize(8);
  doc.text('JUMLAH JUALAN', 18, 77);
  doc.setFontSize(12);
  doc.text(`RM ${fmt2(totalSales || 0)}`, 18, 87);

  doc.setFillColor(254, 242, 242);
  doc.rect(75, 70, 55, 25, 'F');
  doc.setTextColor(244, 63, 94);
  doc.setFontSize(8);
  doc.text('DUIT KELUAR', 79, 77);
  doc.setFontSize(12);
  doc.text(`RM ${fmt2(totalExpense || 0)}`, 79, 87);

  const netProfit = totalIncome - totalExpense;
  doc.setFillColor(239, 246, 255);
  doc.rect(136, 70, 60, 25, 'F');
  doc.setTextColor(59, 130, 246);
  doc.setFontSize(8);
  doc.text('UNTUNG/RUGI BERSIH', 140, 77);
  doc.setFontSize(12);
  doc.text(`RM ${fmt2(netProfit || 0)}`, 140, 87);

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Ringkasan Kategori', 14, 110);

  const breakdownData = [
    ...incomeByCategory.map(item => [CHART_OF_ACCOUNTS[item.category] || '-', item.category, 'Duit Masuk', `RM ${fmt2(item.total)}`]),
    ...expenseByCategory.map(item => [CHART_OF_ACCOUNTS[item.category] || '-', item.category, 'Duit Keluar', `RM ${fmt2(item.total)}`])
  ];

  autoTable(doc, {
    startY: 115,
    head: [['Kod', 'Kategori', 'Jenis', 'Jumlah']],
    body: breakdownData,
    headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { top: 10 },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 115;
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Perincian Transaksi', 14, finalY + 15);

  const sortedRecords = [...records].sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
  const tableData = sortedRecords.map(r => [
    format(parseISO(r.date), 'dd/MM/yyyy'),
    CHART_OF_ACCOUNTS[r.category] || '-',
    r.category,
    r.description,
    r.type === 'income' ? `+RM ${r.amount.toFixed(2)}` : `-RM ${r.amount.toFixed(2)}`
  ]);

  autoTable(doc, {
    startY: finalY + 20,
    head: [['Tarikh', 'Kod', 'Kategori', 'Keterangan', 'Jumlah']],
    body: tableData,
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { top: 10 },
  });

  const pageCount2 = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount2; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Dijana secara automatik oleh Monitacc pada ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 285);
    doc.text(`Halaman ${i} daripada ${pageCount2}`, 170, 285);
  }

  const fileName = reportType === 'custom'
    ? `Laporan_Monitacc_${businessName.replace(/\s+/g, '_')}_Khas_${startDate}_ke_${endDate}.pdf`
    : `Laporan_Monitacc_${businessName.replace(/\s+/g, '_')}_${monthNames[month]}_${year}.pdf`;

  doc.save(fileName);
};

// --- Components ---

const Navbar = ({ activeView, setView, user, isAdminAuthenticated, onLogoutAdmin }: { activeView: AppView, setView: (v: AppView) => void, user: UserType | null, isAdminAuthenticated: boolean, onLogoutAdmin: () => void }) => {
  if (['landing', 'auth', 'welcome', 'admin-auth', 'affiliate-auth', 'affiliate-dashboard'].includes(activeView)) return null;
  const isAdmin = user?.role === 'admin' || isAdminAuthenticated;

  const [navVisible, setNavVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const current = window.scrollY;
      if (current > lastScrollY.current && current > 60) {
        setNavVisible(false);
      } else {
        setNavVisible(true);
      }
      lastScrollY.current = current;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const userNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, premium: null },
    { id: 'sales', label: 'Jualan', icon: ShoppingCart, premium: null },
    { id: 'records', label: 'Transaksi', icon: FileText, premium: null },
    { id: 'reports', label: 'Laporan', icon: PieChart, premium: null },
    { id: 'ledger', label: 'Lejar', icon: BookOpen, premium: null },
    { id: 'reconcile', label: 'Padanan Bank', icon: RefreshCw, premium: 'Ultimate' },
    { id: 'ai-analysis', label: 'Smart Analisis', icon: Sparkles, premium: 'Starter' },
    { id: 'profile', label: 'Akaun', icon: User, premium: null },
  ];

  const adminNavItems = [
    { id: 'admin-dashboard', label: 'Admin Panel', icon: ShieldCheck },
    { id: 'user-management', label: 'Pengguna', icon: Users },
    { id: 'subscription-management', label: 'Langganan', icon: Receipt },
    { id: 'affiliated-management', label: 'Affiliated', icon: Users },
    { id: 'token-usage', label: 'Token Usage', icon: Zap },
    { id: 'plans', label: 'Pakej Harga', icon: CreditCard },
    { id: 'profile', label: 'Akaun', icon: User },
  ];

  const PLAN_ORDER: Record<string, number> = { free: 0, Percuma: 0, Starter: 1, Growth: 2, Ultimate: 3 };
  const userPlanLevel = PLAN_ORDER[user?.plan || 'free'] ?? 0;

  const isPremiumLocked = (requiredPlan: string | null | undefined): boolean => {
    if (!requiredPlan) return false;
    const required = PLAN_ORDER[requiredPlan] ?? 99;
    return userPlanLevel < required;
  };

  const navItems = (isAdmin ? adminNavItems : userNavItems).filter(item => {
    if (!user) return true;
    if (user.role === 'upload-receipt' || user.role === 'upload_only') {
      return ['dashboard', 'records', 'profile'].includes(item.id);
    }
    return true;
  });

  if (activeView === 'landing' || activeView === 'auth' || activeView === 'welcome' || activeView === 'admin-auth') return null;

  return (
    <nav
      className={`fixed z-50 transition-all duration-300 ease-in-out
        bottom-5 left-1/2 -translate-x-1/2
        bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-2xl shadow-slate-900/15
        rounded-2xl px-1.5 py-1.5 flex items-center
        md:translate-x-0 md:left-0 md:bottom-auto md:top-0 md:w-60 md:h-screen md:flex-col md:justify-start md:py-6 md:px-3 md:rounded-none md:border-r md:border-slate-200/80 md:bg-white md:backdrop-blur-none md:shadow-none
        ${navVisible ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none md:translate-y-0 md:opacity-100 md:pointer-events-auto'}
      `}
      style={{ willChange: 'transform, opacity' }}
    >
      <div className="hidden md:flex items-center gap-3 mb-8 px-3 group cursor-pointer">
        <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200/50">
          <CreditCard size={18} strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900 font-display leading-none">Monitacc</h1>
          <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5">empower by wekeyra</p>
        </div>
      </div>

      <div className="flex items-center md:flex-col md:gap-0.5 md:w-full">
        {navItems.map((item, i) => {
          const isActive = activeView === item.id;
          const showDivider = !isAdmin && (i === 3 || i === 5);
          const locked = !isAdmin && isPremiumLocked((item as any).premium);
          const premiumLabel = (item as any).premium;
          return (
            <div key={item.id} className="md:w-full">
              {showDivider && <div className="hidden md:block mx-3 my-2 border-t border-slate-100" />}
              <button
                onClick={() => {
                  if (locked) {
                    setView('plans');
                  } else {
                    setView(item.id as AppView);
                  }
                }}
                className={`relative w-full flex items-center justify-center transition-all duration-200 md:flex-row md:gap-3 md:px-3 md:py-2 md:w-full md:rounded-xl md:text-left ${isActive ? 'md:bg-emerald-600 md:text-white md:shadow-md md:shadow-emerald-600/20' : locked ? 'md:text-slate-300 md:hover:bg-slate-50 md:hover:text-slate-400' : 'md:text-slate-500 md:hover:bg-slate-50 md:hover:text-slate-800'}`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div className={`md:hidden flex items-center justify-center transition-all duration-200 rounded-xl relative
                  ${isActive
                    ? 'bg-emerald-600 text-white px-3 py-2 gap-1.5'
                    : locked ? 'text-slate-300 px-2.5 py-2' : 'text-slate-400 hover:text-slate-600 px-2.5 py-2'
                  }`}>
                  <item.icon size={17} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
                  {isActive && (
                    <span className="text-[11px] font-bold whitespace-nowrap leading-none">{item.label}</span>
                  )}
                  {locked && !isActive && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-full flex items-center justify-center">
                      <Lock size={7} className="text-white" strokeWidth={3} />
                    </span>
                  )}
                </div>
                <div className={`hidden md:flex items-center justify-center w-7 h-7 rounded-lg shrink-0 relative ${isActive ? 'bg-white/15' : locked ? 'bg-slate-50' : 'bg-slate-100'}`}>
                  <item.icon size={15} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
                  {locked && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-full flex items-center justify-center shadow-sm">
                      <Lock size={7} className="text-white" strokeWidth={3} />
                    </span>
                  )}
                </div>
                <span className={`hidden md:block text-[13px] font-semibold flex-1 ${locked ? 'text-slate-300' : ''}`}>{item.label}</span>
                {isActive && <div className="hidden md:block w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" />}
                {locked && !isActive && premiumLabel && (
                  <span className="hidden md:inline-flex items-center px-1.5 py-0.5 bg-amber-50 text-amber-600 text-[9px] font-bold rounded-md border border-amber-100 shrink-0">
                    {premiumLabel}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="hidden md:block mt-auto w-full px-2 pb-4">
        {isAdmin ? (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
                <ShieldCheck size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider leading-none">Status</p>
                <p className="text-xs font-bold text-slate-900 tracking-tight">Pentadbir Sistem</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => setView('dashboard')}
                className="w-full py-2 bg-white border border-emerald-200 text-emerald-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-50 transition-all shadow-sm"
              >
                Lihat Versi User
              </button>
              <button 
                onClick={() => setView('affiliate-auth')}
                className="w-full py-2 bg-blue-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
              >
                Login Affiliate
              </button>
              <button 
                onClick={onLogoutAdmin}
                className="w-full py-2 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Logout Admin
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => setView('admin-auth')}
            className="w-full bg-slate-900 text-white rounded-xl p-4 border border-slate-800 flex items-center gap-3 hover:bg-slate-800 transition-all group shadow-lg shadow-slate-200"
          >
            <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <ShieldCheck size={18} />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Akses Khas</p>
              <p className="text-xs font-bold text-white tracking-tight">Login Admin</p>
            </div>
          </button>
        )}
      </div>
    </nav>
  );
};

const LANDING_PLANS = [
  {
    name: 'Percuma',
    price: '0',
    features: [
      '5 Imbasan Transaksi / bulan',
      'Unlimited Rekod Manual',
      '1× Imbasan Bank Statement',
      'Monitacc Assistant',
    ],
    cta: 'Mula Percuma',
    popular: false,
  },
  {
    name: 'Starter',
    price: '50',
    period: '/bln',
    features: [
      '100 Imbasan Transaksi / bulan',
      'Unlimited Rekod Manual',
      '3× Imbasan Bank Statement',
      'Monitacc Assistant',
      '1× Smart Analysis',
    ],
    cta: 'Pilih Starter',
    popular: false,
  },
  {
    name: 'Growth',
    price: '100',
    period: '/bln',
    features: [
      '250 Imbasan Transaksi / bulan',
      'Unlimited Rekod Manual',
      '9× Imbasan Bank Statement',
      'Monitacc Assistant',
      '4× Smart Analysis',
    ],
    cta: 'Pilih Growth',
    popular: false,
  },
  {
    name: 'Ultimate',
    price: '150',
    period: '/bln',
    features: [
      'Unlimited Imbasan Transaksi',
      'Unlimited Rekod Manual',
      'Unlimited Bank Statement',
      'Unlimited Smart Analysis',
      'P&L Report + Balance Sheet',
      'Reconciliation Features',
    ],
    cta: 'Pilih Ultimate',
    popular: true,
  },
];

const PlanConfirmModal = ({ plan, onConfirm, onClose }: { plan: typeof LANDING_PLANS[0]; onConfirm: () => void; onClose: () => void }) => (
  <AnimatePresence>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
        className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-slate-900 px-6 py-5 text-center relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors">
            <X size={18} />
          </button>
          {plan.popular && (
            <span className="inline-block bg-emerald-500 text-white text-[8px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full mb-3">
              Paling Popular
            </span>
          )}
          <h3 className="text-lg font-bold text-white tracking-tight font-display">Pakej {plan.name}</h3>
          <div className="flex items-baseline justify-center gap-0.5 mt-2">
            <span className="text-[11px] font-bold text-white/50">RM</span>
            <span className="text-4xl font-extrabold text-white font-display">{plan.price}</span>
            {plan.period && <span className="text-[11px] font-bold text-white/50">{plan.period}</span>}
          </div>
        </div>

        <div className="px-6 py-5">
          <ul className="space-y-2.5 mb-5">
            {plan.features.map((f, j) => (
              <li key={j} className="flex items-start gap-2.5 text-[12px] font-medium text-slate-700 leading-snug">
                <Check size={13} strokeWidth={3} className="text-emerald-500 shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-5">
            <div className="flex items-center gap-2.5 mb-2">
              <CreditCard size={15} className="text-slate-400" />
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Maklumat Pembayaran</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Anda akan diminta memasukkan butiran kad kredit/debit melalui Stripe selepas mendaftar akaun. Pembayaran diproses dengan selamat.
            </p>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 mb-5">
            <div className="flex items-center gap-2.5 mb-1.5">
              <ShieldCheck size={15} className="text-emerald-600" />
              <span className="text-[11px] font-bold text-emerald-700">Langkah Seterusnya</span>
            </div>
            <ol className="text-[11px] text-emerald-700/80 leading-relaxed space-y-1 pl-5 list-decimal">
              <li>Daftar akaun Monitacc</li>
              <li>Masukkan butiran kad pembayaran</li>
              <li>Langganan aktif serta-merta</li>
            </ol>
          </div>

          <button
            onClick={onConfirm}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            Langgan Pakej {plan.name}
            <ArrowRight size={15} strokeWidth={2.5} />
          </button>

          <p className="text-center text-[10px] text-slate-400 font-medium mt-3">
            Batalkan bila-bila masa. Tiada komitmen jangka panjang.
          </p>
        </div>
      </motion.div>
    </motion.div>
  </AnimatePresence>
);

const LandingPage = ({ onStart, onAffiliateLogin }: { onStart: (plan?: string) => void, onAffiliateLogin: () => void }) => {
  const [selectedPlan, setSelectedPlan] = useState<typeof LANDING_PLANS[0] | null>(null);

  const handlePlanClick = (plan: typeof LANDING_PLANS[0]) => {
    if (plan.name === 'Percuma') {
      onStart();
      return;
    }
    setSelectedPlan(plan);
  };

  const handleConfirmSubscribe = () => {
    if (selectedPlan) {
      onStart(selectedPlan.name);
      setSelectedPlan(null);
    }
  };

  return (
  <div className="min-h-screen bg-white flex flex-col overflow-x-hidden">
    {selectedPlan && (
      <PlanConfirmModal
        plan={selectedPlan}
        onConfirm={handleConfirmSubscribe}
        onClose={() => setSelectedPlan(null)}
      />
    )}

    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 px-5 py-4">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white shadow-sm">
            <CreditCard size={16} strokeWidth={2.5} />
          </div>
          <span className="text-base font-bold tracking-tight text-slate-900 font-display">Monitacc</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onAffiliateLogin}
            className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-emerald-600 uppercase tracking-wider transition-colors px-3 py-2 rounded-lg hover:bg-slate-50"
          >
            Portal Affiliated
          </button>
          <button
            onClick={() => onStart()}
            className="flex items-center gap-1.5 bg-emerald-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-emerald-700 transition-all shadow-sm"
          >
            Log Masuk
          </button>
        </div>
      </div>
    </header>

    <main className="flex-1">
      <section className="px-5 pt-14 pb-16 text-center bg-white">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold uppercase tracking-wider mb-7 border border-emerald-100"
          >
            <Zap size={10} fill="currentColor" /> Smart Accounting · Empower by Wekeyra
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-5 font-display leading-[1.1]"
          >
            Urus Akaun Bisnes{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-emerald-400">
              Semudah Ambil Gambar.
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="text-base md:text-lg text-slate-500 font-medium max-w-lg mx-auto mb-9 leading-relaxed"
          >
            Gunakan AI untuk imbas resit, urus jualan, dan jana laporan untung rugi secara automatik.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
            className="flex flex-col gap-3 items-center"
          >
            <button
              onClick={() => onStart()}
              className="w-full max-w-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-8 py-3.5 rounded-2xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
            >
              Mula Sekarang — Percuma
              <ArrowRight size={16} strokeWidth={2.5} />
            </button>
            <button
              onClick={onAffiliateLogin}
              className="w-full max-w-xs bg-white hover:bg-slate-50 text-slate-600 font-bold text-sm px-8 py-3.5 rounded-2xl transition-all border border-slate-200 sm:hidden"
            >
              Portal Affiliated
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-6 mt-8"
          >
            {[
              { label: 'Pengguna Aktif', value: '2,000+' },
              { label: 'Transaksi Diimbas', value: '50k+' },
              { label: 'Negeri di Malaysia', value: '14' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-base font-extrabold text-slate-900 font-display">{stat.value}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="px-5 py-14 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h3 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight font-display mb-2">Kenapa Monitacc?</h3>
            <p className="text-slate-500 text-sm font-medium">Direka khas untuk usahawan Malaysia.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { title: 'Imbasan AI', desc: 'Snap resit, AI terus ekstrak data secara automatik. Jimat masa berjam-jam.', icon: Camera },
              { title: 'Laporan P&L', desc: 'Penyata untung rugi dikemaskini secara langsung. PDF sedia muat turun.', icon: PieChart },
              { title: 'Akses Mobile', desc: 'Guna di mana-mana. Responsif untuk telefon, tablet, dan komputer.', icon: LayoutDashboard },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm"
              >
                <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-5">
                  <feature.icon size={22} strokeWidth={2} />
                </div>
                <h4 className="text-base font-bold text-slate-900 font-display mb-2">{feature.title}</h4>
                <p className="text-slate-500 text-sm leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-14 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h3 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight font-display mb-2">Apa Kata Pengguna</h3>
            <p className="text-slate-500 text-sm font-medium">Ribuan usahawan Malaysia telah beralih ke Monitacc.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { name: 'Siti Aminah', role: 'Owner Kedai Makan', comment: 'Dulu kena simpan resit dalam kotak, sekarang ambil gambar saja! Senang gila.' },
              { name: 'Khairul Ali', role: 'Freelancer Digital', comment: 'Laporan P&L yang dijana sangat membantu faham aliran tunai bisnes. Rekomended!' },
              { name: 'Sarah Tan', role: 'Butik Pakaian', comment: 'User-friendly dan AI dia memang power. Jimat masa banyak untuk manage akaun.' },
            ].map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.97 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="bg-slate-50 rounded-2xl p-6 border border-slate-100"
              >
                <div className="flex gap-0.5 text-amber-400 mb-4">
                  {[...Array(5)].map((_, j) => <Sparkles key={j} size={13} fill="currentColor" />)}
                </div>
                <p className="text-slate-700 text-sm leading-relaxed mb-5">"{t.comment}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold text-sm shrink-0">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{t.name}</p>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-14 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h3 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight font-display mb-2">Pilih Pakej Anda</h3>
            <p className="text-slate-500 text-sm font-medium">Mula percuma. Upgrade bila bisnes berkembang.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {LANDING_PLANS.map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className={`rounded-2xl p-5 flex flex-col transition-all ${
                  p.popular
                    ? 'bg-slate-900 border-2 border-emerald-500 shadow-xl'
                    : 'bg-white border border-slate-200 shadow-sm'
                }`}
              >
                {p.popular && (
                  <span className="self-start bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full mb-3">
                    Paling Popular
                  </span>
                )}
                <h4 className={`text-sm font-bold font-display mb-1 ${p.popular ? 'text-white' : 'text-slate-900'}`}>{p.name}</h4>
                <div className="flex items-baseline gap-0.5 mb-4">
                  <span className={`text-[10px] font-bold ${p.popular ? 'text-white/60' : 'text-slate-500'}`}>RM</span>
                  <span className={`text-3xl font-extrabold font-display ${p.popular ? 'text-white' : 'text-slate-900'}`}>{p.price}</span>
                  {p.period && <span className={`text-[10px] font-bold ml-0.5 ${p.popular ? 'text-white/60' : 'text-slate-500'}`}>{p.period}</span>}
                </div>
                <ul className="space-y-2.5 mb-5 flex-1">
                  {p.features.map((f, j) => (
                    <li key={j} className={`flex items-start gap-2 text-[11px] font-medium leading-snug ${p.popular ? 'text-white/90' : 'text-slate-700'}`}>
                      <Check size={11} strokeWidth={3} className="text-emerald-500 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handlePlanClick(p)}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all ${
                    p.popular
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
                  }`}
                >
                  {p.cta}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 bg-slate-900 text-white text-center">
        <div className="max-w-lg mx-auto">
          <div className="w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-emerald-500/30">
            <Zap size={26} className="text-emerald-400" strokeWidth={2} />
          </div>
          <h3 className="text-2xl md:text-3xl font-bold font-display mb-3">Mula Guna Monitacc Hari Ini</h3>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">Daftar percuma. Tiada kredit kad diperlukan. Mula urus akaun bisnes dengan lebih mudah.</p>
          <button
            onClick={() => onStart()}
            className="w-full max-w-xs mx-auto bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm px-8 py-3.5 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            Daftar Percuma
            <ArrowRight size={16} strokeWidth={2.5} />
          </button>
        </div>
      </section>
    </main>

    <footer className="px-5 py-6 bg-slate-900 border-t border-white/5">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-emerald-600 rounded-md flex items-center justify-center">
            <CreditCard size={12} strokeWidth={2.5} className="text-white" />
          </div>
          <span className="text-sm font-bold text-slate-400">Monitacc</span>
        </div>
        <p className="text-slate-500 text-[11px] font-medium">&copy; 2026 Monitacc. Empower by Wekeyra.</p>
        <button
          onClick={onAffiliateLogin}
          className="text-[11px] font-bold text-slate-500 hover:text-emerald-400 uppercase tracking-wider transition-colors"
        >
          Portal Affiliated
        </button>
      </div>
    </footer>
  </div>
  );
};

const AUTH_PLANS = [
  { name: 'Percuma', price: '0', period: null, desc: '5 Imbasan / bln' },
  { name: 'Starter', price: '50', period: '/bln', desc: '100 Imbasan / bln' },
  { name: 'Growth', price: '100', period: '/bln', desc: '250 Imbasan / bln' },
  { name: 'Ultimate', price: '150', period: '/bln', desc: 'Unlimited Imbasan' },
];

const AuthView = ({ onAuthSuccess, initialPlan, onBack }: { onAuthSuccess: (user: UserType, isNewUser: boolean) => void; initialPlan?: string | null; onBack?: () => void }) => {
  const [isLogin, setIsLogin] = useState(!initialPlan);
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>(initialPlan || 'Percuma');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    const savedPassword = localStorage.getItem('rememberedPassword');
    if (savedEmail && savedPassword) {
      setEmail(savedEmail);
      setPassword(savedPassword);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (rememberMe && isLogin) {
      localStorage.setItem('rememberedEmail', email);
      localStorage.setItem('rememberedPassword', password);
    } else if (isLogin) {
      localStorage.removeItem('rememberedEmail');
      localStorage.removeItem('rememberedPassword');
    }

    try {
      let userData: UserType;
      if (isLogin) {
        userData = await apiLogin(email, password);
        onAuthSuccess(userData, false);
      } else {
        const { user: registeredUser, accessToken } = await apiRegister(name, email, phone, password, companyName);
        userData = registeredUser;
        if (selectedPlan && selectedPlan !== 'Percuma') {
          const url = await createCheckoutSession(selectedPlan as PaidPlan, accessToken);
          window.location.href = url;
          return;
        }
        onAuthSuccess(userData, true);
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 overflow-x-hidden">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-lg"
      >
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-sm font-medium mb-6 transition-colors group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform duration-200" />
            Kembali
          </button>
        )}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-emerald-100">
            <CreditCard size={24} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight font-display">{isLogin ? 'Log Masuk' : 'Daftar Akaun'}</h2>
          <p className="text-slate-500 text-sm mt-1">Sistem Perakaunan Pintar Monitacc</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Nama Penuh</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder="Contoh: Ahmad bin Ali"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Nama Syarikat</label>
                <input 
                  type="text" 
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder="Contoh: Kedai Kopi Ahmad"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">No. Telefon</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder="Contoh: 0123456789"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Pilih Pakej</label>
                <div className="grid grid-cols-2 gap-2">
                  {AUTH_PLANS.map((plan) => {
                    const isSelected = selectedPlan === plan.name;
                    return (
                      <button
                        key={plan.name}
                        type="button"
                        onClick={() => setSelectedPlan(plan.name)}
                        className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                          isSelected
                            ? plan.name === 'Ultimate'
                              ? 'border-slate-800 bg-slate-900 text-white'
                              : 'border-emerald-500 bg-emerald-50'
                            : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        {plan.name === 'Ultimate' && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap">Popular</span>
                        )}
                        <div className={`text-xs font-bold mb-0.5 ${isSelected && plan.name === 'Ultimate' ? 'text-white' : isSelected ? 'text-emerald-700' : 'text-slate-700'}`}>{plan.name}</div>
                        <div className={`flex items-baseline gap-0.5 ${isSelected && plan.name === 'Ultimate' ? 'text-white' : isSelected ? 'text-emerald-600' : 'text-slate-500'}`}>
                          <span className="text-[10px] font-bold">RM</span>
                          <span className="text-base font-extrabold">{plan.price}</span>
                          {plan.period && <span className="text-[9px] font-medium">{plan.period}</span>}
                        </div>
                        <div className={`text-[9px] font-medium mt-0.5 ${isSelected && plan.name === 'Ultimate' ? 'text-white/70' : 'text-slate-400'}`}>{plan.desc}</div>
                      </button>
                    );
                  })}
                </div>
                {selectedPlan !== 'Percuma' && (
                  <p className="text-[10px] text-slate-400 font-medium text-center pt-0.5">Anda akan diarahkan ke halaman pembayaran selepas mendaftar.</p>
                )}
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Emel</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              placeholder="nama@syarikat.com"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Kata Laluan</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              placeholder="••••••••"
            />
          </div>

          {isLogin && (
            <div className="flex items-center gap-2 px-1">
              <input 
                type="checkbox" 
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              />
              <label htmlFor="rememberMe" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer select-none">
                Ingat Saya
              </label>
            </div>
          )}

          {error && <p className="text-rose-500 text-xs font-bold text-center">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-sm">
            {loading
              ? selectedPlan !== 'Percuma' && !isLogin
                ? 'Mendaftar akaun...'
                : 'Sila Tunggu...'
              : isLogin
              ? 'Log Masuk'
              : selectedPlan !== 'Percuma'
              ? `Daftar & Bayar Pakej ${selectedPlan}`
              : 'Daftar Percuma'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="relative text-xs font-bold text-slate-400 hover:text-emerald-600 transition-colors duration-300 uppercase tracking-widest group overflow-hidden px-2 py-1"
          >
            <span className="relative z-10 inline-flex items-center gap-1.5">
              <span
                key={isLogin ? 'register' : 'login'}
                className="inline-block"
                style={{ animation: 'fadeSlideUp 0.35s ease forwards' }}
              >
                {isLogin ? 'Tiada akaun? Daftar di sini' : 'Sudah ada akaun? Log masuk'}
              </span>
              <span className="inline-block transition-transform duration-300 group-hover:translate-x-0.5">→</span>
            </span>
            <span className="absolute bottom-0 left-0 h-[1.5px] w-0 bg-emerald-500 group-hover:w-full transition-all duration-300 rounded-full" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const ChoosePlanView = ({ user, onComplete }: { user: UserType | null, onComplete: () => void }) => {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<typeof LANDING_PLANS[0] | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      const plan = params.get('plan') || '';
      window.history.replaceState({}, '', window.location.pathname);
      setConfirmingPayment(true);

      let attempts = 0;
      const maxAttempts = 20;
      const poll = async () => {
        attempts++;
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) { setConfirmingPayment(false); return; }
          const { data: profile } = await supabase
            .from('users')
            .select('plan')
            .eq('id', session.user.id)
            .maybeSingle();
          if (profile && profile.plan && profile.plan !== 'free' && profile.plan !== 'Percuma') {
            setConfirmingPayment(false);
            setSuccessMsg(`Pembayaran berjaya! Plan ${profile.plan} anda kini aktif. Klik teruskan untuk mula.`);
            return;
          }
        } catch (_) {}
        if (attempts < maxAttempts) {
          setTimeout(poll, 3000);
        } else {
          setConfirmingPayment(false);
          setSuccessMsg(`Pembayaran berjaya! Plan ${plan} anda akan diaktifkan tidak lama lagi. Klik teruskan untuk mula.`);
        }
      };
      poll();
    } else if (params.get('payment') === 'cancelled') {
      setError('Pembayaran dibatalkan. Pilih pakej untuk cuba semula.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const plans = [
    {
      name: 'Percuma',
      price: '0',
      period: undefined as string | undefined,
      features: ['5 Imbasan Transaksi / bulan', 'Unlimited Rekod Manual', '1× Bank Statement', 'Monitacc Assistant'],
      popular: false,
      cta: 'Mula Percuma',
    },
    {
      name: 'Starter',
      price: '50',
      period: '/bln',
      features: ['100 Imbasan Transaksi / bulan', 'Unlimited Rekod Manual', '3× Bank Statement', 'Monitacc Assistant', '1× Smart Analysis'],
      popular: false,
      cta: 'Langgan Starter',
    },
    {
      name: 'Growth',
      price: '100',
      period: '/bln',
      features: ['250 Imbasan Transaksi / bulan', 'Unlimited Rekod Manual', '9× Bank Statement', 'Monitacc Assistant', '4× Smart Analysis'],
      popular: false,
      cta: 'Langgan Growth',
    },
    {
      name: 'Ultimate',
      price: '150',
      period: '/bln',
      features: ['Unlimited Imbasan Transaksi', 'Unlimited Rekod Manual', 'Unlimited Bank Statement', 'Unlimited Smart Analysis', 'P&L Report + Balance Sheet', 'Reconciliation Features'],
      popular: true,
      cta: 'Langgan Ultimate',
    },
  ];

  const handlePlanClick = (plan: typeof plans[0]) => {
    setError('');
    if (plan.name === 'Percuma') {
      onComplete();
      return;
    }
    setSelectedPlan(plan);
  };

  const handleConfirmSubscribe = async () => {
    if (!selectedPlan) return;
    const planName = selectedPlan.name;
    setSelectedPlan(null);
    setLoadingPlan(planName);
    try {
      const url = await createCheckoutSession(planName as PaidPlan);
      window.location.href = url;
    } catch (err: any) {
      setError(err.message || 'Ralat semasa memproses pembayaran. Sila cuba lagi.');
      setLoadingPlan(null);
    }
  };

  const firstName = user?.name?.split(' ')[0] || 'Usahawan';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col overflow-x-hidden">
      {selectedPlan && (
        <PlanConfirmModal
          plan={selectedPlan}
          onConfirm={handleConfirmSubscribe}
          onClose={() => setSelectedPlan(null)}
        />
      )}

      <div className="bg-slate-900 px-5 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <CreditCard size={16} className="text-white" />
          </div>
          <span className="text-white font-bold tracking-tight text-sm">Monitacc</span>
        </div>
        <button onClick={onComplete} className="text-slate-400 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors">
          Langkau
        </button>
      </div>

      <div className="flex-1 px-5 py-10 max-w-5xl mx-auto w-full">
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-200"
          >
            <CheckCircle2 size={28} className="text-white" />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight font-display mb-2"
          >
            Akaun berjaya dicipta, {firstName}!
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-slate-500 text-sm font-medium"
          >
            Pilih pakej yang sesuai untuk memulakan perjalanan anda bersama Monitacc.
          </motion.p>
        </div>

        {confirmingPayment && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-3 max-w-xl mx-auto">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
            <p className="text-sm font-bold text-blue-700">Mengesahkan pembayaran... Sila tunggu sebentar.</p>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-center gap-3 max-w-xl mx-auto">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <p className="text-sm font-bold text-emerald-700 flex-1 text-center sm:text-left">{successMsg}</p>
            <button
              onClick={onComplete}
              className="bg-emerald-500 hover:bg-emerald-400 text-white text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-xl transition-all shrink-0"
            >
              Teruskan
            </button>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 max-w-xl mx-auto">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <p className="text-sm font-bold text-rose-700">{error}</p>
            <button onClick={() => setError('')} className="ml-auto text-rose-400 hover:text-rose-600"><X size={14} /></button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((plan, i) => {
            const isLoading = loadingPlan === plan.name;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className={`relative rounded-2xl p-6 flex flex-col border transition-all duration-300 hover:-translate-y-1 ${
                  plan.popular
                    ? 'bg-slate-900 border-emerald-500 ring-4 ring-emerald-100 shadow-2xl scale-[1.03] z-10'
                    : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-3 py-0.5 rounded-full text-[8px] font-bold tracking-widest shadow-lg whitespace-nowrap">
                    PALING POPULAR
                  </span>
                )}
                <h3 className={`text-base font-bold tracking-tight font-display text-center mb-1 ${plan.popular ? 'text-white' : 'text-slate-900'}`}>
                  {plan.name}
                </h3>
                <div className="flex items-baseline justify-center mb-5">
                  <span className={`text-[10px] font-bold ${plan.popular ? 'text-white/60' : 'text-slate-500'}`}>RM</span>
                  <span className={`text-3xl font-extrabold font-display mx-0.5 ${plan.popular ? 'text-white' : 'text-slate-900'}`}>{plan.price}</span>
                  {plan.period && <span className={`text-[10px] font-medium ${plan.popular ? 'text-white/60' : 'text-slate-500'}`}>{plan.period}</span>}
                </div>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((f, j) => (
                    <li key={j} className={`flex items-start gap-2 text-[11px] font-medium leading-snug ${plan.popular ? 'text-white/90' : 'text-slate-600'}`}>
                      <Check size={11} strokeWidth={3} className="text-emerald-500 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handlePlanClick(plan)}
                  disabled={isLoading}
                  className={`w-full py-3 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2 ${
                    plan.popular
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/30'
                      : plan.name === 'Percuma'
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      : 'bg-slate-900 hover:bg-slate-700 text-white'
                  }`}
                >
                  {isLoading ? (
                    <><Loader2 size={13} className="animate-spin" /> Memproses...</>
                  ) : (
                    plan.cta
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>

        <p className="text-center text-[10px] text-slate-400 mt-8 font-medium">
          Pembayaran selamat diproses oleh Stripe. Batalkan langganan bila-bila masa. <br />
          Anda boleh tukar pakej pada bila-bila masa dari tetapan akaun.
        </p>
      </div>
    </div>
  );
};

const WelcomeView = ({ user, onComplete }: { user: UserType | null, onComplete: () => void }) => {
  const firstName = user?.name?.split(' ')[0] || 'Usahawan';
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

  return (
    <div 
      onClick={onComplete}
      className="min-h-screen bg-emerald-600 flex flex-col items-center justify-center p-6 text-center cursor-pointer overflow-hidden relative"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-500 to-emerald-700 opacity-50" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10"
      >
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="relative w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-2xl mb-8 mx-auto"
        >
          <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
            <CheckCircle2 size={32} strokeWidth={3} />
          </div>
        </motion.div>
        
        <motion.h2 
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="text-5xl md:text-7xl font-bold text-white tracking-tight mb-4 font-display"
        >
          Selamat Datang, {displayName}!
        </motion.h2>
        
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          className="text-emerald-100 text-lg md:text-xl font-medium max-w-lg mx-auto leading-relaxed"
        >
          Akaun Monitacc anda telah sedia. <br className="hidden md:block" /> Mari mula urus kewangan bisnes anda.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-12 text-emerald-200 text-sm font-semibold uppercase tracking-widest animate-pulse"
        >
          Klik di mana-mana untuk mula
        </motion.div>
      </motion.div>
    </div>
  );
};

const AIInsightsCard = ({ insights, loading, lastUpdated, isQuotaExceeded, onRefresh }: {
  insights: DashboardInsight[];
  loading: boolean;
  lastUpdated: string;
  isQuotaExceeded: boolean;
  onRefresh: () => void;
}) => {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const getIcon = (type: string) => {
    if (type === 'improvement') return <TrendingDown size={15} />;
    if (type === 'attention') return <AlertCircle size={15} />;
    return <TrendingUp size={15} />;
  };

  const getIconStyle = (type: string) => {
    if (type === 'improvement') return 'bg-rose-500/20 text-rose-400';
    if (type === 'attention') return 'bg-amber-500/20 text-amber-400';
    return 'bg-emerald-500/20 text-emerald-400';
  };

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-700/50 overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-emerald-500/20 rounded-lg">
            <Sparkles size={15} className="text-emerald-400" />
          </div>
          <div>
            <span className="text-sm font-bold text-white tracking-tight">Smart Analisis</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`flex h-1.5 w-1.5 rounded-full ${isQuotaExceeded ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
              <span className={`text-[9px] uppercase tracking-widest font-bold ${isQuotaExceeded ? 'text-amber-400/70' : 'text-emerald-400/70'}`}>
                {isQuotaExceeded ? 'Berehat' : 'Langsung'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 font-medium">{lastUpdated}</span>
          <button
            onClick={onRefresh}
            className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-all text-white/50 hover:text-white"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Insight rows */}
      <div className="divide-y divide-slate-700/40">
        {insights.map((insight, idx) => {
          const isOpen = expandedIdx === idx;
          const isQuota = insight.title === 'Had Quota Dicapai';
          return (
            <button
              key={idx}
              onClick={() => setExpandedIdx(isOpen ? null : idx)}
              className={`w-full text-left px-4 py-3 flex flex-col gap-0 transition-all duration-200
                ${isQuota ? 'hover:bg-amber-500/5' : 'hover:bg-white/[0.03]'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg shrink-0 ${getIconStyle(insight.type)}`}>
                  {getIcon(insight.type)}
                </div>
                <span className="text-[13px] font-semibold text-white/85 leading-snug flex-1 text-left">
                  {insight.title}
                </span>
                <div className={`shrink-0 text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                  <ChevronDown size={14} />
                </div>
              </div>
              {isOpen && (
                <div className="mt-2.5 ml-9 text-xs text-slate-400 leading-relaxed text-left">
                  {insight.description}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const AIInsights = ({ records, sales }: { records: TransactionRecord[], sales: any[] }) => {
  const [insights, setInsights] = useState<DashboardInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' }));
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const res = await getDashboardInsights(records, sales);
      setInsights(res);
      setLastUpdated(new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Error in AIInsights component:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInsights();
    }, 5000); // 5 second debounce to save quota

    return () => clearTimeout(timer);
  }, [records.length, sales.length, refreshTrigger]);

  if (loading) {
    return (
      <div className="card-premium p-8 animate-pulse bg-slate-50/50 border-slate-100">
        <div className="flex justify-between items-center mb-6">
          <div className="h-6 w-48 bg-slate-200 rounded-full" />
          <div className="h-6 w-24 bg-slate-200 rounded-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-24 bg-slate-100 rounded-2xl" />
          <div className="h-24 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (insights.length === 0) return null;

  const isQuotaExceeded = insights.some(i => i.title === 'Had Quota Dicapai');

  return (
    <AIInsightsCard
      insights={insights}
      loading={loading}
      lastUpdated={lastUpdated}
      isQuotaExceeded={isQuotaExceeded}
      onRefresh={() => setRefreshTrigger(prev => prev + 1)}
    />
  );
};

const Dashboard = ({ stats: initialStats, records, sales, user, setView, salesStats, onAddSale, onScan, onFileSelect }: { stats: Stats | null, records: TransactionRecord[], sales: any[], user: UserType | null, setView: (v: AppView) => void, salesStats: any, onAddSale: () => void, onScan: () => void, onFileSelect: (file: File) => void }) => {
  const [timeFilter, setTimeFilter] = useState<'all' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('all');
  const now = new Date();

  const filteredRecords = records.filter(r => {
    const date = parseISO(r.date);
    if (timeFilter === 'daily') return isSameDay(date, now);
    if (timeFilter === 'weekly') return isSameWeek(date, now);
    if (timeFilter === 'monthly') return isSameMonth(date, now);
    if (timeFilter === 'yearly') return isSameYear(date, now);
    return true;
  });

  const dashAssetLiabSet = new Set(ASSET_LIABILITY_CATEGORIES.map(c => c.toUpperCase()));
  const income = filteredRecords.filter(r => r.type === 'income' && !dashAssetLiabSet.has(r.category.trim().toUpperCase())).reduce((sum, r) => sum + r.amount, 0);
  const expense = filteredRecords.filter(r => r.type === 'expense' && !dashAssetLiabSet.has(r.category.trim().toUpperCase())).reduce((sum, r) => sum + r.amount, 0);

  const chartData = [
    { name: 'Masuk', value: income, fill: '#10b981' },
    { name: 'Keluar', value: expense, fill: '#f43f5e' },
  ];

  const filterOptions = [
    { id: 'all', label: 'Semua' },
    { id: 'daily', label: 'Harian' },
    { id: 'weekly', label: 'Mingguan' },
    { id: 'monthly', label: 'Bulanan' },
    { id: 'yearly', label: 'Tahunan' },
  ];

  return (
    <div className="pb-24 md:pl-64 md:pt-12 max-w-7xl mx-auto">
      {/* Mobile Hero Header */}
      <div className="md:hidden bg-gradient-to-br from-emerald-600 to-emerald-800 px-4 pt-5 pb-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
        </div>
        <div className="flex items-center justify-between mb-4 relative">
          <div>
            <p className="text-emerald-200 text-[11px] font-semibold uppercase tracking-widest mb-1">Dashboard</p>
            <motion.h2
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="text-xl font-bold text-white tracking-tight font-display"
            >
              Selamat Kembali,
            </motion.h2>
            <p className="text-white font-bold text-lg leading-tight opacity-90">{user?.name?.split(' ')[0] || 'Ali'}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onScan}
              className="w-10 h-10 bg-white/20 backdrop-blur-sm text-white rounded-xl flex items-center justify-center border border-white/30 active:scale-95 transition-transform"
            >
              <Camera size={18} />
            </button>
            <label className="w-10 h-10 bg-white/20 backdrop-blur-sm text-white rounded-xl flex items-center justify-center border border-white/30 active:scale-95 transition-transform cursor-pointer">
              <FileText size={18} />
              <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFileSelect(file);
              }} />
            </label>
          </div>
        </div>

        {/* Net Balance highlight */}
        {user?.role !== 'upload_only' && (
          <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/20 relative">
            <p className="text-emerald-200 text-[10px] font-bold uppercase tracking-widest mb-0.5">Baki Bersih</p>
            <p className="text-white text-2xl font-bold tracking-tight font-display">RM {((income - expense) || 0).toLocaleString()}</p>
          </div>
        )}
      </div>

      {/* Mobile filter tabs — below hero */}
      <div className="md:hidden px-4 -mt-3 mb-4 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-1 flex">
          {filterOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setTimeFilter(opt.id as any)}
              className={`flex-1 py-2 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                timeFilter === opt.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop header */}
      <header className="hidden md:block mb-10 px-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <motion.h2
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="text-3xl font-bold text-slate-900 tracking-tight mb-0.5 font-display"
            >
              Selamat Kembali, {(user?.name?.split(' ')[0] || 'Ali')}
            </motion.h2>
            <p className="text-sm text-slate-500 font-medium tracking-tight">
              Berikut adalah ringkasan prestasi perniagaan anda.
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={onScan}
              className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-sm"
            >
              <Camera size={16} />
              Imbas Resit
            </button>
            <label className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
              <FileText size={16} />
              Muat Naik PDF
              <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFileSelect(file);
              }} />
            </label>
          </div>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit">
          {filterOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setTimeFilter(opt.id as any)}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                timeFilter === opt.id
                  ? 'bg-white shadow-sm text-emerald-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </header>

      {/* Stat Cards — mobile 2x2 compact, desktop row */}
      <div className="px-4 md:px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-6 mb-5 md:mb-10">
          {user?.role === 'upload_only' ? (
            <>
              <StatCard label="Jumlah Resit" value={expense} icon={TrendingDown} color="rose" />
              <StatCard label="Bil. Resit" value={filteredRecords.length} icon={FileText} color="slate" />
            </>
          ) : (
            <>
              <StatCard label="Duit Masuk" value={income} icon={TrendingUp} color="emerald" />
              <StatCard label="Duit Keluar" value={expense} icon={TrendingDown} color="rose" />
              <StatCard label="Baki Tunai" value={income - expense} icon={DollarSign} color="emerald" />
              <StatCard label="Bil. Rekod" value={filteredRecords.length} icon={FileText} color="slate" />
            </>
          )}
        </div>

        {user?.role !== 'upload_only' && (
          <div className="mb-5 md:mb-10">
            <AIInsights records={records} sales={sales} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-8">
          {user?.role !== 'upload_only' && (
            <div className="lg:col-span-2 card-premium p-4 md:p-8">
              <div className="flex justify-between items-center mb-3 md:mb-8">
                <h3 className="text-sm md:text-lg font-bold text-slate-900 tracking-tight font-display">Aliran Tunai</h3>
                <div className="flex gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-wider">Masuk</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                    <span className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-wider">Keluar</span>
                  </div>
                </div>
              </div>
              <div className="h-40 md:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} />
                    <Tooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.08)', padding: '10px 14px', fontSize: '12px' }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={48}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className={`${user?.role === 'upload_only' ? 'lg:col-span-3' : ''} card-premium p-4 md:p-8`}>
            <div className="flex items-center justify-between mb-3 md:mb-8">
              <h3 className="text-sm md:text-lg font-bold text-slate-900 tracking-tight font-display">Transaksi Terkini</h3>
              <button
                onClick={() => setView('records')}
                className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider md:hidden"
              >
                Lihat Semua
              </button>
            </div>
            <div className="space-y-1 md:space-y-4">
              {filteredRecords.slice(0, 5).map((record, i) => {
                const Icon = getCategoryIcon(record.category);
                return (
                  <div key={i} className="flex items-center justify-between group cursor-pointer px-2 py-2 -mx-2 hover:bg-slate-50 rounded-xl transition-all">
                    <div className="flex items-center gap-2.5 md:gap-4 min-w-0">
                      <div className={`w-8 h-8 md:w-11 md:h-11 shrink-0 rounded-lg md:rounded-2xl flex items-center justify-center border transition-transform group-hover:scale-105 ${record.type === 'income' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                        <Icon size={14} strokeWidth={2} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm font-bold text-slate-900 truncate max-w-[100px] md:max-w-[140px] leading-tight">{record.category}</p>
                        <p className="text-[9px] md:text-[10px] font-medium text-slate-400 mt-0.5">{format(parseISO(record.date), 'dd MMM')}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className={`text-xs md:text-sm font-bold font-display ${record.type === 'income' ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {record.type === 'income' ? '+' : '-'}RM {(record.amount || 0).toLocaleString()}
                      </p>
                      <p className={`text-[9px] font-semibold ${record.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {record.type === 'income' ? 'Masuk' : 'Keluar'}
                      </p>
                    </div>
                  </div>
                );
              })}
              {filteredRecords.length === 0 && (
                <div className="text-center py-6 text-slate-400">
                  <FileText size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-medium">Tiada transaksi</p>
                </div>
              )}
            </div>
            <button
              onClick={() => setView('records')}
              className="w-full mt-4 md:mt-10 py-2.5 bg-slate-50 text-slate-500 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-slate-100 transition-all border border-slate-200 hidden md:block"
            >
              Lihat Semua
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper for PDF Generation
const generatePDF = async (elementId: string, fileName: string, setDownloading?: (val: any) => void, downloadId?: any) => {
  const element = document.getElementById(elementId);
  if (!element) return;
  if (setDownloading) setDownloading(downloadId !== undefined ? downloadId : true);

  try {
    const originalDisplay = element.style.display;
    element.style.display = 'block';
    
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 800,
      onclone: (clonedDoc) => {
        const styleTags = clonedDoc.getElementsByTagName('style');
        for (let i = 0; i < styleTags.length; i++) {
          const style = styleTags[i];
          try {
            if (style.innerHTML.match(/(oklch|oklab|color-mix|hwb|lab|lch|light-dark)/i)) {
              style.innerHTML = style.innerHTML.replace(/(oklch|oklab|color-mix|hwb|lab|lch|light-dark)\s*\([^)]+\)/gi, 'rgb(0,0,0)');
            }
          } catch (e) { /* ignore */ }
        }
        const allElements = clonedDoc.getElementsByTagName('*');
        for (let i = 0; i < allElements.length; i++) {
          const el = allElements[i] as HTMLElement;
          try {
            if (el.style && el.style.cssText && el.style.cssText.match(/(oklch|oklab|color-mix|hwb|lab|lch|light-dark)/i)) {
              el.style.cssText = el.style.cssText.replace(/(oklch|oklab|color-mix|hwb|lab|lch|light-dark)\s*\([^)]+\)/gi, 'rgb(0,0,0)');
            }
          } catch (e) { /* ignore */ }
        }
      }
    });
    
    element.style.display = originalDisplay;

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pdfWidth - (2 * margin);
    const contentHeight = pdfHeight - (2 * margin);
    
    const ratio = contentWidth / canvas.width;
    const canvasPageHeight = contentHeight / ratio;
    
    let currentY = 0;
    let pageNum = 1;
    const totalPages = Math.ceil(canvas.height / canvasPageHeight);
    
    while (currentY < canvas.height) {
      if (pageNum > 1) pdf.addPage();
      
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = Math.min(canvasPageHeight, canvas.height - currentY);
      
      const ctx = pageCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(canvas, 0, currentY, canvas.width, pageCanvas.height, 0, 0, canvas.width, pageCanvas.height);
      }
      
      const pageData = pageCanvas.toDataURL('image/png');
      pdf.addImage(pageData, 'PNG', margin, margin, contentWidth, (pageCanvas.height * ratio));
      
      // Add Page Number & Branding
      pdf.setFontSize(7);
      pdf.setTextColor(150);
      pdf.text(`Halaman ${pageNum} daripada ${totalPages} | Dijana oleh MonitAcc AI`, pdfWidth / 2, pdfHeight - 5, { align: 'center' });
      
      currentY += canvasPageHeight;
      pageNum++;
    }

    pdf.save(fileName);
  } catch (err) {
    console.error('PDF Generation Error:', err);
  } finally {
    if (setDownloading) setDownloading(null);
  }
};

const StatCard = ({ label, value, icon: Icon, color }: { label: string, value: number | string, icon: any, color: string }) => {
  const colors: { [key: string]: string } = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-100',
  };
  
  const isEmerald = color === 'emerald';
  
  return (
    <div className="card-premium p-3 md:p-6 flex flex-col items-start group">
      <div className={`w-9 h-9 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center mb-3 md:mb-6 shadow-sm border transition-all duration-300 group-hover:scale-105 ${isEmerald ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white border-emerald-400' : colors[color]}`}>
        <Icon size={18} strokeWidth={2} className="md:hidden" />
        <Icon size={24} strokeWidth={2} className="hidden md:block" />
      </div>
      <p className="text-[9px] md:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 md:mb-1">{label}</p>
      <p className="text-base md:text-2xl font-bold text-slate-900 tracking-tight font-display pr-1 md:pr-2 leading-tight">
        {label === 'Bil. Rekod' ? value : `RM ${(Number(value) || 0).toLocaleString()}`}
      </p>
    </div>
  );
};

const CameraView = ({ onCapture, onCancel }: { onCapture: (base64: string) => void, onCancel: () => void }) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let currentStream: MediaStream | null = null;
    
    async function startCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Pelayar anda tidak menyokong akses kamera.");
        }

        // Check if any video devices exist
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasVideo = devices.some(device => device.kind === 'videoinput');
        if (!hasVideo) {
          const err = new Error("Tiada kamera ditemui pada peranti anda.");
          err.name = 'NotFoundError';
          throw err;
        }

        let s: MediaStream;
        try {
          // Try environment camera first (back camera) with 'ideal' to be less strict
          s = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: { ideal: 'environment' },
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            }, 
            audio: false 
          });
        } catch (e) {
          // Fallback to any available camera with minimal constraints
          console.warn("Back camera not found or constraints failed, falling back to default camera.", e);
          try {
            s = await navigator.mediaDevices.getUserMedia({ 
              video: true, 
              audio: false 
            });
          } catch (fallbackErr: any) {
            console.error("All camera access attempts failed:", fallbackErr);
            throw fallbackErr;
          }
        }
        
        currentStream = s;
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      } catch (err: any) {
        console.error("Error accessing camera:", err);
        let message = "Tidak dapat mengakses kamera.";
        
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          message = "Kebenaran kamera ditolak. Sila benarkan akses kamera dalam tetapan pelayar anda.";
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          message = "Tiada kamera ditemui pada peranti anda. Sila gunakan fungsi muat naik fail.";
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          message = "Kamera sedang digunakan oleh aplikasi lain.";
        } else if (err.name === 'OverconstrainedError') {
          message = "Kamera anda tidak menyokong tetapan yang diperlukan.";
        } else {
          message = "Ralat kamera: " + (err.message || err.name || "Ralat tidak diketahui");
        }
        
        setError(message);
      }
    }
    
    startCamera();
    
    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg');
        onCapture(base64);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-[100] flex flex-col">
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {error ? (
          <div className="p-8 text-center max-w-xs">
            <div className="w-20 h-20 bg-rose-500/20 text-rose-400 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Camera size={40} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Kamera Tidak Ditemui</h3>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">{error}</p>
            <button 
              onClick={onCancel}
              className="w-full py-4 bg-white text-slate-900 rounded-2xl font-bold text-sm hover:bg-slate-100 transition-all"
            >
              Kembali
            </button>
          </div>
        ) : (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            
            <div className="absolute inset-0 border-[40px] border-slate-900/60 pointer-events-none">
              <div className="w-full h-full border-2 border-white/20 rounded-3xl relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 -mt-1 -ml-1 rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500 -mt-1 -mr-1 rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500 -mb-1 -ml-1 rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 -mb-1 -mr-1 rounded-br-xl" />
              </div>
            </div>

            <div className="absolute top-8 left-0 right-0 text-center">
              <p className="text-white text-xs font-bold uppercase tracking-widest drop-shadow-lg">
                Imbas Resit Anda
              </p>
            </div>
          </>
        )}
      </div>

      {!error && (
        <div className="h-40 bg-slate-900 flex items-center justify-around px-8">
          <button 
            onClick={onCancel}
            className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
          >
            <X size={24} />
          </button>
          
          <button 
            onClick={capture}
            className="w-20 h-20 rounded-full bg-white p-1.5 shadow-2xl active:scale-95 transition-all"
          >
            <div className="w-full h-full rounded-full border-4 border-slate-100 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-emerald-600" />
            </div>
          </button>

          <div className="w-14 h-14" />
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

const ScanView = ({ onSave, initialImage, onCancel, allCategories, onAddNewCategory, records, sales, user, onUpgrade }: { onSave: (data: any) => void, initialImage?: string | null, onCancel: () => void, allCategories: string[], onAddNewCategory: (name: string, type: string) => void, records: TransactionRecord[], sales: Sale[], user: UserType | null, onUpgrade: () => void }) => {
  const [image, setImage] = useState<string | null>(initialImage || null);
  const [mimeType, setMimeType] = useState<string>("image/jpeg");
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState<{ type: 'receipt' | 'pdf'; used: number; limit: number } | null>(null);

  const planKey = user?.plan || 'free';
  const receiptLimit = PLAN_SCAN_LIMITS[planKey] ?? 5;
  const pdfLimit = PLAN_PDF_LIMITS[planKey] ?? 1;

  const checkLimitAndAnalyze = async (base64: string, type: string) => {
    const isPdf = type === 'application/pdf';
    const scanType = isPdf ? 'pdf' : 'receipt';
    if (user?.id && isFinite(isPdf ? pdfLimit : receiptLimit)) {
      const usage = await apiGetScanUsageThisMonth(user.id);
      const used = isPdf ? usage.pdf : usage.receipt;
      const limit = isPdf ? pdfLimit : receiptLimit;
      if (used >= limit) {
        setShowUpgradeModal({ type: scanType, used, limit });
        return;
      }
      await apiLogScanUsage(user.id, scanType);
    }
    analyze(base64, type);
  };

  useEffect(() => {
    if (initialImage) {
      if (initialImage.startsWith('data:')) {
        const match = initialImage.match(/^data:([^;]+);/);
        if (match) {
          setMimeType(match[1]);
          checkLimitAndAnalyze(initialImage, match[1]);
          return;
        }
      }
      checkLimitAndAnalyze(initialImage, 'image/jpeg');
    }
  }, [initialImage]);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImage(base64);
        setMimeType(file.type);
        checkLimitAndAnalyze(base64, file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyze = async (base64: string, type?: string) => {
    setAnalyzing(true);
    let finalMimeType = type;
    if (!finalMimeType && base64.startsWith('data:')) {
      const match = base64.match(/^data:([^;]+);/);
      if (match) finalMimeType = match[1];
    }
    const data = await analyzeDocument(base64, finalMimeType || "image/jpeg");
    if (data && Array.isArray(data)) {
      // Deduplicate within the extracted data - only if EXACTLY the same
      const uniqueData = data.filter((item, index, self) =>
        index === self.findIndex((t) => (
          t.date === item.date &&
          Math.abs(t.amount - item.amount) < 0.01 &&
          t.description.toLowerCase().trim() === item.description.toLowerCase().trim() &&
          t.type === item.type
        ))
      );

      // Sort results by date ASC
      const sortedData = [...uniqueData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setResults(sortedData);
    }
    setAnalyzing(false);
  };

  const updateResult = (index: number, field: string, value: any) => {
    const newResults = [...results];
    newResults[index] = { ...newResults[index], [field]: value };
    setResults(newResults);
  };

  const removeResult = (index: number) => {
    setResults(results.filter((_, i) => i !== index));
  };

  const checkExistingDuplicate = (item: any) => {
    const type = item.type;
    const amount = item.amount;
    const date = item.date;
    const desc = item.description.toLowerCase().trim();

    // Check against records
    const existingRecord = records.find(r => 
      r.type === type && 
      Math.abs(r.amount - amount) < 0.01 && 
      r.date === date &&
      (r.description.toLowerCase().trim() === desc || (desc.length > 10 && r.description.toLowerCase().includes(desc)))
    );
    if (existingRecord) return { type: 'record', item: existingRecord };

    // Check against sales (income only)
    if (type === 'income') {
      const existingSale = sales.find(s => 
        Math.abs(s.total - amount) < 0.01 && 
        s.date === date &&
        (s.product_name.toLowerCase().includes(desc) || desc.includes(s.product_name.toLowerCase()))
      );
      if (existingSale) return { type: 'sale', item: existingSale };
    }

    return null;
  };

  return (
    <div className="p-4 md:p-6 pb-24 md:pl-80 md:pt-12 max-w-4xl mx-auto">
      <header className="mb-12 flex items-center gap-6">
        <button onClick={onCancel} className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm">
          <ArrowLeft size={24} />
        </button>
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter font-display">Imbas Dokumen</h2>
          </div>
          <p className="text-slate-500 font-medium text-xs md:text-base">AI akan mengesan jenis dokumen secara automatik (Resit akan dikategorikan sebagai Duit Keluar).</p>
        </div>
      </header>

      {!image ? (
        <div className="aspect-[3/4] bg-white rounded-[48px] border-4 border-dashed border-slate-100 flex flex-col items-center justify-center p-12 text-center shadow-inner relative overflow-hidden group">
          <div className="absolute inset-0 bg-emerald-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center shadow-xl shadow-emerald-100 mb-8 relative z-10">
            <Camera size={40} strokeWidth={1.5} />
          </div>
          <h3 className="text-2xl font-black mb-3 tracking-tight font-display relative z-10">Sedia untuk mengimbas?</h3>
          <p className="text-slate-500 font-bold mb-10 relative z-10">Pilih fail atau ambil gambar dokumen anda.</p>
          <div className="flex flex-col gap-4 w-full max-w-xs relative z-10">
            <button 
              onClick={() => setShowCamera(true)}
              className="btn-primary py-5"
            >
              <Camera size={20} className="inline-block mr-2" /> Tangkap Gambar
            </button>
            <label className="px-8 py-5 bg-white border-2 border-slate-100 text-slate-700 rounded-3xl font-black text-xs uppercase tracking-widest cursor-pointer hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm">
              <FileText size={20} /> Pilih Fail (Imej/PDF)
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleCapture} />
            </label>
          </div>

          {showCamera && (
            <CameraView
              onCapture={(base64) => {
                setImage(base64);
                setShowCamera(false);
                checkLimitAndAnalyze(base64, 'image/jpeg');
              }}
              onCancel={() => setShowCamera(false)}
            />
          )}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="relative rounded-[40px] overflow-hidden border border-slate-200 shadow-sm max-h-[400px] bg-slate-50 flex items-center justify-center">
            {mimeType === 'application/pdf' ? (
              <div className="py-20 flex flex-col items-center gap-4">
                <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center shadow-sm">
                  <FileText size={40} />
                </div>
                <p className="font-bold text-slate-600">Dokumen PDF Dimuat Naik</p>
              </div>
            ) : (
              <>
                <img src={image} alt="Scanned" className="w-full h-auto object-contain" />
                {!analyzing && (
                  <button
                    type="button"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = image;
                      link.download = `imbasan-${new Date().getTime()}.png`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="absolute top-6 right-6 w-12 h-12 bg-white/90 backdrop-blur-md text-emerald-600 rounded-2xl flex items-center justify-center shadow-xl hover:bg-white transition-all group"
                    title="Muat Turun Gambar"
                  >
                    <Download size={24} className="group-hover:scale-110 transition-transform" />
                  </button>
                )}
              </>
            )}
            {analyzing && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="font-bold">Menganalisa Dokumen...</p>
              </div>
            )}
          </div>

          {results.length > 0 ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900 font-display">
                  {results.length > 1 ? `${results.length} Transaksi Dikesan` : 'Transaksi Dikesan'}
                </h3>
                <button 
                  onClick={() => {
                    setResults([...results, {
                      type: 'expense',
                      docType: 'Manual',
                      category: 'OTHER',
                      amount: 0,
                      date: new Date().toISOString().split('T')[0],
                      description: 'Rekod Manual',
                      payment_method: 'bank'
                    }]);
                  }}
                  className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-100 transition-all"
                >
                  <Plus size={14} className="inline-block mr-1" /> Tambah Rekod
                </button>
              </div>

              <div className="space-y-4">
                {results.map((result, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.05 }}
                    className="card-premium p-6 bg-white border border-slate-200 relative group"
                  >
                    {checkExistingDuplicate(result) && (
                      <div className="absolute -top-3 left-6 z-10 px-3 py-1 bg-amber-500 text-white text-[10px] font-bold rounded-full shadow-lg flex items-center gap-1.5 animate-bounce">
                        <AlertTriangle size={12} />
                        Rekod Bertindih Dikesan
                      </div>
                    )}
                    <div className="flex flex-col gap-8">
                      {/* Top Section: Jenis Transaksi & Delete Button */}
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div className="w-full sm:max-w-xs">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Jenis Transaksi</p>
                          <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 hover:border-emerald-500/30 transition-all shadow-sm group/jenis">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-md transition-transform group-hover/jenis:scale-105 ${result.type === 'income' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                              {React.createElement(getCategoryIcon(result.category), { size: 24, strokeWidth: 2.5 })}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="relative">
                                <select 
                                  value={result.type}
                                  onChange={(e) => updateResult(idx, 'type', e.target.value)}
                                  className="w-full bg-transparent font-bold text-slate-900 text-xs outline-none cursor-pointer appearance-none pr-6"
                                >
                                  <option value="income">Duit Masuk</option>
                                  <option value="expense">Duit Keluar</option>
                                </select>
                                <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                              </div>
                            </div>
                          </div>
                        </div>

                        <button 
                          onClick={() => removeResult(idx)}
                          className="p-2.5 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl transition-all shadow-sm border border-rose-100 self-end sm:self-start"
                          title="Buang Rekod"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      {/* Middle Section: Main Fields Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-8 gap-y-6 w-full">
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kategori</p>
                          <SearchableSelect 
                            value={result.category}
                            onChange={(val) => updateResult(idx, 'category', val)}
                            options={allCategories.filter(cat => {
                              if (result.type === 'income') {
                                return INCOME_CATEGORIES.includes(cat) || ASSET_LIABILITY_CATEGORIES.includes(cat) || !ALL_CATEGORIES.includes(cat);
                              } else {
                                return EXPENSE_CATEGORIES.includes(cat) || COGS_CATEGORIES.includes(cat) || ASSET_LIABILITY_CATEGORIES.includes(cat) || !ALL_CATEGORIES.includes(cat);
                              }
                            })}
                            onAddNew={(val) => onAddNewCategory(val, result.type)}
                            className="w-full"
                          />
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jumlah (RM)</p>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">RM</span>
                            <input 
                              type="number"
                              step="0.01"
                              value={result.amount}
                              onChange={(e) => updateResult(idx, 'amount', parseFloat(e.target.value))}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-2.5 font-bold text-slate-900 text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tarikh</p>
                          <div className="relative">
                            <input 
                              type="date"
                              value={result.date}
                              onChange={(e) => updateResult(idx, 'date', e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-900 text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm appearance-none"
                            />
                            <Calendar size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kaedah Bayaran</p>
                          <div className="relative">
                            <select 
                              value={result.payment_method || 'bank'}
                              onChange={(e) => updateResult(idx, 'payment_method', e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-900 text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm appearance-none pr-10"
                            >
                              <option value="bank">Bank / Online</option>
                              <option value="cash">Tunai (Cash)</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          </div>
                        </div>
                      </div>

                      {/* Bottom Section: Penerangan */}
                      <div className="w-full">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Penerangan Transaksi</p>
                        <div className="relative">
                          <input 
                            type="text"
                            value={result.description}
                            onChange={(e) => updateResult(idx, 'description', e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-3.5 font-bold text-slate-900 text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                            placeholder="Masukkan butiran transaksi..."
                          />
                          <FileText size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="flex gap-4 pt-6">
                <button 
                  onClick={() => {
                    setImage(null);
                    setResults([]);
                  }}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Batal
                </button>
                <button
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      let storedImageUrl = image || '';
                      if (image && user?.id) {
                        const isPdf = mimeType === 'application/pdf';
                        try {
                          storedImageUrl = await apiUploadReceiptFile(user.id, image, isPdf ? 'pdf' : 'receipt');
                        } catch (uploadErr) {
                          console.error('Upload failed, using base64 fallback:', uploadErr);
                          storedImageUrl = image;
                        }
                      }
                      const recordsToSave = results.map(r => ({ ...r, image_url: storedImageUrl }));
                      await onSave(recordsToSave);
                    } catch (error) {
                      console.error("Error saving records:", error);
                      alert("Gagal menyimpan rekod. Sila cuba lagi.");
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className={`btn-primary flex-1 py-4 flex items-center justify-center gap-2 ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      Simpan {results.length} Rekod Pintar
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : !analyzing && (
            <div className="card-premium p-6 md:p-12 text-center bg-white border border-slate-200">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-50 text-slate-300 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <SearchX size={32} className="md:hidden" />
                <SearchX size={40} className="hidden md:block" />
              </div>
              <h3 className="text-lg md:text-xl font-black text-slate-900 mb-2 font-display">Tiada Data Dikesan</h3>
              <p className="text-slate-500 text-xs md:text-sm mb-8 max-w-xs mx-auto font-medium">
                AI tidak dapat mengekstrak maklumat dari imej ini. Anda boleh cuba lagi atau masukkan data secara manual.
              </p>
              <div className="flex flex-col gap-3 max-w-xs mx-auto">
                <button 
                  onClick={() => {
                    setResults([{
                      type: 'expense',
                      docType: 'Manual',
                      category: 'OTHER',
                      amount: 0,
                      date: new Date().toISOString().split('T')[0],
                      description: 'Rekod Manual'
                    }]);
                  }}
                  className="btn-primary py-4"
                >
                  <Plus size={18} className="inline-block mr-2" /> Masukkan Secara Manual
                </button>
                <button 
                  onClick={() => {
                    setImage(null);
                    setResults([]);
                  }}
                  className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cuba Imej Lain
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showUpgradeModal && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="bg-gradient-to-br from-slate-900 to-slate-700 p-8 text-white text-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <Zap size={200} className="absolute -top-10 -right-10 rotate-12" />
              </div>
              <div className="relative z-10">
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Zap size={28} className="text-amber-400" />
                </div>
                <h3 className="text-xl font-black tracking-tight font-display mb-2">Had {showUpgradeModal.type === 'pdf' ? 'PDF' : 'Imbasan'} Dicapai</h3>
                <p className="text-white/60 text-sm font-medium">
                  Anda telah menggunakan {showUpgradeModal.used}/{showUpgradeModal.limit} {showUpgradeModal.type === 'pdf' ? 'imbasan PDF' : 'imbasan resit'} bulan ini.
                </p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-2xl p-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Naik Taraf Untuk Lebih Banyak</p>
                <div className="space-y-2">
                  {[
                    { plan: 'Starter', receipt: '100 imbasan', pdf: '3× PDF', price: 'RM 50/bln' },
                    { plan: 'Growth', receipt: '250 imbasan', pdf: '9× PDF', price: 'RM 100/bln' },
                    { plan: 'Ultimate', receipt: 'Unlimited', pdf: 'Unlimited PDF', price: 'RM 150/bln' },
                  ].map(p => (
                    <div key={p.plan} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <div>
                        <span className="text-sm font-bold text-slate-800">{p.plan}</span>
                        <span className="text-xs text-slate-400 ml-2">{showUpgradeModal.type === 'pdf' ? p.pdf : p.receipt}</span>
                      </div>
                      <span className="text-xs font-bold text-emerald-600">{p.price}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => { setShowUpgradeModal(null); onUpgrade(); }}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-black text-sm rounded-2xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
              >
                <TrendingUp size={16} /> Naik Taraf Sekarang
              </button>
              <button
                onClick={() => { setShowUpgradeModal(null); onCancel(); }}
                className="w-full py-3 text-slate-400 text-sm font-bold hover:text-slate-600 transition-colors"
              >
                Kembali ke Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ManualRecordModal = ({ type, onClose, onSave, initialData, onAddNewCategory, categoryMappings }: { type: 'income' | 'expense', onClose: () => void, onSave: (data: any) => void, initialData?: any, onAddNewCategory: (name: string, type: string) => void, categoryMappings: Record<string, string> }) => {
  const [formData, setFormData] = useState({
    type: type,
    docType: type === 'income' ? 'Duit Masuk Manual' : 'Duit Keluar Manual',
    docNumber: '',
    category: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    description: '',
    payment_method: 'bank',
    image_url: '',
    ...initialData
  });

  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, image_url: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category) {
      alert('Sila pilih kategori');
      return;
    }
    setIsSaving(true);
    try {
      await onSave(formData);
    } catch (error) {
      console.error("Error saving record:", error);
      alert("Gagal menyimpan rekod. Sila cuba lagi.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col"
      >
        <div className="p-8 overflow-y-auto custom-scrollbar">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${formData.type === 'income' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                {formData.type === 'income' ? <TrendingUp size={24} strokeWidth={2} /> : <TrendingDown size={24} strokeWidth={2} />}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight font-display">
                  {type === 'income' ? 'Tambah Duit Masuk' : 'Tambah Duit Keluar'}
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                  Rekod Manual
                </p>
              </div>
            </div>
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Kategori</label>
              <SearchableSelect 
                value={formData.category}
                onChange={(val) => setFormData({...formData, category: val})}
                options={Array.from(new Set([
                  ...(formData.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES),
                  ...ASSET_LIABILITY_CATEGORIES,
                  ...Object.keys(categoryMappings).filter(cat => {
                    const type = categoryMappings[cat];
                    if (formData.type === 'income') return type === 'SALES' || type === 'OTHER_INCOME';
                    return type === 'EXPENSE' || type === 'COGS' || type === 'TAXATION' || type === 'ASSET_LIABILITY';
                  })
                ])).sort()}
                onAddNew={(val) => onAddNewCategory(val, formData.type)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Jumlah (RM)</label>
                <input 
                  required
                  type="number"
                  step="0.01"
                  value={formData.amount || ''}
                  onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value)})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg font-bold text-lg font-display outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Tarikh</label>
                <input 
                  required
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Kaedah Bayaran</label>
                <div className="relative">
                  <select 
                    value={formData.payment_method}
                    onChange={(e) => setFormData({...formData, payment_method: e.target.value as any})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none pr-10"
                  >
                    <option value="bank">Bank / Online</option>
                    <option value="cash">Tunai (Cash)</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">No. Dokumen (Optional)</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <Hash size={14} />
                </div>
                <input 
                  type="text"
                  value={formData.docNumber}
                  onChange={(e) => setFormData({...formData, docNumber: e.target.value})}
                  placeholder="Contoh: REF-001"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Penerangan</p>
              <textarea 
                required
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Masukkan butiran transaksi..."
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Lampiran Dokumen (Optional)</p>
              <div className="flex flex-col gap-3">
                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*,application/pdf"
                  className="hidden"
                />
                {!formData.image_url ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-emerald-500 hover:text-emerald-500 transition-all bg-slate-50/50"
                  >
                    <Camera size={24} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Muat Naik Resit / Invois (Imej/PDF)</span>
                  </button>
                ) : (
                  <div className="relative group">
                    <div className="w-full h-40 rounded-2xl overflow-hidden border-2 border-slate-100 shadow-inner bg-slate-50 flex items-center justify-center">
                      {formData.image_url.startsWith('data:application/pdf') ? (
                        <div className="flex flex-col items-center gap-2 text-rose-500">
                          <FileText size={48} />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Dokumen PDF</span>
                        </div>
                      ) : (
                        <img src={formData.image_url} alt="Attachment" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="absolute inset-0 bg-slate-900/10 flex items-center justify-center gap-3 rounded-2xl">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2.5 bg-white text-emerald-600 rounded-xl shadow-xl hover:scale-110 active:scale-95 transition-all border border-slate-100"
                        title="Tukar Gambar"
                      >
                        <RefreshCw size={20} />
                      </button>
                      {formData.image_url && (
                        <button
                          type="button"
                          onClick={() => {
                            const isPdf = formData.image_url?.startsWith('data:application/pdf');
                            const link = document.createElement('a');
                            link.href = formData.image_url!;
                            link.download = `lampiran-baru.${isPdf ? 'pdf' : 'png'}`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          className="p-2.5 bg-white text-blue-600 rounded-xl shadow-xl hover:scale-110 active:scale-95 transition-all border border-slate-100"
                          title="Muat Turun"
                        >
                          <Download size={20} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, image_url: '' })}
                        className="p-2.5 bg-white text-rose-600 rounded-xl shadow-xl hover:scale-110 active:scale-95 transition-all border border-slate-100"
                        title="Padam Gambar"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-200 transition-all"
              >
                Batal
              </button>
              <button 
                type="submit"
                disabled={isSaving}
                className={`flex-1 py-3 text-sm font-bold text-white rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''} ${formData.type === 'income' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  'Simpan Rekod'
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

const EditRecordModal = ({ record, onClose, onSave, onAddNewCategory, categoryMappings }: { record: TransactionRecord, onClose: () => void, onSave: (data: any) => void, onAddNewCategory: (name: string, type: string) => void, categoryMappings: Record<string, string> }) => {
  const [formData, setFormData] = useState({
    type: record.type,
    docType: record.docType,
    docNumber: record.docNumber || '',
    category: record.category,
    amount: record.amount,
    date: record.date,
    description: record.description,
    image_url: record.image_url,
    payment_method: record.payment_method || 'bank'
  });

  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, image_url: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
    } catch (error) {
      console.error("Error updating record:", error);
      alert("Gagal mengemaskini rekod. Sila cuba lagi.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col"
      >
        <div className="p-8 overflow-y-auto custom-scrollbar">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${formData.type === 'income' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                {React.createElement(getCategoryIcon(formData.category), { size: 24, strokeWidth: 2 })}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight font-display">Butiran Rekod</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                  ACC: {CHART_OF_ACCOUNTS[formData.category] || 'N/A'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1 space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Jenis</label>
                <select 
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value as 'income' | 'expense'})}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                >
                  <option value="income">Masuk</option>
                  <option value="expense">Keluar</option>
                </select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Dokumen</label>
                <input 
                  type="text"
                  value={formData.docType}
                  onChange={(e) => setFormData({...formData, docType: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">No. Dokumen</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <Hash size={14} />
                </div>
                <input 
                  type="text"
                  value={formData.docNumber}
                  onChange={(e) => setFormData({...formData, docNumber: e.target.value})}
                  placeholder="INV-123"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Kategori</label>
              <SearchableSelect 
                value={formData.category}
                onChange={(val) => setFormData({...formData, category: val})}
                options={Array.from(new Set([
                  ...(formData.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES),
                  ...ASSET_LIABILITY_CATEGORIES,
                  ...Object.keys(categoryMappings).filter(cat => {
                    const type = categoryMappings[cat];
                    if (formData.type === 'income') return type === 'SALES' || type === 'OTHER_INCOME';
                    return type === 'EXPENSE' || type === 'COGS' || type === 'TAXATION' || type === 'ASSET_LIABILITY';
                  })
                ])).sort()}
                onAddNew={(val) => onAddNewCategory(val, formData.type)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Jumlah (RM)</label>
                <input 
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value)})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg font-bold text-lg font-display outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Tarikh</label>
                <input 
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Kaedah Bayaran</label>
                <div className="relative">
                  <select 
                    value={formData.payment_method}
                    onChange={(e) => setFormData({...formData, payment_method: e.target.value as any})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none pr-10"
                  >
                    <option value="bank">Bank / Online</option>
                    <option value="cash">Tunai (Cash)</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Penerangan</p>
              <textarea 
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[32px] font-medium text-sm outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Lampiran Dokumen</p>
              <div className="flex flex-col gap-3">
                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*,application/pdf"
                  className="hidden"
                />
                {!formData.image_url ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-emerald-500 hover:text-emerald-500 transition-all bg-slate-50/50"
                  >
                    <Camera size={24} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Muat Naik Resit / Invois (Imej/PDF)</span>
                  </button>
                ) : (
                  <div className="relative group">
                    <div className="w-full h-40 rounded-2xl overflow-hidden border-2 border-slate-100 shadow-inner bg-slate-50 flex items-center justify-center">
                      {formData.image_url.startsWith('data:application/pdf') ? (
                        <div className="flex flex-col items-center gap-2 text-rose-500">
                          <FileText size={48} />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Dokumen PDF</span>
                        </div>
                      ) : (
                        <img src={formData.image_url} alt="Attachment" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="absolute inset-0 bg-slate-900/10 flex items-center justify-center gap-3 rounded-2xl">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2.5 bg-white text-emerald-600 rounded-xl shadow-xl hover:scale-110 active:scale-95 transition-all border border-slate-100"
                        title="Tukar Gambar"
                      >
                        <RefreshCw size={20} />
                      </button>
                      {formData.image_url && (
                        <button
                          type="button"
                          onClick={() => {
                            const isPdf = formData.image_url?.startsWith('data:application/pdf');
                            const link = document.createElement('a');
                            link.href = formData.image_url!;
                            link.download = `lampiran-${record.id || 'rekod'}.${isPdf ? 'pdf' : 'png'}`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          className="p-2.5 bg-white text-blue-600 rounded-xl shadow-xl hover:scale-110 active:scale-95 transition-all border border-slate-100"
                          title="Muat Turun"
                        >
                          <Download size={20} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, image_url: '' })}
                        className="p-2.5 bg-white text-rose-600 rounded-xl shadow-xl hover:scale-110 active:scale-95 transition-all border border-slate-100"
                        title="Padam Gambar"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-200 transition-all"
              >
                Batal
              </button>
              <button 
                type="submit"
                disabled={isSaving}
                className={`flex-1 btn-primary py-3 text-sm flex items-center justify-center gap-2 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  'Simpan Perubahan'
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

const InvoiceTemplate = ({ sale, user }: { sale: any, user: UserType | null }) => {
  return (
    <div id={`invoice-${sale.id}`} className="bg-white p-12 w-[794px] min-h-[1123px] font-sans text-black hidden fixed left-[-9999px] border border-black">
      {/* Formal Header */}
      <div className="flex justify-between items-start mb-8 border-b border-black pb-4">
        <div className="space-y-2">
          <div>
            <h1 className="text-2xl font-bold text-black uppercase">INVOIS CUKAI / TAX INVOICE</h1>
          </div>
          <div className="pt-1">
            <h2 className="text-lg font-bold text-black uppercase">{user?.name || 'Perniagaan Saya'}</h2>
            <div className="text-[10px] text-black">
              <p>No. Pendaftaran SSM: 202403123456 (AS0123456-X)</p>
              <p>No. Cukai (TIN): IG1234567890</p>
            </div>
          </div>
        </div>
        <div className="text-right text-[10px] text-black">
          <p className="font-bold uppercase">Alamat Berdaftar:</p>
          <p>Aras 15, Menara MonitAcc</p>
          <p>Jalan Ampang, 50450 Kuala Lumpur</p>
          <p>Wilayah Persekutuan, Malaysia</p>
          <div className="pt-2">
            <p className="font-bold uppercase">Hubungi:</p>
            <p>Tel: {user?.phone || '+603-8888 9999'}</p>
            <p>Emel: {user?.email}</p>
          </div>
        </div>
      </div>

      {/* Document Info Grid */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <p className="text-[10px] font-bold uppercase mb-2 border-b border-black pb-1">Bil Kepada / Bill To:</p>
          <div className="text-[11px] text-black">
            <p className="text-lg font-bold uppercase">{sale.customer_name || 'Pelanggan Am'}</p>
            <p>ID Pelanggan: CUST-{Math.floor(Math.random() * 10000)}</p>
            <p>Kuala Lumpur, Malaysia</p>
          </div>
        </div>
        <div>
          <table className="w-full text-[11px] border-collapse">
            <tbody>
              <tr>
                <td className="py-1 font-bold uppercase">No. Invois:</td>
                <td className="py-1 text-right font-bold">#{sale.docNumber || sale.id}</td>
              </tr>
              <tr>
                <td className="py-1 font-bold uppercase">Tarikh:</td>
                <td className="py-1 text-right">{format(parseISO(sale.date), 'dd/MM/yyyy')}</td>
              </tr>
              <tr>
                <td className="py-1 font-bold uppercase">Terma:</td>
                <td className="py-1 text-right">TUNAI / COD</td>
              </tr>
              <tr>
                <td className="py-1 font-bold uppercase">Mata Wang:</td>
                <td className="py-1 text-right">MYR</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-8">
        <table className="w-full border-collapse border border-black text-[11px]">
          <thead>
            <tr className="bg-gray-50 border-b border-black">
              <th className="text-left py-2 px-2 font-bold uppercase border-r border-black">Penerangan / Description</th>
              <th className="text-center py-2 px-2 font-bold uppercase w-20 border-r border-black">Kuantiti</th>
              <th className="text-right py-2 px-2 font-bold uppercase w-28 border-r border-black">Harga Unit (RM)</th>
              <th className="text-right py-2 pl-2 pr-4 font-bold uppercase w-28">Jumlah (RM)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-black">
              <td className="py-4 px-2 border-r border-black">
                <p className="font-bold">{sale.product_name || 'Jualan Am'}</p>
                <p className="text-[9px] text-gray-600 uppercase">Kategori: {sale.category}</p>
              </td>
              <td className="py-4 px-2 text-center border-r border-black">{sale.quantity || 1}</td>
              <td className="py-4 px-2 text-right border-r border-black">{((sale.price || sale.total) || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td className="py-4 pl-2 pr-4 text-right font-bold">{(sale.total || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            </tr>
            {/* Filler rows */}
            <tr className="h-40"><td className="border-r border-black"/><td className="border-r border-black"/><td className="border-r border-black"/><td/></tr>
          </tbody>
        </table>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <div className="border border-black p-3 text-[10px]">
            <p className="font-bold uppercase mb-2 border-b border-black pb-1">Maklumat Pembayaran</p>
            <p>Bank: MAYBANK BERHAD</p>
            <p>No. Akaun: 5641 2233 4455</p>
            <p>Nama: {user?.name || 'Perniagaan Saya'}</p>
          </div>
        </div>
        <div>
          <table className="w-full text-[11px] border-collapse">
            <tbody>
              <tr>
                <td className="py-1 font-bold uppercase">Subjumlah:</td>
                <td className="py-1 text-right pr-4">RM {(sale.total || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
              <tr>
                <td className="py-1 font-bold uppercase">Cukai (0%):</td>
                <td className="py-1 text-right pr-4">RM 0.00</td>
              </tr>
              <tr className="border-t border-black">
                <td className="py-2 font-bold uppercase">Jumlah Besar:</td>
                <td className="py-2 text-right font-bold text-base pr-4">RM {(sale.total || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-8 border-t border-black flex justify-between items-end text-[9px]">
        <div>
          <p>Dokumen ini dijana secara komputer.</p>
          <p>ID: {sale.id}-{Date.now().toString().slice(-4)}</p>
        </div>
        <div className="text-center">
          <div className="w-32 border-b border-black mb-1"></div>
          <p className="font-bold uppercase">Disediakan Oleh</p>
        </div>
      </div>
    </div>
  );
};

const SalesView = ({ sales, onAdd, onDelete, stats, user, triggerAddSale = 0, categoryMappings, onAddNewCategory }: { sales: any[], onAdd: (data: any) => void, onDelete: (id: number) => void, stats: any, user: UserType | null, triggerAddSale?: number, categoryMappings: Record<string, string>, onAddNewCategory: (name: string) => void }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);

  const availableSalesCategories = Array.from(new Set([
    ...INCOME_CATEGORIES,
    ...Object.keys(categoryMappings).filter(cat => categoryMappings[cat] === 'SALES')
  ])).sort();

  useEffect(() => {
    if (triggerAddSale > 0) {
      setShowAdd(true);
    }
  }, [triggerAddSale]);
  const [timeFilter, setTimeFilter] = useState<'all' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [startDate, setStartDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [formData, setFormData] = useState({
    total: 0,
    date: new Date().toISOString().split('T')[0],
    docNumber: '',
    category: 'SALES',
    customer_name: '',
    product_name: 'Jualan Am',
    payment_method: 'bank'
  });

  const downloadInvoice = async (sale: any) => {
    const fileName = `Invois-${sale.docNumber || sale.id}.pdf`;
    await generatePDF(`invoice-${sale.id}`, fileName, setDownloading, sale.id);
  };

  const now = new Date();

  const filteredSales = sales.filter(sale => {
    const saleDate = parseISO(sale.date);
    if (timeFilter === 'daily') return isSameDay(saleDate, now);
    if (timeFilter === 'weekly') return isSameWeek(saleDate, now);
    if (timeFilter === 'monthly') {
      return saleDate.getMonth() === selectedMonth && saleDate.getFullYear() === selectedYear;
    }
    if (timeFilter === 'yearly') {
      return saleDate.getFullYear() === selectedYear;
    }
    if (timeFilter === 'custom') {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      const d = new Date(saleDate.getFullYear(), saleDate.getMonth(), saleDate.getDate());
      const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      return d >= s && d <= e;
    }
    return true;
  });

  const filteredTotal = filteredSales.reduce((sum, s) => sum + s.total, 0);
  const filteredCount = filteredSales.length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({ 
      ...formData, 
      quantity: 1, 
      price: formData.total 
    });
    setShowAdd(false);
    setFormData({
      total: 0,
      date: new Date().toISOString().split('T')[0],
      docNumber: '',
      category: 'SALES',
      customer_name: '',
      product_name: 'Jualan Am',
      payment_method: 'bank'
    });
  };

  const filterOptions = [
    { id: 'all', label: 'Semua', short: 'Semua' },
    { id: 'daily', label: 'Harian', short: 'Hari' },
    { id: 'weekly', label: 'Mingguan', short: 'Mggu' },
    { id: 'monthly', label: 'Bulanan', short: 'Bulan' },
    { id: 'yearly', label: 'Tahunan', short: 'Tahun' },
    { id: 'custom', label: 'Khas', short: 'Khas' },
  ];

  const months = [
    'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
    'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="pb-28 md:pl-64 md:pt-12 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="px-4 md:px-6 pt-5 md:pt-0 mb-4">
        <h2 className="text-[22px] font-bold text-slate-900 tracking-tight leading-tight">Rekod Jualan</h2>
        <p className="text-slate-400 text-[12px] font-medium mt-0.5">Pantau prestasi jualan anda secara langsung.</p>
      </div>

      {/* ── Filter tabs ── */}
      <div className="mb-4">
        <div className="px-4 md:px-6">
          <div className="flex items-center bg-slate-800 rounded-2xl p-1 gap-0.5 w-full">
            {filterOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setTimeFilter(opt.id as any)}
                className={`flex-1 py-1.5 rounded-xl text-[10px] md:text-[11px] font-semibold tracking-wide transition-all whitespace-nowrap text-center ${
                  timeFilter === opt.id
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="md:hidden">{opt.short}</span>
                <span className="hidden md:inline">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Secondary selectors */}
        {(timeFilter === 'monthly' || timeFilter === 'yearly' || timeFilter === 'custom') && (
          <div className="flex gap-2 items-center flex-wrap px-4 md:px-6 mt-2.5">
            {timeFilter === 'monthly' && (
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
              >
                {months.map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
            )}
            {(timeFilter === 'monthly' || timeFilter === 'yearly') && (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            )}
            {timeFilter === 'custom' && (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
                />
                <span className="text-slate-300 font-bold text-sm">—</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-4 md:px-6">

      {/* ── Summary card ── */}
      <div className="mb-4 bg-emerald-600 rounded-2xl px-5 py-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-emerald-100 text-[10px] font-semibold uppercase tracking-widest mb-1">Jumlah Jualan</p>
          <span className="text-3xl font-bold text-white tracking-tight font-display">RM {(filteredTotal || 0).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="bg-white/15 text-white rounded-xl px-3 py-1.5 text-[11px] font-bold backdrop-blur-sm">
          {filteredCount} Transaksi
        </div>
      </div>

      {/* ── Sales list ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Mobile Card View */}
        <div className="lg:hidden">
          {filteredSales.length > 0 && (
            <div className="px-4 pt-3 pb-1 border-b border-slate-50">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Senarai Transaksi</p>
            </div>
          )}
          <div className="divide-y divide-slate-50">
          {filteredSales.map((sale) => (
            <div key={sale.id} className="px-4 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <ShoppingCart size={16} strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-bold text-slate-800 truncate">{sale.category || 'SALES'}</span>
                      {!!sale.reconciled && <Check size={10} strokeWidth={3} className="text-emerald-500 shrink-0" />}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] text-slate-400 font-medium">{format(parseISO(sale.date), 'dd MMM yyyy')}</span>
                      {sale.docNumber && (
                        <span className="text-[10px] font-mono text-slate-400">#{sale.docNumber}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-[15px] font-bold text-emerald-600 font-display">RM {(sale.total || 0).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}</span>
                  <div className="flex items-center gap-0.5">
                    <InvoiceTemplate sale={sale} user={user} />
                    <button
                      onClick={() => downloadInvoice(sale)}
                      disabled={downloading === sale.id}
                      className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all disabled:opacity-50"
                    >
                      {downloading === sale.id ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
                    </button>
                    <button
                      onClick={() => onDelete(sale.id)}
                      className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          </div>
          {filteredSales.length === 0 && (
            <div className="py-16 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-200">
                  <ReceiptText size={26} />
                </div>
                <p className="text-slate-400 text-xs font-semibold">Tiada rekod jualan untuk tempoh ini.</p>
              </div>
            </div>
          )}
        </div>
        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-24">No. Kod</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-32">Tarikh</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-48">Kategori</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-32">Jualan (RM)</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right w-24">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-600 text-[10px] font-bold font-mono border border-slate-200 w-fit">
                        {CHART_OF_ACCOUNTS[sale.category] || CHART_OF_ACCOUNTS['SALES'] || `#${sale.id}`}
                      </span>
                      {sale.docNumber && (
                        <span className="text-[9px] font-mono font-bold text-slate-400 mt-1 flex items-center gap-1">
                          <Hash size={8} /> {sale.docNumber}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-700">
                    <div className="flex items-center gap-3">
                      {format(parseISO(sale.date), 'dd MMM yyyy')}
                      {!!sale.reconciled && (
                        <span className="text-emerald-500 ml-2" title="Telah Dipadankan dengan Bank">
                          <Check size={14} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                      {sale.category || 'SALES'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-bold text-emerald-600 text-lg font-display">RM {(sale.total || 0).toLocaleString()}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <InvoiceTemplate sale={sale} user={user} />
                      <button
                        onClick={() => downloadInvoice(sale)}
                        disabled={downloading === sale.id}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all disabled:opacity-50"
                        title="Muat Turun Invois"
                      >
                        {downloading === sale.id ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
                      </button>
                      <button
                        onClick={() => onDelete(sale.id)}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        title="Padam"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                        <ReceiptText size={32} />
                      </div>
                      <p className="text-slate-400 font-bold text-xs uppercase tracking-wider">Tiada rekod jualan untuk tempoh ini.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>{/* end px-4 wrapper */}

      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-slate-200"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-sm">
                      <ShoppingCart size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 tracking-tight font-display">Tambah Jualan</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Rekod Transaksi Baru</p>
                    </div>
                  </div>
                  <button onClick={() => setShowAdd(false)} className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Tarikh Jualan</label>
                    <input 
                      required
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">No. Invois / Resit</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                        <Hash size={14} />
                      </div>
                      <input 
                        type="text"
                        value={formData.docNumber || ''}
                        onChange={(e) => setFormData({...formData, docNumber: e.target.value})}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        placeholder="Contoh: INV-001"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Kategori Jualan</label>
                    <SearchableSelect 
                      value={formData.category}
                      onChange={(val) => setFormData({...formData, category: val})}
                      options={availableSalesCategories}
                      onAddNew={onAddNewCategory}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Nama Pelanggan (Optional)</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                        <UserCircle size={14} />
                      </div>
                      <input 
                        type="text"
                        value={formData.customer_name}
                        onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        placeholder="Contoh: Ali bin Abu"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Nama Produk / Perkhidmatan</label>
                    <input 
                      required
                      type="text"
                      value={formData.product_name}
                      onChange={(e) => setFormData({...formData, product_name: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      placeholder="Contoh: Jualan Produk A"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Jumlah Jualan (RM)</label>
                    <input 
                      required
                      type="number"
                      step="0.01"
                      value={formData.total}
                      onChange={(e) => setFormData({...formData, total: parseFloat(e.target.value)})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg font-bold text-lg font-display outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Kaedah Bayaran</label>
                    <div className="relative">
                      <select 
                        value={formData.payment_method}
                        onChange={(e) => setFormData({...formData, payment_method: e.target.value as any})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none pr-10"
                      >
                        <option value="bank">Bank / Online</option>
                        <option value="cash">Tunai (Cash)</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={() => setShowAdd(false)}
                      className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-200 transition-all"
                    >
                      Batal
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 btn-primary py-3 text-sm"
                    >
                      Simpan Jualan
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const TransactionReportTemplate = ({ records, user }: { records: any[], user: UserType | null }) => {
  const rptAssetLiabSet = new Set(ASSET_LIABILITY_CATEGORIES.map(c => c.toUpperCase()));
  const income = records.filter(r => r.type === 'income' && !rptAssetLiabSet.has(r.category.trim().toUpperCase())).reduce((sum, r) => sum + r.amount, 0);
  const expense = records.filter(r => r.type === 'expense' && !rptAssetLiabSet.has(r.category.trim().toUpperCase())).reduce((sum, r) => sum + r.amount, 0);
  const balance = income - expense;

  return (
    <div id="transaction-report" className="bg-white p-12 w-[794px] min-h-[1123px] font-sans text-black hidden fixed left-[-9999px] border border-black">
      {/* Header */}
      <div className="flex justify-between items-start mb-8 border-b border-black pb-4">
        <div>
          <h1 className="text-2xl font-bold uppercase">LAPORAN TRANSAKSI KEWANGAN</h1>
          <p className="text-[10px] font-bold text-gray-500 uppercase">FINANCIAL TRANSACTION REPORT</p>
          <div className="mt-4">
            <h2 className="text-lg font-bold uppercase">{user?.name || 'Perniagaan Saya'}</h2>
            <p className="text-[10px]">No. Pendaftaran: 202403123456 (AS0123456-X)</p>
          </div>
        </div>
        <div className="text-right text-[10px]">
          <p className="font-bold uppercase">Tarikh Laporan:</p>
          <p>{new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p className="mt-2 font-bold uppercase">ID Laporan:</p>
          <p>REP-{Date.now().toString().slice(-8)}</p>
        </div>
      </div>

      {/* Summary Box */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="border border-black p-3 text-center">
          <p className="text-[9px] font-bold uppercase text-gray-500">Jumlah Masuk</p>
          <p className="text-lg font-bold text-black">RM {income.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
        </div>
        <div className="border border-black p-3 text-center">
          <p className="text-[9px] font-bold uppercase text-gray-500">Jumlah Keluar</p>
          <p className="text-lg font-bold text-black">RM {expense.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
        </div>
        <div className="border border-black p-3 text-center">
          <p className="text-[9px] font-bold uppercase text-gray-500">Baki Bersih</p>
          <p className={`text-lg font-bold ${balance >= 0 ? 'text-black' : 'text-red-600'}`}>RM {balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="mb-8">
        <table className="w-full border-collapse border border-black text-[9px]">
          <thead>
            <tr className="bg-gray-50 border-b border-black">
              <th className="text-left py-2 px-2 font-bold uppercase border-r border-black w-20">Tarikh</th>
              <th className="text-left py-2 px-2 font-bold uppercase border-r border-black w-14">Jenis</th>
              <th className="text-left py-2 px-2 font-bold uppercase border-r border-black w-20">Kategori</th>
              <th className="text-left py-2 px-2 font-bold uppercase border-r border-black">Penerangan</th>
              <th className="text-left py-2 px-2 font-bold uppercase border-r border-black w-16">Kaedah</th>
              <th className="text-right py-2 px-2 font-bold uppercase w-24">Jumlah (RM)</th>
            </tr>
          </thead>
          <tbody>
            {[...records].sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()).map((record, idx) => (
              <tr key={idx} className="border-b border-gray-200">
                <td className="py-2 px-2 border-r border-black">{format(parseISO(record.date), 'dd/MM/yyyy')}</td>
                <td className="py-2 px-2 border-r border-black uppercase">{record.type === 'income' ? 'MASUK' : 'KELUAR'}</td>
                <td className="py-2 px-2 border-r border-black">{record.category}</td>
                <td className="py-2 px-2 border-r border-black truncate max-w-[150px]">{record.description}</td>
                <td className="py-2 px-2 border-r border-black uppercase">{record.payment_method === 'cash' ? 'TUNAI' : 'BANK'}</td>
                <td className={`py-2 px-2 text-right font-bold ${record.type === 'income' ? 'text-black' : 'text-red-600'}`}>
                  {record.type === 'income' ? '+' : '-'} {record.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-8 border-t border-black flex justify-between items-end text-[8px]">
        <div>
          <p>Laporan ini dijana secara automatik oleh MonitAcc (empower by wekeyra).</p>
          <p>Halaman 1 / 1</p>
        </div>
        <div className="text-center">
          <div className="w-32 border-b border-black mb-1"></div>
          <p className="font-bold uppercase">Pengesahan Syarikat</p>
        </div>
      </div>
    </div>
  );
};

const LedgerView = ({ records, sales, user, initialCategory, initialMonth, initialYear, onUpdate, onDelete, onDeleteSale, onAddNewCategory, categoryMappings }: { records: TransactionRecord[], sales: any[], user: UserType | null, initialCategory?: string, initialMonth?: number, initialYear?: number, onUpdate: (id: number, data: any) => void, onDelete: (id: number) => void, onDeleteSale: (id: number) => void, onAddNewCategory: (name: string, type: string) => void, categoryMappings: Record<string, string> }) => {
  const [selectedCategory, setSelectedCategory] = useState(initialCategory || 'JUALAN (REKOD)');
  const [editingRecord, setEditingRecord] = useState<TransactionRecord | null>(null);

  const [timeFilter, setTimeFilter] = useState<'all' | 'monthly' | 'yearly' | 'custom'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(initialMonth !== undefined ? initialMonth : new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(initialYear !== undefined ? initialYear : new Date().getFullYear());

  useEffect(() => {
    if (initialCategory) {
      setSelectedCategory(initialCategory);
    }
    if (initialMonth !== undefined) {
      setSelectedMonth(initialMonth);
      setTimeFilter('monthly');
    }
    if (initialYear !== undefined) {
      setSelectedYear(initialYear);
    }
  }, [initialCategory, initialMonth, initialYear]);
  const [startDate, setStartDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const months = [
    'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
    'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  // Combine records and sales (avoiding duplicates) for a complete ledger
  const allTransactions = [
    ...records.map(r => ({ ...r, source: 'record' })),
    ...sales
      .filter(s => !records.some(r => r.sale_id === s.id))
      .map(s => ({
        id: s.id,
        date: s.date,
        category: s.category || 'JUALAN (REKOD)',
        amount: s.total,
        description: s.product_name || 'Jualan',
        docNumber: s.docNumber,
        type: 'income',
        sale_id: s.id,
        source: 'sale',
        reconciled: s.reconciled
      }))
  ];

  const filtered = allTransactions
    .filter(r => {
      const cat = (r.category || '').trim().toLowerCase();
      const sel = selectedCategory.toLowerCase();
      
      // Balance Sheet Groupings
      if (sel === 'bank') return (r as any).payment_method === 'bank' || cat === 'bank' || cat.includes('bank');
      if (sel === 'cash in hand') return (r as any).payment_method === 'cash' || cat === 'cash in hand' || cat.includes('tunai') || cat.includes('cash');
      
      const fixedAssetCats = ["fixed assets", "motor vehicles", "furniture and fittings", "office equipment", "computer and software", "kitchen utensil", "renovation", "signboard", "building", "goodwill"];
      if (sel === 'fixed assets') return cat === sel || fixedAssetCats.includes(cat) || cat.includes('aset tetap') || cat.includes('kenderaan') || cat.includes('perabot') || cat.includes('pejabat') || cat.includes('komputer');
      
      const debtorCats = ["trade debtors", "other debtors", "en salleh", "morgan sdn bhd"];
      if (sel === 'trade debtors') return cat === sel || debtorCats.includes(cat) || cat.includes('penghutang') || cat.includes('debtor');
      
      const stockCats = ["stock"];
      if (sel === 'stock') return cat === sel || stockCats.includes(cat) || cat.includes('stok') || cat.includes('inventori');
      
      const depositCats = ["deposit & prepayment", "deposit - rental", "prepayment - utilities"];
      if (sel === 'deposit & prepayment') return cat === sel || depositCats.includes(cat) || cat.includes('deposit') || cat.includes('prabayar');
      
      const accrualCats = ["accruals", "accruals - audit fee", "accruals - accounting fee", "accruals - tax fee"];
      if (sel === 'accruals') return cat === sel || accrualCats.includes(cat) || cat.includes('akrual');
      
      const creditorCats = ["trade creditors", "other creditors"];
      if (sel === 'trade creditors') return cat === sel || creditorCats.includes(cat) || cat.includes('pemiutang') || cat.includes('creditor');
      
      const loanCats = ["hire purchase creditor", "term loan"];
      if (sel === 'hire purchase creditor') return cat === sel || loanCats.includes(cat) || cat.includes('pinjaman') || cat.includes('loan') || cat.includes('sewa beli');
      
      const taxCats = ["provision for taxation"];
      if (sel === 'provision for taxation') return cat === sel || taxCats.includes(cat) || cat.includes('cukai') || cat.includes('tax');
      
      const capitalCats = ["capital"];
      if (sel === 'capital') return cat === sel || capitalCats.includes(cat) || cat.includes('modal') || cat.includes('ekuiti');
      
      const drawingCats = ["amount due from director", "amount due to director"];
      if (sel === 'amount due to director') return cat === sel || drawingCats.includes(cat) || cat.includes('pengarah') || cat.includes('director') || cat.includes('ambilan');

      // Grouped Report Categories
      if (sel === 'sales') return r.sale_id || cat === 'sales' || cat === 'jualan' || cat === 'cash sales' || cat.includes('sales') || cat.includes('jualan');
      if (sel === 'sales adjustments') return cat === sel || cat.includes('adjustment') || cat.includes('pelarasan');
      if (sel === 'purchases') return cat === sel || cat.includes('purchase') || cat.includes('beli');
      if (sel === 'maintenance cost') return cat === sel || cat.includes('maintenance') || cat.includes('penyelenggaraan');
      if (sel === 'mileage cost') return cat === sel || cat.includes('mileage') || cat.includes('perbatuan');
      if (sel === 'rental vehicle') return cat === sel || cat.includes('rental vehicle') || cat.includes('sewa kenderaan');
      if (sel === 'other incomes') return r.type === 'income' && !cat.includes('sales') && !cat.includes('jualan') && !cat.includes('adjustment');
      
      if (sel === 'expenses') return r.type === 'expense' && !(cat.includes('purchase') || cat.includes('beli') || cat.includes('maintenance') || cat.includes('penyelenggaraan') || cat.includes('mileage') || cat.includes('perbatuan') || cat.includes('rental vehicle') || cat.includes('sewa kenderaan'));
      if (sel === 'cogs') return r.type === 'expense' && (cat.includes('purchase') || cat.includes('beli') || cat.includes('maintenance') || cat.includes('penyelenggaraan') || cat.includes('mileage') || cat.includes('perbatuan') || cat.includes('rental vehicle') || cat.includes('sewa kenderaan'));

      // Expense Groupings from Report
      if (sel === 'accountancy fee') return cat === sel || cat.includes('accounting') || cat.includes('akaun') || cat.includes('audit');
      if (sel === 'commission') return cat === sel || cat.includes('commission') || cat.includes('komisyen');
      if (sel === 'bank charges') return cat === sel || cat.includes('bank charge') || cat.includes('caj bank');
      if (sel === 'condolences & donation') return cat === sel || cat.includes('donation') || cat.includes('derma') || cat.includes('sumbangan');
      if (sel === 'license fee') return cat === sel || cat.includes('license') || cat.includes('lesen');
      if (sel === 'printing and stationary') return cat === sel || cat.includes('printing') || cat.includes('percetakan') || cat.includes('stationery') || cat.includes('alat tulis');
      if (sel === 'roadtax and insurance') return cat === sel || cat.includes('insurance') || cat.includes('insurans') || cat.includes('roadtax') || cat.includes('cukai jalan');
      if (sel === 'staff refreshment') return cat === sel || cat.includes('refreshment') || cat.includes('makan') || cat.includes('minum');
      if (sel === 'salaries, bonus and allowances') return cat === sel || cat.includes('salari') || cat.includes('salary') || cat.includes('gaji') || cat.includes('upah') || cat.includes('allowance') || cat.includes('elaun');
      if (sel === 'director remuneration / owner salary') return cat === sel || cat.includes('owner salary') || cat.includes('gaji pemilik') || cat.includes('director');
      if (sel === 'secretary fee') return cat === sel || cat.includes('ssm') || cat.includes('setiausaha');
      if (sel === 'telecommunication expenses') return cat === sel || cat.includes('telecom') || cat.includes('telefon') || cat.includes('internet') || cat.includes('unifi') || cat.includes('maxis') || cat.includes('celcom') || cat.includes('digi');
      if (sel === 'upkeep of office') return cat === sel || cat.includes('upkeep') || cat.includes('pejabat') || cat.includes('office');
      if (sel === 'quit rent and asssessment') return cat === sel || cat.includes('stamp duty') || cat.includes('setem') || cat.includes('cukai tanah') || cat.includes('cukai pintu');
      if (sel === 'water and electricity') return cat === sel || cat.includes('utility') || cat.includes('bil') || cat.includes('water') || cat.includes('electricity') || cat.includes('api') || cat.includes('air') || cat.includes('tnb') || cat.includes('syabas');
      if (sel === 'zakat') return cat === sel || cat.includes('zakat');

      if (sel === 'gross profit') {
        const isIncome = r.type === 'income';
        const isCogs = r.type === 'expense' && (cat.includes('purchase') || cat.includes('beli') || cat.includes('maintenance') || cat.includes('penyelenggaraan') || cat.includes('mileage') || cat.includes('perbatuan') || cat.includes('rental vehicle') || cat.includes('sewa kenderaan'));
        return isIncome || isCogs;
      }
      if (sel === 'net profit') return true;
      
      // Default exact match
      return cat === sel;
    })
    .filter(r => {
      const date = parseISO(r.date);
      if (timeFilter === 'monthly') {
        return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
      }
      if (timeFilter === 'yearly') {
        return date.getFullYear() === selectedYear;
      }
      if (timeFilter === 'custom') {
        const start = parseISO(startDate);
        const end = parseISO(endDate);
        // Normalize dates for comparison
        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        return d >= s && d <= e;
      }
      return true;
    }).sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());

  const total = filtered.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="p-4 md:p-6 pb-24 md:pl-64 md:pt-12 max-w-7xl mx-auto">
      <header className="mb-10">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-1 font-display">Perincian Lejar</h2>
            <p className="text-slate-500 text-sm font-medium">Lihat perincian transaksi mengikut kategori akaun.</p>
          </div>
          
          <div className="flex flex-wrap gap-3 items-center">
            <div className="w-64">
              <SearchableSelect 
                value={selectedCategory}
                onChange={setSelectedCategory}
                options={ALL_CATEGORIES.includes(selectedCategory) ? ALL_CATEGORIES : [selectedCategory, ...ALL_CATEGORIES]}
                placeholder="Pilih Akaun"
              />
            </div>
            
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
              {['all', 'monthly', 'yearly', 'custom'].map((f) => (
                <button
                  key={f}
                  onClick={() => setTimeFilter(f as any)}
                  className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                    timeFilter === f ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {f === 'all' ? 'Semua' : f === 'monthly' ? 'Bulan' : f === 'yearly' ? 'Tahun' : 'Khas'}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="mt-4 flex flex-wrap gap-3 items-center">
          {timeFilter === 'monthly' && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              {months.map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
          )}
          {(timeFilter === 'monthly' || timeFilter === 'yearly') && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}
          {timeFilter === 'custom' && (
            <div className="flex items-center gap-2">
              <input 
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <span className="text-slate-400 font-bold text-xs">ke</span>
              <input 
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card-premium p-6 bg-white border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <Hash size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Kod Akaun</p>
              <h3 className="text-xl font-bold text-slate-900 font-mono">{CHART_OF_ACCOUNTS[selectedCategory] || 'N/A'}</h3>
            </div>
          </div>
        </div>
        
        <div className="card-premium p-6 bg-white border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Bil. Transaksi</p>
              <h3 className="text-xl font-bold text-slate-900">{filtered.length}</h3>
            </div>
          </div>
        </div>

        <div className="card-premium p-6 bg-emerald-600 text-white border-none shadow-lg shadow-emerald-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 text-white rounded-xl flex items-center justify-center">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-1">Jumlah Keseluruhan</p>
              <h3 className="text-2xl font-bold font-display">RM {total.toLocaleString()}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="card-premium overflow-hidden bg-white">
        {/* Mobile Card View */}
        <div className="lg:hidden divide-y divide-slate-100">
          {filtered.map((record) => (
            <div key={record.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-700">{record.description || selectedCategory}</span>
                    {!!record.reconciled && <Check size={12} strokeWidth={3} className="text-emerald-500 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-400">{format(parseISO(record.date), 'dd MMM yyyy')}</span>
                    {record.docNumber && (
                      <span className="text-[9px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {record.docNumber}
                      </span>
                    )}
                  </div>
                </div>
                <p className={`text-base font-bold font-display shrink-0 ${
                  record.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {record.type === 'income' ? '+' : '-'} RM {record.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 mt-2">
                {record.source === 'record' && (
                  <button
                    onClick={() => setEditingRecord(record as TransactionRecord)}
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                  >
                    <Eye size={16} />
                  </button>
                )}
                <button
                  onClick={() => record.source === 'sale' ? onDeleteSale(record.sale_id) : onDelete(record.id)}
                  className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="p-20 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                  <BookOpen size={32} />
                </div>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-wider">Tiada transaksi untuk kategori ini dalam tempoh yang dipilih.</p>
              </div>
            </div>
          )}
        </div>
        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-32">Tarikh</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-32">No. Dokumen</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Penerangan</th>
                <th className="pl-6 pr-16 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-32 text-right">Jumlah (RM)</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right w-24">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4 text-sm font-medium text-slate-600 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      {format(parseISO(record.date), 'dd MMM yyyy')}
                      {!!record.reconciled && (
                        <span className="text-emerald-500 ml-2" title="Telah Dipadankan dengan Bank">
                          <Check size={14} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                      {record.docNumber || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {record.description}
                  </td>
                  <td className={`pl-6 pr-16 py-4 font-bold text-right whitespace-nowrap ${
                    record.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {record.type === 'income' ? '+' : '-'} {record.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {record.source === 'record' ? (
                        <button
                          onClick={() => setEditingRecord(record as TransactionRecord)}
                          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                          title="Lihat & Edit"
                        >
                          <Eye size={16} />
                        </button>
                      ) : null}
                      <button
                        onClick={() => record.source === 'sale' ? onDeleteSale(record.sale_id) : onDelete(record.id)}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        title="Padam"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                        <BookOpen size={32} />
                      </div>
                      <p className="text-slate-400 font-bold text-xs uppercase tracking-wider">Tiada transaksi untuk kategori ini dalam tempoh yang dipilih.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingRecord && (
        <EditRecordModal 
          record={editingRecord} 
          onClose={() => setEditingRecord(null)} 
          onSave={(data) => {
            onUpdate(editingRecord.id, data);
            setEditingRecord(null);
          }}
          onAddNewCategory={onAddNewCategory}
          categoryMappings={categoryMappings}
        />
      )}
    </div>
  );
};

const ManualReconcileModal = ({ 
  transaction, 
  records, 
  sales, 
  onClose, 
  onSelect 
}: { 
  transaction: any, 
  records: TransactionRecord[], 
  sales: Sale[], 
  onClose: () => void, 
  onSelect: (match: any) => void 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const type = transaction.type === 'credit' ? 'income' : 'expense';
  
  const potentialRecords = records.filter(r => 
    !r.reconciled && 
    r.type === type &&
    (r.category.toLowerCase().includes(searchTerm.toLowerCase()) || 
     r.amount.toString().includes(searchTerm) ||
     r.description?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const potentialSales = type === 'income' ? sales.filter(s => 
    !s.reconciled && 
    (s.product_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     s.total.toString().includes(searchTerm))
  ) : [];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="bg-white w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[80vh]"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Carian Manual Padanan</h3>
            <p className="text-xs text-slate-500 font-medium">Padankan: {transaction.description} (RM {transaction.amount.toFixed(2)})</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Cari mengikut kategori, jumlah atau penerangan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {potentialRecords.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">Rekod Transaksi</h4>
              {potentialRecords.map(r => (
                <div 
                  key={r.id} 
                  onClick={() => onSelect({ type: 'record', item: r })}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 cursor-pointer transition-all group"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-900">{r.category}</span>
                    <span className="text-[10px] text-slate-500">{r.date} • {r.description}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-slate-900">RM {r.amount.toFixed(2)}</span>
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus size={14} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {potentialSales.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">Rekod Jualan</h4>
              {potentialSales.map(s => (
                <div 
                  key={s.id} 
                  onClick={() => onSelect({ type: 'sale', item: s })}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 cursor-pointer transition-all group"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-900">{s.product_name}</span>
                    <span className="text-[10px] text-slate-500">{s.date} • {s.customer_name || 'Pelanggan Am'}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-slate-900">RM {s.total.toFixed(2)}</span>
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus size={14} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {potentialRecords.length === 0 && potentialSales.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-400 font-medium">Tiada rekod yang sepadan ditemui.</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const ReconcileView = ({ records, sales, onUpdateRecord, onUpdateSale, onAddMissingRecord, onBulkAdd, onRefresh, user }: { records: TransactionRecord[], sales: Sale[], onUpdateRecord: (id: number, data: any) => void, onUpdateSale: (id: number, data: any) => void, onAddMissingRecord: (bt: any) => void, onBulkAdd: (data: any[]) => void, onRefresh: () => void, user: UserType | null }) => {
  const [bankTransactions, setBankTransactions] = useState<any[]>(() => {
    const saved = localStorage.getItem('monitacc_bank_transactions');
    return saved ? JSON.parse(saved) : [];
  });
  const [isUploading, setIsUploading] = useState(false);
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [manualMatchTransaction, setManualMatchTransaction] = useState<any | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    localStorage.setItem('monitacc_bank_transactions', JSON.stringify(bankTransactions));
  }, [bankTransactions]);

  const generateMockBankData = () => {
    setIsUploading(true);
    setTimeout(() => {
      const mockData = [
        { id: 'bt1', date: format(new Date(), 'yyyy-MM-dd'), amount: 150.00, description: 'TRANSFER FROM MAYBANK', type: 'credit' },
        { id: 'bt2', date: format(new Date(), 'yyyy-MM-dd'), amount: 45.50, description: 'PETRONAS FUEL', type: 'debit' },
        { id: 'bt3', date: format(new Date(), 'yyyy-MM-dd'), amount: 1200.00, description: 'SALARY PAYMENT', type: 'debit' },
        { id: 'bt4', date: format(new Date(), 'yyyy-MM-dd'), amount: 350.00, description: 'SHOPEE SALES', type: 'credit' },
      ];
      setBankTransactions(mockData);
      setIsUploading(false);
    }, 1500);
  };

  const guessCategory = (description: string, type: 'income' | 'expense') => {
    const desc = description.toLowerCase();
    if (type === 'income') {
      if (desc.includes('sales') || desc.includes('jualan') || desc.includes('shopee') || desc.includes('lazada') || desc.includes('tiktok')) return 'SALES';
      if (desc.includes('interest') || desc.includes('faedah')) return 'Faedah Bank';
      return 'Duit Masuk Lain';
    } else {
      if (desc.includes('petronas') || desc.includes('shell') || desc.includes('fuel') || desc.includes('tol') || desc.includes('touch n go')) return 'Petrol & Tol';
      if (desc.includes('salary') || desc.includes('gaji') || desc.includes('epf') || desc.includes('socso')) return 'Gaji & Upah';
      if (desc.includes('rental') || desc.includes('sewa')) return 'Sewa';
      if (desc.includes('tnb') || desc.includes('electric') || desc.includes('water') || desc.includes('unifi') || desc.includes('maxis')) return 'Utiliti';
      if (desc.includes('makan') || desc.includes('food') || desc.includes('grabfood') || desc.includes('foodpanda')) return 'Keraian & Makan';
      if (desc.includes('advert') || desc.includes('fb ads') || desc.includes('google ads') || desc.includes('marketing')) return 'Iklan & Pemasaran';
      return 'Lain-lain Belanja';
    }
  };

  const handleQuickAdd = (bt: any) => {
    const match = matches.get(bt.id);
    if (match && match.alreadyReconciled) {
      alert('Transaksi ini sudah ada dalam rekod perakaunan anda.');
      return;
    }

    const type = bt.type === 'credit' ? 'income' : 'expense';
    const guessedCat = guessCategory(bt.description, type);
    
    const newRecord = {
      type,
      docType: type === 'income' ? 'Duit Masuk Bank' : 'Duit Keluar Bank',
      docNumber: `BANK-${bt.id}`,
      category: guessedCat,
      amount: bt.amount,
      date: bt.date,
      description: bt.description,
      reconciled: true,
      origin: 'manual'
    };
    
    onBulkAdd([newRecord]);
    alert(`Rekod berjaya ditambah secara pantas dengan kategori: ${guessedCat}`);
  };

  const handleBulkAdd = async () => {
    const unmatched = bankTransactions.filter(bt => !matches.has(bt.id));
    if (unmatched.length === 0) return;
    
    if (confirm(`Adakah anda pasti mahu menjana ${unmatched.length} rekod baru secara automatik berdasarkan penyata bank ini?\n\nNota: Sistem akan mengesan dan mengabaikan sebarang rekod bertindih secara automatik.`)) {
      setIsBulkAdding(true);
      try {
        const recordsToSave = unmatched.map(bt => {
          const type = bt.type === 'credit' ? 'income' : 'expense';
          return {
            type,
            docType: type === 'income' ? 'Duit Masuk Bank' : 'Duit Keluar Bank',
            docNumber: `BANK-${bt.id}`,
            category: guessCategory(bt.description, type),
            amount: bt.amount,
            date: bt.date,
            description: bt.description,
            reconciled: true,
            origin: 'manual'
          };
        });
        
        await onBulkAdd(recordsToSave);
        alert(`Berjaya! ${unmatched.length} rekod baru telah dijana secara automatik. Sila sahkan padanan di bawah.`);
      } catch (error) {
        console.error("Error bulk adding records:", error);
        alert("Gagal menjana rekod. Sila cuba lagi.");
      } finally {
        setIsBulkAdding(false);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    
    if (file.name.endsWith('.csv')) {
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const lines = text.split('\n').filter(l => l.trim());
          if (lines.length === 0) return;

          // Detect headers
          const header = lines[0].toLowerCase();
          let dateIdx = 0;
          let descIdx = 1;
          let amountIdx = 2;

          if (header.includes('transaction date')) {
            const cols = lines[0].split(',').map(c => c.trim().toLowerCase());
            dateIdx = cols.indexOf('transaction date');
            descIdx = cols.indexOf('transaction description');
            amountIdx = cols.indexOf('amount');
            if (amountIdx === -1) amountIdx = cols.indexOf('transaction amount');
          } else if (header.includes('date') && header.includes('description') && header.includes('amount')) {
            const cols = lines[0].split(',').map(c => c.trim().toLowerCase());
            dateIdx = cols.indexOf('date');
            descIdx = cols.indexOf('description');
            amountIdx = cols.indexOf('amount');
          }

          const data = lines.slice(1).map((line, i) => {
            const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
            const amountStr = cols[amountIdx] || '0';
            const amount = parseFloat(amountStr.replace(/,/g, ''));
            
            // Handle Maybank date format (DD-MMM-YYYY or DD/MM/YYYY)
            let rawDate = cols[dateIdx] || '';
            let formattedDate = rawDate;
            if (rawDate.includes('-') && isNaN(Date.parse(rawDate))) {
              // Try to convert DD-MMM-YYYY to YYYY-MM-DD
              const parts = rawDate.split('-');
              if (parts.length === 3) {
                const months: {[key: string]: string} = {
                  'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04', 'MAY': '05', 'JUN': '06',
                  'JUL': '07', 'AUG': '08', 'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
                };
                const day = parts[0].padStart(2, '0');
                const month = months[parts[1].toUpperCase()] || '01';
                const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
                formattedDate = `${year}-${month}-${day}`;
              }
            }

            return {
              id: `bt-${Date.now()}-${i}`,
              date: formattedDate || format(new Date(), 'yyyy-MM-dd'),
              description: cols[descIdx] || 'Transaksi Bank',
              amount: Math.abs(amount),
              type: amount >= 0 ? 'credit' : 'debit'
            };
          });

          // Deduplicate within the file
          const uniqueData = data.filter((item, index, self) =>
            index === self.findIndex((t) => (
              t.date === item.date && 
              Math.abs(t.amount - item.amount) < 0.01 && 
              t.description.toLowerCase() === item.description.toLowerCase() &&
              t.type === item.type
            ))
          );

          setBankTransactions(uniqueData);
          localStorage.setItem('monitacc_bank_transactions', JSON.stringify(uniqueData));
          if (uniqueData.length < data.length) {
            alert(`Berjaya memuat naik ${uniqueData.length} transaksi. (${data.length - uniqueData.length} rekod bertindih dalam fail telah diabaikan)`);
          } else {
            alert(`Berjaya memuat naik ${uniqueData.length} transaksi.`);
          }
        } catch (err) {
          alert('Ralat membaca fail CSV. Sila pastikan format betul: Tarikh, Penerangan, Jumlah');
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsText(file);
    } else {
      // PDF or Image processing with Gemini
      reader.onload = async (event) => {
        try {
          const base64Data = event.target?.result as string;
          const mimeType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

          setUploadStatus({ type: 'info', message: 'AI sedang menganalisis penyata bank anda...' });

          const extracted = await extractBankTransactions(base64Data, mimeType);

          if (extracted && extracted.length > 0) {
            const data = extracted.map((item, i) => ({
              id: `bt-ai-${Date.now()}-${i}`,
              date: item.date || format(new Date(), 'yyyy-MM-dd'),
              description: item.description || 'Transaksi Bank',
              amount: item.amount,
              type: item.type
            }));

            const uniqueData = data.filter((item, index, self) =>
              index === self.findIndex((t) => (
                t.date === item.date &&
                Math.abs(t.amount - item.amount) < 0.01 &&
                t.description.toLowerCase() === item.description.toLowerCase() &&
                t.type === item.type
              ))
            );

            setBankTransactions(uniqueData);
            localStorage.setItem('monitacc_bank_transactions', JSON.stringify(uniqueData));
            const dupes = data.length - uniqueData.length;
            setUploadStatus({
              type: 'success',
              message: `Berjaya! ${uniqueData.length} transaksi diekstrak${dupes > 0 ? ` (${dupes} rekod bertindih diabaikan)` : ''}.`
            });
          } else {
            setUploadStatus({ type: 'error', message: 'AI tidak dapat mengekstrak transaksi. Sila pastikan dokumen jelas atau gunakan format CSV.' });
          }
        } catch (err) {
          console.error('Error processing with AI:', err);
          setUploadStatus({ type: 'error', message: 'Ralat semasa memproses dokumen dengan AI. Sila cuba lagi.' });
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const matches = useMemo(() => {
    const matchMap = new Map();
    const usedRecordIds = new Set<number>();
    const usedSaleIds = new Set<number>();

    bankTransactions.forEach(bt => {
      const amount = bt.amount;
      const type = bt.type === 'credit' ? 'income' : 'expense';
      const btDesc = bt.description.toLowerCase().trim();
      
      // Priority 1: Exact matches (Date, Amount, Description)
      let matchRecord = records.find(r => 
        !usedRecordIds.has(r.id) &&
        r.type === type && 
        Math.abs(r.amount - amount) < 0.01 &&
        r.date === bt.date &&
        r.description.toLowerCase().trim() === btDesc
      );
      if (matchRecord) {
        usedRecordIds.add(matchRecord.id);
        matchMap.set(bt.id, { type: 'record', item: matchRecord, alreadyReconciled: matchRecord.reconciled });
        return;
      }

      // Priority 2: Unreconciled matches with same date and amount
      matchRecord = records.find(r => 
        !usedRecordIds.has(r.id) &&
        !r.reconciled && 
        r.type === type && 
        Math.abs(r.amount - amount) < 0.01 &&
        r.date === bt.date
      );
      if (matchRecord) {
        usedRecordIds.add(matchRecord.id);
        matchMap.set(bt.id, { type: 'record', item: matchRecord, alreadyReconciled: false });
        return;
      }

      // Priority 3: Unreconciled matches with same amount (within 7 days)
      matchRecord = records.find(r => {
        if (usedRecordIds.has(r.id) || r.reconciled || r.type !== type || Math.abs(r.amount - amount) >= 0.01) return false;
        try {
          const rDate = new Date(r.date);
          const bDate = new Date(bt.date);
          const diffDays = Math.abs(rDate.getTime() - bDate.getTime()) / (1000 * 3600 * 24);
          return diffDays <= 7;
        } catch (e) {
          return true; 
        }
      });
      if (matchRecord) {
        usedRecordIds.add(matchRecord.id);
        matchMap.set(bt.id, { type: 'record', item: matchRecord, alreadyReconciled: false });
        return;
      }

      // Priority 4: Sales matches (income only)
      if (type === 'income') {
        const matchSale = sales.find(s => 
          !usedSaleIds.has(s.id) &&
          Math.abs(s.total - amount) < 0.01 &&
          s.date === bt.date
        );
        if (matchSale) {
          usedSaleIds.add(matchSale.id);
          matchMap.set(bt.id, { type: 'sale', item: matchSale, alreadyReconciled: matchSale.reconciled });
          return;
        }

        const closeSale = sales.find(s => {
          if (usedSaleIds.has(s.id) || Math.abs(s.total - amount) >= 0.01) return false;
          try {
            const sDate = new Date(s.date);
            const bDate = new Date(bt.date);
            const diffDays = Math.abs(sDate.getTime() - bDate.getTime()) / (1000 * 3600 * 24);
            return diffDays <= 7;
          } catch (e) {
            return true;
          }
        });
        if (closeSale) {
          usedSaleIds.add(closeSale.id);
          matchMap.set(bt.id, { type: 'sale', item: closeSale, alreadyReconciled: closeSale.reconciled });
          return;
        }
      }
    });
    return matchMap;
  }, [bankTransactions, records, sales]);

  const handleReconcile = (btId: string, match: any) => {
    if (match.type === 'record') {
      onUpdateRecord(match.item.id, { ...match.item, reconciled: true });
    } else {
      onUpdateSale(match.item.id, { ...match.item, reconciled: true });
    }
    setBankTransactions(prev => prev.filter(bt => bt.id !== btId));
  };

  return (
    <div className="p-4 md:p-6 pb-24 md:pl-64 md:pt-12 max-w-7xl mx-auto">
      <header className="mb-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-1 font-display">Bank Reconciliation</h2>
          <p className="text-slate-500 text-sm font-medium">Padankan transaksi bank dengan rekod perakaunan anda.</p>
        </div>
        <div className="flex items-center gap-3">
          {bankTransactions.length > 0 && (
            <div className="flex items-center gap-2">
              <button 
                onClick={onRefresh}
                className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all border border-slate-200"
                title="Segarkan Padanan"
              >
                <RefreshCw size={16} />
              </button>
              <button 
                onClick={() => {
                  setBankTransactions([]);
                  localStorage.removeItem('monitacc_bank_transactions');
                }}
                className="px-4 py-2 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl hover:bg-rose-100 transition-all flex items-center gap-2 border border-rose-100"
              >
                <Trash2 size={16} />
                Padam Penyata
              </button>
            </div>
          )}
          <label className={`btn-primary flex items-center gap-2 cursor-pointer ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {isUploading ? <RefreshCw size={18} className="animate-spin" /> : <Download size={18} />}
            {bankTransactions.length > 0 ? 'Muat Semula Penyata' : 'Muat Naik Penyata Bank'}
            <input type="file" accept=".csv,.pdf" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      </header>

      {uploadStatus && (
        <div className={`mb-6 flex items-start gap-3 p-4 rounded-2xl border text-sm font-medium ${
          uploadStatus.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' :
          uploadStatus.type === 'error' ? 'bg-rose-50 border-rose-100 text-rose-800' :
          'bg-blue-50 border-blue-100 text-blue-800'
        }`}>
          <div className="shrink-0 mt-0.5">
            {uploadStatus.type === 'info' && <Loader2 size={16} className="animate-spin" />}
            {uploadStatus.type === 'success' && <Check size={16} />}
            {uploadStatus.type === 'error' && <AlertCircle size={16} />}
          </div>
          <span className="flex-1">{uploadStatus.message}</span>
          {uploadStatus.type !== 'info' && (
            <button onClick={() => setUploadStatus(null)} className="shrink-0 opacity-50 hover:opacity-100">
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {bankTransactions.length === 0 && isUploading ? (
        <div className="card-premium p-20 text-center bg-white border-slate-100">
          <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-2">
              <Loader2 size={40} className="animate-spin" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 font-display">AI Sedang Menganalisis...</h3>
            <p className="text-slate-500 text-sm leading-relaxed">Mengekstrak transaksi daripada penyata bank anda. Ini mungkin mengambil masa beberapa saat.</p>
          </div>
        </div>
      ) : bankTransactions.length === 0 ? (
        <div className="card-premium p-20 text-center bg-white border-slate-100">
          <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-2">
              <RefreshCw size={40} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 font-display">Mula Padanan Bank</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Muat naik penyata bank anda (CSV/PDF) untuk memulakan proses padanan automatik dengan rekod jualan dan duit keluar anda.
            </p>
            <p className="text-[10px] text-slate-400 font-medium">Format CSV: Tarikh, Penerangan, Jumlah (Negatif untuk Belanja)</p>
            <div className="flex flex-col sm:flex-row gap-3 mt-2 w-full">
              <button 
                onClick={generateMockBankData}
                className="flex-1 px-8 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg"
              >
                Gunakan Penyata Contoh
              </button>
              <label className="flex-1 px-8 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all cursor-pointer flex items-center justify-center gap-2">
                <FileText size={18} />
                Muat Naik CSV / PDF
                <input type="file" accept=".csv,.pdf" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {records.length === 0 && sales.length === 0 && (
            <div className="bg-amber-50 border border-amber-100 p-5 rounded-2xl flex items-start gap-4">
              <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-amber-900">Sistem Perakaunan Masih Kosong</h4>
                <p className="text-xs text-amber-700 leading-relaxed mt-1">
                  Anda belum memasukkan sebarang rekod transaksi. Untuk memulakan dengan cepat, anda boleh menjana rekod secara automatik berdasarkan penyata bank ini.
                </p>
                <button 
                  onClick={handleBulkAdd}
                  disabled={isBulkAdding}
                  className={`mt-3 px-4 py-2 bg-amber-600 text-white text-[10px] font-bold rounded-lg hover:bg-amber-700 transition-all shadow-sm flex items-center gap-2 ${isBulkAdding ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isBulkAdding ? (
                    <>
                      <Loader2 className="animate-spin" size={14} />
                      <span>Menjana Rekod...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
                      Jana Semua Rekod Automatik
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <AlertCircle size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-blue-900">Maklumat Penyata Bank</h4>
              <p className="text-xs text-blue-700 leading-relaxed mt-1">
                Transaksi di bawah adalah rekod dari penyata bank anda. Jika anda belum memasukkan transaksi ini ke dalam sistem Monitacc, anda boleh klik <strong>"Tambah Rekod"</strong> untuk memasukkannya secara automatik.
              </p>
            </div>
          </div>

          <div className="card-premium overflow-hidden bg-white border-slate-100 shadow-sm">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Transaksi Bank Terkini</h4>
              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-md uppercase tracking-wider">
                {bankTransactions.length} Transaksi Ditemui
              </span>
            </div>
            {/* Mobile Card View */}
            <div className="lg:hidden divide-y divide-slate-100">
              {bankTransactions.map(bt => {
                const match = matches.get(bt.id);
                return (
                  <div key={bt.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate">{bt.description}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[10px] font-bold text-slate-400">
                            {bt.date.includes('-') ? format(parseISO(bt.date), 'dd MMM yyyy') : bt.date}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">{bt.type === 'credit' ? 'Duit Masuk' : 'Duit Keluar'}</span>
                        </div>
                      </div>
                      <p className={`text-base font-bold shrink-0 ${bt.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {bt.type === 'credit' ? '+' : '-'} RM {bt.amount.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      {match ? (
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold border ${match.alreadyReconciled ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                          {match.alreadyReconciled ? <Check size={12} strokeWidth={3} className="text-blue-600" /> : <Check size={12} strokeWidth={3} />}
                          {match.alreadyReconciled ? 'Sudah Dipadankan' : `Padanan Ditemui`}
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-[10px] font-bold border border-amber-100">
                          <AlertCircle size={12} />
                          Tiada Padanan
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {match ? (
                        match.alreadyReconciled ? (
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selesai</span>
                        ) : (
                          <button
                            onClick={() => handleReconcile(bt.id, match)}
                            className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700 transition-all shadow-sm"
                          >
                            Sahkan Padanan
                          </button>
                        )
                      ) : (
                        <>
                          <button
                            onClick={() => handleQuickAdd(bt)}
                            className="px-3 py-2 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700 transition-all shadow-sm flex items-center gap-1.5"
                          >
                            <Zap size={12} />
                            Padan Pantas
                          </button>
                          <button
                            onClick={() => {
                              const type = bt.type === 'credit' ? 'income' : 'expense';
                              const guessedCat = guessCategory(bt.description, type);
                              onAddMissingRecord({ ...bt, category: guessedCat });
                            }}
                            className="px-3 py-2 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-lg hover:bg-emerald-100 transition-all border border-emerald-100"
                          >
                            Tambah Rekod
                          </button>
                          <button
                            onClick={() => setManualMatchTransaction(bt)}
                            className="px-3 py-2 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg hover:bg-slate-200 transition-all"
                          >
                            Cari Manual
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-50">
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tarikh</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Penerangan</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Jumlah (RM)</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Status Padanan</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {bankTransactions.map(bt => {
                    const match = matches.get(bt.id);
                    return (
                      <tr key={bt.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-xs font-bold text-slate-600 whitespace-nowrap">
                          {bt.date.includes('-') ? format(parseISO(bt.date), 'dd MMM yyyy') : bt.date}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-bold text-slate-900">{bt.description}</p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-tight">{bt.type === 'credit' ? 'Duit Masuk' : 'Duit Keluar'}</p>
                        </td>
                        <td className={`px-6 py-4 text-xs font-bold text-right ${bt.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {bt.type === 'credit' ? '+' : '-'} {bt.amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {match ? (
                            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold border ${match.alreadyReconciled ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                              {match.alreadyReconciled ? <Check size={12} strokeWidth={3} className="text-blue-600" /> : <Check size={12} strokeWidth={3} />}
                              {match.alreadyReconciled ? 'Sudah Dipadankan' : `Padanan Ditemui: ${match.type === 'record' ? (match.item as TransactionRecord).category : (match.item as Sale).product_name}`}
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-[10px] font-bold border border-amber-100">
                              <AlertCircle size={12} />
                              Tiada Padanan
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {match ? (
                            match.alreadyReconciled ? (
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selesai</span>
                            ) : (
                              <button
                                onClick={() => handleReconcile(bt.id, match)}
                                className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700 transition-all shadow-sm"
                              >
                                Sahkan Padanan
                              </button>
                            )
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleQuickAdd(bt)}
                                className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700 transition-all shadow-sm flex items-center gap-2"
                                title="Tambah terus dengan kategori yang dicadangkan"
                              >
                                <Zap size={14} />
                                Padan Pantas
                              </button>
                              <button
                                onClick={() => {
                                  const type = bt.type === 'credit' ? 'income' : 'expense';
                                  const guessedCat = guessCategory(bt.description, type);
                                  onAddMissingRecord({ ...bt, category: guessedCat });
                                }}
                                className="px-4 py-2 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-lg hover:bg-emerald-100 transition-all border border-emerald-100"
                              >
                                Tambah Rekod
                              </button>
                              <button
                                onClick={() => setManualMatchTransaction(bt)}
                                className="px-4 py-2 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg hover:bg-slate-200 transition-all"
                              >
                                Cari Manual
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {manualMatchTransaction && (
          <ManualReconcileModal 
            transaction={manualMatchTransaction}
            records={records}
            sales={sales}
            onClose={() => setManualMatchTransaction(null)}
            onSelect={(match) => {
              handleReconcile(manualMatchTransaction.id, match);
              setManualMatchTransaction(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const RecordsView = ({ 
  records, 
  sales, 
  onDelete, 
  onDeleteSale, 
  onUpdate,
  user,
  onAddNewCategory,
  categoryMappings,
  onBulkDelete
}: { 
  records: TransactionRecord[], 
  sales: any[], 
  onDelete: (id: number) => void, 
  onDeleteSale: (id: number) => void, 
  onUpdate: (id: number, data: any) => void,
  user: UserType | null,
  onAddNewCategory: (name: string, type: string) => void,
  categoryMappings: Record<string, string>,
  onBulkDelete?: (items: { id: number, type: 'record' | 'sale', saleId?: number }[]) => void
}) => {
  const [filter, setFilter] = useState<'all' | 'income' | 'expense' | 'sale'>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'monthly' | 'yearly' | 'custom'>('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [startDate, setStartDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [editingRecord, setEditingRecord] = useState<TransactionRecord | null>(null);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const months = [
    'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
    'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  // Use records directly since sales are now mirrored in the records table
  const mergedRecords = records.map(r => ({ ...r, origin: (r.origin || 'manual') as 'manual' | 'scan' | 'sale' }))
    .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());

  const filtered = mergedRecords.filter(r => {
    // Type filter
    if (filter !== 'all') {
      if (filter === 'income' && r.type !== 'income') return false;
      if (filter === 'expense' && r.type !== 'expense') return false;
      if (filter === 'sale' && r.origin !== 'sale') return false;
    }

    // Time filter
    const date = parseISO(r.date);
    if (timeFilter === 'monthly') {
      if (date.getMonth() !== selectedMonth || date.getFullYear() !== selectedYear) return false;
    } else if (timeFilter === 'yearly') {
      if (date.getFullYear() !== selectedYear) return false;
    } else if (timeFilter === 'custom') {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      if (d < s || d > e) return false;
    }

    return true;
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(r => `${r.origin}-${r.id}`)));
    }
  };

  const toggleSelect = (origin: string, id: number) => {
    const key = `${origin}-${id}`;
    const newSelected = new Set(selectedIds);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDeleteClick = () => {
    if (!onBulkDelete) return;
    const itemsToDelete = Array.from(selectedIds).map(key => {
      const [origin, idStr] = key.split('-');
      const id = parseInt(idStr);
      const record = mergedRecords.find(r => r.id === id && r.origin === origin);
      return {
        id,
        type: origin === 'sale' ? 'sale' as const : 'record' as const,
        saleId: record?.sale_id
      };
    });
    onBulkDelete(itemsToDelete);
    setSelectedIds(new Set());
  };

  const downloadReport = async () => {
    const fileName = `Laporan-Transaksi-${new Date().toISOString().split('T')[0]}.pdf`;
    await generatePDF('transaction-report', fileName, setDownloadingReport);
  };

  return (
    <div className="pb-28 md:p-6 md:pb-24 md:pl-64 md:pt-12 max-w-7xl mx-auto">
      <TransactionReportTemplate records={filtered} user={user} />

      {/* ── Mobile Header ── */}
      <div className="lg:hidden bg-white border-b border-slate-100 px-4 pt-5 pb-4 space-y-3">
        {/* Title row */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Rekod Transaksi</h2>
            <p className="text-slate-400 text-[11px] mt-0.5">Semua duit masuk dan keluar</p>
          </div>
          <div className="flex items-center gap-1.5">
            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkDeleteClick}
                className="flex items-center gap-1.5 h-8 px-3 bg-rose-50 text-rose-600 rounded-xl text-[11px] font-bold transition-all"
              >
                <Trash2 size={13} />
                {selectedIds.size}
              </button>
            )}
            <button
              onClick={downloadReport}
              disabled={downloadingReport}
              className="h-8 px-3 flex items-center gap-1.5 bg-slate-900 text-white rounded-xl text-[11px] font-bold transition-all disabled:opacity-50"
            >
              {downloadingReport ? <RefreshCw size={13} className="animate-spin" /> : <FileDown size={13} />}
              PDF
            </button>
          </div>
        </div>

        {/* Type filter */}
        <div className="grid grid-cols-4 bg-slate-100 rounded-2xl p-1 gap-1">
          {[
            { id: 'all', label: 'Semua' },
            { id: 'income', label: 'Masuk' },
            { id: 'expense', label: 'Keluar' },
            { id: 'sale', label: 'Jualan' },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setFilter(opt.id as any)}
              className={`py-2 rounded-xl text-[11px] font-semibold transition-all ${
                filter === opt.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Time filter */}
        <div className="grid grid-cols-4 bg-slate-100 rounded-2xl p-1 gap-1">
          {[
            { id: 'all', label: 'Semua' },
            { id: 'monthly', label: 'Bulan' },
            { id: 'yearly', label: 'Tahun' },
            { id: 'custom', label: 'Khas' },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setTimeFilter(opt.id as any)}
              className={`py-2 rounded-xl text-[11px] font-semibold transition-all ${
                timeFilter === opt.id
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Secondary time selectors */}
        {(timeFilter === 'monthly' || timeFilter === 'yearly' || timeFilter === 'custom') && (
          <div className="flex gap-2">
            {timeFilter === 'monthly' && (
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
              >
                {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            )}
            {(timeFilter === 'monthly' || timeFilter === 'yearly') && (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
              >
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
            {timeFilter === 'custom' && (
              <>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                />
                <span className="text-slate-300 self-center">—</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Desktop Header ── */}
      <header className="hidden lg:flex mb-10 flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-1 font-display">Rekod Transaksi</h2>
          <p className="text-slate-500 text-sm font-medium">Senarai semua duit masuk dan duit keluar.</p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            {[{ id: 'all', label: 'Semua' }, { id: 'income', label: 'Masuk' }, { id: 'expense', label: 'Keluar' }, { id: 'sale', label: 'Jualan' }].map((opt) => (
              <button key={opt.id} onClick={() => setFilter(opt.id as any)} className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${filter === opt.id ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>{opt.label}</button>
            ))}
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            {[{ id: 'all', label: 'Semua Masa' }, { id: 'monthly', label: 'Bulan' }, { id: 'yearly', label: 'Tahun' }, { id: 'custom', label: 'Khas' }].map((opt) => (
              <button key={opt.id} onClick={() => setTimeFilter(opt.id as any)} className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${timeFilter === opt.id ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>{opt.label}</button>
            ))}
          </div>
          <div className="flex gap-2 items-center">
            {timeFilter === 'monthly' && (
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20">
                {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            )}
            {(timeFilter === 'monthly' || timeFilter === 'yearly') && (
              <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20">
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
            {timeFilter === 'custom' && (
              <div className="flex items-center gap-2">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20" />
                <span className="text-slate-400 font-bold text-xs">ke</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20" />
              </div>
            )}
          </div>
          <button onClick={downloadReport} disabled={downloadingReport} className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-slate-800 transition-all disabled:opacity-50 shadow-lg">
            {downloadingReport ? <RefreshCw size={14} className="animate-spin" /> : <FileDown size={14} />}
            Muat Turun Laporan
          </button>
          {selectedIds.size > 0 && (
            <button onClick={handleBulkDeleteClick} className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-rose-700 transition-all shadow-lg animate-in fade-in zoom-in duration-200">
              <Trash2 size={14} />
              Padam Terpilih ({selectedIds.size})
            </button>
          )}
        </div>
      </header>

      <div className="card-premium overflow-hidden bg-white">
        {/* Mobile Card View */}
        <div className="lg:hidden">
          {filtered.length > 0 && (
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selectedIds.size === filtered.length}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                Pilih Semua
              </label>
              <span className="text-[10px] font-semibold text-slate-400">{filtered.length} rekod</span>
            </div>
          )}
          <div className="divide-y divide-slate-50">
            {filtered.map((record) => {
              const CategoryIcon = getCategoryIcon(record.category);
              const accNo = CHART_OF_ACCOUNTS[record.category] || (record.origin === 'sale' ? CHART_OF_ACCOUNTS['SALES'] : null) || `#${record.id}`;
              return (
                <div key={record.id} className={`px-4 py-3 ${selectedIds.has(`${record.origin}-${record.id}`) ? 'bg-emerald-50/40' : ''}`}>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(`${record.origin}-${record.id}`)}
                      onChange={() => toggleSelect(record.origin, record.id)}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                    />
                    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
                      record.origin === 'sale' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {record.origin === 'sale' ? <ShoppingCart size={15} strokeWidth={2} /> : <CategoryIcon size={15} strokeWidth={2} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[13px] font-bold text-slate-800 truncate">{record.category}</span>
                            {record.image_url && <Paperclip size={10} strokeWidth={3} className="text-emerald-500 shrink-0" />}
                            {!!record.reconciled && <Check size={10} strokeWidth={3} className="text-emerald-500 shrink-0" />}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-slate-400 font-medium">{format(parseISO(record.date), 'dd MMM yyyy')}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                              record.payment_method === 'cash' ? 'bg-amber-50 text-amber-600' : 'bg-sky-50 text-sky-600'
                            }`}>
                              {record.payment_method === 'cash' ? 'Tunai' : 'Bank'}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className={`text-[14px] font-bold font-display ${
                            record.origin === 'sale' ? 'text-emerald-600' : (record.type === 'income' ? 'text-emerald-600' : 'text-rose-500')
                          }`}>
                            {record.type === 'income' ? '+' : '-'} RM {record.amount.toLocaleString()}
                          </span>
                          <div className="flex items-center gap-0.5">
                            {record.origin !== 'sale' && (
                              <button
                                onClick={() => setEditingRecord(record as TransactionRecord)}
                                className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                              >
                                <Eye size={13} />
                              </button>
                            )}
                            <button
                              onClick={() => record.origin === 'sale' && record.sale_id ? onDeleteSale(record.sale_id) : onDelete(record.id)}
                              className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="py-16 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-200">
                    <ReceiptText size={26} />
                  </div>
                  <p className="text-slate-400 text-xs font-semibold">Tiada rekod ditemui.</p>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left table-fixed">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-2 py-4 w-[4%]">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </th>
                <th className="px-2 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[8%]">No. Kod</th>
                <th className="px-2 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[10%]">Tarikh</th>
                <th className="px-2 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[8%]">Jenis</th>
                <th className="px-2 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[15%]">Kategori</th>
                <th className="px-2 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[23%]">Penerangan</th>
                <th className="px-2 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[10%]">Kaedah</th>
                <th className="px-2 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[12%] text-right">Jumlah</th>
                <th className="px-2 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right w-[10%]">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((record) => {
                const CategoryIcon = getCategoryIcon(record.category);
                const accNo = CHART_OF_ACCOUNTS[record.category] || (record.origin === 'sale' ? CHART_OF_ACCOUNTS['SALES'] : null) || `#${record.id}`;
                return (
                  <tr key={record.id} className={`hover:bg-slate-50 transition-colors group ${selectedIds.has(`${record.origin}-${record.id}`) ? 'bg-emerald-50/30' : ''}`}>
                    <td className="px-2 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(`${record.origin}-${record.id}`)}
                        onChange={() => toggleSelect(record.origin, record.id)}
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-2 py-4">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-bold font-mono border border-slate-200 truncate max-w-full">
                        {accNo}
                      </span>
                    </td>
                    <td className="px-2 py-4 text-[11px] font-medium text-slate-600 whitespace-nowrap">
                      <div className="flex items-center gap-3 truncate">
                        {format(parseISO(record.date), 'dd MMM yyyy')}
                        {!!record.reconciled && (
                          <span className="text-emerald-500 shrink-0 ml-2" title="Telah Dipadankan dengan Bank">
                            <Check size={12} strokeWidth={3} />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-4">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border inline-block truncate max-w-full ${
                        record.origin === 'sale'
                          ? 'bg-blue-50 text-blue-700 border-blue-100'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      }`}>
                        {record.docType || 'Rekod'}
                      </span>
                    </td>
                    <td className="px-2 py-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${
                          record.origin === 'sale' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-white'
                        }`}>
                          {record.origin === 'sale' ? <ShoppingCart size={12} strokeWidth={2} /> : <CategoryIcon size={12} strokeWidth={2} />}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-slate-900 truncate">
                              {record.category}
                            </span>
                            {record.image_url && (
                              <div className="shrink-0 text-emerald-500" title="Mempunyai Lampiran">
                                <Paperclip size={10} strokeWidth={3} />
                              </div>
                            )}
                          </div>
                          {record.docNumber && (
                            <span className="text-[8px] font-mono font-bold text-slate-400 flex items-center gap-1 truncate">
                              <Hash size={8} /> {record.docNumber}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-4 text-[11px] font-medium text-slate-400">
                      <div className="line-clamp-2 leading-relaxed break-words">
                        {record.description}
                      </div>
                    </td>
                    <td className="px-2 py-4">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border inline-flex items-center gap-1 ${
                        record.payment_method === 'cash'
                          ? 'bg-amber-50 text-amber-700 border-amber-100'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                      }`}>
                        {record.payment_method === 'cash' ? <DollarSign size={10} className="mr-0.5" /> : <Landmark size={10} className="mr-0.5" />}
                        {record.payment_method === 'cash' ? 'Tunai' : 'Bank'}
                      </span>
                    </td>
                    <td className={`px-2 py-4 font-bold text-sm font-display text-right whitespace-nowrap ${
                      record.origin === 'sale' ? 'text-emerald-600' : (record.type === 'income' ? 'text-emerald-600' : 'text-rose-600')
                    }`}>
                      {record.type === 'income' ? '+' : '-'} RM {record.amount.toLocaleString()}
                    </td>
                    <td className="px-2 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {record.origin !== 'sale' && (
                          <button
                            onClick={() => setEditingRecord(record as TransactionRecord)}
                            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                            title="Lihat & Edit"
                          >
                            <Eye size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => record.origin === 'sale' && record.sale_id ? onDeleteSale(record.sale_id) : onDelete(record.id)}
                          className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="Padam"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                        <ReceiptText size={32} />
                      </div>
                      <p className="text-slate-400 font-bold text-xs uppercase tracking-wider">Tiada rekod ditemui.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingRecord && (
        <EditRecordModal 
          record={editingRecord} 
          onClose={() => setEditingRecord(null)} 
          onSave={(data) => {
            onUpdate(editingRecord.id, data);
            setEditingRecord(null);
          }}
          onAddNewCategory={onAddNewCategory}
          categoryMappings={categoryMappings}
        />
      )}
    </div>
  );
};

const ProfitLossReport = ({ 
  records, 
  sales, 
  user, 
  isAnnualOverride, 
  selectedYear: propYear, 
  categoryMappings,
  setCategoryMappings,
  onCategoryClick,
  reportType,
  startDate,
  endDate,
  selectedMonth
}: { 
  records: TransactionRecord[], 
  sales: Sale[], 
  user: UserType | null, 
  isAnnualOverride?: boolean, 
  selectedYear?: number, 
  categoryMappings: Record<string, any>,
  setCategoryMappings: (mappings: any) => void,
  onCategoryClick?: (category: string, month?: number, year?: number) => void,
  reportType?: 'monthly' | 'yearly' | 'custom',
  startDate?: string,
  endDate?: string,
  selectedMonth?: number
}) => {
  const [isAnnual, setIsAnnual] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newSubCatName, setNewSubCatName] = useState('');
  const [pdfSegment, setPdfSegment] = useState<'all' | 'sales' | 'cogs' | 'gross_profit' | 'other_income' | 'expenses' | 'net_profit'>('all');
  const [showPdfMenu, setShowPdfMenu] = useState(false);

  const getOptionsForSection = (section: string) => {
    const standard = (() => {
      switch (section) {
        case 'SALES':
          return INCOME_CATEGORIES.filter(c => c.toUpperCase().includes('SALES') || c.toUpperCase().includes('RETURN') || c.toUpperCase().includes('DISCOUNT'));
        case 'COGS':
          return COGS_CATEGORIES;
        case 'EXPENSE':
          return EXPENSE_CATEGORIES;
        case 'OTHER_INCOME':
          return INCOME_CATEGORIES.filter(c => !c.toUpperCase().includes('SALES') && !c.toUpperCase().includes('RETURN') && !c.toUpperCase().includes('DISCOUNT'));
        case 'TAXATION':
          return ['Provision for taxation', 'Taxation', 'Income Tax', 'Tax Paid', 'Tax Refund'];
        default:
          return ALL_CATEGORIES;
      }
    })();

    // Add custom categories that are already mapped to this section but not in standard list
    const custom = Object.keys(categoryMappings).filter(cat => 
      categoryMappings[cat] === section && 
      !ALL_CATEGORIES.map(c => c.toUpperCase()).includes(cat.toUpperCase())
    );

    return Array.from(new Set([...standard, ...custom]));
  };
  
  const addSubCategory = (mainCat: string) => {
    if (!newSubCatName.trim()) return;
    const cat = newSubCatName.trim().toUpperCase();
    setCategoryMappings((prev: any) => ({
      ...prev,
      [cat]: mainCat
    }));
    // Also track that this was manually added in this session to show it even if empty
    setManuallyAdded(prev => new Set(prev).add(cat));
    setNewSubCatName('');
    setAddingTo(null);
  };

  const [manuallyAdded, setManuallyAdded] = useState<Set<string>>(new Set());
  
  // Determine if a category should be shown in the report
  const shouldShowCategory = (cat: string, sectionKey: string) => {
    const total = calculateRowTotal(`${sectionKey}.${cat}`);
    // Show if has data OR if it's a custom category OR if it was manually added in this session
    const isCustom = !ALL_CATEGORIES.map(c => c.toUpperCase()).includes(cat.toUpperCase());
    const isAdded = manuallyAdded.has(cat.toUpperCase());
    return total !== 0 || isCustom || isAdded;
  };
  
  // Determine the year to display in headers
  const currentYear = reportType === 'custom' && startDate ? 
    parseISO(startDate).getFullYear() : 
    (propYear || new Date().getFullYear());

  useEffect(() => {
    if (isAnnualOverride !== undefined) {
      setIsAnnual(isAnnualOverride);
    }
  }, [isAnnualOverride]);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const companyName = user?.company_name || 'MONITACC ENTERPRISE';

  const getMonthlyData = () => {
    const data: any = {};
    months.forEach(m => {
      data[m] = {
        sales: 0,
        salesByCategory: {},
        salesAdjustments: 0,
        cogs: {},
        otherIncome: {},
        expenses: {},
        taxation: 0,
        cogsTotal: 0,
        expensesTotal: 0,
        otherIncomeTotal: 0
      };
      
      // Initialize COGS, Expenses, and Other Income with 0 for all known categories
      COGS_CATEGORIES.forEach(cat => data[m].cogs[cat] = 0);
      EXPENSE_CATEGORIES.forEach(cat => data[m].expenses[cat] = 0);
      Object.keys(categoryMappings).filter(c => categoryMappings[c] === 'OTHER_INCOME').forEach(cat => data[m].otherIncome[cat] = 0);
      Object.keys(categoryMappings).filter(c => categoryMappings[c] === 'SALES').forEach(cat => data[m].salesByCategory[cat] = 0);
      data[m].salesByCategory['JUALAN (REKOD)'] = 0;
    });

    const assetLiabSet = new Set(ASSET_LIABILITY_CATEGORIES.map(c => c.toUpperCase()));

    // Process Sales
    sales.forEach(s => {
      const sCat = (s.category || 'JUALAN (REKOD)').trim().toUpperCase();
      if (assetLiabSet.has(sCat)) return;
      const date = parseISO(s.date);
      const month = months[date.getMonth()];
      if (data[month]) {
        data[month].sales += s.total;
        data[month].salesByCategory[sCat] = (data[month].salesByCategory[sCat] || 0) + s.total;
      }
    });

    // Process Records
    records.forEach(r => {
      if (r.sale_id) return;

      const category = r.category.trim().toUpperCase();
      const type = categoryMappings[category] || 'EXPENSE';

      // Skip Asset/Liability categories in P&L
      if (assetLiabSet.has(category) || type === 'ASSET_LIABILITY') return;

      const date = parseISO(r.date);
      const month = months[date.getMonth()];
      if (!data[month]) return;

      const amount = r.amount;

      if (r.type === 'income') {
        if (type === 'SALES') {
          data[month].sales += amount;
          data[month].salesByCategory[category] = (data[month].salesByCategory[category] || 0) + amount;
        } else if (category.includes('ADJUSTMENT')) {
          data[month].salesAdjustments += amount;
        } else if (type === 'OTHER_INCOME') {
          data[month].otherIncome[category] = (data[month].otherIncome[category] || 0) + amount;
        } else {
          data[month].otherIncome[category] = (data[month].otherIncome[category] || 0) + amount;
        }
      } else {
        if (type === 'COGS') {
          data[month].cogs[category] = (data[month].cogs[category] || 0) + amount;
        } else if (type === 'EXPENSE') {
          data[month].expenses[category] = (data[month].expenses[category] || 0) + amount;
        } else if (type === 'TAXATION' || category.includes('TAX') || category.includes('CUKAI')) {
          data[month].taxation += amount;
        } else {
          data[month].expenses[category] = (data[month].expenses[category] || 0) + amount;
        }
      }
    });

    // Calculate Totals
    months.forEach(m => {
      const mData = data[m];
      
      mData.cogsTotal = Object.values(mData.cogs).reduce((a: any, b: any) => a + b, 0) as number;
      mData.expensesTotal = Object.values(mData.expenses).reduce((a: any, b: any) => a + b, 0) as number;
      mData.otherIncomeTotal = Object.values(mData.otherIncome).reduce((a: any, b: any) => a + b, 0) as number;
      
      mData.grossProfit = mData.sales + mData.salesAdjustments - mData.cogsTotal;
      mData.netProfit = mData.grossProfit + mData.otherIncomeTotal - mData.expensesTotal - mData.taxation;
    });

    return data;
  };

  const monthlyData = getMonthlyData();

  const calculateRowTotal = (path: string) => {
    return months.reduce((sum, m) => {
      const parts = path.split('.');
      let val = monthlyData[m];
      parts.forEach(p => val = val?.[p]);
      return sum + (val || 0);
    }, 0);
  };

  const formatCurrency = (val: number | undefined | null) => {
    if (val === undefined || val === null || val === 0) return '-';
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const moveCategory = (category: string, newType: string) => {
    setCategoryMappings((prev: any) => ({
      ...prev,
      [category.toUpperCase()]: newType
    }));
    setEditingCategory(null);
  };

  const CategoryName = ({ name, type }: { name: string, type: 'SALES' | 'COGS' | 'EXPENSE' | 'OTHER_INCOME' }) => (
    <td 
      className={`px-1.5 py-1.5 pl-2 sticky left-[60px] bg-white group cursor-pointer hover:bg-slate-50 transition-colors ${editingCategory === name ? 'z-[100]' : 'z-10'}`}
      onClick={() => onCategoryClick?.(name, reportType === 'monthly' ? selectedMonth : undefined, currentYear)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium group-hover:underline group-hover:text-indigo-600 transition-all">{name}</span>
          <ChevronRight size={10} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="flex items-center gap-1 print:hidden relative">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setEditingCategory(editingCategory === name ? null : name);
            }}
            className={`p-1 rounded transition-all ${editingCategory === name ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'}`}
            title="Tukar Bahagian"
          >
            <ChevronDown size={14} className={`transition-transform duration-200 ${editingCategory === name ? 'rotate-180' : ''}`} />
          </button>
          {editingCategory === name && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[1000] p-1.5 min-w-[180px] animate-in fade-in zoom-in duration-200 ring-4 ring-slate-900/5">
              <p className="text-[9px] font-bold text-slate-400 px-3 py-2 uppercase tracking-wider border-b border-slate-50 mb-1">Pindah Ke Bahagian:</p>
              <div className="space-y-0.5">
                {/* Profit & Loss Sections */}
                <p className="text-[8px] font-black text-slate-300 px-3 py-1 uppercase tracking-tighter">Profit & Loss</p>
                {type !== 'SALES' && (
                  <button 
                    onClick={() => moveCategory(name, 'SALES')}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg text-[10px] font-bold text-slate-600 flex items-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    Sales (Jualan)
                  </button>
                )}
                {type !== 'COGS' && (
                  <button 
                    onClick={() => moveCategory(name, 'COGS')}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg text-[10px] font-bold text-slate-600 flex items-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    COGS (Kos Jualan)
                  </button>
                )}
                {type !== 'EXPENSE' && (
                  <button 
                    onClick={() => moveCategory(name, 'EXPENSE')}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg text-[10px] font-bold text-slate-600 flex items-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Expenses (Belanja)
                  </button>
                )}
                {type !== 'OTHER_INCOME' && (
                  <button 
                    onClick={() => moveCategory(name, 'OTHER_INCOME')}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg text-[10px] font-bold text-slate-600 flex items-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Duit Masuk Lain (P&L)
                  </button>
                )}
                
                {/* Balance Sheet Section */}
                <div className="border-t border-slate-50 mt-1 pt-1">
                  <p className="text-[8px] font-black text-slate-300 px-3 py-1 uppercase tracking-tighter">Balance Sheet</p>
                  <button 
                    onClick={() => moveCategory(name, 'ASSET_LIABILITY')}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg text-[10px] font-bold text-slate-600 flex items-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    Balance Sheet (Aset/Liabiliti)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </td>
  );

  const plPeriodLabel = reportType === 'monthly' && selectedMonth !== undefined
    ? `${['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'][selectedMonth]} ${currentYear}`
    : reportType === 'yearly' ? String(currentYear)
    : reportType === 'custom' && startDate && endDate ? `${format(parseISO(startDate), 'dd/MM/yy')} – ${format(parseISO(endDate), 'dd/MM/yy')}`
    : String(currentYear);

  return (
    <div className="card-premium p-0 overflow-hidden bg-white mt-6 print:shadow-none print:border-none">

      <div className="print:block">
      <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-slate-50/50 print:hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <h3 className="text-sm md:text-lg font-bold text-slate-900 tracking-tight font-display">
            {isAnnual ? 'Laporan Tahunan' : 'P&L'} - {plPeriodLabel}
          </h3>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${!isAnnual ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Bulanan
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${isAnnual ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Tahunan
            </button>
          </div>
        </div>
        <div className="relative">
          <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <button
              onClick={() => {
                const sm = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
                const pageW = 210;
                const pageH = 297;
                const marginL = 18;
                const marginR = 18;
                const contentW = pageW - marginL - marginR;
                const colCodeW = 30;
                const colAmtW = 38;
                const colDescX = marginL + colCodeW + 4;
                const colAmtX = pageW - marginR;
                const rowH = 7;
                let y = 0;

                // ── Data computation ───────────────────────────────────────
                const md: any = {};
                sm.forEach(m => { md[m] = { sales: 0, salesByCategory: {}, salesAdjustments: 0, cogs: {}, otherIncome: {}, expenses: {}, taxation: 0 }; });
                sales.filter(s => {
                  const d = parseISO(s.date);
                  return reportType === 'yearly' ? d.getFullYear() === currentYear : reportType === 'monthly' ? d.getMonth() === (selectedMonth ?? 0) && d.getFullYear() === currentYear : true;
                }).forEach(s => {
                  const mi = sm[parseISO(s.date).getMonth()];
                  md[mi].sales += s.total;
                  const sc = (s.category || 'JUALAN (REKOD)').trim().toUpperCase();
                  md[mi].salesByCategory[sc] = (md[mi].salesByCategory[sc] || 0) + s.total;
                });
                const pdfAssetLiabSet = new Set(ASSET_LIABILITY_CATEGORIES.map(c => c.toUpperCase()));
                records.filter(r => {
                  if (r.sale_id) return false;
                  const d = parseISO(r.date);
                  return reportType === 'yearly' ? d.getFullYear() === currentYear : reportType === 'monthly' ? d.getMonth() === (selectedMonth ?? 0) && d.getFullYear() === currentYear : true;
                }).forEach(r => {
                  const mi = sm[parseISO(r.date).getMonth()];
                  const cat = r.category.trim().toUpperCase();
                  const type = categoryMappings[cat] || 'EXPENSE';
                  if (pdfAssetLiabSet.has(cat) || type === 'ASSET_LIABILITY') return;
                  if (r.type === 'income') {
                    if (type === 'SALES') { md[mi].sales += r.amount; md[mi].salesByCategory[cat] = (md[mi].salesByCategory[cat] || 0) + r.amount; }
                    else if (cat.includes('ADJUSTMENT')) md[mi].salesAdjustments += r.amount;
                    else md[mi].otherIncome[cat] = (md[mi].otherIncome[cat] || 0) + r.amount;
                  } else {
                    if (type === 'COGS') md[mi].cogs[cat] = (md[mi].cogs[cat] || 0) + r.amount;
                    else if (type === 'TAXATION' || cat.includes('TAX') || cat.includes('CUKAI')) md[mi].taxation += r.amount;
                    else md[mi].expenses[cat] = (md[mi].expenses[cat] || 0) + r.amount;
                  }
                });
                const calcTotal = (path: string) => sm.reduce((sum, m) => { const parts = path.split('.'); let val: any = md[m]; parts.forEach(p => { val = val?.[p]; }); return sum + (Number(val) || 0); }, 0);
                const salesCats = Array.from(new Set([...Object.keys(categoryMappings).filter(c => categoryMappings[c] === 'SALES'), 'JUALAN (REKOD)'])).filter(cat => calcTotal(`salesByCategory.${cat}`) !== 0);
                const cogsCats = Object.keys(categoryMappings).filter(c => categoryMappings[c] === 'COGS' && calcTotal(`cogs.${c}`) !== 0);
                const otherIncomeCats = Object.keys(categoryMappings).filter(c => categoryMappings[c] === 'OTHER_INCOME' && calcTotal(`otherIncome.${c}`) !== 0);
                const expenseCats = Object.keys(categoryMappings).filter(c => categoryMappings[c] === 'EXPENSE' && calcTotal(`expenses.${c}`) !== 0);
                const totalSalesAmt = calcTotal('sales') + calcTotal('salesAdjustments');
                const totalCogsAmt = cogsCats.reduce((s, c) => s + calcTotal(`cogs.${c}`), 0);
                const grossProfit = totalSalesAmt - totalCogsAmt;
                const totalOtherIncome = otherIncomeCats.reduce((s, c) => s + calcTotal(`otherIncome.${c}`), 0);
                const totalExpensesAmt = expenseCats.reduce((s, c) => s + calcTotal(`expenses.${c}`), 0);
                const taxation = calcTotal('taxation');
                const netProfitAmt = grossProfit + totalOtherIncome - totalExpensesAmt - taxation;

                const segLabels: Record<string, string> = { all: 'Penuh', sales: 'Jualan', cogs: 'Kos Jualan', gross_profit: 'Untung Kasar', other_income: 'Pendapatan Lain', expenses: 'Perbelanjaan', net_profit: 'Untung Bersih' };
                const segTitle = segLabels[pdfSegment] || 'Penuh';
                const mnNames = ['Januari','Februari','Mac','April','Mei','Jun','Julai','Ogos','September','Oktober','November','Disember'];
                const periodLabel = reportType === 'monthly' && selectedMonth !== undefined ? `${mnNames[selectedMonth]} ${currentYear}` : reportType === 'yearly' ? String(currentYear) : `${startDate} - ${endDate}`;
                const bizName = (user?.company_name || 'MONITACC ENTERPRISE').toUpperCase();
                const ssmNo = user?.ssm_number || '-';

                // ── Page helpers ───────────────────────────────────────────
                const drawPageFooter = (pageNum: number, totalPages: number) => {
                  doc.setDrawColor(180, 180, 180);
                  doc.line(marginL, pageH - 14, pageW - marginR, pageH - 14);
                  doc.setFontSize(7); doc.setFont('courier', 'normal'); doc.setTextColor(150, 150, 150);
                  doc.text(`Dijana oleh Monitacc • ${format(new Date(), 'dd MMMM yyyy', { locale: undefined })} • Sulit`, marginL, pageH - 9);
                  doc.text(`Halaman ${pageNum} / ${totalPages}`, pageW - marginR, pageH - 9, { align: 'right' });
                };

                const drawPageHeader = () => {
                  // Dark top bar
                  doc.setFillColor(15, 23, 42);
                  doc.rect(0, 0, pageW, 36, 'F');
                  // Company name
                  doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
                  doc.text(bizName, marginL, 14);
                  // SSM
                  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(148, 163, 184);
                  doc.text(`No. SSM: ${ssmNo}`, marginL, 21);
                  // Report title right-aligned
                  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(52, 211, 153);
                  const rTitle = pdfSegment !== 'all' ? `PENYATA UNTUNG RUGI — ${segTitle.toUpperCase()}` : 'PENYATA UNTUNG RUGI';
                  doc.text(rTitle, pageW - marginR, 14, { align: 'right' });
                  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(148, 163, 184);
                  doc.text(`Tempoh: ${periodLabel}`, pageW - marginR, 21, { align: 'right' });
                  // Thin accent line
                  doc.setFillColor(52, 211, 153);
                  doc.rect(0, 36, pageW, 1.2, 'F');
                  y = 46;
                };

                const drawTableHeader = () => {
                  doc.setFillColor(248, 250, 252);
                  doc.rect(marginL, y - 5, contentW, rowH, 'F');
                  doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139);
                  doc.text('KOD', marginL, y);
                  doc.text('KETERANGAN', colDescX, y);
                  doc.text('JUMLAH (RM)', colAmtX, y, { align: 'right' });
                  doc.setDrawColor(203, 213, 225);
                  doc.line(marginL, y + 1.5, pageW - marginR, y + 1.5);
                  y += rowH;
                };

                const checkNewPage = (needed = rowH) => {
                  if (y + needed > pageH - 20) {
                    doc.addPage();
                    drawPageHeader();
                    drawTableHeader();
                  }
                };

                // Section label band
                const drawSectionLabel = (label: string) => {
                  checkNewPage(rowH + 2);
                  doc.setFillColor(241, 245, 249);
                  doc.rect(marginL, y - 4, contentW, rowH - 1, 'F');
                  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(71, 85, 105);
                  doc.text(label.toUpperCase(), marginL + 1, y);
                  y += rowH - 1;
                };

                // Normal data row
                const drawRow = (code: string, label: string, value: number | null, opts: { bold?: boolean; indent?: boolean; highlight?: boolean; highlightColor?: [number,number,number]; totalRow?: boolean } = {}) => {
                  checkNewPage();
                  const { bold = false, indent = false, highlight = false, highlightColor = [240, 253, 244], totalRow = false } = opts;
                  if (highlight) {
                    doc.setFillColor(...highlightColor);
                    doc.rect(marginL, y - 5, contentW, rowH, 'F');
                  }
                  doc.setFont('helvetica', bold ? 'bold' : 'normal');
                  doc.setFontSize(bold ? 8.5 : 8);
                  doc.setTextColor(bold ? 15 : 55, bold ? 23 : 65, bold ? 42 : 81);
                  doc.text(code, marginL, y);
                  doc.text(indent ? `    ${label}` : label, colDescX, y);
                  if (value !== null) {
                    const isNeg = value < 0;
                    doc.setTextColor(isNeg ? 190 : bold ? 15 : 55, isNeg ? 40 : bold ? 23 : 65, isNeg ? 40 : bold ? 42 : 81);
                    doc.text(fmt2(value), colAmtX, y, { align: 'right' });
                  }
                  if (totalRow) {
                    doc.setDrawColor(100, 116, 139);
                    doc.line(colAmtX - colAmtW + 4, y + 1.5, colAmtX, y + 1.5);
                  }
                  y += rowH;
                };

                // Single underline under amount
                const drawUnderline = (double = false) => {
                  doc.setDrawColor(100, 116, 139);
                  doc.line(colAmtX - colAmtW + 4, y - rowH + 1.5, colAmtX, y - rowH + 1.5);
                  if (double) {
                    doc.line(colAmtX - colAmtW + 4, y - rowH + 3, colAmtX, y - rowH + 3);
                  }
                  y += 1;
                };

                // Full-width separator
                const drawSeparator = (thick = false) => {
                  checkNewPage(3);
                  doc.setDrawColor(thick ? 71 : 203, thick ? 85 : 213, thick ? 105 : 225);
                  doc.setLineWidth(thick ? 0.4 : 0.2);
                  doc.line(marginL, y - 2, pageW - marginR, y - 2);
                  doc.setLineWidth(0.2);
                  y += 2;
                };

                // ── Build PDF ──────────────────────────────────────────────
                drawPageHeader();
                drawTableHeader();

                const seg = pdfSegment;

                // SALES
                if (seg === 'all' || seg === 'sales') {
                  drawSectionLabel('A. Jualan / Sales');
                  salesCats.forEach(cat => drawRow(CHART_OF_ACCOUNTS[cat] || '-', cat, calcTotal(`salesByCategory.${cat}`), { indent: true }));
                  const adj = calcTotal('salesAdjustments');
                  if (adj !== 0) drawRow('-', 'Sales Adjustments', adj, { indent: true });
                  drawSeparator();
                  drawRow(CHART_OF_ACCOUNTS['SALES'] || '5000/000', 'JUMLAH JUALAN (TOTAL)', totalSalesAmt, { bold: true, totalRow: true });
                  drawUnderline();
                  y += 3;
                }

                // COGS
                if (seg === 'all' || seg === 'cogs') {
                  drawSectionLabel('B. Kos Jualan / Cost of Goods Sold');
                  if (cogsCats.length > 0) {
                    cogsCats.forEach(cat => drawRow(CHART_OF_ACCOUNTS[cat] || '-', cat, calcTotal(`cogs.${cat}`), { indent: true }));
                    drawSeparator();
                  }
                  drawRow('', 'JUMLAH KOS JUALAN (TOTAL)', totalCogsAmt, { bold: true, totalRow: true });
                  drawUnderline();
                  y += 3;
                }

                // GROSS PROFIT
                if (seg === 'all' || seg === 'gross_profit') {
                  const gpColor: [number,number,number] = grossProfit >= 0 ? [220, 252, 231] : [254, 226, 226];
                  drawRow('', 'GROSS PROFIT / (LOSS)', grossProfit, { bold: true, highlight: true, highlightColor: gpColor });
                  drawUnderline(true);
                  y += 5;
                }

                // OTHER INCOME
                if (seg === 'all' || seg === 'other_income') {
                  drawSectionLabel('C. Pendapatan Lain / Other Income');
                  if (otherIncomeCats.length > 0) {
                    otherIncomeCats.forEach(cat => drawRow(CHART_OF_ACCOUNTS[cat] || '-', cat, calcTotal(`otherIncome.${cat}`), { indent: true }));
                    drawSeparator();
                  }
                  drawRow('', 'JUMLAH DUIT MASUK LAIN (TOTAL)', totalOtherIncome, { bold: true, totalRow: true });
                  drawUnderline();
                  y += 3;
                }

                // EXPENSES
                if (seg === 'all' || seg === 'expenses') {
                  drawSectionLabel('D. Perbelanjaan / Expenses');
                  expenseCats.forEach(cat => drawRow(CHART_OF_ACCOUNTS[cat] || '-', cat, calcTotal(`expenses.${cat}`), { indent: true }));
                  if (taxation !== 0) {
                    drawSeparator();
                    drawRow(CHART_OF_ACCOUNTS['PROVISION FOR TAXATION'] || '4080/000', 'Provision for Taxation', taxation, { indent: true });
                  }
                  drawSeparator();
                  drawRow('', 'JUMLAH PERBELANJAAN (TOTAL)', totalExpensesAmt + taxation, { bold: true, totalRow: true });
                  drawUnderline();
                  y += 5;
                }

                // NET PROFIT — always full-width highlight
                if (seg === 'all' || seg === 'net_profit') {
                  const npColor: [number,number,number] = netProfitAmt >= 0 ? [15, 23, 42] : [127, 29, 29];
                  doc.setFillColor(...npColor);
                  doc.rect(marginL, y - 5, contentW, rowH + 1, 'F');
                  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
                  doc.text('', marginL, y);
                  doc.text(`NET PROFIT / (LOSS)  —  ${periodLabel}`, colDescX, y);
                  const npColor2: [number,number,number] = netProfitAmt >= 0 ? [52, 211, 153] : [252, 165, 165];
                  doc.setTextColor(...npColor2);
                  doc.text(fmt2(netProfitAmt), colAmtX, y, { align: 'right' });
                  y += rowH + 4;
                }

                // ── Summary box (only for 'all') ───────────────────────────
                if (seg === 'all') {
                  checkNewPage(40);
                  y += 4;
                  doc.setDrawColor(203, 213, 225);
                  doc.setLineWidth(0.3);
                  doc.rect(marginL, y, contentW, 32, 'S');
                  doc.setLineWidth(0.2);
                  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139);
                  doc.text('RINGKASAN EKSEKUTIF', marginL + 4, y + 6);
                  const sumItems = [
                    { label: 'Jumlah Jualan', val: totalSalesAmt, color: [16, 185, 129] as [number,number,number] },
                    { label: 'Kos Jualan', val: totalCogsAmt, color: [100, 116, 139] as [number,number,number] },
                    { label: 'Untung Kasar', val: grossProfit, color: [59, 130, 246] as [number,number,number] },
                    { label: 'Perbelanjaan', val: totalExpensesAmt + taxation, color: [244, 63, 94] as [number,number,number] },
                    { label: 'Untung Bersih', val: netProfitAmt, color: netProfitAmt >= 0 ? [16, 185, 129] as [number,number,number] : [244, 63, 94] as [number,number,number] },
                  ];
                  const boxW = (contentW - 8) / sumItems.length;
                  sumItems.forEach((item, i) => {
                    const bx = marginL + 4 + i * (boxW + 2);
                    const by = y + 11;
                    doc.setFillColor(...item.color);
                    doc.rect(bx, by - 1, 2, 10, 'F');
                    doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
                    doc.text(item.label, bx + 4, by + 3);
                    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...item.color);
                    doc.text(`RM ${fmt2(item.val)}`, bx + 4, by + 9);
                  });
                  y += 38;
                }

                // ── Footer on every page ───────────────────────────────────
                const totalPages = (doc as any).internal.getNumberOfPages();
                for (let i = 1; i <= totalPages; i++) {
                  doc.setPage(i);
                  drawPageFooter(i, totalPages);
                }

                const biz = (user?.company_name || 'Monitacc').replace(/\s+/g, '_');
                doc.save(`PnL_${biz}_${segTitle}_${periodLabel.replace(/\s+/g,'_').replace(/\//g,'-')}.pdf`);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
            >
              <Download size={14} />
              Muat Turun PDF
            </button>
            <div className="w-px h-8 bg-slate-200" />
            <div className="relative">
              <button
                onClick={() => setShowPdfMenu(v => !v)}
                className="flex items-center gap-1 px-3 py-2 bg-white text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all"
              >
                <span className="text-[10px] text-slate-500 max-w-[80px] truncate">{({'all':'Semua','sales':'Jualan','cogs':'Kos Jualan','gross_profit':'Untung Kasar','other_income':'Pendapatan Lain','expenses':'Perbelanjaan','net_profit':'Untung Bersih'} as any)[pdfSegment]}</span>
                <ChevronDown size={12} className={`transition-transform ${showPdfMenu ? 'rotate-180' : ''}`} />
              </button>
              {showPdfMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 py-1.5 min-w-[170px] animate-in fade-in zoom-in duration-150">
                  <p className="text-[9px] font-black text-slate-400 px-3 py-1.5 uppercase tracking-wider border-b border-slate-50 mb-1">Pilih Bahagian PDF</p>
                  {([
                    ['all', 'Laporan Penuh'],
                    ['sales', 'Bahagian Jualan'],
                    ['cogs', 'Kos Jualan (COGS)'],
                    ['gross_profit', 'Untung Kasar'],
                    ['other_income', 'Pendapatan Lain'],
                    ['expenses', 'Perbelanjaan'],
                    ['net_profit', 'Untung/Rugi Bersih'],
                  ] as [string, string][]).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => { setPdfSegment(val as any); setShowPdfMenu(false); }}
                      className={`w-full text-left px-3 py-2 text-[10px] font-bold transition-colors flex items-center gap-2 ${pdfSegment === val ? 'text-emerald-700 bg-emerald-50' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      {pdfSegment === val && <Check size={10} className="text-emerald-600 shrink-0" />}
                      {pdfSegment !== val && <span className="w-[10px]" />}
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        {isAnnual && (
          <div className="p-10 text-center font-mono">
            <h2 className="text-sm font-bold uppercase mb-1">{companyName}</h2>
            <p className="text-[10px] font-bold text-slate-500 mb-2">No. SSM: {user?.ssm_number || '-'}</p>
            <h3 className="text-xs font-bold uppercase mb-1">PENYATA UNTUNG RUGI BAGI TAHUN BERAKHIR 31 DISEMBER {currentYear}</h3>
          </div>
        )}
        <table className={`text-left border-collapse ${isAnnual ? 'w-full max-w-2xl mx-auto my-10 font-mono' : 'min-w-[1100px] w-full'}`}>
          <colgroup>
            {!isAnnual && <>
              <col className="w-[60px]" />
              <col className="w-[140px]" />
              {months.map(m => <col key={m} className="w-[65px]" />)}
              <col className="w-[80px]" />
            </>}
          </colgroup>
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-1.5 py-3 text-[8px] font-bold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50 z-10">Kod</th>
              <th className="px-1.5 py-3 text-[8px] font-bold text-slate-500 uppercase tracking-wider sticky left-[60px] bg-slate-50 z-10">Keterangan</th>
              {!isAnnual && months.map(m => (
                <th key={m} className="px-1 py-3 text-[8px] font-bold text-slate-500 uppercase tracking-wider text-right">{m.slice(0,3).toUpperCase()}</th>
              ))}
              <th className={`px-1.5 py-3 text-[8px] font-bold text-slate-900 uppercase tracking-wider text-right ${isAnnual ? 'w-48' : 'bg-slate-100/50'}`}>
                {isAnnual ? `JUMLAH (RM) ${currentYear}` : 'TOTAL'}
              </th>
            </tr>
          </thead>
          <tbody className="text-[10px] font-medium text-slate-600 divide-y divide-slate-50">
            {/* SALES SECTION */}
            {Array.from(new Set([...Object.keys(categoryMappings).filter(cat => categoryMappings[cat] === 'SALES'), 'JUALAN (REKOD)']))
              .filter(cat => shouldShowCategory(cat, 'salesByCategory'))
              .map(cat => (
              <tr key={cat}>
                <td className="px-1.5 py-1.5 sticky left-0 bg-white z-10">{CHART_OF_ACCOUNTS[cat] || '-'}</td>
                <CategoryName name={cat} type="SALES" />
                {!isAnnual && months.map((m, idx) => (
                  <td 
                    key={m} 
                    className="px-1 py-1.5 text-right hover:bg-slate-50 cursor-pointer transition-colors group"
                    onClick={() => onCategoryClick?.(cat, idx, currentYear)}
                  >
                    <span className="text-indigo-600 group-hover:underline transition-all">{formatCurrency(monthlyData[m].salesByCategory[cat])}</span>
                  </td>
                ))}
                <td 
                  className="px-1.5 py-1.5 text-right bg-slate-50/30 hover:bg-slate-100 cursor-pointer transition-colors group"
                  onClick={() => onCategoryClick?.(cat, undefined, currentYear)}
                >
                  <span className="text-indigo-600 group-hover:underline transition-all">{formatCurrency(calculateRowTotal(`salesByCategory.${cat}`))}</span>
                </td>
              </tr>
            ))}
            <tr>
              <td className="px-1.5 py-1.5 sticky left-0 bg-white z-10"></td>
              <td className="px-1.5 py-1.5 pl-2 sticky left-[60px] bg-white z-10 italic">SALES ADJUSTMENTS</td>
              {!isAnnual && months.map((m, idx) => (
                <td 
                  key={m} 
                  className="px-1 py-1.5 text-right hover:bg-slate-50 cursor-pointer transition-colors group"
                  onClick={() => onCategoryClick?.('SALES ADJUSTMENTS', idx, currentYear)}
                >
                  <span className="group-hover:underline group-hover:text-indigo-600 transition-all">{formatCurrency(monthlyData[m].salesAdjustments)}</span>
                </td>
              ))}
              <td 
                className="px-1.5 py-1.5 text-right bg-slate-50/30 hover:bg-slate-100 cursor-pointer transition-colors group"
                onClick={() => onCategoryClick?.('SALES ADJUSTMENTS', undefined, currentYear)}
              >
                <span className="group-hover:underline group-hover:text-indigo-600 transition-all">{formatCurrency(calculateRowTotal('salesAdjustments'))}</span>
              </td>
            </tr>

            <tr className="bg-slate-50/30 font-bold text-slate-900 border-t border-slate-200">
              <td className="px-1.5 py-1.5 sticky left-0 bg-slate-50/30 z-10">{CHART_OF_ACCOUNTS['SALES']}</td>
              <td className="px-1.5 py-1.5 sticky left-[60px] bg-slate-50/30 z-10 group">
                <div className="flex items-center justify-between">
                  <span>JUMLAH JUALAN (TOTAL)</span>
                  <button 
                    onClick={() => setAddingTo(addingTo === 'SALES' ? null : 'SALES')}
                    className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-indigo-600 transition-all print:hidden"
                    title="Tambah Sub-Kategori"
                  >
                    <Plus size={10} />
                  </button>
                </div>
              </td>
              {!isAnnual && months.map((m, idx) => (
                <td 
                  key={m} 
                  className="px-1 py-1.5 text-right hover:bg-slate-100 cursor-pointer transition-colors group"
                  onClick={() => onCategoryClick?.('SALES', idx, currentYear)}
                >
                  <span className="text-indigo-600 font-bold group-hover:underline transition-all">{formatCurrency(monthlyData[m].sales)}</span>
                </td>
              ))}
              <td 
                className="px-1.5 py-1.5 text-right bg-slate-100/30 hover:bg-slate-200 cursor-pointer transition-colors group"
                onClick={() => onCategoryClick?.('SALES', undefined, currentYear)}
              >
                <span className="text-indigo-600 font-bold group-hover:underline transition-all">{formatCurrency(calculateRowTotal('sales'))}</span>
              </td>
            </tr>
            {addingTo === 'SALES' && (
              <tr className="bg-indigo-50/30">
                <td className="px-1 py-1"></td>
                <td className="px-1.5 py-1 pl-2 sticky left-[60px] bg-indigo-50/30 z-10">
                  <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-indigo-100 shadow-sm max-w-fit">
                    <select 
                      onChange={(e) => {
                        if (e.target.value !== 'CUSTOM') {
                           setNewSubCatName(e.target.value);
                        } else {
                           setNewSubCatName('');
                        }
                      }}
                      className="bg-slate-50 border-none rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none focus:ring-0 cursor-pointer"
                    >
                      <option value="">Pilih Kategori...</option>
                      {getOptionsForSection('SALES').map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                      <option value="CUSTOM">-- Taip Sendiri --</option>
                    </select>
                    <input 
                      type="text"
                      value={newSubCatName}
                      onChange={(e) => setNewSubCatName(e.target.value)}
                      placeholder="Nama Kategori..."
                      className="w-40 bg-slate-50 border border-indigo-100 rounded-lg px-3 py-1.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button 
                      onClick={() => addSubCategory('SALES')}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                      Simpan
                    </button>
                    <button 
                      onClick={() => {
                        setAddingTo(null);
                        setNewSubCatName('');
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </td>
                {!isAnnual && months.map(m => <td key={m} className="px-1 py-1"></td>)}
                <td className="px-1 py-1"></td>
              </tr>
            )}

            {/* COGS SECTION */}
            {Object.keys(categoryMappings)
              .filter(cat => categoryMappings[cat] === 'COGS')
              .filter(cat => shouldShowCategory(cat, 'cogs'))
              .map(cat => (
              <tr key={cat}>
                <td className="px-1.5 py-1.5 sticky left-0 bg-white z-10">{CHART_OF_ACCOUNTS[cat] || '-'}</td>
                <CategoryName name={cat} type="COGS" />
                {!isAnnual && months.map((m, idx) => (
                  <td 
                    key={m} 
                    className="px-1 py-1.5 text-right hover:bg-slate-50 cursor-pointer transition-colors group"
                    onClick={() => onCategoryClick?.(cat, idx, currentYear)}
                  >
                    <span className="text-indigo-600 group-hover:underline transition-all">{formatCurrency(monthlyData[m].cogs[cat])}</span>
                  </td>
                ))}
                <td 
                  className="px-1.5 py-1.5 text-right bg-slate-50/30 hover:bg-slate-100 cursor-pointer transition-colors group"
                  onClick={() => onCategoryClick?.(cat, undefined, currentYear)}
                >
                  <span className="text-indigo-600 group-hover:underline transition-all">{formatCurrency(calculateRowTotal(`cogs.${cat}`))}</span>
                </td>
              </tr>
            ))}
            <tr className="bg-slate-50/30 font-bold text-slate-900 border-t border-slate-200">
              <td className="px-1.5 py-1.5 sticky left-0 bg-slate-50/30 z-10"></td>
              <td className="px-1.5 py-1.5 sticky left-[60px] bg-slate-50/30 z-10 uppercase tracking-wider group">
                <div className="flex items-center justify-between">
                  <span>JUMLAH KOS JUALAN (TOTAL)</span>
                  <button 
                    onClick={() => setAddingTo(addingTo === 'COGS' ? null : 'COGS')}
                    className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-indigo-600 transition-all print:hidden"
                    title="Tambah Sub-Kategori"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </td>
              {!isAnnual && months.map((m, idx) => (
                <td 
                  key={m} 
                  className="px-1 py-1.5 text-right hover:bg-slate-100 cursor-pointer transition-colors group"
                  onClick={() => onCategoryClick?.('COGS', idx, currentYear)}
                >
                  <span className="text-indigo-600 font-bold group-hover:underline transition-all">{formatCurrency(monthlyData[m].cogsTotal)}</span>
                </td>
              ))}
              <td 
                className="px-1.5 py-1.5 text-right bg-slate-100/30 hover:bg-slate-200 cursor-pointer transition-colors group"
                onClick={() => onCategoryClick?.('COGS', undefined, currentYear)}
              >
                <span className="text-indigo-600 font-bold group-hover:underline transition-all">{formatCurrency(calculateRowTotal('cogsTotal'))}</span>
              </td>
            </tr>
            {addingTo === 'COGS' && (
              <tr className="bg-indigo-50/30">
                <td className="px-1 py-1"></td>
                <td className="px-1.5 py-1 pl-2 sticky left-[60px] bg-indigo-50/30 z-10">
                  <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-indigo-100 shadow-sm max-w-fit">
                    <select 
                      onChange={(e) => {
                        if (e.target.value !== 'CUSTOM') {
                          setNewSubCatName(e.target.value);
                        } else {
                          setNewSubCatName('');
                        }
                      }}
                      className="bg-slate-50 border-none rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none focus:ring-0 cursor-pointer"
                    >
                      <option value="">Pilih Kategori...</option>
                      {getOptionsForSection('COGS').map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                      <option value="CUSTOM">-- Taip Sendiri --</option>
                    </select>
                    <input 
                      type="text"
                      value={newSubCatName}
                      onChange={(e) => setNewSubCatName(e.target.value)}
                      placeholder="Nama Kategori..."
                      className="w-40 bg-slate-50 border border-indigo-100 rounded-lg px-3 py-1.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button 
                      onClick={() => addSubCategory('COGS')}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                      Simpan
                    </button>
                    <button 
                      onClick={() => {
                        setAddingTo(null);
                        setNewSubCatName('');
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </td>
                {!isAnnual && months.map(m => <td key={m} className="px-1 py-1"></td>)}
                <td className="px-1 py-1"></td>
              </tr>
            )}

            {/* GROSS PROFIT */}
            <tr className="bg-emerald-50 font-bold text-emerald-700 border-y-2 border-emerald-100">
              <td className="px-1.5 py-2 sticky left-0 bg-emerald-50 z-10"></td>
              <td className="px-1.5 py-2 sticky left-[60px] bg-emerald-50 z-10">GROSS PROFIT/(LOSS)</td>
              {!isAnnual && months.map((m, idx) => (
                <td 
                  key={m} 
                  className="px-1 py-2 text-right hover:bg-emerald-100 cursor-pointer transition-colors group"
                  onClick={() => onCategoryClick?.('GROSS PROFIT', idx, currentYear)}
                >
                  <span className="text-indigo-600 group-hover:underline transition-all">{formatCurrency(monthlyData[m].grossProfit)}</span>
                </td>
              ))}
              <td 
                className="px-1.5 py-2 text-right bg-emerald-100/30 hover:bg-emerald-200 cursor-pointer transition-colors group"
                onClick={() => onCategoryClick?.('GROSS PROFIT', undefined, currentYear)}
              >
                <span className="text-indigo-600 group-hover:underline transition-all">{formatCurrency(calculateRowTotal('grossProfit'))}</span>
              </td>
            </tr>

            {/* OTHER INCOME SECTION */}
            {Object.keys(categoryMappings)
              .filter(cat => categoryMappings[cat] === 'OTHER_INCOME')
              .filter(cat => shouldShowCategory(cat, 'otherIncome'))
              .map(cat => (
              <tr key={cat}>
                <td className="px-1.5 py-1.5 sticky left-0 bg-white z-10">{CHART_OF_ACCOUNTS[cat] || '-'}</td>
                <CategoryName name={cat} type="OTHER_INCOME" />
                {!isAnnual && months.map((m, idx) => (
                  <td 
                    key={m} 
                    className="px-1 py-1.5 text-right hover:bg-slate-50 cursor-pointer transition-colors group"
                    onClick={() => onCategoryClick?.(cat, idx, currentYear)}
                  >
                    <span className="group-hover:underline group-hover:text-indigo-600 transition-all">{formatCurrency(monthlyData[m].otherIncome[cat])}</span>
                  </td>
                ))}
                <td 
                  className="px-1.5 py-1.5 text-right bg-slate-50/30 hover:bg-slate-100 cursor-pointer transition-colors group"
                  onClick={() => onCategoryClick?.(cat, undefined, currentYear)}
                >
                  <span className="group-hover:underline group-hover:text-indigo-600 transition-all">{formatCurrency(calculateRowTotal(`otherIncome.${cat}`))}</span>
                </td>
              </tr>
            ))}
            <tr className="bg-slate-50/30 font-bold text-slate-900">
              <td className="px-1.5 py-1.5 sticky left-0 bg-slate-50/30 z-10"></td>
              <td className="px-1.5 py-1.5 sticky left-[60px] bg-slate-50/30 z-10 uppercase tracking-wider group">
                <div className="flex items-center justify-between">
                  <span>JUMLAH DUIT MASUK LAIN (TOTAL)</span>
                  <button 
                    onClick={() => setAddingTo(addingTo === 'OTHER_INCOME' ? null : 'OTHER_INCOME')}
                    className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-indigo-600 transition-all print:hidden"
                    title="Tambah Sub-Kategori"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </td>
              {!isAnnual && months.map((m, idx) => (
                <td 
                  key={m} 
                  className="px-1 py-1.5 text-right hover:bg-slate-100 cursor-pointer transition-colors group"
                  onClick={() => onCategoryClick?.('OTHER INCOMES', idx, currentYear)}
                >
                  <span className="text-indigo-600 font-bold group-hover:underline transition-all">{formatCurrency(monthlyData[m].otherIncomeTotal)}</span>
                </td>
              ))}
              <td 
                className="px-1.5 py-1.5 text-right bg-slate-100/30 hover:bg-slate-200 cursor-pointer transition-colors group"
                onClick={() => onCategoryClick?.('OTHER INCOMES', undefined, currentYear)}
              >
                <span className="text-indigo-600 font-bold group-hover:underline transition-all">{formatCurrency(calculateRowTotal('otherIncomeTotal'))}</span>
              </td>
            </tr>
            {addingTo === 'OTHER_INCOME' && (
              <tr className="bg-indigo-50/30">
                <td className="px-1 py-1"></td>
                <td className="px-1.5 py-1 pl-2 sticky left-[60px] bg-indigo-50/30 z-10">
                  <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-indigo-100 shadow-sm max-w-fit">
                    <select 
                      onChange={(e) => {
                        if (e.target.value !== 'CUSTOM') {
                          setNewSubCatName(e.target.value);
                        } else {
                          setNewSubCatName('');
                        }
                      }}
                      className="bg-slate-50 border-none rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none focus:ring-0 cursor-pointer"
                    >
                      <option value="">Pilih Kategori...</option>
                      {getOptionsForSection('OTHER_INCOME').map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                      <option value="CUSTOM">-- Taip Sendiri --</option>
                    </select>
                    <input 
                      type="text"
                      value={newSubCatName}
                      onChange={(e) => setNewSubCatName(e.target.value)}
                      placeholder="Nama Kategori..."
                      className="w-40 bg-slate-50 border border-indigo-100 rounded-lg px-3 py-1.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button 
                      onClick={() => addSubCategory('OTHER_INCOME')}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                      Simpan
                    </button>
                    <button 
                      onClick={() => {
                        setAddingTo(null);
                        setNewSubCatName('');
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </td>
                {!isAnnual && months.map(m => <td key={m} className="px-1 py-1"></td>)}
                <td className="px-1 py-1"></td>
              </tr>
            )}

            {/* EXPENSES SECTION */}
            {Object.keys(categoryMappings)
              .filter(cat => categoryMappings[cat] === 'EXPENSE')
              .filter(cat => shouldShowCategory(cat, 'expenses'))
              .map(cat => (
              <tr key={cat}>
                <td className="px-1.5 py-1.5 sticky left-0 bg-white z-10">{CHART_OF_ACCOUNTS[cat] || '-'}</td>
                <CategoryName name={cat} type="EXPENSE" />
                {!isAnnual && months.map((m, idx) => (
                  <td 
                    key={m} 
                    className="px-1 py-1.5 text-right hover:bg-slate-50 cursor-pointer transition-colors group"
                    onClick={() => onCategoryClick?.(cat, idx, currentYear)}
                  >
                    <span className="text-indigo-600 group-hover:underline transition-all">{formatCurrency(monthlyData[m].expenses[cat])}</span>
                  </td>
                ))}
                <td 
                  className="px-1.5 py-1.5 text-right bg-slate-50/30 hover:bg-slate-100 cursor-pointer transition-colors group"
                  onClick={() => onCategoryClick?.(cat, undefined, currentYear)}
                >
                  <span className="text-indigo-600 group-hover:underline transition-all">{formatCurrency(calculateRowTotal(`expenses.${cat}`))}</span>
                </td>
              </tr>
            ))}
            <tr className="bg-slate-50/30 font-bold text-slate-900">
              <td className="px-1.5 py-1.5 sticky left-0 bg-slate-50/30 z-10"></td>
              <td className="px-1.5 py-1.5 sticky left-[60px] bg-slate-50/30 z-10 uppercase tracking-wider group">
                <div className="flex items-center justify-between">
                  <span>JUMLAH BELANJA (TOTAL)</span>
                  <button 
                    onClick={() => setAddingTo(addingTo === 'EXPENSE' ? null : 'EXPENSE')}
                    className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-indigo-600 transition-all print:hidden"
                    title="Tambah Sub-Kategori"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </td>
              {!isAnnual && months.map((m, idx) => (
                <td 
                  key={m} 
                  className="px-1 py-1.5 text-right hover:bg-slate-100 cursor-pointer transition-colors group"
                  onClick={() => onCategoryClick?.('EXPENSES', idx, currentYear)}
                >
                  <span className="text-indigo-600 font-bold group-hover:underline transition-all">{formatCurrency(monthlyData[m].expensesTotal)}</span>
                </td>
              ))}
              <td 
                className="px-1.5 py-1.5 text-right bg-slate-100/30 hover:bg-slate-200 cursor-pointer transition-colors group"
                onClick={() => onCategoryClick?.('EXPENSES', undefined, currentYear)}
              >
                <span className="text-indigo-600 font-bold group-hover:underline transition-all">{formatCurrency(calculateRowTotal('expensesTotal'))}</span>
              </td>
            </tr>
            {addingTo === 'EXPENSE' && (
              <tr className="bg-indigo-50/30">
                <td className="px-1 py-1"></td>
                <td className="px-1.5 py-1 pl-2 sticky left-[60px] bg-indigo-50/30 z-10">
                  <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-indigo-100 shadow-sm max-w-fit">
                    <select 
                      onChange={(e) => {
                        if (e.target.value !== 'CUSTOM') {
                          setNewSubCatName(e.target.value);
                        } else {
                          setNewSubCatName('');
                        }
                      }}
                      className="bg-slate-50 border-none rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none focus:ring-0 cursor-pointer"
                    >
                      <option value="">Pilih Kategori...</option>
                      {getOptionsForSection('EXPENSE').map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                      <option value="CUSTOM">-- Taip Sendiri --</option>
                    </select>
                    <input 
                      type="text"
                      value={newSubCatName}
                      onChange={(e) => setNewSubCatName(e.target.value)}
                      placeholder="Nama Kategori..."
                      className="w-40 bg-slate-50 border border-indigo-100 rounded-lg px-3 py-1.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button 
                      onClick={() => addSubCategory('EXPENSE')}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                      Simpan
                    </button>
                    <button 
                      onClick={() => {
                        setAddingTo(null);
                        setNewSubCatName('');
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </td>
                {!isAnnual && months.map(m => <td key={m} className="px-1 py-1"></td>)}
                <td className="px-1 py-1"></td>
              </tr>
            )}

            {/* TAXATION */}
            <tr>
              <td className="px-1.5 py-1.5 sticky left-0 bg-white z-10 font-bold text-slate-900">{CHART_OF_ACCOUNTS['Provision for taxation']}</td>
              <td className="px-1.5 py-1.5 sticky left-[60px] bg-white z-10 font-bold text-slate-900 group">
                <div className="flex items-center justify-between">
                  <span>TAXATION</span>
                  <button 
                    onClick={() => setAddingTo(addingTo === 'TAXATION' ? null : 'TAXATION')}
                    className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-indigo-600 transition-all print:hidden"
                    title="Tambah Sub-Kategori"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </td>
              {!isAnnual && months.map((m, idx) => (
                <td 
                  key={m} 
                  className="px-1 py-1.5 text-right hover:bg-slate-50 cursor-pointer transition-colors group"
                  onClick={() => onCategoryClick?.('Provision for taxation', idx, currentYear)}
                >
                  <span className="text-indigo-600 font-bold group-hover:underline transition-all">{formatCurrency(monthlyData[m].taxation)}</span>
                </td>
              ))}
              <td 
                className="px-1.5 py-1.5 text-right bg-slate-50/30 hover:bg-slate-100 cursor-pointer transition-colors group"
                onClick={() => onCategoryClick?.('Provision for taxation', undefined, currentYear)}
              >
                <span className="text-indigo-600 font-bold group-hover:underline transition-all">{formatCurrency(calculateRowTotal('taxation'))}</span>
              </td>
            </tr>
            {addingTo === 'TAXATION' && (
              <tr className="bg-indigo-50/30">
                <td className="px-1 py-1"></td>
                <td className="px-1.5 py-1 pl-2 sticky left-[60px] bg-indigo-50/30 z-10">
                  <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-indigo-100 shadow-sm max-w-fit">
                    <select 
                      onChange={(e) => {
                        if (e.target.value !== 'CUSTOM') {
                          setNewSubCatName(e.target.value);
                        }
                      }}
                      className="bg-slate-50 border-none rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none focus:ring-0 cursor-pointer"
                    >
                      <option value="">Pilih Kategori...</option>
                      {getOptionsForSection('TAXATION').map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                      <option value="CUSTOM">-- Taip Sendiri --</option>
                    </select>
                    <input 
                      type="text"
                      value={newSubCatName}
                      onChange={(e) => setNewSubCatName(e.target.value)}
                      placeholder="Nama..."
                      className="w-32 bg-slate-50 border-none rounded-lg px-3 py-1.5 text-[10px] font-bold outline-none focus:ring-0"
                    />
                    <button 
                      onClick={() => addSubCategory('TAXATION')}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition-colors"
                    >
                      Simpan
                    </button>
                    <button 
                      onClick={() => setAddingTo(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </td>
                {!isAnnual && months.map(m => <td key={m} className="px-1 py-1"></td>)}
                <td className="px-1 py-1"></td>
              </tr>
            )}

            {/* NET PROFIT */}
            <tr className="bg-slate-900 font-bold text-white border-y-2 border-slate-800">
              <td className="px-1.5 py-2 sticky left-0 bg-slate-900 z-10"></td>
              <td className="px-1.5 py-2 sticky left-[60px] bg-slate-900 z-10">NET PROFIT / LOSS</td>
              {!isAnnual && months.map((m, idx) => (
                <td 
                  key={m} 
                  className="px-1 py-2 text-right hover:bg-slate-800 cursor-pointer transition-colors group"
                  onClick={() => onCategoryClick?.('NET PROFIT', idx, currentYear)}
                >
                  <span className="text-indigo-400 group-hover:underline transition-all">{formatCurrency(monthlyData[m].netProfit)}</span>
                </td>
              ))}
              <td 
                className="px-1.5 py-2 text-right bg-slate-800 hover:bg-slate-700 cursor-pointer transition-colors group"
                onClick={() => onCategoryClick?.('NET PROFIT', undefined, currentYear)}
              >
                <span className="text-indigo-400 group-hover:underline transition-all">{formatCurrency(calculateRowTotal('netProfit'))}</span>
              </td>
            </tr>
          </tbody>
        </table>
        
        <div className="mt-20 pt-10 border-t border-dashed border-slate-200 text-center max-w-2xl mx-auto pb-20 font-mono">
          <p className="text-[10px] font-bold text-slate-900 uppercase mb-1">{user?.company_name || 'MONITACC ENTERPRISE'}</p>
          <p className="text-[9px] text-slate-500 mb-6">No. SSM: {user?.ssm_number || '-'}</p>
          <p className="text-[9px] text-slate-400 italic">
            Saya/Kami dengan ini mengesahkan bahawa penyata yang diberikan di atas adalah benar dan betul mengikut pengetahuan dan kepercayaan saya/kami.
          </p>
          <div className="mt-12 w-48 border-b border-slate-400 mx-auto"></div>
          <p className="mt-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">Tandatangan Pengarah / Pemilik</p>
        </div>
      </div>
      </div>
    </div>
  );
};

const ReportsView = ({ 
  stats: initialStats, 
  salesStats: initialSalesStats, 
  records, 
  sales, 
  user, 
  categoryMappings,
  setCategoryMappings,
  onCategoryClick 
}: { 
  stats: Stats | null, 
  salesStats: any, 
  records: TransactionRecord[], 
  sales: Sale[], 
  user: UserType | null, 
  categoryMappings: Record<string, any>,
  setCategoryMappings: (mappings: any) => void,
  onCategoryClick: (category: string, month?: number, year?: number) => void 
}) => {
  const [isAnnualMode, setIsAnnualMode] = useState(false);
  const [reportType, setReportType] = useState<'monthly' | 'yearly' | 'custom'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Update selected month/year based on latest data when records or sales change
  useEffect(() => {
    if (records.length > 0 || sales.length > 0) {
      const allDates = [
        ...records.map(r => parseISO(r.date)), 
        ...sales.map(s => parseISO(s.date))
      ].filter(d => !isNaN(d.getTime()));
      
      if (allDates.length > 0) {
        const latestDate = new Date(Math.max(...allDates.map(d => d.getTime())));
        setSelectedMonth(latestDate.getMonth());
        setSelectedYear(latestDate.getFullYear());
      }
    }
  }, [records.length, sales.length]);
  const [startDate, setStartDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const COLORS = ['#10b981', '#34d399', '#059669', '#f59e0b', '#8b5cf6', '#f43f5e'];

  // Filter records and sales based on selected month/year or custom range
  const filteredRecords = records.filter(r => {
    const date = parseISO(r.date);
    if (reportType === 'monthly') {
      return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
    } else if (reportType === 'yearly') {
      return date.getFullYear() === selectedYear;
    } else {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      // Normalize to start of day for comparison
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      return d >= s && d <= e;
    }
  });

  const filteredSales = sales.filter(s => {
    const date = parseISO(s.date);
    if (reportType === 'monthly') {
      return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
    } else if (reportType === 'yearly') {
      return date.getFullYear() === selectedYear;
    } else {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      return d >= s && d <= e;
    }
  });

  // Calculate stats from filtered data (P&L only)
  const salesBreakdown = new Map<string, number>();
  const cogsBreakdown = new Map<string, number>();
  const expenseBreakdown = new Map<string, number>();
  const otherIncomeBreakdown = new Map<string, number>();
  
  let salesFromRecords = 0;

  const assetLiabSet = new Set(ASSET_LIABILITY_CATEGORIES.map(c => c.toUpperCase()));

  filteredRecords.forEach(r => {
    if (r.sale_id) return;
    const category = r.category.trim().toUpperCase();
    const type = categoryMappings[category] || 'EXPENSE';

    // Skip Asset/Liability categories for P&L stats
    if (assetLiabSet.has(category) || type === 'ASSET_LIABILITY') return;

    if (r.type === 'income') {
      if (type === 'SALES') {
        salesBreakdown.set(category, (salesBreakdown.get(category) || 0) + r.amount);
      } else {
        otherIncomeBreakdown.set(category, (otherIncomeBreakdown.get(category) || 0) + r.amount);
      }
    } else {
      if (type === 'COGS') {
        cogsBreakdown.set(category, (cogsBreakdown.get(category) || 0) + r.amount);
      } else {
        expenseBreakdown.set(category, (expenseBreakdown.get(category) || 0) + r.amount);
      }
    }
  });

  filteredSales.forEach(s => {
    salesFromRecords += s.total;
  });

  const totalSales = salesFromRecords + Array.from(salesBreakdown.values()).reduce((a, b) => a + b, 0);
  const otherIncomeTotal = Array.from(otherIncomeBreakdown.values()).reduce((a, b) => a + b, 0);
  const totalIncome = totalSales + otherIncomeTotal;
  
  const totalCogs = Array.from(cogsBreakdown.values()).reduce((a, b) => a + b, 0);
  const totalOtherExpenses = Array.from(expenseBreakdown.values()).reduce((a, b) => a + b, 0);
  const totalExpense = totalCogs + totalOtherExpenses;

  const incomeList = [
    ...(salesFromRecords > 0 ? [{ category: 'JUALAN (REKOD)', total: salesFromRecords, type: 'SALES' }] : []),
    ...Array.from(salesBreakdown.entries()).map(([category, total]) => ({ category, total, type: 'SALES' })),
    ...Array.from(otherIncomeBreakdown.entries()).map(([category, total]) => ({ category, total, type: 'OTHER_INCOME' }))
  ].sort((a, b) => {
    if (a.type === b.type) return b.total - a.total;
    return a.type === 'SALES' ? -1 : 1;
  });

  const expenseList = [
    ...Array.from(cogsBreakdown.entries()).map(([category, total]) => ({ category, total, type: 'COGS' })),
    ...Array.from(expenseBreakdown.entries()).map(([category, total]) => ({ category, total, type: 'EXPENSE' }))
  ].sort((a, b) => {
    if (a.type === b.type) return b.total - a.total;
    return a.type === 'COGS' ? -1 : 1;
  });

  const comparisonData = [
    { name: 'Jualan', value: totalSales, fill: '#10b981' },
    { name: 'Duit Masuk Lain', value: otherIncomeTotal, fill: '#34d399' },
    { name: 'Duit Keluar', value: totalExpense, fill: '#f43f5e' },
  ];

  const months = [
    'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
    'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const handleReportPdf = () => {
    if (reportType === 'yearly') {
      const sm = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const md: any = {};
      sm.forEach(m => {
        md[m] = { sales: 0, salesByCategory: {}, salesAdjustments: 0, cogs: {}, otherIncome: {}, expenses: {}, taxation: 0 };
      });
      sales.filter(s => parseISO(s.date).getFullYear() === selectedYear).forEach(s => {
        const mi = sm[parseISO(s.date).getMonth()];
        md[mi].sales += s.total;
        const sc = (s.category || 'JUALAN (REKOD)').trim().toUpperCase();
        md[mi].salesByCategory[sc] = (md[mi].salesByCategory[sc] || 0) + s.total;
      });
      const pdfAssetLiabSet2 = new Set(ASSET_LIABILITY_CATEGORIES.map(c => c.toUpperCase()));
      records.filter(r => !r.sale_id && parseISO(r.date).getFullYear() === selectedYear).forEach(r => {
        const mi = sm[parseISO(r.date).getMonth()];
        const cat = r.category.trim().toUpperCase();
        const type = categoryMappings[cat] || 'EXPENSE';
        if (pdfAssetLiabSet2.has(cat) || type === 'ASSET_LIABILITY') return;
        if (r.type === 'income') {
          if (type === 'SALES') { md[mi].sales += r.amount; md[mi].salesByCategory[cat] = (md[mi].salesByCategory[cat] || 0) + r.amount; }
          else if (cat.includes('ADJUSTMENT')) md[mi].salesAdjustments += r.amount;
          else md[mi].otherIncome[cat] = (md[mi].otherIncome[cat] || 0) + r.amount;
        } else {
          if (type === 'COGS') md[mi].cogs[cat] = (md[mi].cogs[cat] || 0) + r.amount;
          else if (type === 'TAXATION' || cat.includes('TAX') || cat.includes('CUKAI')) md[mi].taxation += r.amount;
          else md[mi].expenses[cat] = (md[mi].expenses[cat] || 0) + r.amount;
        }
      });
      generatePDFReport(user, reportType, selectedMonth, selectedYear, filteredRecords, filteredSales, incomeList, expenseList, totalIncome, totalExpense, totalSales, startDate, endDate, md, categoryMappings);
    } else {
      generatePDFReport(user, reportType, selectedMonth, selectedYear, filteredRecords, filteredSales, incomeList, expenseList, totalIncome, totalExpense, totalSales, startDate, endDate);
    }
  };

  return (
    <div className="pb-28 md:p-6 md:pb-24 md:pl-64 md:pt-12 max-w-7xl mx-auto">

      {/* ── Mobile Header ── */}
      <div className="lg:hidden bg-white border-b border-slate-100 px-4 pt-5 pb-4 space-y-3 print:hidden">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Laporan Kewangan</h2>
            <p className="text-slate-400 text-[11px] mt-0.5">Analisa prestasi perniagaan</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { setIsAnnualMode(true); setTimeout(() => { window.print(); setIsAnnualMode(false); }, 500); }}
              className="h-8 w-8 flex items-center justify-center bg-slate-100 text-slate-600 rounded-xl transition-all"
            >
              <FileText size={14} />
            </button>
            <button
              onClick={handleReportPdf}
              className="h-8 px-3 flex items-center gap-1.5 bg-emerald-600 text-white rounded-xl text-[11px] font-bold transition-all"
            >
              <Download size={13} />
              PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 bg-slate-100 rounded-2xl p-1 gap-1">
          {[
            { id: 'monthly', label: 'Bulanan' },
            { id: 'yearly', label: 'Tahunan' },
            { id: 'custom', label: 'Khas' },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setReportType(opt.id as any)}
              className={`py-2 rounded-xl text-[11px] font-semibold transition-all ${
                reportType === opt.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {(reportType === 'monthly' || reportType === 'yearly') && (
          <div className="flex gap-2">
            {reportType === 'monthly' && (
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
              >
                {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            )}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
        {reportType === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none" />
            <span className="text-slate-300">—</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none" />
          </div>
        )}
      </div>

      {/* ── Desktop Header ── */}
      <header className="hidden lg:flex mb-10 flex-row justify-between items-center print:hidden gap-6 px-0 pt-0">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-1 font-display">Laporan Kewangan</h2>
          <p className="text-slate-500 text-sm font-medium">Analisa mendalam prestasi perniagaan anda.</p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <button onClick={handleReportPdf}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-sm">
            <Download size={16} />
            Muat Turun PDF
          </button>
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button onClick={() => setReportType('monthly')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${reportType === 'monthly' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>Bulanan</button>
            <button onClick={() => setReportType('yearly')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${reportType === 'yearly' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>Tahunan</button>
            <button onClick={() => setReportType('custom')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${reportType === 'custom' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>Khas</button>
          </div>
          <div className="flex gap-2 items-center">
            {reportType === 'monthly' && (
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20">
                {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            )}
            {(reportType === 'monthly' || reportType === 'yearly') && (
              <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20">
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
            {reportType === 'custom' && (
              <div className="flex items-center gap-2">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20" />
                <span className="text-slate-400 font-bold text-xs">ke</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20" />
              </div>
            )}
          </div>
          <button onClick={() => { setIsAnnualMode(true); setTimeout(() => { window.print(); setIsAnnualMode(false); }, 500); }}
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-sm font-bold hover:bg-slate-800 transition-all shadow-xl">
            <FileText size={18} />
            Cetak Laporan
          </button>
        </div>
      </header>

      <div className="px-4 md:px-0">

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
        <div className="lg:col-span-8 card-premium p-4 md:p-8 bg-white">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 md:mb-8">
            <h3 className="text-lg font-bold text-slate-900 tracking-tight font-display">Perbandingan Prestasi</h3>
            <div className="flex flex-wrap gap-3">
              {comparisonData.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{d.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="h-[280px] md:h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} barCategoryGap="35%" margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} tickFormatter={(v) => `RM${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px' }}
                  formatter={(value: any) => [`RM ${Number(value).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`, 'Jumlah']}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={100} minPointSize={4}>
                  {comparisonData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 card-premium p-8 bg-slate-900 text-white relative overflow-hidden flex flex-col justify-center text-center">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <TrendingUp size={120} strokeWidth={1} />
          </div>
          <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center mx-auto mb-6 border border-white/10">
            <ShoppingCart size={24} className="text-emerald-400" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Total Jualan Keseluruhan</p>
          <h3 className="text-4xl font-bold tracking-tight font-display">
            RM {totalSales.toLocaleString()}
          </h3>
          <div className="mt-6 px-4 py-2 bg-white/5 rounded-lg border border-white/10 inline-block mx-auto">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Berdasarkan rekod jualan pintar</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
        <div className="lg:col-span-5 card-premium p-4 md:p-8 bg-white">
          <h3 className="text-lg font-bold mb-6 md:mb-8 tracking-tight font-display text-slate-900">Pecahan Duit Keluar</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={expenseList}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="total"
                  nameKey="category"
                >
                  {expenseList.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px' }}
                />
              </RePieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-8 space-y-3">
            {expenseList.map((item, i) => {
              const CategoryIcon = getCategoryIcon(item.category);
              const percentage = totalExpense > 0 ? ((item.total / totalExpense) * 100).toFixed(1) : '0.0';
              return (
                <div key={i} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded-2xl transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm transition-transform group-hover:scale-105" style={{ backgroundColor: `${COLORS[i % COLORS.length]}10`, color: COLORS[i % COLORS.length] }}>
                      <CategoryIcon size={20} strokeWidth={2} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">{item.category}</span>
                        <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-100/50">
                          {percentage}%
                        </span>
                      </div>
                      <div className="w-32 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full" 
                          style={{ 
                            width: `${percentage}%`, 
                            backgroundColor: COLORS[i % COLORS.length] 
                          }} 
                        />
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">RM</p>
                    <p className="text-lg font-bold text-slate-900 font-display leading-none">
                      {(item.total || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-7 card-premium p-4 md:p-8 bg-white">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 mb-6 md:mb-10">
            <div>
              <h3 className="text-lg font-bold tracking-tight font-display text-slate-900">Penyata Untung Rugi</h3>
              <p className="text-slate-500 text-xs font-medium">Ringkasan kewangan (P&L Statement)</p>
            </div>
            <div className="px-3 py-1 bg-slate-50 rounded-md border border-slate-200">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                {reportType === 'monthly' ? `${months[selectedMonth]} ${selectedYear}` : 
                 reportType === 'yearly' ? `Tahun Kewangan ${selectedYear}` :
                 `${format(parseISO(startDate), 'dd/MM/yyyy')} - ${format(parseISO(endDate), 'dd/MM/yyyy')}`}
              </p>
            </div>
          </div>
          
          <div className="space-y-10">
            <section>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Duit Masuk</h4>
              <div className="space-y-3">
                {incomeList.map((item, i) => (
                  <div 
                    key={i} 
                    className="flex justify-between py-3 border-b border-slate-50 px-2 group hover:bg-slate-50 cursor-pointer transition-colors rounded-lg"
                    onClick={() => onCategoryClick(item.category, reportType === 'monthly' ? selectedMonth : undefined, selectedYear)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-600">{item.category}</span>
                      <ChevronRight size={12} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <span className="font-bold text-slate-900 text-base font-display">RM {item.total.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between py-4 px-6 font-bold text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-100 mt-4">
                  <span className="uppercase tracking-wider text-[10px]">Jumlah Duit Masuk</span>
                  <span className="text-xl font-display">RM {totalIncome.toLocaleString()}</span>
                </div>
              </div>
            </section>

            <section>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Duit Keluar</h4>
              <div className="space-y-3">
                {expenseList.map((item, i) => (
                  <div 
                    key={i} 
                    className="flex justify-between py-3 border-b border-slate-50 px-2 group hover:bg-slate-50 cursor-pointer transition-colors rounded-lg"
                    onClick={() => onCategoryClick(item.category, reportType === 'monthly' ? selectedMonth : undefined, selectedYear)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-600">{item.category}</span>
                      <ChevronRight size={12} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <span className="font-bold text-slate-900 text-base font-display">RM {item.total.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between py-4 px-6 font-bold text-rose-700 bg-rose-50 rounded-xl border border-rose-100 mt-4">
                  <span className="uppercase tracking-wider text-[10px]">Jumlah Duit Keluar</span>
                  <span className="text-xl font-display">RM {totalExpense.toLocaleString()}</span>
                </div>
              </div>
            </section>

            <section className="pt-6 border-t-2 border-slate-900">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 py-4 md:py-6 px-4 md:px-8 bg-slate-900 text-white rounded-2xl shadow-xl">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Baki Tunai</h4>
                  <p className="text-[10px] font-medium text-slate-500">Selepas ditolak kos operasi</p>
                </div>
                <span className={`text-2xl md:text-4xl font-bold tracking-tight font-display ${(totalIncome - totalExpense) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  RM {(totalIncome - totalExpense).toLocaleString()}
                </span>
              </div>
            </section>
          </div>
        </div>
      </div>
      
      <div className="print:break-after-page">
        <ProfitLossReport 
          records={filteredRecords} 
          sales={filteredSales} 
          user={user} 
          isAnnualOverride={isAnnualMode} 
          selectedYear={selectedYear} 
          categoryMappings={categoryMappings}
          setCategoryMappings={setCategoryMappings}
          onCategoryClick={onCategoryClick}
          reportType={reportType}
          startDate={startDate}
          endDate={endDate}
          selectedMonth={selectedMonth}
        />
      </div>
      <div className="print:break-before-page">
        <BalanceSheetReport 
          records={records} 
          sales={sales} 
          user={user} 
          selectedYear={selectedYear} 
          reportType={reportType}
          startDate={startDate}
          endDate={endDate}
          selectedMonth={selectedMonth}
          onCategoryClick={onCategoryClick}
          categoryMappings={categoryMappings}
        />
      </div>
      </div>
    </div>
  );
};

const BalanceSheetReport = ({ 
  records, 
  sales, 
  user, 
  selectedYear: propYear,
  reportType,
  startDate,
  endDate,
  selectedMonth,
  onCategoryClick,
  categoryMappings
}: { 
  records: TransactionRecord[], 
  sales: Sale[], 
  user: UserType | null, 
  selectedYear?: number,
  reportType?: 'monthly' | 'yearly' | 'custom',
  startDate?: string,
  endDate?: string,
  selectedMonth?: number,
  onCategoryClick?: (category: string, month?: number, year?: number) => void,
  categoryMappings: Record<string, any>
}) => {
  const currentYear = reportType === 'custom' && startDate ? 
    parseISO(startDate).getFullYear() : 
    (propYear || new Date().getFullYear());
  
  const [customAsAtDate, setCustomAsAtDate] = useState<string | null>(null);

  const asAtDate = customAsAtDate ? format(parseISO(customAsAtDate), 'dd/MM/yyyy') : (
    reportType === 'monthly' && selectedMonth !== undefined ? 
      format(new Date(currentYear, selectedMonth + 1, 0), 'dd/MM/yyyy') :
      reportType === 'yearly' ? `31/12/${currentYear}` :
      reportType === 'custom' && endDate ? format(parseISO(endDate), 'dd/MM/yyyy') :
      `31/12/${currentYear}`
  );

  const companyName = user?.company_name || 'MONITACC ENTERPRISE';

  // Calculate Net Profit for Retained Earnings
  // We need two parts:
  // 1. Profit for the current selected period (to match P&L)
  // 2. Profit from all prior periods

  const assetLiabilitySet = new Set(ASSET_LIABILITY_CATEGORIES.map(c => c.toUpperCase()));

  const calculateProfitForPeriod = (periodRecords: TransactionRecord[], periodSales: Sale[]) => {
    let income = 0;
    let expense = 0;

    periodSales.forEach(s => {
      const sCat = (s.category || '').trim().toUpperCase();
      if (assetLiabilitySet.has(sCat)) return;
      income += s.total;
    });

    periodRecords.forEach(r => {
      if (r.sale_id) return;
      const category = r.category.trim().toUpperCase();

      if (assetLiabilitySet.has(category) || categoryMappings[category] === 'ASSET_LIABILITY') return;

      if (r.type === 'income') {
        income += r.amount;
      } else {
        expense += r.amount;
      }
    });

    return income - expense;
  };

  const startOfPeriod = reportType === 'monthly' && selectedMonth !== undefined ? 
    new Date(currentYear, selectedMonth, 1) :
    reportType === 'yearly' ? new Date(currentYear, 0, 1) :
    reportType === 'custom' && startDate ? parseISO(startDate) :
    new Date(currentYear, 0, 1);
  startOfPeriod.setHours(0, 0, 0, 0);

  const endOfPeriod = reportType === 'monthly' && selectedMonth !== undefined ? 
    new Date(currentYear, selectedMonth + 1, 0) :
    reportType === 'yearly' ? new Date(currentYear, 11, 31) :
    reportType === 'custom' && endDate ? parseISO(endDate) :
    new Date(currentYear, 11, 31);
  
  const effectiveEndOfPeriod = customAsAtDate ? parseISO(customAsAtDate) : endOfPeriod;
  effectiveEndOfPeriod.setHours(23, 59, 59, 999);

  // Prior Period Data
  const priorRecords = records.filter(r => parseISO(r.date) < startOfPeriod);
  const priorSales = sales.filter(s => parseISO(s.date) < startOfPeriod);
  const priorProfit = calculateProfitForPeriod(priorRecords, priorSales);

  // Current Period Data (Matches P&L)
  const currentRecords = records.filter(r => {
    const d = parseISO(r.date);
    return d >= startOfPeriod && d <= effectiveEndOfPeriod;
  });
  const currentSales = sales.filter(s => {
    const d = parseISO(s.date);
    return d >= startOfPeriod && d <= effectiveEndOfPeriod;
  });
  const currentPeriodProfit = calculateProfitForPeriod(currentRecords, currentSales);

  // Total Cumulative Profit
  const netProfit = priorProfit + currentPeriodProfit;

  // Balance Sheet is cumulative. We filter all data up to the effectiveEndOfPeriod.
  const filteredRecords = records.filter(r => parseISO(r.date) <= effectiveEndOfPeriod);
  const filteredSales = sales.filter(s => parseISO(s.date) <= effectiveEndOfPeriod);

  // Asset Categories
  const fixedAssetCats = [
    "FIXED ASSETS", "MOTOR VEHICLES", "FURNITURE AND FITTINGS", "OFFICE EQUIPMENT", 
    "COMPUTER AND SOFTWARE", "KITCHEN UTENSIL", "RENOVATION", "SIGNBOARD", "BUILDING", "GOODWILL"
  ];
  const contraAssetCats = [
    "ACCUM. DEPRN - MOTOR VEHICLES", "ACCUM. DEPRN - FURNITURE AND FITTINGS", 
    "ACCUM. DEPRN - OFFICE EQUIPMENT", "ACCUM. DEPRN - COMPUTER AND SOFTWARE", 
    "ACCUM. DEPRN - KITCHEN UTENSIL", "ACCUM. DEPRN - RENOVATION", "PROVISION FOR DOUBTFUL DEBT"
  ];
  const bankCats = ["BANK", ...BANK_LIST];
  const cashCats = ["CASH IN HAND", "TUNAI DI TANGAN"];
  const debtorCats = ["TRADE DEBTORS", "OTHER DEBTORS", "EN SALLEH", "MORGAN SDN BHD"];
  const stockCats = ["STOCK"];
  const depositCats = ["DEPOSIT & PREPAYMENT", "DEPOSIT - RENTAL", "PREPAYMENT - UTILITIES"];

  // Liability Categories
  const accrualCats = ["ACCRUALS", "ACCRUALS - AUDIT FEE", "ACCRUALS - ACCOUNTING FEE", "ACCRUALS - TAX FEE"];
  const creditorCats = ["TRADE CREDITORS", "OTHER CREDITORS"];
  const loanCats = ["HIRE PURCHASE CREDITOR", "TERM LOAN"];
  const taxCats = ["PROVISION FOR TAXATION"];

  // Equity Categories
  const capitalCats = ["CAPITAL"];
  const drawingCats = ["AMOUNT DUE FROM DIRECTOR", "AMOUNT DUE TO DIRECTOR"];

  const getBalance = (categories: string[]) => {
    const lowerCats = categories.map(c => c.toLowerCase());
    return filteredRecords.filter(r => lowerCats.includes(r.category.toLowerCase())).reduce((sum, r) => {
      const cat = r.category.toLowerCase();
      
      // Fixed Assets: Expense increases value (buying), Income decreases (selling)
      if (fixedAssetCats.map(c => c.toLowerCase()).includes(cat)) {
        return sum + (r.type === 'expense' ? r.amount : -r.amount);
      }
      
      // Contra Assets (Depreciation): Expense increases contra-value (decreases total asset), Income decreases it
      if (contraAssetCats.map(c => c.toLowerCase()).includes(cat)) {
        return sum - (r.type === 'expense' ? r.amount : -r.amount);
      }
      
      // Current Assets (Bank, Cash, Debtors, Stock, Deposits): Income increases, Expense decreases
      if (
        bankCats.map(c => c.toLowerCase()).includes(cat) || 
        cashCats.map(c => c.toLowerCase()).includes(cat) || 
        debtorCats.map(c => c.toLowerCase()).includes(cat) || 
        stockCats.map(c => c.toLowerCase()).includes(cat) || 
        depositCats.map(c => c.toLowerCase()).includes(cat)
      ) {
        return sum + (r.type === 'income' ? r.amount : -r.amount);
      }
      
      // Liabilities: Income increases (loan taken), Expense decreases (loan paid)
      if (
        accrualCats.map(c => c.toLowerCase()).includes(cat) || 
        creditorCats.map(c => c.toLowerCase()).includes(cat) || 
        loanCats.map(c => c.toLowerCase()).includes(cat) || 
        taxCats.map(c => c.toLowerCase()).includes(cat)
      ) {
        return sum + (r.type === 'income' ? r.amount : -r.amount);
      }
      
      // Equity: Income increases (capital injection), Expense decreases (drawings)
      if (capitalCats.map(c => c.toLowerCase()).includes(cat) || drawingCats.map(c => c.toLowerCase()).includes(cat)) {
        return sum + (r.type === 'income' ? r.amount : -r.amount);
      }
      
      return sum;
    }, 0);
  };

  const fixedAssets = getBalance(fixedAssetCats) + getBalance(contraAssetCats);
  const cash = filteredRecords.reduce((sum, r) => {
    const category = r.category.trim().toUpperCase();
    const isAssetLiability = assetLiabilitySet.has(category) || categoryMappings[category] === 'ASSET_LIABILITY';
    const isCashCategory = cashCats.map(c => c.toLowerCase()).includes(category.toLowerCase());

    // 1. Direct adjustments where Cash is the category
    if (isCashCategory) {
      return sum + (r.type === 'income' ? r.amount : -r.amount);
    }

    if (r.sale_id) return sum;

    // 2. Transactions where Cash is the payment method but NOT the category
    if (!isCashCategory && r.payment_method === 'cash') {
      if (!isAssetLiability) {
        return sum + (r.type === 'income' ? r.amount : -r.amount);
      } else {
        return sum + (r.type === 'income' ? -r.amount : r.amount);
      }
    }

    return sum;
  }, 0) + filteredSales.reduce((sum, s) => {
    const sCat = (s.category || '').trim().toUpperCase();
    if (assetLiabilitySet.has(sCat)) return sum;
    if (s.payment_method === 'cash') {
      return sum + s.total;
    }
    return sum;
  }, 0);

  const debtors = getBalance(debtorCats);
  const stock = getBalance(stockCats);
  let deposits = getBalance(depositCats);
  let accruals = getBalance(accrualCats);

  // Reclassify negative deposits to accruals as requested by user
  if (deposits < 0) {
    accruals += Math.abs(deposits);
    deposits = 0;
  }

  const creditors = getBalance(creditorCats);
  const loans = getBalance(loanCats);
  const taxProvision = getBalance(taxCats);

  const capital = getBalance(capitalCats);
  const drawings = getBalance(drawingCats);
  const retainedEarnings = netProfit;

  // In a single-entry system, we derive the Bank/Cash balance from the accounting equation:
  // Assets = Liabilities + Equity
  // Bank + FixedAssets + Cash + Debtors + Stock + Deposits = Liabilities + Capital + Drawings + RetainedEarnings
  // Bank = (Liabilities + Capital + Drawings + RetainedEarnings) - (FixedAssets + Cash + Debtors + Stock + Deposits)
  
  const totalCurrentLiabilities = accruals + creditors + loans + taxProvision;
  const totalEquity = capital + drawings + retainedEarnings;
  const otherAssets = fixedAssets + cash + debtors + stock + deposits;
  
  // Calculate bank as the balancing figure to ensure the balance sheet always balances
  const bank = totalEquity + totalCurrentLiabilities - otherAssets;
  
  const totalCurrentAssets = bank + cash + debtors + stock + deposits;
  const netCurrentAssets = totalCurrentAssets - totalCurrentLiabilities;
  const totalAssets = fixedAssets + netCurrentAssets;

  const formatCurrency = (val: number | undefined | null) => {
    if (val === undefined || val === null || val === 0) return '-';
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="card-premium p-0 overflow-hidden bg-white mt-10 mb-20 print:shadow-none print:border-none">
      <div className="p-4 md:p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <h3 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight font-display">Kunci Kira-Kira</h3>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-slate-500 text-xs font-medium">Kedudukan kewangan setakat</p>
              <input 
                type="date" 
                value={customAsAtDate || format(endOfPeriod, 'yyyy-MM-dd')}
                onChange={(e) => setCustomAsAtDate(e.target.value)}
                className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border-none focus:ring-0 cursor-pointer print:hidden"
              />
              <span className="hidden print:inline text-xs font-bold text-slate-900">{asAtDate}</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageW = 210;
            const pageH = 297;
            const mL = 25;
            const mR = 25;
            const amtX = pageW - mR;
            const amtW = 40;
            const rH = 7;
            let y = 0;

            const f = (v: number) => Math.abs(v).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            const addPage = () => { doc.addPage(); y = 28; };
            const chk = (n = rH) => { if (y + n > pageH - 22) addPage(); };

            // ── Header (center-block, minimal) ─────────────────────────
            y = 28;
            doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(20, 20, 20);
            doc.text(companyName.toUpperCase(), pageW / 2, y, { align: 'center' });
            y += 5.5;
            doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(120, 120, 120);
            doc.text(`No. SSM: ${user?.ssm_number || '-'}`, pageW / 2, y, { align: 'center' });
            y += 5;
            doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(20, 20, 20);
            doc.text('KUNCI KIRA-KIRA (BALANCE SHEET)', pageW / 2, y, { align: 'center' });
            y += 4.5;
            doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(120, 120, 120);
            doc.text(`Pada Tarikh: ${asAtDate}`, pageW / 2, y, { align: 'center' });
            y += 5;
            // thin rule under header
            doc.setDrawColor(20, 20, 20); doc.setLineWidth(0.5);
            doc.line(mL, y, pageW - mR, y);
            doc.setLineWidth(0.15);
            y += 7;

            // ── Helpers ────────────────────────────────────────────────
            const colHdr = (left: string, right: string) => {
              doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(120, 120, 120);
              doc.text(left.toUpperCase(), mL, y);
              doc.text(right, amtX, y, { align: 'right' });
              doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.1);
              doc.line(mL, y + 1.5, pageW - mR, y + 1.5);
              y += rH - 1;
            };

            const sectionHdr = (label: string) => {
              chk(rH + 2);
              y += 3;
              doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(20, 20, 20);
              doc.text(label.toUpperCase(), mL, y);
              y += rH - 2;
              doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.1);
              doc.line(mL, y - 1, pageW - mR, y - 1);
              y += 2;
            };

            const row = (label: string, val: number | null, bold = false) => {
              if (val !== null && val === 0) return;
              chk();
              doc.setFont('helvetica', bold ? 'bold' : 'normal');
              doc.setFontSize(bold ? 8 : 8);
              doc.setTextColor(bold ? 20 : 55, bold ? 20 : 55, bold ? 20 : 55);
              doc.text(bold ? label : `    ${label}`, mL, y);
              if (val !== null) {
                doc.setTextColor(val < 0 ? 180 : (bold ? 20 : 55), val < 0 ? 30 : (bold ? 20 : 55), val < 0 ? 30 : (bold ? 20 : 55));
                doc.text(f(val), amtX, y, { align: 'right' });
              }
              y += rH;
            };

            const subtotal = (label: string, val: number) => {
              chk(rH + 3);
              doc.setDrawColor(160, 160, 160); doc.setLineWidth(0.2);
              doc.line(amtX - amtW, y - rH + 1, amtX, y - rH + 1);
              doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(20, 20, 20);
              doc.text(label, mL, y);
              doc.text(f(val), amtX, y, { align: 'right' });
              y += rH;
            };

            const grandTotal = (label: string, val: number) => {
              chk(rH + 5);
              doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(20, 20, 20);
              doc.text(label, mL, y);
              doc.text(f(val), amtX, y, { align: 'right' });
              doc.setDrawColor(20, 20, 20); doc.setLineWidth(0.3);
              doc.line(amtX - amtW, y + 1.5, amtX, y + 1.5);
              doc.line(amtX - amtW, y + 3, amtX, y + 3);
              doc.setLineWidth(0.15);
              y += rH + 4;
            };

            const spacer = (n = 4) => { y += n; };

            // ═══════════════════════════════════════════
            // ASSETS
            // ═══════════════════════════════════════════
            colHdr('Keterangan', 'RM');

            sectionHdr('Aset Tetap (Fixed Assets)');
            row('Aset Tetap', fixedAssets);
            subtotal('Jumlah Aset Tetap', fixedAssets);
            spacer();

            sectionHdr('Aset Semasa (Current Assets)');
            row('Bank', bank);
            row('Tunai di Tangan', cash);
            if (debtors !== 0) row('Penghutang Dagangan', debtors);
            if (stock !== 0) row('Stok', stock);
            if (deposits !== 0) row('Deposit & Prabayar', deposits);
            subtotal('Jumlah Aset Semasa', totalCurrentAssets);
            spacer();

            sectionHdr('Liabiliti Semasa (Current Liabilities)');
            if (accruals !== 0) row('Akruan', accruals);
            if (creditors !== 0) row('Pemiutang Dagangan', creditors);
            if (loans !== 0) row('Pinjaman / HP Kreditor', loans);
            if (taxProvision !== 0) row('Peruntukan Cukai', taxProvision);
            subtotal('Jumlah Liabiliti Semasa', totalCurrentLiabilities);
            spacer();

            row('Aset Semasa Bersih', netCurrentAssets, true);
            spacer(2);
            grandTotal('JUMLAH ASET', totalAssets);

            // ═══════════════════════════════════════════
            // FINANCED BY
            // ═══════════════════════════════════════════
            spacer(4);
            colHdr('Dibiayai Oleh (Financed By)', 'RM');

            sectionHdr('Ekuiti Pemilik (Owner\'s Equity)');
            row('Modal (Capital)', capital);
            row('Ambilan / Pendahuluan', drawings);
            row('Untung/(Rugi) Terkumpul B/H', priorProfit);
            row('Untung/(Rugi) Semasa', currentPeriodProfit);
            subtotal('Jumlah Ekuiti', totalEquity);
            spacer(2);
            grandTotal('JUMLAH DIBIAYAI OLEH', totalEquity);

            // ── Signature ─────────────────────────────────────────────
            spacer(10);
            chk(30);
            doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(140, 140, 140);
            doc.text('Saya/Kami mengesahkan bahawa penyata di atas adalah benar dan betul.', mL, y);
            spacer(10);
            doc.setDrawColor(160, 160, 160); doc.setLineWidth(0.2);
            doc.line(mL, y, mL + 55, y);
            doc.line(pageW - mR - 55, y, pageW - mR, y);
            spacer(4);
            doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(140, 140, 140);
            doc.text('Tandatangan & Cop Syarikat', mL, y);
            doc.text('Tarikh', pageW - mR - 55, y);

            // ── Footer ────────────────────────────────────────────────
            const tp = (doc as any).internal.getNumberOfPages();
            for (let i = 1; i <= tp; i++) {
              doc.setPage(i);
              doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.1);
              doc.line(mL, pageH - 13, pageW - mR, pageH - 13);
              doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(160, 160, 160);
              doc.text(`Dijana oleh Monitacc  •  ${format(new Date(), 'dd/MM/yyyy')}`, mL, pageH - 8);
              doc.text(`${i} / ${tp}`, pageW - mR, pageH - 8, { align: 'right' });
            }

            const biz = companyName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
            doc.save(`KunciKiraKira_${biz}_${asAtDate.replace(/\//g, '-')}.pdf`);
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 rounded-xl text-xs font-bold text-white hover:bg-slate-800 transition-all shadow-lg"
        >
          <Download size={14} />
          Muat Turun PDF
        </button>
      </div>

      <div className="p-4 md:p-10 max-w-4xl mx-auto font-mono text-[10px] md:text-[11px] leading-relaxed overflow-x-auto">
        {/* Standard Accounting Header */}
        <div className="mb-10 text-center">
          <h2 className="text-sm font-bold uppercase mb-1">{companyName}</h2>
          <p className="text-[10px] font-bold text-slate-500 mb-2">No. SSM: {user?.ssm_number || '-'}</p>
          <h3 className="text-xs font-bold uppercase mb-1">KUNCI KIRA-KIRA PADA {asAtDate}</h3>
          <div className="flex justify-between text-[9px] font-bold mt-4 border-b border-slate-900 pb-1">
            <span>KETERANGAN</span>
            <div className="flex gap-20">
              <span>{asAtDate}</span>
              <span className="w-16 text-right">PAGE : 1</span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* FIXED ASSETS */}
          <section>
            <div className="flex justify-between font-bold mb-2">
              <span className="uppercase">ASET TETAP (FIXED ASSETS)</span>
              <span className="w-32 text-right border-b border-slate-900 pr-8">RM</span>
            </div>
            <div 
              className="flex justify-between py-1 pl-4 hover:bg-slate-50 cursor-pointer rounded transition-colors group"
              onClick={() => onCategoryClick?.("Fixed Assets", reportType === 'monthly' ? selectedMonth : undefined, currentYear)}
            >
              <div className="flex items-center gap-2">
                <span>Aset Tetap</span>
                <ChevronRight size={10} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="w-32 text-right pr-8 group-hover:underline group-hover:text-indigo-600 transition-all">{formatCurrency(fixedAssets)}</span>
            </div>
            <div className="flex justify-between py-1 font-bold border-t border-slate-200 mt-1">
              <span className="pl-4">JUMLAH ASET TETAP</span>
              <span className="w-32 text-right border-b border-slate-900 pr-8">{formatCurrency(fixedAssets)}</span>
            </div>
          </section>

          {/* CURRENT ASSETS */}
          <section>
            <div className="flex justify-between font-bold mb-2">
              <span className="uppercase">ASET SEMASA (CURRENT ASSETS)</span>
              <span className="w-32 text-right pr-8"></span>
            </div>
            <div className="space-y-1 pl-4">
            <div 
              className="flex justify-between py-1 pl-4 hover:bg-slate-50 cursor-pointer rounded transition-colors group"
              onClick={() => onCategoryClick?.("Bank", reportType === 'monthly' ? selectedMonth : undefined, currentYear)}
            >
              <div className="flex items-center gap-2">
                <span>BANK</span>
                <ChevronRight size={10} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="w-32 text-right pr-8 group-hover:underline group-hover:text-indigo-600 transition-all">{formatCurrency(bank)}</span>
            </div>
            <div 
              className="flex justify-between py-1 pl-4 hover:bg-slate-50 cursor-pointer rounded transition-colors group"
              onClick={() => onCategoryClick?.("Cash in hand", reportType === 'monthly' ? selectedMonth : undefined, currentYear)}
            >
              <div className="flex items-center gap-2">
                <span>TUNAI DI TANGAN</span>
                <ChevronRight size={10} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="w-32 text-right pr-8 group-hover:underline group-hover:text-indigo-600 transition-all">{formatCurrency(cash)}</span>
            </div>
              {debtors !== 0 && (
                <div 
                  className="flex justify-between py-1 pl-4 hover:bg-slate-50 cursor-pointer rounded transition-colors group"
                  onClick={() => onCategoryClick?.("Trade Debtors", reportType === 'monthly' ? selectedMonth : undefined, currentYear)}
                >
                  <div className="flex items-center gap-2">
                    <span>PENGHUTANG DAGANGAN</span>
                    <ChevronRight size={10} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <span className="w-32 text-right pr-8 group-hover:underline group-hover:text-indigo-600 transition-all">{formatCurrency(debtors)}</span>
                </div>
              )}
              {stock !== 0 && (
                <div 
                  className="flex justify-between py-1 pl-4 hover:bg-slate-50 cursor-pointer rounded transition-colors group"
                  onClick={() => onCategoryClick?.("Stock", reportType === 'monthly' ? selectedMonth : undefined, currentYear)}
                >
                  <div className="flex items-center gap-2">
                    <span>STOK</span>
                    <ChevronRight size={10} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <span className="w-32 text-right pr-8 group-hover:underline group-hover:text-indigo-600 transition-all">{formatCurrency(stock)}</span>
                </div>
              )}
              {deposits !== 0 && (
                <div 
                  className="flex justify-between py-1 pl-4 hover:bg-slate-50 cursor-pointer rounded transition-colors group"
                  onClick={() => onCategoryClick?.("Deposit & Prepayment", reportType === 'monthly' ? selectedMonth : undefined, currentYear)}
                >
                  <div className="flex items-center gap-2">
                    <span>DEPOSIT & PRABAYAR</span>
                    <ChevronRight size={10} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <span className="w-32 text-right pr-8 group-hover:underline group-hover:text-indigo-600 transition-all">{formatCurrency(deposits)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t border-slate-200 mt-2 pt-1">
                <span>JUMLAH ASET SEMASA</span>
                <span className="w-32 text-right border-b border-slate-900 pr-8">{formatCurrency(totalCurrentAssets)}</span>
              </div>
            </div>
          </section>

          {/* CURRENT LIABILITIES */}
          <section>
            <div className="flex justify-between font-bold mb-2">
              <span className="uppercase">LIABILITI SEMASA (CURRENT LIABILITIES)</span>
              <span className="w-24 text-right"></span>
            </div>
            <div className="space-y-1 pl-4">
              <div 
                className="flex justify-between py-1 pl-4 hover:bg-slate-50 cursor-pointer rounded transition-colors group"
                onClick={() => onCategoryClick?.("Accruals", reportType === 'monthly' ? selectedMonth : undefined, currentYear)}
              >
                <div className="flex items-center gap-2">
                  <span>AKRUAN</span>
                  <ChevronRight size={10} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <span className="w-32 text-right pr-8 group-hover:underline group-hover:text-indigo-600 transition-all">{formatCurrency(accruals)}</span>
              </div>
              {creditors !== 0 && (
                <div 
                  className="flex justify-between py-1 pl-4 hover:bg-slate-50 cursor-pointer rounded transition-colors group"
                  onClick={() => onCategoryClick?.("Trade creditors", reportType === 'monthly' ? selectedMonth : undefined, currentYear)}
                >
                  <div className="flex items-center gap-2">
                    <span>PEMIUTANG DAGANGAN</span>
                    <ChevronRight size={10} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <span className="w-32 text-right pr-8 group-hover:underline group-hover:text-indigo-600 transition-all">{formatCurrency(creditors)}</span>
                </div>
              )}
              {loans !== 0 && (
                <div 
                  className="flex justify-between py-1 pl-4 hover:bg-slate-50 cursor-pointer rounded transition-colors group"
                  onClick={() => onCategoryClick?.("Hire purchase creditor", reportType === 'monthly' ? selectedMonth : undefined, currentYear)}
                >
                  <div className="flex items-center gap-2">
                    <span>PINJAMAN / HP</span>
                    <ChevronRight size={10} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <span className="w-32 text-right pr-8 group-hover:underline group-hover:text-indigo-600 transition-all">{formatCurrency(loans)}</span>
                </div>
              )}
              {taxProvision !== 0 && (
                <div 
                  className="flex justify-between py-1 pl-4 hover:bg-slate-50 cursor-pointer rounded transition-colors group"
                  onClick={() => onCategoryClick?.("Provision for taxation", reportType === 'monthly' ? selectedMonth : undefined, currentYear)}
                >
                  <div className="flex items-center gap-2">
                    <span>PERUNTUKAN CUKAI</span>
                    <ChevronRight size={10} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <span className="w-32 text-right pr-8 group-hover:underline group-hover:text-indigo-600 transition-all">{formatCurrency(taxProvision)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t border-slate-200 mt-2 pt-1">
                <span>JUMLAH LIABILITI SEMASA</span>
                <span className="w-32 text-right border-b border-slate-900 pr-8">{formatCurrency(totalCurrentLiabilities)}</span>
              </div>
            </div>
          </section>

          {/* NET CURRENT ASSETS & TOTAL ASSETS */}
          <section className="space-y-2">
            <div className="flex justify-between font-bold">
              <span className="uppercase">ASET SEMASA BERSIH</span>
              <span className="w-32 text-right border-b border-slate-900 pr-8">{formatCurrency(netCurrentAssets)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm pt-2">
              <span className="uppercase tracking-wider">JUMLAH ASET</span>
              <span className="w-32 text-right border-b-4 border-double border-slate-900 pr-8">{formatCurrency(totalAssets)}</span>
            </div>
          </section>

          {/* FINANCED BY */}
          <section className="pt-10">
            <div className="flex justify-between font-bold mb-4 border-b-2 border-slate-900 pb-1">
              <span className="uppercase tracking-widest">DIBIAYAI OLEH (FINANCED BY)</span>
              <span className="w-32 text-right pr-8">RM</span>
            </div>
            <div className="space-y-2 pl-4">
              <div 
                className="flex justify-between py-1 pl-4 hover:bg-slate-50 cursor-pointer rounded transition-colors group"
                onClick={() => onCategoryClick?.("CAPITAL", reportType === 'monthly' ? selectedMonth : undefined, currentYear)}
              >
                <div className="flex items-center gap-2">
                  <span>MODAL (CAPITAL)</span>
                  <ChevronRight size={10} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <span className="w-32 text-right pr-8 group-hover:underline group-hover:text-indigo-600 transition-all">{formatCurrency(capital)}</span>
              </div>
              <div 
                className="flex justify-between py-1 pl-4 hover:bg-slate-50 cursor-pointer rounded transition-colors group"
                onClick={() => onCategoryClick?.("Amount due to director", reportType === 'monthly' ? selectedMonth : undefined, currentYear)}
              >
                <div className="flex items-center gap-2">
                  <span>AMBILAN / PENDAHULUAN (ADVANCE/DRAWING)</span>
                  <ChevronRight size={10} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <span className="w-32 text-right pr-8 group-hover:underline group-hover:text-indigo-600 transition-all">{formatCurrency(drawings)}</span>
              </div>
              <div 
                className="flex justify-between py-1 pl-4 hover:bg-slate-50 cursor-pointer rounded transition-colors group"
                onClick={() => onCategoryClick?.("SALES", undefined, currentYear)}
              >
                <div className="flex items-center gap-2">
                  <span>UNTUNG / RUGI TERKUMPUL (BAWA HADAPAN)</span>
                  <ChevronRight size={10} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <span className="w-32 text-right pr-8 group-hover:underline group-hover:text-indigo-600 transition-all">{formatCurrency(priorProfit)}</span>
              </div>
              <div 
                className="flex justify-between font-bold text-emerald-700 py-1 pl-4 hover:bg-emerald-50 cursor-pointer rounded transition-colors group"
                onClick={() => onCategoryClick?.("SALES", reportType === 'monthly' ? selectedMonth : undefined, currentYear)}
              >
                <div className="flex items-center gap-2">
                  <span>UNTUNG SEMASA (CURRENT PERIOD PROFIT)</span>
                  <ChevronRight size={10} className="text-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <span className="w-32 text-right pr-8 group-hover:underline group-hover:text-emerald-600 transition-all">{formatCurrency(currentPeriodProfit)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm pt-6 border-t border-slate-200 mt-4">
                <span className="uppercase tracking-wider">JUMLAH EKUITI</span>
                <span className="w-32 text-right border-b-4 border-double border-slate-900 pr-8">{formatCurrency(totalEquity)}</span>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-20 pt-10 border-t border-dashed border-slate-200 text-center print:mt-10">
          <p className="text-[10px] font-bold text-slate-900 uppercase mb-1">{user?.company_name || 'MONITACC ENTERPRISE'}</p>
          <p className="text-[9px] text-slate-500 mb-6">No. SSM: {user?.ssm_number || '-'}</p>
          <p className="text-[9px] text-slate-400 italic">
            Saya/Kami dengan ini mengesahkan bahawa penyata yang diberikan di atas adalah benar dan betul mengikut pengetahuan dan kepercayaan saya/kami.
          </p>
          <div className="mt-12 w-48 border-b border-slate-400 mx-auto"></div>
          <p className="mt-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">Tandatangan Pengarah / Pemilik</p>
        </div>
      </div>
    </div>
  );
};

const AIAnalysisView = ({ records, sales, user }: { records: TransactionRecord[], sales: any[], user: UserType | null }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isConcise, setIsConcise] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const analysisRef = useRef<HTMLDivElement>(null);

  const generateAnalysis = async (conciseMode: boolean = isConcise) => {
    setLoading(true);
    const result = await analyzeFinancials(records, sales, conciseMode);
    setAnalysis(result);
    setLoading(false);
  };

  const downloadAnalysis = async () => {
    const fileName = `Laporan-Analisis-AI-${new Date().toISOString().split('T')[0]}.pdf`;
    await generatePDF('formal-ai-report', fileName, setDownloading);
  };

  const handleToggleConcise = (val: boolean) => {
    setIsConcise(val);
  };

  return (
    <div className="p-6 pb-24 md:pl-64 md:pt-12 max-w-5xl mx-auto relative">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl -z-10" />

      <header className="mb-10 flex flex-col md:flex-row md:justify-between md:items-end gap-6 relative z-10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3 border border-emerald-100">
            <Sparkles size={12} fill="currentColor" /> AI Powered Analysis
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-2 font-display">
            Smart Analisis Pintar
          </h2>
          <p className="text-slate-500 text-sm font-medium max-w-md">Analisa data kewangan anda secara automatik dengan teknologi AI terkini untuk keputusan bisnes yang lebih bijak.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex p-1 bg-slate-100 rounded-lg">
            <button 
              onClick={() => handleToggleConcise(false)}
              className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${!isConcise ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Penuh
            </button>
            <button 
              onClick={() => handleToggleConcise(true)}
              className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${isConcise ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Ringkas
            </button>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => generateAnalysis()}
              disabled={loading}
              className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all disabled:opacity-50 border border-emerald-100"
              title="Refresh Smart Analisis"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      {/* Hidden Formal Report Template for PDF Generation */}
      <div id="formal-ai-report" className="bg-white p-12 w-[794px] min-h-[1123px] font-sans text-black hidden fixed left-[-9999px] border border-black">
        {/* Formal Header Block */}
        <div className="flex justify-between items-start mb-12 border-b border-black pb-6">
          <div className="space-y-4">
            <div className="border border-black px-3 py-1 inline-block">
              <p className="text-[9px] font-bold uppercase tracking-wider">SULIT / CONFIDENTIAL</p>
            </div>
            <h1 className="text-3xl font-bold text-black tracking-tight uppercase">LAPORAN ANALISIS KEWANGAN</h1>
            <p className="text-gray-900 font-bold text-[12px] uppercase tracking-widest">{user?.company_name || 'MONITACC ENTERPRISE'}</p>
            <p className="text-gray-500 font-bold text-[10px] uppercase tracking-widest">No. SSM: {user?.ssm_number || '-'}</p>
            <p className="text-gray-400 font-bold text-[9px] uppercase tracking-widest">MONITACC BUSINESS INTELLIGENCE UNIT</p>
          </div>
          <div className="text-right">
            <div className="border border-black p-4 inline-block text-left">
              <p className="text-[8px] font-bold uppercase text-gray-400 mb-1">No. Rujukan</p>
              <p className="text-lg font-bold text-black">MAI-{Date.now().toString().slice(-8)}</p>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-[8px] font-bold uppercase text-gray-400 mb-0.5">Tarikh Laporan</p>
                <p className="text-xs font-bold text-gray-700">{new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Executive Summary Section */}
        <div className="grid grid-cols-12 gap-10 mb-10">
          <div className="col-span-8 space-y-4">
            <h3 className="text-[10px] font-bold text-black uppercase tracking-widest border-l-2 border-black pl-3">
              Ringkasan Eksekutif
            </h3>
            <p className="text-sm text-gray-700 leading-relaxed text-justify">
              Laporan ini menyediakan penilaian komprehensif terhadap kedudukan kewangan entiti berdasarkan data transaksi yang direkodkan. Analisis merangkumi pengesahan aliran tunai, pengenalpastian anomali duit keluar, dan penilaian nisbah keuntungan. Dokumen ini bertujuan untuk kegunaan pengurusan dalam membuat keputusan strategik dan perancangan fiskal.
            </p>
          </div>
          <div className="col-span-4">
            <div className="border border-black p-6 text-center h-full flex flex-col justify-center">
              <p className="text-[9px] font-bold text-gray-400 uppercase mb-2">Skor Kesihatan</p>
              <p className="text-4xl font-bold text-black mb-1">92%</p>
              <p className="text-[9px] font-bold text-black uppercase tracking-tighter">PRESTASI TINGGI</p>
            </div>
          </div>
        </div>

        {/* AI Content Area */}
        <div className="prose prose-sm max-w-none mb-12
          prose-headings:text-black prose-headings:font-bold prose-headings:uppercase prose-headings:border-b prose-headings:border-gray-200 prose-headings:pb-1
          prose-p:text-gray-700 prose-p:leading-relaxed prose-p:text-justify
          prose-strong:text-black prose-strong:font-bold
          prose-li:text-gray-700
          prose-blockquote:border-l-2 prose-blockquote:border-black prose-blockquote:bg-gray-50 prose-blockquote:p-6 prose-blockquote:font-medium prose-blockquote:text-black">
          <Markdown>{analysis || ''}</Markdown>
        </div>

        {/* Formal Footer */}
        <div className="mt-auto pt-8 border-t border-black flex justify-between items-start">
          <div className="max-w-xs">
            <p className="text-[8px] font-bold text-black uppercase mb-1">{user?.company_name || 'MONITACC ENTERPRISE'}</p>
            <p className="text-[7px] text-gray-500 mb-2">No. SSM: {user?.ssm_number || '-'}</p>
            <p className="text-[8px] font-bold text-black uppercase mb-2">Penafian (Disclaimer):</p>
            <p className="text-[7px] text-gray-500 leading-tight text-justify">
              Laporan ini dijana secara automatik oleh sistem AI MonitAcc. Walaupun ketepatan data diutamakan, pengguna dinasihatkan untuk melakukan pengesahan silang dengan akauntan bertauliah sebelum membuat sebarang komitmen kewangan yang besar. MonitAcc tidak bertanggungjawab atas sebarang kerugian akibat penggunaan laporan ini secara tunggal.
            </p>
          </div>
          <div className="text-right space-y-2">
            <div className="inline-block border border-gray-200 p-1">
              <div className="w-12 h-12 bg-gray-50 flex items-center justify-center text-[6px] text-gray-400 font-bold text-center uppercase">
                PENGESAHAN<br/>DIGITAL
              </div>
            </div>
            <p className="text-[8px] font-bold text-black uppercase">Halaman 1 / 1</p>
          </div>
        </div>
      </div>

      <div className="card-premium p-0 min-h-[500px] relative overflow-hidden border-slate-200/60 shadow-xl shadow-slate-200/50 bg-white/80 backdrop-blur-sm">
        <div ref={analysisRef} className="p-8 md:p-12 relative h-full">
          {/* Decorative Background for Card */}
          <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none select-none">
            <Sparkles size={240} strokeWidth={0.5} />
          </div>
          
          {loading ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 text-center">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-emerald-100 rounded-full" />
                <div className="w-20 h-20 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0" />
                <div className="absolute inset-0 flex items-center justify-center text-emerald-500">
                  <Sparkles size={24} className="animate-pulse" />
                </div>
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900 mb-2">Sedang Menganalisa...</p>
                <p className="text-slate-500 font-medium text-sm max-w-xs mx-auto">AI kami sedang memproses data transaksi dan jualan anda untuk menjana laporan komprehensif.</p>
              </div>
              <div className="w-48 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  className="w-1/2 h-full bg-emerald-500 rounded-full"
                />
              </div>
            </div>
          ) : analysis ? (
            <div className="prose prose-slate max-w-none prose-headings:font-display prose-headings:tracking-tight prose-a:text-emerald-600 prose-strong:text-slate-900 prose-p:text-slate-600 prose-p:leading-relaxed prose-li:text-slate-600">
              <div className="mb-10 pb-6 border-b border-slate-100 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-black text-slate-900 mb-1 tracking-tight">Laporan Analisis Kewangan</h1>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Digital AI Audit • {new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <Check size={12} strokeWidth={3} className="text-emerald-500" /> Verified by Monitacc AI
                </div>
              </div>
              <Markdown>{analysis}</Markdown>
            </div>
          ) : (records.length > 0 || sales.length > 0) ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-24 h-24 bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-3xl flex items-center justify-center text-emerald-500 mb-8 shadow-inner border border-emerald-100"
              >
                <Sparkles size={48} strokeWidth={1.5} />
              </motion.div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3 tracking-tight font-display">Sedia untuk Dianalisa</h3>
              <p className="text-slate-500 max-w-sm mb-10 text-sm leading-relaxed font-medium">Data transaksi anda telah sedia. Klik butang di bawah untuk memulakan analisis AI yang mendalam tentang prestasi perniagaan anda.</p>
              <button 
                onClick={() => generateAnalysis()}
                className="group relative flex items-center gap-3 px-8 py-4 bg-emerald-600 text-white rounded-2xl text-sm font-bold uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                Jana Analisis Sekarang
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300 mb-6 border border-slate-100">
                <FileText size={40} strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">Tiada Data untuk Dianalisa</h3>
              <p className="text-slate-500 max-w-xs text-sm font-medium">Sila tambah transaksi atau jualan terlebih dahulu untuk membolehkan AI membuat analisa yang tepat.</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card-premium p-8 bg-gradient-to-br from-emerald-600 to-emerald-800 text-white border-none shadow-lg shadow-emerald-100 group hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-start justify-between mb-6">
            <div className="p-3 bg-white/10 rounded-2xl border border-white/10">
              <Zap size={24} className="text-emerald-300" />
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-200/60 bg-white/5 px-2 py-1 rounded">Quick Tip</div>
          </div>
          <h4 className="text-lg font-bold mb-3 font-display tracking-tight">Tips Pintar AI</h4>
          <p className="text-sm text-emerald-50/80 leading-relaxed font-medium">
            AI kami menganalisa trend duit keluar dan jualan anda untuk memberikan nasihat perniagaan yang tepat. Pastikan anda mengimbas semua resit untuk hasil yang terbaik dan laporan yang lebih komprehensif.
          </p>
        </div>
        <div className="card-premium p-8 bg-gradient-to-br from-slate-800 to-slate-900 text-white border-none shadow-lg shadow-slate-200 group hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-start justify-between mb-6">
            <div className="p-3 bg-white/10 rounded-2xl border border-white/10">
              <FileDown size={24} className="text-slate-400" />
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-white/5 px-2 py-1 rounded">Export</div>
          </div>
          <h4 className="text-lg font-bold mb-3 font-display tracking-tight">Laporan PDF Rasmi</h4>
          <p className="text-sm text-slate-400 leading-relaxed font-medium mb-6">
            {analysis ? 'Laporan analisis anda sedia untuk dimuat turun dalam format PDF rasmi untuk kegunaan mesyuarat atau simpanan fail.' : 'Ciri eksport laporan AI ke PDF akan tersedia secara automatik sebaik sahaja analisis dijana oleh sistem.'}
          </p>
          {analysis && (
            <button 
              onClick={downloadAnalysis}
              disabled={downloading}
              className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white text-slate-900 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-100 transition-all disabled:opacity-50 shadow-xl shadow-black/20"
            >
              {downloading ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
              Muat Turun Laporan PDF
            </button>
          )}
        </div>
        <div className="card-premium p-8 bg-gradient-to-br from-blue-600 to-blue-800 text-white border-none shadow-lg shadow-blue-100 group hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-start justify-between mb-6">
            <div className="p-3 bg-white/10 rounded-2xl border border-white/10">
              <MessageCircle size={24} className="text-blue-300" />
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-blue-200/60 bg-white/5 px-2 py-1 rounded">Support</div>
          </div>
          <h4 className="text-lg font-bold mb-3 font-display tracking-tight">Akauntan Bertauliah</h4>
          <p className="text-sm text-blue-50/80 leading-relaxed font-medium mb-6">
            Perlukan bantuan profesional? Hubungi akauntan bertauliah kami untuk khidmat nasihat percukaian dan audit yang lebih mendalam.
          </p>
          <a 
            href="https://wa.me/60126254849" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white text-blue-900 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-blue-50 transition-all shadow-xl shadow-black/10 mt-auto"
          >
            <MessageCircle size={16} />
            Hubungi Akauntan (WhatsApp)
          </a>
        </div>
      </div>
    </div>
  );
};

const AddUserModal = ({ onClose, onSave }: { onClose: () => void, onSave: (data: any) => void }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'admin',
    company_name: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiAddUser(formData);
      setSuccess(true);
      setTimeout(() => {
        onSave(formData);
      }, 2000);
    } catch (err: any) {
      setError(err?.message || 'Gagal menambah pengguna');
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-12 text-center"
        >
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2 font-display">Berjaya Ditambah!</h3>
          <p className="text-slate-500 text-sm mb-8 font-medium">
            Pengguna baru telah didaftarkan. Anda boleh salin pautan akses di bawah untuk dikongsi.
          </p>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(window.location.origin);
            }}
            className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-100 flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all active:scale-95"
          >
            <Copy size={18} />
            Salin Pautan Akses
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-xl font-bold text-slate-900 font-display tracking-tight">Tambah Pengguna Baru</h3>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-lg text-slate-400 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-lg flex items-center gap-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Nama Penuh</label>
            <input 
              required
              type="text" 
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
              placeholder="Contoh: Ahmad bin Ali"
            />
          </div>
          
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Alamat Email</label>
            <input 
              required
              type="email" 
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
              placeholder="ahmad@example.com"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Kata Laluan</label>
            <input 
              required
              type="password" 
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Nama Syarikat</label>
            <input 
              type="text" 
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
              placeholder="Contoh: Ahmad Enterprise"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Peranan (Role)</label>
            <select 
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none"
            >
              <option value="admin">Admin (Full Access)</option>
              <option value="full_access">Full Access</option>
              <option value="upload_only">Upload Resit Sahaja</option>
            </select>
          </div>

          <button 
            type="submit"
            className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-[0.98] mt-4"
          >
            Simpan Pengguna
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const UserManagementView = ({ onBack }: { onBack: () => void }) => {
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'cancelled'>('all');
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await apiGetUsers();
      setUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await apiUpdateUserRole(userId, newRole);
      fetchUsers();
    } catch (err) {
      console.error('Error updating role:', err);
    }
  };

  return (
    <div className="p-6 pb-24 md:pl-64 md:pt-12 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight font-display">Pengurusan Pengguna</h2>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95"
        >
          <Plus size={18} />
          Tambah Pengguna
        </button>
      </div>

      {showAddModal && (
        <AddUserModal 
          onClose={() => setShowAddModal(false)}
          onSave={() => {
            setShowAddModal(false);
            fetchUsers();
          }}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Jumlah Pengguna</p>
          <p className="text-2xl font-bold text-slate-900">{users.length}</p>
        </div>
        <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 shadow-sm">
          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Pengguna Aktif</p>
          <p className="text-2xl font-bold text-emerald-900">{users.filter(u => u.status === 'active').length}</p>
        </div>
        <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100 shadow-sm">
          <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mb-1">Pengguna Batal</p>
          <p className="text-2xl font-bold text-rose-900">{users.filter(u => u.status === 'cancelled').length}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {['all', 'active', 'cancelled'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === tab 
                ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' 
                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab === 'all' ? 'Semua' : tab === 'active' ? 'Aktif' : 'Batal'}
          </button>
        ))}
      </div>

      <div className="card-premium overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nama & Syarikat</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Pakej</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Affiliate</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users
                .filter(u => activeTab === 'all' || u.status === activeTab)
                .map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-900">{u.name}</div>
                    <div className="text-[10px] text-slate-400 font-medium">{u.email}</div>
                    <div className="text-[10px] text-emerald-600 font-bold mt-0.5 uppercase tracking-tighter">{u.company_name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                      u.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {u.status === 'active' ? 'Aktif' : 'Batal'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                      u.plan === 'Ultimate' ? 'bg-slate-900 text-white' : 
                      u.plan === 'Growth' ? 'bg-emerald-600 text-white' : 
                      u.plan === 'Starter' ? 'bg-emerald-100 text-emerald-700' : 
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {u.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${u.referred_by === 'Direct' ? 'bg-slate-300' : 'bg-blue-500'}`} />
                      <span className="text-xs font-medium text-slate-600">{u.referred_by || 'Direct'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <select 
                        value={u.role || 'full_access'} 
                        onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                        className="text-[10px] font-bold bg-slate-100 border-none rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-emerald-500/20"
                      >
                        <option value="admin">Admin</option>
                        <option value="full_access">Full Access</option>
                        <option value="upload_only">Upload Only</option>
                      </select>
                      <button 
                        onClick={() => setSelectedUser(u)}
                        className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedUser(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                    <User size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold tracking-tight font-display">Butiran Pengguna</h3>
                    <p className="text-xs text-slate-400 font-medium">{selectedUser.name}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedUser(null)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"
                >
                  <X size={18} />
                </button>
              </div>
              
              <div className="p-8 space-y-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nama Penuh</p>
                    <p className="text-sm font-bold text-slate-900">{selectedUser.name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Emel</p>
                    <p className="text-sm font-bold text-slate-900">{selectedUser.email}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Syarikat</p>
                    <p className="text-sm font-bold text-emerald-600 uppercase tracking-tight">{selectedUser.company_name || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pakej Langganan</p>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      selectedUser.plan === 'Ultimate' ? 'bg-slate-900 text-white' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {selectedUser.plan}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck size={14} className="text-emerald-500" />
                    Status & Rujukan
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status Akaun</p>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        selectedUser.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {selectedUser.status === 'active' ? 'Aktif' : 'Batal'}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dirujuk Oleh</p>
                      <p className="text-sm font-bold text-slate-900">{selectedUser.referred_by || 'Direct'}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setSelectedUser(null)}
                    className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95"
                  >
                    Tutup Butiran
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const PREMIUM_GATE_INFO: Record<string, { title: string; desc: string; icon: React.ElementType; requiredPlan: string; features: string[] }> = {
  'ai-analysis': {
    title: 'Smart Analisis',
    desc: 'Analisis kewangan pintar menggunakan AI untuk memberi pandangan mendalam tentang perniagaan anda.',
    icon: Sparkles,
    requiredPlan: 'Starter',
    features: ['Analisis trend bulanan', 'Cadangan penghematan kos', 'Laporan AI automatik', 'Insight perniagaan'],
  },
  reconcile: {
    title: 'Padanan Bank',
    desc: 'Padankan transaksi bank dengan rekod akaun anda secara automatik dan tepat.',
    icon: RefreshCw,
    requiredPlan: 'Ultimate',
    features: ['Auto-padanan transaksi', 'Import penyata bank PDF', 'Kesan perbezaan', 'Laporan reconciliation'],
  },
};

const PLAN_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  Starter: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' },
  Growth: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  Ultimate: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
};

const PremiumGateView = ({ featureId, onUpgrade, onBack }: { featureId: string; onUpgrade: () => void; onBack: () => void }) => {
  const info = PREMIUM_GATE_INFO[featureId];
  if (!info) return null;
  const Icon = info.icon;

  const upgradePlans: Record<string, { name: string; price: string; period: string; highlight: boolean }[]> = {
    Starter: [
      { name: 'Starter', price: 'RM 50', period: '/bulan', highlight: false },
      { name: 'Growth', price: 'RM 100', period: '/bulan', highlight: false },
      { name: 'Ultimate', price: 'RM 150', period: '/bulan', highlight: true },
    ],
    Ultimate: [
      { name: 'Ultimate', price: 'RM 150', period: '/bulan', highlight: true },
    ],
  };
  const planOptions = upgradePlans[info.requiredPlan] || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="min-h-screen flex items-center justify-center px-4 py-12 md:pl-64"
    >
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-3xl overflow-hidden shadow-2xl shadow-slate-200/80 border border-slate-100">

          <div className="relative bg-gradient-to-b from-slate-950 to-slate-800 pt-12 pb-10 px-8 text-center overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-amber-400/8 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10">
              <div className="relative inline-flex mb-6">
                <div className="w-20 h-20 rounded-[22px] bg-white/8 border border-white/10 flex items-center justify-center backdrop-blur-sm shadow-2xl">
                  <Icon size={34} className="text-white" strokeWidth={1.5} />
                </div>
                <span className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/30 border-2 border-slate-950">
                  <Lock size={13} className="text-white" strokeWidth={2.5} />
                </span>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-400/15 border border-amber-400/25 rounded-full mb-5">
                <Crown size={10} className="text-amber-300" />
                <span className="text-[10px] font-bold text-amber-300 uppercase tracking-widest">Pakej {info.requiredPlan} & ke atas</span>
              </div>

              <h1 className="text-[26px] font-black text-white tracking-tight font-display mb-3 leading-tight">
                {info.title}
              </h1>
              <p className="text-white/50 text-[13px] leading-relaxed max-w-xs mx-auto font-medium">
                {info.desc}
              </p>
            </div>
          </div>

          <div className="px-7 py-7">
            <div className="mb-7">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Apa yang anda dapat</p>
              <div className="grid grid-cols-2 gap-2.5">
                {info.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5 bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                      <Check size={12} className="text-emerald-600" strokeWidth={2.5} />
                    </div>
                    <span className="text-[12px] font-semibold text-slate-700 leading-tight">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {planOptions.length > 0 && (
              <div className="mb-7">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Pakej yang sesuai</p>
                <div className="space-y-2.5">
                  {planOptions.map((plan) => {
                    const colors = PLAN_COLORS[plan.name] || PLAN_COLORS['Starter'];
                    return (
                      <div
                        key={plan.name}
                        className={`flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 transition-all ${
                          plan.highlight
                            ? 'border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 shadow-sm'
                            : `border-slate-100 bg-slate-50`
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                          <span className={`text-[13px] font-bold ${plan.highlight ? 'text-amber-800' : 'text-slate-700'}`}>{plan.name}</span>
                          {plan.highlight && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-400 text-white text-[9px] font-black rounded-full uppercase tracking-wide">
                              <Crown size={7} /> Popular
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className={`text-[15px] font-black ${plan.highlight ? 'text-amber-700' : 'text-slate-800'}`}>{plan.price}</span>
                          <span className="text-[10px] text-slate-400 font-medium">{plan.period}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              onClick={onUpgrade}
              className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-black text-[14px] rounded-2xl hover:from-emerald-600 hover:to-emerald-700 active:scale-[0.98] transition-all duration-200 shadow-lg shadow-emerald-200 flex items-center justify-center gap-2.5 mb-3"
            >
              <Crown size={16} strokeWidth={2} />
              Naik Taraf Sekarang
            </button>
            <button
              onClick={onBack}
              className="w-full py-3 text-slate-400 text-[13px] font-semibold hover:text-slate-600 transition-colors rounded-xl hover:bg-slate-50"
            >
              Kembali ke Dashboard
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const PROFILE_PLAN_DETAILS: Record<string, { label: string; price: string; period: string | null; color: string; badgeBg: string; badgeText: string; features: { text: string; included: boolean }[] }> = {
  Percuma: {
    label: 'Percuma',
    price: 'RM 0',
    period: null,
    color: 'from-slate-600 to-slate-800',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    features: [
      { text: '5 Imbasan Transaksi / bulan', included: true },
      { text: 'Unlimited Rekod Manual', included: true },
      { text: '1× Imbasan Bank Statement', included: true },
      { text: 'Monitacc Assistant', included: true },
      { text: 'Smart Analysis', included: false },
      { text: 'P&L Report + Balance Sheet', included: false },
      { text: 'Reconciliation Features', included: false },
    ],
  },
  free: {
    label: 'Percuma',
    price: 'RM 0',
    period: null,
    color: 'from-slate-600 to-slate-800',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    features: [
      { text: '5 Imbasan Transaksi / bulan', included: true },
      { text: 'Unlimited Rekod Manual', included: true },
      { text: '1× Imbasan Bank Statement', included: true },
      { text: 'Monitacc Assistant', included: true },
      { text: 'Smart Analysis', included: false },
      { text: 'P&L Report + Balance Sheet', included: false },
      { text: 'Reconciliation Features', included: false },
    ],
  },
  Starter: {
    label: 'Starter',
    price: 'RM 50',
    period: '/bulan',
    color: 'from-emerald-600 to-emerald-800',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    features: [
      { text: '100 Imbasan Transaksi / bulan', included: true },
      { text: 'Unlimited Rekod Manual', included: true },
      { text: '3× Imbasan Bank Statement', included: true },
      { text: 'Monitacc Assistant', included: true },
      { text: '1× Smart Analysis / bulan', included: true },
      { text: 'P&L Report + Balance Sheet', included: false },
      { text: 'Reconciliation Features', included: false },
    ],
  },
  Growth: {
    label: 'Growth',
    price: 'RM 100',
    period: '/bulan',
    color: 'from-teal-600 to-teal-800',
    badgeBg: 'bg-teal-50',
    badgeText: 'text-teal-700',
    features: [
      { text: '250 Imbasan Transaksi / bulan', included: true },
      { text: 'Unlimited Rekod Manual', included: true },
      { text: '9× Imbasan Bank Statement', included: true },
      { text: 'Monitacc Assistant', included: true },
      { text: '4× Smart Analysis / bulan', included: true },
      { text: 'P&L Report + Balance Sheet', included: false },
      { text: 'Reconciliation Features', included: false },
    ],
  },
  Ultimate: {
    label: 'Ultimate',
    price: 'RM 150',
    period: '/bulan',
    color: 'from-slate-900 to-slate-700',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    features: [
      { text: 'Unlimited Imbasan Transaksi', included: true },
      { text: 'Unlimited Rekod Manual', included: true },
      { text: 'Unlimited Bank Statement', included: true },
      { text: 'Monitacc Assistant', included: true },
      { text: 'Unlimited Smart Analysis', included: true },
      { text: 'P&L Report + Balance Sheet', included: true },
      { text: 'Reconciliation Features', included: true },
    ],
  },
};

const ProfileView = ({ user, setView, onLogout, onEdit, onBusinessSettings, onUserManagement }: { user: UserType | null, setView: (v: AppView) => void, onLogout: () => void, onEdit: () => void, onBusinessSettings: () => void, onUserManagement: () => void }) => {
  const name = user?.name || 'Ahmad bin Ali';
  const companyName = user?.company_name || 'Ahmad Business';
  const email = user?.email || 'monitacc2026@gmail.com';

  const currentPlanKey = user?.plan || 'free';
  const planDetails = PROFILE_PLAN_DETAILS[currentPlanKey] || PROFILE_PLAN_DETAILS['free'];
  const isFreePlan = currentPlanKey === 'free' || currentPlanKey === 'Percuma';

  const planEnd = user?.plan_end ? new Date(user.plan_end) : null;
  const planEndFormatted = planEnd
    ? planEnd.toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const daysLeft = planEnd
    ? Math.max(0, Math.ceil((planEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="p-4 md:p-6 pb-24 md:pl-64 md:pt-12 max-w-4xl mx-auto">
      <div className="space-y-6">
        {/* Profile Header Card */}
        <div className="card-premium p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-emerald-500 to-emerald-700 opacity-10" />

          <div className="relative z-10">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-slate-900 mx-auto mb-6 shadow-xl border border-slate-100 relative group transition-transform hover:scale-105 duration-300">
              <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 group-hover:border-emerald-500/50 transition-colors" />
              <User size={48} strokeWidth={1.5} className="text-slate-700 group-hover:text-emerald-600 transition-colors" />
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white group-hover:scale-110 transition-transform">
                <CheckCircle2 size={14} />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-1 font-display">{companyName}</h2>
            <p className="text-slate-600 text-sm font-bold mb-1">{name}</p>
            <p className="text-slate-500 text-xs font-medium mb-1">{email}</p>
            {user?.phone && <p className="text-slate-400 text-xs font-medium mb-4">{user.phone}</p>}

            <div className="flex flex-col items-center gap-4 mt-4">
              <div className={`inline-flex items-center gap-2 px-4 py-1.5 ${planDetails.badgeBg} ${planDetails.badgeText} text-[10px] font-bold rounded-full uppercase tracking-wider shadow-sm border border-current/10`}>
                <CheckCircle2 size={12} />
                PAKEJ {planDetails.label.toUpperCase()}
              </div>

              <button
                onClick={onEdit}
                className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1"
              >
                Kemaskini Profil
              </button>
            </div>
          </div>
        </div>

        {/* Current Plan Card */}
        <div className={`card-premium overflow-hidden shadow-xl`}>
          <div className={`bg-gradient-to-r ${planDetails.color} p-6 text-white`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-1">Pakej Semasa</p>
                <h3 className="text-2xl font-bold tracking-tight font-display">{planDetails.label}</h3>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-black">{planDetails.price}</span>
                  {planDetails.period && <span className="text-white/60 text-sm font-medium">{planDetails.period}</span>}
                </div>
              </div>
              <div className="p-3 bg-white/10 rounded-xl">
                <Zap size={24} className="text-white" />
              </div>
            </div>

            {!isFreePlan && planEndFormatted && (
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Tamat Langganan</p>
                  <p className="text-white text-sm font-bold mt-0.5">{planEndFormatted}</p>
                </div>
                {daysLeft !== null && (
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${daysLeft <= 7 ? 'bg-red-500/20 text-red-200' : 'bg-white/10 text-white/80'}`}>
                    {daysLeft} hari lagi
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-6 bg-white">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Ciri-ciri Yang Disertakan</p>
            <div className="space-y-3">
              {planDetails.features.map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${f.included ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-300'}`}>
                    {f.included ? <CheckCircle2 size={12} /> : <X size={12} />}
                  </div>
                  <span className={`text-sm font-medium ${f.included ? 'text-slate-700' : 'text-slate-300 line-through'}`}>{f.text}</span>
                </div>
              ))}
            </div>

            {isFreePlan ? (
              <button
                onClick={() => setView('plans')}
                className="mt-6 w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-bold rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-md shadow-emerald-100 flex items-center justify-center gap-2"
              >
                <TrendingUp size={16} />
                Naik Taraf Sekarang
              </button>
            ) : (
              <button
                onClick={() => setView('plans')}
                className="mt-6 w-full py-3 bg-slate-100 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
              >
                <TrendingUp size={16} />
                Urus Langganan
              </button>
            )}
          </div>
        </div>

        {/* Menu Card */}
        <div className="card-premium overflow-hidden bg-white">
          {[
            { label: 'Tetapan Perniagaan', icon: LayoutDashboard, color: 'text-emerald-600', bg: 'bg-emerald-50', onClick: onBusinessSettings },
            { label: 'Pengurusan Kategori', icon: Tag, color: 'text-emerald-600', bg: 'bg-emerald-50', onClick: () => setView('categories') },
            { label: 'Eksport Data (PDF)', icon: FileDown, color: 'text-emerald-600', bg: 'bg-emerald-50', onClick: () => setView('reports') },
            { label: 'Pusat Bantuan (FAQ)', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', onClick: () => setView('faq') },
            { label: 'Hubungi Akauntan (WhatsApp)', icon: MessageCircle, color: 'text-blue-600', bg: 'bg-blue-50', onClick: () => window.open('https://wa.me/60126254849', '_blank') },
            { label: 'Terma & Syarat', icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-50', onClick: () => setView('terms') },
          ].map((item, i) => (
            <button key={i} onClick={item.onClick} className="w-full p-5 flex items-center justify-between border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-all group">
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-lg ${item.bg} flex items-center justify-center ${item.color} mr-4 group-hover:scale-105 transition-transform`}>
                  <item.icon size={18} strokeWidth={2} />
                </div>
                <div className="text-left">
                  <span className="font-bold text-slate-700 text-base tracking-tight font-display block">{item.label}</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
            </button>
          ))}
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2.5 py-4 px-6 bg-white border-2 border-rose-200 text-rose-500 font-semibold text-sm rounded-2xl hover:bg-rose-500 hover:text-white hover:border-rose-500 active:scale-[0.98] transition-all duration-200 shadow-sm hover:shadow-md group"
        >
          <LogOut size={16} className="group-hover:translate-x-0.5 transition-transform duration-200" strokeWidth={2.5} />
          Log Keluar Akaun
        </button>
      </div>
    </div>
  );
};

const CategoriesView = ({ 
  categoryMappings, 
  setCategoryMappings, 
  onBack 
}: { 
  categoryMappings: Record<string, string>, 
  setCategoryMappings: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  onBack: () => void 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newCategoryType, setNewCategoryType] = useState('EXPENSE');

  const customCategories = Object.keys(categoryMappings).filter(cat => 
    !ALL_CATEGORIES.includes(cat)
  ).sort();

  const filteredCustom = customCategories.filter(cat => 
    cat.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = (cat: string) => {
    const newMappings = { ...categoryMappings };
    delete newMappings[cat];
    setCategoryMappings(newMappings);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) return;
    const upper = newCategory.trim().toUpperCase();
    setCategoryMappings(prev => ({
      ...prev,
      [upper]: newCategoryType
    }));
    setNewCategory('');
  };

  return (
    <div className="p-6 pb-24 md:pl-64 md:pt-12 max-w-4xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-8 transition-colors">
        <ArrowLeft size={20} />
        <span className="font-bold text-sm uppercase tracking-wider">Kembali</span>
      </button>

      <header className="mb-12">
        <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight font-display">Pengurusan Kategori</h2>
        <p className="text-slate-500 text-sm font-medium">Urus kategori tersuai anda untuk pengelasan transaksi yang lebih baik.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="card-premium p-6 bg-white sticky top-24">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6 flex items-center gap-2">
              <Plus size={16} className="text-emerald-500" />
              Tambah Kategori Baru
            </h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nama Kategori</label>
                <input 
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Contoh: GRABFOOD"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Jenis</label>
                <select 
                  value={newCategoryType}
                  onChange={(e) => setNewCategoryType(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                >
                  <option value="SALES">Profit & Loss (Jualan)</option>
                  <option value="EXPENSE">Profit & Loss (Belanja)</option>
                  <option value="COGS">Profit & Loss (COGS)</option>
                  <option value="ASSET_LIABILITY">Balance Sheet (Aset/Liabiliti)</option>
                </select>
              </div>
              <button 
                type="submit"
                className="w-full py-3.5 bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                Simpan Kategori
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card-premium bg-white overflow-hidden">
            <div className="p-6 border-b border-slate-50">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  placeholder="Cari kategori tersuai..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            <div className="divide-y divide-slate-50">
              {filteredCustom.length > 0 ? (
                filteredCustom.map(cat => (
                  <div key={cat} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                        <Tag size={18} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 tracking-tight">{cat}</h4>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {categoryMappings[cat] === 'SALES' ? 'Profit & Loss (Jualan)' : 
                           categoryMappings[cat] === 'EXPENSE' ? 'Profit & Loss (Belanja)' : 
                           categoryMappings[cat] === 'COGS' ? 'Profit & Loss (COGS)' : 'Balance Sheet (Aset/Liabiliti)'}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDelete(cat)}
                      className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-20 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mx-auto mb-4">
                    <Tag size={32} />
                  </div>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-wider">Tiada kategori tersuai ditemui.</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shrink-0 shadow-sm border border-slate-100">
                <Info size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">Nota Penting</h4>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Hanya kategori tersuai yang anda tambah boleh dipadamkan. Kategori standard perakaunan (Chart of Accounts) adalah tetap untuk memastikan integriti laporan kewangan anda.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const FAQView = ({ onBack }: { onBack: () => void }) => {
  const faqs = [
    {
      q: "Bagaimana cara untuk mengimbas resit?",
      a: "Anda boleh klik pada butang '+' di bahagian bawah skrin dan pilih 'Imbas Resit'. Ambil gambar resit anda dengan jelas dan AI kami akan mengekstrak maklumat secara automatik."
    },
    {
      q: "Adakah data saya selamat?",
      a: "Ya, kami menggunakan penyulitan gred bank untuk memastikan semua data kewangan anda selamat dan hanya boleh diakses oleh anda."
    },
    {
      q: "Bolehkah saya eksport data ke Excel?",
      a: "Boleh. Anda boleh pergi ke bahagian 'Laporan' atau 'Profil' dan pilih 'Eksport Data (PDF)' untuk memuat turun laporan dalam format PDF standard perakaunan."
    },
    {
      q: "Bagaimana cara untuk menaik taraf plan?",
      a: "Pergi ke bahagian 'Akaun' (Profil) dan klik pada kad 'Naik Taraf Plan'. Pilih plan yang sesuai dengan keperluan perniagaan anda."
    },
    {
      q: "Apa itu Smart Analisis?",
      a: "Smart Analisis adalah ciri kecerdasan buatan (AI) yang menganalisis data kewangan anda untuk memberikan nasihat perniagaan, ramalan jualan, dan tips penjimatan cukai."
    }
  ];

  return (
    <div className="p-6 pb-24 md:pl-64 md:pt-12 max-w-4xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-8 transition-colors">
        <ArrowLeft size={20} />
        <span className="font-bold text-sm uppercase tracking-wider">Kembali</span>
      </button>

      <header className="mb-12">
        <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight font-display">Pusat Bantuan (FAQ)</h2>
        <p className="text-slate-500 text-sm font-medium">Soalan lazim yang sering ditanya oleh pengguna Monitacc.</p>
      </header>

      <div className="space-y-4">
        {faqs.map((faq, i) => (
          <div key={i} className="card-premium p-6 bg-white">
            <h4 className="text-base font-bold text-slate-900 mb-3 flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px] shrink-0 mt-0.5">Q</span>
              {faq.q}
            </h4>
            <div className="flex items-start gap-3 text-slate-600 text-sm leading-relaxed">
              <span className="w-6 h-6 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center text-[10px] shrink-0 mt-0.5">A</span>
              <p>{faq.a}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TermsView = ({ onBack }: { onBack: () => void }) => {
  return (
    <div className="p-6 pb-24 md:pl-64 md:pt-12 max-w-4xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-8 transition-colors">
        <ArrowLeft size={20} />
        <span className="font-bold text-sm uppercase tracking-wider">Kembali</span>
      </button>

      <header className="mb-12">
        <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight font-display">Terma & Syarat</h2>
        <p className="text-slate-500 text-sm font-medium">Sila baca terma dan syarat penggunaan Monitacc dengan teliti.</p>
      </header>

      <div className="card-premium p-8 bg-white space-y-8 text-slate-600 text-sm leading-relaxed">
        <section>
          <h3 className="text-lg font-bold text-slate-900 mb-3 font-display tracking-tight">1. Penerimaan Terma</h3>
          <p>Dengan mengakses dan menggunakan aplikasi Monitacc, anda bersetuju untuk terikat dengan terma dan syarat ini. Jika anda tidak bersetuju, sila hentikan penggunaan aplikasi ini dengan serta-merta.</p>
        </section>

        <section>
          <h3 className="text-lg font-bold text-slate-900 mb-3 font-display tracking-tight">2. Penggunaan Akaun</h3>
          <p>Anda bertanggungjawab sepenuhnya untuk menjaga kerahsiaan maklumat akaun dan kata laluan anda. Sebarang aktiviti yang berlaku di bawah akaun anda adalah tanggungjawab anda.</p>
        </section>

        <section>
          <h3 className="text-lg font-bold text-slate-900 mb-3 font-display tracking-tight">3. Ketepatan Data</h3>
          <p>Walaupun Monitacc menggunakan teknologi AI untuk mengekstrak data dari resit, anda bertanggungjawab untuk menyemak dan mengesahkan ketepatan setiap transaksi sebelum menyimpannya.</p>
        </section>

        <section>
          <h3 className="text-lg font-bold text-slate-900 mb-3 font-display tracking-tight">4. Langganan & Pembayaran</h3>
          <p>Pembayaran untuk plan langganan adalah tidak boleh dikembalikan. Anda boleh membatalkan langganan anda pada bila-bila masa, namun akses akan kekal sehingga tamat tempoh kitaran pengebilan semasa.</p>
        </section>

        <section>
          <h3 className="text-lg font-bold text-slate-900 mb-3 font-display tracking-tight">5. Privasi Data</h3>
          <p>Kami menghormati privasi anda. Data anda tidak akan dikongsi dengan pihak ketiga tanpa kebenaran anda, kecuali jika dikehendaki oleh undang-undang.</p>
        </section>

        <div className="pt-8 border-t border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
          Terakhir Dikemaskini: 31 Mac 2026
        </div>
      </div>
    </div>
  );
};

const PLAN_CONFIG: { name: string; price: number; color: string; features: string[] }[] = [
  { name: 'free', price: 0, color: 'slate', features: ['5 Imbasan / bulan', 'Unlimited Manual', '1x Bank Statement'] },
  { name: 'Starter', price: 50, color: 'emerald', features: ['100 Imbasan / bulan', '3x Bank Statement', '1x Smart Analysis'] },
  { name: 'Growth', price: 100, color: 'emerald', features: ['250 Imbasan / bulan', '9x Bank Statement', '4x Smart Analysis'] },
  { name: 'Ultimate', price: 150, color: 'emerald', features: ['Unlimited Imbasan', 'Unlimited Bank Statement', 'Unlimited Smart Analysis', 'P&L + Balance Sheet'] },
];

const SubscriptionManagementView = ({ onBack }: { onBack: () => void }) => {
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterPlan, setFilterPlan] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [editPlan, setEditPlan] = useState('');
  const [editPlanEnd, setEditPlanEnd] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await apiGetUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleUpdatePlan = async (userId: string) => {
    try {
      await apiUpdateUserPlan(userId, editPlan, editPlanEnd || undefined);
      setEditingUser(null);
      setEditPlan('');
      setEditPlanEnd('');
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'cancelled' : 'active';
    try {
      await apiUpdateUserStatus(userId, newStatus);
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = users.filter(u => {
    if (filterPlan !== 'all' && (u.plan || 'free') !== filterPlan) return false;
    if (filterStatus !== 'all' && (u.status || 'active') !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.company_name?.toLowerCase().includes(q));
    }
    return true;
  });

  const planCounts = PLAN_CONFIG.map(p => ({
    ...p,
    count: users.filter(u => (u.plan || 'free') === p.name).length,
  }));

  const activeCount = users.filter(u => (u.status || 'active') === 'active' && u.plan !== 'free').length;
  const totalRevenue = users.reduce((sum, u) => {
    const cfg = PLAN_CONFIG.find(p => p.name === (u.plan || 'free'));
    if ((u.status || 'active') === 'active' && cfg) return sum + cfg.price;
    return sum;
  }, 0);

  const planBadge = (plan: string) => {
    const cls = plan === 'Ultimate' ? 'bg-slate-900 text-white' :
      plan === 'Growth' ? 'bg-emerald-600 text-white' :
      plan === 'Starter' ? 'bg-emerald-100 text-emerald-700' :
      'bg-slate-100 text-slate-500';
    return <span className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider ${cls}`}>{plan || 'free'}</span>;
  };

  const statusBadge = (status: string) => {
    const s = status || 'active';
    const cls = s === 'active' ? 'bg-emerald-100 text-emerald-700' : s === 'cancelled' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700';
    return <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${cls}`}>{s === 'active' ? 'Aktif' : s === 'cancelled' ? 'Batal' : 'Tamat'}</span>;
  };

  return (
    <div className="p-4 md:p-6 pb-24 md:pl-64 md:pt-12 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><ArrowLeft size={20} /></button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight font-display">Pengurusan Langganan</h2>
            <p className="text-sm text-slate-500 font-medium">Pantau subscriber mengikut pakej</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {planCounts.map(p => (
          <button
            key={p.name}
            onClick={() => setFilterPlan(filterPlan === p.name ? 'all' : p.name)}
            className={`p-4 rounded-2xl border transition-all text-left ${filterPlan === p.name ? 'border-emerald-500 ring-2 ring-emerald-100 bg-white' : 'border-slate-200 bg-white hover:border-slate-300'}`}
          >
            <div className="flex items-center justify-between mb-2">
              {planBadge(p.name)}
              <span className="text-[10px] font-bold text-slate-400">RM{p.price}/bln</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{p.count}</p>
            <p className="text-[10px] font-medium text-slate-400 mt-0.5">pengguna</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100">
          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Subscriber Aktif (Berbayar)</p>
          <p className="text-2xl font-bold text-emerald-900">{activeCount}</p>
        </div>
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Anggaran Hasil Bulanan</p>
          <p className="text-2xl font-bold text-slate-900">RM {totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Jumlah Pengguna</p>
          <p className="text-2xl font-bold text-slate-900">{users.length}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari nama, email, syarikat..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'active', 'cancelled'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${filterStatus === s ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
            >
              {s === 'all' ? 'Semua' : s === 'active' ? 'Aktif' : 'Batal'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-emerald-500" />
        </div>
      ) : (
        <div className="card-premium overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pengguna</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pakej</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tempoh</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Affiliate</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400 font-medium">Tiada pengguna dijumpai</td></tr>
                ) : filtered.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="text-sm font-bold text-slate-900">{u.name || '-'}</div>
                      <div className="text-[10px] text-slate-400 font-medium">{u.email}</div>
                      {u.company_name && <div className="text-[10px] text-emerald-600 font-bold mt-0.5 uppercase tracking-tighter">{u.company_name}</div>}
                    </td>
                    <td className="px-5 py-4">{planBadge(u.plan || 'free')}</td>
                    <td className="px-5 py-4">{statusBadge(u.status || 'active')}</td>
                    <td className="px-5 py-4">
                      <div className="text-[10px] text-slate-500 font-medium">
                        {u.plan_start ? <span>Mula: {format(parseISO(u.plan_start), 'dd MMM yyyy')}</span> : <span className="text-slate-300">-</span>}
                      </div>
                      {u.plan_end && (
                        <div className="text-[10px] text-slate-400 font-medium">
                          Tamat: {format(parseISO(u.plan_end), 'dd MMM yyyy')}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${u.referred_by ? 'bg-blue-500' : 'bg-slate-200'}`} />
                        <span className="text-xs font-medium text-slate-600">{u.referred_by || 'Direct'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setEditingUser(u); setEditPlan(u.plan || 'free'); setEditPlanEnd(u.plan_end || ''); }}
                          className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition-all"
                        >
                          Tukar Pakej
                        </button>
                        <button
                          onClick={() => handleToggleStatus(u.id, u.status || 'active')}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${(u.status || 'active') === 'active' ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                        >
                          {(u.status || 'active') === 'active' ? 'Batal' : 'Aktifkan'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400">{filtered.length} daripada {users.length} pengguna</span>
            {filterPlan !== 'all' && (
              <button onClick={() => setFilterPlan('all')} className="text-[10px] font-bold text-emerald-600 hover:underline">Reset Penapis</button>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingUser(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
              <div className="p-6 bg-slate-900 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold tracking-tight font-display">Tukar Pakej Langganan</h3>
                    <p className="text-sm text-slate-400 font-medium mt-0.5">{editingUser.name} - {editingUser.email}</p>
                  </div>
                  <button onClick={() => setEditingUser(null)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"><X size={18} /></button>
                </div>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Pakej Semasa</p>
                  {planBadge(editingUser.plan || 'free')}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Pakej Baru</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PLAN_CONFIG.map(p => (
                      <button
                        key={p.name}
                        onClick={() => setEditPlan(p.name)}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${editPlan === p.name ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 hover:border-slate-200'}`}
                      >
                        <div className="text-xs font-bold text-slate-900">{p.name === 'free' ? 'Percuma' : p.name}</div>
                        <div className="text-[10px] text-slate-500 font-medium">RM{p.price}/bln</div>
                      </button>
                    ))}
                  </div>
                </div>
                {editPlan !== 'free' && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Tarikh Tamat (Pilihan)</label>
                    <input
                      type="date"
                      value={editPlanEnd}
                      onChange={e => setEditPlanEnd(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                )}
                <button
                  onClick={() => handleUpdatePlan(editingUser.id)}
                  className="w-full py-3.5 bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-[0.98]"
                >
                  Kemaskini Pakej
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const PlansView = ({ user, onPlanActivated }: { user: UserType | null; onPlanActivated?: (plan: string) => void }) => {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{ name: string; price: string; period?: string; features: string[]; popular: boolean } | null>(null);

  const handleManageSubscription = async () => {
    setError('');
    setLoadingPortal(true);
    try {
      const url = await openCustomerPortal();
      window.location.href = url;
    } catch (err: any) {
      setError(err.message || 'Ralat semasa membuka portal pengurusan.');
      setLoadingPortal(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      const plan = params.get('plan') || '';
      window.history.replaceState({}, '', window.location.pathname);
      setConfirmingPayment(true);

      let attempts = 0;
      const maxAttempts = 20;
      const poll = async () => {
        attempts++;
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) { setConfirmingPayment(false); return; }
          const { data: profile } = await supabase
            .from('users')
            .select('plan')
            .eq('id', session.user.id)
            .maybeSingle();
          if (profile && profile.plan && profile.plan !== 'free' && profile.plan !== 'Percuma') {
            setConfirmingPayment(false);
            setSuccessMsg(`Pembayaran berjaya! Plan ${profile.plan} anda kini aktif.`);
            if (onPlanActivated) onPlanActivated(profile.plan);
            return;
          }
        } catch (_) {}
        if (attempts < maxAttempts) {
          setTimeout(poll, 3000);
        } else {
          setConfirmingPayment(false);
          setSuccessMsg(`Pembayaran berjaya! Plan ${plan} anda akan diaktifkan tidak lama lagi.`);
          if (onPlanActivated) setTimeout(() => onPlanActivated(plan), 3000);
        }
      };
      poll();
    } else if (params.get('payment') === 'cancelled') {
      setError('Pembayaran dibatalkan. Anda boleh cuba semula bila-bila masa.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleConfirmSubscribe = async () => {
    if (!selectedPlan) return;
    const planName = selectedPlan.name;
    setSelectedPlan(null);
    setError('');
    setLoadingPlan(planName);
    try {
      const url = await createCheckoutSession(planName as PaidPlan);
      window.location.href = url;
    } catch (err: any) {
      setError(err.message || 'Ralat semasa memproses pembayaran. Sila cuba lagi.');
      setLoadingPlan(null);
    }
  };

  const plans = [
    {
      name: 'Percuma',
      price: '0',
      period: undefined as string | undefined,
      features: [
        '5 Imbasan Transaksi / bulan',
        'Unlimited Rekod Transaksi Manual',
        '1× Imbasan Bank Statement',
        'Monitacc Assistant',
      ],
      popular: false,
    },
    {
      name: 'Starter',
      price: '50',
      period: '/bln',
      features: [
        '100 Imbasan Transaksi / bulan',
        'Unlimited Rekod Transaksi Manual',
        '3× Imbasan Bank Statement',
        'Monitacc Assistant',
        '1× Smart Analysis',
      ],
      popular: false,
    },
    {
      name: 'Growth',
      price: '100',
      period: '/bln',
      features: [
        '250 Imbasan Transaksi / bulan',
        'Unlimited Rekod Transaksi Manual',
        '9× Imbasan Bank Statement',
        'Monitacc Assistant',
        '4× Smart Analysis',
      ],
      popular: false,
    },
    {
      name: 'Ultimate',
      price: '150',
      period: '/bln',
      features: [
        'Unlimited Imbasan Transaksi',
        'Unlimited Rekod Transaksi Manual',
        'Unlimited Imbasan Bank Statement',
        'Unlimited Smart Analysis',
        'P&L Report + Balance Sheet',
        'Reconciliation Features',
      ],
      popular: true,
    },
  ];

  const currentPlan = user?.plan || 'free';
  const planKeyMap: Record<string, string> = { free: 'Percuma', Percuma: 'Percuma', Starter: 'Starter', Growth: 'Growth', Ultimate: 'Ultimate' };
  const activePlanName = planKeyMap[currentPlan] || 'Percuma';

  return (
    <div className="p-6 pb-24 md:pl-64 md:pt-12 max-w-5xl mx-auto">
      {selectedPlan && (
        <PlanConfirmModal
          plan={selectedPlan}
          onConfirm={handleConfirmSubscribe}
          onClose={() => setSelectedPlan(null)}
        />
      )}

      <header className="mb-10 text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight font-display">Pilih Plan Anda</h2>
        <p className="text-slate-500 text-sm font-medium">Sesuai untuk setiap tahap perniagaan anda.</p>
      </header>

      {confirmingPayment && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
          <p className="text-sm font-bold text-blue-700">Mengesahkan pembayaran... Sila tunggu sebentar.</p>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-emerald-700">{successMsg}</p>
          </div>
          <button
            onClick={() => { if (onPlanActivated) onPlanActivated(''); }}
            className="shrink-0 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all active:scale-95"
          >
            Ke Dashboard
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3">
          <AlertCircle size={18} className="text-rose-600 shrink-0" />
          <p className="text-sm font-bold text-rose-700">{error}</p>
          <button onClick={() => setError('')} className="ml-auto text-rose-400 hover:text-rose-600"><X size={16} /></button>
        </div>
      )}

      {activePlanName !== 'Percuma' && (
        <div className="mb-8 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
          <CreditCard size={18} className="text-emerald-600 shrink-0" />
          <p className="text-sm font-medium text-emerald-700">Plan semasa anda: <span className="font-bold">{activePlanName}</span></p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {plans.map((plan, i) => {
          const isActive = activePlanName === plan.name;
          const isFree = plan.name === 'Percuma';
          const isLoading = loadingPlan === plan.name;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className={`relative rounded-2xl p-6 flex flex-col transition-all duration-300 hover:-translate-y-1 border ${
                plan.popular
                  ? 'bg-slate-900 border-emerald-500 ring-4 ring-emerald-50 scale-[1.03] z-10 shadow-xl'
                  : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-5 bg-emerald-500 text-white px-3 py-0.5 rounded-full text-[8px] font-bold tracking-wider shadow-lg">PALING POPULAR</span>
              )}
              {isActive && (
                <span className="absolute -top-3 right-5 bg-blue-500 text-white px-3 py-0.5 rounded-full text-[8px] font-bold tracking-wider shadow">PLAN SEMASA</span>
              )}
              <h3 className={`text-base font-bold mb-0.5 tracking-tight font-display text-center ${plan.popular ? 'text-white' : 'text-slate-900'}`}>{plan.name}</h3>
              <div className="flex items-baseline mb-5 justify-center">
                <span className={`text-[9px] font-bold mr-0.5 ${plan.popular ? 'text-white/60' : 'text-slate-500'}`}>RM</span>
                <span className={`text-3xl font-extrabold tracking-tight font-display ${plan.popular ? 'text-white' : 'text-slate-900'}`}>{plan.price}</span>
                {!isFree && <span className={`text-[9px] font-medium ml-0.5 ${plan.popular ? 'text-white/60' : 'text-slate-500'}`}>/bln</span>}
              </div>
              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.map((f, j) => (
                  <li key={j} className={`flex items-start text-[11px] font-medium leading-snug ${plan.popular ? 'text-white/90' : 'text-slate-700'}`}>
                    <Check size={11} strokeWidth={3} className="text-emerald-500 shrink-0 mt-0.5 mr-2" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => {
                  if (!isActive && !isFree) setSelectedPlan(plan);
                }}
                disabled={isActive || isFree || isLoading}
                className={`w-full py-3 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2 ${
                  isActive
                    ? 'bg-blue-100 text-blue-700 cursor-default'
                    : isFree
                    ? 'bg-slate-100 text-slate-500 cursor-default'
                    : plan.popular
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/30'
                    : 'bg-slate-900 hover:bg-slate-700 text-white'
                }`}
              >
                {isLoading ? (
                  <><Loader2 size={13} className="animate-spin" /> Memproses...</>
                ) : isActive ? (
                  <><CheckCircle2 size={13} /> Plan Aktif</>
                ) : isFree ? (
                  'Plan Semasa'
                ) : (
                  `Langgan ${plan.name}`
                )}
              </button>
            </motion.div>
          );
        })}
      </div>

      {activePlanName !== 'Percuma' && (
        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            onClick={handleManageSubscription}
            disabled={loadingPortal}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95 disabled:opacity-60"
          >
            {loadingPortal ? (
              <><Loader2 size={13} className="animate-spin" /> Membuka Portal...</>
            ) : (
              <><CreditCard size={13} /> Urus Langganan Stripe</>
            )}
          </button>
          <p className="text-center text-[10px] text-slate-400 font-medium">
            Kemaskini kad, lihat invois, atau batalkan langganan melalui portal Stripe.
          </p>
        </div>
      )}

      {activePlanName === 'Percuma' && (
        <p className="text-center text-[10px] text-slate-400 mt-8 font-medium">
          Pembayaran selamat diproses oleh Stripe. Batalkan langganan bila-bila masa.
        </p>
      )}
    </div>
  );
};

const AdminLoginView = ({ onLogin, onBack }: { onLogin: () => void, onBack: () => void }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin123') {
      onLogin();
    } else {
      setError('Kata laluan salah. Sila cuba lagi.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden"
      >
        <div className="p-8 bg-slate-900 text-white text-center relative">
          <div className="absolute top-4 left-4 flex items-center gap-2 opacity-50">
            <div className="w-6 h-6 bg-emerald-500 rounded flex items-center justify-center text-white">
              <CreditCard size={12} />
            </div>
            <span className="text-[10px] font-bold tracking-tighter">Monitacc</span>
          </div>
          <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
            <ShieldCheck size={32} />
          </div>
          <h2 className="text-2xl font-bold tracking-tight font-display">Akses Pentadbir</h2>
          <p className="text-slate-400 text-sm mt-2">Sila masukkan kata laluan keselamatan untuk masuk ke Panel Kawalan.</p>
        </div>
        
        <form onSubmit={handleLogin} className="p-8 space-y-6">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Kata Laluan Admin</label>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-mono"
              autoFocus
            />
            {error && <p className="text-rose-600 text-[10px] font-bold mt-2 uppercase tracking-wider">{error}</p>}
          </div>

          <div className="flex flex-col gap-3">
            <button 
              type="submit"
              className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95"
            >
              Masuk Panel Admin
            </button>
            <button 
              type="button"
              onClick={onBack}
              className="w-full py-4 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
            >
              Kembali
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const AffiliateLoginView = ({ onLogin, onBack }: { onLogin: (affiliate: any) => void, onBack: () => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock authentication
    if (email === 'ali@affiliated.com' && password === 'ali123') {
      onLogin({ id: 1, name: 'Ejen Ali', email: 'ali@affiliated.com', referrals: 45, commission: 1250.50, special_id: 'AFF-0001' });
    } else if (email === 'bakar@affiliated.com' && password === 'bakar123') {
      onLogin({ id: 2, name: 'Ejen Bakar', email: 'bakar@affiliated.com', referrals: 28, commission: 840.00, special_id: 'AFF-0002' });
    } else {
      setError('Emel atau kata laluan salah.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden"
      >
        <div className="p-8 bg-emerald-600 text-white text-center relative">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
            <Users size={32} />
          </div>
          <h2 className="text-2xl font-bold tracking-tight font-display">Portal Affiliated</h2>
          <p className="text-emerald-100 text-sm mt-2">Log masuk untuk pantau rujukan dan komisen anda.</p>
        </div>
        
        <form onSubmit={handleLogin} className="p-8 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Emel Ejen</label>
            <input 
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejen@monitacc.com"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Kata Laluan</label>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
              required
            />
            {error && <p className="text-rose-600 text-[10px] font-bold mt-2 uppercase tracking-wider">{error}</p>}
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <button 
              type="submit"
              className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95"
            >
              Log Masuk Portal
            </button>
            <button 
              type="button"
              onClick={onBack}
              className="w-full py-4 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
            >
              Kembali
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const AffiliateDashboardView = ({ affiliate, onLogout }: { affiliate: any, onLogout: () => void }) => {
  const referrals = [
    { id: 'USR-8821', name: 'Ahmad Fauzi', plan: 'Ultimate', status: 'active', joined: '01/04/2026', commission: 15.00 },
    { id: 'USR-9902', name: 'Siti Aminah', plan: 'Starter', status: 'active', joined: '03/04/2026', commission: 5.00 },
    { id: 'USR-7712', name: 'Robert Fox', plan: 'Growth', status: 'cancelled', joined: '25/03/2026', commission: 10.00 },
    { id: 'USR-6654', name: 'Lim Guan Eng', plan: 'Ultimate', status: 'active', joined: '05/04/2026', commission: 15.00 },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
            <Users size={18} />
          </div>
          <span className="font-bold text-slate-900 tracking-tight font-display">Affiliate Portal</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-xs font-bold text-slate-900">{affiliate.name}</p>
            <p className="text-[10px] text-emerald-600 font-bold">{affiliate.special_id}</p>
          </div>
          <button 
            onClick={onLogout}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </nav>

      <main className="p-6 max-w-5xl mx-auto space-y-8">
        <header>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-1 font-display">Selamat Kembali, {affiliate.name.split(' ')[1]}!</h2>
          <p className="text-slate-500 font-medium tracking-tight">Pantau prestasi rujukan dan pendapatan komisen anda.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
              <Users size={20} />
            </div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Jumlah Rujukan</p>
            <p className="text-2xl font-bold text-slate-900 tracking-tight font-display">{affiliate.referrals}</p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
              <DollarSign size={20} />
            </div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Komisen Terkumpul</p>
            <p className="text-2xl font-bold text-slate-900 tracking-tight font-display">RM {affiliate.commission.toFixed(2)}</p>
          </div>
          <div className="bg-slate-900 p-6 rounded-3xl shadow-xl shadow-slate-200 text-white">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mb-4">
              <Tag size={20} className="text-emerald-400" />
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Link Affiliate Anda</p>
            <div className="flex items-center justify-between gap-2 mt-2">
              <code className="text-[10px] font-mono text-emerald-400">monitacc.com/?ref={affiliate.special_id}</code>
              <button className="p-1.5 hover:bg-white/10 rounded transition-colors">
                <Copy size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-900 tracking-tight font-display">Senarai Rujukan Terkini</h3>
            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider">4 Pengguna</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-4">Pengguna</th>
                  <th className="px-4 py-4">Pakej</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Tarikh</th>
                  <th className="px-4 py-4 text-right">Komisen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {referrals.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-4">
                      <p className="text-sm font-bold text-slate-900">{u.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{u.id}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                        u.plan === 'Ultimate' ? 'bg-slate-900 text-white' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {u.plan}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        u.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {u.status === 'active' ? 'Aktif' : 'Batal'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs font-medium text-slate-400">{u.joined}</td>
                    <td className="px-4 py-4 text-right text-sm font-bold text-emerald-600">RM {u.commission.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

const AdminDashboardView = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeSubscribers: 0,
    cancelledUsers: 0,
    totalTokensUsed: 0,
    monthlyRevenue: 0,
    totalAffiliated: 0,
  });
  const [packageDistribution, setPackageDistribution] = useState<{ name: string; value: number; fill: string }[]>([]);
  const [tokenUsageData, setTokenUsageData] = useState<{ day: string; tokens: number }[]>([]);
  const [recentUsers, setRecentUsers] = useState<UserType[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [dashData, usersData] = await Promise.all([
          apiGetAdminDashboardStats(),
          apiGetUsers(),
        ]);
        setStats({
          totalUsers: dashData.totalUsers,
          activeSubscribers: dashData.activeSubscribers,
          cancelledUsers: dashData.cancelledUsers,
          totalTokensUsed: dashData.totalTokensUsed,
          monthlyRevenue: dashData.monthlyRevenue,
          totalAffiliated: dashData.totalAffiliated,
        });
        setPackageDistribution(dashData.packageDistribution);
        setTokenUsageData(dashData.tokenUsageData);
        setRecentUsers(usersData.slice(0, 8));
      } catch (err) {
        console.error('Error loading admin dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-4 md:p-6 pb-24 md:pl-64 md:pt-12 max-w-7xl mx-auto flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 pb-24 md:pl-64 md:pt-12 max-w-7xl mx-auto">
      <header className="mb-10">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-1 font-display">Admin Dashboard</h2>
        <p className="text-slate-500 font-medium tracking-tight">Pantau penggunaan token dan langganan pengguna.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
        {[
          { label: 'Jumlah Pengguna', value: stats.totalUsers, icon: User, bg: 'bg-blue-50', text: 'text-blue-600' },
          { label: 'Pelanggan Aktif', value: stats.activeSubscribers, icon: CreditCard, bg: 'bg-emerald-50', text: 'text-emerald-600' },
          { label: 'Pengguna Batal', value: stats.cancelledUsers, icon: X, bg: 'bg-rose-50', text: 'text-rose-600' },
          { label: 'Token Digunakan', value: stats.totalTokensUsed.toLocaleString(), icon: Zap, bg: 'bg-amber-50', text: 'text-amber-600' },
          { label: 'Pendapatan (RM)', value: stats.monthlyRevenue.toLocaleString(), icon: DollarSign, bg: 'bg-emerald-50', text: 'text-emerald-600' },
          { label: 'Jumlah Affiliated', value: stats.totalAffiliated, icon: Users, bg: 'bg-slate-100', text: 'text-slate-600' },
        ].map((item, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className={`w-9 h-9 rounded-xl ${item.bg} ${item.text} flex items-center justify-center mb-3`}>
              <item.icon size={18} />
            </div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{item.label}</p>
            <p className="text-2xl font-bold text-slate-900 tracking-tight font-display">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6 tracking-tight font-display">Penggunaan Token (7 Hari Terakhir)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tokenUsageData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="tokens" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6 tracking-tight font-display">Agihan Pakej Langganan</h3>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie data={packageDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {packageDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </RePieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2 ml-4 shrink-0">
              {packageDistribution.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap">{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-900 tracking-tight font-display">Pengguna Terkini</h3>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{recentUsers.length} terkini</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Pengguna</th>
                <th className="px-5 py-3.5">Pakej</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Affiliate</th>
                <th className="px-5 py-3.5">Tarikh Daftar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentUsers.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400">Tiada pengguna lagi</td></tr>
              ) : recentUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="text-sm font-bold text-slate-900">{u.name || '-'}</div>
                    <div className="text-[10px] text-slate-400 font-medium">{u.email}</div>
                    {u.company_name && <div className="text-[10px] text-emerald-600 font-bold uppercase">{u.company_name}</div>}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                      (u.plan || 'free') === 'Ultimate' ? 'bg-slate-900 text-white' :
                      (u.plan || 'free') === 'Growth' ? 'bg-emerald-600 text-white' :
                      (u.plan || 'free') === 'Starter' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>{u.plan || 'free'}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`flex items-center gap-1.5 text-[10px] font-bold ${(u.status || 'active') === 'active' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${(u.status || 'active') === 'active' ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                      {(u.status || 'active') === 'active' ? 'Aktif' : 'Batal'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs font-medium text-slate-500">{u.referred_by || 'Direct'}</td>
                  <td className="px-5 py-4 text-xs font-medium text-slate-400">{u.created_at ? format(parseISO(u.created_at), 'dd/MM/yyyy') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const AffiliatedManagementView = () => {
  const [affiliates, setAffiliates] = useState([
    { id: 1, name: 'Ejen Ali', email: 'ali@affiliated.com', referrals: 45, commission: 1250.50, status: 'Aktif', joinedDate: '12/01/2026', isPaid: false, phone: '012-3456789', bank: 'Maybank', accountNo: '164012345678' },
    { id: 2, name: 'Ejen Bakar', email: 'bakar@affiliated.com', referrals: 28, commission: 840.00, status: 'Aktif', joinedDate: '15/01/2026', isPaid: true, phone: '013-9876543', bank: 'CIMB', accountNo: '7012345678' },
    { id: 3, name: 'Ejen Comot', email: 'comot@affiliated.com', referrals: 12, commission: 360.20, status: 'Tidak Aktif', joinedDate: '20/02/2026', isPaid: false, phone: '011-22334455', bank: 'RHB', accountNo: '2123456789' },
    { id: 4, name: 'Ejen Dayang', email: 'dayang@affiliated.com', referrals: 67, commission: 2010.00, status: 'Aktif', joinedDate: '05/01/2026', isPaid: false, phone: '017-5566778', bank: 'Public Bank', accountNo: '3123456789' },
  ]);

  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);

  const togglePaidStatus = (id: number) => {
    setAffiliates(prev => prev.map(agent => 
      agent.id === id ? { ...agent, isPaid: !agent.isPaid } : agent
    ));
  };

  return (
    <div className="p-4 md:p-6 pb-24 md:pl-64 md:pt-12 max-w-7xl mx-auto">
      <header className="mb-10 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-1 font-display">Pengurusan Affiliated</h2>
          <p className="text-slate-500 font-medium tracking-tight">Pantau prestasi ejen dan komisen affiliated (10% Lifetime).</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          <span>Tambah Ejen</span>
        </button>
      </header>

      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-10 flex items-start gap-4">
        <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shrink-0">
          <Sparkles size={20} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-emerald-900 mb-1">Polisi Komisen Affiliated</h4>
          <p className="text-xs text-emerald-700 font-medium leading-relaxed">
            Setiap ejen akan menerima komisen sebanyak <span className="font-bold">10%</span> bagi setiap langganan berbayar (Starter, Growth, Ultimate). 
            Komisen adalah bersifat <span className="font-bold">Lifetime</span> — ejen akan terus menerima komisen selagi pengguna yang dirujuk kekal melanggan. 
            <span className="italic opacity-75 ml-1">*Pakej Percuma tidak layak untuk komisen.</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {[
          { label: 'Jumlah Ejen', value: affiliates.length, icon: Users, color: 'blue' },
          { label: 'Jumlah Rujukan', value: affiliates.reduce((sum, a) => sum + a.referrals, 0), icon: TrendingUp, color: 'emerald' },
          { label: 'Jumlah Komisen (RM)', value: affiliates.reduce((sum, a) => sum + a.commission, 0).toLocaleString(undefined, { minimumFractionDigits: 2 }), icon: DollarSign, color: 'amber' },
        ].map((item, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className={`w-10 h-10 rounded-xl bg-${item.color}-50 text-${item.color}-600 flex items-center justify-center mb-4`}>
              <item.icon size={20} />
            </div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{item.label}</p>
            <p className="text-2xl font-bold text-slate-900 tracking-tight font-display">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-4">Nama Ejen</th>
                <th className="px-4 py-4">Rujukan</th>
                <th className="px-4 py-4">Komisen (RM)</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Tarikh Sertai</th>
                <th className="px-4 py-4 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {affiliates.map((agent) => (
                <tr key={agent.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-5">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{agent.name}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{agent.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-5 text-sm font-bold text-slate-700">{agent.referrals}</td>
                  <td className="px-4 py-5 text-sm font-mono text-emerald-600 font-bold">{agent.commission.toFixed(2)}</td>
                  <td className="px-4 py-5">
                    <div className="flex flex-col gap-1">
                      <span className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider w-fit ${
                        agent.status === 'Aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>{agent.status}</span>
                      {agent.isPaid && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[8px] font-bold uppercase tracking-tighter w-fit">
                          Sudah Dibayar
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-5 text-xs font-medium text-slate-400">{agent.joinedDate}</td>
                  <td className="px-4 py-5 text-right flex items-center justify-end gap-2">
                    <button 
                      onClick={() => togglePaidStatus(agent.id)}
                      className={`p-2 rounded-lg transition-all ${
                        agent.isPaid 
                          ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' 
                          : 'bg-slate-50 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                      }`}
                      title={agent.isPaid ? "Tanda sebagai Belum Bayar" : "Tanda sebagai Sudah Bayar"}
                    >
                      <Check size={16} strokeWidth={3} />
                    </button>
                    <button 
                      onClick={() => setSelectedAgent(agent)}
                      className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selectedAgent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAgent(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                    <Users size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold tracking-tight font-display">Butiran Ejen Affiliated</h3>
                    <p className="text-xs text-slate-400 font-medium">{selectedAgent.name}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedAgent(null)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"
                >
                  <X size={18} />
                </button>
              </div>
              
              <div className="p-8 space-y-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nama Penuh</p>
                    <p className="text-sm font-bold text-slate-900">{selectedAgent.name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Emel</p>
                    <p className="text-sm font-bold text-slate-900">{selectedAgent.email}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No. Telefon</p>
                    <p className="text-sm font-bold text-slate-900">{selectedAgent.phone}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ID Ejen (Tracking)</p>
                    <p className="text-sm font-bold text-emerald-600 font-mono">AFF-{selectedAgent.id.toString().padStart(4, '0')}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tarikh Sertai</p>
                    <p className="text-sm font-bold text-slate-900">{selectedAgent.joinedDate}</p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <CreditCard size={14} className="text-emerald-500" />
                    Maklumat Pembayaran
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bank</p>
                      <p className="text-sm font-bold text-slate-900">{selectedAgent.bank}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No. Akaun</p>
                      <p className="text-sm font-bold text-slate-900 font-mono">{selectedAgent.accountNo}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Jumlah Rujukan</p>
                    <p className="text-xl font-bold text-emerald-900">{selectedAgent.referrals} Pengguna</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Komisen Terkumpul</p>
                    <p className="text-xl font-bold text-blue-900">RM {selectedAgent.commission.toFixed(2)}</p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Users size={14} className="text-blue-500" />
                    Senarai Pengguna Dirujuk
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {[
                      { id: 'USR-8821', name: 'Ahmad Fauzi', plan: 'Ultimate', status: 'active' },
                      { id: 'USR-9902', name: 'Siti Aminah', plan: 'Starter', status: 'active' },
                      { id: 'USR-7712', name: 'Robert Fox', plan: 'Growth', status: 'cancelled' },
                      { id: 'USR-6654', name: 'Lim Guan Eng', plan: 'Ultimate', status: 'active' },
                    ].map((u, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 hover:border-emerald-200 transition-colors">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-slate-900">{u.name}</p>
                            <span className="text-[8px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{u.id}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-tighter">{u.plan}</span>
                            <span className="text-[9px] text-slate-300">•</span>
                            <span className={`text-[9px] font-bold uppercase ${
                              u.status === 'active' ? 'text-emerald-500' : 'text-rose-500'
                            }`}>
                              {u.status === 'active' ? 'Aktif' : 'Batal'}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Komisen</p>
                          <p className="text-[10px] font-bold text-emerald-600">RM {(u.plan === 'Ultimate' ? 15.00 : u.plan === 'Growth' ? 10.00 : 5.00).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setSelectedAgent(null)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Tutup
                  </button>
                  <button 
                    onClick={() => {
                      togglePaidStatus(selectedAgent.id);
                      setSelectedAgent((prev: any) => ({ ...prev, isPaid: !prev.isPaid }));
                    }}
                    className={`flex-1 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 ${
                      selectedAgent.isPaid 
                        ? 'bg-blue-600 text-white shadow-blue-200 hover:bg-blue-700' 
                        : 'bg-emerald-600 text-white shadow-emerald-200 hover:bg-emerald-700'
                    }`}
                  >
                    {selectedAgent.isPaid ? 'Tanda Belum Bayar' : 'Tanda Sudah Bayar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const TokenUsageView = () => {
  const [usageData, setUsageData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTopUp, setShowTopUp] = useState<{ show: boolean, user: any | null }>({ show: false, user: null });
  const [topUpAmount, setTopUpAmount] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await apiGetTokenUsageByUser();
      setUsageData(data);
    } catch (err) {
      console.error('Error fetching token usage:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleTopUp = () => {
    if (!showTopUp.user || !topUpAmount) return;
    const amount = parseInt(topUpAmount);
    if (isNaN(amount) || amount <= 0) return;
    setShowTopUp({ show: false, user: null });
    setTopUpAmount('');
  };

  return (
    <div className="p-4 md:p-6 pb-24 md:pl-64 md:pt-12 max-w-7xl mx-auto">
      <header className="mb-10">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-1 font-display">Token Usage by User</h2>
        <p className="text-slate-500 font-medium tracking-tight">Pantau penggunaan kuota AI bagi setiap pengguna.</p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-emerald-500" />
        </div>
      ) : (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Pengguna</th>
                <th className="px-6 py-4">Pelan</th>
                <th className="px-6 py-4">Penggunaan</th>
                <th className="px-6 py-4">Status Kuota</th>
                <th className="px-6 py-4">Kegunaan Terakhir</th>
                <th className="px-6 py-4 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usageData.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-400">Tiada data penggunaan token lagi</td></tr>
              ) : usageData.map((user) => {
                const percentage = user.limit > 0 ? (user.tokensUsed / user.limit) * 100 : 0;
                return (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold text-xs">
                          {(user.name || user.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{user.name || '-'}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                        (user.plan || 'free') === 'Ultimate' ? 'bg-slate-900 text-white' :
                        (user.plan || 'free') === 'Growth' ? 'bg-emerald-600 text-white' :
                        (user.plan || 'free') === 'Starter' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>{user.plan || 'free'}</span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1.5 min-w-[120px]">
                        <div className="flex justify-between text-[10px] font-bold">
                          <span className="text-slate-900">{(user.tokensUsed || 0).toLocaleString()}</span>
                          <span className="text-slate-400">/ {(user.limit || 0).toLocaleString()}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              percentage > 90 ? 'bg-rose-500' :
                              percentage > 70 ? 'bg-amber-500' :
                              'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${
                        percentage > 90 ? 'text-rose-600' :
                        percentage > 70 ? 'text-amber-600' :
                        'text-emerald-600'
                      }`}>
                        {percentage > 90 ? 'Hampir Tamat' : percentage > 70 ? 'Sederhana' : 'Mencukupi'}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-xs font-medium text-slate-400">
                      {user.lastUsed ? format(parseISO(user.lastUsed), 'dd/MM/yyyy') : '-'}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button
                        onClick={() => setShowTopUp({ show: true, user })}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-100 transition-all flex items-center gap-1.5 ml-auto"
                      >
                        <Zap size={12} />
                        <span>Top Up</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      <AnimatePresence>
        {showTopUp.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTopUp({ show: false, user: null })}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold tracking-tight font-display">Manual Token Top Up</h3>
                  <p className="text-xs text-slate-400 font-medium">Tambah kuota token untuk {showTopUp.user?.name}</p>
                </div>
                <button 
                  onClick={() => setShowTopUp({ show: false, user: null })}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"
                >
                  <X size={18} />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kuota Semasa</span>
                    <span className="text-sm font-bold text-slate-900">{showTopUp.user?.limit.toLocaleString()} Tokens</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500"
                      style={{ width: `${(showTopUp.user?.tokensUsed / showTopUp.user?.limit) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Jumlah Token Tambahan</label>
                  <div className="relative">
                    <Zap size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" />
                    <input 
                      type="number"
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      placeholder="Masukkan jumlah token (cth: 5000)"
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-bold text-slate-900"
                      autoFocus
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 font-medium italic">* Token ini akan ditambah ke dalam had kuota sedia ada pengguna.</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setShowTopUp({ show: false, user: null })}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={handleTopUp}
                    className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95"
                  >
                    Sahkan Top Up
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const BusinessSettingsModal = ({ user, onClose, onSave }: { user: UserType | null, onClose: () => void, onSave: (data: any) => void }) => {
  const [companyName, setCompanyName] = useState(user?.company_name || '');
  const [ssmNumber, setSsmNumber] = useState(user?.ssm_number || '');
  const [address, setAddress] = useState(user?.business_address || '');
  const [taxId, setTaxId] = useState(user?.tax_id || '');
  const [financialYearEnd, setFinancialYearEnd] = useState(user?.financial_year_end || '31 Disember');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await apiUpdateBusinessSettings(String(user?.id), {
        company_name: companyName,
        ssm_number: ssmNumber,
        business_address: address,
        tax_id: taxId,
        financial_year_end: financialYearEnd,
      });
      onSave(data);
    } catch (err) {
      console.error('Error updating business settings:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col"
      >
        <div className="p-8 overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-900 tracking-tight font-display">Tetapan Perniagaan</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Nama Syarikat / Perniagaan</label>
            <input 
              type="text" 
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              placeholder="Contoh: Monitacc Enterprise"
              required
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">No. Pendaftaran (SSM)</label>
              <input 
                type="text" 
                value={ssmNumber}
                onChange={(e) => setSsmNumber(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                placeholder="Contoh: 202403123456"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">No. Cukai (TIN)</label>
              <input 
                type="text" 
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                placeholder="Contoh: IG1234567890"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Alamat Perniagaan</label>
            <textarea 
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
              placeholder="Alamat penuh pejabat atau kedai anda"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Tarikh Akhir Tahun Kewangan</label>
            <input 
              type="date"
              value={financialYearEnd.includes(' ') ? '' : financialYearEnd}
              onChange={(e) => setFinancialYearEnd(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-sm">
              {loading ? 'Menyimpan...' : 'Simpan Tetapan Perniagaan'}
            </button>
          </div>
        </form>
        </div>
      </motion.div>
    </div>
  );
};

const ProfileEditModal = ({ user, onClose, onSave }: { user: UserType | null, onClose: () => void, onSave: (data: any) => void }) => {
  const [name, setName] = useState(user?.name || '');
  const [companyName, setCompanyName] = useState(user?.company_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await apiUpdateProfile(String(user?.id), name, phone, companyName);
      onSave(data);
    } catch (err) {
      console.error('Error updating profile:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col"
      >
        <div className="p-8 overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-900 tracking-tight font-display">Kemaskini Profil</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Nama Penuh</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Nama Syarikat</label>
            <input 
              type="text" 
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">No. Telefon</label>
            <input 
              type="tel" 
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-sm mt-4">
            {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </form>
        </div>
      </motion.div>
    </div>
  );
};

const DeleteConfirmationModal = ({ onCancel, onConfirm, type, count }: { onCancel: () => void, onConfirm: () => void, type: 'record' | 'sale' | 'bulk', count?: number }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
    >
      <div className="p-6 text-center">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 size={32} />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Padam Rekod?</h3>
        <p className="text-slate-500 mb-6">
          {type === 'bulk' 
            ? `Adakah anda pasti mahu memadam ${count} rekod yang dipilih? Tindakan ini tidak boleh diubah.`
            : `Adakah anda pasti mahu memadam ${type === 'sale' ? 'rekod jualan' : 'rekod'} ini? Tindakan ini tidak boleh diubah.`}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl shadow-lg shadow-rose-200 transition-all"
          >
            Padam
          </button>
        </div>
      </div>
    </motion.div>
  </div>
);

const DuplicateWarningModal = ({ data, existing, onCancel, onConfirm }: { data: any, existing: TransactionRecord | Sale | null, onCancel: () => void, onConfirm: () => void }) => {
  if (!existing) return null;

  const isSale = 'product_name' in existing;
  const existingName = isSale ? (existing as Sale).product_name : (existing as TransactionRecord).category;
  const existingAmount = isSale ? (existing as Sale).total : (existing as TransactionRecord).amount;
  const existingDesc = isSale ? `Kuantiti: ${(existing as Sale).quantity} @ RM ${(existing as Sale).price}` : (existing as TransactionRecord).description;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-rose-500 z-10" />
        <div className="p-8 text-center overflow-y-auto custom-scrollbar">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mx-auto mb-6 border border-rose-100">
          <AlertTriangle size={32} strokeWidth={2} />
        </div>
        
        <h3 className="text-xl font-bold text-slate-900 mb-2 tracking-tight font-display">Rekod Bertindih!</h3>
        <p className="text-slate-500 text-sm font-medium mb-8">
          Sistem mengesan rekod yang serupa sudah wujud dalam pangkalan data anda.
        </p>

        <div className="bg-slate-50 rounded-xl p-6 mb-8 text-left border border-slate-100 relative group">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Rekod Sedia Ada:</p>
          
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-slate-900 text-base font-display">{existingName}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{existing.date}</p>
              </div>
              <p className="font-bold text-slate-900 text-lg font-display">RM {(existingAmount || 0).toLocaleString()}</p>
            </div>
            
            <div className="pt-4 border-t border-slate-200">
              <p className="text-xs font-medium text-slate-500 italic">"{existingDesc}"</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <button 
            onClick={onCancel}
            className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-[10px] uppercase tracking-wider shadow-lg hover:bg-black transition-all active:scale-95"
          >
            Batal & Semak Semula
          </button>
          <button 
            onClick={onConfirm}
            className="w-full py-3 bg-white text-rose-600 border border-rose-100 rounded-xl font-bold text-[10px] uppercase tracking-wider hover:bg-rose-50 transition-all active:scale-95"
          >
            Tetap Simpan
          </button>
        </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

const PROTECTED_VIEWS: AppView[] = [
  'dashboard', 'sales', 'scan', 'records', 'reports', 'ledger',
  'reconcile', 'ai-analysis', 'profile', 'user-management', 'categories',
  'plans', 'token-usage', 'faq', 'terms', 'choose-plan', 'welcome',
];

export default function App() {
  const [view, setView] = useState<AppView>('landing');
  const [user, setUser] = useState<UserType | null>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isAffiliateAuthenticated, setIsAffiliateAuthenticated] = useState(false);
  const [currentAffiliate, setCurrentAffiliate] = useState<any | null>(null);
  const [records, setRecords] = useState<TransactionRecord[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [categoryMappings, setCategoryMappings] = useState<Record<string, 'SALES' | 'COGS' | 'EXPENSE' | 'OTHER_INCOME' | 'TAXATION' | 'ASSET_LIABILITY'>>({});
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profile) {
            setUser(profile as unknown as UserType);
            const params = new URLSearchParams(window.location.search);
            if (params.get('payment') === 'success' || params.get('payment') === 'cancelled') {
              setView('plans');
            } else {
              setView('dashboard');
            }
          }
        }
      } catch (err) {
        console.error('Session restore error:', err);
      } finally {
        setSessionLoading(false);
      }
    };
    restoreSession();
  }, []);

  useEffect(() => {
    if (user) {
      const defaults: any = {};
      INCOME_CATEGORIES.forEach(c => defaults[c.toUpperCase()] = 'SALES');
      COGS_CATEGORIES.forEach(c => defaults[c.toUpperCase()] = 'COGS');
      EXPENSE_CATEGORIES.forEach(c => defaults[c.toUpperCase()] = 'EXPENSE');
      ASSET_LIABILITY_CATEGORIES.forEach(c => defaults[c.toUpperCase()] = 'ASSET_LIABILITY');

      const saved = localStorage.getItem(`monitacc_category_mappings_${user.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const normalized: any = {};
          Object.keys(parsed).forEach(k => {
            normalized[k.trim().toUpperCase()] = parsed[k];
          });
          setCategoryMappings({ ...defaults, ...normalized });
          return;
        } catch (e) {
          console.error('Error loading saved mappings', e);
        }
      }

      setCategoryMappings(defaults);
    } else {
      setCategoryMappings({});
    }
  }, [user]);

  useEffect(() => {
    if (user && Object.keys(categoryMappings).length > 0) {
      localStorage.setItem(`monitacc_category_mappings_${user.id}`, JSON.stringify(categoryMappings));
    }
  }, [categoryMappings, user]);

  const allAvailableCategories = useMemo(() => {
    const all = [
      ...ALL_CATEGORIES,
      ...Object.keys(categoryMappings)
    ].map(cat => cat.trim().toUpperCase());
    return Array.from(new Set(all)).sort();
  }, [categoryMappings]);

  const ensureCategoryExists = useCallback((name: string, type: 'SALES' | 'COGS' | 'EXPENSE' | 'OTHER_INCOME' | 'TAXATION' | 'ASSET_LIABILITY') => {
    const upperName = name.trim().toUpperCase();
    if (!upperName) return;
    if (!categoryMappings[upperName]) {
      setCategoryMappings(prev => ({
        ...prev,
        [upperName]: type
      }));
    }
  }, [categoryMappings]);

  // Sync categoryMappings with records and sales to ensure all categories are available in reports
  useEffect(() => {
    const newMappings = { ...categoryMappings };
    let changed = false;
    
    records.forEach(r => {
      const cat = r.category.trim().toUpperCase();
      if (cat && !newMappings[cat]) {
        newMappings[cat] = r.type === 'income' ? 'SALES' : 'EXPENSE';
        changed = true;
      }
    });

    sales.forEach(s => {
      const cat = (s.category || 'SALES').trim().toUpperCase();
      if (cat && !newMappings[cat]) {
        newMappings[cat] = 'SALES';
        changed = true;
      }
    });
    
    if (changed) {
      setCategoryMappings(newMappings);
    }
  }, [records, sales]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [salesStats, setSalesStats] = useState<any>(null);
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const fetchInProgress = useRef(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [triggerAddSale, setTriggerAddSale] = useState(0);
  const [showManualEntry, setShowManualEntry] = useState<{ show: boolean, type: 'income' | 'expense', initialData?: any }>({ show: false, type: 'income' });
  const [duplicateWarning, setDuplicateWarning] = useState<{ show: boolean, data: any, existing: TransactionRecord | Sale | null }>({ show: false, data: null, existing: null });
  const [confirmDelete, setConfirmDelete] = useState<{ 
    show: boolean, 
    id: number, 
    type: 'record' | 'sale' | 'bulk',
    bulkItems?: { id: number, type: 'record' | 'sale', saleId?: number }[]
  }>({ show: false, id: 0, type: 'record' });
  const [selectedLedgerCategory, setSelectedLedgerCategory] = useState('SALES');
  const [selectedLedgerMonth, setSelectedLedgerMonth] = useState<number | undefined>(undefined);
  const [selectedLedgerYear, setSelectedLedgerYear] = useState<number | undefined>(undefined);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showBusinessSettings, setShowBusinessSettings] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchData();
    }
    if (view !== 'sales') {
      setTriggerAddSale(0);
    }
  }, [user, view]);

  const fetchData = async (retries = 3, delay = 1000) => {
    if (!user) {
      setIsFetching(false);
      return;
    }
    if (fetchInProgress.current) return;
    fetchInProgress.current = true;
    setIsFetching(true);

    try {
      const data = await apiFetchDashboard(String(user.id), user.role || '');
      setRecords(data.records);
      setStats(data.stats);
      setSales(data.sales);
      setSalesStats(data.salesStats);
      setConnectionError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setConnectionError(msg);

      if (retries > 0) {
        fetchInProgress.current = false;
        setTimeout(() => fetchData(retries - 1, delay * 2), delay);
        return;
      }
    } finally {
      fetchInProgress.current = false;
      setIsFetching(false);
    }
  };

  const safeSetView = useCallback((v: AppView) => {
    if (PROTECTED_VIEWS.includes(v) && !user) {
      setView('landing');
      return;
    }
    setView(v);
  }, [user]);

  const handleLogout = async () => {
    await apiLogout();
    setUser(null);
    setIsAdminAuthenticated(false);
    setIsAffiliateAuthenticated(false);
    setCurrentAffiliate(null);
    setRecords([]);
    setSales([]);
    setStats(null);
    setSalesStats(null);
    setView('landing');
  };

  const handleAuthSuccess = async (userData: UserType, isNewUser: boolean) => {
    setUser(userData);
    const planToProcess = pendingPlan;
    setPendingPlan(null);

    if (planToProcess && planToProcess !== 'Percuma') {
      try {
        const url = await createCheckoutSession(planToProcess as PaidPlan);
        window.location.href = url;
        return;
      } catch (err) {
        console.error('Checkout error:', err);
      }
    }

    if (isNewUser) {
      setView('choose-plan');
    } else {
      setView('dashboard');
    }
  };

  const handleSaveRecord = async (data: any | any[], force = false) => {
    const recordsToSave = Array.isArray(data) ? data : [data];
    const isBulk = recordsToSave.length > 1;
    let skippedCount = 0;
    const justSaved: any[] = [];
    
    for (const recordData of recordsToSave) {
      // Check for duplicates against existing records AND records just saved in this batch
      if (!force) {
        const isBankRecord = recordData.docNumber?.startsWith('BANK-');
        const isBankRelated = isBankRecord || 
                             recordData.payment_method === 'bank' || 
                             recordData.docType?.toLowerCase().includes('bank');
        
        const checkDuplicate = (r: any) => {
          // If it has a real docNumber (not BANK-), check that
          if (recordData.docNumber && !isBankRecord && recordData.docNumber.trim() !== '') {
            return r.docNumber?.toLowerCase() === recordData.docNumber.toLowerCase();
          }
          
          // Basic match: Date, Amount, and Type
          const isBasicMatch = r.date === recordData.date && 
                               Math.abs(r.amount - recordData.amount) < 0.01 && 
                               r.type === recordData.type;
          
          if (!isBasicMatch) return false;

          // If description is identical, it's a duplicate
          if (r.description.toLowerCase().trim() === recordData.description.toLowerCase().trim()) {
            return true;
          }

          // If descriptions are different, we only consider it a duplicate if the category matches 
          // AND it's NOT a bank-related transaction. 
          // Bank transactions with different descriptions are almost always unique.
          if (isBankRelated) {
            // For bank transactions, if descriptions are different, it's NOT a duplicate
            return false;
          }
          
          // For non-bank records, we still block if category is the same to prevent accidental double entry
          return r.category.toUpperCase().trim() === recordData.category.toUpperCase().trim();
        };

        const existing = records.find(checkDuplicate);
        
        // Only check justSaved if it's NOT a bank-related record, 
        // because bank statements can have legitimate identical transactions
        const duplicateInBatch = !isBankRelated && justSaved.find(checkDuplicate);

        if (existing || duplicateInBatch) {
          if (isBulk) {
            // For bulk adds, we skip duplicates automatically to avoid modal spam
            skippedCount++;
            continue;
          } else {
            // For single adds, we show the warning
            setDuplicateWarning({ show: true, data: recordData, existing });
            return;
          }
        }
      }

      try {
        await apiSaveRecord(String(user?.id), {
          ...recordData,
          category: recordData.category.trim().toUpperCase(),
        });
        justSaved.push(recordData);
      } catch (err) {
        console.error('Error saving record:', err);
      }
    }

    if (isBulk && skippedCount > 0) {
      alert(`${skippedCount} rekod bertindih telah diabaikan secara automatik.`);
    }

    setView('dashboard');
    setPendingImage(null);
    setDuplicateWarning({ show: false, data: null, existing: null });
    fetchData();
  };

  const handleDeleteRecord = (id: number) => {
    setConfirmDelete({ show: true, id, type: 'record' });
  };

  const executeDeleteRecord = async (id: number) => {
    try {
      await apiDeleteRecord(id, String(user?.id));
      fetchData();
      setConfirmDelete({ show: false, id: 0, type: 'record' });
    } catch (err) {
      console.error('Error deleting record:', err);
    }
  };

  const handleUpdateRecord = async (id: number, data: any) => {
    try {
      await apiUpdateRecord(id, String(user?.id), data);
      fetchData();
    } catch (err) {
      console.error('Error updating record:', err);
    }
  };

  const handleUpdateSale = async (id: number, data: any) => {
    try {
      await apiUpdateSale(id, String(user?.id), data);
      fetchData();
    } catch (err) {
      console.error('Error updating sale:', err);
    }
  };

  const handleSaveSale = async (data: any, force = false) => {
    if (!force) {
      const existing = sales.find(s => 
        s.date === data.date && 
        Math.abs(s.total - data.total) < 0.01 && 
        s.product_name.toLowerCase() === data.product_name.toLowerCase() &&
        (s.customer_name || '').toLowerCase() === (data.customer_name || '').toLowerCase()
      );
      if (existing) {
        setDuplicateWarning({ show: true, data, existing });
        return;
      }
    }

    try {
      await apiSaveSale(String(user?.id), {
        ...data,
        category: (data.category || 'SALES').trim().toUpperCase(),
      });
      fetchData();
    } catch (err) {
      console.error('Error saving sale:', err);
    }
  };

  const handleDeleteSale = (id: number) => {
    setConfirmDelete({ show: true, id, type: 'sale' });
  };

  const executeDeleteSale = async (id: number) => {
    try {
      await apiDeleteSale(id, String(user?.id));
      fetchData();
      setConfirmDelete({ show: false, id: 0, type: 'record' });
    } catch (err) {
      console.error('Error deleting sale:', err);
    }
  };

  const handleBulkDelete = (items: { id: number, type: 'record' | 'sale', saleId?: number }[]) => {
    setConfirmDelete({ show: true, id: 0, type: 'bulk', bulkItems: items });
  };

  const executeBulkDelete = async (items: { id: number, type: 'record' | 'sale', saleId?: number }[]) => {
    setIsFetching(true);
    try {
      for (const item of items) {
        if (item.type === 'sale' && item.saleId) {
          await apiDeleteSale(item.saleId, String(user?.id));
        } else {
          await apiDeleteRecord(item.id, String(user?.id));
        }
      }
      fetchData();
      setConfirmDelete({ show: false, id: 0, type: 'record' });
    } catch (err) {
      console.error('Error in bulk delete:', err);
    } finally {
      setIsFetching(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPendingImage(reader.result as string);
        setView('scan');
        setIsFabOpen(false);
      };
      reader.readAsDataURL(file);
    }
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg">
            <CreditCard size={24} className="text-white" />
          </div>
          <Loader2 size={20} className="text-emerald-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (!user && PROTECTED_VIEWS.includes(view)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg">
            <CreditCard size={24} className="text-white" />
          </div>
          <p className="text-sm text-slate-500">Sila log masuk untuk meneruskan...</p>
          <button
            onClick={() => setView('landing')}
            className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors"
          >
            Log Masuk
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {connectionError && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-rose-600 text-white p-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} />
            <p className="text-sm font-bold tracking-tight">Ralat Sambungan: {connectionError}</p>
          </div>
          <button 
            onClick={() => {
              setConnectionError('Menyambung semula...');
              fetchData();
            }}
            className="px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
          >
            Cuba Lagi
          </button>
        </div>
      )}
      <Navbar
        activeView={view}
        setView={safeSetView}
        user={user}
        isAdminAuthenticated={isAdminAuthenticated}
        onLogoutAdmin={() => {
          setIsAdminAuthenticated(false);
          setView('dashboard');
        }}
      />
      
      {isFetching && !connectionError && (
        <div className="fixed top-4 right-4 z-[9999] bg-white/80 backdrop-blur-md border border-slate-100 px-4 py-2 rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Mengemas Kini...</span>
        </div>
      )}
      
      <main className="pb-20 md:pb-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {view === 'landing' && <LandingPage onStart={(plan) => { if (plan) setPendingPlan(plan); setView('auth'); }} onAffiliateLogin={() => setView('affiliate-auth')} />}
            {view === 'auth' && <AuthView onAuthSuccess={handleAuthSuccess} initialPlan={pendingPlan} onBack={() => setView('landing')} />}
            {view === 'choose-plan' && <ChoosePlanView user={user} onComplete={() => setView('welcome')} />}
            {view === 'welcome' && <WelcomeView user={user} onComplete={() => setView('dashboard')} />}
            {view === 'dashboard' && <Dashboard stats={stats} records={records} sales={sales} user={user} setView={setView} salesStats={salesStats} onAddSale={() => { setTriggerAddSale(prev => prev + 1); setView('sales'); }} onScan={() => setView('scan')} onFileSelect={(file) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                setPendingImage(reader.result as string);
                setView('scan');
              };
              reader.readAsDataURL(file);
            }} />}
            {view === 'admin-auth' && <AdminLoginView onLogin={() => { setIsAdminAuthenticated(true); setView('admin-dashboard'); }} onBack={() => setView('landing')} />}
            {view === 'affiliate-auth' && <AffiliateLoginView onLogin={(aff) => { setCurrentAffiliate(aff); setIsAffiliateAuthenticated(true); setView('affiliate-dashboard'); }} onBack={() => setView('landing')} />}
            {view === 'affiliate-dashboard' && <AffiliateDashboardView affiliate={currentAffiliate} onLogout={() => { setIsAffiliateAuthenticated(false); setCurrentAffiliate(null); setView('landing'); }} />}
            {view === 'sales' && (
              <SalesView 
                sales={sales} 
                onAdd={handleSaveSale} 
                onDelete={handleDeleteSale} 
                stats={salesStats} 
                user={user} 
                triggerAddSale={triggerAddSale} 
                categoryMappings={categoryMappings} 
                onAddNewCategory={(name) => ensureCategoryExists(name, 'SALES')}
              />
            )}
            {view === 'scan' && (
              <ScanView
                onSave={handleSaveRecord}
                initialImage={pendingImage}
                onCancel={() => { setView('dashboard'); setPendingImage(null); }}
                allCategories={allAvailableCategories}
                onAddNewCategory={(name, type) => ensureCategoryExists(name, type === 'income' ? 'SALES' : 'EXPENSE')}
                records={records}
                sales={sales}
                user={user}
                onUpgrade={() => setView('plans')}
              />
            )}
            {view === 'records' && (
              <RecordsView 
                records={records} 
                sales={sales} 
                onDelete={handleDeleteRecord} 
                onDeleteSale={handleDeleteSale} 
                onUpdate={handleUpdateRecord} 
                user={user} 
                onAddNewCategory={(name, type) => ensureCategoryExists(name, type === 'income' ? 'SALES' : 'EXPENSE')}
                categoryMappings={categoryMappings}
                onBulkDelete={handleBulkDelete}
              />
            )}
            {view === 'reports' && (
              <ReportsView 
                stats={stats} 
                salesStats={salesStats} 
                records={records} 
                sales={sales} 
                user={user} 
                categoryMappings={categoryMappings}
                setCategoryMappings={setCategoryMappings}
                onCategoryClick={(cat, month, year) => { 
                  setSelectedLedgerCategory(cat); 
                  setSelectedLedgerMonth(month);
                  setSelectedLedgerYear(year);
                  setView('ledger'); 
                }} 
              />
            )}
            {view === 'ledger' && (
              <LedgerView 
                records={records} 
                sales={sales} 
                user={user} 
                initialCategory={selectedLedgerCategory}
                initialMonth={selectedLedgerMonth}
                initialYear={selectedLedgerYear}
                onUpdate={handleUpdateRecord}
                onDelete={handleDeleteRecord}
                onDeleteSale={handleDeleteSale}
                onAddNewCategory={(name, type) => ensureCategoryExists(name, type === 'income' ? 'SALES' : 'EXPENSE')}
                categoryMappings={categoryMappings}
              />
            )}
            {view === 'reconcile' && (
              (() => {
                const planOrderMain: Record<string, number> = { free: 0, Percuma: 0, Starter: 1, Growth: 2, Ultimate: 3 };
                const userLevel = planOrderMain[user?.plan || 'free'] ?? 0;
                if (userLevel < planOrderMain['Ultimate']) {
                  return <PremiumGateView featureId="reconcile" onUpgrade={() => setView('plans')} onBack={() => setView('dashboard')} />;
                }
                return (
                  <ReconcileView
                    records={records}
                    sales={sales}
                    onUpdateRecord={handleUpdateRecord}
                    onUpdateSale={handleUpdateSale}
                    onAddMissingRecord={(bt) => {
                      const type = bt.type === 'credit' || bt.type === 'income' ? 'income' : 'expense';
                      setShowManualEntry({
                        show: true,
                        type,
                        initialData: {
                          amount: bt.amount,
                          description: bt.description,
                          date: bt.date,
                          category: bt.category || '',
                          docType: bt.docType || (type === 'income' ? 'Duit Masuk Bank' : 'Duit Keluar Bank')
                        }
                      });
                    }}
                    onBulkAdd={handleSaveRecord}
                    onRefresh={fetchData}
                    user={user}
                  />
                );
              })()
            )}
            {view === 'ai-analysis' && (
              (() => {
                const planOrderMain: Record<string, number> = { free: 0, Percuma: 0, Starter: 1, Growth: 2, Ultimate: 3 };
                const userLevel = planOrderMain[user?.plan || 'free'] ?? 0;
                if (userLevel < planOrderMain['Starter']) {
                  return <PremiumGateView featureId="ai-analysis" onUpgrade={() => setView('plans')} onBack={() => setView('dashboard')} />;
                }
                return <AIAnalysisView records={records} sales={sales} user={user} />;
              })()
            )}
            {view === 'profile' && <ProfileView user={user} setView={setView} onLogout={handleLogout} onEdit={() => setShowProfileEdit(true)} onBusinessSettings={() => setShowBusinessSettings(true)} onUserManagement={() => setView('user-management')} />}
            {view === 'user-management' && <UserManagementView onBack={() => setView('profile')} />}
            {view === 'categories' && (
              <CategoriesView 
                categoryMappings={categoryMappings} 
                setCategoryMappings={setCategoryMappings} 
                onBack={() => setView('profile')} 
              />
            )}
            {view === 'plans' && <PlansView user={user} onPlanActivated={async () => {
              const { data: { session } } = await supabase.auth.getSession();
              if (session?.user) {
                const { data: profile } = await supabase.from('users').select('*').eq('id', session.user.id).maybeSingle();
                if (profile) setUser(profile as unknown as UserType);
              }
              setView('dashboard');
            }} />}
            {view === 'subscription-management' && <SubscriptionManagementView onBack={() => setView('admin-dashboard')} />}
            {view === 'admin-dashboard' && <AdminDashboardView />}
            {view === 'token-usage' && <TokenUsageView />}
            {view === 'affiliated-management' && <AffiliatedManagementView />}
            {view === 'admin-auth' && (
              <AdminLoginView 
                onLogin={() => {
                  setIsAdminAuthenticated(true);
                  setView('admin-dashboard');
                }} 
                onBack={() => setView('dashboard')} 
              />
            )}
            {view === 'faq' && <FAQView onBack={() => setView('profile')} />}
            {view === 'terms' && <TermsView onBack={() => setView('profile')} />}
          </motion.div>
        </AnimatePresence>

        {duplicateWarning.show && (
          <DuplicateWarningModal 
            data={duplicateWarning.data}
            existing={duplicateWarning.existing}
            onCancel={() => setDuplicateWarning({ show: false, data: null, existing: null })}
            onConfirm={() => {
              if (duplicateWarning.data && 'product_name' in duplicateWarning.data) {
                handleSaveSale(duplicateWarning.data, true);
              } else {
                handleSaveRecord(duplicateWarning.data, true);
              }
            }}
          />
        )}

        {confirmDelete.show && (
          <DeleteConfirmationModal 
            type={confirmDelete.type}
            count={confirmDelete.bulkItems?.length}
            onCancel={() => setConfirmDelete({ show: false, id: 0, type: 'record' })}
            onConfirm={() => {
              if (confirmDelete.type === 'bulk' && confirmDelete.bulkItems) {
                executeBulkDelete(confirmDelete.bulkItems);
              } else if (confirmDelete.type === 'sale') {
                executeDeleteSale(confirmDelete.id);
              } else {
                executeDeleteRecord(confirmDelete.id);
              }
            }}
          />
        )}

        {showCamera && (
          <CameraView 
            onCapture={(base64) => {
              setPendingImage(base64);
              setView('scan');
              setShowCamera(false);
            }} 
            onCancel={() => setShowCamera(false)} 
          />
        )}

        {showManualEntry.show && (
          <ManualRecordModal 
            type={showManualEntry.type}
            initialData={showManualEntry.initialData}
            onClose={() => setShowManualEntry({ show: false, type: 'income' })}
            onSave={(data) => {
              handleSaveRecord(data);
              setShowManualEntry({ show: false, type: 'income' });
            }}
            onAddNewCategory={(name, type) => ensureCategoryExists(name, type === 'income' ? 'SALES' : 'EXPENSE')}
            categoryMappings={categoryMappings}
          />
        )}

        {showProfileEdit && (
          <ProfileEditModal 
            user={user}
            onClose={() => setShowProfileEdit(false)}
            onSave={(updatedUser) => {
              setUser(updatedUser);
              setShowProfileEdit(false);
            }}
          />
        )}

        {showBusinessSettings && (
          <BusinessSettingsModal 
            user={user}
            onClose={() => setShowBusinessSettings(false)}
            onSave={(updatedUser) => {
              setUser(updatedUser);
              setShowBusinessSettings(false);
            }}
          />
        )}
      </main>

      {/* Floating Action Button */}
      {view !== 'landing' && view !== 'auth' && view !== 'welcome' && view !== 'scan' && (
        <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2 md:bottom-12 md:right-12">
          <AnimatePresence>
            {isFabOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsFabOpen(false)}
                  className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-[-1]"
                />
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col items-end gap-2 mb-1"
                >
                  {[
                    {
                      label: 'Duit Masuk',
                      icon: TrendingUp,
                      iconBg: 'bg-emerald-500',
                      onClick: () => { setShowManualEntry({ show: true, type: 'income' }); setIsFabOpen(false); },
                    },
                    {
                      label: 'Duit Keluar',
                      icon: TrendingDown,
                      iconBg: 'bg-rose-500',
                      onClick: () => { setShowManualEntry({ show: true, type: 'expense' }); setIsFabOpen(false); },
                    },
                    {
                      label: 'Imbas Resit',
                      icon: Camera,
                      iconBg: 'bg-slate-700',
                      onClick: () => { setShowCamera(true); setIsFabOpen(false); },
                    },
                  ].map((action, i) => (
                    <motion.button
                      key={action.label}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={action.onClick}
                      className="flex items-center gap-3 bg-white/95 backdrop-blur-sm px-4 py-3 rounded-2xl shadow-xl border border-slate-100/80 active:scale-95 transition-transform"
                    >
                      <span className="text-xs font-semibold text-slate-700">{action.label}</span>
                      <div className={`w-9 h-9 ${action.iconBg} text-white rounded-xl flex items-center justify-center shadow-sm`}>
                        <action.icon size={18} strokeWidth={2.5} />
                      </div>
                    </motion.button>
                  ))}
                  <motion.label
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: 0.12 }}
                    className="flex items-center gap-3 bg-white/95 backdrop-blur-sm px-4 py-3 rounded-2xl shadow-xl border border-slate-100/80 active:scale-95 transition-transform cursor-pointer"
                  >
                    <span className="text-xs font-semibold text-slate-700">Muat Naik</span>
                    <div className="w-9 h-9 bg-sky-500 text-white rounded-xl flex items-center justify-center shadow-sm">
                      <FileText size={18} strokeWidth={2.5} />
                    </div>
                    <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileSelect} />
                  </motion.label>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <button
            onClick={() => setIsFabOpen(!isFabOpen)}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 ${
              isFabOpen ? 'bg-slate-900 rotate-[135deg]' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
            } text-white active:scale-90 z-10`}
          >
            <Plus size={28} strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  );
}
