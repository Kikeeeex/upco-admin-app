'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check,
  ChevronDown, CircleHelp, ClipboardList, FileArchive, FilePlus2, FileSpreadsheet,
  FileText, LayoutDashboard, Menu, MoreHorizontal, Pencil, Plus, ReceiptText, RefreshCw,
  Search, Settings2, ShieldCheck, SlidersHorizontal, Trash2, UsersRound, Wallet,
  X,
} from 'lucide-react';
import { download, request } from './api';
import MoneyInput from './money-input';
import SearchableCombobox from './searchable-combobox';
import type { CatalogItem, IslrConcept, PurchaseDocument, Settings, Summary, Vendor } from './types';
import type { VendorAuditReport } from '@/lib/tax/vendorAudit';
import type { AppUser } from '@/lib/auth';
import { hasPermission, PERMISSIONS, type Permission } from '@/lib/permissions';

type View = 'resumen' | 'compras' | 'proveedores' | 'reportes' | 'configuracion' | 'usuarios';
type ManagedUser = { id: number; username: string; role: string; permissions: Permission[]; active: boolean; createdAt: string };
type Drawer = 'vendor' | 'document' | null;
type ImportPreview = {
  rows: { row: number; values: { rif: string; type: string; number: string; issuedAt: string; eventAt: string; period: string; half: number }; issues: string[]; warnings: string[] }[];
  summary: { total: number; ready: number; blocked: number };
};

const today = () => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
};
const thisPeriod = () => today().slice(0, 7);
const thisHalf = (): 1 | 2 => Number(today().slice(-2)) <= 15 ? 1 : 2;
const initialSettings: Settings = {
  companyName: 'UPCO DE VENEZUELA CONSULTORES, S.A.',
  companyRif: 'J308175390',
  companyAddress: '',
  unitTaxValue: 0,
  unitTaxEffectiveAt: '',
  unitTaxHistory: [],
  ivaGeneralRate: 16,
  ivaReducedRate: 8,
  ivaLegalReference: 'Providencia Administrativa SNAT/2025/000054',
  islrLegalReference: 'Decreto N° 1.808',
  conceptOverrides: {},
  islrConcepts: [],
  cecos: [],
  paymentAccounts: [],
  certificateSequences: {
    iva: { period: thisPeriod(), nextNumber: 1, suggestedNextNumber: 1, configured: false },
    islr: { period: thisPeriod(), nextNumber: 1, suggestedNextNumber: 1, configured: false },
  },
};
const money = (amount: unknown) => `Bs. ${Number(amount || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateText = (value?: string) => {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
};
const monthText = (period: string) => {
  const [year, month] = period.split('-');
  const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${months[Number(month) - 1] || month} ${year}`;
};
const periodRange = (period: string, half: 1 | 2 | 'all') => {
  const [y, m] = period.split('-').map(Number);
  const end = new Date(y, m, 0).getDate();
  const month = monthText(period);
  return half === 'all' ? `1 al ${end} de ${month}` : half === 1 ? `1 al 15 de ${month}` : `16 al ${end} de ${month}`;
};
const titleByView: Record<View, string> = {
  resumen: 'Resumen general', compras: 'Compras y documentos', proveedores: 'Proveedores',
  reportes: 'Reportes y exportaciones', configuracion: 'Configuración', usuarios: 'Usuarios y accesos',
};
const typeLabel = (type: PurchaseDocument['type']) => ({ factura: 'Factura', nota_credito: 'Nota de crédito', nota_debito: 'Nota de débito' }[type]);
const statusLabel = (status: PurchaseDocument['status']) => ({ draft: 'Borrador', issued: 'Emitido', void: 'Anulado' }[status]);
const certificatePreview = (period: string, nextNumber: number) => `${period.replace('-', '')}${String(nextNumber).padStart(8, '0')}`;
const permissionLabel: Record<Permission, string> = {
  'documents.create': 'Registrar compras', 'documents.edit': 'Editar compras',
  'documents.issue': 'Emitir comprobantes', 'documents.delete': 'Anular y eliminar',
  'vendors.manage': 'Administrar proveedores', 'exports.run': 'Descargar reportes',
  'imports.run': 'Importar históricos', 'catalogs.manage': 'Administrar CECO y cuentas',
};

