import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const { user, loading } = useAuth();
  const [tripId, setTripId] = useState<string | null>(null);
  const [checkingTrip, setCheckingTrip] = useState(true);

  useEffect(() => {
    if (!user) {
      setTripId(null);
      setCheckingTrip(false);
      return;
    }

    const resolveDefaultTrip = async () => {
      const { data } = await supabase
        .from('trips')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1);

      setTripId(data?.[0]?.id || null);
      setCheckingTrip(false);
    };

    setCheckingTrip(true);
    resolveDefaultTrip();
  }, [user]);

  if (loading || checkingTrip) {
    return <div className="flex min-h-screen items-center justify-center"><p>Loading...</p></div>;
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (tripId) return <Navigate to={`/trip/${tripId}`} replace />;

  return <Navigate to="/dashboard" replace />;
};

export default Index;
