import { useEffect, useState } from 'react';
import { getNotifications, getUnreadCount, subscribe } from '../services/notifications';

export default function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      if (!active) return;
      setNotifications(await getNotifications());
      setUnreadCount(await getUnreadCount());
    };

    refresh();
    const unsubscribe = subscribe(refresh);

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { notifications, unreadCount };
}
