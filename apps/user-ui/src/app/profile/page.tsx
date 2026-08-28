"use client";
import useUser from "@/hooks/useUser";
import StatCard from "@/shared/cards/stat.card";
import { CheckCircle, Clock, Loader2, Truck, User } from "lucide-react";
import React, { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

const page = () => {
  const { user, isLoading } = useUser();

  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const queryTab = searchParams.get("active") || "Profile";
  const [activeTab, setActiveTab] = useState(queryTab);
  return (
    <div className="bg-gray-50 p-6 pb-14">
      <div className="md:max-w-7xl mx-auto">
        {/* Greeting */}
        <div className="text-center mb-10 ">
          <h1 className="text-3xl font-bold text-gray-800">
            Welcome back,{" "}
            <span className="text-blue-500">
              {isLoading ? (
                <Loader2 className="inline animate-spin w-5 h-5" />
              ) : (
                `${user.name || "User"}!`
              )}
            </span>
          </h1>
        </div>

        {/* Profile Overview*/}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          <StatCard title="Total Orders" count={10} Icon={Clock} />
          <StatCard title="Processing Orders" count={4} Icon={Truck} />
          <StatCard title="Completed Orders" count={4} Icon={CheckCircle} />
        </div>

        {/* Sidebar and content layout */}
        <div className="mt-10 flex flex-col md:flex-row gap-6">
          {/* Left navigation */}
          <div className="bg-white p-4 rounded-md shadow-md border border-gray-100 w-full md:w-1/5">
            <nav className="space-y-2">
              <NavItem
                label="Profile"
                Icon={User}
                active={activeTab === "Profile"}
                onClick={() => setActiveTab("Profile")}
              />
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
};

export default page;

const NavItem = ({ label, Icon, active, danger, onClick }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition ${
      active
        ? "bg-blue-100 text-blue-600"
        : danger
          ? "text-red-500 hover:bg-red-50"
          : "text-gray-700 hover:bg-gray-100"
    }`}
  >
    <Icon className="w-4 h-4" />
    {label}
  </button>
);
