/*
 * SPDX-License-Identifier: LGPL-2.1-or-later
 *
 * Copyright (C) 2026 Jeff Milne - KE2HNI
 */
import React, { useEffect, useRef, useState } from 'react';

/*
 * Main Cockpit/React UI dependencies used by the Pi 5 Hardware Monitor page.
 */
import { Card, CardBody } from "@patternfly/react-core/dist/esm/components/Card/index.js";
import { Content, ContentVariants } from "@patternfly/react-core/dist/esm/components/Content/index.js";
import { MenuToggle } from "@patternfly/react-core/dist/esm/components/MenuToggle/index.js";
import { Page, PageSection } from "@patternfly/react-core/dist/esm/components/Page/index.js";
import { Select, SelectList, SelectOption } from "@patternfly/react-core/dist/esm/components/Select/index.js";
import { Title } from "@patternfly/react-core/dist/esm/components/Title/index.js";
import { Flex, FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex/index.js";
import { Gallery } from "@patternfly/react-core/dist/esm/layouts/Gallery/index.js";

/*
 * Cockpit bridge interface used to run local node commands and read live data.
 */
declare const cockpit: {
    spawn(args: string[], options?: { err?: string }): Promise<string>;
};

/*
 * Data model types for each major area shown in the plugin UI.
 * These keep the live monitor state structured and predictable.
 */
type ThermalState = {
    cpuTemp: string;
    nvmeTemp: string;
    ioTemp: string;
    pmicTemp: string;
    fanRpm: string;
    fanPwm: string;
};

type PowerState = {
    raw: string;
    rawText: string;
    powerHealth: string;
    currentUndervoltage: string;
    undervoltageSinceBoot: string;
    currentThrottled: string;
    throttledSinceBoot: string;
    currentFreqCap: string;
    freqCapSinceBoot: string;
    currentSoftTempLimit: string;
    softTempLimitSinceBoot: string;
};

type SystemState = {
    piModel: string;
    cpuFrequency: string;
    totalRam: string;
    memoryUsage: string;
    uptime: string;
    kernel: string;
    loadAverage: string;
    rootFilesystemUsed: string;
};

type BootState = {
    bootDevice: string;
    rootDevice: string;
    nvmePresent: string;
    fanPresent: string;
};

type NvmeState = {
    model: string;
    capacity: string;
    firmware: string;
    health: string;
    healthDetail: string;
    smartTemp: string;
    percentageUsed: string;
    powerOnHours: string;
    unsafeShutdowns: string;
    mediaErrors: string;
    mountedAt: string;
};

type SdState = {
    present: string;
    device: string;
    capacity: string;
    cardUsed: string;
    vendor: string;
    name: string;
    serial: string;
    mountedAt: string;
};

type UsbStorageState = {
    present: string;
    model: string;
    capacity: string;
    freeSpace: string;
    devicePath: string;
    mountedAt: string;
};

type PcieState = {
    currentLinkSpeed: string;
    currentLinkWidth: string;
    maxLinkSpeed: string;
    maxLinkWidth: string;
};

type PsuState = {
    inputVoltage: string;
    negotiatedCurrentLimit: string;
    usbCurrentLimitMode: string;
    usbOverCurrentAtBoot: string;
};

type VoltageState = {
    coreVoltage: string;
    sdramC: string;
    sdramI: string;
    sdramP: string;
};

type ClockState = {
    armClock: string;
    coreClock: string;
    emmcClock: string;
};

type AdvancedState = {
    firmwareVersion: string;
    ringOscillator: string;
    coreRailPower: string;
    coreRailDetail: string;
};

type HistorySummaryState = {
    available: string;
    sampleCount: string;
    windowDays: string;
    latestSampleAge: string;
    cpuTempLow: string;
    cpuTempHigh: string;
    ioTempLow: string;
    ioTempHigh: string;
    nvmeTempLow: string;
    nvmeTempHigh: string;
    pmicTempLow: string;
    pmicTempHigh: string;
    undervoltageEvents: string;
    throttledEvents: string;
    freqCapEvents: string;
    softTempLimitEvents: string;
};

type HistoryDaySummary = {
    dayKey: string;
    dayLabel: string;
    available: string;
    sampleCount: string;
    windowDays: string;
    latestSampleAge: string;
    cpuTempLow: string;
    cpuTempHigh: string;
    ioTempLow: string;
    ioTempHigh: string;
    nvmeTempLow: string;
    nvmeTempHigh: string;
    pmicTempLow: string;
    pmicTempHigh: string;
    undervoltageEvents: string;
    throttledEvents: string;
    freqCapEvents: string;
    softTempLimitEvents: string;
};

type HistorySampleSummary = {
    sampleKey: string;
    dayKey: string;
    sampleLabel: string;
    sampleAge: string;
    cpuTemp: string;
    ioTemp: string;
    nvmeTemp: string;
    pmicTemp: string;
    undervoltage: string;
    throttled: string;
    freqCap: string;
    softTempLimit: string;
};

type MonitorState = {
    thermal: ThermalState;
    power: PowerState;
    system: SystemState;
    boot: BootState;
    nvme: NvmeState;
    sd: SdState;
    usbStorage: UsbStorageState;
    pcie: PcieState;
    psu: PsuState;
    voltages: VoltageState;
    clocks: ClockState;
    advanced: AdvancedState;
    history: HistorySummaryState;
};

/*
 * Section visibility keys used by the Show/Hide Sections control.
 */
type SectionKey =
    | "history"
    | "thermal"
    | "power"
    | "system"
    | "boot"
    | "nvme"
    | "sd"
    | "pcie"
    | "psu"
    | "voltages"
    | "clocks"
    | "advanced";

/*
 * Human-readable section labels shown in the visibility dropdown.
 */
const SECTION_LABELS: Record<SectionKey, string> = {
    thermal: "Thermal / Cooling",
    history: "History / Trends",
    power: "Power / Throttling",
    system: "System Summary",
    boot: "Boot / Device Info",
    nvme: "NVMe Drive",
    sd: "SD Card",
    pcie: "PCIe / NVMe Link",
    psu: "Power Supply",
    voltages: "Voltages",
    clocks: "Clocks",
    advanced: "Advanced",
};

/*
 * Default visible state for each major page section.
 */
const DEFAULT_VISIBLE_SECTIONS: Record<SectionKey, boolean> = {
    history: true,
    thermal: true,
    power: true,
    system: true,
    boot: true,
    nvme: true,
    sd: true,
    pcie: true,
    psu: true,
    voltages: true,
    clocks: true,
    advanced: true,
};

/*
 * localStorage key used to persist section visibility across refresh/reboot.
 */
const SECTION_STORAGE_KEY = "pi-monitor-v2-visible-sections";

/*
 * UI formatting and status helper functions.
 * These convert raw node values into readable text and status classes.
 */

function parseTempC(tempText: string) {
    const match = tempText.match(/([-+]?\d+(?:\.\d+)?)\s*°C/);
    return match ? Number(match[1]) : NaN;
}

function getTempStatusClass(tempText: string) {
    const tempC = parseTempC(tempText);

    if (!Number.isFinite(tempC)) return "";

    if (tempC < 55) return "pi-card-status-info";
    if (tempC < 65) return "pi-card-status-success";
    if (tempC < 80) return "pi-card-status-warning";
    return "pi-card-status-danger";
}

function getNvmeTempStatusClass(tempText: string) {
    const tempC = parseTempC(tempText);

    if (!Number.isFinite(tempC)) return "";

    if (tempC < 40) return "pi-card-status-info";
    if (tempC < 60) return "pi-card-status-success";
    if (tempC < 70) return "pi-card-status-warning";
    return "pi-card-status-danger";
}

function getIoTempStatusClass(tempText: string) {
    const tempC = parseTempC(tempText);

    if (!Number.isFinite(tempC)) return "";

    if (tempC < 45) return "pi-card-status-info";
    if (tempC < 65) return "pi-card-status-success";
    if (tempC < 80) return "pi-card-status-warning";
    return "pi-card-status-danger";
}

/*  function parsePercentValue(percentText: string) {
 *  const match = percentText.match(/([-+]?\d+(?:\.\d+)?)\s*%/);
 *  return match ? Number(match[1]) : NaN;
 * }
 *
 * function getFanPwmStatusClass(percentText: string) {
 *  const percent = parsePercentValue(percentText);
 *
 *  if (!Number.isFinite(percent)) return "";
 *
 *  if (percent < 30) return "pi-card-status-info";
 *  if (percent < 50) return "pi-card-status-success";
 *  if (percent < 70) return "pi-card-status-warning";
 *  return "pi-card-status-danger";
 * }
*/

function getFanRpmStatusClass(rpmText: string) {
    const rpm = Number(rpmText);

    if (!Number.isFinite(rpm)) return "";

    if (rpm < 2000) return "pi-card-status-info";
    if (rpm < 4500) return "pi-card-status-success";
    if (rpm < 6500) return "pi-card-status-warning";
    return "pi-card-status-danger";
}

function formatTemp(raw: string) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return "--";
    const c = n / 1000;
    const f = (c * 9 / 5) + 32;
    return `${c.toFixed(1)} °C / ${f.toFixed(1)} °F`;
}

function formatRpm(raw: string) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return "--";
    return `${Math.round(n)}`;
}

function formatPercentFromPwm(raw: string) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return "--";
    return `${Math.round((n / 255) * 100)}%`;
}

function yesNo(flag: boolean) {
    return flag ? "Yes" : "No";
}

function extractValueAfterEquals(raw: string) {
    if (!raw) return "--";
    const idx = raw.indexOf("=");
    if (idx === -1) return raw.trim() || "--";
    const val = raw.slice(idx + 1).trim();
    return val || "--";
}

function extractNumericValue(raw: string) {
    if (!raw) return NaN;
    const idx = raw.indexOf("=");
    const rhs = idx >= 0 ? raw.slice(idx + 1) : raw;
    const match = rhs.match(/[-+]?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : NaN;
}

function formatClock(raw: string) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return "--";

    if (n >= 1_000_000_000) {
        return `${(n / 1_000_000_000).toFixed(2)} GHz`;
    }
    return `${(n / 1_000_000).toFixed(0)} MHz`;
}

function formatBytesDecimal(bytes: string | number) {
    const n = Number(bytes);
    if (!Number.isFinite(n)) return "--";

    const units = ["B", "KB", "MB", "GB", "TB", "PB"];
    let value = n;
    let unit = 0;

    while (value >= 1000 && unit < units.length - 1) {
        value /= 1000;
        unit += 1;
    }

    return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatBytesGiB(bytes: string | number) {
    const n = Number(bytes);
    if (!Number.isFinite(n)) return "--";
    return `${(n / (1024 ** 3)).toFixed(1)} GiB`;
}

function formatMemUsage(usedBytes: string | number, totalBytes: string | number) {
    const used = Number(usedBytes);
    const total = Number(totalBytes);

    if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) return "--";
    return `${Math.round((used / total) * 100)}%`;
}

function formatCpuFreq(rawKHz: string) {
    const n = Number(rawKHz);
    if (!Number.isFinite(n) || n <= 0) return "--";

    const mhz = n / 1000;
    if (mhz >= 1000) return `${(mhz / 1000).toFixed(2)} GHz`;
    return `${mhz.toFixed(0)} MHz`;
}

function formatHours(raw: string) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return "--";
    return `${Math.round(n).toLocaleString()} h`;
}

function formatMilliAmps(raw: string) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return "--";
    return `${Math.round(n)} mA`;
}

function formatUsbCurrentLimitMode(raw: string) {
    if (raw === "1") return "High";
    if (raw === "0") return "Low";
    if (!raw) return "--";
    return raw;
}

