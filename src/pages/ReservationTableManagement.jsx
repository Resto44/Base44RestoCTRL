import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Calendar, Clock, Users, Plus, CheckCircle2, X, Phone,
  ChefHat, Utensils, Grid3x3, List, Edit, Trash2, Bell
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';

const TABLE_STATUS = {
  available:  { label: 'Available',  color: 'bg-emerald-100 border-emerald-300 text-emerald-700' },
  occupied:   { label: 'Occupied',   color: 'bg-red-100 border-red-300 text-red-700' },
  reserved:   { label: 'Reserved',   color: 'bg-amber-100 border-amber-300 text-amber-700' },
  cleaning:   { label: 'Cleaning',   color: 'bg-blue-100 border-blue-300 text-blue-700' },
};

const INITIAL_TABLES = [
  { id: 't1', number: 1, capacity: 2, status: 'available', section: 'Indoor' },
  { id: 't2', number: 2, capacity: 4, status: 'occupied',  section: 'Indoor', guest: 'Smith Family', time: '7:30 PM' },
  { id: 't3', number: 3, capacity: 4, status: 'reserved',  section: 'Indoor', guest: 'Johnson', time: '8:00 PM' },
  { id: 't4', number: 4, capacity: 6, status: 'available', section: 'Indoor' },
  { id: 't5', number: 5, capacity: 2, status: 'cleaning',  section: 'Outdoor' },
  { id: 't6', number: 6, capacity: 4, status: 'available', section: 'Outdoor' },
  { id: 't7', number: 7, capacity: 8, status: 'occupied',  section: 'Private', guest: 'Corporate Event', time: '6:00 PM' },
  { id: 't8', number: 8, capacity: 4, status: 'available', section: 'Outdoor' },
];

const INITIAL_RESERVATIONS = [
  { id: 'r1', name: 'Alice Johnson', phone: '+1 555-0101', guests: 4, date: format(new Date(), 'yyyy-MM-dd'), time: '7:00 PM', table: 3, status: 'confirmed', notes: 'Birthday celebration' },
  { id: 'r2', name: 'Bob Smith', phone: '+1 555-0102', guests: 2, date: format(addDays(new Date(), 1), 'yyyy-MM-dd'), time: '8:00 PM', table: null, status: 'pending', notes: '' },
  { id: 'r3', name: 'Carol White', phone: '+1 555-0103', guests: 6, date: format(addDays(new Date(), 2), 'yyyy-MM-dd'), time: '7:30 PM', table: null, status: 'confirmed', notes: 'Anniversary dinner' },
];

function TableGrid({ tables, onTableClick }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {tables.map(table => {
        const cfg = TABLE_STATUS[table.status] || TABLE_STATUS.available;
        return (
          <button
            key={table.id}
            onClick={() => onTableClick(table)}
            className={`p-3 rounded-xl border-2 ${cfg.color} transition-all active:scale-95 text-left`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold">T{table.number}</span>
              <Users className="w-3.5 h-3.5 opacity-60" />
            </div>
            <p className="text-[11px] font-medium">{table.capacity} seats</p>
            <p className="text-[10px] opacity-70">{cfg.label}</p>
            {table.guest && <p className="text-[10px] font-medium mt-0.5 truncate">{table.guest}</p>}
          </button>
        );
      })}
    </div>
  );
}