function newVendor(): Vendor {
  return { id: '', code: '', rif: '', name: '', address: '', taxpayerType: 'ordinario', personType: 'juridica', residency: 'domiciliada', ivaRetentionRate: 75, usesFiscalMachine: false, fiscalMachineNumbers: [], email: '', phone: '', active: true };
}
function newDocument(vendorId = ''): PurchaseDocument {
  return {
    id: '', type: 'factura', vendorId, issuedAt: today(), eventAt: today(), period: thisPeriod(), half: thisHalf(),
    number: '', controlNumber: '', affectedDocumentId: '', periodOverrideReason: '', exempt: 0, base16: 0, base8: 0,
    ivaRetentionRate: 75, ivaRetentionReason: '', igtfApplies: false, igtfBase: 0,
    islrApplies: false, islrConceptCode: '', islrBase: 0, islrManual: false, islrManualReason: '', islrRate: 0, islrSubtraction: 0, islrAmount: 0,
    ceco: '', cecoAllocations: [{ cecoId: 0, percentage: 100 }], paymentAccountId: null, description: '', status: 'draft',
  };
}
function numberValue(value: unknown): number { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function initials(name: string) { return (name || 'P').split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase(); }
function badgeClass(status: string) { return status === 'issued' ? 'badge-green' : status === 'void' ? 'badge-red' : 'badge-amber'; }
function nationalIslrBeneficiary(vendor?: Vendor): 'PNR' | 'PJD' | null {
  if (vendor?.personType === 'natural' && vendor.residency === 'residente') return 'PNR';
  if (vendor?.personType === 'juridica' && vendor.residency === 'domiciliada') return 'PJD';
  return null;
}

export default function UpcoApp({ user }: { user: AppUser }) {
  const isMaster = user.role === 'master';
  const can = (permission: Permission) => hasPermission(user, permission);
  const [view, setView] = useState<View>('resumen');
  const [period, setPeriod] = useState(thisPeriod);
  const [half, setHalf] = useState<1 | 2>(thisHalf);
  const [reportHalf, setReportHalf] = useState<1 | 2 | 'all'>('all');
  const [closeFrom, setCloseFrom] = useState(() => `${thisPeriod()}-01`);
  const [closeTo, setCloseTo] = useState(() => {
    const [year, month] = thisPeriod().split('-').map(Number);
    return `${thisPeriod()}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importInputKey, setImportInputKey] = useState(0);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [documents, setDocuments] = useState<PurchaseDocument[]>([]);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [settingsDraft, setSettingsDraft] = useState<Settings>(initialSettings);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [vendorDraft, setVendorDraft] = useState<Vendor>(newVendor);
  const [fiscalMachineInput, setFiscalMachineInput] = useState('');
  const [documentDraft, setDocumentDraft] = useState<PurchaseDocument>(() => newDocument());
  const [editingIssued, setEditingIssued] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vendorAudit, setVendorAudit] = useState<VendorAuditReport | null>(null);
  const [vendorAuditBusy, setVendorAuditBusy] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickAdd, setQuickAdd] = useState<'cecos' | 'paymentAccounts' | null>(null);
  const [quickCode, setQuickCode] = useState('');
  const [quickName, setQuickName] = useState('');
  const [moneyErrors, setMoneyErrors] = useState<Record<string, boolean>>({});
  const [documentSequencesByPeriod, setDocumentSequencesByPeriod] = useState<Record<string, Settings['certificateSequences']>>({});
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPermissions, setNewPermissions] = useState<Permission[]>([]);

  const showToast = useCallback((text: string, isError = false) => {
    setToast({ text, error: isError });
    setTimeout(() => setToast(null), 4500);
  }, []);

  const loadUsers = useCallback(async () => {
    if (!isMaster) return;
    const data = await request<{ items: ManagedUser[] }>('/api/users');
    setManagedUsers(data.items);
  }, [isMaster]);

  async function createUser() {
    if (!isMaster || busy) return;
    setBusy(true);
    try {
      const data = await request<{ items: ManagedUser[] }>('/api/users', { method: 'POST', body: JSON.stringify({ username: newUsername, password: newPassword, permissions: newPermissions }) });
      setManagedUsers(data.items); setNewUsername(''); setNewPassword(''); setNewPermissions([]);
      showToast('Usuario creado con los permisos seleccionados.');
    } catch (error) { showToast((error as Error).message, true); } finally { setBusy(false); }
  }

  async function updateUser(target: ManagedUser, changes: { active?: boolean; permissions?: Permission[]; password?: string }) {
    if (!isMaster || busy) return;
    setBusy(true);
    try {
      await request(`/api/users/${target.id}`, { method: 'PATCH', body: JSON.stringify(changes) });
      await loadUsers(); showToast('Acceso actualizado.');
    } catch (error) { showToast((error as Error).message, true); } finally { setBusy(false); }
  }

  function renderUsers() {
    if (!isMaster) return null;
    return <>
      <div className="page-head"><div><p className="eyebrow">ACCESOS</p><h1>Usuarios</h1><p>El usuario master conserva el control fiscal. Define las tareas de cada usuario adicional.</p></div></div>
      <section className="panel"><div className="panel-head"><div><h3>Crear usuario</h3><p>Contraseña de 12 a 128 caracteres. Entrega los datos de acceso por un canal privado.</p></div></div><div className="panel-body">
        <div className="form-grid"><Field label="Usuario"><input value={newUsername} autoComplete="off" onChange={e => setNewUsername(e.target.value.toLowerCase())} /></Field><Field label="Contraseña inicial"><input type="password" value={newPassword} autoComplete="new-password" onChange={e => setNewPassword(e.target.value)} /></Field></div>
        <div className="permission-grid">{PERMISSIONS.map(permission => <label key={permission} className="permission-choice"><input type="checkbox" checked={newPermissions.includes(permission)} onChange={e => setNewPermissions(current => e.target.checked ? [...current, permission] : current.filter(item => item !== permission))} />{permissionLabel[permission]}</label>)}</div>
        <button className="btn btn-primary" onClick={createUser} disabled={busy || !newUsername || newPassword.length < 12}><Plus />Crear usuario</button>
      </div></section>
      <section className="panel" style={{marginTop:16}}><div className="panel-head"><div><h3>Accesos existentes</h3><p>Los cambios de permisos se aplican desde la siguiente acción. Desactivar o cambiar contraseña cierra las sesiones del usuario.</p></div><button className="btn btn-secondary btn-small" onClick={() => loadUsers().catch(error => showToast((error as Error).message, true))}><RefreshCw />Actualizar</button></div><div className="panel-body">
        {managedUsers.map(target => <div key={target.id} className="managed-user"><div><strong>{target.username}</strong><span className="muted"> · {target.role === 'master' ? 'Master' : target.active ? 'Activo' : 'Inactivo'}</span></div>
          {target.role !== 'master' && <><div className="permission-grid">{PERMISSIONS.map(permission => <label key={permission} className="permission-choice"><input type="checkbox" checked={target.permissions.includes(permission)} disabled={busy} onChange={e => updateUser(target, { permissions: e.target.checked ? [...target.permissions, permission] : target.permissions.filter(item => item !== permission) })} />{permissionLabel[permission]}</label>)}</div><div className="catalog-actions"><button className="btn btn-secondary btn-small" disabled={busy} onClick={() => { const password = window.prompt(`Nueva contraseña para ${target.username} (mínimo 12 caracteres)`); if (password) updateUser(target, { password }); }}>Cambiar contraseña</button><button className={`btn btn-small ${target.active ? 'btn-danger' : 'btn-secondary'}`} disabled={busy} onClick={() => window.confirm(`${target.active ? '¿Desactivar' : '¿Activar'} a ${target.username}?`) && updateUser(target, { active: !target.active })}>{target.active ? 'Desactivar' : 'Activar'}</button></div></>}
        </div>)}
      </div></section>
    </>;
  }

  const refresh = useCallback(async (selectedPeriod = period, selectedHalf = half) => {
    const [vendorData, documentData, settingsData, summaryData] = await Promise.all([
      request<{ items: Vendor[] }>('/api/vendors'),
      request<{ items: PurchaseDocument[] }>('/api/documents'),
      request<Settings>(`/api/settings?period=${encodeURIComponent(selectedPeriod)}`),
      request<Summary>(`/api/summary?period=${encodeURIComponent(selectedPeriod)}&half=${selectedHalf}`).catch(() => null),
    ]);
    setVendors((vendorData.items || []).map(v => ({ ...v, id: String(v.id) })));
    setDocuments((documentData.items || []).map(d => ({ ...d, id: String(d.id), vendorId: String(d.vendorId), affectedDocumentId: d.affectedDocumentId == null ? null : String(d.affectedDocumentId) })));
    setSettings({ ...initialSettings, ...settingsData });
    setSettingsDraft({ ...initialSettings, ...settingsData });
    setSummary(summaryData);
  }, [period, half]);

  useEffect(() => {
    Promise.resolve().then(() => refresh()).catch(e => setError(e.message || 'No se pudieron cargar los datos.')).finally(() => setLoading(false));
  }, []); // initial load
  useEffect(() => {
    if (view === 'usuarios' && isMaster) request<{ items: ManagedUser[] }>('/api/users')
      .then(data => setManagedUsers(data.items)).catch(error => setError((error as Error).message));
  }, [view, isMaster]);
  useEffect(() => {
    if (loading) return;
    request<Summary>(`/api/summary?period=${encodeURIComponent(period)}&half=${half}`).then(setSummary).catch(() => setSummary(null));
  }, [period, half, loading]);
  useEffect(() => {
    if (loading) return;
    request<Settings>(`/api/settings?period=${encodeURIComponent(period)}`).then(data => {
      const current = { ...initialSettings, ...data };
      setSettings(current);
      setSettingsDraft(current);
    }).catch(e => setError((e as Error).message));
  }, [period, loading]);
  useEffect(() => {
    if (drawer !== 'document') return;
    const selectedPeriods = [...new Set([documentDraft.period, documentDraft.eventAt.slice(0, 7)])];
    let current = true;
    Promise.all(selectedPeriods.map(async selectedPeriod => {
      try {
        const data = await request<Settings>(`/api/settings?period=${encodeURIComponent(selectedPeriod)}`);
        return [selectedPeriod, data.certificateSequences] as const;
      } catch { return null; }
    })).then(results => {
      if (current) setDocumentSequencesByPeriod(Object.fromEntries(results.filter((item): item is NonNullable<typeof item> => item !== null)));
    });
    return () => { current = false; };
  }, [drawer, documentDraft.period, documentDraft.eventAt]);

  const vendorsById = useMemo(() => new Map(vendors.map(v => [v.id, v])), [vendors]);
  const visibleDocs = useMemo(() => documents.filter(d => d.period === period && d.half === half && d.status !== 'void'), [documents, period, half]);
  const docTotals = useMemo(() => visibleDocs.reduce((acc, d) => {
    acc.total += numberValue(d.total ?? (numberValue(d.exempt) + numberValue(d.base16) * 1.16 + numberValue(d.base8) * 1.08));
    acc.iva += numberValue(d.ivaRetentionAmount ?? ((numberValue(d.base16) * .16 + numberValue(d.base8) * .08) * numberValue(d.ivaRetentionRate) / 100));
    acc.islr += numberValue(d.islrAmount);
    return acc;
  }, { total: 0, iva: 0, islr: 0 }), [visibleDocs]);
  const filteredDocs = useMemo(() => documents.filter(d => d.period === period && d.half === half && (d.status !== 'void' || statusFilter === 'void')).filter(d => {
    const vendor = vendorsById.get(d.vendorId);
    const matchesSearch = `${d.number} ${d.controlNumber} ${vendor?.name || ''} ${vendor?.rif || ''}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (statusFilter === 'all' || d.status === statusFilter);
  }).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)), [documents, period, half, vendorsById, search, statusFilter]);
  const filteredVendors = useMemo(() => vendors.filter(v => `${v.name} ${v.rif} ${v.code || ''}`.toLowerCase().includes(search.toLowerCase())), [vendors, search]);

  function navigate(next: View) { setView(next); setSearch(''); setStatusFilter('all'); setMobileOpen(false); setQuickAdd(null); setMoneyErrors({}); }
  function openVendor(vendor?: Vendor) { setVendorDraft(vendor ? { ...vendor, fiscalMachineNumbers: [...(vendor.fiscalMachineNumbers || [])] } : newVendor()); setFiscalMachineInput(''); setDrawer('vendor'); }
  function openDocument(document?: PurchaseDocument) {
    const draft = document ? { ...document } : newDocument();
    setEditingIssued(false);
    setCorrectionReason('');
    if (draft.status === 'draft' && draft.islrApplies && draft.islrConceptCode) {
      const beneficiary = nationalIslrBeneficiary(vendorsById.get(draft.vendorId));
      const concept = settings.islrConcepts?.find(item => item.code === draft.islrConceptCode);
      if (!beneficiary || concept?.beneficiary !== beneficiary) draft.islrConceptCode = '';
    }
    draft.cecoAllocations = (draft.cecoAllocations || []).map(x => ({ cecoId: Number(x.cecoId), percentage: Number(x.percentage) }));
    if (draft.status === 'draft' && !draft.cecoAllocations.length) draft.cecoAllocations = [{ cecoId: 0, percentage: 100 }];
    draft.paymentAccountId = draft.paymentAccountId == null ? null : Number(draft.paymentAccountId);
    if (document?.type === 'nota_credito') {
      draft.exempt = Math.abs(numberValue(draft.exempt)); draft.base16 = Math.abs(numberValue(draft.base16)); draft.base8 = Math.abs(numberValue(draft.base8));
      draft.igtfBase = Math.abs(numberValue(draft.igtfBase)); draft.islrBase = Math.abs(numberValue(draft.islrBase));
      draft.islrSubtraction = Math.abs(numberValue(draft.islrSubtraction)); draft.islrAmount = Math.abs(numberValue(draft.islrAmount));
    }
    setDocumentDraft(draft);
    setMoneyErrors({});
    setQuickAdd(null);
    setDrawer('document');
  }
  function openCreditNote(document: PurchaseDocument) {
    setDocumentDraft({ ...newDocument(document.vendorId), type: 'nota_credito', affectedDocumentId: document.id,
      cecoAllocations: document.cecoAllocations?.length ? document.cecoAllocations.map(x => ({...x})) : [{ cecoId: 0, percentage: 100 }], paymentAccountId: document.paymentAccountId ?? null,
      ivaRetentionRate: document.ivaRetentionRate, description: `Ajuste de factura Nº ${document.number}` });
    setMoneyErrors({});
    setDrawer('document');
  }
  function closeDrawer() { if (!busy) { setDrawer(null); setEditingIssued(false); setCorrectionReason(''); } }
  function updateVendor<K extends keyof Vendor>(key: K, value: Vendor[K]) { setVendorDraft(d => ({ ...d, [key]: value })); }
  function addVendorFiscalMachine() {
    const number = fiscalMachineInput.trim().toUpperCase();
    if (!number) return;
    if (number.length > 80) return showToast('Número de máquina fiscal: máximo 80 caracteres.', true);
    if ((vendorDraft.fiscalMachineNumbers || []).some(item => item.toUpperCase() === number)) return showToast('Ese número de máquina fiscal ya está agregado.', true);
    if ((vendorDraft.fiscalMachineNumbers || []).length >= 200) return showToast('Registre hasta 200 máquinas fiscales por proveedor.', true);
    updateVendor('fiscalMachineNumbers', [...(vendorDraft.fiscalMachineNumbers || []), number]);
    setFiscalMachineInput('');
  }
  function changePersonType(value: Vendor['personType']) { setVendorDraft(d => ({ ...d, personType: value, residency: value === 'natural' ? 'residente' : 'domiciliada' })); }
  function updateDocument<K extends keyof PurchaseDocument>(key: K, value: PurchaseDocument[K]) {
    setDocumentDraft(d => {
      const updated = { ...d, [key]: value };
      if (key === 'vendorId') {
        const selectedVendor = vendorsById.get(String(value));
        if (selectedVendor && d.vendorId !== String(value)) {
          updated.ivaRetentionRate = selectedVendor.ivaRetentionRate;
          if (d.vendorId) updated.affectedDocumentId = '';
          const beneficiary = nationalIslrBeneficiary(selectedVendor);
          const concept = settings.islrConcepts?.find(item => item.code === d.islrConceptCode);
          if (d.islrConceptCode && (!beneficiary || concept?.beneficiary !== beneficiary)) updated.islrConceptCode = '';
        }
      }
      if (key === 'eventAt' && !d.id) {
        updated.period = String(value).slice(0, 7);
        updated.half = Number(String(value).slice(-2)) <= 15 ? 1 : 2;
      }
      if ((key === 'exempt' || key === 'base16' || key === 'base8') && !d.id && !updated.islrApplies) {
        updated.islrBase = numberValue(updated.exempt) + numberValue(updated.base16) + numberValue(updated.base8);
      }
      if (key === 'islrApplies' && value === true) updated.islrBase = numberValue(updated.exempt) + numberValue(updated.base16) + numberValue(updated.base8);
      return updated;
    });
  }

  async function saveVendor() {
    if (!can('vendors.manage')) return showToast('No tienes permiso para administrar proveedores.', true);
    if (!vendorDraft.rif.trim() || !vendorDraft.name.trim()) return showToast('Completa el RIF y la razón social.', true);
    if (vendorDraft.personType === 'natural' && !['residente', 'no_residente'].includes(vendorDraft.residency)) return showToast('Selecciona la residencia de la persona natural.', true);
    if (vendorDraft.personType === 'juridica' && !['domiciliada', 'no_domiciliada'].includes(vendorDraft.residency)) return showToast('Selecciona el domicilio de la persona jurídica.', true);
    const pendingMachine = vendorDraft.usesFiscalMachine ? fiscalMachineInput.trim().toUpperCase() : '';
    if (pendingMachine && (vendorDraft.fiscalMachineNumbers || []).some(item => item.toUpperCase() === pendingMachine)) return showToast('Ese número de máquina fiscal ya está agregado.', true);
    if (pendingMachine && (vendorDraft.fiscalMachineNumbers || []).length >= 200) return showToast('Registre hasta 200 máquinas fiscales por proveedor.', true);
    const draft = pendingMachine && vendorDraft.usesFiscalMachine ? { ...vendorDraft, fiscalMachineNumbers: [...(vendorDraft.fiscalMachineNumbers || []), pendingMachine] } : vendorDraft;
    setBusy(true);
    try {
      const { id, code, ...rest } = draft;
      await request<Vendor>(id ? `/api/vendors/${id}` : '/api/vendors', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(rest) });
      await refresh();
      setDrawer(null);
      showToast(id ? 'Proveedor actualizado.' : 'Proveedor creado.');
    } catch (e) { showToast((e as Error).message, true); } finally { setBusy(false); }
  }
  async function deleteVendor() {
    if (!vendorDraft.id || !window.confirm('¿Eliminar este proveedor?')) return;
    setBusy(true);
    try {
      await request<void>(`/api/vendors/${vendorDraft.id}`, { method: 'DELETE' });
      await refresh(); setDrawer(null); showToast('Proveedor eliminado.');
    } catch (e) { showToast((e as Error).message, true); } finally { setBusy(false); }
  }
  async function runVendorAudit() {
    setVendorAuditBusy(true);
    try {
      const report = await request<VendorAuditReport>('/api/vendors/audit');
      setVendorAudit(report);
      showToast(`Revisión interna terminada: ${report.summary.total} proveedores.`);
    } catch (error) { showToast((error as Error).message, true); }
    finally { setVendorAuditBusy(false); }
  }
  async function saveDocument(issue = false) {
    if (!can(documentDraft.id ? 'documents.edit' : 'documents.create') || (issue && !can('documents.issue'))) return showToast('No tienes permiso para esta acción.', true);
    const correctingIssued = documentDraft.status === 'issued' && editingIssued;
    const originalDocument = correctingIssued ? documents.find(item => item.id === documentDraft.id) : undefined;
    if (documentDraft.status === 'issued' && !correctingIssued) return;
    if (correctingIssued && (correctionReason.trim().length < 10 || correctionReason.trim().length > 500)) return showToast('Explica la corrección en 10 a 500 caracteres.', true);
    if (!documentDraft.vendorId || !documentDraft.number.trim() || !documentDraft.controlNumber.trim()) return showToast('Completa proveedor, número y control.', true);
    if (documentDraft.description.trim().length < 10 || documentDraft.description.length > 2000) return showToast('Describe la compra entre 10 y 2.000 caracteres.', true);
    if (!documentDraft.paymentAccountId || !settings.paymentAccounts?.some(x => x.id === documentDraft.paymentAccountId && (x.active || (correctingIssued && originalDocument?.paymentAccountId === x.id)))) return showToast('Selecciona una cuenta de pago activa.', true);
    const allocations = documentDraft.cecoAllocations || [];
    if (!allocations.length || allocations.some(x => !x.cecoId || !settings.cecos?.some(c => c.id === x.cecoId && (c.active || (correctingIssued && originalDocument?.cecoAllocations.some(previous => previous.cecoId === c.id)))))) return showToast('Selecciona los centros de costo activos.', true);
    if (new Set(allocations.map(x => x.cecoId)).size !== allocations.length) return showToast('No repitas un CECO en la distribución.', true);
    if (allocations.some(x => !Number.isFinite(x.percentage) || x.percentage <= 0 || x.percentage > 100 || Math.abs(x.percentage * 100 - Math.round(x.percentage * 100)) > 0.000001) || Math.round(allocations.reduce((n, x) => n + x.percentage, 0) * 100) !== 10_000) return showToast('La distribución CECO debe sumar 100 % con máximo dos decimales.', true);
    if (Object.values(moneyErrors).some(Boolean)) return showToast('Corrige los montos con formato 1.234,56.', true);
    if (documentDraft.igtfApplies && numberValue(documentDraft.igtfBase) <= 0) return showToast('Indica una base IGTF mayor que cero para calcular el 3 %.', true);
    if (documentDraft.type !== 'factura' && !documentDraft.affectedDocumentId) return showToast('Selecciona la factura afectada por la nota.', true);
    const fullyExempt = numberValue(documentDraft.exempt) > 0 && numberValue(documentDraft.base16) === 0 && numberValue(documentDraft.base8) === 0;
    if (!fullyExempt && (documentDraft.ivaRetentionRate === 0 || documentDraft.ivaRetentionRate === 100) && !documentDraft.ivaRetentionReason?.trim()) return showToast('Indica el motivo del porcentaje de retención de IVA.', true);
    if (documentDraft.islrApplies && !documentDraft.islrConceptCode) return showToast('Selecciona el concepto de ISLR.', true);
    if (documentDraft.islrApplies) {
      const beneficiary = nationalIslrBeneficiary(vendorsById.get(documentDraft.vendorId));
      const concept = settings.islrConcepts?.find(item => item.code === documentDraft.islrConceptCode);
      if (!beneficiary || concept?.beneficiary !== beneficiary) return showToast('Selecciona un concepto ISLR aplicable a este proveedor nacional.', true);
    }
    const expectedHalf = Number(documentDraft.eventAt.slice(-2)) <= 15 ? 1 : 2;
    if ((documentDraft.period !== documentDraft.eventAt.slice(0, 7) || documentDraft.half !== expectedHalf) && !documentDraft.periodOverrideReason?.trim()) return showToast('Indica el motivo del cambio de período o quincena.', true);
    if (documentDraft.islrApplies && documentDraft.islrManual && !documentDraft.islrManualReason?.trim()) return showToast('Indica el motivo del cálculo manual de ISLR.', true);
    if (correctingIssued && !window.confirm('¿Guardar esta corrección? Los números de retención asignados se conservarán. Si los importes de los comprobantes cambian, descarga las versiones actualizadas para revisarlas.')) return;
    setBusy(true);
    try {
      const { id, iva16, iva8, subtotal, total, ivaRetentionAmount, ivaCertificateNumber, islrCertificateNumber, islrSubtract, igtfAmount, netPayable, attachmentUrl, attachmentName, hasAttachment, ceco, ...rest } = documentDraft;
      const payload = { ...rest, status: correctingIssued ? 'issued' : 'draft', affectedDocumentId: rest.type === 'factura' ? null : rest.affectedDocumentId,
        exempt: numberValue(rest.exempt), base16: numberValue(rest.base16), base8: numberValue(rest.base8),
        igtfBase: rest.igtfApplies ? numberValue(rest.igtfBase) : 0,
        islrBase: rest.islrApplies ? numberValue(rest.islrBase) : 0,
        ...(correctingIssued ? { correctionReason: correctionReason.trim(), expectedUpdatedAt: documentDraft.updatedAt } : {}) };
      const saved = await request<PurchaseDocument>(id ? `/api/documents/${id}` : '/api/documents', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      setDocumentDraft(d => ({ ...d, id: String(saved.id), status: saved.status, updatedAt: saved.updatedAt, hasAttachment: saved.hasAttachment, attachmentName: saved.attachmentName }));
      const issued = !correctingIssued && issue
        ? await request<PurchaseDocument>(`/api/documents/${saved.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'issued' }) })
        : null;
      try { await refresh(); }
      catch {
        const fallback = issued || saved;
        setDocuments(current => [...current.filter(document => document.id !== String(fallback.id)), {
          ...fallback, id: String(fallback.id), vendorId: String(fallback.vendorId),
          affectedDocumentId: fallback.affectedDocumentId == null ? null : String(fallback.affectedDocumentId),
        }]);
      }
      setDrawer(null);
      setEditingIssued(false);
      setCorrectionReason('');
      if (correctingIssued) { showToast('Factura corregida. Los comprobantes conservan sus números.'); return; }
      if (!issued) {
        showToast('Borrador guardado.');
        return;
      }

      const automaticPdf = issued.ivaCertificateNumber && issued.islrCertificateNumber
        ? { path: `/api/documents/${issued.id}/combined-pdf`, fileName: `UPCO_IVA_ISLR_${issued.number}.pdf` }
        : issued.ivaCertificateNumber
          ? { path: `/api/documents/${issued.id}/iva-pdf`, fileName: `UPCO_IVA_${issued.ivaCertificateNumber}.pdf` }
          : issued.islrCertificateNumber
            ? { path: `/api/documents/${issued.id}/islr-pdf`, fileName: `UPCO_ISLR_${issued.islrCertificateNumber}.pdf` }
            : null;
      if (!automaticPdf) showToast('Documento emitido sin comprobantes de retención.');
      else {
        try { await download(automaticPdf.path, automaticPdf.fileName); showToast('Documento emitido. Descarga de comprobantes iniciada.'); }
        catch { showToast('Documento emitido. No se pudo descargar el PDF; abre el documento para intentarlo de nuevo.', true); }
      }
    } catch (e) { showToast((e as Error).message, true); } finally { setBusy(false); }
  }
  async function removeDocument(target: PurchaseDocument) {
    if (!can('documents.delete')) return showToast('No tienes permiso para eliminar documentos.', true);
    if (!target.id || busy) return;
    const name = `${typeLabel(target.type)} Nº ${target.number}`;
    const vendorName = vendorsById.get(target.vendorId)?.name || 'este proveedor';
    const confirmation = target.status === 'draft'
      ? `¿Eliminar definitivamente ${name} de ${vendorName}? Esta acción no se puede deshacer.`
      : `¿Eliminar definitivamente ${name} de ${vendorName}? Desaparecerá de los reportes. ${target.historicalImport ? 'Los números originales importados no se volverán a asignar.' : 'Sus números de retención quedarán disponibles para otra emisión.'} Usa esta opción solo antes de entregar o declarar el comprobante. Si ya lo entregaste o declaraste, revisa el ajuste correspondiente. Escribe ELIMINAR para confirmar.`;
    const confirmed = target.status === 'draft' ? window.confirm(confirmation) : window.prompt(confirmation)?.trim().toUpperCase() === 'ELIMINAR';
    if (!confirmed) return;
    setBusy(true);
    try {
      const result = await request<{ deleted: boolean; released?: { iva: string | null; islr: string | null }; warning?: string }>(`/api/documents/${target.id}`, { method: 'DELETE' });
      try { await refresh(); }
      catch { setDocuments(current => current.filter(document => document.id !== target.id)); }
      if (drawer === 'document' && documentDraft.id === target.id) setDrawer(null);
      const deletionMessage = target.status === 'draft' ? 'Borrador eliminado.'
        : target.historicalImport ? 'Documento histórico eliminado; sus correlativos originales siguen reservados.'
        : result.released?.iva || result.released?.islr ? 'Documento eliminado. Sus correlativos quedaron disponibles.'
        : 'Documento eliminado.';
      showToast(result.warning || deletionMessage, Boolean(result.warning));
    } catch (e) { showToast((e as Error).message, true); } finally { setBusy(false); }
  }
  async function voidDocument(target: PurchaseDocument) {
    if (!can('documents.delete')) return showToast('No tienes permiso para anular documentos.', true);
    if (!target.id || target.status !== 'issued' || busy) return;
    const message = `¿Anular ${typeLabel(target.type).toLowerCase()} Nº ${target.number}? Saldrá de los reportes. ${target.historicalImport ? 'Los correlativos históricos importados seguirán reservados.' : 'Sus correlativos IVA e ISLR quedarán disponibles para la próxima emisión.'} Si el comprobante ya fue entregado o declarado, revisa primero el ajuste correspondiente. Escribe ANULAR para confirmar.`;
    if (window.prompt(message)?.trim().toUpperCase() !== 'ANULAR') return;
    setBusy(true);
    try {
      const saved = await request<PurchaseDocument>(`/api/documents/${target.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'void' }) });
      try { await refresh(); }
      catch { setDocuments(current => current.map(document => document.id === target.id ? { ...saved, id: String(saved.id), vendorId: String(saved.vendorId), affectedDocumentId: saved.affectedDocumentId == null ? null : String(saved.affectedDocumentId) } : document)); }
      if (drawer === 'document' && documentDraft.id === target.id) setDrawer(null);
      showToast(target.historicalImport ? 'Documento anulado. Sus correlativos históricos siguen reservados.' : 'Documento anulado. Los correlativos asignados quedaron disponibles.');
    } catch (error) { showToast((error as Error).message, true); }
    finally { setBusy(false); }
  }
  async function saveSettings(confirmSequences = false) {
    if (!isMaster) return showToast('Solo el usuario master puede modificar reglas fiscales.', true);
    if (moneyErrors.unitTaxValue) return showToast('Corrige la unidad tributaria con formato 1.234,56.', true);
    if (confirmSequences && (['iva', 'islr'] as const).some(kind => {
      const sequence = settingsDraft.certificateSequences[kind];
      return sequence.period !== period || !Number.isInteger(sequence.nextNumber) || sequence.nextNumber < 1;
    })) return showToast('Revisa los próximos correlativos IVA e ISLR.', true);
    setBusy(true);
    try {
      const saved = await request<Settings>(`/api/settings?period=${encodeURIComponent(period)}`, { method: 'PATCH', body: JSON.stringify({
        companyName: settingsDraft.companyName, companyRif: settingsDraft.companyRif,
        companyAddress: settingsDraft.companyAddress, ivaGeneralRate: numberValue(settingsDraft.ivaGeneralRate),
        ivaReducedRate: numberValue(settingsDraft.ivaReducedRate), ivaLegalReference: settingsDraft.ivaLegalReference,
        islrLegalReference: settingsDraft.islrLegalReference, unitTaxValue: numberValue(settingsDraft.unitTaxValue),
        unitTaxEffectiveAt: settingsDraft.unitTaxEffectiveAt, conceptOverrides: settingsDraft.conceptOverrides,
        cecos: settingsDraft.cecos, paymentAccounts: settingsDraft.paymentAccounts,
        ...(confirmSequences ? { certificateSequences: settingsDraft.certificateSequences } : {}),
      }) });
      setSettings(saved); setSettingsDraft(saved);
      showToast(confirmSequences ? 'Correlativos IVA e ISLR actualizados.' : 'Configuración general actualizada.');
    } catch (e) { showToast((e as Error).message, true); } finally { setBusy(false); }
  }
  function updateCatalog(kind: 'cecos' | 'paymentAccounts', id: number, changes: Partial<CatalogItem>) {
    setSettingsDraft(d => ({ ...d, [kind]: d[kind].map(item => item.id === id ? { ...item, ...changes } : item) }));
  }
  async function addCatalog(kind: 'cecos' | 'paymentAccounts') {
    if (!can('catalogs.manage')) return showToast('No tienes permiso para administrar catálogos.', true);
    const code = quickCode.trim().toUpperCase();
    const name = quickName.trim();
    if (!code || !name) return showToast('Indica código y nombre.', true);
    if ((settingsDraft[kind] || []).some(item => item.code.toUpperCase() === code)) return showToast('Ese código ya existe.', true);
    setBusy(true);
    try {
      const list = [...(settingsDraft[kind] || []), { code, name, active: true }];
      const saved = await request<Settings>(`/api/settings?period=${encodeURIComponent(period)}`, { method: 'PATCH', body: JSON.stringify({ [kind]: list }) });
      setSettings(saved);
      setSettingsDraft(d => ({ ...d, [kind]: saved[kind] }));
      const added = saved[kind].find(item => item.code.toUpperCase() === code);
      if (drawer === 'document' && added) {
        if (kind === 'paymentAccounts') setDocumentDraft(d => ({ ...d, paymentAccountId: added.id }));
        else setDocumentDraft(d => {
          const rows = [...(d.cecoAllocations || [])];
          const empty = rows.findIndex(row => !row.cecoId);
          if (empty >= 0) rows[empty] = { ...rows[empty], cecoId: added.id };
          else if (!rows.length) rows.push({ cecoId: added.id, percentage: 100 });
          return { ...d, cecoAllocations: rows };
        });
      }
      setQuickAdd(null); setQuickCode(''); setQuickName('');
      showToast(kind === 'cecos' ? 'CECO agregado.' : 'Cuenta de pago agregada.');
    } catch (e) { showToast((e as Error).message, true); } finally { setBusy(false); }
  }
  function startQuickAdd(kind: 'cecos' | 'paymentAccounts') {
    if (!can('catalogs.manage')) return;
    setQuickAdd(kind); setQuickCode(''); setQuickName('');
  }
  function quickAddForm(kind: 'cecos' | 'paymentAccounts') {
    if (quickAdd !== kind) return null;
    return <div className="catalog-quick-add"><div className="form-grid"><Field label="Código"><input value={quickCode} maxLength={30} onChange={e => setQuickCode(e.target.value.toUpperCase())} placeholder={kind === 'cecos' ? 'CECO-001' : 'BANCO-001'} /></Field><Field label="Nombre"><input value={quickName} maxLength={120} onChange={e => setQuickName(e.target.value)} placeholder={kind === 'cecos' ? 'Centro de costo' : 'Banco y cuenta'} /></Field></div><div className="catalog-actions"><button type="button" className="btn btn-secondary btn-small" onClick={() => setQuickAdd(null)} disabled={busy}>Cancelar</button><button type="button" className="btn btn-primary btn-small" onClick={() => addCatalog(kind)} disabled={busy}>Agregar</button></div></div>;
  }
  async function importDocuments(mode: 'preview' | 'commit') {
    if (!can('imports.run')) return showToast('No tienes permiso para importar documentos.', true);
    if (!importFile || importBusy) return;
    if (mode === 'commit' && (!importPreview || importPreview.summary.blocked > 0 || !window.confirm(`¿Importar ${importPreview.summary.ready} documentos históricos? Se conservarán sus números de comprobante y no se emitirán retenciones nuevas.`))) return;
    setImportBusy(true);
    try {
      const body = new FormData();
      body.append('file', importFile);
      const response = await fetch(`/api/import/documents?mode=${mode}`, { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || `Error ${response.status}`);
      if (mode === 'preview') setImportPreview(data as ImportPreview);
      else {
        const imported = Number(data.imported || 0);
        setImportFile(null); setImportPreview(null); setImportInputKey(key => key + 1);
        await refresh();
        showToast(`${imported} ${imported === 1 ? 'documento importado' : 'documentos importados'}.`);
      }
    } catch (e) { showToast((e as Error).message, true); }
    finally { setImportBusy(false); }
  }
  async function getFile(path: string, fileName: string) {
    if ((path.startsWith('/api/exports/') && !can('exports.run')) || (path.startsWith('/api/import/') && !can('imports.run'))) return showToast('No tienes permiso para descargar este archivo.', true);
    setBusy(true);
    try { await download(path, fileName); showToast('Descarga iniciada.'); }
    catch (e) { showToast((e as Error).message, true); }
    finally { setBusy(false); }
  }
  async function logout() {
    try { await fetch('/api/auth/logout', { method: 'POST' }); }
    finally { window.location.replace('/login'); }
  }
  async function uploadAttachment(file: File) {
    if (!documentDraft.id || documentDraft.status !== 'draft') return;
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return showToast('Adjunta un PDF, JPG, PNG o WEBP.', true);
    if (file.size > 10 * 1024 * 1024) return showToast('El archivo no puede superar 10 MB.', true);
    setBusy(true);
    try {
      const response = await fetch(`/api/documents/${documentDraft.id}/attachment`, { method: 'PUT', headers: { 'Content-Type': file.type, 'X-File-Name': file.name }, body: file });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error || 'No se pudo adjuntar el soporte.');
      }
      setDocumentDraft(d => ({ ...d, hasAttachment: true, attachmentName: file.name }));
      await refresh(); showToast('Soporte adjuntado.');
    } catch (e) { showToast((e as Error).message, true); } finally { setBusy(false); }
  }
  async function deleteAttachment() {
    if (!documentDraft.id || documentDraft.status !== 'draft' || !window.confirm('¿Quitar el soporte adjunto?')) return;
    setBusy(true);
    try {
      await request<void>(`/api/documents/${documentDraft.id}/attachment`, { method: 'DELETE' });
      setDocumentDraft(d => ({ ...d, hasAttachment: false, attachmentName: null }));
      await refresh(); showToast('Soporte eliminado.');
    } catch (e) { showToast((e as Error).message, true); } finally { setBusy(false); }
  }

  const periodQuery = `period=${encodeURIComponent(period)}`;
  const kpiDocs = summary?.documents ?? visibleDocs.length;
  const kpiTotal = summary?.invoiceTotal ?? docTotals.total;
  const kpiIva = summary?.ivaRetained ?? docTotals.iva;
  const kpiIslr = summary?.islrRetained ?? docTotals.islr;

  return (
    <div className="app-shell">
      {mobileOpen && <div className="mobile-shade" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="brand"><img src="/upco-logo-light.png" alt="UPCO de Venezuela" className="brand-image" /><span className="brand-caption">Compras y retenciones</span></div>
        <div className="nav-label">ESPACIO DE TRABAJO</div>
        <nav className="nav-list" aria-label="Navegación principal">
          {([
            ['resumen', LayoutDashboard, 'Resumen'], ['compras', ReceiptText, 'Compras y notas'],
            ['proveedores', UsersRound, 'Proveedores'],
            ...(can('exports.run') || can('imports.run') ? [['reportes', FileSpreadsheet, 'Reportes'] as const] : []),
            ...(isMaster || can('catalogs.manage') ? [['configuracion', Settings2, 'Configuración'] as const] : []),
            ...(isMaster ? [['usuarios', ShieldCheck, 'Usuarios'] as const] : []),
          ] as const).map(([key, Icon, label]) => <button key={key} className={`nav-item ${view === key ? 'active' : ''}`} onClick={() => navigate(key)}><Icon />{label}</button>)}
        </nav>
        <div className="side-bottom">
          <div className="side-company"><div className="side-avatar">UP</div><div><strong>UPCO de Venezuela</strong><span>RIF J308175390</span></div></div>
          <div className="side-help">Gestión de compras, retenciones y declaraciones en un solo lugar.</div>
          <button className="side-logout" onClick={logout}>Cerrar sesión</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <button className="mobile-menu" aria-label="Abrir menú" onClick={() => setMobileOpen(true)}><Menu /></button>
            <div><div className="top-title">{titleByView[view]}</div><div className="top-subtitle">UPCO DE VENEZUELA CONSULTORES, S.A.</div></div>
          </div>
          <div className="top-actions"><label className="period-control"><CalendarDays /><input type="month" aria-label="Período" value={period} onChange={e => setPeriod(e.target.value)} /></label><span className="admin-pill"><span />{user.username} · {isMaster ? 'Master' : 'Usuario'}</span></div>
        </header>

        <div className="content">
          {error && <div className="error-banner"><span>{error}</span><button className="btn btn-plain btn-small" onClick={() => { setLoading(true); refresh().catch(e => setError(e.message)).finally(() => setLoading(false)); }}>Reintentar</button></div>}
          {loading ? <div className="loading-state"><div className="spinner" />Cargando la información de UPCO...</div> : <>
            {view === 'resumen' && renderDashboard()}
            {view === 'compras' && renderDocuments()}
            {view === 'proveedores' && renderVendors()}
            {view === 'reportes' && renderReports()}
            {view === 'configuracion' && (isMaster ? renderSettings() : renderCatalogOnly())}
            {view === 'usuarios' && renderUsers()}
          </>}
        </div>
      </main>

      {drawer && <><div className="overlay" onClick={closeDrawer} />{drawer === 'vendor' ? renderVendorDrawer() : renderDocumentDrawer()}</>}
      {toast && <div className="toast-host"><div className={`toast ${toast.error ? 'error' : ''}`} role="status">{toast.text}</div></div>}
    </div>
  );

  function renderDashboard() {
    const recent = [...documents].filter(d => d.status !== 'void').sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)).slice(0, 5);
    return <>
      <div className="page-head"><div><p className="eyebrow">PANEL DE CONTROL</p><h1>Tu operación, al día.</h1><p>Control de compras y retenciones de {monthText(period)}.</p></div><div className="head-actions">{can('exports.run') && <button className="btn btn-secondary" onClick={() => navigate('reportes')}><FileSpreadsheet />Ver reportes</button>}{can('documents.create') && <button className="btn btn-primary" onClick={() => openDocument()}><Plus />Nueva compra</button>}</div></div>
      <section className="hero"><div className="hero-content"><div className="hero-kicker">PERÍODO ACTIVO · {half === 1 ? 'PRIMERA' : 'SEGUNDA'} QUINCENA</div><h2>{periodRange(period, half)}</h2><p>Registra las compras, revisa las retenciones y descarga los archivos de la quincena desde un mismo registro.</p></div><div className="hero-actions"><button className="btn" onClick={() => navigate('compras')}><ReceiptText />Abrir compras <ArrowRight /></button></div></section>
      <div className="period-chips"><button className={`chip ${half === 1 ? 'active' : ''}`} onClick={() => setHalf(1)}>1ª quincena</button><button className={`chip ${half === 2 ? 'active' : ''}`} onClick={() => setHalf(2)}>2ª quincena</button></div>
      <div className="kpi-grid">
        <Kpi label="Documentos" value={String(kpiDocs)} note="En la quincena" icon={<ClipboardList />} />
        <Kpi label="Total de compras" value={money(kpiTotal)} note="Facturas y ajustes" icon={<Wallet />} />
        <Kpi label="IVA retenido" value={money(kpiIva)} note="Por enterar" icon={<ShieldCheck />} />
        <Kpi label="ISLR retenido" value={money(kpiIslr)} note="Del período" icon={<FileText />} />
      </div>
      <div className="overview-grid">
        <section className="panel"><div className="panel-head"><div><h3>Documentos recientes</h3><p>Últimas facturas y notas registradas</p></div><button className="section-link" onClick={() => navigate('compras')}>Ver todos →</button></div>{recent.length ? <div className="table-wrap"><table className="data-table recent-table"><thead><tr><th>Documento</th><th>Proveedor</th><th>Fecha</th><th className="right">Total</th><th>Estado</th></tr></thead><tbody>{recent.map(d => <tr key={d.id} onClick={() => openDocument(d)} style={{cursor:'pointer'}}><td className="strong">{typeLabel(d.type)} Nº {d.number}</td><td>{vendorsById.get(d.vendorId)?.name || 'Proveedor'}</td><td className="muted mono">{dateText(d.issuedAt)}</td><td className="right mono strong">{money(d.total)}</td><td><span className={`badge ${badgeClass(d.status)}`}>{statusLabel(d.status)}</span></td></tr>)}</tbody></table></div> : <Empty icon={<ReceiptText />} title="Aún no hay compras" description="Registra la primera factura para comenzar." action={<button className="btn btn-primary btn-small" onClick={() => openDocument()}>Registrar compra</button>} />}</section>
        <section className="panel"><div className="panel-head"><div><h3>En esta quincena</h3><p>Vista rápida del cierre</p></div><CalendarDays size={17} color="#72a17c" /></div><div className="panel-body side-stats"><div className="mini-stat"><div className="mini-stat-top"><span>Compras registradas</span><ReceiptText size={15} /></div><strong>{visibleDocs.length}</strong><div className="progress"><i style={{width:visibleDocs.length ? '100%' : '0%'}} /></div></div><div className="mini-stat"><div className="mini-stat-top"><span>Comprobantes emitidos</span><Check size={15} /></div><strong>{visibleDocs.filter(d => d.status === 'issued').length}</strong><div className="progress"><i style={{width:`${visibleDocs.length ? (visibleDocs.filter(d => d.status === 'issued').length / visibleDocs.length) * 100 : 0}%`}} /></div></div><button className="btn btn-secondary btn-full" onClick={() => navigate('reportes')}><ArrowDownToLine />Preparar cierre</button></div></section>
      </div>
    </>;
  }

  function renderDocuments() {
    return <>
      <div className="page-head"><div><p className="eyebrow">REGISTRO DOCUMENTAL</p><h1>Compras y notas</h1><p>Facturas, notas de crédito y débito con sus retenciones.</p></div><div className="head-actions">{can('documents.create') && <button className="btn btn-primary" onClick={() => openDocument()}><Plus />Nuevo documento</button>}</div></div>
      <div className="toolbar"><div className="toolbar-left"><label className="searchbar"><Search /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar factura o proveedor" /></label><select className="select-input" aria-label="Estado" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">Todos los estados activos</option><option value="draft">Borradores</option><option value="issued">Emitidos</option><option value="void">Anulados</option></select></div><div className="toolbar-right"><button className={`chip ${half === 1 ? 'active' : ''}`} onClick={() => setHalf(1)}>1ª quincena</button><button className={`chip ${half === 2 ? 'active' : ''}`} onClick={() => setHalf(2)}>2ª quincena</button></div></div>
      <section className="panel"><div className="panel-head"><div><h3>{periodRange(period, half)}</h3><p>{filteredDocs.length} documentos encontrados</p></div><button className="btn btn-secondary btn-small" onClick={() => { setLoading(true); refresh().catch(e => setError(e.message)).finally(() => setLoading(false)); }}><RefreshCw />Actualizar</button></div>{filteredDocs.length ? <div className="table-wrap"><table className="data-table documents-table"><thead><tr><th>Tipo y número</th><th>Proveedor</th><th>Emisión</th><th>Base 16 %</th><th>Base 8 %</th><th className="right">Total</th><th>Estado</th><th className="right">Acciones</th></tr></thead><tbody>{filteredDocs.map(d => <tr key={d.id}><td><span className="strong">{typeLabel(d.type)} Nº {d.number}</span><br/><span className="muted mono">Control {d.controlNumber}</span></td><td><div className="vendor-cell"><span className="vendor-avatar">{initials(vendorsById.get(d.vendorId)?.name || 'P')}</span><span>{vendorsById.get(d.vendorId)?.name || 'Proveedor no encontrado'}</span></div></td><td className="mono">{dateText(d.issuedAt)}</td><td className="mono">{money(d.base16)}</td><td className="mono">{money(d.base8)}</td><td className="right mono strong">{money(d.total)}</td><td><span className={`badge ${badgeClass(d.status)}`}>{statusLabel(d.status)}</span></td><td className="actions"><button className="btn btn-secondary btn-small" onClick={() => openDocument(d)} disabled={busy}>Ver</button>{d.id && can('documents.delete') && <button type="button" className="btn btn-danger btn-small" onClick={() => removeDocument(d)} disabled={busy}><Trash2 />Eliminar</button>}</td></tr>)}</tbody></table></div> : <Empty icon={<ReceiptText />} title={statusFilter === 'void' ? 'No hay documentos anulados en este período' : 'No hay documentos en este período'} description={statusFilter === 'void' ? 'Los documentos anulados se conservan aquí como historial.' : 'Crea una factura o cambia la quincena para ver otros registros.'} action={statusFilter === 'void' ? undefined : <button className="btn btn-primary btn-small" onClick={() => openDocument()}>Nuevo documento</button>} />}</section>
    </>;
  }

  function renderVendors() {
    return <>
      <div className="page-head"><div><p className="eyebrow">DIRECTORIO FISCAL</p><h1>Proveedores</h1><p>Datos tributarios que alimentan facturas y comprobantes.</p></div><div className="head-actions"><button className="btn btn-secondary" disabled={vendorAuditBusy} onClick={runVendorAudit}><ShieldCheck />{vendorAuditBusy ? 'Revisando…' : 'Revisar todos'}</button>{can('vendors.manage') && <button className="btn btn-primary" onClick={() => openVendor()}><Plus />Nuevo proveedor</button>}</div></div>
      {vendorAudit && <section className="panel" style={{marginBottom:16}}>
        <div className="panel-head"><div><h3>Auditoría de proveedores</h3><p>{vendorAudit.summary.total} fichas · {vendorAudit.summary.importedTotal} importadas</p></div><ShieldCheck size={18} color="#5f9c70" /></div>
        <div className="panel-body">
          <p className="helper">Esta revisión detecta inconsistencias en los datos guardados y en los soportes de importación. No consulta al SENIAT ni comprueba la vigencia de un RIF.</p>
          <p className="helper" style={{marginTop:8}}>{vendorAudit.summary.highPriority} fichas con observaciones prioritarias · {vendorAudit.summary.withIssues} con alguna observación.</p>
          <div className="toolbar" style={{marginTop:14}}><div className="toolbar-left"><button className="btn btn-secondary" disabled={vendorAuditBusy} onClick={() => getFile('/api/vendors/audit?format=csv', 'UPCO_revision_proveedores.csv')}><ArrowDownToLine />Descargar informe CSV</button></div></div>
          {vendorAudit.items.some(item => item.issues.length) && <div className="table-wrap" style={{maxHeight:340,overflow:'auto',marginTop:14}}><table className="data-table"><thead><tr><th>Proveedor</th><th>RIF</th><th>Observaciones</th><th className="right">Acción</th></tr></thead><tbody>{vendorAudit.items.filter(item => item.issues.length).slice(0, 20).map(item => <tr key={item.id}><td className="strong">{item.name}</td><td className="mono">{item.rif}</td><td>{item.issues.map(issue => issue.label).join(' · ')}</td><td className="actions"><button className="btn btn-secondary btn-small" onClick={() => openVendor(vendorsById.get(String(item.id)))}>Editar</button></td></tr>)}</tbody></table></div>}
          {vendorAudit.summary.withIssues > 20 && <p className="helper" style={{marginTop:10}}>Se muestran 20 fichas; descarga el CSV para verlas todas.</p>}
        </div>
      </section>}
      <div className="toolbar"><label className="searchbar"><Search /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nombre, RIF o código" /></label><div className="toolbar-right"><span className="helper">{vendors.length} {vendors.length === 1 ? 'proveedor registrado' : 'proveedores registrados'}</span></div></div>
      <section className="panel">{filteredVendors.length ? <div className="table-wrap"><table className="data-table vendors-table"><thead><tr><th>Proveedor</th><th>RIF</th><th>Tipo</th><th>Persona</th><th>Ret. IVA</th><th>Estado</th><th className="right">Acciones</th></tr></thead><tbody>{filteredVendors.map(v => <tr key={v.id}><td><div className="vendor-cell"><span className="vendor-avatar">{initials(v.name)}</span><span><span className="strong">{v.name}</span><br/><span className="muted">{v.code || 'Sin correlativo'}</span></span></div></td><td className="mono">{v.rif}</td><td style={{textTransform:'capitalize'}}>{v.taxpayerType}</td><td style={{textTransform:'capitalize'}}>{v.personType}</td><td className="mono">{v.ivaRetentionRate} %</td><td><span className={`badge ${v.active ? 'badge-green' : 'badge-gray'}`}>{v.active ? 'Activo' : 'Inactivo'}</span></td><td className="actions"><button className="btn btn-secondary btn-small" onClick={() => openVendor(v)}>Editar</button></td></tr>)}</tbody></table></div> : <Empty icon={<UsersRound />} title="Aún no hay proveedores" description="Carga sus datos fiscales para registrar compras." action={<button className="btn btn-primary btn-small" onClick={() => openVendor()}>Agregar proveedor</button>} />}</section>
    </>;
  }

  function renderReports() {
    const booksHalf = reportHalf === 'all' ? '' : `&half=${reportHalf}`;
    const selectedDocs = documents.filter(d => d.period === period && (reportHalf === 'all' || d.half === reportHalf) && d.status === 'issued');
    const draftDocs = documents.filter(d => d.period === period && (reportHalf === 'all' || d.half === reportHalf) && d.status === 'draft');
    const retainedDocs = selectedDocs.filter(d => numberValue(d.ivaRetentionAmount) !== 0);
    const countRetained = retainedDocs.length;
    const mixedDocs = retainedDocs.filter(d => numberValue(d.base16) !== 0 && numberValue(d.base8) !== 0);
    const documentsById = new Map(documents.map(d => [d.id, d]));
    const crossPeriodNotes = retainedDocs.filter(d => {
      if (d.type !== 'nota_credito' || !d.affectedDocumentId) return false;
      const original = documentsById.get(d.affectedDocumentId);
      return !original || original.status !== 'issued' || original.period !== d.period || original.half !== d.half;
    });
    const txtBlocked = draftDocs.length > 0 || mixedDocs.length > 0 || crossPeriodNotes.length > 0;
    const retained = selectedDocs.reduce((s, d) => s + numberValue(d.ivaRetentionAmount), 0);
    return <>
      <div className="page-head"><div><p className="eyebrow">CIERRE FISCAL</p><h1>Reportes y exportaciones</h1><p>Descarga los archivos generados a partir de los mismos documentos.</p></div></div>
      <div className="toolbar"><div className="toolbar-left"><label className="period-control"><CalendarDays /><input type="month" aria-label="Período de exportación" value={period} onChange={e => setPeriod(e.target.value)} /></label><select className="select-input" aria-label="Quincena de exportación" value={reportHalf} onChange={e => setReportHalf(e.target.value === 'all' ? 'all' : Number(e.target.value) as 1 | 2)}><option value="all">Mes completo</option><option value="1">Primera quincena</option><option value="2">Segunda quincena</option></select></div><span className="helper">Período: {periodRange(period, reportHalf)}</span></div>
      <div className="report-grid">
        <ReportCard color="green" icon={<BookOpen />} title="Libro de compras" description="Excel con columnas separadas para base e IVA al 16 % y al 8 %, además de los totales y retenciones." button="Descargar Excel" onClick={() => getFile(`/api/exports/book?${periodQuery}${booksHalf}`, `UPCO_libro_compras_${period}${reportHalf === 'all' ? '' : '_Q' + reportHalf}.xlsx`)} disabled={busy} />
        <ReportCard color="blue" icon={<FileText />} title="Retenciones de IVA" description="TXT de la quincena para carga en SENIAT. Requiere seleccionar primera o segunda quincena." button="Descargar TXT" onClick={() => reportHalf === 'all' ? showToast('Selecciona una quincena para el TXT.', true) : getFile(`/api/exports/iva-txt?${periodQuery}&half=${reportHalf}`, `UPCO_IVA_${period}_Q${reportHalf}.txt`)} disabled={busy} />
        <ReportCard color="sand" icon={<FileArchive />} title="Retenciones de ISLR" description="Archivo XML mensual con los conceptos y datos de las retenciones practicadas." button="Descargar XML" onClick={() => getFile(`/api/exports/islr-xml?${periodQuery}`, `UPCO_ISLR_${period}.xml`)} disabled={busy} />
        <ReportCard color="green" icon={<FileSpreadsheet />} title="Relación ISLR para macro" description="Excel mensual: la primera hoja retISLR replica las columnas A:H de la macro histórica. Copia esos datos en la macro original; este archivo no contiene macros." button="Descargar Excel" onClick={() => getFile(`/api/exports/islr-data?${periodQuery}`, `UPCO_ISLR_macro_${period}.xlsx`)} disabled={busy} />
      </div>
      <section className="panel" style={{marginTop:16}}><div className="panel-head"><div><h3>Cierre contable por fechas</h3><p>Excel con descripción de cada compra, cuenta de pago y distribución entre CECO para revisar la contabilidad.</p></div><FileSpreadsheet size={18} color="#5f9c70" /></div><div className="panel-body"><div className="toolbar"><div className="toolbar-left"><label className="field">Desde<input type="date" aria-label="Cierre desde" value={closeFrom} onChange={e => setCloseFrom(e.target.value)} /></label><label className="field">Hasta<input type="date" aria-label="Cierre hasta" value={closeTo} onChange={e => setCloseTo(e.target.value)} /></label></div><button className="btn btn-primary" disabled={busy} onClick={() => !closeFrom || !closeTo || closeFrom > closeTo ? showToast('Selecciona un rango de fechas válido para el cierre.', true) : getFile(`/api/exports/monthly-close?from=${encodeURIComponent(closeFrom)}&to=${encodeURIComponent(closeTo)}`, `UPCO_Cierre_Contable_${closeFrom}_a_${closeTo}.xlsx`)}><ArrowDownToLine />Exportar cierre</button></div><p className="helper" style={{marginTop:10}}>Incluye documentos emitidos con pago o abono en cuenta dentro del rango, sin borradores ni anulados.</p></div></section>
      <section className="panel" style={{marginTop:16}}>
        <div className="panel-head"><div><h3>Importar documentos anteriores</h3><p>Descarga la plantilla, completa las compras y revisa las filas antes de incorporarlas al libro.</p></div><FileSpreadsheet size={18} color="#5f9c70" /></div>
        <div className="panel-body">
          <div className="toolbar"><button className="btn btn-secondary" onClick={() => getFile('/api/import/documents/template', 'UPCO_Plantilla_Importacion_Documentos.xlsx')} disabled={busy || importBusy}><ArrowDownToLine />Descargar plantilla</button><input key={importInputKey} className="input" type="file" accept=".xlsx,.csv" aria-label="Archivo de documentos para importar" onChange={e => { setImportFile(e.target.files?.[0] || null); setImportPreview(null); }} /><button className="btn btn-secondary" disabled={!importFile || importBusy} onClick={() => importDocuments('preview')}>{importBusy ? 'Revisando…' : 'Revisar archivo'}</button></div>
          {importFile && <p className="helper" style={{marginTop:10}}>Archivo seleccionado: {importFile.name}</p>}
          <p className="helper" style={{marginTop:10}}>Usa esta opción cuando quieras agregar compras ya emitidas. Conserva los PDF originales de retenciones históricas: la plantilla importa sus números y montos, pero no adjunta ni recrea esos comprobantes.</p>
          {importPreview && <><p className="helper" style={{marginTop:13}}>{importPreview.summary.total} filas · {importPreview.summary.ready} listas · {importPreview.summary.blocked} por corregir. La importación se detiene si alguna fila tiene errores.</p><div className="table-wrap" style={{maxHeight:360,overflow:'auto'}}><table className="data-table"><thead><tr><th>Fila</th><th>RIF</th><th>Tipo</th><th>Documento</th><th>Fecha de pago</th><th>Período</th><th>Revisión</th></tr></thead><tbody>{importPreview.rows.map(row => <tr key={row.row}><td>{row.row}</td><td className="mono">{row.values.rif}</td><td>{row.values.type}</td><td className="mono">{row.values.number}</td><td>{dateText(row.values.eventAt)}</td><td>{row.values.period} · Q{row.values.half}</td><td>{row.issues.length ? <span className="badge badge-amber">{row.issues.join('; ')}</span> : row.warnings?.length ? <span className="badge badge-amber">Lista con aviso: {row.warnings.join('; ')}</span> : <span className="badge badge-green">Lista</span>}</td></tr>)}</tbody></table></div><div style={{marginTop:13}}><button className="btn btn-primary" disabled={importBusy || importPreview.summary.blocked > 0 || importPreview.summary.ready === 0} onClick={() => importDocuments('commit')}>Importar {importPreview.summary.ready} documentos</button></div></>}
        </div>
      </section>
      <div className="overview-grid" style={{marginTop:16}}><section className="panel"><div className="panel-head"><div><h3>Conciliación del período</h3><p>{periodRange(period, reportHalf)}</p></div><ShieldCheck size={18} color="#5f9c70" /></div><div className="panel-body"><div className="reconcile-grid"><div className="reconcile-item"><span>Documentos emitidos</span><strong>{selectedDocs.length}</strong></div><div className="reconcile-item"><span>Con retención de IVA</span><strong>{countRetained}</strong></div><div className="reconcile-item"><span>IVA retenido</span><strong>{money(retained)}</strong></div></div><p className="helper" style={{marginTop:13}}>El libro incluye {selectedDocs.length} documentos emitidos. {countRetained} tienen IVA retenido y {selectedDocs.length - countRetained} con retención 0 % quedan solo en el libro; el TXT incluye las retenciones practicadas de la quincena.</p></div></section><section className="panel"><div className="panel-head"><div><h3>Antes de exportar</h3><p>Revisión de {periodRange(period, reportHalf)}</p></div><CircleHelp size={17} color="#6b9e7a" /></div><div className="panel-body export-checklist">
          <div className="export-check-item"><span className={draftDocs.length ? 'export-attention' : 'export-clear'}>{draftDocs.length ? 'Revisar' : '✓'}</span><span>{draftDocs.length ? `${draftDocs.length} ${draftDocs.length === 1 ? 'documento en borrador bloquea' : 'documentos en borrador bloquean'} el libro final y el TXT.` : 'Sin borradores en el período.'}</span></div>
          <div className="export-check-item"><span className={mixedDocs.length ? 'export-attention' : 'export-clear'}>{mixedDocs.length ? 'TXT detenido' : '✓'}</span><span>{mixedDocs.length ? `${mixedDocs.length} ${mixedDocs.length === 1 ? 'documento con bases' : 'documentos con bases'} al 16 % y 8 %: valida su representación antes del TXT.` : 'Sin retenciones de IVA con dos alícuotas.'}</span></div>
          <div className="export-check-item"><span className={crossPeriodNotes.length ? 'export-attention' : 'export-clear'}>{crossPeriodNotes.length ? 'TXT detenido' : '✓'}</span><span>{crossPeriodNotes.length ? `${crossPeriodNotes.length} ${crossPeriodNotes.length === 1 ? 'nota de crédito ajusta' : 'notas de crédito ajustan'} una factura de otra quincena o mes; revisa el tratamiento en SENIAT antes del TXT.` : 'Sin notas de crédito que ajusten otro período.'}</span></div>
          <div className="export-check-item"><span className={reportHalf === 'all' || txtBlocked || !countRetained ? 'export-attention' : 'export-clear'}>{reportHalf === 'all' ? 'Elegir' : txtBlocked ? 'TXT detenido' : !countRetained ? 'Sin movimientos' : 'IVA'}</span><span>{reportHalf === 'all' ? 'Selecciona una quincena para descargar el TXT de IVA.' : txtBlocked ? 'Resuelve borradores, facturas mixtas o notas de otra quincena antes de descargar el TXT.' : !countRetained ? 'No hay IVA retenido declarable; el TXT no genera operaciones ficticias.' : `${countRetained} ${countRetained === 1 ? 'operación' : 'operaciones'} con IVA retenido en la quincena.`}</span></div>
        </div></section></div>
      <div className="report-info"><strong>Facturas con dos alícuotas:</strong> el Excel conserva ambas columnas. El TXT tiene una sola alícuota por línea; la plataforma detendrá esa exportación hasta validar la representación de la factura mixta con el portal SENIAT.</div>
    </>;
  }

  function renderCatalogSettings(kind: 'cecos' | 'paymentAccounts', title: string, description: string) {
    const items = settingsDraft[kind] || [];
    return <section className="panel catalog-panel">
      <div className="panel-head"><div><h3>{title}</h3><p>{description}</p></div><button type="button" className="btn btn-secondary btn-small" onClick={() => startQuickAdd(kind)}><Plus />Agregar</button></div>
      <div className="panel-body">
        {items.length ? items.map(item => <div className="catalog-item" key={item.id}>
          <Field label="Código"><input value={item.code} maxLength={30} onChange={e => updateCatalog(kind,item.id,{code:e.target.value.toUpperCase()})} /></Field>
          <Field label="Nombre"><input value={item.name} maxLength={120} onChange={e => updateCatalog(kind,item.id,{name:e.target.value})} /></Field>
          <label className="catalog-active"><input type="checkbox" checked={item.active} onChange={e => updateCatalog(kind,item.id,{active:e.target.checked})} />Activo</label>
        </div>) : <p className="helper">Aún no hay {kind === 'cecos' ? 'centros de costo' : 'cuentas de pago'}. {kind === 'cecos' ? 'Agrégalos' : 'Agrégalas'} antes de registrar compras.</p>}
        {quickAddForm(kind)}
      </div>
    </section>;
  }

  async function saveCatalogs() {
    if (!can('catalogs.manage')) return;
    setBusy(true);
    try {
      const saved = await request<Settings>(`/api/settings?period=${encodeURIComponent(period)}`, { method: 'PATCH', body: JSON.stringify({ cecos: settingsDraft.cecos, paymentAccounts: settingsDraft.paymentAccounts }) });
      setSettings(saved); setSettingsDraft(saved); showToast('CECO y cuentas actualizados.');
    } catch (error) { showToast((error as Error).message, true); } finally { setBusy(false); }
  }

  function renderCatalogOnly() {
    if (!can('catalogs.manage')) return null;
    return <><div className="page-head"><div><p className="eyebrow">CATÁLOGOS</p><h1>CECO y cuentas de pago</h1><p>Administra las opciones disponibles al registrar compras.</p></div><button className="btn btn-primary" onClick={saveCatalogs} disabled={busy}><Check />Guardar catálogos</button></div><div className="settings-grid">{renderCatalogSettings('cecos','Centros de costo (CECO)','Distribuye cada compra entre uno o varios centros.')}{renderCatalogSettings('paymentAccounts','Cuentas de pago','Cuenta desde la que se pagó o abonó cada compra.')}</div></>;
  }

  function renderSettings() {
    const sequences = settings.certificateSequences;
    const pendingSequences = !sequences.iva.configured || !sequences.islr.configured;
    return <>
      <div className="page-head"><div><p className="eyebrow">ADMINISTRACIÓN</p><h1>Configuración fiscal</h1><p>Datos de UPCO y reglas aplicadas a nuevos documentos.</p></div><button className="btn btn-primary" onClick={() => saveSettings(false)} disabled={busy}><Check />Guardar configuración general</button></div>
      <div className="settings-grid">
        <section className="panel"><div className="panel-head"><div><h3>Agente y parámetros</h3><p>Datos para comprobantes y cálculos</p></div></div><div className="panel-body"><div className="form-grid">
          <Field label="Razón social" span2><input value={settingsDraft.companyName} onChange={e => setSettingsDraft(d => ({...d,companyName:e.target.value}))} /></Field>
          <Field label="RIF"><input value={settingsDraft.companyRif} onChange={e => setSettingsDraft(d => ({...d,companyRif:e.target.value.toUpperCase()}))} /></Field>
          <Field label="Unidad tributaria (Bs.)"><MoneyInput value={numberValue(settingsDraft.unitTaxValue)} onChange={value => setSettingsDraft(d => ({...d,unitTaxValue:value}))} onValidityChange={valid => setMoneyErrors(errors => ({...errors,unitTaxValue:!valid}))} aria-label="Unidad tributaria" /></Field>
          <Field label="Dirección fiscal" span2><textarea value={settingsDraft.companyAddress || ''} onChange={e => setSettingsDraft(d => ({...d,companyAddress:e.target.value}))} /></Field>
          <Field label="Vigencia de la UT"><input type="date" value={settingsDraft.unitTaxEffectiveAt || ''} onChange={e => setSettingsDraft(d => ({...d,unitTaxEffectiveAt:e.target.value}))} /></Field>
          <Field label="Alícuota IVA general (%)"><input type="number" step="0.01" min="0" value={settingsDraft.ivaGeneralRate} onChange={e => setSettingsDraft(d => ({...d,ivaGeneralRate:numberValue(e.target.value)}))} /></Field>
          <Field label="Alícuota IVA reducida (%)"><input type="number" step="0.01" min="0" value={settingsDraft.ivaReducedRate} onChange={e => setSettingsDraft(d => ({...d,ivaReducedRate:numberValue(e.target.value)}))} /></Field>
          <Field label="Referencia normativa IVA" span2><input value={settingsDraft.ivaLegalReference || ''} onChange={e => setSettingsDraft(d => ({...d,ivaLegalReference:e.target.value}))} /></Field>
          <Field label="Referencia normativa ISLR" span2><input value={settingsDraft.islrLegalReference || ''} onChange={e => setSettingsDraft(d => ({...d,islrLegalReference:e.target.value}))} /></Field>
        </div></div></section>
        <section className="panel"><div className="panel-head"><div><h3>Conceptos de ISLR</h3><p>Catálogo SENIAT y ajustes de alícuotas</p></div><SlidersHorizontal size={17} color="#6b9e7a" /></div><div className="panel-body" style={{maxHeight:560,overflowY:'auto'}}>
          {settingsDraft.islrConcepts?.length ? settingsDraft.islrConcepts.map((concept, i) => <div key={concept.code} style={{border:'1px solid #e5ede6',padding:12,borderRadius:9,marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:800,color:'#23513b',marginBottom:5}}>{concept.code} · {concept.description}</div>
            <div className="helper" style={{marginBottom:10}}>{concept.beneficiary || 'Beneficiario general'} · {concept.calculation}</div>
            <div className="form-grid"><Field label="Porcentaje de retención"><input type="number" step="0.01" min="0" value={concept.ratePercent ?? ''} placeholder="Revisión manual" onChange={e => updateConcept(i,'ratePercent',e.target.value === '' ? null : numberValue(e.target.value))} /></Field><Field label="Base sujeta (%)"><input type="number" step="0.01" min="0" value={concept.taxableBasePercent ?? ''} placeholder="Revisión manual" onChange={e => updateConcept(i,'taxableBasePercent',e.target.value === '' ? null : numberValue(e.target.value))} /></Field></div>
          </div>) : <Empty icon={<SlidersHorizontal />} title="Sin conceptos cargados" description="El catálogo aparecerá cuando se prepare la configuración fiscal." />}
        </div></section>
      </div>
      <div className="settings-grid" style={{marginTop:16}}>
        <section className="panel"><div className="panel-head"><div><h3>Correlativos de comprobantes</h3><p>Una secuencia continua para IVA y otra para ISLR</p></div><ClipboardList size={18} color="#6b9e7a" /></div><div className="panel-body">
          <p className="helper" style={{marginBottom:12}}>Los números continúan entre meses. El comprobante muestra el mes de la retención como prefijo y el correlativo global a continuación.</p>
          {pendingSequences && <div className="sequence-warning" role="status"><strong>Correlativos no disponibles</strong><p>Falta inicializar los números de comprobante. Contacta al administrador antes de emitir.</p></div>}
          <div className="form-grid"><Field label="Próximo correlativo IVA"><input type="number" min="1" step="1" value={settingsDraft.certificateSequences.iva.nextNumber} onFocus={e => e.currentTarget.select()} onChange={e => setSettingsDraft(d => ({...d,certificateSequences:{...d.certificateSequences,iva:{...d.certificateSequences.iva,period,nextNumber:Number(e.target.value)}}}))} /><small className={sequences.iva.configured ? 'sequence-confirmed' : 'sequence-pending'}>{sequences.iva.configured ? `Próximo global: ${sequences.iva.nextNumber}` : `Inicialización pendiente · sugerido ${sequences.iva.suggestedNextNumber}`}</small></Field><Field label="Próximo correlativo ISLR"><input type="number" min="1" step="1" value={settingsDraft.certificateSequences.islr.nextNumber} onFocus={e => e.currentTarget.select()} onChange={e => setSettingsDraft(d => ({...d,certificateSequences:{...d.certificateSequences,islr:{...d.certificateSequences.islr,period,nextNumber:Number(e.target.value)}}}))} /><small className={sequences.islr.configured ? 'sequence-confirmed' : 'sequence-pending'}>{sequences.islr.configured ? `Próximo global: ${sequences.islr.nextNumber}` : `Inicialización pendiente · sugerido ${sequences.islr.suggestedNextNumber}`}</small></Field></div>
          <div className="catalog-actions"><button type="button" className="btn btn-primary btn-small" onClick={() => saveSettings(true)} disabled={busy}><Check />Guardar correlativos</button></div>
          <p className="helper" style={{marginTop:8}}>El ajuste manual cambia los próximos números globales; no hace falta repetirlo cada mes.</p>
          <p className="helper" style={{marginTop:12}}>La modificación afecta únicamente los próximos comprobantes; los ya emitidos conservan su número.</p>
        </div></section>
        {renderCatalogSettings('cecos','Centros de costo (CECO)','Catálogo para distribuir cada compra entre uno o varios centros.')}
      </div>
      <div style={{marginTop:16}}>{renderCatalogSettings('paymentAccounts','Cuentas de pago','Cuenta desde la que se pagó o abonó cada compra.')}</div>
      <div className="report-info"><strong>Historial fiscal:</strong> las reglas se actualizarán para operaciones futuras. Los comprobantes emitidos conservan sus importes y referencias originales.</div>
    </>;
  }

  function updateConcept(index: number, key: 'ratePercent' | 'taxableBasePercent', value: number | null) {
    setSettingsDraft(d => {
      const concept = d.islrConcepts[index];
      const overrides = { ...d.conceptOverrides, [concept.code]: { ...(d.conceptOverrides[concept.code] || {}), ...(value === null ? {} : { [key]: value }) } };
      if (value === null) delete overrides[concept.code][key];
      return { ...d, conceptOverrides: overrides, islrConcepts: d.islrConcepts.map((c, i) => i === index ? { ...c, [key]: value } : c) };
    });
  }

  function renderVendorDrawer() {
    return <aside className="drawer" role="dialog" aria-modal="true" aria-label={vendorDraft.id ? 'Editar proveedor' : 'Nuevo proveedor'}>
      <div className="drawer-head"><div><h2>{vendorDraft.id ? 'Editar proveedor' : 'Nuevo proveedor'}</h2><p>Datos fiscales y de contacto del proveedor</p></div><button className="drawer-close" aria-label="Cerrar" onClick={closeDrawer}><X /></button></div>
      <div className="drawer-body"><div className="form-grid"><Field label="RIF *"><input value={vendorDraft.rif} maxLength={10} onChange={e => updateVendor('rif',e.target.value.toUpperCase().replace(/[\s-]/g,''))} placeholder="J123456789" /></Field><Field label="Correlativo"><input value={vendorDraft.code || 'Automático'} readOnly /></Field><Field label="Razón social *" span2><input value={vendorDraft.name} onChange={e => updateVendor('name',e.target.value)} placeholder="Nombre fiscal del proveedor" /></Field><Field label="Dirección fiscal" span2><textarea value={vendorDraft.address || ''} onChange={e => updateVendor('address',e.target.value)} /></Field><Field label="Tipo de contribuyente"><select value={vendorDraft.taxpayerType} onChange={e => updateVendor('taxpayerType',e.target.value as Vendor['taxpayerType'])}><option value="especial">Especial</option><option value="ordinario">Ordinario</option><option value="formal">Formal</option></select></Field><Field label="Tipo de persona"><select value={vendorDraft.personType} onChange={e => changePersonType(e.target.value as Vendor['personType'])}><option value="juridica">Jurídica</option><option value="natural">Natural</option></select></Field><Field label="Residencia / domicilio"><select value={vendorDraft.residency} onChange={e => updateVendor('residency',e.target.value as Vendor['residency'])}>{vendorDraft.personType === 'juridica' ? <><option value="domiciliada">Jurídica domiciliada</option><option value="no_domiciliada">Jurídica no domiciliada</option></> : <><option value="residente">Natural residente</option><option value="no_residente">Natural no residente</option></>}</select></Field><Field label="Retención IVA sugerida"><select value={vendorDraft.ivaRetentionRate} onChange={e => updateVendor('ivaRetentionRate',Number(e.target.value) as 0 | 75 | 100)}><option value="0">0 %</option><option value="75">75 %</option><option value="100">100 %</option></select></Field><Field label="Correo electrónico"><input type="email" value={vendorDraft.email || ''} onChange={e => updateVendor('email',e.target.value)} placeholder="contacto@proveedor.com" /></Field><Field label="Teléfono"><input value={vendorDraft.phone || ''} onChange={e => updateVendor('phone',e.target.value)} /></Field></div>
      <div className="form-section-title" style={{ marginTop: 18 }}>Máquina fiscal</div>
      <label className="check-row"><input type="checkbox" checked={Boolean(vendorDraft.usesFiscalMachine)} onChange={e => updateVendor('usesFiscalMachine', e.target.checked)} /><span>Este proveedor usa máquina fiscal</span></label>
      {vendorDraft.usesFiscalMachine && <div className="report-info" style={{ marginTop: 10 }}>
        <strong>Números de máquina fiscal</strong>
        <p className="helper" style={{ margin: '6px 0 10px' }}>Puedes guardar varios números y elegirlos como número de control al registrar una compra.</p>
        <div className="inline-select">
          <div className="field" style={{ flex: 1 }}><input aria-label="Número de máquina fiscal" value={fiscalMachineInput} maxLength={80} onChange={e => setFiscalMachineInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addVendorFiscalMachine(); } }} placeholder="Escribe el número de máquina fiscal" /></div>
          <button type="button" className="btn btn-secondary btn-small" onClick={addVendorFiscalMachine}><Plus />Agregar</button>
        </div>
        {(vendorDraft.fiscalMachineNumbers || []).length > 0 && <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
          {(vendorDraft.fiscalMachineNumbers || []).map((number, index) => <div key={number + index} style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="mono">{number}</span>
            <button type="button" className="btn btn-plain btn-small" onClick={() => updateVendor('fiscalMachineNumbers', (vendorDraft.fiscalMachineNumbers || []).filter((_, position) => position !== index))}><X />Quitar</button>
          </div>)}
        </div>}
      </div>}
      {vendorDraft.sourceDate && <div className="report-info" style={{marginTop:16}}><strong>Origen de la ficha</strong><p style={{margin:'6px 0 0'}}>Último soporte: {dateText(vendorDraft.sourceDate)}{vendorDraft.sourcePdf ? ` · ${vendorDraft.sourcePdf.split(/[\\/]/).pop()}` : ''}</p>{vendorDraft.importReview && <p style={{margin:'6px 0 0'}}>{vendorDraft.importReview}</p>}</div>}
      <div style={{marginTop:18}}><label className="check-row"><input type="checkbox" checked={vendorDraft.active} onChange={e => updateVendor('active',e.target.checked)} /><span>Proveedor activo</span></label></div></div>
      <div className="drawer-footer"><div className="drawer-footer-left">{vendorDraft.id && can('vendors.manage') && <button className="btn btn-danger btn-small" onClick={deleteVendor} disabled={busy}><Trash2 />Eliminar</button>}</div><div className="drawer-footer-right"><button className="btn btn-secondary" onClick={closeDrawer} disabled={busy}>Cancelar</button>{can('vendors.manage') && <button className="btn btn-primary" onClick={saveVendor} disabled={busy}>{busy ? 'Guardando…' : 'Guardar proveedor'}</button>}</div></div>
    </aside>;
  }

  function renderDocumentDrawer() {
    const d = documentDraft;
    const frozen = d.status === 'void' || (d.status === 'issued' && !editingIssued) || (d.status === 'draft' && !can(d.id ? 'documents.edit' : 'documents.create'));
    const hasAssignedCertificates = d.status === 'issued';
    const periodChanged = d.period !== d.eventAt.slice(0, 7) || d.half !== (Number(d.eventAt.slice(-2)) <= 15 ? 1 : 2);
    const subtotalCents = Math.round(numberValue(d.exempt) * 100) + Math.round(numberValue(d.base16) * 100) + Math.round(numberValue(d.base8) * 100);
    const subtotal = subtotalCents / 100;
    const iva16 = Math.round(Math.round(numberValue(d.base16) * 100) * numberValue(settings.ivaGeneralRate) / 100) / 100;
    const iva8 = Math.round(Math.round(numberValue(d.base8) * 100) * numberValue(settings.ivaReducedRate) / 100) / 100;
    const total = subtotal + iva16 + iva8;
    const fullyExempt = numberValue(d.exempt) > 0 && numberValue(d.base16) === 0 && numberValue(d.base8) === 0;
    const retained = fullyExempt ? 0 : Math.round((iva16 + iva8) * numberValue(d.ivaRetentionRate) / 100 * 100) / 100;
    const igtfPreview = d.igtfApplies ? Math.round(Math.round(numberValue(d.igtfBase) * 100) * 3 / 100) / 100 : 0;
    const islrPeriod = d.eventAt.slice(0, 7);
    const selectedConcept = (settings.islrConcepts || []).find(concept => concept.code === d.islrConceptCode);
    const islrBaseCents = Math.round(numberValue(d.islrBase) * 100);
    const islrPreviewCents = !d.islrApplies || !selectedConcept ? 0 : d.islrManual
      ? Math.round(numberValue(d.islrAmount) * 100)
      : selectedConcept.calculation !== 'flat' || selectedConcept.ratePercent == null || selectedConcept.taxableBasePercent == null
        ? null
        : (() => {
          const taxable = Math.round(islrBaseCents * selectedConcept.taxableBasePercent! / 100);
          const gross = Math.round(taxable * selectedConcept.ratePercent! / 100);
          const ut = [...settings.unitTaxHistory].reverse().find(item => item.effectiveAt <= d.eventAt);
          if (selectedConcept.subtractionApplies && !ut) return null;
          const subtract = selectedConcept.subtractionApplies ? Math.round(ut!.value * 100 * selectedConcept.ratePercent! / 100 * 83.3334) : 0;
          return Math.max(0, gross - subtract);
        })();
    const islrWillRetain = d.type === 'factura' && d.islrApplies && (islrPreviewCents == null || islrPreviewCents > 0);
    const ivaSequence = documentSequencesByPeriod[d.period]?.iva ?? settings.certificateSequences.iva;
    const islrSequence = documentSequencesByPeriod[islrPeriod]?.islr ?? settings.certificateSequences.islr;
    const ivaCertificatePreview = !d.vendorId ? 'Selecciona proveedor' : ivaSequence?.configured
      ? certificatePreview(d.period, ivaSequence.nextNumber) : 'Cargando correlativo';
    const islrCertificatePreview = !d.vendorId ? 'Selecciona proveedor' : islrSequence?.configured
      ? certificatePreview(islrPeriod, islrSequence.nextNumber) : 'Cargando correlativo';
    const pendingKinds = d.status === 'issued' ? [] : [
      retained > 0 && !ivaSequence?.configured ? 'IVA' : null,
      islrWillRetain && !islrSequence?.configured ? 'ISLR' : null,
    ].filter((kind): kind is string => Boolean(kind));
    const originalOptions = documents.filter(x => x.type === 'factura' && x.vendorId === d.vendorId && x.status === 'issued');
    const cecoOptions = (settings.cecos || []).filter(item => item.active || (d.cecoAllocations || []).some(x => x.cecoId === item.id));
    const accountOptions = (settings.paymentAccounts || []).filter(item => item.active || d.paymentAccountId === item.id);
    const selectedVendor = vendorsById.get(d.vendorId);
    const beneficiary = nationalIslrBeneficiary(selectedVendor);
    const eligibleConcepts = (settings.islrConcepts || []).filter(concept => beneficiary && concept.beneficiary === beneficiary);
    const conceptOptions = hasAssignedCertificates && selectedConcept && !eligibleConcepts.some(concept => concept.code === selectedConcept.code)
      ? [...eligibleConcepts, selectedConcept] : eligibleConcepts;
    const allocationTotal = Math.round((d.cecoAllocations || []).reduce((sum, item) => sum + numberValue(item.percentage), 0) * 100) / 100;
    return <aside className="drawer" role="dialog" aria-modal="true" aria-label={d.id ? 'Documento de compra' : 'Nuevo documento'}>
      <div className="drawer-head"><div><h2>{d.id ? `${typeLabel(d.type)} Nº ${d.number}` : 'Nuevo documento'}</h2><p>{editingIssued ? 'Corrigiendo factura emitida · se conservan los correlativos' : d.id ? `Estado: ${statusLabel(d.status)}` : 'Registra una factura o una nota vinculada'}</p></div><button className="drawer-close" aria-label="Cerrar" onClick={closeDrawer}><X /></button></div>
      <div className="drawer-body"><fieldset disabled={frozen || busy} style={{border:0,padding:0,margin:0}}>
        {editingIssued && <div className="report-info" style={{marginBottom:16}}>Puedes corregir los datos de la factura emitida. Los comprobantes IVA e ISLR conservarán sus números. Si la corrección crea o elimina una retención, o cambia el mes de su comprobante, el sistema la rechazará.</div>}
        <div className="form-section-title">Identificación</div><div className="form-grid"><Field label="Tipo de documento"><select value={d.type} onChange={e => updateDocument('type',e.target.value as PurchaseDocument['type'])}><option value="factura">Factura</option><option value="nota_credito">Nota de crédito</option><option value="nota_debito">Nota de débito</option></select></Field><Field label="Proveedor *"><SearchableCombobox value={d.vendorId} options={vendors.filter(v => v.active || v.id === d.vendorId).map(v => ({value:v.id,label:v.name,detail:v.rif + (v.code ? ' · ' + v.code : ''),searchText:v.rif + ' ' + (v.code || '')}))} onChange={value => updateDocument('vendorId',value)} ariaLabel="Proveedor" placeholder="Escribe nombre, RIF o correlativo" emptyText="No se encontraron proveedores" disabled={frozen || busy} /></Field>{d.type !== 'factura' && <Field label="Factura afectada *" span2><select value={d.affectedDocumentId || ''} onChange={e => updateDocument('affectedDocumentId',e.target.value)}><option value="">Seleccionar factura</option>{originalOptions.map(x => <option key={x.id} value={x.id}>Nº {x.number} · {dateText(x.issuedAt)}</option>)}</select><small>Introduce importes positivos; la nota aplicará el ajuste correspondiente.</small></Field>}<Field label="Número de documento *"><input value={d.number} onChange={e => updateDocument('number',e.target.value)} /></Field><Field label="Número de control *">{selectedVendor?.usesFiscalMachine ? <><SearchableCombobox value={d.controlNumber} options={(selectedVendor.fiscalMachineNumbers || []).map(machine => ({value:machine,label:machine}))} onChange={value => updateDocument('controlNumber',value)} ariaLabel="Número de control" placeholder="Escribe o elige una máquina fiscal" emptyText="No hay máquinas registradas; escribe el número" allowCustom disabled={frozen || busy} /><small>Escribe otro número o elige una máquina fiscal registrada.</small></> : <input value={d.controlNumber} onChange={e => updateDocument('controlNumber',e.target.value)} />}</Field><Field label="Fecha de emisión"><input type="date" value={d.issuedAt} onChange={e => updateDocument('issuedAt',e.target.value)} /></Field><Field label="Pago o abono en cuenta"><input type="date" value={d.eventAt} onChange={e => updateDocument('eventAt',e.target.value)} /></Field><Field label="Mes a enterar"><input type="month" value={d.period} onChange={e => updateDocument('period',e.target.value)} /></Field><Field label="Quincena a enterar"><select value={d.half} onChange={e => updateDocument('half',Number(e.target.value) as 1 | 2)}><option value="1">Primera · 1 al 15</option><option value="2">Segunda · 16 al último</option></select></Field>{periodChanged && <Field label="Motivo del cambio de período *" span2><input value={d.periodOverrideReason || ''} onChange={e => updateDocument('periodOverrideReason',e.target.value)} placeholder="Explica por qué difieres la retención" /></Field>}</div>
        {d.status === 'draft' && <div className="report-info" style={{marginTop:14}}>
          <strong>Comprobantes previstos al emitir</strong>
          <div style={{display:'grid',gap:4,marginTop:8}}>
            <span>IVA: <strong className="mono">{retained > 0 ? ivaCertificatePreview : 'No aplica'}</strong></span>
            <span>ISLR: <strong className="mono">{islrWillRetain ? islrCertificatePreview : 'No aplica'}</strong></span>
            {d.igtfApplies && <span>IGTF (3 %): <strong>{money(igtfPreview)}</strong> sobre la base indicada abajo.</span>}
          </div>
          <small>Vista previa: el número se reserva al emitir y puede cambiar si otra persona emite primero. La emisión de la factura puede ser de otro mes; ISLR usa el mes real del pago o abono.</small>
        </div>}
        <div className="form-section-title">Conciliación y contabilización</div>
        <div className="form-grid">
          <Field label="Cuenta de pago *" span2>
            <div className="inline-select"><select value={d.paymentAccountId ?? ''} onChange={e => updateDocument('paymentAccountId', e.target.value ? Number(e.target.value) : null)}><option value="">Seleccionar cuenta</option>{accountOptions.map(account => <option key={account.id} value={account.id}>{account.code} · {account.name}{account.active ? '' : ' (inactiva)'}</option>)}</select>{can('catalogs.manage') && <button type="button" className="btn btn-secondary btn-small" onClick={() => startQuickAdd('paymentAccounts')}><Plus />Agregar</button>}</div>
            {quickAddForm('paymentAccounts')}
          </Field>
          <Field label="Descripción de la compra *" span2><textarea value={d.description || ''} maxLength={2000} onChange={e => updateDocument('description', e.target.value)} placeholder="Explica qué se compró, para qué área o proyecto y cualquier dato útil para conciliar y contabilizar." /><small>{d.description.trim().length} de 2.000 caracteres · mínimo 10</small></Field>
          <Field label="Distribución por CECO *" span2>
            <div className="allocation-list">{(d.cecoAllocations || []).map((allocation, index) => <div className="allocation-row" key={index}><select aria-label={`CECO ${index + 1}`} value={allocation.cecoId || ''} onChange={e => updateDocument('cecoAllocations', d.cecoAllocations.map((row, i) => i === index ? {...row, cecoId: Number(e.target.value)} : row))}><option value="">Seleccionar CECO</option>{cecoOptions.map(ceco => <option key={ceco.id} value={ceco.id}>{ceco.code} · {ceco.name}{ceco.active ? '' : ' (inactivo)'}</option>)}</select><input type="number" aria-label={`Porcentaje CECO ${index + 1}`} min="0" max="100" step="0.01" value={allocation.percentage} onChange={e => updateDocument('cecoAllocations', d.cecoAllocations.map((row, i) => i === index ? {...row, percentage: numberValue(e.target.value)} : row))} /><span className="allocation-percent">%</span>{d.cecoAllocations.length > 1 && <button type="button" className="btn btn-icon" aria-label={`Quitar CECO ${index + 1}`} onClick={() => updateDocument('cecoAllocations', d.cecoAllocations.filter((_, i) => i !== index))}><Trash2 /></button>}</div>)}</div>
            <div className="catalog-actions"><button type="button" className="btn btn-secondary btn-small" onClick={() => updateDocument('cecoAllocations', [...(d.cecoAllocations || []), {cecoId: 0, percentage: d.cecoAllocations?.length ? 0 : 100}])}><Plus />Añadir CECO a la distribución</button>{can('catalogs.manage') && <button type="button" className="btn btn-plain btn-small" onClick={() => startQuickAdd('cecos')}><Plus />Crear CECO</button>}</div>
            {quickAddForm('cecos')}
            <small className={Math.abs(allocationTotal - 100) < 0.001 ? 'allocation-valid' : 'allocation-invalid'}>Total asignado: {allocationTotal.toLocaleString('es-VE', { maximumFractionDigits: 2 })} % · debe sumar 100 %</small>
          </Field>
        </div>        <div className="form-section-title">Montos e IVA</div><div className="form-grid"><Field label="Monto exento"><MoneyInput value={numberValue(d.exempt)} onChange={value => updateDocument('exempt',value)} onValidityChange={valid => setMoneyErrors(errors => ({...errors,exempt:!valid}))} aria-label="Monto exento" /></Field><Field label="Base imponible 16 %"><MoneyInput value={numberValue(d.base16)} onChange={value => updateDocument('base16',value)} onValidityChange={valid => setMoneyErrors(errors => ({...errors,base16:!valid}))} aria-label="Base imponible 16 por ciento" /></Field><Field label="Base imponible 8 %"><MoneyInput value={numberValue(d.base8)} onChange={value => updateDocument('base8',value)} onValidityChange={valid => setMoneyErrors(errors => ({...errors,base8:!valid}))} aria-label="Base imponible 8 por ciento" /></Field><Field label="Retención de IVA"><select value={fullyExempt ? 0 : d.ivaRetentionRate} disabled={fullyExempt} onChange={e => updateDocument('ivaRetentionRate',Number(e.target.value) as 0 | 75 | 100)}><option value="0">0 %</option><option value="75">75 %</option><option value="100">100 %</option></select></Field>{fullyExempt && <div className="report-info" style={{gridColumn:'1 / -1'}}>Operación 100 % exenta: no se emite comprobante ni correlativo de retención de IVA.</div>}{!fullyExempt && (d.ivaRetentionRate === 0 || d.ivaRetentionRate === 100) && <Field label={`Motivo de retención ${d.ivaRetentionRate} % *`} span2><input value={d.ivaRetentionReason || ''} onChange={e => updateDocument('ivaRetentionReason',e.target.value)} placeholder="Indica la exclusión o supuesto aplicable" /></Field>}</div>
        <div className="form-section-title">Otros tributos</div><div style={{display:'grid',gap:10}}><label className="check-row"><input type="checkbox" checked={d.igtfApplies} onChange={e => updateDocument('igtfApplies',e.target.checked)} /><span>Aplica IGTF</span><small>Calcula 3 % de su base</small></label>{d.igtfApplies && <div className="form-grid"><Field label="Base imponible IGTF"><MoneyInput value={numberValue(d.igtfBase)} onChange={value => updateDocument('igtfBase',value)} onValidityChange={valid => setMoneyErrors(errors => ({...errors,igtfBase:!valid}))} aria-label="Base imponible IGTF" /></Field></div>}<label className="check-row"><input type="checkbox" checked={d.islrApplies} onChange={e => updateDocument('islrApplies',e.target.checked)} /><span>Aplica retención ISLR</span><small>Sobre subtotal o porción</small></label>{d.islrApplies && <div className="form-grid"><Field label="Concepto de retención" span2><SearchableCombobox value={d.islrConceptCode || ''} options={conceptOptions.map(c => ({value:c.code,label:c.code + ' · ' + c.description + (c.ratePercent == null ? ' · alícuota por revisar' : ' · ' + c.ratePercent + ' %'),searchText:c.code + ' ' + c.description}))} onChange={value => updateDocument('islrConceptCode',value)} ariaLabel="Concepto de retención ISLR" placeholder={!selectedVendor ? 'Selecciona primero un proveedor' : !beneficiary ? 'Sin conceptos nacionales aplicables' : 'Escribe para buscar concepto'} emptyText="No se encontraron conceptos aplicables" disabled={!beneficiary || frozen || busy} />{!beneficiary && <small>Solo se muestran conceptos para persona natural residente o jurídica domiciliada.</small>}</Field><Field label="Base de retención ISLR"><MoneyInput value={numberValue(d.islrBase)} onChange={value => updateDocument('islrBase',value)} onValidityChange={valid => setMoneyErrors(errors => ({...errors,islrBase:!valid}))} aria-label="Base retención ISLR" /><small>Por defecto, subtotal antes de IVA.</small></Field></div>}{d.islrApplies && <label className="check-row"><input type="checkbox" checked={Boolean(d.islrManual)} onChange={e => updateDocument('islrManual',e.target.checked)} /><span>Cálculo manual verificado</span><small>Para conceptos que requieren revisión</small></label>}{d.islrApplies && d.islrManual && <div className="form-grid"><Field label="Porcentaje ISLR"><input type="number" step="0.01" min="0" value={d.islrRate || 0} onChange={e => updateDocument('islrRate',numberValue(e.target.value))} /></Field><Field label="Sustraendo (Bs.)"><MoneyInput value={numberValue(d.islrSubtraction)} onChange={value => updateDocument('islrSubtraction',value)} onValidityChange={valid => setMoneyErrors(errors => ({...errors,islrSubtraction:!valid}))} aria-label="Sustraendo ISLR" /></Field><Field label="Monto retenido (Bs.)"><MoneyInput value={numberValue(d.islrAmount)} onChange={value => updateDocument('islrAmount',value)} onValidityChange={valid => setMoneyErrors(errors => ({...errors,islrAmount:!valid}))} aria-label="Monto retenido ISLR" /></Field><Field label="Motivo del cálculo manual *" span2><input value={d.islrManualReason || ''} onChange={e => updateDocument('islrManualReason',e.target.value)} /></Field></div>}</div>
      </fieldset>{editingIssued && <div className="form-grid" style={{marginTop:16}}><Field label="Motivo de la corrección *" span2><textarea value={correctionReason} maxLength={500} onChange={event => setCorrectionReason(event.target.value)} placeholder="Describe el error encontrado y por qué corriges esta factura." /><small>{correctionReason.trim().length} de 500 caracteres · mínimo 10</small></Field></div>}<div className="preview-box"><h4>Resumen del documento</h4><div className="preview-row"><span>Subtotal</span><strong>{money(frozen ? d.subtotal : subtotal)}</strong></div><div className="preview-row"><span>IVA 16 %</span><strong>{money(frozen ? d.iva16 : iva16)}</strong></div><div className="preview-row"><span>IVA 8 %</span><strong>{money(frozen ? d.iva8 : iva8)}</strong></div><div className="preview-row"><span>IVA retenido</span><strong>{money(frozen ? d.ivaRetentionAmount : retained)}</strong></div>{d.islrApplies && <div className="preview-row"><span>ISLR retenido</span><strong>{frozen ? money(d.islrAmount) : islrPreviewCents == null ? 'Pendiente de cálculo' : money(islrPreviewCents / 100)}</strong></div>}
        {d.igtfApplies && <div className="preview-row"><span>IGTF · 3 % sobre {money(d.igtfBase)}</span><strong>{money(frozen ? d.igtfAmount : igtfPreview)}</strong></div>}
        {(hasAssignedCertificates ? Boolean(d.ivaCertificateNumber) : retained > 0) && <div className="preview-row"><span>Comprobante IVA {hasAssignedCertificates ? 'asignado' : 'previsto'}</span><strong className="mono">{hasAssignedCertificates ? d.ivaCertificateNumber : ivaCertificatePreview}</strong></div>}
        {(hasAssignedCertificates ? Boolean(d.islrCertificateNumber) : islrWillRetain) && <div className="preview-row"><span>Comprobante ISLR {hasAssignedCertificates ? 'asignado' : 'previsto'}</span><strong className="mono">{hasAssignedCertificates ? d.islrCertificateNumber : islrCertificatePreview}</strong></div>}
        {d.status === 'draft' && (retained > 0 || islrWillRetain) && <small>Los números se asignan al emitir; pueden cambiar si otra persona emite antes.</small>}
        <div className="preview-row total"><span>Total facturado</span><strong>{money(frozen ? d.total : total)}</strong></div>
        {(d.type === 'factura' || frozen) && <div className="preview-row total"><span>Neto a pagar (incluye IGTF)</span><strong>{frozen ? money(d.netPayable) : islrPreviewCents == null ? 'Pendiente de cálculo ISLR' : money(total + igtfPreview - retained - islrPreviewCents / 100)}</strong></div>}</div>
      {!frozen && pendingKinds.length > 0 && <div className="sequence-warning document-sequence-warning" role="status"><strong>Correlativos no disponibles</strong><p>Falta inicializar {pendingKinds.join(' e ')}. Contacta al administrador; puedes guardar el borrador mientras tanto.</p></div>}
      {d.id && <div className="report-info" style={{marginTop:16}}><strong>Soporte de la compra</strong><div style={{marginTop:8,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>{d.hasAttachment && <a className="btn btn-secondary btn-small" href={`/api/documents/${d.id}/attachment`} target="_blank" rel="noreferrer"><FileText />Ver {d.attachmentName || 'soporte'}</a>}{d.status === 'draft' && <><label className="btn btn-secondary btn-small" style={{cursor:'pointer'}}><Plus />{d.hasAttachment ? 'Reemplazar' : 'Adjuntar archivo'}<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" hidden onChange={e => { const file = e.target.files?.[0]; if (file) uploadAttachment(file); e.target.value = ''; }} /></label>{d.hasAttachment && <button className="btn btn-danger btn-small" onClick={deleteAttachment} disabled={busy}>Quitar</button>}</>}</div><div className="helper" style={{marginTop:7}}>PDF o imagen, hasta 10 MB. Guarda el borrador antes de adjuntar.</div></div>}
      {d.id && d.status === 'issued' && d.historicalImport && <div className="report-info" style={{marginTop:17}}>Documento importado: conserva los comprobantes PDF originales. La plataforma guarda sus números y montos, pero no recrea los comprobantes históricos.</div>}
      {d.id && d.status === 'issued' && !d.historicalImport && <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:17}}>{d.ivaCertificateNumber && <button className="btn btn-secondary btn-small" onClick={() => getFile(`/api/documents/${d.id}/iva-pdf`,`UPCO_IVA_${d.ivaCertificateNumber}.pdf`)}><ArrowDownToLine />Comprobante IVA</button>}{d.islrCertificateNumber && <button className="btn btn-secondary btn-small" onClick={() => getFile(`/api/documents/${d.id}/islr-pdf`,`UPCO_ISLR_${d.islrCertificateNumber}.pdf`)}><ArrowDownToLine />Comprobante ISLR</button>}</div>}
      </div><div className="drawer-footer"><div className="drawer-footer-left">{d.id && can('documents.delete') && <button type="button" className="btn btn-danger btn-small" onClick={() => removeDocument(d)} disabled={busy}><Trash2 />Eliminar documento</button>}{d.id && can('documents.delete') && d.status === 'issued' && !editingIssued && <button type="button" className="btn btn-secondary btn-small" onClick={() => voidDocument(d)} disabled={busy}>Anular</button>}{d.id && can('documents.create') && d.status === 'issued' && d.type === 'factura' && !editingIssued && <button className="btn btn-secondary btn-small" onClick={() => openCreditNote(d)} disabled={busy}><FilePlus2 />Crear nota de crédito</button>}</div><div className="drawer-footer-right"><button className="btn btn-secondary" onClick={editingIssued ? () => openDocument(documents.find(item => item.id === d.id)) : closeDrawer} disabled={busy}>{editingIssued ? 'Cancelar edición' : 'Cerrar'}</button>{can('documents.edit') && d.status === 'issued' && d.type === 'factura' && !d.historicalImport && !editingIssued && <button className="btn btn-secondary" onClick={() => setEditingIssued(true)} disabled={busy}><Pencil />Editar factura</button>}{editingIssued && <button className="btn btn-primary" onClick={() => saveDocument(false)} disabled={busy}>{busy ? 'Guardando…' : 'Guardar corrección'}</button>}{d.status === 'draft' && can(d.id ? 'documents.edit' : 'documents.create') && <><button className="btn btn-secondary" onClick={() => saveDocument(false)} disabled={busy}>Guardar borrador</button>{can('documents.issue') && <button className="btn btn-primary" onClick={() => saveDocument(true)} disabled={busy || pendingKinds.length > 0} title={pendingKinds.length ? 'Correlativos no disponibles' : undefined}>Emitir</button>}</>}</div></div>
    </aside>;
  }
}

function Kpi({label,value,note,icon}:{label:string;value:string;note:string;icon:React.ReactNode}) { return <div className="kpi"><div className="kpi-top"><span className="kpi-label">{label}</span><span className="kpi-icon">{icon}</span></div><div className="kpi-value mono">{value}</div><div className="kpi-note">{note}</div></div>; }
function Empty({icon,title,description,action}:{icon:React.ReactNode;title:string;description:string;action?:React.ReactNode}) { return <div className="empty"><div className="empty-icon">{icon}</div><strong>{title}</strong><p>{description}</p>{action}</div>; }
function Field({label,span2,children}:{label:string;span2?:boolean;children:React.ReactNode}) { return <div className={`field ${span2 ? 'span2' : ''}`}><label>{label}</label>{children}</div>; }
function ReportCard({color,icon,title,description,button,onClick,disabled}:{color:string;icon:React.ReactNode;title:string;description:string;button:string;onClick:()=>void;disabled:boolean}) { return <div className="report-card"><div className={`report-icon ${color}`}>{icon}</div><h3>{title}</h3><p>{description}</p><button className="btn btn-secondary" onClick={onClick} disabled={disabled}><ArrowDownToLine />{button}</button></div>; }

