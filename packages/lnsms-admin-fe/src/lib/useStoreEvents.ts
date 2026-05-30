'use client';

import { useEffect, useRef } from 'react';
import { storeWsClient, type StoreWsHandlers } from './storeWsClient';

export function useStoreEvents(userid: string, storeId: string, handlers: StoreWsHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!userid || !storeId) return;
    return storeWsClient.subscribe(userid, storeId, {
      onChanged: (evt) => handlersRef.current.onChanged?.(evt),
      onUploadDone: (msg) => handlersRef.current.onUploadDone?.(msg),
    });
  }, [userid, storeId]);
}
