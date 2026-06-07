export type ContainerStatus = "import" | "export" | "transit" | "empty";

export type ContainerType = "20GP" | "40GP" | "40HQ";

export interface Container {
  id: string;
  containerNo: string;
  type: ContainerType;
  status: ContainerStatus;
  owner: string;
  arrivalDate: string;
  departureDate: string;
  position: {
    col: number;
    row: number;
    tier: number;
  };
}

export interface YardCell {
  col: number;
  row: number;
  containers: Container[];
}

export const STATUS_COLORS: Record<ContainerStatus, string> = {
  import: "#3498db",
  export: "#e74c3c",
  transit: "#f1c40f",
  empty: "#95a5a6",
};

export const STATUS_LABELS: Record<ContainerStatus, string> = {
  import: "进口箱",
  export: "出口箱",
  transit: "中转箱",
  empty: "空箱",
};

export const YARD_CONFIG = {
  cols: 10,
  rows: 20,
  maxTiers: 5,
  containerWidth: 3,
  containerDepth: 6,
  containerHeight: 2.6,
  gap: 0.3,
};
