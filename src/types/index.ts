export interface Metric {
  id: string;
  date: string; // ISO string format (YYYY-MM-DD)
  value: number;
  notes?: string;
}

export interface GoogleSheetsData {
  date: string;
  value: number;
  notes?: string;
}
