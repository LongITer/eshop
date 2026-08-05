"use client";
import { useEffect, useState } from "react";
import { UAParser } from "ua-parser-js";

const useDeviceTracking = () => {
  const [deviceInfo, setDeviceInfo] = useState("");

  useEffect(() => {
    // ua-parser-js v2: call as a function, no `new`, no `.getResult()`
    const result = UAParser();

    setDeviceInfo(
      `${result.device.type || "Desktop"} - ${result.os.name ?? ""} ${
        result.os.version ?? ""
      } - ${result.browser.name ?? ""} ${result.browser.version ?? ""}`.trim(),
    );
  }, []);

  return deviceInfo;
};

export default useDeviceTracking;
