import type {
  Container,
  ContainerStatus,
  ContainerType,
} from "../types/container";
import { YARD_CONFIG } from "../types/container";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const OWNERS = [
  "中远海运",
  "马士基",
  "地中海航运",
  "达飞海运",
  "赫伯罗特",
  "中远海控",
  "东方海外",
  "阳明海运",
  "万海航运",
  "太平船务",
];
const STATUSES: ContainerStatus[] = ["import", "export", "transit", "empty"];
const TYPES: ContainerType[] = ["20GP", "40GP", "40HQ"];

function randomLetter(): string {
  return LETTERS[Math.floor(Math.random() * LETTERS.length)];
}

function randomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateContainerNo(): string {
  let no = "";
  for (let i = 0; i < 4; i++) {
    no += randomLetter();
  }
  for (let i = 0; i < 7; i++) {
    no += randomNumber(0, 9);
  }
  return no;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function generateMockContainers(count: number = 600): Container[] {
  const containers: Container[] = [];
  const totalCells = YARD_CONFIG.cols * YARD_CONFIG.rows;
  const capacity = totalCells * YARD_CONFIG.maxTiers;
  const targetCount = Math.min(count, capacity);

  const cellTopTier: number[][] = Array(YARD_CONFIG.cols)
    .fill(null)
    .map(() => Array(YARD_CONFIG.rows).fill(-1));

  const availableCells: { col: number; row: number }[] = [];
  for (let col = 0; col < YARD_CONFIG.cols; col++) {
    for (let row = 0; row < YARD_CONFIG.rows; row++) {
      availableCells.push({ col, row });
    }
  }

  const today = new Date();
  let idCounter = 0;

  while (containers.length < targetCount && availableCells.length > 0) {
    const idx = randomNumber(0, availableCells.length - 1);
    const cell = availableCells[idx];
    const col = cell.col;
    const row = cell.row;
    const nextTier = cellTopTier[col][row] + 1;

    if (nextTier >= YARD_CONFIG.maxTiers) {
      availableCells.splice(idx, 1);
      continue;
    }

    const arrivalDate = new Date(today);
    arrivalDate.setDate(arrivalDate.getDate() - randomNumber(1, 30));

    const departureDate = new Date(today);
    departureDate.setDate(departureDate.getDate() + randomNumber(1, 20));

    containers.push({
      id: `container-${idCounter}`,
      containerNo: generateContainerNo(),
      type: TYPES[randomNumber(0, TYPES.length - 1)],
      status: STATUSES[randomNumber(0, STATUSES.length - 1)],
      owner: OWNERS[randomNumber(0, OWNERS.length - 1)],
      arrivalDate: formatDate(arrivalDate),
      departureDate: formatDate(departureDate),
      position: { col, row, tier: nextTier },
    });

    cellTopTier[col][row] = nextTier;
    idCounter++;
  }

  return containers;
}

export function getStatistics(containers: Container[]) {
  const totalCapacity =
    YARD_CONFIG.cols * YARD_CONFIG.rows * YARD_CONFIG.maxTiers;
  const totalCount = containers.length;
  const occupancyRate = (totalCount / totalCapacity) * 100;

  const statusCounts: Record<ContainerStatus, number> = {
    import: 0,
    export: 0,
    transit: 0,
    empty: 0,
  };

  const colCounts: number[] = new Array(YARD_CONFIG.cols).fill(0);
  const colCapacity = YARD_CONFIG.rows * YARD_CONFIG.maxTiers;

  let totalTiers = 0;

  containers.forEach((c) => {
    statusCounts[c.status]++;
    colCounts[c.position.col]++;
    totalTiers += c.position.tier + 1;
  });

  const avgHeight = totalCount > 0 ? (totalTiers / totalCount).toFixed(2) : "0";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const threeDaysLater = new Date(today);
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);

  const soonDeparting = containers
    .filter((c) => {
      const depDate = new Date(c.departureDate);
      depDate.setHours(0, 0, 0, 0);
      return depDate >= today && depDate <= threeDaysLater;
    })
    .sort(
      (a, b) =>
        new Date(a.departureDate).getTime() -
        new Date(b.departureDate).getTime(),
    )
    .slice(0, 10);

  const colOccupancy = colCounts.map((count, idx) => ({
    col: idx + 1,
    count,
    rate: ((count / colCapacity) * 100).toFixed(1),
  }));

  return {
    totalCapacity,
    totalCount,
    occupancyRate: occupancyRate.toFixed(1),
    statusCounts,
    colOccupancy,
    avgHeight,
    soonDeparting,
  };
}
