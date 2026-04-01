import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Dashboard from '@/pages/Dashboard';

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p>Loading...</p></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return <Dashboard />;
};

export default Index;
