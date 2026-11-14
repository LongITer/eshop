'use client';

import { useEffect, useRef, useState } from 'react';
import axios from '@/utils/axioInstance';
import { useStore } from '@/store';
import { parsePcSelections, PcSelection } from '@packages/utils/pc-build-selection';

const endpoint = '/product/api/pc-builder/saved';

export default function useSavedPcBuild(ownerId: string | null, onOpen: (parts: PcSelection[]) => Promise<void>) {
  const [busy, setBusy] = useState(!!ownerId);
  const [revision, setRevision] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState(false);
  const [hasDeviceBuild, setHasDeviceBuild] = useState(false);
  const active = useRef(true);
  const working = useRef(false);
  const storageKey = `saved-pc-build:${ownerId || 'guest'}`;
  const current = () => active.current && useStore.getState().ownerId === ownerId;
  const readDevice = () => parsePcSelections(JSON.parse(localStorage.getItem(storageKey) || '[]'));

  useEffect(() => {
    active.current = true;
    let canceled = false;
    const controller = new AbortController();
    try { setHasDeviceBuild(readDevice().length > 0); } catch { setHasDeviceBuild(false); }
    if (ownerId) {
      axios.get(endpoint, { params: { ownerId }, signal: controller.signal }).then(({ data }) => {
        if (!canceled && current()) setRevision(data.revision);
      }).catch(() => {
        if (!canceled && current()) setMessage('Cannot load your saved PC build. Open saved build to retry.');
      }).finally(() => {
        if (!canceled && current()) setBusy(false);
      });
    }
    return () => { canceled = true; active.current = false; controller.abort(); };
  }, [ownerId]);

  async function open(fromDevice = false) {
    if (working.current || !current()) return;
    working.current = true; setBusy(true); setMessage('');
    try {
      let parts: PcSelection[];
      if (ownerId && !fromDevice) {
        const { data } = await axios.get(endpoint, { params: { ownerId } });
        if (!current()) return;
        parts = parsePcSelections(data.parts);
        setRevision(data.revision); setConflict(false);
      } else {
        parts = readDevice();
      }
      if (!parts.length) {
        // An explicit choice to use the account version must also apply an empty version.
        if (ownerId && !fromDevice) await onOpen([]);
        if (current()) setMessage('No saved PC build yet.');
        return;
      }
      await onOpen(parts);
      if (current()) setMessage(fromDevice && ownerId
        ? 'Opened the device build. Save it to your account to use it on other devices.'
        : 'Opened saved build. Prices, stock and compatibility are checked again.');
    } catch {
      if (current()) setMessage('Cannot open the saved PC build. Please try again.');
    } finally {
      working.current = false;
      if (current()) setBusy(false);
    }
  }

  async function save(value: PcSelection[], replace = false) {
    if (working.current || !current() || (ownerId && revision === null)) return;
    working.current = true; setBusy(true); setMessage('');
    try {
      const parts = parsePcSelections(value);
      if (!parts.length) return;
      if (!ownerId) {
        localStorage.setItem(storageKey, JSON.stringify(parts));
        setHasDeviceBuild(true); setMessage('Saved PC build on this device. Sign in to save across devices.');
      } else {
        let expectedRevision = revision;
        if (replace) {
          const { data } = await axios.get(endpoint, { params: { ownerId } });
          if (!current()) return;
          expectedRevision = data.revision;
        }
        const { data } = await axios.put(endpoint, { ownerId, revision: expectedRevision, parts });
        if (!current()) return;
        setRevision(data.revision); setConflict(false); setMessage('Saved PC build to your account. You can open it on another device.');
      }
    } catch (error: any) {
      if (current()) {
        const changed = error.response?.status === 409;
        setConflict(changed);
        setMessage(changed ? 'Your saved PC build changed on another device. Choose which build to keep.' : 'Cannot save the PC build. Your current selections have been kept.');
      }
    } finally {
      working.current = false;
      if (current()) setBusy(false);
    }
  }

  const clearMessage = () => { if (!conflict) setMessage(''); };
  return { busy, conflict, message, hasDeviceBuild, canSave: !busy && (!ownerId || revision !== null) && !conflict, open, save, clearMessage };
}
