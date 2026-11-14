import React from 'react';
import SellerShell from '../../shared/components/seller-shell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <SellerShell>{children}</SellerShell>;
}
