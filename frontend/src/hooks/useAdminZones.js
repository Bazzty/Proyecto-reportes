import { useEffect, useState } from 'react';
import api from '../services/api';

// Zonas para el filtro del panel de administración. Si la petición falla la lista queda vacía y
// la pantalla funciona igual, solo sin esos chips.
export default function useAdminZones() {
  const [zones, setZones] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api.get('/admin/zones')
      .then((res) => { if (!cancelled && Array.isArray(res.data)) setZones(res.data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return zones;
}
