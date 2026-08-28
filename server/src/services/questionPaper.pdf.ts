import { jsPDF } from 'jspdf';

interface PdfPaper {
  id: string;
  title: string;
  subject_name: string;
  subject_code: string;
  class_name: string;
  duration_minutes: number | null;
  instructions: string | null;
  total_marks: number;
}

interface PdfItem {
  sort_order: number;
  marks: number;
  question_text: string;
  question_type: string;
  options: string[] | null;
}

export interface QuestionPaperPdfInput {
  paper: PdfPaper;
  items: PdfItem[];
  school: { name: string; academic_year: string };
}

export async function renderQuestionPaperPdf(input: QuestionPaperPdfInput): Promise<Uint8Array> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 18;
  const maxY = pageHeight - 22;
  let y = margin;

  // Header — school name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(input.school.name, pageWidth / 2, y, { align: 'center' });
  y += 6;

  if (input.school.academic_year) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Academic Year ${input.school.academic_year}`, pageWidth / 2, y, { align: 'center' });
    y += 6;
  }

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(input.paper.title, pageWidth / 2, y, { align: 'center' });
  y += 5;

  // Subject / class / duration
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const subtitle = [
    `${input.paper.subject_code} — ${input.paper.subject_name}`,
    input.paper.class_name,
    input.paper.duration_minutes ? `${input.paper.duration_minutes} minutes` : null,
    `Total: ${input.paper.total_marks} marks`,
  ].filter(Boolean).join('   ·   ');
  doc.text(subtitle, pageWidth / 2, y, { align: 'center' });
  y += 4;

  // Divider
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Instructions
  if (input.paper.instructions) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(input.paper.instructions, pageWidth - margin * 2);
    for (const line of lines) {
      if (y > maxY) { doc.addPage(); y = margin; }
      doc.text(line, margin, y);
      y += 4;
    }
    y += 2;
  }

  // Questions
  for (const item of input.items) {
    if (y > maxY - 14) { doc.addPage(); y = margin; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const header = `Q${item.sort_order}.`;
    doc.text(header, margin, y);

    const questionLines = doc.splitTextToSize(item.question_text, pageWidth - margin * 2 - 14);
    doc.setFont('helvetica', 'normal');
    for (const line of questionLines) {
      if (y > maxY) { doc.addPage(); y = margin; }
      doc.text(line, margin + 12, y);
      y += 4.5;
    }

    // MCQ options
    if (item.question_type === 'mcq' && Array.isArray(item.options)) {
      doc.setFont('helvetica', 'normal');
      for (const opt of item.options) {
        if (y > maxY) { doc.addPage(); y = margin; }
        const optLines = doc.splitTextToSize(opt, pageWidth - margin * 2 - 18);
        for (const line of optLines) {
          doc.text(line, margin + 16, y);
          y += 4.2;
        }
      }
    }

    // Marks on the right
    doc.setFont('helvetica', 'bold');
    doc.text(`[${item.marks}]`, pageWidth - margin, y - 4.5, { align: 'right' });

    y += 3;
  }

  return doc.output('arraybuffer') as unknown as Uint8Array;
}
