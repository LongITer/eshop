"use client";
import useUser from "@/hooks/useUser";
import StatCard from "@/shared/cards/stat.card";
import { CheckCircle, Clock, Loader2, Truck } from "lucide-react";
import React, { useState } from "react";

const page = () => {
  const { user, isLoading } = useUser();
  return (
    <div className="bg-gray-50 p-6 pb-14">
      <div className="mx-w-7xl mx-auto">
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
      </div>
    </div>
  );
};

export default page;
