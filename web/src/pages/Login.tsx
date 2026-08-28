import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { Button, Input, FormField, Card, useToasts } from '../components/ui';
import { GraduationCap } from 'lucide-react';

export default function Login() {
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const { show, node } = useToasts();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [loading, setLoading] = useState(false);

  if (token) return <Navigate to="/dashboard" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: Parameters<typeof setAuth>[1] }>('/auth/login', {
        username,
        password,
      });
      setAuth(res.token, res.user);
      navigate('/dashboard');
    } catch (e) {
      const err = e as ApiError;
      show(err.message === 'invalid_credentials' ? 'Invalid username or password' : err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-100 flex items-center justify-center p-4">
      {node}
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-blue-700 to-blue-500 text-white flex items-center justify-center shadow-lg">
            <GraduationCap className="w-7 h-7" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">School ERP</h1>
          <p className="text-sm text-slate-500">Sign in to your school's central system</p>
        </div>
        <Card className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <FormField label="Username" required>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
              />
            </FormField>
            <FormField label="Password" required>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </FormField>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
          <div className="mt-5 pt-4 border-t border-slate-100 text-xs text-slate-500">
            <div className="font-medium text-slate-700 mb-1">Demo accounts</div>
            <ul className="space-y-0.5">
              <li><code>admin</code> / <code>admin</code> — full access</li>
              <li><code>reception</code> / <code>reception</code> — students + attendance + fees</li>
              <li><code>teacher1</code> / <code>teacher</code> — attendance read/write</li>
              <li><code>accountant</code> / <code>accountant</code> — fees only</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}