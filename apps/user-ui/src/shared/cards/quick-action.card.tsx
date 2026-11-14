import React from "react";
import Link from 'next/link';

const QuickActionCard = ({ Icon, title, description, href }: { Icon: React.ElementType; title: string; description: string; href: string }) => {
  return (
    <Link href={href} className="bg-white p-4 rounded-md shadow-sm border border-gray-100 flex items-start gap-4 hover:border-blue-400 focus-visible:outline-blue-500">
      <Icon className="w-6 h-6 text-blue-500 mt-1" />
      <div className="flex-1">
        <h4 className="text-sm font-semibold text-gray-800 mb-1">{title}</h4>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </Link>
  );
};

export default QuickActionCard;
