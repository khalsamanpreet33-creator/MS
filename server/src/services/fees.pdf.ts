import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export function renderReceiptPdf(args: {
  payment: Record<string, unknown>;
  allocations: { amount: number; invoice_no: string; period_label: string }[];
  settings: Record<string, string>;
}): Buffer {
  const doc = new jsPDF({ unit: 'pt', format: 'a5' });
  const w = doc.internal.pageSize.getWidth();
  const p = args.payment;
  const s = args.settings;
  const fmt = (n: unknown) => `${s['currency.symbol'] ?? '₹'}${(Number(n) || 0).toLocaleString('en-IN')}`;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(s['school.name'] ?? 'School', w / 2, 40, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(s['school.address'] ?? '', w / 2, 56, { align: 'center' });
  doc.text(`${s['school.phone'] ?? ''}  ${s['school.email'] ?? ''}`, w / 2, 70, { align: 'center' });

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('FEE RECEIPT', w / 2, 100, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  let y = 130;
  const row = (label: string, value: string) => {
    doc.text(label, 36, y);
    doc.text(value, 160, y);
    y += 16;
  };
  row('Receipt No', String(p.receipt_no ?? ''));
  row('Date', String(p.payment_date ?? ''));
  row('Student', `${p.first_name ?? ''} ${p.last_name ?? ''}`);
  row('Admission No', String(p.admission_no ?? ''));
  row('Class', `${p.class_name ?? '-'} / ${p.section_name ?? '-'}`);
  row('Guardian', String(p.guardian_name ?? '-'));
  row('Phone', String(p.guardian_phone ?? '-'));
  row('Mode', String((p.payment_mode ?? '').toString().toUpperCase()));
  row('Reference', String(p.reference ?? '-'));

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Amount', 36, y);
  doc.text(fmt(p.amount), w - 36, y, { align: 'right' });
  y += 14;

  if (args.allocations.length) {
    autoTable(doc, {
      startY: y + 6,
      head: [['Invoice', 'Period', 'Amount']],
      body: args.allocations.map((a) => [
        a.invoice_no,
        a.period_label,
        fmt(a.amount),
      ]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [12, 76, 179] },
      columnStyles: { 2: { halign: 'right' } },
      margin: { left: 36, right: 36 },
    });
  }

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text('This is a computer-generated receipt.', w / 2, doc.internal.pageSize.getHeight() - 30, {
    align: 'center',
  });

  return Buffer.from(doc.output('arraybuffer'));
}