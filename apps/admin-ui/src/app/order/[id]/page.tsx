'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AdminShell from '../../../shared/admin-shell';
import { OrderInspector } from '../../../shared/work-management';
export default function Page() { const { id } = useParams<{id: string}>(); return <AdminShell><div className="admin-page"><Link className="text-blue-400" href="/dashboard/orders">← Orders</Link><OrderInspector id={id} /></div></AdminShell>; }
