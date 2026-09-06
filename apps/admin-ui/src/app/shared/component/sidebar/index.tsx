"use client";
import { activeSideBarAtom } from "apps/admin-ui/src/configs/constants";
import { useAtom } from "jotai";
import { usePathname } from "next/navigation";
import React from "react";
import useAdmin from "../../../hooks/useAdmin";
import Box from "../box";
import { SideBar } from "./sidebar.style";
import Link from "next/link";
import Logo from "../../../assets/svgs/logo";

const SidebarWrapper = () => {
  const [activeSidebar, setActiveSidebar] = useAtom(activeSideBarAtom);
  const pathname = usePathname();
  const { admin } = useAdmin();

  const getIconColor = (route: string) =>
    activeSidebar == route ? "#0085ff" : "#969696";

  return (
    <Box
      css={{
        height: "100vh",
        zIndex: 202,
        position: "sticky",
        padding: "8px",
        top: "0",
        overflowY: "scroll",
        scrollbarWidth: "none",
      }}
      className="sidebar-wrapper"
    >
      <SideBar.Header>
        <Box>
          <Link href={"/"} className="flex justify-center text-center gap-2">
            <Logo />
            <Box>
              <h3 className="text-xl font-medium text-[#ecedee]">
                {admin?.name}
              </h3>
              <h5 className="font-medium pl-2 text-xs text-[#ecedee7] whitespace-nowrap">
                {admin?.email}
              </h5>
            </Box>
          </Link>
        </Box>
      </SideBar.Header>
    </Box>
  );
};

export default SidebarWrapper;
