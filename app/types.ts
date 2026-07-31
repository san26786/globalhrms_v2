export interface Employee {
  id: string;
  name: string;
  avatar: string;
  role: string;
  outdoorReason: string;
  date: string;
}

export interface DeptEngagement {
  department: string;
  percentage: number;
  color: string;
  count: number;
}

export interface SalarySlab {
  range: string;
  count: number;
}

export interface JoiningTrend {
  year: number;
  count: number;
}
