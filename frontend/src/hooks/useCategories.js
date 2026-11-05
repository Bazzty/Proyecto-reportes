import { useEffect, useState } from 'react';
import api from '../services/api';

// Si la petición falla la lista queda vacía. onError debe ser estable (definido fuera del componente).
export default function useCategories(onError) {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api.get('/categories')
      .then((res) => { if (!cancelled && Array.isArray(res.data)) setCategories(res.data); })
      .catch(() => { if (!cancelled) onError?.(); });
    return () => { cancelled = true; };
  }, [onError]);

  return categories;
}