function formatYesNoFromZeroOne(raw: string) {
    if (raw === "1") return "Yes";
    if (raw === "0") return "No";
    if (!raw) return "--";
    return raw;
}

function formatUptime(secondsRaw: string) {
    const seconds = Math.floor(Number(secondsRaw));
    if (!Number.isFinite(seconds)) return "--";

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    const parts: string[] = [];
    if (days) parts.push(`${days}d`);
    if (hours || days) parts.push(`${hours}h`);
    parts.push(`${mins}m`);

    return parts.join(" ");
}

function classifyBootDevice(rootDevice: string) {
    if (!rootDevice || rootDevice === "--") return "--";
    if (rootDevice.startsWith("/dev/nvme")) return "NVMe";
    if (rootDevice.startsWith("/dev/mmcblk")) return "microSD";
    if (rootDevice.startsWith("/dev/sd")) return "USB / SATA";
    return "Other";
}

function parseSmartValue(raw: string, key: string) {
    if (!raw) return "--";
    const re = new RegExp(`^\\s*${key}\\s*:\\s*(.+)$`, "mi");
    const m = raw.match(re);
    return m ? m[1].trim() : "--";
}

function parseSmartHealth(raw: string) {
    const val = parseSmartValue(raw, "SMART overall-health self-assessment test result");
    if (val !== "--") return val;

    const val2 = parseSmartValue(raw, "SMART Health Status");
    if (val2 !== "--") return val2;

    const val3 = parseSmartValue(raw, "SMART overall-health self-assessment test result:");
    if (val3 !== "--") return val3;

    return "--";
}

function cleanNvmeTemp(raw: string) {
    if (!raw || raw === "--") return "--";

    const m = raw.match(/([-+]?\d+(?:\.\d+)?)\s+Celsius/i);
    if (!m) return raw;

    return formatTemp(String(Number(m[1]) * 1000));
}

function decodeSdVendor(raw: string) {
    const v = (raw || "").trim().toUpperCase();

    const vendors: Record<string, string> = {
        "0X000000": "Gigastone",
        "0X000001": "Panasonic",
        "0X000002": "Toshiba",
        "0X000003": "SanDisk",
        "0X000006": "SanDisk Extreme Pro",
        "0X00000B": "Toshiba",
        "0X000013": "SanDisk/WD",
        "0X000014": "Samsung",
        "0X00001B": "Kingston/Samsung",
        "0X00001D": "ADATA/Transcend",
        "0X000024": "Lexar",
        "0X000027": "Phison/Sony",
        "0X000028": "Lexar",
        "0X000031": "Silicon Power",
        "0X000041": "Kingston",
        "0X00005C": "Lexar",
        "0X000074": "Transcend/ADATA",
        "0X000076": "PNY",
        "0X000082": "Sony/Silicon Power",
        "0X000089": "Intel/Kingston Canvas Select Plus",
        "0X000090": "Strontium",
        "0X000092": "Verbatim",
        "0X00009B": "Patriot",
        "0X00009C": "Lexar",
        "0X0000B6": "Delkin Devices",
    };

    if (!v) return "--";
    return vendors[v] || raw || "--";
}

