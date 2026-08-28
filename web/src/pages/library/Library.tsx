import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, BookOpen, Edit2, BookMarked, RotateCcw } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Input, Select, Table, Badge,
  useToasts, EmptyState, Modal, FormField, Textarea,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth';
import { formatDate, formatMoney } from '../../lib/format';

interface Book {
  id: string;
  accession_no: string;
  isbn: string | null;
  title: string;
  author: string;
  publisher: string | null;
  category_id: string | null;
  category_name: string | null;
  total_copies: number;
  available_copies: number;
  shelf_location: string | null;
  status: 'available' | 'archived' | 'lost';
}

interface Category { id: string; name: string; code: string | null }
interface Issue {
  id: string;
  book_id: string;
  book_title: string;
  accession_no: string;
  borrower_type: 'student' | 'staff';
  borrower_id: string;
  borrower_name: string;
  issued_at: string;
  due_at: string;
  returned_at: string | null;
  status: 'issued' | 'returned' | 'overdue' | 'lost';
  fine_amount: number;
}

type Tab = 'books' | 'issues';

export default function Library() {
  const qc = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPerm('library.write'));
  const { show, node } = useToasts();
  const [tab, setTab] = useState<Tab>('books');

  const [bookOpen, setBookOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [bookForm, setBookForm] = useState({
    accession_no: '', isbn: '', title: '', author: '', publisher: '',
    category_id: '', total_copies: 1, shelf_location: '', status: 'available' as Book['status'],
  });

  const [issueOpen, setIssueOpen] = useState(false);
  const [issueForm, setIssueForm] = useState({
    book_id: '', borrower_type: 'student' as Issue['borrower_type'],
    borrower_id: '', borrower_name: '', due_at: '',
  });

  const [search, setSearch] = useState('');
  const { data: books = { items: [] as Book[] }, isLoading: bLoading } = useQuery<{ items: Book[] }>({
    queryKey: ['library-books', search],
    queryFn: () => api.get(`/library/books?q=${encodeURIComponent(search)}`),
  });
  const { data: cats = { items: [] as Category[] } } = useQuery<{ items: Category[] }>({
    queryKey: ['library-cats'], queryFn: () => api.get('/library/categories'),
  });
  const { data: issues = { items: [] as Issue[] }, isLoading: iLoading } = useQuery<{ items: Issue[] }>({
    queryKey: ['library-issues'],
    queryFn: () => api.get('/library/issues'),
  });

  const openBook = (b?: Book) => {
    if (b) {
      setEditingBook(b);
      setBookForm({
        accession_no: b.accession_no, isbn: b.isbn ?? '', title: b.title, author: b.author,
        publisher: b.publisher ?? '', category_id: b.category_id ?? '',
        total_copies: b.total_copies, shelf_location: b.shelf_location ?? '',
        status: b.status,
      });
    } else {
      setEditingBook(null);
      setBookForm({
        accession_no: '', isbn: '', title: '', author: '', publisher: '',
        category_id: '', total_copies: 1, shelf_location: '', status: 'available',
      });
    }
    setBookOpen(true);
  };

  const saveBook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        accession_no: bookForm.accession_no, isbn: bookForm.isbn || null,
        title: bookForm.title, author: bookForm.author,
        publisher: bookForm.publisher || null, category_id: bookForm.category_id || null,
        total_copies: Number(bookForm.total_copies),
        shelf_location: bookForm.shelf_location || null, status: bookForm.status,
      };
      if (editingBook) {
        await api.patch(`/library/books/${editingBook.id}`, payload);
        show('Book updated', 'success');
      } else {
        await api.post('/library/books', payload);
        show('Book added', 'success');
      }
      setBookOpen(false);
      qc.invalidateQueries({ queryKey: ['library-books'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const removeBook = async (b: Book) => {
    if (!confirm(`Delete book "${b.title}"?`)) return;
    try {
      await api.delete(`/library/books/${b.id}`);
      show('Book deleted', 'success');
      qc.invalidateQueries({ queryKey: ['library-books'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const openIssue = () => {
    setIssueForm({ book_id: '', borrower_type: 'student', borrower_id: '', borrower_name: '', due_at: '' });
    setIssueOpen(true);
  };

  const issueBook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/library/issues', issueForm);
      show('Book issued', 'success');
      setIssueOpen(false);
      qc.invalidateQueries({ queryKey: ['library-issues'] });
      qc.invalidateQueries({ queryKey: ['library-books'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const returnBook = async (i: Issue) => {
    const fineStr = prompt('Fine amount (₹, blank for none):', '0');
    if (fineStr === null) return;
    const fine = Number(fineStr) || 0;
    try {
      await api.post(`/library/issues/${i.id}/return`, {
        fine_amount: fine, fine_reason: 'overdue',
      });
      show(fine > 0 ? `Returned with ₹${fine} fine` : 'Book returned', 'success');
      qc.invalidateQueries({ queryKey: ['library-issues'] });
      qc.invalidateQueries({ queryKey: ['library-books'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  return (
    <div>
      {node}
      <PageHeader
        title="Library"
        description={`${books.items.length} book(s) · ${issues.items.filter((i) => i.status === 'issued').length} active issue(s)`}
        actions={
          canWrite && (
            <>
              <Button variant="secondary" onClick={() => openBook()}><Plus className="w-4 h-4" /> Add Book</Button>
              <Button onClick={openIssue} disabled={books.items.length === 0}><BookMarked className="w-4 h-4" /> Issue Book</Button>
            </>
          )
        }
      />

      <div className="border-b border-slate-200 mb-4">
        <nav className="flex gap-1">
          <TabBtn active={tab === 'books'} onClick={() => setTab('books')} icon={BookOpen} label="Books" count={books.items.length} />
          <TabBtn active={tab === 'issues'} onClick={() => setTab('issues')} icon={BookMarked} label="Issues" count={issues.items.length} />
        </nav>
      </div>

      {tab === 'books' && (
        <>
          <div className="mb-4 max-w-md">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title, author, accession no..." />
          </div>
          <Card>
            {bLoading ? (
              <div className="p-8 text-center text-slate-400">Loading...</div>
            ) : books.items.length === 0 ? (
              <EmptyState title="No books" description="Add a book to get started." />
            ) : (
              <Table>
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                    <th className="px-4 py-3">Acc No</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Author</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Avail / Total</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {books.items.map((b) => (
                    <tr key={b.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-mono">{b.accession_no}</td>
                      <td className="px-4 py-3 text-sm font-medium">{b.title}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{b.author}</td>
                      <td className="px-4 py-3 text-sm">{b.category_name ?? '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={b.available_copies === 0 ? 'text-red-600 font-medium' : ''}>{b.available_copies}</span>
                        <span className="text-slate-400"> / {b.total_copies}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={b.status === 'available' ? 'success' : b.status === 'lost' ? 'danger' : 'default'}>
                          {b.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canWrite && (
                          <>
                            <button onClick={() => openBook(b)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => removeBook(b)} className="text-red-600 hover:bg-red-50 p-1.5 rounded ml-1">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </>
      )}

      {tab === 'issues' && (
        <Card>
          {iLoading ? (
            <div className="p-8 text-center text-slate-400">Loading...</div>
          ) : issues.items.length === 0 ? (
            <EmptyState title="No issues" description="Issue a book to a student or staff." />
          ) : (
            <Table>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <th className="px-4 py-3">Book</th>
                  <th className="px-4 py-3">Borrower</th>
                  <th className="px-4 py-3">Issued</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Fine</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {issues.items.map((i) => (
                  <tr key={i.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium">{i.book_title}</div>
                      <div className="text-xs text-slate-500 font-mono">{i.accession_no}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>{i.borrower_name}</div>
                      <div className="text-xs text-slate-500">{i.borrower_type}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">{formatDate(i.issued_at)}</td>
                    <td className="px-4 py-3 text-sm">{formatDate(i.due_at)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={
                        i.status === 'returned' ? 'success' :
                        i.status === 'overdue' ? 'danger' :
                        i.status === 'lost' ? 'danger' : 'info'
                      }>{i.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">{i.fine_amount > 0 ? formatMoney(i.fine_amount) : '-'}</td>
                    <td className="px-4 py-3 text-right">
                      {canWrite && (i.status === 'issued' || i.status === 'overdue') && (
                        <button onClick={() => returnBook(i)} className="text-green-600 hover:bg-green-50 p-1.5 rounded" title="Return">
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {/* Book modal */}
      <Modal open={bookOpen} onClose={() => setBookOpen(false)} title={editingBook ? 'Edit Book' : 'Add Book'} size="lg">
        <form onSubmit={saveBook} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Accession No" required>
              <Input value={bookForm.accession_no} onChange={(e) => setBookForm({ ...bookForm, accession_no: e.target.value })} required maxLength={40} />
            </FormField>
            <FormField label="ISBN">
              <Input value={bookForm.isbn} onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })} maxLength={40} />
            </FormField>
            <FormField label="Title" required>
              <Input value={bookForm.title} onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })} required maxLength={300} />
            </FormField>
            <FormField label="Author" required>
              <Input value={bookForm.author} onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })} required maxLength={200} />
            </FormField>
            <FormField label="Publisher">
              <Input value={bookForm.publisher} onChange={(e) => setBookForm({ ...bookForm, publisher: e.target.value })} maxLength={200} />
            </FormField>
            <FormField label="Category">
              <Select value={bookForm.category_id} onChange={(e) => setBookForm({ ...bookForm, category_id: e.target.value })}>
                <option value="">— None —</option>
                {cats.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Total Copies">
              <Input type="number" min={1} value={bookForm.total_copies} onChange={(e) => setBookForm({ ...bookForm, total_copies: Number(e.target.value) })} />
            </FormField>
            <FormField label="Shelf Location">
              <Input value={bookForm.shelf_location} onChange={(e) => setBookForm({ ...bookForm, shelf_location: e.target.value })} maxLength={60} />
            </FormField>
            <FormField label="Status">
              <Select value={bookForm.status} onChange={(e) => setBookForm({ ...bookForm, status: e.target.value as Book['status'] })}>
                <option value="available">Available</option>
                <option value="archived">Archived</option>
                <option value="lost">Lost</option>
              </Select>
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setBookOpen(false)}>Cancel</Button>
            <Button type="submit">{editingBook ? 'Update' : 'Add'}</Button>
          </div>
        </form>
      </Modal>

      {/* Issue modal */}
      <Modal open={issueOpen} onClose={() => setIssueOpen(false)} title="Issue Book">
        <form onSubmit={issueBook} className="space-y-3">
          <FormField label="Book" required>
            <Select value={issueForm.book_id} onChange={(e) => setIssueForm({ ...issueForm, book_id: e.target.value })} required>
              <option value="">Select book...</option>
              {books.items.filter((b) => b.available_copies > 0 && b.status === 'available').map((b) => (
                <option key={b.id} value={b.id}>{b.title} ({b.accession_no}) — {b.available_copies} avail</option>
              ))}
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Borrower Type" required>
              <Select value={issueForm.borrower_type} onChange={(e) => setIssueForm({ ...issueForm, borrower_type: e.target.value as Issue['borrower_type'] })}>
                <option value="student">Student</option>
                <option value="staff">Staff</option>
              </Select>
            </FormField>
            <FormField label="Due Date" required>
              <Input type="date" value={issueForm.due_at} onChange={(e) => setIssueForm({ ...issueForm, due_at: e.target.value })} required />
            </FormField>
          </div>
          <FormField label="Borrower ID">
            <Input value={issueForm.borrower_id} onChange={(e) => setIssueForm({ ...issueForm, borrower_id: e.target.value })} required />
          </FormField>
          <FormField label="Borrower Name" required>
            <Input value={issueForm.borrower_name} onChange={(e) => setIssueForm({ ...issueForm, borrower_name: e.target.value })} required maxLength={160} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setIssueOpen(false)}>Cancel</Button>
            <Button type="submit">Issue</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label, count }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-2 ${active ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
    >
      <Icon className="w-4 h-4" />
      {label} ({count})
    </button>
  );
}
