import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Boxes, Package, Truck, ArrowUp, ArrowDown, Settings as SettingsIcon, Edit2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Input, Select, Table, Badge,
  useToasts, EmptyState, Modal, FormField, Textarea,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth';
import { formatDateTime, formatMoney } from '../../lib/format';

interface Item {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
  unit: 'pcs' | 'box' | 'kg' | 'litre' | 'meter' | 'set' | 'pack';
  min_stock: number;
  current_stock: number;
  unit_cost: number;
  location: string | null;
  status: 'active' | 'archived';
}

interface Vendor {
  id: string; name: string; phone: string | null; email: string | null;
  address: string | null; gstin: string | null; status: 'active' | 'inactive';
}

interface Movement {
  id: string; item_id: string; item_name: string; sku: string;
  movement_type: 'in' | 'out' | 'adjust'; quantity: number; unit_cost: number | null;
  reference: string | null; vendor_name: string | null; notes: string | null;
  created_at: string; creator_name: string | null;
}

interface PO {
  id: string; po_number: string; vendor_id: string; vendor_name: string | null;
  status: 'draft' | 'placed' | 'partial' | 'received' | 'cancelled';
  total_amount: number; notes: string | null; expected_date: string | null;
  created_at: string;
}

interface Category { id: string; name: string }

type Tab = 'items' | 'movements' | 'vendors' | 'purchase-orders';