function formatRingOsc(raw: string) {
    if (!raw || raw === "--") return "--";

    const freqMatch = raw.match(/=\s*([0-9.]+MHz)/i);
    const voltMatch = raw.match(/\(@\s*([0-9.]+V)\)/i);
    const tempMatch = raw.match(/\(([0-9.]+)'C\)/i);

    if (!freqMatch) return raw;

    const freq = freqMatch[1];
    const volt = voltMatch ? voltMatch[1] : "";
    const tempC = tempMatch ? Number(tempMatch[1]) : NaN;

    if (Number.isFinite(tempC)) {
        const tempF = (tempC * 9 / 5) + 32;
        return `${freq}${volt ? ` (@${volt})` : ""} ${tempC.toFixed(1)}'C/${tempF.toFixed(1)}'F`;
    }

    return `${freq}${volt ? ` (@${volt})` : ""}`;
}

function parseThrottledHex(raw: string) {
    const match = raw.match(/0x([0-9a-fA-F]+)/);
    const value = match ? parseInt(match[1], 16) : 0;

    const currentUndervoltage = (value & (1 << 0)) !== 0;
    const currentFreqCap = (value & (1 << 1)) !== 0;
    const currentThrottled = (value & (1 << 2)) !== 0;
    const currentSoftTempLimit = (value & (1 << 3)) !== 0;

    const undervoltageSinceBoot = (value & (1 << 16)) !== 0;
    const freqCapSinceBoot = (value & (1 << 17)) !== 0;
    const throttledSinceBoot = (value & (1 << 18)) !== 0;
    const softTempLimitSinceBoot = (value & (1 << 19)) !== 0;

    const powerHealth =
        currentUndervoltage || currentFreqCap || currentThrottled || currentSoftTempLimit
            ? "Issue Detected"
            : "Healthy";

    const activeNow: string[] = [];
    const sinceBoot: string[] = [];

    if (currentUndervoltage) activeNow.push("under-voltage active now");
    if (currentFreqCap) activeNow.push("frequency cap active now");
    if (currentThrottled) activeNow.push("throttling active now");
    if (currentSoftTempLimit) activeNow.push("soft temp limit active now");

    if (undervoltageSinceBoot) sinceBoot.push("under-voltage occurred since boot");
    if (freqCapSinceBoot) sinceBoot.push("frequency cap occurred since boot");
    if (throttledSinceBoot) sinceBoot.push("throttling occurred since boot");
    if (softTempLimitSinceBoot) sinceBoot.push("soft temp limit occurred since boot");

    const rawText =
        activeNow.length === 0 && sinceBoot.length === 0
            ? "No power or thermal issues"
            : [...activeNow, ...sinceBoot].join("; ");

    return {
        raw: match ? `throttled=0x${match[1].toLowerCase()}` : "throttled=0x0",
        rawText,
        powerHealth,
        currentUndervoltage: yesNo(currentUndervoltage),
        undervoltageSinceBoot: yesNo(undervoltageSinceBoot),
        currentThrottled: yesNo(currentThrottled),
        throttledSinceBoot: yesNo(throttledSinceBoot),
        currentFreqCap: yesNo(currentFreqCap),
        freqCapSinceBoot: yesNo(freqCapSinceBoot),
        currentSoftTempLimit: yesNo(currentSoftTempLimit),
        softTempLimitSinceBoot: yesNo(softTempLimitSinceBoot),
    };
}

function getPowerHealthTextClass(powerHealth: string) {
    if (powerHealth === "Healthy") return "pi-text-status-success";
    if (powerHealth === "Issue Detected") return "pi-text-status-danger";
    return "";
}

/*
 * History collector record format read from /var/lib/pi-monitor/history.ndjson.
 */
type HistoryRecord = {
    ts?: number;
    cpuTemp?: number | null;
    nvmeTemp?: number | null;
    ioTemp?: number | null;
    pmicTemp?: number | null;
    currentUndervoltage?: number | null;
    currentFreqCap?: number | null;
    currentThrottled?: number | null;
    currentSoftTempLimit?: number | null;
    rootUsedPct?: number | null;
    usbFreeBytes?: number | null;
};

function formatTempMillic(raw: number | null | undefined) {
    if (!Number.isFinite(raw)) return "--";

    const c = Number(raw) / 1000;
    const f = (c * 9 / 5) + 32;

    return `${c.toFixed(1)} °C / ${f.toFixed(1)} °F`;
}

function summarizeTempRange(values: Array<number | null | undefined>) {
    const temps = values
            .filter((value): value is number => Number.isFinite(value))
            .map(value => Number(value));

    if (temps.length === 0) {
        return {
            low: "--",
            high: "--",
        };
    }

    const low = Math.min(...temps);
    const high = Math.max(...temps);

    return {
        low: formatTempMillic(low),
        high: formatTempMillic(high),
    };
}

function formatHistoryAge(ts: number | null | undefined) {
    if (!Number.isFinite(ts)) return "--";

    const ageSeconds = Math.max(0, Math.floor(Date.now() / 1000) - Number(ts));
    const days = Math.floor(ageSeconds / 86400);
    const hours = Math.floor((ageSeconds % 86400) / 3600);
    const mins = Math.floor((ageSeconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h ago`;
    if (hours > 0) return `${hours}h ${mins}m ago`;
    return `${mins}m ago`;
}

function formatSampleSpan(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) return "--";

    const totalMinutes = Math.floor(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    if (hours <= 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;

    return `${hours}h ${mins}m`;
}

function getHistoryDayKey(ts: number | null | undefined, timeZone: string) {
    if (!Number.isFinite(ts)) return "--";

    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date(Number(ts) * 1000));

    const year = parts.find(part => part.type === "year")?.value || "0000";
    const month = parts.find(part => part.type === "month")?.value || "00";
    const day = parts.find(part => part.type === "day")?.value || "00";

    return `${year}-${month}-${day}`;
}

function formatHistoryDayLabel(ts: number | null | undefined, timeZone: string) {
    if (!Number.isFinite(ts)) return "--";

    return new Intl.DateTimeFormat(undefined, {
        timeZone,
        month: "short",
        day: "numeric",
    }).format(new Date(Number(ts) * 1000));
}

function formatHistorySampleLabel(ts: number | null | undefined, timeZone: string) {
    if (!Number.isFinite(ts)) return "--";

    return new Intl.DateTimeFormat(undefined, {
        timeZone,
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
    }).format(new Date(Number(ts) * 1000));
}

function summarizeHistorySamples(records: HistoryRecord[], timeZone: string): HistorySampleSummary[] {
    return records
            .filter(record => Number.isFinite(record.ts))
            .sort((a, b) => Number(b.ts) - Number(a.ts))
            .map(record => {
                const ts = Number(record.ts);

                return {
                    sampleKey: String(ts),
                    dayKey: getHistoryDayKey(ts, timeZone),
                    sampleLabel: formatHistorySampleLabel(ts, timeZone),
                    sampleAge: formatHistoryAge(ts),
                    cpuTemp: formatTempMillic(record.cpuTemp),
                    ioTemp: formatTempMillic(record.ioTemp),
                    nvmeTemp: formatTempMillic(record.nvmeTemp),
                    pmicTemp: formatTempMillic(record.pmicTemp),
                    undervoltage: yesNo(record.currentUndervoltage === 1),
                    throttled: yesNo(record.currentThrottled === 1),
                    freqCap: yesNo(record.currentFreqCap === 1),
                    softTempLimit: yesNo(record.currentSoftTempLimit === 1),
                };
            });
}

function getTodayHistoryDayKey(timeZone: string) {
    return getHistoryDayKey(Math.floor(Date.now() / 1000), timeZone);
}

function countHistoryEvents(records: HistoryRecord[], key: keyof HistoryRecord) {
    return records.reduce((count, record) => {
        const value = record[key];

        return count + (value === 1 ? 1 : 0);
    }, 0);
}

function defaultHistorySummaryState(): HistorySummaryState {
    return {
        available: "No",
        sampleCount: "--",
        windowDays: "--",
        latestSampleAge: "--",
        cpuTempLow: "--",
        cpuTempHigh: "--",
        ioTempLow: "--",
        ioTempHigh: "--",
        nvmeTempLow: "--",
        nvmeTempHigh: "--",
        pmicTempLow: "--",
        pmicTempHigh: "--",
        undervoltageEvents: "--",
        throttledEvents: "--",
        freqCapEvents: "--",
        softTempLimitEvents: "--",
    };
}

function summarizeHistory(records: HistoryRecord[]): HistorySummaryState {
    if (records.length === 0) {
        return defaultHistorySummaryState();
    }

    const sorted = [...records]
            .filter(record => Number.isFinite(record.ts))
            .sort((a, b) => Number(a.ts) - Number(b.ts));

    if (sorted.length === 0) {
        return defaultHistorySummaryState();
    }

    const firstTs = Number(sorted[0].ts);
    const lastTs = Number(sorted[sorted.length - 1].ts);
    const windowDays = Math.max(0, (lastTs - firstTs) / 86400);
    const cpuTemps = summarizeTempRange(sorted.map(record => record.cpuTemp));
    const ioTemps = summarizeTempRange(sorted.map(record => record.ioTemp));
    const nvmeTemps = summarizeTempRange(sorted.map(record => record.nvmeTemp));
    const pmicTemps = summarizeTempRange(sorted.map(record => record.pmicTemp));

    return {
        available: "Yes",
        sampleCount: String(sorted.length),
        windowDays: `${windowDays.toFixed(1)} days`,
        latestSampleAge: formatHistoryAge(lastTs),
        cpuTempLow: cpuTemps.low,
        cpuTempHigh: cpuTemps.high,
        ioTempLow: ioTemps.low,
        ioTempHigh: ioTemps.high,
        nvmeTempLow: nvmeTemps.low,
        nvmeTempHigh: nvmeTemps.high,
        pmicTempLow: pmicTemps.low,
        pmicTempHigh: pmicTemps.high,
        undervoltageEvents: String(countHistoryEvents(sorted, "currentUndervoltage")),
        throttledEvents: String(countHistoryEvents(sorted, "currentThrottled")),
        freqCapEvents: String(countHistoryEvents(sorted, "currentFreqCap")),
        softTempLimitEvents: String(countHistoryEvents(sorted, "currentSoftTempLimit")),
    };
}

function summarizeHistoryDays(records: HistoryRecord[], timeZone: string): HistoryDaySummary[] {
    const grouped = new Map<string, HistoryRecord[]>();

    for (const record of records) {
        if (!Number.isFinite(record.ts)) continue;

        const dateKey = getHistoryDayKey(Number(record.ts), timeZone);
        const bucket = grouped.get(dateKey) || [];

        bucket.push(record);
        grouped.set(dateKey, bucket);
    }

    return [...grouped.entries()]
            .sort((a, b) => b[0].localeCompare(a[0]))
            .slice(0, 5)
            .map(([dayKey, dayRecords]) => {
                const sortedDayRecords = [...dayRecords]
                        .filter(record => Number.isFinite(record.ts))
                        .sort((a, b) => Number(a.ts) - Number(b.ts));

                const firstTs = sortedDayRecords.length > 0 ? Number(sortedDayRecords[0].ts) : NaN;
                const cpuTemps = summarizeTempRange(sortedDayRecords.map(record => record.cpuTemp));
                const ioTemps = summarizeTempRange(sortedDayRecords.map(record => record.ioTemp));
                const nvmeTemps = summarizeTempRange(sortedDayRecords.map(record => record.nvmeTemp));
                const pmicTemps = summarizeTempRange(sortedDayRecords.map(record => record.pmicTemp));

                const lastTs = sortedDayRecords.length > 0 ? Number(sortedDayRecords[sortedDayRecords.length - 1].ts) : NaN;
                const daySampleSpanSeconds = Number.isFinite(firstTs) && Number.isFinite(lastTs)
                    ? Math.max(0, lastTs - firstTs)
                    : 0;

                return {
                    dayKey,
                    dayLabel: formatHistoryDayLabel(firstTs, timeZone),
                    available: "Yes",
                    sampleCount: String(sortedDayRecords.length),
                    windowDays: formatSampleSpan(daySampleSpanSeconds),
                    latestSampleAge: formatHistoryAge(lastTs),
                    cpuTempLow: cpuTemps.low,
                    cpuTempHigh: cpuTemps.high,
                    ioTempLow: ioTemps.low,
                    ioTempHigh: ioTemps.high,
                    nvmeTempLow: nvmeTemps.low,
                    nvmeTempHigh: nvmeTemps.high,
                    pmicTempLow: pmicTemps.low,
                    pmicTempHigh: pmicTemps.high,
                    undervoltageEvents: String(countHistoryEvents(sortedDayRecords, "currentUndervoltage")),
                    throttledEvents: String(countHistoryEvents(sortedDayRecords, "currentThrottled")),
                    freqCapEvents: String(countHistoryEvents(sortedDayRecords, "currentFreqCap")),
                    softTempLimitEvents: String(countHistoryEvents(sortedDayRecords, "currentSoftTempLimit")),
                };
            });
}

/*
 * History file readers and summarizers.
 * These load the local NDJSON file, group it by node timezone, and build the
 * summary/day/sample objects used by the History / Trends cards.
 */
async function readHistoryRecords(): Promise<HistoryRecord[]> {
    try {
        const out = await cockpit.spawn(
            ["sh", "-c", "test -r /var/lib/pi-monitor/history.ndjson && tail -n 1440 /var/lib/pi-monitor/history.ndjson || true"],
            { err: "out" }
        );

        return out
                .split("\n")
                .map(line => line.trim())
                .filter(Boolean)
                .map(line => {
                    try {
                        return JSON.parse(line) as HistoryRecord;
                    } catch {
                        return null;
                    }
                })
                .filter((record): record is HistoryRecord => record !== null);
    } catch {
        return [];
    }
}

async function readNodeTimeZone(): Promise<string> {
    try {
        const out = await cockpit.spawn(
            ["sh", "-c", "(timedatectl show -p Timezone --value 2>/dev/null || cat /etc/timezone 2>/dev/null || printf 'UTC') | head -n1"],
            { err: "out" }
        );

        const zone = out.trim();
        return zone || "UTC";
    } catch {
        return "UTC";
    }
}

async function readHistoryView(): Promise<{
    summary: HistorySummaryState;
    days: HistoryDaySummary[];
    samples: HistorySampleSummary[];
    timeZone: string;
}> {
    const [records, timeZone] = await Promise.all([
        readHistoryRecords(),
        readNodeTimeZone(),
    ]);

    return {
        summary: summarizeHistory(records),
        days: summarizeHistoryDays(records, timeZone),
        samples: summarizeHistorySamples(records, timeZone),
        timeZone,
    };
}

/*
 * Live monitor defaults and live-data reader.
 * These provide safe placeholder values until the node responds.
 */
function defaultMonitorState(): MonitorState {
    return {
        thermal: {
            cpuTemp: "--",
            nvmeTemp: "--",
            ioTemp: "--",
            pmicTemp: "--",
            fanRpm: "--",
            fanPwm: "--",
        },
        power: {
            raw: "throttled=0x0",
            rawText: "No power or thermal issues",
            powerHealth: "--",
            currentUndervoltage: "--",
            undervoltageSinceBoot: "--",
            currentThrottled: "--",
            throttledSinceBoot: "--",
            currentFreqCap: "--",
            freqCapSinceBoot: "--",
            currentSoftTempLimit: "--",
            softTempLimitSinceBoot: "--",
        },
        system: {
            piModel: "--",
            cpuFrequency: "--",
            totalRam: "--",
            memoryUsage: "--",
            uptime: "--",
            kernel: "--",
            loadAverage: "--",
            rootFilesystemUsed: "--",
        },
        boot: {
            bootDevice: "--",
            rootDevice: "--",
            nvmePresent: "--",
            fanPresent: "--",
        },
        nvme: {
            model: "--",
            capacity: "--",
            firmware: "--",
            health: "--",
            healthDetail: "--",
            smartTemp: "--",
            percentageUsed: "--",
            powerOnHours: "--",
            unsafeShutdowns: "--",
            mediaErrors: "--",
            mountedAt: "--",
        },
        sd: {
            present: "--",
            device: "--",
            capacity: "--",
            cardUsed: "--",
            vendor: "--",
            name: "--",
            serial: "--",
            mountedAt: "--",
        },
        usbStorage: {
            present: "--",
            model: "--",
            capacity: "--",
            freeSpace: "--",
            devicePath: "--",
            mountedAt: "--",
        },
        pcie: {
            currentLinkSpeed: "--",
            currentLinkWidth: "--",
            maxLinkSpeed: "--",
            maxLinkWidth: "--",
        },
        psu: {
            inputVoltage: "--",
            negotiatedCurrentLimit: "--",
            usbCurrentLimitMode: "--",
            usbOverCurrentAtBoot: "--",
        },
        voltages: {
            coreVoltage: "--",
            sdramC: "--",
            sdramI: "--",
            sdramP: "--",
        },
        clocks: {
            armClock: "--",
            coreClock: "--",
            emmcClock: "--",
        },
        advanced: {
            firmwareVersion: "--",
            ringOscillator: "--",
            coreRailPower: "--",
            coreRailDetail: "--",
        },
        history: defaultHistorySummaryState(),
    };
}

async function readMonitorData(): Promise<MonitorState> {
    const cmd = `
      echo "CPU=$(cat /sys/class/hwmon/hwmon0/temp1_input 2>/dev/null)"
      echo "NVME=$(cat /sys/class/hwmon/hwmon1/temp1_input 2>/dev/null)"
      echo "RP1=$(cat /sys/class/hwmon/hwmon2/temp1_input 2>/dev/null)"
      echo "PMIC_TEMP=$(vcgencmd measure_temp pmic 2>/dev/null | sed "s/.*=//; s/'C//" | awk '{printf "%d", $1 * 1000}')"

      FAN_VALUE=""
      PWM_VALUE=""
      FAN_FOUND=0
      PWM_FOUND=0

      if [ -r /sys/devices/platform/cooling_fan/hwmon/hwmon3/fan1_input ]; then
        FAN_VALUE=$(cat /sys/devices/platform/cooling_fan/hwmon/hwmon3/fan1_input 2>/dev/null || true)
        [ -n "$FAN_VALUE" ] && FAN_FOUND=1
      fi

      if [ -r /sys/devices/platform/cooling_fan/hwmon/hwmon3/pwm1 ]; then
        PWM_VALUE=$(cat /sys/devices/platform/cooling_fan/hwmon/hwmon3/pwm1 2>/dev/null || true)
        [ -n "$PWM_VALUE" ] && PWM_FOUND=1
      fi

      if [ "$FAN_FOUND" -eq 0 ] || [ "$PWM_FOUND" -eq 0 ]; then
        for HWMON_DIR in /sys/class/hwmon/hwmon*; do
          [ -d "$HWMON_DIR" ] || continue

          if [ "$FAN_FOUND" -eq 0 ]; then
            for FAN_PATH in "$HWMON_DIR"/fan*_input; do
              [ -r "$FAN_PATH" ] || continue
              FAN_VALUE=$(cat "$FAN_PATH" 2>/dev/null || true)
              if [ -n "$FAN_VALUE" ]; then
                FAN_FOUND=1
                break
              fi
            done
          fi

          if [ "$PWM_FOUND" -eq 0 ]; then
            for PWM_PATH in "$HWMON_DIR"/pwm[0-9]*; do
              [ -r "$PWM_PATH" ] || continue
              case "$PWM_PATH" in
                *_enable) continue ;;
              esac
              PWM_VALUE=$(cat "$PWM_PATH" 2>/dev/null || true)
              if [ -n "$PWM_VALUE" ]; then
                PWM_FOUND=1
                break
              fi
            done
          fi

          if [ "$FAN_FOUND" -eq 1 ] && [ "$PWM_FOUND" -eq 1 ]; then
            break
          fi
        done
      fi

      [ "$FAN_FOUND" -eq 1 ] && echo "FAN=$FAN_VALUE"
      [ "$PWM_FOUND" -eq 1 ] && echo "PWM=$PWM_VALUE"

      echo "THROTTLED=$(vcgencmd get_throttled 2>/dev/null || echo throttled=0x0)"
      echo "VOLT_CORE=$(vcgencmd measure_volts core 2>/dev/null)"
      echo "VOLT_SDRAM_C=$(vcgencmd measure_volts sdram_c 2>/dev/null)"
      echo "VOLT_SDRAM_I=$(vcgencmd measure_volts sdram_i 2>/dev/null)"
      echo "VOLT_SDRAM_P=$(vcgencmd measure_volts sdram_p 2>/dev/null)"

      echo "CLOCK_ARM=$(vcgencmd measure_clock arm 2>/dev/null | awk -F= '{print $2}')"
      echo "CLOCK_CORE=$(vcgencmd measure_clock core 2>/dev/null | awk -F= '{print $2}')"
      echo "CLOCK_EMMC=$(vcgencmd measure_clock emmc 2>/dev/null | awk -F= '{print $2}')"

      ROOT_DEV=$(findmnt -n -o SOURCE / 2>/dev/null)
      echo "ROOT_DEVICE=$ROOT_DEV"

      ROOT_DF_LINE=$(df -B1 / 2>/dev/null | awk 'NR==2 {print $3 "|" $2 "|" $5}')
      if [ -n "$ROOT_DF_LINE" ]; then
        echo "ROOTFS_USED_BYTES=$(printf '%s\\n' "$ROOT_DF_LINE" | cut -d'|' -f1)"
        echo "ROOTFS_TOTAL_BYTES=$(printf '%s\\n' "$ROOT_DF_LINE" | cut -d'|' -f2)"
        echo "ROOTFS_USED_PCT=$(printf '%s\\n' "$ROOT_DF_LINE" | cut -d'|' -f3)"
      fi

      [ -e /sys/class/hwmon/hwmon1/temp1_input ] && echo "NVME_PRESENT=1"
      [ "$FAN_FOUND" -eq 1 ] || [ "$PWM_FOUND" -eq 1 ] && echo "FAN_PRESENT=1"

      echo "PI_MODEL=$(tr -d '\\0' </proc/device-tree/model 2>/dev/null)"
      echo "KERNEL=$(uname -r 2>/dev/null)"
      echo "UPTIME=$(cut -d. -f1 /proc/uptime 2>/dev/null)"
      echo "LOAD_AVG=$(cut -d' ' -f1-3 /proc/loadavg 2>/dev/null)"
      echo "MEMTOTAL_KB=$(awk '/MemTotal:/ {print $2}' /proc/meminfo 2>/dev/null)"
      echo "MEMAVAILABLE_KB=$(awk '/MemAvailable:/ {print $2}' /proc/meminfo 2>/dev/null)"
      echo "CPU_FREQ_KHZ=$(cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq 2>/dev/null)"

      echo "VCGEN_VERSION=$(vcgencmd version 2>/dev/null | head -n1)"
      echo "RING_OSC=$(vcgencmd read_ring_osc 2>/dev/null | tr '\\n' ' ' | sed 's/[[:space:]]\\+/ /g' | sed 's/[[:space:]]*$//')"
      echo "PMIC_CORE_V=$(vcgencmd pmic_read_adc VDD_CORE_V 2>/dev/null)"
      echo "PMIC_CORE_A=$(vcgencmd pmic_read_adc VDD_CORE_A 2>/dev/null)"
      echo "PMIC_EXT5V_V=$(vcgencmd pmic_read_adc EXT5V_V 2>/dev/null)"

      if [ -r /proc/device-tree/chosen/power/max_current ]; then
        echo "PSU_MAX_CURRENT_MA=$(od -A n -d -j 2 --endian=big /proc/device-tree/chosen/power/max_current 2>/dev/null | tr -d ' ')"
      fi

      if [ -r /proc/device-tree/chosen/power/usb_max_current_enable ]; then
        echo "USB_MAX_CURRENT_ENABLE=$(od -A n -d -j 3 /proc/device-tree/chosen/power/usb_max_current_enable 2>/dev/null | tr -d ' ')"
      fi

      if [ -r /proc/device-tree/chosen/power/usb_over_current_detected ]; then
        echo "USB_OVER_CURRENT_DETECTED=$(od -A n -d -j 3 /proc/device-tree/chosen/power/usb_over_current_detected 2>/dev/null | tr -d ' ')"
      fi

      if [ -b /dev/nvme0n1 ]; then
        [ -r /sys/class/nvme/nvme0/model ] && echo "NVME_MODEL=$(cat /sys/class/nvme/nvme0/model 2>/dev/null)"
        [ -r /sys/class/nvme/nvme0/firmware_rev ] && echo "NVME_FIRMWARE=$(cat /sys/class/nvme/nvme0/firmware_rev 2>/dev/null)"
        [ -r /sys/class/block/nvme0n1/size ] && echo "NVME_SIZE_BYTES=$(awk '{print $1 * 512}' /sys/class/block/nvme0n1/size 2>/dev/null)"

        NVME_MOUNT_DEV=$(findmnt -rn -o SOURCE | grep -E '^/dev/nvme0n1p[0-9]+$' | head -n1 || true)
        if [ -n "$NVME_MOUNT_DEV" ]; then
          NVME_MOUNT_POINT=$(findmnt -rn -S "$NVME_MOUNT_DEV" -o TARGET | head -n1 || true)
          [ -n "$NVME_MOUNT_POINT" ] && echo "NVME_MOUNT_POINT=$NVME_MOUNT_POINT"
        fi

        echo "NVME_SMART_BEGIN"
        sudo -n smartctl -a /dev/nvme0n1 2>/dev/null || smartctl -a /dev/nvme0n1 2>/dev/null || true
        echo "NVME_SMART_END"
      fi

      if [ -L /sys/class/nvme/nvme0/device ]; then
        NVME_PCI_DEV=$(readlink -f /sys/class/nvme/nvme0/device 2>/dev/null || true)

        if [ -n "$NVME_PCI_DEV" ] && [ -d "$NVME_PCI_DEV" ]; then
          [ -r "$NVME_PCI_DEV/current_link_speed" ] && echo "PCIE_CURRENT_LINK_SPEED=$(cat "$NVME_PCI_DEV/current_link_speed" 2>/dev/null)"
          [ -r "$NVME_PCI_DEV/current_link_width" ] && echo "PCIE_CURRENT_LINK_WIDTH=$(cat "$NVME_PCI_DEV/current_link_width" 2>/dev/null)"
          [ -r "$NVME_PCI_DEV/max_link_speed" ] && echo "PCIE_MAX_LINK_SPEED=$(cat "$NVME_PCI_DEV/max_link_speed" 2>/dev/null)"
          [ -r "$NVME_PCI_DEV/max_link_width" ] && echo "PCIE_MAX_LINK_WIDTH=$(cat "$NVME_PCI_DEV/max_link_width" 2>/dev/null)"
        fi
      fi

      USB_STORAGE_DISK=""
      USB_ROOT_DISK=""
      USB_STORAGE_MODEL=""
      USB_STORAGE_SIZE_BYTES=""
      USB_STORAGE_MOUNT_DEVICE=""
      USB_STORAGE_MOUNT_POINT=""
      USB_STORAGE_FREE_BYTES=""

      case "$ROOT_DEV" in
        /dev/sd[a-z][0-9]*)
          USB_ROOT_DISK=$(printf '%s\n' "$ROOT_DEV" | sed -E 's#^/dev/(sd[a-z]+)[0-9]+$#\\1#')
          ;;
        /dev/sd[a-z])
          USB_ROOT_DISK=$(printf '%s\n' "$ROOT_DEV" | sed -E 's#^/dev/(sd[a-z]+)$#\\1#')
          ;;
      esac

      is_usb_storage_disk() {
        DISK_NAME="$1"
        DISK_DEVICE_PATH=$(readlink -f "/sys/class/block/$DISK_NAME/device" 2>/dev/null || true)
        printf '%s\n' "$DISK_DEVICE_PATH" | grep -q '/usb'
      }

      if [ -n "$USB_ROOT_DISK" ] && is_usb_storage_disk "$USB_ROOT_DISK"; then
        USB_STORAGE_DISK="$USB_ROOT_DISK"
      else
        for DISK_PATH in /sys/class/block/sd*; do
          [ -e "$DISK_PATH" ] || continue
          DISK_NAME=$(basename "$DISK_PATH")
          if is_usb_storage_disk "$DISK_NAME"; then
            USB_STORAGE_DISK="$DISK_NAME"
            break
          fi
        done
      fi

      if [ -n "$USB_STORAGE_DISK" ]; then
        echo "USB_STORAGE_PRESENT=1"
        echo "USB_STORAGE_DEVICE=/dev/$USB_STORAGE_DISK"

        if [ -r "/sys/class/block/$USB_STORAGE_DISK/device/model" ]; then
          USB_STORAGE_MODEL=$(cat "/sys/class/block/$USB_STORAGE_DISK/device/model" 2>/dev/null | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        fi
        [ -n "$USB_STORAGE_MODEL" ] && echo "USB_STORAGE_MODEL=$USB_STORAGE_MODEL"

        if [ -r "/sys/class/block/$USB_STORAGE_DISK/size" ]; then
          USB_STORAGE_SIZE_BYTES=$(awk '{print $1 * 512}' "/sys/class/block/$USB_STORAGE_DISK/size" 2>/dev/null)
        fi
        [ -n "$USB_STORAGE_SIZE_BYTES" ] && echo "USB_STORAGE_SIZE_BYTES=$USB_STORAGE_SIZE_BYTES"

        USB_MOUNT_LINE=$(lsblk -nrpo NAME,MOUNTPOINT "/dev/$USB_STORAGE_DISK" 2>/dev/null | awk '$2 != "" {print $1 "|" $2; exit}')
        if [ -n "$USB_MOUNT_LINE" ]; then
          USB_STORAGE_MOUNT_DEVICE=$(printf '%s\n' "$USB_MOUNT_LINE" | cut -d'|' -f1)
          USB_STORAGE_MOUNT_POINT=$(printf '%s\n' "$USB_MOUNT_LINE" | cut -d'|' -f2-)
          [ -n "$USB_STORAGE_MOUNT_DEVICE" ] && echo "USB_STORAGE_MOUNT_DEVICE=$USB_STORAGE_MOUNT_DEVICE"
          [ -n "$USB_STORAGE_MOUNT_POINT" ] && echo "USB_STORAGE_MOUNT_POINT=$USB_STORAGE_MOUNT_POINT"
        if [ -n "$USB_STORAGE_MOUNT_POINT" ]; then
          USB_STORAGE_FREE_BYTES=$(df -B1 "$USB_STORAGE_MOUNT_POINT" 2>/dev/null | awk 'NR==2 {print $4}')
          [ -n "$USB_STORAGE_FREE_BYTES" ] && echo "USB_STORAGE_FREE_BYTES=$USB_STORAGE_FREE_BYTES"
        fi
        fi
      fi

      if [ -b /dev/mmcblk0 ]; then
        echo "SD_PRESENT=1"
        echo "SD_DEVICE=/dev/mmcblk0"
        [ -r /sys/class/block/mmcblk0/size ] && echo "SD_SIZE_BYTES=$(awk '{print $1 * 512}' /sys/class/block/mmcblk0/size 2>/dev/null)"
        [ -r /sys/class/block/mmcblk0/device/manfid ] && echo "SD_VENDOR=$(cat /sys/class/block/mmcblk0/device/manfid 2>/dev/null)"
        [ -r /sys/class/block/mmcblk0/device/name ] && echo "SD_NAME=$(cat /sys/class/block/mmcblk0/device/name 2>/dev/null)"
        [ -r /sys/class/block/mmcblk0/device/serial ] && echo "SD_SERIAL=$(cat /sys/class/block/mmcblk0/device/serial 2>/dev/null)"

        SD_MOUNT_DEV=$(findmnt -rn -o SOURCE | grep -E '^/dev/mmcblk0p[0-9]+$' | head -n1 || true)
        if [ -n "$SD_MOUNT_DEV" ]; then
          SD_MOUNT_POINT=$(findmnt -rn -S "$SD_MOUNT_DEV" -o TARGET | head -n1 || true)
          if [ -n "$SD_MOUNT_POINT" ]; then
            echo "SD_MOUNT_DEVICE=$SD_MOUNT_DEV"
            echo "SD_MOUNT_POINT=$SD_MOUNT_POINT"

            SD_DF_LINE=$(df -B1 "$SD_MOUNT_POINT" 2>/dev/null | awk 'NR==2 {print $3 "|" $2 "|" $5}')
            if [ -n "$SD_DF_LINE" ]; then
              echo "SD_USED_BYTES=$(printf '%s\\n' "$SD_DF_LINE" | cut -d'|' -f1)"
              echo "SD_TOTAL_BYTES=$(printf '%s\\n' "$SD_DF_LINE" | cut -d'|' -f2)"
              echo "SD_USED_PCT=$(printf '%s\\n' "$SD_DF_LINE" | cut -d'|' -f3)"
            fi
          fi
        fi
      fi
    `;

    const out = await cockpit.spawn(["sh", "-c", cmd], { err: "out" });

    const data: Record<string, string> = {};
    const lines = out.trim().split("\n");

    let inNvmeSmart = false;
    const nvmeSmartLines: string[] = [];

    for (const line of lines) {
        if (line === "NVME_SMART_BEGIN") {
            inNvmeSmart = true;
            continue;
        }
        if (line === "NVME_SMART_END") {
            inNvmeSmart = false;
            continue;
        }

        if (inNvmeSmart) {
            nvmeSmartLines.push(line);
            continue;
        }

        const idx = line.indexOf("=");
        if (idx > 0) {
            data[line.slice(0, idx)] = line.slice(idx + 1).trim();
        }
    }

    const throttled = parseThrottledHex(data.THROTTLED || "throttled=0x0");

    const memTotalBytes = Number(data.MEMTOTAL_KB || 0) * 1024;
    const memAvailableBytes = Number(data.MEMAVAILABLE_KB || 0) * 1024;
    const memUsedBytes =
        Number.isFinite(memTotalBytes) && Number.isFinite(memAvailableBytes)
            ? Math.max(0, memTotalBytes - memAvailableBytes)
            : NaN;

    const nvmeSmartRaw = nvmeSmartLines.join("\n");
    const nvmeHealth = parseSmartHealth(nvmeSmartRaw);
    const nvmeSmartTemp = cleanNvmeTemp(parseSmartValue(nvmeSmartRaw, "Temperature"));
    const nvmePercentageUsed =
        parseSmartValue(nvmeSmartRaw, "Percentage Used") !== "--"
            ? parseSmartValue(nvmeSmartRaw, "Percentage Used")
            : parseSmartValue(nvmeSmartRaw, "Percentage Used Endurance Indicator");
    const nvmePowerOnHours = formatHours(parseSmartValue(nvmeSmartRaw, "Power On Hours"));
    const nvmeUnsafeShutdowns = parseSmartValue(nvmeSmartRaw, "Unsafe Shutdowns");
    const nvmeMediaErrors = parseSmartValue(nvmeSmartRaw, "Media and Data Integrity Errors");

    const coreV = extractNumericValue(data.PMIC_CORE_V || "");
    const coreA = extractNumericValue(data.PMIC_CORE_A || "");
    const corePower =
        Number.isFinite(coreV) && Number.isFinite(coreA)
            ? `${(coreV * coreA).toFixed(2)} W`
            : "--";
    const coreDetail =
        Number.isFinite(coreV) && Number.isFinite(coreA)
            ? `${coreV.toFixed(4)} V × ${coreA.toFixed(4)} A`
            : "--";

    return {
        thermal: {
            cpuTemp: formatTemp(data.CPU || ""),
            nvmeTemp: data.NVME ? formatTemp(data.NVME) : "--",
            ioTemp: formatTemp(data.RP1 || ""),
            pmicTemp: data.PMIC_TEMP ? formatTemp(data.PMIC_TEMP) : "--",
            fanRpm: data.FAN ? formatRpm(data.FAN) : "--",
            fanPwm: data.PWM ? formatPercentFromPwm(data.PWM) : "--",
        },
        power: {
            raw: throttled.raw,
            rawText: throttled.rawText,
            powerHealth: throttled.powerHealth,
            currentUndervoltage: throttled.currentUndervoltage,
            undervoltageSinceBoot: throttled.undervoltageSinceBoot,
            currentThrottled: throttled.currentThrottled,
            throttledSinceBoot: throttled.throttledSinceBoot,
            currentFreqCap: throttled.currentFreqCap,
            freqCapSinceBoot: throttled.freqCapSinceBoot,
            currentSoftTempLimit: throttled.currentSoftTempLimit,
            softTempLimitSinceBoot: throttled.softTempLimitSinceBoot,
        },
        system: {
            piModel: data.PI_MODEL || "--",
            cpuFrequency: formatCpuFreq(data.CPU_FREQ_KHZ || ""),
            totalRam: formatBytesGiB(memTotalBytes),
            memoryUsage: formatMemUsage(memUsedBytes, memTotalBytes),
            uptime: formatUptime(data.UPTIME || ""),
            kernel: data.KERNEL || "--",
            loadAverage: data.LOAD_AVG || "--",
            rootFilesystemUsed: data.ROOTFS_USED_PCT || "--",
        },
        boot: {
            bootDevice: classifyBootDevice(data.ROOT_DEVICE || "--"),
            rootDevice: data.ROOT_DEVICE || "--",
            nvmePresent: formatYesNoFromZeroOne(data.NVME_PRESENT || "0"),
            fanPresent: formatYesNoFromZeroOne(data.FAN_PRESENT || "0"),
        },
        nvme: {
            model: data.NVME_MODEL || "--",
            capacity: formatBytesDecimal(data.NVME_SIZE_BYTES || ""),
            firmware: data.NVME_FIRMWARE || "--",
            health: nvmeHealth,
            healthDetail: nvmeHealth !== "--" ? "SMART status" : "--",
            smartTemp: nvmeSmartTemp,
            percentageUsed: nvmePercentageUsed,
            powerOnHours: nvmePowerOnHours,
            unsafeShutdowns: nvmeUnsafeShutdowns,
            mediaErrors: nvmeMediaErrors,
            mountedAt: data.NVME_MOUNT_POINT || "--",
        },
        sd: {
            present: formatYesNoFromZeroOne(data.SD_PRESENT || "0"),
            device: data.SD_MOUNT_DEVICE || data.SD_DEVICE || "--",
            capacity: formatBytesDecimal(data.SD_SIZE_BYTES || ""),
            cardUsed: data.SD_USED_PCT || "--",
            vendor: decodeSdVendor(data.SD_VENDOR || ""),
            name: data.SD_NAME || "--",
            serial: data.SD_SERIAL || "--",
            mountedAt: data.SD_MOUNT_POINT || "--",
        },
        usbStorage: {
            present: formatYesNoFromZeroOne(data.USB_STORAGE_PRESENT || "0"),
            model: data.USB_STORAGE_MODEL || "--",
            capacity: formatBytesDecimal(data.USB_STORAGE_SIZE_BYTES || ""),
            freeSpace: formatBytesDecimal(data.USB_STORAGE_FREE_BYTES || ""),
            devicePath: data.USB_STORAGE_DEVICE || "--",
            mountedAt: data.USB_STORAGE_MOUNT_POINT || "--",
        },
        pcie: {
            currentLinkSpeed: data.PCIE_CURRENT_LINK_SPEED || "--",
            currentLinkWidth: data.PCIE_CURRENT_LINK_WIDTH ? `x${data.PCIE_CURRENT_LINK_WIDTH}` : "--",
            maxLinkSpeed: data.PCIE_MAX_LINK_SPEED || "--",
            maxLinkWidth: data.PCIE_MAX_LINK_WIDTH ? `x${data.PCIE_MAX_LINK_WIDTH}` : "--",
        },
        psu: {
            inputVoltage: Number.isFinite(extractNumericValue(data.PMIC_EXT5V_V || ""))
                ? `${extractNumericValue(data.PMIC_EXT5V_V || "").toFixed(4)} V`
                : "--",
            negotiatedCurrentLimit: formatMilliAmps(data.PSU_MAX_CURRENT_MA || ""),
            usbCurrentLimitMode: formatUsbCurrentLimitMode(data.USB_MAX_CURRENT_ENABLE || ""),
            usbOverCurrentAtBoot: formatYesNoFromZeroOne(data.USB_OVER_CURRENT_DETECTED || ""),
        },
        voltages: {
            coreVoltage: extractValueAfterEquals(data.VOLT_CORE || ""),
            sdramC: extractValueAfterEquals(data.VOLT_SDRAM_C || ""),
            sdramI: extractValueAfterEquals(data.VOLT_SDRAM_I || ""),
            sdramP: extractValueAfterEquals(data.VOLT_SDRAM_P || ""),
        },
        clocks: {
            armClock: formatClock(data.CLOCK_ARM || ""),
            coreClock: formatClock(data.CLOCK_CORE || ""),
            emmcClock: formatClock(data.CLOCK_EMMC || ""),
        },
        advanced: {
            firmwareVersion: data.VCGEN_VERSION || "--",
            ringOscillator: formatRingOsc(data.RING_OSC || ""),
            coreRailPower: corePower,
            coreRailDetail: coreDetail,
        },
        history: defaultHistorySummaryState(),
    };
}

/*
 * Main Pi 5 Hardware Monitor application component.
 * Handles live refresh loops, persisted UI state, history selection, and page render.
 */
export const Application = () => {
    const [liveDataOnline, setLiveDataOnline] = useState(false);
    const [monitor, setMonitor] = useState<MonitorState>(defaultMonitorState());
    const [historyDays, setHistoryDays] = useState<HistoryDaySummary[]>([]);
    const [historySamples, setHistorySamples] = useState<HistorySampleSummary[]>([]);
    const [nodeTimeZone, setNodeTimeZone] = useState("UTC");
    const [selectedHistoryDayKey, setSelectedHistoryDayKey] = useState("");
    const [selectedHistorySampleKey, setSelectedHistorySampleKey] = useState("");
    const [isHistoryDayOpen, setIsHistoryDayOpen] = useState(false);
    const [isHistorySampleOpen, setIsHistorySampleOpen] = useState(false);
    const selectedHistorySampleOptionRef = useRef<HTMLElement | null>(null);
    const [isSectionsOpen, setIsSectionsOpen] = useState(false);
    const [visibleSections, setVisibleSections] =
        useState<Record<SectionKey, boolean>>(() => {
            try {
                const raw = window.localStorage.getItem(SECTION_STORAGE_KEY);
                if (!raw) return DEFAULT_VISIBLE_SECTIONS;

                const parsed = JSON.parse(raw) as Partial<Record<SectionKey, boolean>>;
                return { ...DEFAULT_VISIBLE_SECTIONS, ...parsed };
            } catch {
                return DEFAULT_VISIBLE_SECTIONS;
            }
        });

    /*
     * Live refresh loop for both current sensor data and history summaries.
     * Keeps the UI updated while also tracking whether live reads are online.
     */
    useEffect(() => {
        let cancelled = false;
        let lastSnapshot = "";
        let stallTimer: number | undefined;

        const markOnline = () => {
            if (cancelled) return;
            setLiveDataOnline(true);

            if (stallTimer !== undefined) {
                window.clearTimeout(stallTimer);
            }

            stallTimer = window.setTimeout(() => {
                if (!cancelled) {
                    setLiveDataOnline(false);
                }
            }, 2500);
        };

        const refreshLoop = async (): Promise<void> => {
            try {
                const [data, historyView] = await Promise.all([
                    readMonitorData(),
                    readHistoryView(),
                ]);
                if (cancelled) return;

                const combined = {
                    ...data,
                    history: historyView.summary,
                };
                const snapshot = JSON.stringify({
                    combined,
                    historyDays: historyView.days,
                    historySamples: historyView.samples,
                    nodeTimeZone: historyView.timeZone,
                });

                if (snapshot !== lastSnapshot) {
                    lastSnapshot = snapshot;
                    setMonitor(combined);
                    setHistoryDays(historyView.days);
                    setHistorySamples(historyView.samples);
                    setNodeTimeZone(historyView.timeZone);
                    setSelectedHistoryDayKey(prev => {
                        if (historyView.days.length === 0) return "";

                        const todayKey = getTodayHistoryDayKey(historyView.timeZone);

                        if (historyView.days.some(day => day.dayKey === prev)) return prev;
                        if (historyView.days.some(day => day.dayKey === todayKey)) return todayKey;

                        return historyView.days[0].dayKey;
                    });
                }

                markOnline();

                window.setTimeout(() => {
                    if (!cancelled) {
                        refreshLoop().catch(() => undefined);
                    }
                }, 250);
            } catch {
                if (cancelled) return;

                setLiveDataOnline(false);

                window.setTimeout(() => {
                    if (!cancelled) {
                        refreshLoop().catch(() => undefined);
                    }
                }, 1000);
            }
        };

        refreshLoop().catch(() => undefined);

        return () => {
            cancelled = true;
            if (stallTimer !== undefined) {
                window.clearTimeout(stallTimer);
            }
        };
    }, []);

    /*
     * Persist the Show/Hide Sections choices in browser local storage.
     */
    useEffect(() => {
        try {
            window.localStorage.setItem(
                SECTION_STORAGE_KEY,
                JSON.stringify(visibleSections)
            );
        } catch {
            // ignore storage failures
        }
    }, [visibleSections]);

    /*
     * Keep the selected history sample aligned with the selected day.
     */
    useEffect(() => {
        if (!selectedHistoryDayKey) {
            setSelectedHistorySampleKey("");
            return;
        }

        const daySamples = historySamples.filter(sample => sample.dayKey === selectedHistoryDayKey);

        if (daySamples.length === 0) {
            setSelectedHistorySampleKey("");
            return;
        }

        if (!daySamples.some(sample => sample.sampleKey === selectedHistorySampleKey)) {
            setSelectedHistorySampleKey(daySamples[0].sampleKey);
        }
    }, [historySamples, selectedHistoryDayKey, selectedHistorySampleKey]);

    /*
     * When reopening the sample dropdown, scroll the current sample into view.
     */
    useEffect(() => {
        if (!isHistorySampleOpen) return;

        window.setTimeout(() => {
            selectedHistorySampleOptionRef.current?.scrollIntoView({
                block: "center",
            });
        }, 0);
    }, [isHistorySampleOpen, selectedHistorySampleKey]);

    const showNvmeDependentItems = visibleSections.nvme;
    const showPcieSection = visibleSections.nvme && visibleSections.pcie;
    const showFanCard = monitor.thermal.fanRpm !== "--" || monitor.thermal.fanPwm !== "--";
    const showUsbStorageSection = monitor.usbStorage.present === "Yes";
    const selectedHistoryDay = historyDays.find(day => day.dayKey === selectedHistoryDayKey) || null;
    const selectedDaySamples = historySamples.filter(sample => sample.dayKey === selectedHistoryDayKey);
    const selectedHistorySample =
        selectedDaySamples.find(sample => sample.sampleKey === selectedHistorySampleKey) ||
        selectedDaySamples[0] ||
        null;

    /*
     * Render the full Cockpit page layout and all enabled monitor sections.
     */
    return (
        <Page className="pf-m-no-sidebar ct-content-gap">
            <PageSection variant="secondary" isFilled>
                <Card isPlain className="pi-card-service-like">
                    <CardBody>
                        <Flex
                            justifyContent={{ default: "justifyContentSpaceBetween" }}
                            alignItems={{ default: "alignItemsFlexStart" }}
                        >
                            <FlexItem flex={{ default: "flex_1" }}>
                                <Title headingLevel="h1">Raspberry Pi 5 Hardware Monitor</Title>
                                <Content component={ContentVariants.p}>
                                    Ver. 1.2 - April 2026
                                </Content>
                            </FlexItem>

                            <FlexItem>
                                <Card
                                    isCompact
                                    className={`pi-live-data-card ${liveDataOnline ? "pi-live-data-card-online" : "pi-live-data-card-offline"}`}
                                >
                                    <CardBody>
                                        <Title headingLevel="h3">
                                            <span>Live Sensor Data</span>
                                            <br />
                                            <span>{liveDataOnline ? "Online" : "Offline"}</span>
                                        </Title>
                                    </CardBody>
                                </Card>
                            </FlexItem>

                            <FlexItem flex={{ default: "flex_1" }}>
                                <Flex
                                    direction={{ default: "column" }}
                                    spaceItems={{ default: "spaceItemsSm" }}
                                    alignItems={{ default: "alignItemsFlexEnd" }}
                                >
                                    <FlexItem>
                                        <Select
                                            isOpen={isSectionsOpen}
                                            onOpenChange={setIsSectionsOpen}
                                            popperProps={{
                                                direction: "down",
                                                position: "right",
                                                enableFlip: true,
                                                preventOverflow: true,
                                            }}
                                            onSelect={(_, value) => {
                                                const key = value as SectionKey;

                                                setVisibleSections(prev => ({
                                                    ...prev,
                                                    [key]: !prev[key],
                                                }));
                                            }}
                                            selected={Object.keys(visibleSections).filter(
                                                key => visibleSections[key as SectionKey]
                                            )}
                                            role="menu"
                                            toggle={(toggleRef) => (
                                                <MenuToggle
                                                    ref={toggleRef}
                                                    onClick={() => setIsSectionsOpen(prev => !prev)}
                                                    isExpanded={isSectionsOpen}
                                                >
                                                    Show/Hide Sections
                                                </MenuToggle>
                                            )}
                                        >
                                            <SelectList>
                                                {(Object.keys(SECTION_LABELS) as SectionKey[]).map((key) => (
                                                    <SelectOption
                                                        key={key}
                                                        value={key}
                                                        hasCheckbox
                                                        isSelected={visibleSections[key]}
                                                    >
                                                        {SECTION_LABELS[key]}
                                                    </SelectOption>
                                                ))}
                                            </SelectList>
                                        </Select>
                                    </FlexItem>

                                </Flex>
                            </FlexItem>
                        </Flex>

                        {/* Thermal / Cooling section: live temperature and fan telemetry cards. */}
                        {visibleSections.thermal && (
                            <>
                                <Content>
                                    <Title headingLevel="h2">Thermal / Cooling</Title>
                                    <Content component={ContentVariants.small}>
                                        Core temperature and fan telemetry. Border color guide: Blue = Cool · Green = Normal · Yellow = Warm · Red = Hot
                                    </Content>
                                </Content>
                                <Gallery hasGutter minWidths={{ default: "220px" }}>
                                    <Card isCompact className={getTempStatusClass(monitor.thermal.cpuTemp)}>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">CPU Temp</Title>
                                            <Title headingLevel="h3">{monitor.thermal.cpuTemp}</Title>
                                        </CardBody>
                                    </Card>
                                    {showNvmeDependentItems && (
                                        <Card isCompact className={getNvmeTempStatusClass(monitor.thermal.nvmeTemp)}>
                                            <CardBody>
                                                <Title headingLevel="h4" size="md" className="pi-card-label">NVMe Temp</Title>
                                                <Title headingLevel="h3">{monitor.thermal.nvmeTemp}</Title>
                                            </CardBody>
                                        </Card>
                                    )}
                                    <Card isCompact className={getIoTempStatusClass(monitor.thermal.ioTemp)}>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">I/O Temp</Title>
                                            <Title headingLevel="h3">{monitor.thermal.ioTemp}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact className={getIoTempStatusClass(monitor.thermal.pmicTemp)}>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Power Chip Temp</Title>
                                            <Title headingLevel="h3">{monitor.thermal.pmicTemp}</Title>
                                        </CardBody>
                                    </Card>
                                    {showFanCard && (
                                        <Card isCompact className={getFanRpmStatusClass(monitor.thermal.fanRpm)}>
                                            <CardBody>
                                                <Flex justifyContent={{ default: "justifyContentSpaceBetween" }}>
                                                    <FlexItem>
                                                        <Title headingLevel="h4" size="md" className="pi-card-label" style={{ marginLeft: "0.5rem" }}>Fan RPM</Title>
                                                    </FlexItem>
                                                    <FlexItem style={{ marginRight: "0.5rem" }}>
                                                        <Title headingLevel="h4" size="md" className="pi-card-label">Power Level</Title>
                                                    </FlexItem>
                                                </Flex>
                                                <Flex justifyContent={{ default: "justifyContentSpaceBetween" }}>
                                                    <FlexItem>
                                                        <Title headingLevel="h4" style={{ marginLeft: "1.5rem" }}>{monitor.thermal.fanRpm}</Title>
                                                    </FlexItem>
                                                    <FlexItem>
                                                        <Title headingLevel="h4" style={{ marginRight: "2rem" }}>{monitor.thermal.fanPwm}</Title>
                                                    </FlexItem>
                                                </Flex>
                                            </CardBody>
                                        </Card>
                                    )}
                                </Gallery>
                            </>
                        )}

                        {/* History / Trends section: rolling summary plus Last 5 Days detail view. */}
                        {visibleSections.history && (
                            <>
                                <Content>
                                    <Title headingLevel="h2">History / Trends</Title>
                                    <Content component={ContentVariants.small}>
                                        Rolling Pi-specific history from the local collector. This summarizes the stored 5-day NDJSON data and avoids duplicating Cockpit Metrics.
                                    </Content>
                                </Content>
                                <Gallery hasGutter minWidths={{ default: "220px" }}>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">CPU Temp Range</Title>
                                            <Title headingLevel="h3">{monitor.history.cpuTempLow}<span style={{ marginLeft: "0.3rem" }}>Lows</span></Title>
                                            <Title headingLevel="h3">{monitor.history.cpuTempHigh}<span style={{ marginLeft: "0.3rem" }}>Highs</span></Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">I/O Temp Range</Title>
                                            <Title headingLevel="h3">{monitor.history.ioTempLow}<span style={{ marginLeft: "0.3rem" }}>Lows</span></Title>
                                            <Title headingLevel="h3">{monitor.history.ioTempHigh}<span style={{ marginLeft: "0.3rem" }}>Highs</span></Title>
                                        </CardBody>
                                    </Card>
                                    {showNvmeDependentItems && monitor.history.nvmeTempLow !== "--" && (
                                        <Card isCompact>
                                            <CardBody>
                                                <Title headingLevel="h4" size="md" className="pi-card-label">NVMe Temp Range</Title>
                                                <Title headingLevel="h3">{monitor.history.nvmeTempLow}<span style={{ marginLeft: "0.3rem" }}>Lows</span></Title>
                                                <Title headingLevel="h3">{monitor.history.nvmeTempHigh}<span style={{ marginLeft: "0.3rem" }}>Highs</span></Title>
                                            </CardBody>
                                        </Card>
                                    )}
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Power Chip Temp Range</Title>
                                            <Title headingLevel="h3">{monitor.history.pmicTempLow}<span style={{ marginLeft: "0.3rem" }}>Lows</span></Title>
                                            <Title headingLevel="h3">{monitor.history.pmicTempHigh}<span style={{ marginLeft: "0.3rem" }}>Highs</span></Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">History Available</Title>
                                            <Title headingLevel="h3">{monitor.history.available}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Samples Stored</Title>
                                            <Title headingLevel="h3">{monitor.history.sampleCount}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Sample Span</Title>
                                            <Title headingLevel="h3">{monitor.history.windowDays}</Title>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Latest sample {monitor.history.latestSampleAge}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Undervoltage Events</Title>
                                            <Title headingLevel="h3">{monitor.history.undervoltageEvents}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Throttled Events</Title>
                                            <Title headingLevel="h3">{monitor.history.throttledEvents}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Freq Cap Events</Title>
                                            <Title headingLevel="h3">{monitor.history.freqCapEvents}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Soft Temp Limit Events</Title>
                                            <Title headingLevel="h3">{monitor.history.softTempLimitEvents}</Title>
                                        </CardBody>
                                    </Card>
                                </Gallery>
                                {historyDays.length > 0 && selectedHistoryDay && (
                                    <>
                                        <Content>
                                            <Title headingLevel="h3">Last 5 Days</Title>
                                            <Content component={ContentVariants.small}>
                                                Default view follows today in the node timezone ({nodeTimeZone}) when available and the newest stored sample for that day. You can also pick any stored sample from the selected day.
                                            </Content>
                                        </Content>
                                        <Gallery hasGutter minWidths={{ default: "220px" }}>
                                            <Card isCompact>
                                                <CardBody>
                                                    <Title headingLevel="h4" size="md" className="pi-card-label">Selected Day</Title>
                                                    <Flex
                                                        direction={{ default: "column" }}
                                                        spaceItems={{ default: "spaceItemsSm" }}
                                                        alignItems={{ default: "alignItemsCenter" }}
                                                    >
                                                        <FlexItem>
                                                            <Select
                                                                isOpen={isHistoryDayOpen}
                                                                onOpenChange={setIsHistoryDayOpen}
                                                                selected={selectedHistoryDayKey}
                                                                popperProps={{
                                                                    direction: "down",
                                                                    position: "left",
                                                                    enableFlip: true,
                                                                    preventOverflow: true,
                                                                }}
                                                                onSelect={(_, value) => {
                                                                    setSelectedHistoryDayKey(String(value));
                                                                    setIsHistoryDayOpen(false);
                                                                }}
                                                                toggle={(toggleRef) => (
                                                                    <MenuToggle
                                                                        ref={toggleRef}
                                                                        onClick={() => setIsHistoryDayOpen(prev => !prev)}
                                                                        isExpanded={isHistoryDayOpen}
                                                                    >
                                                                        {selectedHistoryDay.dayLabel}
                                                                    </MenuToggle>
                                                                )}
                                                            >
                                                                <SelectList>
                                                                    {historyDays.map((day) => (
                                                                        <SelectOption
                                                                            key={day.dayKey}
                                                                            value={day.dayKey}
                                                                            isSelected={day.dayKey === selectedHistoryDayKey}
                                                                        >
                                                                            {day.dayLabel}
                                                                        </SelectOption>
                                                                    ))}
                                                                </SelectList>
                                                            </Select>
                                                        </FlexItem>
                                                        <FlexItem>
                                                            <Content component={ContentVariants.small}>
                                                                History Available {selectedHistoryDay.available}
                                                            </Content>
                                                        </FlexItem>
                                                    </Flex>
                                                </CardBody>
                                            </Card>
                                            <Card isCompact>
                                                <CardBody>
                                                    <Title headingLevel="h4" size="md" className="pi-card-label">Selected Sample</Title>
                                                    <Flex
                                                        direction={{ default: "column" }}
                                                        spaceItems={{ default: "spaceItemsSm" }}
                                                        alignItems={{ default: "alignItemsCenter" }}
                                                    >
                                                        <FlexItem>
                                                            <Select
                                                                isOpen={isHistorySampleOpen}
                                                                onOpenChange={setIsHistorySampleOpen}
                                                                selected={selectedHistorySampleKey}
                                                                popperProps={{
                                                                    direction: "down",
                                                                    position: "left",
                                                                    enableFlip: true,
                                                                    preventOverflow: true,
                                                                }}
                                                                onSelect={(_, value) => {
                                                                    setSelectedHistorySampleKey(String(value));
                                                                    setIsHistorySampleOpen(false);
                                                                }}
                                                                toggle={(toggleRef) => (
                                                                    <MenuToggle
                                                                        ref={toggleRef}
                                                                        onClick={() => setIsHistorySampleOpen(prev => !prev)}
                                                                        isExpanded={isHistorySampleOpen}
                                                                        isDisabled={selectedDaySamples.length === 0}
                                                                    >
                                                                        {selectedHistorySample ? selectedHistorySample.sampleLabel : "No Samples"}
                                                                    </MenuToggle>
                                                                )}
                                                            >
                                                                <SelectList style={{ maxHeight: "16rem", overflowY: "auto" }}>
                                                                    {selectedDaySamples.map((sample) => (
                                                                        <SelectOption
                                                                            key={sample.sampleKey}
                                                                            value={sample.sampleKey}
                                                                            isSelected={sample.sampleKey === selectedHistorySampleKey}
                                                                            ref={(node) => {
                                                                                if (sample.sampleKey === selectedHistorySampleKey) {
                                                                                    selectedHistorySampleOptionRef.current = node;
                                                                                }
                                                                            }}
                                                                        >
                                                                            {sample.sampleLabel}
                                                                        </SelectOption>
                                                                    ))}
                                                                </SelectList>
                                                            </Select>
                                                        </FlexItem>
                                                        <FlexItem>
                                                            <Content component={ContentVariants.small}>
                                                                Sample Age {selectedHistorySample ? selectedHistorySample.sampleAge : "--"}
                                                            </Content>
                                                        </FlexItem>
                                                    </Flex>
                                                </CardBody>
                                            </Card>
                                            <Card isCompact>
                                                <CardBody>
                                                    <Title headingLevel="h4" size="md" className="pi-card-label">Samples Stored</Title>
                                                    <Title headingLevel="h3">{selectedHistoryDay.sampleCount}</Title>
                                                </CardBody>
                                            </Card>
                                            <Card isCompact>
                                                <CardBody>
                                                    <Title headingLevel="h4" size="md" className="pi-card-label">Sample Span</Title>
                                                    <Title headingLevel="h3">{selectedHistoryDay.windowDays}</Title><br />
                                                    <Title headingLevel="h4" size="md" className="pi-card-label">Latest sample {selectedHistoryDay.latestSampleAge}</Title>
                                                </CardBody>
                                            </Card>
                                            <Card isCompact>
                                                <CardBody>
                                                    <Title headingLevel="h4" size="md" className="pi-card-label">CPU Temp</Title>
                                                    <Title headingLevel="h3">{selectedHistorySample ? selectedHistorySample.cpuTemp : "--"}</Title>
                                                </CardBody>
                                            </Card>
                                            <Card isCompact>
                                                <CardBody>
                                                    <Title headingLevel="h4" size="md" className="pi-card-label">I/O Temp</Title>
                                                    <Title headingLevel="h3">{selectedHistorySample ? selectedHistorySample.ioTemp : "--"}</Title>
                                                </CardBody>
                                            </Card>
                                            {showNvmeDependentItems && selectedHistorySample && selectedHistorySample.nvmeTemp !== "--" && (
                                                <Card isCompact>
                                                    <CardBody>
                                                        <Title headingLevel="h4" size="md" className="pi-card-label">NVMe Temp</Title>
                                                        <Title headingLevel="h3">{selectedHistorySample.nvmeTemp}</Title>
                                                    </CardBody>
                                                </Card>
                                            )}
                                            <Card isCompact>
                                                <CardBody>
                                                    <Title headingLevel="h4" size="md" className="pi-card-label">Power Chip Temp</Title>
                                                    <Title headingLevel="h3">{selectedHistorySample ? selectedHistorySample.pmicTemp : "--"}</Title>
                                                </CardBody>
                                            </Card>
                                            <Card isCompact>
                                                <CardBody>
                                                    <Title headingLevel="h4" size="md" className="pi-card-label">Undervoltage</Title>
                                                    <Title headingLevel="h3">{selectedHistorySample ? selectedHistorySample.undervoltage : "--"}</Title>
                                                </CardBody>
                                            </Card>
                                            <Card isCompact>
                                                <CardBody>
                                                    <Title headingLevel="h4" size="md" className="pi-card-label">Throttled</Title>
                                                    <Title headingLevel="h3">{selectedHistorySample ? selectedHistorySample.throttled : "--"}</Title>
                                                </CardBody>
                                            </Card>
                                            <Card isCompact>
                                                <CardBody>
                                                    <Title headingLevel="h4" size="md" className="pi-card-label">Freq Cap</Title>
                                                    <Title headingLevel="h3">{selectedHistorySample ? selectedHistorySample.freqCap : "--"}</Title>
                                                </CardBody>
                                            </Card>
                                            <Card isCompact>
                                                <CardBody>
                                                    <Title headingLevel="h4" size="md" className="pi-card-label">Soft Temp Limit</Title>
                                                    <Title headingLevel="h3">{selectedHistorySample ? selectedHistorySample.softTempLimit : "--"}</Title>
                                                </CardBody>
                                            </Card>
                                        </Gallery>
                                    </>
                                )}
                            </>
                        )}

                        {/* Power / Throttling section: current and since-boot power/thermal flags. */}
                        {visibleSections.power && (
                            <>
                                <Content>
                                    <Title headingLevel="h2">Power / Throttling</Title>
                                    <Content component={ContentVariants.small}>
                                        Undervoltage, throttling, frequency cap, and temperature-limit status
                                    </Content>
                                </Content>
                                <Gallery hasGutter minWidths={{ default: "220px" }}>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Power Health</Title>
                                            <Title headingLevel="h3" className={getPowerHealthTextClass(monitor.power.powerHealth)}>
                                                {monitor.power.powerHealth}
                                            </Title>
                                            <Content component={ContentVariants.small}>{monitor.power.rawText}</Content>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Current Undervoltage</Title>
                                            <Title headingLevel="h3">{monitor.power.currentUndervoltage}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Undervoltage Since Boot</Title>
                                            <Title headingLevel="h3">{monitor.power.undervoltageSinceBoot}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Current Throttled</Title>
                                            <Title headingLevel="h3">{monitor.power.currentThrottled}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Throttled Since Boot</Title>
                                            <Title headingLevel="h3">{monitor.power.throttledSinceBoot}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Current Freq Cap</Title>
                                            <Title headingLevel="h3">{monitor.power.currentFreqCap}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Freq Cap Since Boot</Title>
                                            <Title headingLevel="h3">{monitor.power.freqCapSinceBoot}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Current Soft Temp Limit</Title>
                                            <Title headingLevel="h3">{monitor.power.currentSoftTempLimit}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Soft Temp Limit Since Boot</Title>
                                            <Title headingLevel="h3">{monitor.power.softTempLimitSinceBoot}</Title>
                                        </CardBody>
                                    </Card>
                                </Gallery>
                            </>
                        )}

                        {/* System Summary section: model, RAM, uptime, load, and root usage. */}
                        {visibleSections.system && (
                            <>
                                <Content>
                                    <Title headingLevel="h2">System Summary</Title>
                                    <Content component={ContentVariants.small}>
                                        Model, kernel, uptime, load, and memory
                                    </Content>
                                </Content>
                                <Gallery hasGutter minWidths={{ default: "220px" }}>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Pi Model</Title>
                                            <Title headingLevel="h3">{monitor.system.piModel}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">CPU Frequency</Title>
                                            <Title headingLevel="h3">{monitor.system.cpuFrequency}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Total RAM</Title>
                                            <Title headingLevel="h3">{monitor.system.totalRam}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Memory Usage</Title>
                                            <Title headingLevel="h3">{monitor.system.memoryUsage}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Uptime</Title>
                                            <Title headingLevel="h3">{monitor.system.uptime}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Kernel</Title>
                                            <Title headingLevel="h3">{monitor.system.kernel}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Load Average</Title>
                                            <Flex justifyContent={{ default: "justifyContentSpaceBetween" }}>
                                                <FlexItem>
                                                    <Title headingLevel="h4" size="md" className="pi-card-label">&nbsp;&nbsp;&nbsp;1m</Title>
                                                </FlexItem>
                                                <FlexItem>
                                                    <Title headingLevel="h4" size="md" className="pi-card-label">&nbsp;5m</Title>
                                                </FlexItem>
                                                <FlexItem style={{ marginRight: "0.5rem" }}>
                                                    <Title headingLevel="h4" size="md" className="pi-card-label">15m</Title>
                                                </FlexItem>
                                            </Flex>
                                            <Flex justifyContent={{ default: "justifyContentSpaceBetween" }}>
                                                <FlexItem style={{ marginLeft: "0.3rem" }}>
                                                    <Title headingLevel="h3">{monitor.system.loadAverage.split(" ")[0] || "--"}</Title>
                                                </FlexItem>
                                                <FlexItem>
                                                    <Title headingLevel="h3">{monitor.system.loadAverage.split(" ")[1] || "--"}</Title>
                                                </FlexItem>
                                                <FlexItem style={{ marginRight: "0.3rem" }}>
                                                    <Title headingLevel="h3">{monitor.system.loadAverage.split(" ")[2] || "--"}</Title>
                                                </FlexItem>
                                            </Flex>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Root Filesystem Used</Title>
                                            <Title headingLevel="h3">{monitor.system.rootFilesystemUsed}</Title>
                                        </CardBody>
                                    </Card>
                                </Gallery>
                            </>
                        )}

                        {/* Boot / Device Info section: root device and detected hardware presence. */}
                        {visibleSections.boot && (
                            <>
                                <Content>
                                    <Title headingLevel="h2">Boot / Device Info</Title>
                                    <Content component={ContentVariants.small}>
                                        Root device, storage type, and hardware presence
                                    </Content>
                                </Content>
                                <Gallery hasGutter minWidths={{ default: "220px" }}>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Boot Device</Title>
                                            <Title headingLevel="h3">{monitor.boot.bootDevice}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Root Device</Title>
                                            <Title headingLevel="h3">{monitor.boot.rootDevice}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">NVMe Present</Title>
                                            <Title headingLevel="h3">{monitor.boot.nvmePresent}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Fan Present</Title>
                                            <Title headingLevel="h3">{monitor.boot.fanPresent}</Title>
                                        </CardBody>
                                    </Card>
                                </Gallery>
                            </>
                        )}

                        {/* NVMe Drive section: drive identity, SMART health, and mount point. */}
                        {visibleSections.nvme && (
                            <>
                                <Content>
                                    <Title headingLevel="h2">NVMe Drive</Title>
                                    <Content component={ContentVariants.small}>
                                        Drive identity, firmware, temperature, and SMART status
                                    </Content>
                                </Content>
                                <Gallery hasGutter minWidths={{ default: "220px" }}>
                                    <Card isCompact className={getNvmeTempStatusClass(monitor.nvme.smartTemp)}>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">SMART Temp</Title>
                                            <Title headingLevel="h3">{monitor.nvme.smartTemp}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Model</Title>
                                            <Title headingLevel="h3">{monitor.nvme.model}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Capacity</Title>
                                            <Title headingLevel="h3">{monitor.nvme.capacity}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Health</Title>
                                            <Title headingLevel="h3">{monitor.nvme.health}</Title>
                                            <Content component={ContentVariants.small}>{monitor.nvme.healthDetail}</Content>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Firmware</Title>
                                            <Title headingLevel="h3">{monitor.nvme.firmware}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">% of Drive Life Used</Title>
                                            <Title headingLevel="h3">{monitor.nvme.percentageUsed}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Power-on Hours</Title>
                                            <Title headingLevel="h3">{monitor.nvme.powerOnHours}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Unsafe Shutdowns</Title>
                                            <Title headingLevel="h3">{monitor.nvme.unsafeShutdowns}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Media Errors</Title>
                                            <Title headingLevel="h3">{monitor.nvme.mediaErrors}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Mounted At</Title>
                                            <Title headingLevel="h3">{monitor.nvme.mountedAt}</Title>
                                        </CardBody>
                                    </Card>
                                </Gallery>
                            </>
                        )}

                        {/* SD Card section: card presence, identity, usage, and mount point. */}
                        {visibleSections.sd && (
                            <>
                                <Content>
                                    <Title headingLevel="h2">SD Card</Title>
                                    <Content component={ContentVariants.small}>
                                        microSD presence, identity, capacity, and usage
                                    </Content>
                                </Content>
                                <Gallery hasGutter minWidths={{ default: "220px" }}>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Present</Title>
                                            <Title headingLevel="h3">{monitor.sd.present}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Device</Title>
                                            <Title headingLevel="h3">{monitor.sd.device}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Capacity</Title>
                                            <Title headingLevel="h3">{monitor.sd.capacity}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Card Used</Title>
                                            <Title headingLevel="h3">{monitor.sd.cardUsed}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Vendor</Title>
                                            <Title headingLevel="h3">{monitor.sd.vendor}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Model</Title>
                                            <Title headingLevel="h3">{monitor.sd.name}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Serial</Title>
                                            <Title headingLevel="h3">{monitor.sd.serial}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Mounted At</Title>
                                            <Title headingLevel="h3">{monitor.sd.mountedAt}</Title>
                                        </CardBody>
                                    </Card>
                                </Gallery>
                            </>
                        )}

                        {/* External USB Storage section: attached USB storage details when present. */}
                        {showUsbStorageSection && (
                            <>
                                <Content>
                                    <Title headingLevel="h2">External USB Storage</Title>
                                    <Content component={ContentVariants.small}>
                                        Connected USB storage device details
                                    </Content>
                                </Content>
                                <Gallery hasGutter minWidths={{ default: "220px" }}>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Model</Title>
                                            <Title headingLevel="h3">{monitor.usbStorage.model}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Capacity</Title>
                                            <Title headingLevel="h3">{monitor.usbStorage.capacity}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Free Space</Title>
                                            <Title headingLevel="h3">{monitor.usbStorage.freeSpace}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Device Path</Title>
                                            <Title headingLevel="h3">{monitor.usbStorage.devicePath}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Mounted At</Title>
                                            <Title headingLevel="h3">{monitor.usbStorage.mountedAt}</Title>
                                        </CardBody>
                                    </Card>
                                </Gallery>
                            </>
                        )}

                        {/* PCIe / NVMe Link section: negotiated and maximum PCIe link details. */}
                        {showPcieSection && (
                            <>
                                <Content>
                                    <Title headingLevel="h2">PCIe / NVMe Link</Title>
                                    <Content component={ContentVariants.small}>
                                        Current negotiated PCIe link status for the NVMe controller
                                    </Content>
                                </Content>
                                <Gallery hasGutter minWidths={{ default: "220px" }}>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Current Link Speed</Title>
                                            <Title headingLevel="h3">{monitor.pcie.currentLinkSpeed}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Current Link Width</Title>
                                            <Title headingLevel="h3">{monitor.pcie.currentLinkWidth}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Max Link Speed</Title>
                                            <Title headingLevel="h3">{monitor.pcie.maxLinkSpeed}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Max Link Width</Title>
                                            <Title headingLevel="h3">{monitor.pcie.maxLinkWidth}</Title>
                                        </CardBody>
                                    </Card>
                                </Gallery>
                            </>
                        )}

                        {/* Power Supply section: input voltage and negotiated power state. */}
                        {visibleSections.psu && (
                            <>
                                <Content>
                                    <Title headingLevel="h2">Power Supply</Title>
                                    <Content component={ContentVariants.small}>
                                        Input voltage and negotiated power-supply status
                                    </Content>
                                </Content>
                                <Gallery hasGutter minWidths={{ default: "220px" }}>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Input Voltage</Title>
                                            <Title headingLevel="h3">{monitor.psu.inputVoltage}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Negotiated Current Limit</Title>
                                            <Title headingLevel="h3">{monitor.psu.negotiatedCurrentLimit}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">USB Current Limit Mode</Title>
                                            <Title headingLevel="h3">{monitor.psu.usbCurrentLimitMode}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">USB Over-current at Boot</Title>
                                            <Title headingLevel="h3">{monitor.psu.usbOverCurrentAtBoot}</Title>
                                        </CardBody>
                                    </Card>
                                </Gallery>
                            </>
                        )}

                        {/* Voltages section: Pi firmware-reported rail voltages. */}
                        {visibleSections.voltages && (
                            <>
                                <Content>
                                    <Title headingLevel="h2">Voltages</Title>
                                    <Content component={ContentVariants.small}>
                                        Pi firmware voltage readings
                                    </Content>
                                </Content>
                                <Gallery hasGutter minWidths={{ default: "220px" }}>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Core Voltage</Title>
                                            <Title headingLevel="h3">{monitor.voltages.coreVoltage}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">SDRAM C</Title>
                                            <Title headingLevel="h3">{monitor.voltages.sdramC}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">SDRAM I</Title>
                                            <Title headingLevel="h3">{monitor.voltages.sdramI}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">SDRAM P</Title>
                                            <Title headingLevel="h3">{monitor.voltages.sdramP}</Title>
                                        </CardBody>
                                    </Card>
                                </Gallery>
                            </>
                        )}

                        {/* Clocks section: current firmware-reported clocks. */}
                        {visibleSections.clocks && (
                            <>
                                <Content>
                                    <Title headingLevel="h2">Clocks</Title>
                                    <Content component={ContentVariants.small}>
                                        Current firmware-reported clock speeds
                                    </Content>
                                </Content>
                                <Gallery hasGutter minWidths={{ default: "220px" }}>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">ARM Clock</Title>
                                            <Title headingLevel="h3">{monitor.clocks.armClock}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Core Clock</Title>
                                            <Title headingLevel="h3">{monitor.clocks.coreClock}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">eMMC Clock</Title>
                                            <Title headingLevel="h3">{monitor.clocks.emmcClock}</Title>
                                        </CardBody>
                                    </Card>
                                </Gallery>
                            </>
                        )}

                        {/* Advanced section: firmware version and extra Pi-specific diagnostics. */}
                        {visibleSections.advanced && (
                            <>
                                <Content>
                                    <Title headingLevel="h2">Advanced</Title>
                                    <Content component={ContentVariants.small}>
                                        Firmware/version details and extra Pi-specific diagnostics
                                    </Content>
                                </Content>
                                <Gallery hasGutter minWidths={{ default: "220px" }}>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Firmware Version</Title>
                                            <Title headingLevel="h3">{monitor.advanced.firmwareVersion}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Ring Oscillator</Title>
                                            <Title headingLevel="h3">{monitor.advanced.ringOscillator}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Core Rail Power</Title>
                                            <Title headingLevel="h3">{monitor.advanced.coreRailPower}</Title>
                                            <Content component={ContentVariants.small}>{monitor.advanced.coreRailDetail}</Content>
                                        </CardBody>
                                    </Card>
                                </Gallery>
                            </>
                        )}

                    </CardBody>
                </Card>
            </PageSection>
        </Page>
    );
};