function ReservationCard({ reservation, onEdit, onDelete }) {
  const statusColors = {
    confirmed: 'bg-emerald-100 text-emerald-700',
    pending:   'bg-amber-100 text-amber-700',
    cancelled: 'bg-red-100 text-red-700',
    seated:    'bg-blue-100 text-blue-700',
  };
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold">{reservation.name}</p>
              <Badge className={`text-[10px] h-4 px-1 ${statusColors[reservation.status] || statusColors.pending}`}>
                {reservation.status}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" />{reservation.date}</span>
              <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{reservation.time}</span>
              <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />{reservation.guests}</span>
            </div>
            {reservation.notes && <p className="text-xs text-muted-foreground mt-1 italic">{reservation.notes}</p>}
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={() => onEdit(reservation)} className="p-1 text-muted-foreground hover:text-foreground">
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDelete(reservation.id)} className="p-1 text-muted-foreground hover:text-red-500">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReservationTableManagement() {
  const { t } = useLanguage();
  const [tab, setTab] = useState('tables');
  const [tables, setTables] = useState(INITIAL_TABLES);
  const [reservations, setReservations] = useState(INITIAL_RESERVATIONS);
  const [selectedTable, setSelectedTable] = useState(null);
  const [showAddReservation, setShowAddReservation] = useState(false);
  const [newReservation, setNewReservation] = useState({ name: '', phone: '', guests: 2, date: format(new Date(), 'yyyy-MM-dd'), time: '7:00 PM', notes: '' });

  const sections = [...new Set(tables.map(t => t.section))];
  const [activeSection, setActiveSection] = useState('All');

  const filteredTables = activeSection === 'All' ? tables : tables.filter(t => t.section === activeSection);

  const stats = {
    available: tables.filter(t => t.status === 'available').length,
    occupied: tables.filter(t => t.status === 'occupied').length,
    reserved: tables.filter(t => t.status === 'reserved').length,
    total: tables.length,
  };

  const handleTableClick = (table) => {
    setSelectedTable(table);
  };

  const handleStatusChange = (tableId, newStatus) => {
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, status: newStatus } : t));
    setSelectedTable(null);
    toast.success(`Table status updated to ${newStatus}`);
  };

  const handleAddReservation = () => {
    const res = {
      id: `r${Date.now()}`,
      ...newReservation,
      status: 'confirmed',
      table: null,
    };
    setReservations(prev => [...prev, res]);
    setShowAddReservation(false);
    setNewReservation({ name: '', phone: '', guests: 2, date: format(new Date(), 'yyyy-MM-dd'), time: '7:00 PM', notes: '' });
    toast.success('Reservation added!');
  };

  const handleDeleteReservation = (id) => {
    setReservations(prev => prev.filter(r => r.id !== id));
    toast.success('Reservation deleted');
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-xl font-bold">{t('reservations')}</h1>
          <p className="text-xs text-muted-foreground">{stats.available}/{stats.total} tables available</p>
        </div>
        <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => setShowAddReservation(true)}>
          <Plus className="w-3 h-3" /> Reserve
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Available', value: stats.available, color: 'bg-emerald-50 text-emerald-700' },
          { label: 'Occupied', value: stats.occupied, color: 'bg-red-50 text-red-700' },
          { label: 'Reserved', value: stats.reserved, color: 'bg-amber-50 text-amber-700' },
          { label: 'Total', value: stats.total, color: 'bg-blue-50 text-blue-700' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-2 text-center ${s.color}`}>
            <p className="text-lg font-bold">{s.value}</p>
            <p className="text-[10px] font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full grid grid-cols-3 h-9">
          <TabsTrigger value="tables" className="text-xs">{t('table_management')}</TabsTrigger>
          <TabsTrigger value="reservations" className="text-xs">{t('reservations')}</TabsTrigger>
          <TabsTrigger value="waitlist" className="text-xs">Waitlist</TabsTrigger>
        </TabsList>

        {/* Tables Tab */}
        <TabsContent value="tables" className="mt-3 space-y-3">
          {/* Section filter */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {['All', ...sections].map(s => (
              <button
                key={s}
                onClick={() => setActiveSection(s)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  activeSection === s ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <TableGrid tables={filteredTables} onTableClick={handleTableClick} />
        </TabsContent>

        {/* Reservations Tab */}
        <TabsContent value="reservations" className="mt-3 space-y-2">
          {reservations.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{t('no_data')}</p>
            </div>
          ) : (
            reservations.map(r => (
              <ReservationCard key={r.id} reservation={r} onEdit={() => {}} onDelete={handleDeleteReservation} />
            ))
          )}
        </TabsContent>

        {/* Waitlist Tab */}
        <TabsContent value="waitlist" className="mt-3">
          <div className="text-center py-10 text-muted-foreground">
            <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Waitlist is empty</p>
            <p className="text-xs mt-1">Customers will appear here when tables are full</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Table Status Modal */}
      <Dialog open={!!selectedTable} onOpenChange={() => setSelectedTable(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Table {selectedTable?.number} — {selectedTable?.capacity} seats</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Current status: <strong>{selectedTable?.status}</strong></p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(TABLE_STATUS).map(([status, cfg]) => (
                <Button
                  key={status}
                  variant="outline"
                  className={`h-10 text-xs ${selectedTable?.status === status ? 'border-primary bg-primary/5' : ''}`}
                  onClick={() => handleStatusChange(selectedTable.id, status)}
                >
                  {cfg.label}
                </Button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Reservation Modal */}
      <Dialog open={showAddReservation} onOpenChange={setShowAddReservation}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Reservation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Guest Name</Label>
              <Input value={newReservation.name} onChange={e => setNewReservation(p => ({ ...p, name: e.target.value }))} className="mt-1 h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input value={newReservation.phone} onChange={e => setNewReservation(p => ({ ...p, phone: e.target.value }))} className="mt-1 h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Date</Label>
                <Input type="date" value={newReservation.date} onChange={e => setNewReservation(p => ({ ...p, date: e.target.value }))} className="mt-1 h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Time</Label>
                <Input value={newReservation.time} onChange={e => setNewReservation(p => ({ ...p, time: e.target.value }))} className="mt-1 h-9 text-sm" placeholder="7:00 PM" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Guests</Label>
              <Input type="number" value={newReservation.guests} onChange={e => setNewReservation(p => ({ ...p, guests: parseInt(e.target.value) || 1 }))} className="mt-1 h-9 text-sm" min={1} max={20} />
            </div>
            <div>
              <Label className="text-xs">Notes (optional)</Label>
              <Input value={newReservation.notes} onChange={e => setNewReservation(p => ({ ...p, notes: e.target.value }))} className="mt-1 h-9 text-sm" placeholder="Special requests..." />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowAddReservation(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleAddReservation} disabled={!newReservation.name}>Confirm</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