export default function Inventory() {
  const qc = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPerm('inventory.write'));
  const { show, node } = useToasts();
  const [tab, setTab] = useState<Tab>('items');

  const [itemOpen, setItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemForm, setItemForm] = useState({
    sku: '', name: '', description: '', category_id: '',
    unit: 'pcs' as Item['unit'], min_stock: 0, unit_cost: 0,
    location: '', status: 'active' as Item['status'],
  });

  const [mvOpen, setMvOpen] = useState(false);
  const [mvForm, setMvForm] = useState({
    item_id: '', movement_type: 'in' as Movement['movement_type'],
    quantity: 0, unit_cost: 0, reference: '', vendor_id: '', notes: '',
  });

  const [vendorOpen, setVendorOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [vendorForm, setVendorForm] = useState({ name: '', phone: '', email: '', address: '', gstin: '', status: 'active' as Vendor['status'] });

  const [search, setSearch] = useState('');
  const { data: items = { items: [] as Item[] }, isLoading: iLoading } = useQuery<{ items: Item[] }>({
    queryKey: ['inv-items', search],
    queryFn: () => api.get(`/inventory/items?q=${encodeURIComponent(search)}`),
  });
  const { data: vendors = { items: [] as Vendor[] } } = useQuery<{ items: Vendor[] }>({
    queryKey: ['inv-vendors'], queryFn: () => api.get('/inventory/vendors'),
  });
  const { data: cats = { items: [] as Category[] } } = useQuery<{ items: Category[] }>({
    queryKey: ['inv-cats'], queryFn: () => api.get('/inventory/categories'),
  });
  const { data: movements = { items: [] as Movement[] }, isLoading: mLoading } = useQuery<{ items: Movement[] }>({
    queryKey: ['inv-movements'], queryFn: () => api.get('/inventory/movements?limit=200'),
  });
  const { data: pos = { items: [] as PO[] } } = useQuery<{ items: PO[] }>({
    queryKey: ['inv-pos'], queryFn: () => api.get('/inventory/purchase-orders'),
  });

  // Items
  const openItem = (i?: Item) => {
    if (i) {
      setEditingItem(i);
      setItemForm({
        sku: i.sku, name: i.name, description: i.description ?? '',
        category_id: i.category_id ?? '', unit: i.unit,
        min_stock: i.min_stock, unit_cost: i.unit_cost,
        location: i.location ?? '', status: i.status,
      });
    } else {
      setEditingItem(null);
      setItemForm({ sku: '', name: '', description: '', category_id: '', unit: 'pcs', min_stock: 0, unit_cost: 0, location: '', status: 'active' });
    }
    setItemOpen(true);
  };

  const saveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        sku: itemForm.sku, name: itemForm.name,
        description: itemForm.description || null,
        category_id: itemForm.category_id || null,
        unit: itemForm.unit, min_stock: Number(itemForm.min_stock),
        unit_cost: Number(itemForm.unit_cost),
        location: itemForm.location || null, status: itemForm.status,
      };
      if (editingItem) {
        await api.patch(`/inventory/items/${editingItem.id}`, payload);
        show('Item updated', 'success');
      } else {
        await api.post('/inventory/items', payload);
        show('Item added', 'success');
      }
      setItemOpen(false);
      qc.invalidateQueries({ queryKey: ['inv-items'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const removeItem = async (i: Item) => {
    if (!confirm(`Delete item ${i.name}?`)) return;
    try {
      await api.delete(`/inventory/items/${i.id}`);
      show('Item deleted', 'success');
      qc.invalidateQueries({ queryKey: ['inv-items'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  // Movement
  const openMv = () => {
    setMvForm({ item_id: '', movement_type: 'in', quantity: 0, unit_cost: 0, reference: '', vendor_id: '', notes: '' });
    setMvOpen(true);
  };

  const saveMv = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        item_id: mvForm.item_id, movement_type: mvForm.movement_type,
        quantity: Number(mvForm.quantity),
        unit_cost: mvForm.unit_cost > 0 ? Number(mvForm.unit_cost) : undefined,
        reference: mvForm.reference || null,
        vendor_id: mvForm.vendor_id || null,
        notes: mvForm.notes || null,
      };
      await api.post('/inventory/movements', payload);
      show('Stock movement recorded', 'success');
      setMvOpen(false);
      qc.invalidateQueries({ queryKey: ['inv-movements'] });
      qc.invalidateQueries({ queryKey: ['inv-items'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  // Vendor
  const openVendor = (v?: Vendor) => {
    if (v) {
      setEditingVendor(v);
      setVendorForm({
        name: v.name, phone: v.phone ?? '', email: v.email ?? '',
        address: v.address ?? '', gstin: v.gstin ?? '', status: v.status,
      });
    } else {
      setEditingVendor(null);
      setVendorForm({ name: '', phone: '', email: '', address: '', gstin: '', status: 'active' });
    }
    setVendorOpen(true);
  };

  const saveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: vendorForm.name, phone: vendorForm.phone || null,
        email: vendorForm.email || null, address: vendorForm.address || null,
        gstin: vendorForm.gstin || null, status: vendorForm.status,
      };
      if (editingVendor) {
        await api.patch(`/inventory/vendors/${editingVendor.id}`, payload);
        show('Vendor updated', 'success');
      } else {
        await api.post('/inventory/vendors', payload);
        show('Vendor added', 'success');
      }
      setVendorOpen(false);
      qc.invalidateQueries({ queryKey: ['inv-vendors'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  return (
    <div>
      {node}
      <PageHeader
        title="Inventory"
        description={`${items.items.length} item(s) · ${vendors.items.length} vendor(s)`}
        actions={
          canWrite && (
            <>
              <Button variant="secondary" onClick={() => openVendor()}><Plus className="w-4 h-4" /> Vendor</Button>
              <Button variant="secondary" onClick={() => openItem()}><Plus className="w-4 h-4" /> Item</Button>
              <Button onClick={() => openMv()} disabled={items.items.length === 0}><SettingsIcon className="w-4 h-4" /> Stock Movement</Button>
            </>
          )
        }
      />

      <div className="border-b border-slate-200 mb-4">
        <nav className="flex gap-1">
          <TabBtn active={tab === 'items'} onClick={() => setTab('items')} icon={Package} label="Items" count={items.items.length} />
          <TabBtn active={tab === 'movements'} onClick={() => setTab('movements')} icon={Boxes} label="Movements" count={movements.items.length} />
          <TabBtn active={tab === 'vendors'} onClick={() => setTab('vendors')} icon={Truck} label="Vendors" count={vendors.items.length} />
          <TabBtn active={tab === 'purchase-orders'} onClick={() => setTab('purchase-orders')} icon={ArrowUp} label="POs" count={pos.items.length} />
        </nav>
      </div>

      {tab === 'items' && (
        <>
          <div className="mb-4 max-w-md">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or SKU..." />
          </div>
          <Card>
            {iLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> :
              items.items.length === 0 ? <EmptyState title="No items" description="Add an inventory item." /> :
              <Table>
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3">Unit Cost</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.items.map((i) => {
                    const low = i.current_stock <= i.min_stock;
                    return (
                      <tr key={i.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-mono">{i.sku}</td>
                        <td className="px-4 py-3 text-sm font-medium">{i.name}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={low ? 'text-red-600 font-medium' : ''}>{i.current_stock}</span>
                          <span className="text-slate-400"> {i.unit} (min {i.min_stock})</span>
                          {low && <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-700">Low</span>}
                        </td>
                        <td className="px-4 py-3 text-sm">{formatMoney(i.unit_cost)}</td>
                        <td className="px-4 py-3 text-sm">{i.category_name ?? '-'}</td>
                        <td className="px-4 py-3 text-right">
                          {canWrite && (
                            <>
                              <button onClick={() => openItem(i)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded"><Edit2 className="w-4 h-4" /></button>
                              <button onClick={() => removeItem(i)} className="text-red-600 hover:bg-red-50 p-1.5 rounded ml-1"><Trash2 className="w-4 h-4" /></button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            }
          </Card>
        </>
      )}

      {tab === 'movements' && (
        <Card>
          {mLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> :
            movements.items.length === 0 ? <EmptyState title="No movements" description="Record a stock movement." /> :
            <Table>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Reference</th>
                </tr>
              </thead>
              <tbody>
                {movements.items.map((m) => (
                  <tr key={m.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-sm">{formatDateTime(m.created_at)}</td>
                    <td className="px-4 py-3 text-sm"><div className="font-medium">{m.item_name}</div><div className="text-xs text-slate-500 font-mono">{m.sku}</div></td>
                    <td className="px-4 py-3">
                      <Badge variant={m.movement_type === 'in' ? 'success' : m.movement_type === 'out' ? 'warning' : 'default'}>
                        {m.movement_type === 'in' && <ArrowUp className="w-3 h-3 inline mr-1" />}
                        {m.movement_type === 'out' && <ArrowDown className="w-3 h-3 inline mr-1" />}
                        {m.movement_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">{m.quantity}</td>
                    <td className="px-4 py-3 text-sm">{m.vendor_name ?? '-'}</td>
                    <td className="px-4 py-3 text-sm">{m.reference ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          }
        </Card>
      )}

      {tab === 'vendors' && (
        <Card>
          {vendors.items.length === 0 ? <EmptyState title="No vendors" description="Add a vendor." /> :
            <Table>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">GSTIN</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {vendors.items.map((v) => (
                  <tr key={v.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium">{v.name}</td>
                    <td className="px-4 py-3 text-sm">{v.phone ?? '-'}</td>
                    <td className="px-4 py-3 text-sm">{v.email ?? '-'}</td>
                    <td className="px-4 py-3 text-sm font-mono">{v.gstin ?? '-'}</td>
                    <td className="px-4 py-3"><Badge variant={v.status === 'active' ? 'success' : 'default'}>{v.status}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      {canWrite && (
                        <button onClick={() => openVendor(v)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded"><Edit2 className="w-4 h-4" /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          }
        </Card>
      )}

      {tab === 'purchase-orders' && (
        <Card>
          {pos.items.length === 0 ? <EmptyState title="No POs" description="Create a purchase order." /> :
            <Table>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <th className="px-4 py-3">PO #</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Expected</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {pos.items.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-sm font-mono">{p.po_number}</td>
                    <td className="px-4 py-3 text-sm">{p.vendor_name}</td>
                    <td className="px-4 py-3 text-sm">{formatMoney(p.total_amount)}</td>
                    <td className="px-4 py-3"><Badge variant={p.status === 'received' ? 'success' : p.status === 'cancelled' ? 'danger' : 'info'}>{p.status}</Badge></td>
                    <td className="px-4 py-3 text-sm">{p.expected_date ?? '-'}</td>
                    <td className="px-4 py-3 text-sm">{formatDateTime(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          }
        </Card>
      )}

      {/* Item modal */}
      <Modal open={itemOpen} onClose={() => setItemOpen(false)} title={editingItem ? 'Edit Item' : 'New Item'} size="lg">
        <form onSubmit={saveItem} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="SKU" required><Input value={itemForm.sku} onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })} required maxLength={60} /></FormField>
            <FormField label="Name" required><Input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} required maxLength={200} /></FormField>
            <FormField label="Unit">
              <Select value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value as Item['unit'] })}>
                <option value="pcs">Pieces</option><option value="box">Box</option><option value="kg">Kg</option>
                <option value="litre">Litre</option><option value="meter">Meter</option><option value="set">Set</option><option value="pack">Pack</option>
              </Select>
            </FormField>
            <FormField label="Category">
              <Select value={itemForm.category_id} onChange={(e) => setItemForm({ ...itemForm, category_id: e.target.value })}>
                <option value="">— None —</option>
                {cats.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Min Stock"><Input type="number" min={0} step="0.01" value={itemForm.min_stock} onChange={(e) => setItemForm({ ...itemForm, min_stock: Number(e.target.value) })} /></FormField>
            <FormField label="Unit Cost"><Input type="number" min={0} step="0.01" value={itemForm.unit_cost} onChange={(e) => setItemForm({ ...itemForm, unit_cost: Number(e.target.value) })} /></FormField>
            <FormField label="Location"><Input value={itemForm.location} onChange={(e) => setItemForm({ ...itemForm, location: e.target.value })} maxLength={60} /></FormField>
            <FormField label="Status">
              <Select value={itemForm.status} onChange={(e) => setItemForm({ ...itemForm, status: e.target.value as Item['status'] })}>
                <option value="active">Active</option><option value="archived">Archived</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Description"><Textarea value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} maxLength={2000} rows={2} /></FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setItemOpen(false)}>Cancel</Button>
            <Button type="submit">{editingItem ? 'Update' : 'Add'}</Button>
          </div>
        </form>
      </Modal>

      {/* Movement modal */}
      <Modal open={mvOpen} onClose={() => setMvOpen(false)} title="Stock Movement">
        <form onSubmit={saveMv} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Item" required>
              <Select value={mvForm.item_id} onChange={(e) => setMvForm({ ...mvForm, item_id: e.target.value })} required>
                <option value="">Select item...</option>
                {items.items.map((i) => <option key={i.id} value={i.id}>{i.name} (stock: {i.current_stock})</option>)}
              </Select>
            </FormField>
            <FormField label="Type" required>
              <Select value={mvForm.movement_type} onChange={(e) => setMvForm({ ...mvForm, movement_type: e.target.value as Movement['movement_type'] })}>
                <option value="in">In (+)</option>
                <option value="out">Out (-)</option>
                <option value="adjust">Adjust (set)</option>
              </Select>
            </FormField>
            <FormField label="Quantity" required><Input type="number" min={0.01} step="0.01" value={mvForm.quantity} onChange={(e) => setMvForm({ ...mvForm, quantity: Number(e.target.value) })} required /></FormField>
            <FormField label="Unit Cost"><Input type="number" min={0} step="0.01" value={mvForm.unit_cost} onChange={(e) => setMvForm({ ...mvForm, unit_cost: Number(e.target.value) })} /></FormField>
            <FormField label="Vendor"><Select value={mvForm.vendor_id} onChange={(e) => setMvForm({ ...mvForm, vendor_id: e.target.value })}><option value="">— None —</option>{vendors.items.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></FormField>
            <FormField label="Reference"><Input value={mvForm.reference} onChange={(e) => setMvForm({ ...mvForm, reference: e.target.value })} maxLength={120} /></FormField>
          </div>
          <FormField label="Notes"><Textarea value={mvForm.notes} onChange={(e) => setMvForm({ ...mvForm, notes: e.target.value })} maxLength={500} rows={2} /></FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setMvOpen(false)}>Cancel</Button>
            <Button type="submit">Record</Button>
          </div>
        </form>
      </Modal>

      {/* Vendor modal */}
      <Modal open={vendorOpen} onClose={() => setVendorOpen(false)} title={editingVendor ? 'Edit Vendor' : 'New Vendor'} size="lg">
        <form onSubmit={saveVendor} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Name" required><Input value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} required maxLength={200} /></FormField>
            <FormField label="Phone"><Input value={vendorForm.phone} onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })} maxLength={40} /></FormField>
            <FormField label="Email"><Input type="email" value={vendorForm.email} onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })} /></FormField>
            <FormField label="GSTIN"><Input value={vendorForm.gstin} onChange={(e) => setVendorForm({ ...vendorForm, gstin: e.target.value })} maxLength={20} /></FormField>
            <FormField label="Status">
              <Select value={vendorForm.status} onChange={(e) => setVendorForm({ ...vendorForm, status: e.target.value as Vendor['status'] })}>
                <option value="active">Active</option><option value="inactive">Inactive</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Address"><Textarea value={vendorForm.address} onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })} maxLength={500} rows={2} /></FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setVendorOpen(false)}>Cancel</Button>
            <Button type="submit">{editingVendor ? 'Update' : 'Add'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label, count }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string; count: number }) {
  return (
    <button onClick={onClick} className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-2 ${active ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
      <Icon className="w-4 h-4" />
      {label} ({count})
    </button>
  );
}
